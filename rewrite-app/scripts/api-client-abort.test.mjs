import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { createServer, request } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import ts from "typescript";
import { createServerRequestFailureGate } from "./server-request-failure-gate.mjs";

const api = new URL("../apps/api/dist/apps/api/src/index.js", import.meta.url).href;
const source = readFileSync(new URL("../apps/api/src/index.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("api.ts", source, ts.ScriptTarget.Latest, true);
const errorClass = ast.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "ClientRequestAbortedError");
const chunks = ast.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => declaration.name.getText(ast) === "readRequestChunks"));
assert.ok(errorClass && chunks, "Execute the production upload boundary, not a copied classifier");
const compiled = ts.transpileModule(`${errorClass.getText(ast)}\n${chunks.getText(ast)}\nexport { ClientRequestAbortedError, readRequestChunks };`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
}).outputText;
const { ClientRequestAbortedError, readRequestChunks } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const poll = async (predicate, message) => {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) { if (await predicate()) return; await delay(10); }
  throw Error(message);
};

for (const [name, aborted, complete, readableEnded, code, classified] of [
  ["incomplete client reset", true, false, false, "ECONNRESET", true],
  ["reset without client abort", false, false, false, "ECONNRESET", false],
  ["reset after parsing but before consuming the body", true, true, false, "ECONNRESET", true],
  ["reset after consuming the body", true, true, true, "ECONNRESET", false],
  ["storage error during an abort", true, false, false, "ENOSPC", false],
  ["unclassified stream error", true, false, false, undefined, false]
]) test(`the real body reader preserves ${name}`, async () => {
  const failure = Object.assign(new Error(name), { code });
  const incoming = { aborted, complete, readableEnded, async *[Symbol.asyncIterator]() { yield Buffer.from("owned partial"); throw failure; } };
  const observed = [];
  await assert.rejects(async () => { for await (const chunk of readRequestChunks(incoming)) observed.push(chunk.toString()); },
    error => classified ? error instanceof ClientRequestAbortedError && error.cause === failure : error === failure);
  assert.deepEqual(observed, ["owned partial"]);
});

test("a fully received real upload can still abort before the application consumes its body", async () => {
  let incoming, client, release;
  const held = new Promise(resolve => { release = resolve; });
  let settle;
  const result = new Promise(resolve => { settle = resolve; });
  const server = createServer(async (req, res) => {
    incoming = req;
    req.on("error", () => {});
    await held;
    try {
      for await (const _chunk of readRequestChunks(req)) {}
      settle({ error: null });
    } catch (error) { settle({ error }); }
    res.end();
  });
  try {
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    client = request(`http://127.0.0.1:${server.address().port}`, { method: "POST",
      headers: { "content-type": "application/json", "content-length": "2" } });
    client.on("error", () => {});
    client.end("{}");
    await poll(() => Promise.resolve(incoming?.complete === true), "The HTTP parser did not receive the complete body");
    assert.equal(incoming.readableEnded, false, "Received bytes have not been consumed by the application");
    client.destroy();
    await poll(() => Promise.resolve(incoming.aborted), "The held request did not observe the client disconnect");
    assert.equal(incoming.complete, true);
    assert.equal(incoming.readableEnded, false);
    release();
    const { error } = await result;
    assert.ok(error instanceof ClientRequestAbortedError, `Expected transport cancellation, received ${error}`);
    assert.equal(error.cause.code, "ECONNRESET");
  } finally {
    client?.destroy(); release();
    await new Promise(resolve => server.close(resolve));
  }
});

for (const holdCompleteBody of [false, true]) test(`a real ${holdCompleteBody ? "fully received, unread" : "incomplete"} client upload is cancelled without an internal failure or leaked active request`, async () => {
  const child = spawn(process.execPath, ["--input-type=module", "-e", `
    import { createProductionApiServer } from ${JSON.stringify(api)};
    const server = await createProductionApiServer();
    server.prependListener('request', req => {
      if (req.headers['x-owned-hold-body'] !== 'true') return;
      const original = req[Symbol.asyncIterator];
      let release;
      const held = new Promise(resolve => { release = resolve; });
      // Model a reader delayed by authentication while the real HTTP parser
      // receives the complete body. Never replace its native iterator/error.
      req[Symbol.asyncIterator] = async function* () { await held; yield* original.call(this); };
      const timer = setInterval(() => {
        if (req.complete) { clearInterval(timer); process.send({ bodyComplete: true }); }
      }, 1);
      req.once('aborted', () => { clearInterval(timer); release(); });
    });
    server.listen(0, '127.0.0.1', () => process.send({ port: server.address().port }));
    process.once('SIGTERM', () => server.close(() => process.exit(0)));
  `], { env: { ...process.env, FIRST_SLICE_STORE: "memory", FIRST_SLICE_BOOTSTRAP_DEMO: "false",
    FIRST_SLICE_OPERATOR_AUTH_REQUIRED: "false", FIRST_SLICE_PROOF_OF_WORK_SCOPES: "",
    FIRST_SLICE_XML_SCHEMA_PROFILE: "legacy-compatibility" }, stdio: ["ignore", "pipe", "pipe", "ipc"] });
  const closed = new Promise(resolve => child.once("close", resolve));
  const gate = createServerRequestFailureGate();
  let output = "", client;
  const notifications = [];
  child.on("message", message => notifications.push(message));
  child.stdout.on("data", chunk => { output += chunk; });
  child.stderr.on("data", chunk => { output += chunk; });
  gate.observeStream(child.stdout); gate.observeStream(child.stderr);
  const events = () => output.split("\n").flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
  try {
    const port = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error("Owned API startup timed out")), 20_000);
      child.once("message", ({ port }) => { clearTimeout(timer); resolve(port); });
      child.once("error", error => { clearTimeout(timer); reject(error); });
    });
    const base = `http://127.0.0.1:${port}`;
    const metrics = async () => { const response = await fetch(base + "/metrics"); assert.equal(response.status, 200); return response.json(); };
    const before = await metrics();
    client = request(base + "/api/v1/participant/auth/sign-in", { method: "POST", headers: {
      "content-type": "application/json", "content-length": holdCompleteBody ? "2" : "1024", expect: "100-continue",
      ...(holdCompleteBody ? { "x-owned-hold-body": "true" } : {})
    } });
    client.on("error", () => {});
    const continued = once(client, "continue"); client.flushHeaders(); await continued;
    if (holdCompleteBody) {
      client.end("{}");
      await poll(() => Promise.resolve(notifications.some(message => message.bodyComplete)), "The API did not receive the held complete body");
    } else client.write('{"tenantKey":"owned-incomplete');
    await poll(async () => (await metrics()).runtime.activeRequests === before.runtime.activeRequests + 1,
      "The real partial upload did not enter the API handler");
    client.destroy();
    await poll(() => Promise.resolve(events().some(event => ["http_request_aborted", "http_request_failed"].includes(event.event))),
      "The API did not record the client upload outcome");
    gate.assertHealthy();
    const after = await metrics();
    assert.equal(after.runtime.activeRequests, before.runtime.activeRequests);
    assert.equal(after.runtime.abortedRequests, before.runtime.abortedRequests + 1);
    assert.equal(after.errorCounts.internal, before.errorCounts.internal);
    assert.equal(after.errorCounts.invalidJson, before.errorCounts.invalidJson);
    assert.equal(after.errorCounts.firstSlice, before.errorCounts.firstSlice, "An aborted body must not reach application validation");
    const aborted = events().filter(event => event.event === "http_request_aborted");
    assert.equal(aborted.length, 1);
    assert.equal(aborted[0].method, "POST");
    assert.equal(aborted[0].route, "POST /api/v1/participant/auth/sign-in");
    assert.equal(aborted[0].bodyComplete, holdCompleteBody);
    assert.ok(!output.includes("owned-incomplete"), "Aborted payload bytes must not enter operational logs");
    const malformed = await fetch(base + "/api/v1/participant/auth/sign-in", { method: "POST",
      headers: { "content-type": "application/json" }, body: "{" });
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json()).error, "invalid_json");
    const final = await metrics();
    assert.equal(final.runtime.abortedRequests, before.runtime.abortedRequests + 1);
    assert.equal(final.errorCounts.invalidJson, before.errorCounts.invalidJson + 1);
    assert.equal(final.errorCounts.internal, before.errorCounts.internal);
    gate.assertHealthy();
    const ready = await fetch(base + "/readyz"); assert.equal(ready.status, 200);
  } finally {
    client?.destroy();
    if (child.exitCode === null) child.kill("SIGTERM");
    await closed;
  }
});
