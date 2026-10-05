import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createInMemoryFirstSliceRepository } from "@testcenter-rewrite-app/memory-store";
import { createFileFirstSliceRepository } from "@testcenter-rewrite-app/file-store";
import { createSqliteFirstSliceRepository } from "@testcenter-rewrite-app/sqlite-store";
import { createPostgresFirstSliceStorage } from "@testcenter-rewrite-app/postgres-store";
import { createFirstSliceServices, PARTICIPANT_PRESENCE_LEASE_MS as lease } from "@testcenter-rewrite-app/application";

const timestamp = Date.parse("2026-10-04T00:00:00.000Z");
const first = "11111111-1111-4111-8111-111111111111";
const second = "22222222-2222-4222-8222-222222222222";
const never = "33333333-3333-4333-8333-333333333333";
const kinds = ["memory", "file", "sqlite"];
if (process.env.FIRST_SLICE_STORE === "postgres") {
  assert.ok(process.env.FIRST_SLICE_POSTGRES_URL, "PostgreSQL presence proof requires the configured test database.");
  kinds.push("postgres");
}

for (const kind of kinds) {
  test(`${kind}: atomic participant presence survives reconnects without changing saved answers`, async t => {
    const directory = await mkdtemp(join(tmpdir(), "testcenter-presence-"));
    const key = `presence-${randomUUID()}`;
    const session = { participantSessionId: key, tenantId: key, workspaceId: key,
      contentReleaseId: key, loginKey: key, groupKey: key, status: "launched",
      createdAt: new Date(timestamp).toISOString() };
    const run = { testRunId: key, participantSessionId: key, tenantId: key, workspaceId: key,
      contentReleaseId: key, bookletKey: "booklet", status: "running", currentUnitKey: "unit",
      unitResponses: { unit: "protected saved answer" }, testletTimers: {},
      createdAt: session.createdAt, updatedAt: session.createdAt, completedAt: null };
    let storage;
    let replica;
    const create = async () => {
      if (kind === "memory") return createInMemoryFirstSliceRepository();
      if (kind === "file") return createFileFirstSliceRepository(join(directory, "store.json"));
      if (kind === "sqlite") return createSqliteFirstSliceRepository(join(directory, "store.sqlite"));
      storage = await createPostgresFirstSliceStorage(process.env.FIRST_SLICE_POSTGRES_URL);
      return storage.repository;
    };
    let repository = await create();
    const mutate = (action, connectionId, elapsed = 0, extra = {}) => repository.updateParticipantPresence({
      testRunId: key, participantSessionId: key, timestamp: timestamp + elapsed, action, connectionId, ...extra
    });
    const logs = () => repository.listParticipantTestLogsByWorkspace(key, key);
    try {
      await repository.saveParticipantSession(session);
      await repository.saveTestRun(run);
      // Registration alone cannot prove that a browser received an event.
      const application = createFirstSliceServices({ repository, now: () => session.createdAt,
        xmlSchemaProfile: "legacy-compatibility" });
      assert.equal(await application.participantRuntime.updateConnection({
        participantSessionId: key, testRunId: key, action: "open", connectionId: never
      }), true);
      assert.deepEqual(await repository.listExpiredParticipantPresence(timestamp + lease - 1, 1), []);
      assert.equal((await repository.listExpiredParticipantPresence(timestamp + lease, 1)).length, 1,
        "Business-event sequencing cannot shift the real 60-second deadline.");
      assert.equal((await mutate("expire", undefined, lease)).testLog, null);
      assert.equal((await logs()).length, 0);
      assert.equal((await mutate("acknowledge", never, lease)).accepted, false);
      await mutate("open", first, lease + 1);
      const live = await mutate("acknowledge", first, lease + 2);
      assert.equal(live.testLog.logContent, "WEBSOCKET");
      const previousLive = structuredClone(live);
      assert.equal((await mutate("acknowledge", first, lease + 3)).testLog, null);
      assert.deepEqual(live, previousLive, "Previously returned state cannot alias later mutable store state.");
      await mutate("open", second, lease + 4);
      await mutate("acknowledge", second, lease + 5);
      assert.equal((await mutate("close", first, lease + 6)).testLog, null);
      assert.equal((await mutate("close", first, lease + 7)).accepted, false);
      assert.equal((await mutate("acknowledge", never, lease + 8)).accepted, false);
      assert.equal((await mutate("poll", undefined, lease + 9)).presence.mode, "WEBSOCKET");
      assert.equal((await mutate("poll", undefined, lease + 9, { participantSessionId: "foreign" })).accepted, false);
      assert.equal((await mutate("expire", undefined, lease * 2 + 4)).testLog, null);

      if (kind !== "memory") {
        if (kind === "postgres") await storage.shutdown();
        repository = await create();
      }
      assert.deepEqual(await repository.listExpiredParticipantPresence(timestamp + lease * 2 + 5, 1),
        [{ testRunId: key, participantSessionId: key }], "Confirmed leases survive a fresh repository instance.");
      const lost = await mutate("expire", undefined, lease * 2 + 5);
      assert.equal(lost.testLog.logContent, "LOST");
      assert.equal(lost.testLog.originalTimestamp, 0);
      assert.equal((await mutate("expire", undefined, lease * 2 + 6)).testLog, null);
      assert.deepEqual(await repository.listExpiredParticipantPresence(timestamp + lease * 3, 1), []);
      const polling = await mutate("poll", undefined, lease * 2 + 7);
      assert.equal(polling.testLog.logContent, "POLLING");
      assert.equal(polling.testLog.originalTimestamp, 0);
      assert.equal((await mutate("poll", undefined, lease * 2 + 8)).testLog, null);
      await mutate("open", first, lease * 2 + 9);
      await mutate("acknowledge", first, lease * 2 + 10);
      assert.equal((await mutate("close", second, lease * 2 + 11)).accepted, false);
      assert.equal((await mutate("poll", undefined, lease * 2 + 12)).presence.mode, "WEBSOCKET");
      assert.deepEqual((await logs()).sort((left, right) => left.timestamp - right.timestamp)
        .map(log => log.logContent), ["WEBSOCKET", "LOST", "POLLING", "WEBSOCKET"]);
      const persisted = await repository.getTestRunById(key);
      assert.deepEqual((await logs()).filter(log => log.originalTimestamp === 0).map(log => log.logContent).sort(),
        ["LOST", "POLLING"], "Original client epoch zero must survive the durable store.");
      assert.deepEqual(persisted.unitResponses, run.unitResponses);
      assert.equal(persisted.status, run.status);
      assert.equal(persisted.updatedAt, run.updatedAt);
      assert.deepEqual(persisted.testletTimers, run.testletTimers);

      await t.test("closed and completed runs cannot receive new connection logs", async () => {
        const before = (await logs()).length;
        await repository.saveTestRun({ ...persisted, status: "completed" });
        assert.deepEqual((await mutate("close", first, lease * 2 + 13)).presence.connections, {});
        assert.equal((await mutate("open", second, lease * 2 + 14)).accepted, false);
        await repository.saveTestRun(persisted);
        await repository.saveParticipantSession({ ...session, status: "closed" });
        assert.equal((await mutate("open", first, lease * 2 + 15)).accepted, false);
        assert.equal((await logs()).length, before);
        await repository.saveParticipantSession(session);
      });
      await t.test("silent expiry never beats another live connection and transitions once", async () => {
        await mutate("open", first, lease * 3);
        await mutate("acknowledge", first, lease * 3 + 1);
        await mutate("open", second, lease * 3 + 2);
        await mutate("acknowledge", second, lease * 3 + 3);
        await mutate("acknowledge", second, lease * 4);
        assert.equal((await mutate("expire", undefined, lease * 4 + 1)).testLog, null);
        assert.equal((await mutate("close", first, lease * 4 + 2)).accepted, false);
        if (kind === "sqlite") replica = { repository: await create() };
        if (kind === "postgres") replica = await createPostgresFirstSliceStorage(process.env.FIRST_SLICE_POSTGRES_URL);
        const other = replica?.repository ?? repository;
        const input = { testRunId: key, participantSessionId: key, action: "expire", timestamp: timestamp + lease * 5 };
        const results = await Promise.all([repository.updateParticipantPresence(input), other.updateParticipantPresence(input)]);
        assert.equal(results.filter(result => result.testLog?.logContent === "LOST").length, 1);
      });
      await t.test("retained future client history cannot hide the server transition", async () => {
        await repository.saveParticipantTestLogs([{ participantTestLogId: `${key}-legacy`,
          tenantId: key, workspaceId: key, participantSessionId: key, testRunId: key,
          unitKey: null, originalUnitId: null, logKey: "CONNECTION", logContent: "POLLING",
          timestamp: timestamp + lease * 100, recordedAt: session.createdAt }]);
        await mutate("open", first, lease * 5 + 1);
        const restored = await mutate("acknowledge", first, lease * 5 + 2);
        assert.ok(restored.testLog.timestamp > timestamp + lease * 100);
        const states = await repository.listLatestParticipantTestStateLogsByWorkspace(key, key, ["CONNECTION"]);
        assert.equal(states[0].logContent, "WEBSOCKET");
        await repository.deleteTestRunsByIds([key]);
        assert.deepEqual(await repository.listExpiredParticipantPresence(timestamp + lease * 1000, 10), []);
        assert.equal((await mutate("acknowledge", first, lease * 5 + 3)).accepted, false);
      });
    } finally {
      await repository.deleteParticipantTestLogsByTestRunIds([key]);
      await repository.deleteTestRunsByIds([key]);
      await replica?.shutdown?.();
      await storage?.shutdown();
      await rm(directory, { recursive: true, force: true });
    }
  });
}
