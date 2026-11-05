import assert from 'node:assert/strict';
import test from 'node:test';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const exports={};new Function('exports',ts.transpileModule(readFileSync(new URL('../apps/web/src/app/native-participant/native-unit-journal.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports);
const {NativeUnitJournal,NATIVE_UNIT_JOURNAL_PREFIX}=exports;
class Storage {
 values=new Map();failing=false;
 get length(){return this.values.size;}key(i){return[...this.values.keys()][i]??null;}
 getItem(key){return this.values.get(key)??null;}
 setItem(key,value){if(this.failing)throw Error('Owned quota failure');this.values.set(key,value);}
 removeItem(key){if(this.failing)throw Error('Owned quota failure');this.values.delete(key);}
}
function locks(){
 const active=new Set();return{active,async request(key,options,callback){
  if(active.has(key)){assert.equal(options.ifAvailable,true);return callback(null);}
  active.add(key);try{return await callback({name:key});}finally{active.delete(key);}
 }};
}
export function nativeUnitJournalFixture(){
 const storage=new Storage(),manager=locks(),opened=[];
 const open=async(token='owned-capability-never-persist-as-plaintext',testId='9007199254740993')=>{
  const journal=await NativeUnitJournal.open({token,testId,storage,locks:manager,crypto:webcrypto});opened.push(journal);return journal;
 };
 return{storage,manager,open,close(){for(const journal of opened)journal.close();}};
}
const fixture=nativeUnitJournalFixture;
const flush=()=>new Promise(done=>setImmediate(done));
const state=[{key:'PRESENTATION_PROGRESS',content:'some',timeStamp:111}];
const body=(value,timeStamp=500)=>({timeStamp,dataParts:{answer:value},responseType:'owned/first',originalUnitId:'ORIGINAL'});
test('native pre-buffer drafts survive document destruction with original clocks and Source first response type',async t=>{
 const f=fixture();t.after(()=>f.close());const a=await f.open();
 a.captureResponse('B','ORIGINAL',{answer:'first',extra:'exact Ω\n  '},'owned/first',110);
 a.captureResponse('B','ORIGINAL',{answer:'second'},'owned/second',120);
 a.captureState('A','ORIGINAL',state,111);a.captureResponse('A','ORIGINAL',{answer:'A'},'owned/A',115);
 assert.equal(f.storage.length,1);assert.ok(![...f.storage.values].flat().join('').includes('owned-capability-never-persist-as-plaintext'));
 a.close();await flush();const b=await f.open(),pending=b.recoveries();assert.equal(pending.length,3);
 assert.equal(pending[0].kind,'state');assert.deepEqual(JSON.parse(pending[0].payload).newState,state);
 const saved=JSON.parse(pending.find(row=>row.unitAlias==='B').payload);
 assert.deepEqual(saved,{timeStamp:120,dataParts:{answer:'second',extra:'exact Ω\n  '},responseType:'owned/first',originalUnitId:'ORIGINAL'});
 assert.ok(pending.every(row=>row.phase==='ready'));
});
test('normal flush freezes actual grouped bytes and an older receipt cannot clear a newer staged edit',async t=>{
 const f=fixture();t.after(()=>f.close());const a=await f.open();a.captureResponse('A','ORIGINAL',{answer:'old'},'owned/first',100);
 const old=a.freeze('response','A',body('old'));a.captureResponse('A','ORIGINAL',{answer:'new'},'owned/next',600);
 a.acknowledge(old);a.acknowledge(old);a.close();await flush();const b=await f.open(),pending=b.recoveries();
 assert.equal(pending.length,1);assert.notEqual(pending[0].id,old.id);assert.equal(JSON.parse(pending[0].payload).dataParts.answer,'new');assert.equal(JSON.parse(pending[0].payload).timeStamp,600);
 b.acknowledge(pending[0]);assert.equal(f.storage.length,0);
});
test('a lost acknowledgement recovers the same delivery identity and frozen payload after reload',async t=>{
 const f=fixture();t.after(()=>f.close());const a=await f.open(),payload={originalUnitId:'ORIGINAL',newState:structuredClone(state)};
 a.captureState('A','ORIGINAL',state,100);const delivery=a.freeze('state','A',payload);payload.newState[0].content='mutated later';
 a.close();await flush();const b=await f.open(),[recovered]=b.recoveries();
 assert.equal(recovered.id,delivery.id);assert.equal(recovered.payload,delivery.payload);assert.equal(JSON.parse(recovered.payload).newState[0].content,'some');
 assert.throws(()=>b.acknowledge({...recovered,payload:'different'}));assert.equal(b.recoveries().length,1);b.acknowledge(recovered);
});
test('an active peer tab retains its buffer window; each tab owns independent storage and acknowledgements',async t=>{
 const f=fixture();t.after(()=>f.close());const a=await f.open();a.captureResponse('A','ORIGINAL',{answer:'live tab'},'owned',100);
 const b=await f.open();assert.deepEqual(b.recoveries(),[]);b.captureResponse('A','ORIGINAL',{answer:'other tab'},'owned',200);assert.equal(f.storage.length,2);
 const sent=a.freeze('response','A',body('live tab'));a.acknowledge(sent);assert.equal(f.storage.length,1);
 b.close();await flush();const c=await f.open(),[recovered]=c.recoveries();assert.equal(JSON.parse(recovered.payload).dataParts.answer,'other tab');
});
test('actor and exact signed-int64 Run identity isolate pending bytes across logins',async t=>{
 const f=fixture();t.after(()=>f.close());const a=await f.open();a.captureResponse('A','ORIGINAL',{answer:'private A'},'owned',100);a.close();await flush();
 const foreign=await f.open('owned-different-capability');assert.deepEqual(foreign.recoveries(),[]);
 const otherRun=await f.open(undefined,'9007199254740992');assert.deepEqual(otherRun.recoveries(),[]);
 const owner=await f.open();assert.equal(owner.recoveries().length,1);assert.ok([...f.storage.values.keys()][0].startsWith(NATIVE_UNIT_JOURNAL_PREFIX));
});
test('quota failure keeps all acknowledged ownership and prior staged Unit data without silently dropping it',async t=>{
 const f=fixture();t.after(()=>f.close());const a=await f.open();a.captureResponse('A','ORIGINAL',{answer:'retained A'},'owned',100);a.captureResponse('B','ORIGINAL',{answer:'retained B'},'owned',100);
 const before=[...f.storage.values];f.storage.failing=true;assert.throws(()=>a.captureResponse('A','ORIGINAL',{answer:'rejected edit'},'owned',200));assert.deepEqual([...f.storage.values],before);
 f.storage.failing=false;a.close();await flush();const b=await f.open();assert.deepEqual(b.recoveries().map(row=>JSON.parse(row.payload).dataParts.answer),['retained A','retained B']);
});
test('the count and document-size boundary reject new data while preserving every other Unit',async t=>{
 const f=fixture();t.after(()=>f.close());const a=await f.open();
 for(let i=0;i<200;i++){a.captureResponse('UNIT_'+i,'ORIGINAL',{answer:'retained '+i},'owned',100);a.captureState('UNIT_'+i,'ORIGINAL',state,100);}
 const before=[...f.storage.values];assert.throws(()=>a.captureResponse('OVERFLOW','ORIGINAL',{answer:'overflow'},'owned',100));assert.deepEqual([...f.storage.values],before);
 assert.throws(()=>a.captureResponse('UNIT_0','ORIGINAL',{answer:'x'.repeat(4_500_000)},'owned',200));assert.deepEqual([...f.storage.values],before);
});
test('corrupt retained documents fail explicitly and remain intact instead of disappearing as an empty queue',async t=>{
 const f=fixture();t.after(()=>f.close());const a=await f.open();a.captureResponse('A','ORIGINAL',{answer:'retained'},'owned',100);a.close();await flush();
 const key=f.storage.key(0);f.storage.setItem(key,'{invalid owned data');await assert.rejects(f.open());assert.equal(f.storage.getItem(key),'{invalid owned data');assert.equal(f.manager.active.size,0);
});
test('a failed local acknowledgement remains recoverable and a retired journal cannot stage or clear data',async t=>{
 const f=fixture();t.after(()=>f.close());const a=await f.open(),delivery=a.freeze('log','A',{originalUnitId:'ORIGINAL',logEntries:[{key:'OWNED',content:'exact',timeStamp:0}]});
 f.storage.failing=true;assert.throws(()=>a.acknowledge(delivery));f.storage.failing=false;a.close();
 assert.throws(()=>a.captureResponse('A','ORIGINAL',{answer:'late'},'owned',100));assert.throws(()=>a.acknowledge(delivery));await flush();
 const b=await f.open(),pending=b.recoveries();assert.equal(pending.length,1);assert.equal(pending[0].id,delivery.id);assert.equal(pending[0].payload,delivery.payload);
});
test('invalid capture identities fail before mutating previously retained data',async t=>{
 const f=fixture();t.after(()=>f.close());const a=await f.open();a.captureResponse('A','ORIGINAL',{answer:'retained'},'owned',100);const before=[...f.storage.values];
 for(const alias of ['','../foreign','bad\\alias','bad\nname'])assert.throws(()=>a.captureResponse(alias,'ORIGINAL',{answer:'invalid'},'owned',100));
 assert.deepEqual([...f.storage.values],before);
});
