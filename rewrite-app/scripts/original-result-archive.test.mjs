import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Pool } from 'pg';
import { createFirstSliceServices } from '@testcenter-rewrite-app/application';
import { compileBookletRuntimePolicy } from '@testcenter-rewrite-app/contracts';
import { createInMemoryFirstSliceRepository } from '@testcenter-rewrite-app/memory-store';
import { createFileFirstSliceStorage } from '@testcenter-rewrite-app/file-store';
import { createSqliteFirstSliceStorage } from '@testcenter-rewrite-app/sqlite-store';
import { createPostgresFirstSliceStorage } from '@testcenter-rewrite-app/postgres-store';

const timestamp = '2026-10-17T00:00:00.000Z';
const reportNames = ['responses', 'logs', 'reviews'];
const readArchive = ({ body }) => {
  const entries = new Map();
  let offset = 0;
  while (body.readUInt32LE(offset) === 0x04034b50) {
    assert.equal(body.readUInt16LE(offset + 8), 0);
    const length = body.readUInt32LE(offset + 18), nameLength = body.readUInt16LE(offset + 26);
    const start = offset + 30 + nameLength + body.readUInt16LE(offset + 28), end = start + length;
    assert.ok(end <= body.length);
    entries.set(body.subarray(offset + 30, offset + 30 + nameLength).toString('utf8'), body.subarray(start, end).toString('utf8'));
    offset = end;
  }
  assert.equal(entries.size, 7);
  return { manifest: JSON.parse(entries.get('manifest.json')), entries,
    rows: Object.fromEntries(reportNames.map(name => [name, JSON.parse(entries.get(name + '.json'))])) };
};
const kinds = ['memory', 'file', 'sqlite'];
if (process.env.FIRST_SLICE_STORE === 'postgres') { assert.ok(process.env.FIRST_SLICE_POSTGRES_URL); kinds.push('postgres'); }

test('Original production result fixtures retain their verified receipt and exact report bytes',async()=>{
  const root=new URL('../test-fixtures/original-testcenter/source-workspace-results/',import.meta.url);
  const read=async name=>readFile(new URL(name,root));
  const manifest=JSON.parse(await read('manifest.json')),receipt=JSON.parse(await read('receipt.json'));
  assert.equal(manifest.version,1);assert.equal(manifest.sourceCommit,'eedae41840cbe90e5547c0211da818bdf620f5aa');
  assert.equal(receipt.sourceCommit,manifest.sourceCommit);assert.equal(receipt.testMode,false);assert.equal(receipt.success,true);
  assert.equal(receipt.checks.length,manifest.checks);assert.equal(manifest.checks,27);
  for(const [name,sha]of Object.entries(manifest.files)){
    assert.match(name,/^[a-z-]+\.(json|csv|txt)$/);
    assert.equal(createHash('sha256').update(await read(name)).digest('hex'),sha,name);
  }
  for(const name of ['responses','logs','reviews-legacy','reviews-enhanced']){
    const csv=await read(name+'.csv'),rows=JSON.parse(await read(name+'.json'));
    assert.ok(csv.subarray(0,3).equals(Buffer.from([239,187,191])));assert.ok(rows.length>0);
  }
  const responses=JSON.parse(await read('responses.json'));
  assert.deepEqual(responses.find(row=>row.unitname==='ORACLE.UNIT2').responses,[]);
});

for (const kind of kinds) test(`${kind}: Original archive distinguishes omitted and empty group selections`, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'testcenter-report-selection-'));
  const schema = 'owned_report_' + randomUUID().replaceAll('-', '');
  const url = kind === 'postgres' ? new URL(process.env.FIRST_SLICE_POSTGRES_URL) : null;
  url?.searchParams.set('options', `-c search_path=${schema}`);
  const root = url ? new Pool({ connectionString: process.env.FIRST_SLICE_POSTGRES_URL }) : null;
  let storage, repository, created = false;
  const open = async () => {
    storage = kind === 'memory' ? storage ?? { repository: createInMemoryFirstSliceRepository(), shutdown: async () => {} }
      : kind === 'file' ? await createFileFirstSliceStorage(join(directory, 'owned.json'))
      : kind === 'sqlite' ? await createSqliteFirstSliceStorage(join(directory, 'owned.sqlite'))
      : await createPostgresFirstSliceStorage(url.toString());
    repository = storage.repository;
  };
  const services = () => createFirstSliceServices({ repository, now: () => timestamp });
  try {
    if (root) { await root.query(`CREATE SCHEMA "${schema}"`); created = true; }
    await open();
    const tenant = await services().platform.createTenant({ tenantKey: 'owned-' + randomUUID(), displayName: 'Owned report test' });
    const seedWorkspace = async workspaceKey => {
      const workspace = await services().platform.createWorkspace({ tenantKey: tenant.tenantKey, workspaceKey, displayName: workspaceKey });
      const scope = { tenantId: tenant.tenantId, workspaceId: workspace.workspaceId }, contentReleaseId = randomUUID();
      await repository.saveContentRelease({ ...scope, contentReleaseId, importJobId: contentReleaseId,
        releaseLabel: 'Owned', status: 'active', createdAt: timestamp, activatedAt: timestamp,
        runtimeSnapshot: { bookletEntries: [{ bookletKey: 'owned', displayLabel: 'Owned booklet', policy: compileBookletRuntimePolicy({}),
          testletEntries: [], unitEntries: [{ unitKey: 'unit', originalUnitId: 'authored', displayLabel: 'Owned Unit' }] }] } });
      return { ...scope, contentReleaseId };
    };
    const workspace = await seedWorkspace('owned'), foreign = await seedWorkspace('foreign');
    const seed = async (scope, groupKey) => {
      const id = randomUUID();
      await repository.saveParticipantSession({ ...scope, participantSessionId: id, loginKey: groupKey, groupKey,
        executionMode: 'run-hot-return', status: 'launched', createdAt: timestamp });
      await repository.saveTestRun({ ...scope, participantSessionId: id, testRunId: id, bookletKey: 'owned', bookletAssignmentKey: 'owned',
        executionMode: 'run-hot-return', status: 'running', currentUnitKey: 'unit', unitResponses: { unit: `Exact ${groupKey} Ω\n"; ` },
        createdAt: timestamp, updatedAt: timestamp, completedAt: null });
      await repository.saveParticipantTestLogs([{ ...scope, participantSessionId: id, testRunId: id, participantTestLogId: randomUUID(),
        unitKey: 'unit', originalUnitId: 'authored', logKey: 'OWNED', logContent: `Log ${groupKey} Ω`, timestamp: Date.parse(timestamp), recordedAt: timestamp }]);
      await services().workspaceReview.createReview({ tenantKey: tenant.tenantKey, workspaceKey: scope === workspace ? 'owned' : 'foreign',
        participantSessionId: id, testRunId: id, unitKey: 'unit', reviewerId: 'owned', category: 'quality', comment: `Review ${groupKey} Ω` });
    };
    for (const group of ['alpha', 'beta']) await seed(workspace, group);
    await seed(foreign, 'private-foreign');
    const scope = { tenantKey: tenant.tenantKey, workspaceKey: 'owned' };
    const report = async groupKeys => readArchive(await services().workspaceAdminRead.exportOriginalResultArchive({ ...scope, ...(groupKeys === undefined ? {} : { groupKeys }) }));

    await t.test('omission equals the union of all group reports in every CSV and JSON member', async () => {
      const all = await report(), selected = await report(['alpha', 'beta']);
      assert.deepEqual(all.manifest.groupKeys, ['alpha', 'beta']);
      for (const name of reportNames) {
        assert.equal(all.entries.get(name + '.csv'), selected.entries.get(name + '.csv'));
        assert.equal(all.entries.get(name + '.json'), selected.entries.get(name + '.json'));
        const union = (await Promise.all(['alpha', 'beta'].map(async group => (await report([group])).rows[name]))).flat();
        const ordered = rows => rows.map(row => JSON.stringify(row)).sort();
        assert.deepEqual(ordered(all.rows[name]), ordered(union));
        assert.deepEqual([...new Set(all.rows[name].map(row => row.groupname))].sort(), ['alpha', 'beta']);
        assert.match(all.entries.get(name + '.csv'), /^\uFEFF/);
      }
    });
    await t.test('explicit empty, blank-only and unknown selections never widen into all groups', async () => {
      for (const selection of [[], [' ', ''], ['absent']]) {
        const empty = await report(selection);
        for (const name of reportNames) assert.deepEqual(empty.rows[name], []);
        assert.deepEqual(empty.manifest.counts, { responses: 0, logs: 0, reviews: 0 });
      }
      assert.deepEqual((await report([' beta ', 'beta'])).manifest.groupKeys, ['beta']);
    });
    await t.test('unfiltered selection is workspace-scoped and survives durable reopen', async () => {
      const before = await report();
      if (kind !== 'memory') { await storage.shutdown(); await open(); }
      const after = await report();
      assert.deepEqual(after.rows, before.rows);
      assert.equal(JSON.stringify(after.rows).includes('private-foreign'), false);
      const emptyWorkspace = await services().platform.createWorkspace({ tenantKey: tenant.tenantKey, workspaceKey: 'empty', displayName: 'Empty' });
      const empty = readArchive(await services().workspaceAdminRead.exportOriginalResultArchive({ ...scope, workspaceKey: emptyWorkspace.workspaceKey }));
      assert.deepEqual(empty.manifest.groupKeys, []); assert.deepEqual(empty.manifest.counts, { responses: 0, logs: 0, reviews: 0 });
    });
    await t.test('all-groups default is not truncated to the explicit selection cap', async () => {
      for (let i = 0; i < 101; i++) await repository.saveParticipantSession({ ...workspace, participantSessionId: randomUUID(), loginKey: 'extra-' + i,
        groupKey: 'extra-' + i, executionMode: 'run-hot-return', status: 'signed_in', createdAt: timestamp });
      const all = await report(); assert.equal(all.manifest.groupKeys.length, 103); assert.equal(all.rows.responses.length, 2);
      await assert.rejects(() => report(all.manifest.groupKeys), error => error.errorCode === 'result_archive_group_limit_exceeded');
    });
    await t.test('saved state-only Units export empty response arrays instead of opaque packets', async () => {
      const session=(await repository.listParticipantSessionsByWorkspace(workspace.tenantId,workspace.workspaceId)).find(row=>row.loginKey==='alpha');
      const run=(await repository.listTestRunsByParticipantSessionId(session.participantSessionId))[0];
      const stateOnly=JSON.stringify({kind:'verona_unit_state',version:1,unitState:{presentationProgress:'some'}});
      const noParts=JSON.stringify({kind:'verona_unit_state',version:1,unitState:{dataParts:{},responseProgress:'none'}});
      await repository.saveTestRun({...run,unitResponses:{...run.unitResponses,'state-only':stateOnly,'empty-parts':noParts,'intentional-clear':''}});
      const rows=(await report(['alpha'])).rows.responses;
      const saved=rows.find(row=>row.unitname==='state-only');assert.ok(saved);
      assert.deepEqual(saved.responses,[],'A captured Unit state is not an opaque answer. Source exports no response entries.');
      assert.deepEqual(JSON.parse(saved.laststate),{presentationProgress:'some'});
      assert.deepEqual(rows.find(row=>row.unitname==='empty-parts').responses,[]);
      assert.deepEqual(rows.find(row=>row.unitname==='intentional-clear').responses,[{id:'all',content:'',ts:Date.parse(timestamp),responseType:''}],
        'An intentional empty legacy answer remains a real response entry.');
    });
    await t.test('review-initialized Units remain in response reports after review deletion and durable reopen',async()=>{
      const session=(await repository.listParticipantSessionsByWorkspace(workspace.tenantId,workspace.workspaceId)).find(row=>row.loginKey==='alpha');
      const run=(await repository.listTestRunsByParticipantSessionId(session.participantSessionId))[0];
      const release=await repository.getContentReleaseById(run.contentReleaseId);
      release.runtimeSnapshot.bookletEntries[0].unitEntries.push({unitKey:'review-only',originalUnitId:'authored-review-only',displayLabel:'Review Unit'});
      await repository.saveContentRelease(release);
      const created=await services().workspaceReview.createReview({...scope,participantSessionId:session.participantSessionId,
        testRunId:run.testRunId,unitKey:'review-only',reviewerId:'owned',category:'quality',comment:'Exact Unit review Ω'});
      const snapshot=await repository.getTestRunById(run.testRunId);
      const checkSaved=async()=>{
        const archive=await report(['alpha']);const row=archive.rows.responses.find(row=>row.unitname==='review-only');
        assert.ok(row,'Source review creation initializes a saved Unit even without any answer packet.');
        assert.deepEqual(row.responses,[]);assert.equal(row.laststate,null);assert.equal(row.originalUnitId,'authored-review-only');
        assert.equal(archive.manifest.counts.responses,5);assert.equal(archive.rows.responses.some(row=>row.unitname==='raw-log-only'),false);
        assert.equal(archive.rows.responses.some(row=>row.unitname.startsWith('foreign-')),false);
        assert.equal(archive.rows.responses.some(row=>row.unitname==='booklet-review-only'),false);
        assert.deepEqual(await repository.getTestRunById(run.testRunId),snapshot,'Report projection must not manufacture stored answers or rewrite the Run.');
        return row;
      };
      await repository.saveParticipantTestLogs([{...workspace,participantSessionId:session.participantSessionId,testRunId:run.testRunId,
        participantTestLogId:randomUUID(),unitKey:'raw-log-only',originalUnitId:'raw-log-only',logKey:'PRESENTATION_PROGRESS',
        logContent:'some',timestamp:Date.parse(timestamp),recordedAt:timestamp}]);
      for(const overrides of [{tenantId:foreign.tenantId,workspaceId:foreign.workspaceId},
        {subjectId:randomUUID()},{details:{participantSessionId:randomUUID(),unitKey:'foreign-session',reviewId:randomUUID()}},
        {eventType:'source_package_created'},{subjectType:'participant_session'}]){
        await repository.saveWorkspaceActivityEvent({activityEventId:randomUUID(),tenantId:workspace.tenantId,workspaceId:workspace.workspaceId,
          eventType:'review_created',actorId:null,subjectType:'test_run',subjectId:run.testRunId,occurredAt:timestamp,
          summary:'Owned invalid projection control',details:{participantSessionId:session.participantSessionId,unitKey:'foreign-unit',reviewId:randomUUID()},...overrides});
      }
      await services().workspaceReview.createReview({...scope,participantSessionId:session.participantSessionId,testRunId:run.testRunId,
        reviewerId:'owned',category:'quality',comment:'Booklet-level comment does not initialize a Unit.'});
      const before=await checkSaved();
      await services().workspaceReview.deleteReview({...scope,reviewId:created.review.reviewId});
      assert.deepEqual(await checkSaved(),before,'Deleting a comment retains the initialized Unit, as in Source.');
      if(kind!=='memory'){await storage.shutdown();await open();}
      assert.deepEqual(await checkSaved(),before);
    });
    await t.test('scoped journal filtering distinguishes omitted, selected and empty event kinds',async()=>{
      const all=await repository.listWorkspaceActivityEventsByWorkspace(workspace.tenantId,workspace.workspaceId);
      const kinds=['review_created','review_updated','review_deleted'];
      const selected=await repository.listWorkspaceActivityEventsByWorkspace(workspace.tenantId,workspace.workspaceId,kinds);
      const ordered=rows=>rows.toSorted((left,right)=>left.activityEventId.localeCompare(right.activityEventId));
      assert.deepEqual(ordered(selected),ordered(all.filter(event=>kinds.includes(event.eventType))));
      assert.ok(selected.length>0);assert.ok(all.length>selected.length);
      assert.deepEqual(await repository.listWorkspaceActivityEventsByWorkspace(workspace.tenantId,workspace.workspaceId,[]),[]);
      assert.deepEqual(await repository.listWorkspaceActivityEventsByWorkspace(workspace.tenantId,workspace.workspaceId,["review_created') OR 1=1 --"]),[]);
      const own=await repository.listWorkspaceActivityEventsByWorkspace(workspace.tenantId,workspace.workspaceId,['review_created','review_created']);
      assert.deepEqual(ordered(own),ordered(all.filter(event=>event.eventType==='review_created')));
      const read=repository.listWorkspaceActivityEventsByWorkspace.bind(repository),calls=[];
      repository.listWorkspaceActivityEventsByWorkspace=async(...args)=>{calls.push(args);return read(...args);};
      try{await report(['alpha']);}finally{repository.listWorkspaceActivityEventsByWorkspace=read;}
      assert.deepEqual(calls,[[workspace.tenantId,workspace.workspaceId,kinds]],'An archive must request only the scoped review journal.');
    });
  } finally {
    try { await storage?.shutdown(); }
    finally { try { if (created) await root.query(`DROP SCHEMA "${schema}" CASCADE`); }
      finally { await root?.end(); await rm(directory, { recursive: true, force: true }); } }
  }
});

test('protected HTTP exports retain unanswered Units for read-only users after comment deletion',async()=>{
 const {spawn}=await import('node:child_process');
 const {resolve}=await import('node:path');
 const {pathToFileURL}=await import('node:url');
 const {raceWithSmokeDeadline}=await import('./smoke-deadline.mjs');
 const module=pathToFileURL(resolve('apps/api/dist/apps/api/src/index.js')).href;
 const child=spawn(process.execPath,['--input-type=module','-e',`
  import{createProductionApiServer}from ${JSON.stringify(module)};
  const server=await createProductionApiServer();server.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));
  process.once('SIGTERM',()=>server.close(()=>process.exit(0)));
 `],{stdio:['ignore','ignore','inherit','ipc'],env:{...process.env,FIRST_SLICE_STORE:'memory',
  FIRST_SLICE_BOOTSTRAP_DEMO:'true',FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',
  FIRST_SLICE_XML_SCHEMA_PROFILE:'legacy-compatibility',FIRST_SLICE_PROOF_OF_WORK_SCOPES:''}});
 const closed=new Promise(done=>child.once('close',done));
 try{
  const port=await raceWithSmokeDeadline(new Promise((done,reject)=>{
   child.once('message',message=>done(message.port));child.once('error',reject);
   child.once('exit',()=>reject(Error('Owned result API exited before startup.')));
  }),20000,()=>{throw Error('Owned result API startup timed out.');});
  const base='http://127.0.0.1:'+port;let rootToken='';
  const request=async(path,{method='GET',body,token=rootToken,status=200}={})=>{
   const response=await fetch(base+path,{method,headers:{...(token?{authorization:'Bearer '+token}:{}),
    ...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});
   const value=(response.headers.get('content-type')??'').includes('application/json')?await response.json():Buffer.from(await response.arrayBuffer());
   assert.equal(response.status,status,method+' '+path+': '+(Buffer.isBuffer(value)?'binary':JSON.stringify(value)));return value;
  };
  rootToken=(await request('/api/v1/admin/auth/sign-in',{method:'POST',body:{username:'demo-admin',password:'demo-admin-password'}})).sessionToken;
  const scope='/api/v1/tenants/demo-tenant/workspaces/demo-workspace',archive=scope+'/exports/original-results.zip';
  const login=await request('/api/v1/participant/auth/sign-in',{method:'POST',token:'',body:{workspaceKey:'demo-workspace',loginKey:'student-demo'}});
  const credential=login.sessionToken,sessionId=login.participantSession.participantSessionId;
  const resumed=await request('/api/v1/participant/sessions/'+sessionId+'/resume',{method:'POST',body:{},token:credential});
  const runId=resumed.testRun.testRunId;
  await request('/api/v1/participant/test-runs/'+runId+'/save-progress',{method:'POST',token:credential,
   body:{responseUnitKey:'unit-intro',status:'running',unitResponse:JSON.stringify({kind:'verona_unit_state',version:1,unitState:{presentationProgress:'some'}})}});
  const created=await request(scope+'/reviews',{method:'POST',status:201,body:{participantSessionId:sessionId,testRunId:runId,
   unitKey:'unit-practice',reviewerId:'owned-http',category:'quality',comment:'Owned review-only Unit Ω'}});
  await request('/api/v1/admin/users',{method:'POST',status:201,body:{username:'owned-result-reader',password:'Owned-result-read-9!',
   roleAssignments:[{role:'workspace_admin',tenantKey:'demo-tenant',workspaceKey:'demo-workspace',accessMode:'read_only'}]}});
  const ro=(await request('/api/v1/admin/auth/sign-in',{method:'POST',body:{username:'owned-result-reader',password:'Owned-result-read-9!'}})).sessionToken;
  const currentPath='/api/v1/participant/sessions/'+sessionId+'/current-state';
  const before=(await request(currentPath,{token:credential})).currentRunState.testRun;
  const selected=archive+'?groupKey=group%3Astudent-demo';
  const check=async()=>{
   const result=readArchive({body:await request(selected,{token:ro})});
   assert.deepEqual(result.rows.responses.map(row=>row.unitname),['unit-intro','unit-practice']);
   assert.deepEqual(result.rows.responses.map(row=>row.responses),[[],[]]);
   assert.equal(result.rows.responses[1].laststate,null);
   assert.deepEqual((await request(currentPath,{token:credential})).currentRunState.testRun,before);
   return result.rows.responses;
  };
  const rows=await check();
  await request(archive,{token:'',status:401});
  await request(scope+'/reviews/'+created.item.review.reviewId,{method:'DELETE',token:ro,status:403});
  assert.deepEqual(await check(),rows);
  await request(scope+'/reviews/'+created.item.review.reviewId,{method:'DELETE'});
  assert.deepEqual(await check(),rows);
  assert.deepEqual(readArchive({body:await request(archive+'?groupKey=absent',{token:ro})}).rows.responses,[]);
  await request('/api/v1/tenants/demo-tenant/workspaces',{method:'POST',status:201,body:{workspaceKey:'owned-result-foreign',displayName:'Foreign'}});
  await request('/api/v1/tenants/demo-tenant/workspaces/owned-result-foreign/exports/original-results.zip',{token:ro,status:403});
 }finally{
  if(child.exitCode===null && child.signalCode===null)child.kill('SIGTERM');
  await raceWithSmokeDeadline(closed,10000,()=>{child.kill('SIGKILL');throw Error('Owned result API shutdown timed out.');});
 }
});
