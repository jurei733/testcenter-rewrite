import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {Subject} from 'rxjs';
const require=createRequire(import.meta.url),load=path=>{const exports={};const source=readFileSync(new URL('../apps/web/src/app/'+path,import.meta.url),'utf8');const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;new Function('exports','require',code)(exports,require);return exports;};
const {observeNativeRealtime}=load('native-realtime.ts'),{parseNativeParticipantBroadcast}=load('native-participant/native-wire.ts'),{parseNativeMonitorBroadcast}=load('native-monitor/native-monitor-wire.ts');
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function setup(t,read,extras={}){
 const previous={socket:globalThis.WebSocket,location:globalThis.location};const sockets=[];
 class Socket{static OPEN=1;readyState=0;sent=[];closed=false;constructor(url){this.url=String(url);sockets.push(this);}send(value){this.sent.push(value);}close(){this.closed=true;this.readyState=3;this.onclose?.({code:1000});}open(){this.readyState=1;this.onopen?.({});}receive(data){this.onmessage?.({data});}}
 globalThis.WebSocket=Socket;globalThis.location={origin:'https://native.invalid',protocol:'https:'};t.mock.timers.enable({apis:['setTimeout','setInterval']});
 const scope=new AbortController(),data=[],statuses=[],errors=[],options={channel:'commands',scope:scope.signal,current:()=>true,read,decode:wire=>JSON.parse(wire).data,status:s=>statuses.push(s),error:e=>errors.push(e),...extras};
 const subscription=observeNativeRealtime(options).subscribe(value=>data.push(value));
 t.after(()=>{subscription.unsubscribe();t.mock.timers.reset();globalThis.WebSocket=previous.socket;if(previous.location===undefined)delete globalThis.location;else globalThis.location=previous.location;});
 return{scope,sockets,data,statuses,errors,subscription};
}
test('an actual channel subscribes on its same-origin opaque capability and retires all private callbacks with its owner',async t=>{
 let reads=0;const f=setup(t,async()=>({data:['initial '+(++reads)],subscribeToken:'a'.repeat(43)}));await flush();const ws=f.sockets[0];assert.equal(new URL(ws.url).protocol,'wss:');assert.equal(new URL(ws.url).origin,'wss://native.invalid');ws.open();assert.deepEqual(ws.sent,['{"event":"subscribe:commands"}']);ws.receive('{"event":"commands","data":["live"]}');assert.deepEqual(f.data,[['initial 1'],['live']]);
 t.mock.timers.tick(15000);await flush();assert.equal(reads,1);const stale=ws.onmessage;f.scope.abort();assert.equal(ws.closed,true);stale({data:'{"data":["retired private"]}'});t.mock.timers.tick(15000);await flush();assert.deepEqual(f.data,[['initial 1'],['live']]);assert.equal(reads,1);
});
test('outage re-polls with a fresh lease and old open/error/data callbacks cannot close or change the replacement socket',async t=>{
 let reads=0;const f=setup(t,async()=>({data:[++reads],subscribeToken:(reads===1?'a':'b').repeat(43)}));await flush();const old=f.sockets[0],open=old.onopen,message=old.onmessage,error=old.onerror;old.open();error();t.mock.timers.tick(4999);await flush();assert.equal(reads,1);t.mock.timers.tick(1);await flush();assert.equal(reads,2);const fresh=f.sockets[1];open();error();message({data:'{"data":["old"]}'});assert.equal(fresh.closed,false);fresh.open();fresh.receive('{"data":["new"]}');assert.deepEqual(f.data,[[1],[2],['new']]);
});
test('view teardown aborts the real read signal and a late HTTP payload cannot create a socket or publish private state',async t=>{
 let resolve,signal;const f=setup(t,s=>{signal=s;return new Promise(done=>resolve=done);});f.subscription.unsubscribe();assert.equal(signal.aborted,true);resolve({data:['private late'],subscribeToken:'a'.repeat(43)});await flush();t.mock.timers.tick(60000);await flush();assert.deepEqual(f.data,[]);assert.equal(f.sockets.length,0);
});
test('failed HTTP reads remain errors while later polling can recover without a fabricated empty snapshot',async t=>{
 let reads=0;const f=setup(t,async()=>{if(++reads===1)throw Error('Owned failure');return{data:['real'],subscribeToken:null};});await flush();assert.deepEqual(f.data,[]);assert.equal(f.errors.length,1);t.mock.timers.tick(5000);await flush();assert.deepEqual(f.data,[['real']]);assert.equal(f.statuses.at(-1),'polling-sleep');
});
test('failed-ACK recovery leaves the open socket and returns to authenticated polling without reusing its capability',async t=>{
 const retry=new Subject();let reads=0;const f=setup(t,async()=>({data:[++reads],subscribeToken:'a'.repeat(43)}),{retry});await flush();f.sockets[0].open();retry.next();assert.equal(f.sockets[0].closed,true);t.mock.timers.tick(5000);await flush();assert.equal(reads,2);assert.equal(f.sockets.length,2);
});
test('a bounded socket opening timeout falls back after its deadline and preserves ordinary polling',async t=>{
 let reads=0;const f=setup(t,async()=>({data:[++reads],subscribeToken:'a'.repeat(43)}));await flush();t.mock.timers.tick(20000);await flush();assert.equal(f.sockets[0].closed,true);assert.equal(reads,1);t.mock.timers.tick(5000);await flush();assert.equal(reads,2);
});
test('policy closure verifies current access and cannot reconnect after that actor is retired',async t=>{
 let owner,checks=0,reads=0;const f=setup(t,async()=>({data:[++reads],subscribeToken:'a'.repeat(43)}),{revalidate:async()=>{checks++;owner.abort();}});owner=f.scope;await flush();const ws=f.sockets[0];ws.open();ws.onclose({code:1008});await flush();t.mock.timers.tick(60000);await flush();assert.equal(checks,1);assert.equal(reads,1);assert.equal(ws.closed,true);
});
test('malformed subscription headers cannot become a WebSocket URL',async t=>{
 const f=setup(t,async()=>({data:['safe'],subscribeToken:'https://foreign.invalid/?secret=private'}));await flush();assert.equal(f.sockets.length,0);assert.equal(f.statuses.at(-1),'polling-sleep');
});
test('Source event envelopes retain actual signed-int64 identities through both production decoders',()=>{
 const commands=parseNativeParticipantBroadcast('/test/9007199254740993/commands','{"event":"commands","data":[{"id":9007199254740993,"keyword":"pause","arguments":[],"timestamp":1793390000}]}');assert.equal(commands[0].id,'9007199254740993');assert.equal(parseNativeParticipantBroadcast('/test/1/commands','{"event":"test-sessions","data":[]}'),undefined);
 const snapshot=parseNativeMonitorBroadcast('{"event":"test-sessions","data":[{"testId":9007199254740993,"personId":9007199254740995,"groupName":"owned","personLabel":"Owned","timestamp":1,"testState":{},"unitState":{}}]}');assert.equal(snapshot[0].testId,'9007199254740993');assert.equal(snapshot[0].personId,'9007199254740995');assert.equal(parseNativeMonitorBroadcast('{"event":"commands","data":[]}'),undefined);assert.throws(()=>parseNativeMonitorBroadcast('{"event":"test-sessions","data":{}}'));
});
