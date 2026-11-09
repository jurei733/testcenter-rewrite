import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import test from 'node:test';
import {Pool} from 'pg';
import {raceWithSmokeDeadline} from './smoke-deadline.mjs';
const fixture=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-application-asset-scope-http/',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(await readFile(new URL('manifest.json',fixture))),source=JSON.parse(await readFile(new URL('observations.json',fixture)));
for(const [name,hash]of Object.entries(manifest.files))assert.equal(sha(await readFile(new URL(name,fixture))),hash);
assert.equal(source.sourceFilesVerifiedBeforeAndAfter,137);assert.equal(source.rows.length,43);assert.equal(source.sourceUnsafePartialAssignmentWriteConfirmed,true);
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=','base64');
function normalizer(){const names=new Map();return value=>JSON.parse(JSON.stringify(value).replace(/asset_[a-f0-9]{32}\.(?:png|jpe?g|webp)/g,name=>{if(!names.has(name))names.set(name,'[stored-name-'+names.size+']');return names.get(name);}));}
const kinds=['memory','file','sqlite',...(process.env.FIRST_SLICE_STORE==='postgres'?['postgres']:[])];
for(const kind of kinds)test(kind+': native asset priority and deletion fallback match actual protected Source',async()=>{
 const actualNormalize=normalizer(),sourceNormalize=normalizer();
 const dir=await mkdtemp(join(tmpdir(),'owned-native-asset-scope-')),schema='owned_asset_scope_'+randomUUID().replaceAll('-','');let server,pool,token;
 const pg=kind==='postgres'?new URL(process.env.FIRST_SLICE_POSTGRES_URL):null;pg?.searchParams.set('options','-c search_path='+schema);
 const start=async()=>{
  const module=pathToFileURL(resolve('apps/api/dist/apps/api/src/index.js')).href;
  server=spawn(process.execPath,['--input-type=module','-e',`import{createProductionApiServer}from ${JSON.stringify(module)};const server=await createProductionApiServer();server.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));process.once('SIGTERM',()=>server.close(()=>process.exit(0)));`],{
   stdio:['ignore','ignore','inherit','ipc'],env:{...process.env,FIRST_SLICE_STORE:kind,FIRST_SLICE_FILE:join(dir,'owned.json'),FIRST_SLICE_SQLITE_FILE:join(dir,'owned.sqlite'),...(pg?{FIRST_SLICE_POSTGRES_URL:pg.toString()}:{}),FIRST_SLICE_BOOTSTRAP_DEMO:'true',FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',FIRST_SLICE_PROOF_OF_WORK_SCOPES:'',FIRST_SLICE_XML_SCHEMA_PROFILE:'original-19'}});
  const port=await raceWithSmokeDeadline(new Promise((done,reject)=>{server.once('message',x=>done(x.port));server.once('error',reject);server.once('exit',()=>reject(Error('Owned scoped API exited.')));}),20000,()=>{throw Error('Owned scoped API startup timed out.');});return 'http://127.0.0.1:'+port;
 };
 const close=async()=>{if(!server)return;const child=server;server=undefined;const closed=new Promise(done=>child.once('close',done));child.kill('SIGTERM');await raceWithSmokeDeadline(closed,10000,()=>{child.kill('SIGKILL');throw Error('Owned scoped API shutdown timed out.');});};
 try{
  if(pg){pool=new Pool({connectionString:process.env.FIRST_SLICE_POSTGRES_URL});await pool.query('CREATE SCHEMA "'+schema+'"');}
  let base=await start();
  const http=async(method,path,body,credential=token,expected=200,native=true)=>{
   const r=await fetch(base+path,{method,headers:{...(credential?native?{AuthToken:credential}:{Authorization:'Bearer '+credential}:{}),...(body===undefined||body instanceof FormData?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:body instanceof FormData?body:JSON.stringify(body)})});const text=await r.text();let value;try{value=JSON.parse(text);}catch{value=text;}assert.equal(r.status,expected,method+' '+path+': '+text);return value;
  };
  const compare=async(label,credential)=>{const actual=await http('GET','/asset-assignments',undefined,credential);const expected=source.rows.find(x=>x.label===label);assert.ok(expected,label);assert.deepEqual(actualNormalize(actual),sourceNormalize(expected.value),label);return actual;};
  token=(await http('PUT','/session/admin',{name:'demo-admin',password:'demo-admin-password'},null)).token;
  const assets=[];
  for(const name of ['global','group','user']){
   const body=new FormData();body.append('file',new Blob([png]),'owned-r95-scope-'+name+'.png');const asset=await http('POST','/assets',body);
   const expected=source.rows.find(x=>x.label==='asset-'+name);assert.deepEqual(actualNormalize(asset),sourceNormalize(expected.value));assets.push(asset);
  }
  await http('POST','/asset-assignments',{assignments:[{slotName:'logo',assetID:assets[0].id},{slotName:'loginIllustration',assetID:assets[0].id},{slotName:'future-slot-Ω',assetID:assets[0].id}]});
  const global=await compare('public-global',null);
  await http('POST','/api/v1/tenants/demo-tenant/workspaces',{workspaceKey:'owned-asset-peer',displayName:'Owned asset peer'},token,201,false);
  const xml=(root,body)=>`<${root} xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/${root==='Unit'?'unit-xml/17.6':root==='Booklet'?'testcenter-booklet-xml/18.0':'testcenter-testtaker-xml/18.0'}">${body}</${root}>`;
  for(const [index,workspace]of ['demo-workspace','owned-asset-peer'].entries()){
   const prefix='/api/v1/tenants/demo-tenant/workspaces/'+workspace;
   const upload=(fileName,sourceDocument,mediaType='application/xml')=>http('POST',prefix+'/files',{fileName,sourceDocument,mediaType},token,201,false);
   await upload('owned-asset-player-1.0.html','<html><script type="application/ld+json">'+JSON.stringify({$schema:'https://raw.githubusercontent.com/verona-interfaces/metadata/master/verona-module-metadata.json',id:'owned-asset-player',version:'1.0.0',specVersion:'6.0',metadataVersion:'2.0',type:'player',name:[{lang:'de',value:'Owned asset Player'}]})+'</script></html>','text/html');
   await upload('unit.xml',xml('Unit','<Metadata><Id>R95.UNIT</Id><Label>Owned</Label></Metadata><Definition player="owned-asset-player-1.0">Owned</Definition>'));
   await upload('booklet.xml',xml('Booklet','<Metadata><Id>R95.BOOKLET</Id><Label>Owned</Label></Metadata><Units><Unit id="R95.UNIT" label="Owned"/></Units>'));
   const assignment=(slot,asset)=>'<Asset slot="'+slot+'">'+asset.originalName+'</Asset>';
   const group=index===0?'<AssetAssignments>'+assignment('logo',assets[1])+'</AssetAssignments>':'';
   const user=index===0?'<AssetAssignments>'+assignment('logo',assets[2])+assignment('loadingProgress',assets[1])+'</AssetAssignments>':'';
   const login=(name,userAssets='')=>'<Login name="'+name+'" pw="owned-r95-asset-password" mode="run-hot-return"><Booklet codes="c1">R95.BOOKLET</Booklet>'+userAssets+'</Login>';
   const roster=xml('Testtakers','<Metadata/><Group id="R95.ASSET.GROUP.'+index+'" label="Owned asset group">'+group+login('owned-r95-asset-'+index,user)+(index===0?login('owned-r95-group-only'):'')+'</Group>');
   await upload('people.xml',roster);await http('POST',prefix+'/participant-roster',{rosterText:roster},token,201,false);
  }
  const userLogin=await http('PUT','/session/login',{name:'owned-r95-asset-0',password:'owned-r95-asset-password'},null);assert.ok(userLogin.flags.includes('codeRequired'));
  const user=await compare('login-token-user-scope',userLogin.token);assert.notEqual(user.logo.url,global.logo.url);
  let person=await http('PUT','/session/person',{code:'c1'},userLogin.token);await compare('person-token-user-scope',person.token);
  const groupLogin=await http('PUT','/session/login',{name:'owned-r95-group-only',password:'owned-r95-asset-password'},null);await compare('login-token-group-scope',groupLogin.token);
  const foreign=await http('PUT','/session/login',{name:'owned-r95-asset-1',password:'owned-r95-asset-password'},null);await compare('different-group-other-workspace',foreign.token);await compare('admin-sees-global-only',token);
  await http('DELETE','/assets/'+assets[2].id);const groupFallback=await compare('user-deletion-falls-back-to-group',person.token);assert.equal(groupFallback.logo.assetID,assets[1].id);
  // A process restart must retain the hidden group layer and its exact URL.
  if(kind!=='memory'){
   await close();base=await start();token=(await http('PUT','/session/admin',{name:'demo-admin',password:'demo-admin-password'},null)).token;
   person=await http('GET','/session',undefined,person.token);await compare('user-deletion-falls-back-to-group',person.token);
  }
  await http('DELETE','/assets/'+assets[1].id);await compare('group-deletion-falls-back-to-global',person.token);
  await http('POST','/asset-assignments',{assignments:[{slotName:'logo',assetID:assets[0].id},{slotName:'logo',assetID:null}]});await compare('upsert-wins-even-after-later-null',null);
  const before=await http('GET','/asset-assignments',undefined,null);
  await http('POST','/asset-assignments',{assignments:[{slotName:'logo',assetID:null},{slotName:'other',assetID:2147483647}]},token,500);
  assert.deepEqual(await http('GET','/asset-assignments',undefined,null),before,'Do not reproduce Source partial deletion on failed batch');
  await http('DELETE','/assets/'+assets[0].id);await compare('public-empty-after-cascade',null);
 }finally{await close();if(pool){await pool.query('DROP SCHEMA "'+schema+'" CASCADE');await pool.end();}await rm(dir,{recursive:true,force:true});}
});
