import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {readOriginalWorkspaceName,originalWorkspaceNameParameter,originalWorkspaceStoredName} from './original-workspace-directory-name.js';
import {decodeOriginalTestLogJson} from './original-test-log-json.js';
import {originalParticipantGroupKeysEqual} from './original-participant-group.js';

type Row={label:string;status:number;requestBody?:unknown;rawText:string;value:unknown};
const folder='test-fixtures/original-testcenter/source-workspace-results/native-workspace-directory-crud-http/';
const bytes=readFileSync(folder+'observations.json');
const manifest=JSON.parse(readFileSync(folder+'manifest.json','utf8')) as {files:Record<string,string>};
const proof=JSON.parse(readFileSync(folder+'independent-verification.json','utf8')) as {verified:boolean;observationSha256:string;actualHttpExchanges:number};
const digest=createHash('sha256').update(bytes).digest('hex');
assert.equal(digest,manifest.files['observations.json']);assert.equal(digest,proof.observationSha256);
assert.equal(proof.verified,true);assert.equal(proof.actualHttpExchanges,231);
const evidence=JSON.parse(bytes.toString()) as {verified:boolean;baselineRestored:boolean;rows:Row[]};
assert.equal(evidence.verified,true);assert.equal(evidence.baselineRestored,true);
const labels=['missing','null','false','true','zero-number','one-number','empty','zero-string','spaces','tab','normal','duplicate',
 'lowercase','leading-space','trailing-space','unicode','ascii-80','ascii-255','ascii-256','unicode-255','unicode-256','nul','array',
 'object','ascii-50','ascii-51','unicode-50','unicode-51','over-limit-trailing-spaces','over-limit-leading-spaces','nul-only',
 'empty-array','negative-number','fraction-number','extra-field','array-body','null-body','string-body'];
const row=(label:string):Row=>{const value=evidence.rows.find(row=>row.label===label);assert.ok(value,label);return value;};
for(const operation of ['create','rename'] as const)for(const label of labels){
 const source=row(operation+'-'+label);
 test(`native workspace ${operation} name follows actual Source HTTP ${label} (${source.status})`,()=>{
  const body=decodeOriginalTestLogJson(JSON.stringify(source.requestBody));
  const evaluate=()=>{
   const parameter=originalWorkspaceNameParameter(readOriginalWorkspaceName(body,operation));
   return{...parameter,value:originalWorkspaceStoredName(parameter.parameter)};
  };
  if(source.status===400||source.status===500){
   assert.throws(evaluate,(error:unknown)=>{
    assert.equal((error as {statusCode:number}).statusCode,source.status);
    assert.equal((error as Error).message,source.rawText);return true;
   });
  }else{
   const prepared=evaluate();
   if(source.status===201||source.status===200){
    const after=row('after-'+operation+'-'+label).value as Array<{id:number;name:string}>;
    const id=operation==='create'?source.rawText:row('create-anchor').rawText;
    assert.equal(prepared.value,after.find(workspace=>String(workspace.id)===id)?.name);
   }else{
    assert.equal(source.status,409);
    assert.equal(source.rawText,'Workspace with name `'+prepared.source+'` already exists!');
   }
  }
 });
}
test('duplicate lookup retains the actual unbounded PDO parameter before varchar storage',()=>{
 const prepared=originalWorkspaceNameParameter(readOriginalWorkspaceName(decodeOriginalTestLogJson('{"name":"'+'c'.repeat(50)+'  "}'),'create'));
 assert.equal(prepared.parameter,'c'.repeat(50)+'  ');
 assert.equal(originalWorkspaceStoredName(prepared.parameter),'c'.repeat(50));
 assert.equal(originalParticipantGroupKeysEqual(prepared.parameter,'c'.repeat(50)),false);
 const actual=row('after-rename-over-limit-trailing-spaces').value as Array<{id:number;name:string}>;
 const duplicates=actual.filter(workspace=>workspace.name==='c'.repeat(50));
 assert.equal(row('rename-over-limit-trailing-spaces').status,200);
 assert.equal(duplicates.length,2,'The actual Source rename stores a second identical display name after its unbounded lookup.');
 assert.notEqual(duplicates[0]!.id,duplicates[1]!.id,'Native identity must never be recovered by display name.');
});
test('a valid name field is read before a rename-target lookup; object conversion is a later failure',()=>{
 const field=readOriginalWorkspaceName(decodeOriginalTestLogJson('{"name":{"owned":1}}'),'rename');
 assert.ok(field);assert.throws(()=>originalWorkspaceNameParameter(field),error=>(error as {statusCode:number}).statusCode===500);
});
test('lexical signed64 integers and PHP float tokens keep their actual scalar identity',()=>{
 const prepared=(literal:string)=>originalWorkspaceNameParameter(readOriginalWorkspaceName(decodeOriginalTestLogJson('{"name":'+literal+'}'),'create')).parameter;
 assert.equal(prepared('9223372036854775807'),'9223372036854775807');
 assert.equal(prepared('-9223372036854775808'),'-9223372036854775808');
 assert.equal(prepared('1.5'),'1.5');assert.equal(prepared('-0.0'),'-0');
 assert.throws(()=>readOriginalWorkspaceName(decodeOriginalTestLogJson('{"name":-0.0}'),'rename'),error=>(error as {statusCode:number}).statusCode===400);
});
test('inherited fields and malformed Unicode cannot become native directory names',()=>{
 assert.throws(()=>readOriginalWorkspaceName(Object.create({name:'inherited'}),'create'),error=>(error as {statusCode:number}).statusCode===400);
 assert.throws(()=>originalWorkspaceNameParameter('\ud800'),error=>(error as {statusCode:number}).statusCode===500);
 assert.throws(()=>decodeOriginalTestLogJson('{"name":"\\ud800"}'),SyntaxError);
});
