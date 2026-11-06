import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const exports={};new Function('exports',ts.transpileModule(readFileSync(new URL('../apps/web/src/app/native-participant/native-unit-restore.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports);
const {restoreNativeUnit:restore}=exports;
const value=()=>({state:{same:'server same',newer:'server newer',untouched:'server only'},dataParts:{same:'server same',newer:'server newer',untouched:null},unitResponseType:'server/type',definition:'{intentionally opaque large definition}',definitionType:'owned',nativeClocks:{version:1,stateClocks:{same:10,newer:20},partClocks:{same:10,newer:20,untouched:1}}});
const entry=(kind,body,originalUnitId='ORIGINAL')=>({kind,originalUnitId,payload:JSON.stringify(body)});
test('pending answers and state use the same independent clocks as the server, including equality, missing fields and null',()=>{
 const server=value(),before=structuredClone(server),pending=[entry('state',{newState:[{key:'same',content:'equal local',timeStamp:10},{key:'newer',content:'older local',timeStamp:19},{key:'new',content:'pending state',timeStamp:11},{key:'zero',content:'not accepted at initial clock',timeStamp:0}]}),entry('response',{timeStamp:10,dataParts:{same:'equal local',newer:'older local',new:null},responseType:'pending/type'})];
 const result=restore(server,pending,'original');assert.deepEqual(result.state,{same:'server same',newer:'server newer',untouched:'server only',new:'pending state'});assert.deepEqual(result.dataParts,{same:'server same',newer:'server newer',untouched:null,new:null});assert.equal(result.unitResponseType,'pending/type');assert.equal(result.definition,server.definition);assert.deepEqual(server,before);assert.equal(Object.hasOwn(result,'nativeClocks'),false);
});
test('an old pending response cannot replace the response type or answer from a newer remote edit',()=>{
 const result=restore(value(),[entry('response',{timeStamp:9,dataParts:{same:'old'},responseType:'old/type'})],'ORIGINAL');assert.equal(result.dataParts.same,'server same');assert.equal(result.unitResponseType,'server/type');
});
test('missing response fields admit signed clocks as on the server and prototype-shaped keys remain ordinary data',()=>{
 const body=JSON.parse('{"timeStamp":-1,"dataParts":{"__proto__":"exact Ω"},"responseType":"signed"}');const result=restore(value(),[entry('response',body)],'ORIGINAL');assert.equal(Object.getPrototypeOf(result.dataParts),Object.prototype);assert.equal(Object.getOwnPropertyDescriptor(result.dataParts,'__proto__').value,'exact Ω');assert.equal(result.unitResponseType,'signed');
});
test('foreign original Unit packets are ignored and unsupported/malformed clocks fail instead of guessing',()=>{
 const packet=entry('response',{timeStamp:30,dataParts:{same:'foreign'},responseType:'foreign'},'OTHER');assert.equal(restore(value(),[packet],'ORIGINAL').dataParts.same,'server same');
 for(const nativeClocks of [undefined,{version:2,stateClocks:{},partClocks:{}},{version:1,stateClocks:{a:NaN},partClocks:{}}])assert.throws(()=>restore({...value(),nativeClocks},[],'ORIGINAL'),/clocks unavailable/);
});
