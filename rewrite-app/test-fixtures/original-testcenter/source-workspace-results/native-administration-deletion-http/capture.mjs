import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

// Only real HTTP-created identities in the existing owned synthetic runtime
// can be deletion targets. In particular, never probe an element true/1:
// PDO could resolve it to baseline user/workspace1. No Source/DAO/SQL edits.
const output=process.env.ORIGINAL_ADMIN_DELETION_OUTPUT_DIR;assert.ok(output);await mkdir(output,{recursive:true});
const parent=new URL('../native-workspace-permissions-http/',import.meta.url);
const evidence=JSON.parse(await readFile(new URL('observations.json',parent)));
const verify=()=>JSON.parse(execFileSync(process.execPath,[new URL('verify.mjs',parent).pathname],{encoding:'utf8',env:process.env}));
const before=verify(),port=execFileSync('docker',['port',process.env.ORIGINAL_PERMISSIONS_CONTAINER,'8080'],{encoding:'utf8'}).trim();assert.match(port,/^127\.0\.0\.1:\d+$/);
const base='http://'+port,password='owned-source-super-secret',userPassword='Owned permissions password',prefix='Owned D69 '+Date.now()+' ';
const aliases=new Map([[password,'[owned-root-password]'],[userPassword,'[owned-user-password]']]),rows=[],created={users:new Set(),workspaces:new Set()};
const hash=data=>createHash('sha256').update(data).digest('hex');let token,baseline,complete=false;
function register(value){if(value&&typeof value==='object')for(const[key,item]of Object.entries(value)){
 if(/^(token|groupToken|salt|signature)$/i.test(key)&&typeof item==='string'){if(!aliases.has(item))aliases.set(item,'[owned-'+key+'-'+aliases.size+']');}else register(item);
}}
function redact(value){
 if(typeof value==='string'){for(const[secret,alias]of [...aliases].sort((a,b)=>b[0].length-a[0].length))value=value.replaceAll(secret,alias);return value;}
 if(Array.isArray(value))return value.map(redact);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,redact(v)]));return value;
}
async function request(label,method,path,{auth=token,body,rawBody,expected}={}){
 const payload=rawBody??(body===undefined?undefined:JSON.stringify(body));
 const r=await fetch(base+path,{method,headers:{Accept:'application/json',...(auth?{AuthToken:auth}:{}),...(payload===undefined?{}:{'Content-Type':'application/json'})},...(payload===undefined?{}:{body:payload}),signal:AbortSignal.timeout(20000)});
 const rawText=await r.text();let value;try{value=JSON.parse(rawText);}catch{value=rawText;}register(value);
 rows.push({label,method,path,status:r.status,contentType:r.headers.get('content-type'),allow:r.headers.get('allow'),requestBody:body,...rawBody===undefined?{}:{rawRequestBody:rawBody},rawText,value,bodySha256:hash(rawText)});
 if(method==='PUT'&&r.status===201&&(path==='/user'||path==='/workspace')){
  const family=path==='/user'?'users':'workspaces';assert.match(rawText,/^[1-9]\d*$/);assert.ok(!baseline[family].some(row=>String(row.id)===rawText));created[family].add(rawText);
 }
 if(expected!==undefined)assert.equal(r.status,expected,label+': '+rawText);
 return{status:r.status,value,rawText};
}
const get=(family,label)=>request(label,'GET','/'+family,{expected:200});
const create=async(family,label)=>(await request('create-'+family+'-'+label,'PUT',family==='users'?'/user':'/workspace',{
 body:family==='users'?{n:prefix+family[0]+' '+label,p:userPassword}:{name:prefix+family[0]+' '+label},expected:201})).rawText;
try{
 token=(await request('root-login','PUT','/session/admin',{auth:'',body:{name:'super',password},expected:200})).value.token;
 baseline={users:(await get('users','baseline-users')).value,workspaces:(await get('workspaces','baseline-workspaces')).value};
 assert.ok(Object.values(baseline).flat().every(row=>Number.isSafeInteger(row.id)));
 const reader=(await request('reader-login','PUT','/session/admin',{auth:'',body:{name:'Owned permissions A',password:userPassword},expected:200})).value.token;
 for(const family of ['users','workspaces']){
  const key=family==='users'?'u':'ws',path='/'+family,del=(label,body,options={})=>request(family+'-'+label,'DELETE',path,{body,...options});
  for(const[label,auth]of [['missing',''],['invalid','owned-nonexistent-token'],['reader',reader]])await del('auth-'+label,{[key]:[],p:password},{auth});
  for(const method of ['PATCH','PUT','POST'])await request(family+'-method-'+method,method,path,{body:{[key]:[],p:password}});
  for(const[label,body]of [
   ['password-missing',{}],['password-null',{[key]:[],p:null}],['password-wrong',{[key]:[],p:'owned-wrong-password'}],
   ['password-false',{[key]:[],p:false}],['password-array',{[key]:[],p:[]}],['password-object',{[key]:[],p:{owned:1}}],
   ['list-empty',{[key]:[],p:password}],['list-missing',{p:password}],['list-null',{[key]:null,p:password}],
   ['list-string',{[key]:'owned',p:password}],['list-object',{[key]:{owned:1},p:password}],['list-false',{[key]:false,p:password}],
   ['list-true',{[key]:true,p:password}],['list-zero',{[key]:0,p:password}],
   ['list-before-password',{[key]:'owned'}],['list-before-wrong-password',{[key]:'owned',p:'owned-wrong-password'}],
   ['body-null',null],['body-array',[]]
  ])await del(label,body);
  await del('invalid-json',undefined,{rawBody:'{"'+key+'":'});
  const values=[['null',()=>null],['false',()=>false],['empty-array',()=>[]],['object',()=>({owned:1})],['empty-string',()=> ''],['zero',()=>0],
   ['negative',id=>'-'+id],['unknown-max',()=> '9223372036854775807'],['overflow',()=> '9223372036854775808'],['underflow',()=> '-9223372036854775809'],
   ['integer',id=>id],['number',id=>Number(id)],['leading-zero',id=>'00'+id],['plus',id=>'+'+id],['spaces',id=>' \t'+id+'\r\n'],
   ['decimal-string',id=>id+'.0'],['exponent-string',id=>id+'e0'],['prefix',id=>id+'owned'],['nul',id=>id+'\0ignored']];
  for(const[label,value]of values){
   const id=await create(family,label);assert.ok(created[family].has(id));
   await del('element-'+label,{[key]:[value(id)],p:password});await get(family,family+'-after-element-'+label);
  }
  for(const[label,number]of [['whole-float',id=>id+'.0'],['fraction',id=>id+'.5'],['exact-high-integer',()=> '9007199254740993'],['overflow-number',()=> '9223372036854775808']]){
   const id=await create(family,label);
   await del('element-'+label,undefined,{rawBody:'{"'+key+'":['+number(id)+'],"p":'+JSON.stringify(password)+'}'});await get(family,family+'-after-element-'+label);
  }
  const duplicate=await create(family,'duplicate');await del('duplicate',{[key]:[duplicate,duplicate],p:password});await get(family,family+'-after-duplicate');
  const partial=await create(family,'partial');await del('partial-before-invalid',{[key]:[partial,'owned-invalid-bigint'],p:password});await get(family,family+'-after-partial');
 }
 complete=true;
}finally{
 if(token&&baseline)for(const family of ['users','workspaces']){
  const current=(await get(family,'cleanup-current-'+family)).value,ids=created[family],baselineIDs=new Set(baseline[family].map(row=>String(row.id)));
  assert.ok([...ids].every(id=>!baselineIDs.has(id)));
  const remaining=[...ids].filter(id=>current.some(row=>String(row.id)===id));
  if(remaining.length)await request('cleanup-owned-'+family,'DELETE','/'+family,{body:{[family==='users'?'u':'ws']:remaining,p:password},expected:200});
  assert.deepEqual((await get(family,'final-'+family)).value,baseline[family]);
 }
 const after=verify();assert.deepEqual(after,before);
 const captured=redact(rows).map(row=>({...row,redactedBodySha256:hash(row.rawText)}));
 const data={verified:complete,sourceCommit:evidence.sourceCommit,sourceHashes:evidence.sourceHashes,sourceRuntimeBefore:before,sourceRuntimeAfter:after,baselineRestored:true,
  ownedHttpCreatedIdentitiesOnly:true,sqlSeedsOrDaoStubs:false,createdOwnedIDs:Object.fromEntries(Object.entries(created).map(([key,ids])=>[key,[...ids]])),actualHttpExchanges:captured.length,
  excludedUnsafeProbe:'An element true/1 could delete baseline ID1; no such request was made.',rows:captured,fullOriginalParityProven:false};
 await writeFile(join(output,'observations.json'),JSON.stringify(data,null,2)+'\n');
 await writeFile(join(output,'manifest.json'),JSON.stringify({sourceCommit:evidence.sourceCommit,files:{'capture.mjs':hash(await readFile(new URL('./capture.mjs',import.meta.url))),'observations.json':hash(await readFile(join(output,'observations.json')))}},null,2)+'\n');
 console.log(JSON.stringify({verified:complete,exchanges:captured.length,ownedUsers:created.users.size,ownedWorkspaces:created.workspaces.size,baselineRestored:true}));
}
