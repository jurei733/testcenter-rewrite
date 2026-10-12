import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {productionApiRoutes,resolveRoutePath,parseVeronaUnitResponse,hasMeaningfulVeronaResponse} from '@testcenter-rewrite-app/contracts';
import {participantControllerContextRoute} from '@testcenter-rewrite-app/contracts/participant-native-command';
const source=readFileSync(new URL('../apps/web/src/app/participant-view.facade.ts',import.meta.url),'utf8');
const ast=ts.createSourceFile('facade.ts',source,ts.ScriptTarget.Latest,true),declaration=ast.statements.find(ts.isClassDeclaration);
const names=['consoleRun','isParticipantPlayerFocused','eagerBookletLoading','unitViewPending','isRunPaused','debugControllerStatus','nativeControllerStatus','controllerLogState','isParticipantLogin','isParticipantStarter','resumeSessionInternal','debugRunState','readCurrentRunState','syncRun','updateCurrentTextResponse','hasControllerError','controllerError','refreshCurrentStateInternal','validateParticipantControllerContext','invalidateCurrentStateRefreshes','applyNativeConsoleCommand','prepareNativeConsoleCommand','applyReceivedParticipantCommand','reconcileParticipantTerminalState','startAcceptedParticipantReception'];
const members=names.map(name=>{const member=declaration.members.find(item=>item.name?.getText(ast)===name);assert.ok(member,name);return member.getText(ast);});
// Inject only module resolution; the actual production method bodies execute unchanged.
const emitted=ts.transpileModule(`export const load=(productionApiRoutes,resolveRoutePath,prettyPrintJson,withSelectedParticipantRun,loadControllerContract,parseVeronaUnitResponse,hasMeaningfulVeronaResponse,loadCommandExecution)=>class Host {${members.join('\n').replaceAll('import("@testcenter-rewrite-app/contracts/participant-native-command")','loadControllerContract()').replaceAll('import("./participant-command-execution")','loadCommandExecution()')}}`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {load}=await import('data:text/javascript;base64,'+Buffer.from(emitted).toString('base64'));
const executionSource=readFileSync(new URL('../apps/web/src/app/participant-command-execution.ts',import.meta.url),'utf8');
const executionAst=ts.createSourceFile('execution.ts',executionSource,ts.ScriptTarget.Latest,true);
const reconciliation=executionAst.statements.filter(ts.isVariableStatement).flatMap(item=>[...item.declarationList.declarations]).find(item=>item.name.getText(executionAst)==='reconcileAcceptedParticipantCommand');assert.ok(reconciliation?.initializer);
const reconciliationCode=ts.transpileModule(`export const reconcileAcceptedParticipantCommand=${reconciliation.initializer.getText(executionAst)}`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {reconcileAcceptedParticipantCommand}=await import('data:text/javascript;base64,'+Buffer.from(reconciliationCode).toString('base64'));
const hostClass=execute=>load(productionApiRoutes,resolveRoutePath,JSON.stringify,(path,id)=>path+(id?'?testRunId='+id:''),async()=>({participantControllerContextRoute}),parseVeronaUnitResponse,hasMeaningfulVeronaResponse,async()=>({executeReceivedParticipantCommand:execute,reconcileAcceptedParticipantCommand}));
const deferred=()=>{let resolve,reject;const promise=new Promise((done,fail)=>{resolve=done;reject=fail;});return {promise,resolve,reject};};
const run={tenantId:'tenant',workspaceId:'workspace',participantSessionId:'participant',testRunId:'selected',contentReleaseId:'release',bookletKey:'booklet',bookletAssignmentKey:'booklet',status:'running',currentUnitKey:'unit',unitResponses:{unit:'Exact owned Ω'},unitResponseFieldTimestamps:{unit:{opaque:123}},testletTimers:{},createdAt:'2026-10-12T00:00:00Z',updatedAt:'2026-10-12T00:00:00Z'};
const session={tenantId:'tenant',workspaceId:'workspace',participantSessionId:'participant',status:'launched'};
const state=record=>({participantSession:session,testRun:record,currentUnit:{unitKey:'unit'},executionMode:{receiveRemoteCommands:true},booklet:{policy:{player:{loadingMode:'lazy'}}}});
const fixture=(request=async()=>({currentRunState:state(run)}),execute=()=>assert.fail('Unexpected remote application'))=>{
 const Host=hostClass(execute);
 let error=null,consoleRunValue=null;const calls={requests:[],applied:0,suspended:0,started:0,failures:[],drained:0,saved:0,reloads:0,starter:0},host=new Host();
 Object.assign(host,{runtime:{participantSessionId:'participant',testRunId:'selected',currentRunStateView:'',currentUnitResponse:'Old unowned controller draft',bookletKey:'booklet'},consoleTestRun:Object.assign(()=>consoleRunValue,{set:value=>{consoleRunValue=value;}}),currentRunState:null,
  currentStateRefreshSequence:0,currentStateAppliedRefreshSequence:0,bookletAssetLoadStartedAtMs:new Map(),loadedBookletAssets:()=>null,veronaErrorText:'Owned load error',
  requestState:{request:async(...args)=>{calls.requests.push(args[2]);return request(...args);},isApiError:error=>Boolean(error?.error)},
  activeControllerError:Object.assign(()=>error,{set:value=>{error=value;}}),participantErrorReceptionSuspended:false,
  participantEvents:{suspend(){calls.suspended++;},stop(){},start(){calls.started++;}},captureTimerLifecycleTransitions(){},syncParticipantHeaderVisibility(){},syncActiveBookletCustomTexts(){},
  recordLoadedBookletAssets(){},shouldPreserveCurrentTextDraft:()=>false,syncCurrentRunState(value){this.currentRunState=value;calls.applied++;},syncCurrentUnitResponse(){},
  reconcileOptimisticVeronaResponse(){},restorePersistentVeronaSave(){},persistLoadCompleteLog(){},loadBookletAssetsInBackground(){},refreshParticipantReviewsInternal:async()=>{},persistState(){},
  settleVeronaAutoSaveBeforeForegroundAction:async()=>{calls.drained++;return null;},saveCurrentDraftBeforeCompleteInternal:async()=>{calls.saved++;},
  ephemeralUnitResponses:new Map(),nativeConsoleCommandFailed(error){calls.failures.push(error);},commandReloadSequence:{update(){calls.reloads++;}},presentParticipantStarter(){calls.starter++;},replaceSelectedRunEntryLink:async()=>{},commandControllerState:null,remoteTerminalErrorRunId:null});
 return {host,calls};
};
const tick=()=>new Promise(done=>setTimeout(done,0));
test('a URL or serialized former view cannot authorize a console Run; authenticated context does so before the initial state arrives',async()=>{
 const gate=deferred(),f=fixture(async(label)=>label==='Participant Controller'?{controllerContext:{participantSession:session,testRun:run}}:gate.promise);
 assert.equal(f.host.consoleRun,null);const loading=f.host.refreshCurrentStateInternal(true);await tick();
 assert.equal(f.host.consoleRun.testRunId,'selected');assert.equal(f.host.debugRunState,null);
 await f.host.prepareNativeConsoleCommand(()=>true);assert.equal(f.calls.drained,0);assert.equal(f.calls.saved,0);
 gate.resolve({currentRunState:state(run)});await loading;assert.equal(f.host.debugRunState.testRun.testRunId,'selected');
 assert.deepEqual(f.calls.requests,['/api/v1/participant/sessions/participant/controller-context?testRunId=selected','/api/v1/participant/sessions/participant/current-state?testRunId=selected']);
 f.host.runtime.testRunId='other';assert.equal(f.host.consoleRun,null);assert.equal(f.host.debugRunState,null);
});
for(const field of ['testRunId','participantSessionId','tenantId','workspaceId','contentReleaseId','bookletKey'])test(`malformed or foreign ${field} context cannot establish scope or request a Unit`,async()=>{
 const malformed={...run,[field]:['testRunId','participantSessionId','tenantId','workspaceId'].includes(field)?'foreign':null};
 const f=fixture(async()=>({controllerContext:{participantSession:session,testRun:malformed}}));
 await assert.rejects(f.host.refreshCurrentStateInternal(true),/controller context/);assert.equal(f.host.consoleRun,null);assert.equal(f.calls.requests.length,1);assert.equal(f.calls.applied,0);
});
test('a pending controller-context response is ignored after a live selection or route replacement',async()=>{
 for(const replace of [host=>{host.runtime.testRunId='new';},host=>host.invalidateCurrentStateRefreshes()]){
  const gate=deferred(),f=fixture(()=>gate.promise);const pending=f.host.refreshCurrentStateInternal(true);await tick();replace(f.host);
  gate.resolve({controllerContext:{participantSession:session,testRun:run}});await pending;
  assert.equal(f.host.consoleRun,null);assert.equal(f.calls.requests.length,1);assert.equal(f.calls.applied,0);
 }
});
test('an owned initial load failure enters ERROR without losing console scope, and accepted resume recovers the same Run',async()=>{
 const failure={error:'owned_load_failure',statusCode:503};let fail=true;
 const f=fixture(async label=>label==='Participant Controller'?{controllerContext:{participantSession:session,testRun:run}}:fail?Promise.reject(failure):{currentRunState:state(run)});
 await assert.rejects(f.host.refreshCurrentStateInternal(true),value=>value===failure);assert.equal(f.host.hasControllerError,true);assert.equal(f.host.controllerError.testRunId,'selected');
 assert.equal(f.host.consoleRun.testRunId,'selected');assert.equal(f.host.debugRunState,null);fail=false;
 await f.host.applyNativeConsoleCommand({keyword:'resume',testRun:run,participantSession:session},()=>true);await tick();
 assert.equal(f.host.hasControllerError,false);assert.equal(f.host.controllerError,null);assert.equal(f.host.debugRunState.testRun.testRunId,'selected');
 assert.equal(f.calls.saved,0);assert.deepEqual(f.host.consoleRun.unitResponses,run.unitResponses);
});
test('an accepted early pause fences an older RUNNING reply before the fresh paused view finishes loading',async()=>{
 const old=deferred(),fresh=deferred();let count=0;
 const f=fixture(async label=>label==='Participant Controller'?{controllerContext:{participantSession:session,testRun:run}}:++count===1?old.promise:fresh.promise);
 const loading=f.host.refreshCurrentStateInternal(true);await tick();
 const paused={...run,status:'paused'},applied=f.host.applyNativeConsoleCommand({keyword:'pause',testRun:paused,participantSession:session},()=>true);await tick();
 old.resolve({currentRunState:state(run)});await loading;assert.equal(f.calls.applied,0);assert.equal(f.host.consoleRun.status,'paused');
 fresh.resolve({currentRunState:state(paused)});await applied;await tick();assert.equal(f.calls.applied,1);assert.equal(f.host.debugRunState.testRun.status,'paused');
});
test('access rejection clears a verified loading scope instead of retaining commands for a revoked session',async()=>{
 const denied={error:'participant_session_access_required',statusCode:401};
 const f=fixture(async label=>label==='Participant Controller'?{controllerContext:{participantSession:session,testRun:run}}:Promise.reject(denied));
 await assert.rejects(f.host.refreshCurrentStateInternal(true),value=>value===denied);assert.equal(f.host.consoleRun,null);assert.equal(f.host.controllerError,null);
});

test('an authorized resume synchronizes its exact non-Starter URL before a first load failure',async()=>{
 const failure={error:'owned_load_failure',statusCode:503},order=[];
 const f=fixture(async label=>{if(label==='Participant Resume Session')return {testRun:run};order.push('current');throw failure;});
 f.host.runtime.testRunId='';f.host.viewLifecycleSequence=1;
 f.host.replaceSelectedRunEntryLink=async()=>{order.push('url');assert.equal(f.host.consoleRun.testRunId,'selected');assert.equal(f.host.isParticipantStarter,false);};
 await assert.rejects(f.host.resumeSessionInternal({quiet:true}),value=>value===failure);
 assert.deepEqual(order,['url','current']);assert.equal(f.host.consoleRun.testRunId,'selected');assert.equal(f.host.hasControllerError,true);
});

test('accepted controller states are visible before their Unit loads and termination overrides the retained error presentation',async()=>{
 const loading=deferred(),f=fixture(()=>loading.promise);f.host.syncRun(run);
 assert.equal(f.host.debugControllerStatus,'LOADING');assert.equal(f.host.nativeControllerStatus,'LOADING');
 await f.host.applyNativeConsoleCommand({keyword:'resume',testRun:run,participantSession:session},()=>true);
 assert.equal(f.host.debugControllerStatus,'RUNNING');assert.equal(f.host.nativeControllerStatus,'RUNNING');
 f.host.syncRun({...run,status:'paused'});f.host.commandControllerState={testRunId:'selected',status:'TERMINATED_PAUSED'};
 assert.equal(f.host.nativeControllerStatus,'PAUSED');
 f.host.activeControllerError.set({testRunId:'selected',message:'Retained error'});f.host.participantErrorReceptionSuspended=true;
 assert.equal(f.host.debugControllerStatus,'TERMINATED_PAUSED');
 assert.equal(f.host.nativeControllerStatus,'ERROR');
 f.host.runtime.testRunId='other';assert.equal(f.host.consoleRun,null);
 loading.resolve({currentRunState:state(run)});await tick();
});

test('a former Run or participant view is never returned during a new selected controller load',()=>{
 const f=fixture();f.host.syncRun(run);f.host.currentRunState=state(run);
 assert.equal(f.host.readCurrentRunState().testRun.testRunId,'selected');
 for(const scope of [{testRunId:'new-run',participantSessionId:'participant'},{testRunId:'selected',participantSessionId:'new-participant'}]){
  Object.assign(f.host.runtime,scope);assert.equal(f.host.readCurrentRunState(),null);assert.equal(f.host.debugRunState,null);
 }
});

test('a verified loading controller uses the player surface and loading/paused views without fabricating a current Unit',()=>{
 const f=fixture();assert.equal(f.host.isParticipantPlayerFocused,false);assert.equal(f.host.eagerBookletLoading,false);
 f.host.syncRun(run);assert.equal(f.host.isParticipantPlayerFocused,true);assert.equal(f.host.eagerBookletLoading,true);assert.equal(f.host.isParticipantStarter,false);
 assert.equal(f.host.debugRunState,null);assert.equal(f.host.isRunPaused,false);
 f.host.syncRun({...run,status:'paused'});assert.equal(f.host.isRunPaused,true);assert.equal(f.host.debugRunState,null);
});

const unsupportedContext={error:'route_not_found',statusCode:404};
for(const selected of ['selected',''])test(`an older backend establishes an authorized ${selected?'explicit':'legacy'} Run through the existing state route`,async()=>{
 const held=deferred(),f=fixture(label=>label==='Participant Controller'?Promise.reject(unsupportedContext):held.promise);
 f.host.runtime.testRunId=selected;
 const loading=f.host.refreshCurrentStateInternal(true);await tick();
 assert.equal(f.host.consoleRun,null);assert.equal(f.calls.requests.length,2);
 assert.equal(f.calls.requests[1],'/api/v1/participant/sessions/participant/current-state'+(selected?'?testRunId=selected':''));
 held.resolve({currentRunState:state(run)});await loading;
 assert.equal(f.host.consoleRun.testRunId,'selected');assert.equal(f.host.debugRunState.testRun.testRunId,'selected');
 assert.equal(f.calls.applied,1);assert.equal(f.calls.saved,0);
});

test('only a 404 route-not-found permits the old-backend fallback; access, missing Run and malformed success stay closed',async()=>{
 for(const error of [{error:'participant_session_access_required',statusCode:401},{error:'participant_session_access_denied',statusCode:403},
  {error:'test_run_not_found',statusCode:404},{error:'route_not_found',statusCode:503},{error:'http_error',statusCode:404}]){
  const f=fixture(()=>Promise.reject(error));await assert.rejects(f.host.refreshCurrentStateInternal(true),value=>value===error);
  assert.equal(f.calls.requests.length,1);assert.equal(f.host.consoleRun,null);
 }
 const malformed=fixture(async()=>({}));await assert.rejects(malformed.host.refreshCurrentStateInternal(true),/controller context/);
 assert.equal(malformed.calls.requests.length,1);assert.equal(malformed.host.consoleRun,null);
});

test('a fallback state must carry all authorized scope fields before establishing a console or Unit view',async()=>{
 for(const field of ['testRunId','participantSessionId','tenantId','workspaceId','contentReleaseId','bookletKey']){
  const value={...run,[field]:['testRunId','participantSessionId','tenantId','workspaceId'].includes(field)?'foreign':null};
  const f=fixture(async label=>label==='Participant Controller'?Promise.reject(unsupportedContext):{currentRunState:state(value)});
  await assert.rejects(f.host.refreshCurrentStateInternal(true),/controller context/);
  assert.equal(f.host.consoleRun,null);assert.equal(f.host.debugRunState,null);assert.equal(f.calls.applied,0);
 }
});

test('an unsupported context response cannot start a fallback for a replacement controller',async()=>{
 for(const replace of [host=>{host.runtime.testRunId='other';},host=>{host.runtime.participantSessionId='other';},host=>host.invalidateCurrentStateRefreshes()]){
  const held=deferred(),f=fixture(()=>held.promise);const loading=f.host.refreshCurrentStateInternal(true);await tick();replace(f.host);
  held.reject(unsupportedContext);await loading;assert.equal(f.calls.requests.length,1);assert.equal(f.host.consoleRun,null);
 }
});

test('a late legacy fallback state cannot establish scope after a participant selection changed',async()=>{
 const held=deferred(),f=fixture(label=>label==='Participant Controller'?Promise.reject(unsupportedContext):held.promise);
 f.host.runtime.testRunId='';const loading=f.host.refreshCurrentStateInternal(true);await tick();f.host.runtime.testRunId='other';
 held.resolve({currentRunState:state(run)});await loading;assert.equal(f.host.consoleRun,null);assert.equal(f.calls.applied,0);
});

test('eager fallback assets cannot replace an owned controller with a foreign full view',async()=>{
 const eager=state(run);eager.booklet.policy.player.loadingMode='eager';
 const f=fixture(async label=>label==='Participant Controller'?Promise.reject(unsupportedContext):{currentRunState:eager});
 f.host.loadBookletAssets=async()=>({currentRunState:{...eager,testRun:{...run,workspaceId:'foreign'}}});
 await assert.rejects(f.host.refreshCurrentStateInternal(true),/controller context/);
 assert.equal(f.calls.applied,0);assert.equal(f.host.debugRunState,null);assert.equal(f.host.consoleRun.workspaceId,'workspace');
 assert.equal(f.host.hasControllerError,true);assert.deepEqual(f.host.consoleRun.unitResponses,run.unitResponses);
});

test('controller lifecycle uses only an authorized Run and distinguishes initial loading, readiness, early failure and already-recorded native states',()=>{
 const f=fixture();assert.equal(f.host.controllerLogState,null);
 f.host.syncRun({...run,status:'paused'});assert.equal(f.host.controllerLogState.ready,false);assert.equal(f.host.controllerLogState.status,'LOADING');assert.equal(f.host.controllerLogState.alreadyRecorded,false);
 f.host.currentRunState=state({...run,status:'paused'});assert.equal(f.host.controllerLogState.ready,true);assert.equal(f.host.controllerLogState.status,'PAUSED');
 f.host.activeControllerError.set({testRunId:'selected',message:'Pre-Unit failure'});f.host.participantErrorReceptionSuspended=true;f.host.currentRunState=null;assert.equal(f.host.controllerLogState.status,'ERROR');
 f.host.activeControllerError.set(null);f.host.participantErrorReceptionSuspended=false;f.host.syncRun(run);f.host.commandControllerState={testRunId:'selected',status:'RUNNING'};
 assert.equal(f.host.controllerLogState.status,'RUNNING');assert.equal(f.host.controllerLogState.alreadyRecorded,true);
 f.host.currentRunState=state(run);f.host.commandControllerState={testRunId:'selected',status:'PAUSED'};
 assert.equal(f.host.controllerLogState.status,'RUNNING');assert.equal(f.host.controllerLogState.alreadyRecorded,false);
 f.host.syncRun({...run,status:'completed'});assert.equal(f.host.controllerLogState,null);
 f.host.runtime.testRunId='other';assert.equal(f.host.controllerLogState,null);
});

const remoteCommand=(commandType,id='remote-'+commandType)=>({tenantId:run.tenantId,workspaceId:run.workspaceId,participantSessionId:run.participantSessionId,testRunId:run.testRunId,
 commandId:id,commandType,acknowledgedAt:'2026-10-12T00:00:01Z',effectsDeferred:true});
const remoteApplication=command=>({command,testRun:{...run,status:command.commandType==='pause'||command.commandType.startsWith('complete')?'paused':'running'},participantSession:{...session,status:command.commandType.startsWith('complete')?'signed_in':'launched'},applied:true});
const applyRemote=async(command,signal,options)=>{
 await options.prepare();if(signal.aborted||!options.isCurrent())return;options.controllerStatus();await options.apply(remoteApplication(command));
};
test('a held paused view cannot delay a receipt projection or the next accepted resume, and its late state cannot undo that resume',async()=>{
 const old=deferred(),fresh=deferred();let reads=0;
 const f=fixture(()=>++reads===1?old.promise:fresh.promise,applyRemote);f.host.syncRun(run);f.host.currentRunState=state(run);f.host.runtime.currentUnitResponse=run.unitResponses.unit;
 await f.host.applyReceivedParticipantCommand(remoteCommand('pause'),new AbortController().signal);
 assert.equal(f.host.consoleRun.status,'paused');assert.equal(f.host.debugControllerStatus,'PAUSED');assert.equal(f.calls.applied,0);assert.equal(reads,1);
 await f.host.applyReceivedParticipantCommand(remoteCommand('resume'),new AbortController().signal);
 assert.equal(f.host.consoleRun.status,'running');assert.equal(f.host.debugControllerStatus,'RUNNING');assert.equal(reads,2);assert.equal(f.calls.reloads,1);
 old.resolve({currentRunState:state({...run,status:'paused'})});await tick();assert.equal(f.host.consoleRun.status,'running');assert.equal(f.calls.applied,0);
 fresh.resolve({currentRunState:state(run)});await tick();assert.equal(f.calls.applied,1);assert.deepEqual(f.host.consoleRun.unitResponses,run.unitResponses);assert.equal(f.calls.saved,0);
});
test('an accepted command projects the authorized controller before any full Unit view without inventing an answer',async()=>{
 const view=deferred(),f=fixture(()=>view.promise,applyRemote);f.host.syncRun(run);assert.equal(f.host.debugRunState,null);
 await f.host.applyReceivedParticipantCommand(remoteCommand('pause'),new AbortController().signal);
 assert.equal(f.host.consoleRun.status,'paused');assert.equal(f.host.debugRunState,null);assert.equal(f.calls.saved,0);assert.equal(f.calls.drained,0);
 view.resolve({currentRunState:state({...run,status:'paused'})});await tick();
});
test('an accepted remote pause can advance while an older trusted answer receipt remains held',async()=>{
 const oldSave=deferred(),view=deferred(),f=fixture(()=>view.promise,applyRemote);f.host.syncRun(run);f.host.currentRunState=state(run);
 f.host.settleVeronaAutoSaveBeforeForegroundAction=async()=>{f.calls.drained++;return oldSave.promise;};
 let applied=false;const pending=f.host.applyReceivedParticipantCommand(remoteCommand('pause'),new AbortController().signal).then(()=>{applied=true;});
 try {await tick();assert.equal(applied,true);assert.equal(f.host.consoleRun.status,'paused');assert.equal(f.calls.drained,0);assert.equal(f.calls.saved,0);}
 finally {oldSave.resolve();await pending;view.resolve({currentRunState:state({...run,status:'paused'})});await tick();}
});
test('a confirmed goto retires the former Unit surface while its target metadata is held',async()=>{
 const view=deferred(),target={...run,currentUnitKey:'next'},f=fixture(()=>view.promise,async(command,_signal,options)=>{await options.prepare();options.controllerStatus();await options.apply({...remoteApplication(command),testRun:target});});
 f.host.syncRun(run);f.host.currentRunState=state(run);assert.equal(f.host.unitViewPending,false);
 await f.host.applyReceivedParticipantCommand(remoteCommand('goto'),new AbortController().signal);
 assert.equal(f.host.consoleRun.currentUnitKey,'next');assert.equal(f.host.unitViewPending,true);assert.deepEqual(f.host.consoleRun.unitResponses,run.unitResponses);
 view.resolve({currentRunState:{...state(target),currentUnit:{unitKey:'next'}}});await tick();assert.equal(f.host.unitViewPending,false);
});
test('text input cannot create a target-Unit draft before its authenticated metadata arrives',()=>{
 const f=fixture();f.host.syncRun({...run,currentUnitKey:'next'});f.host.currentRunState=state({...run,currentUnitKey:'next'});
 f.host.runtime.currentUnitResponse='Exact former draft Ω';f.host.currentTextDraftIdentity='selected\u0000unit';
 f.host.updateCurrentTextResponse('Unattributed input');assert.equal(f.host.runtime.currentUnitResponse,'Exact former draft Ω');
 assert.equal(f.host.currentTextDraftIdentity,'selected\u0000unit');
 f.host.currentRunState.currentUnit={unitKey:'next'};f.host.updateCurrentTextResponse('Exact target draft Ω');
 assert.equal(f.host.runtime.currentUnitResponse,'Exact target draft Ω');assert.equal(f.host.currentTextDraftIdentity,'selected\u0000next');
});
for(const field of ['tenantId','workspaceId','participantSessionId','testRunId','contentReleaseId','bookletKey'])test(`a pending command cannot project into a replacement ${field} scope`,async()=>{
 const reply=deferred(),entered=deferred(),f=fixture(undefined,async(command,_signal,options)=>{options.controllerStatus();entered.resolve();await reply.promise;await options.apply(remoteApplication(command));});
 f.host.syncRun(run);const pending=f.host.applyReceivedParticipantCommand(remoteCommand('pause'),new AbortController().signal);await entered.promise;
 const replacement={...run,[field]:'replacement'};Object.assign(f.host.runtime,{participantSessionId:replacement.participantSessionId,testRunId:replacement.testRunId});f.host.syncRun(replacement);
 reply.resolve();await pending;assert.equal(f.host.consoleRun[field],'replacement');assert.equal(f.host.consoleRun.status,'running');assert.equal(f.calls.requests.length,0);
});
test('a later accepted native state and newer answer cannot be overwritten by an older remote application reply',async()=>{
 const reply=deferred(),entered=deferred(),view=deferred(),f=fixture(()=>view.promise,async(command,_signal,options)=>{options.controllerStatus();entered.resolve();await reply.promise;await options.apply(remoteApplication(command));});
 f.host.syncRun(run);const pending=f.host.applyReceivedParticipantCommand(remoteCommand('resume'),new AbortController().signal);await entered.promise;
 const newer={...run,status:'paused',unitResponses:{unit:'Newer trusted answer Ω'}};f.host.invalidateCurrentStateRefreshes();f.host.syncRun(newer);
 reply.resolve();await pending;assert.equal(f.host.consoleRun.status,'paused');assert.deepEqual(f.host.consoleRun.unitResponses,newer.unitResponses);assert.equal(f.calls.reloads,0);
 view.resolve({currentRunState:state(newer)});await tick();assert.equal(f.host.consoleRun.status,'paused');
});
test('an already accepted resume clears ERROR blocking while retaining its scoped error dialog, before the next full view',async()=>{
 const view=deferred(),f=fixture(()=>view.promise,applyRemote);f.host.syncRun(run);f.host.activeControllerError.set({testRunId:'selected',message:'Retained error'});f.host.participantErrorReceptionSuspended=true;
 await f.host.applyReceivedParticipantCommand(remoteCommand('resume'),new AbortController().signal);
 assert.equal(f.host.hasControllerError,false);assert.equal(f.host.controllerError.message,'Retained error');assert.equal(f.calls.reloads,1);assert.equal(f.calls.saved,0);
 view.resolve({currentRunState:state(run)});await tick();
});
test('a terminal receipt cannot return a later same-Run entry to Starter',async()=>{
 const view=deferred(),f=fixture(label=>label==='Participant Starter'?{runtimeState:{participantSession:{...run,status:'launched'}}}:view.promise,applyRemote);f.host.syncRun(run);
 await f.host.applyReceivedParticipantCommand(remoteCommand('complete'),new AbortController().signal);
 await tick();assert.equal(f.calls.starter,0);view.resolve({currentRunState:state(run)});await tick();assert.equal(f.host.consoleRun.status,'running');assert.equal(f.calls.started,1,'An authorized fresh RUNNING view must restore reception after reentry from another controller.');
});
test('a scoped terminal receipt returns the controller to Starter without requiring a Unit or response',async()=>{
 const f=fixture(async()=>({runtimeState:{participantSession:{...run,status:'signed_in'}}}),applyRemote);f.host.syncRun({...run,status:'paused'});
 await f.host.applyReceivedParticipantCommand(remoteCommand('complete'),new AbortController().signal);
 await tick();assert.equal(f.calls.starter,1);assert.equal(f.host.commandControllerState.status,'TERMINATED_PAUSED');assert.equal(f.calls.saved,0);assert.equal(f.calls.drained,0);
});
test('a foreign terminal runtime state permanently rejects navigation',async()=>{
 const f=fixture(async()=>({runtimeState:{participantSession:{...run,status:'signed_in',contentReleaseId:'foreign'}}}),applyRemote);f.host.syncRun(run);
 await f.host.applyReceivedParticipantCommand(remoteCommand('complete'),new AbortController().signal);await tick();
 assert.equal(f.calls.starter,0);assert.equal(f.host.consoleRun.status,'paused');assert.equal(f.calls.failures.length,1);assert.equal(f.calls.failures[0].retryable,false);
});

test('a late terminal runtime reply is re-read after a newer native reentry instead of returning that entry to Starter',async()=>{
 const old=deferred(),entered=deferred(),view=deferred();let reads=0;
 const f=fixture(label=>{if(label!=='Participant Starter')return view.promise;if(++reads===1){entered.resolve();return old.promise;}return {runtimeState:{participantSession:{...run,status:'launched'}}};},applyRemote);
 f.host.syncRun(run);const pending=f.host.applyReceivedParticipantCommand(remoteCommand('complete'),new AbortController().signal);await entered.promise;
 const fresh={...run,unitResponses:{unit:'Later entry answer Ω'}};f.host.invalidateCurrentStateRefreshes();f.host.syncRun(fresh);
 old.resolve({runtimeState:{participantSession:{...run,status:'signed_in'}}});await pending;await tick();
 assert.equal(reads,2);assert.equal(f.calls.starter,0);assert.deepEqual(f.host.consoleRun.unitResponses,fresh.unitResponses);
 view.resolve({currentRunState:state(fresh)});await tick();
});
test('repeated local controller changes make terminal reconciliation retryable without accepting either stale runtime reply',async()=>{
 let f,reads=0;
 f=fixture(async()=>{reads++;f.host.invalidateCurrentStateRefreshes();return {runtimeState:{participantSession:{...run,status:'signed_in'}}};},applyRemote);f.host.syncRun(run);
 const controller=new AbortController();await f.host.applyReceivedParticipantCommand(remoteCommand('complete'),controller.signal);await tick();controller.abort();
 assert.equal(reads,2);assert.equal(f.calls.starter,0);assert.equal(f.host.consoleRun.status,'paused');assert.equal(f.calls.failures.length,0);
});
for(const commandType of ['lock_test','unlock_test','unlock_navigation','lock_navigation','set_testlet_time'])test(`${commandType} uses the confirmed paused status without reloading the Player`,async()=>{
 const view=deferred(),f=fixture(()=>view.promise,async(command,_signal,options)=>{options.controllerStatus();await options.apply({...remoteApplication(command),testRun:{...run,status:'paused'}});});f.host.syncRun({...run,status:'paused'});
 await f.host.applyReceivedParticipantCommand(remoteCommand(commandType),new AbortController().signal);
 assert.equal(f.host.consoleRun.status,'paused');assert.equal(f.host.commandControllerState.status,'PAUSED');assert.equal(f.calls.reloads,0);
 view.resolve({currentRunState:state({...run,status:'paused'})});await tick();
});

for(const origin of ['native','remote'])test(`${origin} termination cuts new reception before its held Starter view and allows an accepted resume to reactivate the same controller`,async()=>{
 const terminal=deferred(),view=deferred();let reads=0;
 const f=fixture(label=>label==='Participant Starter'?++reads===1?terminal.promise:{runtimeState:{participantSession:{...run,status:'launched'}}}:view.promise,applyRemote);
 f.host.syncRun(run);f.host.currentRunState=state(run);
 if(origin==='native')await f.host.applyNativeConsoleCommand({keyword:'terminate',scope:run,controllerStatus:'RUNNING',testRun:{...run,status:'paused'},participantSession:{...session,status:'signed_in'}},()=>true);
 else await f.host.applyReceivedParticipantCommand(remoteCommand('complete'),new AbortController().signal);
 await tick();assert.equal(reads,1);assert.equal(f.host.debugControllerStatus,'TERMINATED');assert.equal(f.calls.suspended,1);assert.equal(f.calls.starter,0);
 if(origin==='native')await f.host.applyNativeConsoleCommand({keyword:'resume',testRun:run,participantSession:session},()=>true);
 else await f.host.applyReceivedParticipantCommand(remoteCommand('resume'),new AbortController().signal);
 assert.equal(f.host.debugControllerStatus,'RUNNING');assert.equal(f.calls.started,1);assert.deepEqual(f.host.consoleRun.unitResponses,run.unitResponses);
 terminal.resolve({runtimeState:{participantSession:{...run,status:'signed_in'}}});await tick();assert.equal(reads,2);assert.equal(f.calls.starter,0);assert.equal(f.calls.requests.length,3,'Only the newer receipt may request its own Unit view.');
 view.resolve({currentRunState:state(run)});await tick();assert.equal(f.calls.starter,0);assert.deepEqual(f.calls.failures,[]);
});
test('a lightweight initial context cannot open remote reception through an early native resume',async()=>{
 const view=deferred(),f=fixture(()=>view.promise);f.host.syncRun(run);await f.host.applyNativeConsoleCommand({keyword:'resume',testRun:run,participantSession:session},()=>true);
 assert.equal(f.calls.started,0);view.resolve({currentRunState:state(run)});await tick();assert.equal(f.calls.started,1);
});
test('an ordinary paused view cannot reopen reception during terminal presentation reconciliation',async()=>{
 const terminal=deferred(),f=fixture(label=>label==='Participant Starter'?terminal.promise:{currentRunState:state({...run,status:'paused'})},applyRemote);
 f.host.syncRun(run);f.host.currentRunState=state(run);await f.host.applyReceivedParticipantCommand(remoteCommand('complete'),new AbortController().signal);
 await f.host.refreshCurrentStateInternal(true);assert.equal(f.calls.started,0);assert.equal(f.host.debugControllerStatus,'TERMINATED');
 terminal.resolve({runtimeState:{participantSession:{...run,status:'signed_in'}}});await tick();assert.equal(f.calls.starter,1);
});
test('an auxiliary command cannot reactivate a terminated controller while its Starter view is held',async()=>{
 const terminal=deferred(),f=fixture(label=>label==='Participant Starter'?terminal.promise:{currentRunState:state({...run,status:'paused'})},async(command,_signal,options)=>{await options.prepare();options.controllerStatus();await options.apply({...remoteApplication(command),testRun:{...run,status:'paused'}});});
 f.host.syncRun(run);f.host.currentRunState=state(run);await f.host.applyReceivedParticipantCommand(remoteCommand('complete'),new AbortController().signal);
 await f.host.applyReceivedParticipantCommand(remoteCommand('lock_test'),new AbortController().signal);await tick();
 assert.equal(f.calls.started,0);assert.equal(f.host.debugControllerStatus,'TERMINATED');
 terminal.resolve({runtimeState:{participantSession:{...run,status:'signed_in'}}});await tick();assert.equal(f.calls.starter,1);
});

test('an ordinary identical Run view cannot strand a confirmed Goto behind its target Unit view',async()=>{
 const reply=deferred(),entered=deferred(),targetView=deferred();let reads=0;
 const f=fixture(()=>++reads===1?{currentRunState:state(structuredClone(run))}:targetView.promise,
  async(command,_signal,options)=>{options.controllerStatus();entered.resolve();await reply.promise;await options.apply({...remoteApplication(command),testRun:{...run,currentUnitKey:'next-unit'}});});
 f.host.syncRun(run);f.host.currentRunState=state(run);
 const pending=f.host.applyReceivedParticipantCommand(remoteCommand('goto'),new AbortController().signal);await entered.promise;
 await f.host.refreshCurrentStateInternal(true);assert.equal(f.host.consoleRun.currentUnitKey,'unit');
 reply.resolve();await pending;assert.equal(f.host.consoleRun.currentUnitKey,'next-unit');assert.equal(f.host.unitViewPending,true);
 assert.deepEqual(f.host.consoleRun.unitResponses,run.unitResponses);targetView.resolve({currentRunState:{...state({...run,currentUnitKey:'next-unit'}),currentUnit:{...state(run).currentUnit,unitKey:'next-unit'}}});await tick();
});

for(const [name,status,parentStatus] of [['sibling parent activation','paused','launched'],['inactive parent','running','signed_in']])test(`a ${name} cannot reopen a terminated selected controller`,async()=>{
 const selected={...run,status},f=fixture(async()=>({currentRunState:{...state(selected),participantSession:{...session,status:parentStatus}}}),applyRemote);
 f.host.syncRun({...run,status:'paused'});f.host.currentRunState=state({...run,status:'paused'});
 f.host.commandControllerState={testRunId:run.testRunId,status:'TERMINATED'};
 await f.host.refreshCurrentStateInternal(true,true);assert.equal(f.calls.started,0);assert.equal(f.host.commandControllerState.status,'TERMINATED');
});
test('a running view captured before terminal application cannot restore reception after its verified effect',async()=>{
 const ordinary=deferred(),runtime=deferred(),f=fixture(label=>label==='Participant Starter'?runtime.promise:ordinary.promise,applyRemote);
 f.host.syncRun(run);f.host.currentRunState=state(run);const reading=f.host.refreshCurrentStateInternal(true);
 await f.host.applyReceivedParticipantCommand(remoteCommand('complete'),new AbortController().signal);await tick();
 ordinary.resolve({currentRunState:state(run)});await reading;
 assert.equal(f.calls.started,0);assert.equal(f.host.consoleRun.status,'paused');assert.equal(f.host.commandControllerState.status,'TERMINATED');
 runtime.resolve({runtimeState:{participantSession:{...run,status:'signed_in'}}});await tick();assert.equal(f.calls.starter,1);
});

for (const status of ['running','paused']) test(`a newer same-Run entry revision reopens a terminated ${status} controller`,async()=>{
 const entered={...run,status,controllerEntry:{active:true,revision:4}},terminated={...run,status:'paused',controllerEntry:{active:false,revision:3}};
 const f=fixture(async()=>({currentRunState:state(entered)}),applyRemote);f.host.syncRun(terminated);f.host.currentRunState=state(terminated);
 f.host.commandControllerState={testRunId:run.testRunId,status:'TERMINATED_PAUSED',entryRevision:3};
 await f.host.refreshCurrentStateInternal(true,true);
 assert.equal(f.calls.started,1,'A newer scoped entry must restore reception even when the selected Run is still paused.');
 assert.equal(f.host.commandControllerState.status,status.toUpperCase());assert.equal(f.host.commandControllerState.entryRevision,4);
 assert.deepEqual(f.host.consoleRun.unitResponses,run.unitResponses);assert.deepEqual(f.host.consoleRun.unitResponseFieldTimestamps,run.unitResponseFieldTimestamps);
});
test('a launched sibling parent cannot authorize a closed selected entry even when its canonical Run is running',async()=>{
 const closed={...run,controllerEntry:{active:false,revision:3}},f=fixture(async()=>({currentRunState:state(closed)}),applyRemote);
 f.host.syncRun(closed);f.host.currentRunState=state(closed);f.host.commandControllerState={testRunId:run.testRunId,status:'TERMINATED',entryRevision:3};
 await f.host.refreshCurrentStateInternal(true,true);assert.equal(f.calls.started,0);assert.equal(f.host.commandControllerState.status,'TERMINATED');
});
for(const entry of [{active:true,revision:2},{active:true,revision:3}])test(`an entry revision ${entry.revision} cannot reopen terminal revision 3`,async()=>{
 const closed={...run,status:'paused',controllerEntry:{active:false,revision:3}},f=fixture(async()=>({currentRunState:state({...run,controllerEntry:entry})}),applyRemote);
 f.host.syncRun(closed);f.host.currentRunState=state(closed);f.host.commandControllerState={testRunId:run.testRunId,status:'TERMINATED',entryRevision:3};
 await f.host.refreshCurrentStateInternal(true,true);assert.equal(f.calls.started,0);assert.equal(f.host.commandControllerState.status,'TERMINATED');
});
for(const entry of [null,{active:'true',revision:4},{active:true,revision:0},{active:true,revision:1.5},{active:true,revision:Number.MAX_SAFE_INTEGER+1}])test(`invalid server entry metadata cannot authorize a view: ${JSON.stringify(entry)}`,async()=>{
 const f=fixture(async()=>({currentRunState:state({...run,controllerEntry:entry})}),applyRemote);f.host.syncRun(run);f.host.currentRunState=state(run);
 await assert.rejects(f.host.refreshCurrentStateInternal(true,true),/controller entry/);assert.equal(f.calls.started,0);assert.equal(f.calls.applied,0);
});

test('a held native terminal receipt cannot replace a newer externally observed paused entry',async()=>{
 const newer={...run,status:'paused',controllerEntry:{active:true,revision:5}},f=fixture(async()=>({currentRunState:state(newer)}),applyRemote);
 f.host.syncRun(newer);f.host.currentRunState=state(newer);f.host.commandControllerState={testRunId:run.testRunId,status:'PAUSED',entryRevision:5};
 await f.host.applyNativeConsoleCommand({keyword:'terminate',controllerStatus:'PAUSED',testRun:{...run,status:'paused',controllerEntry:{active:false,revision:4}},participantSession:{...session,status:'signed_in'}},()=>true);await tick();
 assert.equal(f.calls.starter,0);assert.equal(f.calls.suspended,0);assert.equal(f.host.debugControllerStatus,'PAUSED');assert.deepEqual(f.host.consoleRun.controllerEntry,{active:true,revision:5});
});
test('a legacy view cannot erase already verified entry evidence',async()=>{
 const selected={...run,status:'paused',controllerEntry:{active:false,revision:3}},f=fixture(async()=>({currentRunState:state(run)}),applyRemote);
 f.host.syncRun(selected);f.host.currentRunState=state(selected);f.host.commandControllerState={testRunId:run.testRunId,status:'TERMINATED',entryRevision:3};
 await f.host.refreshCurrentStateInternal(true,true);assert.equal(f.calls.applied,0);assert.equal(f.calls.started,0);assert.deepEqual(f.host.consoleRun,selected);
});
