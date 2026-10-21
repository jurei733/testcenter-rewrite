import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createServer} from 'node:http';
import test from 'node:test';
import {pollSmokeJson} from './poll-smoke-json.mjs';

const helper = new URL('./poll-smoke-json.mjs', import.meta.url).href;
for (const held of ['request', 'body']) test(`a handle-free stalled ${held} fails normally and executes finally instead of Node exit 13`, () => {
  const expression = held === 'request' ? 'new Promise(()=>{})' : 'Promise.resolve({ok:true,json:()=>new Promise(()=>{})})';
  const old = spawnSync(process.execPath, ['--input-type=module','-e',
    `const response=await ${expression};await response.json();`], {encoding:'utf8',timeout:2000});
  assert.equal(old.error,undefined); assert.equal(old.status,13);
  const current = spawnSync(process.execPath, ['--input-type=module','-e',
    `import {pollSmokeJson} from ${JSON.stringify(helper)};
     try{await pollSmokeJson('http://owned.invalid/readyz',{fetcher:()=>${expression},timeoutMs:40});}
     catch(error){console.error(error.message);process.exitCode=37;}
     finally{console.log('owned-cleanup');}`], {encoding:'utf8',timeout:2000});
  assert.equal(current.error,undefined);assert.equal(current.status,37);
  assert.match(current.stderr,new RegExp('phase='+held));assert.equal(current.stdout,'owned-cleanup\n');
});

async function ownedServer(handler, action) {
  const server = createServer(handler);
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  try {await action('http://127.0.0.1:'+server.address().port);}
  finally {server.closeAllConnections();await new Promise(done=>server.close(done));}
}
for (const held of ['headers','body']) test(`the absolute deadline aborts a real HTTP response held at ${held}`, () => {
  let requests=0;
  return ownedServer((request,response)=>{
    requests++;
    if(held==='body'){response.writeHead(200,{'content-type':'application/json'});response.write('{"ready":');}
  },async base=>{
    const phases=[];
    await assert.rejects(pollSmokeJson(base+'/readyz',{timeoutMs:300,intervalMs:10,onPhase:phase=>phases.push(phase)}), /HTTP JSON timeout/);
    assert.equal(requests,1);
    assert.equal(phases.at(-1).phase,held==='headers'?'request':'body');
  });
});
test('temporary non-ready responses are consumed and the eventual real JSON is returned', () => {
  let requests=0;
  return ownedServer((request,response)=>{
    response.writeHead(++requests<3?503:200,{'content-type':'application/json'});
    response.end(JSON.stringify({ready:requests===3}));
  },async base=>{
    const statuses=[];
    const result=await pollSmokeJson(base+'/readyz',{timeoutMs:2000,intervalMs:5,
      onPhase:phase=>{if(phase.phase==='headers')statuses.push(phase.status);}});
    assert.deepEqual(result,{ready:true});assert.deepEqual(statuses,[503,503,200]);
  });
});
test('successful polling disposes the long referenced deadline before process exit', () => {
  const result=spawnSync(process.execPath,['--input-type=module','-e',
    `import {pollSmokeJson} from ${JSON.stringify(helper)};
     const result=await pollSmokeJson('http://owned.invalid/readyz',{timeoutMs:60000,
       fetcher:async()=>({ok:true,json:async()=>({ready:true})})});
     console.log(JSON.stringify(result));`],{encoding:'utf8',timeout:2000});
  assert.equal(result.error,undefined);assert.equal(result.status,0);assert.equal(result.stdout,'{"ready":true}\n');
});
