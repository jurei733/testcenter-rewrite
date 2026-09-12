import assert from "node:assert/strict";
import test from "node:test";

import type { ContentRelease, TestRun } from "@testcenter-rewrite-app/domain";

import { resolveOpenMonitorBookletError } from "./index.js";

const healthyRelease: ContentRelease = {
  contentReleaseId: "release-1",
  tenantId: "tenant-1",
  workspaceId: "workspace-1",
  importJobId: "import-1",
  releaseLabel: "Release 1",
  runtimeSnapshot: {
    bookletEntries: [
      {
        bookletKey: "booklet-1",
        displayLabel: "Booklet 1",
        unitEntries: [
          {
            unitKey: "unit-1",
            displayLabel: "Unit 1"
          }
        ]
      }
    ]
  },
  status: "active",
  createdAt: "2026-08-09T10:00:00.000Z",
  activatedAt: "2026-08-09T10:00:00.000Z"
};

const healthyRun: TestRun = {
  testRunId: "run-1",
  participantSessionId: "session-1",
  tenantId: "tenant-1",
  workspaceId: "workspace-1",
  contentReleaseId: "release-1",
  bookletKey: "booklet-1",
  status: "running",
  currentUnitKey: "unit-1",
  unitResponses: {},
  createdAt: "2026-08-09T10:00:00.000Z",
  updatedAt: "2026-08-09T10:00:00.000Z",
  completedAt: null
};

test("monitor booklet errors preserve the original four failure classes", () => {
  assert.equal(resolveOpenMonitorBookletError(healthyRelease, healthyRun), null);
  assert.equal(
    resolveOpenMonitorBookletError(healthyRelease, {
      ...healthyRun,
      bookletKey: ""
    }),
    "missing-id"
  );
  assert.equal(
    resolveOpenMonitorBookletError(healthyRelease, {
      ...healthyRun,
      bookletKey: "missing-booklet"
    }),
    "missing-file"
  );
  assert.equal(resolveOpenMonitorBookletError(null, healthyRun), "general");

  const malformedBookletRelease = {
    ...healthyRelease,
    runtimeSnapshot: {
      bookletEntries: [
        {
          bookletKey: "booklet-1",
          displayLabel: "Booklet 1",
          unitEntries: "not-an-array"
        }
      ]
    }
  } as unknown as ContentRelease;
  assert.equal(
    resolveOpenMonitorBookletError(malformedBookletRelease, healthyRun),
    "xml"
  );

  const malformedSnapshotRelease = {
    ...healthyRelease,
    runtimeSnapshot: null
  } as unknown as ContentRelease;
  assert.equal(
    resolveOpenMonitorBookletError(malformedSnapshotRelease, healthyRun),
    "general"
  );
});
