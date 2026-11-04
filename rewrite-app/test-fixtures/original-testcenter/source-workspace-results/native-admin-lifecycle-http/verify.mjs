import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';

// Revalidate the actual read-only Source runtime and frozen HTTP archive.
// Recording is exclusive; verification never replaces an existing receipt.
const root=new URL('./',import.meta.url),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const bytes=await readFile(new URL('observations.json',root)),data=JSON.parse(bytes);
const manifestBytes=await readFile(new URL('manifest.json',root)),manifest=JSON.parse(manifestBytes);
for(const[name,digest]of Object.entries(manifest.files))assert.equal(hash(await readFile(new URL(name,root))),digest,name);
const runtime=JSON.parse(execFileSync(process.execPath,[new URL('../native-workspace-permissions-http/verify.mjs',root).pathname],{encoding:'utf8',env:process.env}));
assert.equal(data.verified,true);assert.equal(data.baselineRestored,true);assert.equal(data.ownedSyntheticAccountsOnly,true);
assert.equal(data.sqlSeedsOrDaoStubs,false);assert.equal(data.fullOriginalParityProven,false);
assert.equal(data.sourceCommit,manifest.sourceCommit);assert.equal(data.sourceCommit,runtime.sourceCommit);
assert.deepEqual(data.sourceRuntimeBefore,data.sourceRuntimeAfter);assert.deepEqual(data.sourceRuntimeAfter,runtime);
assert.equal(Object.keys(data.sourceHashes).length,137);assert.equal(runtime.composerPackages,19);
assert.equal(data.rows.length,112);assert.equal(data.actualHttpExchanges,112);
assert.equal(new Set(data.rows.map(row=>row.label)).size,112);
for(const row of data.rows)assert.equal(hash(row.rawText),row.redactedBodySha256,row.label);
const row=label=>{const found=data.rows.find(row=>row.label===label);assert.ok(found,label);return found;};
const baseline=row('baseline-users').value;
assert.deepEqual(row('final-users').value,baseline);assert.deepEqual(row('final-workspaces').value,row('baseline-workspaces').value);
assert.equal(data.createdOwnedIDs.length,5);assert.equal(new Set(data.createdOwnedIDs).size,5);
assert.ok(data.createdOwnedIDs.every(id=>!baseline.some(user=>String(user.id)===id)));
const target=row('create-target').rawText,partial=row('create-partial-victim').rawText,self=row('create-self-owned').rawText;
for(const status of ['on','true','1','TRUE','True','ON','On','off','false','0','FALSE','False','OFF','Off']){
 assert.equal(row('status-'+JSON.stringify(status)).status,200);
 assert.equal(Boolean(row('after-status-'+JSON.stringify(status)).value.find(user=>String(user.id)===target).isSuperadmin),status==='on');
}
for(const status of ['undefined','2','yes','on '])assert.equal(row('status-'+JSON.stringify(status)).status,400);
assert.equal(row('invalid-status-before-password').rawText,'New Status `undefined` is undefined!');
for(const prefix of ['status','delete']){
 assert.equal(row('missing-'+prefix).status,401);assert.equal(row('invalid-'+prefix).status,403);assert.equal(row('non-root-'+prefix).status,403);
}
for(const label of ['status-password-false','status-password-array','status-password-object','status-invalid-json','delete-false-password','delete-array-password','delete-object-password','delete-string-list','delete-object-list','delete-invalid-json'])assert.equal(row(label).status,500);
assert.equal(row('delete-partial-before-invalid').status,500);
assert.ok(!row('after-delete-partial').value.some(user=>String(user.id)===partial),'The real Source commits its earlier deletion before a later invalid element fails.');
assert.equal(row('owned-self-demotion').status,200);
assert.equal(Boolean(row('after-owned-self-demotion').value.find(user=>String(user.id)===self).isSuperadmin),false);
assert.equal(row('owned-self-delete').status,200);assert.equal(row('owned-self-session-after-delete').status,403);
assert.ok(!row('after-owned-self-delete').value.some(user=>String(user.id)===self));
const proof={verified:true,sourceCommit:data.sourceCommit,observationSha256:hash(bytes),manifestSha256:hash(manifestBytes),
 verifierSha256:hash(await readFile(new URL('./verify.mjs',root))),sourceFiles:137,composerPackages:19,actualHttpExchanges:112,
 backendImage:runtime.backendImage,ownedCreatedAccounts:5,baselineRestored:true,readOnlyVerification:true,sqlSeedsOrDaoStubs:false,
 sourceUnsafeBehaviorCaptured:{partialDeletion:true,selfDemotion:true,selfDeletion:true},rewriteSecurityGatesMustRemain:true};
const receipt=new URL('independent-verification.json',root);
if(process.argv.includes('--record'))await writeFile(receipt,JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
else assert.deepEqual(JSON.parse(await readFile(receipt)),proof,'The independent receipt must remain frozen.');
console.log(JSON.stringify(proof));
