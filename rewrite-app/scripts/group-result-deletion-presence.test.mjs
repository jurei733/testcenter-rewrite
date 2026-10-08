import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createFirstSliceServices, PARTICIPANT_PRESENCE_LEASE_MS as lease } from "@testcenter-rewrite-app/application";
import { createInMemoryFirstSliceRepository } from "@testcenter-rewrite-app/memory-store";
import { createFileFirstSliceRepository } from "@testcenter-rewrite-app/file-store";
import { createSqliteFirstSliceRepository } from "@testcenter-rewrite-app/sqlite-store";
import { createPostgresFirstSliceStorage } from "@testcenter-rewrite-app/postgres-store";

const kinds = ["memory", "file", "sqlite"];
if (process.env.FIRST_SLICE_STORE === "postgres") {
  assert.ok(process.env.FIRST_SLICE_POSTGRES_URL, "PostgreSQL deletion proof requires the configured test database.");
  kinds.push("postgres");
}
const connectionId = "11111111-1111-4111-8111-111111111111";
const boundaries = [
  { method: "deleteTestRunsByIds", when: "before", expectedLogs: 2 },
  { method: "deleteParticipantTestLogsByTestRunIds", when: "after", expectedLogs: 1 },
  { method: "deleteTestRunsByIds", when: "after", expectedLogs: 1 }
];

for (const kind of kinds) {
  for (const boundary of boundaries) {
    test(`${kind}: group deletion fences presence ${boundary.when} ${boundary.method}`, async () => {
      const directory = await mkdtemp(join(tmpdir(), "testcenter-group-delete-presence-"));
      let storage;
      const repository = kind === "memory" ? createInMemoryFirstSliceRepository()
        : kind === "file" ? createFileFirstSliceRepository(join(directory, "owned.json"))
        : kind === "sqlite" ? createSqliteFirstSliceRepository(join(directory, "owned.sqlite"))
        : (storage = await createPostgresFirstSliceStorage(process.env.FIRST_SLICE_POSTGRES_URL)).repository;
      let timestamp = Date.parse("2026-10-08T00:00:00.000Z");
      const services = createFirstSliceServices({ repository,
        now: () => new Date(timestamp).toISOString(), xmlSchemaProfile: "legacy-compatibility" });
      const scope = { tenantKey: `delete-presence-${randomUUID()}`, workspaceKey: "owned" };
      const runIds = [];
      const reviewIds = [];
      let restore;
      try {
        const tenant = await services.platform.createTenant({ tenantKey: scope.tenantKey, displayName: "Owned deletion regression" });
        const workspace = await services.platform.createWorkspace({ ...scope, displayName: "Owned deletion regression" });
        const createdAt = new Date(timestamp).toISOString();
        const base = { tenantId: tenant.tenantId, workspaceId: workspace.workspaceId, contentReleaseId: "owned-release", createdAt };
        const sessions = {};
        const runs = {};
        for (const groupKey of ["selected", "retained"]) {
          const id = randomUUID();
          const session = { ...base, participantSessionId: id, loginKey: groupKey, groupKey, status: "launched" };
          const run = { ...base, testRunId: id, participantSessionId: id, bookletKey: "owned-booklet",
            status: "running", executionMode: "run-hot-return", currentUnitKey: "unit", testletTimers: {},
            unitResponses: { unit: `Exact unchanged answer ${groupKey}: Ä/β\n";` }, updatedAt: createdAt, completedAt: null };
          sessions[groupKey] = session;
          runs[groupKey] = run;
          runIds.push(id);
          await repository.saveParticipantSession(session);
          await repository.saveTestRun(run);
          const reviewId = randomUUID();
          reviewIds.push(reviewId);
          await repository.saveWorkspaceReview({ reviewId, tenantId: tenant.tenantId, workspaceId: workspace.workspaceId,
            participantSessionId: id, testRunId: id, unitKey: "unit", originalUnitId: "unit", page: null,
            pageLabel: null, userAgent: null, reviewerId: "owned", category: "owned", categories: ["owned"],
            priority: 1, comment: `Exact ${groupKey} review Ä/β`, createdAt, updatedAt: createdAt });
        }
        const selectedId = runs.selected.testRunId;
        const emptyId = randomUUID();
        runIds.push(emptyId);
        await repository.saveTestRun({ ...runs.selected, testRunId: emptyId, status: "completed", unitResponses: {}, completedAt: createdAt });
        const selectedConnection = { participantSessionId: sessions.selected.participantSessionId, testRunId: selectedId, connectionId };
        assert.equal(await services.participantRuntime.updateConnection({ ...selectedConnection, action: "open" }), true);
        assert.equal(await services.participantRuntime.updateConnection({ ...selectedConnection, action: "acknowledge" }), true);
        await services.participantRuntime.updateConnection({ participantSessionId: sessions.retained.participantSessionId,
          testRunId: runs.retained.testRunId, action: "poll" });
        // This job could already have read the lease before the DELETE starts.
        const pendingExpiry = (await repository.listExpiredParticipantPresence(timestamp + lease, 10))
          .find(item => item.testRunId === selectedId);
        assert.ok(pendingExpiry);
        const logs = () => repository.listParticipantTestLogsByWorkspace(tenant.tenantId, workspace.workspaceId);
        const reviews = () => repository.listWorkspaceReviewsByWorkspace(tenant.tenantId, workspace.workspaceId);
        const retained = {
          run: await repository.getTestRunById(runs.retained.testRunId),
          session: await repository.getParticipantSessionById(sessions.retained.participantSessionId),
          logs: (await logs()).filter(item => item.testRunId === runs.retained.testRunId),
          reviews: (await reviews()).filter(item => item.testRunId === runs.retained.testRunId)
        };
        let interleavings = 0;
        const expire = async () => {
          interleavings++;
          timestamp += lease;
          await services.participantRuntime.expireConnections();
          // Replay the previously captured work item, not only a fresh sweep.
          await repository.updateParticipantPresence({ ...pendingExpiry, action: "expire", timestamp });
        };
        const original = repository[boundary.method].bind(repository);
        restore = () => { repository[boundary.method] = original; };
        repository[boundary.method] = async ids => {
          assert.deepEqual([...ids].sort(), [selectedId, emptyId].sort(), "Only the chosen group's exact Runs may be deleted.");
          if (boundary.when === "before") await expire();
          const count = await original(ids);
          if (boundary.when === "after") await expire();
          return count;
        };
        const deletion = await services.workspaceResults.deleteGroupResultsBulk({ ...scope,
          groupKeys: ["selected"], confirmation: scope.workspaceKey });
        assert.equal(interleavings, 1, "Exercise the real selected repository boundary exactly once.");
        assert.deepEqual([...deletion.deletedTestRunIds].sort(), [selectedId, emptyId].sort());
        assert.equal(deletion.deletedTestRunCount, 2);
        assert.equal(deletion.deletedResponseCount, 1);
        assert.equal(deletion.deletedReviewCount, 1);
        assert.equal(deletion.deletedTestLogCount, boundary.expectedLogs, "Report all logs actually removed, including a transition before parent deletion.");
        assert.equal(await repository.getTestRunById(selectedId), null);
        assert.equal(await repository.getTestRunById(emptyId), null);
        // Raw storage is essential: report joins can conceal orphan log rows.
        assert.deepEqual((await logs()).filter(item => item.testRunId === selectedId || item.testRunId === emptyId), [],
          "Concurrent presence must not leave raw CONNECTION rows behind deleted Runs.");
        assert.deepEqual((await reviews()).filter(item => item.testRunId === selectedId || item.testRunId === emptyId), []);
        assert.deepEqual(await repository.listExpiredParticipantPresence(timestamp + lease * 100, 10), []);
        assert.equal((await repository.updateParticipantPresence({ ...pendingExpiry, action: "expire", timestamp: timestamp + lease })).accepted, false);
        assert.deepEqual({
          run: await repository.getTestRunById(runs.retained.testRunId),
          session: await repository.getParticipantSessionById(sessions.retained.participantSessionId),
          logs: (await logs()).filter(item => item.testRunId === runs.retained.testRunId),
          reviews: (await reviews()).filter(item => item.testRunId === runs.retained.testRunId)
        }, retained, "Another group's exact answer, Run, identity, review and log must survive unchanged.");
      } finally {
        restore?.();
        await repository.deleteTestRunsByIds(runIds);
        await repository.deleteParticipantTestLogsByTestRunIds(runIds);
        for (const reviewId of reviewIds) await repository.deleteWorkspaceReview(reviewId);
        await storage?.shutdown();
        await rm(directory, { recursive: true, force: true });
      }
    });
  }
}
