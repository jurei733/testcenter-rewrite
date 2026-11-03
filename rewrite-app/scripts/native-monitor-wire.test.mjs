import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
const code=await readFile(new URL('../apps/web/src/app/native-monitor/native-monitor-wire.ts',import.meta.url),'utf8');
const output=ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {parseNativeMonitorSnapshot,nativeMonitorSelectionBody}=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'));
const packet=(test='9007199254740993',person='9223372036854775806',state='{}')=>'[{"personId":'+person+',"timestamp":1793210400,"testId":'+test+',"groupName":"Owned","personLabel":"One","testState":'+state+',"unitState":{}}]';
test('native Source integer tokens survive JSON decoding past JS safe integers without UUID substitution or rounding',()=>{
 const text=packet(),rows=parseNativeMonitorSnapshot(text);assert.notEqual(String(JSON.parse(text)[0].testId),rows[0].testId);assert.equal(rows[0].testId,'9007199254740993');assert.equal(rows[0].personId,'9223372036854775806');assert.equal(rows[0].timestamp,1793210400);
 assert.equal(nativeMonitorSelectionBody(rows.map(row=>row.testId),{keyword:'pause',arguments:[],timestamp:1793210400}),'{"keyword":"pause","arguments":[],"timestamp":1793210400,"testIds":[9007199254740993]}');
});
test('Source snapshot state keys named testId/personId do not become transport identities',()=>{
 const rows=parseNativeMonitorSnapshot(packet('5','7','{"testId":"authored","personId":"authored","COUNT":3}'));assert.deepEqual(rows[0].testState,{testId:'authored',personId:'authored',COUNT:3});assert.equal(rows[0].testId,'5');
});
test('literal selection preserves duplicates, recipient order, signed-int64 bounds and independently serialized fields',()=>{
 assert.equal(nativeMonitorSelectionBody(['9223372036854775807','1','1']),'{"testIds":[9223372036854775807,1,1]}');assert.equal(nativeMonitorSelectionBody([],{}),'{"testIds":[]}');
 for(const id of ['0','-1','01','1.0','1e3','9223372036854775808','1],"keyword":"owned"'])assert.throws(()=>nativeMonitorSelectionBody([id]));
});
test('malformed/unsafe numeric token types fail instead of silently changing a target identity',()=>{
 for(const token of ['0','-1','1.0','1e0','9223372036854775808'])assert.throws(()=>parseNativeMonitorSnapshot(packet(token,'1')));
 for(const text of ['null','{}','[{}]','[null]'])assert.throws(()=>parseNativeMonitorSnapshot(text));
});
