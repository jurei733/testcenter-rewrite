import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {canonicalNativeInventory,preflightNativeInventory} from './ci-browser-inventory-preflight.mjs';

const inventory='libone\t1.0\tamd64\tii \nlibtwo\t2.0\tamd64\tii \n';
const digest=value=>createHash('sha256').update(value).digest('hex');
test('native inventory uses the exact dpkg fields, bounded execution and producer canonical ordering',()=>{
  let calls=0;
  const actual=canonicalNativeInventory((command,args,options)=>{
    calls++;assert.equal(command,'/usr/bin/dpkg-query');
    assert.deepEqual(args,['-W','-f=${Package}\t${Version}\t${Architecture}\t${db:Status-Abbrev}\n']);
    assert.equal(options.env.LC_ALL,'C');assert.equal(options.timeout,30000);assert.equal(options.maxBuffer,1024*1024);
    return inventory.split('\n').filter(Boolean).reverse().join('\n')+'\n';
  });
  assert.equal(actual,inventory);assert.equal(calls,1);
});
test('missing or injected expected digests reject before reading packages or writing diagnostics',async()=>{
  for(const value of [undefined,'','a'.repeat(63),'A'.repeat(64),'$(echo owned)','a'.repeat(64)+'\n']){
    let reads=0;await assert.rejects(preflightNativeInventory(value,{readInventory:()=>{reads++;return inventory;}}),/invalid producer initial inventory digest/);
    assert.equal(reads,0);
  }
});
test('exact initial state passes without creating diagnostic files',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'owned-inventory-pass-'));
  try{
    assert.equal(await preflightNativeInventory(digest(inventory),{readInventory:()=>inventory,directory}),digest(inventory));
    assert.deepEqual(await readdir(directory),[]);
  }finally{await rm(directory,{recursive:true,force:true});}
});
test('changed, added and removed packages reject and preserve only canonical inventory and hashes',async()=>{
  for(const changed of [inventory.replace('1.0','1.1'),inventory+'libzzz\t3.0\tamd64\tii \n',inventory.split('\n').slice(1).join('\n')]){
    const directory=await mkdtemp(join(tmpdir(),'owned-inventory-reject-'));
    try{
      await assert.rejects(preflightNativeInventory(digest(inventory),{readInventory:()=>changed,directory}),/mismatch before dependency installation/);
      assert.equal(await readFile(join(directory,'observed-inventory.tsv'),'utf8'),changed);
      assert.deepEqual(JSON.parse(await readFile(join(directory,'inventory-mismatch.json'),'utf8')),
        {version:1,expected:digest(inventory),actual:digest(changed)});
      assert.deepEqual((await readdir(directory)).sort(),['inventory-mismatch.json','observed-inventory.tsv']);
    }finally{await rm(directory,{recursive:true,force:true});}
  }
});
test('invalid native rows fail even when their untrusted digest matches',async()=>{
  for(const invalid of [inventory+'libone\t1.0\tamd64\tii \n','secret=example\n','',inventory.repeat(20000)]){
    await assert.rejects(preflightNativeInventory(digest(invalid),{readInventory:()=>invalid}),/inventory/);
  }
});
