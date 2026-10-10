import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { parseParticipantRunCommand } from "@testcenter-rewrite-app/contracts/participant-run-command";
import { productionApiRoutes, resolveRoutePath, parseParticipantEventStreamEvent } from "@testcenter-rewrite-app/contracts";

const source = readFileSync(new URL("../apps/web/src/app/participant-command-receiver.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("receiver.ts", source, ts.ScriptTarget.ES2022, true);
const declarations = ast.statements.filter(ts.isVariableStatement).flatMap(statement => [...statement.declarationList.declarations]);
const factory = declarations.find(declaration => declaration.name.getText(ast) === "createParticipantCommandReceiver");
assert.ok(factory?.initializer);
const moduleSource = `export const load = parseParticipantRunCommand => (${factory.initializer.getText(ast)});`;
const compiled = ts.transpileModule(moduleSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { load } = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));
const createReceiver = load(parseParticipantRunCommand);
const channelFactory = declarations.find(declaration => declaration.name.getText(ast) === "createParticipantCommandChannel");
assert.ok(channelFactory?.initializer);
const channelModule = ts.transpileModule(`export const load = (createParticipantCommandReceiver, productionApiRoutes, resolveRoutePath, withSelectedParticipantRun, fetch) => (${channelFactory.initializer.getText(ast)});`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
}).outputText;
const { load: loadChannel } = await import("data:text/javascript;base64," + Buffer.from(channelModule).toString("base64"));
const linksModule = ts.transpileModule(readFileSync(new URL("../apps/web/src/app/participant-session-links.ts", import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
}).outputText;
const { withSelectedParticipantRun } = await import("data:text/javascript;base64," + Buffer.from(linksModule).toString("base64"));
const createChannel = fetch => loadChannel(createReceiver, productionApiRoutes, resolveRoutePath, withSelectedParticipantRun, fetch);
const deferred = () => { let resolve, reject; const promise = new Promise((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; };
const command = (sequence, type = "resume", extra = {}) => ({ tenantId: "owned", workspaceId: "owned",
  participantSessionId: "owned-session", testRunId: "owned-run", commandId: `command-${sequence}`, commandType: type,
  sequence, targetUnitKey: null, remainingSeconds: null, actorId: null, issuedAt: "2026-10-11T00:00:00.000Z",
  acknowledgedAt: null, ...extra });
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
const fixture = () => {
  let time = 0;
  const timers = [], started = [], effects = [], requests = new Map();
  const receiver = createReceiver({ participantSessionId: "owned-session", testRunId: "owned-run", now: () => time,
    schedule(callback, delay) { const entry = { at: time + delay, callback, canceled: false }; timers.push(entry); return () => { entry.canceled = true; }; },
    acknowledge(record, signal) { const request = deferred(); requests.set(record.commandId, { ...request, record, signal }); started.push({ id: record.commandId, at: time }); return request.promise; },
    execute: record => effects.push(record) });
  const advance = value => { time = value; for (const entry of timers) { if (!entry.canceled && entry.at <= time) { entry.canceled = true; entry.callback(); } } };
  const acknowledge = (sequence, extra = {}) => { const request = requests.get(`command-${sequence}`); request.resolve({ ...request.record, acknowledgedAt: "2026-10-11T00:00:01.000Z", ...extra }); };
  return { receiver, started, effects, requests, advance, acknowledge };
};

for (const reversed of [false, true]) {
  test(`accepted commands execute in ${reversed ? "reversed" : "normal"} ACK completion order`, async () => {
    const f = fixture();
    f.receiver.accept([command(1, "pause"), command(2, "resume")]);
    assert.deepEqual(f.started, [{ id: "command-1", at: 0 }]);
    f.advance(999); assert.equal(f.started.length, 1);
    f.advance(1000); assert.deepEqual(f.started, [{ id: "command-1", at: 0 }, { id: "command-2", at: 1000 }]);
    assert.equal(f.effects.length, 0);
    assert.equal(f.receiver.hasOutstanding(), true);
    for (const id of reversed ? [2, 1] : [1, 2]) { f.acknowledge(id); await flush(); }
    const original = JSON.parse(readFileSync(new URL("./fixtures/original-runtime-command-order.json", import.meta.url), "utf8"));
    const expected = original.cases[reversed ? "queued-pause-resume-reversed-acks" : "queued-pause-resume"];
    assert.deepEqual(f.effects.map(record => record.commandType), expected.commandEffects);
    assert.equal(f.receiver.hasOutstanding(), false);
    f.receiver.stop();
  });
}

test("accepted records cannot alias a later frame and replay does not issue duplicate ACKs", async () => {
  const f = fixture(), records = [command(1), command(2)];
  f.receiver.accept(records); f.receiver.accept(records);
  records[1].commandType = "pause";
  f.acknowledge(1); await flush(); f.advance(1000); f.acknowledge(2); await flush();
  assert.deepEqual(f.started.map(item => item.id), ["command-1", "command-2"]);
  assert.deepEqual(f.effects.map(item => item.commandType), ["resume", "resume"]);
  f.receiver.accept([command(1), command(2)]); assert.equal(f.started.length, 2);
  f.receiver.stop();
});

test("route cleanup cancels scheduled ACKs and discards a successful response already in flight", async () => {
  const f = fixture(); f.receiver.accept([command(1), command(2)]);
  f.receiver.stop(); assert.equal(f.requests.get("command-1").signal.aborted, true);
  f.acknowledge(1); f.advance(1000); await flush();
  f.receiver.accept([command(3)]);
  assert.equal(f.started.length, 1); assert.equal(f.effects.length, 0);
  assert.equal(f.receiver.hasOutstanding(), false);
});

test("failed or mismatched receipts never authorize a command effect", async () => {
  for (const extra of [{ commandId: "foreign" }, { testRunId: "foreign" }, { commandType: "pause" },
    { acknowledgedAt: null }, { tenantId: "foreign" }, { actorId: "foreign" }]) {
    const f = fixture(); f.receiver.accept([command(1)]); f.acknowledge(1, extra); await flush();
    assert.deepEqual(f.effects, []); f.receiver.stop();
  }
  const f = fixture(); f.receiver.accept([command(1)]); f.requests.get("command-1").reject(new Error("Owned HTTP failure"));
  await flush(); assert.deepEqual(f.effects, []); f.receiver.stop();
});

for (const interruption of ["stopReception", "stop"]) {
  test(`${interruption} ${interruption === "stop" ? "discards" : "preserves"} an accepted HTTP ACK in flight`, async () => {
    const ack = deferred(), calls = [], effects = [];
    const channel = createChannel((url, request) => { calls.push({ url, request }); return ack.promise; })({
      participantSessionId: "owned-session", testRunId: "owned-run", readCredential: () => "owned-credential", execute: item => effects.push(item)
    });
    channel.accept([command(1)]);
    assert.equal(calls[0].url, "/api/v1/participant/sessions/owned-session/commands/command-1/acknowledgement");
    assert.equal(calls[0].request.method, "PATCH");
    assert.deepEqual(JSON.parse(calls[0].request.body), { testRunId: "owned-run" });
    assert.equal(calls[0].request.headers.authorization, "Bearer owned-credential");
    channel[interruption]();
    assert.equal(calls[0].request.signal.aborted, interruption === "stop");
    ack.resolve({ ok: true, json: async () => ({ command: { ...command(1), acknowledgedAt: "2026-10-11T00:00:01.000Z" } }) });
    await flush(); await flush();
    assert.equal(effects.length, interruption === "stop" ? 0 : 1);
    channel.stop();
  });
}

for (const interruption of ["stopReception", "stop", "generation"]) {
  test(`a late parsed polling reply starts no ACK after ${interruption}`, async () => {
    const body = deferred(), calls = [];
    let current = true;
    const channel = createChannel(async (url, request) => { calls.push({ url, request }); return { ok: true, json: () => body.promise }; })({
      participantSessionId: "owned-session", testRunId: "owned-run", readCredential: () => "owned-credential", execute: () => assert.fail("A late reply cannot execute")
    });
    const polling = channel.poll(() => current);
    await flush();
    assert.equal(new URL(calls[0].url, "https://example.test").searchParams.get("testRunId"), "owned-run");
    if (interruption === "generation") current = false;
    else channel[interruption]();
    body.resolve({ commands: [command(1)] }); await polling;
    assert.equal(calls.length, 1);
    assert.equal(channel.hasOutstanding(), false);
    channel.stop();
  });
}

const streamSource = readFileSync(new URL("../apps/web/src/app/participant-event-stream.service.ts", import.meta.url), "utf8");
const streamAst = ts.createSourceFile("stream.ts", streamSource, ts.ScriptTarget.ES2022, true);
const streamClass = streamAst.statements.find(ts.isClassDeclaration);
const streamMethods = ["suspend", "stop", "stopConnection", "resetCommands", "handleFrame"].map(name => {
  const method = streamClass.members.find(member => ts.isMethodDeclaration(member) && member.name.getText(streamAst) === name);
  assert.ok(method); return method.getText(streamAst);
}).join("\n");
const streamModule = ts.transpileModule(`export const load = parseParticipantEventStreamEvent => class Stream { ${streamMethods} };`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
}).outputText;
const { load: loadStream } = await import("data:text/javascript;base64," + Buffer.from(streamModule).toString("base64"));
const Stream = loadStream(parseParticipantEventStreamEvent);

for (const interruption of ["suspend", "stop"]) {
  test(`actual stream ${interruption} preserves only the authorized command lifecycle`, async () => {
    const f = fixture(); let receptionStopped = 0, refreshed = 0;
    const stream = Object.assign(new Stream(), { generation: 1, commandLifecycle: 0,
      activeParticipantSessionId: "owned-session", activeTestRunId: "owned-run", connectHandle: null, abortController: new AbortController(),
      commandReceiver: { ...f.receiver, stopReception: () => receptionStopped++ }, setConnectionState() {}, queueRefresh: () => refreshed++ });
    const frame = records => "data: " + JSON.stringify({ schemaVersion: 1, eventType: "change", sequence: 1,
      participantSessionId: "owned-session", testRunId: "owned-run", emittedAt: "2026-10-11T00:00:00.000Z", revision: "a".repeat(64), commands: records });
    assert.equal(stream.handleFrame(frame([command(1, "pause"), command(2)]), 1, () => {}), true);
    assert.equal(refreshed, 0);
    // The server has already persisted the ACK but its browser reply is held.
    assert.equal(stream.handleFrame(frame([]), 1, () => {}), true);
    assert.equal(refreshed, 0);
    stream[interruption](); assert.equal(receptionStopped, 1);
    assert.equal(stream.handleFrame(frame([command(3)]), 1, () => assert.fail("No new ACK after suspension")), false);
    f.advance(1000); f.acknowledge(1); if (interruption === "suspend") f.acknowledge(2);
    await flush();
    assert.deepEqual(f.effects.map(item => item.commandType), interruption === "suspend" ? ["pause", "resume"] : []);
    assert.equal(f.started.length, interruption === "suspend" ? 2 : 1);
    f.receiver.stop();
  });
}

test("malformed, foreign, acknowledged or nonordered deliveries start no ACK requests", () => {
  for (const records of [[command(1, "resume", { testRunId: "foreign" })], [command(1, "resume", { participantSessionId: "foreign" })],
    [command(1, "unknown")], [command(1, "resume", { sequence: -1 })], [command(1), command(1)],
    [command(2), command(1)], [command(1, "resume", { acknowledgedAt: "2026-10-11T00:00:01.000Z" })],
    [command(1), null], [command(1, "resume", { remainingSeconds: -1 })]]) {
    const f = fixture(); f.receiver.accept(records); assert.deepEqual(f.started, []); f.receiver.stop();
  }
});

test("the parser strips unknown fields and rejects invalid server timestamps", () => {
  const input = command(1, "resume", { untrusted: "removed" });
  const parsed = parseParticipantRunCommand(input); assert.ok(parsed); assert.equal("untrusted" in parsed, false);
  assert.equal(parseParticipantRunCommand({ ...input, issuedAt: "invalid" }), null);
  assert.equal(parseParticipantRunCommand({ ...input, acknowledgedAt: "invalid" }), null);
});
