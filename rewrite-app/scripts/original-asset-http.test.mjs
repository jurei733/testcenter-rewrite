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
const fixture=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-application-asset-http/',import.meta.url);
const sha=v=>createHash('sha256').update(v).digest('hex');
const manifest=JSON.parse(await readFile(new URL('manifest.json',fixture))),source=JSON.parse(await readFile(new URL('observations.json',fixture)));
for(const [name,hash]of Object.entries(manifest.files))assert.equal(sha(await readFile(new URL(name,fixture))),hash);
assert.equal(source.sourceFilesVerifiedBeforeAndAfter,137);assert.equal(source.vendor.allInstalledVersionsAndSourceReferencesMatchPinnedLock,true);assert.equal(source.sqlSeedsOrDaoStubs,false);assert.equal(source.rows.length,51);
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=','base64');
function normalize(){const names=new Map(),times=new Map();return function visit(value,key='',parentId=''){
 if(Array.isArray(value))return value.map(x=>visit(x));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,visit(v,k,value.id??parentId)]));
 if(typeof value==='string'){
  if(key==='createdAt'){let dates=times.get(parentId);if(!dates){dates=new Map();times.set(parentId,dates);}if(!dates.has(value))dates.set(value,'[created-at-'+parentId+'-'+dates.size+']');return dates.get(value);}
  return value.replace(/asset_[a-f0-9]{32}\.(png|jpe?g|webp)/g,name=>{if(!names.has(name))names.set(name,'[stored-file-'+names.size+']');return names.get(name);});
 }return value;
};}
const kinds=['memory','file','sqlite',...(process.env.FIRST_SLICE_STORE==='postgres'?['postgres']:[])];
for(const kind of kinds)test(kind+': native asset HTTP follows actual Source registry and assignment lifecycle',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'owned-native-assets-')),schema='owned_native_assets_'+randomUUID().replaceAll('-','');let server,pool,token;
 const pg=kind==='postgres'?new URL(process.env.FIRST_SLICE_POSTGRES_URL):null;pg?.searchParams.set('options','-c search_path='+schema);
 const sourceNormalize=normalize(),rewriteNormalize=normalize(),seen=new Set();
 const start=async()=>{
  const module=pathToFileURL(resolve('apps/api/dist/apps/api/src/index.js')).href;
  server=spawn(process.execPath,['--input-type=module','-e',`import{createProductionApiServer}from ${JSON.stringify(module)};const server=await createProductionApiServer();server.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));process.once('SIGTERM',()=>server.close(()=>process.exit(0)));`],{
   stdio:['ignore','ignore','inherit','ipc'],env:{...process.env,FIRST_SLICE_STORE:kind,FIRST_SLICE_FILE:join(dir,'owned.json'),FIRST_SLICE_SQLITE_FILE:join(dir,'owned.sqlite'),...(pg?{FIRST_SLICE_POSTGRES_URL:pg.toString()}:{}),FIRST_SLICE_BOOTSTRAP_DEMO:'true',FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',FIRST_SLICE_PROOF_OF_WORK_SCOPES:'',FIRST_SLICE_XML_SCHEMA_PROFILE:'legacy-compatibility'}});
  const port=await raceWithSmokeDeadline(new Promise((done,reject)=>{server.once('message',x=>done(x.port));server.once('error',reject);server.once('exit',()=>reject(Error('Owned native asset API exited during startup.')));}),20000,()=>{throw Error('Owned native asset API startup timed out.');});return 'http://127.0.0.1:'+port;
 };
 const close=async()=>{if(!server)return;const current=server;server=undefined;const closed=new Promise(done=>current.once('close',done));current.kill('SIGTERM');await raceWithSmokeDeadline(closed,10000,()=>{current.kill('SIGKILL');throw Error('Owned native asset API shutdown timed out.');});};
 try{
  if(pg){pool=new Pool({connectionString:process.env.FIRST_SLICE_POSTGRES_URL});await pool.query('CREATE SCHEMA "'+schema+'"');}
  let base=await start();
  const request=async(label,method,path,{body,credential=token,skipValue=false}={})=>{
   const response=await fetch(base+path,{method,headers:{...(credential==null?{}:{AuthToken:credential}),...(body===undefined||body instanceof FormData?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:body instanceof FormData?body:JSON.stringify(body)})});
   const text=await response.text();let value;try{value=JSON.parse(text);}catch{value=text;}
   const expected=source.rows.find(row=>row.label===label);assert.ok(expected,'Missing actual Source operation '+label);seen.add(label);
   assert.equal(response.status,expected.status,label+': '+text);assert.equal(response.headers.get('content-type'),expected.contentType,label+' content-type');
   if(expected.errorId){assert.ok(response.headers.get('error-id'));assert.equal(response.headers.get('test-mode'),'NO');}
   if(!skipValue)assert.deepEqual(rewriteNormalize(value),sourceNormalize(expected.value),label);
   return value;
  };
  const upload=async(label,name,bytes=png,field='file')=>{const body=new FormData();body.append(field,new Blob([bytes],{type:'text/plain'}),name);return request(label,'POST','/assets',{body});};
  token=(await request('admin-login','PUT','/session/admin',{body:{name:'demo-admin',password:'demo-admin-password'},credential:null,skipValue:true})).token;
  await request('catalog-before','GET','/assets');await request('catalog-no-token','GET','/assets',{credential:null});await request('catalog-empty-token','GET','/assets',{credential:''});
  const invalid=await request('catalog-invalid-token','GET','/assets',{credential:'owned-invalid-token',skipValue:true});assert.ok(!String(invalid).includes('owned-invalid-token'),'Never reproduce Source bearer reflection');
  await request('assignments-public-empty','GET','/asset-assignments',{credential:null});await request('assignments-empty-header','GET','/asset-assignments',{credential:''});
  const a=await upload('upload-a-unicode','Owned-R95-Ä Ω.png'),b=await upload('upload-b-spoofed-extension','owned-r95-b.webp');
  await request('catalog-populated','GET','/assets');
  await request('set-global-and-custom-slot','POST','/asset-assignments',{body:{assignments:[{slotName:'logo',assetID:a.id,scope:'user',scopeID:'ignored'},{slotName:'future-slot-Ω',assetID:b.id,scope:'group',scopeID:'ignored'}]}});
  await request('assignments-public-global','GET','/asset-assignments',{credential:null});
  const replacement=await upload('upload-a-replacement','Owned-R95-Ä Ω.png',Buffer.concat([png,Buffer.from('replacement')]));
  const old=await fetch(base+'/'+a.url);assert.equal(old.status,404,'Old physical URL must retire on replacement');
  const bytes=await fetch(base+'/'+replacement.url);assert.equal(bytes.status,200);assert.deepEqual(Buffer.from(await bytes.arrayBuffer()),Buffer.concat([png,Buffer.from('replacement')]));
  await request('catalog-after-replacement','GET','/assets');await request('assignments-follow-replacement','GET','/asset-assignments',{credential:null});
  await upload('upload-a-case-variant','owned-r95-ä ω.PNG');await upload('upload-leading-space','  owned-r95-leading.png');await upload('upload-trailing-space','owned-r95-trailing.png  ');
  await request('upload-no-file','POST','/assets',{body:{}});await upload('upload-wrong-field','owned-r95-wrong.png',png,'other');
  const over=Buffer.concat([png,Buffer.alloc(2*1024*1024+1-png.length)]);await upload('upload-two-mib-plus-one','owned-r95-big.png',over);
  const edge=Buffer.concat([png,Buffer.alloc(2*1024*1024-png.length)]);await upload('upload-two-mib-exact','owned-r95-edge.png',edge);
  await request('set-subset-does-not-remove-custom-slot','POST','/asset-assignments',{body:{assignments:[{slotName:'logo',assetID:null}]}});
  await request('assignment-null-deletes-only-provided-slot','GET','/asset-assignments',{credential:null});
  await request('set-empty-assignment-array','POST','/asset-assignments',{body:{assignments:[]}});await request('set-missing-assignment-array','POST','/asset-assignments',{body:{}});
  await request('before-invalid-assignment','GET','/asset-assignments',{credential:null});await request('set-unknown-asset','POST','/asset-assignments',{body:{assignments:[{slotName:'logo',assetID:2147483647}]}});await request('after-invalid-assignment','GET','/asset-assignments',{credential:null});
  const uid=await request('create-nonroot','PUT','/user',{body:{n:'owned-r95-nonroot',p:'owned-r95-nonroot-secret'},skipValue:true});
  const normal=await request('nonroot-login','PUT','/session/admin',{body:{name:'owned-r95-nonroot',password:'owned-r95-nonroot-secret'},credential:null,skipValue:true});
  for(const method of ['GET','POST','DELETE'])await request('nonroot-'+method,method,method==='DELETE'?'/assets/'+b.id:'/assets',{credential:normal.token,...method==='POST'?{body:{}}:{}});
  await request('nonroot-set-assignments','POST','/asset-assignments',{credential:normal.token,body:{assignments:[]}});await request('nonroot-get-global','GET','/asset-assignments',{credential:normal.token});
  await request('remove-nonroot','DELETE','/users',{body:{u:[Number(uid)],p:'demo-admin-password'},skipValue:true});
  for(const reference of ['missing','2147483647','0','-1','1x'])await request('delete-reference-'+reference,'DELETE','/assets/'+reference);
  for(const id of [1,2,3,4,5])await request('cleanup-'+id,'DELETE','/assets/'+id);
  await request('catalog-after-cleanup','GET','/assets');await request('assignments-cascade-after-cleanup','GET','/asset-assignments',{credential:null});
  const reuploaded=await upload('reupload-after-delete','owned-r95-b.webp');await request('cleanup-reupload','DELETE','/assets/'+reuploaded.id);
  assert.equal(seen.size,51,'Exercise every recorded Source exchange');
  await t.test('old numeric capability cannot bind a reupload with the same original filename',async()=>{
   const create=async()=>{const body=new FormData();body.append('file',new Blob([png]),'owned-aba.png');const r=await fetch(base+'/assets',{method:'POST',headers:{AuthToken:token},body});assert.equal(r.status,200);return r.json();};
   const first=await create();assert.equal((await fetch(base+'/assets/'+first.id,{method:'DELETE',headers:{AuthToken:token}})).status,200);const second=await create();assert.ok(second.id>first.id);
   const stale=await fetch(base+'/asset-assignments',{method:'POST',headers:{AuthToken:token,'content-type':'application/json'},body:JSON.stringify({assignments:[{slotName:'logo',assetID:first.id}]})});assert.equal(stale.status,500);
   assert.deepEqual(await(await fetch(base+'/asset-assignments')).json(),[]);
   if(kind!=='memory'){
    await close();base=await start();
    const r=await fetch(base+'/session/admin',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({name:'demo-admin',password:'demo-admin-password'})});assert.equal(r.status,200);token=(await r.json()).token;
    const list=await(await fetch(base+'/assets',{headers:{AuthToken:token}})).json();assert.equal(list.length,1);assert.equal(list[0].id,second.id);assert.equal(list[0].storedName,second.storedName);
    assert.deepEqual(Buffer.from(await(await fetch(base+'/'+second.url)).arrayBuffer()),png);
   }
  });
 }finally{await close();if(pool){await pool.query('DROP SCHEMA "'+schema+'" CASCADE');await pool.end();}await rm(dir,{recursive:true,force:true});}
});
