import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';

// Read-only verifier. A frozen receipt cannot be replaced by a later run.
const root=new URL('./',import.meta.url),hash=data=>createHash('sha256').update(data).digest('hex');
const bytes=await readFile(new URL('observations.json',root)),source=JSON.parse(bytes);
const manifestBytes=await readFile(new URL('manifest.json',root)),manifest=JSON.parse(manifestBytes);
for(const[name,digest]of Object.entries(manifest.files))assert.equal(hash(await readFile(new URL(name,root))),digest,name);
const runtime=JSON.parse(execFileSync(process.execPath,[new URL('../native-workspace-permissions-http/verify.mjs',root).pathname],{encoding:'utf8',env:process.env}));
assert.equal(source.verified,true);assert.equal(source.baselineRestored,true);assert.equal(source.ownedHttpCreatedIdentitiesOnly,true);assert.equal(source.sqlSeedsOrDaoStubs,false);
assert.equal(source.sourceCommit,'eedae41840cbe90e5547c0211da818bdf620f5aa');assert.equal(source.sourceCommit,runtime.sourceCommit);
assert.deepEqual(source.sourceRuntimeBefore,source.sourceRuntimeAfter);assert.deepEqual(source.sourceRuntimeAfter,runtime);
assert.equal(Object.keys(source.sourceHashes).length,137);assert.equal(runtime.composerPackages,19);assert.equal(source.actualHttpExchanges,210);assert.equal(source.rows.length,210);
assert.equal(new Set(source.rows.map(row=>row.label)).size,210);
for(const row of source.rows)assert.equal(hash(row.rawText),row.redactedBodySha256,row.label);
const row=label=>{const r=source.rows.find(r=>r.label===label);assert.ok(r,label);return r;};
const removed=new Set(['integer','number','leading-zero','plus','spaces','nul','whole-float']);
for(const family of ['users','workspaces']){
 const baseline=row('baseline-'+family).value,ids=source.createdOwnedIDs[family];
 assert.deepEqual(row('final-'+family).value,baseline);assert.equal(ids.length,25);assert.equal(new Set(ids).size,25);
 assert.ok(ids.every(id=>!baseline.some(r=>String(r.id)===id)));
 for(const[label,code]of [['missing',401],['invalid',403],['reader',403]])assert.equal(row(family+'-auth-'+label).status,code);
 for(const label of ['string','object','false','true','zero'])assert.equal(row(family+'-list-'+label).status,family==='users'?500:400);
 assert.equal(row(family+'-list-before-password').rawText,family==='users'?'Provide Password for security reasons!':'Bad request.');
 assert.equal(row(family+'-list-before-wrong-password').status,family==='users'?403:400);
 for(const label of ['null','false','empty-array','object','empty-string','zero','negative','unknown-max','overflow','underflow','integer','number','leading-zero','plus','spaces',
  'decimal-string','exponent-string','prefix','nul','whole-float','fraction','exact-high-integer','overflow-number']){
  const created=row('create-'+family+'-'+label),after=row(family+'-after-element-'+label).value;
  assert.equal(created.status,201);assert.ok(ids.includes(created.rawText));
  assert.equal(after.some(r=>String(r.id)===created.rawText),!removed.has(label),family+' '+label+' actual deletion outcome');
 }
 for(const label of ['duplicate','partial']){
  const created=row('create-'+family+'-'+label),after=row(family+'-after-'+label).value;
  assert.equal(after.some(r=>String(r.id)===created.rawText),false);
 }
 assert.equal(row(family+'-duplicate').status,200);assert.equal(row(family+'-partial-before-invalid').status,500);
 for(const r of source.rows.filter(r=>r.method==='DELETE'&&r.path==='/'+family)){
  const body=r.rawRequestBody?(()=>{try{return JSON.parse(r.rawRequestBody);}catch{return{};}})():r.requestBody;
  const list=body?.[family==='users'?'u':'ws'];if(!Array.isArray(list))continue;
  for(const value of list){
   assert.notEqual(value,true,'No boolean true element may target baseline ID1.');
   if(typeof value!=='number'&&typeof value!=='string')continue;
   const text=String(value).split('\0',1)[0].trim();if(!/^\+?\d+$/.test(text))continue;
   const id=BigInt(text);if(id>0n)assert.ok(!baseline.some(r=>BigInt(r.id)===id),'Every positive deletion argument excludes baseline identities.');
  }
 }
}
const proof={verified:true,sourceCommit:source.sourceCommit,observationSha256:hash(bytes),manifestSha256:hash(manifestBytes),verifierSha256:hash(await readFile(new URL('./verify.mjs',root))),
 sourceFiles:137,composerPackages:19,actualHttpExchanges:210,backendImage:runtime.backendImage,ownedUsers:25,ownedWorkspaces:25,baselineRestored:true,readOnlyVerification:true,sqlSeedsOrDaoStubs:false,
 sourcePartialDeletionConfirmed:true,rewriteBatchMustRemainAtomic:true,unsafeBaselineProbeExcluded:true,fullOriginalParityProven:false};
const receipt=new URL('independent-verification.json',root);
if(process.argv.includes('--record'))await writeFile(receipt,JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
else assert.deepEqual(JSON.parse(await readFile(receipt)),proof);
console.log(JSON.stringify(proof));
