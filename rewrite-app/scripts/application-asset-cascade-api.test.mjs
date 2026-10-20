import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Pool} from 'pg';
import test from 'node:test';
import {raceWithSmokeDeadline} from './smoke-deadline.mjs';
const kinds=['memory','file','sqlite',...(process.env.FIRST_SLICE_STORE==='postgres'?['postgres']:[])];
for(const kind of kinds)test(kind+': protected HTTP asset cascade preserves unrelated data and old DELETE policy',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'asset-cascade-api-')),schema='owned_asset_api_'+randomUUID().replaceAll('-','');let pool,server;
 const pg=kind==='postgres'?new URL(process.env.FIRST_SLICE_POSTGRES_URL):null;pg?.searchParams.set('options','-c search_path='+schema);
 try{
  if(pg){pool=new Pool({connectionString:process.env.FIRST_SLICE_POSTGRES_URL});await pool.query('CREATE SCHEMA "'+schema+'"');}
  const module=pathToFileURL(resolve('apps/api/dist/apps/api/src/index.js')).href;
  server=spawn(process.execPath,['--input-type=module','-e',`import{createProductionApiServer}from ${JSON.stringify(module)};const server=await createProductionApiServer();server.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));process.once('SIGTERM',()=>server.close(()=>process.exit(0)));`],{
   stdio:['ignore','ignore','inherit','ipc'],env:{...process.env,PORT:'4310',FIRST_SLICE_STORE:kind,FIRST_SLICE_FILE:join(folder,'owned.json'),FIRST_SLICE_SQLITE_FILE:join(folder,'owned.sqlite'),...(pg?{FIRST_SLICE_POSTGRES_URL:pg.toString()}:{}),FIRST_SLICE_BOOTSTRAP_DEMO:'true',FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',FIRST_SLICE_PROOF_OF_WORK_SCOPES:'',FIRST_SLICE_XML_SCHEMA_PROFILE:'legacy-compatibility'}});
  const port=await raceWithSmokeDeadline(new Promise((done,reject)=>{server.once('message',message=>done(message.port));server.once('error',reject);server.once('exit',()=>reject(Error('Owned API exited during startup.')));}),20000,()=>{throw Error('Owned API startup timed out.');});
  const base='http://127.0.0.1:'+port;let token;
  const api=async(path,body,method=body===undefined?'GET':'POST',expected=200,credential=token)=>{
   const response=await fetch(base+path,{method,headers:{...(credential?{authorization:'Bearer '+credential}:{}),...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
   const value=await response.json();assert.equal(response.status,expected,method+' '+path+': '+JSON.stringify(value));return value;
  };
  token=(await api('/api/v1/admin/auth/sign-in',{username:'demo-admin',password:'demo-admin-password'})).sessionToken;
  const image={originalName:'owned-cascade.png',mediaType:'image/png',dataBase64:Buffer.from([137,80,78,71,13,10,26,10]).toString('base64')};
  const asset=(await api('/api/v1/admin/application-assets',image,'POST',201)).applicationAsset;
  const other=(await api('/api/v1/admin/application-assets',{...image,originalName:'owned-keep.png'},'POST',201)).applicationAsset;
  await api('/api/v1/admin/application-settings',{appTitle:'Owned cascade title',globalWarningText:'Retain this warning',customTexts:{login_subtitle:'  Authored Ω  '},assetAssignments:{logo:asset.originalName,loginIllustration:other.originalName}},'PATCH');
  const scope='/api/v1/tenants/demo-tenant/workspaces/demo-workspace',rosterText='<Testtakers><Group id="owned-group"><AssetAssignments><Asset slot="starterCompanion">owned-cascade.png</Asset><Asset slot="logo">owned-keep.png</Asset></AssetAssignments><Login name="owned-login" pw="Owned-participant-password-9!" mode="run-hot-return"><Booklet>owned-booklet</Booklet></Login><Login name="owned-monitor" pw="Owned-monitor-password-9!" mode="monitor-group"/></Group></Testtakers>';
  await api(scope+'/participant-roster',{rosterText},'POST',201);
  const beforeSettings=(await api('/api/v1/system/application-settings')).applicationSettings,beforeRoster=await api(scope+'/participant-roster');
  const path='/api/v1/admin/application-assets?applicationAssetId='+encodeURIComponent(asset.applicationAssetId);
  await api(path,{cascadeAssignments:true},'DELETE',401,null);
  await api('/api/v1/admin/users',{username:'owned-cascade-tenant',password:'Owned-tenant-password-9!',roleAssignments:[{role:'tenant_admin',tenantKey:'demo-tenant'}]},'POST',201);
  let delegated=(await api('/api/v1/admin/auth/sign-in',{username:'owned-cascade-tenant',password:'Owned-tenant-password-9!'})).sessionToken;
  await api('/api/v1/admin/auth/password',{password:'Changed-tenant-password-9!'},'POST',200,delegated);
  delegated=(await api('/api/v1/admin/auth/sign-in',{username:'owned-cascade-tenant',password:'Changed-tenant-password-9!'})).sessionToken;
  assert.equal((await api(path,{cascadeAssignments:true},'DELETE',403,delegated)).error,'admin_role_required');
  assert.equal((await api(path,{cascadeAssignments:'yes'},'DELETE',400)).error,'application_asset_deletion_policy_invalid');
  assert.equal((await api(path,undefined,'DELETE',409)).error,'application_asset_in_use');
  assert.deepEqual((await api('/api/v1/system/application-settings')).applicationSettings,beforeSettings);assert.deepEqual(await api(scope+'/participant-roster'),beforeRoster);
  await api(path,{cascadeAssignments:true},'DELETE');
  const after=(await api('/api/v1/system/application-settings')).applicationSettings;
  assert.deepEqual(after.assetAssignments,{loginIllustration:other.originalName});assert.equal(after.appTitle,beforeSettings.appTitle);assert.equal(after.globalWarningText,beforeSettings.globalWarningText);assert.deepEqual(after.customTexts,beforeSettings.customTexts);
  const roster=await api(scope+'/participant-roster');assert.deepEqual(roster.items.find(item=>item.loginKey==='owned-login').assetAssignments,{logo:other.originalName});
  assert.deepEqual(roster.operationalLoginCandidates.find(item=>item.loginKey==='owned-monitor').assetAssignments,{logo:other.originalName});
  assert.equal((await fetch(base+'/api/v1/system/application-assets?applicationAssetId='+encodeURIComponent(asset.applicationAssetId))).status,404);
  const fresh=(await api('/api/v1/admin/application-assets',image,'POST',201)).applicationAsset;assert.notEqual(fresh.applicationAssetId,asset.applicationAssetId);
  assert.deepEqual((await api(scope+'/participant-roster')).items.find(item=>item.loginKey==='owned-login').assetAssignments,{logo:other.originalName});
  assert.deepEqual((await api('/api/v1/system/application-settings')).applicationSettings.assetAssignments,{loginIllustration:other.originalName});
  await api(path,{cascadeAssignments:true},'DELETE',404);
  const audit=(await api('/api/v1/admin/audit-events?eventType=application_asset_deleted&limit=100')).items;
  assert.equal(audit.length,1);assert.equal(audit[0].details.cascadeAssignments,true);assert.equal(audit[0].details.clearedRosterReferenceCount,2);
 }finally{
  if(server){const closed=new Promise(done=>server.once('close',done));server.kill('SIGTERM');await raceWithSmokeDeadline(closed,10000,()=>{server.kill('SIGKILL');throw Error('Owned API shutdown timed out.');});}
  if(pool){await pool.query('DROP SCHEMA "'+schema+'" CASCADE');await pool.end();}await rm(folder,{recursive:true,force:true});
 }
});
