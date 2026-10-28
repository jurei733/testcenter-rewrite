import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
async function methods(path,names){
 const source=readFileSync(new URL(path,import.meta.url),'utf8'),ast=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true);
 const declaration=ast.statements.find(ts.isClassDeclaration);assert.ok(declaration);
 const text='export class Actual { '+declaration.members.filter(member=>names.includes(member.name?.getText(ast))).map(member=>member.getText(ast).replace(/@HostListener\([^\n]*\)\s*/g,'')).join('\n')+' }';
 return (await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,experimentalDecorators:true}}).outputText).toString('base64'))).Actual;
}
const Combobox=await methods('../apps/web/src/app/participant-debug-pane.component.ts',['openCustomTextOptions','selectCustomText','customTextKeydown']);
const combo=()=>{
 const value=new Combobox(),scrolled=[];let focus=0,prevented=0;
 const input={getBoundingClientRect:()=>({bottom:120,left:20,width:300}),focus:()=>focus++,ownerDocument:{getElementById:id=>({scrollIntoView:options=>scrolled.push({id,options})})}};
 Object.assign(value,{customTextKeys:['first','middle','last'],customTextOptionIndex:-1,customTextOptionsOpen:false,searchCustomText:''});
 const key=key=>value.customTextKeydown({key,target:input,preventDefault:()=>prevented++});
 return {value,input,key,scrolled,focus:()=>focus,prevented:()=>prevented};
};
test('custom text autocomplete opens at the actual input and supports first/last/wrapped keyboard choices',()=>{
 const f=combo();f.value.openCustomTextOptions({target:f.input});assert.deepEqual(f.value.customTextOptionsPosition,{top:120,left:20,width:300});
 assert.equal(f.value.customTextOptionIndex,-1);f.key('ArrowDown');assert.equal(f.value.customTextOptionIndex,0);f.key('ArrowUp');assert.equal(f.value.customTextOptionIndex,2);
 f.key('ArrowDown');assert.equal(f.value.customTextOptionIndex,0);f.key('Enter');assert.equal(f.value.searchCustomText,'first');assert.equal(f.value.customTextOptionsOpen,false);assert.equal(f.focus(),1);
 f.value.openCustomTextOptions({target:f.input});f.key('ArrowUp');assert.equal(f.value.customTextOptionIndex,2);f.key('Enter');assert.equal(f.value.searchCustomText,'last');
 assert.ok(f.scrolled.every(item=>item.options.block==='nearest'));
});
for(const key of ['Tab','Escape'])test(`${key} closes custom text suggestions without selecting a token`,()=>{
 const f=combo();f.value.openCustomTextOptions({target:f.input});f.key('ArrowDown');f.key(key);assert.equal(f.value.customTextOptionsOpen,false);assert.equal(f.value.searchCustomText,'');
});
test('native autocomplete selection updates the search and an empty token list does not produce an invalid selection',()=>{
 const f=combo();f.value.openCustomTextOptions({target:f.input});f.value.selectCustomText('middle');assert.equal(f.value.searchCustomText,'middle');assert.equal(f.value.customTextOptionsOpen,false);
 f.value.customTextKeys=[];f.value.customTextOptionIndex=-1;f.key('ArrowDown');f.key('ArrowUp');f.key('Enter');assert.equal(f.value.searchCustomText,'middle');assert.equal(f.value.customTextOptionIndex,-1);
});
const Drag=await methods('../apps/web/src/app/participant-debug-drag.directive.ts',['begin','move','end']);
// HostListener decorators are irrelevant to the method body; supply only their no-op adapter.
const drag=()=>{
 const value=new Drag(),captured=new Set(),element={style:{},setPointerCapture:id=>captured.add(id),hasPointerCapture:id=>captured.has(id),releasePointerCapture:id=>captured.delete(id)};
 Object.assign(value,{element,start:null,offsetX:0,offsetY:0});
 const event=(extra={})=>({pointerId:1,isPrimary:true,button:0,clientX:10,clientY:20,target:{closest:()=>null},preventDefault(){},...extra});
 return {value,element,captured,event};
};
test('window dragging uses the captured pointer, preserves cumulative offsets and releases on cancellation',()=>{
 const f=drag();f.value.begin(f.event());assert.equal(f.captured.has(1),true);
 f.value.move(f.event({pointerId:2,clientX:999,clientY:999}));assert.equal(f.element.style.transform,undefined);
 f.value.move(f.event({clientX:40,clientY:60}));assert.equal(f.element.style.transform,'translate3d(30px,40px,0)');
 f.value.end(f.event({pointerId:2}));assert.equal(f.captured.has(1),true);f.value.end(f.event());assert.equal(f.captured.size,0);
 f.value.begin(f.event({clientX:40,clientY:60}));f.value.move(f.event({clientX:45,clientY:70}));assert.equal(f.element.style.transform,'translate3d(35px,50px,0)');f.value.end(f.event());
});
for(const extra of [{button:1},{isPrimary:false},{target:{closest:()=>({})}}])test(`window drag leaves interactive controls or other pointers alone: ${JSON.stringify(extra)}`,()=>{
 const f=drag();f.value.begin(f.event(extra));assert.equal(f.captured.size,0);assert.equal(f.value.start,null);
});
test('a second active pointer cannot replace the drag owner',()=>{
 const f=drag();f.value.begin(f.event());f.value.begin(f.event({pointerId:2}));assert.deepEqual([...f.captured],[1]);assert.equal(f.value.start.id,1);f.value.end(f.event());
});
