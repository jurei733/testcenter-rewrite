import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile,readdir} from 'node:fs/promises';
import fs from 'node:fs/promises';
import {syncBuiltinESMExports} from 'node:module';
import {join,resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {createFirstSliceServices,decodeOriginalTestLogJson} from '@testcenter-rewrite-app/application';
import {prepareOriginalXmlSchemaValidator} from '../packages/application/dist/packages/application/src/original-xml-schema.js';
import {createProductionApiServer} from '../apps/api/dist/apps/api/src/index.js';
import {DatabaseSync} from 'node:sqlite';
import {Pool} from 'pg';
import {types as pgTypes} from 'pg';
import {WebSocket} from 'ws';
import {once} from 'node:events';
import {fixture} from './native-admin-permissions-controls.mjs';
import {verifyNativeWorkspaceDeletionSecurity,verifyNativeWorkspaceParentLocks} from './native-workspace-deletion-security-controls.mjs';

const root=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-administration-deletion-http/',import.meta.url),hash=b=>createHash('sha256').update(b).digest('hex');
const bytes=await readFile(new URL('observations.json',root)),source=JSON.parse(bytes),proof=JSON.parse(await readFile(new URL('independent-verification.json',root))),manifest=JSON.parse(await readFile(new URL('manifest.json',root)));
assert.equal(hash(bytes),proof.observationSha256);for(const[name,digest]of Object.entries(manifest.files))assert.equal(hash(await readFile(new URL(name,root))),digest);
assert.equal(source.verified,true);assert.equal(source.actualHttpExchanges,210);assert.equal(source.baselineRestored,true);assert.equal(source.sourceCommit,'eedae41840cbe90e5547c0211da818bdf620f5aa');
const validator=await prepareOriginalXmlSchemaValidator(resolve(process.env.FIRST_SLICE_XML_SCHEMA_CACHE||'.data/original-xml-schemas'),false);
const kinds=['memory','file','sqlite',...(process.env.FIRST_SLICE_STORE==='postgres'?['postgres']:[])];
const schemas={Unit:'unit-xml/17.6',Booklet:'testcenter-booklet-xml/18.0',Testtakers:'testcenter-testtaker-xml/18.0'};
const xml=(kind,body)=>`<${kind} xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/${schemas[kind]}">${body}</${kind}>`;
export async function populateWorkspace(f,w,label){
 const services=createFirstSliceServices({repository:f.repository,now:f.now,originalXmlSchemaValidator:validator,xmlSchemaProfile:'original-19'}),scope={tenantKey:f.tenant.tenantKey,workspaceKey:w.workspaceKey};
 const upload=(fileName,sourceDocument,mediaType='application/xml')=>services.contentIntake.uploadWorkspaceFile({...scope,fileName,sourceDocument,mediaType});
 await upload('owned-ws-delete-player-1.0.html','<html><script type="application/ld+json">'+JSON.stringify({id:'owned-ws-delete-player',version:'1.0.0',specVersion:'6.0',metadataVersion:'2.0',type:'player',name:[{lang:'de',value:'Owned deletion Player'}],description:[{lang:'de',value:'Owned fixture'}]})+'</script><main>Owned Player</main></html>','text/html');
 const unit='OWNED.WS.DELETE.UNIT',booklet='OWNED.WS.DELETE.'+label.toUpperCase(),group='OWNED.DELETE.'+label.toUpperCase(),name='owned-delete-'+label+'-'+f.kind;
 await upload('unit.xml',xml('Unit','<Metadata><Id>'+unit+'</Id><Label>Owned deletion Unit</Label></Metadata><Definition player="owned-ws-delete-player@1.0.0">Owned '+label+' definition</Definition>'));
 await upload('booklet.xml',xml('Booklet','<Metadata><Id>'+booklet+'</Id><Label>Owned '+label+' Booklet Ω</Label></Metadata><Units><Unit id="'+unit+'" label="Owned deletion Unit"/></Units>'));
 await services.workspaceAdminRead.importParticipantRoster({...scope,rosterText:xml('Testtakers','<Metadata/><Group id="'+group+'" label="Owned '+label+' group Ω"><Login name="'+name+'" mode="run-trial"><Booklet>'+booklet+'</Booklet></Login><Login name="'+name+'-m" mode="monitor-group"/></Group>')});
 const person=await services.originalSession.login({name,password:''}),monitor=await services.originalSession.login({name:name+'-m',password:''}),testNumber=await services.originalTest.create({token:person.token,bookletName:booklet});
 await services.originalTest.read({token:person.token,testNumber});
 await services.originalTest.patchState({token:person.token,testNumber,patch:[{key:'OWNED.STORED',content:'Owned '+label+' state Ω',timeStamp:1793796000010}]});
 const request={token:person.token,testNumber,unitName:unit};
 await services.originalUnit.patchState({...request,body:{originalUnitId:'OWNED.ORIGINAL.'+label,newState:[{key:'PRESENTATION_PROGRESS',content:'some',timeStamp:1793796000011}]}});
 await services.originalUnit.putResponse({...request,body:{timeStamp:1793796000012,dataParts:{owned:JSON.stringify({answer:'Owned '+label+' answer Ω'})},responseType:'owned'}});
 await services.originalUnit.putLog({...request,body:{logEntries:[{key:'OWNED_UNIT',content:'Owned '+label+' unit log',timeStamp:1793796000013}]}});
 await services.originalTest.putLog({token:person.token,testNumber,body:[{key:'OWNED_TEST',content:'Owned '+label+' test log',timeStamp:1793796000014}]});
 for(const unitName of [unit,null])await services.originalReview.create({token:person.token,testNumber,unitName,body:{priority:2,categories:'tech design',entry:'Owned '+label+' review Ω\n  line two',reviewer:'Reviewer Ä',userAgent:'Owned deletion probe',originalUnitId:'OWNED.ORIGINAL.'+label,page:3,pagelabel:'Teilaufgabe β'}});
 await services.originalCommand.send({token:monitor.token,body:{keyword:'pause',arguments:[],timestamp:1793796000,testIds:[Number(testNumber)]}});
 await services.originalCommand.pending({token:person.token,testNumber});await services.originalMonitor.sessions({token:monitor.token,groupKey:group});
 const native=await f.repository.findOriginalTestNumber({tenantId:w.tenantId,workspaceId:w.workspaceId,participantSessionId:(await services.originalAuthentication.read({token:person.token})).participantSession.participantSessionId,testNumber});
 const parent=await f.repository.getParticipantSessionById(native.participantSessionId),run=await f.repository.getTestRunById(native.testRunId);
 await f.repository.saveParticipantSession({...parent,status:'launched'});await f.repository.saveTestRun({...run,status:'running',controllerEntry:undefined});
 assert.equal((await f.repository.updateParticipantPresence({testRunId:native.testRunId,participantSessionId:native.participantSessionId,action:'open',connectionId:randomUUID(),timestamp:f.clock.value})).accepted,true);
 await f.repository.recordParticipantLoginFailure({tenantId:w.tenantId,workspaceId:w.workspaceId,loginKey:name,attemptedAt:f.now(),expiresAt:new Date(f.clock.value+60000).toISOString()});
 return{...scope,tenantId:w.tenantId,workspaceId:w.workspaceId,person,monitor,testNumber,testRunId:native.testRunId,participantSessionId:native.participantSessionId,contentReleaseId:native.contentReleaseId,group,services,loginKey:name};
}
async function snapshot(f,w){
 const repository=f.repository,tenantId=w.tenantId,workspaceId=w.workspaceId;
 const lists=['listAttachmentFilesByWorkspace','listWorkspaceActivityEventsByWorkspace','listWorkspaceReviewsByWorkspace','listSourcePackagesByWorkspace','listImportJobsByWorkspace','listContentReleasesByWorkspace','listParticipantSessionsByWorkspace','listParticipantRosterEntriesByWorkspace','listOriginalParticipantGroupsByWorkspace','listOriginalLoginBindingsByWorkspace','listOriginalOperationalLoginsByWorkspace','listOperationalLoginMigrationCandidatesByWorkspace','listTestRunsByWorkspace','listParticipantTestLogsByWorkspace'];
 const data={workspace:await repository.getWorkspaceByScope(f.tenant.tenantKey,w.workspaceKey)};
 for(const name of lists){assert.equal(typeof repository[name],'function',name);data[name]=await repository[name](tenantId,workspaceId);}
 return data;
}
async function objects(file){const dir=file+'.objects',out={};async function visit(path,prefix=''){let items;try{items=await readdir(path,{withFileTypes:true});}catch(e){if(e.code==='ENOENT')return;throw e;}for(const item of items){const key=prefix+item.name;if(item.isDirectory())await visit(join(path,item.name),key+'/');else if(item.isFile())out[key]=hash(await readFile(join(path,item.name)));}}await visit(dir);return out;}
async function assertNoSqlOrphans(f,scope,people,runs){
 if(f.kind!=='sqlite'&&f.kind!=='postgres')return;
 const db=f.kind==='sqlite'?new DatabaseSync(f.file):new Pool({connectionString:f.url.toString()}),quoted=s=>'"'+s.replaceAll('"','""')+'"';
 try{
  // Discover scope columns from the actual installed schema rather than
  // copying the implementation's cleanup list into this assertion.
  let tables;
  if(f.kind==='sqlite')tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name).filter(name=>{const cols=db.prepare('PRAGMA table_info('+quoted(name)+')').all().map(r=>r.name);return cols.includes('tenant_id')&&cols.includes('workspace_id');});
  else tables=(await db.query("SELECT table_name FROM information_schema.columns WHERE table_schema=current_schema() AND column_name IN ('tenant_id','workspace_id') GROUP BY table_name HAVING count(DISTINCT column_name)=2")).rows.map(r=>r.table_name);
  assert.ok(tables.length>=24);
  for(const table of tables){const sql='SELECT count(*) AS count FROM '+quoted(table)+' WHERE tenant_id='+ (f.kind==='sqlite'?'?':'$1')+' AND workspace_id='+(f.kind==='sqlite'?'?':'$2'),args=[scope.tenantId,scope.workspaceId];const r=f.kind==='sqlite'?db.prepare(sql).get(...args):(await db.query(sql,args)).rows[0];assert.equal(Number(r.count),0,'Owned rows remain in actual schema table '+table);}
  for(const [table,key,ids]of [['participant_access_credentials','participant_session_id',people],['participant_connection_presence','test_run_id',runs]])for(const id of ids){const sql='SELECT count(*) AS count FROM '+table+' WHERE '+key+'='+(f.kind==='sqlite'?'?':'$1'),r=f.kind==='sqlite'?db.prepare(sql).get(id):(await db.query(sql,[id])).rows[0];assert.equal(Number(r.count),0,table);}
 }finally{if(f.kind==='sqlite')db.close();else await db.end();}
}
async function replay(f,request,{methods=false}={}){
 const ids=new Map([['1','1'],['2','2']]);let current=null,cases=0;
 for(const row of source.rows){
  if(row.label.startsWith('create-workspaces-')){current=row.rawText;const actual=await request('PUT','/workspace',row.requestBody);assert.equal(actual.status,201);ids.set(current,actual.text);cases++;continue;}
  if(!row.label.startsWith('workspaces-')||row.label.startsWith('workspaces-auth-')||!methods&&row.label.startsWith('workspaces-method-')||row.label==='workspaces-after-partial')continue;
  let body=row.requestBody===undefined?undefined:structuredClone(row.requestBody),raw=row.rawRequestBody;
  if(body&&typeof body==='object'&&!Array.isArray(body)){
   if(body.p==='[owned-root-password]')body.p=f.password;
   if(Array.isArray(body.ws))body.ws=body.ws.map(v=>typeof v==='number'&&String(v)===current?Number(ids.get(current)):typeof v==='string'&&current&&v.includes(current)?v.replace(current,ids.get(current)):v);
  }
  if(raw){raw=raw.replaceAll('[owned-root-password]',f.password);if(/workspaces-element-(whole-float|fraction)$/.test(row.label))raw=raw.replace('['+current,'['+ids.get(current));}
  const actual=await request(row.method,row.path,body,raw);assert.equal(actual.status,row.status,row.label+': '+actual.text);cases++;
  if(row.method==='GET')assert.deepEqual(JSON.parse(actual.text).map(w=>String(w.id)).sort(),row.value.map(w=>ids.get(String(w.id))).sort(),row.label);
  else assert.equal(actual.text,row.rawText,row.label);
  if(actual.headers){assert.equal(actual.headers.get('content-type'),row.contentType,row.label);assert.equal(actual.headers.get('cache-control'),'private, no-store');}
 }
 const partial=source.rows.find(r=>r.label==='create-workspaces-partial');assert.ok(JSON.parse((await request('GET','/workspaces')).text).some(w=>String(w.id)===ids.get(partial.rawText)),'Source partial deletion must remain a complete Rewrite rollback.');
 assert.equal((await request('DELETE','/workspaces',{ws:[...ids.values()].slice(2),p:f.password})).status,200);assert.ok(cases>80);
}
for(const kind of kinds)test(`${kind}: native workspace deletion retains Source inputs and removes the complete owned aggregate atomically`,{timeout:240000},async t=>{
 const f=await fixture(kind,t),remove=(ids,services=f.services)=>services.originalAdminDirectory.deleteWorkspaces({token:f.root.token,body:{ws:ids,p:f.password}});
 await t.test('frozen Source collection/password precedence, PDO casts and intentional complete rollback',async()=>{await replay(f,async(method,path,body,raw)=>{
  try{if(method==='GET')return{status:200,text:await f.services.originalAdminDirectory.listWorkspaces({token:f.root.token})};
   const decoded=decodeOriginalTestLogJson(raw??JSON.stringify(body));if(method==='PUT')return{status:201,text:await f.services.originalAdminDirectory.createWorkspace({token:f.root.token,body:decoded})};
   await f.services.originalAdminDirectory.deleteWorkspaces({token:f.root.token,body:decoded});return{status:200,text:''};
  }catch(e){return{status:e.statusCode??500,text:e.statusCode?e.message:'Internal error.'};}
 });});
 await t.test('immutable metadata rejects a forged Root, foreign target and mixed effects before mutation',async()=>{
  let metadata;await f.repository.mutateOriginalAdminSession({token:f.root.token,at:f.now(),directory:'workspaces',workspaceWrite:'delete'},s=>{metadata=structuredClone(s);return{};});
  const peer=await f.services.originalAdminSession.login({name:f.a.username,password:f.password}),before=await snapshot(f,f.one),roles=await f.allRoles(),audits=await f.repository.listAdminAuditEvents();
  const forged={...f.repository,mutateOriginalAdminSession:(selector,transform)=>f.repository.mutateOriginalAdminSession(selector,s=>{s.roles=[{...metadata.roles[0],adminUserId:s.user.adminUserId}];s.directory=structuredClone(metadata.directory);return transform(s);})};
  await assert.rejects(createFirstSliceServices({repository:forged,now:f.now}).originalAdminDirectory.deleteWorkspaces({token:peer.token,body:{ws:['1'],p:f.password}}),/deletion authorization changed/);
  for(const edit of [e=>e.deletedWorkspaces[0].workspace.tenantId=randomUUID(),e=>e.deletedWorkspaces[0].workspaceNumber='2',e=>e.deletedWorkspaces[0].tenant.tenantKey='foreign',e=>e.deletedUsers=[]]){
   const repository={...f.repository,mutateOriginalAdminSession:(selector,transform)=>f.repository.mutateOriginalAdminSession(selector,s=>{const e=transform(s);if(e.deletedWorkspaces)edit(e);return e;})};
   await assert.rejects(remove(['1'],createFirstSliceServices({repository,now:f.now})));
  }
  assert.deepEqual(await snapshot(f,f.one),before);assert.deepEqual(await f.allRoles(),roles);assert.deepEqual(await f.repository.listAdminAuditEvents(),audits);
 });
 await verifyNativeWorkspaceDeletionSecurity(t,f);
 await t.test('populated batch rollback and complete deletion preserve foreign scopes, parent tenants and sidecars',async sub=>{
  const target=await populateWorkspace(f,f.one,'target'),control=await populateWorkspace(f,f.two,'control');
  if(kind==='postgres'){
   const workspace=await f.services.platform.createWorkspace({tenantKey:f.tenant.tenantKey,workspaceKey:'held-artifact',displayName:'Owned held attachment workspace'});
   await verifyNativeWorkspaceParentLocks(sub,f,await populateWorkspace(f,workspace,'held-artifact'));
  }
  const marker='OWNED_DELETE_WORKSPACE_PRIVATE_'+randomUUID(),foreign=[];
  for(const w of [f.one,f.two])await f.repository.saveSourcePackage({sourcePackageId:randomUUID(),tenantId:w.tenantId,workspaceId:w.workspaceId,fileName:'private.xml',mediaType:'application/xml',sourceDocument:marker,contentStructure:{bookletEntries:[],privateFixtureMarker:marker},status:'accepted',uploadedAt:f.now()});
  for(const suffix of ['a','b']){const tenant=await f.services.platform.createTenant({tenantKey:'foreign-delete-'+suffix,displayName:'Foreign '+suffix}),workspace=await f.services.platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:f.one.workspaceKey,displayName:f.one.displayName});foreign.push({tenant,workspace});}
  const alias=await f.repository.getWorkspaceByWorkspaceKey(f.one.workspaceKey);await f.reopen();
  const before=await snapshot(f,f.one),retained=await snapshot(f,f.two),roles=await f.allRoles(),audits=await f.repository.listAdminAuditEvents(),files=kind==='file'?await objects(f.file):null;
  const directory=await f.services.originalAdminDirectory.listWorkspaces({token:f.root.token});
  for(const idList of [['1','owned-invalid'],['1','2']]){
   let services=f.services;
   if(idList[1]==='2'){const repository={...f.repository,mutateOriginalAdminSession:(selector,transform)=>f.repository.mutateOriginalAdminSession(selector,s=>{const e=transform(s);if(e.deletedWorkspaces)e.audits[1].adminAuditEventId=audits[0].adminAuditEventId;return e;})};services=createFirstSliceServices({repository,now:f.now});}
   await assert.rejects(remove(idList,services));assert.deepEqual(await snapshot(f,f.one),before);assert.deepEqual(await snapshot(f,f.two),retained);assert.deepEqual(await f.repository.listAdminAuditEvents(),audits);if(files)assert.deepEqual(await objects(f.file),files);
  }
  assert.equal(await f.services.originalAdminDirectory.listWorkspaces({token:f.root.token}),directory);
  if(kind==='file')await sub.test('actual manifest write failure restores the whole batch and dirty sidecar state',async()=>{
   const oldRename=fs.rename,manifestBefore=await readFile(f.file),objectsBefore=await objects(f.file);let faults=0;
   fs.rename=async(from,to)=>{if(to===f.file){faults++;throw Object.assign(Error('Owned native workspace manifest failure'),{code:'EIO'});}return oldRename(from,to);};syncBuiltinESMExports();
   try{await assert.rejects(remove(['1','2']),/Owned native workspace manifest failure/);}finally{fs.rename=oldRename;syncBuiltinESMExports();}
   assert.equal(faults,1);assert.deepEqual(await readFile(f.file),manifestBefore);assert.deepEqual(await objects(f.file),objectsBefore);
   await f.reopen();assert.deepEqual(await snapshot(f,f.one),before);assert.deepEqual(await snapshot(f,f.two),retained);assert.deepEqual(await f.repository.listAdminAuditEvents(),audits);
  });
  // Force fresh lazy payloads. Neither target nor retained Source package
  // contents may be decoded to perform a metadata-authorized deletion.
  await f.reopen();const parse=JSON.parse,parser=pgTypes.getTypeParser(3802);JSON.parse=text=>{if(typeof text==='string'&&text.includes(marker))throw Error('Private workspace deletion decoder fence');return parse(text);};if(kind==='postgres')pgTypes.setTypeParser(3802,JSON.parse);
  try{await remove(['1','1']);}finally{JSON.parse=parse;if(kind==='postgres')pgTypes.setTypeParser(3802,parser);}await f.reopen();
  const gone=await snapshot(f,f.one);assert.equal(gone.workspace,null);for(const [key,v]of Object.entries(gone))if(key!=='workspace')assert.deepEqual(v,[],key);
  assert.deepEqual(await snapshot(f,f.two),retained);assert.deepEqual(await f.repository.getTenantByKey(f.tenant.tenantKey),f.tenant);
  assert.deepEqual(await f.allRoles(),roles.filter(r=>r.workspaceId!==f.one.workspaceId));
  await assert.rejects(f.services.originalSession.read({token:target.person.token}),e=>e.statusCode===401);await assert.rejects(f.services.originalSession.read({token:target.monitor.token}),e=>e.statusCode===401);
  assert.equal(await f.repository.findOriginalWorkspaceAdministrationScope('1'),null);assert.equal(await f.repository.findOriginalTestNumber({...target,participantSessionId:target.participantSessionId,testNumber:target.testNumber}),null);
  assert.equal(await f.repository.getParticipantAccessCredential(target.participantSessionId),null);assert.equal((await f.repository.listExpiredParticipantPresence(f.clock.value+120000,100)).some(p=>p.testRunId===target.testRunId),false);
  assert.equal(await f.repository.findOriginalSessionTokenByHash(hash(target.person.groupToken)),null);
  await assertNoSqlOrphans(f,target,before.listParticipantSessionsByWorkspace.map(p=>p.participantSessionId),before.listTestRunsByWorkspace.map(r=>r.testRunId));
  assert.equal((await f.services.originalSession.read({token:control.person.token})).token,control.person.token);
  assert.equal(await f.repository.getParticipantLoginAttempt(target.tenantId,target.workspaceId,target.loginKey),null);assert.ok(await f.repository.getParticipantLoginAttempt(control.tenantId,control.workspaceId,control.loginKey));
  for(const row of foreign)assert.deepEqual(await f.repository.getWorkspaceByScope(row.tenant.tenantKey,row.workspace.workspaceKey),row.workspace);
  if(kind==='memory'||kind==='file')assert.deepEqual(await f.repository.getWorkspaceByWorkspaceKey(f.one.workspaceKey),alias,'A foreign short-key alias must not be repointed.');
  const recreated=await f.services.platform.createWorkspace({tenantKey:f.tenant.tenantKey,workspaceKey:f.one.workspaceKey,displayName:f.one.displayName});assert.notEqual(recreated.workspaceId,f.one.workspaceId);
  await f.services.originalAdminDirectory.listWorkspaces({token:f.root.token});assert.notEqual(await f.repository.getOrCreateOriginalWorkspaceNumber(recreated),'1');
  if(files){const after=await objects(f.file);assert.ok(Object.keys(after).length<Object.keys(files).length,'Owned external package/release payloads must be removed.');}
 });
 await t.test('exact signed-int64 workspace identity stays exact',async()=>{
  await f.repository.mutateOriginalAdminSession({token:f.root.token,at:f.now()},()=>({workspaceCounter:'9007199254740992'}));
  const id=await f.services.originalAdminDirectory.createWorkspace({token:f.root.token,body:{name:'Owned exact workspace deletion'}});assert.equal(id,'9007199254740993');
  await f.services.originalAdminDirectory.deleteWorkspaces({token:f.root.token,body:decodeOriginalTestLogJson('{"ws":[9007199254740993],"p":'+JSON.stringify(f.password)+'}')});assert.equal(await f.repository.findOriginalWorkspaceAdministrationScope(id),null);
 });
});

for(const kind of kinds)test(`${kind}: native workspace deletion preserves hidden scopes and resolves duplicate names only by exact numeric identity`,{timeout:60000},async t=>{
 const f=await fixture(kind,t),remove=ids=>f.services.originalAdminDirectory.deleteWorkspaces({token:f.root.token,body:{ws:ids,p:f.password}});
 await f.repository.saveTenant({...f.tenant,status:'suspended'});await remove(['1','2']);assert.equal((await f.repository.getWorkspaceByScope(f.tenant.tenantKey,f.one.workspaceKey)).workspaceId,f.one.workspaceId);await f.repository.saveTenant(f.tenant);
 await f.repository.saveWorkspace({tenantKey:f.tenant.tenantKey,workspaceKey:f.one.workspaceKey,workspace:{...f.one,status:'archived'}});await remove(['1']);assert.equal((await f.repository.getWorkspaceByScope(f.tenant.tenantKey,f.one.workspaceKey)).status,'archived');await f.repository.saveWorkspace({tenantKey:f.tenant.tenantKey,workspaceKey:f.one.workspaceKey,workspace:f.one});
 const peer={...f.two,displayName:f.one.displayName};await f.repository.saveWorkspace({tenantKey:f.tenant.tenantKey,workspaceKey:peer.workspaceKey,workspace:peer});
 await assert.rejects(remove(['2','9223372036854775808']),e=>e.statusCode===500);assert.deepEqual(await f.repository.getWorkspaceByScope(f.tenant.tenantKey,peer.workspaceKey),peer);
 await remove([true]);assert.equal(await f.repository.getWorkspaceByScope(f.tenant.tenantKey,f.one.workspaceKey),null);assert.deepEqual(await f.repository.getWorkspaceByScope(f.tenant.tenantKey,peer.workspaceKey),peer);assert.ok(Object.hasOwn((await f.services.originalAdminSession.read({token:f.root.token})).claims,'superAdmin'));
});

test(`real ${process.env.FIRST_SLICE_STORE==='postgres'?'PostgreSQL':'SQLite'} native workspace deletion HTTP matches Source precedence and atomic responses`,{timeout:240000},async t=>{
 const f=await fixture(process.env.FIRST_SLICE_STORE==='postgres'?'postgres':'sqlite',t),previous={...process.env};
 Object.assign(process.env,{FIRST_SLICE_STORE:f.kind,FIRST_SLICE_SQLITE_FILE:f.file,...f.url?{FIRST_SLICE_POSTGRES_URL:f.url.toString()}:{},FIRST_SLICE_BOOTSTRAP_DEMO:'false',FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',FIRST_SLICE_XML_SCHEMA_PROFILE:'original-19',FIRST_SLICE_NATIVE_WEBSOCKET_ENABLED:'true'});
 let server;try{server=await createProductionApiServer();}finally{for(const key of Object.keys(process.env))if(!(key in previous))delete process.env[key];Object.assign(process.env,previous);}
 await new Promise(done=>server.listen(0,'127.0.0.1',done));f.beforeShutdown(async()=>{server.closeAllConnections();await new Promise(done=>server.close(done));});
 const request=async(method,path,body,raw,token=f.root.token)=>{const payload=raw??(body===undefined?undefined:JSON.stringify(body)),r=await fetch('http://127.0.0.1:'+server.address().port+path,{method,headers:{...token?{AuthToken:token}:{},...payload===undefined?{}:{'content-type':'application/json'}},...payload===undefined?{}:{body:payload},signal:AbortSignal.timeout(15000)});return{status:r.status,text:await r.text(),headers:r.headers};};
 const reader=await f.services.originalAdminSession.login({name:f.a.username,password:f.password});
 for(const[token,code]of [[null,401],[reader.token,403],[f.root.token,500]])assert.equal((await request('DELETE','/workspaces',undefined,'{',token)).status,code);
 await replay(f,request,{methods:true});
 await t.test('actual populated HTTP commit closes all four Source channels, failure closes none and control data is unchanged',async()=>{
  const target=await populateWorkspace(f,f.one,'http-target'),control=await populateWorkspace(f,f.two,'http-control'),sockets=[];
  const before=await snapshot(f,f.one),retained=await snapshot(f,f.two),base='http://127.0.0.1:'+server.address().port;
  const ticket=async(scope,channel)=>{const r=await request('GET',channel==='commands'?'/test/'+scope.testNumber+'/commands':'/monitor/group/'+scope.group+'/test-sessions',undefined,undefined,channel==='commands'?scope.person.token:scope.monitor.token);assert.equal(r.status,200);assert.ok(r.headers.get('SubscribeToken'));return r.headers.get('SubscribeToken');};
  const connect=async(value,channel)=>{const ws=new WebSocket(base.replace('http:','ws:')+'/ws?token='+value,{origin:base});sockets.push(ws);ws.on('error',()=>{});await once(ws,'open',{signal:AbortSignal.timeout(10000)});const frame=once(ws,'message',{signal:AbortSignal.timeout(10000)});ws.send(JSON.stringify({event:'subscribe:'+channel}));await frame;return ws;};
  const expectClosed=ws=>once(ws,'close',{signal:AbortSignal.timeout(10000)});
  const query=f.kind==='sqlite'?new DatabaseSync(f.file):new Pool({connectionString:f.url.toString()});
  const sql=async text=>f.kind==='sqlite'?query.exec(text):query.query(text);
  const drop=f.kind==='sqlite'?'DROP TRIGGER IF EXISTS owned_native_workspace_http_failure':'DROP TRIGGER IF EXISTS owned_native_workspace_http_failure ON admin_audit_events; DROP FUNCTION IF EXISTS owned_native_workspace_http_failure()';
  try{
   const peers=[];for(const scope of [target,control])for(const channel of ['commands','test-sessions'])peers.push(await connect(await ticket(scope,channel),channel));
   const wrong=await request('DELETE','/workspaces',{ws:['1'],p:'owned-incorrect-password'});assert.equal(wrong.status,403);assert.ok(peers.every(ws=>ws.readyState===WebSocket.OPEN));
   const savedTicket=await ticket(control,'commands');
   await sql(f.kind==='sqlite'?"CREATE TRIGGER owned_native_workspace_http_failure BEFORE INSERT ON admin_audit_events WHEN NEW.summary='Native workspace deleted' BEGIN SELECT RAISE(ABORT,'owned workspace HTTP audit failure'); END":
    "CREATE FUNCTION owned_native_workspace_http_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned workspace HTTP audit failure'; END $$; CREATE TRIGGER owned_native_workspace_http_failure BEFORE INSERT ON admin_audit_events FOR EACH ROW WHEN (NEW.summary='Native workspace deleted') EXECUTE FUNCTION owned_native_workspace_http_failure()");
   const failed=await request('DELETE','/workspaces',{ws:['1','2'],p:f.password});assert.equal(failed.status,500);await sql(drop);
   assert.ok(peers.every(ws=>ws.readyState===WebSocket.OPEN));assert.deepEqual(await snapshot(f,f.one),before);assert.deepEqual(await snapshot(f,f.two),retained);
   const survived=await connect(savedTicket,'commands'),survivedClosed=expectClosed(survived);survived.close();await survivedClosed;
   const unused=await ticket(control,'commands'),closed=peers.map(expectClosed),deleted=await request('DELETE','/workspaces',{ws:['1'],p:f.password});
   assert.equal(deleted.status,200);assert.equal(deleted.text,'');for(const [code,reason]of await Promise.all(closed)){assert.equal(code,1005);assert.equal(String(reason),'');}
   assert.deepEqual(await snapshot(f,f.two),retained);
   for(const path of ['/session','/test/'+target.testNumber,'/test/'+target.testNumber+'/commands']){
    const stale=await request('GET',path,undefined,undefined,target.person.token);assert.equal(stale.status,403);assert.equal(stale.text,'Invalid token.');assert.equal(stale.headers.get('content-type'),'text/html;charset=UTF-8');assert.equal(stale.headers.get('test-mode'),'NO');assert.ok(stale.headers.get('error-id'));assert.equal(stale.text.includes(target.person.token),false);
   }
   const rejected=new WebSocket(base.replace('http:','ws:')+'/ws?token='+unused,{origin:base});sockets.push(rejected);rejected.on('error',()=>{});const [,response]=await once(rejected,'unexpected-response',{signal:AbortSignal.timeout(10000)});assert.equal(response.statusCode,403);response.resume();rejected.terminate();
   const fresh=await connect(await ticket(control,'commands'),'commands'),freshClosed=expectClosed(fresh);
   assert.equal((await request('DELETE','/workspaces',{ws:[],p:f.password})).status,200);assert.equal((await freshClosed)[0],1005,'A successful empty batch still performs Original global cleanup.');
   assert.deepEqual(await snapshot(f,f.two),retained);
  }finally{for(const ws of sockets)ws.terminate();await sql(drop);if(f.kind==='sqlite')query.close();else await query.end();}
 });
});
