import assert from 'node:assert/strict';
import test from 'node:test';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,rename,copyFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';

async function fixture(){
 const directory=await mkdtemp(join(tmpdir(),'api-sqlite-readiness-')),file=join(directory,'owned.sqlite');
 const api=new URL('../apps/api/dist/apps/api/src/index.js',import.meta.url).href;
 const child=spawn(process.execPath,['--input-type=module','-e',`
  import {DatabaseSync} from 'node:sqlite';
  let live,closes=0;const exec=DatabaseSync.prototype.exec,close=DatabaseSync.prototype.close;
  DatabaseSync.prototype.exec=function(sql){live??=this;return exec.call(this,sql);};
  DatabaseSync.prototype.close=function(){closes++;return close.call(this);};
  const {createProductionApiServer}=await import(${JSON.stringify(api)});
  const server=await createProductionApiServer();
  server.listen(0,'127.0.0.1',()=>process.send({id:0,port:server.address().port}));
  process.on('message',({id,action})=>{
   if(action==='readonly'||action==='writable'){live.exec('PRAGMA query_only = '+(action==='readonly'?'ON':'OFF'));process.send({id});}
   if(action==='close')server.close(()=>setImmediate(()=>{
    let open=true;try{live.prepare('SELECT 1').get();}catch{open=false;}
    process.send({id,closes,open},()=>process.exit(0));
   }));
  });
 `],{env:{...process.env,FIRST_SLICE_STORE:'sqlite',FIRST_SLICE_SQLITE_FILE:file,FIRST_SLICE_BOOTSTRAP_DEMO:'true',
   FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',FIRST_SLICE_PROOF_OF_WORK_SCOPES:'',FIRST_SLICE_XML_SCHEMA_PROFILE:'legacy-compatibility'},stdio:['ignore','pipe','pipe','ipc']});
 let output='',nextId=0;const pending=new Map();child.stdout.on('data',c=>output+=c);child.stderr.on('data',c=>output+=c);
 child.on('message',message=>{pending.get(message.id)?.(message);pending.delete(message.id);});
 const closed=new Promise(resolve=>child.once('close',resolve));
 const response=id=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{pending.delete(id);reject(Error('Owned API IPC timed out: '+output));},20_000);
  pending.set(id,message=>{clearTimeout(timer);resolve(message);});
 });
 const request=action=>{const id=++nextId,promise=response(id);child.send({id,action});return promise;};
 let stopped=false;
 const stop=async()=>{
  if(stopped)return;stopped=true;
  try{const result=child.exitCode===null?await request('close'):undefined;await closed;return result;}
  finally{if(child.exitCode===null)child.kill('SIGTERM');await closed;await rm(directory,{recursive:true,force:true});}
 };
 try{
  const {port}=await response(0),base='http://127.0.0.1:'+port;
  assert.equal((await fetch(base+'/readyz')).status,200,output);
  return {file,base,request,stop,output:()=>output};
 }catch(error){await stop();throw error;}
}

test('the actual SQLite API rejects a read-only live writer and becomes ready after recovery',async()=>{
 const f=await fixture();
 try{
  await f.request('readonly');assert.equal((await fetch(f.base+'/healthz')).status,200);
  const denied=await fetch(f.base+'/readyz');assert.equal(denied.status,503);assert.equal((await denied.json()).error,'storage_not_ready');
  const failed=await fetch(f.base+'/api/v1/admin/auth/sign-in',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'demo-admin',password:'demo-admin-password'})});
  assert.equal(failed.status,500);const failureBody=await failed.json();assert.equal(failureBody.error,'internal_server_error');assert.equal(failureBody.sqliteCode,undefined);
  const readEvents=()=>f.output().split('\n').flatMap(line=>{try{return [JSON.parse(line)];}catch{return [];}});
  const deadline=Date.now()+5_000;
  while(Date.now()<deadline&&!readEvents().some(event=>event.event==='http_request_failed'))await delay(10);
  const events=readEvents();
  for(const type of ['storage_readiness_failed','http_request_failed']){
   const event=events.find(event=>event.event===type);assert.ok(event,type);assert.equal(event.error.code,'ERR_SQLITE_ERROR');assert.ok(Number.isSafeInteger(event.error.sqliteCode));assert.match(event.error.sqliteDescription,/readonly database/);
   assert.equal(JSON.stringify(event).includes('demo-admin-password'),false);
  }
  await f.request('writable');assert.equal((await fetch(f.base+'/readyz')).status,200);
 }finally{await f.stop();}
});

test('the actual SQLite API cannot declare a replacement path ready for its former connection',async()=>{
 const f=await fixture(),backup=f.file+'.previous';
 try{
  const before=await readFile(f.file);await rename(f.file,backup);await copyFile(backup,f.file);
  const denied=await fetch(f.base+'/readyz');assert.equal(denied.status,503);assert.equal((await denied.json()).error,'storage_not_ready');
  assert.deepEqual(await readFile(backup),before);assert.deepEqual(await readFile(f.file),before);
 }finally{await f.stop();}
});

test('the actual API shutdown releases its live SQLite connection exactly once',async()=>{
 const f=await fixture();
 const result=await f.stop();assert.equal(result.closes,1);assert.equal(result.open,false);
});
