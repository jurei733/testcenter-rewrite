import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { once } from "node:events";
import { Worker } from "node:worker_threads";
import test from "node:test";

import type { ParticipantTestLog } from "@testcenter-rewrite-app/domain";
import { createSqliteFirstSliceRepository, migrateSqliteFirstSliceStorage, SQLITE_BUSY_TIMEOUT_MS, SQLITE_FIRST_SLICE_SCHEMA_VERSION } from "./index.js";

const log = (id: string, content: string): ParticipantTestLog => ({
  participantTestLogId: id, tenantId: "own-tenant", workspaceId: "own-workspace",
  participantSessionId: "own-session", testRunId: "own-run", unitKey: null,
  originalUnitId: null, logKey: "CONTROLLER", logContent: content,
  timestamp: 1, recordedAt: "2026-10-10T00:00:00.000Z"
});

for (const conflict of ["ABORT", "ROLLBACK"] as const) {
  test(`SQLite preserves the original ${conflict} error and atomically retries a test-log batch`, async () => {
    const directory = await mkdtemp(join(tmpdir(), "sqlite-log-failure-"));
    const databasePath = join(directory, "own.sqlite");
    const repository = createSqliteFirstSliceRepository(databasePath);
    const control = new DatabaseSync(databasePath);
    try {
      await repository.saveParticipantTestLogs([log("existing", "before")]);
      control.exec(`CREATE TRIGGER own_log_failure BEFORE INSERT ON participant_test_logs
        WHEN NEW.participant_test_log_id = 'rejected'
        BEGIN SELECT RAISE(${conflict}, 'own test-log failure'); END`);
      await assert.rejects(repository.saveParticipantTestLogs([
        log("existing", "must roll back"), log("rejected", "must not persist")
      ]), (error: unknown) => error instanceof Error && error.message === "own test-log failure");
      assert.deepEqual(await repository.listParticipantTestLogsByWorkspace("own-tenant", "own-workspace"),
        [log("existing", "before")]);
      control.exec("DROP TRIGGER own_log_failure");
      await repository.saveParticipantTestLogs([log("existing", "after retry"), log("rejected", "retried")]);
      assert.deepEqual((await repository.listParticipantTestLogsByWorkspace("own-tenant", "own-workspace"))
        .sort((a, b) => a.participantTestLogId.localeCompare(b.participantTestLogId)),
        [log("existing", "after retry"), log("rejected", "retried")]);
    } finally {
      control.close();
      await rm(directory, { recursive: true, force: true });
    }
  });
}

test("SQLite preserves SQLITE_FULL, rolls back the whole test-log batch and recovers after capacity returns", async t => {
  const directory = await mkdtemp(join(tmpdir(), "sqlite-bounded-capacity-"));
  const databasePath = join(directory, "own.sqlite");
  const repository = createSqliteFirstSliceRepository(databasePath);
  const control = new DatabaseSync(databasePath);
  let limitedDatabase: DatabaseSync | undefined;
  const originalExec = DatabaseSync.prototype.exec;
  try {
    await repository.saveParticipantTestLogs([log("existing", "before")]);
    const pages = Number(control.prepare("PRAGMA page_count").get()?.page_count);
    // Limit only this real repository connection, without filling the host disk
    // or adding a test-only storage option to the production API.
    const hook = t.mock.method(DatabaseSync.prototype, "exec", function (this: DatabaseSync, sql: string) {
      if (sql === "BEGIN" && !limitedDatabase) {
        limitedDatabase = this;
        originalExec.call(this, `PRAGMA max_page_count = ${pages + 16}`);
      }
      return originalExec.call(this, sql);
    });
    await assert.rejects(repository.saveParticipantTestLogs([
      log("existing", "must roll back"), log("full", "x".repeat(256 * 1024))
    ]), (error: unknown) => error instanceof Error &&
      error.message === "database or disk is full" && "errcode" in error && error.errcode === 13);
    hook.mock.restore();
    assert.deepEqual(await repository.listParticipantTestLogsByWorkspace("own-tenant", "own-workspace"),
      [log("existing", "before")]);
    assert.ok(limitedDatabase);
    limitedDatabase.exec("PRAGMA max_page_count = 1073741823");
    await repository.saveParticipantTestLogs([log("existing", "after retry"), log("full", "retried")]);
    assert.equal((await repository.listParticipantTestLogsByWorkspace("own-tenant", "own-workspace")).length, 2);
  } finally {
    t.mock.restoreAll();
    control.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("SQLite preserves automatic rollback errors when consuming proof-of-work challenges", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sqlite-challenge-failure-"));
  const databasePath = join(directory, "own.sqlite");
  const repository = createSqliteFirstSliceRepository(databasePath);
  const control = new DatabaseSync(databasePath);
  const input = { challengeId: "own-challenge", consumedAt: "2026-10-10T00:00:00.000Z",
    expiresAt: "2026-10-10T00:01:00.000Z" };
  try {
    control.exec(`CREATE TRIGGER own_challenge_failure BEFORE INSERT ON consumed_proof_of_work_challenges
      BEGIN SELECT RAISE(ROLLBACK, 'own challenge failure'); END`);
    await assert.rejects(repository.consumeProofOfWorkChallenge(input), /own challenge failure/);
    assert.equal(control.prepare("SELECT COUNT(*) AS count FROM consumed_proof_of_work_challenges").get()?.count, 0);
    control.exec("DROP TRIGGER own_challenge_failure");
    assert.equal(await repository.consumeProofOfWorkChallenge(input), true);
    assert.equal(await repository.consumeProofOfWorkChallenge(input), false);
  } finally {
    control.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("SQLite keeps both failures when rollback itself fails unexpectedly", async t => {
  const directory = await mkdtemp(join(tmpdir(), "sqlite-rollback-failure-"));
  const databasePath = join(directory, "own.sqlite");
  const repository = createSqliteFirstSliceRepository(databasePath);
  const control = new DatabaseSync(databasePath);
  const originalExec = DatabaseSync.prototype.exec;
  const rollbackError = new Error("own rollback I/O failure");
  let failedDatabase: DatabaseSync | undefined;
  try {
    control.exec(`CREATE TRIGGER own_log_failure BEFORE INSERT ON participant_test_logs
      BEGIN SELECT RAISE(ABORT, 'own original failure'); END`);
    const hook = t.mock.method(DatabaseSync.prototype, "exec", function (this: DatabaseSync, sql: string) {
      if (sql === "ROLLBACK") { failedDatabase = this; throw rollbackError; }
      return originalExec.call(this, sql);
    });
    await assert.rejects(repository.saveParticipantTestLogs([log("rejected", "rejected")]),
      (error: unknown) => error instanceof AggregateError &&
        error.errors[0] instanceof Error && error.errors[0].message === "own original failure" &&
        error.errors[1] === rollbackError && error.cause === error.errors[0] &&
        error.message.includes("own original failure") && error.message.includes(rollbackError.message));
    hook.mock.restore();
    assert.ok(failedDatabase);
    failedDatabase.exec("ROLLBACK");
    control.exec("DROP TRIGGER own_log_failure");
    await repository.saveParticipantTestLogs([log("retried", "after retry")]);
    assert.deepEqual(await repository.listParticipantTestLogsByWorkspace("own-tenant", "own-workspace"),
      [log("retried", "after retry")]);
  } finally {
    t.mock.restoreAll();
    control.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("SQLite rolls back a test-log batch after a busy COMMIT and accepts a later retry", { timeout: 15_000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), "sqlite-commit-failure-"));
  const databasePath = join(directory, "own.sqlite");
  const repository = createSqliteFirstSliceRepository(databasePath);
  const worker = new Worker(`
    const { DatabaseSync } = require('node:sqlite');
    const { parentPort, workerData } = require('node:worker_threads');
    const database = new DatabaseSync(workerData.databasePath);
    database.exec('BEGIN');
    database.prepare('SELECT COUNT(*) FROM participant_test_logs').get();
    parentPort.postMessage('locked');
    setTimeout(() => { database.exec('ROLLBACK'); database.close(); }, workerData.duration);
  `, { eval: true, workerData: { databasePath, duration: SQLITE_BUSY_TIMEOUT_MS + 750 } });
  const ready = once(worker, "message"), finished = once(worker, "exit");
  try {
    assert.deepEqual(await ready, ["locked"]);
    await assert.rejects(repository.saveParticipantTestLogs([log("rejected", "rejected")]), /database is locked/);
    assert.deepEqual(await repository.listParticipantTestLogsByWorkspace("own-tenant", "own-workspace"), []);
    await finished;
    await repository.saveParticipantTestLogs([log("rejected", "after retry")]);
    assert.deepEqual(await repository.listParticipantTestLogsByWorkspace("own-tenant", "own-workspace"),
      [log("rejected", "after retry")]);
  } finally {
    await finished;
    await rm(directory, { recursive: true, force: true });
  }
});

test("SQLite migration automatic rollback preserves its cause and leaves schema changes retryable", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sqlite-migration-failure-"));
  const databasePath = join(directory, "own.sqlite");
  const repository = createSqliteFirstSliceRepository(databasePath);
  const control = new DatabaseSync(databasePath);
  try {
    const run = { tenantId: "own", workspaceId: "own", participantSessionId: "own", testRunId: "own",
      contentReleaseId: "own", bookletKey: "own", status: "running" as const, currentUnitKey: "unit",
      unitResponses: { unit: "Exact answer before migration" }, testletTimers: {},
      createdAt: "2026-10-10T00:00:00.000Z", updatedAt: "2026-10-10T00:00:00.000Z", completedAt: null };
    await repository.saveTestRun(run);
    const storedRun = await repository.getTestRunById(run.testRunId);
    control.exec(`DELETE FROM schema_migrations WHERE version >= 58;
      DROP TABLE original_login_bindings; DROP TABLE original_participant_groups;
      DROP INDEX participant_sessions_original_login;
      ALTER TABLE participant_sessions DROP COLUMN original_name_suffix; ALTER TABLE participant_sessions DROP COLUMN original_login_key;
      ALTER TABLE participant_roster_entries DROP COLUMN original_login_identity;
      ALTER TABLE test_runs DROP COLUMN original_result_state_json; ALTER TABLE test_runs DROP COLUMN controller_dispatches_json; ALTER TABLE test_runs DROP COLUMN state_revision; ALTER TABLE test_runs DROP COLUMN controller_entry_json;
      DROP TABLE participant_progress_deliveries;
      ALTER TABLE test_runs DROP COLUMN response_field_timestamps_json;
      ALTER TABLE test_runs DROP COLUMN shared_parameter_timestamps_json;
      DROP TABLE participant_run_commands;
      DROP TABLE participant_connection_presence;
      ALTER TABLE participant_test_logs DROP COLUMN original_timestamp;
      CREATE TRIGGER own_migration_failure BEFORE INSERT ON schema_migrations
      WHEN NEW.version = 58 BEGIN SELECT RAISE(ROLLBACK, 'own migration failure'); END`);
    await assert.rejects(migrateSqliteFirstSliceStorage(databasePath), /own migration failure/);
    assert.equal(control.prepare("SELECT MAX(version) AS version FROM schema_migrations").get()?.version, 57);
    assert.equal(control.prepare("SELECT name FROM sqlite_master WHERE name = 'participant_connection_presence'").get(), undefined);
    assert.equal(control.prepare("SELECT name FROM sqlite_master WHERE name = 'participant_run_commands'").get(), undefined);
    assert.equal(control.prepare("PRAGMA table_info(participant_test_logs)").all()
      .some(row => row.name === "original_timestamp"), false);
    control.exec("DROP TRIGGER own_migration_failure");
    assert.equal((await migrateSqliteFirstSliceStorage(databasePath)).currentSchemaVersion, SQLITE_FIRST_SLICE_SCHEMA_VERSION);
    const upgraded = createSqliteFirstSliceRepository(databasePath);
    assert.deepEqual(await upgraded.getTestRunById(run.testRunId), storedRun);
    assert.equal((await upgraded.appendParticipantRunCommand({ ...run, commandId: "new-command", commandType: "resume",
      actorId: null, targetUnitKey: null, remainingSeconds: null, issuedAt: run.createdAt }))?.sequence, 1);
  } finally {
    control.close();
    await rm(directory, { recursive: true, force: true });
  }
});
