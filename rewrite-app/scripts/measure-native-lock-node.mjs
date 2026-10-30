import assert from 'node:assert/strict';
import {readFileSync,statSync,chmodSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.platform,'linux');assert.equal(process.arch,'x64');
const path=process.execPath;assert.equal(path,'/opt/hostedtoolcache/node/22.23.4/x64/bin/node');assert.equal(process.version,'v22.23.4');
assert.equal(statSync(path).uid,process.getuid());assert.equal(statSync(path).mode&0o7777,0o755);
const hash=()=>createHash('sha256').update(readFileSync(path)).digest('hex');
const before=hash();assert.equal(before,'94efd062ed066c1a0b332e18249859c905e920eeada5df55d24c99b919629a90');
chmodSync(path,0o777);
try{
 const child=spawnSync(path,['scripts/ci-node-runtime.mjs'],{encoding:'utf8'});assert.equal(child.status,0,child.stderr);
 const result=JSON.parse(child.stdout).ciNode;assert.deepEqual(result,{nodeVersion:'v22.23.4',beforeMode:0o777,afterMode:0o755,changed:true});assert.equal(hash(),before);
 console.log(JSON.stringify({actualOwnedNodeModeCorrection:true,binarySha256:before,...result}));
}finally{chmodSync(path,0o755);}
