import assert from 'node:assert/strict';
import {mkdtemp,readFile,realpath,rm,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import test from 'node:test';
const actual=await readFile(new URL('./ci-browser-system.mjs',import.meta.url),'utf8');
const start=actual.lastIndexOf('if(process.argv[1]');assert.ok(start>0);
const entry=actual.slice(start);
const run=async implementation=>{
  const directory=await realpath(await mkdtemp(join(tmpdir(),'owned-browser-entry-')));
  try{
    await writeFile(join(directory,'entry.mjs'),"import {resolve} from 'node:path';import {fileURLToPath} from 'node:url';\n"+implementation+'\n'+entry);
    await writeFile(join(directory,'dependent.mjs'),"import {browserSystem} from './entry.mjs';export const ready=typeof browserSystem==='function';\n");
    return spawnSync(process.execPath,[join(directory,'entry.mjs'),'owned'],{encoding:'utf8',timeout:5000,
      env:{...process.env,CI_BROWSER_SYSTEM_DIR:directory}});
  }finally{await rm(directory,{recursive:true,force:true});}
};
test('the actual CLI bootstrap can dynamically load a validator that imports its reusable module',async()=>{
  const child=await run("export async function browserSystem(){const module=await import('./dependent.mjs');if(!module.ready)throw Error('Not ready');console.log('owned-loaded');}");
  assert.equal(child.status,0,child.stderr);assert.equal(child.stdout,'owned-loaded\n');assert.equal(child.stderr,'');
});
test('the actual asynchronous CLI bootstrap preserves bounded error output and native failure status',async()=>{
  const child=await run("export async function browserSystem(){await import('./dependent.mjs');throw Object.assign(Error('owned failure'),{exitCode:37});}");
  assert.equal(child.status,37);assert.equal(child.stdout,'');assert.equal(child.stderr,'owned failure\n');
});
