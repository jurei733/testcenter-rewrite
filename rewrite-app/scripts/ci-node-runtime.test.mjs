import assert from 'node:assert/strict';
import test from 'node:test';
import {qualifyCiNode} from './ci-node-runtime.mjs';
const path='/opt/hostedtoolcache/node/22.23.4/x64/bin/node';
const fixture=(initialMode=0o755)=>{
  let mode=initialMode;const calls=[];
  const options={expectedVersion:'22.23.4',actualVersion:'v22.23.4',platform:'linux',arch:'x64',executable:path,
    inspect:()=>({mode,isFile:()=>true}),realpath:value=>value,
    execute:(command,args,settings)=>{calls.push({command,args,settings});mode=0o755;}};
  return {options,calls};
};
test('already qualified Node permissions require no privileged operation',()=>{
  const f=fixture();assert.deepEqual(qualifyCiNode(f.options),{nodeVersion:'v22.23.4',beforeMode:0o755,afterMode:0o755,changed:false});
  assert.deepEqual(f.calls,[]);
});
test('the observed cached 0777 binary becomes 0755 through one exact bounded chmod',()=>{
  const f=fixture(0o777);assert.equal(qualifyCiNode(f.options).changed,true);
  assert.deepEqual(f.calls,[{command:'/usr/bin/sudo',args:['-n','--','/usr/bin/chmod','0755',path],settings:{stdio:'inherit',timeout:10000}}]);
});
test('wrong version, executable, platform, redirection and unsafe modes reject before privilege',()=>{
  for(const patch of [{expectedVersion:'22'},{expectedVersion:'22.23.4\nowned'},{actualVersion:'v22.23.3'},
    {platform:'darwin'},{arch:'arm64'},{executable:'/usr/bin/node'},{realpath:()=>'/etc/owned'},
    {inspect:()=>({mode:0o777,isFile:()=>false})},{inspect:()=>({mode:0o4755,isFile:()=>true})}]){
    const f=fixture(0o777);assert.throws(()=>qualifyCiNode({...f.options,...patch}));assert.deepEqual(f.calls,[]);
  }
});
test('failed chmod and incorrect post-operation state remain hard failures',()=>{
  const f=fixture(0o777);assert.throws(()=>qualifyCiNode({...f.options,execute:()=>{throw Error('owned denied');}}),/owned denied/);
  assert.throws(()=>qualifyCiNode({...f.options,execute:()=>{}}),/exactly 0755/);
  let reads=0;assert.throws(()=>qualifyCiNode({...f.options,realpath:()=>++reads===1?path:'/etc/owned'}),/path changed/);
});
