import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseInventory} from './ci-browser-system.mjs';

const digest=value=>createHash('sha256').update(value).digest('hex');
export function canonicalNativeInventory(execute=execFileSync){
  const raw=execute('/usr/bin/dpkg-query',['-W','-f=${Package}\t${Version}\t${Architecture}\t${db:Status-Abbrev}\n'],
    {encoding:'utf8',timeout:30000,maxBuffer:1024*1024,env:{...process.env,LC_ALL:'C'}});
  const inventory=raw.split('\n').filter(Boolean).sort().join('\n')+'\n';
  parseInventory(inventory);return inventory;
}

// This cheap rejection is additional to authenticated archive/context checks,
// offline APT, complete final inventory/font checks and actual runtime pixels.
export async function preflightNativeInventory(expected,{readInventory=canonicalNativeInventory,directory}={}){
  assert(typeof expected==='string'&&expected.length===64&&/^[a-f0-9]{64}$/.test(expected),'Missing or invalid producer initial inventory digest');
  const inventory=readInventory();parseInventory(inventory);
  const actual=digest(inventory);
  if(actual!==expected){
    if(directory){
      await mkdir(directory,{recursive:true});
      await writeFile(join(directory,'observed-inventory.tsv'),inventory,{flag:'wx'});
      await writeFile(join(directory,'inventory-mismatch.json'),JSON.stringify({version:1,expected,actual})+'\n',{flag:'wx'});
    }
    throw Error('Browser system initial dpkg inventory mismatch before dependency installation: expected='+expected+' actual='+actual);
  }
  return actual;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    assert(process.platform==='linux'&&process.arch==='x64','Inventory preflight requires native Linux x64');
    const actual=await preflightNativeInventory(process.env.CI_BROWSER_SYSTEM_EXPECTED_BEFORE_SHA256,
      {directory:process.env.CI_BROWSER_COHORT_DIAGNOSTIC_DIR});
    console.log('Browser initial inventory matches producer: '+actual+'; complete offline verification remains mandatory.');
  }catch(error){console.error(error.message);process.exitCode=1;}
}
