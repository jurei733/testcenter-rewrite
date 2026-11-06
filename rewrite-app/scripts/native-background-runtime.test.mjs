import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID,createHash,webcrypto} from 'node:crypto';
const require=createRequire(import.meta.url);
const {createRuntime,snapshot,order,runLock}=require('../apps/web/src/native-save-runtime/runtime.js');
const token='owned-native-background-A',actor=createHash('sha256').update(token).digest('hex'),testId='9007199254740993';
const state=(alias,clock=1)=>({id:randomUUID(),kind:'state',unitAlias:alias,originalUnitId:'ORIGINAL',queuedAt:clock,phase:'ready',payload:JSON.stringify({newState:[{key:'PRESENTATION_PROGRESS',content:'complete',timeStamp:clock}],originalUnitId:'ORIGINAL'})});
const response=(alias,value,clock=1)=>({id:randomUUID(),kind:'response',unitAlias:alias,originalUnitId:'ORIGINAL',queuedAt:clock,phase:'staged',payload:JSON.stringify({timeStamp:clock,dataParts:{owned:value},responseType:'owned/type',originalUnitId:'ORIGINAL'})});
function record(entries,{kind='unit',run=testId,owner=actor,revision=1,sealed=true,preferredUnitAlias}={}){
 const bucket=`testcenter-native-${kind}-journal:v1:${owner}:${run}:${randomUUID()}`,document={version:1,actor:owner,testId:run,revision,entries};
 return {...snapshot(bucket,JSON.stringify(document)),sealed,pending:Number(entries.length>0),preferredUnitAlias};
}
function fixture(rows){
 const records=new Map(rows.map(row=>[row.bucket,structuredClone(row)])),grants=new Map([[actor,{active:true,token}]]),held=new Set(),sent=[],acks=[];
 const runtime=createRuntime({crypto:webcrypto,origin:'https://native.example'});
 const locked=async(name,work)=>{if(held.has(name))return false;held.add(name);try{return await work();}finally{held.delete(name);}};
 const run=send=>runtime.drain({pending:async()=>[...records.values()],readRecord:async key=>structuredClone(records.get(key)),readGrant:async key=>structuredClone(grants.get(key)),locked,
  retireGrant:async()=>{grants.set(actor,{active:false});},send:async(url,options)=>{sent.push({url:String(url),options});return send(url,options);},
  acknowledge:async(row,entry)=>{const current=records.get(row.bucket);assert.equal(current.revision,row.revision);current.document.entries=current.document.entries.filter(e=>e.id!==entry.id);current.pending=Number(current.document.entries.length>0);acks.push(entry.id);}});
 return {records,grants,held,sent,acks,run};
}
const ok=(status=201)=>new Response('',{status});
test('unsealed mirrors never dispatch merely because a document lease disappeared',async()=>{
 const value=record([response('A','not past its Source window')],{sealed:false}),f=fixture([value]);await f.run(()=>ok());assert.deepEqual(f.sent,[]);assert.equal(f.records.get(value.bucket).document.entries.length,1);
});
test('the active document lease and the per-Run recovery lease independently prevent background reads from racing a Player',async()=>{
 for(const name of ['document','run']){
  const value=record([response('A','retained')]),f=fixture([value]);f.held.add(name==='document'?value.bucket:runLock(actor,testId));await assert.rejects(f.run(()=>ok()),/remain queued/);assert.deepEqual(f.sent,[]);assert.equal(f.acks.length,0);
 }
});
test('closed native Unit responses initialize safely and preserve exact bytes UUID scope and credential policy without Test GET',async()=>{
 const entry=response('OWNED.Ω','exact Ω\n  '),value=record([entry]),f=fixture([value]);await f.run(()=>ok());assert.equal(f.sent.length,2);
 assert.ok(f.sent.every(call=>call.url===`https://native.example/test/${testId}/unit/OWNED.%CE%A9/`+(call.options.method==='PATCH'?'state':'response')));
 assert.deepEqual(JSON.parse(f.sent[0].options.body),{newState:[],originalUnitId:'ORIGINAL'});assert.equal(f.sent[1].options.body,entry.payload);
 for(const {options}of f.sent){assert.equal(options.headers.AuthToken,token);assert.equal(options.headers['X-Native-Delivery-Id'],entry.id);assert.equal(options.headers.authorization,undefined);assert.equal(options.credentials,'omit');assert.equal(options.cache,'no-store');assert.equal(options.redirect,'error');assert.ok(options.signal instanceof AbortSignal);}
 assert.deepEqual(f.acks,[entry.id]);assert.equal(f.records.get(value.bucket).pending,0);
});
test('current Unit state and response precede non-current Units without inventing a new state log',async()=>{
 const a=response('A','A',1),b=response('B','B',2),bs=state('B',3),value=record([a,b,bs],{preferredUnitAlias:'B'}),f=fixture([value]);await f.run(()=>ok());
 assert.deepEqual(f.sent.map(call=>new URL(call.url).pathname.split('/').slice(-2).join('/')),['B/state','B/state','B/response','A/state','A/response']);assert.deepEqual(f.acks,[bs.id,b.id,a.id]);
});
test('a lost response retains the packet; later delivery uses the same original payload and identity',async()=>{
 const entry=response('A','before crash'),value=record([entry]),f=fixture([value]);await assert.rejects(f.run((_url,options)=>{if(options.method==='PUT')throw Error('lost reply');return ok();}),/remain queued/);assert.equal(f.acks.length,0);
 await f.run(()=>ok());const attempts=f.sent.filter(call=>call.options.method==='PUT');assert.equal(attempts.length,2);assert.equal(attempts[0].options.body,attempts[1].options.body);assert.equal(attempts[0].options.headers['X-Native-Delivery-Id'],attempts[1].options.headers['X-Native-Delivery-Id']);assert.deepEqual(f.acks,[entry.id]);
});
test('an independently failing Unit cannot strand another Unit or another native Test',async()=>{
 const a=response('A','retain'),b=response('B','accept'),other=response('C','other run'),one=record([a,b]),two=record([other],{run:'9007199254740992'}),f=fixture([one,two]);
 await assert.rejects(f.run(url=>String(url).includes('/unit/A/')?new Response('',{status:413}):ok()),/remain queued/);
 assert.deepEqual(f.records.get(one.bucket).document.entries.map(row=>row.id),[a.id]);assert.equal(f.records.get(two.bucket).pending,0);assert.deepEqual(f.acks,[b.id,other.id]);
});
test('a new sealed run arriving during a failing pass is drained before the joined request settles',async()=>{
 const first=record([response('A','retain')]),next=record([response('B','accept')],{run:'9007199254740992'}),f=fixture([first]);
 let release,entered;const held=new Promise(done=>{release=done;}),started=new Promise(done=>{entered=done;});
 const send=async(url,options)=>{if(String(url).includes('/unit/A/')&&options.method==='PUT'){entered();await held;return new Response('',{status:503});}return ok();};
 const pending=f.run(send);const result=pending.catch(error=>error);await started;
 f.records.set(next.bucket,structuredClone(next));const joined=f.run(send).catch(error=>error);release();
 assert.match((await result).message,/remain queued/);assert.match((await joined).message,/remain queued/);
 assert.equal(f.records.get(next.bucket).pending,0);assert.equal(f.records.get(first.bucket).document.entries.length,1);
 assert.deepEqual(f.acks,next.document.entries.map(entry=>entry.id));
});
test('unauthorized background work retires its captured credential and retains every private packet',async()=>{
 const value=record([response('A','private A'),response('B','private B')]),f=fixture([value]);await assert.rejects(f.run(()=>new Response('',{status:403})),/remain queued/);
 assert.equal(f.sent.length,1);assert.equal(f.grants.get(actor).active,false);assert.deepEqual(f.acks,[]);assert.equal(f.records.get(value.bucket).document.entries.length,2);
 await f.run(()=>assert.fail('Retired grant sent a request'));assert.equal(f.sent.length,1);
});
test('crossed metadata and captured actor/token mismatches cannot construct a request',async()=>{
 const original=record([response('A','private')]),crossed=structuredClone(original);crossed.testId='9007199254740992';let f=fixture([crossed]);await assert.rejects(f.run(()=>ok()),/remain queued/);assert.deepEqual(f.sent,[]);
 f=fixture([original]);f.grants.set(actor,{active:true,token:'different actor'});await f.run(()=>ok());assert.deepEqual(f.sent,[]);assert.equal(f.records.get(original.bucket).document.entries.length,1);
});
test('causal Test packets precede descendants despite backwards clocks and preserve Source state base segments',async()=>{
 const first={id:randomUUID(),kind:'state',queuedAt:200,phase:'ready',payload:JSON.stringify([{key:'FOCUS',content:'HAS',timeStamp:1}]),base:{version:1,revision:0,controlEpoch:0}};
 const next={id:randomUUID(),kind:'state',queuedAt:100,phase:'staged',payload:JSON.stringify([{key:'CONTROLLER',content:'RUNNING',timeStamp:1},{key:'CONTROLLER',content:'TERMINATED',timeStamp:2}]),base:{version:1,revision:0,controlEpoch:0,previousDeliveryId:first.id,segments:[{start:1,revision:7,controlEpoch:4}]}};
 const value=record([next,first],{kind:'test'}),f=fixture([value]);await f.run(()=>new Response('',{headers:{'X-Native-State-Result':JSON.stringify({version:1,revision:8,controlEpoch:5,superseded:true,currentSuperseded:false})}}));
 assert.deepEqual(f.acks,[first.id,next.id]);assert.equal(f.sent.length,2);assert.equal(f.sent[1].options.body,next.payload);assert.deepEqual(JSON.parse(f.sent[1].options.headers['X-Native-State-Base']),next.base);
});
test('a failed predecessor retains descendants while independent Test logs still drain',async()=>{
 const first={id:randomUUID(),kind:'state',queuedAt:1,phase:'ready',payload:'[]',base:{version:1,revision:0,controlEpoch:0}},next={id:randomUUID(),kind:'state',queuedAt:2,phase:'ready',payload:'[]',base:{version:1,revision:0,controlEpoch:0,previousDeliveryId:undefined}},log={id:randomUUID(),kind:'log',queuedAt:3,phase:'ready',payload:'[{"key":"command executed","timeStamp":1,"content":"terminate"}]'};next.base.previousDeliveryId=first.id;
 const value=record([first,next,log],{kind:'test'}),f=fixture([value]);await assert.rejects(f.run((_url,options)=>options.method==='PATCH'?new Response('',{status:425}):ok()),/remain queued/);
 assert.equal(f.sent.length,2);assert.deepEqual(f.acks,[log.id]);assert.deepEqual(f.records.get(value.bucket).document.entries.map(row=>row.id),[first.id,next.id]);
});
test('malformed snapshots and cycles remain intact and never degrade into an empty queue',()=>{
 const value=record([response('A','retained')]);for(const text of ['broken',JSON.stringify({...value.document,actor:'0'.repeat(64)}),JSON.stringify({...value.document,revision:-1})])assert.throws(()=>snapshot(value.bucket,text));
 const first={id:randomUUID(),kind:'state',queuedAt:1,phase:'ready',payload:'[]',base:{version:1,revision:0,controlEpoch:0}},next={...first,id:randomUUID()};first.base={...first.base,previousDeliveryId:next.id};next.base={...next.base,previousDeliveryId:first.id};assert.throws(()=>order(record([first,next],{kind:'test'})));
});
