import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {productionApiRoutes,resolveRoutePath,parseVeronaUnitResponse,hasMeaningfulVeronaResponse} from '@testcenter-rewrite-app/contracts';
import {participantControllerContextRoute} from '@testcenter-rewrite-app/contracts/participant-native-command';
const source=readFileSync(new URL('../apps/web/src/app/participant-view.facade.ts',import.meta.url),'utf8');
const ast=ts.createSourceFile('facade.ts',source,ts.ScriptTarget.Latest,true),declaration=ast.statements.find(ts.isClassDeclaration);
const names=['consoleRun','isParticipantPlayerFocused','eagerBookletLoading','isRunPaused','debugControllerStatus','isParticipantLogin','isParticipantStarter','resumeSessionInternal','debugRunState','readCurrentRunState','syncRun','hasControllerError','controllerError','refreshCurrentStateInternal','validateParticipantControllerContext','invalidateCurrentStateRefreshes','applyNativeConsoleCommand','prepareNativeConsoleCommand'];
const members=names.map(name=>{const member=declaration.members.find(item=>item.name?.getText(ast)===name);assert.ok(member,name);return member.getText(ast);});
// Inject only module resolution; the actual production method bodies execute unchanged.
const emitted=ts.transpileModule(`export const load=(productionApiRoutes,resolveRoutePath,prettyPrintJson,withSelectedParticipantRun,loadControllerContract,parseVeronaUnitResponse,hasMeaningfulVeronaResponse)=>class Host {${members.join('\n').replaceAll('import("@testcenter-rewrite-app/contracts/participant-native-command")','loadControllerContract()')}}`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {load}=await import('data:text/javascript;base64,'+Buffer.from(emitted).toString('base64'));
const Host=load(productionApiRoutes,resolveRoutePath,JSON.stringify,(path,id)=>path+(id?'?testRunId='+id:''),async()=>({participantControllerContextRoute}),parseVeronaUnitResponse,hasMeaningfulVeronaResponse);
const deferred=()=>{let resolve,reject;const promise=new Promise((done,fail)=>{resolve=done;reject=fail;});return {promise,resolve,reject};};
const run={tenantId:'tenant',workspaceId:'workspace',participantSessionId:'participant',testRunId:'selected',contentReleaseId:'release',bookletKey:'booklet',bookletAssignmentKey:'booklet',status:'running',currentUnitKey:'unit',unitResponses:{unit:'Exact owned Ω'},unitResponseFieldTimestamps:{unit:{opaque:123}},testletTimers:{},createdAt:'2026-10-12T00:00:00Z',updatedAt:'2026-10-12T00:00:00Z'};
const session={tenantId:'tenant',workspaceId:'workspace',participantSessionId:'participant',status:'launched'};
const state=record=>({participantSession:session,testRun:record,currentUnit:{unitKey:'unit'},booklet:{policy:{player:{loadingMode:'lazy'}}}});
const fixture=(request=async()=>({currentRunState:state(run)}))=>{
 let error=null,consoleRunValue=null;const calls={requests:[],applied:0,suspended:0,drained:0,saved:0},host=new Host();
 Object.assign(host,{runtime:{participantSessionId:'participant',testRunId:'selected',currentRunStateView:'',currentUnitResponse:'Old unowned controller draft',bookletKey:'booklet'},consoleTestRun:Object.assign(()=>consoleRunValue,{set:value=>{consoleRunValue=value;}}),currentRunState:null,
  currentStateRefreshSequence:0,currentStateAppliedRefreshSequence:0,bookletAssetLoadStartedAtMs:new Map(),loadedBookletAssets:()=>null,veronaErrorText:'Owned load error',
  requestState:{request:async(...args)=>{calls.requests.push(args[2]);return request(...args);},isApiError:error=>Boolean(error?.error)},
  activeControllerError:Object.assign(()=>error,{set:value=>{error=value;}}),participantErrorReceptionSuspended:false,
  participantEvents:{suspend(){calls.suspended++;},stop(){},start(){}},captureTimerLifecycleTransitions(){},syncParticipantHeaderVisibility(){},syncActiveBookletCustomTexts(){},
  recordLoadedBookletAssets(){},shouldPreserveCurrentTextDraft:()=>false,syncCurrentRunState(value){this.currentRunState=value;calls.applied++;},syncCurrentUnitResponse(){},
  reconcileOptimisticVeronaResponse(){},restorePersistentVeronaSave(){},persistLoadCompleteLog(){},loadBookletAssetsInBackground(){},refreshParticipantReviewsInternal:async()=>{},persistState(){},
  settleVeronaAutoSaveBeforeForegroundAction:async()=>{calls.drained++;return null;},saveCurrentDraftBeforeCompleteInternal:async()=>{calls.saved++;},
  ephemeralUnitResponses:new Map(),nativeConsoleCommandFailed(){},commandReloadSequence:{update(){}},commandControllerState:null,remoteTerminalErrorRunId:null});
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
 assert.equal(f.host.debugControllerStatus,'LOADING');
 await f.host.applyNativeConsoleCommand({keyword:'resume',testRun:run,participantSession:session},()=>true);
 assert.equal(f.host.debugControllerStatus,'RUNNING');
 f.host.syncRun({...run,status:'paused'});f.host.commandControllerState={testRunId:'selected',status:'TERMINATED_PAUSED'};
 f.host.activeControllerError.set({testRunId:'selected',message:'Retained error'});f.host.participantErrorReceptionSuspended=true;
 assert.equal(f.host.debugControllerStatus,'TERMINATED_PAUSED');
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
