import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

// Reference-only production evidence. These controls deliberately do not claim
// the Rewrite's current canonical result deletion implements this native cascade.
const root = new URL('../test-fixtures/original-testcenter/source-workspace-results/native-group-deletion/', import.meta.url);
const read = async name => readFile(new URL(name, root));
const manifest = JSON.parse(await read('manifest.json'));
const receipt = JSON.parse(await read('receipt.json'));
const observations = JSON.parse(await read('http-observations.json'));
const requests = (method, path) => observations.filter(row => row.method === method && row.path === path);
const accessSets = name => requests('PUT', '/session').map(row => row.value).filter(value => value?.loginName === name);
const personSets = name => accessSets(name).filter(value => Object.hasOwn(value.claims, 'test'));
const loginSets = name => accessSets(name).filter(value => !Object.hasOwn(value.claims, 'test'));
const hasCheck = prefix => assert.equal(receipt.checks.filter(row => row.name.startsWith(prefix)).length, 1, prefix);

test('unchanged production Source proves the native group lifecycle with protected work and XSD uploads', async () => {
  assert.equal(manifest.sourceCommit, 'eedae41840cbe90e5547c0211da818bdf620f5aa');
  assert.equal(manifest.head, '4779500c23135a3d8c6c38698c1f5d89b0abb5c0');
  assert.equal(manifest.tree, '7facf36f4e53ffeba08ee07a52594492582183fc');
  assert.equal(manifest.conclusion, 'success');
  assert.equal(receipt.sourceCommit, manifest.sourceCommit);
  assert.equal(receipt.testMode, false); assert.equal(manifest.testMode, false);
  assert.equal(receipt.success, true); assert.equal(receipt.error, undefined);
  assert.equal(receipt.transport, 'unchanged production Apache HTTP; actual ALTCHA; no SQL seeds');
  assert.deepEqual(receipt.protectedScopes, ['login', 'person']);
  assert.equal(receipt.checks.length, 21); assert.equal(manifest.checks, 21);
  assert.equal(observations.length, manifest.httpObservations);
  assert.deepEqual(receipt.sourceFiles, manifest.sourceFiles);
  assert.equal(Object.keys(receipt.sourceFiles).length, 11);
  assert.equal(Object.keys(manifest.files).length, 7);
  for (const [name, digest] of Object.entries(manifest.files)) {
    assert.match(name, /^[a-z0-9][a-z0-9.-]*$/);
    assert.equal(createHash('sha256').update(await read(name)).digest('hex'), digest, name);
  }
  for (const prefix of ['actual production Apache requires both', 'owned XSD-validated fixture',
    'invalid signature and wrong work', 'a person solution still requires', 'a signed person challenge cannot']) hasCheck(prefix);
});

test('Source group deletion distinguishes denied writes, unknown groups, obsolete snapshots and a real cascade', () => {
  const deletion = requests('DELETE', '/workspace/1/responses');
  assert.deepEqual(deletion.map(row => row.status), [200, 403, 401, 403, 200, 200]);
  for (const row of deletion.filter(row => row.status === 200)) {
    assert.equal(row.value, null);
    assert.equal(row.wireSha256, createHash('sha256').update('').digest('hex'));
  }
  hasCheck('deleting an obsolete group snapshot preserves');
  hasCheck('read-only, anonymous and participant deletion is denied');
  hasCheck('case-equivalent whole-group deletion returns an empty HTTP200');
  const cascadeIndex = observations.indexOf(deletion.at(-1));
  const before = observations.slice(0, cascadeIndex).filter(row => row.method === 'GET' && row.path === '/workspace/1/results').at(-1).value;
  const after = observations.slice(cascadeIndex).find(row => row.method === 'GET' && row.path === '/workspace/1/results').value;
  assert.equal(before.find(row => row.groupName === 'ORACLE.DELETE.MAIN').bookletsStarted, 2);
  assert.equal(before.find(row => row.groupName === 'ORACLE.DELETE.MAIN').numUnitsTotal, 2);
  assert.ok(!after.some(row => row.groupName === 'ORACLE.DELETE.MAIN'));
  assert.deepEqual(after, before.filter(row => row.groupName !== 'ORACLE.DELETE.MAIN'));
  assert.deepEqual(after.map(row => row.groupName), ['ORACLE.DELETE.KEEP', 'ORACLE.DELETE.NEXT']);
  const files = requests('GET', '/workspace/1/files'); assert.equal(files.length, 2);
  assert.deepEqual(files[0].value, files[1].value);
  assert.equal(requests('PUT', '/test/1/unit/ORACLE.POW.UNIT/response')[0].status, 201);
  assert.equal(requests('PUT', '/test/1/unit/ORACLE.POW.UNIT/review')[0].status, 201);
  assert.equal(requests('PUT', '/test/1/log')[0].status, 201);
});

test('Source recreates fresh scoped capabilities while keeping deleted bearer aliases invalid', () => {
  const oldLogin = loginSets('owned-delete-main')[0], newLogin = loginSets('owned-delete-main').at(-1);
  const oldPerson = personSets('owned-delete-main')[0], newPerson = personSets('owned-delete-main').at(-1);
  assert.equal(loginSets('owned-delete-main').length, 2); assert.equal(personSets('owned-delete-main').length, 2);
  assert.notEqual(oldLogin.token, newLogin.token); assert.notEqual(oldPerson.token, newPerson.token);
  assert.notEqual(oldPerson.groupToken, newPerson.groupToken);
  assert.equal(oldPerson.groupToken, personSets('owned-delete-peer')[0].groupToken);
  assert.equal(newPerson.groupLabel, 'Recreated deletion label');
  assert.ok(newPerson.claims.test.every(claim => claim.flags.running === false));
  assert.equal(loginSets('owned-delete-moved')[0].token, loginSets('owned-delete-moved').at(-1).token);
  const denied = requests('GET', '/session').filter(row => row.status === 403).map(row => row.value);
  for (const token of [oldLogin.token, oldPerson.token, loginSets('owned-delete-peer')[0].token, personSets('owned-delete-peer')[0].token]) {
    assert.ok(denied.some(value => typeof value === 'string' && value.includes(token)));
  }
  hasCheck('new native authentication recreates fresh Login, group and person capabilities');
});

test('retained public Source evidence contains only redacted capabilities and no request bodies or headers', () => {
  const walk = value => {
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      if (/^(?:token|groupToken|salt|challenge|signature)$/i.test(key) && item !== null) {
        assert.equal(typeof item, 'string'); assert.match(item, /^\[redacted-owned-[a-zA-Z]+-\d+\]$/);
      } else walk(item);
    }
  };
  walk(observations);
  for (const row of observations) {
    assert.deepEqual(Object.keys(row).sort(), ['method', 'path', 'status', 'value', 'wireSha256']);
    assert.match(row.wireSha256, /^[a-f0-9]{64}$/); assert.ok(row.path.startsWith('/'));
  }
  const text = JSON.stringify({receipt, observations});
  for (const secret of ['owned-source-super-secret', 'owned-native-pow-secret', 'Owned-delete-reader-secret']) assert.ok(!text.includes(secret));
});
