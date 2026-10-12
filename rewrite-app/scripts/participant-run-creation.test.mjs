import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { Pool } from 'pg';
import { createFirstSliceServices } from '@testcenter-rewrite-app/application';
import { compileBookletRuntimePolicy } from '@testcenter-rewrite-app/contracts';
import { createInMemoryFirstSliceRepository } from '@testcenter-rewrite-app/memory-store';
import { createFileFirstSliceRepository } from '@testcenter-rewrite-app/file-store';
import { createSqliteFirstSliceRepository } from '@testcenter-rewrite-app/sqlite-store';
import { createPostgresFirstSliceStorage } from '@testcenter-rewrite-app/postgres-store';

const timestamp = '2026-10-11T00:00:00.000Z';
const kinds = ['memory', 'file', 'sqlite'];
if (process.env.FIRST_SLICE_STORE === 'postgres') { assert.ok(process.env.FIRST_SLICE_POSTGRES_URL); kinds.push('postgres'); }

for (const kind of kinds) test(`${kind}: fresh Run, activation and initial artifacts commit together`, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'testcenter-run-creation-'));
  const file = join(directory, kind === 'sqlite' ? 'owned.sqlite' : 'owned.json');
  const schema = 'owned_creation_' + randomUUID().replaceAll('-', '');
  const url = kind === 'postgres' ? new URL(process.env.FIRST_SLICE_POSTGRES_URL) : null;
  url?.searchParams.set('options', `-c search_path=${schema}`);
  url?.searchParams.set('application_name', schema);
  const storages = [];
  let repository, control, rootPool, created = false;
  const create = async () => {
    if (kind === 'memory') return repository ?? createInMemoryFirstSliceRepository();
    if (kind === 'file') return createFileFirstSliceRepository(file);
    if (kind === 'sqlite') return createSqliteFirstSliceRepository(file);
    const storage = await createPostgresFirstSliceStorage(url.toString()); storages.push(storage); return storage.repository;
  };
  const execute = sql => kind === 'sqlite' ? control.exec(sql) : control.query(sql);
  const fixture = async (mode = 'run-hot-return') => {
    const id = randomUUID(), clock = { milliseconds: Date.parse(timestamp) };
    const services = repo => createFirstSliceServices({ repository: repo, now: () => new Date(clock.milliseconds).toISOString() });
    const service = services(repository);
    const tenant = await service.platform.createTenant({ tenantKey: 'owned-' + id, displayName: 'Owned creation' });
    const workspace = await service.platform.createWorkspace({ tenantKey: tenant.tenantKey, workspaceKey: 'owned', displayName: 'Owned creation' });
    const base = { tenantId: tenant.tenantId, workspaceId: workspace.workspaceId, createdAt: timestamp };
    await repository.saveContentRelease({ ...base, contentReleaseId: id, importJobId: id, releaseLabel: 'Owned', status: 'active', activatedAt: timestamp,
      runtimeSnapshot: { bookletEntries: [{ bookletKey: 'owned', displayLabel: 'Owned', policy: compileBookletRuntimePolicy({}),
        testletEntries: [{ testletKey: 'outer', displayLabel: 'Outer', parentTestletKey: null, restrictions: { timeMax: { minutes: 5, leave: 'allowed' } } }],
        unitEntries: ['unit', 'second'].map(unitKey => ({ unitKey, displayLabel: unitKey, testletPath: ['outer'] })) }] } });
    const parent = { ...base, participantSessionId: id, contentReleaseId: id, loginKey: id, groupKey: 'owned', participantCode: 'owned',
      executionMode: mode, status: 'signed_in', validUntil: '2026-10-12T00:00:00.000Z' };
    await repository.saveParticipantSession(parent);
    return { id, base, parent, clock, service, services,
      launch: (repo = repository) => services(repo).participantRuntime.launch({ participantSessionId: id, bookletKey: 'owned' }) };
  };
  const snapshot = async (f, repo = repository) => ({ parent: await repo.getParticipantSessionById(f.id),
    runs: (await repo.listTestRunsByParticipantSessionId(f.id)).sort((a,b) => a.testRunId.localeCompare(b.testRunId)),
    logs: (await repo.listParticipantTestLogsByWorkspace(f.base.tenantId, f.base.workspaceId)).sort((a,b) => a.participantTestLogId.localeCompare(b.participantTestLogId)),
    events: (await repo.listWorkspaceActivityEventsByWorkspace(f.base.tenantId, f.base.workspaceId)).sort((a,b) => a.activityEventId.localeCompare(b.activityEventId)) });
  const initial = (state, runId) => ({ logs: state.logs.filter(log => log.testRunId === runId), events: state.events.filter(event => event.subjectId === runId) });
  const assertComplete = (state, run, save = true, browser = false) => {
    assert.equal(state.runs.length, 1); assert.equal(state.parent.status, 'launched');
    const artifacts = initial(state, run.testRunId);
    assert.equal(artifacts.logs.filter(log => log.logKey === 'CONTROLLER').length, save && !browser ? 1 : 0);
    assert.equal(artifacts.logs.filter(log => log.logKey === 'CURRENT_UNIT_ID').length, save ? 1 : 0);
    assert.equal(artifacts.logs.filter(log => log.logKey === 'TESTLETS_TIMELEFT').length, save ? 1 : 0);
    if (!save) assert.deepEqual(artifacts.logs, []);
    assert.equal(artifacts.events.filter(event => event.eventType === 'testlet_timer_started').length, 1);
    assert.equal(artifacts.events.filter(event => event.eventType === 'participant_session_resumed').length, 1);
    assert.equal(run.testletTimers.outer.status, 'running'); assert.equal(run.currentUnitKey, 'unit');
  };
  try {
    if (url) { rootPool = new Pool({ connectionString: process.env.FIRST_SLICE_POSTGRES_URL }); await rootPool.query(`CREATE SCHEMA "${schema}"`); created = true; }
    repository = await create();
    if (kind === 'sqlite') control = new DatabaseSync(file);
    if (url) { const controlUrl = new URL(url); controlUrl.searchParams.set('application_name', schema + '_control'); control = new Pool({ connectionString: controlUrl.toString(), max: 1 }); }

    await t.test('actual launch writes one full set and uses no standalone initialization writes', async () => {
      const f = await fixture(), originals = ['saveParticipantTestLogs','saveWorkspaceActivityEvent','activateParticipantController'].map(key => [key,repository[key]]);
      for (const [key] of originals) repository[key] = async () => { throw new Error('Standalone initialization write forbidden'); };
      let run;
      try { run = await f.launch(); } finally { for (const [key,value] of originals) repository[key] = value; }
      const state = await snapshot(f); assertComplete(state, run);
      assert.deepEqual(state.parent, { ...f.parent, status: 'launched' });
      if (kind !== 'memory') assert.deepEqual(JSON.parse(JSON.stringify(await snapshot(f, await create()))), JSON.parse(JSON.stringify(state)));
      const before = await snapshot(f); await f.launch(); assert.deepEqual(await snapshot(f), before);
    });
    await t.test('browser lifecycle entry reserves the same atomic artifacts without a premature RUNNING; log-only deliveries preserve the Run and deduplicate by client entry', async () => {
      const f = await fixture(), run = await f.service.participantRuntime.launch({ participantSessionId:f.id,bookletKey:'owned',controllerLifecycle:'browser-v1' });
      assertComplete(await snapshot(f),run,true,true);
      const before = await snapshot(f), logs = [{unitKey:null,originalUnitId:null,entries:[
        {key:'CONTROLLER',timeStamp:f.clock.milliseconds,content:'LOADING',clientEntryId:'owned-loading'},
        {key:'CONTROLLER',timeStamp:f.clock.milliseconds+1,content:'RUNNING',clientEntryId:'owned-ready'}]}];
      await f.service.participantRuntime.saveTestLogs({testRunId:run.testRunId,logs});
      const saved = await snapshot(f);assert.deepEqual(saved.runs,before.runs);assert.deepEqual(saved.parent,before.parent);assert.deepEqual(saved.events,before.events);
      assert.deepEqual(saved.logs.filter(log=>log.logKey==='CONTROLLER').sort((a,b)=>a.timestamp-b.timestamp).map(log=>log.logContent),['LOADING','RUNNING']);
      await f.service.participantRuntime.saveTestLogs({testRunId:run.testRunId,logs});assert.deepEqual(await snapshot(f),saved);
      if(kind!=='memory')assert.deepEqual(JSON.parse(JSON.stringify(await snapshot(f,await create()))),JSON.parse(JSON.stringify(saved)));
    });
    await t.test('browser resume suppresses only its entry status log while preserving saved responses, clocks, timer and audit transitions', async () => {
      const f = await fixture(), run = await f.launch();
      const paused={...run,status:'paused',pauseSource:'participant',unitResponses:{unit:'Exact saved Ä/β'},unitResponseFieldTimestamps:{unit:{opaque:123}},
        testletTimers:Object.fromEntries(Object.entries(run.testletTimers).map(([key,timer])=>[key,{...timer,status:'paused',remainingSeconds:240,expiresAt:null}]))};
      await repository.saveTestRun(paused);f.clock.milliseconds+=5_000;
      const before=await snapshot(f),resumed=await f.service.participantRuntime.resumeSession({participantSessionId:f.id,bookletKey:'owned',controllerLifecycle:'browser-v1'}),after=await snapshot(f);
      assert.equal(resumed.testRunId,run.testRunId);assert.equal(resumed.status,'running');assert.deepEqual(resumed.unitResponses,paused.unitResponses);assert.deepEqual(resumed.unitResponseFieldTimestamps,paused.unitResponseFieldTimestamps);
      assert.equal(resumed.testletTimers.outer.status,'running');assert.equal(resumed.testletTimers.outer.remainingSeconds,240);
      assert.equal(after.logs.filter(log=>log.logKey==='CONTROLLER').length,before.logs.filter(log=>log.logKey==='CONTROLLER').length);
      assert.equal(after.events.filter(event=>event.eventType==='participant_session_resumed').length,before.events.filter(event=>event.eventType==='participant_session_resumed').length+1);
      assert.ok(after.logs.filter(log=>log.logKey==='TESTLETS_TIMELEFT').length>before.logs.filter(log=>log.logKey==='TESTLETS_TIMELEFT').length);
    });
    await t.test('unsupported lifecycle values reject launch and resume before any Run, activation, log or audit mutation', async () => {
      const f=await fixture(),before=await snapshot(f);
      for(const method of ['launch','resumeSession'])for(const controllerLifecycle of [null,false,'browser-v2',{}]){
        await assert.rejects(f.service.participantRuntime[method]({participantSessionId:f.id,bookletKey:'owned',controllerLifecycle}),error=>error.statusCode===400&&error.errorCode==='participant_controller_lifecycle_invalid');
        assert.deepEqual(await snapshot(f),before);
      }
    });
    await t.test('a failed initial projection leaves no reserved Run, timer, parent activation, logs or audit; retry is complete', async () => {
      const f = await fixture(), before = await snapshot(f), original = repository.getOrCreateTestRunForAssignment;
      repository.getOrCreateTestRunForAssignment = (candidate, initialize) => original(candidate, context => {
        initialize(context); throw new Error('Owned initial projection failure');
      });
      try { await assert.rejects(f.launch(), /Owned initial projection failure/); } finally { repository.getOrCreateTestRunForAssignment = original; }
      assert.deepEqual(await snapshot(f), before);
      const run = await f.launch(); assertComplete(await snapshot(f), run);
    });
    await t.test('eligibility uses the current parent and rejects late closure, expiry, code or mode changes without a Run', async () => {
      for (const [patch,code] of [[{ status:'closed' },'participant_session_closed'], [{ validUntil:'2026-10-10T23:59:59.999Z' },'participant_access_expired'],
        [{ participantCode:'changed' },'participant_entry_changed'], [{ executionMode:'run-demo' },'participant_entry_changed']]) {
        const f = await fixture(), original = repository.getOrCreateTestRunForAssignment;
        repository.getOrCreateTestRunForAssignment = async (candidate, initialize) => {
          await repository.saveParticipantSession({ ...f.parent, ...patch }); return original(candidate, initialize);
        };
        try { await assert.rejects(f.launch(), error => { assert.equal(error.errorCode,code); return true; }); }
        finally { repository.getOrCreateTestRunForAssignment = original; }
        const state = await snapshot(f); assert.deepEqual(state.runs,[]); assert.deepEqual(state.logs,[]);
        assert.deepEqual(state.parent,{...f.parent,...patch}); assert.equal(state.events.some(event => event.eventType==='participant_session_resumed'),false);
      }
    });
    await t.test('the winner starts timers after obtaining its reservation and preserves other current parent fields', async () => {
      const f = await fixture(), original = repository.getOrCreateTestRunForAssignment;
      repository.getOrCreateTestRunForAssignment = async (candidate, initialize) => {
        f.clock.milliseconds += 30_000; await repository.saveParticipantSession({ ...f.parent, groupKey:'Current group' });
        return original(candidate, initialize);
      };
      let run; try { run = await f.launch(); } finally { repository.getOrCreateTestRunForAssignment = original; }
      assertComplete(await snapshot(f),run); assert.equal((await snapshot(f)).parent.groupKey,'Current group');
      assert.equal(Date.parse(run.testletTimers.outer.startedAt),f.clock.milliseconds);
      assert.equal(Date.parse(run.testletTimers.outer.expiresAt),f.clock.milliseconds+300_000);
      assert.ok(initial(await snapshot(f),run.testRunId).logs.every(log => log.timestamp===f.clock.milliseconds));
    });
    await t.test('non-saving modes activate and audit without response/state logs or clocks', async () => {
      for (const mode of ['run-demo','run-review']) {
        const f = await fixture(mode), run = await f.launch(); assertComplete(await snapshot(f),run,false);
        assert.deepEqual(run.unitResponses,{}); assert.equal(run.unitResponseFieldTimestamps,undefined);
      }
    });
    await t.test('simultaneous launch callers produce one Run, activation and initial artifact set', async () => {
      const f = await fixture(), other = kind==='sqlite'||kind==='postgres' ? await create() : repository;
      const runs = await Promise.all(Array.from({length:12},(_,i)=>f.launch(i%2 ? other : repository)));
      assert.equal(new Set(runs.map(run=>run.testRunId)).size,1); assertComplete(await snapshot(f),runs[0]);
    });
    await t.test('fresh initialization cannot replace existing log or audit identities', async () => {
      const f = await fixture(), first = await f.launch(), before = await snapshot(f);
      const candidate = { ...first,testRunId:randomUUID(),bookletAssignmentKey:'owned#other',unitResponses:{} };
      const artifacts = initial(before,first.testRunId);
      for (const type of ['log','audit']) {
        await assert.rejects(repository.getOrCreateTestRunForAssignment(candidate,context=>({testRun:context.testRun,
          testLogs:type==='log'?[{...artifacts.logs[0],testRunId:candidate.testRunId}]:[],
          activityEvents:type==='audit'?[{...artifacts.events[0],subjectId:candidate.testRunId}]:[]})),/identit|unique|duplicate/i);
        assert.deepEqual(await snapshot(f),before);
      }
    });
    await t.test('an initializer cannot alter immutable scope, parent fields or artifact identities', async () => {
      const f = await fixture(), candidate = { ...f.base, testRunId:randomUUID(), participantSessionId:f.id,contentReleaseId:f.id,
        bookletKey:'owned',bookletAssignmentKey:'owned',executionMode:'run-hot-return',status:'running',currentUnitKey:'unit',unitResponses:{},updatedAt:timestamp,completedAt:null };
      const event = { activityEventId:randomUUID(),tenantId:f.base.tenantId,workspaceId:f.base.workspaceId,eventType:'participant_session_resumed',actorId:null,
        subjectType:'test_run',subjectId:candidate.testRunId,occurredAt:timestamp,summary:'Owned',details:{} };
      const before = await snapshot(f);
      for (const patch of [context=>({testRun:{...context.testRun,bookletKey:'foreign'}}), context=>({testRun:{...context.testRun,createdAt:'changed'}}),
        context=>({participantSession:{...context.participantSession,groupKey:'changed'}}), ()=>({activityEvents:[{...event,subjectId:'foreign'}]}),
        ()=>({activityEvents:[event,event]}), context=>({commandInput:{...context.testRun,commandId:randomUUID(),commandType:'pause',issuedAt:timestamp,
          actorId:null,targetUnitKey:null,remainingSeconds:null}}), ()=>({progressDelivery:{}})]) {
        await assert.rejects(repository.getOrCreateTestRunForAssignment(candidate, context => ({testRun:context.testRun,testLogs:[],activityEvents:[],...patch(context)})));
        assert.deepEqual(await snapshot(f),before);
      }
      const run = await f.launch();
      const state = await snapshot(f); await repository.saveTestRun({...run,status:'paused',pauseSource:'monitor',locked:true,currentUnitKey:'second'});
      const preserved = await snapshot(f);
      const reused = await repository.getOrCreateTestRunForAssignment({...candidate,testRunId:randomUUID()},()=>{throw new Error('Loser must not initialize');});
      assert.equal(reused.created,false); assert.deepEqual(await snapshot(f),preserved); assert.equal(state.runs.length,1);
    });
    if (kind==='file') await t.test('failed File publication leaves live cache and reopened state unchanged; retry writes every artifact', async () => {
      const f = await fixture(), before = await snapshot(f);
      await rename(file,file+'.before'); await mkdir(file);
      try { await assert.rejects(f.launch()); assert.deepEqual(await snapshot(f),before); }
      finally { await rm(file,{recursive:true}); await rename(file+'.before',file); }
      assert.deepEqual(await snapshot(f,await create()),before);
      const run = await f.launch(); assertComplete(await snapshot(f),run);
    });
    if (control) for (const [table,operation,eventType] of [
      ['test_runs','INSERT'], ['participant_test_logs','INSERT'],
      ['workspace_activity_events','INSERT','testlet_timer_started'],
      ['workspace_activity_events','INSERT','participant_session_resumed'],
      ['participant_sessions','UPDATE']
    ]) await t.test(`failed ${table} ${operation}${eventType ? ' '+eventType : ''} rolls back the complete fresh launch`, async () => {
      const f = await fixture(), before = await snapshot(f);
      const guard = eventType ? `NEW.tenant_id='${f.base.tenantId}' AND NEW.event_type='${eventType}'` :
        `NEW.participant_session_id='${f.id}'${operation==='UPDATE' ? " AND NEW.status='launched'" : ''}`;
      await execute(kind==='sqlite' ? `CREATE TRIGGER owned_creation_failure BEFORE ${operation} ON ${table} WHEN ${guard} BEGIN SELECT RAISE(ABORT,'owned creation failure'); END` :
        `CREATE FUNCTION owned_creation_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned creation failure'; END $$; CREATE TRIGGER owned_creation_failure BEFORE ${operation} ON ${table} FOR EACH ROW WHEN (${guard}) EXECUTE FUNCTION owned_creation_failure()`);
      try { await assert.rejects(f.launch(),/owned creation failure/); assert.deepEqual(await snapshot(f),before); }
      finally { await execute(kind==='sqlite' ? 'DROP TRIGGER owned_creation_failure' : `DROP TRIGGER owned_creation_failure ON ${table}; DROP FUNCTION owned_creation_failure()`); }
      const run = await f.launch(); assertComplete(await snapshot(f),run);
    });
    if (kind==='postgres') await t.test('a second independent creator waits for the first uncommitted initialization', async () => {
      const f = await fixture(), other = await create(), lock = Math.floor(Math.random()*1_000_000_000)+1;
      await execute(`CREATE FUNCTION owned_creation_hold() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_advisory_xact_lock(${lock}); RETURN NEW; END $$; CREATE TRIGGER owned_creation_hold BEFORE INSERT ON participant_test_logs FOR EACH ROW WHEN (NEW.participant_session_id='${f.id}') EXECUTE FUNCTION owned_creation_hold()`);
      await execute(`SELECT pg_advisory_lock(${lock})`);
      let first,second,settled=false;
      try {
        first=f.launch();
        for(let attempt=0;;attempt++) {
          const result=await control.query(`SELECT 1 FROM pg_locks WHERE locktype='advisory' AND objid=$1 AND NOT granted`,[lock]);
          if(result.rows.length)break; assert.ok(attempt<200,'Observe the real uncommitted first initialization'); await delay(10);
        }
        const before=await snapshot(f,other); assert.deepEqual(before.runs,[]); assert.deepEqual(before.logs,[]); assert.equal(before.parent.status,'signed_in');
        second=f.launch(other).finally(()=>{settled=true;}); await delay(75); assert.equal(settled,false);
      } finally { await execute(`SELECT pg_advisory_unlock(${lock})`); await Promise.allSettled([first,second].filter(Boolean));
        await execute('DROP TRIGGER owned_creation_hold ON participant_test_logs; DROP FUNCTION owned_creation_hold()'); }
      const runs=await Promise.all([first,second]); assert.equal(runs[0].testRunId,runs[1].testRunId); assertComplete(await snapshot(f),runs[0]);
    });
  } finally {
    if(kind==='sqlite')control?.close(); else await control?.end();
    for(const storage of storages)await storage.shutdown();
    if(created)await rootPool.query(`DROP SCHEMA "${schema}" CASCADE`);
    await rootPool?.end(); await rm(directory,{recursive:true,force:true});
  }
});
