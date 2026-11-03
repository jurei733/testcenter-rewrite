import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import test from 'node:test';
const directory=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-workspace-administration-http/',import.meta.url);
export const nativeWorkspaceSource=JSON.parse(await readFile(new URL('observations.json',directory),'utf8'));
const manifest=JSON.parse(await readFile(new URL('manifest.json',directory),'utf8'));
export const actualSourceFieldExtraction=JSON.parse(await readFile(new URL('php-field-extraction.json',directory),'utf8'));
export const actualSourceWorkspaceCasts=JSON.parse(await readFile(new URL('php-workspace-casts.json',directory),'utf8')).observations;
export const nativeWorkspaceSourceRow=label=>{const rows=nativeWorkspaceSource.rows.filter(row=>row.label===label);assert.equal(rows.length,1,label);return rows[0];};
test('Source197 records actual unmodified production administration with pinned files and vendor',async()=>{
 assert.equal(nativeWorkspaceSource.verified,true);assert.equal(nativeWorkspaceSource.sourceCommit,'eedae41840cbe90e5547c0211da818bdf620f5aa');
 assert.equal(nativeWorkspaceSource.rows.length,197);assert.equal(nativeWorkspaceSource.sourceFilesVerifiedBeforeAndAfter,137);assert.equal(Object.keys(nativeWorkspaceSource.sourceHashes).length,137);
 assert.equal(nativeWorkspaceSource.vendor.installedPackages,19);assert.equal(nativeWorkspaceSource.vendor.allInstalledVersionsAndSourceReferencesMatchPinnedLock,true);
 assert.equal(nativeWorkspaceSource.sqlSeedsOrDaoStubs,false);assert.equal(manifest.XMLSchemaValidation,true);assert.equal(manifest.testModeAllowed,false);
 for(const[file,sha]of Object.entries(manifest.files))assert.equal(createHash('sha256').update(await readFile(new URL(file,directory))).digest('hex'),sha,file);
 assert.match(manifest.runtime.postgres,/PostgreSQL 18\.4 /);assert.match(manifest.runtime.redis,/v=8\.0\.6/);assert.match(manifest.runtime.php,/PHP 8\.3\.36/);
 const previous=JSON.parse(await readFile(new URL('../native-test-administration-http/observations.json',directory),'utf8'));
 const counts=rows=>rows.reduce((map,row)=>(map.set(row.label,(map.get(row.label)??0)+1),map),new Map());
 const all=counts(nativeWorkspaceSource.rows);for(const[label,count]of counts(previous.rows))assert.ok(all.get(label)>=count,label);
});
test('Source197 requires explicit workspace grants even for superadmins and preserves hidden-scope404 versus RO403',()=>{
 assert.ok(Object.hasOwn(nativeWorkspaceSource.rows.find(r=>r.label==='admin').value.claims,'superAdmin'));
 for(const label of ['superadmin-without-explicit-grant','superadmin-without-grant-delete','foreign-ungranted-results','foreign-ungranted-responses-detailed','foreign-ungranted-report-response'])assert.equal(nativeWorkspaceSourceRow(label).status,404,label);
 assert.equal(nativeWorkspaceSourceRow('RO-unknown-selected-delete').status,403);
 for(const[label,status]of [['missing',401],['empty',401],['unknown',403]])assert.equal(nativeWorkspaceSourceRow('native-admin-auth-'+label).status,status);
});
test('Source197 measures actual PHP numeric path aliases and signed64 saturation without rewriting runner metadata',()=>{
 const known=new Map(actualSourceWorkspaceCasts);
 for(const value of ['1','01',' +1','1abc','1.9','1e0'])assert.equal(known.get(value),'1',value);
 assert.equal(known.get('9007199254740993'),'9007199254740993');assert.equal(known.get('9007199254740993.0'),'9007199254740992');
 assert.equal(known.get('9223372036854775808'),'9223372036854775807');assert.equal(known.get('1e999'),'0');
 for(const row of nativeWorkspaceSource.rows.filter(r=>r.label.startsWith('numeric-workspace-'))){
  const value=row.label.slice('numeric-workspace-'.length);assert.ok([200,404].includes(row.status));if(['01',' +1','1abc','1.9','1e0'].includes(value))assert.equal(row.rawText,'[]');
 }
});
test('Source197 accepts first supported report media type including q=0 and emits zero-byte empty bodies',()=>{
 const csv=new Set([1,2,6,7]);
 for(const type of ['response','log','review'])for(let i=0;i<9;i++){
  const row=nativeWorkspaceSourceRow('empty-report-'+type+'-accept-'+i);assert.equal(row.status,200);assert.equal(row.rawText,'');
  assert.equal(row.contentType,csv.has(i)?'text/csv;charset=UTF-8':'application/json');assert.equal(row.bodySha256,createHash('sha256').update('').digest('hex'));
 }
 for(const flag of ['true','TRUE','false','1',''])assert.equal(nativeWorkspaceSourceRow('empty-enhanced-review-'+flag).rawText,'');
 assert.equal(nativeWorkspaceSourceRow('unknown-report-type').status,404);
});
test('Source197 preserves native dataIds case comparison and comma splitting without trimming or ZIP defaults',()=>{
 const baseline=nativeWorkspaceSourceRow('retained-response-before-delete').rawText;
 for(let i=0;i<7;i++){
  const row=nativeWorkspaceSourceRow('response-dataIds-'+i+'-application-json');assert.equal(row.status,200);
  assert.equal(row.rawText,[0,1,2,4].includes(i)?baseline:'');
 }
});
test('Source197 retains required-null400 scalar/array PDO coercion and object500 without affecting real Tests',()=>{
 for(const label of ['null-required-login','null-required-booklet'])assert.equal(nativeWorkspaceSourceRow('selection-coercion-'+label).status,400);
 for(const label of ['empty-required-strings','null-optionals','numeric-fields','boolean-fields','array-code','array-login'])assert.equal(nativeWorkspaceSourceRow('selection-coercion-'+label).status,200,label);
 for(const label of ['object-code','object-booklet']){const row=nativeWorkspaceSourceRow('selection-coercion-'+label);assert.equal(row.status,500);assert.equal(row.rawText,'Internal error.');}
 assert.equal(nativeWorkspaceSourceRow('coercion-probes-preserve-every-real-test').rawText,nativeWorkspaceSourceRow('exact-group-and-numeric-test-order').rawText);
});
test('Source197 retains the preceding actual selected-Test cascade and current capability controls',()=>{
 for(const key of ['exactScopedSelectedDeletion','samePersonBearerRetained','unrelatedAnswerByteExact','recreatedTestUsesNewIdAndLabel','firstCodeAndSuffixPreserved'])assert.equal(nativeWorkspaceSource.cases[key],true,key);
 assert.equal(nativeWorkspaceSourceRow('retained-response-after-delete').rawText,nativeWorkspaceSourceRow('b-only-answer-baseline').rawText);
 assert.equal(nativeWorkspaceSourceRow('deleted-test-bearer-boundary').status,403);assert.equal(nativeWorkspaceSourceRow('same-person-session-after-delete').status,200);
});
