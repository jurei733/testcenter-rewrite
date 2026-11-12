import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash,randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {request as httpRequest} from 'node:http';
import {Pool} from 'pg';
import {createFirstSliceServices} from '@testcenter-rewrite-app/application';
import {createSqliteFirstSliceStorage} from '@testcenter-rewrite-app/sqlite-store';
import {createPostgresFirstSliceStorage} from '@testcenter-rewrite-app/postgres-store';
import {prepareOriginalXmlSchemaValidator} from '../packages/application/dist/packages/application/src/original-xml-schema.js';
import {createProductionApiServer} from '../apps/api/dist/apps/api/src/index.js';
import {setupNativeSystemCheck,sourceReply,sourceWireReply,systemCheckRoster,systemCheckXml} from './native-system-check-fixture.mjs';
import {raceWithSmokeDeadline} from './smoke-deadline.mjs';
const validator=await prepareOriginalXmlSchemaValidator(resolve(process.env.FIRST_SLICE_XML_SCHEMA_CACHE||'.data/original-xml-schemas'),process.env.FIRST_SLICE_XML_SCHEMA_DOWNLOAD!=='false');
const kinds=['sqlite',...(process.env.FIRST_SLICE_STORE==='postgres'?['postgres']:[])];
const solve=challenge=>{for(let number=0;number<=challenge.maxNumber;number++)if(createHash('sha256').update(challenge.salt+number).digest('hex')===challenge.challenge)return{algorithm:challenge.algorithm,challenge:challenge.challenge,salt:challenge.salt,signature:challenge.signature,number};assert.fail('Unsolvable native challenge.');};
for(const kind of kinds)test(kind+': actual protected native Systemcheck HTTP, persistence and body-wait authorization',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'owned-system-check-http-')),namespace='owned_syscheck_http_'+randomUUID().replaceAll('-',''),pg=kind==='postgres'?new URL(process.env.FIRST_SLICE_POSTGRES_URL):null;
 pg?.searchParams.set('options','-c search_path='+namespace);pg?.searchParams.set('application_name',namespace);
 let server,storage,pool,repository,services,base;
 const environment={FIRST_SLICE_STORE:kind,FIRST_SLICE_SQLITE_FILE:join(dir,'owned.sqlite'),FIRST_SLICE_BOOTSTRAP_DEMO:'false',FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',FIRST_SLICE_XML_SCHEMA_PROFILE:'original-19',REQUIRE_LOGIN_PASSWORD:'false',
  FIRST_SLICE_PROOF_OF_WORK_SCOPES:'participant,second_code',FIRST_SLICE_PROOF_OF_WORK_SECRET:'owned-native-syscheck-http-proof-secret-2026-11-09',FIRST_SLICE_PROOF_OF_WORK_PREVIOUS_SECRET:'',FIRST_SLICE_PROOF_OF_WORK_MAX_NUMBER:'12',FIRST_SLICE_PROOF_OF_WORK_TTL_MS:'60000',...(pg?{FIRST_SLICE_POSTGRES_URL:pg.toString()}:{})};
 const start=async()=>{const previous=new Map(Object.keys(environment).map(key=>[key,process.env[key]]));try{Object.assign(process.env,environment);server=await createProductionApiServer();}finally{for(const[key,value]of previous)if(value===undefined)delete process.env[key];else process.env[key]=value;}
  await new Promise(done=>server.listen(0,'127.0.0.1',done));base='http://127.0.0.1:'+server.address().port;};
 const close=async()=>{const current=server;server=undefined;if(current)await new Promise((done,reject)=>current.close(error=>error?reject(error):done()));};
 try{
  if(pg){pool=new Pool({connectionString:process.env.FIRST_SLICE_POSTGRES_URL});await pool.query('CREATE SCHEMA "'+namespace+'"');}
  storage=pg?await createPostgresFirstSliceStorage(pg.toString()):createSqliteFirstSliceStorage(environment.FIRST_SLICE_SQLITE_FILE);repository=storage.repository;services=createFirstSliceServices({repository,originalXmlSchemaValidator:validator,xmlSchemaProfile:'original-19'});
  const setup=await setupNativeSystemCheck(services,repository),{scope,ids,workspaceNumber}=setup;
  const records=async()=>(await repository.listWorkspaceActivityEventsByWorkspace(ids.tenantId,ids.workspaceId)).filter(event=>event.eventType==='system_check_report_saved');
  const http=async(method,path,{token,body,status=200}={})=>{
   const response=await fetch(base+path,{method,headers:{...(token!==undefined?{AuthToken:token}:{}),...(body!==undefined?{'content-type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
   const text=await response.text();let value;try{value=JSON.parse(text);}catch{value=text;}assert.equal(response.status,status,method+' '+path+': '+text);assert.equal(response.headers.get('cache-control'),'private, no-store');return{response,text,value};
  };
  const login=async()=>{const challenge=(await http('POST','/session/challenge',{body:{loginType:'login',name:'r98-syscheck',password:'owned-r98-theme-password'}})).value;return(await http('PUT','/session',{body:solve(challenge)})).value;};
  const path='/workspace/'+workspaceNumber+'/sys-check/R99.UNITCHECK',body={keyPhrase:'owned-wrong-key',title:'Must not become actor title',environment:[],network:[],questionnaire:[],unit:[],responses:[]};
  await start();let actor;
  await t.test('public native mode and directory use persisted files and Source empty-body/method semantics',async()=>{
   assert.equal((await http('GET','/sys-check-mode',{token:'owned-irrelevant-token'})).value,false);
   assert.equal((await http('HEAD','/sys-check-mode')).text,'');
   const listing=(await http('GET','/sys-checks')).value;
   assert.deepEqual(listing.map(row=>row.name),['R99.UNITCHECK','R98.CHECK']);
   assert.ok(listing.every(row=>String(row.workspaceId)===workspaceNumber));
   assert.ok(listing.every(row=>Object.keys(row).join(',')==='workspaceId,name,label,description'));
   assert.equal((await http('HEAD','/sys-checks')).text,'');
   for(const route of ['/sys-check-mode','/sys-checks']){const rejected=await http('POST',route,{status:405});assert.equal(rejected.response.headers.get('allow'),'GET');}

  });
  await t.test('native time, Source download cache-buster and dotted client routes work over real HTTP',async()=>{
   const time=await fetch(base+'/system/time');assert.equal(time.status,200);assert.equal(time.headers.get('cache-control'),'no-store');const payload=await time.json();assert.ok(Number.isFinite(payload.timestamp));assert.equal(typeof payload.timezone,'string');
   const head=await fetch(base+'/system/time',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
   for(const method of ['GET','HEAD']){const download=await fetch(base+'/speed-test/random-package/64&uid=1794240000000',{method});assert.equal(download.status,200);assert.equal((await download.arrayBuffer()).byteLength,method==='HEAD'?0:64);}
   const bad=await fetch(base+'/speed-test/random-package/64&uid=invalid');assert.equal(bad.status,406);
   const client=await fetch(base+'/app/check/'+workspaceNumber+'/R99.UNITCHECK/w');assert.equal(client.status,200);assert.match(await client.text(),/<app-root/);
  });

  await t.test('the native client must solve configured first-factor work and receives only Systemcheck claims',async()=>{
   await http('PUT','/session/login',{body:{name:'r98-syscheck',password:'owned-r98-theme-password'},status:400});actor=await login();
   assert.deepEqual(actor.access.sysCheck.slice().sort(),['R98.CHECK','R99.UNITCHECK']);assert.equal(actor.claims.test,undefined);assert.equal(actor.claims.workspaceAdmin,undefined);assert.equal(actor.claims.testGroupMonitor,undefined);
  });
  await t.test('actual HTTP config and Unit/Player bodies match captured production Source',async()=>{
   for(const token of [undefined,'',actor.token]){
    assert.deepEqual((await http('GET',path,{token})).value,sourceReply('config-with-unit').value);
    assert.deepEqual((await http('GET',path+'/unit-and-player',{token})).value,sourceReply('unit-with-player').value);
   }
   const missing=await http('GET','/workspace/'+workspaceNumber+'/sys-check/MISSING',{token:actor.token,status:404});assert.equal(missing.text,sourceReply('config-missing').value);assert.ok(missing.response.headers.get('error-id'));assert.equal(missing.response.headers.get('test-mode'),'NO');
   const wrong=await http('POST',path,{token:actor.token,status:405});assert.equal(wrong.response.headers.get('allow'),'GET');
   for(const suffix of ['','/unit-and-player'])assert.equal((await http('HEAD',path+suffix,{token:actor.token,status:sourceWireReply(suffix?'unit-head':'config-head').status})).text,'');
   await http('GET',path,{token:'owned-invalid-token',status:403});await http('GET',path,{token:setup.monitor.token,status:403});
  });
  await t.test('successful native PUT has empty201, persists the server-owned report and keeps canonical/no-save-key gates',async()=>{
   assert.equal((await http('PUT',path+'/report',{token:actor.token,body,status:201})).text,'');const [event]=await records();assert.equal(event.details.report.title,'r98-syscheck');assert.equal(event.details.report.checkId,'R99.UNITCHECK');
   const before=await records();await http('PUT','/workspace/'+workspaceNumber+'/sys-check/R98.CHECK/report',{token:actor.token,body,status:409});await http('PUT',path+'/report',{token:setup.monitor.token,body,status:403});assert.deepEqual(await records(),before);
   await http('PUT',path+'/report',{body:{...body,keyPhrase:'owned-key',title:'Owned anonymous'},status:201});assert.equal((await records()).length,2);
   const wrong=await http('PUT',path+'/report',{body:{...body,keyPhrase:' OWNED-KEY '},status:403});assert.equal(wrong.text,sourceWireReply('save-key-space-anonymous').rawText);
  });
  await t.test('server restart retains the native credential and report evidence',async()=>{
   const before=await records();await close();await start();assert.deepEqual((await http('GET','/session',{token:actor.token})).value.claims,actor.claims);assert.deepEqual(await records(),before);
   assert.deepEqual((await http('GET',path+'/unit-and-player',{token:actor.token})).value,sourceReply('unit-with-player').value);
  });
  const delayed=async(action,expectedStatus,options={})=>{
   const token=Object.hasOwn(options,'token')?options.token:actor.token;
   const before=await records(),wire=JSON.stringify(options.body??body),reply=Promise.withResolvers(),started=Promise.withResolvers(),bodyReader=Promise.withResolvers();
   const observe=incoming=>{
    if(incoming.url!==path+'/report'||incoming.method!=='PUT')return;
    // The async body iterator attaches this listener only after the real
    // Systemcheck preflight has completed. Observing it does not consume data.
    const onNewListener=event=>{if(event==='readable'){incoming.off('newListener',onNewListener);queueMicrotask(()=>bodyReader.resolve(incoming));}};
    incoming.on('newListener',onNewListener);
   };
   server.on('request',observe);
   const request=httpRequest(base+path+'/report',{method:'PUT',headers:{...(token!==undefined?{AuthToken:token}:{}),'content-type':'application/json','content-length':Buffer.byteLength(wire),Expect:'100-continue'}},response=>{let text='';response.setEncoding('utf8');response.on('data',chunk=>text+=chunk);response.on('end',()=>reply.resolve({status:response.statusCode,text}));});
   request.on('error',reply.reject);request.on('continue',()=>{request.write(wire.slice(0,-1));started.resolve();});request.flushHeaders();
   try{
    await raceWithSmokeDeadline(Promise.race([started.promise,reply.promise.then(value=>{throw Error('Reply before body wait: '+JSON.stringify(value));})]),5000,()=>{throw Error('Native report body wait did not start.');});
    const incoming=await raceWithSmokeDeadline(Promise.race([bodyReader.promise,reply.promise.then(value=>{throw Error('Reply before post-auth body reader: '+JSON.stringify(value));})]),5000,()=>{throw Error('Post-auth body reader did not start.');});
    assert.equal(incoming.complete,false);assert.equal(incoming.readableEnded,false);assert.equal(incoming.destroyed,false);
    // The actual post-auth body reader now waits for the final byte while an
    // independently committed mutation changes the authority used at save time.
    await action();request.end(wire.slice(-1));const value=await raceWithSmokeDeadline(reply.promise,5000,()=>{throw Error('Native report did not finish after the final body byte.');});
    assert.equal(value.status,expectedStatus,value.text);assert.deepEqual(await records(),before);
   }finally{server.off('request',observe);request.destroy();}
  };
  await t.test('real partially sent HTTP report is rejected after native logout',async()=>{
   await delayed(()=>services.originalSession.logout({token:actor.token}),403);actor=await login();
  });
  await t.test('real partially sent HTTP report is rejected after native role replacement',async()=>{
   await delayed(()=>services.workspaceAdminRead.importParticipantRoster({...scope,rosterText:systemCheckRoster('monitor-group')}),403);
   await services.workspaceAdminRead.importParticipantRoster({...scope,rosterText:systemCheckRoster()});actor=await login();
  });
  await t.test('real partially sent HTTP report is rejected after person expiry',async()=>{
   const person=(await services.originalAuthentication.read({token:actor.token})).participantSession;
   await delayed(()=>repository.updateParticipantSessionValidity({...person,validUntil:new Date(Date.now()-1000).toISOString()}),410);
   await repository.updateParticipantSessionValidity({...person,validUntil:null});
  });
  await t.test('enabling dedicated login during a real anonymous body wait blocks the otherwise valid key',async()=>{
   const credentials={username:'owned-http-syscheck-root',password:'Owned HTTP syscheck root password'};await services.adminAuth.bootstrapAdminUser(credentials);const {adminUser}=await services.adminAuth.signIn(credentials);
   await delayed(()=>repository.saveAdminRoleAssignment({roleAssignmentId:randomUUID(),adminUserId:adminUser.adminUserId,role:'system_check',accessMode:'read_write',tenantId:ids.tenantId,workspaceId:ids.workspaceId,groupKey:null,createdAt:new Date().toISOString()}),401,{token:undefined,body:{...body,keyPhrase:'OWNED-KEY'}});
   await http('PUT',path+'/report',{token:actor.token,body,status:201});
  });
  await t.test('physical Systemcheck mode is visible over HTTP and survives server restart',async()=>{
   await services.contentIntake.uploadWorkspaceFile({...scope,fileName:'owned-mode.xml',mediaType:'application/xml',sourceDocument:systemCheckXml('Testtakers','<Metadata/><Group id="OWNED.HTTP.MODE" label="Owned"><Login name="owned-http-mode" pw="owned-password" mode="sys-check-login"/></Group>')});
   assert.equal((await http('GET','/sys-check-mode')).value,true);
   await close();await start();assert.equal((await http('GET','/sys-check-mode')).value,true);
  });
 }finally{await close();await storage?.shutdown();if(pool){await pool.query('DROP SCHEMA "'+namespace+'" CASCADE');await pool.end();}await rm(dir,{recursive:true,force:true});}
});
