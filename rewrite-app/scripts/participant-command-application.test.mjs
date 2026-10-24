import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, rename, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { spawn } from "node:child_process";
import test from "node:test";
import { createInMemoryFirstSliceRepository } from "@testcenter-rewrite-app/memory-store";
import { createFileFirstSliceRepository } from "@testcenter-rewrite-app/file-store";
import { createSqliteFirstSliceRepository, migrateSqliteFirstSliceStorage, SQLITE_FIRST_SLICE_SCHEMA_VERSION } from "@testcenter-rewrite-app/sqlite-store";
import { createPostgresFirstSliceStorage, migratePostgresFirstSliceStorage, POSTGRES_FIRST_SLICE_SCHEMA_VERSION } from "@testcenter-rewrite-app/postgres-store";
import { Pool } from "pg";

const issuedAt = "2026-10-11T00:00:00.000Z", acknowledgedAt = "2026-10-11T00:00:01.000Z", executedAt = "2026-10-11T00:00:02.000Z";
const kinds = ["memory", "file", "sqlite"];
if (process.env.FIRST_SLICE_STORE === "postgres") {
  assert.ok(process.env.FIRST_SLICE_POSTGRES_URL, "A real owned PostgreSQL database is required.");
  kinds.push("postgres");
}

for (const kind of kinds.filter(kind => kind === "sqlite" || kind === "postgres")) {
  for (const upgrade of ["application", "delivery"]) {
  test(`${kind}: a ${upgrade}-index upgrade preserves receipts and retries a failed migration`, async () => {
    const directory = await mkdtemp(join(tmpdir(), "testcenter-command-application-upgrade-"));
    const file = join(directory, "owned.sqlite");
    const schema = `owned_application_upgrade_${randomUUID().replaceAll("-", "")}`;
    assert.match(schema, /^owned_application_upgrade_[a-f0-9]+$/);
    const url = kind === "postgres" ? new URL(process.env.FIRST_SLICE_POSTGRES_URL) : null;
    url?.searchParams.set("options", `-c search_path=${schema}`);
    const rootPool = kind === "postgres" ? new Pool({ connectionString: process.env.FIRST_SLICE_POSTGRES_URL }) : null;
    let control, storage, created = false;
    const currentVersion = kind === "sqlite" ? SQLITE_FIRST_SLICE_SCHEMA_VERSION : POSTGRES_FIRST_SLICE_SCHEMA_VERSION;
    const applicationVersion = upgrade === "application" ? kind === "sqlite" ? 60 : 54 : kind === "sqlite" ? 62 : 56;
    const migration = () => kind === "sqlite" ? migrateSqliteFirstSliceStorage(file) : migratePostgresFirstSliceStorage(url.toString());
    const create = async () => {
      if (kind === "sqlite") return createSqliteFirstSliceRepository(file);
      storage = await createPostgresFirstSliceStorage(url.toString()); return storage.repository;
    };
    const execute = query => kind === "sqlite" ? control.exec(query) : control.query(query);
    const value = async query => kind === "sqlite" ? control.prepare(query).get().value : (await control.query(query)).rows[0].value;
    try {
      if (rootPool) { await rootPool.query(`CREATE SCHEMA "${schema}"`); created = true; }
      let repository = await create();
      control = kind === "sqlite" ? new DatabaseSync(file) : new Pool({ connectionString: url.toString() });
      const scope = { tenantId: "owned", workspaceId: "owned", participantSessionId: "owned", testRunId: "owned" };
      const run = { ...scope, contentReleaseId: "owned", bookletKey: "owned", status: "running", currentUnitKey: "unit",
        unitResponses: { unit: 'Exact pre-upgrade answer Ä/β\n";' }, testletTimers: {}, executionMode: "run-hot-return",
        createdAt: issuedAt, updatedAt: issuedAt, completedAt: null };
      await repository.saveParticipantSession({ ...scope, contentReleaseId: "owned", loginKey: "owned", groupKey: "owned", status: "launched", createdAt: issuedAt });
      await repository.saveTestRun(run);
      await repository.appendParticipantRunCommand({ ...scope, commandId: "legacy", commandType: "pause", issuedAt,
        actorId: null, targetUnitKey: null, remainingSeconds: null });
      const command = await repository.acknowledgeParticipantRunCommand({ ...scope, commandId: "legacy", acknowledgedAt });
      for (const commandId of ["deferred-acknowledged", "deferred-unreceived"]) {
        await repository.appendParticipantRunCommand({ ...scope, commandId, commandType: "resume", issuedAt,
          actorId: null, targetUnitKey: null, remainingSeconds: null, effectsDeferred: true });
      }
      const deferredReceipt = await repository.acknowledgeParticipantRunCommand({ ...scope, commandId: "deferred-acknowledged", acknowledgedAt });
      delete command.executedAt; delete command.executionSequence;
      if (kind === "sqlite") control.prepare("UPDATE participant_run_commands SET command_json = ? WHERE command_id = 'legacy'").run(JSON.stringify(command));
      else await control.query("UPDATE participant_run_commands SET command_json = $1::jsonb WHERE command_id = 'legacy'", [JSON.stringify(command)]);
      const savedRun = await repository.getTestRunById(scope.testRunId);
      await storage?.shutdown(); storage = undefined;
      if (upgrade === "application") await execute("DROP INDEX idx_participant_run_commands_execution");
      else {
        await execute(`DROP INDEX idx_participant_run_commands_pending; CREATE INDEX idx_participant_run_commands_pending
          ON participant_run_commands(test_run_id, sequence) WHERE acknowledged_at IS NULL OR (${kind === "sqlite"
            ? "json_extract(command_json, '$.effectsDeferred') = 1 AND json_extract(command_json, '$.executedAt') IS NULL"
            : "command_json->>'effectsDeferred' = 'true' AND command_json->>'executedAt' IS NULL"})`);
      }
      await execute("DROP TABLE original_login_bindings; DROP TABLE original_participant_groups; DROP INDEX participant_sessions_original_login; ALTER TABLE participant_sessions DROP COLUMN original_name_suffix; ALTER TABLE participant_sessions DROP COLUMN original_login_key; ALTER TABLE participant_roster_entries DROP COLUMN original_login_identity; ALTER TABLE test_runs DROP COLUMN original_result_state_json; ALTER TABLE test_runs DROP COLUMN controller_dispatches_json; ALTER TABLE test_runs DROP COLUMN state_revision; ALTER TABLE test_runs DROP COLUMN controller_entry_json; DROP TABLE participant_progress_deliveries; ALTER TABLE test_runs DROP COLUMN response_field_timestamps_json; ALTER TABLE test_runs DROP COLUMN shared_parameter_timestamps_json");
      await execute(`DELETE FROM schema_migrations WHERE version >= ${applicationVersion}`);
      if (kind === "sqlite") await execute(`CREATE TRIGGER owned_application_upgrade_failure BEFORE INSERT ON schema_migrations
        WHEN NEW.version = ${applicationVersion} BEGIN SELECT RAISE(ABORT, 'owned application upgrade failure'); END`);
      else await execute(`CREATE FUNCTION owned_application_upgrade_failure() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'owned application upgrade failure'; END $$;
        CREATE TRIGGER owned_application_upgrade_failure BEFORE INSERT ON schema_migrations FOR EACH ROW
        WHEN (NEW.version = ${applicationVersion}) EXECUTE FUNCTION owned_application_upgrade_failure()`);
      await assert.rejects(migration(), /owned application upgrade failure/);
      assert.equal(Number(await value("SELECT MAX(version) AS value FROM schema_migrations")), applicationVersion - 1);
      assert.equal(await value(kind === "sqlite"
        ? "SELECT COUNT(*) AS value FROM sqlite_master WHERE name = 'idx_participant_run_commands_execution'"
        : "SELECT COUNT(*)::int AS value FROM pg_indexes WHERE schemaname = current_schema() AND indexname = 'idx_participant_run_commands_execution'"), upgrade === "application" ? 0 : 1);
      await execute(kind === "sqlite" ? "DROP TRIGGER owned_application_upgrade_failure"
        : "DROP TRIGGER owned_application_upgrade_failure ON schema_migrations; DROP FUNCTION owned_application_upgrade_failure()");
      assert.equal((await migration()).currentSchemaVersion, currentVersion);
      repository = await create();
      assert.deepEqual(await repository.getTestRunById(scope.testRunId), savedRun);
      assert.deepEqual(await repository.listPendingParticipantRunCommands(scope), [await repository.appendParticipantRunCommand({
        ...scope, commandId: "deferred-unreceived", commandType: "resume", issuedAt,
        actorId: null, targetUnitKey: null, remainingSeconds: null, effectsDeferred: true })]);
      assert.deepEqual(await repository.acknowledgeParticipantRunCommand({ ...scope, commandId: "deferred-acknowledged", acknowledgedAt: executedAt }), deferredReceipt);
      const pendingIndex = await value(kind === "sqlite" ? "SELECT sql AS value FROM sqlite_master WHERE name = 'idx_participant_run_commands_pending'"
        : "SELECT indexdef AS value FROM pg_indexes WHERE schemaname = current_schema() AND indexname = 'idx_participant_run_commands_pending'");
      assert.match(pendingIndex, /acknowledged_at IS NULL/); assert.doesNotMatch(pendingIndex, /effectsDeferred|executedAt/);
      assert.deepEqual(await repository.acknowledgeParticipantRunCommand({ ...scope, commandId: "legacy", acknowledgedAt: executedAt }), command);
      const applied = await repository.applyParticipantRunCommand({ ...scope, commandId: "legacy", executedAt }, context => ({
        testRun: { ...context.testRun, status: "paused", pauseSource: "monitor", updatedAt: executedAt }, testLogs: [], activityEvents: [] }));
      assert.equal(applied.command.executionSequence, 1); assert.equal(applied.testRun.unitResponses.unit, run.unitResponses.unit);
      assert.equal((await repository.applyParticipantRunCommand({ ...scope, commandId: "legacy", executedAt }, () => assert.fail("A legacy retry must not run again"))).applied, false);
    } finally {
      await storage?.shutdown();
      if (kind === "sqlite") control?.close(); else await control?.end();
      try { if (created) await rootPool.query(`DROP SCHEMA "${schema}" CASCADE`); }
      finally { await rootPool?.end(); await rm(directory, { recursive: true, force: true }); }
    }
  });
  }
}

for (const kind of kinds) {
  test(`${kind}: command effects and receipts commit atomically`, async t => {
    const directory = await mkdtemp(join(tmpdir(), "testcenter-command-application-"));
    const file = join(directory, kind === "sqlite" ? "owned.sqlite" : "owned.json");
    const storages = [];
    const create = async () => {
      if (kind === "memory") return createInMemoryFirstSliceRepository();
      if (kind === "file") return createFileFirstSliceRepository(file);
      if (kind === "sqlite") return createSqliteFirstSliceRepository(file);
      const storage = await createPostgresFirstSliceStorage(process.env.FIRST_SLICE_POSTGRES_URL);
      storages.push(storage); return storage.repository;
    };
    const repository = await create();
    const tenantId = randomUUID(), workspaceId = randomUUID();
    const seed = async (type = "pause", extra = {}, commandExtra = {}) => {
      const session = { tenantId, workspaceId, participantSessionId: randomUUID(), contentReleaseId: randomUUID(),
        loginKey: "owned", groupKey: "owned", status: "launched", createdAt: issuedAt };
      const run = { ...session, testRunId: randomUUID(), bookletKey: "owned", executionMode: "run-hot-return",
        status: "running", currentUnitKey: "unit", unitResponses: { unit: 'Exact answer Ä/β\n";' }, testletTimers: {},
        createdAt: issuedAt, updatedAt: issuedAt, completedAt: null, ...extra };
      await repository.saveParticipantSession(session); await repository.saveTestRun(run);
      const scope = { tenantId, workspaceId, participantSessionId: session.participantSessionId, testRunId: run.testRunId };
      const input = { ...scope, commandId: randomUUID(), commandType: type, targetUnitKey: null, remainingSeconds: null, actorId: null, issuedAt, ...commandExtra };
      const queued = await repository.appendParticipantRunCommand(input);
      return { session: await repository.getParticipantSessionById(session.participantSessionId), run: await repository.getTestRunById(run.testRunId), scope, input, queued };
    };
    const ack = f => repository.acknowledgeParticipantRunCommand({ ...f.scope, commandId: f.input.commandId, acknowledgedAt });
    const application = f => ({ ...f.scope, commandId: f.input.commandId, executedAt });
    const effect = (context, status = "paused", sessionStatus) => ({
      testRun: { ...context.testRun, status, updatedAt: executedAt, ...(status === "paused" ? { pauseSource: "monitor" } : { pauseSource: undefined }) },
      testLogs: [{ ...context.command, participantTestLogId: randomUUID(), unitKey: null, originalUnitId: null,
        logKey: "CONTROLLER", logContent: status.toUpperCase(), timestamp: Date.parse(executedAt), recordedAt: executedAt }],
      activityEvents: [{ activityEventId: randomUUID(), tenantId, workspaceId, eventType: "monitor_run_command_issued", actorId: null,
        subjectType: "test_run", subjectId: context.testRun.testRunId, occurredAt: executedAt, summary: "Owned application", details: {} }],
      ...(sessionStatus ? { participantSession: { ...context.participantSession, status: sessionStatus } } : {})
    });
    const snapshot = async (f, repo = repository) => ({ run: await repo.getTestRunById(f.run.testRunId),
      session: await repo.getParticipantSessionById(f.session.participantSessionId),
      logs: (await repo.listParticipantTestLogsByWorkspace(tenantId, workspaceId)).filter(log => log.testRunId === f.run.testRunId),
      activity: (await repo.listWorkspaceActivityEventsByWorkspace(tenantId, workspaceId)).filter(event => event.subjectId === f.run.testRunId) });
    try {
      await t.test("issuance and ACK leave state untouched; application needs the exact acknowledged scope", async () => {
        const f = await seed(), before = await snapshot(f); let called = 0;
        const transform = context => { called++; return effect(context); };
        await assert.rejects(repository.applyParticipantRunCommand(application(f), transform), /acknowledged/);
        assert.equal(called, 0); await ack(f);
        for (const key of ["tenantId", "workspaceId", "participantSessionId", "testRunId", "commandId"]) {
          assert.equal(await repository.applyParticipantRunCommand({ ...application(f), [key]: "foreign" }, transform), null);
        }
        assert.equal(called, 0); assert.deepEqual(await snapshot(f), before);
        assert.equal((await repository.applyParticipantRunCommand(application(f), transform)).applied, true);
        assert.equal(called, 1);
      });
      await t.test("the first effect and all associated records survive restart; retries preserve a newer answer", async () => {
        const f = await seed(); await ack(f);
        const applied = await repository.applyParticipantRunCommand(application(f), context => effect(context, "paused", "signed_in"));
        assert.equal(applied.command.executionSequence, 1); assert.equal(applied.command.executedAt, executedAt);
        const saved = await snapshot(f); assert.equal(saved.logs.length, 1); assert.equal(saved.activity.length, 1); assert.equal(saved.session.status, "signed_in");
        applied.testRun.unitResponses.unit = "Untrusted mutation";
        assert.equal((await repository.getTestRunById(f.run.testRunId)).unitResponses.unit, f.run.unitResponses.unit);
        const replica = kind === "memory" ? repository : await create();
        assert.deepEqual(await snapshot(f, replica), saved);
        await replica.saveTestRun({ ...saved.run, unitResponses: { unit: "Newer delivered answer" } });
        const duplicate = await replica.applyParticipantRunCommand({ ...application(f), executedAt: "2026-10-11T00:00:09.000Z" }, () => assert.fail("A retry cannot execute again"));
        assert.equal(duplicate.applied, false); assert.equal(duplicate.command.executedAt, executedAt);
        assert.equal(duplicate.testRun.unitResponses.unit, "Newer delivered answer");
        assert.equal((await snapshot(f, replica)).logs.length, 1);
      });
      await t.test("a terminal no-op decision survives restart without advancing the waiting first command highwater",async()=>{
        const f=await seed('complete',{stateRevision:3,controllerEntry:{active:true,revision:7},controllerDispatches:{'owned-controller':5}},{effectsDeferred:true});
        const later={...f.input,commandId:randomUUID(),commandType:'complete_and_lock'};await repository.appendParticipantRunCommand(later);await ack(f);await repository.acknowledgeParticipantRunCommand({...f.scope,commandId:later.commandId,acknowledgedAt});
        const before=await snapshot(f);const applied=await repository.applyParticipantRunCommand({...application(f),commandId:later.commandId},context=>({terminationNoop:true,testRun:context.testRun,testLogs:[{...effect(context).testLogs[0],logKey:'command executed',logContent:'terminate lock'}],activityEvents:[]}));
        assert.equal(applied.command.terminationNoop,true);assert.deepEqual(applied.testRun,before.run);assert.deepEqual(applied.participantSession,before.session);const after=await snapshot(f);assert.deepEqual(after.run,before.run);assert.deepEqual(after.session,before.session);assert.deepEqual(after.activity,before.activity);assert.equal(after.logs.length-before.logs.length,1);
        const replica=kind==='memory'?repository:await create();const replay=await replica.applyParticipantRunCommand({...application(f),commandId:later.commandId},()=>assert.fail('A persisted no-op cannot execute again'));assert.equal(replay.applied,false);assert.equal(replay.command.terminationNoop,true);assert.equal(replay.command.executionSequence,applied.command.executionSequence);assert.deepEqual(await snapshot(f,replica),after);
        const first=await replica.applyParticipantRunCommand(application(f),context=>({...effect(context),controllerDispatch:{controllerId:'owned-controller',sequence:6}}));assert.equal(first.superseded,undefined);assert.equal(first.testRun.status,'paused');assert.equal(first.testRun.controllerDispatches['owned-controller'],6);assert.equal(first.testRun.stateRevision,4);
      });
      await t.test("a no-op projection cannot mutate Run, parent, entry, highwater, state logs or activity",async()=>{
        const f=await seed('complete',{}, {effectsDeferred:true});await ack(f);const before=await snapshot(f);
        for(const change of [e=>e.testRun.status='paused',e=>e.participantSession=f.session,e=>e.controllerEntryActive=false,e=>e.controllerDispatch={controllerId:'owned-controller',sequence:2},e=>e.testLogs=effect({testRun:f.run,command:f.input}).testLogs,e=>e.activityEvents=effect({testRun:f.run,command:f.input}).activityEvents,e=>e.terminationNoop=false]){
          await assert.rejects(repository.applyParticipantRunCommand(application(f),context=>{const e={terminationNoop:true,testRun:context.testRun,testLogs:[],activityEvents:[]};change(e);return e;}),/early return/);assert.deepEqual(await snapshot(f),before);
        }
      });
      for (const reversed of [false, true]) await t.test(`actual application order follows ${reversed ? "reversed" : "normal"} ACK dispatch`, async () => {
        const f = await seed("pause");
        const second = { ...f.input, commandId: randomUUID(), commandType: "resume" };
        await repository.appendParticipantRunCommand(second); await ack(f);
        await repository.acknowledgeParticipantRunCommand({ ...f.scope, commandId: second.commandId, acknowledgedAt });
        const commands = reversed ? [second, f.input] : [f.input, second];
        const effects = [];
        for (const command of commands) {
          const result = await repository.applyParticipantRunCommand({ ...application(f), commandId: command.commandId }, context => effect(context, command.commandType === "pause" ? "paused" : "running"));
          effects.push(result.command.commandType); assert.equal(result.command.executionSequence, effects.length);
        }
        const original = JSON.parse(await readFile(new URL("./fixtures/original-runtime-command-order.json", import.meta.url), "utf8"));
        assert.deepEqual(effects, original.cases[reversed ? "queued-pause-resume-reversed-acks" : "queued-pause-resume"].commandEffects);
        assert.equal((await repository.getTestRunById(f.run.testRunId)).status, reversed ? "paused" : "running");
      });
      await t.test("a throwing or foreign transform cannot mutate the Run, parent or any log", async () => {
        const f = await seed(); await ack(f); const before = await snapshot(f);
        await assert.rejects(repository.applyParticipantRunCommand(application(f), context => {
          context.testRun.unitResponses.unit = "Must not survive"; context.participantSession.status = "closed";
          throw new Error("Owned preparation failure");
        }), /Owned preparation failure/);
        for (const target of ["run", "log", "activity", "session"]) {
          await assert.rejects(repository.applyParticipantRunCommand(application(f), context => {
            const prepared = effect(context);
            if (target === "run") prepared.testRun.bookletKey = "foreign";
            if (target === "log") prepared.testLogs[0].testRunId = "foreign";
            if (target === "activity") prepared.activityEvents[0].workspaceId = "foreign";
            if (target === "session") prepared.participantSession = { ...context.participantSession, loginKey: "foreign" };
            return prepared;
          }), /immutable parent scope/);
        }
        assert.deepEqual(await snapshot(f), before);
        assert.equal((await repository.applyParticipantRunCommand(application(f), context => effect(context))).command.executionSequence, 1);
      });
      await t.test("termination updates its parent and retries safely after completion", async () => {
        const f = await seed("complete"); await ack(f);
        const applied = await repository.applyParticipantRunCommand(application(f), context => ({ ...effect(context, "completed", "closed"),
          testRun: { ...context.testRun, status: "completed", currentUnitKey: null, completedAt: executedAt, updatedAt: executedAt } }));
        assert.equal(applied.applied, true); assert.equal(applied.testRun.status, "completed");
        assert.equal(applied.participantSession.status, "closed");
        assert.equal((await repository.applyParticipantRunCommand(application(f), () => assert.fail("Completed retry cannot run"))).applied, false);
        assert.equal((await repository.getTestRunById(f.run.testRunId)).unitResponses.unit, f.run.unitResponses.unit);
      });
      await t.test("duplicate and existing log identities reject the entire effect", async () => {
        const f = await seed(); await ack(f);
        const existing = effect({ testRun: f.run, command: f.input }).testLogs[0];
        await repository.saveParticipantTestLogs([existing]);
        const before = await snapshot(f);
        await assert.rejects(repository.applyParticipantRunCommand(application(f), context => ({ ...effect(context), testLogs: [existing] })));
        await assert.rejects(repository.applyParticipantRunCommand(application(f), context => {
          const next = effect(context); next.testLogs.push(structuredClone(next.testLogs[0])); return next;
        }), /duplicate artifact identities/);
        assert.deepEqual(await snapshot(f), before);
        const retried = await repository.applyParticipantRunCommand(application(f), context => effect(context));
        assert.equal(retried.applied, true); assert.equal(retried.command.executionSequence, 1);
      });
      if (kind === "sqlite" || kind === "postgres") await t.test("independent repositories serialize concurrent effects against the latest Run", async () => {
        const f = await seed(), second = { ...f.input, commandId: randomUUID(), commandType: "resume" };
        await repository.appendParticipantRunCommand(second); await ack(f);
        await repository.acknowledgeParticipantRunCommand({ ...f.scope, commandId: second.commandId, acknowledgedAt });
        const replica = await create();
        const results = await Promise.all([repository.applyParticipantRunCommand(application(f), context => effect(context, "paused")),
          replica.applyParticipantRunCommand({ ...application(f), commandId: second.commandId }, context => effect(context, "running"))]);
        assert.deepEqual(results.map(result => result.command.executionSequence).sort(), [1, 2]);
        const last = results.find(result => result.command.executionSequence === 2);
        assert.equal((await repository.getTestRunById(f.run.testRunId)).status, last.testRun.status);
        assert.equal((await snapshot(f)).logs.length, 2); assert.equal((await snapshot(f)).activity.length, 2);
      });
      if (kind === "sqlite") await t.test("two actual Node processes assign one execution order without losing the response", async () => {
        const f = await seed(), second = { ...f.input, commandId: randomUUID(), commandType: "resume" };
        await repository.appendParticipantRunCommand(second); await ack(f);
        await repository.acknowledgeParticipantRunCommand({ ...f.scope, commandId: second.commandId, acknowledgedAt });
        const children = [f.input, second].map(command => {
          const child = spawn(process.execPath, ["--input-type=module", "-e", `
            import { createSqliteFirstSliceRepository } from '@testcenter-rewrite-app/sqlite-store';
            const repository = createSqliteFirstSliceRepository(${JSON.stringify(file)});
            process.once('message',async () => {
              try {
                const result = await repository.applyParticipantRunCommand(${JSON.stringify({ ...application(f), commandId: command.commandId })},context => ({
                  testRun:{...context.testRun,status:${JSON.stringify(command.commandType === "pause" ? "paused" : "running")}},testLogs:[],activityEvents:[]
                }));
                process.send({type:'result',result});process.disconnect();
              } catch(error){console.error(error);process.exit(1);}
            });
            process.send({type:'ready'});
          `], { stdio: ["ignore", "pipe", "pipe", "ipc"] });
          let stderr = "", result, wasReady = false;
          child.stderr.on("data", data => stderr += data);
          const ready = new Promise((resolve, reject) => {
            child.on("message", message => { if (message.type === "ready") { wasReady = true; resolve(); } else result = message.result; });
            child.once("error", reject);
            child.once("close", () => { if (!wasReady) reject(new Error(stderr || "The owned child exited before its ready event.")); });
          });
          const closed = new Promise((resolve, reject) => child.once("close", code => code === 0 ? resolve(result) : reject(new Error(stderr))));
          void closed.catch(() => undefined);
          return { child, ready, closed };
        });
        const timeout = setTimeout(() => { for (const entry of children) entry.child.kill("SIGTERM"); }, 15_000);
        try {
          await Promise.all(children.map(entry => entry.ready));
          for (const entry of children) entry.child.send({ go: true });
          const results = await Promise.all(children.map(entry => entry.closed));
          assert.deepEqual(results.map(result => result.command.executionSequence).sort(), [1, 2]);
          const current = await repository.getTestRunById(f.run.testRunId);
          assert.equal(current.status, results.find(result => result.command.executionSequence === 2).testRun.status);
          assert.equal(current.unitResponses.unit, f.run.unitResponses.unit);
        } finally {
          clearTimeout(timeout);
          for (const entry of children) if (entry.child.exitCode === null && entry.child.signalCode === null) entry.child.kill("SIGTERM");
          await Promise.allSettled(children.map(entry => entry.closed));
        }
      });
      if (kind === "file") await t.test("a failed file rename preserves all cached and durable state for a complete retry", async () => {
        const f = await seed(); await ack(f); const before = await snapshot(f), backup = file + ".owned-backup";
        await rename(file, backup); await mkdir(file);
        try { await assert.rejects(repository.applyParticipantRunCommand(application(f), context => effect(context, "paused", "closed"))); }
        finally { await rm(file, { recursive: true }); await rename(backup, file); }
        assert.deepEqual(await snapshot(f), before);
        assert.deepEqual(await snapshot(f, await create()), before);
        assert.equal((await repository.applyParticipantRunCommand(application(f), context => effect(context, "paused", "closed"))).applied, true);
      });
      if (kind === "sqlite" || kind === "postgres") {
        const connection = kind === "sqlite" ? new DatabaseSync(file) : new Pool({ connectionString: process.env.FIRST_SLICE_POSTGRES_URL });
        const execute = query => kind === "sqlite" ? connection.exec(query) : connection.query(query);
        try {
          for (const [table, action] of [["participant_test_logs", "INSERT"], ["workspace_activity_events", "INSERT"], ["participant_sessions", "UPDATE"], ["participant_run_commands", "UPDATE"]]) {
            await t.test(`${table} failure rolls back the entire effect and its receipt`, async () => {
              const f = await seed(); await ack(f); const before = await snapshot(f);
              if (kind === "sqlite") await execute(`CREATE TRIGGER owned_application_failure BEFORE ${action} ON ${table} BEGIN SELECT RAISE(ABORT, 'owned application failure'); END`);
              else await execute(`CREATE FUNCTION owned_application_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned application failure'; END $$;
                CREATE TRIGGER owned_application_failure BEFORE ${action} ON ${table} FOR EACH ROW EXECUTE FUNCTION owned_application_failure()`);
              try { await assert.rejects(repository.applyParticipantRunCommand(application(f), context => effect(context, "paused", "closed")), /owned application failure/); }
              finally {
                if (kind === "sqlite") await execute("DROP TRIGGER owned_application_failure");
                else await execute(`DROP TRIGGER owned_application_failure ON ${table}; DROP FUNCTION owned_application_failure()`);
              }
              assert.deepEqual(await snapshot(f), before);
              assert.deepEqual(await snapshot(f, await create()), before);
              const retried = await repository.applyParticipantRunCommand(application(f), context => effect(context, "paused", "closed"));
              assert.equal(retried.applied, true); assert.equal(retried.command.executionSequence, 1);
              assert.equal((await snapshot(f)).logs.length, 1); assert.equal((await snapshot(f)).activity.length, 1);
            });
          }
        } finally { if (kind === "sqlite") connection.close(); else await connection.end(); }
      }
    } finally {
      for (const storage of storages) await storage.shutdown();
      await rm(directory, { recursive: true, force: true });
    }
  });
}
