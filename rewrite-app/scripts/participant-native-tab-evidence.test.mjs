import assert from 'node:assert/strict';
import test from 'node:test';
import {nativeTabFailureEvidence} from './participant-native-tab-readiness.mjs';
import {nativeRouteArtifactDirectory, writeNativeRouteFailure} from './participant-native-route-evidence.mjs';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

test('native tab upload evidence excludes error payloads, request queries/headers/bodies and foreign origins', () => {
  const request = url => ({url: () => url, method: () => 'GET',
    headers: () => assert.fail('Do not inspect credential headers'), postData: () => assert.fail('Do not inspect bodies')});
  const error = Object.assign(Error('OWNED_MESSAGE_SECRET'), {name: 'OWNED_NAME_SECRET', body: 'OWNED_BODY_SECRET'});
  const pending = new Map([
    [request('http://OWNED_USER_SECRET:OWNED_PASS_SECRET@127.0.0.1:1234/api/v1/participant/sessions/owned/events?token=OWNED_QUERY_SECRET#OWNED_FRAGMENT_SECRET'), 'source'],
    [request('https://foreign.example/OWNED_FOREIGN_SECRET'), 'clone']
  ]);
  const evidence = nativeTabFailureEvidence(error, ['owned-qualified-state'], pending, 'http://127.0.0.1:1234');
  assert.deepEqual(evidence, {errorName: 'Error', checks: ['owned-qualified-state'],
    pendingRequests: [{tab: 'source', method: 'GET', path: '/api/v1/participant/sessions/owned/events'}]});
  assert.ok(!JSON.stringify(evidence).includes('SECRET'));
});

test('tab evidence bounds retained checks and active same-origin request metadata', () => {
  const pending = new Map(Array.from({length: 300}, (_, i) => [{url: () => 'http://localhost/owned/' + i, method: () => 'POST'}, 'source']));
  const result = nativeTabFailureEvidence({name: 'TimeoutError'}, Array.from({length: 150}, (_, i) => 'owned-' + i), pending, 'http://localhost');
  assert.equal(result.errorName, 'TimeoutError'); assert.equal(result.checks.length, 100);
  assert.equal(result.checks[0], 'owned-50'); assert.equal(result.pendingRequests.length, 200);
});

test('the failing route prefix writes public JSON/png at the exact configured upload root and leaves stores untouched', async () => {
  const root = await mkdtemp(join(tmpdir(), 'owned-route-evidence-'));
  try {
    const directory = await nativeRouteArtifactDirectory(join(root, 'configured'));
    await writeFile(join(directory, 'private.sqlite'), 'OWNED_STORE_SECRET');
    const request = {url: () => 'http://localhost/owned/events?secret=OWNED_QUERY_SECRET', method: () => 'GET',
      postData: () => assert.fail('Never collect request bodies'), headers: () => assert.fail('Never collect headers')};
    const page = {screenshot: async ({path}) => writeFile(path, 'owned-image-fixture'), locator: () => assert.fail('Never collect body text')};
    await writeNativeRouteFailure({directory, page, error: Error('OWNED_ERROR_SECRET'), checks: ['owned-check'], pending: new Map([[request, 'native-route']]), origin: 'http://localhost'});
    const evidence = JSON.parse(await readFile(join(directory, 'failure.json'), 'utf8'));
    assert.deepEqual(evidence, {errorName: 'Error', checks: ['owned-check'], pendingRequests: [{tab: 'native-route', method: 'GET', path: '/owned/events'}]});
    assert.equal(await readFile(join(directory, 'failure.png'), 'utf8'), 'owned-image-fixture');
    assert.equal(await readFile(join(directory, 'private.sqlite'), 'utf8'), 'OWNED_STORE_SECRET');
    assert.ok(!JSON.stringify(evidence).includes('SECRET'));
  } finally { await rm(root, {recursive: true, force: true}); }
});

test('public route evidence survives an unavailable screenshot without serializing its error', async () => {
  const directory = await nativeRouteArtifactDirectory('');
  try {
    await writeNativeRouteFailure({directory, page: {screenshot: async () => { throw Error('OWNED_IMAGE_SECRET'); }},
      error: Object.assign(Error('OWNED_ERROR_SECRET'), {name: 'TimeoutError'}), checks: [], pending: new Map(), origin: 'http://localhost'});
    assert.deepEqual(JSON.parse(await readFile(join(directory, 'failure.json'), 'utf8')), {errorName: 'TimeoutError', checks: [], pendingRequests: []});
  } finally { await rm(directory, {recursive: true, force: true}); }
});
