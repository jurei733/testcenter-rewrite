import assert from 'node:assert/strict';
import test from 'node:test';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const exports={};new Function('exports',ts.transpileModule(readFileSync(new URL('../apps/web/src/app/native-participant/native-test-journal.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports);
const {NativeTestJournal,parseNativeTestStateBase}=exports,base={version:1,revision:7,controlEpoch:2};
const state=(content,timeStamp=123)=>[{key:'CURRENT_UNIT_ID',content,timeStamp}];
const turn=()=>new Promise(done=>setImmediate(done));
function fixture(options={}){
 const values=new Map(),active=new Set(),opened=[];
 const storage={failing:false,get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:key=>values.get(key)??null,
  setItem(key,value){if(this.failing)throw Error('owned quota failure');values.set(key,value);},removeItem(key){if(this.failing)throw Error('owned quota failure');values.delete(key);}};
 const locks={async request(key,options,callback){assert.equal(options.ifAvailable,true);if(active.has(key))return callback(null);active.add(key);try{return await callback({name:key});}finally{active.delete(key);}}};
 const open=async(token='private-capability-never-persist',testId='9007199254740993',writeBase=base)=>{const journal=await NativeTestJournal.open({storage,locks,crypto:webcrypto,base:writeBase,token,testId,...options});opened.push(journal);return journal;};
 return{storage,values,active,open,close(){for(const journal of opened)journal.close();}};
}
test('native Test snapshots retain monotone revisions, causal bases and a final sealed log after earlier state ACKs',async t=>{
 const mirrored=[],sealed=[],f=fixture({mirror:(key,text)=>mirrored.push({key,doc:JSON.parse(text)}),seal:(key,text)=>sealed.push({key,doc:JSON.parse(text)})});t.after(()=>f.close());const a=await f.open();
 a.captureState(state('first'));const packet=a.freeze('state',state('first'));a.acknowledge(packet);const log=a.freeze('log',[{key:'command executed',content:'terminate',timeStamp:123}]);assert.deepEqual(sealed,[]);a.close();
 assert.deepEqual(mirrored.map(row=>row.doc.revision),[1,2,3,4]);assert.equal(sealed.length,1);assert.equal(sealed[0].doc.revision,4);assert.equal(sealed[0].doc.entries[0].id,log.id);assert.equal(sealed[0].doc.entries[0].payload,log.payload);
});
test('pre-buffer Test state survives reload with every Source entry, captured base and exact signed-int64 Run ownership',async t=>{
 const f=fixture();t.after(()=>f.close());const a=await f.open();a.captureState(state('first',200),200);a.captureState(state('second',100),100);
 assert.ok(!JSON.stringify([...f.values]).includes('private-capability-never-persist'));a.close();await turn();
 const b=await f.open(),[packet]=b.recoveries();assert.deepEqual(JSON.parse(packet.payload),[...state('first',200),...state('second',100)]);assert.deepEqual(packet.base,base);assert.equal(packet.phase,'ready');
 b.acknowledge(packet);assert.equal(f.storage.length,0);
});
test('normal Source grouping freezes bytes once; old acknowledgement retains a later staged packet and its causal predecessor',async t=>{
 const f=fixture();t.after(()=>f.close());const a=await f.open();a.captureState(state('old'));const grouped=[...state('old'),{key:'FOCUS',content:'HAS',timeStamp:124}],sent=a.freeze('state',grouped);
 a.captureState(state('new',125));grouped[0].content='mutation after freeze';a.acknowledge(sent);a.close();await turn();
 const b=await f.open(),[pending]=b.recoveries();assert.notEqual(pending.id,sent.id);assert.deepEqual(pending.base,{...base,previousDeliveryId:sent.id});assert.equal(JSON.parse(pending.payload)[0].content,'new');
});
test('a lost reply recovers the same ready state identity and base; tampered ACK cannot erase it',async t=>{
 const f=fixture();t.after(()=>f.close());const a=await f.open();a.captureState(state('retained'));const sent=a.freeze('state',state('retained'));a.close();await turn();
 const b=await f.open(),[pending]=b.recoveries();assert.equal(pending.id,sent.id);assert.equal(pending.payload,sent.payload);assert.deepEqual(pending.base,sent.base);
 assert.throws(()=>b.acknowledge({...pending,base:{...base,revision:8}}));assert.equal(b.recoveries().length,1);b.acknowledge(pending);b.acknowledge(pending);assert.equal(f.storage.length,0);
});
test('causal recovery precedes descendants even if the client clock moved backwards',async t=>{
 const f=fixture();t.after(()=>f.close());const a=await f.open();a.captureState(state('first'),200);const first=a.freeze('state',state('first'));
 a.captureState(state('second'),100);const second=a.freeze('state',state('second'));a.captureState(state('third'),50);a.close();await turn();
 const b=await f.open(),packets=b.recoveries();assert.deepEqual(packets.slice(0,2).map(packet=>packet.id),[first.id,second.id]);assert.equal(packets[2].base.previousDeliveryId,second.id);
});
test('a live peer retains its own window; actor and neighboring int64 Test IDs cannot recover private data',async t=>{
 const f=fixture();t.after(()=>f.close());const a=await f.open();a.captureState(state('private A'));const peer=await f.open();assert.deepEqual(peer.recoveries(),[]);
 a.close();await turn();const foreign=await f.open('other-actor'),neighbor=await f.open(undefined,'9007199254740992');assert.deepEqual(foreign.recoveries(),[]);assert.deepEqual(neighbor.recoveries(),[]);
 const owner=await f.open();assert.equal(JSON.parse(owner.recoveries()[0].payload)[0].content,'private A');
});
test('storage failure preserves the prior staged data and never acknowledges an unpersisted packet',async t=>{
 const f=fixture();t.after(()=>f.close());const a=await f.open();a.captureState(state('retained'));const before=[...f.values];f.storage.failing=true;
 assert.throws(()=>a.captureState(state('rejected')));assert.throws(()=>a.freeze('state',state('rejected')));assert.deepEqual([...f.values],before);
 f.storage.failing=false;const sent=a.freeze('state',state('retained'));f.storage.failing=true;assert.throws(()=>a.acknowledge(sent));f.storage.failing=false;
 a.close();await turn();const b=await f.open();assert.equal(b.recoveries()[0].id,sent.id);
});
test('size limits retain prior state and corrupt documents fail visibly without eviction',async t=>{
 const f=fixture();t.after(()=>f.close());const a=await f.open();a.captureState(state('retained'));const before=[...f.values];assert.throws(()=>a.captureState(state('x'.repeat(4_500_000))));assert.deepEqual([...f.values],before);
 a.close();await turn();const key=f.storage.key(0);f.storage.setItem(key,'{broken');await assert.rejects(f.open());assert.equal(f.storage.getItem(key),'{broken');assert.equal(f.active.size,0);
});
test('logs survive retirement with exact timestamps and bytes, independently of state chains',async t=>{
 const f=fixture();t.after(()=>f.close());const a=await f.open(),body=[{key:'command executed',content:'terminate Ω',timeStamp:123}],sent=a.freeze('log',body);a.close();await turn();
 const b=await f.open(),[packet]=b.recoveries();assert.equal(packet.id,sent.id);assert.equal(packet.base,undefined);assert.deepEqual(JSON.parse(packet.payload),body);b.acknowledge(packet);assert.equal(f.storage.length,0);
});
test('fresh authoritative bases are accepted before input, never used to rebase captured or dispatched stale packets',async t=>{
 const f=fixture();t.after(()=>f.close());const a=await f.open();a.useFreshBase({...base,revision:10,controlEpoch:3});a.captureState(state('captured'));assert.throws(()=>a.useFreshBase({...base,revision:11}));
 const sent=a.freeze('state',state('captured'));assert.equal(sent.base.revision,10);a.acknowledge(sent);assert.throws(()=>a.useFreshBase({...base,revision:12}));
 for(const invalid of [null,{},'bad',{...base,revision:-1},{...base,revision:1},{...base,previousDeliveryId:'bad'},{...base,unknown:true}])assert.throws(()=>parseNativeTestStateBase(invalid));
});
test('a command ACK authorizes only subsequent entries while preserving one exact Source grouped body through reload',async t=>{
 const f=fixture();t.after(()=>f.close());const a=await f.open(),old=state('before command'),fresh=state('after command',124);
 a.captureState(old);a.useCommandBase({...base,revision:10,controlEpoch:4});a.captureState(fresh);
 const body=[{key:'CONTROLLER',content:'LOADING',timeStamp:1},...old,...fresh],packet=a.freeze('state',body);
 assert.equal(packet.payload,JSON.stringify(body));assert.deepEqual(packet.base,{...base,segments:[{start:2,revision:10,controlEpoch:4}]});
 a.close();await turn();const b=await f.open(),[recovered]=b.recoveries();assert.deepEqual(recovered.base,packet.base);assert.equal(recovered.payload,packet.payload);
});
