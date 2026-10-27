import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {lstatSync,readFileSync,realpathSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export function qualifyCiNode({expectedVersion,actualVersion=process.version,platform=process.platform,arch=process.arch,
  executable=process.execPath,inspect=lstatSync,realpath=realpathSync,execute=execFileSync}){
  assert(typeof expectedVersion==='string'&&/^22\.[0-9]+\.[0-9]+$/.test(expectedVersion),'Invalid exact CI Node version');
  assert.equal(actualVersion,'v'+expectedVersion,'CI Node must match the shared exact patch');
  assert(platform==='linux'&&arch==='x64','CI Node normalization requires hosted Linux x64');
  const expectedPath='/opt/hostedtoolcache/node/'+expectedVersion+'/x64/bin/node';
  assert.equal(executable,expectedPath,'Only the exact hosted Node executable may be normalized');
  assert.equal(realpath(executable),expectedPath,'CI Node must not redirect to another file');
  const before=inspect(executable);assert(before.isFile(),'CI Node must be a regular file');
  const mode=before.mode&0o7777;
  assert([0o755,0o777].includes(mode),'Unexpected CI Node file permissions');
  if(mode!==0o755)execute('/usr/bin/sudo',['-n','--','/usr/bin/chmod','0755',expectedPath],
    {stdio:'inherit',timeout:10000});
  assert.equal(realpath(executable),expectedPath,'CI Node path changed during normalization');
  const after=inspect(executable);assert(after.isFile(),'CI Node file changed during normalization');
  assert.equal(after.mode&0o7777,0o755,'CI Node permissions must be exactly 0755');
  return {nodeVersion:actualVersion,beforeMode:mode,afterMode:0o755,changed:mode!==0o755};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const expectedVersion=readFileSync(new URL('../../.node-version',import.meta.url),'utf8').trim();
    console.log(JSON.stringify({ciNode:qualifyCiNode({expectedVersion})}));
  }catch(error){console.error(error.message);process.exitCode=1;}
}
