import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import test from "node:test";
import { createInMemoryFirstSliceRepository } from "@testcenter-rewrite-app/memory-store";
import { createFileFirstSliceRepository } from "@testcenter-rewrite-app/file-store";
import { createSqliteFirstSliceRepository } from "@testcenter-rewrite-app/sqlite-store";
import { createPostgresFirstSliceStorage } from "@testcenter-rewrite-app/postgres-store";

const kinds = process.env.FIRST_SLICE_STORE === "postgres" ? ["memory", "file", "sqlite", "postgres"] : ["memory", "file", "sqlite"];
const timestamp = "2026-10-07T00:00:00.000Z";

for (const kind of kinds) {
  test(`${kind}: atomically reserve an exact participant assignment without overwriting any existing run`, async t => {
    const directory = await mkdtemp(join(tmpdir(), "testcenter-assignment-reservation-"));
    const key = `assignment-${randomUUID()}`;
    const session = { participantSessionId: key, tenantId: key, workspaceId: key, contentReleaseId: key,
      loginKey: key, groupKey: key, status: "launched", createdAt: timestamp };
    const candidate = (assignment, id = randomUUID()) => ({
      testRunId: id, participantSessionId: key, tenantId: key, workspaceId: key, contentReleaseId: key,
      bookletKey: "BOOKLET", bookletAssignmentKey: assignment, status: "running", currentUnitKey: "unit",
      unitResponses: { unit: "  answer ä漢字\n" }, testletTimers: {}, lockedUnitKeys: [], lockedTestletKeys: [],
      createdAt: timestamp, updatedAt: timestamp, completedAt: null
    });
    const connections = [];
    const create = async () => {
      if (kind === "memory") return createInMemoryFirstSliceRepository();
      if (kind === "file") return createFileFirstSliceRepository(join(directory, "store.json"));
      if (kind === "sqlite") return createSqliteFirstSliceRepository(join(directory, "store.sqlite"));
      assert.ok(process.env.FIRST_SLICE_POSTGRES_URL, "PostgreSQL reservation tests require the owned test database.");
      const storage = await createPostgresFirstSliceStorage(process.env.FIRST_SLICE_POSTGRES_URL);
      connections.push(storage);
      return storage.repository;
    };
    const repository = await create();
    try {
      await repository.saveParticipantSession(session);
      await t.test("simultaneous candidates for one assignment select exactly one winner", async () => {
        const other = kind === "sqlite" || kind === "postgres" ? await create() : repository;
        const attempts = Array.from({ length: 24 }, (_, index) => (index % 2 ? repository : other)
          .getOrCreateTestRunForAssignment(candidate("BOOKLET#level:advanced")));
        const results = await Promise.all(attempts);
        assert.equal(results.filter(result => result.created).length, 1);
        assert.equal(new Set(results.map(result => result.testRun.testRunId)).size, 1);
        assert.equal((await repository.listTestRunsByParticipantSessionId(key)).length, 1);
        const before = await repository.getTestRunById(results[0].testRun.testRunId);
        results[0].testRun.unitResponses.unit = "caller mutation cannot enter storage";
        assert.deepEqual(await repository.getTestRunById(before.testRunId), before);
      });
      await t.test("preset variants and other booklets reserve independent IDs", async () => {
        const beginner = await repository.getOrCreateTestRunForAssignment(candidate("BOOKLET#level:beginner"));
        const other = await repository.getOrCreateTestRunForAssignment({ ...candidate("OTHER"), bookletKey: "OTHER" });
        assert.equal(beginner.created, true);
        assert.equal(other.created, true);
        assert.notEqual(beginner.testRun.testRunId, other.testRun.testRunId);
        assert.equal((await repository.listTestRunsByParticipantSessionId(key)).length, 3);
      });
      await t.test("completed, locked, monitor-paused runs keep all their existing data", async () => {
        for (const [status, pauseSource, locked] of [["completed", undefined, false], ["paused", "monitor", false], ["paused", "participant", true]]) {
          const input = candidate(`BOOKLET#level:${status}-${pauseSource ?? "none"}-${locked}`);
          const preserved = { ...input, status, pauseSource, locked, completedAt: status === "completed" ? timestamp : null,
            unitResponses: { unit: "old bytes: ä 漢字\n  " }, currentUnitKey: "old-unit",
            testletTimers: { block: { status: "interrupted", remainingSeconds: 19 } }, lockedUnitKeys: ["old-unit"] };
          await repository.saveTestRun(preserved);
          const result = await repository.getOrCreateTestRunForAssignment({ ...input, testRunId: randomUUID(), unitResponses: {} });
          assert.equal(result.created, false);
          assert.deepEqual(result.testRun, await repository.getTestRunById(preserved.testRunId));
          assert.equal(result.testRun.testRunId, preserved.testRunId);
          assert.deepEqual(result.testRun.unitResponses, preserved.unitResponses);
          assert.deepEqual(result.testRun.testletTimers, preserved.testletTimers);
          assert.deepEqual(result.testRun.lockedUnitKeys, preserved.lockedUnitKeys);
          assert.equal(result.testRun.status, status);
          assert.equal(result.testRun.locked, locked);
        }
      });
      await t.test("legacy source-booklet identity remains distinct from preset variants", async () => {
        const legacy = candidate("BOOKLET");
        delete legacy.bookletAssignmentKey;
        await repository.saveTestRun(legacy);
        const result = await repository.getOrCreateTestRunForAssignment(candidate("BOOKLET"));
        assert.equal(result.created, false);
        assert.equal(result.testRun.testRunId, legacy.testRunId);
      });
      await t.test("same assignment in another session does not acquire the first session's run", async () => {
        await repository.saveParticipantSession({ ...session, participantSessionId: `${key}-other` });
        const result = await repository.getOrCreateTestRunForAssignment({ ...candidate("BOOKLET#level:advanced"), participantSessionId: `${key}-other` });
        assert.equal(result.created, true);
        assert.equal(result.testRun.participantSessionId, `${key}-other`);
        assert.equal((await repository.listTestRunsByParticipantSessionId(`${key}-other`)).length, 1);
      });
      await t.test("invalid scope rolls back without inserting or changing any run", async () => {
        const before = await repository.listTestRunsByParticipantSessionId(key);
        for (const change of [{ participantSessionId: "missing" }, { tenantId: "foreign" }, { workspaceId: "foreign" }, { contentReleaseId: "foreign" }]) {
          await assert.rejects(repository.getOrCreateTestRunForAssignment({ ...candidate("UNCREATED"), ...change }), /participant session scope/i);
        }
        assert.deepEqual(await repository.listTestRunsByParticipantSessionId(key), before);
        const retry = await repository.getOrCreateTestRunForAssignment(candidate("UNCREATED"));
        assert.equal(retry.created, true, "A failed reservation cannot strand a transaction/lock.");
      });
      await t.test("an existing Run ID cannot overwrite another assignment or session", async () => {
        const before = structuredClone(await repository.listTestRunsByParticipantSessionId(key));
        const otherSessionRuns = await repository.listTestRunsByParticipantSessionId(`${key}-other`);
        for (const id of [before[0].testRunId, otherSessionRuns[0].testRunId]) {
          await assert.rejects(repository.getOrCreateTestRunForAssignment(candidate("COLLIDING-ASSIGNMENT", id)), /Run ID already exists/);
        }
        assert.deepEqual(await repository.listTestRunsByParticipantSessionId(key), before);
        assert.deepEqual(await repository.listTestRunsByParticipantSessionId(`${key}-other`), otherSessionRuns);
      });
      await t.test("a concurrent cross-session ID collision has one winner and never resets that winner", async () => {
        const other = kind === "sqlite" || kind === "postgres" ? await create() : repository;
        const id = randomUUID();
        const results = await Promise.allSettled([
          repository.getOrCreateTestRunForAssignment(candidate("COLLISION-RACE", id)),
          other.getOrCreateTestRunForAssignment({ ...candidate("COLLISION-RACE", id), participantSessionId: `${key}-other` })
        ]);
        assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
        const winner = results.find(result => result.status === "fulfilled").value;
        assert.equal(winner.created, true);
        assert.match(results.find(result => result.status === "rejected").reason.message, /Run ID already exists/);
        assert.deepEqual(await repository.getTestRunById(id), winner.testRun);
      });
      if (kind !== "memory") {
        await t.test("a fresh durable repository reuses the previously reserved identity", async () => {
          // File storage keeps its existing single-writer contract: reopen only
          // after all writes through the first repository have settled.
          const reopened = await create();
          const before = await repository.listTestRunsByParticipantSessionId(key);
          const result = await reopened.getOrCreateTestRunForAssignment(candidate("BOOKLET#level:advanced"));
          assert.equal(result.created, false);
          assert.equal(result.testRun.testRunId, before.find(run => run.bookletAssignmentKey === "BOOKLET#level:advanced").testRunId);
        });
      }
      if (kind === "sqlite") {
        await t.test("independent worker processes race through the same durable reservation", async () => {
          const attempts = Array.from({ length: 4 }, () => {
            const worker = new Worker(`
              const { parentPort, workerData } = require('node:worker_threads');
              import(workerData.module).then(async ({ createSqliteFirstSliceRepository }) => {
                const result = await createSqliteFirstSliceRepository(workerData.path)
                  .getOrCreateTestRunForAssignment(workerData.candidate);
                parentPort.postMessage(result);
              }).catch(error => { throw error; });
            `, { eval: true, workerData: {
              module: new URL('../packages/sqlite-store/dist/packages/sqlite-store/src/index.js', import.meta.url).href,
              path: join(directory, "store.sqlite"), candidate: candidate("WORKER-ASSIGNMENT")
            } });
            return new Promise((resolve, reject) => {
              let result;
              worker.once("message", value => { result = value; });
              worker.once("error", reject);
              worker.once("exit", code => code === 0 && result ? resolve(result) : reject(new Error(`Reservation worker exited ${code}`)));
            });
          });
          const results = await Promise.all(attempts);
          assert.equal(results.filter(result => result.created).length, 1);
          assert.equal(new Set(results.map(result => result.testRun.testRunId)).size, 1);
        });
      }
    } finally {
      for (const storage of connections) await storage.shutdown();
      // Every path is an owned mkdtemp fixture, never the user's tryout data.
      await rm(directory, { recursive: true, force: true });
    }
  });
}
