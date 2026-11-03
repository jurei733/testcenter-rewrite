import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
const work=new URL('.',import.meta.url).pathname,out=join(work,'round39-source-session-wire');await mkdir(out,{recursive:true});
const original='/Users/julian/Documents/Codex/2026-10-20/en/work/testcenter-original',container='source-session-wire-r39-backend-1';
const port=execFileSync('docker',['port',container,'8080'],{encoding:'utf8'}).trim();assert.match(port,/^127\.0\.0\.1:\d+$/);const base='http://'+port;
const hash=b=>createHash('sha256').update(b).digest('hex'),git=(...a)=>execFileSync('git',['-C',original,...a],{encoding:'utf8'}).trim();
assert.equal(git('rev-parse','HEAD'),'eedae41840cbe90e5547c0211da818bdf620f5aa');assert.equal(git('status','--porcelain','--untracked-files=no'),'');
const paths=git('ls-files','backend/src','backend/index.php','backend/routes.php','backend/initialize.php','definitions/testtaker','scripts/database/full.sql').split('\n');
const sourceHashes=Object.fromEntries(await Promise.all(paths.map(async p=>[p,hash(await readFile(join(original,p)))])));
const verifyImage=()=>{
 const php='$paths=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);$out=[];foreach($paths as $p){$f="/var/www/testcenter/".$p;if(!is_file($f))throw new RuntimeException("Missing pinned source: ".$p);$out[$p]=hash_file("sha256",$f);}echo json_encode($out,JSON_THROW_ON_ERROR);';
 const actual=JSON.parse(execFileSync('docker',['exec','-i',container,'php','-r',php],{encoding:'utf8',input:JSON.stringify(paths)}));assert.deepEqual(actual,sourceHashes);return actual;
};
verifyImage();
const composerLock=JSON.parse(await readFile(join(original,'backend/composer.lock'),'utf8'));
const installedBytes=execFileSync('docker',['exec',container,'php','-r','echo file_get_contents("/var/www/testcenter/backend/vendor/composer/installed.json");']);
const installed=JSON.parse(installedBytes),known=new Map([...composerLock.packages,...composerLock['packages-dev']].map(p=>[p.name,p]));
for(const p of installed.packages){assert.ok(known.has(p.name),p.name);assert.equal(p.version,known.get(p.name).version,p.name);assert.equal(p.source?.reference,known.get(p.name).source?.reference,p.name);}
for(const p of composerLock.packages)assert.ok(installed.packages.some(i=>i.name===p.name),'Missing locked production package '+p.name);
const vendor={sourceComposerLockSha256:hash(await readFile(join(original,'backend/composer.lock'))),installedMetadataSha256:hash(installedBytes),installedPackages:installed.packages.length,requiredProductionPackages:composerLock.packages.length,allInstalledVersionsAndSourceReferencesMatchPinnedLock:true};
const password='Owned source HTTP window password',adminPassword='owned-source-super-secret',secrets=new Set([password,adminPassword]),requests=[],rows=[];
const register=v=>{if(v&&typeof v==='object')for(const[k,x]of Object.entries(v)){if(/^(token|groupToken)$/i.test(k)&&typeof x==='string')secrets.add(x);else register(x);}};
const redact=v=>{if(typeof v==='string'){for(const s of [...secrets].sort((a,b)=>b.length-a.length))v=v.replaceAll(s,'[owned-secret-redacted]');return v;}if(Array.isArray(v))return v.map(redact);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,redact(x)]));return v;};
const request=async(method,path,{body,token,rawBody,allowEmptyToken=false}={})=>{
 const r=await fetch(base+path,{method,headers:{Accept:'application/json',...(token||allowEmptyToken?{AuthToken:token??''}:{}),...(body!==undefined&&!(body instanceof FormData)?{'Content-Type':'application/json'}:{})},...(rawBody!==undefined?{body:rawBody}:body===undefined?{}:{body:body instanceof FormData?body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
 const bytes=Buffer.from(await r.arrayBuffer());let value=null;try{value=JSON.parse(bytes.toString());}catch{value=bytes.toString();}register(value);requests.push({method,path,status:r.status,bodySha256:hash(bytes),contentType:r.headers.get('content-type'),errorId:r.headers.get('error-id'),testMode:r.headers.get('test-mode'),value});return{status:r.status,value,contentType:r.headers.get('content-type'),errorId:r.headers.get('error-id'),testMode:r.headers.get('test-mode')};
};
let workspace;
try{
 const config=await request('GET','/system/config');assert.equal(config.status,200);assert.deepEqual(config.value.bruteForceProtection,[]);
 const admin=await request('PUT','/session/admin',{body:{name:'super',password:adminPassword}});assert.equal(admin.status,200);assert.ok(admin.value.token);
 const created=await request('PUT','/workspace',{token:admin.value.token,body:{name:'Owned Source HTTP window oracle'}});assert.equal(created.status,201);workspace=Number(created.value);assert.ok(Number.isSafeInteger(workspace)&&workspace>0);
 const grant=await request('PATCH','/user/'+admin.value.id+'/workspaces',{token:admin.value.token,body:{ws:[{id:workspace,role:'RW'}]}});assert.equal(grant.status,200);
 const actor=state=>'owned-http-'+state;
 const roster=expiredRate=>'<Testtakers xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/testcenter-testtaker-xml/18.0"><Metadata/>'+[
  ['active','Owned active',''],['expired','Owned expired',' validTo="1/1/2000 12:00"'],['scheduled','Owned scheduled',' validFrom="1/1/2099 12:00"'],['empty','',''],['space','   ',''],['rate','Owned rate',expiredRate?' validTo="1/1/2000 12:00"':'']
 ].map(([state,label,window])=>'<Group id="OWNED.HTTP.'+state.toUpperCase()+'" label="'+label+'"'+window+'><Login name="'+actor(state)+'" pw="'+password+'" mode="monitor-group"/></Group>').join('')+'</Testtakers>';
 const upload=async expiredRate=>{const form=new FormData();form.append('fileforvo[]',new Blob([roster(expiredRate)],{type:'application/xml'}),'owned-http-people.xml');const result=await request('POST','/workspace/'+workspace+'/file',{token:admin.value.token,body:form});assert.equal(result.status,201);};
 await upload(false);
 const login=async(state,passwordKind)=>{const value=passwordKind==='empty'?'':passwordKind==='wrong'?'Owned wrong HTTP password':password;const r=await request('PUT','/session/login',{body:{name:actor(state),password:value}});rows.push({state,passwordKind,...r});return r;};
 for(const state of ['active','expired','scheduled','empty','space'])for(const kind of ['empty','wrong','correct'])await login(state,kind);
 const rateStatuses=[];for(let n=0;n<6;n++)rateStatuses.push((await login('rate','wrong')).status);assert.deepEqual(rateStatuses,[400,400,400,400,400,429]);
 assert.equal((await login('rate','correct')).status,429);assert.equal((await login('rate','empty')).status,429);
 await upload(true);assert.equal((await login('rate','correct')).status,429);
 for(const state of ['expired','scheduled'])for(const row of rows.filter(r=>r.state===state))assert.equal(row.status,state==='expired'?410:401);
 assert.deepEqual(rows.filter(r=>r.state==='active').map(r=>r.status),[400,400,200]);
 const wireCases=[];
 for(const [label,method,path,options]of [
  ['unknown-name','PUT','/session/login',{body:{name:'owned-unknown-wire',password:'Owned wrong HTTP password'}}],
  ['empty-name','PUT','/session/login',{body:{name:'',password:'Owned wrong HTTP password'}}],
  ['escaped-name','PUT','/session/login',{body:{name:'owned-<>&"\'/',password:'Owned wrong HTTP password'}}],
  ['missing-name','PUT','/session/login',{body:{password:'Owned wrong HTTP password'}}],
  ['malformed-json','PUT','/session/login',{body:{},rawBody:'{'}],
  ['wrong-login-method','GET','/session/login',{}],
  ['missing-token','GET','/session',{}],
  ['empty-token','GET','/session',{token:'',allowEmptyToken:true}],
  ['unknown-token','GET','/session',{token:'owned-not-a-real-token'}],
  ['person-missing-token','PUT','/session/person',{body:{code:''}}],
  ['challenge-missing-fields','POST','/session/challenge',{body:{}}]
 ]){const result=await request(method,path,options);wireCases.push({label,method,path,request:options.body??null,rawRequest:options.rawBody??null,...result});assert.ok(result.status>=400);assert.match(result.errorId,/^error-[a-f0-9]+\.\d+$/);assert.equal(result.testMode,'NO');assert.equal(result.contentType,'text/html;charset=UTF-8');}
 verifyImage();assert.equal(git('status','--porcelain','--untracked-files=no'),'');
 const versions={php:execFileSync('docker',['exec',container,'php','-r','echo PHP_VERSION;'],{encoding:'utf8'}).trim(),postgres:execFileSync('docker',['exec','source-session-wire-r39-postgres-1','psql','-U','source_oracle','-d','source_oracle','-Atc','select version();'],{encoding:'utf8'}).trim()};
 const result={verified:true,sourceCommit:git('rev-parse','HEAD'),sourceHashes,sourceFilesVerifiedBeforeAndAfter:paths.length,vendor,backendImage:'sha256:d7045f22e834e2907ed39b5f8c99eed3d81f37643c50c3f66746e3f654381328',versions,transport:'Unmodified pinned Original Apache/PHP HTTP, actual PostgreSQL/Redis, actual admin/workspace/roster upload and schema validation; no method/DAO stubs, no SQL seeding or HTTP response interception.',configuration:{bruteForceProtection:[],testMode:false,ownedDedicatedStack:true},workspace,rows:redact(rows),wireCases:redact(wireCases),requests:redact(requests),fullOriginalParityProven:false};
 await writeFile(join(out,'observations.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({verified:true,sourceFiles:paths.length,statuses:rows.map(({state,passwordKind,status})=>({state,passwordKind,status})),versions}));
}catch(error){await writeFile(join(out,'failure.json'),JSON.stringify({error:String(error),workspace,sourceHashes,rows:redact(rows),requests:redact(requests)},null,2)+'\n');throw error;}
