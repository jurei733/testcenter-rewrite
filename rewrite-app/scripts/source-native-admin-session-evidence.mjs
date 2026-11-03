import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
const root=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-admin-session-http/',import.meta.url);
const read=async name=>JSON.parse(await readFile(new URL(name,root),'utf8'));
const manifest=await read('manifest.json'),source=await read('observations.json'),verified=await read('independent-verification.json');
const sha=value=>createHash('sha256').update(value).digest('hex');
export const nativeAdminSessionSource=source;
export const nativeAdminSessionSourceRow=name=>{const row=source.rows.find(r=>r.label===name);assert.ok(row,name);return row;};
const row=nativeAdminSessionSourceRow;
test('actual Source Admin107 reference binds both genuine backends and unchanged production dependencies',async()=>{
 assert.equal(manifest.sourceCommit,'eedae41840cbe90e5547c0211da818bdf620f5aa');assert.equal(manifest.testMode,false);assert.equal(manifest.sqlSeedsOrDaoStubs,false);assert.equal(manifest.actualSourceHttpRequests,107);
 assert.equal(source.sourceCommit,manifest.sourceCommit);assert.equal(source.rows.length,107);assert.equal(new Set(source.rows.map(r=>r.label)).size,107);assert.equal(source.sourceFilesVerifiedBeforeAndAfter,137);assert.equal(Object.keys(source.sourceHashes).length,137);
 for(const [name,digest]of Object.entries(manifest.files)){assert.match(name,/^[a-z][a-z0-9.-]*$/);assert.equal(sha(await readFile(new URL(name,root))),digest,name);}
 for(const r of source.rows)assert.equal(sha(r.rawText),r.redactedBodySha256,r.label);
 assert.equal(verified.verified,true);assert.equal(verified.actualSourceHttpRequests,107);assert.equal(verified.sourceFilesBeforeAndAfter,137);assert.equal(verified.additionalSourceFilesVerifiedAfterCapture,2);
 assert.ok(source.sqlReadsOnly.every(r=>/^(SELECT|SHOW) /.test(r.query)));assert.match(source.actualPostgres,/PostgreSQL 18\.4/);assert.match(source.actualRedis,/redis_version:8\.0\.6/);
 for(const [role,runtime]of Object.entries(verified.runtime)){assert.equal(runtime.version,'19.0.0');assert.equal(runtime.xmlSchemaValidation,true);assert.equal(runtime.allowTestMode,false);assert.equal(runtime.staticTime,'now');assert.equal(runtime.staticTokens,false);assert.equal(runtime.insecurePasswords,false);assert.deepEqual(runtime.protection,role==='open'?['login','person']:['admin','login','person']);assert.equal(source.phpVersions[role],'8.3.36');}
 assert.equal(source.vendors.length,2);assert.ok(source.vendors.every(v=>v.installedPackages===19&&v.requiredProductionPackages===19));
});
test('actual Source Admin AccessSets retain empty claims, numeric user IDs and nullable participant fields',()=>{
 const admin=row('root-first').value;assert.equal(admin.id,1);assert.equal(admin.loginName,'super');assert.equal(admin.displayName,'super');assert.equal(admin.groupLabel,null);assert.equal(admin.groupToken,null);assert.equal(admin.pwSetByAdmin,false);assert.deepEqual(admin.claims,{workspaceAdmin:[],superAdmin:[]});assert.deepEqual(admin.access,{workspaceAdmin:[],superAdmin:[]});assert.deepEqual(admin.customTexts,{});assert.deepEqual(admin.flags,[]);assert.deepEqual(admin.viewSettings,[]);
 const user=row('user-no-workspaces');assert.equal(user.status,200);assert.equal(user.value.id,3);assert.equal(user.value.pwSetByAdmin,true);assert.deepEqual(user.value.claims,{workspaceAdmin:[]});assert.deepEqual(user.value.access,{workspaceAdmin:[]});
});
test('actual Source Admin login compares names without trimming and replaces the old session',()=>{
 const first=row('admin-no-grants').value,second=row('admin-case-folded-name').value;assert.equal(first.loginName,'OwnedÄdmin');assert.equal(second.loginName,first.loginName);assert.equal(second.id,first.id);assert.notEqual(second.token,first.token);assert.equal(row('old-admin-token-rotated').status,403);
 assert.equal(row('admin-leading-space-name').status,400);assert.equal(row('admin-trailing-space-name').status,400);assert.equal(row('admin-logout').status,205);assert.equal(row('admin-logout').rawText,'');assert.equal(row('logged-out-admin-read-denied').status,403);assert.equal(row('deleted-user-token-denied').status,403);
});
test('actual Source Admin session reads refresh ten-hour lifetime and current explicit workspace claims',()=>{
 assert.deepEqual(row('session-live-explicit-grants').value.claims.workspaceAdmin,[{id:'1',type:'workspaceAdmin',label:'Zulu Ω',flags:{mode:'RO'}},{id:'2',type:'workspaceAdmin',label:'Alpha Ä',flags:{mode:'RW'}}]);
 assert.equal(row('root-no-inherited-workspace').status,404);assert.equal(row('regular-RO-results').status,200);assert.equal(row('session-live-renamed-label').value.claims.workspaceAdmin[0].label,'Changed current workspace β');assert.deepEqual(row('session-live-all-grants-revoked').value.claims,{workspaceAdmin:[]});assert.equal(row('revoked-workspace-hidden').status,404);
 assert.ok(Object.hasOwn(row('session-live-promoted').value.claims,'superAdmin'));assert.ok(!Object.hasOwn(row('session-live-demoted').value.claims,'superAdmin'));assert.equal(row('demoted-directory-current-token-denied').status,403);
 const sql=name=>source.sqlReadsOnly.find(r=>r.label===name).rawText;assert.ok(BigInt(sql('admin-expiry-after-refresh'))>BigInt(sql('admin-expiry-before-refresh')));assert.equal(sql('admin-expiry-minutes'),'600');
});
test('actual Source Admin required-field precedence and native error bytes remain explicit',()=>{
 for(const label of ['direct-missing-body','direct-missing-name','direct-null-name']){assert.equal(row(label).status,400);assert.equal(row(label).rawText,'Required body-parameter is missing: `name`');}
 for(const label of ['direct-missing-password','direct-null-password']){assert.equal(row(label).status,400);assert.equal(row(label).rawText,'Required body-parameter is missing: `password`');}
 for(const label of ['direct-name-empty','direct-name-over50','direct-name-number','direct-name-array','direct-name-object','direct-password-number','direct-password-array','direct-password-object']){assert.equal(row(label).status,500);assert.equal(row(label).rawText,'Internal error.');}
 assert.equal(row('direct-password-empty').status,400);assert.equal(row('direct-password-empty').rawText,'No login with this password.');
 for(const r of source.rows.filter(r=>r.status>=400)){assert.equal(r.testMode,'NO',r.label);assert.ok(r.errorId,r.label);assert.equal(r.contentType,'text/html;charset=UTF-8',r.label);}
});
test('actual Source proof and password observations cannot weaken existing Rewrite security gates',()=>{
 assert.equal(row('protected-direct-empty-name').status,400);assert.equal(row('protected-direct-valid-name').status,400);assert.match(row('protected-direct-valid-name').rawText,/Brute Force protection active/);
 assert.equal(row('protected-admin-solution').value.id,2);assert.equal(row('protected-admin-proof-replay').status,200);assert.notEqual(row('protected-admin-solution').value.token,row('protected-admin-proof-replay').value.token);
 assert.equal(row('rate-correct-still-denied').status,429);assert.equal(row('case-variant-rate-bucket').status,200);assert.equal(row('session-after-self-password-change').status,200);assert.equal(row('session-after-self-password-change').value.pwSetByAdmin,false);assert.equal(row('session-after-root-password-reset').value.pwSetByAdmin,true);
 assert.ok(manifest.requiredSecurityPreservation.includes('Encrypted credential tickets and durable one-use proofs'));assert.ok(manifest.requiredSecurityPreservation.includes('Normalized rate-limit buckets and existing configured limits'));assert.ok(manifest.requiredSecurityPreservation.includes('Existing password-change session revocation'));
});
test('actual Source directory and same-name participant/Admin sessions keep their own identities',()=>{
 assert.equal(row('root-users').value.length,5);assert.ok(row('root-users').value.every(u=>u.email===null&&typeof u.id==='number'&&typeof u.isSuperadmin==='boolean'));
 assert.deepEqual(row('root-workspaces').value.map(w=>w.name),['Alpha Ä','Zulu Ω']);assert.ok(row('root-workspaces').value.every(w=>w.latest_modification_ts===null));assert.equal(row('regular-users-denied').status,403);
 const person=row('same-name-participant-solution').value,admin=row('same-name-admin-refresh').value;assert.equal(person.loginName,admin.loginName);assert.equal(person.id,null);assert.equal(person.groupLabel,'Owned');assert.equal(admin.id,2);assert.equal(admin.groupLabel,null);assert.notEqual(person.token,admin.token);assert.ok(Object.hasOwn(person.claims,'test'));assert.equal(row('participant-token-directory-denied').status,403);
});
test('unchanged Source Admin serializer emits unsafe int64 User ID and decimal Workspace claim without rounding',async()=>{
 const actual=await read('php-access-set.json');assert.equal(actual.actualUnchangedSourceMethod,'AccessSet::createFromAdminToken');assert.equal(sha(actual.rawText),actual.sha256);assert.equal(actual.noSqlOrHttpRequest,true);assert.ok(actual.rawText.includes('"id":9007199254740993'));assert.ok(!actual.rawText.includes('"id":9007199254740992'));assert.ok(actual.rawText.includes('"id":"9007199254740995"'));assert.equal(JSON.parse(actual.rawText).claims.workspaceAdmin[0].flags.mode,'RO');
});
