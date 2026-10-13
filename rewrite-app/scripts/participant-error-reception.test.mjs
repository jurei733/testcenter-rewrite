import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import ts from "typescript";
import {productionApiRoutes,resolveRoutePath,parseParticipantEventStreamEvent} from "@testcenter-rewrite-app/contracts";
import {isParticipantControllerDispatches} from "@testcenter-rewrite-app/contracts/participant-native-command";

const methods=(path,className,names)=>{
 const source=readFileSync(new URL(path,import.meta.url),"utf8");
 const ast=ts.createSourceFile(path,source,ts.ScriptTarget.ES2022,true);
 const declaration=ast.statements.find(n=>ts.isClassDeclaration(n)&&n.name?.text===className);
 return names.map(name=>{
  const member=declaration?.members.find(n=>(ts.isMethodDeclaration(n)||ts.isGetAccessorDeclaration(n))&&n.name.getText(ast)===name);
  assert.ok(member,`Production ${name} must exist`);return member.getText(ast);
 }).join("\n");
};
const moduleFrom=async source=>{
 const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 return import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"));
};
const facadeMethods=methods("../apps/web/src/app/participant-view.facade.ts","ParticipantViewFacade",
 ["hasControllerError","controllerError","handleVeronaControllerError","refreshCurrentStateInternal","validateParticipantControllerContext","invalidateCurrentStateRefreshes","isOlderRunState"]);
const {makeHost}=await moduleFrom(`export const makeHost=(productionApiRoutes,resolveRoutePath,isParticipantControllerDispatches)=>class Host{
 ${facadeMethods}
 };`);
const Host=makeHost(productionApiRoutes,resolveRoutePath,isParticipantControllerDispatches);
const deferred=()=>{let resolve,reject;const promise=new Promise((done,fail)=>{resolve=done;reject=fail;});return {promise,resolve,reject};};
const state=(status="running",run="selected-run")=>({
 participantSession:{participantSessionId:"selected-session",tenantId:"tenant",workspaceId:"workspace"},
 testRun:{testRunId:run,status,participantSessionId:"selected-session",tenantId:"tenant",workspaceId:"workspace",contentReleaseId:"release",bookletKey:"booklet",unitResponses:{}},
 currentUnit:{unitKey:"selected-unit"},booklet:{policy:{player:{loadingMode:"lazy"}}}
});
const fixture=()=>{
 let error=null;const request=deferred(),assets=deferred(),calls={request:0,applied:0,suspend:0,start:0,stop:0,assets:0};
 const host=Object.assign(new Host(),{
  runtime:{participantSessionId:"selected-session",testRunId:"selected-run"},current:state(),
  activeControllerError:Object.assign(()=>error,{set:value=>{error=value;}}),
  readCurrentRunState(){return this.current;},currentStateRefreshSequence:0,currentStateAppliedRefreshSequence:0,
  requestState:{request:()=>{calls.request++;return request.promise;},isApiError:()=>false},
  participantEvents:{suspend:()=>calls.suspend++,stop:()=>calls.stop++,start:()=>calls.start++},
  bookletAssetLoadStartedAtMs:new Map(),loadedBookletAssets:()=>null,
  loadBookletAssets:()=>{calls.assets++;return assets.promise;},recordLoadedBookletAssets(){},
  shouldPreserveCurrentTextDraft:()=>false,syncCurrentRunState(value){calls.applied++;this.current=value;},
  syncRun(){},syncCurrentUnitResponse(){},reconcileOptimisticVeronaResponse(){},restorePersistentVeronaSave(){},
  persistLoadCompleteLog(){},loadBookletAssetsInBackground(){},refreshParticipantReviewsInternal:async()=>{},
  persistState(){},refreshFromParticipantEvents(){}
 });
 Object.defineProperty(host,"consoleRun",{get(){return this.current?.testRun ?? null;}});
 return {host,calls,request,assets};
};
const ownedError={testRunId:"selected-run",unitKey:"selected-unit",message:"Owned error"};
globalThis.prettyPrintJson=value=>JSON.stringify(value);
globalThis.withSelectedParticipantRun=(url,run)=>url+"?testRunId="+run;

test("only an error from the running selected Unit suspends reception",()=>{
 const f=fixture();
 for(const error of [{...ownedError,testRunId:"foreign-run"},{...ownedError,unitKey:"foreign-unit"}])f.host.handleVeronaControllerError(error);
 assert.equal(f.calls.suspend,0);assert.equal(f.host.hasControllerError,false);
 f.host.current=state("paused");f.host.handleVeronaControllerError(ownedError);assert.equal(f.calls.suspend,0);
 f.host.current=state();f.host.handleVeronaControllerError(ownedError);
 assert.equal(f.calls.suspend,1);assert.equal(f.host.hasControllerError,true);
});
test("a save/status refresh cannot start again after ERROR",async()=>{
 const f=fixture();f.host.handleVeronaControllerError(ownedError);
 await f.host.refreshCurrentStateInternal(true);
 assert.equal(f.calls.request,0);assert.equal(f.calls.start,0);
});
test("a pre-error ordinary refresh cannot apply a late paused response",async()=>{
 const f=fixture();const refresh=f.host.refreshCurrentStateInternal(true);
 f.host.handleVeronaControllerError(ownedError);f.request.resolve({currentRunState:state("paused")});
 await refresh;assert.equal(f.calls.applied,0);assert.equal(f.calls.start,0);
});
test("a late ordinary API failure cannot clear the errored selected Run",async()=>{
 const f=fixture();f.host.requestState.isApiError=()=>true;
 const refresh=f.host.refreshCurrentStateInternal(true);
 f.host.handleVeronaControllerError(ownedError);
 f.request.reject({error:"participant_session_has_no_current_run"});
 await refresh;assert.equal(f.host.current.testRun.testRunId,"selected-run");
 assert.equal(f.calls.stop,0);assert.equal(f.host.controllerError,ownedError);
});
test("a pending eager asset load cannot restore an ordinary refresh after ERROR",async()=>{
 const f=fixture();const refresh=f.host.refreshCurrentStateInternal(true);
 const eager=state();eager.booklet.policy.player.loadingMode="eager";
 f.request.resolve({currentRunState:eager});await new Promise(done=>setTimeout(done,0));
 assert.equal(f.calls.assets,1);f.host.handleVeronaControllerError(ownedError);
 f.assets.resolve({currentRunState:eager});await refresh;
 assert.equal(f.calls.applied,0);assert.equal(f.calls.start,0);
});
test("an accepted pre-error pause moves the controller out of ERROR and reopens reception",async()=>{
 const f=fixture();const refresh=f.host.refreshCurrentStateInternal(true,true);
 f.host.handleVeronaControllerError(ownedError);f.request.resolve({currentRunState:state("paused")});
 await refresh;assert.equal(f.calls.applied,1);assert.equal(f.host.current.testRun.status,"paused");
 assert.equal(f.calls.start,1);assert.equal(f.calls.suspend,1);assert.equal(f.host.hasControllerError,false);
 assert.equal(f.host.controllerError,ownedError);
});
test("accepted completion ends ERROR blocking but retains the scoped dialog until reload",async()=>{
 const f=fixture();const refresh=f.host.refreshCurrentStateInternal(true,true);
 f.host.handleVeronaControllerError(ownedError);f.request.resolve({currentRunState:state("completed")});
 await refresh;assert.equal(f.host.hasControllerError,false);assert.equal(f.host.controllerError,ownedError);
 assert.equal(f.calls.stop,1);assert.equal(f.calls.start,0);
});
test("an error dialog cannot cross the selected Run boundary",()=>{
 const f=fixture();f.host.handleVeronaControllerError(ownedError);f.host.current=state("running","other-run");
 assert.equal(f.host.controllerError,null);assert.equal(f.host.hasControllerError,false);
});
test("route cleanup still invalidates an accepted refresh in flight",async()=>{
 const f=fixture();const refresh=f.host.refreshCurrentStateInternal(true,true);
 f.host.invalidateCurrentStateRefreshes();f.request.resolve({currentRunState:state("paused")});
 await refresh;assert.equal(f.calls.applied,0);assert.equal(f.calls.start,0);
});

const streamMethods=methods("../apps/web/src/app/participant-event-stream.service.ts","ParticipantEventStreamService",
 ["suspend","stop","stopConnection","resetCommands","queueRefresh","handleFrame"]);
const {makeStream}=await moduleFrom(`export const makeStream=parseParticipantEventStreamEvent=>class Stream{${streamMethods}};`);
const Stream=makeStream(parseParticipantEventStreamEvent);
const streamFixture=()=>{
 const first=deferred();let count=0;
 const stream=Object.assign(new Stream(),{generation:1,abortController:{abort(){}},connectHandle:null,
  activeParticipantSessionId:"selected-session",activeTestRunId:"selected-run",refreshRunning:false,refreshPending:false,
  refresh:()=>++count===1?first.promise:Promise.resolve(),setConnectionState(){},
  uiState:{renderVersion:{update(){}}}});
 return {stream,first,count:()=>count};
};
test("suspension preserves an accepted queued refresh and rejects new frames",async()=>{
 const f=streamFixture();f.stream.queueRefresh();f.stream.queueRefresh();f.stream.suspend();
 let acknowledged=false;
 assert.equal(f.stream.handleFrame('data: {}',1,()=>{acknowledged=true;}),false);
 assert.equal(acknowledged,false);f.first.resolve();await new Promise(done=>setTimeout(done,0));
 assert.equal(f.count(),2);
});
test("route/session stop discards queued refreshes",async()=>{
 const f=streamFixture();f.stream.queueRefresh();f.stream.queueRefresh();f.stream.stop();
 f.first.resolve();await new Promise(done=>setTimeout(done,0));assert.equal(f.count(),1);
});
