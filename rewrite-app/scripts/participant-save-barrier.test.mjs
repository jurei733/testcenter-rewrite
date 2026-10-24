import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../apps/web/src/app/participant-save-barrier.ts',import.meta.url),'utf8');
const emitted=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
export const {createParticipantSaveBarriers}=await import('data:text/javascript;base64,'+Buffer.from(emitted).toString('base64'));
const deferred=()=>{let resolve,reject;const promise=new Promise((done,fail)=>{resolve=done;reject=fail;});return{promise,resolve,reject};};
const tick=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};
const entry=(run='owned',id='response')=>({testRunId:run,deliveryId:id,unitKey:'unit',response:'Exact Ω',logs:[],status:'running',version:1,queuedAt:'2026-10-14T00:00:00Z'});
const dispatch=sequence=>({controllerId:'owned-controller',sequence});
test('a captured saved-event barrier survives removal of its durable/view entry',async()=>{
 const requests=createParticipantSaveBarriers(),held=deferred(),packet=entry();requests.track(packet,held.promise);
 const closing=requests.close([packet],dispatch(1));let done=false;const wait=closing.wait().then(()=>{done=true;});
 requests.close([],dispatch(2));await tick();assert.equal(done,false);held.resolve();await wait;assert.equal(done,true);
});
test('a later Pause cannot steal a waiting Terminate buffer',async()=>{
 const requests=createParticipantSaveBarriers(),held=deferred(),packet=entry();requests.track(packet,held.promise);
 const term=requests.close([packet],dispatch(1)),pause=requests.close([packet],dispatch(2));assert.deepEqual([...pause.deliveryIds],[]);
 let done=false;const waiting=term.wait().then(()=>{done=true;});await pause.wait();await tick();assert.equal(done,false);held.resolve();await waiting;
});
test('Terminate does not wait for an earlier already-closed Pause buffer',async()=>{
 const requests=createParticipantSaveBarriers(),held=deferred(),packet=entry();requests.track(packet,held.promise);
 requests.close([packet],dispatch(1));const term=requests.close([packet],dispatch(2));assert.deepEqual([...term.deliveryIds],[]);await term.wait();assert.equal(held.promise instanceof Promise,true);held.resolve();
});
test('retrying the same closure retains its original save request',async()=>{
 const requests=createParticipantSaveBarriers(),held=deferred(),packet=entry();requests.track(packet,held.promise);requests.close([packet],dispatch(1));
 const retry=requests.close([packet],dispatch(1));assert.deepEqual([...retry.deliveryIds],['response']);let done=false;const wait=retry.wait().then(()=>{done=true;});await tick();assert.equal(done,false);held.resolve();await wait;
});
test('a captured pending packet joins its request when the drainer starts later',async()=>{
 const requests=createParticipantSaveBarriers(),held=deferred(),packet=entry(),closing=requests.close([packet],dispatch(1));requests.track(packet,held.promise);
 let done=false;const wait=closing.wait().then(()=>{done=true;});await tick();assert.equal(done,false);held.resolve();await wait;
});
test('equal delivery identifiers in another Run cannot extend the selected barrier',async()=>{
 const requests=createParticipantSaveBarriers(),owned=deferred(),foreign=deferred();requests.track(entry(),owned.promise);requests.track(entry('foreign'),foreign.promise);
 const wait=requests.active('owned').wait();owned.resolve();await wait;foreign.resolve();
});
test('a failed save releases its request wait while the drainer remains responsible for durable retry',async()=>{
 const requests=createParticipantSaveBarriers(),held=deferred(),packet=entry();requests.track(packet,held.promise);const wait=requests.close([packet],dispatch(1)).wait();held.reject(Error('owned transport failure'));await wait;await tick();assert.deepEqual([...requests.active('owned').deliveryIds],[]);
});
