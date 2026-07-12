import type { FirstSliceRepository } from "@testcenter-rewrite-app/application";
import type {
  AdminAuditEvent,
  AdminRoleAssignment,
  AdminSession,
  AdminUser,
  ContentRelease,
  ImportJob,
  ParticipantRosterEntry,
  ParticipantSession,
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
  testRuns: Map<string, TestRun>;
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
  testRuns: new Map()
});

const workspaceScopeKey = (tenantKey: string, workspaceKey: string): string =>
  `${tenantKey}::${workspaceKey}`;

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
    async saveParticipantRosterEntry(participantRosterEntry) {
      state.participantRosterEntries.set(
        participantRosterEntry.participantRosterEntryId,
        participantRosterEntry
      );
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
