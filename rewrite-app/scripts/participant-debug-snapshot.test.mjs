import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import {resolveRoutePath} from '@testcenter-rewrite-app/contracts';
import {participantDebugStateRoute} from '@testcenter-rewrite-app/contracts/participant-debug';
const source=readFileSync(new URL('../apps/web/src/app/participant-debug-snapshot.ts',import.meta.url),'utf8');
const ast=ts.createSourceFile('snapshot.ts',source,ts.ScriptTarget.Latest,true);
const declarations=ast.statements.filter(ts.isVariableStatement).flatMap(statement=>[...statement.declarationList.declarations]);
const reader=declarations.find(declaration=>declaration.name.getText(ast)==='readParticipantDebugSnapshot');
const code=ts.transpileModule(`export const load=(resolveRoutePath,participantDebugStateRoute,readParticipantSessionCredential,withSelectedParticipantRun,fetch)=>(${reader.initializer.getText(ast)});`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {load}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const run={tenantId:'owned',workspaceId:'owned',participantSessionId:'owned-session',testRunId:'owned-run',contentReleaseId:'owned-release',bookletKey:'owned-booklet'};
const payload=()=>({debugState:{scope:{...run},booklet:{bookletKey:run.bookletKey,unitEntries:[{unitKey:'unit',unitDefinition:'owned'}]},variables:[],states:[]}});
function fixture({token='owned-credential',reply=payload(),status=200}={}){
 const calls=[],controller=new AbortController();
 const read=load(resolveRoutePath,participantDebugStateRoute,()=>token,(path,id)=>path+`?testRunId=${id}`,async(url,options)=>{
  calls.push({url,options});return {ok:status===200,status,json:async()=>reply};
 });
 return {calls,controller,read:()=>read({testRun:run},controller.signal)};
}
test('the browser reads only the exact authorized Run and keeps its abort signal and no-store policy',async()=>{
 const f=fixture(),snapshot=await f.read();assert.deepEqual(snapshot,payload().debugState);assert.equal(f.calls[0].url,'/api/v1/participant/sessions/owned-session/debug-state?testRunId=owned-run');
 assert.equal(f.calls[0].options.signal,f.controller.signal);assert.equal(f.calls[0].options.cache,'no-store');assert.equal(f.calls[0].options.headers.authorization,'Bearer owned-credential');
});
for(const key of Object.keys(run))test(`a snapshot for another ${key} cannot expose diagnostics`,async()=>{
 const reply=payload();reply.debugState.scope[key]='foreign';await assert.rejects(fixture({reply}).read(),/selected Run/);
});
for(const change of [reply=>reply.debugState.booklet.bookletKey='foreign',reply=>reply.debugState.booklet.unitEntries=null,reply=>reply.debugState.variables=null,reply=>reply.debugState.states=null])test('malformed snapshot structure cannot enter the pane',async()=>{
 const reply=payload();change(reply);await assert.rejects(fixture({reply}).read(),/selected Run/);
});
for(const status of [401,404,409,500])test(`HTTP ${status} exposes no cached debug state`,async()=>{await assert.rejects(fixture({status}).read(),new RegExp(String(status)));});
test('a signed-out session cannot fall back to an unauthenticated read',async()=>{const f=fixture({token:null});await assert.rejects(f.read(),/signed out/);assert.equal(f.calls.length,0);});
