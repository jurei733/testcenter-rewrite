import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {Readable} from 'node:stream';
import {formatOriginalUnitReadJson} from '@testcenter-rewrite-app/application';
import {createProductionApiServer} from '../apps/api/dist/apps/api/src/index.js';

const mib=1024*1024;
// Opaque Verona content shaped like a GeoGebra export. This does not claim to
// execute GeoGebra itself; the Original LONGTEXT change specifically concerns
// retaining large opaque response strings without decoding or truncating them.
export function nativeLargeState(){
 const suffix='Ω / "quoted" \\ \n  ';
 const overhead=Buffer.byteLength(JSON.stringify({id:'geogebra-state',value:suffix}));
 return JSON.stringify({id:'geogebra-state',value:'G'.repeat(2*mib-overhead)+suffix});
}
const hash=value=>createHash('sha256').update(value).digest('hex');

export async function verifyOriginalNativeLargeState({t,kind,file,url,auth,bookletName,reopen,services}){
 const owner=await auth('owned-large-state'),token=owner.person.token;
 const testNumber=await services().originalTest.create({token,bookletName});
 const target={token,testNumber,unitName:'OWNED.LARGE.STATE'},large=nativeLargeState();
 assert.equal(Buffer.byteLength(large),2*mib);
 const state={originalUnitId:'OWNED.LARGE.ORIGINAL',newState:[{key:'PLAYER_STATE',content:large,timeStamp:100}]};
 const response={originalUnitId:'OWNED.LARGE.ORIGINAL',dataParts:{geogebra:large},responseType:'owned/geogebra',timeStamp:100};
 const read=async()=>JSON.parse(formatOriginalUnitReadJson(await services().originalUnit.read({...target,unitName:'OWNED.NATIVE.UNIT',alias:target.unitName})));
 await t.test('native GeoGebra-shaped two-MiB state and response survive exact durable reopening and immutable retry',async()=>{
  const stateId=randomUUID(),responseId=randomUUID();
  await services().originalUnit.patchState({...target,body:state,deliveryId:stateId});
  await services().originalUnit.putResponse({...target,body:response,deliveryId:responseId});
  await reopen();
  let restored=await read();assert.equal(hash(restored.state.PLAYER_STATE),hash(large));assert.equal(restored.state.PLAYER_STATE,large);assert.equal(restored.dataParts.geogebra,large);
  await services().originalUnit.patchState({...target,body:state,deliveryId:stateId});await services().originalUnit.putResponse({...target,body:response,deliveryId:responseId});
  restored=await read();assert.equal(restored.state.PLAYER_STATE,large);assert.equal(restored.dataParts.geogebra,large);
 });
 if(kind!=='sqlite'&&kind!=='postgres')return;
 await t.test('production native ingress accepts two-MiB Unit progress while ordinary commands retain one-MiB limits',async()=>{
  const environment={FIRST_SLICE_STORE:kind,FIRST_SLICE_SQLITE_FILE:file,FIRST_SLICE_BOOTSTRAP_DEMO:'false',FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',
   FIRST_SLICE_XML_SCHEMA_PROFILE:'original-19',FIRST_SLICE_PROOF_OF_WORK_SCOPES:'',FIRST_SLICE_MAX_JSON_BODY_BYTES:String(mib),FIRST_SLICE_MAX_PARTICIPANT_PROGRESS_JSON_BODY_BYTES:String(3*mib),...(url?{FIRST_SLICE_POSTGRES_URL:url.toString()}:{})};
  const previous=new Map(Object.keys(environment).map(key=>[key,process.env[key]]));let server;
  try{
   try{Object.assign(process.env,environment);server=await createProductionApiServer();}
   finally{for(const[key,value]of previous){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
   await new Promise(done=>server.listen(0,'127.0.0.1',done));const base='http://127.0.0.1:'+server.address().port;
   const path='/test/'+testNumber+'/unit/'+target.unitName;
   const call=async(method,path,body,status,{credential=token,chunked=false,deliveryId}={})=>{
    const wire=JSON.stringify(body),payload=chunked?Readable.from([wire.slice(0,500000),wire.slice(500000)]):wire;
    const result=await fetch(base+path,{method,headers:{...(credential?{AuthToken:credential}:{}),'content-type':'application/json',...(deliveryId?{'X-Native-Delivery-Id':deliveryId}:{})},body:payload,...(chunked?{duplex:'half'}:{}),signal:AbortSignal.timeout(15000)});
    const text=await result.text();assert.equal(result.status,status,method+' '+path+' expected '+status+'; got '+result.status);
    assert.equal(result.headers.get('cache-control'),'private, no-store');return{text,headers:result.headers};
   };
   const responseId=randomUUID(),packet={...response,timeStamp:200};
   const accepted=await call('PUT',path+'/response',packet,201,{deliveryId:responseId});assert.equal(accepted.text,'');
   await call('PUT',path+'/response',packet,201,{chunked:true,deliveryId:responseId});
   // Route classification must use the same decoded path as the native router.
   await call('PATCH',path.replace('/OWNED.','/%4FWNED.')+'/state',{...state,newState:[{key:'PLAYER_STATE',content:large,timeStamp:200}]},200);
   const restored=await read();assert.equal(restored.state.PLAYER_STATE,large);assert.equal(restored.dataParts.geogebra,large);
   for(const[method,ordinary]of[['PATCH','/test/'+testNumber+'/state'],['PUT','/test/'+testNumber+'/log'],['PUT',path+'/log'],['PUT','/test']]){
    const rejected=JSON.parse((await call(method,ordinary,{oversized:large},413)).text);assert.equal(rejected.error,'request_body_too_large');assert.equal(rejected.details.maxJsonBodyBytes,mib);
   }
   await call('PUT',path+'/response',packet,401,{credential:''});await call('PUT',path+'/response',packet,403,{credential:owner.login.token});
   await call('POST',path+'/response',packet,405);
   const other=await auth('owned-unit-peer');await call('PUT',path+'/response',packet,403,{credential:other.person.token});
   await call('PUT',path+'/response',{oversized:'X'.repeat(3*mib)},403,{credential:other.person.token});
   for(const chunked of [false,true])for(const[method,suffix]of[['PUT','response'],['PATCH','state']]){
    const rejected=JSON.parse((await call(method,path+'/'+suffix,{oversized:'X'.repeat(3*mib)},413,{chunked})).text);
    assert.equal(rejected.error,'request_body_too_large');assert.equal(rejected.details.maxJsonBodyBytes,3*mib);
   }
   assert.deepEqual(await read(),restored,'A denied or oversized request must not mutate previously accepted state');
  }finally{if(server)await new Promise((done,reject)=>server.close(error=>error?reject(error):done()));}
 });
}
