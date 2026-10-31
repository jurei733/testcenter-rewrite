import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
await import('@angular/compiler');
const {DecimalPipe}=await import('@angular/common');
const source=await readFile(new URL('../apps/web/src/app/native-monitor/native-monitor-number.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {formatNativeMonitorMinutes}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('native Monitor minute labels retain actual Angular number:1.0-0 grouping and rounding across timer boundaries',()=>{
 const original=new DecimalPipe('en-US');for(const value of [0,.001,.49,.5,.501,1,1.5,2.5,5,59.49,59.5,60,99.99,999.5,1000,10000,86400])assert.equal(formatNativeMonitorMinutes(value),original.transform(value,'1.0-0'),String(value));
});
