import { participantCommandExecutionRoute } from "@testcenter-rewrite-app/contracts/participant-run-command";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";
import { productionApiRoutes as routes, resolveRoutePath } from "@testcenter-rewrite-app/contracts";
import { createSqliteFirstSliceRepository } from "@testcenter-rewrite-app/sqlite-store";
import { createPostgresFirstSliceStorage } from "@testcenter-rewrite-app/postgres-store";
import { createProductionApiServer } from "../apps/api/dist/apps/api/src/index.js";
import { localDemoSourcePackage } from "../apps/api/dist/apps/api/src/local-demo-bootstrap.js";

const postgres = process.env.FIRST_SLICE_STORE === "postgres";
test(`real ${postgres ? "PostgreSQL" : "SQLite"} participant command API authorizes the selected Run and persists exact receipts`, async t => {
  const directory = await mkdtemp(join(tmpdir(), "testcenter-command-api-"));
  const file = join(directory, "owned.sqlite");
  const schema = `owned_command_api_${randomUUID().replaceAll("-", "")}`;
  const environment = { FIRST_SLICE_STORE: postgres ? "postgres" : "sqlite", FIRST_SLICE_SQLITE_FILE: file,
    FIRST_SLICE_BOOTSTRAP_DEMO: "false", FIRST_SLICE_OPERATOR_AUTH_REQUIRED: "true",
    FIRST_SLICE_XML_SCHEMA_PROFILE: "legacy-compatibility",
    FIRST_SLICE_PROOF_OF_WORK_SCOPES: "", REQUIRE_LOGIN_PASSWORD: "false" };
  let rootPool, schemaCreated = false, freshStorage;
  if (postgres) {
    assert.ok(process.env.FIRST_SLICE_POSTGRES_URL, "The PostgreSQL API proof requires its own configured test database.");
    const url = new URL(process.env.FIRST_SLICE_POSTGRES_URL);
    url.searchParams.set("options", `-c search_path=${schema}`);
    environment.FIRST_SLICE_POSTGRES_URL = url.toString();
    rootPool = new Pool({ connectionString: process.env.FIRST_SLICE_POSTGRES_URL });
  }
  const cleanup = async () => {
    try { await freshStorage?.shutdown(); }
    finally {
      try { if (schemaCreated) await rootPool.query(`DROP SCHEMA "${schema}" CASCADE`); }
      finally { await rootPool?.end(); await rm(directory, { recursive: true, force: true }); }
    }
  };
  const readFreshRepository = async () => {
    if (!postgres) return createSqliteFirstSliceRepository(file);
    freshStorage ??= await createPostgresFirstSliceStorage(environment.FIRST_SLICE_POSTGRES_URL);
    return freshStorage.repository;
  };
  const previous = new Map(Object.keys(environment).map(key => [key, process.env[key]]));
  let server;
  try {
    if (postgres) { await rootPool.query(`CREATE SCHEMA "${schema}"`); schemaCreated = true; }
    Object.assign(process.env, environment);
    server = await createProductionApiServer();
  } catch (error) {
    await cleanup();
    throw error;
  } finally {
    for (const [key, value] of previous) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
  try {
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = async (method, path, body, token, expected = 200) => {
      const response = await fetch(base + path, { method,
        headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { "content-type": "application/json" } : {}) },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
      const payload = response.status === 204 || response.status === 205 ? null : await response.json();
      assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(payload)}`);
      return payload;
    };
    const password = "Owned-command-API-2026!";
    await request("POST", routes.admin.bootstrap, { username: "owned-command", password }, undefined, 201);
    const operator = (await request("POST", routes.admin.signIn, { username: "owned-command", password })).sessionToken;
    const tenantKey = "owned-command-tenant", workspaceKey = "owned";
    await request("POST", routes.platform.createTenant, { tenantKey, displayName: "Owned command test" }, operator, 201);
    const workspace = `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}`;
    await request("POST", resolveRoutePath(routes.workspace.createWorkspace, { tenantKey }), { workspaceKey, displayName: "Owned command test" }, operator, 201);
    const content = JSON.parse(localDemoSourcePackage.sourceDocument);
    const firstBooklet = content.bookletEntries[0].bookletKey;
    const second = { ...structuredClone(content.bookletEntries[0]), bookletKey: "owned-second" };
    second.unitEntries = second.unitEntries.map(unit => ({ ...unit, unitKey: `second-${unit.unitKey}` }));
    content.bookletEntries.push(second);
    const uploaded = await request("POST", workspace + "/source-packages", { fileName: "commands.json", mediaType: "application/json", contentStructure: content }, operator, 201);
    const imported = await request("POST", workspace + "/import-jobs", { sourcePackageId: uploaded.sourcePackage.sourcePackageId }, operator, 201);
    await request("POST", workspace + `/content-releases/${imported.stagedContentRelease.contentReleaseId}/activate`, { activatedByActorId: "owned" }, operator);
    await request("POST", workspace + "/participant-roster", { rosterText: JSON.stringify(["selected", "other"].map(loginKey => ({
      loginKey, groupKey: "owned", displayName: loginKey, executionMode: "run-hot-return",
      booklets: [{ id: firstBooklet }, { id: second.bookletKey }]
    }))) }, operator, 201);
    const login = async loginKey => request("POST", routes.participant.signIn, { tenantKey, workspaceKey, loginKey });
    const selected = await login("selected"), other = await login("other");
    const sessionId = selected.participantSession.participantSessionId;
    const launch = async (identity, bookletKey) => (await request("POST", routes.participant.launch,
      { participantSessionId: identity.participantSession.participantSessionId, bookletKey }, identity.sessionToken)).testRun;
    const run = await launch(selected, firstBooklet), otherBookletRun = await launch(selected, second.bookletKey);
    const foreign = await launch(other, firstBooklet);
    const listPath = resolveRoutePath(routes.participant.listPendingCommands, { participantSessionId: sessionId });
    const list = (testRunId, token = selected.sessionToken) => request("GET", `${listPath}?testRunId=${encodeURIComponent(testRunId)}`, undefined, token);
    const acknowledgement = commandId => resolveRoutePath(routes.participant.acknowledgeCommand, { participantSessionId: sessionId, commandId });
    const issue = async (testRunId, commandType = "resume") => (await request("POST", workspace + `/monitor/open-runs/${testRunId}/commands`, { commandType }, operator)).command;
    const application = commandId => resolveRoutePath(participantCommandExecutionRoute, { participantSessionId: sessionId, commandId });
    const apply = (commandId, controllerStatus = "RUNNING") => request("POST", application(commandId), { testRunId: run.testRunId, controllerStatus }, selected.sessionToken);
    await request("POST", resolveRoutePath(routes.participant.saveProgress, { testRunId: run.testRunId }),
      { status: "running", currentUnitKey: run.currentUnitKey, unitResponse: 'Exact saved answer Ä/β\n";' }, selected.sessionToken);
    const first = await issue(run.testRunId), secondCommand = await issue(run.testRunId), retained = await issue(otherBookletRun.testRunId);
    await t.test("real monitor issuance supplies distinct pending records to exactly one selected Run", async () => {
      assert.notEqual(first.commandId, secondCommand.commandId);
      assert.deepEqual((await list(run.testRunId)).commands.map(command => [command.commandId, command.sequence]), [[first.commandId, 1], [secondCommand.commandId, 2]]);
      assert.deepEqual((await list(otherBookletRun.testRunId)).commands.map(command => command.commandId), [retained.commandId]);
    });
    await t.test("participant credentials and Run ownership protect both routes", async () => {
      for (const token of [undefined, "invalid-token", other.sessionToken, operator]) {
        await request("GET", `${listPath}?testRunId=${run.testRunId}`, undefined, token, 401);
        await request("PATCH", acknowledgement(first.commandId), { testRunId: run.testRunId }, token, 401);
        await request("POST", application(first.commandId), { testRunId: run.testRunId }, token, 401);
      }
      await request("GET", `${listPath}?testRunId=${foreign.testRunId}`, undefined, selected.sessionToken, 404);
      await request("PATCH", acknowledgement(first.commandId), { testRunId: foreign.testRunId }, selected.sessionToken, 404);
      await request("PATCH", acknowledgement(first.commandId), { testRunId: otherBookletRun.testRunId }, selected.sessionToken, 404);
      await request("PATCH", acknowledgement("unknown"), { testRunId: run.testRunId }, selected.sessionToken, 404);
      await request("GET", listPath, undefined, selected.sessionToken, 400);
      for (const body of [{}, { testRunId: null }, { testRunId: 42 }, { testRunId: " " }]) {
        await request("PATCH", acknowledgement(first.commandId), body, selected.sessionToken, 400);
      }
      await request("POST", application(first.commandId), { testRunId: run.testRunId }, selected.sessionToken, 409);
      await request("POST", application(first.commandId), { testRunId: otherBookletRun.testRunId }, selected.sessionToken, 404);
      await request("POST", application(first.commandId), { testRunId: foreign.testRunId }, selected.sessionToken, 404);
      await request("POST", application("unknown"), { testRunId: run.testRunId }, selected.sessionToken, 404);
      assert.equal((await list(run.testRunId)).commands.length, 2);
    });
    await t.test("the SSE snapshot carries the selected Run's concrete commands", async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5_000);
      let reader;
      try {
        const path = resolveRoutePath(routes.participant.eventStream, { participantSessionId: sessionId });
        const response = await fetch(`${base}${path}?testRunId=${otherBookletRun.testRunId}`, { headers: { authorization: `Bearer ${selected.sessionToken}` }, signal: controller.signal });
        assert.equal(response.status, 200); reader = response.body.getReader();
        let data = "", event;
        const decoder = new TextDecoder();
        while (!event) {
          const chunk = await reader.read(); assert.equal(chunk.done, false);
          data += decoder.decode(chunk.value, { stream: true });
          const line = data.split(/\r?\n/).find(line => line.startsWith("data: "));
          if (line) event = JSON.parse(line.slice(6));
        }
        assert.equal(event.testRunId, otherBookletRun.testRunId);
        assert.deepEqual(event.commands.map(command => command.commandId), [retained.commandId]);
        assert.equal(event.commands[0].acknowledgedAt, null);
      } finally { clearTimeout(timeout); controller.abort(); reader?.releaseLock(); }
    });
    await t.test("a receipt uses the server timestamp, is idempotent and changes no saved Run data", async () => {
      const currentPath = resolveRoutePath(routes.participant.getCurrentRunState, { participantSessionId: sessionId }) + `?testRunId=${run.testRunId}`;
      const before = (await request("GET", currentPath, undefined, selected.sessionToken)).currentRunState.testRun;
      const received = (await request("PATCH", acknowledgement(first.commandId), { testRunId: run.testRunId,
        acknowledgedAt: "1970-01-01T00:00:00.000Z", tenantId: "foreign", workspaceId: "foreign" }, selected.sessionToken)).command;
      assert.equal(received.commandId, first.commandId); assert.notEqual(received.acknowledgedAt, "1970-01-01T00:00:00.000Z");
      assert.equal(received.tenantId, run.tenantId); assert.equal(received.workspaceId, run.workspaceId);
      assert.deepEqual((await request("PATCH", acknowledgement(first.commandId), { testRunId: run.testRunId }, selected.sessionToken)).command, received);
      assert.deepEqual((await request("GET", currentPath, undefined, selected.sessionToken)).currentRunState.testRun, before);
      assert.deepEqual((await list(run.testRunId)).commands.map(command => command.commandId), [secondCommand.commandId]);
      assert.equal((await list(run.testRunId)).commands[0].effectsDeferred, true);
      assert.equal((await list(otherBookletRun.testRunId)).commands.length, 1);
      const durable = await (await readFreshRepository()).acknowledgeParticipantRunCommand({ tenantId: run.tenantId,
        workspaceId: run.workspaceId, participantSessionId: sessionId, testRunId: run.testRunId,
        commandId: first.commandId, acknowledgedAt: "1970-01-01T00:00:00.000Z" });
      assert.deepEqual(durable, received, "A fresh storage instance must return the same persisted first receipt.");
    });
    await t.test("application derives the effect from its stored command and retains the first execution receipt", async () => {
      const before = await (await readFreshRepository()).getTestRunById(run.testRunId);
      const applied = (await request("POST", application(first.commandId), { testRunId: run.testRunId,
        commandType: "complete_and_lock", targetUnitKey: "foreign", executedAt: "1970-01-01T00:00:00.000Z", controllerStatus: "ERROR" }, selected.sessionToken)).application;
      assert.equal(applied.command.commandType, "resume"); assert.equal(applied.applied, true);
      assert.ok(applied.command.executedAt); assert.notEqual(applied.command.executedAt, "1970-01-01T00:00:00.000Z");
      assert.equal(applied.command.executionSequence, 1); assert.equal(applied.testRun.status, "running");
      assert.deepEqual(applied.testRun.unitResponses, before.unitResponses);
      const retry = (await apply(first.commandId)).application;
      assert.equal(retry.applied, false); assert.deepEqual(retry.command, applied.command);
      assert.deepEqual((await list(run.testRunId)).commands.map(command => command.commandId), [secondCommand.commandId]);
      await request("PATCH", acknowledgement(secondCommand.commandId), { testRunId: run.testRunId }, selected.sessionToken);
      await apply(secondCommand.commandId);
    });
    await t.test("pause does not change the Run or logs at issuance or ACK and applies after ERROR", async () => {
      const before = await (await readFreshRepository()).getTestRunById(run.testRunId);
      const paused = await issue(run.testRunId, "pause");
      assert.equal(paused.testRun.status, "running");
      assert.deepEqual(await (await readFreshRepository()).getTestRunById(run.testRunId), before);
      await request("PATCH", acknowledgement(paused.commandId), { testRunId: run.testRunId }, selected.sessionToken);
      assert.deepEqual(await (await readFreshRepository()).getTestRunById(run.testRunId), before);
      const applied = (await apply(paused.commandId, "ERROR")).application;
      assert.equal(applied.testRun.status, "paused"); assert.equal(applied.testRun.pauseSource, "monitor");
      assert.deepEqual(applied.testRun.unitResponses, before.unitResponses);
      const logs = await (await readFreshRepository()).listParticipantTestLogsByWorkspace(run.tenantId, run.workspaceId);
      assert.equal(logs.filter(log => log.testRunId === run.testRunId && log.logKey === "CONTROLLER" && log.logContent === "PAUSED").length, 1);
    });
    for (const reversed of [false, true]) await t.test(`server effects follow ${reversed ? "reversed" : "normal"} successful ACK dispatch`, async () => {
      const pause = await issue(run.testRunId, "pause"), resume = await issue(run.testRunId, "resume");
      for (const command of [pause, resume]) await request("PATCH", acknowledgement(command.commandId), { testRunId: run.testRunId }, selected.sessionToken);
      const commands = reversed ? [resume, pause] : [pause, resume], receipts = [];
      for (const command of commands) receipts.push((await apply(command.commandId, receipts.length ? receipts.at(-1).testRun.status.toUpperCase() : "ERROR")).application);
      assert.deepEqual(receipts.map(result => result.command.commandType), reversed ? ["resume", "pause"] : ["pause", "resume"]);
      assert.equal(receipts[1].command.executionSequence, receipts[0].command.executionSequence + 1);
      assert.equal((await (await readFreshRepository()).getTestRunById(run.testRunId)).status, reversed ? "paused" : "running");
    });
    await t.test("remote termination preserves the current Unit and answers and permits re-entry", async () => {
      const before = await (await readFreshRepository()).getTestRunById(run.testRunId);
      const terminal = await issue(run.testRunId, "complete");
      assert.deepEqual(await (await readFreshRepository()).getTestRunById(run.testRunId), before);
      await request("PATCH", acknowledgement(terminal.commandId), { testRunId: run.testRunId }, selected.sessionToken);
      const result = (await apply(terminal.commandId, "ERROR")).application;
      assert.equal(result.testRun.status, "paused"); assert.equal(result.testRun.locked, false);
      assert.equal(result.testRun.currentUnitKey, before.currentUnitKey); assert.deepEqual(result.testRun.unitResponses, before.unitResponses);
      assert.equal(result.testRun.completedAt, null); assert.equal(result.participantSession.status, "signed_in");
      const resumed = (await request("POST", resolveRoutePath(routes.participant.resumeSession, { participantSessionId: sessionId }), { bookletKey: firstBooklet }, selected.sessionToken)).testRun;
      assert.equal(resumed.testRunId, run.testRunId); assert.equal(resumed.status, "running");
      const restoredSession = await (await readFreshRepository()).getParticipantSessionById(sessionId);
      assert.equal(restoredSession.status, "launched", "Resuming a terminated Run must reopen its controller's event stream.");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      let reader;
      try {
        const stream = await fetch(base + resolveRoutePath(routes.participant.eventStream, { participantSessionId:sessionId }) + `?testRunId=${run.testRunId}`, {
          headers:{authorization:`Bearer ${selected.sessionToken}`,accept:"text/event-stream"}, signal:controller.signal
        });
        assert.equal(stream.status, 200); assert.match(stream.headers.get("content-type"), /text\/event-stream/);
        reader = stream.body.getReader(); assert.equal((await reader.read()).done, false);
      } finally { clearTimeout(timeout); controller.abort(); reader?.releaseLock(); }
    });
    await t.test("session revocation also closes command access", async () => {
      await request("DELETE", resolveRoutePath(routes.participant.signOut, { participantSessionId: sessionId }), undefined, selected.sessionToken, 205);
      await request("GET", `${listPath}?testRunId=${otherBookletRun.testRunId}`, undefined, selected.sessionToken, 401);
      await request("PATCH", acknowledgement(retained.commandId), { testRunId: otherBookletRun.testRunId }, selected.sessionToken, 401);
    });
  } finally {
    try { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
    finally { await cleanup(); }
  }
});
