import { randomUUID } from "node:crypto";
import {
  access,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile
} from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  createWorkspaceSourcePackageReferenceRevision,
  type FirstSliceRepository
} from "@testcenter-rewrite-app/application";
import {
  defaultApplicationSettings,
  selectLatestParticipantTestStateLogs
} from "@testcenter-rewrite-app/domain";
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

type PersistedFirstSliceState = {
  applicationSettings: ApplicationSettings | null;
  applicationAssets: Record<string, ApplicationAsset>;
  attachmentFiles: Record<string, AttachmentFile>;
  adminUsers: Record<string, AdminUser>;
  adminLoginAttempts: Record<string, AdminLoginAttempt>;
  proofOfWorkChallenges: Record<
    string,
    { consumedAt: string; expiresAt: string }
  >;
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
  operationalLoginMigrationCandidates: Record<
    string,
    OperationalLoginMigrationCandidate[]
  >;
  participantRosterPasswordHashes: Record<string, string>;
  participantLoginAttempts: Record<string, ParticipantLoginAttempt>;
  testRuns: Record<string, TestRun>;
  participantTestLogs: Record<string, ParticipantTestLog>;
};

type ExternalizedCollectionManifest = {
  version: 1;
  sourcePackageIds: string[];
  contentReleaseIds: string[];
};

type PersistedFirstSliceDocument = Partial<PersistedFirstSliceState> & {
  externalizedCollections?: unknown;
};

type LoadedFirstSliceState = {
  state: PersistedFirstSliceState;
  externalizedCollections: boolean;
};

const createInitialState = (): PersistedFirstSliceState => ({
  applicationSettings: null,
  applicationAssets: {},
  attachmentFiles: {},
  adminUsers: {},
  adminLoginAttempts: {},
  proofOfWorkChallenges: {},
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
  operationalLoginMigrationCandidates: {},
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

const externalCollectionDirectory = (
  filePath: string,
  collectionName: "source-packages" | "content-releases"
): string => join(`${filePath}.objects`, collectionName);

const externalEntityFilePath = (
  filePath: string,
  collectionName: "source-packages" | "content-releases",
  entityId: string
): string =>
  join(
    externalCollectionDirectory(filePath, collectionName),
    `${encodeURIComponent(entityId)}.json`
  );

const isExternalizedCollectionManifest = (
  value: unknown
): value is ExternalizedCollectionManifest =>
  typeof value === "object" &&
  value !== null &&
  "version" in value &&
  value.version === 1 &&
  "sourcePackageIds" in value &&
  Array.isArray(value.sourcePackageIds) &&
  value.sourcePackageIds.every(entityId => typeof entityId === "string") &&
  "contentReleaseIds" in value &&
  Array.isArray(value.contentReleaseIds) &&
  value.contentReleaseIds.every(entityId => typeof entityId === "string");

const writeJsonAtomically = async (
  targetPath: string,
  value: unknown,
  pretty = false
): Promise<void> => {
  await mkdir(dirname(targetPath), { recursive: true });
  const temporaryPath = `${targetPath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(
      temporaryPath,
      JSON.stringify(value, null, pretty ? 2 : undefined),
      "utf8"
    );
    await rename(temporaryPath, targetPath);
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
  }
};

const readExternalizedCollection = async <Value>(input: {
  filePath: string;
  collectionName: "source-packages" | "content-releases";
  entityIds: string[];
  resolveEntityId: (value: Value) => string;
}): Promise<Record<string, Value>> => {
  const values: Record<string, Value> = {};
  const seenEntityIds = new Set<string>();
  for (const entityId of input.entityIds) {
    if (seenEntityIds.has(entityId)) {
      throw new Error(
        `Duplicate '${entityId}' in externalized ${input.collectionName} manifest.`
      );
    }
    seenEntityIds.add(entityId);
    const raw = await readFile(
      externalEntityFilePath(input.filePath, input.collectionName, entityId),
      "utf8"
    );
    const value = JSON.parse(raw) as Value;
    if (input.resolveEntityId(value) !== entityId) {
      throw new Error(
        `Externalized ${input.collectionName} entry '${entityId}' has a mismatched identity.`
      );
    }
    values[entityId] = value;
  }
  return values;
};

const removeUnreferencedExternalFiles = async (input: {
  filePath: string;
  collectionName: "source-packages" | "content-releases";
  entityIds: string[];
}): Promise<void> => {
  const directory = externalCollectionDirectory(
    input.filePath,
    input.collectionName
  );
  const expectedFileNames = new Set(
    input.entityIds.map(entityId => `${encodeURIComponent(entityId)}.json`)
  );
  try {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (
        entry.isFile() &&
        !expectedFileNames.has(entry.name) &&
        (entry.name.endsWith(".json") || entry.name.endsWith(".tmp"))
      ) {
        await rm(join(directory, entry.name), { force: true });
      }
    }
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return;
    }
    // The manifest is authoritative, so stale sidecars are harmless and can be
    // retried by the next successful mutation.
  }
};

const persistExternalizedState = async (input: {
  filePath: string;
  state: PersistedFirstSliceState;
  externalizedCollections: boolean;
  dirtySourcePackageIds: Set<string>;
  dirtyContentReleaseIds: Set<string>;
}): Promise<void> => {
  const sourcePackageIds = Object.keys(input.state.sourcePackages).sort();
  const contentReleaseIds = Object.keys(input.state.contentReleases).sort();
  const sourcePackageIdsToWrite = input.externalizedCollections
    ? [...input.dirtySourcePackageIds].filter(
        entityId => input.state.sourcePackages[entityId]
      )
    : sourcePackageIds;
  const contentReleaseIdsToWrite = input.externalizedCollections
    ? [...input.dirtyContentReleaseIds].filter(
        entityId => input.state.contentReleases[entityId]
      )
    : contentReleaseIds;

  for (const sourcePackageId of sourcePackageIdsToWrite) {
    await writeJsonAtomically(
      externalEntityFilePath(
        input.filePath,
        "source-packages",
        sourcePackageId
      ),
      input.state.sourcePackages[sourcePackageId]
    );
  }
  for (const contentReleaseId of contentReleaseIdsToWrite) {
    await writeJsonAtomically(
      externalEntityFilePath(
        input.filePath,
        "content-releases",
        contentReleaseId
      ),
      input.state.contentReleases[contentReleaseId]
    );
  }

  const manifest: ExternalizedCollectionManifest = {
    version: 1,
    sourcePackageIds,
    contentReleaseIds
  };
  await writeJsonAtomically(
    input.filePath,
    {
      ...input.state,
      sourcePackages: {},
      contentReleases: {},
      externalizedCollections: manifest
    },
    true
  );
  await Promise.all([
    removeUnreferencedExternalFiles({
      filePath: input.filePath,
      collectionName: "source-packages",
      entityIds: sourcePackageIds
    }),
    removeUnreferencedExternalFiles({
      filePath: input.filePath,
      collectionName: "content-releases",
      entityIds: contentReleaseIds
    })
  ]);
};

const readStateFromFile = async (
  filePath: string
): Promise<LoadedFirstSliceState> => {
  try {
    const raw = await readFile(filePath, "utf8");
    const document = JSON.parse(raw) as PersistedFirstSliceDocument;
    const { externalizedCollections, ...inlineState } = document;
    const state: PersistedFirstSliceState = {
      ...createInitialState(),
      ...(inlineState as Partial<PersistedFirstSliceState>)
    };
    if (externalizedCollections !== undefined) {
      if (!isExternalizedCollectionManifest(externalizedCollections)) {
        throw new Error("Invalid externalized file-store collection manifest.");
      }
      state.sourcePackages = await readExternalizedCollection<SourcePackage>({
        filePath,
        collectionName: "source-packages",
        entityIds: externalizedCollections.sourcePackageIds,
        resolveEntityId: sourcePackage => sourcePackage.sourcePackageId
      });
      state.contentReleases = await readExternalizedCollection<ContentRelease>({
        filePath,
        collectionName: "content-releases",
        entityIds: externalizedCollections.contentReleaseIds,
        resolveEntityId: contentRelease => contentRelease.contentReleaseId
      });
    }
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
        privacyNotice:
          typeof state.applicationSettings.privacyNotice === "string"
            ? state.applicationSettings.privacyNotice
            : defaultApplicationSettings.privacyNotice,
        accessibilityNotice:
          typeof state.applicationSettings.accessibilityNotice === "string"
            ? state.applicationSettings.accessibilityNotice
            : defaultApplicationSettings.accessibilityNotice,
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
          passwordChangeRequired: adminUser.passwordChangeRequired ?? false,
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
          viewSettings:
            entry.viewSettings &&
            typeof entry.viewSettings === "object" &&
            !Array.isArray(entry.viewSettings)
              ? entry.viewSettings
              : {},
          ...(entry.assetAssignments &&
            typeof entry.assetAssignments === "object" &&
            !Array.isArray(entry.assetAssignments)
            ? {
                assetAssignments: Object.fromEntries(
                  Object.entries(entry.assetAssignments).filter(
                    (assignment): assignment is [string, string] =>
                      typeof assignment[1] === "string"
                  )
                )
              }
            : {}),
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
    return {
      state,
      externalizedCollections: externalizedCollections !== undefined
    };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return {
        state: createInitialState(),
        externalizedCollections: false
      };
    }

    throw error;
  }
};

export const checkFileFirstSliceReadiness = async (
  filePath: string
): Promise<void> => {
  await mkdir(dirname(filePath), { recursive: true });

  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
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
  const document = JSON.parse(raw) as PersistedFirstSliceDocument;
  if (document.externalizedCollections !== undefined) {
    if (!isExternalizedCollectionManifest(document.externalizedCollections)) {
      throw new Error("Invalid externalized file-store collection manifest.");
    }
    for (const sourcePackageId of document.externalizedCollections
      .sourcePackageIds) {
      await access(
        externalEntityFilePath(filePath, "source-packages", sourcePackageId)
      );
    }
    for (const contentReleaseId of document.externalizedCollections
      .contentReleaseIds) {
      await access(
        externalEntityFilePath(filePath, "content-releases", contentReleaseId)
      );
    }
  }
};

export const migrateFileFirstSliceStorage = async (
  filePath: string
): Promise<{
  migrated: boolean;
  formatVersion: 1;
  sourcePackageCount: number;
  contentReleaseCount: number;
}> => {
  const loaded = await readStateFromFile(filePath);
  const sourcePackageCount = Object.keys(loaded.state.sourcePackages).length;
  const contentReleaseCount = Object.keys(loaded.state.contentReleases).length;
  if (!loaded.externalizedCollections) {
    await persistExternalizedState({
      filePath,
      state: loaded.state,
      externalizedCollections: false,
      dirtySourcePackageIds: new Set(),
      dirtyContentReleaseIds: new Set()
    });
  }
  return {
    migrated: !loaded.externalizedCollections,
    formatVersion: 1,
    sourcePackageCount,
    contentReleaseCount
  };
};

export const createFileFirstSliceRepository = (
  filePath: string
): FirstSliceRepository => {
  let cachePromise: Promise<PersistedFirstSliceState> | null = null;
  let writeQueue: Promise<void> = Promise.resolve();
  let externalizedCollections = false;
  const dirtySourcePackageIds = new Set<string>();
  const dirtyContentReleaseIds = new Set<string>();

  const getState = async (): Promise<PersistedFirstSliceState> => {
    cachePromise ??= readStateFromFile(filePath).then(loaded => {
      externalizedCollections = loaded.externalizedCollections;
      return loaded.state;
    });
    return cachePromise;
  };

  const persistState = async (state: PersistedFirstSliceState): Promise<void> => {
    await persistExternalizedState({
      filePath,
      state,
      externalizedCollections,
      dirtySourcePackageIds,
      dirtyContentReleaseIds
    });
    externalizedCollections = true;
    dirtySourcePackageIds.clear();
    dirtyContentReleaseIds.clear();
  };

  const mutate = <Result>(
    updater: (state: PersistedFirstSliceState) => Result
  ): Promise<Result> => {
    const operation = writeQueue.then(async () => {
      const state = await getState();
      const result = updater(state);
      await persistState(state);
      return result;
    });
    writeQueue = operation.then(
      () => undefined,
      () => undefined
    );
    return operation;
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
    async listApplicationAssets() {
      const state = await getState();
      return Object.values(state.applicationAssets);
    },
    async getApplicationAssetById(applicationAssetId) {
      const state = await getState();
      return state.applicationAssets[applicationAssetId] ?? null;
    },
    async getApplicationAssetByOriginalName(originalName) {
      const state = await getState();
      return (
        Object.values(state.applicationAssets).find(
          asset => asset.originalName === originalName
        ) ?? null
      );
    },
    async saveApplicationAsset(applicationAsset) {
      await mutate(state => {
        state.applicationAssets[applicationAsset.applicationAssetId] =
          applicationAsset;
      });
    },
    async deleteApplicationAsset(applicationAssetId) {
      let deleted = false;
      await mutate(state => {
        if (state.applicationAssets[applicationAssetId]) {
          delete state.applicationAssets[applicationAssetId];
          deleted = true;
        }
      });
      return deleted;
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
    async getAdminLoginAttempt(username) {
      const state = await getState();
      return state.adminLoginAttempts[username] ?? null;
    },
    async recordAdminLoginFailure(input) {
      let result: AdminLoginAttempt | null = null;
      await mutate(state => {
        const current = state.adminLoginAttempts[input.username];
        result = {
          username: input.username,
          failedAttempts:
            !current || current.expiresAt <= input.attemptedAt
              ? 1
              : current.failedAttempts + 1,
          expiresAt: input.expiresAt,
          updatedAt: input.attemptedAt
        };
        state.adminLoginAttempts[input.username] = result;
      });
      if (!result) {
        throw new Error("Admin login failure could not be persisted.");
      }
      return result;
    },
    async consumeProofOfWorkChallenge(input) {
      let consumed = false;
      await mutate(state => {
        for (const [challengeId, challenge] of Object.entries(
          state.proofOfWorkChallenges
        )) {
          if (challenge.expiresAt <= input.consumedAt) {
            delete state.proofOfWorkChallenges[challengeId];
          }
        }
        if (state.proofOfWorkChallenges[input.challengeId]) {
          return;
        }
        state.proofOfWorkChallenges[input.challengeId] = {
          consumedAt: input.consumedAt,
          expiresAt: input.expiresAt
        };
        consumed = true;
      });
      return consumed;
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
        for (const sourcePackage of Object.values(state.sourcePackages)) {
          if (workspaceMatches(sourcePackage)) {
            dirtySourcePackageIds.add(sourcePackage.sourcePackageId);
          }
        }
        for (const contentRelease of Object.values(state.contentReleases)) {
          if (workspaceMatches(contentRelease)) {
            dirtyContentReleaseIds.add(contentRelease.contentReleaseId);
          }
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
        for (const key of Object.keys(state.participantRosterPasswordHashes)) {
          if (key.startsWith(`${input.tenantId}::${input.workspaceId}::`)) {
            delete state.participantRosterPasswordHashes[key];
          }
        }
        delete state.operationalLoginMigrationCandidates[
          `${input.tenantId}::${input.workspaceId}`
        ];
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
        dirtySourcePackageIds.add(sourcePackage.sourcePackageId);
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
        const workspaceSourcePackageReferenceRevision =
          createWorkspaceSourcePackageReferenceRevision({
            sourcePackages: Object.values(state.sourcePackages).filter(
              candidate =>
                candidate.tenantId === input.tenantId &&
                candidate.workspaceId === input.workspaceId
            ),
            activityEvents: Object.values(state.workspaceActivityEvents).filter(
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
          Object.values(state.participantSessions).some(participantSession =>
            contentReleaseIds.has(participantSession.contentReleaseId)
          ) ||
          Object.values(state.testRuns).some(testRun =>
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
          dirtyContentReleaseIds.add(contentReleaseId);
          delete state.contentReleases[contentReleaseId];
        }
        for (const importJobId of importJobIds) {
          delete state.importJobs[importJobId];
        }
        dirtySourcePackageIds.add(input.sourcePackageId);
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
        dirtyContentReleaseIds.add(contentRelease.contentReleaseId);
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
    async listOperationalLoginMigrationCandidatesByWorkspace(
      tenantId,
      workspaceId
    ) {
      const state = await getState();
      return (
        state.operationalLoginMigrationCandidates[
          `${tenantId}::${workspaceId}`
        ] ?? []
      );
    },
    async replaceOperationalLoginMigrationCandidatesByWorkspace(
      tenantId,
      workspaceId,
      candidates
    ) {
      await mutate(state => {
        state.operationalLoginMigrationCandidates[
          `${tenantId}::${workspaceId}`
        ] = candidates;
      });
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
    async listLatestParticipantTestStateLogsByWorkspace(
      tenantId,
      workspaceId,
      logKeys
    ) {
      const state = await getState();
      return selectLatestParticipantTestStateLogs(
        Object.values(state.participantTestLogs).filter(
          testLog =>
            testLog.tenantId === tenantId && testLog.workspaceId === workspaceId
        ),
        logKeys
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
