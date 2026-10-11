import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { resolveRoutePath } from "@testcenter-rewrite-app/contracts";
import { parseParticipantRunCommand, participantCommandExecutionRoute } from "@testcenter-rewrite-app/contracts/participant-run-command";

const source = readFileSync(new URL("../apps/web/src/app/participant-command-execution.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("execution.ts", source, ts.ScriptTarget.Latest, true);
const declaration = ast.statements.filter(ts.isVariableStatement).flatMap(item => [...item.declarationList.declarations])
  .find(item => item.name.getText(ast) === "executeReceivedParticipantCommand");
assert.ok(declaration?.initializer);
const compiled = ts.transpileModule(`export const load = (parseParticipantRunCommand, participantCommandExecutionRoute, resolveRoutePath, readParticipantSessionCredential, fetch) => (${declaration.initializer.getText(ast)});`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
}).outputText;
const { load } = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));
const command = () => parseParticipantRunCommand({
  tenantId: "owned-tenant", workspaceId: "owned-workspace", participantSessionId: "owned-session", testRunId: "owned-run",
  commandId: "owned-command", commandType: "resume", targetUnitKey: null, remainingSeconds: null, actorId: "owned-monitor",
  sequence: 1, issuedAt: "2026-10-11T00:00:00.000Z", acknowledgedAt: "2026-10-11T00:00:01.000Z", effectsDeferred: true
});
const application = () => ({ application: {
  command: { ...command(), executedAt: "2026-10-11T00:00:02.000Z", executionSequence: 1 }, applied: true,
  testRun: { tenantId: "owned-tenant", workspaceId: "owned-workspace", participantSessionId: "owned-session", testRunId: "owned-run" },
  participantSession: { tenantId: "owned-tenant", workspaceId: "owned-workspace", participantSessionId: "owned-session" }
} });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const fixture = (respond = async () => ({ ok: true, json: async () => application() })) => {
  const controller = new AbortController(), calls = [], events = [];
  let current = true;
  const execute = load(parseParticipantRunCommand, participantCommandExecutionRoute, resolveRoutePath,
    sessionId => { assert.equal(sessionId, "owned-session"); return "owned-credential"; },
    async (url, request) => { calls.push({ url, request }); events.push("request"); return respond(url, request); });
  const options = { isCurrent: () => current, controllerStatus: () => "ERROR",
    prepare: async () => { events.push("saved"); }, apply: async () => { events.push("projected"); } };
  return { calls, events, controller, options, execute: () => execute(command(), controller.signal, options), leave: () => { current = false; } };
};

test("accepted command application drains first and authenticates the exact selected Run", async () => {
  const f = fixture(); await f.execute();
  assert.deepEqual(f.events, ["saved", "request", "projected"]);
  const { url, request } = f.calls[0];
  assert.equal(url, "/api/v1/participant/sessions/owned-session/commands/owned-command/application");
  assert.equal(request.method, "POST"); assert.equal(request.cache, "no-store");
  assert.equal(request.headers.authorization, "Bearer owned-credential");
  assert.equal(request.signal, f.controller.signal);
  assert.deepEqual(JSON.parse(request.body), { testRunId: "owned-run", controllerStatus: "ERROR" });
});

test("a durable duplicate receipt still restores an interrupted local projection", async () => {
  const f = fixture(async () => ({ ok: true, json: async () => ({ application: { ...application().application, applied: false } }) }));
  await f.execute(); assert.deepEqual(f.events, ["saved", "request", "projected"]);
});

for (const interruption of ["abort", "scope"]) {
  test(`command application sends nothing after ${interruption} while draining`, async () => {
    const held = deferred(), f = fixture();
    f.options.prepare = () => held.promise;
    const pending = f.execute();
    if (interruption === "abort") f.controller.abort(); else f.leave();
    held.resolve(); await pending; assert.deepEqual(f.calls, []); assert.deepEqual(f.events, []);
  });
  test(`a parsed application reply cannot project after ${interruption}`, async () => {
    const held = deferred(), entered = deferred();
    const f = fixture(async () => ({ ok: true, json: () => { entered.resolve(); return held.promise; } }));
    const pending = f.execute(); await entered.promise;
    if (interruption === "abort") f.controller.abort(); else f.leave();
    held.resolve(application()); await pending; assert.deepEqual(f.events, ["saved", "request"]);
  });
}

for (const status of [401, 404, 409, 500, 503]) {
  test(`HTTP ${status} never authorizes a UI effect and classifies retry correctly`, async () => {
    const f = fixture(async () => ({ ok: false, status }));
    await assert.rejects(f.execute(), error => error.retryable === (status >= 500));
    assert.deepEqual(f.events, ["saved", "request"]);
  });
}

test("foreign, forged and incomplete execution replies permanently reject projection", async () => {
  const changes = [
    value => { value.application.command.commandType = "pause"; },
    value => { value.application.command.commandId = "foreign"; },
    value => { value.application.command.actorId = "foreign"; },
    value => { value.application.command.acknowledgedAt = "2026-10-11T00:00:03.000Z"; },
    value => { value.application.command.executedAt = null; },
    value => { value.application.command.executionSequence = 0; },
    value => { value.application.applied = "true"; },
    ...["tenantId", "workspaceId", "participantSessionId", "testRunId"].map(key => value => { value.application.testRun[key] = "foreign"; }),
    ...["tenantId", "workspaceId", "participantSessionId"].map(key => value => { value.application.participantSession[key] = "foreign"; }),
    value => { delete value.application.participantSession; }, value => { delete value.application.command; }
  ];
  for (const change of changes) {
    const value = application(); change(value);
    const f = fixture(async () => ({ ok: true, json: async () => value }));
    await assert.rejects(f.execute(), error => error.retryable === false);
    assert.deepEqual(f.events, ["saved", "request"]);
  }
  for (const value of [null, {}, { application: null }]) {
    const f = fixture(async () => ({ ok: true, json: async () => value }));
    await assert.rejects(f.execute(), error => error.retryable === false);
  }
});

test("save drain failure cannot issue a command application request", async () => {
  const failure = new Error("Owned pending answer could not be saved"), f = fixture();
  f.options.prepare = async () => { throw failure; };
  await assert.rejects(f.execute(), failure); assert.deepEqual(f.calls, []);
});

for (const substituted of [false, true]) test(`debug does not drain Player answers and ${substituted ? "rejects" : "accepts"} the argument receipt`, async () => {
  const debug = parseParticipantRunCommand({ ...command(), commandType: "debug", debugArguments: ["OFF", "Exact Ä/β\n\";"] });
  const reply = application();
  reply.application.command = { ...debug, debugArguments: substituted ? ["on"] : [...debug.debugArguments],
    executedAt: "2026-10-11T00:00:02.000Z", executionSequence: 1 };
  let requests = 0, effects = 0;
  const execute = load(parseParticipantRunCommand, participantCommandExecutionRoute, resolveRoutePath, () => "owned-credential", async () => {
    requests++; return { ok: true, json: async () => structuredClone(reply) };
  });
  const pending = execute(debug, new AbortController().signal, { isCurrent: () => true, controllerStatus: () => "ERROR",
    prepare: () => assert.fail("A read-only debug command cannot wait on the Player answer drain."), apply: () => { effects++; } });
  if (substituted) await assert.rejects(pending, error => error.retryable === false); else await pending;
  assert.equal(requests, 1); assert.equal(effects, substituted ? 0 : 1);
});
