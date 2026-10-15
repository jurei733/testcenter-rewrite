import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {hasMeaningfulVeronaResponse,parseVeronaUnitResponse} from '@testcenter-rewrite-app/contracts';
const emit=source=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64');
const fixture=JSON.parse(readFileSync(new URL('./fixtures/original-native-command-reference.json',import.meta.url),'utf8'));
assert.equal(fixture.originalCommit,'ee2ab9ab64bd91209ef8534bbe6005838024e46d');
const original=await import(emit(Object.values(fixture.sources).map(value=>value.extracted).join('\n')+'\nexport {TestControllerComponent,TestControllerService,UnitActivateGuard};'));
const originalEntry=async({current=1,locked=[],codeFirst=false,ownTime=false,ownShow=false,ownLeave=false}={})=>{
 const source=new original.TestControllerService(),calls=[];
 const parent={locked:codeFirst?{by:'code'}:null,locks:{show:ownShow,time:ownTime,afterLeave:ownLeave}};
 source.booklet={config:{}};source.testId=42;source.currentUnitSequenceId=current;
 source.units=Object.fromEntries([1,2,3].map(sequenceId=>[sequenceId,{sequenceId,localIndex:sequenceId-1,
  parent:sequenceId===3?{locked:null,locks:{}}:parent,lockedAfterLeaving:locked.includes(sequenceId)}]));
 source.currentUnit=source.units[current];source.checkCompleteness=()=>[];source.state$={next:value=>calls.push(['state',value])};
 source.getUnit=sequence=>{if(!source.units[sequence])throw Error('Unit missing');return source.units[sequence];};
 source.shouldShowConfirmationUI=()=>false;source.closeAllBuffers=async()=>source.getNavigationState(current);
 const guard=new original.UnitActivateGuard(source,{parseUrl:url=>({redirect:url})},{});
 source.router={navigate:async([url],options)=>{calls.push(['navigate',url,options.state.force]);return guard.canActivate({params:{u:url.split('/').at(-1)}});}};
 return {result:await source.resume(),calls,source};
};
for(const [name,input,expected] of [
 ['a locked current Unit redirects past other locked Units',{locked:[1,2]},{redirect:'/t/42/u/3'}],
 ['a locked last Unit stays when no later Unit is accessible',{current:3,locked:[3]},true],
 ['the first local Unit of a code-locked block remains accessible',{codeFirst:true},true],
 ['a code-first exception does not bypass its own timer lock',{codeFirst:true,ownTime:true},{redirect:'/t/42/u/3'}],
 ['a code-first exception does not bypass its own show lock',{codeFirst:true,ownShow:true},{redirect:'/t/42/u/3'}],
 ['a code-first exception does not bypass its own leave lock',{codeFirst:true,ownLeave:true},{redirect:'/t/42/u/3'}],
 ['a missing current Unit has no authored-first fallback',{current:0},false]
])test(`pinned Resume enters the actual activation guard: ${name}`,async()=>{
 const {result,calls}=await originalEntry(input);assert.deepEqual(result,expected);
 assert.deepEqual(calls,[['state','RUNNING'],['navigate',`/t/42/u/${input.current===0?'null':input.current??1}`,true]]);
});
for(const [keyword,args,expected] of [['pause',[],['pause']],['resume',['ignored'],['resume']],['terminate',['LOCK'],['terminate','BOOKLETLOCKEDbyOPERATOR',true,false]],['terminate',['lock','extra'],['terminate','BOOKLETLOCKEDbyOPERATOR',true,true]]])test(`pinned root dispatch establishes ${keyword} argument semantics`,async()=>{
 const root=new original.TestControllerComponent(),calls=[];
 root.tcs={pause:async()=>calls.push(['pause']),resume:async()=>calls.push(['resume']),terminateTest:async(...args)=>calls.push(['terminate',...args])};
 await root.handleCommand(keyword,args);assert.deepEqual(calls,[expected]);
});
for(const args of [['2'],['id','alias-Ω']])test(`pinned root goto selects the immediate parent and alias (${JSON.stringify(args)})`,async()=>{
 const root=new original.TestControllerComponent(),calls=[],parent={id:'inner',timerId:'outer'};
 root.tcs={state$:{next:value=>calls.push(['state',value])},unitAliasMap:{'alias-Ω':2},units:{2:{parent,lockedAfterLeaving:true}},currentUnit:{parent:{timerId:'outer'}},
  updateSingleLock:(target,key,value)=>calls.push(['lock',target.id,key,value]),clearCodeLock:key=>calls.push(['code',key]),setUnitNavigationRequest:async(target,force)=>{calls.push(['navigate',target,force]);return true;}};
 await root.handleCommand('goto',args);assert.deepEqual(calls,[['state','RUNNING'],['lock','inner','afterLeave',false],['code','inner'],['navigate','2',true]]);
 assert.equal(root.tcs.units[2].lockedAfterLeaving,false);
});
test('pinned root cross-timer goto parses the final word as minutes and does not clear ancestors',async()=>{
 const root=new original.TestControllerComponent(),calls=[],parent={id:'target',timerId:'b'};
 root.tcs={state$:{next:value=>calls.push(['state',value])},unitAliasMap:{target:2},units:{2:{parent,lockedAfterLeaving:true}},currentUnit:{parent:{timerId:'a'}},
  cancelTimer:()=>calls.push(['cancel']),restoreTime:(target,minutes)=>calls.push(['restore',target.id,minutes]),updateSingleLock:(target,key,value)=>calls.push(['lock',target.id,key,value]),
  clearCodeLock:key=>calls.push(['code',key]),setUnitNavigationRequest:async(target,force)=>{calls.push(['navigate',target,force]);return true;}};
 await root.handleCommand('goto',['id','target','give 2']);assert.deepEqual(calls,[['state','RUNNING'],['cancel'],['restore','target',2],['lock','target','afterLeave',false],['code','target'],['navigate','2',true]]);
});
for(const balance of [undefined,0,-1,1.5])test(`pinned restoreTime changes only a recorded nonpositive immediate-parent balance (${balance})`,()=>{
 const source=new original.TestControllerService(),calls=[],parent={id:'owned',restrictions:{timeMax:{minutes:5}}};source.timers=balance===undefined?{}:{owned:balance};
 source.updateSingleLock=(target,key,value)=>calls.push([target.id,key,value]);source.restoreTime(parent,2);
 assert.equal(source.timers.owned,balance!==undefined&&balance<=0?2:balance);assert.deepEqual(calls,balance!==undefined&&balance<=0?[['owned','time',false]]:[]);
});
const file=readFileSync(new URL('../apps/web/src/app/participant-view.facade.ts',import.meta.url),'utf8'),ast=ts.createSourceFile('facade.ts',file,ts.ScriptTarget.Latest,true);
const declaration=ast.statements.find(ts.isClassDeclaration),method=declaration.members.find(member=>member.name?.getText(ast)==='prepareNativeConsoleCommand');assert.ok(method);
const {createParticipantSaveBarriers}=await import(emit(readFileSync(new URL('../apps/web/src/app/participant-save-barrier.ts',import.meta.url),'utf8')));
const {load}=await import(emit('export const load=(hasMeaningfulVeronaResponse,parseVeronaUnitResponse,createParticipantSaveBarriers)=>{const listParticipantSaveOutboxEntriesForRun=()=>[];return class Actual { veronaSaveBarriers=createParticipantSaveBarriers(); '+method.getText(ast)+' };};'));
const Actual=load(hasMeaningfulVeronaResponse,parseVeronaUnitResponse,createParticipantSaveBarriers);
for(const [name,player,response,saved,expected] of [
 ['untouched empty Player shell',{},'{"kind":"verona_unit_state","version":1,"unitState":{}}',undefined,0],
 ['unchanged trusted saved response',{},'{"kind":"verona_unit_state","version":1,"unitState":{"responseProgress":"complete"}}','{"kind":"verona_unit_state","version":1,"unitState":{"responseProgress":"complete"}}',0],
 ['changed meaningful Player response',{},'{"kind":"verona_unit_state","version":1,"unitState":{"responseProgress":"complete"}}',undefined,1],
 ['cleared manual text draft',null,'','prior text',1]
])test(`actual native preparation preserves answers for ${name}`,async()=>{
 const value=new Actual(),calls=[];value.runtime={currentUnitResponse:response};value.readCurrentRunState=()=>({currentUnit:{unitKey:'unit',player},testRun:{currentUnitKey:'unit',unitResponses:saved===undefined?{}:{unit:saved}}});
 Object.defineProperty(value,'debugRunState',{get:()=>value.readCurrentRunState()});value.consoleRun={currentUnitKey:'unit'};
 value.settleVeronaAutoSaveBeforeForegroundAction=async()=>{calls.push('drained');return {owned:true};};value.saveCurrentDraftBeforeCompleteInternal=async settled=>calls.push(settled);
 await value.prepareNativeConsoleCommand(()=>true);assert.equal(calls[0],'drained');assert.equal(calls.length,1+expected);
});
test('preparation cannot write a new controller draft after its pending drain returns late',async()=>{
 const value=new Actual(),writes=[];value.runtime={currentUnitResponse:'changed'};value.readCurrentRunState=()=>({currentUnit:{unitKey:'unit',player:null},testRun:{unitResponses:{unit:'old'}}});
 Object.defineProperty(value,'debugRunState',{get:()=>value.readCurrentRunState()});value.consoleRun={currentUnitKey:'unit'};
 value.settleVeronaAutoSaveBeforeForegroundAction=async()=>null;value.saveCurrentDraftBeforeCompleteInternal=async value=>writes.push(value);
 await value.prepareNativeConsoleCommand(()=>false);assert.deepEqual(writes,[]);
});
test('native preparation before a verified current Unit exists never drains or stages a previous controller draft',async()=>{
 const value=new Actual();value.debugRunState=null;value.runtime={currentUnitResponse:'Old controller text'};
 value.settleVeronaAutoSaveBeforeForegroundAction=async()=>assert.fail('No selected Player exists');
 value.saveCurrentDraftBeforeCompleteInternal=async()=>assert.fail('No draft can belong to the loading controller');
 await value.prepareNativeConsoleCommand(()=>true);
});
const saveMethod=declaration.members.find(member=>member.name?.getText(ast)==='saveVeronaResponse');assert.ok(saveMethod);
const {loadSaver}=await import(emit('export const loadSaver=(findParticipantSaveOutboxEntryForUnit,carriedParticipantTestLogBatches,createParticipantSaveOutboxEntry,persistParticipantSaveOutboxEntry)=>class Actual { '+saveMethod.getText(ast)+' };'));
test('actual log-only staging preserves the draft and omits a new optimistic answer; merging retains a genuine pending answer',()=>{
 let persisted=[],durable=null;
 const Saver=loadSaver(()=>durable,entry=>entry?.logs??[],input=>({version:input.logOnly?2:1,deliveryId:'owned',...input}),entry=>persisted.push(entry));
 const value=new Saver(),current={testRun:{testRunId:'run',status:'running',unitResponses:{}},currentUnit:{unitKey:'unit'},bookletUnits:[{unitKey:'unit'}],availableActions:['save_progress'],executionMode:{saveResponses:true}};
 Object.assign(value,{runtime:{currentUnitResponse:'untouched'},queuedVeronaLogs:[{testRunId:'run',unitKey:null,originalUnitId:null,entries:[{key:'CONTROLLER',timeStamp:1,content:'ERROR'}]}],pendingVeronaSave:null,optimisticVeronaResponse:null});
 value.readCurrentRunState=()=>current;value.compactParticipantTestLogBatches=logs=>logs;value.scheduleVeronaSaveDrain=()=>{};value.veronaBufferDelayMs=()=>0;value.persistState=()=>{};
 const logs={testRunId:'run',unitKey:'unit',response:'synthetic shell',unitDataChanged:false,unitStateChanged:false,playerStateChanged:false};
 value.saveVeronaResponse(logs);assert.equal(value.pendingVeronaSave.logOnly,true);assert.equal(value.pendingVeronaSave.version,2);assert.equal(value.runtime.currentUnitResponse,'untouched');assert.equal(value.optimisticVeronaResponse,null);
 value.pendingVeronaSave={testRunId:'run',unitKey:'unit',response:'Exact real capture Ω',logs:[]};value.saveVeronaResponse(logs);
 assert.equal(Object.hasOwn(value.pendingVeronaSave,'logOnly'),false);assert.equal(value.pendingVeronaSave.response,'Exact real capture Ω');
 value.saveVeronaResponse({...logs,response:'Latest real capture',unitDataChanged:true});assert.equal(value.pendingVeronaSave.response,'Latest real capture');assert.equal(value.runtime.currentUnitResponse,'Latest real capture');
});
test('native preparation drains tagged former-Unit reports without staging its stale draft for the newly selected Unit',async()=>{
 const value=new Actual(),calls=[];value.runtime={currentUnitResponse:'Old Unit changed text'};
 value.debugRunState={currentUnit:{unitKey:'old'},testRun:{unitResponses:{old:'Previously saved'}}};value.consoleRun={currentUnitKey:'new'};
 value.settleVeronaAutoSaveBeforeForegroundAction=async()=>{calls.push('trusted old report drained');return null;};
 value.saveCurrentDraftBeforeCompleteInternal=async()=>assert.fail('The old draft must not be assigned to the new Unit');
 await value.prepareNativeConsoleCommand(()=>true);assert.deepEqual(calls,['trusted old report drained']);
});
