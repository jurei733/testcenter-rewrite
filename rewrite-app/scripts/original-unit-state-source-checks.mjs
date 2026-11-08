import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {formatOriginalParticipantLogEntry} from '../packages/application/dist/packages/application/src/original-report-csv.js';
import {handleOriginalTestHttp} from '../apps/api/dist/apps/api/src/original-test-http.js';

const evidence = async name => {
  const root = new URL('../test-fixtures/original-testcenter/source-workspace-results/' + name + '/', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('manifest.json', root)));
  assert.equal(manifest.sourceCommit, 'eedae41840cbe90e5547c0211da818bdf620f5aa');
  assert.equal(manifest.sourceRuntimeFilesVerifiedBeforeAndAfter, 137);
  assert.equal(manifest.composerPackages, 19);
  assert.equal(manifest.xmlSchemaValidation, true);
  assert.equal(manifest.allowTestMode, false);
  assert.equal(manifest.sqlSeedsOrDaoStubs, false);
  for (const [name, digest] of Object.entries(manifest.files)) {
    assert.equal(createHash('sha256').update(await readFile(new URL(name, root))).digest('hex'), digest);
  }
  const data = JSON.parse(await readFile(new URL('observations.json', root)));
  assert.equal(data.verified, true);
  assert.equal(data.rows.length, manifest.httpRows);
  assert.equal(Object.keys(data.sourceHashes).length, 137);
  assert.equal(data.vendor.allInstalledVersionsAndSourceReferencesMatchPinnedLock, true);
  return {data, inputs: JSON.parse(await readFile(new URL('inputs.json', root)))};
};

/** Actual Source HTTP supplies the contract; every effect below uses the real store. */
export async function verifyOriginalUnitStateSource({t, auth, bookletName, services, repository, reopen}) {
  const content = await evidence('native-unit-state-content-http');
  const wire = await evidence('native-unit-state-wire-http');
  assert.equal(content.data.rows.length, 185);
  assert.equal(content.data.outcomes.length, 22);
  assert.equal(wire.data.rows.length, 95);
  assert.equal(wire.data.wireOutcomes.length, 14);
  const owner = await auth('owned-unit-native'), peer = await auth('owned-unit-peer');
  let sequence = 0;
  const fresh = async () => {
    const token = owner.person.token;
    const testNumber = await services().originalTest.create({token, bookletName: bookletName + '#state-source:' + ++sequence});
    const scope = await repository().findOriginalTestNumber({...owner.person.participantSession, testNumber});
    const unitName = 'OWNED.R90.STATE';
    const target = {token, testNumber, unitName};
    await services().originalUnit.patchState({...target, body: {originalUnitId: 'OWNED.R90.ORIGINAL',
      newState: [{key: 'STATE', content: 'Owned baseline', timeStamp: 100}]}});
    const snapshot = async () => ({unit: await repository().getOriginalUnit({...scope, unitName}),
      run: await repository().getTestRunById(scope.testRunId),
      logs: (await repository().listParticipantTestLogsByWorkspace(scope.tenantId, scope.workspaceId))
        .filter(row => row.testRunId === scope.testRunId)});
    return {target, snapshot};
  };
  await t.test('actual Source string, legacy, stale, duplicate-clock and prototype-key Unit STATE effects match exactly', async () => {
    const valid = content.data.outcomes.filter(row => row.status === 200);
    assert.equal(valid.length, 7);
    for (const row of valid) {
      const x = await fresh();
      const body = content.inputs.cases.find(value => value.label === row.label).body;
      assert.deepEqual((await x.snapshot()).unit.state, row.before);
      await services().originalUnit.patchState({...x.target, body});
      const after = await x.snapshot();
      assert.deepEqual(after.unit.state, row.after, row.label);
      // The repository timeline has its own ordering; Source's report query
      // declares no within-branch ORDER BY. Compare every emitted entry with
      // multiplicity, independently of that internal timeline presentation.
      const entries = rows => rows.map(row => JSON.stringify(row)).sort();
      assert.deepEqual(entries(after.logs.map(log => ({timestamp: log.timestamp, logentry: formatOriginalParticipantLogEntry(log)}))),
        entries(row.logsAfter.map(log => ({timestamp: log.timestamp, logentry: log.logentry}))), row.label);
      await reopen();
      assert.deepEqual(await x.snapshot(), after, row.label + ': durable state and logs');
    }
  });
  await t.test('actual Source malformed-content counterexamples retain atomic rejection and cannot leave unlogged state', async () => {
    const invalid = content.data.outcomes.filter(row => row.status !== 200);
    assert.equal(invalid.length, 15);
    assert.equal(invalid.filter(row => row.status === 500 && row.stateChanged).length, 11);
    for (const row of invalid) {
      const x = await fresh(), before = await x.snapshot();
      const body = content.inputs.cases.find(value => value.label === row.label).body;
      // Source can persist invalid content and then fail its typed UnitLog.
      // Keep the stronger atomic validation boundary across every real adapter.
      await assert.rejects(services().originalUnit.patchState({...x.target, body}), error => error.statusCode === 400);
      assert.deepEqual(await x.snapshot(), before, row.label);
      await reopen();
      assert.deepEqual(await x.snapshot(), before, row.label + ': no deferred partial write');
    }
  });
  await t.test('native Unit STATE HTTP matches actual Source error envelopes, with bearer redaction and no rejected effects', async () => {
    const x = await fresh();
    const privateFailure = 'Owned private database diagnostic';
    let forceFailure = false;
    const server = createServer(async (request, response) => {
      const current = services();
      const active = forceFailure ? {...current, originalUnit: {...current.originalUnit,
        patchState: async () => {throw Error(privateFailure);}}} : current;
      try {
        const handled = await handleOriginalTestHttp({request, pathname: new URL(request.url, 'http://owned').pathname,
          services: active, readBody: async allowEmpty => {
            let text = ''; for await (const chunk of request) text += chunk;
            return allowEmpty && !text.length ? undefined : JSON.parse(text);
          }, header: (name, value) => response.setHeader(name, value), reason: value => {response.statusMessage = value;},
          raw: (status, text, type) => {response.writeHead(status, {'content-type': type}); response.end(text);},
          send: (status, value) => {response.writeHead(status, {'content-type': 'application/json'}); response.end(JSON.stringify(value));},
          binary: () => assert.fail('Unexpected binary response')});
        if (!handled) response.writeHead(404).end();
      } catch (error) {
        response.writeHead(500, {'content-type': 'application/json'}); response.end(JSON.stringify({error: String(error)}));
      }
    });
    await new Promise(done => server.listen(0, '127.0.0.1', done));
    const base = 'http://127.0.0.1:' + server.address().port;
    const path = '/test/' + x.target.testNumber + '/unit/' + x.target.unitName + '/state';
    try {
      for (const row of wire.data.wireOutcomes.filter(row => row.label !== 'wire-admin-token')) {
        const before = await x.snapshot(), input = row.request;
        const credential = row.label === 'wire-missing-token' ? undefined : row.label === 'wire-empty-token' ? '' :
          row.label === 'wire-unknown-token' ? 'owned-invalid-native-state-token' :
            row.label === 'wire-foreign-person' ? peer.person.token : owner.person.token;
        const response = await fetch(base + path, {method: input.method,
          headers: {...(credential === undefined ? {} : {AuthToken: credential}), 'content-type': 'application/json'},
          body: input.rawBody ? input.body : JSON.stringify(input.body), signal: AbortSignal.timeout(15000)});
        const text = await response.text();
        assert.equal(response.status, row.status, row.label);
        assert.equal(response.headers.get('content-type'), row.contentType, row.label);
        if (row.status >= 400) {
          assert.equal(response.headers.get('test-mode'), 'NO');
          assert.match(response.headers.get('error-id'), /^error-/);
        }
        const expected = row.label === 'wire-unknown-token' ? 'Invalid token.' : row.label === 'wire-foreign-person' ?
          row.rawText.replace(/test [0-9]+/, 'test ' + x.target.testNumber) : row.rawText;
        assert.equal(text, expected, row.label);
        for (const token of [owner.person.token, peer.person.token]) assert.ok(!text.includes(token));
        assert.deepEqual(await x.snapshot(), before, row.label);
      }
      const before = await x.snapshot();
      const wrongRole = await fetch(base + path, {method: 'PATCH', headers: {AuthToken: owner.login.token}, body: '{'});
      const wrongRoleText = await wrongRole.text();
      assert.equal(wrongRole.status, 403);
      assert.equal(wrongRole.headers.get('content-type'), 'text/html;charset=UTF-8');
      assert.ok(!wrongRoleText.includes(owner.login.token));
      forceFailure = true;
      const response = await fetch(base + path, {method: 'PATCH', headers: {AuthToken: owner.person.token},
        body: JSON.stringify({newState: [{key: 'STATE', content: 'Owned', timeStamp: 200}]})});
      assert.equal(response.status, 500);
      assert.equal(await response.text(), 'Internal error.');
      assert.equal(response.headers.get('content-type'), 'text/html;charset=UTF-8');
      assert.equal(response.headers.get('test-mode'), 'NO');
      assert.match(response.headers.get('error-id'), /^error-/);
      assert.deepEqual(await x.snapshot(), before);
    } finally {
      await new Promise(done => server.close(done));
    }
  });
}
