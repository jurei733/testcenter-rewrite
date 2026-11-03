import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const compile=path=>ts.transpileModule(readFileSync(new URL('../apps/web/src/app/'+path,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
const routing={};new Function('exports',compile('owned-error-routing.ts'))(routing);
const {ownAsyncError,dispatchOwnedError}=routing;
function fixture(t){
 const captures=[],logs=[],exports={};t.mock.method(console,'error',error=>logs.push(error));
 new Function('exports','require',compile('global-error-handler.ts'))(exports,name=>name==='@angular/core'?{Injectable:()=>value=>value,inject:()=>({capture:error=>captures.push(error)})}:routing);
 return {handler:new exports.GlobalErrorHandler(),captures,logs};
}
test('an owned async error reaches its original handler once, including Angular promise wrappers',t=>{
 const f=fixture(t),received=[],error=ownAsyncError(Error('owned'),()=>received.push('actor A'));
 f.handler.handleError({promise:Promise.resolve(),rejection:error});f.handler.handleError(error);
 assert.deepEqual(received,['actor A']);assert.deepEqual(f.captures,[]);assert.deepEqual(f.logs,[]);
});
test('a late retired-owner error cannot reach a replacement owner or the canonical bug-report buffer',t=>{
 const f=fixture(t),received=[];let current=true;
 const error=ownAsyncError(Error('private old actor context'),()=>{if(current)received.push('old actor');});
 current=false;f.handler.handleError(error);assert.deepEqual(received,[]);assert.deepEqual(f.captures,[]);assert.deepEqual(f.logs,[]);
});
test('unowned canonical errors retain their existing capture and console path',t=>{
 const f=fixture(t),error=Error('canonical');f.handler.handleError(error);assert.deepEqual(f.captures,[error]);assert.deepEqual(f.logs,[error]);
});
test('cyclic foreign rejection wrappers are not treated as owned errors',()=>{
 const a={},b={rejection:a};a.rejection=b;assert.equal(dispatchOwnedError(a),false);
});
