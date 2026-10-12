import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const source=readFileSync(new URL('../apps/web/src/app/participant-debug-control.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {createParticipantDebugControl:create,applyParticipantDebugArguments:apply,participantDebugWindows:windows}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const scope={tenantId:'owned',workspaceId:'owned',participantSessionId:'owned-session',testRunId:'owned-run'};
function fixture({production=true,saved,tc,window:shared}={}){
 const values=new Map(saved===undefined?[]:[['tc-debug',saved]]);
 const window=shared??{tc,localStorage:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)}};
 const changes=[],logs=[],native=[];let selected={...scope};
 const control=create({window,isProductionMode:production,readScope:()=>selected,changed:state=>changes.push(state),consoleCommand:args=>logs.push([...args]),nativeCommand:(keyword,args)=>native.push({keyword,args})});
 return {window,values,changes,logs,native,control,select:next=>{selected=next;control.observeScope();},state:()=>changes.at(-1)};
}
for(const production of [false,true]) for(const saved of [undefined,'["tools","main"]','[]']){
 test(`${production?'production':'development'} restores ${saved??'no key'} only on controller creation`,()=>{
  const f=fixture({production,saved});try{
   assert.equal(f.state().enabled,!production&&Boolean(saved));
   if(saved)assert.deepEqual(f.state().activeWindows,JSON.parse(saved));
   f.window.tc.debug();assert.equal(f.state().enabled,true);assert.deepEqual(f.state().activeWindows,['main']);
   assert.equal(f.values.get('tc-debug'),'["main"]');assert.deepEqual(f.logs,[[]]);
   f.control.observeScope();assert.equal(f.state().enabled,true,'The same controller must not close a manually enabled pane.');
  }finally{f.control.stop();}
 });
}
for(const args of [[],['on'],['OFF'],['off'],['Off','ignored'],[' off ']]){
 test(`Source debug argument ${JSON.stringify(args)} preserves exact off matching`,()=>{
  const f=fixture();try{f.window.tc.debug(args);const enabled=!args.length||args[0].toLowerCase()!=='off';
   assert.equal(f.state().enabled,enabled);assert.equal(f.values.has('tc-debug'),enabled);assert.deepEqual(f.logs,[args]);
  }finally{f.control.stop();}
 });
}
test('all ten window toggles, closing the last window and re-enabling preserve Source preferences',()=>{
 const f=fixture();try{f.window.tc.debug();for(const id of windows.slice(1))f.control.toggleWindow(id);
  assert.deepEqual(f.state().activeWindows,[...windows]);assert.deepEqual(JSON.parse(f.values.get('tc-debug')),[...windows]);
  for(const id of windows)f.control.closeWindow(id);assert.equal(f.state().enabled,true);assert.equal(f.values.get('tc-debug'),'[]');
  f.control.toggleWindow('tools');f.control.toggleWindow('main');assert.deepEqual(f.state().activeWindows,['tools','main']);
  f.window.tc.debug();assert.deepEqual(f.state().activeWindows,['main']);
 }finally{f.control.stop();}
});
test('scoped remote commands never duplicate the native-console log',()=>{
 const f=fixture();try{apply([],scope);assert.equal(f.state().enabled,true);assert.deepEqual(f.logs,[]);
  apply(['off'],scope);assert.equal(f.state().enabled,false);
  for(const key of Object.keys(scope))assert.throws(()=>apply([],{...scope,[key]:'foreign'}),error=>error.retryable===true);
  assert.equal(f.state().enabled,false);
 }finally{f.control.stop();}
});
test('a replaced controller cannot apply a late command for its old Run',()=>{
 const f=fixture();try{f.window.tc.debug();f.select({...scope,testRunId:'next-run'});assert.equal(f.state().enabled,false);
  assert.throws(()=>apply([],scope),error=>error.retryable===true);apply([],{...scope,testRunId:'next-run'});assert.equal(f.state().enabled,true);
  f.select(null);f.window.tc.debug();assert.equal(f.state().enabled,false);assert.deepEqual(f.logs,[[]]);
 }finally{f.control.stop();}
});
test('the global console method targets the latest selected controller in its own Window',()=>{
 const first=fixture(),second=fixture();try{first.window.tc.debug();assert.equal(first.state().enabled,true);assert.equal(second.state().enabled,false);
  const replacement=fixture({window:first.window});try{first.window.tc.debug(['off']);assert.equal(replacement.state().enabled,false);assert.equal(first.state().enabled,true);
   assert.deepEqual(replacement.logs,[['off']]);assert.deepEqual(first.logs,[[]]);replacement.control.stop();first.window.tc.debug(['off']);assert.equal(first.state().enabled,false);
  }finally{replacement.control.stop();}
 }finally{first.control.stop();second.control.stop();}
});
for(const tc of [undefined,7,{pause:()=>{},debug:()=>{}}])test(`cleanup restores the previous console binding (${typeof tc})`,()=>{
 const previous=Object.getOwnPropertyDescriptor(tc??{},'debug'),f=fixture({tc});f.control.stop();
 assert.equal(f.window.tc,tc);if(tc&&typeof tc==='object')assert.deepEqual(Object.getOwnPropertyDescriptor(tc,'debug'),previous);
 assert.throws(()=>apply([],scope));
});
test('cleanup preserves a subsequent third-party console replacement',()=>{
 const original={pause:()=>{}},f=fixture({tc:original}),replacement=()=>{};f.window.tc.debug=replacement;f.control.stop();
 assert.equal(f.window.tc,original);assert.equal(f.window.tc.debug,replacement);assert.equal(f.window.tc.pause,original.pause);
});
test('denied storage, malformed preferences and malformed arguments do not corrupt controller scope',()=>{
 for(const saved of ['broken','{}','["foreign"]']){const f=fixture({saved,production:false});try{
  for(const args of [null,'off',[null],[42]]){f.window.tc.debug(args);assert.deepEqual(f.logs,[]);}
 }finally{f.control.stop();}}
 const window={get localStorage(){throw new Error('Denied storage');}},f=fixture({window});try{window.tc.debug();assert.equal(f.state().enabled,true);window.tc.debug(['off']);assert.equal(f.state().enabled,false);}finally{f.control.stop();}
});
test('all four native keywords dispatch only to the latest owner and do not toggle or log Debug',()=>{
 const first=fixture(),second=fixture({window:first.window});try{
  for(const keyword of ['pause','resume','terminate','goto']){const args=['Exact Ω'];first.window.tc[keyword](args);args[0]='mutated';}
  assert.deepEqual(second.native,['pause','resume','terminate','goto'].map(keyword=>({keyword,args:['Exact Ω']})));
  assert.deepEqual(first.native,[]);assert.deepEqual(first.logs,[]);assert.equal(first.state().enabled,false);
  second.select(null);first.window.tc.pause();assert.equal(second.native.length,4);assert.deepEqual(first.native,[]);
  second.control.stop();first.window.tc.resume();assert.deepEqual(first.native,[{keyword:'resume',args:[]}]);
 }finally{first.control.stop();second.control.stop();}
});
test('cleanup restores every prior native descriptor and preserves independently replaced methods',()=>{
 const old={pause:()=>{},resume:()=>{},terminate:()=>{},goto:()=>{}},descriptors=Object.getOwnPropertyDescriptors(old);
 const f=fixture({tc:old}),replacement=()=>{};f.window.tc.goto=replacement;f.control.stop();
 for(const key of ['pause','resume','terminate'])assert.deepEqual(Object.getOwnPropertyDescriptor(old,key),descriptors[key]);
 assert.equal(old.goto,replacement);assert.equal(Object.hasOwn(old,'debug'),false);
});
