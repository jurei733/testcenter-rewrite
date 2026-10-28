import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EventEmitter } from "node:events";
import { createServer, request } from "node:http";
import { setImmediate as nextTurn } from "node:timers/promises";
import test from "node:test";
import ts from "typescript";

const load = async source => {
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext
  }});
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
};
const { createRequestLifecycle } = await load(readFileSync(new URL("../apps/api/src/request-lifecycle.ts", import.meta.url), "utf8"));
const apiSource = readFileSync(new URL("../apps/api/src/index.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("index.ts", apiSource, ts.ScriptTarget.ES2022, true);
const shutdowns = [];
const visit = node => {
  if (ts.isPropertyAssignment(node) && node.name.getText(ast) === "shutdown" &&
      ts.isArrowFunction(node.initializer) && node.initializer.getText(ast).includes("presenceSweep")) {
    shutdowns.push(node.initializer.getText(ast));
  }
  ts.forEachChild(node, visit);
};
visit(ast);
assert.equal(shutdowns.length, 1, "Execute the actual production runtime shutdown closure.");
const { createShutdown } = await load(`export const createShutdown = (presenceSweepHandle, presenceSweep, repositoryConfig, requestLifecycle) => (${shutdowns[0]});`);
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

test("production shutdown keeps storage alive after the client socket closes until its handler finishes", async () => {
  const lifecycle = createRequestLifecycle(), entered = deferred(), release = deferred();
  const bytes = "Owned cancelled-request write: Ä/β 🧪\n\";";
  const writes = [], errors = [];
  let storageClosed = false;
  const handler = lifecycle.wrap(async (_req, res) => {
    entered.resolve();
    await release.promise;
    assert.equal(storageClosed, false, "Client disconnect must not close the handler's repository.");
    writes.push(bytes);
    res.end("Owned completed operation");
  });
  const server = createServer((req, res) => { void handler(req, res).catch(error => errors.push(error)); });
  const shutdown = createShutdown(undefined, Promise.resolve(), {
    shutdown: async () => { storageClosed = true; }
  }, lifecycle);
  let client;
  try {
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    client = request(`http://127.0.0.1:${server.address().port}/owned-write`);
    client.on("error", () => {});
    client.end();
    await entered.promise;
    client.destroy();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    const closing = shutdown();
    await nextTurn();
    assert.equal(storageClosed, false, "HTTP server close must not outpace the asynchronous handler.");
    release.resolve();
    await closing;
    assert.equal(storageClosed, true);
    assert.deepEqual(writes, [bytes]);
    assert.deepEqual(errors, []);
  } finally {
    client?.destroy();
    release.resolve();
    await lifecycle.drain();
    if (server.listening) await new Promise(resolve => server.close(resolve));
  }
});

test("handler rejection reaches its caller and cannot strand shutdown", async () => {
  const lifecycle = createRequestLifecycle(), release = deferred();
  const failure = new Error("Owned rejected operation");
  const operation = lifecycle.wrap(async () => { await release.promise; throw failure; })();
  const rejected = assert.rejects(operation, error => error === failure);
  const draining = lifecycle.drain();
  release.resolve();
  await rejected;
  await draining;
  await lifecycle.drain();
});

test("shutdown also waits for work registered while an earlier handler is draining", async () => {
  const lifecycle = createRequestLifecycle(), first = deferred(), second = deferred();
  const writes = [];
  const one = lifecycle.wrap(async () => { await first.promise; writes.push("one"); })();
  let drained = false;
  const draining = lifecycle.drain().then(() => { drained = true; });
  const two = lifecycle.wrap(async () => { await second.promise; writes.push("two"); })();
  first.resolve(); await one; await nextTurn();
  assert.equal(drained, false);
  second.resolve(); await two; await draining;
  assert.deepEqual(writes, ["one", "two"]);
});

const actualStream = name => {
  let source;
  const find = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) source = node.initializer.getText(ast);
    ts.forEachChild(node, find);
  };
  find(ast); assert.ok(source, name); return source;
};
// Control presentation and interval scheduling; execute the actual stream and shutdown code.
const { createEventStreams } = await load(`export const createEventStreams = driver => {
  const setInterval = callback => { driver.poll = callback; return { unref() {} }; }, clearInterval = () => {};
  const randomUUID = () => 'owned-connection', canStreamParticipantRun = () => true;
  const participantCurrentStateRevision = () => 'unchanged', monitorOpenRunsRevision = () => 'unchanged';
  const securityHeaders = {}, sendError = () => { throw Error('Unexpected stream rejection'); };
  const writeParticipantEvent = () => {}, writeMonitorEvent = () => {};
  const PARTICIPANT_EVENT_STREAM_SCHEMA_VERSION = 1, MONITOR_EVENT_STREAM_SCHEMA_VERSION = 1;
  const PARTICIPANT_EVENT_STREAM_POLL_INTERVAL_MS = 1000, PARTICIPANT_EVENT_STREAM_HEARTBEAT_INTERVAL_MS = 15000;
  const MONITOR_EVENT_STREAM_POLL_INTERVAL_MS = 1000, MONITOR_EVENT_STREAM_HEARTBEAT_INTERVAL_MS = 15000;
  return { participant: ${actualStream('streamParticipantEvents')}, monitor: ${actualStream('streamMonitorEvents')} };
};`);
class LifecycleResponse extends EventEmitter {
  writableEnded = false;
  writeHead() {} flushHeaders() {} write() { return true; }
  end() { this.writableEnded = true; this.emit('close'); }
}
for (const kind of ['participant-close', 'participant-poll', 'monitor-poll']) {
  test(`production shutdown drains ${kind} SSE work before closing storage`, async () => {
    const entered = deferred(), release = deferred(), done = deferred(), lifecycle = createRequestLifecycle();
    const driver = {}, response = new LifecycleResponse();
    let storageClosed = false, completedWhileOpen = false, calls = 0;
    const complete = async () => { entered.resolve(); await release.promise; completedWhileOpen = !storageClosed; done.resolve(); };
    const state = { testRun: { testRunId: 'owned-run', status: 'running' }, participantSession: { status: 'launched' } };
    const input = { request: new EventEmitter(), response, requestLifecycle: lifecycle,
      participantSessionId: 'owned-session', testRunId: 'owned-run', tenantKey: 'owned-tenant', workspaceKey: 'owned-workspace',
      validateAccess: async () => {}, participantRuntime: {
        getCurrentRunState: async () => { if (kind === 'participant-poll' && ++calls > 1) await complete(); return state; },
        listPendingCommands: async () => [],
        updateConnection: async ({ action }) => { if (kind === 'participant-close' && action === 'close') await complete(); return {}; }
      }, monitorRead: { listOpenRuns: async () => { if (++calls > 1) await complete(); return []; } } };
    const stream = createEventStreams(driver);
    await (kind === 'monitor-poll' ? stream.monitor(input) : stream.participant(input));
    if (kind !== 'participant-close') { driver.poll(); await entered.promise; }
    response.emit('close'); if (kind === 'participant-close') await entered.promise;
    const stopping = createShutdown(undefined, Promise.resolve(), { shutdown: async () => { storageClosed = true; } }, lifecycle)();
    await nextTurn(); const closedBeforeRelease = storageClosed;
    release.resolve(); await done.promise; await stopping; await nextTurn();
    assert.equal(closedBeforeRelease, false, 'A closed SSE socket must not close storage underneath its pending work.');
    assert.equal(completedWhileOpen, true); assert.equal(storageClosed, true);
  });
}

for (const kind of ['participant', 'monitor']) {
  test(`an initially disconnected ${kind} SSE stream cannot retain a lease or start polling`, async () => {
    const entered = deferred(), release = deferred(), lifecycle = createRequestLifecycle(), driver = {};
    const response = new LifecycleResponse(); let closes = 0;
    const state = { testRun: { testRunId: 'owned-run', status: 'running' }, participantSession: { status: 'launched' } };
    const input = { request: new EventEmitter(), response, requestLifecycle: lifecycle,
      participantSessionId: 'owned-session', testRunId: 'owned-run', tenantKey: 'owned-tenant', workspaceKey: 'owned-workspace',
      validateAccess: async () => {}, participantRuntime: {
        getCurrentRunState: async () => state, listPendingCommands: async () => [],
        updateConnection: async ({ action }) => {
          if (action === 'open') { entered.resolve(); await release.promise; }
          else closes++;
          return {};
        }
      }, monitorRead: { listOpenRuns: async () => { entered.resolve(); await release.promise; return []; } } };
    const streams = createEventStreams(driver), starting = streams[kind](input);
    await entered.promise; response.destroyed = true; response.emit('close'); release.resolve();
    await starting; await lifecycle.drain();
    assert.equal(driver.poll, undefined, 'A stream that lost its response during initial loading cannot start a poller.');
    assert.equal(closes, kind === 'participant' ? 1 : 0);
  });
}
