import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const dataModule = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const transpile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, experimentalDecorators: true }
}).outputText;
const watchdogUrl = dataModule(transpile("../apps/web/src/app/event-stream-watchdog.ts"));
const { createEventStreamWatchdog, EVENT_STREAM_MAX_SILENCE_MS } = await import(watchdogUrl);
const coreUrl = dataModule(`
  export const Injectable = () => target => target;
  export const inject = () => globalThis.__eventStreamTestHost;
  export const signal = initial => {
    let value = initial; const read = () => value;
    read.set = next => { value = next; }; read.asReadonly = () => read; return read;
  };
`);
const stateUrl = dataModule("export class RewriteAppUiStateService {}");
const credentialsUrl = dataModule(transpile("../apps/web/src/app/participant-access-credentials.ts"));
const contractsUrl = import.meta.resolve("@testcenter-rewrite-app/contracts");
const loadService = async name => {
  // Only Angular injection/signal storage is stubbed. The production service,
  // credential reader, event parsers and watchdog execute unchanged.
  const source = transpile(`../apps/web/src/app/${name}-event-stream.service.ts`)
    .replace('"@angular/core"', JSON.stringify(coreUrl))
    .replace('"@testcenter-rewrite-app/contracts"', JSON.stringify(contractsUrl))
    .replace('"./rewrite-app-ui-state.service"', JSON.stringify(stateUrl))
    .replace('"./participant-access-credentials"', JSON.stringify(credentialsUrl))
    .replace('"./event-stream-watchdog"', JSON.stringify(watchdogUrl));
  const module = await import(dataModule(source));
  return module[name === "participant" ? "ParticipantEventStreamService" : "MonitorEventStreamService"];
};
const Service = { participant: await loadService("participant"), monitor: await loadService("monitor") };
const flush = async () => { await new Promise(done => setImmediate(done)); await new Promise(done => setImmediate(done)); };

const withClock = async action => {
  const previous = { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout,
    window: globalThis.window, fetch: globalThis.fetch, host: globalThis.__eventStreamTestHost,
    navigator: Object.getOwnPropertyDescriptor(globalThis, "navigator") };
  let now = 0, nextId = 1;
  const timers = new Map();
  const setTimer = (callback, ms) => { const id = nextId++; timers.set(id, { callback, at: now + ms, ms }); return id; };
  globalThis.setTimeout = setTimer;
  globalThis.clearTimeout = id => timers.delete(id);
  globalThis.window = { setTimeout: setTimer, clearTimeout: id => timers.delete(id) };
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { onLine: true } });
  const advance = async milliseconds => {
    const target = now + milliseconds;
    while (true) {
      const due = [...timers].filter(([, item]) => item.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      now = due[1].at; timers.delete(due[0]); due[1].callback(); await flush();
    }
    now = target; await flush();
  };
  try { await action({ timers, advance }); }
  finally {
    globalThis.setTimeout = previous.setTimeout; globalThis.clearTimeout = previous.clearTimeout;
    globalThis.fetch = previous.fetch;
    if (previous.window === undefined) delete globalThis.window; else globalThis.window = previous.window;
    if (previous.host === undefined) delete globalThis.__eventStreamTestHost; else globalThis.__eventStreamTestHost = previous.host;
    if (previous.navigator === undefined) delete globalThis.navigator; else Object.defineProperty(globalThis, "navigator", previous.navigator);
  }
};

test("SSE watchdog aborts at exactly one minute, never before it", async () => withClock(async clock => {
  assert.equal(EVENT_STREAM_MAX_SILENCE_MS, 60_000);
  const controller = new AbortController(), watchdog = createEventStreamWatchdog(controller);
  await clock.advance(59_999); assert.equal(controller.signal.aborted, false);
  await clock.advance(1); assert.equal(controller.signal.aborted, true); assert.equal(watchdog.timedOut, true);
  assert.equal(controller.signal.reason.message, "Live channel heartbeat timed out.");
  assert.equal(clock.timers.size, 0);
}));

test("valid SSE activity replaces the deadline and stale callbacks cannot abort a healthy channel", async () => withClock(async clock => {
  const controller = new AbortController(), watchdog = createEventStreamWatchdog(controller);
  const stale = [...clock.timers.values()][0].callback;
  await clock.advance(15_000); watchdog.receivedEvent(); stale();
  assert.equal(controller.signal.aborted, false);
  await clock.advance(59_999); assert.equal(controller.signal.aborted, false);
  await clock.advance(1); assert.equal(watchdog.timedOut, true);
}));

test("stop and deliberate abort remove deadlines without reporting an expired channel", async () => withClock(async clock => {
  for (const stop of [watchdog => watchdog.stop(), (_watchdog, controller) => controller.abort()]) {
    const controller = new AbortController(), watchdog = createEventStreamWatchdog(controller);
    stop(watchdog, controller); watchdog.receivedEvent(); await clock.advance(120_000);
    assert.equal(watchdog.timedOut, false); assert.equal(clock.timers.size, 0);
  }
  const controller = new AbortController(); controller.abort();
  assert.equal(createEventStreamWatchdog(controller).timedOut, false); assert.equal(clock.timers.size, 0);
}));

test("an expired SSE watchdog cannot be resurrected by queued activity", async () => withClock(async clock => {
  const controller = new AbortController(), watchdog = createEventStreamWatchdog(controller);
  let aborts = 0; controller.signal.addEventListener("abort", () => { aborts += 1; });
  await clock.advance(60_000); watchdog.receivedEvent(); await clock.advance(120_000);
  assert.equal(aborts, 1); assert.equal(clock.timers.size, 0);
}));

const withService = async (kind, action, stallHeaders = false) => withClock(async clock => {
  const host = { workspace: { tenantKey: "tenant-a", workspaceKey: "workspace-a" },
    ops: { adminSessionToken: "synthetic-operator-token" }, runtime: {}, renderVersion: { update() {} } };
  globalThis.__eventStreamTestHost = host;
  const requests = [], modes = [];
  let refreshes = 0;
  globalThis.fetch = async (path, options) => {
    const record = { path, options }; requests.push(record);
    if (stallHeaders) return new Promise((_done, reject) => options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true }));
    const body = new ReadableStream({ start(controller) { record.stream = controller; } });
    options.signal.addEventListener("abort", () => record.stream.error(options.signal.reason), { once: true });
    return { ok: true, status: 200, body, headers: new Headers({ "content-type": "text/event-stream; charset=utf-8" }) };
  };
  const service = new Service[kind]();
  const start = () => kind === "participant"
    ? service.start("session-a", async () => { refreshes += 1; }, mode => modes.push(mode))
    : service.start(async () => { refreshes += 1; });
  const event = overrides => ({ schemaVersion: 1, eventType: "heartbeat", sequence: 1,
    tenantKey: "tenant-a", workspaceKey: "workspace-a", participantSessionId: "session-a", testRunId: "run-a",
    emittedAt: "2026-10-04T12:00:00Z", revision: "a".repeat(64), openRunCount: 2, ...overrides });
  const send = async data => {
    requests.at(-1).stream.enqueue(new TextEncoder().encode(`data: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`));
    await flush();
  };
  const status = () => kind === "participant" ? service.connectionState().status : host.runtime.monitorConnectionStatus;
  start(); await clock.advance(kind === "participant" ? 1_000 : 0);
  try { await action({ ...clock, service, host, requests, modes, event, send, status, refreshes: () => refreshes }); }
  finally { service.stop(); await flush(); assert.equal(clock.timers.size, 0); }
});

for (const kind of ["participant", "monitor"]) {
  test(`${kind} silent channel leaves live state, refreshes quietly and reconnects with the same credential`, async () => withService(kind, async host => {
    assert.equal(host.status(), "live");
    await host.advance(59_999); assert.equal(host.status(), "live");
    await host.advance(1); assert.equal(host.status(), kind === "participant" ? "reconnecting" : "polling");
    assert.equal(host.requests[0].options.signal.aborted, true); assert.equal(host.refreshes(), 1);
    if (kind === "participant") assert.deepEqual(host.modes, ["WEBSOCKET", "POLLING"]);
    await host.advance(3_000); assert.equal(host.requests.length, 2); assert.equal(host.status(), "live");
    assert.deepEqual(host.requests[1].options.headers, host.requests[0].options.headers);
  }));

  test(`${kind} deadline also covers a fetch that never receives headers`, async () => withService(kind, async host => {
    await host.advance(60_000);
    assert.equal(host.requests[0].options.signal.aborted, true);
    assert.equal(host.status(), kind === "participant" ? "reconnecting" : "polling");
    assert.equal(host.refreshes(), 1);
  }, true));

  test(`${kind} only a valid correctly scoped event renews the heartbeat deadline`, async () => withService(kind, async host => {
    await host.advance(59_000);
    await host.send(host.event({ eventType: "snapshot" })); assert.equal(host.refreshes(), 1);
    await host.advance(59_000); assert.equal(host.status(), "live");
    for (const malformed of ["invalid JSON", host.event({ schemaVersion: 999 }), host.event(kind === "participant"
      ? { participantSessionId: "another-session" } : { workspaceKey: "another-workspace", openRunCount: 999 }),
      ...(kind === "monitor" ? [host.event({ tenantKey: "another-tenant", openRunCount: 999 })] : [])]) await host.send(malformed);
    assert.equal(host.refreshes(), 1, "Invalid or out-of-scope frames must not refresh protected reads.");
    if (kind === "monitor") assert.equal(host.host.runtime.monitorConnectionOpenRunCount, 2);
    await host.advance(1_000); assert.notEqual(host.status(), "live");
  }));

  test(`${kind} manual stop cancels a blocked read and deadline without retry or state resurrection`, async () => withService(kind, async host => {
    host.service.stop(); await host.advance(120_000);
    assert.equal(host.status(), "idle"); assert.equal(host.requests.length, 1); assert.equal(host.refreshes(), 0);
    assert.equal(host.requests[0].options.signal.aborted, true);
  }));

  test(`${kind} heartbeat expiry while offline retains retry protection and reports the offline state`, async () => withService(kind, async host => {
    globalThis.navigator.onLine = false;
    await host.advance(60_000);
    assert.equal(host.status(), "offline"); assert.equal(host.refreshes(), 1);
    assert.equal(host.requests[0].options.signal.aborted, true);
    if (kind === "participant") assert.deepEqual(host.modes, ["WEBSOCKET", "POLLING"]);
  }));

  test(`${kind} an old generation cannot apply a buffered event after the view stops`, async () => withService(kind, async host => {
    const generation = host.service.generation;
    host.service.stop();
    const before = JSON.stringify(host.host.runtime);
    assert.equal(host.service.handleFrame(`data: ${JSON.stringify(host.event({ eventType: "change", openRunCount: 999 }))}`,
      kind === "participant" ? generation : { generation, tenantKey: "tenant-a", workspaceKey: "workspace-a" }), false);
    assert.equal(JSON.stringify(host.host.runtime), before);
    assert.equal(host.status(), "idle"); assert.equal(host.refreshes(), 0);
  }));
}
