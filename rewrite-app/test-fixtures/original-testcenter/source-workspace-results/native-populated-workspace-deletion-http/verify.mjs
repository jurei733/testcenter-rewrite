import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {verifyRuntime} from './runtime.mjs';

// Independent, read-only revalidation. Never replace the recorded witness or
// use SQL writes to compensate for the Source's measured orphan-group defect.
const root=new URL('./',import.meta.url),hash=b=>createHash('sha256').update(b).digest('hex');
const bytes=await readFile(new URL('observations.json',root)),data=JSON.parse(bytes);
const manifestBytes=await readFile(new URL('manifest.json',root)),manifest=JSON.parse(manifestBytes);
for(const[name,digest]of Object.entries(manifest.files))assert.equal(hash(await readFile(new URL(name,root))),digest,name);
assert.equal(data.verified,true);assert.equal(data.sourceCommit,'eedae41840cbe90e5547c0211da818bdf620f5aa');
assert.equal(data.sourceCommit,manifest.sourceCommit);assert.equal(data.actualHttpExchanges,97);assert.equal(data.rows.length,97);
assert.equal(data.ownedHTTPWorkspacesOnly,true);assert.equal(data.baselineRestored,true);assert.equal(data.sqlSeedsOrDaoStubs,false);assert.equal(data.readOnlySqlInspection,true);assert.equal(data.fullOriginalParityProven,false);
assert.deepEqual(data.runtimeBefore,data.runtimeAfter);assert.deepEqual(await verifyRuntime(),data.runtimeBefore);
for(const row of data.rows){assert.equal(hash(row.rawText),row.redactedBodySha256,row.label);if(row.subscribeToken)assert.match(row.subscribeToken,/^\[owned-subscribeToken-\d+\]$/);}
const row=label=>{const r=data.rows.find(r=>r.label===label);assert.ok(r,label);return r;},s=data.snapshots;
assert.equal(new Set(data.rows.map(r=>r.label)).size,97);assert.equal(new Set(data.createdOwnedIDs).size,2);
for(const family of ['users','workspaces','root-workspaces'])assert.deepEqual(row('baseline-'+family).value,row('final-'+family).value);
const baseline=row('baseline-workspaces').value;
for(const id of data.createdOwnedIDs)assert.ok(!baseline.some(w=>String(w.id)===id));
for(const kind of ['target','control']){
 assert.ok(data.createdOwnedIDs.includes(s.owned[kind].id));
 const b=s[kind+'Before'];assert.equal(b.files.exists,true);assert.ok(Object.keys(b.files.files).length>=4);
 for(const name of ['workspaces','workspace_users','files','logins','login_session_groups','login_sessions','person_sessions','tests','units','unit_data','unit_logs','unit_reviews','test_logs','test_reviews','test_commands'])assert.ok(b.sql[name]>0,name);
 assert.ok(row(kind+'-monitor-sessions').value.some(v=>String(v.testId)===s.owned[kind].testId));
}
assert.equal(row('wrong-password-delete').status,403);assert.equal(row('delete-populated-target').status,200);assert.equal(row('delete-populated-target').rawText,'');
for(const suffix of ['/files','/results','/responses/detailed','/report/response','/report/log','/report/review']){
 assert.equal(row('target-before'+suffix).rawText,row('target-after-denial'+suffix).rawText);
 assert.equal(row('control-before'+suffix).rawText,row('control-after-denial'+suffix).rawText);
 assert.equal(row('control-before'+suffix).rawText,row('control-after-delete'+suffix).rawText);
}
assert.deepEqual(s.controlBefore,s.controlAfter);assert.deepEqual(s.targetAfter.files,{exists:false,files:{}});
for(const[name,count]of Object.entries(s.targetAfter.sql))assert.equal(count,name==='login_session_groups'?1:0,name);
assert.equal(s.peersAfter.length,4);assert.equal(new Set(s.peersAfter.map(p=>p.label)).size,4);
for(const peer of s.peersAfter){assert.equal(peer.closed,true);assert.equal(peer.closeCode,1005);assert.equal(peer.closeReason,'');
 if(peer.label.endsWith('-commands'))assert.ok(peer.messages.some(m=>m.event==='commands'&&m.data.some(c=>c.keyword==='pause')));
}
assert.equal(s.cacheBefore['/clients'].length,4);assert.equal(s.cacheBefore['/testees'].length,2);assert.equal(s.cacheBefore['/monitors'].length,2);assert.ok(s.cacheBefore['/test-sessions'].length>=2);
assert.deepEqual(s.cacheAfter,{'/clients':[],'/testees':[],'/monitors':[],'/test-sessions':[]});
assert.equal(row('deleted-participant-session').status,403);assert.equal(row('deleted-test').status,403);assert.equal(row('retained-participant-session').status,200);
assert.equal(row('retained-fresh-commands').status,200);assert.equal(s.freshSubscriptionAccepted,true);
const proof={verified:true,sourceCommit:data.sourceCommit,observationSha256:hash(bytes),manifestSha256:hash(manifestBytes),verifierSha256:hash(await readFile(new URL('verify.mjs',root))),
 sourceFiles:137,broadcasterSourceFiles:38,composerPackages:19,actualHttpExchanges:97,ownedWorkspaces:2,baselineUsersWorkspacesGrantsAndFilesUnchanged:true,
 controlReportsAndFilesByteIdentical:true,realCommandsDelivered:true,allFourPeersSilentlyClosed:true,allBroadcasterCachesEmptied:true,freshSubscriptionAccepted:true,
 sourceOrphanGroupRows:1,rewriteMustRemoveOwnedGroupRows:true,sqlSeedsOrDaoStubs:false,readOnlyVerification:true,fullOriginalParityProven:false};
const receipt=new URL('independent-verification.json',root);
if(process.argv.includes('--record'))await writeFile(receipt,JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
else assert.deepEqual(JSON.parse(await readFile(receipt)),proof);
console.log(JSON.stringify(proof));
