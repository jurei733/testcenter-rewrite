import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const root=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-workspace-permissions-http/',import.meta.url);
const source=JSON.parse(await readFile(new URL('observations.json',root)));
export const sourcePermissionRow=label=>{const rows=source.rows.filter(r=>r.label===label);assert.equal(rows.length,1,label);return rows[0];};
test('Source112 permission evidence retains actual unmodified production HTTP, files, packages and strict runtime',async()=>{
  const manifest=JSON.parse(await readFile(new URL('manifest.json',root))),proof=JSON.parse(await readFile(new URL('independent-verification.json',root)));
  assert.equal(source.sourceCommit,'eedae41840cbe90e5547c0211da818bdf620f5aa');assert.equal(source.verified,true);assert.equal(source.rows.length,112);assert.equal(new Set(source.rows.map(r=>r.label)).size,112);
  assert.equal(Object.keys(source.sourceHashes).length,137);assert.equal(source.vendor.installedPackages,19);assert.equal(source.vendor.requiredProductionPackages,19);
  for(const[name,digest]of Object.entries(manifest.files))assert.equal(createHash('sha256').update(await readFile(new URL(name,root))).digest('hex'),digest,name);
  assert.equal(createHash('sha256').update(await readFile(new URL('observations.json',root))).digest('hex'),proof.observationSha256);
  for(const row of source.rows)assert.equal(createHash('sha256').update(row.rawText).digest('hex'),row.redactedBodySha256,row.label);
  assert.equal(source.sqlSeedsOrDaoStubs,false);assert.equal(source.mutationsOverActualHttp,true);assert.equal(proof.exactImage,source.backendImage);assert.equal(proof.sourceFilesReverified,137);
  assert.equal(proof.runtime.php,'8.3.36');assert.match(proof.runtime.postgres,/^PostgreSQL 18\.4 /);
  assert.equal(proof.configuration.allowTestMode,false);assert.equal(proof.configuration.xmlSchemaValidation,true);assert.equal(proof.configuration.staticTokens,false);assert.equal(proof.configuration.insecurePasswords,false);assert.equal(proof.configuration.staticTime,'now');
});
test('Source112 matrices replace one complete explicit scope, ignore selected and retain other workspace grants',()=>{
  const mixed=sourcePermissionRow('mixed-workspace-users').value;
  assert.deepEqual(mixed.map(r=>[r.id,r.selected,r.role]),[[2,true,'RW'],[3,true,'RO'],[1,false,'']]);
  assert.deepEqual(sourcePermissionRow('a-workspaces-after-replace').value.map(r=>[r.id,r.selected,r.role]),[[1,true,'RO'],[2,true,'RW']]);
  assert.equal(sourcePermissionRow('workspace-after-selected-false').value.find(r=>r.id===2).role,'RW');
  assert.ok(sourcePermissionRow('b-after-workspace-replacement').value.every(r=>r.selected===false));
  assert.equal(sourcePermissionRow('other-workspace-survives-clear').value.find(r=>r.id===2).role,'RW');
  assert.equal(sourcePermissionRow('live-user-session-after-revoke').value.claims.workspaceAdmin.some(r=>r.id==='1'),false);
  for(const label of ['unknown-user-matrix','unknown-workspace-matrix'])assert.ok(sourcePermissionRow(label).value.every(r=>!r.selected&&r.role===''));
});
test('Source112 explicitly records malformed-write partial effects without treating them as a safe Rewrite contract',()=>{
  assert.equal(sourcePermissionRow('probe-unknown-user').status,500);assert.ok(sourcePermissionRow('state-after-unknown-user').value.every(r=>!r.selected));
  assert.equal(sourcePermissionRow('probe-duplicate-user').status,500);assert.equal(sourcePermissionRow('state-after-duplicate-user').value.find(r=>r.id===2).role,'RO');
  assert.equal(sourcePermissionRow('probe-unknown-role').status,200);assert.equal(sourcePermissionRow('state-after-unknown-role').value.find(r=>r.id===2).role,'XX');
  for(const family of ['workspace','user'])for(const type of ['missing','null','empty'])assert.equal(sourcePermissionRow(family+'-invalid-'+type).status,400);
});
