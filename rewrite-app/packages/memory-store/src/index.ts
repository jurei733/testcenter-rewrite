import {
  createWorkspaceSourcePackageReferenceRevision,
  type FirstSliceRepository
} from "@testcenter-rewrite-app/application";
import { selectLatestParticipantTestStateLogs } from "@testcenter-rewrite-app/domain";
import type {
  AdminLoginAttempt,
  AdminAuditEvent,
  AdminRoleAssignment,
  AdminSession,
  AdminUser,
  ApplicationSettings,
  ApplicationAsset,
  AttachmentFile,
  ContentRelease,
  ImportJob,
  OperationalLoginMigrationCandidate,
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

type InMemoryFirstSliceState = {
  applicationSettings: ApplicationSettings | null;
  applicationAssets: Map<string, ApplicationAsset>;
  attachmentFiles: Map<string, AttachmentFile>;
  adminUsers: Map<string, AdminUser>;
  adminUsersByUsername: Map<string, AdminUser>;
  adminLoginAttempts: Map<string, AdminLoginAttempt>;
  proofOfWorkChallenges: Map<
    string,
    { consumedAt: string; expiresAt: string }
  >;
  adminRoleAssignments: Map<string, AdminRoleAssignment>;
  adminAuditEvents: Map<string, AdminAuditEvent>;
  adminSessionsByToken: Map<string, AdminSession>;
  tenants: Map<string, Tenant>;
  workspacesByScope: Map<string, Workspace>;
  workspacesByKey: Map<string, Workspace>;
  workspaceActivityEvents: Map<string, WorkspaceActivityEvent>;
  workspaceReviews: Map<string, WorkspaceReview>;
  sourcePackages: Map<string, SourcePackage>;
  importJobs: Map<string, ImportJob>;
  contentReleases: Map<string, ContentRelease>;
  participantSessions: Map<string, ParticipantSession>;
  participantRosterEntries: Map<string, ParticipantRosterEntry>;
  operationalLoginMigrationCandidates: Map<
    string,
    OperationalLoginMigrationCandidate[]
  >;
  participantRosterPasswordHashes: Map<string, string>;
  participantLoginAttempts: Map<string, ParticipantLoginAttempt>;
  testRuns: Map<string, TestRun>;
  participantTestLogs: Map<string, ParticipantTestLog>;
};

const createInitialState = (): InMemoryFirstSliceState => ({
  applicationSettings: null,
  applicationAssets: new Map(),
  attachmentFiles: new Map(),
  adminUsers: new Map(),
  adminUsersByUsername: new Map(),
  adminLoginAttempts: new Map(),
  proofOfWorkChallenges: new Map(),
  adminRoleAssignments: new Map(),
  adminAuditEvents: new Map(),
  adminSessionsByToken: new Map(),
  tenants: new Map(),
  workspacesByScope: new Map(),
  workspacesByKey: new Map(),
  workspaceActivityEvents: new Map(),
  workspaceReviews: new Map(),
  sourcePackages: new Map(),
  importJobs: new Map(),
  contentReleases: new Map(),
  participantSessions: new Map(),
  participantRosterEntries: new Map(),
  operationalLoginMigrationCandidates: new Map(),
  participantRosterPasswordHashes: new Map(),
  participantLoginAttempts: new Map(),
  testRuns: new Map(),
  participantTestLogs: new Map()
});

const workspaceScopeKey = (tenantKey: string, workspaceKey: string): string =>
  `${tenantKey}::${workspaceKey}`;

const participantRosterPasswordKey = (
  tenantId: string,
  workspaceId: string,
  loginKey: string
): string => `${tenantId}::${workspaceId}::${loginKey}`;

const participantLoginAttemptKey = participantRosterPasswordKey;

export const createInMemoryFirstSliceRepository = (): FirstSliceRepository => {
  const state = createInitialState();

  return {
    async getApplicationSettings() {
      return state.applicationSettings;
    },
    async saveApplicationSettings(settings) {
      state.applicationSettings = { ...settings };
    },
    async listApplicationAssets() {
      return Array.from(state.applicationAssets.values());
    },
    async getApplicationAssetById(applicationAssetId) {
      return state.applicationAssets.get(applicationAssetId) ?? null;
    },
    async getApplicationAssetByOriginalName(originalName) {
      return (
        Array.from(state.applicationAssets.values()).find(
          asset => asset.originalName === originalName
        ) ?? null
      );
    },
    async saveApplicationAsset(applicationAsset) {
      state.applicationAssets.set(
        applicationAsset.applicationAssetId,
        applicationAsset
      );
    },
    async deleteApplicationAsset(applicationAssetId) {
      return state.applicationAssets.delete(applicationAssetId);
    },
    async listAttachmentFilesByWorkspace(tenantId, workspaceId) {
      return Array.from(state.attachmentFiles.values()).filter(
        attachmentFile =>
          attachmentFile.tenantId === tenantId &&
          attachmentFile.workspaceId === workspaceId
      );
    },
    async getAttachmentFileById(attachmentFileId) {
      return state.attachmentFiles.get(attachmentFileId) ?? null;
    },
    async saveAttachmentFile(attachmentFile) {
      state.attachmentFiles.set(attachmentFile.attachmentFileId, attachmentFile);
    },
    async deleteAttachmentFile(attachmentFileId) {
      return state.attachmentFiles.delete(attachmentFileId);
    },
    async listAdminUsers() {
      return Array.from(state.adminUsers.values());
    },
    async getAdminUserById(adminUserId) {
      return state.adminUsers.get(adminUserId) ?? null;
    },
    async getAdminUserByUsername(username) {
      return state.adminUsersByUsername.get(username) ?? null;
    },
    async getAdminLoginAttempt(username) {
      return state.adminLoginAttempts.get(username) ?? null;
    },
    async recordAdminLoginFailure(input) {
      const current = state.adminLoginAttempts.get(input.username);
      const next: AdminLoginAttempt = {
        username: input.username,
        failedAttempts:
          !current || current.expiresAt <= input.attemptedAt
            ? 1
            : current.failedAttempts + 1,
        expiresAt: input.expiresAt,
        updatedAt: input.attemptedAt
      };
      state.adminLoginAttempts.set(input.username, next);
      return next;
    },
    async consumeProofOfWorkChallenge(input) {
      for (const [challengeId, challenge] of state.proofOfWorkChallenges) {
        if (challenge.expiresAt <= input.consumedAt) {
          state.proofOfWorkChallenges.delete(challengeId);
        }
      }
      if (state.proofOfWorkChallenges.has(input.challengeId)) {
        return false;
      }
      state.proofOfWorkChallenges.set(input.challengeId, {
        consumedAt: input.consumedAt,
        expiresAt: input.expiresAt
      });
      return true;
    },
    async saveAdminUser(adminUser) {
      state.adminUsers.set(adminUser.adminUserId, adminUser);
      state.adminUsersByUsername.set(adminUser.username, adminUser);
    },
    async deleteAdminUser(adminUserId) {
      const adminUser = state.adminUsers.get(adminUserId);
      if (adminUser) {
        state.adminUsers.delete(adminUserId);
        state.adminUsersByUsername.delete(adminUser.username);
      }
      let deletedRoleAssignmentCount = 0;
      for (const [roleAssignmentId, roleAssignment] of
        state.adminRoleAssignments.entries()) {
        if (roleAssignment.adminUserId === adminUserId) {
          state.adminRoleAssignments.delete(roleAssignmentId);
          deletedRoleAssignmentCount += 1;
        }
      }
      let deletedSessionCount = 0;
      for (const [token, adminSession] of state.adminSessionsByToken.entries()) {
        if (adminSession.adminUserId === adminUserId) {
          state.adminSessionsByToken.delete(token);
          deletedSessionCount += 1;
        }
      }
      return { deletedRoleAssignmentCount, deletedSessionCount };
    },
    async listAdminRoleAssignmentsByUserId(adminUserId) {
      return Array.from(state.adminRoleAssignments.values()).filter(
        roleAssignment => roleAssignment.adminUserId === adminUserId
      );
    },
    async saveAdminRoleAssignment(roleAssignment) {
      state.adminRoleAssignments.set(roleAssignment.roleAssignmentId, roleAssignment);
    },
    async deleteAdminRoleAssignment(roleAssignmentId) {
      state.adminRoleAssignments.delete(roleAssignmentId);
    },
    async listAdminAuditEvents() {
      return Array.from(state.adminAuditEvents.values());
    },
    async saveAdminAuditEvent(auditEvent) {
      state.adminAuditEvents.set(auditEvent.adminAuditEventId, auditEvent);
    },
    async listAdminSessions() {
      return Array.from(state.adminSessionsByToken.values());
    },
    async getAdminSessionByToken(token) {
      return state.adminSessionsByToken.get(token) ?? null;
    },
    async saveAdminSession(adminSession) {
      state.adminSessionsByToken.set(adminSession.token, adminSession);
    },
    async getTenantByKey(tenantKey) {
      return state.tenants.get(tenantKey) ?? null;
    },
    async listTenants() {
      return Array.from(state.tenants.values());
    },
    async saveTenant(tenant) {
      state.tenants.set(tenant.tenantKey, tenant);
    },
    async getWorkspaceByScope(tenantKey, workspaceKey) {
      return (
        state.workspacesByScope.get(workspaceScopeKey(tenantKey, workspaceKey)) ?? null
      );
    },
    async getWorkspaceByWorkspaceKey(workspaceKey) {
      return state.workspacesByKey.get(workspaceKey) ?? null;
    },
    async listWorkspacesByTenantId(tenantId) {
      return Array.from(state.workspacesByScope.values()).filter(
        workspace => workspace.tenantId === tenantId
      );
    },
    async saveWorkspace(scope) {
      state.workspacesByScope.set(
        workspaceScopeKey(scope.tenantKey, scope.workspaceKey),
        scope.workspace
      );
      state.workspacesByKey.set(scope.workspace.workspaceKey, scope.workspace);
    },
    async deleteWorkspaceAggregate(input) {
      const scopeKey = workspaceScopeKey(input.tenantKey, input.workspaceKey);
      const workspace = state.workspacesByScope.get(scopeKey);
      if (!workspace || workspace.workspaceId !== input.workspaceId) {
        return null;
      }
      const deleteMatching = <Value>(
        values: Map<string, Value>,
        matches: (value: Value) => boolean
      ): number => {
        let deletedCount = 0;
        for (const [key, value] of values) {
          if (matches(value)) {
            values.delete(key);
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
      for (const key of state.participantRosterPasswordHashes.keys()) {
        if (key.startsWith(`${input.tenantId}::${input.workspaceId}::`)) {
          state.participantRosterPasswordHashes.delete(key);
        }
      }
      state.operationalLoginMigrationCandidates.delete(
        `${input.tenantId}::${input.workspaceId}`
      );
      state.workspacesByScope.delete(scopeKey);
      const remainingWorkspaceWithSameKey = Array.from(
        state.workspacesByScope.values()
      ).find(candidate => candidate.workspaceKey === workspace.workspaceKey);
      if (remainingWorkspaceWithSameKey) {
        state.workspacesByKey.set(
          remainingWorkspaceWithSameKey.workspaceKey,
          remainingWorkspaceWithSameKey
        );
      } else {
        state.workspacesByKey.delete(workspace.workspaceKey);
      }
      state.adminAuditEvents.set(input.auditEvent.adminAuditEventId, input.auditEvent);
      return counts;
    },
    async listWorkspaceActivityEventsByWorkspace(tenantId, workspaceId) {
      return Array.from(state.workspaceActivityEvents.values()).filter(
        activityEvent =>
          activityEvent.tenantId === tenantId &&
          activityEvent.workspaceId === workspaceId
      );
    },
    async saveWorkspaceActivityEvent(activityEvent) {
      state.workspaceActivityEvents.set(
        activityEvent.activityEventId,
        activityEvent
      );
    },
    async deleteWorkspaceActivityEventsByIds(activityEventIds) {
      let deletedCount = 0;
      for (const activityEventId of activityEventIds) {
        if (state.workspaceActivityEvents.delete(activityEventId)) {
          deletedCount += 1;
        }
      }
      return deletedCount;
    },
    async getSourcePackageById(sourcePackageId) {
      return state.sourcePackages.get(sourcePackageId) ?? null;
    },
    async listSourcePackagesByWorkspace(tenantId, workspaceId) {
      return Array.from(state.sourcePackages.values()).filter(
        sourcePackage =>
          sourcePackage.tenantId === tenantId &&
          sourcePackage.workspaceId === workspaceId
      );
    },
    async saveSourcePackage(sourcePackage) {
      state.sourcePackages.set(sourcePackage.sourcePackageId, sourcePackage);
    },
    async deleteSourcePackageAggregate(input) {
      const sourcePackage = state.sourcePackages.get(input.sourcePackageId);
      if (
        !sourcePackage ||
        sourcePackage.tenantId !== input.tenantId ||
        sourcePackage.workspaceId !== input.workspaceId
      ) {
        return false;
      }
      const importJobs = Array.from(state.importJobs.values()).filter(
        importJob =>
          importJob.tenantId === input.tenantId &&
          importJob.workspaceId === input.workspaceId &&
          importJob.sourcePackageId === input.sourcePackageId
      );
      const importJobIds = new Set(importJobs.map(importJob => importJob.importJobId));
      const contentReleases = Array.from(state.contentReleases.values()).filter(
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
      const workspaceSourcePackageReferenceRevision =
        createWorkspaceSourcePackageReferenceRevision({
          sourcePackages: Array.from(state.sourcePackages.values()).filter(
            candidate =>
              candidate.tenantId === input.tenantId &&
              candidate.workspaceId === input.workspaceId
          ),
          activityEvents: Array.from(state.workspaceActivityEvents.values()).filter(
            activityEvent =>
              activityEvent.tenantId === input.tenantId &&
              activityEvent.workspaceId === input.workspaceId
          )
        });
      const isBlocked =
        importJobs.some(
          importJob => importJob.status === "queued" || importJob.status === "running"
        ) ||
        contentReleases.some(contentRelease => contentRelease.status === "active") ||
        Array.from(state.participantSessions.values()).some(participantSession =>
          contentReleaseIds.has(participantSession.contentReleaseId)
        ) ||
        Array.from(state.testRuns.values()).some(testRun =>
          contentReleaseIds.has(testRun.contentReleaseId)
        );
      if (
        isBlocked ||
        !idsMatch([...importJobIds], input.expectedImportJobIds) ||
        !idsMatch([...contentReleaseIds], input.expectedContentReleaseIds) ||
        workspaceSourcePackageReferenceRevision !==
          input.expectedWorkspaceSourcePackageReferenceRevision
      ) {
        return false;
      }

      for (const contentReleaseId of contentReleaseIds) {
        state.contentReleases.delete(contentReleaseId);
      }
      for (const importJobId of importJobIds) {
        state.importJobs.delete(importJobId);
      }
      state.sourcePackages.delete(input.sourcePackageId);
      return true;
    },
    async getImportJobById(importJobId) {
      return state.importJobs.get(importJobId) ?? null;
    },
    async listImportJobsByWorkspace(tenantId, workspaceId) {
      return Array.from(state.importJobs.values()).filter(
        importJob => importJob.tenantId === tenantId && importJob.workspaceId === workspaceId
      );
    },
    async saveImportJob(importJob) {
      state.importJobs.set(importJob.importJobId, importJob);
    },
    async getContentReleaseById(contentReleaseId) {
      return state.contentReleases.get(contentReleaseId) ?? null;
    },
    async listContentReleasesByWorkspace(tenantId, workspaceId) {
      return Array.from(state.contentReleases.values()).filter(
        contentRelease =>
          contentRelease.tenantId === tenantId &&
          contentRelease.workspaceId === workspaceId
      );
    },
    async saveContentRelease(contentRelease) {
      state.contentReleases.set(contentRelease.contentReleaseId, contentRelease);
    },
    async getParticipantSessionById(participantSessionId) {
      return state.participantSessions.get(participantSessionId) ?? null;
    },
    async listParticipantSessionsByWorkspace(tenantId, workspaceId) {
      return Array.from(state.participantSessions.values()).filter(
        participantSession =>
          participantSession.tenantId === tenantId &&
          participantSession.workspaceId === workspaceId
      );
    },
    async saveParticipantSession(participantSession) {
      state.participantSessions.set(
        participantSession.participantSessionId,
        participantSession
      );
    },
    async listParticipantRosterEntriesByWorkspace(tenantId, workspaceId) {
      return Array.from(state.participantRosterEntries.values()).filter(
        entry => entry.tenantId === tenantId && entry.workspaceId === workspaceId
      );
    },
    async listOperationalLoginMigrationCandidatesByWorkspace(
      tenantId,
      workspaceId
    ) {
      return (
        state.operationalLoginMigrationCandidates.get(
          `${tenantId}::${workspaceId}`
        ) ?? []
      );
    },
    async replaceOperationalLoginMigrationCandidatesByWorkspace(
      tenantId,
      workspaceId,
      candidates
    ) {
      state.operationalLoginMigrationCandidates.set(
        `${tenantId}::${workspaceId}`,
        candidates
      );
    },
    async getParticipantRosterPasswordHash(tenantId, workspaceId, loginKey) {
      return (
        state.participantRosterPasswordHashes.get(
          participantRosterPasswordKey(tenantId, workspaceId, loginKey)
        ) ?? null
      );
    },
    async saveParticipantRosterEntry(participantRosterEntry, passwordHash) {
      state.participantRosterEntries.set(
        participantRosterEntry.participantRosterEntryId,
        participantRosterEntry
      );
      const passwordKey = participantRosterPasswordKey(
        participantRosterEntry.tenantId,
        participantRosterEntry.workspaceId,
        participantRosterEntry.loginKey
      );
      if (passwordHash) {
        state.participantRosterPasswordHashes.set(passwordKey, passwordHash);
      } else {
        state.participantRosterPasswordHashes.delete(passwordKey);
      }
    },
    async getParticipantLoginAttempt(tenantId, workspaceId, loginKey) {
      return (
        state.participantLoginAttempts.get(
          participantLoginAttemptKey(tenantId, workspaceId, loginKey)
        ) ?? null
      );
    },
    async recordParticipantLoginFailure(input) {
      const attemptKey = participantLoginAttemptKey(
        input.tenantId,
        input.workspaceId,
        input.loginKey
      );
      const current = state.participantLoginAttempts.get(attemptKey);
      const next: ParticipantLoginAttempt = {
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
      state.participantLoginAttempts.set(attemptKey, next);
      return next;
    },
    async getTestRunById(testRunId) {
      return state.testRuns.get(testRunId) ?? null;
    },
    async listTestRunsByParticipantSessionId(participantSessionId) {
      return Array.from(state.testRuns.values()).filter(
        testRun => testRun.participantSessionId === participantSessionId
      );
    },
    async getOpenTestRunByParticipantSessionId(participantSessionId) {
      return (
        Array.from(state.testRuns.values()).find(
          testRun =>
            testRun.participantSessionId === participantSessionId &&
            testRun.status !== "completed"
        ) ?? null
      );
    },
    async listTestRunsByWorkspace(tenantId, workspaceId) {
      return Array.from(state.testRuns.values()).filter(
        testRun => testRun.tenantId === tenantId && testRun.workspaceId === workspaceId
      );
    },
    async saveTestRun(testRun) {
      state.testRuns.set(testRun.testRunId, testRun);
    },
    async deleteTestRunsByIds(testRunIds) {
      let deletedCount = 0;
      for (const testRunId of testRunIds) {
        if (state.testRuns.delete(testRunId)) {
          deletedCount += 1;
        }
      }
      return deletedCount;
    },
    async listParticipantTestLogsByWorkspace(tenantId, workspaceId) {
      return Array.from(state.participantTestLogs.values()).filter(
        testLog =>
          testLog.tenantId === tenantId && testLog.workspaceId === workspaceId
      );
    },
    async listLatestParticipantTestStateLogsByWorkspace(
      tenantId,
      workspaceId,
      logKeys
    ) {
      return selectLatestParticipantTestStateLogs(
        Array.from(state.participantTestLogs.values()).filter(
          testLog =>
            testLog.tenantId === tenantId && testLog.workspaceId === workspaceId
        ),
        logKeys
      );
    },
    async saveParticipantTestLogs(testLogs) {
      for (const testLog of testLogs) {
        state.participantTestLogs.set(testLog.participantTestLogId, testLog);
      }
    },
    async deleteParticipantTestLogsByTestRunIds(testRunIds) {
      const testRunIdSet = new Set(testRunIds);
      let deletedCount = 0;
      for (const testLog of state.participantTestLogs.values()) {
        if (testRunIdSet.has(testLog.testRunId)) {
          state.participantTestLogs.delete(testLog.participantTestLogId);
          deletedCount += 1;
        }
      }
      return deletedCount;
    },
    async getWorkspaceReviewById(reviewId) {
      return state.workspaceReviews.get(reviewId) ?? null;
    },
    async listWorkspaceReviewsByWorkspace(tenantId, workspaceId) {
      return Array.from(state.workspaceReviews.values()).filter(
        review => review.tenantId === tenantId && review.workspaceId === workspaceId
      );
    },
    async saveWorkspaceReview(review) {
      state.workspaceReviews.set(review.reviewId, review);
    },
    async deleteWorkspaceReview(reviewId) {
      return state.workspaceReviews.delete(reviewId);
    },
    async deleteWorkspaceReviewsByTestRunIds(testRunIds) {
      const testRunIdSet = new Set(testRunIds);
      let deletedCount = 0;
      for (const review of state.workspaceReviews.values()) {
        if (testRunIdSet.has(review.testRunId)) {
          state.workspaceReviews.delete(review.reviewId);
          deletedCount += 1;
        }
      }
      return deletedCount;
    }
  };
};
