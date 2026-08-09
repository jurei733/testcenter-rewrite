import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { FirstSliceRepository } from "@testcenter-rewrite-app/application";
import { defaultApplicationSettings } from "@testcenter-rewrite-app/domain";
import type {
  AdminAuditEvent,
  AdminRoleAssignment,
  AdminSession,
  AdminUser,
  ApplicationSettings,
  AttachmentFile,
  ContentRelease,
  ImportJob,
  ParticipantLoginAttempt,
  ParticipantRosterEntry,
  ParticipantSession,
  ParticipantTestLog,
  SourcePackage,
  Tenant,
  TestRun,
  WorkspaceActivityEvent,
  WorkspaceReview,
  Workspace
} from "@testcenter-rewrite-app/domain";

type PersistedFirstSliceState = {
  applicationSettings: ApplicationSettings | null;
  attachmentFiles: Record<string, AttachmentFile>;
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
  participantTestLogs: Record<string, ParticipantTestLog>;
};

const createInitialState = (): PersistedFirstSliceState => ({
  applicationSettings: null,
  attachmentFiles: {},
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
  testRuns: {},
  participantTestLogs: {}
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
    if (state.applicationSettings) {
      state.applicationSettings = {
        ...defaultApplicationSettings,
        ...state.applicationSettings,
        introHtml:
          typeof state.applicationSettings.introHtml === "string"
            ? state.applicationSettings.introHtml
            : defaultApplicationSettings.introHtml,
        legalNoticeHtml:
          typeof state.applicationSettings.legalNoticeHtml === "string"
            ? state.applicationSettings.legalNoticeHtml
            : defaultApplicationSettings.legalNoticeHtml,
        globalWarningText: state.applicationSettings.globalWarningText ?? null,
        globalWarningExpiresAt:
          state.applicationSettings.globalWarningExpiresAt ?? null,
        updatedAt: state.applicationSettings.updatedAt ?? null,
        updatedByAdminUserId:
          state.applicationSettings.updatedByAdminUserId ?? null
      };
    }
    state.adminUsers = Object.fromEntries(
      Object.entries(state.adminUsers).map(([adminUserId, adminUser]) => [
        adminUserId,
        {
          ...adminUser,
          customTexts:
            adminUser.customTexts && typeof adminUser.customTexts === "object"
              ? adminUser.customTexts
              : {},
          validFrom: adminUser.validFrom ?? null,
          validTo: adminUser.validTo ?? null,
          validForMinutes: adminUser.validForMinutes ?? null,
          firstSignedInAt: adminUser.firstSignedInAt ?? null
        }
      ])
    );
    state.participantRosterEntries = Object.fromEntries(
      Object.entries(state.participantRosterEntries).map(([entryId, entry]) => [
        entryId,
        {
          ...entry,
          customTexts:
            entry.customTexts && typeof entry.customTexts === "object"
              ? entry.customTexts
              : {},
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
    async getApplicationSettings() {
      const state = await getState();
      return state.applicationSettings;
    },
    async saveApplicationSettings(settings) {
      await mutate(state => {
        state.applicationSettings = { ...settings };
      });
    },
    async listAttachmentFilesByWorkspace(tenantId, workspaceId) {
      const state = await getState();
      return Object.values(state.attachmentFiles).filter(
        attachmentFile =>
          attachmentFile.tenantId === tenantId &&
          attachmentFile.workspaceId === workspaceId
      );
    },
    async getAttachmentFileById(attachmentFileId) {
      const state = await getState();
      return state.attachmentFiles[attachmentFileId] ?? null;
    },
    async saveAttachmentFile(attachmentFile) {
      await mutate(state => {
        state.attachmentFiles[attachmentFile.attachmentFileId] = attachmentFile;
      });
    },
    async deleteAttachmentFile(attachmentFileId) {
      return mutate(state => {
        if (!state.attachmentFiles[attachmentFileId]) {
          return false;
        }
        delete state.attachmentFiles[attachmentFileId];
        return true;
      });
    },
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
    async deleteAdminUser(adminUserId) {
      return mutate(state => {
        delete state.adminUsers[adminUserId];
        let deletedRoleAssignmentCount = 0;
        for (const [roleAssignmentId, roleAssignment] of Object.entries(
          state.adminRoleAssignments
        )) {
          if (roleAssignment.adminUserId === adminUserId) {
            delete state.adminRoleAssignments[roleAssignmentId];
            deletedRoleAssignmentCount += 1;
          }
        }
        let deletedSessionCount = 0;
        for (const [adminSessionId, adminSession] of Object.entries(
          state.adminSessions
        )) {
          if (adminSession.adminUserId === adminUserId) {
            delete state.adminSessions[adminSessionId];
            deletedSessionCount += 1;
          }
        }
        return { deletedRoleAssignmentCount, deletedSessionCount };
      });
    },
    async listAdminRoleAssignmentsByUserId(adminUserId) {
      const state = await getState();
      return Object.values(state.adminRoleAssignments)
        .filter(roleAssignment => roleAssignment.adminUserId === adminUserId)
        .map(roleAssignment => ({
          ...roleAssignment,
          accessMode: roleAssignment.accessMode ?? "read_write",
          groupKey: roleAssignment.groupKey ?? null,
          monitorProfiles: Array.isArray(roleAssignment.monitorProfiles)
            ? roleAssignment.monitorProfiles
            : []
        }));
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
    async deleteWorkspaceAggregate(input) {
      return mutate(state => {
        const scopeKey = workspaceScopeKey(input.tenantKey, input.workspaceKey);
        const workspace = state.workspacesByScope[scopeKey];
        if (!workspace || workspace.workspaceId !== input.workspaceId) {
          return null;
        }
        const deleteMatching = <Value>(
          values: Record<string, Value>,
          matches: (value: Value) => boolean
        ): number => {
          let deletedCount = 0;
          for (const [key, value] of Object.entries(values)) {
            if (matches(value)) {
              delete values[key];
              deletedCount += 1;
            }
          }
          return deletedCount;
        };
        const workspaceMatches = (value: { tenantId: string; workspaceId: string }) =>
          value.tenantId === input.tenantId && value.workspaceId === input.workspaceId;
        const counts = {
          deletedWorkspaceCount: 1,
          deletedAdminRoleAssignmentCount: deleteMatching(
            state.adminRoleAssignments,
            value => value.workspaceId === input.workspaceId
          ),
          deletedAttachmentFileCount: deleteMatching(state.attachmentFiles, workspaceMatches),
          deletedActivityEventCount: deleteMatching(
            state.workspaceActivityEvents,
            workspaceMatches
          ),
          deletedReviewCount: deleteMatching(state.workspaceReviews, workspaceMatches),
          deletedSourcePackageCount: deleteMatching(state.sourcePackages, workspaceMatches),
          deletedImportJobCount: deleteMatching(state.importJobs, workspaceMatches),
          deletedContentReleaseCount: deleteMatching(state.contentReleases, workspaceMatches),
          deletedParticipantSessionCount: deleteMatching(
            state.participantSessions,
            workspaceMatches
          ),
          deletedRosterEntryCount: deleteMatching(
            state.participantRosterEntries,
            workspaceMatches
          ),
          deletedLoginAttemptCount: deleteMatching(
            state.participantLoginAttempts,
            workspaceMatches
          ),
          deletedTestRunCount: deleteMatching(state.testRuns, workspaceMatches),
          deletedTestLogCount: deleteMatching(state.participantTestLogs, workspaceMatches)
        };
        for (const key of Object.keys(state.participantRosterPasswordHashes)) {
          if (key.startsWith(`${input.tenantId}::${input.workspaceId}::`)) {
            delete state.participantRosterPasswordHashes[key];
          }
        }
        delete state.workspacesByScope[scopeKey];
        const remainingWorkspaceWithSameKey = Object.values(
          state.workspacesByScope
        ).find(candidate => candidate.workspaceKey === workspace.workspaceKey);
        if (remainingWorkspaceWithSameKey) {
          state.workspacesByKey[remainingWorkspaceWithSameKey.workspaceKey] =
            remainingWorkspaceWithSameKey;
        } else {
          delete state.workspacesByKey[workspace.workspaceKey];
        }
        state.adminAuditEvents[input.auditEvent.adminAuditEventId] = input.auditEvent;
        return counts;
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
    async deleteWorkspaceActivityEventsByIds(activityEventIds) {
      let deletedCount = 0;
      await mutate(state => {
        for (const activityEventId of activityEventIds) {
          if (state.workspaceActivityEvents[activityEventId]) {
            delete state.workspaceActivityEvents[activityEventId];
            deletedCount += 1;
          }
        }
      });
      return deletedCount;
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
    async listParticipantTestLogsByWorkspace(tenantId, workspaceId) {
      const state = await getState();
      return Object.values(state.participantTestLogs).filter(
        testLog =>
          testLog.tenantId === tenantId && testLog.workspaceId === workspaceId
      );
    },
    async saveParticipantTestLogs(testLogs) {
      await mutate(state => {
        for (const testLog of testLogs) {
          state.participantTestLogs[testLog.participantTestLogId] = testLog;
        }
      });
    },
    async deleteParticipantTestLogsByTestRunIds(testRunIds) {
      const testRunIdSet = new Set(testRunIds);
      let deletedCount = 0;
      await mutate(state => {
        for (const testLog of Object.values(state.participantTestLogs)) {
          if (testRunIdSet.has(testLog.testRunId)) {
            delete state.participantTestLogs[testLog.participantTestLogId];
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
