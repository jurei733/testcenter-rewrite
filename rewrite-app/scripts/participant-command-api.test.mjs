import { participantCommandExecutionRoute } from "@testcenter-rewrite-app/contracts/participant-run-command";
import { participantDebugStateRoute } from "@testcenter-rewrite-app/contracts/participant-debug";
import { participantNativeCommandRoute, participantControllerContextRoute, participantControllerTimerInterruptionRoute } from "@testcenter-rewrite-app/contracts/participant-native-command";
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
      if (path.includes("/controller-context") && response.ok) assert.match(response.headers.get("cache-control"), /no-store/);
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
    const debugUnitKey = content.bookletEntries[0].unitEntries[0].unitKey;
    content.bookletEntries[0].testletEntries = [...(content.bookletEntries[0].testletEntries ?? []), {
      testletKey: "owned-debug-private-gate", displayLabel: "Private debug gate", parentTestletKey: null,
      restrictions: { codeToEnter: { code: "OWNED_PRIVATE_CODE_Ω", prompt: "Owned prompt" } }
    }];
    content.bookletEntries[0].stateEntries = [{ stateKey: "owned-debug-state", displayLabel: "Owned debug state", options: [
      { optionKey: "high", displayLabel: "High", conditions: [{ source: { type: "Score", unitKey: debugUnitKey, variableKey: "owned-score", defaultValue: "0" }, expression: { type: "greaterThan", value: "1" } }] },
      { optionKey: "base", displayLabel: "Base", conditions: [] }
    ] }];
    const second = { ...structuredClone(content.bookletEntries[0]), bookletKey: "owned-second" };
    second.stateEntries = [];
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
    const issue = async (testRunId, commandType = "resume", extra = {}) => (await request("POST", workspace + `/monitor/open-runs/${testRunId}/commands`, { commandType, ...extra }, operator)).command;
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
    await t.test("diagnostic HTTP endpoints require the participant credential and explicit selected Run", async () => {
      const path = resolveRoutePath(participantDebugStateRoute, { participantSessionId: sessionId });
      for (const method of ["GET", "POST"]) {
        const body = method === "POST" ? {} : undefined;
        await request(method, `${path}?testRunId=${run.testRunId}`, body, undefined, 401);
        await request(method, `${path}?testRunId=${run.testRunId}`, body, other.sessionToken, 401);
        await request(method, `${path}?testRunId=${foreign.testRunId}`, body, selected.sessionToken, 404);
        await request(method, path, body, selected.sessionToken, 400);
      }
      const selectedSnapshot = (await request("GET", `${path}?testRunId=${run.testRunId}`, undefined, selected.sessionToken)).debugState;
      assert.equal(selectedSnapshot.scope.testRunId, run.testRunId);
      assert.equal(selectedSnapshot.scope.bookletKey, firstBooklet);
      assert.ok(!JSON.stringify(selectedSnapshot).includes("OWNED_PRIVATE_CODE_Ω"));
      assert.deepEqual(selectedSnapshot.booklet.testletEntries.find(entry => entry.testletKey === "owned-debug-private-gate").restrictions.codeToEnter,
        { code: "", prompt: "Owned prompt" });
      assert.ok(selectedSnapshot.booklet.unitEntries.every(unit => !unit.unitKey.startsWith("second-")));
      const otherSnapshot = (await request("GET", `${path}?testRunId=${otherBookletRun.testRunId}`, undefined, selected.sessionToken)).debugState;
      assert.equal(otherSnapshot.scope.testRunId, otherBookletRun.testRunId);
      assert.ok(otherSnapshot.booklet.unitEntries.every(unit => unit.unitKey.startsWith("second-")));
    });
    await t.test("read-only diagnostic POST evaluates local captures and XML without changing durable state", async () => {
      const repository = await readFreshRepository();
      const durable = async () => ({ run: await repository.getTestRunById(run.testRunId),
        session: await repository.getParticipantSessionById(sessionId),
        logs: await repository.listParticipantTestLogsByWorkspace(run.tenantId, run.workspaceId),
        activity: await repository.listWorkspaceActivityEventsByWorkspace(run.tenantId, run.workspaceId) });
      const before = await durable();
      const path = resolveRoutePath(participantDebugStateRoute, { participantSessionId: sessionId }) + `?testRunId=${run.testRunId}`;
      const captured = JSON.stringify({ kind: "verona_unit_state", version: 1, unitState: { unitStateDataType: "iqb-standard@1.0", dataParts: {
        one: JSON.stringify([{ id: "owned-score", status: "CODING_COMPLETE", value: "Exact local Ä/β\n\";", score: 2 }])
      } } });
      const snapshot = (await request("POST", path, { unitResponses: { [debugUnitKey]: captured },
        conditionXml: `<If><Score of="owned-score" from="${debugUnitKey}"/><Is equal="2"/></If>` }, selected.sessionToken)).debugState;
      assert.deepEqual(snapshot.conditionResults, [true]); assert.equal(snapshot.adaptiveStates[0].optionKey, "high");
      assert.ok(!JSON.stringify(snapshot).includes("OWNED_PRIVATE_CODE_Ω"));
      assert.deepEqual(await durable(), before);
      for (const body of [null, [], { unitResponses: { "second-foreign": "foreign" } },
        { conditionXml: "<Else/>" }, { conditionXml: "<If><Value/></If>" }, { conditionXml: "<!DOCTYPE If><If/>" }]) {
        await request("POST", path, body, selected.sessionToken, 400);
        assert.deepEqual(await durable(), before);
      }
    });
    await t.test("debug arguments survive monitor HTTP, selected ACK and idempotent execution after ERROR", async () => {
      const repository = await readFreshRepository();
      const before = await repository.getTestRunById(run.testRunId);
      const parent = await repository.getParticipantSessionById(sessionId);
      for (const debugArguments of [[], ["OFF"], ["on", "Exact Ä/β\n\";"]]) {
        const result = (await request("POST", workspace + `/monitor/open-runs/${run.testRunId}/commands`, { commandType: "debug", debugArguments }, operator)).command;
        assert.deepEqual(result.debugArguments, debugArguments); assert.deepEqual(await repository.getTestRunById(run.testRunId), before);
        const queued = (await list(run.testRunId)).commands.find(command => command.commandId === result.commandId);
        assert.deepEqual(queued.debugArguments, debugArguments);
        const receipt = (await request("PATCH", acknowledgement(result.commandId), { testRunId: run.testRunId }, selected.sessionToken)).command;
        assert.deepEqual(receipt.debugArguments, debugArguments); assert.deepEqual(await repository.getTestRunById(run.testRunId), before);
        const applied = (await request("POST", application(result.commandId), { testRunId: run.testRunId, controllerStatus: "ERROR", debugArguments: ["forged"] }, selected.sessionToken)).application;
        assert.equal(applied.applied, true); assert.deepEqual(applied.command.debugArguments, debugArguments);
        assert.deepEqual(await repository.getTestRunById(run.testRunId), before); assert.deepEqual(await repository.getParticipantSessionById(sessionId), parent);
        const logs = await repository.listParticipantTestLogsByWorkspace(run.tenantId, run.workspaceId);
        assert.equal(logs.filter(log => log.testRunId === run.testRunId && log.logKey === "command executed" && log.logContent === ["debug", ...debugArguments].join(" ")).length, 1);
        const retry = (await apply(result.commandId, "PAUSED")).application;
        assert.equal(retry.applied, false); assert.deepEqual(retry.command, applied.command);
        assert.deepEqual(await repository.listParticipantTestLogsByWorkspace(run.tenantId, run.workspaceId), logs);
      }
      for (const debugArguments of [null, "off", [42]]) await request("POST", workspace + `/monitor/open-runs/${run.testRunId}/commands`, { commandType: "debug", debugArguments }, operator, 400);
      await request("POST", workspace + `/monitor/open-runs/${run.testRunId}/commands`, { commandType: "resume", debugArguments: [] }, operator, 400);
    });
    await t.test("controller context authorizes selected and legacy Runs without loading Units or writing artifacts", async () => {
      const path = resolveRoutePath(participantControllerContextRoute, { participantSessionId: sessionId });
      const repository = await readFreshRepository();
      const snapshot = async () => ({ run: await repository.getTestRunById(run.testRunId), other: await repository.getTestRunById(otherBookletRun.testRunId),
        foreign: await repository.getTestRunById(foreign.testRunId), parent: await repository.getParticipantSessionById(sessionId),
        logs: await repository.listParticipantTestLogsByWorkspace(run.tenantId, run.workspaceId), events: await repository.listWorkspaceActivityEventsByWorkspace(run.tenantId, run.workspaceId),
        commands: await list(run.testRunId) });
      const before = await snapshot();
      for (const token of [undefined, "invalid", other.sessionToken, operator]) await request("GET", path, undefined, token, 401);
      for (const id of [foreign.testRunId, "missing"]) await request("GET", `${path}?testRunId=${id}`, undefined, selected.sessionToken, 404);
      await request("GET", path + "?testRunId=", undefined, selected.sessionToken, 400);
      for (const id of [run.testRunId, otherBookletRun.testRunId]) {
        const { controllerContext } = await request("GET", `${path}?testRunId=${id}`, undefined, selected.sessionToken);
        assert.equal(controllerContext.testRun.testRunId, id); assert.equal(controllerContext.testRun.participantSessionId, sessionId);
        assert.deepEqual(controllerContext.testRun, JSON.parse(JSON.stringify(await repository.getTestRunById(id))));
        assert.equal(controllerContext.participantSession.participantSessionId, sessionId);
        assert.equal(Object.hasOwn(controllerContext, "currentUnit"), false);
      }
      const legacy = (await request("GET", path, undefined, selected.sessionToken)).controllerContext;
      assert.equal(legacy.testRun.participantSessionId, sessionId);
      assert.deepEqual(await snapshot(), before);
    });
    await t.test("native HTTP commands use participant ownership, immutable content and no remote ACK", async () => {
      const path = resolveRoutePath(participantNativeCommandRoute, { participantSessionId: sessionId });
      const repository = await readFreshRepository(), beforeRun = await repository.getTestRunById(run.testRunId);
      const beforeCommands = await list(run.testRunId);
      const body = { testRunId: run.testRunId, contentReleaseId: beforeRun.contentReleaseId, bookletKey: beforeRun.bookletKey,
        deliveryId: randomUUID(), keyword: "resume", arguments: [], controllerStatus: "ERROR", timeStamp: Date.now() };
      for (const token of [undefined, "invalid", other.sessionToken, operator]) await request("POST", path, body, token, 401);
      await request("POST", path, { ...body, testRunId: foreign.testRunId }, selected.sessionToken, 404);
      for (const invalid of [null, [], {}, { ...body, arguments: [42] }, { ...body, contentReleaseId: "foreign" }]) {
        await request("POST", path, invalid, selected.sessionToken, invalid?.contentReleaseId === "foreign" ? 409 : 400);
        assert.deepEqual(await repository.getTestRunById(run.testRunId), beforeRun);
      }
      const first = (await request("POST", path, body, selected.sessionToken)).application;
      assert.equal(first.applied, true); assert.equal(first.testRun.status, "running");
      assert.deepEqual(first.testRun.unitResponses, beforeRun.unitResponses); assert.deepEqual(await list(run.testRunId), beforeCommands);
      const snapshot = async () => ({ run: await repository.getTestRunById(run.testRunId), parent: await repository.getParticipantSessionById(sessionId),
        logs: await repository.listParticipantTestLogsByWorkspace(run.tenantId, run.workspaceId), events: await repository.listWorkspaceActivityEventsByWorkspace(run.tenantId, run.workspaceId) });
      const accepted = await snapshot(), retry = (await request("POST", path, body, selected.sessionToken)).application;
      assert.equal(retry.applied, false); assert.equal(retry.executedAt, first.executedAt); assert.deepEqual(await snapshot(), accepted);
      await request("POST", path, { ...body, arguments: ["forged"] }, selected.sessionToken, 409); assert.deepEqual(await snapshot(), accepted);
      assert.equal(accepted.logs.filter(log => log.participantTestLogId.startsWith(`delivery:${run.testRunId}:console:${body.deliveryId}:`) && log.logKey === "command executed").length, 1);
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
    for (const commandType of ["pause", "resume", "goto"]) await t.test(`an already accepted ${commandType} reactivates its own parent after termination without replaying that effect`, async () => {
      const repository=await readFreshRepository(),before=await repository.getTestRunById(run.testRunId),sibling=await repository.getTestRunById(otherBookletRun.testRunId);
      const terminal=await issue(run.testRunId,"complete"),next=await issue(run.testRunId,commandType,commandType==="goto"?{targetUnitKey:before.currentUnitKey}:{});
      for (const command of [terminal,next]) await request("PATCH",acknowledgement(command.commandId),{testRunId:run.testRunId},selected.sessionToken);
      await apply(terminal.commandId,"RUNNING");assert.equal((await repository.getParticipantSessionById(sessionId)).status,"signed_in");
      const accepted=(await apply(next.commandId,"PAUSED")).application;
      assert.equal(accepted.participantSession.status,"launched");assert.equal((await repository.getParticipantSessionById(sessionId)).status,"launched");
      assert.equal(accepted.testRun.status,commandType==="pause"?"paused":"running");
      assert.deepEqual(accepted.testRun.unitResponses,before.unitResponses);assert.deepEqual(accepted.testRun.unitResponseFieldTimestamps,before.unitResponseFieldTimestamps);
      assert.deepEqual(await repository.getTestRunById(otherBookletRun.testRunId),sibling);
      const later=await issue(run.testRunId,"complete");await request("PATCH",acknowledgement(later.commandId),{testRunId:run.testRunId},selected.sessionToken);await apply(later.commandId);
      const snapshot=async()=>({parent:await repository.getParticipantSessionById(sessionId),run:await repository.getTestRunById(run.testRunId),
        logs:await repository.listParticipantTestLogsByWorkspace(run.tenantId,run.workspaceId),events:await repository.listWorkspaceActivityEventsByWorkspace(run.tenantId,run.workspaceId)});
      const inactive=await snapshot(),replay=(await apply(next.commandId)).application;
      assert.equal(replay.applied,false);assert.equal(replay.command.executedAt,accepted.command.executedAt);assert.deepEqual(await snapshot(),inactive);
    });
    await t.test("authenticated HTTP dispatches preserve later effects across native and remote arrival inversion", async () => {
      const repository=await readFreshRepository(),nativePath=resolveRoutePath(participantNativeCommandRoute,{participantSessionId:sessionId});
      const before=await repository.getTestRunById(run.testRunId),sibling=await repository.getTestRunById(otherBookletRun.testRunId);
      const clock=sequence=>({controllerId:'owned-http-controller',sequence});
      const body={testRunId:run.testRunId,contentReleaseId:before.contentReleaseId,bookletKey:before.bookletKey,deliveryId:'owned-http-late',keyword:'pause',arguments:[],controllerStatus:'RUNNING',timeStamp:Date.now(),controllerDispatch:clock(1)};
      const resume=await issue(run.testRunId,'resume');await request('PATCH',acknowledgement(resume.commandId),{testRunId:run.testRunId},selected.sessionToken);
      const latest=(await request('POST',application(resume.commandId),{testRunId:run.testRunId,controllerStatus:'PAUSED',controllerDispatch:clock(2)},selected.sessionToken)).application;
      assert.deepEqual(latest.controllerDispatch,clock(2));assert.equal(latest.testRun.status,'running');
      const late=(await request('POST',nativePath,body,selected.sessionToken)).application;
      assert.equal(late.superseded,true);assert.deepEqual(late.controllerDispatch,clock(1));assert.deepEqual(late.testRun,latest.testRun);
      const snapshot=async()=>({run:await repository.getTestRunById(run.testRunId),parent:await repository.getParticipantSessionById(sessionId),
        logs:await repository.listParticipantTestLogsByWorkspace(run.tenantId,run.workspaceId)}),accepted=await snapshot();
      const replay=(await request('POST',nativePath,body,selected.sessionToken)).application;
      assert.equal(replay.applied,false);assert.equal(replay.superseded,true);assert.deepEqual(await snapshot(),accepted);
      for(const token of [undefined,other.sessionToken])await request('POST',nativePath,{...body,deliveryId:'owned-http-other',controllerDispatch:clock(3)},token,401);
      await request('POST',nativePath,{...body,testRunId:foreign.testRunId,deliveryId:'owned-http-foreign',controllerDispatch:clock(3)},selected.sessionToken,404);
      for(const controllerDispatch of [null,{},[],{controllerId:'owned-http-controller',sequence:0}]){
        const rejected=await request('POST',nativePath,{...body,deliveryId:'owned-http-invalid',controllerDispatch},selected.sessionToken,400);assert.equal(rejected.error,'participant_controller_dispatch_invalid');
        await request('POST',application(resume.commandId),{testRunId:run.testRunId,controllerDispatch},selected.sessionToken,400);
      }
      await request('POST',nativePath,{...body,controllerDispatch:clock(3)},selected.sessionToken,409);
      assert.deepEqual(await snapshot(),accepted);assert.deepEqual(await repository.getTestRunById(otherBookletRun.testRunId),sibling);
    });
    for(const origin of ['native','remote'])await t.test(`authenticated ${origin} terminal early returns preserve the first pending native effect and immutable receipt`,async()=>{
      const repository=await readFreshRepository(),current=await repository.getTestRunById(run.testRunId),nativePath=resolveRoutePath(participantNativeCommandRoute,{participantSessionId:sessionId}),actor='owned-'+origin+'-noop-http',clock=sequence=>({controllerId:actor,sequence});
      const first={testRunId:run.testRunId,contentReleaseId:current.contentReleaseId,bookletKey:current.bookletKey,deliveryId:randomUUID(),keyword:'terminate',arguments:[],controllerStatus:'RUNNING',timeStamp:Date.now(),controllerDispatch:clock(1)};
      let path=nativePath,noop={...first,deliveryId:randomUUID(),arguments:['lock'],controllerStatus:'TERMINATED',terminationNoop:true,controllerDispatch:clock(2)};
      if(origin==='remote'){const command=await issue(run.testRunId,'complete_and_lock');await request('PATCH',acknowledgement(command.commandId),{testRunId:run.testRunId},selected.sessionToken);path=application(command.commandId);noop={testRunId:run.testRunId,controllerStatus:'TERMINATED',terminationNoop:true,controllerDispatch:clock(2)};}
      const snapshot=async()=>({run:await repository.getTestRunById(run.testRunId),parent:await repository.getParticipantSessionById(sessionId),sibling:await repository.getTestRunById(otherBookletRun.testRunId),logs:await repository.listParticipantTestLogsByWorkspace(run.tenantId,run.workspaceId),events:await repository.listWorkspaceActivityEventsByWorkspace(run.tenantId,run.workspaceId)}),before=await snapshot();
      const result=(await request('POST',path,noop,selected.sessionToken)).application;assert.equal(origin==='native'?result.terminationNoop:result.command.terminationNoop,true);assert.deepEqual(result.testRun,JSON.parse(JSON.stringify(before.run)));assert.deepEqual(result.participantSession,JSON.parse(JSON.stringify(before.parent)));
      const after=await snapshot();for(const key of ['run','parent','sibling','events'])assert.deepEqual(after[key],before[key]);assert.equal(after.logs.length-before.logs.length,1);assert.equal(after.logs.filter(log=>!before.logs.some(old=>old.participantTestLogId===log.participantTestLogId))[0].logKey,'command executed');
      const replay=(await request('POST',path,noop,selected.sessionToken)).application;assert.equal(replay.applied,false);assert.equal(origin==='native'?replay.terminationNoop:replay.command.terminationNoop,true);assert.deepEqual(await snapshot(),after);
      await request('POST',path,{...noop,terminationNoop:undefined},selected.sessionToken,409);
      for(const flag of [false,'true',{}])await request('POST',path,{...noop,terminationNoop:flag},selected.sessionToken,400);
      for(const token of [undefined,other.sessionToken])await request('POST',path,noop,token,401);await request('POST',path,{...noop,testRunId:foreign.testRunId},selected.sessionToken,404);assert.deepEqual(await snapshot(),after);
      const completed=(await request('POST',nativePath,first,selected.sessionToken)).application;assert.equal(completed.superseded,undefined);assert.equal(completed.testRun.status,'paused');assert.equal(completed.testRun.locked,false);assert.equal(completed.testRun.controllerDispatches[actor],1);assert.deepEqual(completed.testRun.unitResponses,before.run.unitResponses);assert.deepEqual(completed.testRun.unitResponseFieldTimestamps,before.run.unitResponseFieldTimestamps);
      await request('POST',nativePath,{...first,deliveryId:randomUUID(),keyword:'resume',controllerStatus:'PAUSED',controllerDispatch:clock(3)},selected.sessionToken);
    });
    await t.test("selected streaming survives sibling exits, while a sibling entry cannot revive a terminated receiver", async () => {
      const repository=await readFreshRepository(),before=await repository.getTestRunById(run.testRunId);
      const nativePath=resolveRoutePath(participantNativeCommandRoute,{participantSessionId:sessionId});
      const native=async(testRunId,keyword)=>{
        const current=await repository.getTestRunById(testRunId);
        return (await request("POST",nativePath,{testRunId,contentReleaseId:current.contentReleaseId,bookletKey:current.bookletKey,
          deliveryId:randomUUID(),keyword,arguments:[],controllerStatus:"PAUSED",timeStamp:Date.now()},selected.sessionToken)).application;
      };
      await native(run.testRunId,"pause");await native(otherBookletRun.testRunId,"terminate");
      assert.equal((await repository.getParticipantSessionById(sessionId)).status,"signed_in");
      const active=await repository.getTestRunById(run.testRunId);assert.equal(active.controllerEntry.active,true);assert.equal(active.status,"paused");
      const path=resolveRoutePath(routes.participant.eventStream,{participantSessionId:sessionId});
      await request("GET",path+`?testRunId=${run.testRunId}`,undefined,other.sessionToken,401);
      await request("GET",path+`?testRunId=${foreign.testRunId}`,undefined,selected.sessionToken,404);
      const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15_000);let reader;
      try {
        const stream=await fetch(base+path+`?testRunId=${run.testRunId}`,{headers:{authorization:`Bearer ${selected.sessionToken}`,accept:"text/event-stream"},signal:controller.signal});
        assert.equal(stream.status,200);reader=stream.body.getReader();let buffer="";const decoder=new TextDecoder();
        const readEvent=async()=>{
          while(true){let boundary=buffer.indexOf("\n\n");
            while(boundary>=0){const frame=buffer.slice(0,boundary);buffer=buffer.slice(boundary+2);const data=frame.split("\n").find(line=>line.startsWith("data: "));
              if(data)return JSON.parse(data.slice(6));boundary=buffer.indexOf("\n\n");}
            const chunk=await reader.read();assert.equal(chunk.done,false,"The selected live stream closed after a sibling exit.");buffer+=decoder.decode(chunk.value,{stream:true});
          }
        };
        const snapshot=await readEvent();assert.equal(snapshot.testRunId,run.testRunId);assert.equal(snapshot.eventType,"snapshot");
        const acknowledgementPath=resolveRoutePath(routes.participant.acknowledgeEventStream,{participantSessionId:sessionId});
        const acknowledgementBody={testRunId:run.testRunId,connectionId:snapshot.connectionId};
        await request("POST",acknowledgementPath,acknowledgementBody,selected.sessionToken);
        await native(otherBookletRun.testRunId,"resume");await native(otherBookletRun.testRunId,"terminate");
        const debug=await issue(run.testRunId,"debug",{debugArguments:[]});
        const change=await readEvent();assert.equal(change.eventType,"change");assert.equal(change.testRunId,run.testRunId);
        assert.ok(change.commands.some(command=>command.commandId===debug.commandId));
        await request("POST",acknowledgementPath,acknowledgementBody,selected.sessionToken);
        const stopped=await native(run.testRunId,"terminate");assert.equal(stopped.testRun.controllerEntry.active,false);
        assert.equal((await reader.read()).done,true,"Terminating the selected entry closes its own stream.");
        await native(otherBookletRun.testRunId,"resume");
        await request("GET",path+`?testRunId=${run.testRunId}`,undefined,selected.sessionToken,409);
        await request("POST",acknowledgementPath,acknowledgementBody,selected.sessionToken,409);
        const after=await repository.getTestRunById(run.testRunId);
        assert.deepEqual(after.unitResponses,before.unitResponses);assert.deepEqual(after.unitResponseFieldTimestamps,before.unitResponseFieldTimestamps);
      } finally {clearTimeout(timeout);controller.abort();reader?.releaseLock();}
    });
    await t.test("authenticated timer preparation freezes only its selected timer and replays the exact receipt", async () => {
      const repository=await readFreshRepository(),originalRelease=await repository.getContentReleaseById(run.contentReleaseId),release=structuredClone(originalRelease);
      const booklet=release.runtimeSnapshot.bookletEntries.find(entry=>entry.bookletKey===run.bookletKey),unit=booklet.unitEntries[0];
      booklet.testletEntries=[...(booklet.testletEntries??[]),{testletKey:'owned-timer-api',displayLabel:'Owned timer',parentTestletKey:null,restrictions:{timeMax:{minutes:1,leave:'confirm'}}}];
      unit.testletPath=['owned-timer-api'];await repository.saveContentRelease(release);
      try{
        const time=new Date().toISOString(),timer={testletKey:'owned-timer-api',status:'running',durationSeconds:60,remainingSeconds:60,startedAt:time,expiresAt:new Date(Date.now()+60_000).toISOString(),updatedAt:time,endedAt:null};
        const owned={...run,testRunId:randomUUID(),status:'running',currentUnitKey:unit.unitKey,controllerEntry:{active:true,revision:1},testletTimers:{'owned-timer-api':timer},unitResponses:{[unit.unitKey]:'Exact timer answer Ω'},unitResponseFieldTimestamps:{[unit.unitKey]:{opaque:123}}};
        await repository.saveTestRun(owned);
        const path=resolveRoutePath(participantControllerTimerInterruptionRoute,{participantSessionId:sessionId});
        const body={testRunId:owned.testRunId,contentReleaseId:owned.contentReleaseId,bookletKey:owned.bookletKey,deliveryId:randomUUID(),controllerDispatch:{controllerId:'owned-timer-api',sequence:1},
          keyword:'pause',controllerStatus:'RUNNING',unitKey:unit.unitKey,testletKey:'owned-timer-api',startedAt:timer.startedAt,expiresAt:timer.expiresAt,remainingSeconds:57};
        const before=await repository.getParticipantSessionById(sessionId),sibling=await repository.getTestRunById(otherBookletRun.testRunId);
        for(const token of [undefined,'invalid-token',other.sessionToken,operator])await request('POST',path,body,token,401);
        await request('POST',path,{...body,testRunId:foreign.testRunId},selected.sessionToken,404);
        await request('POST',path,{...body,remainingSeconds:61},selected.sessionToken,400);
        const receipt=(await request('POST',path,body,selected.sessionToken)).interruption;assert.equal(receipt.applied,true);
        const prepared=await repository.getTestRunById(owned.testRunId);assert.equal(prepared.status,'running');assert.equal(prepared.testletTimers['owned-timer-api'].status,'paused');assert.equal(prepared.testletTimers['owned-timer-api'].remainingSeconds,57);assert.equal(prepared.controllerDispatches,undefined);
        assert.deepEqual(prepared.unitResponses,owned.unitResponses);assert.deepEqual(prepared.unitResponseFieldTimestamps,owned.unitResponseFieldTimestamps);
        assert.deepEqual(await repository.getParticipantSessionById(sessionId),before);assert.deepEqual(await repository.getTestRunById(otherBookletRun.testRunId),sibling);
        const replay=(await request('POST',path,body,selected.sessionToken)).interruption;assert.equal(replay.applied,false);assert.equal(replay.acceptedAt,receipt.acceptedAt);
        await request('POST',path,{...body,remainingSeconds:56},selected.sessionToken,409);assert.deepEqual(await repository.getTestRunById(owned.testRunId),prepared);
        const nativePath=resolveRoutePath(participantNativeCommandRoute,{participantSessionId:sessionId});
        const applied=(await request('POST',nativePath,{testRunId:owned.testRunId,contentReleaseId:owned.contentReleaseId,bookletKey:owned.bookletKey,deliveryId:randomUUID(),keyword:'pause',arguments:[],controllerStatus:'RUNNING',timeStamp:Date.now(),controllerDispatch:body.controllerDispatch},selected.sessionToken)).application;
        assert.equal(applied.testRun.status,'paused');assert.equal(applied.testRun.testletTimers['owned-timer-api'].remainingSeconds,57);assert.equal(applied.testRun.controllerDispatches['owned-timer-api'],1);
      }finally{await repository.saveContentRelease(originalRelease);}
    });
    await t.test("session revocation also closes command access", async () => {
      await request("DELETE", resolveRoutePath(routes.participant.signOut, { participantSessionId: sessionId }), undefined, selected.sessionToken, 205);
      await request("GET", `${listPath}?testRunId=${otherBookletRun.testRunId}`, undefined, selected.sessionToken, 401);
      await request("PATCH", acknowledgement(retained.commandId), { testRunId: otherBookletRun.testRunId }, selected.sessionToken, 401);
      await request("POST",resolveRoutePath(participantControllerTimerInterruptionRoute,{participantSessionId:sessionId}),{testRunId:run.testRunId},selected.sessionToken,401);
    });
  } finally {
    try { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
    finally { await cleanup(); }
  }
});
