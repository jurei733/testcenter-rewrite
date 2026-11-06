import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {Readable} from 'node:stream';
import {createProductionApiServer} from '../apps/api/dist/apps/api/src/index.js';
const mib=1024*1024,progressLimit=64*mib;
const hash=value=>createHash('sha256').update(value).digest('hex');
const exact=(actual,expected)=>{assert.equal(typeof actual,'string');assert.equal(Buffer.byteLength(actual),Buffer.byteLength(expected));assert.equal(hash(actual),hash(expected));assert.ok(actual===expected,'Large native content must remain byte-exact');};

export async function verifyOriginalNativeUnitCapacity({t,kind,file,url,auth,bookletName,reopen,services}){
 const owner=await auth('owned-large-state'),token=owner.person.token,testNumber=await services().originalTest.create({token,bookletName});
 const target={token,testNumber,unitName:'OWNED.LONGTEXT.AGGREGATE'};
 const read=async()=>services().originalUnit.read({...target,unitName:'OWNED.NATIVE.UNIT',alias:target.unitName});
 await t.test('native Test state accumulates more than five MiB from independent sub-MiB patches and survives reopening',async()=>{
  const content='T'.repeat(mib/2);
  for(let i=0;i<12;i++)await services().originalTest.patchState({token,testNumber,patch:[{key:'BULK_'+i,content,timeStamp:1000+i}]});
  await reopen();const value=await services().originalTest.read({token,testNumber});for(let i=0;i<12;i++)exact(value.laststate['BULK_'+i],content);
 });
 await t.test('native Unit aggregates exceed a complete progress request budget without truncating independent state or response parts',async()=>{
  const stateText='S'.repeat(33*mib-4)+' Ω\n',responseText='R'.repeat(33*mib-4)+' Ω\n';
  assert.equal(Buffer.byteLength(stateText)+Buffer.byteLength(responseText),66*mib);
  const state={originalUnitId:'OWNED.LONGTEXT.ORIGINAL',newState:[{key:'PLAYER_STATE',content:stateText,timeStamp:100}]};
  const response={originalUnitId:'OWNED.LONGTEXT.ORIGINAL',dataParts:{large:responseText},responseType:'owned/longtext',timeStamp:100},stateId=randomUUID(),responseId=randomUUID();
  await services().originalUnit.patchState({...target,body:state,deliveryId:stateId});await services().originalUnit.putResponse({...target,body:response,deliveryId:responseId});
  await reopen();let unit=await read();exact(unit.state.PLAYER_STATE,stateText);exact(Object.fromEntries(unit.dataParts).large,responseText);unit=undefined;
  // Receipts still gate retries after reopening; an unrelated tiny part update
  // must retain the entire large aggregate and its independent state clock.
  await services().originalUnit.patchState({...target,body:state,deliveryId:stateId});await services().originalUnit.putResponse({...target,body:response,deliveryId:responseId});
  await services().originalUnit.putResponse({...target,body:{timeStamp:200,dataParts:{small:'independent Ω'},responseType:'owned/tiny'}});
  await reopen();unit=await read();exact(unit.state.PLAYER_STATE,stateText);exact(Object.fromEntries(unit.dataParts).large,responseText);assert.equal(Object.fromEntries(unit.dataParts).small,'independent Ω');
 });
 if(kind!=='sqlite'&&kind!=='postgres')return;
 await t.test('production native progress accepts the exact default64MiB wire boundary and rejects one extra byte for length and chunked bodies',async()=>{
  const environment={FIRST_SLICE_STORE:kind,FIRST_SLICE_SQLITE_FILE:file,FIRST_SLICE_BOOTSTRAP_DEMO:'false',FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',FIRST_SLICE_XML_SCHEMA_PROFILE:'original-19',FIRST_SLICE_PROOF_OF_WORK_SCOPES:'',FIRST_SLICE_MAX_JSON_BODY_BYTES:String(mib),FIRST_SLICE_MAX_PARTICIPANT_PROGRESS_JSON_BODY_BYTES:undefined,...(url?{FIRST_SLICE_POSTGRES_URL:url.toString()}:{})};
  const previous=new Map(Object.keys(environment).map(key=>[key,process.env[key]]));let server;
  try{
   try{for(const[key,value]of Object.entries(environment)){if(value===undefined)delete process.env[key];else process.env[key]=value;}server=await createProductionApiServer();}
   finally{for(const[key,value]of previous){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
   await new Promise(done=>server.listen(0,'127.0.0.1',done));const base='http://127.0.0.1:'+server.address().port,unitName='OWNED.LONGTEXT.HTTP',path=`/test/${testNumber}/unit/${unitName}`;
   await services().originalUnit.patchState({token,testNumber,unitName,body:{originalUnitId:'OWNED.LONGTEXT.HTTP',newState:[]}});
   const empty={timeStamp:300,dataParts:{max:''},responseType:'owned/longtext'},value='L'.repeat(progressLimit-Buffer.byteLength(JSON.stringify(empty))),wire=JSON.stringify({...empty,dataParts:{max:value}}),deliveryId=randomUUID();
   assert.equal(Buffer.byteLength(wire),progressLimit);
   const call=async(chunked,oversized,status)=>{
    const text=oversized?wire+' ':wire;
    const body=chunked?Readable.from((function*(){for(let offset=0;offset<text.length;offset+=65536)yield text.slice(offset,offset+65536);})()):text;
    const response=await fetch(base+path+'/response',{method:'PUT',headers:{AuthToken:token,'content-type':'application/json','X-Native-Delivery-Id':deliveryId},body,...(chunked?{duplex:'half'}:{}),signal:AbortSignal.timeout(120000)});
    const reply=await response.text();assert.equal(response.status,status,'Actual native64MiB wire boundary');return reply;
   };
   assert.equal(await call(false,false,201),'');assert.equal(await call(true,false,201),'');
   const reply=await fetch(base+`/test/${testNumber}/unit/OWNED.NATIVE.UNIT/alias/${unitName}`,{headers:{AuthToken:token},signal:AbortSignal.timeout(120000)});assert.equal(reply.status,200);const restored=await reply.json();exact(restored.dataParts.max,value);
   for(const chunked of [false,true]){const rejected=JSON.parse(await call(chunked,true,413));assert.equal(rejected.error,'request_body_too_large');assert.equal(rejected.details.maxJsonBodyBytes,progressLimit);}
   const current=await services().originalUnit.read({token,testNumber,unitName:'OWNED.NATIVE.UNIT',alias:unitName});exact(Object.fromEntries(current.dataParts).max,value);
   const content='H'.repeat(mib/2);
   for(let i=0;i<12;i++){
    const patch=JSON.stringify([{key:'HTTP_BULK_'+i,content,timeStamp:2000+i}]);assert.ok(Buffer.byteLength(patch)<mib);
    const reply=await fetch(base+`/test/${testNumber}/state`,{method:'PATCH',headers:{AuthToken:token,'content-type':'application/json'},body:patch,signal:AbortSignal.timeout(15000)});assert.equal(reply.status,200);await reply.arrayBuffer();
   }
   const saved=await fetch(base+`/test/${testNumber}`,{headers:{AuthToken:token},signal:AbortSignal.timeout(15000)});assert.equal(saved.status,200);const savedState=(await saved.json()).laststate;for(let i=0;i<12;i++)exact(savedState['HTTP_BULK_'+i],content);
  }finally{if(server)await new Promise((done,reject)=>server.close(error=>error?reject(error):done()));}
 });
}
