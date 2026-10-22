import assert from 'node:assert/strict';
import test from 'node:test';
import {runBoundedSmokeCases} from './bounded-smoke-cases.mjs';

test('two workers execute every independent case exactly once with at most two open contexts',async()=>{
  const cases=Array.from({length:32},(_,index)=>index),started=[],closed=[];
  let active=0,peak=0;
  await runBoundedSmokeCases(cases,2,async item=>{
    started.push(item);active++;peak=Math.max(peak,active);
    try{await new Promise(done=>setImmediate(done));}finally{active--;closed.push(item);}
  });
  assert.equal(peak,2);assert.equal(active,0);
  assert.deepEqual(started,cases);assert.deepEqual([...closed].sort((a,b)=>a-b),cases);
});

test('a failed case stops new dispatch and cannot retire its peer before cleanup',async()=>{
  const failure=new Error('owned case failure'),release=Promise.withResolvers(),peerStarted=Promise.withResolvers(),started=[],closed=[];
  let finished=false;
  const operation=runBoundedSmokeCases([0,1,2,3],2,async item=>{
    started.push(item);
    try{
      if(item===0){await peerStarted.promise;throw failure;}
      peerStarted.resolve();await release.promise;
    }finally{closed.push(item);}
  }).then(()=>{finished=true;},error=>{finished=true;throw error;});
  const rejected=assert.rejects(operation,error=>error===failure);
  await peerStarted.promise;await new Promise(done=>setImmediate(done));
  assert.deepEqual(started,[0,1]);assert.deepEqual(closed,[0]);assert.equal(finished,false);
  release.resolve();await rejected;
  assert.deepEqual(closed,[0,1]);assert.equal(finished,true);
});

test('both in-flight failures survive aggregation after both contexts close',async()=>{
  const failures=[new Error('owned first'),new Error('owned peer')],barrier=Promise.withResolvers(),closed=[];
  await assert.rejects(runBoundedSmokeCases([0,1,2],2,async item=>{
    try{if(item===1)barrier.resolve();await barrier.promise;throw failures[item];}
    finally{closed.push(item);}
  }),error=>{
    assert.ok(error instanceof AggregateError);assert.deepEqual(error.errors,failures);return true;
  });
  assert.deepEqual(closed,[0,1]);
});

test('serial mode keeps each context lifetime separate and preserves source order',async()=>{
  const events=[];
  await runBoundedSmokeCases(['a','b','c'],1,async item=>{
    events.push('open '+item);await Promise.resolve();events.push('close '+item);
  });
  assert.deepEqual(events,['open a','close a','open b','close b','open c','close c']);
});

test('invalid worker limits reject before opening any case',async()=>{
  for(const concurrency of [0,3,1.5,NaN,'2',undefined]){
    await assert.rejects(runBoundedSmokeCases([1],concurrency,()=>assert.fail('case must not open')),/one or two/);
  }
});

test('empty case sets do not start workers',async()=>{
  await runBoundedSmokeCases([],2,()=>assert.fail('no case exists'));
});
