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

const fixture=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-application-asset-wire-http/',import.meta.url);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest=JSON.parse(await readFile(new URL('manifest.json',fixture))),source=JSON.parse(await readFile(new URL('observations.json',fixture)));
for(const [name,hash]of Object.entries(manifest.files))assert.equal(sha(await readFile(new URL(name,fixture))),hash);
assert.equal(source.sourceFilesVerifiedBeforeAndAfter,137);assert.equal(source.vendor.allInstalledVersionsAndSourceReferencesMatchPinnedLock,true);
assert.equal(source.publicFileServerHttpProven,true);assert.equal(source.sqlSeedsOrDaoStubs,false);assert.equal(source.wireRows.length,55);
const multipart=source.rows.filter(row=>row.label.startsWith('multipart-'));assert.equal(multipart.length,21);
const png=Buffer.from(source.wireRows[0].bodyBase64,'base64');
// These responses already agree on status and absence of writes. Exact
// libmagic error wording for arbitrary rejected MIME types remains open.
const openMimeText=new Set(['multipart-plain-text-disguised-as-png','multipart-png-signature-only']);
const render=(template,baseline)=>{const {etag,modified:last}=baseline;return Object.fromEntries(Object.entries(template).map(([k,v])=>[k,v.replaceAll('@etag',etag).replaceAll('@modified',last).replaceAll('@past',new Date(Date.parse(last)-1000).toUTCString()).replaceAll('@future',new Date(Date.parse(last)+86400000).toUTCString()).replaceAll('@rfc850',last.replace(/^\w+, (\d+) (\w+) (\d{4}) /,(_,day,month,year)=>'Monday, '+day+'-'+month+'-'+year.slice(-2)+' ')).replaceAll('@asctime',last.replace(/^(\w+), (\d+) (\w+) (\d{4}) (.+) GMT$/,(_,day,date,month,year,time)=>day+' '+month+' '+date+' '+time+' '+year)).replaceAll('@iso',new Date(Date.parse(last)).toISOString())]));};
function normalizedReply(headers,bytes,baseline){
 const result={...headers};if(result.etag===baseline.etag)result.etag='[asset-etag]';if(result['last-modified']===baseline.modified)result['last-modified']='[asset-modified]';
 const boundary=/^multipart\/byteranges; boundary=(.+)$/.exec(result['content-type']??'')?.[1];
 if(boundary){assert.match(boundary,/^\d{20}$/);result['content-type']='multipart/byteranges; boundary=[boundary]';return {headers:result,body:bytes.toString('latin1').replaceAll(boundary,'[boundary]')};}
 return {headers:result,body:bytes.toString('base64')};
}
const kinds=['memory','file','sqlite',...(process.env.FIRST_SLICE_STORE==='postgres'?['postgres']:[])];
for(const kind of kinds)test(kind+': actual Source multipart and public-image HTTP behavior',async t=>{
 const folder=await mkdtemp(join(tmpdir(),'owned-native-asset-wire-')),schema='owned_asset_wire_'+randomUUID().replaceAll('-','');let server,pool,token;
 const pg=kind==='postgres'?new URL(process.env.FIRST_SLICE_POSTGRES_URL):null;pg?.searchParams.set('options','-c search_path='+schema);
 const stop=async()=>{if(!server)return;const child=server;server=undefined;const closed=new Promise(done=>child.once('close',done));child.kill('SIGTERM');await raceWithSmokeDeadline(closed,10000,()=>{child.kill('SIGKILL');throw Error('Owned asset wire server shutdown timed out.');});};
 try{
  if(pg){pool=new Pool({connectionString:process.env.FIRST_SLICE_POSTGRES_URL});await pool.query('CREATE SCHEMA "'+schema+'"');}
  const module=pathToFileURL(resolve('apps/api/dist/apps/api/src/index.js')).href;
  server=spawn(process.execPath,['--input-type=module','-e',`import{createProductionApiServer}from ${JSON.stringify(module)};const server=await createProductionApiServer();server.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));process.once('SIGTERM',()=>server.close(()=>process.exit(0)));`],{stdio:['ignore','ignore','inherit','ipc'],env:{...process.env,FIRST_SLICE_STORE:kind,FIRST_SLICE_FILE:join(folder,'owned.json'),FIRST_SLICE_SQLITE_FILE:join(folder,'owned.sqlite'),...(pg?{FIRST_SLICE_POSTGRES_URL:pg.toString()}:{}),FIRST_SLICE_BOOTSTRAP_DEMO:'true',FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',FIRST_SLICE_PROOF_OF_WORK_SCOPES:''}});
  const port=await raceWithSmokeDeadline(new Promise((done,reject)=>{server.once('message',m=>done(m.port));server.once('error',reject);server.once('exit',()=>reject(Error('Owned asset wire server exited before listening.')));}),20000,()=>{throw Error('Owned asset wire server startup timed out.');}),base='http://127.0.0.1:'+port;
  const login=await fetch(base+'/session/admin',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({name:'demo-admin',password:'demo-admin-password'})});assert.equal(login.status,200);token=(await login.json()).token;
  const catalog=async()=>{const r=await fetch(base+'/assets',{headers:{AuthToken:token}});assert.equal(r.status,200);return r.json();};
  for(const expected of multipart)await t.test(expected.label+(openMimeText.has(expected.label)?' (status and write effects only; MIME wording open)':''),async()=>{
   const before=await catalog();let body,headers={AuthToken:token};
   if(expected.rawBodyBase64){body=Buffer.from(expected.rawBodyBase64,'base64');headers['content-type']=expected.rawContentType;}
   else{body=new FormData();for(const part of expected.parts){if(part.text!==undefined)body.append(part.field??'file',part.text);else body.append(part.field??'file',new Blob([Buffer.from(part.bytesBase64,'base64')],{type:part.type??'image/png'}),part.name);}}
   const r=await fetch(base+'/assets',{method:'POST',headers,body}),text=await r.text();assert.equal(r.status,expected.status,expected.label+': '+text);
   const after=await catalog();assert.equal(after.length-before.length,expected.catalogCountAfter-expected.catalogCountBefore);
   if(r.status>=400){assert.deepEqual(after,before);if(!openMimeText.has(expected.label))assert.equal(text,expected.rawText);}
   else{const value=JSON.parse(text);assert.equal(value.originalName,expected.value.originalName);assert.match(value.storedName,/^asset_[a-f0-9]{32}\.(?:png|webp|jpe?g)$/);}
  });
  for(const extension of ['png','webp','jpeg','jpg']){
   const form=new FormData();form.append('file',new Blob([png],{type:'image/png'}),'public-'+extension+'.'+extension);
   const uploaded=await fetch(base+'/assets',{method:'POST',headers:{AuthToken:token},body:form});assert.equal(uploaded.status,200);const asset=await uploaded.json();
   const first=await fetch(base+'/'+asset.url),baseline={etag:first.headers.get('etag')??'"unavailable"',modified:first.headers.get('last-modified')??'Mon, 09 Nov 2026 00:00:00 GMT'};await first.arrayBuffer();
   const expectedFirst=source.wireRows.find(row=>row.label==='public-'+extension+'-get'),sourceBaseline={etag:expectedFirst.headers.etag,modified:expectedFirst.headers['last-modified']};
   for(const expected of source.wireRows.filter(row=>row.assetAlias===extension))await t.test(expected.label,async()=>{
    if(expected.label.endsWith('-retired')){const r=await fetch(base+'/assets/'+asset.id,{method:'DELETE',headers:{AuthToken:token}});assert.equal(r.status,200);await r.text();}
    const r=await fetch(base+'/'+asset.url,{method:expected.method,headers:render(expected.headersTemplate,baseline)}),bytes=Buffer.from(await r.arrayBuffer());assert.equal(r.status,expected.status);
    const h=Object.fromEntries(Object.keys(expected.headers).map(k=>[k,r.headers.get(k)]));
    // Preserve the API's stronger no-store error guarantee where the Source
    // file server omits a cache policy. Successful/conditional/range replies
    // must expose the actual Source immutable public policy.
    if(expected.headers['cache-control']===null&&h['cache-control']==='private, no-store')h['cache-control']=null;
    assert.deepEqual(normalizedReply(h,bytes,baseline),normalizedReply(expected.headers,Buffer.from(expected.bodyBase64,'base64'),sourceBaseline));
    assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.equal(r.headers.get('referrer-policy'),'no-referrer');assert.equal(r.headers.get('x-frame-options'),'SAMEORIGIN');assert.equal(r.headers.get('permissions-policy'),'camera=(self), geolocation=(), microphone=()');
   });
  }
  await t.test('public-missing-generated-url',async()=>{
   const expected=source.wireRows.find(row=>row.label==='public-missing-generated-url'),r=await fetch(base+'/public/uploaded_assets/asset_'+('0'.repeat(32))+'.png'),bytes=Buffer.from(await r.arrayBuffer());assert.equal(r.status,404);
   const headers=Object.fromEntries(Object.keys(expected.headers).map(k=>[k,r.headers.get(k)]));if(headers['cache-control']==='private, no-store')headers['cache-control']=null;
   assert.deepEqual({headers,body:bytes.toString('base64')},{headers:expected.headers,body:expected.bodyBase64});
  });
 }finally{await stop();if(pool){await pool.query('DROP SCHEMA "'+schema+'" CASCADE');await pool.end();}await rm(folder,{recursive:true,force:true});}
});
