import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
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

// Actual image20261018.96.1, run41147780535/job124378804786, artifact13022148204.
// ZIPsha9edb3e86000fe79cf9cd9857b5d714f745c69ab13ca596ab78a1c230fc3d4f47.
const aws = await readFile(new URL('./fixtures/apt-mirrors-ubuntu24-20261018.txt', import.meta.url), 'utf8');
test('the captured native AWS profile retains its exact three archives and deterministic priorities', () => {
  assert.equal(Buffer.byteLength(aws),152);
  assert.equal(createHash('sha256').update(aws).digest('hex'),'af9816b59bc904eaf28838ae673ac2b625b6628bebfc67a7cbeae78ba06e226a');
  const result=prefer(aws);
  assert.equal(result,'https://archive.ubuntu.com/ubuntu/\tpriority:1\n'+
    'https://security.ubuntu.com/ubuntu/\tpriority:2\nhttp://us-east-2.ec2.archive.ubuntu.com/ubuntu/\tpriority:3\n');
  assert.deepEqual(result.trim().split('\n').map(row=>row.split('\t')[0]).sort(),aws.trim().split('\n').map(row=>row.split('\t')[0]).sort());
  assert.equal(prefer(result),result);
  assert.equal(prefer('# Actual AWS profile\r\n'+aws.replaceAll('\n','\r\n')),result);
});
for(const [name,source] of [
  ['an unmeasured AWS region',aws.replace('us-east-2.','us-east-1.')],
  ['a lookalike cloud host',aws.replace('ec2.archive.ubuntu.com/','ec2.archive.ubuntu.com.foreign.invalid/')],
  ['credentials on an otherwise recognized host',aws.replace('http://us-east-2.','http://OWNED:OWNED_SECRET@us-east-2.')],
  ['a different cloud archive path',aws.replace('http://us-east-2.ec2.archive.ubuntu.com/ubuntu/','http://us-east-2.ec2.archive.ubuntu.com/other/')],
  ['an explicit cloud port',aws.replace('ec2.archive.ubuntu.com/','ec2.archive.ubuntu.com:8080/')],
  ['mixed Azure and AWS fallbacks',aws.replace('https://archive.ubuntu.com/ubuntu/','http://azure.archive.ubuntu.com/ubuntu/')],
  ['an added fourth archive',aws+'http://azure.archive.ubuntu.com/ubuntu/\tpriority:1\n'],
  ['an extra insecure option',aws.replace('priority:1','priority:1 trusted:yes')]
]) test('the captured AWS preference rejects '+name,()=>{
  assert.throws(()=>prefer(source),error=>error.message==='Unexpected runner APT mirror profile; no package source was changed.');
});
