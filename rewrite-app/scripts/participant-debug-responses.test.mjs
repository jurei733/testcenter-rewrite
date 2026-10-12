import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const file='../apps/web/src/app/participant-debug-responses.ts';
const source=readFileSync(new URL(file,import.meta.url),'utf8'),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
const declaration=ast.statements.find(member=>ts.isVariableStatement(member)&&member.declarationList.declarations.some(item=>item.name.getText(ast)==='readParticipantDebugResponses'));
assert.ok(declaration);
const emitted=ts.transpileModule(declaration.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {readParticipantDebugResponses:read}=await import('data:text/javascript;base64,'+Buffer.from(emitted).toString('base64'));
const state={testRun:{testRunId:'selected',unitResponses:{a:'saved-a',b:'saved-b'}},bookletUnits:[{unitKey:'a'},{unitKey:'b'}]};
const sources=()=>({pending:null,optimistic:null,ephemeral:new Map()});
const none=()=>null;
test('log-only queued packets cannot replace local or saved diagnostic answers',()=>{
 const value=sources();value.pending={testRunId:'selected',unitKey:'a',response:'synthetic',logOnly:true};
 const queued=()=>({response:'synthetic-outbox',logOnly:true});
 assert.deepEqual(read(state,value,queued),{a:'saved-a',b:'saved-b'});
 value.optimistic={testRunId:'selected',unitKey:'a',response:'actual-latest'};
 assert.deepEqual(read(state,value,queued),{a:'actual-latest',b:'saved-b'});
});
test('local pending and optimistic Verona captures override stale saved data for their selected Unit only',()=>{
 const value=sources();value.pending={testRunId:'selected',unitKey:'a',response:'offline-a'};
 value.optimistic={testRunId:'selected',unitKey:'b',response:'optimistic-b'};
 assert.deepEqual(read(state,value,none),{a:'offline-a',b:'optimistic-b'});
 value.optimistic={testRunId:'selected',unitKey:'a',response:'old-optimistic-a'};
 assert.deepEqual(read(state,value,none),{a:'offline-a',b:'saved-b'});
});
test('durable outbox captures survive reload and another Run cannot substitute pending, optimistic or outbox data',()=>{
 const value=sources();value.pending={testRunId:'foreign',unitKey:'a',response:'foreign-pending'};
 value.optimistic={testRunId:'foreign',unitKey:'b',response:'foreign-optimistic'};
 const outbox=new Map([['foreign/b',{response:'foreign-outbox'}],['selected/a',{response:'reloaded-a'}]]);
 assert.deepEqual(read(state,value,(run,unit)=>outbox.get(run+'/'+unit)),{a:'reloaded-a',b:'saved-b'});
});
test('non-saving ephemeral captures remain selected and signed-out diagnostics are empty',()=>{
 const value=sources();value.ephemeral.set('selected',new Map([['a','ephemeral']]));value.ephemeral.set('foreign',new Map([['b','foreign']]));
 assert.deepEqual(read(state,value,none),{a:'ephemeral',b:'saved-b'});assert.deepEqual(read(null,value,none),{});
});
