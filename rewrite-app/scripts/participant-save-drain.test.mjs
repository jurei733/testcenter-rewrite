import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { productionApiRoutes, resolveRoutePath } from "@testcenter-rewrite-app/contracts";

const transpile = source => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
}).outputText;
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
// Keep the production durable outbox. Only the worker transport is supplied by
// the host; the actual shipped worker has its own independent regression suite.
const workerUrl = moduleUrl(`
  export function queueParticipantSaveForBackgroundDelivery() {}
  export function removeParticipantSaveFromBackgroundDelivery() {}
  export function discardParticipantBackgroundSavesForRun() {}
`);
const outboxSource = readFileSync(new URL("../apps/web/src/app/participant-save-outbox.ts", import.meta.url), "utf8");
const outbox = await import(moduleUrl(transpile(outboxSource).replace(
  'from "./participant-save-background-sync"', `from ${JSON.stringify(workerUrl)}`
)));
const facadeSource = readFileSync(new URL("../apps/web/src/app/participant-view.facade.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("participant-view.facade.ts", facadeSource, ts.ScriptTarget.ES2022, true);
const declaration = ast.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "ParticipantViewFacade");
const methods = ["saveVeronaResponse", "scheduleVeronaSaveDrain", "clearVeronaSaveBuffer", "drainVeronaSaveQueue",
  "nextPersistentVeronaSave", "restorePersistentVeronaSave"].map(name => {
  const method = declaration?.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(ast) === name);
  assert.ok(method, `The production ${name} method must exist.`);
  return method.getText(ast);
});
const { createSaveHost } = await import(moduleUrl(transpile(`
  export const createSaveHost = (outbox, productionApiRoutes, resolveRoutePath, prettyPrintJson) => {
    const { createParticipantSaveOutboxEntry, persistParticipantSaveOutboxEntry, removeParticipantSaveOutboxEntry,
      queueParticipantSaveOutboxEntryForBackgroundDelivery, findParticipantSaveOutboxEntryForUnit,
      findParticipantSaveOutboxEntry } = outbox;
    return class SaveHost { ${methods.join("\n")} };
  };
`)));
const SaveHost = createSaveHost(outbox, productionApiRoutes, resolveRoutePath, value => JSON.stringify(value));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
};
const log = (unitKey, content) => ({ unitKey, originalUnitId: `authored-${unitKey}`,
  entries: [{ key: "UNIT_STATE", content, timeStamp: 1_791_411_000_000 }] });
const entry = (unitKey, overrides = {}) => outbox.createParticipantSaveOutboxEntry({
  testRunId: "selected-run", unitKey, response: `exact-${unitKey}\n ä🙂\u0000 `,
  status: "running", logs: [log(unitKey, `log-${unitKey}`)], ...overrides
});
const change = (unitKey, response, testRunId = "selected-run") => ({
  testRunId, unitKey, response, unitDataChanged: true, unitStateChanged: false, playerStateChanged: false
});
const withHost = async action => {
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const values = new Map();
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  Object.defineProperty(globalThis, "window", { configurable: true, value: { setTimeout, clearTimeout } });
  const host = new SaveHost();
  const currentState = {
    testRun: { testRunId: "selected-run", status: "running", unitResponses: {} },
    currentUnit: { unitKey: "2" }, bookletUnits: Array.from({ length: 28 }, (_, index) => ({ unitKey: String(index + 1) })),
    executionMode: { saveResponses: true }, availableActions: ["save_progress"]
  };
  const calls = { requests: [], persisted: 0, refreshed: 0, synchronized: [], actions: [] };
  host.readCurrentRunState = () => currentState;
  host.runtime = { currentUnitResponse: "", runtimeMonitorView: "" };
  host.pendingVeronaSave = null;
  host.optimisticVeronaResponse = null;
  host.queuedVeronaLogs = [];
  host.veronaSaveDrainPromise = null;
  host.veronaForegroundSaveSettlement = false;
  host.veronaSaveBufferTimeout = null;
  host.veronaSaveBufferDueAtMs = null;
  host.persistState = () => { calls.persisted++; };
  host.compactParticipantTestLogBatches = batches => batches;
  host.veronaBufferDelayMs = () => 0;
  host.syncRun = run => { calls.synchronized.push(run); };
  host.refreshCurrentStateInternal = async () => { calls.refreshed++; };
  host.viewState = { onActionAsync: action => { calls.actions.push(action()); } };
  host.requestState = { request: async (...args) => {
    const [, method, path, body, options] = args;
    assert.equal(method, "POST");
    assert.deepEqual(options, { quiet: true });
    calls.requests.push({ path, body });
    return host.respond(body, path);
  } };
  host.respond = body => ({ testRun: { testRunId: currentState.testRun.testRunId, unitResponses: { [body.responseUnitKey]: body.unitResponse } } });
  try { await action({ host, calls, currentState, storage }); }
  finally {
    host.clearVeronaSaveBuffer();
    if (previousStorage) Object.defineProperty(globalThis, "localStorage", previousStorage);
    else delete globalThis.localStorage;
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else delete globalThis.window;
  }
};

test("an older failed delivery cannot strand a new visible-Unit answer behind its existing drain", async () => {
  await withHost(async ({ host, calls, currentState }) => {
    const older = entry("8");
    assert.equal(outbox.persistParticipantSaveOutboxEntry(older), true);
    const firstRequest = deferred();
    host.respond = body => {
      if (calls.requests.length === 1) return firstRequest.promise;
      if (body.responseUnitKey === "8") throw new Error("this Unit remains blocked");
      return { testRun: { testRunId: "selected-run", unitResponses: { "2": body.unitResponse } } };
    };
    host.restorePersistentVeronaSave(currentState);
    const drain = host.veronaSaveDrainPromise;
    assert.ok(drain);
    host.queuedVeronaLogs.push({ testRunId: "selected-run", ...log("2", "new visible-Unit log") });
    host.saveVeronaResponse(change("2", "new visible answer\nä🙂\u0000 "));
    const newer = outbox.findParticipantSaveOutboxEntryForUnit("selected-run", "2");
    firstRequest.reject(new Error("older background Unit failed"));
    await drain;
    assert.deepEqual(calls.requests.map(request => request.body.responseUnitKey), ["8", "2", "8"]);
    assert.equal(calls.requests[1].body.deliveryId, newer.deliveryId);
    assert.equal(calls.requests[1].body.unitResponse, newer.response);
    assert.deepEqual(calls.requests[1].body.logs, newer.logs);
    assert.deepEqual(outbox.listParticipantSaveOutboxEntriesForRun("selected-run"), [older]);
    assert.equal(host.pendingVeronaSave.deliveryId, older.deliveryId);
    assert.equal(host.veronaSaveStatus, "queued_offline");
    assert.equal(host.veronaSaveDrainPromise, null);
  });
});

test("a failed delivery without a newly queued answer stops instead of busy retrying", async () => {
  await withHost(async ({ host, calls, currentState }) => {
    const older = entry("8");
    outbox.persistParticipantSaveOutboxEntry(older);
    host.respond = () => { throw new Error("network offline"); };
    host.restorePersistentVeronaSave(currentState);
    await host.veronaSaveDrainPromise;
    assert.equal(calls.requests.length, 1);
    assert.deepEqual(outbox.listParticipantSaveOutboxEntriesForRun("selected-run"), [older]);
    assert.equal(host.pendingVeronaSave.deliveryId, older.deliveryId);
    assert.equal(host.veronaSaveStatus, "queued_offline");
    assert.equal(host.veronaSaveDrainPromise, null);
  });
});

test("when both deliveries fail, the new answer gets one attempt and both exact packets remain durable", async () => {
  await withHost(async ({ host, calls, currentState }) => {
    const older = entry("8");
    outbox.persistParticipantSaveOutboxEntry(older);
    const firstRequest = deferred();
    host.respond = () => calls.requests.length === 1 ? firstRequest.promise : Promise.reject(new Error("still offline"));
    host.restorePersistentVeronaSave(currentState);
    const drain = host.veronaSaveDrainPromise;
    host.saveVeronaResponse(change("2", "new answer with whitespace \n🙂 "));
    const newer = outbox.findParticipantSaveOutboxEntryForUnit("selected-run", "2");
    firstRequest.reject(new Error("offline"));
    await drain;
    assert.deepEqual(calls.requests.map(request => request.body.deliveryId), [older.deliveryId, newer.deliveryId]);
    assert.deepEqual(outbox.listParticipantSaveOutboxEntriesForRun("selected-run"), [older, newer]);
    assert.equal(host.pendingVeronaSave.deliveryId, newer.deliveryId);
    assert.equal(host.veronaSaveStatus, "queued_offline");
    assert.equal(host.veronaSaveDrainPromise, null);
  });
});

test("requeueing the same delivery during its failed request does not manufacture a new attempt", async () => {
  await withHost(async ({ host, calls, currentState }) => {
    const older = entry("8");
    outbox.persistParticipantSaveOutboxEntry(older);
    const firstRequest = deferred();
    host.respond = () => firstRequest.promise;
    host.restorePersistentVeronaSave(currentState);
    const drain = host.veronaSaveDrainPromise;
    host.pendingVeronaSave = older;
    firstRequest.reject(new Error("offline"));
    await drain;
    assert.equal(calls.requests.length, 1);
    assert.equal(host.pendingVeronaSave.deliveryId, older.deliveryId);
    assert.equal(host.veronaSaveStatus, "queued_offline");
  });
});

test("a newer same-Unit packet is delivered with its own exact identity rather than the failed older response", async () => {
  await withHost(async ({ host, calls, currentState }) => {
    const older = entry("2", { logs: [] });
    outbox.persistParticipantSaveOutboxEntry(older);
    const firstRequest = deferred();
    host.respond = body => calls.requests.length === 1 ? firstRequest.promise : {
      testRun: { testRunId: "selected-run", unitResponses: { "2": body.unitResponse } }
    };
    host.restorePersistentVeronaSave(currentState);
    const drain = host.veronaSaveDrainPromise;
    host.saveVeronaResponse(change("2", "latest same-Unit answer"));
    const newer = outbox.findParticipantSaveOutboxEntryForUnit("selected-run", "2");
    firstRequest.reject(new Error("old attempt failed"));
    await drain;
    assert.deepEqual(calls.requests.map(request => request.body.deliveryId), [older.deliveryId, newer.deliveryId]);
    assert.equal(calls.requests[1].body.unitResponse, newer.response);
    assert.deepEqual(outbox.listParticipantSaveOutboxEntriesForRun("selected-run"), []);
    assert.equal(host.pendingVeronaSave, null);
    assert.equal(host.veronaSaveStatus, "saved");
  });
});

test("foreground settlement still pauses automatic delivery of the newer packet", async () => {
  await withHost(async ({ host, calls, currentState }) => {
    const older = entry("8");
    outbox.persistParticipantSaveOutboxEntry(older);
    const firstRequest = deferred();
    host.respond = () => calls.requests.length === 1 ? firstRequest.promise : Promise.reject(new Error("offline"));
    host.restorePersistentVeronaSave(currentState);
    const drain = host.veronaSaveDrainPromise;
    host.saveVeronaResponse(change("2", "new answer before navigation"));
    const newer = outbox.findParticipantSaveOutboxEntryForUnit("selected-run", "2");
    host.veronaForegroundSaveSettlement = true;
    firstRequest.reject(new Error("offline"));
    await drain;
    assert.equal(calls.requests.length, 1);
    assert.equal(host.pendingVeronaSave.deliveryId, newer.deliveryId);
    await host.drainVeronaSaveQueue({ allowForegroundSettlement: true, refreshCurrentState: false });
    assert.equal(calls.requests.length, 2);
    assert.equal(calls.requests[1].body.deliveryId, newer.deliveryId);
    assert.deepEqual(outbox.listParticipantSaveOutboxEntriesForRun("selected-run"), [older, newer]);
  });
});

test("a foreign Run or unknown Unit cannot inject a replacement while the selected request is pending", async () => {
  await withHost(async ({ host, calls, currentState }) => {
    const older = entry("8");
    const sibling = entry("2", { testRunId: "sibling-run" });
    outbox.persistParticipantSaveOutboxEntry(older);
    outbox.persistParticipantSaveOutboxEntry(sibling);
    const firstRequest = deferred();
    host.respond = () => firstRequest.promise;
    host.restorePersistentVeronaSave(currentState);
    const drain = host.veronaSaveDrainPromise;
    host.saveVeronaResponse(change("2", "must not send", "foreign-run"));
    host.saveVeronaResponse(change("unknown", "must not send"));
    firstRequest.reject(new Error("offline"));
    await drain;
    assert.equal(calls.requests.length, 1);
    assert.deepEqual(outbox.listParticipantSaveOutboxEntriesForRun("selected-run"), [older]);
    assert.deepEqual(outbox.listParticipantSaveOutboxEntriesForRun("sibling-run"), [sibling]);
  });
});

test("a storage failure surfaces save_failed without preventing the newer packet's own network attempt", async () => {
  await withHost(async ({ host, calls, currentState, storage }) => {
    const older = entry("8");
    outbox.persistParticipantSaveOutboxEntry(older);
    const firstRequest = deferred();
    host.respond = () => calls.requests.length === 1 ? firstRequest.promise : Promise.reject(new Error("offline"));
    host.restorePersistentVeronaSave(currentState);
    const drain = host.veronaSaveDrainPromise;
    storage.setItem = () => { throw new Error("quota exceeded"); };
    host.saveVeronaResponse(change("2", "exact unsaved newest answer\nä🙂 "));
    const newer = host.pendingVeronaSave;
    firstRequest.reject(new Error("offline"));
    await drain;
    assert.deepEqual(calls.requests.map(request => request.body.deliveryId), [older.deliveryId, newer.deliveryId]);
    assert.equal(host.pendingVeronaSave.response, newer.response);
    assert.equal(host.veronaSaveStatus, "save_failed");
    assert.deepEqual(outbox.listParticipantSaveOutboxEntriesForRun("selected-run"), [older]);
  });
});

test("a partial 28-Unit reload keeps exactly 21 blocked packets after the visible Unit is re-emitted", async () => {
  await withHost(async ({ host, calls, currentState }) => {
    const queuedAt = Date.now();
    const blocked = Array.from({ length: 21 }, (_, index) => ({
      ...entry(String(index + 8)), queuedAt: new Date(queuedAt + index).toISOString()
    }));
    const sibling = entry("2", { testRunId: "another-run", response: "another Run's exact answer" });
    for (const packet of [...blocked, sibling]) assert.equal(outbox.persistParticipantSaveOutboxEntry(packet), true);
    currentState.testRun.unitResponses = Object.fromEntries(
      Array.from({ length: 7 }, (_, index) => [String(index + 1), `already delivered-${index + 1}`])
    );
    const firstRequest = deferred();
    host.respond = body => {
      if (calls.requests.length === 1) return firstRequest.promise;
      if (body.responseUnitKey !== "2") throw new Error("undelivered Units remain blocked");
      return { testRun: { testRunId: "selected-run", unitResponses: {
        ...currentState.testRun.unitResponses, "2": body.unitResponse
      } } };
    };
    host.restorePersistentVeronaSave(currentState);
    const drain = host.veronaSaveDrainPromise;
    host.saveVeronaResponse(change("2", "visible restored answer\n ä🙂 "));
    assert.equal(outbox.listParticipantSaveOutboxEntriesForRun("selected-run").length, 22);
    firstRequest.reject(new Error("blocked Unit 8"));
    await drain;
    assert.deepEqual(calls.requests.map(request => request.body.responseUnitKey), ["8", "2", "8"]);
    assert.deepEqual(outbox.listParticipantSaveOutboxEntriesForRun("selected-run"), blocked);
    assert.deepEqual(outbox.listParticipantSaveOutboxEntriesForRun("another-run"), [sibling]);
    assert.equal(host.pendingVeronaSave.deliveryId, blocked[0].deliveryId);
    assert.equal(host.veronaSaveStatus, "queued_offline");
  });
});
