import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
await import('@angular/compiler');
const {KeyValuePipe}=await import('@angular/common');
const {ɵdefaultKeyValueDiffers}=await import('@angular/core');
const load=async path=>{let s=await readFile(new URL('../apps/web/src/app/native-monitor/'+path,import.meta.url),'utf8');const code=ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));};
const {NativeMonitorEntriesView}=await load('native-monitor-entries.pipe.ts');
const {CustomtextPipe}=await load('shared/pipes/customtext/customtext.pipe.ts');
test('native record views match actual Angular KeyValuePipe through sorting, in-place changes and comparator changes',()=>{
 const source=new KeyValuePipe(ɵdefaultKeyValueDiffers),view=new NativeMonitorEntriesView();
 const value={z:{label:'z'},a:{label:'a'},'20':{label:'20'},'3':{label:'3'}};
 const check=compare=>assert.deepEqual(view.transform(value,compare),source.transform(value,compare));
 check();const first=view.transform(value);assert.equal(view.transform(value),first);value.a.label='updated';check();assert.equal(view.transform(value),first);
 value.b={label:'b'};check();delete value.z;check();value.a={label:'new reference'};check();
 const descending=(a,b)=>a.key<b.key?1:a.key>b.key?-1:0;check(descending);check(null);check();
 const other={other:'value'};const before=view.transform(value);view.transform(other);assert.equal(view.transform(value),before,'another record must not invalidate existing entries');
 assert.equal(view.transform(null),source.transform(null));assert.equal(view.transform(undefined),source.transform(undefined));
});
test('native custom texts keep Source fallback, sequential replacements and current access values',()=>{
 const values={text:'Block %s: %s',date:'Zeit %date',empty:''};const pipe=new CustomtextPipe({getCustomText:key=>values[key]??null});
 assert.equal(pipe.transform('fallback','text',1,'zwei'),'Block 1: zwei');assert.equal(pipe.transform('fallback','empty'),'fallback');assert.equal(pipe.transform('fallback','missing'),'fallback');
 const date='2026-10-28T12:00:00Z';assert.equal(pipe.transform('fallback','date',date),'Zeit '+new Date(date).toLocaleString());values.text='Aktuell %s';assert.equal(pipe.transform('fallback','text','neu'),'Aktuell neu');
});
test('all rendered native SVG glyphs match the hash-bound Original icon asset exactly',async()=>{
 const {createHash}=await import('node:crypto');const {DOMParser}=await import('@xmldom/xmldom');
 const manifest=JSON.parse(await readFile(new URL('../docs/NATIVE-MONITOR-SOURCE.json',import.meta.url),'utf8'));
 const asset=await readFile(new URL('../apps/web/src/assets/native-monitor-icons.svg',import.meta.url));assert.equal(createHash('sha256').update(asset).digest('hex'),manifest.files['frontend/src/assets/icons/material-icons.svg']);
 const source=await readFile(new URL('../apps/web/src/app/native-monitor/native-monitor-icon.component.ts',import.meta.url),'utf8');const ast=ts.createSourceFile('icon.ts',source,ts.ScriptTarget.Latest,true);let rendered;
 const visit=node=>{if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='glyphs')rendered=JSON.parse(node.initializer.getText(ast));ts.forEachChild(node,visit);};visit(ast);
 const doc=new DOMParser().parseFromString(asset.toString(),'image/svg+xml'),expected={};for(const node of Array.from(doc.getElementsByTagName('symbol')))expected[node.getAttribute('id')]={viewBox:node.getAttribute('viewBox'),paths:Array.from(node.getElementsByTagName('path')).map(path=>path.getAttribute('d'))};
 assert.equal(Object.keys(expected).length,69);assert.deepEqual(rendered,expected);
});
