import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { productionApiRoutes as routes, resolveRoutePath } from '@testcenter-rewrite-app/contracts';
import { participantNativeCommandRoute, participantCommandCompletionRoute } from '@testcenter-rewrite-app/contracts/participant-native-command';
import { participantCommandExecutionRoute } from '@testcenter-rewrite-app/contracts/participant-run-command';
import { createSqliteFirstSliceRepository } from '@testcenter-rewrite-app/sqlite-store';
import { createProductionApiServer } from '../apps/api/dist/apps/api/src/index.js';
import { localDemoSourcePackage } from '../apps/api/dist/apps/api/src/local-demo-bootstrap.js';

test('real SQLite HTTP command completion requires the exact accepted participant command', { timeout: 30_000 }, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'testcenter-completion-api-'));
  const file = join(directory, 'owned.sqlite');
  const environment = { FIRST_SLICE_STORE: 'sqlite', FIRST_SLICE_SQLITE_FILE: file, FIRST_SLICE_BOOTSTRAP_DEMO: 'false',
    FIRST_SLICE_OPERATOR_AUTH_REQUIRED: 'true', FIRST_SLICE_XML_SCHEMA_PROFILE: 'legacy-compatibility',
    FIRST_SLICE_PROOF_OF_WORK_SCOPES: '', REQUIRE_LOGIN_PASSWORD: 'false' };
  const previous = new Map(Object.keys(environment).map(key => [key, process.env[key]]));
  let server;
  try { Object.assign(process.env, environment); server = await createProductionApiServer(); }
  finally { for (const [key, value] of previous) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = async (method, path, body, token, status = 200) => {
      const response = await fetch(base + path, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      const payload = await response.json(); assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(payload)}`); return payload;
    };
    const password = 'Owned-completion-API-2026!';
    await request('POST', routes.admin.bootstrap, { username: 'owned', password }, undefined, 201);
    const operator = (await request('POST', routes.admin.signIn, { username: 'owned', password })).sessionToken;
    const tenantKey = 'owned-completion', workspaceKey = 'owned';
    await request('POST', routes.platform.createTenant, { tenantKey, displayName: 'Owned' }, operator, 201);
    await request('POST', resolveRoutePath(routes.workspace.createWorkspace, { tenantKey }), { workspaceKey, displayName: 'Owned' }, operator, 201);
    const workspace = `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}`;
    const content = JSON.parse(localDemoSourcePackage.sourceDocument), bookletKey = content.bookletEntries[0].bookletKey;
    const uploaded = await request('POST', workspace + '/source-packages', { fileName: 'completion.json', mediaType: 'application/json', contentStructure: content }, operator, 201);
    const imported = await request('POST', workspace + '/import-jobs', { sourcePackageId: uploaded.sourcePackage.sourcePackageId }, operator, 201);
    await request('POST', workspace + `/content-releases/${imported.stagedContentRelease.contentReleaseId}/activate`, { activatedByActorId: 'owned' }, operator);
    await request('POST', workspace + '/participant-roster', { rosterText: JSON.stringify(['native', 'remote', 'other'].map(loginKey => ({
      loginKey, groupKey: 'owned', executionMode: 'run-hot-return', booklets: [{ id: bookletKey }]
    }))) }, operator, 201);
    const launch = async loginKey => {
      const identity = await request('POST', routes.participant.signIn, { tenantKey, workspaceKey, loginKey });
      const run = (await request('POST', routes.participant.launch, { participantSessionId: identity.participantSession.participantSessionId, bookletKey }, identity.sessionToken)).testRun;
      return { ...identity, run, participantSessionId: identity.participantSession.participantSessionId };
    };
    const native = await launch('native'), remote = await launch('remote'), other = await launch('other');
    const repo = createSqliteFirstSliceRepository(file);
    const logs = async run => (await repo.listParticipantTestLogsByWorkspace(run.tenantId, run.workspaceId)).filter(log => log.testRunId === run.testRunId && log.logKey === 'command executed');
    const completionPath = identity => resolveRoutePath(participantCommandCompletionRoute, { participantSessionId: identity.participantSessionId });
    await t.test('native completion uses a separate authenticated transaction and stable timestamp', async () => {
      const command = { testRunId: native.run.testRunId, contentReleaseId: native.run.contentReleaseId, bookletKey,
        keyword: 'terminate', arguments: [], controllerStatus: 'RUNNING', deliveryId: randomUUID(), timeStamp: Date.now(), commandCompletion: 'browser-v1' };
      const packet = { testRunId: native.run.testRunId, contentReleaseId: native.run.contentReleaseId, bookletKey,
        command: { kind: 'native', request: command }, timeStamp: command.timeStamp + 20_000 };
      for (const token of [undefined, operator, other.sessionToken]) await request('POST', completionPath(native), packet, token, 401);
      await request('POST', completionPath(native), packet, native.sessionToken, 409);
      const application = (await request('POST', resolveRoutePath(participantNativeCommandRoute, { participantSessionId: native.participantSessionId }), command, native.sessionToken)).application;
      assert.equal(application.commandCompletion, 'browser-v1'); assert.deepEqual(await logs(native.run), []);
      const before = await repo.getTestRunById(native.run.testRunId);
      const first = (await request('POST', completionPath(native), packet, native.sessionToken)).completion;
      const replay = (await request('POST', completionPath(native), packet, native.sessionToken)).completion;
      assert.equal(first.applied, true); assert.equal(replay.applied, false); assert.equal(replay.acceptedAt, first.acceptedAt);
      assert.deepEqual(await repo.getTestRunById(native.run.testRunId), before);
      const saved = await logs(native.run); assert.equal(saved.length, 1); assert.equal(saved[0].timestamp, packet.timeStamp);
      await request('POST', completionPath(native), { ...packet, timeStamp: packet.timeStamp + 1 }, native.sessionToken, 409);
      await request('POST', completionPath(native), { ...packet, testRunId: other.run.testRunId, command: { kind: 'native', request: { ...command, testRunId: other.run.testRunId } } }, native.sessionToken, 404);
      assert.deepEqual(await logs(native.run), saved);
    });
    await t.test('remote completion refuses pending and legacy commands, and completes an opted-in receipt once', async () => {
      const command = (await request('POST', workspace + `/monitor/open-runs/${remote.run.testRunId}/commands`, { commandType: 'pause' }, operator)).command;
      const packet = { testRunId: remote.run.testRunId, contentReleaseId: remote.run.contentReleaseId, bookletKey,
        command: { kind: 'remote', commandId: command.commandId }, timeStamp: Date.now() + 20_000 };
      await request('POST', completionPath(remote), packet, remote.sessionToken, 409);
      await request('PATCH', resolveRoutePath(routes.participant.acknowledgeCommand, { participantSessionId: remote.participantSessionId, commandId: command.commandId }), { testRunId: remote.run.testRunId }, remote.sessionToken);
      const effect = (await request('POST', resolveRoutePath(participantCommandExecutionRoute, { participantSessionId: remote.participantSessionId, commandId: command.commandId }),
        { testRunId: remote.run.testRunId, controllerStatus: 'RUNNING', commandCompletion: 'browser-v1' }, remote.sessionToken)).application;
      assert.equal(effect.command.commandCompletion, 'browser-v1'); assert.deepEqual(await logs(remote.run), []);
      await request('POST', completionPath(remote), packet, remote.sessionToken); await request('POST', completionPath(remote), packet, remote.sessionToken);
      assert.equal((await logs(remote.run)).length, 1); assert.equal((await logs(remote.run))[0].timestamp, packet.timeStamp);
      const legacy = (await request('POST', workspace + `/monitor/open-runs/${remote.run.testRunId}/commands`, { commandType: 'resume' }, operator)).command;
      await request('PATCH', resolveRoutePath(routes.participant.acknowledgeCommand, { participantSessionId: remote.participantSessionId, commandId: legacy.commandId }), { testRunId: remote.run.testRunId }, remote.sessionToken);
      const acceptedLegacy = (await request('POST', resolveRoutePath(participantCommandExecutionRoute, { participantSessionId: remote.participantSessionId, commandId: legacy.commandId }),
        { testRunId: remote.run.testRunId, controllerStatus: 'PAUSED' }, remote.sessionToken)).application;
      assert.equal(acceptedLegacy.command.commandCompletion, undefined);
      await request('POST', completionPath(remote), { ...packet, command: { kind: 'remote', commandId: legacy.commandId } }, remote.sessionToken, 409);
      assert.equal((await logs(remote.run)).length, 2);

    });
    await t.test('invalid protocol and malformed completion return bounded client errors', async () => {
      for (const body of [{}, { ...native.run, command: null }, { testRunId: native.run.testRunId, contentReleaseId: native.run.contentReleaseId, bookletKey,
        command: { kind: 'remote', commandId: 'unknown' }, timeStamp: Infinity }]) await request('POST', completionPath(native), body, native.sessionToken, 400);
      await request('POST', resolveRoutePath(participantNativeCommandRoute, { participantSessionId: native.participantSessionId }), { testRunId: native.run.testRunId, commandCompletion: 'unknown' }, native.sessionToken, 400);
    });
  } finally {
    if (server?.listening) await new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); });
    await rm(directory, { recursive: true, force: true });
  }
});
