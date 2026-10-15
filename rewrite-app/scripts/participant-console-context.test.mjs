import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {productionApiRoutes,resolveRoutePath,parseVeronaUnitResponse,hasMeaningfulVeronaResponse} from '@testcenter-rewrite-app/contracts';
import {isParticipantControllerDispatches,participantControllerContextRoute} from '@testcenter-rewrite-app/contracts/participant-native-command';
const saveBarrierCode=ts.transpileModule(readFileSync(new URL('../apps/web/src/app/participant-save-barrier.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {createParticipantSaveBarriers}=await import('data:text/javascript;base64,'+Buffer.from(saveBarrierCode).toString('base64'));
const source=readFileSync(new URL('../apps/web/src/app/participant-view.facade.ts',import.meta.url),'utf8');
const ast=ts.createSourceFile('facade.ts',source,ts.ScriptTarget.Latest,true),declaration=ast.statements.find(ts.isClassDeclaration);
const names=['captureControllerTimerInterruption','isControllerTimerInterrupted','handleVeronaControllerError','pendingControllerStatus','beginControllerCommand','isOlderControllerPhase','finishControllerPhase','isOlderRunState','consoleRun','isParticipantPlayerFocused','eagerBookletLoading','unitViewPending','isRunPaused','debugControllerStatus','nativeControllerStatus','controllerLogState','isParticipantLogin','isParticipantStarter','resumeSessionInternal','debugRunState','readCurrentRunState','syncRun','updateCurrentTextResponse','hasControllerError','controllerError','refreshCurrentStateInternal','validateParticipantControllerContext','invalidateCurrentStateRefreshes','applyNativeConsoleCommand','prepareNativeConsoleCommand','applyReceivedParticipantCommand','reconcileParticipantTerminalState','startAcceptedParticipantReception'];
const members=names.map(name=>{const member=declaration.members.find(item=>item.name?.getText(ast)===name);assert.ok(member,name);return member.getText(ast);});
// Inject only module resolution; the actual production method bodies execute unchanged.
const emitted=ts.transpileModule(`export const load=(productionApiRoutes,resolveRoutePath,prettyPrintJson,withSelectedParticipantRun,loadControllerContract,parseVeronaUnitResponse,hasMeaningfulVeronaResponse,loadCommandExecution,isParticipantControllerDispatches)=>{const listParticipantSaveOutboxEntriesForRun=()=>[];return class Host {${members.join('\n').replaceAll('import("@testcenter-rewrite-app/contracts/participant-native-command")','loadControllerContract()').replaceAll('import("./participant-command-execution")','loadCommandExecution()')}}}`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {load}=await import('data:text/javascript;base64,'+Buffer.from(emitted).toString('base64'));
const executionSource=readFileSync(new URL('../apps/web/src/app/participant-command-execution.ts',import.meta.url),'utf8');
const executionAst=ts.createSourceFile('execution.ts',executionSource,ts.ScriptTarget.Latest,true);
const reconciliation=executionAst.statements.filter(ts.isVariableStatement).flatMap(item=>[...item.declarationList.declarations]).find(item=>item.name.getText(executionAst)==='reconcileAcceptedParticipantCommand');assert.ok(reconciliation?.initializer);
const settlement=executionAst.statements.filter(ts.isVariableStatement).flatMap(item=>[...item.declarationList.declarations]).find(item=>item.name.getText(executionAst)==='settleAcceptedParticipantCommand');assert.ok(settlement?.initializer);
const reconciliationCode=ts.transpileModule(`export const reconcileAcceptedParticipantCommand=${reconciliation.initializer.getText(executionAst)}; export const settleAcceptedParticipantCommand=${settlement.initializer.getText(executionAst)}`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {reconcileAcceptedParticipantCommand,settleAcceptedParticipantCommand}=await import('data:text/javascript;base64,'+Buffer.from(reconciliationCode).toString('base64'));
const hostClass=(execute,interruptTimer)=>load(productionApiRoutes,resolveRoutePath,JSON.stringify,(path,id)=>path+(id?'?testRunId='+id:''),async()=>({participantControllerContextRoute}),parseVeronaUnitResponse,hasMeaningfulVeronaResponse,async()=>({executeReceivedParticipantCommand:execute,deliverParticipantControllerTimerInterruption:interruptTimer,reconcileAcceptedParticipantCommand,settleAcceptedParticipantCommand}),isParticipantControllerDispatches);
const deferred=()=>{let resolve,reject;const promise=new Promise((done,fail)=>{resolve=done;reject=fail;});return {promise,resolve,reject};};
const run={tenantId:'tenant',workspaceId:'workspace',participantSessionId:'participant',testRunId:'selected',contentReleaseId:'release',bookletKey:'booklet',bookletAssignmentKey:'booklet',status:'running',currentUnitKey:'unit',unitResponses:{unit:'Exact owned Ω'},unitResponseFieldTimestamps:{unit:{opaque:123}},testletTimers:{},createdAt:'2026-10-12T00:00:00Z',updatedAt:'2026-10-12T00:00:00Z'};
const session={tenantId:'tenant',workspaceId:'workspace',participantSessionId:'participant',status:'launched'};
const state=record=>({participantSession:session,testRun:record,currentUnit:{unitKey:'unit'},executionMode:{receiveRemoteCommands:true},booklet:{policy:{player:{loadingMode:'lazy'}}}});
const fixture=(request=async()=>({currentRunState:state(run)}),execute=()=>assert.fail('Unexpected remote application'),interruptTimer=()=>assert.fail('Unexpected timer interruption'))=>{
 const Host=hostClass(execute,interruptTimer);
 let error=null,consoleRunValue=null,phase=null,timerCapture=null;const calls={requests:[],applied:0,suspended:0,started:0,failures:[],drained:0,saved:0,reloads:0,starter:0},host=new Host();
 Object.assign(host,{controllerTimerInterruption:Object.assign(()=>timerCapture,{set:value=>{timerCapture=value;}}),terminalCommandPhases:new WeakMap(),commandTimerInterruptions:new WeakMap(),controllerCommandPhase:Object.assign(()=>phase,{set:value=>{phase=value;}}),runtime:{participantSessionId:'participant',testRunId:'selected',currentRunStateView:'',currentUnitResponse:'Old unowned controller draft',bookletKey:'booklet'},consoleTestRun:Object.assign(()=>consoleRunValue,{set:value=>{consoleRunValue=value;}}),currentRunState:null,
  currentStateRefreshSequence:0,currentStateAppliedRefreshSequence:0,bookletAssetLoadStartedAtMs:new Map(),loadedBookletAssets:()=>null,veronaErrorText:'Owned load error',
  requestState:{request:async(...args)=>{calls.requests.push(args[2]);return request(...args);},isApiError:error=>Boolean(error?.error)},
  activeControllerError:Object.assign(()=>error,{set:value=>{error=value;}}),participantErrorReceptionSuspended:false,
  participantEvents:{suspend(){calls.suspended++;},stop(){},start(){calls.started++;}},captureTimerLifecycleTransitions(){},syncParticipantHeaderVisibility(){},syncActiveBookletCustomTexts(){},
  recordLoadedBookletAssets(){},shouldPreserveCurrentTextDraft:()=>false,syncCurrentRunState(value){this.currentRunState=value;calls.applied++;},syncCurrentUnitResponse(){},
  reconcileOptimisticVeronaResponse(){},restorePersistentVeronaSave(){},persistLoadCompleteLog(){},loadBookletAssetsInBackground(){},refreshParticipantReviewsInternal:async()=>{},persistState(){},
  settleVeronaAutoSaveBeforeForegroundAction:async()=>{calls.drained++;return null;},saveCurrentDraftBeforeCompleteInternal:async()=>{calls.saved++;},
  veronaSaveBarriers:createParticipantSaveBarriers(),clearVeronaSaveBuffer(){},drainVeronaSaveQueue:async()=>{},ephemeralUnitResponses:new Map(),nativeConsoleCommandFailed(error){calls.failures.push(error);},commandReloadSequence:{update(){calls.reloads++;}},presentParticipantStarter(){calls.starter++;},replaceSelectedRunEntryLink:async()=>{},commandControllerState:null,remoteTerminalErrorRunId:null});
 return {host,calls};
};
for(const keyword of ['pause','goto'])test(`native ${keyword} retains independent answer drainage while an older terminal buffer is held`,async()=>{
 const held=deferred(),f=fixture();f.host.syncRun(run);f.host.currentRunState=state(run);f.host.runtime.currentUnitResponse='Unconfirmed controller draft';
 let drained=false;f.host.drainVeronaSaveQueue=async()=>{await held.promise;drained=true;};
 await f.host.prepareNativeConsoleCommand(()=>true,keyword);assert.equal(drained,false);assert.equal(f.calls.saved,0);
 held.resolve();await tick();assert.equal(drained,true);assert.equal(f.calls.failures.length,0);assert.equal(f.calls.saved,0);
});
test('native Resume navigates without starting another foreground buffer settlement',async()=>{
 const f=fixture();f.host.syncRun(run);f.host.currentRunState=state(run);f.host.settleVeronaAutoSaveBeforeForegroundAction=()=>assert.fail('Resume started a saved-event barrier');f.host.drainVeronaSaveQueue=()=>assert.fail('Resume closed buffers');
 await f.host.prepareNativeConsoleCommand(()=>true,'resume');assert.equal(f.calls.saved,0);
});
test('termination still joins its captured answer request while the next Unit view is unavailable',async()=>{
 const f=fixture(),held=deferred();f.host.syncRun(run);assert.equal(f.host.debugRunState,null);
 const packet={version:1,testRunId:'selected',deliveryId:'held-answer',unitKey:'unit',response:'Owned exact Ω',logs:[],status:'running',queuedAt:'2026-10-14T00:00:00Z'};
 f.host.veronaSaveBarriers.track(packet,held.promise);f.host.settleVeronaAutoSaveBeforeForegroundAction=async barrier=>{assert.deepEqual([...barrier.deliveryIds],['held-answer']);await barrier.wait();return null;};
 let done=false;const preparation=f.host.prepareNativeConsoleCommand(()=>true,'terminate',phaseDispatch(1)).then(()=>{done=true;});await tick();assert.equal(done,false);
 held.resolve();await preparation;assert.equal(done,true);assert.equal(f.calls.saved,0);
});
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
 assert.equal(f.host.nativeControllerStatus,'TERMINATED_PAUSED');
 f.host.activeControllerError.set({testRunId:'selected',message:'Retained error'});f.host.participantErrorReceptionSuspended=true;
 assert.equal(f.host.debugControllerStatus,'TERMINATED_PAUSED');
 assert.equal(f.host.nativeControllerStatus,'TERMINATED_PAUSED');
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
for(const origin of ['native','remote'])test(`a late ${origin} receipt cannot overwrite a newer Run revision with the same entry`,async()=>{
 const view=deferred(),latest={...run,status:'paused',stateRevision:9,controllerEntry:{active:true,revision:1},unitResponses:{unit:'Exact newer response Ω'}},older={...run,stateRevision:8,controllerEntry:latest.controllerEntry};
 const f=fixture(()=>view.promise,async(command,_signal,options)=>{options.controllerStatus();await options.apply({...remoteApplication(command),testRun:older});});
 f.host.syncRun(latest);f.host.currentRunState=state(latest);
 if(origin==='native')await f.host.applyNativeConsoleCommand({keyword:'resume',testRun:older,participantSession:session},()=>true);
 else await f.host.applyReceivedParticipantCommand(remoteCommand('resume'),new AbortController().signal);
 assert.equal(f.host.consoleRun.stateRevision,9);assert.equal(f.host.consoleRun.status,'paused');assert.deepEqual(f.host.consoleRun.unitResponses,latest.unitResponses);assert.equal(f.calls.reloads,0);
 view.resolve({currentRunState:state(latest)});await tick();
});
test('a higher Run revision projects a newer remote effect across an intervening local view',async()=>{
 const entered=deferred(),reply=deferred(),view=deferred(),initial={...run,stateRevision:4},local={...run,status:'paused',stateRevision:5},latest={...run,stateRevision:6,unitResponses:{unit:'Newest stored answer Ω'}};
 const f=fixture(()=>view.promise,async(command,_signal,options)=>{options.controllerStatus();entered.resolve();await reply.promise;await options.apply({...remoteApplication(command),testRun:latest});});
 f.host.syncRun(initial);f.host.currentRunState=state(initial);const pending=f.host.applyReceivedParticipantCommand(remoteCommand('resume'),new AbortController().signal);await entered.promise;
 f.host.invalidateCurrentStateRefreshes();f.host.syncRun(local);reply.resolve();await pending;
 assert.equal(f.host.consoleRun.stateRevision,6);assert.equal(f.host.consoleRun.status,'running');assert.equal(f.calls.reloads,1);assert.deepEqual(f.host.consoleRun.unitResponses,latest.unitResponses);
 view.resolve({currentRunState:state(latest)});await tick();
});
test('a newly requested full view cannot downgrade the selected Run revision',async()=>{
 const latest={...run,stateRevision:7},f=fixture(async()=>({currentRunState:state({...run,stateRevision:6,status:'paused'})}));
 f.host.syncRun(latest);f.host.currentRunState=state(latest);await f.host.refreshCurrentStateInternal(true,true);
 assert.equal(f.host.consoleRun.stateRevision,7);assert.equal(f.calls.applied,0);
});
for(const ordering of [{stateRevision:null},{stateRevision:0},{stateRevision:Number.MAX_SAFE_INTEGER+1},{controllerDispatches:null},{controllerDispatches:{owned:0}}])test('invalid ordering metadata cannot establish a selected controller context',async()=>{
 const f=fixture(async()=>({controllerContext:{participantSession:session,testRun:{...run,...ordering}}}));
 await assert.rejects(f.host.refreshCurrentStateInternal(true),error=>error.retryable===false);assert.equal(f.host.consoleRun,null);assert.equal(f.calls.requests.length,1);
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

test('a newer selected entry remains authoritative when another Run subsequently deactivates the shared parent',async()=>{
 const entered={...run,status:'paused',controllerEntry:{active:true,revision:4}},stopped={...run,status:'paused',controllerEntry:{active:false,revision:3}};
 const f=fixture(async()=>({currentRunState:{...state(entered),participantSession:{...session,status:'signed_in'}}}),applyRemote);
 f.host.syncRun(stopped);f.host.currentRunState=state(stopped);f.host.commandControllerState={testRunId:run.testRunId,status:'TERMINATED_PAUSED',entryRevision:3};
 await f.host.refreshCurrentStateInternal(true,true);assert.equal(f.calls.started,1);assert.equal(f.host.debugControllerStatus,'PAUSED');assert.equal(f.host.commandControllerState.entryRevision,4);
});

for(const [active,revision,parentStatus] of [[false,3,'launched'],[true,4,'signed_in']])test(`terminal presentation follows the selected entry ${active}/${revision} with shared parent ${parentStatus}`,async()=>{
 const stopped={...run,status:'paused',controllerEntry:{active:false,revision:3}},selected={...stopped,controllerEntry:{active,revision}},parent={...run,status:parentStatus};
 const f=fixture(async label=>label==='Participant Starter'?{runtimeState:{participantSession:parent}}:label==='Participant Controller'?{controllerContext:{participantSession:parent,testRun:selected}}:{currentRunState:{...state(selected),participantSession:parent}},applyRemote);
 f.host.syncRun(stopped);f.host.currentRunState=state(stopped);f.host.commandControllerState={testRunId:run.testRunId,status:'TERMINATED_PAUSED',entryRevision:3};
 await f.host.reconcileParticipantTerminalState(stopped,false,()=>true);await tick();
 assert.equal(f.calls.starter,active?0:1);assert.equal(f.calls.started,active?1:0);assert.deepEqual(f.host.consoleRun.unitResponses,run.unitResponses);
});
for(const change of [value=>{value.bookletKey='foreign';},value=>{delete value.controllerEntry;},value=>{value.controllerEntry={active:true,revision:3};},value=>{value.controllerEntry=null;}])test('contradictory terminal entry evidence cannot navigate or reopen reception',async()=>{
 const stopped={...run,status:'paused',controllerEntry:{active:false,revision:3}},selected=structuredClone(stopped);change(selected);const parent={...run,status:'signed_in'};
 const f=fixture(async label=>label==='Participant Starter'?{runtimeState:{participantSession:parent}}:{controllerContext:{participantSession:parent,testRun:selected}},applyRemote);
 f.host.syncRun(stopped);f.host.currentRunState=state(stopped);f.host.commandControllerState={testRunId:run.testRunId,status:'TERMINATED_PAUSED',entryRevision:3};
 await assert.rejects(f.host.reconcileParticipantTerminalState(stopped,false,()=>true),error=>error.retryable===false);assert.equal(f.calls.starter,0);assert.equal(f.calls.started,0);
});

for(const origin of ['native','remote'])test(`a replayed ${origin} termination receipt retains the current selected entry despite an inactive shared parent`,async()=>{
 const entered={...run,status:'paused',controllerEntry:{active:true,revision:5}},parent={...session,status:'signed_in'};
 const execute=async(command,_signal,options)=>{options.controllerStatus();await options.apply({...remoteApplication(command),testRun:entered,participantSession:parent,applied:false});};
 const f=fixture(async()=>({currentRunState:{...state(entered),participantSession:parent}}),execute);
 f.host.syncRun({...entered,controllerEntry:{active:false,revision:4}});f.host.currentRunState=state({...entered,controllerEntry:{active:false,revision:4}});
 f.host.commandControllerState={testRunId:run.testRunId,status:'TERMINATED_PAUSED',entryRevision:4};
 if(origin==='native')await f.host.applyNativeConsoleCommand({keyword:'terminate',controllerStatus:'PAUSED',testRun:entered,participantSession:parent,applied:false},()=>true);
 else await f.host.applyReceivedParticipantCommand(remoteCommand('complete'),new AbortController().signal);
 await tick();assert.equal(f.calls.starter,0);assert.equal(f.calls.suspended,0);assert.ok(f.calls.started>0);assert.equal(f.host.debugControllerStatus,'PAUSED');assert.deepEqual(f.host.consoleRun.controllerEntry,{active:true,revision:5});
});

test('entry evidence without a started Run status cannot reopen a terminated controller',async()=>{
 const stopped={...run,status:'paused',controllerEntry:{active:false,revision:3}},created={...run,status:'created',controllerEntry:{active:true,revision:4}};
 const f=fixture(async()=>({currentRunState:state(created)}),applyRemote);f.host.syncRun(stopped);f.host.currentRunState=state(stopped);f.host.commandControllerState={testRunId:run.testRunId,status:'TERMINATED',entryRevision:3};
 await f.host.refreshCurrentStateInternal(true,true);assert.equal(f.calls.started,0);assert.equal(f.host.debugControllerStatus,'TERMINATED');
});

const phaseDispatch=sequence=>({controllerId:'owned-controller',sequence});
test('Pause, Resume and Goto enter their controller phase synchronously without forging a Run or navigating',()=>{
 const f=fixture();f.host.syncRun(run);f.host.currentRunState=state(run);const original=structuredClone(f.host.consoleRun);
 for(const [keyword,status,sequence]of [['pause','PAUSED',1],['resume','RUNNING',2],['goto','RUNNING',3]]){
  f.host.beginControllerCommand('selected',keyword,phaseDispatch(sequence));
  assert.equal(f.host.debugControllerStatus,status);assert.equal(f.host.nativeControllerStatus,status);
  assert.deepEqual(f.host.consoleRun,original);assert.equal(f.host.isRunPaused,false);assert.equal(f.calls.reloads,0);assert.equal(f.calls.saved,0);
 }
 f.host.beginControllerCommand('selected','pause',phaseDispatch(1));assert.equal(f.host.debugControllerStatus,'RUNNING','An application retry cannot restart an older phase.');
 f.host.beginControllerCommand('foreign','pause',phaseDispatch(4));assert.equal(f.host.debugControllerStatus,'RUNNING');
});
test('a held older native receipt cannot replace the newer immediate phase or reload its Player',async()=>{
 const view=deferred(),f=fixture(()=>view.promise);f.host.syncRun(run);f.host.currentRunState=state(run);
 f.host.beginControllerCommand('selected','pause',phaseDispatch(1));f.host.beginControllerCommand('selected','resume',phaseDispatch(2));
 await f.host.applyNativeConsoleCommand({keyword:'pause',testRun:{...run,status:'paused'},participantSession:session,controllerStatus:'RUNNING'},()=>true,phaseDispatch(1));
 assert.equal(f.host.debugControllerStatus,'RUNNING');assert.equal(f.calls.reloads,0);
 await f.host.applyNativeConsoleCommand({keyword:'resume',testRun:run,participantSession:session,controllerStatus:'PAUSED'},()=>true,phaseDispatch(2));
 assert.equal(f.host.debugControllerStatus,'RUNNING');assert.equal(f.calls.reloads,1);
 view.resolve({currentRunState:state(run)});await tick();assert.equal(f.host.debugControllerStatus,'RUNNING');
});
test('a modern full view cannot revive the previous ERROR while the accepted Resume receipt is held',async()=>{
 const f=fixture();f.host.syncRun(run);f.host.currentRunState=state(run);f.host.activeControllerError.set({testRunId:'selected',unitKey:'unit',message:'Retained dialog'});f.host.participantErrorReceptionSuspended=true;
 f.host.beginControllerCommand('selected','resume',phaseDispatch(1));
 f.host.syncRun({...run,stateRevision:2,controllerDispatches:{'owned-controller':1}});
 assert.equal(f.host.hasControllerError,false);assert.equal(f.host.debugControllerStatus,'RUNNING');assert.equal(f.host.controllerError.message,'Retained dialog');assert.ok(f.calls.started>0);
});
test('a new ERROR wins over an already started command and its late receipt, while a fresh Resume exits ERROR',async()=>{
 const f=fixture();f.host.syncRun(run);f.host.currentRunState=state(run);
 f.host.beginControllerCommand('selected','pause',phaseDispatch(1));
 const error={testRunId:'selected',unitKey:'unit',message:'Newer Player error'};f.host.handleVeronaControllerError(error);
 assert.equal(f.host.hasControllerError,true);assert.equal(f.host.debugControllerStatus,'ERROR');
 await f.host.applyNativeConsoleCommand({keyword:'pause',testRun:{...run,status:'paused'},participantSession:session,controllerStatus:'RUNNING'},()=>true,phaseDispatch(1));
 assert.equal(f.host.hasControllerError,true);assert.equal(f.calls.requests.length,0);assert.equal(f.host.consoleRun.status,'running');
 f.host.beginControllerCommand('selected','resume',phaseDispatch(2));assert.equal(f.host.debugControllerStatus,'RUNNING');assert.equal(f.host.hasControllerError,false);assert.equal(f.host.controllerError,error);
});
test('remote phase starts before its lazy execution module resolves and observes the current server dispatch highwater',async()=>{
 const gate=deferred(),f=fixture(async()=>({currentRunState:state(run)}),async()=>gate.promise);f.host.syncRun({...run,controllerDispatches:{'owned-controller':8}});f.host.currentRunState=state(run);
 let observed;const pending=f.host.applyReceivedParticipantCommand(remoteCommand('pause'),new AbortController().signal,value=>{observed=value;return phaseDispatch(9);});
 assert.equal(f.host.debugControllerStatus,'PAUSED');assert.deepEqual(observed,{'owned-controller':8});assert.equal(f.host.consoleRun.status,'running');
 gate.resolve();await pending;
 const canceled=new AbortController();canceled.abort();await f.host.applyReceivedParticipantCommand(remoteCommand('resume'),canceled.signal,()=>assert.fail('Canceled receipt allocated a phase'));
 assert.equal(f.host.debugControllerStatus,'PAUSED');
});

for(const initial of ['RUNNING','PAUSED'])test(`the ${initial} controller enters its terminal phase without forging the Run or navigating before buffers`,()=>{
 const original={...run,status:initial.toLowerCase()},f=fixture();f.host.syncRun(original);f.host.currentRunState=state(original);
 f.host.beginControllerCommand('selected','terminate',phaseDispatch(1),initial);
 assert.equal(f.host.debugControllerStatus,initial==='PAUSED'?'TERMINATED_PAUSED':'TERMINATED');assert.deepEqual(f.host.consoleRun,original);
 assert.equal(f.calls.suspended,1);assert.equal(f.calls.starter,0);assert.equal(f.calls.requests.length,0);assert.equal(f.calls.saved,0);
});
for(const keyword of ['pause','resume'])test(`a legacy terminal receipt cannot replace a later ${keyword} entry`,async()=>{
 const gate=deferred(),f=fixture(()=>gate.promise);f.host.syncRun(run);f.host.currentRunState=state(run);
 f.host.beginControllerCommand('selected','terminate',phaseDispatch(1),'RUNNING');f.host.beginControllerCommand('selected',keyword,phaseDispatch(2));
 await f.host.applyNativeConsoleCommand({keyword:'terminate',testRun:{...run,status:'paused',controllerEntry:{active:false,revision:1}},participantSession:{...session,status:'signed_in'},controllerStatus:'RUNNING'},()=>true,phaseDispatch(1));
 assert.equal(f.host.debugControllerStatus,keyword==='pause'?'PAUSED':'RUNNING');assert.equal(f.calls.starter,0);assert.deepEqual(f.host.consoleRun,run);
 gate.resolve({currentRunState:state({...run,status:keyword==='pause'?'paused':'running',controllerEntry:{active:true,revision:2}})});await tick();assert.equal(f.host.debugControllerStatus,keyword==='pause'?'PAUSED':'RUNNING');
});

for (const origin of ['native', 'remote']) for (const initial of ['RUNNING', 'PAUSED']) for (const later of ['pause', 'resume']) {
 test(`${origin}: the ${initial} termination finishes its own Starter continuation after later ${later} without reverting the controller`,async()=>{
  const runtime=deferred(),entered=deferred();let f,settled=false;
  const status=later==='pause'?'paused':'running',latest={...run,status,unitResponses:{unit:'Later trusted answer Ω'},controllerEntry:{active:true,revision:2},controllerDispatches:{'owned-controller':2},stateRevision:3};
  const closed={...latest,controllerEntry:{active:false,revision:3},stateRevision:4};
  const laterPhase=()=>{f.host.beginControllerCommand('selected',later,phaseDispatch(2));f.host.syncRun(latest);f.host.finishControllerPhase(phaseDispatch(2));f.host.commandControllerState={testRunId:'selected',status:status.toUpperCase(),entryRevision:2};};
  const request=label=>{if(label==='Participant Starter'){entered.resolve();return runtime.promise;}assert.equal(label,'Participant Controller');return {controllerContext:{participantSession:{...session,contentReleaseId:'release',status:'signed_in'},testRun:closed}};};
  f=fixture(request,async(command,_signal,options)=>{laterPhase();await options.apply({...remoteApplication(command),command:{...command,commandCompletion:'browser-v1'},testRun:closed,terminalContinuation:true,superseded:true},phaseDispatch(1));});
  const original={...run,status:initial.toLowerCase()};f.host.syncRun(original);f.host.currentRunState=state(original);
  let pending;
  if(origin==='native'){
   f.host.beginControllerCommand('selected','terminate',phaseDispatch(1),initial);laterPhase();
   pending=f.host.applyNativeConsoleCommand({keyword:'terminate',controllerStatus:initial,commandCompletion:'browser-v1',terminalContinuation:true,superseded:true,testRun:closed,participantSession:{...session,status:'signed_in'}},()=>true,phaseDispatch(1));
  }else pending=f.host.applyReceivedParticipantCommand(remoteCommand('complete'),new AbortController().signal,()=>phaseDispatch(1));
  pending=pending.then(()=>{settled=true;});await entered.promise;await tick();
  assert.equal(settled,false);assert.equal(f.calls.starter,0);assert.equal(f.host.debugControllerStatus,status.toUpperCase());assert.deepEqual(f.host.consoleRun,latest);
  runtime.resolve({runtimeState:{participantSession:{...run,status:'signed_in'}}});await pending;
  assert.equal(settled,true);assert.equal(f.calls.starter,1);assert.equal(f.host.debugControllerStatus,status.toUpperCase());assert.deepEqual(f.host.consoleRun,latest);assert.equal(f.calls.failures.length,0);
 });
}
test('a trusted Player ERROR after terminal phase entry survives the old termination receipt',async()=>{
 const f=fixture();f.host.syncRun(run);f.host.currentRunState=state(run);f.host.beginControllerCommand('selected','terminate',phaseDispatch(1),'RUNNING');
 f.host.handleVeronaControllerError({testRunId:'selected',unitKey:'unit',message:'Newer error'});assert.equal(f.host.debugControllerStatus,'ERROR');
 await f.host.applyNativeConsoleCommand({keyword:'terminate',testRun:{...run,status:'paused'},participantSession:session,controllerStatus:'RUNNING'},()=>true,phaseDispatch(1));
 assert.equal(f.host.debugControllerStatus,'ERROR');assert.equal(f.calls.requests.length,0);assert.equal(f.calls.starter,0);
});
test('remote forced termination starts before its lazy execution module and retains its first observation on retry',async()=>{
 let attempt=0;const observations=[],command=remoteCommand('complete'),f=fixture(undefined,async(_command,_signal,options)=>{observations.push(options.controllerStatus());if(++attempt===1)throw Error('Owned lost receipt');});
 f.host.syncRun(run);f.host.currentRunState=state(run);let allocations=0;const allocate=()=>{allocations++;return phaseDispatch(1);};
 const pending=f.host.applyReceivedParticipantCommand(command,new AbortController().signal,allocate);assert.equal(f.host.debugControllerStatus,'RUNNING');await Promise.resolve();assert.equal(f.host.debugControllerStatus,'TERMINATED');await assert.rejects(pending,/Owned lost receipt/);
 f.host.beginControllerCommand('selected','pause',phaseDispatch(2));await f.host.applyReceivedParticipantCommand(command,new AbortController().signal,allocate);
 assert.equal(f.host.debugControllerStatus,'PAUSED');assert.deepEqual(observations,['RUNNING','RUNNING']);assert.equal(allocations,1);
});

test('a native no-op receipt cannot finish the first pending terminal phase or navigate',async()=>{
 const gate=deferred(),f=fixture(()=>gate.promise);f.host.syncRun(run);f.host.currentRunState=state(run);f.host.beginControllerCommand('selected','terminate',phaseDispatch(1),'RUNNING');
 assert.equal(f.host.nativeControllerStatus,'TERMINATED');const before=structuredClone(f.host.consoleRun),suspended=f.calls.suspended;
 await f.host.applyNativeConsoleCommand({keyword:'terminate',terminationNoop:true,controllerStatus:'TERMINATED',testRun:run,participantSession:session},()=>true,phaseDispatch(2));
 assert.equal(f.host.debugControllerStatus,'TERMINATED');assert.deepEqual(f.host.consoleRun,before);assert.equal(f.calls.suspended,suspended);assert.equal(f.calls.requests.length,0);assert.equal(f.calls.starter,0);
 gate.resolve({runtimeState:{participantSession:session}});
});

test('a completed terminal phase is actual TERMINATED despite an older retained error dialog',async()=>{
 const gate=deferred(),ended={...run,status:'paused',controllerEntry:{active:false,revision:1}},parent={...session,status:'signed_in'};
 const f=fixture(label=>label==='Participant Starter'?gate.promise:Promise.resolve({controllerContext:{participantSession:parent,testRun:ended}}));f.host.syncRun(run);f.host.currentRunState=state(run);f.host.activeControllerError.set({testRunId:'selected',unitKey:'unit',message:'Older retained dialog'});f.host.participantErrorReceptionSuspended=true;
 f.host.beginControllerCommand('selected','terminate',phaseDispatch(1),'ERROR');await f.host.applyNativeConsoleCommand({keyword:'terminate',testRun:ended,participantSession:parent,controllerStatus:'ERROR'},()=>true,phaseDispatch(1));
 assert.equal(f.host.nativeControllerStatus,'TERMINATED');assert.equal(f.host.controllerError.message,'Older retained dialog');const requests=f.calls.requests.length;
 await f.host.applyNativeConsoleCommand({keyword:'terminate',terminationNoop:true,testRun:ended,participantSession:parent,controllerStatus:'TERMINATED'},()=>true,phaseDispatch(2));assert.equal(f.host.nativeControllerStatus,'TERMINATED');assert.equal(f.calls.requests.length,requests);
 gate.resolve({runtimeState:{participantSession:parent}});await tick();
});

test('a remote no-op receipt retains the first phase and its original decision across a later Resume',async()=>{
 const observations=[],command=remoteCommand('complete_and_lock'),f=fixture(undefined,async(cmd,_signal,options)=>{
  observations.push({status:options.controllerStatus(),terminationNoop:options.terminationNoop});const application=remoteApplication(cmd);await options.apply({...application,command:{...application.command,terminationNoop:true}});
 });f.host.syncRun(run);f.host.currentRunState=state(run);f.host.beginControllerCommand('selected','terminate',phaseDispatch(1),'RUNNING');
 const allocate=()=>phaseDispatch(2),suspended=f.calls.suspended;await f.host.applyReceivedParticipantCommand(command,new AbortController().signal,allocate);
 assert.equal(f.host.debugControllerStatus,'TERMINATED');assert.equal(f.host.controllerCommandPhase().dispatch.sequence,1);assert.equal(f.calls.suspended,suspended);assert.equal(f.calls.starter,0);assert.equal(f.calls.saved,0);assert.equal(f.calls.requests.length,0);
 f.host.beginControllerCommand('selected','resume',phaseDispatch(3));await f.host.applyReceivedParticipantCommand(command,new AbortController().signal,()=>assert.fail('A retry cannot get a new decision or dispatch'));
 assert.equal(f.host.debugControllerStatus,'RUNNING');assert.deepEqual(observations,[{status:'TERMINATED',terminationNoop:true},{status:'TERMINATED',terminationNoop:true}]);assert.deepEqual(f.host.consoleRun,run);
});
test('same-turn accepted terminal handlers both pass their invocation guard before either continuation',async()=>{
 const gate=deferred(),observed=[],f=fixture(undefined,async(_cmd,_signal,options)=>{observed.push({status:options.controllerStatus(),terminationNoop:options.terminationNoop});await gate.promise;});f.host.syncRun(run);f.host.currentRunState=state(run);let sequence=0;const allocate=()=>phaseDispatch(++sequence);
 const first=f.host.applyReceivedParticipantCommand(remoteCommand('complete'),new AbortController().signal,allocate),second=f.host.applyReceivedParticipantCommand({...remoteCommand('complete_and_lock'),commandId:'second'},new AbortController().signal,allocate);
 await tick();assert.deepEqual(observed,[{status:'RUNNING',terminationNoop:false},{status:'TERMINATED',terminationNoop:false}]);assert.equal(f.host.debugControllerStatus,'TERMINATED');gate.resolve();await Promise.all([first,second]);
});

const timedContext=(f,extra={})=>{
 const current={...state(run),currentUnit:{unitKey:'unit',parentLocked:false},activeTestletTimer:{testletKey:'timed',startedAt:'2026-10-13T00:00:00.000Z',expiresAt:'2026-10-13T00:00:06.000Z',status:'running',durationSeconds:6,remainingSeconds:6},...extra};
 f.host.syncRun(run);f.host.currentRunState=current;return current;
};
test('actual timer capture hides the interrupted timer immediately without forging its canonical Run or command phase',t=>{
 t.mock.method(Date,'now',()=>Date.parse('2026-10-13T00:00:02.500Z'));
 const f=fixture(),current=timedContext(f),before=structuredClone(current);let sequence=0;
 const request=f.host.captureControllerTimerInterruption({testRunId:'selected',deliveryId:'owned',keyword:'pause',controllerStatus:'RUNNING'},()=>({controllerId:'owned',sequence:++sequence}));
 assert.equal(request.remainingSeconds,3);assert.equal(request.keyword,'pause');assert.equal(sequence,1);assert.equal(f.host.isControllerTimerInterrupted(current),true);
 assert.deepEqual(current,before);assert.equal(f.host.pendingControllerStatus,undefined);
 assert.equal(f.host.captureControllerTimerInterruption({testRunId:'selected',deliveryId:'second',keyword:'pause',controllerStatus:'PAUSED'},()=>assert.fail('Already interrupted timer allocated again')),undefined);
 assert.equal(f.host.isControllerTimerInterrupted({...current,testRun:{...run,controllerDispatches:{owned:2}}}),false);
 assert.equal(f.host.isControllerTimerInterrupted({...current,activeTestletTimer:{...current.activeTestletTimer,expiresAt:'2026-10-13T00:00:07.000Z'}}),false);
 assert.equal(f.host.isControllerTimerInterrupted({...current,testRun:{...run,testRunId:'foreign'}}),false);
});
for(const [name,context,status] of [['ERROR',{},'ERROR'],['TERMINATED',{},'TERMINATED'],['missing Unit',{currentUnit:{unitKey:null,parentLocked:false}},'RUNNING'],['locked parent',{currentUnit:{unitKey:'unit',parentLocked:true}},'RUNNING'],['unknown legacy parent',{currentUnit:{unitKey:'unit'}},'RUNNING']])
test(`actual forced terminal timer capture preserves the Source ${name} early return`,()=>{
 const f=fixture();timedContext(f,context);
 assert.equal(f.host.captureControllerTimerInterruption({testRunId:'selected',deliveryId:'owned',keyword:'terminate',controllerStatus:status},()=>assert.fail('An early return allocated its timer dispatch')),undefined);
});
for(const status of ['ERROR','TERMINATED'])test(`actual Pause still interrupts its active timer from ${status}`,t=>{
 t.mock.method(Date,'now',()=>Date.parse('2026-10-13T00:00:02.500Z'));
 const f=fixture();timedContext(f);const request=f.host.captureControllerTimerInterruption({testRunId:'selected',deliveryId:'owned',keyword:'pause',controllerStatus:status},()=>({controllerId:'owned',sequence:1}));
 assert.equal(request.remainingSeconds,3);assert.equal(request.keyword,'pause');
});
test('accepted remote Pause captures synchronously and awaits its timer receipt before executing its command',async t=>{
 t.mock.method(Date,'now',()=>Date.parse('2026-10-13T00:00:02.500Z'));
 const gate=deferred(),order=[];let sequence=0;
 const f=fixture(undefined,async(_command,_signal,options)=>{order.push('execution');await options.prepare();},async request=>{order.push(['timer',request]);await gate.promise;});
 const current=timedContext(f),pending=f.host.applyReceivedParticipantCommand(remoteCommand('pause'),new AbortController().signal,()=>({controllerId:'owned',sequence:++sequence}));
 assert.equal(f.host.pendingControllerStatus,'PAUSED');assert.equal(f.host.isControllerTimerInterrupted(current),true);await tick();
 assert.equal(order.length,1);assert.equal(order[0][1].remainingSeconds,3);assert.equal(f.calls.drained,0);
 gate.resolve();await pending;assert.equal(order[1],'execution');assert.equal(f.calls.drained,0);
});
test('a lost remote terminal timer reply retries its original interruption without turning the pending command into a no-op',async t=>{
 t.mock.method(Date,'now',()=>Date.parse('2026-10-13T00:00:02.500Z'));
 const packets=[];let sequence=0,attempt=0,executions=0;
 const f=fixture(undefined,async(_command,_signal,options)=>{executions++;assert.equal(options.terminationNoop,false);await options.prepare();},async request=>{packets.push(structuredClone(request));if(++attempt===1)throw Error('Lost owned timer reply');});
 timedContext(f);const command=remoteCommand('complete'),allocate=()=>({controllerId:'owned',sequence:++sequence});
 await assert.rejects(f.host.applyReceivedParticipantCommand(command,new AbortController().signal,allocate),/Lost owned timer/);
 assert.equal(f.host.pendingControllerStatus,'TERMINATED');assert.equal(f.calls.drained,0);
 await f.host.applyReceivedParticipantCommand(command,new AbortController().signal,allocate);
 assert.deepEqual(packets[1],packets[0]);assert.equal(sequence,2);assert.equal(executions,1);assert.equal(f.calls.drained,1);
});
