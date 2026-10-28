import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import test from 'node:test';
import ts from 'typescript';

// Production Source evidence only: native monitor-person and command adapters
// remain implementation work. These checks must not imply Rewrite adoption.
const root=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-test-command/',import.meta.url);
const read=name=>readFile(new URL(name,root),'utf8');
const manifest=JSON.parse(await read('manifest.json')),receipt=JSON.parse(await read('receipt.json'));
const httpText=await read('http-observations.json'),http=JSON.parse(httpText);
const old=JSON.parse(await readFile(new URL('../native-test-lock/receipt.json',root),'utf8'));

test('unchanged production Source65 pins all57 prior groups and43 actual Source files without SQL seeds or test mode',async()=>{
 assert.equal(manifest.sourceCommit,'eedae41840cbe90e5547c0211da818bdf620f5aa');assert.equal(manifest.probeCommit,'693a169891aa8ae186ff231b4895160a0e614a66');
 assert.equal(manifest.probeTree,'dd8b2cbb672a4aac7a3d41b67083e14eaa8b1993');assert.equal(manifest.runId,40635022432);assert.equal(manifest.jobId,122639886462);
 assert.equal(manifest.artifactId,12792503946);assert.equal(manifest.artifactBytes,80472);assert.equal(manifest.artifactSha256,'23fece5cb5dec1a1f339f22cfb49d86d73485ffedee09e67f516611b03570a49');
 assert.equal(manifest.sourceProbeSha256,'b9707f3b8712b93bd4734b248b38d9fb8592652fa81f08494d3eda8563ab6d0f');
 assert.equal(receipt.success,true);assert.equal(receipt.testMode,false);assert.equal(receipt.checks.length,65);assert.equal(http.length,612);assert.equal(Object.keys(receipt.sourceFiles).length,43);
 assert.deepEqual(receipt.checks.slice(0,57).map(x=>x.name),old.checks.map(x=>x.name));for(const[name,hash]of Object.entries(old.sourceFiles))assert.equal(receipt.sourceFiles[name],hash);
 assert.equal(receipt.sourceFiles['frontend/src/app/group-monitor/backend.service.ts'],'6031cc3838048aba3e8b103d610bf3a9cb7aefe94b9ccd761ce11d94f9a2d22c');
 for(const[name,hash]of Object.entries(manifest.files)){assert.match(name,/^[a-z0-9][a-z0-9.-]*$/);assert.equal(createHash('sha256').update(await readFile(new URL(name,root))).digest('hex'),hash,name);}
 const probe=await read('source-probe.mjs'),previous=await readFile(new URL('../native-test-lock/source-probe.mjs',root),'utf8');
 assert.equal(probe.split('  // Independent native command transport:')[0],previous.split('  receipt.success = true;')[0]);
 const ast=ts.createSourceFile('source.mjs',probe,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);let calls=0;
 const walk=node=>{if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='xml'){assert.equal(node.arguments.length,4);calls++;}ts.forEachChild(node,walk);};walk(ast);assert.equal(calls,8);
 assert.ok(probe.includes('const clock=1793158800;'));assert.equal(manifest.newAppImplementation,false);
});

test('actual monitor login is an uncoded person with both Test and testGroupMonitor claims',()=>{
 const reply=http.find(row=>row.method==='PUT'&&row.path==='/session'&&row.value?.loginName==='owned-native-command-monitor');assert.ok(reply);assert.equal(reply.status,200);
 const person=reply.value;assert.deepEqual(person.flags,[]);assert.equal(person.id,null);assert.equal(person.pwSetByAdmin,null);assert.deepEqual(person.viewSettings,[]);
 assert.deepEqual(person.claims.test.map(x=>[x.id,x.type,x.flags]),[['ORACLE.POW.BOOK','test',{locked:false,running:false}]]);
 assert.deepEqual(person.claims.testGroupMonitor,[{id:'ORACLE.COMMAND',type:'testGroupMonitor',label:'Owned native commands',flags:[]}]);
 assert.deepEqual(person.access,{test:['ORACLE.POW.BOOK'],testGroupMonitor:['ORACLE.COMMAND']});
 assert.match(person.token,/^\[redacted-owned-token-\d+\]$/);assert.match(person.groupToken,/^\[redacted-owned-groupToken-\d+\]$/);
 assert.equal(httpText.includes('owned-native-pow-secret'),false);assert.equal(httpText.includes('owned-source-super-secret'),false);
});

test('actual command packets retain shared IDs, seconds, PHP string arguments, strict body filtering and scoped ACK reasons',async()=>{
 const initial=JSON.parse(await read('command-initial.json')),peer=JSON.parse(await read('command-peer.json'));assert.equal(initial.length,3);assert.equal(peer.length,1);
 assert.deepEqual(initial.map(x=>x.id),[1,2,3]);assert.deepEqual(initial.map(x=>x.timestamp),[1793158810,1793158820,1793158820]);
 assert.deepEqual(initial[0].arguments,['Ω/x','0','','1','','42','1.5']);assert.deepEqual(peer,[initial[0]]);
 assert.deepEqual(Object.keys(initial[0]),['id','keyword','arguments','timestamp']);
 const filter=receipt.checks[60];assert.deepEqual(filter.query,initial);assert.deepEqual(filter.afterFirst,initial.slice(1));assert.deepEqual(filter.afterEqualTimestamp,[]);assert.deepEqual(filter.unknownScopedId,[]);assert.deepEqual(filter.zero,initial);assert.equal(filter.stringBodyId,500);
 const ack=receipt.checks[61];assert.equal(ack.firstReason,'OK');assert.equal(ack.repeatedReason,'OK, was already marked as executed');assert.equal(ack.unknownCommand,404);assert.equal(ack.unaddressedSharedId,404);assert.equal(ack.peerUnchanged,true);
 const locked=receipt.checks[63];assert.equal(locked.lockedCommand.keyword,'owned.command.locked');assert.equal(locked.lockedTestRead,423);
});

test('actual zero-clock polling retains LOST but appends raw zero-timestamp POLLING logs on every poll',async()=>{
 const polling=receipt.checks[62];assert.equal(polling.firstStart,true);assert.equal(polling.secondStart,false);assert.deepEqual(polling.laststate,{CONNECTION:'LOST'});assert.equal(polling.subscribeToken,null);
 assert.equal(polling.firstServerLogs.length,1);assert.equal(polling.repeatedServerLogs.length,2);
 const rows=JSON.parse(await read('command-polling.json'));assert.equal(rows.length,6);
 assert.deepEqual(rows.map(x=>[x.timestamp,x.logentry]),[[777,'CONNECTION : "LOST"'],[0,'"CONNECTION" : POLLING'],[0,'"CONNECTION" : POLLING'],[1793158850,'Owned command locked polling'],[0,'"CONNECTION" : POLLING'],[0,'"CONNECTION" : POLLING']]);
 assert.equal(rows.every(row=>row.groupname==='ORACLE.COMMAND'&&row.loginname==='owned-native-command-one'&&row.bookletname==='ORACLE.POW.BOOK#command:one'),true);
});
