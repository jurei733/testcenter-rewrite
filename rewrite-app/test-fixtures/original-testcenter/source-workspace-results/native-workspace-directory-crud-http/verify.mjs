import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';

// Read-only revalidation. --record creates the first receipt exclusively;
// subsequent verification cannot silently replace a frozen receipt.
const root=new URL('./',import.meta.url),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const bytes=await readFile(new URL('observations.json',root)),data=JSON.parse(bytes);
const manifestBytes=await readFile(new URL('manifest.json',root)),manifest=JSON.parse(manifestBytes);
for(const[name,digest]of Object.entries(manifest.files))assert.equal(hash(await readFile(new URL(name,root))),digest,name);
const runtime=JSON.parse(execFileSync(process.execPath,[new URL('../native-workspace-permissions-http/verify.mjs',root).pathname],{encoding:'utf8',env:process.env}));
assert.equal(data.verified,true);assert.equal(data.baselineRestored,true);assert.equal(data.ownedSyntheticRuntimeOnly,true);
assert.equal(data.sqlSeedsOrDaoStubs,false);assert.equal(data.fullOriginalParityProven,false);
assert.equal(data.sourceCommit,manifest.sourceCommit);assert.equal(data.sourceCommit,runtime.sourceCommit);
assert.deepEqual(data.sourceRuntimeBefore,data.sourceRuntimeAfter);assert.deepEqual(data.sourceRuntimeAfter,runtime);
assert.equal(Object.keys(data.sourceHashes).length,137);assert.equal(runtime.composerPackages,19);
assert.equal(data.rows.length,231);assert.equal(data.actualHttpExchanges,data.rows.length);
assert.equal(new Set(data.rows.map(row=>row.label)).size,data.rows.length);
for(const row of data.rows)assert.equal(hash(row.rawText),row.redactedBodySha256,row.label);
const row=label=>{const result=data.rows.find(row=>row.label===label);assert.ok(result,label);return result;};
const baseline=row('baseline-workspaces').value,baselineUsers=row('baseline-users').value;
assert.deepEqual(row('final-workspaces').value,baseline);assert.deepEqual(row('final-users').value,baselineUsers);
assert.equal(new Set(data.createdOwnedIDs).size,data.createdOwnedIDs.length);
assert.ok(data.createdOwnedIDs.every(id=>!baseline.some(workspace=>String(workspace.id)===id)));
for(const family of ['create','rename','delete']){
 assert.equal(row('missing-'+family).status,401);assert.equal(row('invalid-'+family).status,403);assert.equal(row('non-root-'+family).status,403);
}
for(const[name,status]of [['create-missing',400],['create-null',400],['create-false',201],['create-true',201],['create-duplicate',409],
 ['create-lowercase',409],['create-array',201],['create-object',500],['create-ascii-50',201],['create-ascii-51',500],
 ['create-unicode-50',201],['create-unicode-51',500],['create-over-limit-trailing-spaces',201],['create-over-limit-leading-spaces',500],
 ['rename-zero-string',400],['rename-false',400],['rename-same-name',409],['rename-path-prefix',200],['rename-path-fraction',200],
 ['rename-path-exponent',200],['rename-path-negative',400],['rename-path-word',400],['create-invalid-json',500],['rename-invalid-json',500],
 ['delete-wrong-password',403],['delete-empty',200],['delete-string-list',400],['cleanup-owned-workspaces',200]])assert.equal(row(name).status,status,name);
for(const[name,expected]of [['false',''],['true','1'],['zero-number','0'],['array','Array'],['ascii-50','a'.repeat(50)],
 ['unicode-50','😀'.repeat(50)],['over-limit-trailing-spaces','c'.repeat(50)]]){
 const id=row('create-'+name).rawText;
 assert.equal(row('after-create-'+name).value.find(workspace=>String(workspace.id)===id)?.name,expected,name+' actual stored value');
}
assert.match(row('rename-path-overflow').rawText,/9223372036854775807/);
const container=process.env.ORIGINAL_PERMISSIONS_POSTGRES_CONTAINER;
assert.equal(container,'source-native-workspace-permissions-r65-postgres-1');
const schema=JSON.parse(execFileSync('docker',['exec',container,'psql','-U','source_oracle','-d','source_oracle','-Atc',
 "SELECT json_agg(json_build_object('column',column_name,'type',data_type,'maximumLength',character_maximum_length,'collation',collation_name) ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema='public' AND table_name='workspaces'"],{encoding:'utf8'}));
assert.equal(schema.find(column=>column.column==='id')?.type,'bigint');assert.equal(schema.find(column=>column.column==='name')?.maximumLength,50);
const proof={verified:true,sourceCommit:data.sourceCommit,observationSha256:hash(bytes),manifestSha256:hash(manifestBytes),
 verifierSha256:hash(await readFile(new URL('./verify.mjs',root))),sourceFiles:137,composerPackages:19,actualHttpExchanges:data.rows.length,
 backendImage:runtime.backendImage,baselineRestored:true,readOnlyVerification:true,sqlSeedsOrDaoStubs:false,schema};
const receipt=new URL('independent-verification.json',root);
if(process.argv.includes('--record'))await writeFile(receipt,JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
else assert.deepEqual(JSON.parse(await readFile(receipt)),proof,'The independent receipt must remain frozen.');
console.log(JSON.stringify(proof));
