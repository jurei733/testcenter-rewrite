import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createFirstSliceServices } from "@testcenter-rewrite-app/application";
import { compileBookletRuntimePolicy, serializeVeronaUnitResponse } from "@testcenter-rewrite-app/contracts";
import { createInMemoryFirstSliceRepository } from "@testcenter-rewrite-app/memory-store";
import { createFileFirstSliceRepository } from "@testcenter-rewrite-app/file-store";
import { createSqliteFirstSliceRepository } from "@testcenter-rewrite-app/sqlite-store";
import { createPostgresFirstSliceStorage } from "@testcenter-rewrite-app/postgres-store";
import { completenessCases } from "./exit-completeness-fixture.mjs";

const kinds = ["memory", "file", "sqlite"];
if (process.env.FIRST_SLICE_STORE === "postgres") {
  assert.ok(process.env.FIRST_SLICE_POSTGRES_URL);
  kinds.push("postgres");
}
for (const kind of kinds) test(`${kind}: starter exit preserves completeness, timer preparation and lock ordering`, async t => {
  const directory = await mkdtemp(join(tmpdir(), "testcenter-starter-completeness-"));
  let storage;
  const repository = kind === "memory" ? createInMemoryFirstSliceRepository()
    : kind === "file" ? createFileFirstSliceRepository(join(directory, "owned.json"))
    : kind === "sqlite" ? createSqliteFirstSliceRepository(join(directory, "owned.sqlite"))
    : (storage = await createPostgresFirstSliceStorage(process.env.FIRST_SLICE_POSTGRES_URL)).repository;
  const timestamp = "2026-10-10T12:00:00.000Z";
  const services = createFirstSliceServices({ repository, now: () => timestamp, xmlSchemaProfile: "legacy-compatibility" });
  const tenant = await services.platform.createTenant({tenantKey:`exit-${randomUUID()}`,displayName:"Owned exit proof"});
  const workspace = await services.platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:"owned",displayName:"Owned exit proof"});
  const base = {tenantId:tenant.tenantId,workspaceId:workspace.workspaceId,createdAt:timestamp};
  const makeRun = async ({scope="booklet", leave="none", progress, mode="run-hot-return", override=false, unlocked=false, lockScope="unit", lockConfirm=true, silent=false, lockOnTermination=false}) => {
    const id=randomUUID(),policy=compileBookletRuntimePolicy({...(scope==="booklet"?{force_presentation_complete:"ALWAYS",force_response_complete:"ALWAYS"}:{}),silent_mode:silent?"TRUE":"FALSE",lock_test_on_termination:lockOnTermination?"ON":"OFF"});
    const completeRestriction={presentation:"always",response:"always"};
    const restrictions={...(scope==="testlet"?{denyNavigationOnIncomplete:completeRestriction}:{}),
      ...(leave!=="none"?{timeMax:{minutes:5,leave}}:{}),lockAfterLeaving:{confirm:lockConfirm,scope:lockScope}};
    const booklet={bookletKey:"owned",displayLabel:"Owned booklet",policy,
      ...(scope==="root"?{rootRestrictions:{denyNavigationOnIncomplete:completeRestriction}}:{}),
      testletEntries:[{testletKey:"outer",displayLabel:"Outer",parentTestletKey:null,restrictions},
        ...(override?[{testletKey:"inner",displayLabel:"Inner",parentTestletKey:"outer",restrictions:{denyNavigationOnIncomplete:{presentation:"off",response:"off"}}}]:[])],
      unitEntries:[{unitKey:"unit",displayLabel:"Owned unit",testletPath:override?["outer","inner"]:["outer"]}]};
    await repository.saveContentRelease({...base,contentReleaseId:id,importJobId:id,releaseLabel:"Owned",runtimeSnapshot:{bookletEntries:[booklet]},status:"active",activatedAt:timestamp});
    await repository.saveParticipantSession({...base,participantSessionId:id,contentReleaseId:id,loginKey:id,groupKey:"owned",status:"launched",executionMode:mode});
    const response=serializeVeronaUnitResponse({unitState:{presentationProgress:progress.presentation,responseProgress:progress.response,dataParts:{answer:"Exact ä Ω\n  whitespace  "}}});
    const timer={testletKey:"outer",status:"running",durationSeconds:300,remainingSeconds:300,startedAt:timestamp,expiresAt:"2026-10-10T12:05:00.000Z",updatedAt:timestamp,endedAt:null};
    await repository.saveTestRun({...base,testRunId:id,participantSessionId:id,contentReleaseId:id,bookletKey:"owned",executionMode:mode,
      status:"running",currentUnitKey:"unit",unitResponses:["run-demo","run-review","run-simulation"].includes(mode)?{}:{unit:response},testletTimers:leave==="none"?{}:{outer:timer},
      lockedUnitKeys:[],lockedTestletKeys:[],monitorNavigationUnlocked:unlocked,updatedAt:timestamp,completedAt:null});
    return {id,response};
  };
  try {
    for(const scope of ["booklet","root","testlet"]) for(const leave of ["none","confirm","forbidden"]) for(const [name,progress] of Object.entries(completenessCases)) {
      await t.test(`${scope}/${leave}/${name}: confirmations cannot bypass missing completion`,async()=>{
        const {id,response}=await makeRun({scope,leave,progress});
        const before=await repository.getTestRunById(id);
        await assert.rejects(services.participantRuntime.returnToStarter({testRunId:id,confirmTestletTimeLeave:true,confirmTestletLeaveLock:true}),error=>{
          assert.equal(error.statusCode,409);assert.equal(error.errorCode,"booklet_starter_return_denied");
          assert.deepEqual(error.details.deniedReasons,progress.reasons);return true;
        });
        const after=await repository.getTestRunById(id);
        assert.equal(after.status,"running");assert.equal(after.unitResponses.unit,response);
        assert.deepEqual(after.testletTimers,before.testletTimers);assert.deepEqual(after.lockedUnitKeys,[]);assert.deepEqual(after.lockedTestletKeys,[]);
      });
    }
    await t.test("Verona 2 complete-and-valid completes responses but not presentation on exit",async()=>{
      const legacy=await makeRun({progress:{presentation:"complete-and-valid",response:"complete-and-valid"}});
      await assert.rejects(services.participantRuntime.returnToStarter({testRunId:legacy.id,confirmTestletLeaveLock:true}),error=>{
        assert.deepEqual(error.details.deniedReasons,["presentation_incomplete"]);return true;
      });
      assert.equal((await repository.getTestRunById(legacy.id)).unitResponses.unit,legacy.response);
      const allowed=await makeRun({progress:{presentation:"complete",response:"complete-and-valid"}});
      assert.equal((await services.participantRuntime.returnToStarter({testRunId:allowed.id,confirmTestletLeaveLock:true})).status,"paused");
    });
    const complete={presentation:"complete",response:"complete"};
    for(const scope of ["booklet","root","testlet"]) {
      await t.test(`${scope}: scoped completeness is projected for a newer local report`,async()=>{
        const {id}=await makeRun({scope,progress:completenessCases.both});
        const state=await services.participantRuntime.getCurrentRunState({participantSessionId:id,testRunId:id});
        assert.deepEqual(state.currentUnit.completenessPolicy,{requirePresentationComplete:"always",requireResponseComplete:"always"});
      });
      await t.test(`${scope}: complete stored response can leave and is retained exactly`,async()=>{
        const {id,response}=await makeRun({scope,leave:"confirm",progress:complete});
        const returned=await services.participantRuntime.returnToStarter({testRunId:id,confirmTestletTimeLeave:true,confirmTestletLeaveLock:true});
        assert.equal(returned.status,"paused");assert.equal(returned.unitResponses.unit,response);
        assert.equal(returned.testletTimers.outer.status,"cancelled");assert.deepEqual(returned.lockedUnitKeys,[]);assert.deepEqual(returned.lockedTestletKeys,[]);
      });
      await t.test(`${scope}: nearest explicit OFF overrides the inherited requirement`,async()=>{
        const {id,response}=await makeRun({scope,progress:completenessCases.both,override:true});
        const state=await services.participantRuntime.getCurrentRunState({participantSessionId:id,testRunId:id});
        assert.deepEqual(state.currentUnit.completenessPolicy,{requirePresentationComplete:"off",requireResponseComplete:"off"});
        const returned=await services.participantRuntime.returnToStarter({testRunId:id,confirmTestletLeaveLock:true});
        assert.equal(returned.status,"paused");assert.equal(returned.unitResponses.unit,response);
      });
    }
    for(const mode of ["run-demo","run-review","run-trial"]) await t.test(`${mode}: advisory completeness cannot prohibit exit`,async()=>{
      const {id}=await makeRun({scope:"testlet",progress:completenessCases.both,mode});
      await services.participantRuntime.returnToStarter({testRunId:id,confirmTestletLeaveLock:true});
    });
    for(const [name,progress] of Object.entries(completenessCases)) await t.test(`non-saving simulation/${name}: transient evaluation cannot persist or skip completeness`,async()=>{
      const {id,response}=await makeRun({scope:"testlet",progress,mode:"run-simulation",leave:"confirm"});
      const before=await repository.getTestRunById(id);
      await assert.rejects(services.participantRuntime.returnToStarter({testRunId:id,transientUnitResponses:{unit:response},confirmTestletTimeLeave:true,confirmTestletLeaveLock:true}),error=>{
        assert.equal(error.errorCode,"booklet_starter_return_denied");assert.deepEqual(error.details.deniedReasons,progress.reasons);return true;
      });
      assert.deepEqual((await repository.getTestRunById(id)).unitResponses,{});
      assert.deepEqual((await repository.getTestRunById(id)).testletTimers,before.testletTimers);
      const completePacket=serializeVeronaUnitResponse({unitState:{presentationProgress:"complete",responseProgress:"complete",dataParts:{answer:"Transient Ω"}}});
      const returned=await services.participantRuntime.returnToStarter({testRunId:id,responseUnitKey:"unit",unitResponse:completePacket,confirmTestletTimeLeave:true,confirmTestletLeaveLock:true});
      assert.deepEqual(returned.unitResponses,{});assert.deepEqual((await repository.getTestRunById(id)).unitResponses,{});
    });
    await t.test("saving mode cannot substitute a forged return-body packet for the stored incomplete response",async()=>{
      const {id,response}=await makeRun({progress:completenessCases.both});
      await assert.rejects(services.participantRuntime.returnToStarter({testRunId:id,responseUnitKey:"unit",unitResponse:serializeVeronaUnitResponse({unitState:{presentationProgress:"complete",responseProgress:"complete"}}),confirmTestletLeaveLock:true}),error=>{
        assert.deepEqual(error.details.deniedReasons,completenessCases.both.reasons);return true;
      });
      assert.equal((await repository.getTestRunById(id)).unitResponses.unit,response);
    });
    await t.test("monitor navigation override bypasses completeness while preserving the timed-block prohibition",async()=>{
      const {id}=await makeRun({progress:completenessCases.both,unlocked:true});
      assert.equal((await services.participantRuntime.returnToStarter({testRunId:id,confirmTestletLeaveLock:true})).status,"paused");
      const timed=await makeRun({progress:completenessCases.both,unlocked:true,leave:"forbidden"});
      await assert.rejects(services.participantRuntime.returnToStarter({testRunId:timed.id,confirmTestletTimeLeave:true,confirmTestletLeaveLock:true}),error=>{
        assert.deepEqual(error.details.deniedReasons,["testlet_time_leave_forbidden"]);return true;
      });
    });
    await t.test("unreported progress differs from an explicit incomplete packet",async()=>{
      const {id}=await makeRun({progress:completenessCases.both});
      const run=await repository.getTestRunById(id);
      await repository.saveTestRun({...run,unitResponses:{}});
      await assert.rejects(services.participantRuntime.returnToStarter({testRunId:id,confirmTestletLeaveLock:true}),error=>{
        assert.deepEqual(error.details.deniedReasons,["presentation_incomplete"]);return true;
      });
      const release=await repository.getContentReleaseById(run.contentReleaseId);
      release.runtimeSnapshot.bookletEntries[0].policy.navigation.requirePresentationComplete="off";
      await repository.saveContentRelease(release);
      assert.equal((await services.participantRuntime.returnToStarter({testRunId:id,confirmTestletLeaveLock:true})).status,"paused");
    });
    for(const mode of ["run-demo","run-review","run-trial"]) for(const leave of ["allowed","confirm","forbidden"])
      for(const lockScope of ["unit","testlet"]) for(const lockConfirm of [false,true]) {
      await t.test(`${mode}/${leave}/${lockScope}/${lockConfirm}: prepare changes only the timer before consent`,async()=>{
        const {id,response}=await makeRun({progress:completenessCases.both,mode,leave,lockScope,lockConfirm});
        const before=await repository.getTestRunById(id);
        const prepared=await services.participantRuntime.prepareStarterExit({testRunId:id,currentUnitKey:"unit",...(mode!=="run-trial"?{unitResponse:response}: {})});
        assert.equal(prepared.timerEffect,leave==="allowed"?"cancelled":"interrupted");
        const stored=await repository.getTestRunById(id);
        assert.equal(stored.status,"running");assert.equal(stored.currentUnitKey,"unit");
        assert.deepEqual(stored.unitResponses,before.unitResponses);
        assert.deepEqual(stored.lockedUnitKeys,[]);assert.deepEqual(stored.lockedTestletKeys,[]);
        assert.equal(stored.testletTimers.outer.status,leave==="allowed"?"cancelled":"paused");
        assert.equal(stored.testletTimers.outer.remainingSeconds,leave==="allowed"?0:300);
        assert.equal(stored.testletTimers.outer.expiresAt,null);
        const repeated=await services.participantRuntime.prepareStarterExit({testRunId:id,currentUnitKey:"unit"});
        assert.equal(repeated.timerEffect,null);assert.deepEqual(repeated.testRun,stored);
        const returned=await services.participantRuntime.returnToStarter({testRunId:id,confirmTestletLeaveLock:lockConfirm});
        assert.equal(returned.status,mode==="run-trial"?"paused":"running");
        assert.deepEqual(returned.lockedUnitKeys,[]);assert.deepEqual(returned.lockedTestletKeys,[]);
      });
    }
    for(const leave of ["confirm","forbidden"]) await t.test(`forced ${leave}: preparation cannot bypass time restrictions`,async()=>{
      const {id}=await makeRun({progress:complete,leave});const before=await repository.getTestRunById(id);
      const prepared=await services.participantRuntime.prepareStarterExit({testRunId:id,currentUnitKey:"unit"});
      assert.equal(prepared.timerEffect,null);assert.deepEqual(prepared.testRun.testletTimers,before.testletTimers);
      if(leave==="confirm") {
        const returned=await services.participantRuntime.returnToStarter({testRunId:id,confirmTestletTimeLeave:true});
        assert.equal(returned.testletTimers.outer.status,"cancelled");
        assert.deepEqual(returned.lockedUnitKeys,[]);assert.deepEqual(returned.lockedTestletKeys,[]);
      } else await assert.rejects(services.participantRuntime.returnToStarter({testRunId:id,confirmTestletTimeLeave:true}),error=>error.errorCode==="booklet_starter_return_denied");
    });
    await t.test("forced completeness precedes even allowed timer preparation and ignores forged saving packets",async()=>{
      const {id,response}=await makeRun({progress:completenessCases.both,leave:"allowed"});
      const before=await repository.getTestRunById(id);
      await assert.rejects(services.participantRuntime.prepareStarterExit({testRunId:id,currentUnitKey:"unit",unitResponse:serializeVeronaUnitResponse({unitState:{presentationProgress:"complete",responseProgress:"complete"}})}),error=>{
        assert.equal(error.errorCode,"booklet_starter_return_denied");assert.deepEqual(error.details.deniedReasons,completenessCases.both.reasons);return true;
      });
      const stored=await repository.getTestRunById(id);assert.equal(stored.unitResponses.unit,response);assert.deepEqual(stored.testletTimers,before.testletTimers);
    });
    await t.test("a non-saving complete simulation packet can cancel an allowed timer without storing the packet",async()=>{
      const {id}=await makeRun({progress:completenessCases.both,mode:"run-simulation",leave:"allowed"});
      const prepared=await services.participantRuntime.prepareStarterExit({testRunId:id,currentUnitKey:"unit",transientUnitResponses:{unit:serializeVeronaUnitResponse({unitState:{presentationProgress:"complete",responseProgress:"complete"}})}});
      assert.equal(prepared.timerEffect,"cancelled");assert.deepEqual((await repository.getTestRunById(id)).unitResponses,{});
    });
    for(const unit of ["", "previous-unit"]) await t.test(`stale unit ${unit}: cannot prepare another foreground action`,async()=>{
      const {id}=await makeRun({progress:complete,leave:"allowed"});const before=await repository.getTestRunById(id);
      await assert.rejects(services.participantRuntime.prepareStarterExit({testRunId:id,currentUnitKey:unit}),error=>error.errorCode==="starter_exit_unit_changed");
      await assert.rejects(services.participantRuntime.returnToStarter({testRunId:id,currentUnitKey:unit,confirmTestletTimeLeave:true,confirmTestletLeaveLock:true}),error=>error.errorCode==="starter_exit_unit_changed");
      assert.deepEqual((await repository.getTestRunById(id)).testletTimers,before.testletTimers);
    });
    await t.test("status refresh and saving an unchanged unit cannot resume an advisory interruption",async()=>{
      const {id,response}=await makeRun({progress:complete,mode:"run-trial",leave:"confirm"});
      await services.participantRuntime.prepareStarterExit({testRunId:id,currentUnitKey:"unit"});
      await services.participantRuntime.getCurrentRunState({participantSessionId:id,testRunId:id});
      await services.participantRuntime.saveProgress({testRunId:id,currentUnitKey:"unit",responseUnitKey:"unit",unitResponse:response,status:"running"});
      const stored=await repository.getTestRunById(id);assert.equal(stored.status,"running");
      assert.equal(stored.testletTimers.outer.status,"paused");assert.equal(stored.testletTimers.outer.interruptedAtUnitKey,"unit");
    });
    await t.test("explicit Run resume can restart the interrupted timer",async()=>{
      const {id}=await makeRun({progress:complete,mode:"run-trial",leave:"confirm"});
      await services.participantRuntime.prepareStarterExit({testRunId:id,currentUnitKey:"unit"});
      const prepared=await repository.getTestRunById(id);await repository.saveTestRun({...prepared,status:"paused"});
      const resumed=await services.participantRuntime.resumeRun({testRunId:id});
      assert.equal(resumed.testletTimers.outer.status,"running");assert.equal(resumed.testletTimers.outer.interruptedAtUnitKey,undefined);
    });
    for(const status of ["paused","completed"]) await t.test(`${status}: preparation cannot reactivate an inactive Run`,async()=>{
      const {id}=await makeRun({progress:complete,leave:"allowed"});
      await repository.saveTestRun({...await repository.getTestRunById(id),status});
      await assert.rejects(services.participantRuntime.prepareStarterExit({testRunId:id,currentUnitKey:"unit"}),error=>error.errorCode==="test_run_not_running");
    });
    for(const mode of ["run-hot-return","run-hot-restart"]) for(const leave of ["allowed","confirm","forbidden"])
      for(const silent of [false,true]) for(const lockOnTermination of [false,true]) {
      await t.test(`${mode}/${leave}/${silent}/${lockOnTermination}: paused status exit skips unit checks and preserves interrupted time`,async()=>{
        const {id,response}=await makeRun({progress:completenessCases.both,mode,leave,silent,lockOnTermination});
        await services.monitorControl.issueRunCommand({tenantKey:tenant.tenantKey,workspaceKey:workspace.workspaceKey,testRunId:id,commandType:"pause"});
        const before=await repository.getTestRunById(id);
        const logsBefore=(await repository.listParticipantTestLogsByWorkspace(tenant.tenantId,workspace.workspaceId)).filter(log=>log.testRunId===id);
        await assert.rejects(services.participantRuntime.returnToStarter({testRunId:id,currentUnitKey:"unit",expectedStatus:"running"}),error=>error.errorCode==="starter_exit_state_changed");
        assert.deepEqual(await repository.getTestRunById(id),before);
        const returned=await services.participantRuntime.returnToStarter({testRunId:id,currentUnitKey:"unit",expectedStatus:"paused"});
        assert.equal(returned.status,"paused");assert.equal(returned.currentUnitKey,"unit");assert.equal(returned.unitResponses.unit,response);
        assert.deepEqual(returned.testletTimers,before.testletTimers);assert.deepEqual(returned.lockedUnitKeys,[]);assert.deepEqual(returned.lockedTestletKeys,[]);
        assert.equal(returned.locked,silent&&lockOnTermination);
        const logsAfter=(await repository.listParticipantTestLogsByWorkspace(tenant.tenantId,workspace.workspaceId)).filter(log=>log.testRunId===id);
        const beforeIds=new Set(logsBefore.map(log=>log.participantTestLogId));
        assert.deepEqual(logsAfter.filter(log=>!beforeIds.has(log.participantTestLogId)).map(log=>[log.logKey,log.logContent]).sort(),silent?
          [["CONTROLLER","TERMINATED_PAUSED"],...(lockOnTermination?[["BOOKLETLOCKEDbyTESTEE",""]]:[])].sort():[]);
        if(!silent)assert.deepEqual(returned,before);
      });
    }
  } finally { await storage?.shutdown(); await rm(directory,{recursive:true,force:true}); }
});
