import {nextOriginalCommandNumber,findOriginalCommandTargetCollection,appendOriginalCommandCollection,listOriginalCommandsCollection,acknowledgeOriginalCommandCollection,touchOriginalCommandPollingCollection} from '@testcenter-rewrite-app/application';
import type {OriginalCommandDelivery} from '@testcenter-rewrite-app/application';
import {prepareOriginalOperationalLogins,projectOriginalOperationalModes} from '@testcenter-rewrite-app/application';
import {lockOriginalTestCollection,appendOriginalTestLogCollection} from '@testcenter-rewrite-app/application';
import type {OriginalNativeUnit} from '@testcenter-rewrite-app/domain';
import {originalUnitParentMatches,readOriginalUnitCollection,mutateOriginalUnitCollection,invalidateOriginalUnitCollection} from '@testcenter-rewrite-app/application';
import {preserveOriginalTestState} from '@testcenter-rewrite-app/application';
import {prepareOriginalWorkspaceNumber,selectOwnedOriginalTestNumber,type OriginalWorkspaceNumberRecord} from '@testcenter-rewrite-app/application';
import {prepareOriginalTestNumber, assertOriginalTestCreationCandidate, type OriginalTestNumberRecord} from '@testcenter-rewrite-app/application';
import {guardResultArtifactCollections, activityResultParent, attachmentResultParent} from '@testcenter-rewrite-app/application';
import {prepareOriginalGroupDeletionInput, deleteOriginalGroupsFromCollections} from '@testcenter-rewrite-app/application';
import {projectOriginalGroupResultInventory} from '@testcenter-rewrite-app/application';
import {projectOriginalResultTest} from '@testcenter-rewrite-app/application';
import {projectOriginalSessionTest} from '@testcenter-rewrite-app/application';
import {
  originalParticipantGroupKeysEqual,
  prepareOriginalParticipantGroup,
  prepareOriginalLoginBinding,
  prepareOriginalSessionToken,
  selectOriginalSessionToken,
  originalSessionTokenKey,
  hashOriginalSessionToken,
  type OriginalSessionToken,
  prepareOriginalParticipantSession,
  resolveOriginalPerson,
  assertOriginalPersonUnique,
  projectOriginalPersonRuns,
  projectOriginalLoginMode,
  withOriginalTestRunMode,
  projectOriginalPersonSessions,
  createContentReleaseActivationRevision,
  prepareContentReleaseActivation,
  prepareWorkspaceFilePublication,
  prepareApplicationAssetDeletion,
  validateApplicationAssetReferences,
  createWorkspaceSourcePackageReferenceRevision,
  hasActiveSourcePackageReplacement,
  transitionParticipantPresence,
  prepareParticipantAssignmentRunCreation,
  prepareParticipantControllerActivation,
  prepareParticipantRunMutation,
  appendParticipantRunCommand,
  acknowledgeParticipantRunCommand,
  prepareParticipantRunCommandApplication,
  matchesParticipantRunCommandScope,
  type ParticipantPresence,
  type FirstSliceRepository,
  type ParticipantAccessCredential
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
  OriginalParticipantGroup,
  OriginalLoginBinding,
  ParticipantTestLog,
  ParticipantRunCommand,
  ParticipantProgressDelivery,
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
  originalParticipantGroups: Map<string, OriginalParticipantGroup>;
  originalLoginBindings: Map<string, OriginalLoginBinding>;
  originalSessionTokens: Map<string, OriginalSessionToken>;
  participantSessions: Map<string, ParticipantSession>;
  participantAccessCredentials: Map<string, ParticipantAccessCredential>;
  participantRosterEntries: Map<string, ParticipantRosterEntry>;
  operationalLoginMigrationCandidates: Map<
    string,
    OperationalLoginMigrationCandidate[]
  >;
  originalOperationalLogins: Map<string, import('@testcenter-rewrite-app/application').OriginalOperationalLogin[]>;
  participantRosterPasswordHashes: Map<string, string>;
  participantLoginAttempts: Map<string, ParticipantLoginAttempt>;
  testRuns: Map<string, TestRun>;
  originalNativeUnits: Map<string,OriginalNativeUnit>;
  originalTestNumbers: Map<string, OriginalTestNumberRecord>;
  originalTestNumberCounter: string;
  originalTestRunsByNumber: Map<string,string>;
  originalWorkspaceNumbers: Map<string,OriginalWorkspaceNumberRecord>;
  originalWorkspaceNumberCounter: string;
  originalNativeCommands: Map<string,OriginalCommandDelivery>;
  originalNativeCommandCounter: string;
  participantRunCommands: Map<string, ParticipantRunCommand>;
  participantProgressDeliveries: Map<string, ParticipantProgressDelivery>;
  participantTestLogs: Map<string, ParticipantTestLog>;
  participantPresence: Map<string, ParticipantPresence>;
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
  originalParticipantGroups: new Map(),
  originalLoginBindings: new Map(),
  originalSessionTokens: new Map(),
  participantSessions: new Map(),
  participantAccessCredentials: new Map(),
  participantRosterEntries: new Map(),
  operationalLoginMigrationCandidates: new Map(),
  originalOperationalLogins: new Map(),
  participantRosterPasswordHashes: new Map(),
  participantLoginAttempts: new Map(),
  testRuns: new Map(),
  originalNativeUnits: new Map(),
  originalTestNumbers: new Map(),
  originalTestNumberCounter: "0",
  originalTestRunsByNumber: new Map(),
  originalWorkspaceNumbers: new Map(),
  originalWorkspaceNumberCounter: "0",
  originalNativeCommands: new Map(),
  originalNativeCommandCounter: '0',
  participantRunCommands: new Map(),
  participantProgressDeliveries: new Map(),
  participantTestLogs: new Map(),
  participantPresence: new Map()
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

  const reserveSourcePackageWithActivity = async (input: Parameters<FirstSliceRepository['reserveSourcePackageAssembly']>[0],
    requiredEventType: 'source_package_assembled' | 'source_package_created'): Promise<boolean> => {
    const { assembledSourcePackage, assemblyActivityEvent } = input;
    const sourcePackages = Array.from(state.sourcePackages.values()).filter(
      candidate =>
        candidate.tenantId === assembledSourcePackage.tenantId &&
        candidate.workspaceId === assembledSourcePackage.workspaceId
    );
    const activityEvents = Array.from(
      state.workspaceActivityEvents.values()
    ).filter(
      activityEvent =>
        activityEvent.tenantId === assembledSourcePackage.tenantId &&
        activityEvent.workspaceId === assembledSourcePackage.workspaceId
    );
    if (
      assemblyActivityEvent.tenantId !== assembledSourcePackage.tenantId ||
      assemblyActivityEvent.workspaceId !==
        assembledSourcePackage.workspaceId ||
      assemblyActivityEvent.eventType !== requiredEventType ||
      assemblyActivityEvent.subjectId !==
        assembledSourcePackage.sourcePackageId ||
      state.sourcePackages.has(assembledSourcePackage.sourcePackageId) ||
      state.workspaceActivityEvents.has(assemblyActivityEvent.activityEventId) ||
      createWorkspaceSourcePackageReferenceRevision({
        sourcePackages,
        activityEvents
      }) !== input.expectedWorkspaceSourcePackageReferenceRevision
    ) {
      return false;
    }
    state.sourcePackages.set(
      assembledSourcePackage.sourcePackageId,
      assembledSourcePackage
    );
    state.workspaceActivityEvents.set(
      assemblyActivityEvent.activityEventId,
      assemblyActivityEvent
    );
    return true;
  };

  return {
    async getApplicationSettings() {
      return state.applicationSettings;
    },
    async saveApplicationSettings(settings) {
      validateApplicationAssetReferences(settings.assetAssignments,Array.from(state.applicationAssets.values()));
      state.applicationSettings = { ...settings };
    },
    async mutateApplicationSettings(transform) {
      {
        const effect=transform(structuredClone(state.applicationSettings));
        validateApplicationAssetReferences(effect.settings.assetAssignments,Array.from(state.applicationAssets.values()));
        const settings=structuredClone(effect.settings),audit=structuredClone(effect.auditEvent);
        if(state.adminAuditEvents.has(audit.adminAuditEventId))throw Error("Duplicate application settings audit event.");
        state.applicationSettings=settings;state.adminAuditEvents.set(audit.adminAuditEventId,audit);
        return structuredClone(effect.settings);
      }
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
    async saveApplicationAsset(applicationAsset, replaceByOriginalName=false) {
      const existing=replaceByOriginalName?Array.from(state.applicationAssets.values()).find(asset=>asset.originalName===applicationAsset.originalName):null;
      if(existing)applicationAsset={...applicationAsset,applicationAssetId:existing.applicationAssetId,createdAt:existing.createdAt};

      state.applicationAssets.set(
        applicationAsset.applicationAssetId,
        applicationAsset
      );
      return { applicationAsset, replaced: Boolean(existing) };
    },
    async mutateApplicationAssetDeletion(input) {
      const scopes=Array.from(state.workspacesByScope.values()).map(workspace=>({...workspace,
        tenantKey:Array.from(state.tenants.values()).find(tenant=>tenant.tenantId===workspace.tenantId)?.tenantKey??workspace.tenantId}));
      const effect=prepareApplicationAssetDeletion(input,{
        asset:state.applicationAssets.get(input.applicationAssetId)??null,settings:state.applicationSettings,
        roster:Array.from(state.participantRosterEntries.values()).map(row=>({...row,assetAssignments:row.assetAssignments??{}})),
        operational:Array.from(state.operationalLoginMigrationCandidates.entries()).map(([key,candidates])=>{
          const scope=scopes.find(scope=>scope.tenantId+"::"+scope.workspaceId===key);
          if(scope)return {...scope,candidates};
          const parts=key.split("::");if(parts.length!==2)throw Error("Invalid stored operational asset scope.");
          return {tenantId:parts[0]!,workspaceId:parts[1]!,candidates};
        }),scopes
      });
      if(!effect)return null;
      if(effect.settings)state.applicationSettings=effect.settings;
      for(const row of effect.roster){const previous=state.participantRosterEntries.get(row.participantRosterEntryId)!;
        state.participantRosterEntries.set(row.participantRosterEntryId,{...previous,assetAssignments:row.assetAssignments});}
      for(const group of effect.operational)state.operationalLoginMigrationCandidates.set(group.tenantId+"::"+group.workspaceId,group.candidates);
      state.applicationAssets.delete(effect.asset.applicationAssetId);
      state.adminAuditEvents.set(effect.auditEvent.adminAuditEventId,effect.auditEvent);
      return effect.asset;
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
      guardResultArtifactCollections(state, attachmentResultParent(attachmentFile));
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
      const number=prepareOriginalWorkspaceNumber(scope.workspace,scope.workspace,state.originalWorkspaceNumbers.get(scope.workspace.workspaceId),state.originalWorkspaceNumberCounter);
      if(number.changed){state.originalWorkspaceNumbers.set(scope.workspace.workspaceId,number.record);state.originalWorkspaceNumberCounter=number.counter;}
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
      deleteMatching(state.participantRunCommands, workspaceMatches);
      deleteMatching(state.originalNativeCommands, workspaceMatches);
      deleteMatching(state.participantProgressDeliveries, workspaceMatches);
      deleteMatching(state.originalLoginBindings, workspaceMatches);
      deleteMatching(state.originalSessionTokens, workspaceMatches);
      deleteMatching(state.originalParticipantGroups, workspaceMatches);
      deleteMatching(state.originalNativeUnits,workspaceMatches);
      deleteMatching(state.originalTestNumbers, row=>{if(!workspaceMatches(row))return false;state.originalTestRunsByNumber.delete(row.testNumber);return true;});
      deleteMatching(state.originalWorkspaceNumbers,workspaceMatches);
      for (const run of state.testRuns.values()) {
        if (workspaceMatches(run)) state.participantPresence.delete(run.testRunId);
      }
      for (const session of state.participantSessions.values()) {
        if (workspaceMatches(session)) state.participantAccessCredentials.delete(session.participantSessionId);
      }
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
      state.originalOperationalLogins.delete(`${input.tenantId}::${input.workspaceId}`);
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
    async listWorkspaceActivityEventsByWorkspace(tenantId, workspaceId, eventTypes) {
      return Array.from(state.workspaceActivityEvents.values()).filter(
        activityEvent =>
          activityEvent.tenantId === tenantId &&
          activityEvent.workspaceId === workspaceId &&
          (eventTypes === undefined || eventTypes.includes(activityEvent.eventType))
      );
    },
    async saveWorkspaceActivityEvent(activityEvent) {
      guardResultArtifactCollections(state, activityResultParent(activityEvent));
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
    reserveSourcePackageAssembly: input => reserveSourcePackageWithActivity(input, 'source_package_assembled'),
    async publishWorkspaceFiles(input) {
      input=structuredClone(input);
      const source=input.sourcePackage,job=input.importJob,release=input.contentRelease;
      const scoped=(value:{tenantId:string;workspaceId:string})=>value.tenantId===source.tenantId && value.workspaceId===source.workspaceId;
      const superseded=prepareWorkspaceFilePublication(input,{
        workspaceExists:Array.from(state.workspacesByScope.values()).some(scoped),
        identitiesAvailable:!state.sourcePackages.has(source.sourcePackageId) && !state.importJobs.has(job.importJobId) &&
          (!release || !state.contentReleases.has(release.contentReleaseId)) &&
          input.activityEvents.every(event=>!state.workspaceActivityEvents.has(event.activityEventId)),
        sourcePackages:Array.from(state.sourcePackages.values()).filter(scoped),
        activityEvents:Array.from(state.workspaceActivityEvents.values()).filter(scoped),
        contentReleases:Array.from(state.contentReleases.values()).filter(scoped)
      });
      if(!superseded)return false;
      state.sourcePackages.set(source.sourcePackageId,structuredClone(source));
      state.importJobs.set(job.importJobId,structuredClone(job));
      for(const value of superseded)state.contentReleases.set(value.contentReleaseId,structuredClone(value));
      if(release)state.contentReleases.set(release.contentReleaseId,structuredClone(release));
      for(const event of input.activityEvents)state.workspaceActivityEvents.set(event.activityEventId,structuredClone(event));
      return true;
    },
    reserveWorkspaceFileUpload: input => reserveSourcePackageWithActivity({assembledSourcePackage:input.sourcePackage,
      assemblyActivityEvent:input.createdActivityEvent,
      expectedWorkspaceSourcePackageReferenceRevision:input.expectedWorkspaceSourcePackageReferenceRevision}, 'source_package_created'),
    async reserveSourcePackageReplacement(input) {
      const { replacementSourcePackage, replacementActivityEvent } = input;
      const sourcePackages = Array.from(state.sourcePackages.values()).filter(
        candidate =>
          candidate.tenantId === replacementSourcePackage.tenantId &&
          candidate.workspaceId === replacementSourcePackage.workspaceId
      );
      const activityEvents = Array.from(
        state.workspaceActivityEvents.values()
      ).filter(
        activityEvent =>
          activityEvent.tenantId === replacementSourcePackage.tenantId &&
          activityEvent.workspaceId === replacementSourcePackage.workspaceId
      );
      const replacedSourcePackage = state.sourcePackages.get(
        input.replacedSourcePackageId
      );
      if (
        !replacedSourcePackage ||
        replacedSourcePackage.tenantId !== replacementSourcePackage.tenantId ||
        replacedSourcePackage.workspaceId !== replacementSourcePackage.workspaceId ||
        replacementActivityEvent.tenantId !== replacementSourcePackage.tenantId ||
        replacementActivityEvent.workspaceId !== replacementSourcePackage.workspaceId ||
        replacementActivityEvent.subjectId !== input.replacedSourcePackageId ||
        createWorkspaceSourcePackageReferenceRevision({
          sourcePackages,
          activityEvents
        }) !== input.expectedWorkspaceSourcePackageReferenceRevision ||
        hasActiveSourcePackageReplacement({
          sourcePackageId: input.replacedSourcePackageId,
          sourcePackages,
          activityEvents
        })
      ) {
        return false;
      }
      state.sourcePackages.set(
        replacementSourcePackage.sourcePackageId,
        replacementSourcePackage
      );
      state.workspaceActivityEvents.set(
        replacementActivityEvent.activityEventId,
        replacementActivityEvent
      );
      return true;
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
          participantSession.contentReleaseId !== null && contentReleaseIds.has(participantSession.contentReleaseId)
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
    async getContentReleaseActivationRevision(tenantId, workspaceId) {

      const scoped=(value:{tenantId:string;workspaceId:string})=>value.tenantId===tenantId && value.workspaceId===workspaceId;
      return createContentReleaseActivationRevision({contentReleases:Array.from(state.contentReleases.values()).filter(scoped),
          participantSessions:Array.from(state.participantSessions.values()).filter(scoped),
          testRuns:Array.from(state.testRuns.values()).filter(scoped)});
    },
    async commitContentReleaseActivation(input) {

        const scoped=(value:{tenantId:string;workspaceId:string})=>value.tenantId===input.tenantId && value.workspaceId===input.workspaceId;
        const prepared=prepareContentReleaseActivation(input,{
          workspaceExists:Array.from(state.workspacesByScope.values()).some(scoped),
          eventIdAvailable:!state.workspaceActivityEvents.has(input.activityEvent.activityEventId),
          contentReleases:Array.from(state.contentReleases.values()).filter(scoped),
          participantSessions:Array.from(state.participantSessions.values()).filter(scoped),
          testRuns:Array.from(state.testRuns.values()).filter(scoped)
        });
        if(!prepared)return false;
        for(const release of prepared.contentReleases)state.contentReleases.set(release.contentReleaseId,release);
        state.workspaceActivityEvents.set(prepared.activityEvent.activityEventId,prepared.activityEvent);
        return true;

    },
    async saveContentRelease(contentRelease) {
      state.contentReleases.set(contentRelease.contentReleaseId, contentRelease);
    },
    async getParticipantSessionById(participantSessionId) {
      return state.participantSessions.get(participantSessionId) ?? null;
    },
    async getParticipantAccessCredential(participantSessionId) {
      const credential = state.participantAccessCredentials.get(participantSessionId);
      return credential ? { ...credential } : null;
    },
    async saveParticipantAccessCredential(credential) {
      guardResultArtifactCollections(state, credential);
      state.participantAccessCredentials.set(credential.participantSessionId, { ...credential });
    },
    async revokeParticipantAccessCredential(input) {
      guardResultArtifactCollections(state, input);
      const current = state.participantAccessCredentials.get(input.participantSessionId);
      if ((current?.tokenHash ?? null) !== input.expectedTokenHash) return false;
      state.participantAccessCredentials.set(input.participantSessionId, {
        participantSessionId: input.participantSessionId, tokenHash: null, updatedAt: input.updatedAt
      });
      return true;
    },
    async listParticipantSessionsByWorkspace(tenantId, workspaceId) {
      return Array.from(state.participantSessions.values()).filter(
        participantSession =>
          participantSession.tenantId === tenantId &&
          participantSession.workspaceId === workspaceId
      );
    },
    async getOrCreateOriginalSessionToken(input) {
      const candidate = prepareOriginalSessionToken(input);
      if (!Array.from(state.workspacesByScope.values()).some(workspace => workspace.tenantId === candidate.tenantId && workspace.workspaceId === candidate.workspaceId)) return null;
      const subjects = candidate.kind === 'login' ? Array.from(state.originalLoginBindings.values()) : Array.from(state.originalParticipantGroups.values());
      if (!subjects.some(subject => subject.tenantId === candidate.tenantId && subject.workspaceId === candidate.workspaceId &&
        ('loginKey' in subject ? subject.loginKey : subject.groupKey) === candidate.subjectKey)) return null;
      const selected = selectOriginalSessionToken(candidate, Array.from(state.originalSessionTokens.values()));
      state.originalSessionTokens.set(originalSessionTokenKey(selected), selected);
      return structuredClone(selected);
    },
    async findOriginalSessionTokenByHash(tokenHash) {
      if (!/^[a-f0-9]{64}$/.test(tokenHash)) return null;
      const matches = Array.from(state.originalSessionTokens.values()).filter(token => hashOriginalSessionToken(token.token) === tokenHash);
      return matches.length === 1 ? structuredClone(matches[0]) : null;
    },
    async findParticipantSessionByAccessTokenHash(tokenHash) {
      if (!/^[a-f0-9]{64}$/.test(tokenHash)) return null;
      const matches = Array.from(state.participantAccessCredentials.values()).filter(credential => credential.tokenHash === tokenHash);
      if (matches.length !== 1) return null;
      const person = state.participantSessions.get(matches[0]!.participantSessionId);
      return person ? structuredClone(person) : null;
    },
    async getOrCreateOriginalParticipantGroup(input) {
      const candidate = prepareOriginalParticipantGroup(input);
      if (!Array.from(state.workspacesByScope.values()).some(workspace => workspace.tenantId === candidate.tenantId && workspace.workspaceId === candidate.workspaceId)) return null;
      const existing = Array.from(state.originalParticipantGroups.values()).find(group => group.tenantId === candidate.tenantId && group.workspaceId === candidate.workspaceId && originalParticipantGroupKeysEqual(group.groupKey, candidate.groupKey));
      if (existing) return structuredClone(existing);
      state.originalParticipantGroups.set(JSON.stringify([candidate.tenantId, candidate.workspaceId, candidate.groupKey]), candidate);
      return structuredClone(candidate);
    },
    async listOriginalParticipantGroupsByWorkspace(tenantId, workspaceId) {
      return structuredClone(Array.from(state.originalParticipantGroups.values()).filter(group => group.tenantId === tenantId && group.workspaceId === workspaceId));
    },
    async bindOriginalLoginGroup(input) {
      const validated = prepareOriginalLoginBinding(input);
      if (!Array.from(state.workspacesByScope.values()).some(workspace => workspace.tenantId === input.tenantId && workspace.workspaceId === input.workspaceId) ||
          !Array.from(state.originalParticipantGroups.values()).some(group => group.tenantId === input.tenantId && group.workspaceId === input.workspaceId && group.groupKey === input.groupSnapshotKey)) return null;
      const previous = state.originalLoginBindings.get(JSON.stringify([input.tenantId, input.workspaceId, validated.loginKey]));
      const binding = prepareOriginalLoginBinding(input, previous);
      state.originalLoginBindings.set(JSON.stringify([binding.tenantId, binding.workspaceId, binding.loginKey]), binding);
      for (const [id, session] of state.participantSessions) if (session.tenantId === binding.tenantId && session.workspaceId === binding.workspaceId && session.originalLoginKey === binding.loginKey) {
        state.participantSessions.set(id, {...session, groupKey: binding.groupKey});
      }
      return structuredClone(binding);
    },
    async listOriginalLoginBindingsByWorkspace(tenantId, workspaceId) {
      return structuredClone(Array.from(state.originalLoginBindings.values()).filter(binding => binding.tenantId === tenantId && binding.workspaceId === workspaceId));
    },
    async resolveOriginalParticipantSession(candidate,validate) {
      if(!Array.from(state.workspacesByScope.values()).some(workspace=>workspace.tenantId===candidate.tenantId && workspace.workspaceId===candidate.workspaceId))return null;
      const binding=Array.from(state.originalLoginBindings.values()).find(binding=>binding.tenantId===candidate.tenantId && binding.workspaceId===candidate.workspaceId && binding.loginKey===candidate.originalLoginKey);
      const storedPeople=Array.from(state.participantSessions.values()),result=resolveOriginalPerson(candidate,binding,storedPeople,validate);
      const people=projectOriginalPersonSessions(result.participantSession,storedPeople),runs=projectOriginalPersonRuns(result.participantSession,Array.from(state.testRuns.values()),people);
      for(const person of people)state.participantSessions.set(person.participantSessionId,person);
      for(const run of runs)state.testRuns.set(run.testRunId,run);
      return structuredClone(result);
    },
    async updateParticipantSessionValidity(input) {
      const person = state.participantSessions.get(input.participantSessionId);
      if (person && person.tenantId === input.tenantId && person.workspaceId === input.workspaceId) state.participantSessions.set(input.participantSessionId, {...person, validUntil: input.validUntil});
    },
    async saveParticipantSession(participantSession) {
      const previous = state.participantSessions.get(participantSession.participantSessionId);
      const originalLoginKey = previous?.originalLoginKey ?? participantSession.originalLoginKey;
      if (originalLoginKey !== undefined) {
        const binding = Array.from(state.originalLoginBindings.values()).find(binding => binding.tenantId === participantSession.tenantId && binding.workspaceId === participantSession.workspaceId && binding.loginKey === originalLoginKey);

        participantSession = prepareOriginalParticipantSession(participantSession,previous,binding);
      } else participantSession = prepareOriginalParticipantSession(participantSession,previous,null);
      assertOriginalPersonUnique(participantSession,Array.from(state.participantSessions.values()));
      state.participantSessions.set(participantSession.participantSessionId, structuredClone(participantSession));
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
      candidates,
      nativeLogins = []
    ) {
      const privateLogins = prepareOriginalOperationalLogins(candidates, nativeLogins);
      if(privateLogins.length && !Array.from(state.workspacesByScope.values()).some(w=>w.tenantId===tenantId&&w.workspaceId===workspaceId))throw new Error('Native operational workspace no longer exists.');
      for (const candidate of candidates) validateApplicationAssetReferences(candidate.assetAssignments,Array.from(state.applicationAssets.values()));
      const modes=projectOriginalOperationalModes({tenantId,workspaceId},privateLogins,Array.from(state.participantSessions.values()),Array.from(state.testRuns.values()));
      state.operationalLoginMigrationCandidates.set(
        `${tenantId}::${workspaceId}`,
        candidates
      );
      for(const person of modes.participantSessions)state.participantSessions.set(person.participantSessionId,person);
      for(const run of modes.testRuns)state.testRuns.set(run.testRunId,run);
      state.originalOperationalLogins.set(`${tenantId}::${workspaceId}`, privateLogins);
    },
    async reserveOriginalCommandNumber(){const next=nextOriginalCommandNumber(state.originalNativeCommandCounter);state.originalNativeCommandCounter=next;return next;},
    async findOriginalCommandTarget(actor,testNumber){return findOriginalCommandTargetCollection(state,actor,testNumber);},
    async appendOriginalCommand(actor,command,targets){appendOriginalCommandCollection(state,actor,command,targets);},
    async listOriginalCommands(scope,lastCommandId){return listOriginalCommandsCollection(state,scope,lastCommandId);},
    async acknowledgeOriginalCommand(scope,commandNumber){return acknowledgeOriginalCommandCollection(state,scope,commandNumber);},
    async touchOriginalCommandPolling(scope,timestamp){return touchOriginalCommandPollingCollection(state,scope,timestamp);},
    async listOriginalOperationalLoginsByWorkspace(tenantId, workspaceId) {
      return structuredClone(state.originalOperationalLogins.get(`${tenantId}::${workspaceId}`) ?? []);
    },
    async getParticipantRosterPasswordHash(tenantId, workspaceId, loginKey) {
      return (
        state.participantRosterPasswordHashes.get(
          participantRosterPasswordKey(tenantId, workspaceId, loginKey)
        ) ?? null
      );
    },
    async saveParticipantRosterEntry(participantRosterEntry, passwordHash) {
      validateApplicationAssetReferences(participantRosterEntry.assetAssignments,Array.from(state.applicationAssets.values()));
      const modes=projectOriginalLoginMode(participantRosterEntry,Array.from(state.participantSessions.values()),Array.from(state.testRuns.values()));
      for(const person of modes.participantSessions)state.participantSessions.set(person.participantSessionId,person);
      for(const run of modes.testRuns)state.testRuns.set(run.testRunId,run);
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
    async resetParticipantLoginAttempts(tenantId, workspaceId, loginKey) {
      state.participantLoginAttempts.delete(
        participantLoginAttemptKey(tenantId, workspaceId, loginKey)
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
    async getOrCreateOriginalWorkspaceNumber(input){
      const workspace=Array.from(state.workspacesByScope.values()).find(row=>row.workspaceId===input.workspaceId)??null;
      const result=prepareOriginalWorkspaceNumber(input,workspace,state.originalWorkspaceNumbers.get(input.workspaceId),state.originalWorkspaceNumberCounter);
      if(result.changed){state.originalWorkspaceNumbers.set(input.workspaceId,result.record);state.originalWorkspaceNumberCounter=result.counter;}return result.record.workspaceNumber;
    },
    async matchesOriginalWorkspaceNumber(input){const row=state.originalWorkspaceNumbers.get(input.workspaceId);return row?.tenantId===input.tenantId&&row.workspaceNumber===input.workspaceNumber&&Array.from(state.workspacesByScope.values()).some(w=>w.workspaceId===input.workspaceId&&w.tenantId===input.tenantId&&w.status==='active')&&Array.from(state.tenants.values()).some(t=>t.tenantId===input.tenantId&&t.status==='active');},
    async findOriginalTestNumber(input){
      const id=state.originalTestRunsByNumber.get(input.testNumber);const row=id?state.originalTestNumbers.get(id):undefined;
      return selectOwnedOriginalTestNumber(input,row,id?state.testRuns.get(id)??null:null,state.participantSessions.get(input.participantSessionId)??null);
    },
    async appendOriginalTestLogs(input, logs) {appendOriginalTestLogCollection(state, input, logs);},
    async lockOriginalTest(input, timestamp) {lockOriginalTestCollection(state, input, timestamp);},
    async getOrCreateOriginalTestNumber(input) {
      guardResultArtifactCollections(state, input);
      const prepared = prepareOriginalTestNumber(input, state.testRuns.get(input.testRunId) ?? null,
        state.participantSessions.get(input.participantSessionId) ?? null, state.originalTestNumbers.get(input.testRunId), state.originalTestNumberCounter);
      if (prepared.changed) {state.originalTestNumbers.set(input.testRunId, prepared.record); state.originalTestRunsByNumber.set(prepared.record.testNumber,input.testRunId); state.originalTestNumberCounter = prepared.counter;}
      return prepared.record.testNumber;
    },
    async getTestRunById(testRunId) {
      return state.testRuns.get(testRunId) ?? null;
    },
    async deleteOriginalGroupResults(raw) {
      const input = prepareOriginalGroupDeletionInput(raw);
      if (![...state.workspacesByScope.values()].some(row => row.tenantId === input.tenantId && row.workspaceId === input.workspaceId)) return null;
      return deleteOriginalGroupsFromCollections(state, input);
    },
    async listOriginalUnitsByWorkspace(tenantId,workspaceId){return structuredClone(Array.from(state.originalNativeUnits.values()).filter(unit=>unit.tenantId===tenantId&&unit.workspaceId===workspaceId));},
    async getOriginalUnit(input){return readOriginalUnitCollection(state,input);},
    async mutateOriginalUnit(input,transform){return mutateOriginalUnitCollection(state,input,transform);},
    async getOriginalGroupResultInventory(tenantId, workspaceId) {
      const scoped = (row: {tenantId:string;workspaceId:string}) => row.tenantId === tenantId && row.workspaceId === workspaceId;
      const nativeByRun=new Map<string,OriginalNativeUnit[]>();
      for(const unit of Array.from(state.originalNativeUnits.values()))if(scoped(unit)){const rows=nativeByRun.get(unit.testRunId)??[];rows.push(unit);nativeByRun.set(unit.testRunId,rows);}
      return projectOriginalGroupResultInventory({
        people: Array.from(state.participantSessions.values()).filter(scoped),
        bindings: Array.from(state.originalLoginBindings.values()).filter(scoped),
        groups: Array.from(state.originalParticipantGroups.values()).filter(scoped),
        runs: Array.from(state.testRuns.values()).filter(scoped).map(run => projectOriginalResultTest(run,Object.keys(run.unitResponses),(nativeByRun.get(run.testRunId)??[]).filter(unit=>originalUnitParentMatches(run,unit)).map(unit=>unit.unitName))),
        reviews: Array.from(state.workspaceReviews.values()).filter(scoped),
        events: Array.from(state.workspaceActivityEvents.values()).filter(scoped)
      });
    },
    async listOriginalSessionTestFlags(participantSessionId) {
      return Array.from(state.testRuns.values()).filter(run => run.participantSessionId === participantSessionId).map(projectOriginalSessionTest);
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
    async getOrCreateTestRunForAssignment(candidate, initialize, allocateOriginalNumber) {
      if (allocateOriginalNumber) {assertOriginalTestCreationCandidate(candidate); if (initialize) throw new TypeError('Native creation cannot activate a controller.');}
      const prepared = prepareParticipantAssignmentRunCreation(candidate,
        state.participantSessions.get(candidate.participantSessionId) ?? null,
        Array.from(state.testRuns.values()), initialize, state.contentReleases.get(candidate.contentReleaseId));
      const numbered = allocateOriginalNumber ? prepareOriginalTestNumber({...prepared.testRun, consumeSequence: true}, prepared.testRun,
        prepared.effect?.participantSession ?? state.participantSessions.get(candidate.participantSessionId) ?? null,
        state.originalTestNumbers.get(prepared.testRun.testRunId), state.originalTestNumberCounter) : undefined;
      if (prepared.effect) {
        const effect = prepared.effect;
        if (effect.testLogs.some(log => state.participantTestLogs.has(log.participantTestLogId)) ||
          effect.activityEvents.some(event => state.workspaceActivityEvents.has(event.activityEventId))) {
          throw new Error("Initial participant artifacts cannot overwrite existing identities.");
        }
        state.testRuns.set(effect.testRun.testRunId, effect.testRun);
        for (const log of effect.testLogs) state.participantTestLogs.set(log.participantTestLogId, log);
        for (const event of effect.activityEvents) state.workspaceActivityEvents.set(event.activityEventId, event);
        if (effect.participantSession) state.participantSessions.set(candidate.participantSessionId, effect.participantSession);
      }
      if (numbered?.changed) {state.originalTestNumbers.set(prepared.testRun.testRunId, numbered.record); state.originalTestRunsByNumber.set(numbered.record.testNumber,prepared.testRun.testRunId); state.originalTestNumberCounter = numbered.counter;}
      return { testRun: prepared.testRun, created: prepared.created, ...(numbered ? {originalTestNumber: numbered.record.testNumber} : {}) };
    },
    async saveTestRun(testRun) {
      guardResultArtifactCollections(state, {tenantId: testRun.tenantId, workspaceId: testRun.workspaceId, participantSessionId: testRun.participantSessionId});
      const next=preserveOriginalTestState(withOriginalTestRunMode(testRun,state.participantSessions.get(testRun.participantSessionId)),state.testRuns.get(testRun.testRunId)??null);invalidateOriginalUnitCollection(state,state.testRuns.get(testRun.testRunId),next);state.testRuns.set(testRun.testRunId,next);
    },
    async activateParticipantController(input) {
      const result = prepareParticipantControllerActivation(input,
        state.participantSessions.get(input.participantSessionId) ?? null, state.testRuns.get(input.testRunId) ?? null);
      if (result?.activated) state.participantSessions.set(input.participantSessionId, structuredClone(result.participantSession));
      if (result?.entryChanged) {invalidateOriginalUnitCollection(state,state.testRuns.get(input.testRunId),result.testRun);state.testRuns.set(input.testRunId, structuredClone(result.testRun));}
      return result;
    },
    async appendParticipantRunCommand(input) {
      const command = appendParticipantRunCommand(input, state.testRuns.get(input.testRunId) ?? null, {
        existing: state.participantRunCommands.get(JSON.stringify([input.testRunId, input.commandId])) ?? null,
        lastSequence: Array.from(state.participantRunCommands.values())
          .reduce((max, entry) => entry.testRunId === input.testRunId ? Math.max(max, entry.sequence) : max, 0)
      });
      if (command) state.participantRunCommands.set(JSON.stringify([command.testRunId, command.commandId]), structuredClone(command));
      return command;
    },
    async listPendingParticipantRunCommands(scope) {
      if (!matchesParticipantRunCommandScope(state.testRuns.get(scope.testRunId), scope)) return [];
      return structuredClone(Array.from(state.participantRunCommands.values())
        .filter(command => matchesParticipantRunCommandScope(command, scope) && command.acknowledgedAt === null)
        .sort((a, b) => a.sequence - b.sequence));
    },
    async acknowledgeParticipantRunCommand(input) {
      const key = JSON.stringify([input.testRunId, input.commandId]);
      const command = acknowledgeParticipantRunCommand(input, state.testRuns.get(input.testRunId) ?? null,
        state.participantRunCommands.get(key) ?? null);
      if (command) state.participantRunCommands.set(key, structuredClone(command));
      return command;
    },
    async mutateParticipantRun(input, transform) {
      const testRun = state.testRuns.get(input.testRunId);
      const participantSession = state.participantSessions.get(input.participantSessionId);
      const prepared = prepareParticipantRunMutation(input, testRun && participantSession ? { testRun, participantSession,
        progressDelivery: input.deliveryId ? state.participantProgressDeliveries.get(JSON.stringify([input.testRunId, input.deliveryId])) ?? null : null,
        testRuns: Array.from(state.testRuns.values()).filter(run => run.participantSessionId === input.participantSessionId) } : null, transform);
      if (prepared?.effect) {
        const effect = prepared.effect;
        if(effect.originalTestState!==undefined&&(effect.testLogs.some(row=>state.participantTestLogs.has(row.participantTestLogId))||effect.activityEvents.some(row=>state.workspaceActivityEvents.has(row.activityEventId))||new Set(effect.testLogs.map(row=>row.participantTestLogId)).size!==effect.testLogs.length||new Set(effect.activityEvents.map(row=>row.activityEventId)).size!==effect.activityEvents.length))throw Error('Run mutation artifact identity already exists.');
        const command = effect.commandInput ? appendParticipantRunCommand(effect.commandInput, effect.testRun, {
          existing: state.participantRunCommands.get(JSON.stringify([input.testRunId, effect.commandInput.commandId])) ?? null,
          lastSequence: Array.from(state.participantRunCommands.values()).reduce((max, entry) => entry.testRunId === input.testRunId ? Math.max(max, entry.sequence) : max, 0)
        }) : null;
        if (effect.commandInput && !command) throw new Error("The Run no longer accepts the projected command.");
        if (command) state.participantRunCommands.set(JSON.stringify([command.testRunId, command.commandId]), command);
        if (effect.progressDelivery) state.participantProgressDeliveries.set(JSON.stringify([input.testRunId, effect.progressDelivery.deliveryId]), effect.progressDelivery);
        invalidateOriginalUnitCollection(state,state.testRuns.get(input.testRunId),effect.testRun);
        state.testRuns.set(input.testRunId, effect.testRun);
        for (const log of effect.testLogs) state.participantTestLogs.set(log.participantTestLogId, log);
        for (const event of effect.activityEvents) state.workspaceActivityEvents.set(event.activityEventId, event);
        if (effect.participantSession) state.participantSessions.set(input.participantSessionId, effect.participantSession);
      }
      return prepared?.result ?? null;
    },
    async applyParticipantRunCommand(input, transform) {
      const key = JSON.stringify([input.testRunId, input.commandId]);
      const command = state.participantRunCommands.get(key);
      const testRun = state.testRuns.get(input.testRunId);
      const participantSession = state.participantSessions.get(input.participantSessionId);
      const terminal = command?.commandType === "complete" || command?.commandType === "complete_and_lock";
      const prepared = prepareParticipantRunCommandApplication(input,
        command && testRun && participantSession ? { command, testRun, participantSession,
          testRuns: terminal ? Array.from(state.testRuns.values()).filter(run => run.participantSessionId === input.participantSessionId) : [testRun] } : null,
        Array.from(state.participantRunCommands.values()).reduce((max, record) =>
          record.testRunId === input.testRunId ? Math.max(max, record.executionSequence ?? 0) : max, 0), transform);
      if (!prepared) return null;
      if (prepared.effect) {
        const effect = prepared.effect;
        if (effect.testLogs.some(log => state.participantTestLogs.has(log.participantTestLogId)) ||
            effect.activityEvents.some(event => state.workspaceActivityEvents.has(event.activityEventId))) {
          throw new Error("A participant command effect cannot overwrite an existing artifact identity.");
        }
        invalidateOriginalUnitCollection(state,state.testRuns.get(input.testRunId),effect.testRun);
        state.testRuns.set(input.testRunId, effect.testRun);
        state.participantRunCommands.set(key, prepared.result.command);
        for (const log of effect.testLogs) state.participantTestLogs.set(log.participantTestLogId, log);
        for (const event of effect.activityEvents) state.workspaceActivityEvents.set(event.activityEventId, event);
        if (effect.participantSession) state.participantSessions.set(input.participantSessionId, effect.participantSession);
      }
      return structuredClone(prepared.result);
    },
    async deleteTestRunsByIds(testRunIds) {
      let deletedCount = 0;
      for (const testRunId of testRunIds) {
        state.participantPresence.delete(testRunId);
        for(const[key,row]of state.originalNativeCommands)if(row.testRunId===testRunId)state.originalNativeCommands.delete(key);
        for (const [key, command] of state.participantRunCommands) {
          if (command.testRunId === testRunId) state.participantRunCommands.delete(key);
        }
        for (const [key, receipt] of state.participantProgressDeliveries) {
          if (receipt.testRunId === testRunId) state.participantProgressDeliveries.delete(key);
        }
        for(const[key,row]of state.originalNativeUnits)if(row.testRunId===testRunId)state.originalNativeUnits.delete(key);
        const nativeNumber=state.originalTestNumbers.get(testRunId);if(nativeNumber)state.originalTestRunsByNumber.delete(nativeNumber.testNumber);
        state.originalTestNumbers.delete(testRunId);
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
      for (const log of testLogs) guardResultArtifactCollections(state, log);
      for (const testLog of testLogs) {
        // A stable delivery identity keeps its first persisted content and receipt time.
        if (testLog.participantTestLogId.startsWith("delivery:") && state.participantTestLogs.has(testLog.participantTestLogId)) continue;
        state.participantTestLogs.set(testLog.participantTestLogId, testLog);
      }
    },
    async updateParticipantPresence(input) {
      const result = transitionParticipantPresence(input,
        state.participantPresence.get(input.testRunId) ?? null,
        state.testRuns.get(input.testRunId) ?? null,
        state.participantSessions.get(input.participantSessionId) ?? null,
        Array.from(state.participantTestLogs.values()).reduce((latest, log) =>
          log.testRunId === input.testRunId && log.unitKey === null && !log.participantTestLogId.startsWith("original-test-log:") && log.logKey === "CONNECTION"
            ? Math.max(latest, log.timestamp) : latest, 0));
      if (result.presence) state.participantPresence.set(input.testRunId, result.presence);
      else state.participantPresence.delete(input.testRunId);
      if (result.testLog) state.participantTestLogs.set(result.testLog.participantTestLogId, result.testLog);
      return structuredClone(result);
    },
    async listExpiredParticipantPresence(timestamp, limit) {
      return Array.from(state.participantPresence.values())
        .filter(presence => presence.nextExpiry !== null && presence.nextExpiry <= timestamp)
        .sort((left, right) => left.nextExpiry! - right.nextExpiry!)
        .slice(0, limit).map(({ testRunId, participantSessionId }) => ({ testRunId, participantSessionId }));
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
      guardResultArtifactCollections(state, review);
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
