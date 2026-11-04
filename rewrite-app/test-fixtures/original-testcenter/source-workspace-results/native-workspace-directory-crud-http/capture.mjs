import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

// Operate only on the previously verified synthetic Source installation. Every
// created identity is obtained from a real HTTP response; never seed SQL, edit
// the Original checkout, replace a DAO, or mutate an existing workspace.
const output=process.env.ORIGINAL_WORKSPACE_CRUD_OUTPUT_DIR;
assert.ok(output);await mkdir(output,{recursive:true});
const parent=new URL('../native-workspace-permissions-http/',import.meta.url);
const previous=JSON.parse(await readFile(new URL('observations.json',parent)));
const verify=()=>JSON.parse(execFileSync(process.execPath,[new URL('verify.mjs',parent).pathname],{encoding:'utf8',env:process.env}));
const before=verify();
const port=execFileSync('docker',['port',process.env.ORIGINAL_PERMISSIONS_CONTAINER,'8080'],{encoding:'utf8'}).trim();
assert.match(port,/^127\.0\.0\.1:\d+$/);
const base='http://'+port,rootPassword='owned-source-super-secret',userPassword='Owned permissions password';
const prefix='Owned R67 directory '+Date.now()+' ';
const aliases=new Map([[rootPassword,'[owned-root-password]'],[userPassword,'[owned-user-password]']]);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const rows=[],created=new Set();let token,baseline,baselineUsers,complete=false;
function register(value){
 if(!value||typeof value!=='object')return;
 for(const[key,item]of Object.entries(value)){
  if(/^(token|groupToken|salt|signature)$/i.test(key)&&typeof item==='string'){
   if(!aliases.has(item))aliases.set(item,'[owned-'+key+'-'+aliases.size+']');
  }else register(item);
 }
}
function redact(value){
 if(typeof value==='string'){
  for(const[secret,alias]of [...aliases].sort((a,b)=>b[0].length-a[0].length))value=value.replaceAll(secret,alias);
  return value;
 }
 if(Array.isArray(value))return value.map(redact);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,redact(v)]));
 return value;
}
async function request(label,method,path,{auth=token,body,rawBody,expected}={}){
 const payload=rawBody??(body===undefined?undefined:JSON.stringify(body));
 const response=await fetch(base+path,{method,headers:{Accept:'application/json',...(auth?{AuthToken:auth}:{}),
  ...(payload===undefined?{}:{'Content-Type':'application/json'})},...(payload===undefined?{}:{body:payload}),signal:AbortSignal.timeout(20000)});
 const rawText=await response.text();let value;try{value=JSON.parse(rawText);}catch{value=rawText;}
 register(value);
 rows.push({label,method,path,status:response.status,contentType:response.headers.get('content-type'),allow:response.headers.get('allow'),
  errorId:response.headers.get('error-id'),testMode:response.headers.get('test-mode'),requestBody:body,...rawBody===undefined?{}:{rawRequestBody:rawBody},
  rawText,value,bodySha256:hash(rawText)});
 if(method==='PUT'&&path==='/workspace'&&response.status===201){
  assert.match(rawText,/^[1-9]\d*$/);assert.ok(!baseline.some(w=>String(w.id)===rawText));created.add(rawText);
 }
 if(expected!==undefined)assert.equal(response.status,expected,label+': '+rawText);
 return{response,value,rawText};
}
async function create(label,body){
 const result=await request(label,'PUT','/workspace',{body});
 if(result.response.status===201){assert.match(result.rawText,/^[1-9]\d*$/);assert.ok(!baseline.some(w=>String(w.id)===result.rawText));created.add(result.rawText);}
 return result;
}
try{
 token=(await request('root-login','PUT','/session/admin',{auth:'',body:{name:'super',password:rootPassword},expected:200})).value.token;
 baseline=(await request('baseline-workspaces','GET','/workspaces',{expected:200})).value;
 assert.ok(baseline.every(w=>Number.isSafeInteger(w.id)),'The owned synthetic baseline must have exact small IDs.');
 baselineUsers=(await request('baseline-users','GET','/users',{expected:200})).value;
 const reader=(await request('reader-login','PUT','/session/admin',{auth:'',body:{name:'Owned permissions A',password:userPassword},expected:200})).value.token;
 for(const[authName,auth]of [['missing',''],['invalid','owned-nonexistent-token'],['non-root',reader]]){
  await request(authName+'-create','PUT','/workspace',{auth,body:{name:prefix+authName}});
  await request(authName+'-rename','PATCH','/workspace/9223372036854775807',{auth,body:{name:prefix+authName}});
  await request(authName+'-delete','DELETE','/workspaces',{auth,body:{ws:[],p:rootPassword}});
 }
 for(const[method,path]of [['GET','/workspace'],['POST','/workspace'],['PUT','/workspace/9223372036854775807'],['PATCH','/workspaces']]){
  await request('method-'+method+'-'+path,method,path,{body:method==='GET'?undefined:{name:prefix+'wrong-method'}});
 }
 const anchor=(await create('create-anchor',{name:prefix+'anchor'})).rawText;
 assert.ok(created.has(anchor));
 const names=[['missing',{}],['null',{name:null}],['false',{name:false}],['true',{name:true}],['zero-number',{name:0}],['one-number',{name:1}],
  ['empty',{name:''}],['zero-string',{name:'0'}],['spaces',{name:'   '}],['tab',{name:'\t'}],['normal',{name:prefix+'normal'}],
  ['duplicate',{name:prefix+'normal'}],['lowercase',{name:(prefix+'normal').toLowerCase()}],['leading-space',{name:' '+prefix+'normal'}],
  ['trailing-space',{name:prefix+'normal '}],['unicode',{name:prefix+'Ω 漢 😀'}],['ascii-80',{name:'x'.repeat(80)}],
  ['ascii-255',{name:'y'.repeat(255)}],['ascii-256',{name:'z'.repeat(256)}],['unicode-255',{name:'Ω'.repeat(255)}],
  ['unicode-256',{name:'漢'.repeat(256)}],['nul',{name:prefix+'nul\0ignored'}],['array',{name:['owned']}],['object',{name:{name:'owned'}}],
  ['ascii-50',{name:'a'.repeat(50)}],['ascii-51',{name:'b'.repeat(51)}],['unicode-50',{name:'😀'.repeat(50)}],['unicode-51',{name:'Ω'.repeat(51)}],
  ['over-limit-trailing-spaces',{name:'c'.repeat(50)+'  '}],['over-limit-leading-spaces',{name:'  '+'d'.repeat(50)}],
  ['nul-only',{name:'\0'}],['empty-array',{name:[]}],['negative-number',{name:-1}],['fraction-number',{name:1.5}],
  ['extra-field',{name:prefix+'extra',ignored:'owned extra'}],['array-body',[]],['null-body',null],['string-body','owned']];
 for(const[name,body]of names){
  await create('create-'+name,body);
  await request('after-create-'+name,'GET','/workspaces',{expected:200});
 }
 await request('create-invalid-json','PUT','/workspace',{rawBody:'{"name":'});
 let ordinal=0;
 for(const[name,body]of names){
  await request('rename-'+name+'-reset','PATCH','/workspace/'+anchor,{body:{name:prefix+'reset '+ordinal++},expected:200});
  await request('rename-'+name,'PATCH','/workspace/'+anchor,{body});
  await request('after-rename-'+name,'GET','/workspaces',{expected:200});
 }
 await request('rename-invalid-json','PATCH','/workspace/'+anchor,{rawBody:'{"name":'});
 const same=(await request('before-rename-same-name','GET','/workspaces',{expected:200})).value.find(w=>String(w.id)===anchor);
 assert.ok(same);await request('rename-same-name','PATCH','/workspace/'+anchor,{body:{name:same.name}});
 for(const[alias,path]of [['same',anchor],['prefix',anchor+'owned'],['fraction',anchor+'.9'],['exponent',anchor+'e0'],['negative','-'+anchor],['unknown','9223372036854775807'],['overflow','9223372036854775808'],['word','owned']]){
  await request('rename-path-'+alias,'PATCH','/workspace/'+path,{body:{name:prefix+'path '+alias}});
 }
 for(const[name,body]of [['missing-password',{}],['wrong-password',{ws:[],p:'owned-wrong-password'}],['empty',{ws:[],p:rootPassword}],
  ['missing-list',{p:rootPassword}],['null-list',{ws:null,p:rootPassword}],['string-list',{ws:'owned',p:rootPassword}],['unknown',{ws:['9223372036854775807'],p:rootPassword}]]){
  await request('delete-'+name,'DELETE','/workspaces',{body});
 }
 complete=true;
}finally{
 if(token&&baseline){
  // The baseline IDs are excluded explicitly, including a name that existed
  // before an attempted create. A failed capture still removes its own rows.
  const current=(await request('cleanup-current','GET','/workspaces',{expected:200})).value;
  const baselineIDs=new Set(baseline.map(w=>String(w.id)));
  assert.ok([...created].every(id=>!baselineIDs.has(id)));
  const own=[...created].filter(id=>current.some(w=>String(w.id)===id));
  if(own.length)await request('cleanup-owned-workspaces','DELETE','/workspaces',{body:{ws:own,p:rootPassword}});
  assert.deepEqual((await request('final-workspaces','GET','/workspaces',{expected:200})).value,baseline,'Every original workspace row must be unchanged.');
  assert.deepEqual((await request('final-users','GET','/users',{expected:200})).value,baselineUsers,'Every original administrator row must be unchanged.');
 }
 const after=verify();assert.deepEqual(after,before);
 const captured=redact(rows).map(row=>({...row,redactedBodySha256:hash(row.rawText)}));
 const result={verified:complete,sourceCommit:previous.sourceCommit,sourceHashes:previous.sourceHashes,sourceRuntimeBefore:before,sourceRuntimeAfter:after,
  ownedSyntheticRuntimeOnly:true,baselineRestored:true,sqlSeedsOrDaoStubs:false,actualHttpExchanges:captured.length,createdOwnedIDs:[...created],rows:captured,fullOriginalParityProven:false};
 await writeFile(join(output,'observations.json'),JSON.stringify(result,null,2)+'\n');
 const manifest={sourceCommit:previous.sourceCommit,files:{'capture.mjs':hash(await readFile(new URL('./capture.mjs',import.meta.url))),'observations.json':hash(await readFile(join(output,'observations.json')))}};
 await writeFile(join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log(JSON.stringify({verified:complete,exchanges:captured.length,createdOwnedIDs:created.size,baselineRestored:true,sourceFiles:Object.keys(previous.sourceHashes).length,sourceImage:before.backendImage}));
}
