import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const root=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-opaque-workspace-roles-http/',import.meta.url);
const source=JSON.parse(await readFile(new URL('observations.json',root)));
export const sourceOpaqueRoleRow=label=>{const rows=source.rows.filter(r=>r.label===label);assert.equal(rows.length,1,label);return rows[0];};
export const sourceOpaqueRoleCases=[['RO','RO'],['RW','RW'],['opaque','XX'],['padded',' RW '],['blank',''],['limit-ascii','1234567890'],['over-limit-ascii','12345678901'],['limit-unicode','Ω'.repeat(10)],['over-limit-unicode','Ω'.repeat(11)],['first-nul','XX\0RW'],['nul-only','\0'],['RW-nul-suffix','RW\0ignored'],['limit-spaces',' '.repeat(10)],['over-limit-spaces',' '.repeat(11)],['over-limit-trailing-spaces','RO'+' '.repeat(9)],['over-limit-leading-spaces',' '.repeat(9)+'RO']];
test('Source233 opaque-role evidence retains the actual production image, unmodified files and complete real HTTP capture',async()=>{
 const manifest=JSON.parse(await readFile(new URL('manifest.json',root)));
 for(const[name,digest]of Object.entries(manifest.files))assert.equal(createHash('sha256').update(await readFile(new URL(name,root))).digest('hex'),digest,name);
 assert.equal(source.verified,true);assert.equal(source.readAndWriteGatesProven,true);assert.equal(source.sqlSeedsOrDaoStubs,false);assert.equal(source.actualHttpExchanges,233);assert.equal(source.rows.length,233);assert.equal(new Set(source.rows.map(r=>r.label)).size,233);
 assert.equal(source.sourceCommit,'eedae41840cbe90e5547c0211da818bdf620f5aa');assert.equal(Object.keys(source.sourceHashes).length,137);
 const runtime=source.sourceRuntimeBefore;assert.deepEqual(runtime,source.sourceRuntimeAfter);assert.equal(runtime.backendImage,'sha256:d7045f22e834e2907ed39b5f8c99eed3d81f37643c50c3f66746e3f654381328');assert.equal(runtime.sourceFiles,137);assert.equal(runtime.composerPackages,19);assert.equal(runtime.php,'8.3.36');
 assert.equal(runtime.configuration.allowTestMode,false);assert.equal(runtime.configuration.staticTokens,false);assert.equal(runtime.configuration.insecurePasswords,false);assert.equal(runtime.configuration.staticTime,'now');assert.equal(runtime.configuration.xmlSchemaValidation,true);
 for(const row of source.rows)assert.equal(createHash('sha256').update(row.rawText).digest('hex'),row.redactedBodySha256,row.label);
});
test('Source233 keeps opaque role membership distinct from read/write authority, including an actually stored empty role',()=>{
 for(const family of ['workspace','user'])for(const name of ['opaque','padded','limit-ascii','limit-unicode','first-nul','nul-only','limit-spaces','over-limit-spaces','over-limit-trailing-spaces']){
  const label=family+'-'+name;assert.equal(sourceOpaqueRoleRow(label+'-write').status,200);
  const subject=sourceOpaqueRoleRow(label+'-matrix').value.find(r=>r.id===2);assert.equal(subject.selected,true);
  const claim=sourceOpaqueRoleRow(label+'-claim').value.claims.workspaceAdmin.find(r=>r.id==='1');assert.equal(claim.flags.mode,subject.role);
  assert.equal(sourceOpaqueRoleRow(label+'-read').status,403);assert.equal(sourceOpaqueRoleRow(label+'-delete').status,403);
 }
 assert.equal(sourceOpaqueRoleRow('workspace-nul-only-matrix').value.find(r=>r.id===2).role,'');
 assert.equal(sourceOpaqueRoleRow('workspace-blank-matrix').value.find(r=>r.id===2).selected,false);
 for(const family of ['workspace','user'])for(const name of ['RO','RW','RW-nul-suffix']){
  assert.equal(sourceOpaqueRoleRow(family+'-'+name+'-read').status,200);
  assert.equal(sourceOpaqueRoleRow(family+'-'+name+'-delete').status,name==='RO'?403:200);
 }
});
test('Source233 measures PostgreSQL character length, excess-space truncation and first-NUL binding without hiding partial failures',()=>{
 for(const family of ['workspace','user']){
  for(const name of ['over-limit-ascii','over-limit-unicode','over-limit-leading-spaces']){
   assert.equal(sourceOpaqueRoleRow(family+'-'+name+'-write').status,500);
   assert.equal(sourceOpaqueRoleRow(family+'-'+name+'-matrix').value.find(r=>r.id===2).selected,false);
  }
  assert.equal(sourceOpaqueRoleRow(family+'-over-limit-spaces-matrix').value.find(r=>r.id===2).role,' '.repeat(10));
  assert.equal(sourceOpaqueRoleRow(family+'-over-limit-trailing-spaces-matrix').value.find(r=>r.id===2).role,'RO'+' '.repeat(8));
  assert.equal(sourceOpaqueRoleRow(family+'-first-nul-matrix').value.find(r=>r.id===2).role,'XX');
  assert.equal(sourceOpaqueRoleRow(family+'-RW-nul-suffix-matrix').value.find(r=>r.id===2).role,'RW');
 }
});
