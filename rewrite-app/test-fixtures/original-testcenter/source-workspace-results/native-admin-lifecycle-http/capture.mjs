import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

// Only the named synthetic Source installation and new accounts created by
// this capture may be mutated. Baseline users (including its Root) never enter
// any status-change or deletion request. No SQL seeds, DAO or runtime edits.
const output=process.env.ORIGINAL_ADMIN_LIFECYCLE_OUTPUT_DIR;assert.ok(output);await mkdir(output,{recursive:true});
const parent=new URL('../native-workspace-permissions-http/',import.meta.url);
const previous=JSON.parse(await readFile(new URL('observations.json',parent)));
const verify=()=>JSON.parse(execFileSync(process.execPath,[new URL('verify.mjs',parent).pathname],{encoding:'utf8',env:process.env}));
const before=verify(),port=execFileSync('docker',['port',process.env.ORIGINAL_PERMISSIONS_CONTAINER,'8080'],{encoding:'utf8'}).trim();
assert.match(port,/^127\.0\.0\.1:\d+$/);
const base='http://'+port,rootPassword='owned-source-super-secret',password='Owned lifecycle password',prefix='Owned R68 '+Date.now()+' ';
const aliases=new Map([[rootPassword,'[owned-root-password]'],[password,'[owned-lifecycle-password]']]),created=new Set(),rows=[];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');let token,baseline,workspaces,complete=false;
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
 const response=await fetch(base+path,{method,headers:{Accept:'application/json',...(auth?{AuthToken:auth}:{}),...(payload===undefined?{}:{'Content-Type':'application/json'})},
  ...(payload===undefined?{}:{body:payload}),signal:AbortSignal.timeout(20000)});
 const rawText=await response.text();let value;try{value=JSON.parse(rawText);}catch{value=rawText;}register(value);
 rows.push({label,method,path,status:response.status,contentType:response.headers.get('content-type'),allow:response.headers.get('allow'),errorId:response.headers.get('error-id'),testMode:response.headers.get('test-mode'),requestBody:body,
  ...rawBody===undefined?{}:{rawRequestBody:rawBody},rawText,value,bodySha256:hash(rawText)});
 if(method==='PUT'&&path==='/user'&&response.status===201){assert.match(rawText,/^[1-9]\d*$/);assert.ok(!baseline.some(user=>String(user.id)===rawText));created.add(rawText);}
 if(expected!==undefined)assert.equal(response.status,expected,label+': '+rawText);
 return{status:response.status,rawText,value};
}
const create=async name=>(await request('create-'+name,'PUT','/user',{body:{n:prefix+name,p:password},expected:201})).rawText;
const owned=id=>{assert.ok(created.has(id),'Mutation must target an HTTP-created owned account.');return id;};
const state=label=>request(label,'GET','/users',{expected:200});
const patch=(label,id,status,options={})=>request(label,'PATCH','/user/'+owned(id)+'/super-admin/'+encodeURIComponent(status),{body:{p:rootPassword},...options});
try{
 token=(await request('root-login','PUT','/session/admin',{auth:'',body:{name:'super',password:rootPassword},expected:200})).value.token;
 baseline=(await state('baseline-users')).value;workspaces=(await request('baseline-workspaces','GET','/workspaces',{expected:200})).value;
 assert.ok(baseline.every(user=>Number.isSafeInteger(user.id)));assert.ok(baseline.some(user=>user.name==='super'&&user.isSuperadmin));
 const target=await create('target'),reader=await create('reader');
 const readerToken=(await request('reader-login','PUT','/session/admin',{auth:'',body:{name:prefix+'reader',password},expected:200})).value.token;
 for(const[name,auth]of [['missing',''],['invalid','owned-nonexistent-token'],['non-root',readerToken]]){
  await patch(name+'-status',target,'on',{auth});await request(name+'-delete','DELETE','/users',{auth,body:{u:[],p:rootPassword}});
 }
 for(const status of ['on','true','1','TRUE','True','ON','On','off','false','0','FALSE','False','OFF','Off','undefined','2','yes','on ']){
  await patch('status-'+JSON.stringify(status),target,status);await state('after-status-'+JSON.stringify(status));
 }
 for(const[name,body]of [['missing',{}],['null',{p:null}],['false',{p:false}],['array',{p:[]}],['object',{p:{owned:1}}],['wrong',{p:'owned-wrong-password'}],['valid',{p:rootPassword,ignored:'owned'}]]){
  await patch('status-password-'+name,target,'on',{body});await state('after-status-password-'+name);
 }
 await patch('invalid-status-before-password',target,'undefined',{body:{}});
 await patch('status-invalid-json',target,'on',{rawBody:'{"p":'});
 for(const[name,ref]of [['prefix',target+'owned'],['fraction',target+'.9'],['exponent',target+'e0'],['negative','-'+target],['unknown','9223372036854775807'],['overflow','9223372036854775808'],['word','owned']]){
  // Positive path aliases cast only to this owned ID. Nonpositive/unknown
  // references cannot name any baseline user.
  await request('status-reference-'+name,'PATCH','/user/'+ref+'/super-admin/on',{body:{p:rootPassword}});await state('after-status-reference-'+name);
 }
 for(const[name,body]of [['missing-password',{}],['null-password',{u:[],p:null}],['wrong-password',{u:[],p:'owned-wrong-password'}],['false-password',{u:[],p:false}],
  ['array-password',{u:[],p:[]}],['object-password',{u:[],p:{owned:1}}],['empty',{u:[],p:rootPassword}],['missing-list',{p:rootPassword}],['null-list',{u:null,p:rootPassword}],
  ['string-list',{u:'owned',p:rootPassword}],['object-list',{u:{owned:true},p:rootPassword}],['zero',{u:[0],p:rootPassword}],['unknown',{u:['9223372036854775807'],p:rootPassword}],['negative',{u:['-'+target],p:rootPassword}]]){
  await request('delete-'+name,'DELETE','/users',{body});
 }
 await request('delete-invalid-json','DELETE','/users',{rawBody:'{"u":'});
 const duplicate=await create('duplicate-victim');await request('delete-duplicate-owned','DELETE','/users',{body:{u:[owned(duplicate),owned(duplicate)],p:rootPassword}});await state('after-delete-duplicate');
 const partial=await create('partial-victim');await request('delete-partial-before-invalid','DELETE','/users',{body:{u:[owned(partial),'owned-invalid-bigint'],p:rootPassword}});await state('after-delete-partial');
 const self=await create('self-owned');await patch('self-grant-by-baseline-root',self,'on',{expected:200});
 const selfToken=(await request('self-login','PUT','/session/admin',{auth:'',body:{name:prefix+'self-owned',password},expected:200})).value.token;
 await patch('owned-self-demotion',self,'off',{auth:selfToken,body:{p:password}});await state('after-owned-self-demotion');
 await patch('self-regrant-by-baseline-root',self,'on',{expected:200});
 await request('owned-self-delete','DELETE','/users',{auth:selfToken,body:{u:[owned(self)],p:password}});
 await request('owned-self-session-after-delete','GET','/session',{auth:selfToken});await state('after-owned-self-delete');
 complete=true;
}finally{
 if(token&&baseline){
  const current=(await state('cleanup-current')).value,baselineIDs=new Set(baseline.map(user=>String(user.id)));
  assert.ok([...created].every(id=>!baselineIDs.has(id)));
  const own=[...created].filter(id=>current.some(user=>String(user.id)===id));
  if(own.length)await request('cleanup-owned-users','DELETE','/users',{body:{u:own,p:rootPassword},expected:200});
  assert.deepEqual((await state('final-users')).value,baseline,'All original users, IDs and Root flags must be unchanged.');
  assert.deepEqual((await request('final-workspaces','GET','/workspaces',{expected:200})).value,workspaces,'All original workspaces must be unchanged.');
 }
 const after=verify();assert.deepEqual(after,before);
 const captured=redact(rows).map(row=>({...row,redactedBodySha256:hash(row.rawText)}));
 const result={verified:complete,sourceCommit:previous.sourceCommit,sourceHashes:previous.sourceHashes,sourceRuntimeBefore:before,sourceRuntimeAfter:after,
  ownedSyntheticAccountsOnly:true,baselineRestored:true,sqlSeedsOrDaoStubs:false,createdOwnedIDs:[...created],actualHttpExchanges:captured.length,rows:captured,fullOriginalParityProven:false};
 await writeFile(join(output,'observations.json'),JSON.stringify(result,null,2)+'\n');
 const manifest={sourceCommit:previous.sourceCommit,files:{'capture.mjs':hash(await readFile(new URL('./capture.mjs',import.meta.url))),'observations.json':hash(await readFile(join(output,'observations.json')))}};
 await writeFile(join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log(JSON.stringify({verified:complete,actualHttpExchanges:captured.length,createdOwnedAccounts:created.size,baselineRestored:true,sourceFiles:137,backendImage:before.backendImage}));
}
