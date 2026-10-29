import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as contracts from '@testcenter-rewrite-app/contracts';
import * as capture from '@testcenter-rewrite-app/contracts/participant-response-capture';
import {nativeFocusEvidence} from './participant-native-route-evidence.mjs';

// Execute the production host methods. Stub only Angular's decorator/UI boundary;
// document focus and the clock are controlled to exercise event ordering.
const source=readFileSync(new URL('../apps/web/src/app/verona-player-host.component.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
const decorator=()=>()=>{};
const core={Component:decorator,Input:decorator,Output:decorator,HostListener:decorator,ViewChild:decorator,ViewEncapsulation:{None:0}};
function fixture(){
 let focused=true,hidden=false;const exports={};
 const document={hasFocus:()=>focused,get hidden(){return hidden;}};
 runInNewContext(code,{exports,require:name=>{
  if(name==='@angular/core')return core;
  if(name==='@angular/common')return {CommonModule:class{}};
  if(name==='@testcenter-rewrite-app/contracts')return contracts;
  if(name==='@testcenter-rewrite-app/contracts/participant-response-capture')return capture;
  if(name==='./original-player-navigation.component')return {OriginalPlayerNavigationComponent:class{}};
  throw Error(`Unexpected host dependency: ${name}`);
 },document,Date,setTimeout:(...args)=>setTimeout(...args),clearTimeout:(...args)=>clearTimeout(...args)});
 const host=Object.create(exports.VeronaPlayerHostComponent.prototype),entries=[];
 Object.assign(host,{status:'running',lastFocusLogContent:'HAS',focusLogTimeout:null,testLogEntries:{emit:batch=>entries.push(...batch)}});
 return{host,entries,focus:value=>focused=value,visible:value=>hidden=!value};
}
test('a later application blur supersedes a pending player-focus hint',t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture();
 f.host.scheduleFocusLog(true);f.focus(false);f.host.onWindowBlur();
 t.mock.timers.tick(499);assert.equal(f.entries.length,0);
 t.mock.timers.tick(1);assert.deepEqual(f.entries.map(x=>[x.key,x.content]),[['FOCUS','HAS_NOT']]);
});
test('a later hidden-document event supersedes a pending player-focus hint',t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture();
 f.host.scheduleFocusLog(true);f.focus(false);f.visible(false);f.host.onVisibilityChange();
 t.mock.timers.tick(500);assert.deepEqual(f.entries.map(x=>x.content),['HAS_NOT']);
});
test('a later owned player focus remains authoritative after application blur',t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture();f.host.lastFocusLogContent='HAS_NOT';
 f.focus(false);f.host.onWindowBlur();f.host.scheduleFocusLog(true);
 t.mock.timers.tick(500);assert.deepEqual(f.entries.map(x=>x.content),['HAS']);
});
test('window recovery retains the debounce and duplicate suppression',t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture();f.host.lastFocusLogContent='HAS_NOT';
 f.host.scheduleFocusLog(false);f.host.onWindowFocus();t.mock.timers.tick(500);
 f.host.onWindowFocus();t.mock.timers.tick(500);assert.deepEqual(f.entries.map(x=>x.content),['HAS']);
});
test('focus evidence keeps only bounded focus metadata',()=>{
 const extra={token:'must-be-discarded',answer:'must-be-discarded',url:'must-be-discarded'};
 const probe={platform:'linux',arch:'x64',node:'v22.23.4',browser:'147.0.7727.15',headless:true,focusSaveContents:['HAS_NOT','private','HAS'],...extra};
 const result=nativeFocusEvidence(probe,[{type:'player-focus',at:123,hasFocus:false,hidden:false,trusted:true,hasPlayerFocus:false,...extra}]);
 assert.deepEqual(result,{platform:'linux',arch:'x64',node:'v22.23.4',browser:'147.0.7727.15',headless:true,focusSaveContents:['HAS_NOT','HAS'],events:[{type:'player-focus',at:123,hasFocus:false,hidden:false,trusted:true,hasPlayerFocus:false}]});
 assert.equal(nativeFocusEvidence(probe,Array(150).fill(result.events[0])).events.length,100);
 assert.deepEqual(nativeFocusEvidence({},[{type:'blur',at:Infinity,hasFocus:false,hidden:false},{type:'answer',at:1,hasFocus:false,hidden:false}]).events,[]);
});
