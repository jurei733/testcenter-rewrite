import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {Pool,types as pgTypes} from 'pg';
import {setTimeout as delay} from 'node:timers/promises';
import {createFirstSliceServices,decodeOriginalTestLogJson} from '@testcenter-rewrite-app/application';
import {createProductionApiServer} from '../apps/api/dist/apps/api/src/index.js';
import {fixture} from './native-admin-permissions-controls.mjs';

const directory=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-workspace-directory-crud-http/',import.meta.url);
const bytes=await readFile(new URL('observations.json',directory));
const source=JSON.parse(bytes),manifest=JSON.parse(await readFile(new URL('manifest.json',directory))),proof=JSON.parse(await readFile(new URL('independent-verification.json',directory)));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.equal(hash(bytes),proof.observationSha256);assert.equal(hash(bytes),manifest.files['observations.json']);
assert.equal(source.verified,true);assert.equal(source.baselineRestored,true);assert.equal(source.actualHttpExchanges,231);
assert.equal(source.sourceCommit,'eedae41840cbe90e5547c0211da818bdf620f5aa');
assert.equal(Object.keys(source.sourceHashes).length,137);assert.equal(source.sqlSeedsOrDaoStubs,false);
assert.deepEqual(source.sourceRuntimeBefore,source.sourceRuntimeAfter);
assert.equal(hash(await readFile(new URL('verify.mjs',directory))),proof.verifierSha256);
for(const[name,digest]of Object.entries(manifest.files))assert.equal(hash(await readFile(new URL(name,directory))),digest);
for(const row of source.rows)assert.equal(hash(row.rawText),row.redactedBodySha256,row.label);
const kinds=['memory','file','sqlite',...(process.env.FIRST_SLICE_STORE==='postgres'?['postgres']:[])];
const status=expected=>error=>error.statusCode===expected;
const sourceAnchor=source.rows.find(row=>row.label==='create-anchor').rawText;
const collator=new Intl.Collator('de-DE-u-ks-level2',{usage:'sort',sensitivity:'accent'});
// Source orders only by name. Equal-collation names have no SQL tie order;
// compare their full rows by ID without normalizing any other ordering/value.
function equalNameGroups(rows){
 const result=[];
 for(let i=0;i<rows.length;){let end=i+1;while(end<rows.length&&collator.compare(rows[i].name,rows[end].name)===0)end++;
  result.push(...rows.slice(i,end).toSorted((a,b)=>a.id-b.id));i=end;}
 return result;
}
const selected=row=>row.label==='baseline-workspaces'||row.label==='before-rename-same-name'||row.label.startsWith('after-create-')||row.label.startsWith('after-rename-')||
 row.label.startsWith('create-')||row.label.startsWith('rename-');
function reference(value,ids){
 const target=ids.get(sourceAnchor);if(!target)return value;
 if(value==='-'+sourceAnchor)return'-'+target;
 for(const suffix of ['','owned','.9','e0'])if(value===sourceAnchor+suffix)return target+suffix;
 return value;
}
async function replay(request){
 const ids=new Map([['1','1'],['2','2']]);let count=0;
 for(const row of source.rows.filter(selected)){
  const path=row.path.replace(/^\/workspace\/([^/]+)$/,(_,ref)=>'/workspace/'+reference(ref,ids));
  const actual=await request(row.method,path,row.requestBody,row.rawRequestBody);
  assert.equal(actual.status,row.status,row.label+': '+actual.text);count++;
  if(row.method==='GET'){
   const expected=row.value.map(workspace=>({...workspace,id:Number(ids.get(String(workspace.id)))}));
   assert.ok(expected.every(workspace=>Number.isSafeInteger(workspace.id)),row.label+' ID map');
   const value=JSON.parse(actual.text);assert.deepEqual(equalNameGroups(value),equalNameGroups(expected),row.label);
   if(value.length)assert.deepEqual(Object.keys(value[0]),Object.keys(row.value[0]),row.label+' DTO order');
  }else if(row.status===201){
   assert.match(actual.text,/^[1-9]\d*$/);assert.ok(BigInt(actual.text)<=9223372036854775807n);
   assert.ok(![...ids.values()].includes(actual.text),row.label+' fresh identity');ids.set(row.rawText,actual.text);
  }else{
   const expected=row.rawText.replace('`-'+sourceAnchor+'`','`-'+ids.get(sourceAnchor)+'`');
   assert.equal(actual.text,expected,row.label);
  }
  if(actual.headers){assert.equal(actual.headers.get('content-type'),row.contentType,row.label+' content type');assert.equal(actual.headers.get('cache-control'),'private, no-store');}
 }
 return{count,ids};
}
const snapshot=async f=>{let result;await f.repository.mutateOriginalAdminSession({token:f.root.token,at:f.now(),directory:'workspaces',workspaceWrite:'create'},s=>{result=structuredClone(s);return{};});return result;};

for(const kind of kinds)test(`${kind}: native workspace directory writes retain Source behavior and atomic protected scopes`,{timeout:180000},async t=>{
 const f=await fixture(kind,t),beforeRoles=await f.allRoles();
 await t.test('audit failure rolls back a new internal parent, workspace, numeric counter and rename',async()=>{
  const audits=await f.repository.listAdminAuditEvents({limit:10000}),collision=audits[0].adminAuditEventId;
  const before=await snapshot(f);
  const repository={...f.repository,mutateOriginalAdminSession:(selector,transform)=>f.repository.mutateOriginalAdminSession(selector,s=>{
   const effect=transform(s);if(effect.workspaceChange)effect.audit.adminAuditEventId=collision;return effect;
  })};
  const services=createFirstSliceServices({repository,now:f.now});
  await assert.rejects(services.originalAdminDirectory.createWorkspace({token:f.root.token,body:{name:'Owned audit rollback '+kind}}));
  await assert.rejects(services.originalAdminDirectory.renameWorkspace({token:f.root.token,reference:'1',body:{name:'Owned rename rollback '+kind}}));
  assert.deepEqual(await snapshot(f),before);assert.deepEqual(await f.repository.listAdminAuditEvents({limit:10000}),audits);
 });
 await t.test('actual Source create/rename sequence, casts, conflicts and native path aliases',async()=>{
  const run=await replay(async(method,path,body,raw)=>{
   try{
    if(method==='GET')return{status:200,text:await f.services.originalAdminDirectory.listWorkspaces({token:f.root.token})};
    let parsed;try{parsed=decodeOriginalTestLogJson(raw??JSON.stringify(body));}catch{return{status:500,text:'Internal error.'};}
    if(method==='PUT')return{status:201,text:await f.services.originalAdminDirectory.createWorkspace({token:f.root.token,body:parsed})};
    await f.services.originalAdminDirectory.renameWorkspace({token:f.root.token,reference:path.slice('/workspace/'.length),body:parsed});return{status:200,text:''};
   }catch(error){return{status:error.statusCode,text:error.message};}
  });
  assert.ok(run.count>180);assert.equal(run.ids.size,20);
  const state=await snapshot(f),parent=state.directory.creationTenant;
  assert.equal(parent.tenantKey,'original-interface');assert.equal(parent.status,'active');
  assert.deepEqual(await f.allRoles(),beforeRoles,'No Root, Tenant, workspace, monitor or group grant is added or replaced.');
  for(const id of [...run.ids.values()].slice(2)){
   const row=state.directory.workspaces.find(row=>row.workspaceNumber===id);assert.ok(row);
   const canonical=await f.repository.getWorkspaceByScope(parent.tenantKey,row.workspace.workspaceKey);assert.equal(canonical.workspaceId,row.workspace.workspaceId);
  }
  const saved=await f.services.originalAdminDirectory.listWorkspaces({token:f.root.token});await f.reopen();
  assert.equal(await f.services.originalAdminDirectory.listWorkspaces({token:f.root.token}),saved,'Native IDs and renamed rows survive reopening.');
 });
 await t.test('a suspended dedicated parent is never reactivated or replaced',async()=>{
  const before=await snapshot(f),parent=before.directory.creationTenant;
  await f.repository.saveTenant({...parent,status:'suspended'});
  try{await assert.rejects(f.services.originalAdminDirectory.createWorkspace({token:f.root.token,body:{name:'Owned suspended parent'}}),status(409));}
  finally{await f.repository.saveTenant(parent);}
  assert.deepEqual(await snapshot(f),before);
 });
 await t.test('a hidden foreign workspace key cannot be overwritten or rebound',async()=>{
  const tenant=await f.services.platform.createTenant({tenantKey:'hidden-'+randomUUID(),displayName:'Owned protected parent'});
  const workspace=await f.services.platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:'workspace-forced-collision',displayName:'Owned protected workspace'});
  await f.repository.saveTenant({...tenant,status:'suspended'});
  try{
   const before=await snapshot(f),values=[randomUUID(),'forced-collision',randomUUID()];
   const services=createFirstSliceServices({repository:f.repository,now:f.now,idGenerator:()=>values.shift()??randomUUID()});
   await assert.rejects(services.originalAdminDirectory.createWorkspace({token:f.root.token,body:{name:'Owned forbidden key overwrite'}}));
   assert.deepEqual(await snapshot(f),before);
   assert.equal((await f.repository.getWorkspaceByWorkspaceKey(workspace.workspaceKey)).workspaceId,workspace.workspaceId);
  }finally{await f.repository.saveTenant(tenant);}
 });
 await t.test('metadata writes do not decode unrelated package or administrator payloads',async()=>{
  const marker='OWNED_WS_DIRECTORY_PRIVATE_'+randomUUID();
  await f.repository.saveSourcePackage({sourcePackageId:randomUUID(),tenantId:f.tenant.tenantId,workspaceId:f.one.workspaceId,fileName:'owned.xml',mediaType:'application/xml',sourceDocument:marker,
   contentStructure:{bookletEntries:[],privateFixtureMarker:marker},status:'accepted',uploadedAt:f.now()});
  const peer=await f.repository.getAdminUserById(f.b.adminUserId);await f.repository.saveAdminUser({...peer,customTexts:{privateFixtureMarker:marker}});
  const original=JSON.parse,parser=pgTypes.getTypeParser(3802);JSON.parse=text=>{if(typeof text==='string'&&text.includes(marker))throw Error('Unrelated native workspace decoder fence');return original(text);};
  if(kind==='postgres')pgTypes.setTypeParser(3802,JSON.parse);
  try{
   const id=await f.services.originalAdminDirectory.createWorkspace({token:f.root.token,body:{name:'Owned metadata-only '+kind}});
   await f.services.originalAdminDirectory.renameWorkspace({token:f.root.token,reference:id,body:{name:'Owned metadata-only renamed '+kind}});
  }finally{JSON.parse=original;if(kind==='postgres')pgTypes.setTypeParser(3802,parser);}
 });
 await t.test('a transform cannot forge Root by editing its metadata snapshot',async()=>{
  const peer=await f.services.originalAdminSession.login({name:f.a.username,password:f.password}),before=await snapshot(f);
  const repository={...f.repository,mutateOriginalAdminSession:(selector,transform)=>f.repository.mutateOriginalAdminSession(selector,s=>{
   s.roles=[{...before.roles.find(role=>role.role==='platform_admin'),adminUserId:s.user.adminUserId,roleAssignmentId:randomUUID()}];
   s.directory=structuredClone(before.directory);
   return transform(s);
  })};
  const services=createFirstSliceServices({repository,now:f.now});
  await assert.rejects(services.originalAdminDirectory.createWorkspace({token:peer.token,body:{name:'Owned forged Root workspace'}}),/writer authorization changed/);
  assert.deepEqual(await snapshot(f),before);
 });
 await t.test('name presence precedes target lookup, while object conversion follows it',async()=>{
  await assert.rejects(f.services.originalAdminDirectory.renameWorkspace({token:f.root.token,reference:'9223372036854775807',body:{name:'0'}}),error=>error.statusCode===400&&error.message==='New name (name) is missing');
  await assert.rejects(f.services.originalAdminDirectory.renameWorkspace({token:f.root.token,reference:'9223372036854775807',body:{name:{owned:1}}}),error=>error.statusCode===400&&error.message.includes('does not exist'));
  await assert.rejects(f.services.originalAdminDirectory.renameWorkspace({token:f.root.token,reference:'1',body:{name:{owned:1}}}),status(500));
 });
 if(kind==='postgres')await t.test('actual PostgreSQL table waits recheck Root revocation and expiry before create or rename',async()=>{
  const url=new URL(f.url);url.searchParams.set('application_name',f.schema+'_workspace_locker');
  const pool=new Pool({connectionString:url.toString()});
  try{
   for(const operation of ['create','rename'])for(const invalidation of ['role','expiry']){
    const client=await pool.connect(),before=await snapshot(f),rootRole=(await f.allRoles()).find(role=>role.role==='platform_admin'),clock=f.clock.value;
    let pending,committed=false;
    try{
     await client.query('BEGIN');await client.query('LOCK TABLE workspaces IN ROW EXCLUSIVE MODE');
     const action=operation==='create'?()=>f.services.originalAdminDirectory.createWorkspace({token:f.root.token,body:{name:'Owned blocked create'}})
      :()=>f.services.originalAdminDirectory.renameWorkspace({token:f.root.token,reference:'1',body:{name:'Owned blocked rename'}});
     pending=action().then(value=>({value}),error=>({error}));
     const deadline=Date.now()+10000;let waiting=false;
     while(Date.now()<deadline){
      const result=await pool.query("SELECT pid FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock' AND query LIKE 'LOCK TABLE tenants,workspaces,%'",[f.schema]);
      if(result.rowCount){waiting=true;break;}await delay(5);
     }
     assert.equal(waiting,true,'The actual native writer must be observed waiting on its catalog lock.');
     if(invalidation==='role')await client.query('DELETE FROM admin_role_assignments WHERE role_assignment_id=$1',[rootRole.roleAssignmentId]);
     else f.clock.value=Date.parse(before.sessions.find(session=>session.token===f.root.token).expiresAt)+1;
     await client.query('COMMIT');committed=true;
     const result=await pending;assert.ok(result.error);assert.equal(result.error.statusCode,403);
     if(result.error.errorCode!==(invalidation==='role'?'original_super_admin_required':'original_admin_session_invalid')){
      const current=await snapshot(f);
      assert.fail(JSON.stringify({operation,invalidation,errorCode:result.error.errorCode,now:f.now(),originalClock:clock,
       user:current.user?{status:current.user.status,validFrom:current.user.validFrom,validTo:current.user.validTo,validForMinutes:current.user.validForMinutes}:null,
       sessions:current.sessions.map(s=>({expiresAt:s.expiresAt,revokedAt:s.revokedAt,matchesActorToken:s.token===f.root.token})),roles:current.roles.map(r=>r.role)}));
     }
    }finally{
     if(!committed)await client.query('ROLLBACK');if(pending)await pending;
     client.release();f.clock.value=clock;await f.repository.saveAdminRoleAssignment(rootRole);
     // Services deliberately keep a monotonic security clock. A fixture that
     // returns to its earlier wall time must also reopen its service instance.
     if(invalidation==='expiry')await f.reopen();
    }
    assert.deepEqual(await snapshot(f),before,'A denied post-wait writer must not change a parent, name, number or counter.');
   }
  }finally{await pool.end();}
 });
 await t.test('native IDs above JavaScript precision remain exact for creation and rename',async()=>{
  await f.repository.mutateOriginalAdminSession({token:f.root.token,at:f.now()},()=>({workspaceCounter:'9007199254740992'}));
  const id=await f.services.originalAdminDirectory.createWorkspace({token:f.root.token,body:{name:'Owned exact native workspace'}});assert.equal(id,'9007199254740993');
  await f.services.originalAdminDirectory.renameWorkspace({token:f.root.token,reference:id,body:{name:'Owned renamed exact native workspace'}});
  assert.match(await f.services.originalAdminDirectory.listWorkspaces({token:f.root.token}),/"id":9007199254740993,"name":"Owned renamed exact native workspace"/);
 });
});

test(`real ${process.env.FIRST_SLICE_STORE==='postgres'?'PostgreSQL':'SQLite'} native workspace directory HTTP preserves Source bodies and middleware`,{timeout:180000},async t=>{
 const f=await fixture(process.env.FIRST_SLICE_STORE==='postgres'?'postgres':'sqlite',t),previous=new Map();
 const env={FIRST_SLICE_STORE:f.kind,FIRST_SLICE_SQLITE_FILE:f.file,...f.url?{FIRST_SLICE_POSTGRES_URL:f.url.toString()}:{},FIRST_SLICE_BOOTSTRAP_DEMO:'false',FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',FIRST_SLICE_PROOF_OF_WORK_SCOPES:''};
 for(const[key,value]of Object.entries(env)){previous.set(key,process.env[key]);process.env[key]=value;}
 let server;try{server=await createProductionApiServer();}finally{for(const[key,value]of previous)if(value===undefined)delete process.env[key];else process.env[key]=value;}
 await new Promise(done=>server.listen(0,'127.0.0.1',done));f.beforeShutdown(async()=>{server.closeAllConnections();await new Promise(done=>server.close(done));});
 const base='http://127.0.0.1:'+server.address().port;
 const request=async(method,path,body,raw,token=f.root.token)=>{
  const payload=raw??(body===undefined?undefined:JSON.stringify(body));
  const r=await fetch(base+path,{method,headers:{...(token===null?{}:{AuthToken:token}),...(payload===undefined?{}:{'content-type':'application/json'})},
   ...(payload===undefined?{}:{body:payload}),signal:AbortSignal.timeout(15000)});return{status:r.status,text:await r.text(),headers:r.headers};
 };
 const regular=await f.services.originalAdminSession.login({name:f.a.username,password:f.password});
 for(const path of ['/workspace','/workspace/9223372036854775807']){
  const method=path==='/workspace'?'PUT':'PATCH';
  assert.equal((await request(method,path,undefined,'{',null)).status,401);
  assert.equal((await request(method,path,undefined,'{',regular.token)).status,403);
  assert.equal((await request(method,path,undefined,'{')).status,500);
 }
 const run=await replay(request);assert.ok(run.count>180);
 for(const row of source.rows.filter(row=>row.label.startsWith('method-')&&row.path!=='/workspaces')){
  const actual=await request(row.method,row.path,row.requestBody);assert.equal(actual.status,row.status);assert.equal(actual.text,row.rawText);
  // Slim's captured405 omits Allow. Preserve Rewrite's established explicit
  // method declaration while matching the actual Source status and body.
  assert.equal(row.allow,null);assert.equal(actual.headers.get('allow'),row.path==='/workspace'?'PUT':'GET, PATCH');
 }
 await f.repository.mutateOriginalAdminSession({token:f.root.token,at:f.now()},()=>({workspaceCounter:'9007199254740992'}));
 const created=await request('PUT','/workspace',{name:'Owned HTTP high native ID'});assert.equal(created.status,201);assert.equal(created.text,'9007199254740993');
 const renamed=await request('PATCH','/workspace/'+created.text,{name:'Owned HTTP renamed high native ID'});assert.equal(renamed.status,200);assert.equal(renamed.text,'');
 assert.match((await request('GET','/workspaces')).text,/"id":9007199254740993,"name":"Owned HTTP renamed high native ID"/);
 const rootUser=await f.repository.getAdminUserByUsername('super');await f.repository.saveAdminUser({...rootUser,passwordChangeRequired:true});
 assert.equal((await request('PUT','/workspace',{name:'Owned Root password flag'})).status,201,'Source Root metadata writes retain the established password-flag exemption.');
});
