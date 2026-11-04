import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

// Reuse only the named, already initialized, synthetic Source runtime. Check
// its unmodified production code/configuration before and after the capture.
const output=process.env.ORIGINAL_OPAQUE_ROLE_OUTPUT_DIR;
assert.ok(output);await mkdir(output,{recursive:true});
const parent=new URL('../native-workspace-permissions-http/',import.meta.url);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const previous=JSON.parse(await readFile(new URL('observations.json',parent)));
const verify=()=>JSON.parse(execFileSync(process.execPath,[new URL('verify.mjs',parent).pathname],{encoding:'utf8',env:process.env}));
const before=verify();
const port=execFileSync('docker',['port',process.env.ORIGINAL_PERMISSIONS_CONTAINER,'8080'],{encoding:'utf8'}).trim();assert.match(port,/^127\.0\.0\.1:\d+$/);
const base='http://'+port,rootPassword='owned-source-super-secret',userPassword='Owned permissions password';
const aliases=new Map([[rootPassword,'[owned-root-password]'],[userPassword,'[owned-user-password]']]);
const rows=[];
function register(value){if(!value||typeof value!=='object')return;for(const[key,item]of Object.entries(value)){if(/^(token|groupToken|salt|signature)$/i.test(key)&&typeof item==='string'){if(!aliases.has(item))aliases.set(item,'[owned-'+key+'-'+aliases.size+']');}else register(item);}}
function redact(value){if(typeof value==='string'){for(const[secret,alias]of [...aliases].sort((a,b)=>b[0].length-a[0].length))value=value.replaceAll(secret,alias);return value;}if(Array.isArray(value))return value.map(redact);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,redact(v)]));return value;}
async function request(label,method,path,{token,body,expected}={}){
 const response=await fetch(base+path,{method,headers:{Accept:'application/json',...(token?{AuthToken:token}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
 const rawText=await response.text();let value;try{value=JSON.parse(rawText);}catch{value=rawText;}register(value);
 const row={label,method,path,status:response.status,contentType:response.headers.get('content-type'),errorId:response.headers.get('error-id'),testMode:response.headers.get('test-mode'),requestBody:body,rawText,value,bodySha256:hash(rawText)};rows.push(row);
 if(expected!==undefined)assert.equal(row.status,expected,label+': '+rawText);return row;
}
let token,workspaceUsers,userWorkspaces,ws,user,captureComplete=false;
try{
 token=(await request('root-login','PUT','/session/admin',{body:{name:'super',password:rootPassword},expected:200})).value.token;
 const workspaces=(await request('owned-workspaces','GET','/workspaces',{token,expected:200})).value;
 ws=workspaces.find(w=>w.name==='Owned permissions One Ω')?.id;assert.equal(ws,previous.setup.one);
 workspaceUsers=(await request('before-workspace-users','GET','/workspace/'+ws+'/users',{token,expected:200})).value;
 user=workspaceUsers.find(u=>u.name==='Owned permissions A')?.id;assert.equal(user,previous.setup.a);
 userWorkspaces=(await request('before-user-workspaces','GET','/user/'+user+'/workspaces',{token,expected:200})).value;
 const userToken=(await request('user-login','PUT','/session/admin',{body:{name:'Owned permissions A',password:userPassword},expected:200})).value.token;
 const roles=[['RO','RO'],['RW','RW'],['opaque','XX'],['padded',' RW '],['blank',''],['limit-ascii','1234567890'],['over-limit-ascii','12345678901'],['limit-unicode','Ω'.repeat(10)],['over-limit-unicode','Ω'.repeat(11)],['first-nul','XX\0RW'],['nul-only','\0'],['RW-nul-suffix','RW\0ignored'],['limit-spaces',' '.repeat(10)],['over-limit-spaces',' '.repeat(11)],['over-limit-trailing-spaces','RO'+' '.repeat(9)],['over-limit-leading-spaces',' '.repeat(9)+'RO']];
 for(const family of ['workspace','user'])for(const[name,role]of roles){
  const label=family+'-'+name;
  const path=family==='workspace'?'/workspace/'+ws+'/users':'/user/'+user+'/workspaces';
  const restoreBody=family==='workspace'?{u:workspaceUsers.map(r=>({id:r.id,role:r.role}))}:{ws:userWorkspaces.map(r=>({id:r.id,role:r.role}))};
  await request(label+'-restore','PATCH',path,{token,body:restoreBody,expected:200});
  await request(label+'-write','PATCH',path,{token,body:family==='workspace'?{u:[{id:user,role}]}:{ws:[{id:ws,role}]}});
  await request(label+'-matrix','GET','/workspace/'+ws+'/users',{token,expected:200});
  await request(label+'-user-matrix','GET','/user/'+user+'/workspaces',{token,expected:200});
  await request(label+'-claim','GET','/session',{token:userToken,expected:200});
  const matrix=rows.at(-3).value.find(r=>r.id===user);
  const expectedRead=matrix.selected?(matrix.role==='RO'||matrix.role==='RW'?200:403):404;
  await request(label+'-read','GET','/workspace/'+ws+'/results',{token:userToken,expected:expectedRead});
  // Synthetic fixture has no result data. The owned nonexistent group only
  // probes the actual write gate; it cannot touch a user's study or response.
  await request(label+'-delete','DELETE','/workspace/'+ws+'/responses',{token:userToken,body:{groups:['OWNED.OPAQUE.ROLE.NO.RESULTS']},expected:matrix.selected?(matrix.role==='RW'?200:403):404});
 }
 captureComplete=true;
}finally{
 if(token&&workspaceUsers&&userWorkspaces){
  await request('final-restore-user','PATCH','/user/'+user+'/workspaces',{token,body:{ws:userWorkspaces.map(r=>({id:r.id,role:r.role}))},expected:200});
  await request('final-restore-workspace','PATCH','/workspace/'+ws+'/users',{token,body:{u:workspaceUsers.map(r=>({id:r.id,role:r.role}))},expected:200});
  assert.deepEqual((await request('final-workspace-users','GET','/workspace/'+ws+'/users',{token,expected:200})).value,workspaceUsers);
  assert.deepEqual((await request('final-user-workspaces','GET','/user/'+user+'/workspaces',{token,expected:200})).value,userWorkspaces);
 }
 const after=verify();assert.deepEqual(after,before);
 const captured=redact(rows).map(row=>({...row,redactedBodySha256:hash(row.rawText)}));
 const result={verified:captureComplete,readAndWriteGatesProven:captureComplete,sourceCommit:previous.sourceCommit,sourceHashes:previous.sourceHashes,sourceRuntimeBefore:before,sourceRuntimeAfter:after,ownedExistingFixtureOnly:true,sqlSeedsOrDaoStubs:false,rows:captured,actualHttpExchanges:captured.length,fullOriginalParityProven:false};
 await writeFile(join(output,'observations.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({verified:captureComplete,exchanges:rows.length,sourceFiles:Object.keys(previous.sourceHashes).length,sourceImage:before.backendImage}));
}
