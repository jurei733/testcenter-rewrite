import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { Pool } from "pg";
import { createFirstSliceServices } from "@testcenter-rewrite-app/application";
import { createInMemoryFirstSliceRepository } from "@testcenter-rewrite-app/memory-store";
import { createFileFirstSliceRepository } from "@testcenter-rewrite-app/file-store";
import { createSqliteFirstSliceRepository } from "@testcenter-rewrite-app/sqlite-store";
import { createPostgresFirstSliceStorage, migratePostgresFirstSliceStorage, POSTGRES_FIRST_SLICE_SCHEMA_VERSION } from "@testcenter-rewrite-app/postgres-store";

const issuedAt = "2026-10-11T00:00:00.000Z";
const acknowledgedAt = "2026-10-11T00:00:01.000Z";
const kinds = ["memory", "file", "sqlite"];
if (process.env.FIRST_SLICE_STORE === "postgres") {
  assert.ok(process.env.FIRST_SLICE_POSTGRES_URL, "PostgreSQL command proof requires a real configured database.");
  kinds.push("postgres");
}

for (const kind of kinds) {
  test(`${kind}: durable participant command receipts`, async t => {
    const directory = await mkdtemp(join(tmpdir(), "testcenter-command-receipts-"));
    const file = join(directory, "owned.json");
    const storages = [];
    const create = async () => {
      if (kind === "memory") return createInMemoryFirstSliceRepository();
      if (kind === "file") return createFileFirstSliceRepository(file);
      if (kind === "sqlite") return createSqliteFirstSliceRepository(join(directory, "owned.sqlite"));
      const storage = await createPostgresFirstSliceStorage(process.env.FIRST_SLICE_POSTGRES_URL);
      storages.push(storage);
      return storage.repository;
    };
    let repository = await create();
    const services = createFirstSliceServices({ repository, now: () => issuedAt, xmlSchemaProfile: "legacy-compatibility" });
    const keys = { tenantKey: `command-${randomUUID()}`, workspaceKey: "owned" };
    const tenant = await services.platform.createTenant({ tenantKey: keys.tenantKey, displayName: "Owned command receipt test" });
    const workspace = await services.platform.createWorkspace({ ...keys, displayName: "Owned command receipt test" });
    const session = { tenantId: tenant.tenantId, workspaceId: workspace.workspaceId,
      participantSessionId: randomUUID(), contentReleaseId: randomUUID(), loginKey: "owned", groupKey: "owned",
      status: "launched", createdAt: issuedAt };
    const run = { tenantId: tenant.tenantId, workspaceId: workspace.workspaceId,
      participantSessionId: session.participantSessionId, contentReleaseId: session.contentReleaseId,
      testRunId: randomUUID(), bookletKey: "owned-booklet", status: "running", currentUnitKey: "unit",
      executionMode: "run-hot-return", unitResponses: { unit: 'Exact saved answer Ä/β\n";' },
      testletTimers: {}, createdAt: issuedAt, updatedAt: issuedAt, completedAt: null };
    const otherRun = { ...run, testRunId: randomUUID() };
    const scope = { tenantId: run.tenantId, workspaceId: run.workspaceId,
      participantSessionId: run.participantSessionId, testRunId: run.testRunId };
    const otherScope = { ...scope, testRunId: otherRun.testRunId };
    const input = (commandId, extra = {}) => ({ ...scope, commandId, commandType: "resume",
      targetUnitKey: null, remainingSeconds: null, actorId: "owned-operator", issuedAt, ...extra });
    const ack = (commandId, extra = {}) => ({ ...scope, commandId, acknowledgedAt, ...extra });
    const pending = () => repository.listPendingParticipantRunCommands(scope);
    const deletion = { ...keys, tenantId: tenant.tenantId, workspaceId: workspace.workspaceId,
      auditEvent: { adminAuditEventId: randomUUID(), eventType: "workspace_deleted", actorAdminUserId: null,
        subjectAdminUserId: null, occurredAt: issuedAt, summary: "Owned command receipt cleanup", details: {} } };
    try {
      await repository.saveParticipantSession(session);
      await repository.saveTestRun(run);
      await repository.saveTestRun(otherRun);
      const storedRun = structuredClone(await repository.getTestRunById(run.testRunId));

      await t.test("same-status commands have independent identities, fan-out and detached values", async () => {
        const request = input("shared-id");
        const first = await repository.appendParticipantRunCommand(request);
        assert.equal(first.sequence, 1);
        assert.equal(first.acknowledgedAt, null);
        request.commandType = "pause";
        first.commandType = "pause";
        const second = await repository.appendParticipantRunCommand(input("second-id"));
        assert.equal(second.sequence, 2);
        const fanout = await repository.appendParticipantRunCommand(input("shared-id", otherScope));
        assert.equal(fanout.sequence, 1);
        const listed = await pending();
        assert.deepEqual(listed.map(item => [item.commandId, item.commandType]), [["shared-id", "resume"], ["second-id", "resume"]]);
        listed[0].commandType = "pause";
        assert.equal((await pending())[0].commandType, "resume");
        const received = await repository.acknowledgeParticipantRunCommand(ack("shared-id"));
        assert.equal(received.acknowledgedAt, acknowledgedAt);
        received.acknowledgedAt = issuedAt;
        assert.equal((await repository.acknowledgeParticipantRunCommand(ack("shared-id", { acknowledgedAt: "2026-10-11T00:01:00Z" }))).acknowledgedAt, acknowledgedAt);
        assert.deepEqual((await pending()).map(item => item.commandId), ["second-id"]);
        assert.deepEqual((await repository.listPendingParticipantRunCommands(otherScope)).map(item => item.commandId), ["shared-id"]);
        assert.deepEqual(await repository.getTestRunById(run.testRunId), storedRun, "Issuance/receipt must not change status, answers, timers or current-unit timestamps.");
      });

      await t.test("all scope boundaries deny reads, issuance and receipts", async () => {
        for (const key of Object.keys(scope)) {
          const foreign = { [key]: `foreign-${randomUUID()}` };
          assert.deepEqual(await repository.listPendingParticipantRunCommands({ ...scope, ...foreign }), []);
          assert.equal(await repository.appendParticipantRunCommand(input(`denied-${key}`, foreign)), null);
          assert.equal(await repository.acknowledgeParticipantRunCommand(ack("second-id", foreign)), null);
        }
        assert.equal(await repository.acknowledgeParticipantRunCommand(ack("unknown-command")), null);
        assert.deepEqual((await pending()).map(item => item.commandId), ["second-id"]);
      });

      await t.test("idempotency and concurrent writers allocate one stable sequence per command", async () => {
        assert.equal((await repository.appendParticipantRunCommand(input("shared-id"))).acknowledgedAt, acknowledgedAt);
        await assert.rejects(repository.appendParticipantRunCommand(input("shared-id", { commandType: "pause" })), /identity cannot be reused/);
        for (const invalid of [{ commandType: "not-a-command" }, { issuedAt: "invalid" }, { remainingSeconds: -1 },
          { remainingSeconds: 1.5 }, { targetUnitKey: " " }, { actorId: 4 }, { commandId: " " }]) {
          await assert.rejects(repository.appendParticipantRunCommand(input("invalid", invalid)));
        }
        await assert.rejects(repository.acknowledgeParticipantRunCommand(ack("second-id", { acknowledgedAt: "invalid" })));
        const other = kind === "postgres" || kind === "sqlite" ? await create() : repository;
        const writers = [repository, other];
        const commands = await Promise.all(Array.from({ length: 24 }, (_, index) =>
          writers[index % writers.length].appendParticipantRunCommand(input(`parallel-${index}`))));
        assert.deepEqual(commands.map(item => item.sequence).sort((a, b) => a - b), Array.from({ length: 24 }, (_, index) => index + 3));
        const retries = await Promise.all(writers.map(writer => writer.appendParticipantRunCommand(input("same-retry"))));
        assert.equal(retries[0].sequence, 27);
        assert.deepEqual(retries[0], retries[1]);
        const receipts = await Promise.all(writers.map((writer, index) =>
          writer.acknowledgeParticipantRunCommand(ack("same-retry", { acknowledgedAt: `2026-10-11T00:00:0${index + 2}.000Z` }))));
        assert.deepEqual(receipts[0], receipts[1], "Concurrent receipts must retain the first accepted server timestamp.");
      });

      await t.test("restart preserves pending commands and receipt history", async () => {
        const before = await pending();
        if (kind !== "memory") repository = await create();
        assert.deepEqual(await pending(), before);
        assert.equal((await repository.appendParticipantRunCommand(input("shared-id"))).acknowledgedAt, acknowledgedAt);
        assert.equal((await repository.appendParticipantRunCommand(input("after-restart"))).sequence, 28);
      });

      await t.test("completed Runs retain accepted receipts while denying new commands", async () => {
        const completed = { ...run, status: "completed", completedAt: acknowledgedAt, updatedAt: acknowledgedAt };
        await repository.saveTestRun(completed);
        const storedCompleted = structuredClone(await repository.getTestRunById(run.testRunId));
        assert.equal(await repository.appendParticipantRunCommand(input("too-late")), null);
        assert.ok(await repository.acknowledgeParticipantRunCommand(ack("second-id")));
        assert.deepEqual(await repository.getTestRunById(run.testRunId), storedCompleted);
        await repository.saveTestRun(run);
      });

      await t.test("ACK ends deferred delivery across controller termination and re-entry without applying the command", async () => {
        const original = await repository.getTestRunById(run.testRunId);
        const before = await pending();
        const received = await repository.appendParticipantRunCommand(input("deferred-before-stop", { effectsDeferred: true }));
        const late = await repository.appendParticipantRunCommand(input("deferred-after-stop", { effectsDeferred: true }));
        const unreceived = await repository.appendParticipantRunCommand(input("deferred-unreceived", { effectsDeferred: true }));
        const receipt = await repository.acknowledgeParticipantRunCommand(ack(received.commandId));
        await repository.saveParticipantSession({ ...session, status: "signed_in" });
        const lateReceipt = await repository.acknowledgeParticipantRunCommand(ack(late.commandId));
        await repository.saveParticipantSession(session);
        if (kind !== "memory") repository = await create();
        assert.deepEqual(await pending(), [...before, unreceived]);
        for (const record of [receipt, lateReceipt]) {
          assert.equal(record.executedAt, null);
          assert.deepEqual(await repository.acknowledgeParticipantRunCommand(ack(record.commandId, { acknowledgedAt: issuedAt })), record);
        }
        assert.deepEqual(await repository.getTestRunById(run.testRunId), original);
      });

      if (kind === "file") {
        await t.test("failed durable writes never consume cached pending commands", async () => {
          const before = await pending();
          const backup = join(directory, "owned-backup.json");
          await rename(file, backup);
          await mkdir(file);
          try {
            await assert.rejects(repository.acknowledgeParticipantRunCommand(ack("after-restart")));
            assert.deepEqual(await pending(), before, "An unsuccessful disk receipt must remain pending in this live process.");
            await assert.rejects(repository.appendParticipantRunCommand(input("write-failed")));
            assert.deepEqual(await pending(), before);
          } finally {
            await rm(file, { recursive: true });
            await rename(backup, file);
          }
          assert.deepEqual(await (await create()).listPendingParticipantRunCommands(scope), before);
          assert.ok(await repository.acknowledgeParticipantRunCommand(ack("after-restart")));
          assert.equal((await repository.appendParticipantRunCommand(input("write-recovered"))).sequence,
            Math.max(...before.map(command => command.sequence)) + 1, "A failed append must not consume the next sequence.");
        });
      }

      await t.test("parent deletion removes receipts rather than hiding orphan rows", async () => {
        await repository.deleteTestRunsByIds([run.testRunId]);
        await repository.saveTestRun(run);
        assert.deepEqual(await pending(), [], "Recreating a deleted Run cannot expose its old command rows.");
        assert.equal((await repository.appendParticipantRunCommand(input("shared-id"))).sequence, 1);
        assert.equal((await repository.listPendingParticipantRunCommands(otherScope)).length, 1);
        assert.ok(await repository.deleteWorkspaceAggregate(deletion));
        await repository.saveParticipantSession(session);
        await repository.saveTestRun(run);
        await repository.saveTestRun(otherRun);
        assert.deepEqual(await pending(), []);
        assert.deepEqual(await repository.listPendingParticipantRunCommands(otherScope), []);
      });
    } finally {
      try {
        await repository.deleteTestRunsByIds([run.testRunId, otherRun.testRunId]);
        await repository.deleteWorkspaceAggregate(deletion);
      } finally {
        for (const storage of storages) await storage.shutdown();
        await rm(directory, { recursive: true, force: true });
      }
    }
  });
}

test("legacy file snapshots receive an empty command collection without dropping saved Runs", async () => {
  const directory = await mkdtemp(join(tmpdir(), "testcenter-legacy-command-store-"));
  const file = join(directory, "owned.json");
  try {
    const original = createFileFirstSliceRepository(file);
    const run = { tenantId: "owned", workspaceId: "owned", participantSessionId: "owned", testRunId: "owned",
      contentReleaseId: "owned", bookletKey: "owned", status: "running", currentUnitKey: "unit", unitResponses: { unit: "Exact legacy answer" },
      testletTimers: {}, createdAt: issuedAt, updatedAt: issuedAt, completedAt: null };
    await original.saveParticipantSession({tenantId:run.tenantId,workspaceId:run.workspaceId,participantSessionId:run.participantSessionId,contentReleaseId:run.contentReleaseId,loginKey:'owned',groupKey:'owned',status:'launched',createdAt:issuedAt});
    await original.saveTestRun(run);
    const document = JSON.parse(await readFile(file, "utf8"));
    delete document.participantRunCommands;
    await writeFile(file, JSON.stringify(document));
    const repository = createFileFirstSliceRepository(file);
    assert.deepEqual(await repository.listPendingParticipantRunCommands(run), []);
    assert.equal((await repository.appendParticipantRunCommand({ ...run, commandId: "first", commandType: "resume", actorId: null,
      targetUnitKey: null, remainingSeconds: null, issuedAt })).sequence, 1);
    assert.deepEqual(await repository.getTestRunById(run.testRunId), run);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("SQLite serializes command identities across two actual Node processes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "testcenter-command-processes-"));
  const file = join(directory, "owned.sqlite");
  const scope = { tenantId: "owned", workspaceId: "owned", participantSessionId: "owned", testRunId: "owned" };
  const input = { ...scope, commandType: "resume", actorId: null, targetUnitKey: null, remainingSeconds: null, issuedAt };
  const repository = createSqliteFirstSliceRepository(file);
  const workers = [];
  const code = `
    import { createSqliteFirstSliceRepository } from '@testcenter-rewrite-app/sqlite-store';
    import { setTimeout as delay } from 'node:timers/promises';
    const repository = createSqliteFirstSliceRepository(process.argv[1]);
    const input = JSON.parse(process.argv[2]);
    process.once('message', async () => {
      try {
        const results = [];
        for (let index = 0; index < 13; index++) {
          results.push(await repository.appendParticipantRunCommand({ ...input,
            commandId: index === 0 ? 'shared' : process.argv[3] + '-' + index }));
          await delay(1);
        }
        process.send({ results });
      } catch (error) { process.send({ error: error.message }); process.exitCode = 1; }
      finally { process.disconnect(); }
    });
    process.send({ ready: true });
  `;
  const timeout = setTimeout(() => { for (const worker of workers) worker.kill("SIGTERM"); }, 15_000);
  try {
    await repository.saveParticipantSession({tenantId:scope.tenantId,workspaceId:scope.workspaceId,participantSessionId:scope.participantSessionId,contentReleaseId:'owned',loginKey:'owned',groupKey:'owned',status:'launched',createdAt:issuedAt});
    await repository.saveTestRun({ ...scope, contentReleaseId: "owned", bookletKey: "owned", status: "running",
      currentUnitKey: "unit", unitResponses: {}, testletTimers: {}, createdAt: issuedAt, updatedAt: issuedAt, completedAt: null });
    const jobs = ["first", "second"].map(name => {
      const worker = spawn(process.execPath, ["--input-type=module", "--eval", code, file, JSON.stringify(input), name],
        { cwd: new URL("../", import.meta.url), stdio: ["ignore", "ignore", "pipe", "ipc"] });
      workers.push(worker);
      let stderr = "";
      let result;
      worker.stderr.on("data", chunk => stderr += chunk);
      const ready = new Promise((resolve, reject) => {
        worker.once("error", reject);
        worker.once("exit", code => reject(new Error(`SQLite worker exited before ready: ${code}: ${stderr}`)));
        worker.once("message", message => message.ready ? resolve() : reject(new Error("Worker was not ready.")));
      });
      const complete = new Promise((resolve, reject) => {
        worker.once("error", reject);
        worker.on("message", message => { if (message.results || message.error) result = message; });
        worker.once("exit", code => code === 0 && result?.results ? resolve(result.results) :
          reject(new Error(`SQLite worker failed: ${code}: ${result?.error ?? stderr}`)));
      });
      return { worker, ready, complete };
    });
    // Attach result rejection handlers before the readiness barrier can fail.
    const completed = Promise.all(jobs.map(job => job.complete));
    completed.catch(() => {});
    await Promise.all(jobs.map(job => job.ready));
    for (const job of jobs) job.worker.send({ start: true });
    const results = await completed;
    assert.deepEqual(results[0][0], results[1][0], "A shared command identity receives exactly one sequence across processes.");
    const pending = await createSqliteFirstSliceRepository(file).listPendingParticipantRunCommands(scope);
    assert.equal(pending.length, 25);
    assert.deepEqual(pending.map(command => command.sequence), Array.from({ length: 25 }, (_, index) => index + 1));
  } finally {
    clearTimeout(timeout);
    await Promise.all(workers.map(worker => worker.exitCode !== null || worker.signalCode !== null ? undefined :
      new Promise(resolve => { worker.once("exit", resolve); worker.kill("SIGTERM"); })));
    await rm(directory, { recursive: true, force: true });
  }
});

if (kinds.includes("postgres")) {
  test("PostgreSQL upgrades existing saved Runs and atomically retries a failed command migration", async () => {
    const schema = `owned_command_upgrade_${randomUUID().replaceAll("-", "")}`;
    assert.match(schema, /^owned_command_upgrade_[a-f0-9]+$/);
    const rootPool = new Pool({ connectionString: process.env.FIRST_SLICE_POSTGRES_URL });
    const url = new URL(process.env.FIRST_SLICE_POSTGRES_URL);
    url.searchParams.set("options", `-c search_path=${schema}`);
    const control = new Pool({ connectionString: url.toString() });
    let storage;
    let created = false;
    try {
      await rootPool.query(`CREATE SCHEMA "${schema}"`);
      created = true;
      storage = await createPostgresFirstSliceStorage(url.toString());
      const run = { tenantId: "owned", workspaceId: "owned", participantSessionId: "owned", testRunId: "owned",
        contentReleaseId: "owned", bookletKey: "owned", status: "running", currentUnitKey: "unit",
        unitResponses: { unit: "Exact PostgreSQL answer before migration" }, testletTimers: {},
        createdAt: issuedAt, updatedAt: issuedAt, completedAt: null };
      await storage.repository.saveParticipantSession({tenantId:run.tenantId,workspaceId:run.workspaceId,participantSessionId:run.participantSessionId,contentReleaseId:run.contentReleaseId,loginKey:'owned',groupKey:'owned',status:'launched',createdAt:issuedAt});
      await storage.repository.saveTestRun(run);
      const before = await storage.repository.getTestRunById(run.testRunId);
      await storage.shutdown();
      storage = undefined;
      await control.query(`ALTER TABLE operational_login_migration_candidates DROP COLUMN native_logins_json; DROP TABLE IF EXISTS original_native_units; DROP TABLE original_workspace_numbers; DROP TABLE original_workspace_number_counter; ALTER TABLE test_runs DROP COLUMN original_test_state_json; DROP TABLE original_test_numbers; DROP TABLE original_test_number_counter; ALTER TABLE test_runs DROP COLUMN response_part_types_json; DROP TABLE original_session_tokens; DROP INDEX participant_access_credentials_token_hash; DROP TABLE original_login_bindings; DROP TABLE original_participant_groups; DROP INDEX participant_sessions_original_login; ALTER TABLE participant_sessions DROP COLUMN original_name_suffix; ALTER TABLE participant_sessions DROP COLUMN original_login_key; ALTER TABLE participant_roster_entries DROP COLUMN original_login_identity; ALTER TABLE test_runs DROP COLUMN original_result_state_json; ALTER TABLE test_runs DROP COLUMN controller_dispatches_json; ALTER TABLE test_runs DROP COLUMN state_revision; ALTER TABLE test_runs DROP COLUMN controller_entry_json; DROP TABLE participant_progress_deliveries;
        ALTER TABLE test_runs DROP COLUMN response_field_timestamps_json;
        ALTER TABLE test_runs DROP COLUMN shared_parameter_timestamps_json;
        DROP TABLE participant_run_commands;
        DELETE FROM schema_migrations WHERE version >= 53;
        CREATE FUNCTION own_migration_failure() RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN RAISE EXCEPTION 'own command migration failure'; END $$;
        CREATE TRIGGER own_migration_failure BEFORE INSERT ON schema_migrations
          FOR EACH ROW WHEN (NEW.version = 53) EXECUTE FUNCTION own_migration_failure()`);
      assert.equal(Number((await control.query("SELECT MAX(version) AS version FROM schema_migrations")).rows[0].version), 52);
      await assert.rejects(migratePostgresFirstSliceStorage(url.toString()), /own command migration failure/);
      assert.equal((await control.query("SELECT to_regclass('participant_run_commands') AS name")).rows[0].name, null,
        "A rejected migration must roll back the new command table and its index.");
      assert.equal(Number((await control.query("SELECT MAX(version) AS version FROM schema_migrations")).rows[0].version), 52);
      await control.query("DROP TRIGGER own_migration_failure ON schema_migrations; DROP FUNCTION own_migration_failure()");
      assert.equal((await migratePostgresFirstSliceStorage(url.toString())).currentSchemaVersion, POSTGRES_FIRST_SLICE_SCHEMA_VERSION);
      storage = await createPostgresFirstSliceStorage(url.toString());
      assert.deepEqual(await storage.repository.getTestRunById(run.testRunId), before);
      assert.equal((await storage.repository.appendParticipantRunCommand({ ...run, commandId: "after-upgrade", commandType: "resume",
        actorId: null, targetUnitKey: null, remainingSeconds: null, issuedAt })).sequence, 1);
    } finally {
      await storage?.shutdown();
      await control.end();
      try { if (created) await rootPool.query(`DROP SCHEMA "${schema}" CASCADE`); }
      finally { await rootPool.end(); }
    }
  });
}
