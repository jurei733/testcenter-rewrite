import assert from 'node:assert/strict';
import {writeFile,access} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
await assert.rejects(access(new URL('./observations.json',import.meta.url)),{code:'ENOENT'},'Never overwrite frozen Source evidence.');
const original=process.env.ORIGINAL_PERMISSIONS_SOURCE_ROOT;assert.ok(original);
assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:original,encoding:'utf8'}).trim(),'eedae41840cbe90e5547c0211da818bdf620f5aa');
assert.equal(execFileSync('git',['status','--porcelain'],{cwd:original,encoding:'utf8'}),'');
const base='http://127.0.0.1:'+JSON.parse(execFileSync('docker',['inspect',process.env.ORIGINAL_PERMISSIONS_CONTAINER],{encoding:'utf8'}))[0].NetworkSettings.Ports['8080/tcp'][0].HostPort;
const password='owned-source-super-secret',rows=[],users=[],workspaces=[],secrets=[password,'Owned permissions password'];let token;
function redact(value){if(typeof value==='string'){for(const secret of secrets)value=value.replaceAll(secret,'[owned-secret]');return value;}if(Array.isArray(value))return value.map(redact);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,redact(v)]));return value;}
async function request(label,method,path,body,expected=200){
 const response=await fetch(base+path,{method,headers:{...(token?{AuthToken:token}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});
 const rawText=await response.text();let value;try{value=JSON.parse(rawText);}catch{}if(value?.token)secrets.push(value.token);
 rows.push({label,method,path,body,status:response.status,contentType:response.headers.get('content-type'),rawText});
 assert.equal(response.status,expected,label+': '+rawText);return{rawText,value};
}
let baselineUsers,baselineWorkspaces,baselineGrants,success=false;
try{
 token=(await request('root-login','PUT','/session/admin',{name:'super',password})).value.token;
 baselineUsers=(await request('users-before','GET','/users')).rawText;baselineWorkspaces=(await request('workspaces-before','GET','/workspaces')).rawText;
 baselineGrants=await Promise.all(JSON.parse(baselineWorkspaces).map(async w=>[w.id,(await request('baseline-grants-'+w.id,'GET','/workspace/'+w.id+'/users')).rawText]));
 const suffix=Date.now().toString(36);
 for(const name of ['A','B'])users.push((await request('create-user-'+name,'PUT','/user',{n:'Owned R71 '+suffix+' '+name,p:'Owned permissions password'},201)).rawText);
 for(const name of ['A','B'])workspaces.push((await request('create-workspace-'+name,'PUT','/workspace',{name:'Owned R71 '+suffix+' '+name},201)).rawText);
 assert.ok(users.every(id=>/^\d+$/.test(id)&&!JSON.parse(baselineUsers).some(u=>String(u.id)===id)));
 assert.ok(workspaces.every(id=>/^\d+$/.test(id)&&!JSON.parse(baselineWorkspaces).some(w=>String(w.id)===id)));
 await request('workspace-empty-selected-seed','PATCH','/workspace/'+workspaces[0]+'/users',{u:[{id:users[0],role:'\0'},{id:users[1],role:'RO'}]});
 let matrix=(await request('workspace-matrix-seeded','GET','/workspace/'+workspaces[0]+'/users')).value;
 assert.deepEqual(matrix.find(r=>String(r.id)===users[0]),{id:Number(users[0]),name:'Owned R71 '+suffix+' A',selected:true,role:''});
 await request('workspace-opaque-roundtrip','PATCH','/workspace/'+workspaces[0]+'/users',{u:matrix.map(row=>({id:String(row.id),role:String(row.id)===users[1]?'RW':row.selected?(row.role===''?'\0':row.role):''}))});
 matrix=(await request('workspace-matrix-after','GET','/workspace/'+workspaces[0]+'/users')).value;
 assert.equal(matrix.find(r=>String(r.id)===users[0]).selected,true);assert.equal(matrix.find(r=>String(r.id)===users[0]).role,'');assert.equal(matrix.find(r=>String(r.id)===users[1]).role,'RW');
 await request('user-empty-selected-seed','PATCH','/user/'+users[0]+'/workspaces',{ws:[{id:workspaces[0],role:'\0'},{id:workspaces[1],role:'RO'}]});
 matrix=(await request('user-matrix-seeded','GET','/user/'+users[0]+'/workspaces')).value;
 await request('user-opaque-roundtrip','PATCH','/user/'+users[0]+'/workspaces',{ws:matrix.map(row=>({id:String(row.id),role:String(row.id)===workspaces[1]?'RW':row.selected?(row.role===''?'\0':row.role):''}))});
 matrix=(await request('user-matrix-after','GET','/user/'+users[0]+'/workspaces')).value;
 assert.equal(matrix.find(r=>String(r.id)===workspaces[0]).selected,true);assert.equal(matrix.find(r=>String(r.id)===workspaces[0]).role,'');assert.equal(matrix.find(r=>String(r.id)===workspaces[1]).role,'RW');success=true;
}finally{
 if(token){
  if(users.length)await request('cleanup-owned-users','DELETE','/users',{u:users,p:password});
  if(workspaces.length)await request('cleanup-owned-workspaces','DELETE','/workspaces',{ws:workspaces,p:password});
  assert.equal((await request('users-after','GET','/users')).rawText,baselineUsers);
  assert.equal((await request('workspaces-after','GET','/workspaces')).rawText,baselineWorkspaces);
  for(const [id,before]of baselineGrants??[])assert.equal((await request('baseline-grants-after-'+id,'GET','/workspace/'+id+'/users')).rawText,before);
  await request('root-logout','DELETE','/session',undefined,205);
 }
 const result=redact({verified:success,sourceCommit:'eedae41840cbe90e5547c0211da818bdf620f5aa',sourceReadOnly:true,actualHttpExchanges:rows.length,ownedUsers:users,ownedWorkspaces:workspaces,baselineUsersWorkspacesAndGrantsRestored:true,rows});
 await writeFile(new URL('./observations.json',import.meta.url),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({verified:success,actualHttpExchanges:rows.length,baselineRestored:true}));
}
