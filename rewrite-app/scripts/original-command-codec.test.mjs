import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {decodeOriginalTestLogJson,parseOriginalCommandFields,prepareOriginalCommandInsert,formatOriginalCommandsJson,readOriginalLastCommandId} from '@testcenter-rewrite-app/application';
const root=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-test-command-boundaries/',import.meta.url);
const read=async name=>JSON.parse(await readFile(new URL(name,root),'utf8'));
const manifest=await read('manifest.json'),receipt=await read('receipt.json'),cases=await read('command-producer-boundaries.json');
const prior=new URL('../native-test-command/',root),old=JSON.parse(await readFile(new URL('receipt.json',prior),'utf8'));
test('immutable production Source67 retains65 prior groups,1080HTTP,43Source files and52 actual producer boundaries',async()=>{
 assert.equal(manifest.sourceCommit,'eedae41840cbe90e5547c0211da818bdf620f5aa');assert.equal(manifest.probeCommit,'d3c855d1a5c22e268429e61afcf221b96e6c4360');assert.equal(manifest.probeTree,'88711cf74b75c4f92abebfacf098c04685dfae17');assert.equal(manifest.runId,40643360991);assert.equal(manifest.jobId,122666403634);assert.equal(manifest.artifactId,12796173035);assert.equal(manifest.artifactBytes,100519);assert.equal(manifest.artifactSha256,'847643f3938f18fa50d46cc78471ee9ad97380baea78e9c47162db50821f9196');
 assert.equal(receipt.success,true);assert.equal(receipt.testMode,false);assert.equal(receipt.checks.length,67);assert.equal((await read('http-observations.json')).length,1080);assert.deepEqual(receipt.sourceFiles,old.sourceFiles);assert.equal(Object.keys(receipt.sourceFiles).length,43);assert.deepEqual(receipt.checks.slice(0,65).map(row=>row.name),old.checks.map(row=>row.name));assert.equal(cases.length,52);assert.deepEqual(cases,receipt.checks[65].cases);assert.equal(receipt.checks[66].beforeAndAfterMarkers,104);
 for(const[name,hash]of Object.entries(manifest.files)){assert.match(name,/^[a-z0-9][a-z0-9.-]*$/);assert.equal(createHash('sha256').update(await readFile(new URL(name,root))).digest('hex'),hash,name);}
 const probe=await readFile(new URL('source-probe.mjs',root),'utf8'),before=await readFile(new URL('source-probe.mjs',prior),'utf8');assert.ok(probe.startsWith(before.slice(0,before.indexOf('\n  }\n\n  receipt.success'))));
});
for(const source of cases)test('Source67 producer codec: '+source.label,()=>{
 let fields;
 try{fields=parseOriginalCommandFields(decodeOriginalTestLogJson(source.body));}catch(error){assert.equal(error.statusCode,source.produced.status);assert.equal(source.sequenceDelta,1,'construction failure precedes allocation');assert.deepEqual(source.polled.value,[]);return;}
 // Source resolves the entire int-cast target list before reserving a command.
 const missing=fields.testNumbers.some(id=>id!==String(source.targetTestId));
 if(missing){assert.equal(source.produced.status,404);assert.equal(source.sequenceDelta,1);assert.deepEqual(source.polled.value,[]);return;}
 if(!fields.testNumbers.length){assert.equal(source.produced.status,201);assert.equal(source.sequenceDelta,1);assert.deepEqual(source.polled.value,[]);return;}
 assert.equal(source.sequenceDelta,2,'a real INSERT or SQL validation failure consumes the reserved identity');
 let inserted;try{inserted=prepareOriginalCommandInsert(fields);}catch(error){assert.equal(error.statusCode,source.produced.status);assert.equal(source.produced.status,500);assert.deepEqual(source.polled.value,[]);return;}
 assert.equal(source.produced.status,201);
 const packet={id:String(source.sequenceBefore+1),...inserted};
 if(source.polled.status===500)assert.throws(()=>formatOriginalCommandsJson([packet]),error=>error.statusCode===500);
 else assert.deepEqual(JSON.parse(formatOriginalCommandsJson([packet])),source.polled.value);
});
test('actual Source65 strict last-command body IDs retain int64 lexical type and ignore absent fields',()=>{
 for(const body of ['{}','null','[]','{"lastCommandId":null}','{"lastCommandId":0}'])assert.equal(readOriginalLastCommandId(decodeOriginalTestLogJson(body)),null);
 assert.equal(readOriginalLastCommandId(decodeOriginalTestLogJson('{"lastCommandId":9223372036854775807}')),'9223372036854775807');
 for(const body of ['{"lastCommandId":"1"}','{"lastCommandId":1.0}','{"lastCommandId":true}','{"lastCommandId":false}','{"lastCommandId":[]}','{"lastCommandId":{}}','{"lastCommandId":9223372036854775808}'])assert.throws(()=>readOriginalLastCommandId(decodeOriginalTestLogJson(body)),e=>e.statusCode===500);
});
