import assert from 'node:assert/strict';
import test from 'node:test';
import {preferOfficialUbuntuArchive as prefer} from './ci-apt-mirrors.mjs';

const original = 'http://azure.archive.ubuntu.com/ubuntu/\tpriority:1\n' +
  'https://archive.ubuntu.com/ubuntu/\tpriority:2\n' + 'https://security.ubuntu.com/ubuntu/\tpriority:3\n';
test('APT archive preference retains exactly the runner archives with deterministic documented priorities', () => {
  const result = prefer(original);
  assert.equal(result, 'https://archive.ubuntu.com/ubuntu/\tpriority:1\n' +
    'https://security.ubuntu.com/ubuntu/\tpriority:2\nhttp://azure.archive.ubuntu.com/ubuntu/\tpriority:3\n');
  assert.deepEqual(result.split('\n').filter(Boolean).map(line => line.split('\t')[0]).sort(),
    original.split('\n').filter(Boolean).map(line => line.split('\t')[0]).sort());
  assert.equal(prefer(result), result);
  assert.equal(prefer('# Owned runner profile\r\n\r\n' + original.replaceAll('\n', '\r\n')), result);
});
for (const [name, source] of [
  ['foreign or credential-bearing transport', original.replace('http://azure.archive.ubuntu.com/ubuntu/', 'https://owned:OWNED_MIRROR_SECRET@foreign.invalid/')],
  ['missing or duplicated archive', original.replace('https://archive.ubuntu.com/ubuntu/', 'https://security.ubuntu.com/ubuntu/')],
  ['extra source options', original.replace('priority:1', 'priority:1 trusted:yes')],
  ['unrecognized priority', original.replace('priority:1', 'priority:0')]
]) test('APT preference fails closed for ' + name, () => {
  assert.throws(() => prefer(source), error => error.message === 'Unexpected runner APT mirror profile; no package source was changed.');
});
