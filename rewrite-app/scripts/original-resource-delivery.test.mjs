import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {FirstSliceError} from '@testcenter-rewrite-app/application';
import {originalResourceDelivery} from '../apps/api/dist/apps/api/src/original-resource-delivery.js';
import {handleOriginalTestHttp} from '../apps/api/dist/apps/api/src/original-test-http.js';

const root=new URL('../test-fixtures/original-testcenter/native-geogebra/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));
const source=Buffer.from(await readFile(new URL('web3d.nocache.js.base64',root),'utf8'),'base64');
const path='Resource/GeoGebra/GeoGebra/HTML5/5.0/web3d/web3d.nocache.js';

test('only the pinned browser script representation uses the own opaque document',()=>{
  assert.equal(createHash('sha256').update(source).digest('hex'),manifest.runtime.bootstrap.sha256);
  const before=Buffer.from(source),result=originalResourceDelivery(path,source,'script');
  assert.equal(result.adapter,'geogebra-gwt-opaque-v1');assert.equal(result.varyByDestination,true);
  const code=Buffer.from(result.bytes).toString();
  assert.ok(code.startsWith('var $wnd=window;\n'));
  assert.ok(!code.includes('t=a.contentWindow.document'));
  assert.ok(!code.includes('allow-same-origin'));assert.deepEqual(source,before);
});
for(const destination of [undefined,'empty','document',['script']])test('ordinary '+String(destination)+' delivery preserves the exact upstream bytes and varies the representation',()=>{
  const result=originalResourceDelivery(path,source,destination);
  assert.deepEqual(result.bytes,source);assert.equal(result.adapter,undefined);assert.equal(result.varyByDestination,true);
});
test('unknown asset bytes or unrelated paths never activate the compatibility adapter',()=>{
  for(const [name,bytes] of [[path,Buffer.concat([source,Buffer.from('\n/* different release */')])],['Resource/other.js',source],
    ['Resource/GeoGebra/GeoGebra/HTML5/5.0/web3d/89EAAC7096ECFDF6F8E851E8D8B0340A.cache.js',Buffer.from('unknown GWT code')]]){
    assert.deepEqual(originalResourceDelivery(name,bytes,'script'),{bytes});
  }
});

for(const method of ['GET','POST'])test('native file '+method+' denial cannot emit adapted code or an adapter header',async()=>{
  const headers={},responses=[];let authorized=0;
  const handled=await handleOriginalTestHttp({request:{method,headers:{'sec-fetch-dest':'script'}},
    pathname:'/file/owned-invalid-cap/ws_1/'+path,
    services:{originalTest:{resource:async()=>{authorized++;throw new FirstSliceError(403,'original_group_token_invalid','Group-Token not valid');}}},
    readBody:()=>assert.fail('A file request must not read a body'),send:(status,value)=>responses.push({status,value}),
    raw:(status,value)=>responses.push({status,value}),binary:()=>assert.fail('Denied resource bytes must not be emitted'),
    header:(name,value)=>{headers[name.toLowerCase()]=value;},reason:()=>{}});
  assert.equal(handled,true);assert.equal(responses[0].status,method==='GET'?403:405);
  assert.equal(authorized,method==='GET'?1:0);assert.equal(headers['x-testcenter-resource-adapter'],undefined);assert.equal(headers.vary,undefined);
});
