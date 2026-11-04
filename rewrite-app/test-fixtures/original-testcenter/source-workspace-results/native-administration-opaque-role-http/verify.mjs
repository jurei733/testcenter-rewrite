import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
const directory=new URL('./',import.meta.url),hash=b=>createHash('sha256').update(b).digest('hex');
export async function verifyOpaqueRoleEvidence(live=false){
 const manifest=JSON.parse(await readFile(new URL('manifest.json',directory)));
 for(const [name,digest]of Object.entries(manifest.files))assert.equal(hash(await readFile(new URL(name,directory))),digest,name);
 const data=JSON.parse(await readFile(new URL('observations.json',directory))),runtime=JSON.parse(await readFile(new URL('runtime-verification.json',directory)));
 assert.equal(data.verified,true);assert.equal(data.sourceCommit,'eedae41840cbe90e5547c0211da818bdf620f5aa');assert.equal(runtime.sourceCommit,data.sourceCommit);
 assert.equal(data.actualHttpExchanges,24);assert.equal(data.rows.length,24);assert.equal(data.sourceReadOnly,true);assert.equal(data.baselineUsersWorkspacesAndGrantsRestored,true);
 const row=label=>{const rows=data.rows.filter(r=>r.label===label);assert.equal(rows.length,1,label);return rows[0];};
 const value=label=>JSON.parse(row(label).rawText);
 assert.equal(row('root-login').method,'PUT');assert.equal(row('root-logout').status,205);
 for(const family of ['workspace','user']){
  const field=family==='workspace'?'u':'ws',target=family==='workspace'?data.ownedUsers[0]:data.ownedWorkspaces[0];
  assert.equal(row(family+'-empty-selected-seed').body[field][0].role,'\0');
  const seeded=value(family+'-matrix-seeded').find(r=>String(r.id)===target);assert.equal(seeded.selected,true);assert.equal(seeded.role,'');
  assert.equal(row(family+'-opaque-roundtrip').body[field].find(r=>r.id===target).role,'\0');
  const after=value(family+'-matrix-after').find(r=>String(r.id)===target);assert.equal(after.selected,true);assert.equal(after.role,'');
  const edited=family==='workspace'?data.ownedUsers[1]:data.ownedWorkspaces[1];
  assert.equal(value(family+'-matrix-seeded').find(r=>String(r.id)===edited).role,'RO');
  assert.equal(value(family+'-matrix-after').find(r=>String(r.id)===edited).role,'RW');
 }
 for(const family of ['users','workspaces'])assert.equal(row(family+'-before').rawText,row(family+'-after').rawText);
 const baselineUsers=new Set(value('users-before').map(r=>String(r.id))),baselineWorkspaces=new Set(value('workspaces-before').map(r=>String(r.id)));
 assert.equal(data.ownedUsers.length,2);assert.equal(data.ownedWorkspaces.length,2);
 for(const id of data.ownedUsers)assert.ok(!baselineUsers.has(id));for(const id of data.ownedWorkspaces)assert.ok(!baselineWorkspaces.has(id));
 for(const id of baselineWorkspaces)assert.equal(row('baseline-grants-'+id).rawText,row('baseline-grants-after-'+id).rawText);
 assert.deepEqual(row('cleanup-owned-users').body.u,data.ownedUsers);assert.deepEqual(row('cleanup-owned-workspaces').body.ws,data.ownedWorkspaces);
 for(const r of data.rows){
  assert.equal(r.status,r.label.startsWith('create-')?201:r.label==='root-logout'?205:200);
  if(r.method==='PATCH'){const allowed=r.path.startsWith('/workspace/')?data.ownedWorkspaces:data.ownedUsers;assert.ok(allowed.includes(r.path.split('/')[2]));}
 }
 if(live){
  const output=execFileSync(process.execPath,[fileURLToPath(new URL('../native-workspace-permissions-http/verify.mjs',directory))],{encoding:'utf8',env:process.env});
  assert.deepEqual(JSON.parse(output),runtime);
 }
 return {verified:true,sourceCommit:data.sourceCommit,observationSha256:manifest.files['observations.json'],actualHttpExchanges:24,
  bothNativeMatrixDirections:true,selectedEmptyOpaqueMembershipRetained:true,unrelatedRoleEditApplied:true,baselineUsersWorkspacesAndGrantsRestored:true,liveSourceReverified:live};
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)console.log(JSON.stringify(await verifyOpaqueRoleEvidence(true)));
