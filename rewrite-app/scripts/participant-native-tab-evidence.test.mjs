import assert from 'node:assert/strict';
import test from 'node:test';
import {nativeTabFailureEvidence} from './participant-native-tab-readiness.mjs';

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
