import assert from 'node:assert/strict';
import test from 'node:test';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {compactFileFirstSliceStorage,createFileFirstSliceRepository} from '../packages/file-store/dist/packages/file-store/src/index.js';

for(const stage of ['before-sidecar','before-manifest','after-manifest']){
  test(`abrupt File writer death ${stage} retains the correct committed version and can be compacted`,async()=>{
    const root=await mkdtemp(join(tmpdir(),'file-store-crash-')),file=join(root,'owned.json');
    const module=new URL('../packages/file-store/dist/packages/file-store/src/index.js',import.meta.url).href;
    const source={sourcePackageId:'owned-crash-source',tenantId:'owned',workspaceId:'owned',fileName:'committed.zip',mediaType:'application/zip',contentStructure:null,sourceDocument:'Owned before crash',status:'uploaded',uploadedAt:'2026-10-14T00:00:00.000Z'};
    const changed={...source,fileName:'next-version.zip',sourceDocument:'Owned replacement'};
    const child=spawn(process.execPath,['--input-type=module','-e',`
      import fs from 'node:fs/promises';import{syncBuiltinESMExports}from'node:module';
      const file=${JSON.stringify(file)},stage=${JSON.stringify(stage)};
      let armed=false;const rename=fs.rename,held=new Promise(()=>{});
      fs.rename=async function(from,to){
        if(armed&&(stage==='before-sidecar'&&String(to).startsWith(file+'.objects/')||stage==='before-manifest'&&to===file)){
          process.send({phase:'paused'});await held;
        }
        const result=await rename.call(this,from,to);
        if(armed&&stage==='after-manifest'&&to===file){process.send({phase:'paused'});await held;}
        return result;
      };syncBuiltinESMExports();
      const{createFileFirstSliceStorage}=await import(${JSON.stringify(module)});
      const storage=await createFileFirstSliceStorage(file);
      await storage.repository.saveSourcePackage(${JSON.stringify(source)});
      process.send({phase:'ready'});
      process.on('message',async action=>{if(action==='replace'){armed=true;await storage.repository.saveSourcePackage(${JSON.stringify(changed)});process.send({phase:'unexpected-finish'});}});
    `],{stdio:['ignore','pipe','pipe','ipc']});
    const messages=[];let output='';child.stdout.on('data',c=>output+=c);child.stderr.on('data',c=>output+=c);child.on('message',m=>messages.push(m));
    const closed=new Promise(resolve=>child.once('close',resolve));
    const wait=async phase=>{const until=Date.now()+10_000;while(Date.now()<until&&!messages.some(m=>m.phase===phase))await delay(10);assert.ok(messages.some(m=>m.phase===phase),phase+' '+output);};
    try{
      await wait('ready');const before=await readFile(file);child.send('replace');await wait('paused');
      await assert.rejects(compactFileFirstSliceStorage(file,{apply:true}),{code:'FILE_STORE_BUSY'});
      assert.equal(messages.some(m=>m.phase==='unexpected-finish'),false);
      child.kill('SIGKILL');await closed;assert.equal(child.signalCode,'SIGKILL');
      const expected=stage==='after-manifest'?changed:source;
      assert.deepEqual(await createFileFirstSliceRepository(file).getSourcePackageById(source.sourcePackageId),expected);
      if(stage!=='after-manifest')assert.deepEqual(await readFile(file),before);
      const committed=await readFile(file),result=await compactFileFirstSliceStorage(file,{apply:true});
      assert.ok(result.removedFiles>=1,'Crash debris or old version must be reclaimed.');
      assert.equal(result.ignoredPaths.length,0);
      assert.deepEqual(await readFile(file),committed);
      assert.deepEqual(await createFileFirstSliceRepository(file).getSourcePackageById(source.sourcePackageId),expected);
      const sourceFiles=await readdir(join(file+'.objects','source-packages'));
      assert.equal(sourceFiles.length,1);assert.match(sourceFiles[0],/\.[a-f0-9]{64}\.json$/);
      assert.equal((await readdir(root)).some(name=>name.endsWith('.tmp')),false);
      assert.equal((await compactFileFirstSliceStorage(file,{apply:true})).removedFiles,0);
    }finally{
      if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');await closed;
      await rm(root,{recursive:true,force:true});
    }
  });
}
