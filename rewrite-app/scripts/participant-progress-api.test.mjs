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
test(`real ${postgres ? "PostgreSQL" : "SQLite"} participant progress API preserves accepted deliveries and capture times`, async t => {
  const directory = await mkdtemp(join(tmpdir(), "testcenter-progress-api-"));
  const file = join(directory, "owned.sqlite");
  const schema = `owned_progress_api_${randomUUID().replaceAll("-", "")}`;
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
    const tenantKey = "owned-progress-tenant", workspaceKey = "owned";
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
    const savePath = testRunId => resolveRoutePath(routes.participant.saveProgress, { testRunId });
    const save = (body, token = selected.sessionToken, expected = 200, target = run.testRunId) => request('POST', savePath(target), body, token, expected);
    const repository = await readFreshRepository();
    const old = { deliveryId: randomUUID(), responseUnitKey: run.currentUnitKey, status: 'running', unitResponse: 'Older HTTP answer Ä/β', responseTimestamp: 10 };
    await t.test('the route forwards capture time and ignores a distinct older opaque response', async () => {
      await save(old);
      await save({ ...old, deliveryId: randomUUID(), unitResponse: 'Current HTTP answer Ω', responseTimestamp: 20 });
      const accepted = await save({ ...old, deliveryId: randomUUID(), responseTimestamp: 11 });
      assert.equal(accepted.testRun.unitResponses[run.currentUnitKey], 'Current HTTP answer Ω');
      assert.deepEqual(accepted.testRun.unitResponseFieldTimestamps[run.currentUnitKey], { opaque: 20 });
    });
    await t.test('duplicate retries return current data and altered accepted IDs conflict', async () => {
      const before = await repository.getTestRunById(run.testRunId);
      const duplicate = await save(old);
      assert.equal(duplicate.testRun.unitResponses[run.currentUnitKey], before.unitResponses[run.currentUnitKey]);
      const conflict = await save({ ...old, unitResponse: 'Changed accepted payload' }, selected.sessionToken, 409);
      assert.equal(conflict.error, 'participant_delivery_conflict');
      assert.deepEqual(await repository.getTestRunById(run.testRunId), before);
    });
    await t.test('credentials and selected-Run ownership protect accepted retry receipts', async () => {
      for (const token of [undefined, 'invalid-token', other.sessionToken, operator]) {
        await request('POST', savePath(run.testRunId), old, token, 401);
      }
      await save(old, selected.sessionToken, 401, foreign.testRunId);
      const independent = await save({ ...old, responseUnitKey: otherBookletRun.currentUnitKey }, selected.sessionToken, 200, otherBookletRun.testRunId);
      assert.equal(independent.testRun.unitResponses[otherBookletRun.currentUnitKey], old.unitResponse);
    });
    await t.test('invalid clocks fail through the HTTP boundary without changing data', async () => {
      const before = await repository.getTestRunById(run.testRunId);
      for (const responseTimestamp of [null, 0, -1, 1.5, '20']) {
        const rejected = await save({ ...old, deliveryId: randomUUID(), responseTimestamp }, selected.sessionToken, 400);
        assert.equal(rejected.error, 'participant_response_timestamps_invalid');
      }
      const invalid = JSON.stringify({ kind: 'verona_unit_state', version: 1, unitState: { dataParts: { a: 'Forged' } }, fieldTimestamps: { dataParts: { a: -1 } } });
      await save({ ...old, deliveryId: randomUUID(), unitResponse: invalid }, selected.sessionToken, 400);
      assert.deepEqual(await repository.getTestRunById(run.testRunId), before);
    });
    await t.test('an accepted retry after a monitor lock returns the locked Run while a new delivery rejects', async () => {
      await request('POST', workspace + `/monitor/open-runs/${run.testRunId}/commands`, { commandType: 'lock_test' }, operator);
      const before = await repository.getTestRunById(run.testRunId);
      assert.equal(before.locked, true);
      const acknowledged = await save(old); assert.equal(acknowledged.testRun.locked, true);
      await save({ ...old, deliveryId: randomUUID() }, selected.sessionToken, 423);
      assert.deepEqual(await repository.getTestRunById(run.testRunId), before);
    });
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await cleanup();
  }
});
