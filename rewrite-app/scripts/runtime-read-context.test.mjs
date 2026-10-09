import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { productionApiRoutes, resolveRoutePath } from "@testcenter-rewrite-app/contracts";

const functions = (file, names) => {
  const ast = ts.createSourceFile(file, readFileSync(new URL(file, import.meta.url), "utf8"), ts.ScriptTarget.ES2022, true);
  return names.map(name => {
    const node = ast.statements.find(n =>
      (ts.isFunctionDeclaration(n) && n.name?.text === name) ||
      (ts.isVariableStatement(n) && n.declarationList.declarations.some(d=>d.name.getText(ast)===name)));
    assert.ok(node, `Execute production function ${name}`);
    return node.getText(ast).replace(/^export\s+/, "");
  }).join("\n");
};
const load = async source => {
  const { outputText } = ts.transpileModule(source, {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
};
const pretty = functions("../apps/web/src/app/rewrite-app-shell.readers.ts", ["prettyPrintJson"]);
const presentation = functions("../apps/web/src/app/rewrite-app-shell.runtime.ts", ["applyRuntimeReadsWithoutSession", "applyRuntimeReadsWithSession", "applyRuntimeReadsCurrentRunMissing"]);
const action = functions("../apps/web/src/app/rewrite-app-shell.runtime-reads.ts", ["refreshRuntimeReadsAction"]);
const factory = functions("../apps/web/src/app/rewrite-app-shell.hosts-runtime.ts", ["createRuntimeReadsStateHost"]);
const actionsFactory = functions("../apps/web/src/app/rewrite-app-shell.hosts-runtime.ts", ["createRuntimeActionsStateHost"]);
const deletionAction = functions("../apps/web/src/app/rewrite-app-shell.runtime-actions.ts", ["deleteGroupResultsAction"]);
const { create } = await load(`export const create = (productionApiRoutes, resolveRoutePath) => { ${pretty}\n${presentation}\n${action}\n${factory}\nreturn { refreshRuntimeReadsAction, createRuntimeReadsStateHost }; };`);
const { refreshRuntimeReadsAction, createRuntimeReadsStateHost } = create(productionApiRoutes, resolveRoutePath);
const { deletion } = await load(`export const deletion = (productionApiRoutes, resolveRoutePath) => { ${actionsFactory}\n${deletionAction}\nreturn { createRuntimeActionsStateHost, deleteGroupResultsAction }; };`);
const { createRuntimeActionsStateHost, deleteGroupResultsAction } = deletion(productionApiRoutes, resolveRoutePath);
const serviceAst = ts.createSourceFile("runtime-service.ts", readFileSync(new URL("../apps/web/src/app/rewrite-app-runtime.service.ts", import.meta.url), "utf8"), ts.ScriptTarget.ES2022, true);
const serviceClass = serviceAst.statements.find(n=>ts.isClassDeclaration(n)&&n.name?.text==="RewriteAppRuntimeService");
const bulkMethod = serviceClass.members.find(n=>n.name?.getText(serviceAst)==="deleteSelectedGroupResults");
assert.ok(bulkMethod,"Execute the actual production bulk-deletion method.");
const { createBulkService } = await load(`export const createBulkService = (productionApiRoutes, loadGroupResultsAction, loadDetailedResponsesAction, loadReviewsAction) => class { ${bulkMethod.getText(serviceAst)} };`);
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((ok,fail) => {resolve=ok;reject=fail;});
  return {promise,resolve,reject};
};

function fixture({ gatePhase = "monitor", olderRun = false } = {}) {
  const workspace = { tenantKey:"owned-tenant", workspaceKey:"owned-workspace" };
  const runtime = { participantSessionId:"owned-session", testRunId:olderRun?"owned-older-run":"owned-run",
    currentUnitKey:"owned-unit", loginKey:"owned-login", groupKey:"owned-group", bookletKey:"owned-booklet",
    monitorCommandHistoryRunFilter:"", monitorCommandHistoryLimit:"5", openRunLimit:"100",
    openRunLoginFilter:"",openRunGroupFilter:"",openRunBookletFilter:"",openRunSpeciesFilter:"",
    openRunSessionFilter:"",openRunRunFilter:"",openRunUnitFilter:"",openRunStatusFilter:"" };
  let authorization = "owned-operator-session";
  const gate = deferred(), entered = deferred(), reads = [], calls = [], views = {};
  const latest = {testRunId:"owned-run",currentUnitKey:"owned-unit",status:"running",
    unitResponses:{"owned-unit":"Owned newest answer: Ä/β 🧪\n"}};
  const older = {...latest,testRunId:"owned-older-run",unitResponses:{"owned-unit":"Owned older answer: Ä/β 🧪\n"}};
  const runtimePayload = {runtimeState:{latestTestRun:latest,runtimeStatus:"running",availableAction:"resume"}};
  const detailPayload = {participantSessionDetail:{participantSession:{participantSessionId:"owned-session",groupKey:"owned-group"}}};
  const requests = async (_label,_method,path) => {
    reads.push(path);
    const url=new URL(path,"http://127.0.0.1");
    const phase = url.pathname.endsWith("/monitor/open-runs") ? "monitor"
      : url.pathname.endsWith("/runtime-state") ? "runtime"
      : url.pathname.endsWith("/current-state") ? "current" : "other";
    const payload = phase==="monitor" ? {items:[]} : phase==="runtime" ? runtimePayload
      : phase==="current" ? {currentRunState:{testRun:url.searchParams.get("testRunId")==="owned-older-run"?older:latest,currentUnit:{displayLabel:"Owned Unit"}}}
      : url.pathname.includes("/participant-sessions/") ? detailPayload : {items:[]};
    if(phase===gatePhase){entered.resolve();const result=await gate.promise;return result??payload;}
    return payload;
  };
  const host = new Proxy({}, { get(_target,name) {
    return (...args) => {
      calls.push({name,args});
      if(String(name).startsWith("get")) return name==="getParticipantSessionId"?runtime.participantSessionId:views[name]??"";
      if(name==="setGroupKey") runtime.groupKey=args[0];
      if(name==="syncRuntimeStateFromRun" && args[0]) {
        runtime.testRunId=args[0].testRunId;runtime.currentUnitKey=args[0].currentUnitKey;
        views.selectedRun=args[0];
      }
      if(name==="clearParticipantSessionSelection"){runtime.participantSessionId="";runtime.testRunId="";}
      views[name]=args[0];
    };
  }});
  const readsHost = createRuntimeReadsStateHost({request:requests,
    isCurrentRunMissingError:error=>error?.error==="participant_session_has_no_current_run",
    isParticipantSessionMissingError:error=>error?.error==="participant_session_not_found",
    workspaceState:workspace,runtimeState:runtime,getAuthorizationContext:()=>authorization,
    createRuntimePresentationHost:()=>host});
  const run = () => refreshRuntimeReadsAction(readsHost,runtime.participantSessionId,true);
  return {workspace,runtime,gate,entered,reads,calls,views,run,
    setAuthorization:value=>{authorization=value;}};
}

test("a prepared participant cannot be replaced by a late old-session refresh or a malformed session URL", async () => {
  const f=fixture();const pending=f.run();await f.entered.promise;
  Object.assign(f.runtime,{participantSessionId:"",testRunId:"",currentUnitKey:"",loginKey:"owned-new-entry",groupKey:"owned-new-group",bookletKey:"owned-new-booklet"});
  const prepared=structuredClone(f.runtime);
  f.gate.resolve();await pending;
  assert.deepEqual(f.runtime,prepared);
  assert.deepEqual(f.calls,[]);
  assert.equal(f.reads.some(path=>path.includes("/sessions/")),false);
});

for(const phase of ["runtime","current"]) for(const boundary of ["tenant","workspace","Session","Run","login","group","Booklet","operator"]) {
  test(`late ${phase} data cannot mutate a changed ${boundary} context`,async()=>{
    const f=fixture({gatePhase:phase});const pending=f.run();await f.entered.promise;
    if(boundary==="tenant") f.workspace.tenantKey="other-owned-tenant";
    else if(boundary==="workspace") f.workspace.workspaceKey="other-owned-workspace";
    else if(boundary==="operator") f.setAuthorization("other-owned-operator");
    else f.runtime[{Session:"participantSessionId",Run:"testRunId",login:"loginKey",group:"groupKey",Booklet:"bookletKey"}[boundary]]="other-owned-context";
    const selected=structuredClone(f.runtime),before=structuredClone(f.views),calls=f.calls.length;
    f.gate.resolve();await pending;
    assert.deepEqual(f.runtime,selected);assert.deepEqual(f.views,before);assert.equal(f.calls.length,calls);
    if(phase==="runtime")assert.equal(f.reads.some(path=>path.includes("/current-state")),false);
  });
}

test("a late missing-session response cannot clear a newly selected Session",async()=>{
  const f=fixture({gatePhase:"runtime"});const pending=f.run();await f.entered.promise;
  f.runtime.participantSessionId="another-owned-session";f.runtime.testRunId="another-owned-run";
  f.gate.reject({error:"participant_session_not_found"});await pending;
  assert.equal(f.runtime.participantSessionId,"another-owned-session");
  assert.equal(f.calls.some(c=>c.name==="clearParticipantSessionSelection"),false);
});

test("a late missing-current-run response cannot replace a new Run's presentation",async()=>{
  const f=fixture({gatePhase:"current"});const pending=f.run();await f.entered.promise;
  f.runtime.testRunId="another-owned-run";
  const before=structuredClone(f.views);
  f.gate.reject({error:"participant_session_has_no_current_run"});await pending;
  assert.deepEqual(f.views,before);
});

for(const olderRun of [false,true]) test(`stable refresh preserves the exact ${olderRun?"older":"current"} selected Run and bytes`,async()=>{
  const f=fixture({gatePhase:"current",olderRun});const selected=f.runtime.testRunId;
  const pending=f.run();await f.entered.promise;f.gate.resolve();await pending;
  assert.equal(f.runtime.testRunId,selected);
  assert.equal(new URL(f.reads.find(path=>path.includes("/current-state")),"http://127.0.0.1").searchParams.get("testRunId"),selected);
  assert.equal(f.views.selectedRun.unitResponses["owned-unit"],olderRun?"Owned older answer: Ä/β 🧪\n":"Owned newest answer: Ä/β 🧪\n");
});

function deletionFixture() {
  const workspace = {tenantKey:"owned-tenant",workspaceKey:"owned-workspace"};
  const runtime = {participantSessionId:"owned-session",testRunId:"owned-run",
    currentUnitKey:"owned-unit",currentUnitResponse:"Owned selected answer: Ä/β 🧪\n",
    groupKey:"owned-group",bookletKey:"owned-booklet"};
  const gate = deferred(), started = deferred(), refreshed = [];
  const host = createRuntimeActionsStateHost({workspaceState:workspace,runtimeState:runtime,
    request:async()=>{started.resolve();return gate.promise;},
    createRuntimePresentationHost:()=>{throw Error("No unrelated presentation mutation");},
    refreshCrossViewStateAfterRuntimeChange:async()=>{refreshed.push(structuredClone(runtime));}});
  const payload = {deletion:{...workspace,groupKey:"owned-group",deletedTestRunIds:["owned-run"],
    affectedParticipantSessionIds:["owned-session"],deletedTestRunCount:1}};
  return {workspace,runtime,host,gate,started,refreshed,payload};
}

test("confirmed group deletion clears only its selected Run before the next exact runtime read",async()=>{
  const f=deletionFixture(),pending=deleteGroupResultsAction(f.host);await f.started.promise;
  f.gate.resolve(f.payload);assert.equal(await pending,f.payload);
  assert.deepEqual(f.runtime,{participantSessionId:"owned-session",testRunId:"",currentUnitKey:"",
    currentUnitResponse:"",groupKey:"owned-group",bookletKey:"owned-booklet"});
  assert.deepEqual(f.refreshed,[f.runtime]);
});

for(const boundary of ["tenant","workspace","Session","Run","foreign payload scope","foreign payload Run","foreign payload Session"]) {
  test(`confirmed deletion cannot clear a changed or unrelated ${boundary}`,async()=>{
    const f=deletionFixture(),pending=deleteGroupResultsAction(f.host);await f.started.promise;
    if(boundary==="tenant")f.workspace.tenantKey="another-owned-tenant";
    else if(boundary==="workspace")f.workspace.workspaceKey="another-owned-workspace";
    else if(boundary==="Session")f.runtime.participantSessionId="another-owned-session";
    else if(boundary==="Run")f.runtime.testRunId="another-owned-run";
    else if(boundary==="foreign payload scope")f.payload.deletion.workspaceKey="another-owned-workspace";
    else if(boundary==="foreign payload Run")f.payload.deletion.deletedTestRunIds=["another-owned-run"];
    else f.payload.deletion.affectedParticipantSessionIds=["another-owned-session"];
    const expected=structuredClone(f.runtime);f.gate.resolve(f.payload);await pending;
    assert.deepEqual(f.runtime,expected);assert.deepEqual(f.refreshed,[expected]);
  });
}

test("failed group deletion retains the selected Run and exact answer without refreshing",async()=>{
  const f=deletionFixture(),expected=structuredClone(f.runtime);
  const pending=deleteGroupResultsAction(f.host);await f.started.promise;
  const failure=new Error("Owned forbidden deletion");f.gate.reject(failure);
  await assert.rejects(pending,error=>error===failure);
  assert.deepEqual(f.runtime,expected);assert.deepEqual(f.refreshed,[]);
});

for(const foreign of [false,true]) test(`bulk deletion ${foreign?"retains an unrelated":"clears its confirmed"} selected Run before filtered reads`,async()=>{
  const f=deletionFixture(),reads=[],activities=[];
  const read=async()=>{reads.push(structuredClone(f.runtime));};
  const service=Object.assign(new (createBulkService(productionApiRoutes,read,read,read))(),{
    normalizeSelectedGroupKeys:keys=>keys,selectedGroupPath:()=>"/owned-delete",
    hosts:{createRuntimeActionsHost:()=>f.host,createRuntimeReadsHost:()=>({})},
    requestState:{request:f.host.request},feedback:{rememberActivity:(...args)=>activities.push(args)},
    refreshCrossViewStateAfterRuntimeChange:async()=>{throw Error("No unrelated workflow");}});
  const payload={deletion:{...f.payload.deletion,groupKeys:["owned-group"]}};
  delete payload.deletion.groupKey;
  if(foreign)payload.deletion.deletedTestRunIds=["other-owned-run"];
  const expected=structuredClone(f.runtime),pending=service.deleteSelectedGroupResults(["owned-group"],"owned-workspace");
  await f.started.promise;f.gate.resolve(payload);assert.equal(await pending,payload);
  if(!foreign)Object.assign(expected,{testRunId:"",currentUnitKey:"",currentUnitResponse:""});
  assert.deepEqual(f.runtime,expected);assert.deepEqual(reads,[expected,expected,expected]);
  assert.equal(activities[0][0],"Selected Group Results Deleted");
});
