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
  ParticipantTestLog,
  SourcePackage,
  Tenant,
  TestRun,
  WorkspaceActivityEvent,
  WorkspaceReview,
  Workspace
} from "@testcenter-rewrite-app/domain";

type InMemoryFirstSliceState = {
  adminUsers: Map<string, AdminUser>;
  adminUsersByUsername: Map<string, AdminUser>;
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
  participantRosterPasswordHashes: Map<string, string>;
  participantLoginAttempts: Map<string, ParticipantLoginAttempt>;
  testRuns: Map<string, TestRun>;
  participantTestLogs: Map<string, ParticipantTestLog>;
};

const createInitialState = (): InMemoryFirstSliceState => ({
  adminUsers: new Map(),
  adminUsersByUsername: new Map(),
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
    async listAdminUsers() {
      return Array.from(state.adminUsers.values());
    },
    async getAdminUserById(adminUserId) {
      return state.adminUsers.get(adminUserId) ?? null;
    },
    async getAdminUserByUsername(username) {
      return state.adminUsersByUsername.get(username) ?? null;
    },
    async saveAdminUser(adminUser) {
      state.adminUsers.set(adminUser.adminUserId, adminUser);
      state.adminUsersByUsername.set(adminUser.username, adminUser);
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
        !idsMatch([...contentReleaseIds], input.expectedContentReleaseIds)
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
