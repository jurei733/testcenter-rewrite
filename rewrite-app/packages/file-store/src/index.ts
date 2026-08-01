import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { FirstSliceRepository } from "@testcenter-rewrite-app/application";
import type {
  AdminAuditEvent,
  AdminRoleAssignment,
  AdminSession,
  AdminUser,
  ContentRelease,
  ImportJob,
  ParticipantLoginAttempt,
  ParticipantRosterEntry,
  ParticipantSession,
  SourcePackage,
  Tenant,
  TestRun,
  WorkspaceActivityEvent,
  WorkspaceReview,
  Workspace
} from "@testcenter-rewrite-app/domain";

type PersistedFirstSliceState = {
  adminUsers: Record<string, AdminUser>;
  adminRoleAssignments: Record<string, AdminRoleAssignment>;
  adminAuditEvents: Record<string, AdminAuditEvent>;
  adminSessions: Record<string, AdminSession>;
  tenants: Record<string, Tenant>;
  workspacesByScope: Record<string, Workspace>;
  workspacesByKey: Record<string, Workspace>;
  workspaceActivityEvents: Record<string, WorkspaceActivityEvent>;
  workspaceReviews: Record<string, WorkspaceReview>;
  sourcePackages: Record<string, SourcePackage>;
  importJobs: Record<string, ImportJob>;
  contentReleases: Record<string, ContentRelease>;
  participantSessions: Record<string, ParticipantSession>;
  participantRosterEntries: Record<string, ParticipantRosterEntry>;
  participantRosterPasswordHashes: Record<string, string>;
  participantLoginAttempts: Record<string, ParticipantLoginAttempt>;
  testRuns: Record<string, TestRun>;
};

const createInitialState = (): PersistedFirstSliceState => ({
  adminUsers: {},
  adminRoleAssignments: {},
  adminAuditEvents: {},
  adminSessions: {},
  tenants: {},
  workspacesByScope: {},
  workspacesByKey: {},
  workspaceActivityEvents: {},
  workspaceReviews: {},
  sourcePackages: {},
  importJobs: {},
  contentReleases: {},
  participantSessions: {},
  participantRosterEntries: {},
  participantRosterPasswordHashes: {},
  participantLoginAttempts: {},
  testRuns: {}
});

const workspaceScopeKey = (tenantKey: string, workspaceKey: string): string =>
  `${tenantKey}::${workspaceKey}`;

const participantRosterPasswordKey = (
  tenantId: string,
  workspaceId: string,
  loginKey: string
): string => `${tenantId}::${workspaceId}::${loginKey}`;

const participantLoginAttemptKey = participantRosterPasswordKey;

const readStateFromFile = async (
  filePath: string
): Promise<PersistedFirstSliceState> => {
  try {
    const raw = await readFile(filePath, "utf8");
    const state = {
      ...createInitialState(),
      ...(JSON.parse(raw) as Partial<PersistedFirstSliceState>)
    };
    state.participantRosterEntries = Object.fromEntries(
      Object.entries(state.participantRosterEntries).map(([entryId, entry]) => [
        entryId,
        {
          ...entry,
          bookletKey:
            entry.bookletKey ??
            (Array.isArray(entry.bookletKeys) &&
            typeof entry.bookletKeys[0] === "string"
              ? entry.bookletKeys[0]
              : null),
          ...(Array.isArray(entry.bookletKeys) && entry.bookletKeys.length > 1
            ? {
                bookletKeys: [
                  ...new Set(
                    entry.bookletKeys.filter(
                      (bookletKey): bookletKey is string =>
                        typeof bookletKey === "string" && Boolean(bookletKey.trim())
                    )
                  )
                ]
              }
            : { bookletKeys: undefined }),
          passwordRequired:
            typeof entry.passwordRequired === "boolean"
              ? entry.passwordRequired
              : Boolean(
                  state.participantRosterPasswordHashes[
                    participantRosterPasswordKey(
                      entry.tenantId,
                      entry.workspaceId,
                      entry.loginKey
                    )
                  ]
                )
        }
      ])
    );
    return state;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return createInitialState();
    }

    throw error;
  }
};

export const checkFileFirstSliceReadiness = async (
  filePath: string
): Promise<void> => {
  await mkdir(dirname(filePath), { recursive: true });

  try {
    await readFile(filePath, "utf8");
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return;
    }

    throw error;
  }
};

export const createFileFirstSliceRepository = (
  filePath: string
): FirstSliceRepository => {
  let cachePromise: Promise<PersistedFirstSliceState> | null = null;
  let writeQueue = Promise.resolve();

  const getState = async (): Promise<PersistedFirstSliceState> => {
    cachePromise ??= readStateFromFile(filePath);
    return cachePromise;
  };

  const persistState = async (state: PersistedFirstSliceState): Promise<void> => {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(state, null, 2), "utf8");
  };

  const mutate = async <Result>(
    updater: (state: PersistedFirstSliceState) => Result
  ): Promise<Result> => {
    const state = await getState();
    const result = updater(state);
    writeQueue = writeQueue.then(() => persistState(state));
    await writeQueue;
    return result;
  };

  return {
    async listAdminUsers() {
      const state = await getState();
      return Object.values(state.adminUsers);
    },
    async getAdminUserById(adminUserId) {
      const state = await getState();
      return state.adminUsers[adminUserId] ?? null;
    },
    async getAdminUserByUsername(username) {
      const state = await getState();
      return (
        Object.values(state.adminUsers).find(
          adminUser => adminUser.username === username
        ) ?? null
      );
    },
    async saveAdminUser(adminUser) {
      await mutate(state => {
        state.adminUsers[adminUser.adminUserId] = adminUser;
      });
    },
    async listAdminRoleAssignmentsByUserId(adminUserId) {
      const state = await getState();
      return Object.values(state.adminRoleAssignments).filter(
        roleAssignment => roleAssignment.adminUserId === adminUserId
      );
    },
    async saveAdminRoleAssignment(roleAssignment) {
      await mutate(state => {
        state.adminRoleAssignments[roleAssignment.roleAssignmentId] = roleAssignment;
      });
    },
    async deleteAdminRoleAssignment(roleAssignmentId) {
      await mutate(state => {
        delete state.adminRoleAssignments[roleAssignmentId];
      });
    },
    async listAdminAuditEvents() {
      const state = await getState();
      return Object.values(state.adminAuditEvents);
    },
    async saveAdminAuditEvent(auditEvent) {
      await mutate(state => {
        state.adminAuditEvents[auditEvent.adminAuditEventId] = auditEvent;
      });
    },
    async listAdminSessions() {
      const state = await getState();
      return Object.values(state.adminSessions);
    },
    async getAdminSessionByToken(token) {
      const state = await getState();
      return (
        Object.values(state.adminSessions).find(
          adminSession => adminSession.token === token
        ) ?? null
      );
    },
    async saveAdminSession(adminSession) {
      await mutate(state => {
        state.adminSessions[adminSession.adminSessionId] = adminSession;
      });
    },
    async getTenantByKey(tenantKey) {
      const state = await getState();
      return state.tenants[tenantKey] ?? null;
    },
    async listTenants() {
      const state = await getState();
      return Object.values(state.tenants);
    },
    async saveTenant(tenant) {
      await mutate(state => {
        state.tenants[tenant.tenantKey] = tenant;
      });
    },
    async getWorkspaceByScope(tenantKey, workspaceKey) {
      const state = await getState();
      return state.workspacesByScope[workspaceScopeKey(tenantKey, workspaceKey)] ?? null;
    },
    async getWorkspaceByWorkspaceKey(workspaceKey) {
      const state = await getState();
      return state.workspacesByKey[workspaceKey] ?? null;
    },
    async listWorkspacesByTenantId(tenantId) {
      const state = await getState();
      return Object.values(state.workspacesByScope).filter(
        workspace => workspace.tenantId === tenantId
      );
    },
    async saveWorkspace(scope) {
      await mutate(state => {
        state.workspacesByScope[
          workspaceScopeKey(scope.tenantKey, scope.workspaceKey)
        ] = scope.workspace;
        state.workspacesByKey[scope.workspace.workspaceKey] = scope.workspace;
      });
    },
    async listWorkspaceActivityEventsByWorkspace(tenantId, workspaceId) {
      const state = await getState();
      return Object.values(state.workspaceActivityEvents).filter(
        activityEvent =>
          activityEvent.tenantId === tenantId &&
          activityEvent.workspaceId === workspaceId
      );
    },
    async saveWorkspaceActivityEvent(activityEvent) {
      await mutate(state => {
        state.workspaceActivityEvents[activityEvent.activityEventId] = activityEvent;
      });
    },
    async getSourcePackageById(sourcePackageId) {
      const state = await getState();
      return state.sourcePackages[sourcePackageId] ?? null;
    },
    async listSourcePackagesByWorkspace(tenantId, workspaceId) {
      const state = await getState();
      return Object.values(state.sourcePackages).filter(
        sourcePackage =>
          sourcePackage.tenantId === tenantId &&
          sourcePackage.workspaceId === workspaceId
      );
    },
    async saveSourcePackage(sourcePackage) {
      await mutate(state => {
        state.sourcePackages[sourcePackage.sourcePackageId] = sourcePackage;
      });
    },
    async deleteSourcePackageAggregate(input) {
      return mutate(state => {
        const sourcePackage = state.sourcePackages[input.sourcePackageId];
        if (
          !sourcePackage ||
          sourcePackage.tenantId !== input.tenantId ||
          sourcePackage.workspaceId !== input.workspaceId
        ) {
          return false;
        }
        const importJobs = Object.values(state.importJobs).filter(
          importJob =>
            importJob.tenantId === input.tenantId &&
            importJob.workspaceId === input.workspaceId &&
            importJob.sourcePackageId === input.sourcePackageId
        );
        const importJobIds = new Set(importJobs.map(importJob => importJob.importJobId));
        const contentReleases = Object.values(state.contentReleases).filter(
          contentRelease =>
            contentRelease.tenantId === input.tenantId &&
            contentRelease.workspaceId === input.workspaceId &&
            importJobIds.has(contentRelease.importJobId)
        );
        const contentReleaseIds = new Set(
          contentReleases.map(contentRelease => contentRelease.contentReleaseId)
        );
        const idsMatch = (actual: string[], expected: string[]): boolean =>
          JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());
        const isBlocked =
          importJobs.some(
            importJob => importJob.status === "queued" || importJob.status === "running"
          ) ||
          contentReleases.some(contentRelease => contentRelease.status === "active") ||
          Object.values(state.participantSessions).some(participantSession =>
            contentReleaseIds.has(participantSession.contentReleaseId)
          ) ||
          Object.values(state.testRuns).some(testRun =>
            contentReleaseIds.has(testRun.contentReleaseId)
          );
        if (
          isBlocked ||
          !idsMatch([...importJobIds], input.expectedImportJobIds) ||
          !idsMatch([...contentReleaseIds], input.expectedContentReleaseIds)
        ) {
          return false;
        }

        for (const contentReleaseId of contentReleaseIds) {
          delete state.contentReleases[contentReleaseId];
        }
        for (const importJobId of importJobIds) {
          delete state.importJobs[importJobId];
        }
        delete state.sourcePackages[input.sourcePackageId];
        return true;
      });
    },
    async getImportJobById(importJobId) {
      const state = await getState();
      return state.importJobs[importJobId] ?? null;
    },
    async listImportJobsByWorkspace(tenantId, workspaceId) {
      const state = await getState();
      return Object.values(state.importJobs).filter(
        importJob => importJob.tenantId === tenantId && importJob.workspaceId === workspaceId
      );
    },
    async saveImportJob(importJob) {
      await mutate(state => {
        state.importJobs[importJob.importJobId] = importJob;
      });
    },
    async getContentReleaseById(contentReleaseId) {
      const state = await getState();
      return state.contentReleases[contentReleaseId] ?? null;
    },
    async listContentReleasesByWorkspace(tenantId, workspaceId) {
      const state = await getState();
      return Object.values(state.contentReleases).filter(
        contentRelease =>
          contentRelease.tenantId === tenantId &&
          contentRelease.workspaceId === workspaceId
      );
    },
    async saveContentRelease(contentRelease) {
      await mutate(state => {
        state.contentReleases[contentRelease.contentReleaseId] = contentRelease;
      });
    },
    async getParticipantSessionById(participantSessionId) {
      const state = await getState();
      return state.participantSessions[participantSessionId] ?? null;
    },
    async listParticipantSessionsByWorkspace(tenantId, workspaceId) {
      const state = await getState();
      return Object.values(state.participantSessions).filter(
        participantSession =>
          participantSession.tenantId === tenantId &&
          participantSession.workspaceId === workspaceId
      );
    },
    async saveParticipantSession(participantSession) {
      await mutate(state => {
        state.participantSessions[participantSession.participantSessionId] =
          participantSession;
      });
    },
    async listParticipantRosterEntriesByWorkspace(tenantId, workspaceId) {
      const state = await getState();
      return Object.values(state.participantRosterEntries).filter(
        entry => entry.tenantId === tenantId && entry.workspaceId === workspaceId
      );
    },
    async getParticipantRosterPasswordHash(tenantId, workspaceId, loginKey) {
      const state = await getState();
      return (
        state.participantRosterPasswordHashes[
          participantRosterPasswordKey(tenantId, workspaceId, loginKey)
        ] ?? null
      );
    },
    async saveParticipantRosterEntry(participantRosterEntry, passwordHash) {
      await mutate(state => {
        state.participantRosterEntries[
          participantRosterEntry.participantRosterEntryId
        ] = participantRosterEntry;
        const passwordKey = participantRosterPasswordKey(
          participantRosterEntry.tenantId,
          participantRosterEntry.workspaceId,
          participantRosterEntry.loginKey
        );
        if (passwordHash) {
          state.participantRosterPasswordHashes[passwordKey] = passwordHash;
        } else {
          delete state.participantRosterPasswordHashes[passwordKey];
        }
      });
    },
    async getParticipantLoginAttempt(tenantId, workspaceId, loginKey) {
      const state = await getState();
      return (
        state.participantLoginAttempts[
          participantLoginAttemptKey(tenantId, workspaceId, loginKey)
        ] ?? null
      );
    },
    async recordParticipantLoginFailure(input) {
      let result: ParticipantLoginAttempt | null = null;
      await mutate(state => {
        const attemptKey = participantLoginAttemptKey(
          input.tenantId,
          input.workspaceId,
          input.loginKey
        );
        const current = state.participantLoginAttempts[attemptKey];
        result = {
          tenantId: input.tenantId,
          workspaceId: input.workspaceId,
          loginKey: input.loginKey,
          failedAttempts:
            !current || current.expiresAt <= input.attemptedAt
              ? 1
              : current.failedAttempts + 1,
          expiresAt: input.expiresAt,
          updatedAt: input.attemptedAt
        };
        state.participantLoginAttempts[attemptKey] = result;
      });
      if (!result) {
        throw new Error("Participant login failure could not be persisted.");
      }
      return result;
    },
    async getTestRunById(testRunId) {
      const state = await getState();
      return state.testRuns[testRunId] ?? null;
    },
    async listTestRunsByParticipantSessionId(participantSessionId) {
      const state = await getState();
      return Object.values(state.testRuns).filter(
        testRun => testRun.participantSessionId === participantSessionId
      );
    },
    async getOpenTestRunByParticipantSessionId(participantSessionId) {
      const state = await getState();
      return (
        Object.values(state.testRuns).find(
          testRun =>
            testRun.participantSessionId === participantSessionId &&
            testRun.status !== "completed"
        ) ?? null
      );
    },
    async listTestRunsByWorkspace(tenantId, workspaceId) {
      const state = await getState();
      return Object.values(state.testRuns).filter(
        testRun => testRun.tenantId === tenantId && testRun.workspaceId === workspaceId
      );
    },
    async saveTestRun(testRun) {
      await mutate(state => {
        state.testRuns[testRun.testRunId] = testRun;
      });
    },
    async deleteTestRunsByIds(testRunIds) {
      let deletedCount = 0;
      await mutate(state => {
        for (const testRunId of testRunIds) {
          if (state.testRuns[testRunId]) {
            delete state.testRuns[testRunId];
            deletedCount += 1;
          }
        }
      });
      return deletedCount;
    },
    async getWorkspaceReviewById(reviewId) {
      const state = await getState();
      return state.workspaceReviews[reviewId] ?? null;
    },
    async listWorkspaceReviewsByWorkspace(tenantId, workspaceId) {
      const state = await getState();
      return Object.values(state.workspaceReviews).filter(
        review => review.tenantId === tenantId && review.workspaceId === workspaceId
      );
    },
    async saveWorkspaceReview(review) {
      await mutate(state => {
        state.workspaceReviews[review.reviewId] = review;
      });
    },
    async deleteWorkspaceReview(reviewId) {
      let deleted = false;
      await mutate(state => {
        deleted = Boolean(state.workspaceReviews[reviewId]);
        delete state.workspaceReviews[reviewId];
      });
      return deleted;
    },
    async deleteWorkspaceReviewsByTestRunIds(testRunIds) {
      const testRunIdSet = new Set(testRunIds);
      let deletedCount = 0;
      await mutate(state => {
        for (const review of Object.values(state.workspaceReviews)) {
          if (testRunIdSet.has(review.testRunId)) {
            delete state.workspaceReviews[review.reviewId];
            deletedCount += 1;
          }
        }
      });
      return deletedCount;
    }
  };
};
