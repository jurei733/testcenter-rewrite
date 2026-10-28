import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createFileFirstSliceRepository,createFileFirstSliceStorage} from '../packages/file-store/dist/packages/file-store/src/index.js';

const source={sourcePackageId:'owned-cli',tenantId:'owned',workspaceId:'owned',fileName:'first.zip',mediaType:'application/zip',contentStructure:null,sourceDocument:'Owned CLI payload',status:'uploaded',uploadedAt:'2026-10-14T00:00:00.000Z'};
const command=(file,args)=>spawnSync(process.execPath,['scripts/storage-admin.mjs','compact',...args],{encoding:'utf8',env:{...process.env,FIRST_SLICE_STORE:'file',FIRST_SLICE_FILE:file}});
async function fixture(){const root=await mkdtemp(join(tmpdir(),'file-compact-cli-')),file=join(root,'owned.json'),repository=createFileFirstSliceRepository(file);await repository.saveSourcePackage(source);await repository.saveSourcePackage({...source,fileName:'second.zip'});return{root,file};}

test('File compact CLI defaults to preview and applies only an explicit --apply',async()=>{
  const f=await fixture();
  try{
    const before=await readFile(f.file),preview=command(f.file,[]);assert.equal(preview.status,0,preview.stderr);
    const data=JSON.parse(preview.stdout);assert.equal(data.applied,false);assert.equal(data.candidateFiles,1);assert.equal(data.removedFiles,0);
    assert.deepEqual(await readFile(f.file),before);
    const applied=command(f.file,['--apply']);assert.equal(applied.status,0,applied.stderr);const result=JSON.parse(applied.stdout);
    assert.equal(result.applied,true);assert.equal(result.removedFiles,1);assert.equal(result.reclaimedBytes,data.candidateBytes);
    assert.deepEqual(await readFile(f.file),before);assert.equal((await createFileFirstSliceRepository(f.file).getSourcePackageById(source.sourcePackageId)).fileName,'second.zip');
  }finally{await rm(f.root,{recursive:true,force:true});}
});

test('File compact CLI rejects live writer ownership and cannot mutate the store',async()=>{
  const f=await fixture();let storage;
  try{
    storage=await createFileFirstSliceStorage(f.file);const before=await readFile(f.file),denied=command(f.file,['--apply']);
    assert.equal(denied.status,1);assert.match(denied.stderr,/FILE_STORE_BUSY/);assert.deepEqual(await readFile(f.file),before);
    await storage.shutdown();assert.equal(command(f.file,['--apply']).status,0);
  }finally{await storage?.shutdown();await rm(f.root,{recursive:true,force:true});}
});

test('File compact CLI rejects unknown options without deleting anything',async()=>{
  const f=await fixture();
  try{const result=command(f.file,['--force']);assert.equal(result.status,1);assert.match(result.stderr,/preview/);assert.equal(JSON.parse(command(f.file,[]).stdout).candidateFiles,1);}
  finally{await rm(f.root,{recursive:true,force:true});}
});
