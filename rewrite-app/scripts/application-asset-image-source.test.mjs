import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Pool} from 'pg';
import test from 'node:test';
import {raceWithSmokeDeadline} from './smoke-deadline.mjs';

const fixture=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-application-asset-image-http/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',fixture)));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
for(const [name,expected] of Object.entries(manifest.files))assert.equal(sha(await readFile(new URL(name,fixture))),expected,name);
const inputs=JSON.parse(await readFile(new URL('inputs.json',fixture))),source=JSON.parse(await readFile(new URL('observations.json',fixture)));
assert.equal(source.verified,true);assert.equal(source.sourceCommit,'eedae41840cbe90e5547c0211da818bdf620f5aa');
assert.equal(source.sourceFilesVerifiedBeforeAndAfter,137);assert.equal(source.baselineCatalogRestored,true);
assert.equal(source.vendor.allInstalledVersionsAndSourceReferencesMatchPinnedLock,true);
assert.equal(inputs.length,source.outcomes.length);
const png=inputs.find(row=>row.label==='png-complete');
const kinds=['memory','file','sqlite',...(process.env.FIRST_SLICE_STORE==='postgres'?['postgres']:[])];
for(const kind of kinds)test(kind+': protected bitmap uploads match actual Source header/type/extension decisions',async t=>{
 const folder=await mkdtemp(join(tmpdir(),'owned-asset-images-')),schema='owned_asset_image_'+randomUUID().replaceAll('-','');let pool,server;
 const pg=kind==='postgres'?new URL(process.env.FIRST_SLICE_POSTGRES_URL):null;pg?.searchParams.set('options','-c search_path='+schema);
 try{
  if(pg){pool=new Pool({connectionString:process.env.FIRST_SLICE_POSTGRES_URL});await pool.query('CREATE SCHEMA "'+schema+'"');}
  const module=pathToFileURL(resolve('apps/api/dist/apps/api/src/index.js')).href;
  server=spawn(process.execPath,['--input-type=module','-e',`import{createProductionApiServer}from ${JSON.stringify(module)};const server=await createProductionApiServer();server.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));process.once('SIGTERM',()=>server.close(()=>process.exit(0)));`],{
   stdio:['ignore','ignore','inherit','ipc'],env:{...process.env,FIRST_SLICE_STORE:kind,FIRST_SLICE_FILE:join(folder,'owned.json'),FIRST_SLICE_SQLITE_FILE:join(folder,'owned.sqlite'),...(pg?{FIRST_SLICE_POSTGRES_URL:pg.toString()}:{}),FIRST_SLICE_BOOTSTRAP_DEMO:'true',FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',FIRST_SLICE_PROOF_OF_WORK_SCOPES:'',FIRST_SLICE_XML_SCHEMA_PROFILE:'legacy-compatibility'}});
  const port=await raceWithSmokeDeadline(new Promise((done,reject)=>{server.once('message',m=>done(m.port));server.once('error',reject);server.once('exit',()=>reject(Error('Owned image API exited during startup.')));}),20000,()=>{throw Error('Owned image API startup timed out.');});
  const base='http://127.0.0.1:'+port;let token;
  const api=async(path,body,method=body===undefined?'GET':'POST',status=200)=>{
   const response=await fetch(base+path,{method,headers:{...(token?{authorization:'Bearer '+token}:{}),...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
   const value=await response.json();assert.equal(response.status,status,method+' '+path+': '+JSON.stringify(value));return value;
  };
  token=(await api('/api/v1/admin/auth/sign-in',{username:'demo-admin',password:'demo-admin-password'})).sessionToken;
  const assets='/api/v1/admin/application-assets',settings='/api/v1/system/application-settings';
  const audits='/api/v1/admin/audit-events?limit=100';
  for(const input of inputs)await t.test(input.label,async()=>{
   assert.equal(sha(Buffer.from(input.base64,'base64')),input.sha256);
   const expected=source.outcomes.find(row=>row.label===input.label);assert.ok(expected);
   const before={assets:await api(assets),settings:await api(settings),audits:await api(audits)};
   const body={originalName:'owned-'+input.label+'.'+input.extension,mediaType:input.declaredMediaType,dataBase64:input.base64};
   const response=await api(assets,body,'POST',expected.accepted?201:400);
   if(expected.accepted){
    assert.equal(response.applicationAsset.mediaType,expected.probe.mimeType);
    assert.equal(response.applicationAsset.byteLength,input.bytes);
    const path='/api/v1/system/application-assets?applicationAssetId='+encodeURIComponent(response.applicationAsset.applicationAssetId);
    const downloaded=await fetch(base+path);assert.equal(downloaded.status,200);
    assert.equal(downloaded.headers.get('content-type').split(';')[0],expected.probe.mimeType);
    assert.equal(sha(Buffer.from(await downloaded.arrayBuffer())),input.sha256);
    await api(assets+'?applicationAssetId='+encodeURIComponent(response.applicationAsset.applicationAssetId),{cascadeAssignments:true},'DELETE');
   }else{
    assert.deepEqual(await api(assets),before.assets);assert.deepEqual(await api(settings),before.settings);assert.deepEqual(await api(audits),before.audits);
   }
  });
  await t.test('the exact2MiB readable image boundary remains downloadable byte-for-byte',async()=>{
   const bytes=Buffer.alloc(2*1024*1024);Buffer.from(png.base64,'base64').copy(bytes);
   const image=(await api(assets,{originalName:'owned-boundary.png',mediaType:'image/png',dataBase64:bytes.toString('base64')},'POST',201)).applicationAsset;
   const response=await fetch(base+'/api/v1/system/application-assets?applicationAssetId='+encodeURIComponent(image.applicationAssetId));
   assert.equal(response.status,200);assert.equal(sha(Buffer.from(await response.arrayBuffer())),sha(bytes));
   await api(assets+'?applicationAssetId='+encodeURIComponent(image.applicationAssetId),{cascadeAssignments:true},'DELETE');
  });
  await t.test('one byte over2MiB keeps the existing413limit without catalog, settings or audit writes',async()=>{
   const bytes=Buffer.alloc(2*1024*1024+1);Buffer.from(png.base64,'base64').copy(bytes);
   const before={assets:await api(assets),settings:await api(settings),audits:await api(audits)};
   const response=await api(assets,{originalName:'owned-over-limit.png',mediaType:'image/png',dataBase64:bytes.toString('base64')},'POST',413);
   assert.equal(response.error,'application_asset_file_too_large');
   assert.deepEqual(await api(assets),before.assets);assert.deepEqual(await api(settings),before.settings);assert.deepEqual(await api(audits),before.audits);
  });
  await t.test('invalid image replacement retains exact assigned bytes, settings and audit',async()=>{
   const body={originalName:'owned-preserved.png',mediaType:'image/png',dataBase64:png.base64};
   const image=(await api(assets,body,'POST',201)).applicationAsset;
   await api('/api/v1/admin/original-interface/application-settings',{appTitle:'Owned image preservation',assetAssignments:{logo:body.originalName}},'PATCH');
   const before={assets:await api(assets),settings:await api(settings),audits:await api(audits)};
   await api(assets,{...body,dataBase64:inputs.find(row=>row.label==='png-prefix-16').base64},'POST',400);
   assert.deepEqual(await api(assets),before.assets);assert.deepEqual(await api(settings),before.settings);assert.deepEqual(await api(audits),before.audits);
   const download=await fetch(base+'/api/v1/system/application-assets?applicationAssetId='+encodeURIComponent(image.applicationAssetId));
   assert.equal(download.status,200);assert.equal(sha(Buffer.from(await download.arrayBuffer())),png.sha256);
  });
 }finally{
  if(server){const closed=new Promise(done=>server.once('close',done));server.kill('SIGTERM');await raceWithSmokeDeadline(closed,10000,()=>{server.kill('SIGKILL');throw Error('Owned image API shutdown timed out.');});}
  if(pool){await pool.query('DROP SCHEMA "'+schema+'" CASCADE');await pool.end();}await rm(folder,{recursive:true,force:true});
 }
});
