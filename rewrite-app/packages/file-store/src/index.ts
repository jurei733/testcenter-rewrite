import { createHash, randomUUID } from "node:crypto";
import {
  access,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { dirname, join } from "node:path";

import {
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
  ParticipantRunCommand,
  ParticipantProgressDelivery,
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
  participantAccessCredentials: Record<string, ParticipantAccessCredential>;
  participantRosterEntries: Record<string, ParticipantRosterEntry>;
  operationalLoginMigrationCandidates: Record<
    string,
    OperationalLoginMigrationCandidate[]
  >;
  participantRosterPasswordHashes: Record<string, string>;
  participantLoginAttempts: Record<string, ParticipantLoginAttempt>;
  testRuns: Record<string, TestRun>;
  participantRunCommands: Record<string, ParticipantRunCommand>;
  participantProgressDeliveries: Record<string, ParticipantProgressDelivery>;
  participantTestLogs: Record<string, ParticipantTestLog>;
  participantPresence: Record<string, ParticipantPresence>;
};

type LegacyExternalizedCollectionManifest = {
  version: 1;
  sourcePackageIds: string[];
  contentReleaseIds: string[];
};
type VersionedExternalizedCollectionManifest = {
  version: 2;
  sourcePackageIds: string[];
  contentReleaseIds: string[];
  sourcePackageHashes: Record<string, string>;
  contentReleaseHashes: Record<string, string>;
};
type ExternalizedCollectionManifest = LegacyExternalizedCollectionManifest | VersionedExternalizedCollectionManifest;

type PersistedFirstSliceDocument = Partial<PersistedFirstSliceState> & {
  externalizedCollections?: unknown;
};

type LoadedFirstSliceState = {
  state: PersistedFirstSliceState;
  externalizedCollections: ExternalizedCollectionManifest | null;
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
  participantAccessCredentials: {},
  participantRosterEntries: {},
  operationalLoginMigrationCandidates: {},
  participantRosterPasswordHashes: {},
  participantLoginAttempts: {},
  testRuns: {},
  participantRunCommands: {},
  participantProgressDeliveries: {},
  participantTestLogs: {},
  participantPresence: {}
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
  entityId: string,
  hash?: string
): string =>
  join(
    externalCollectionDirectory(filePath, collectionName),
    `${encodeURIComponent(entityId)}${hash ? `.${hash}` : ""}.json`
  );

const isHashIndex = (value: unknown, ids: string[]): value is Record<string, string> =>
  typeof value === "object" && value !== null && !Array.isArray(value) &&
  Object.keys(value).length === ids.length &&
  ids.every(id => Object.hasOwn(value, id) && typeof (value as Record<string, unknown>)[id] === "string" && /^[a-f0-9]{64}$/.test((value as Record<string, string>)[id]!));

const isExternalizedCollectionManifest = (
  value: unknown
): value is ExternalizedCollectionManifest =>
  typeof value === "object" &&
  value !== null &&
  "version" in value &&
  (value.version === 1 || value.version === 2) &&
  "sourcePackageIds" in value &&
  Array.isArray(value.sourcePackageIds) &&
  value.sourcePackageIds.every(entityId => typeof entityId === "string") &&
  "contentReleaseIds" in value &&
  Array.isArray(value.contentReleaseIds) &&
  value.contentReleaseIds.every(entityId => typeof entityId === "string") &&
  new Set(value.sourcePackageIds).size === value.sourcePackageIds.length &&
  new Set(value.contentReleaseIds).size === value.contentReleaseIds.length &&
  (value.version === 1 || ("sourcePackageHashes" in value && "contentReleaseHashes" in value &&
    isHashIndex(value.sourcePackageHashes, value.sourcePackageIds) && isHashIndex(value.contentReleaseHashes, value.contentReleaseIds)));

const writeJsonAtomically = async (
  targetPath: string,
  value: unknown,
  pretty = false
): Promise<void> => {
  await writeRawAtomically(targetPath, JSON.stringify(value, null, pretty ? 2 : undefined));
};

const writeRawAtomically = async (targetPath: string, raw: string): Promise<void> => {
  await mkdir(dirname(targetPath), { recursive: true });
  const temporaryPath = `${targetPath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, raw, { encoding: "utf8", flag: "wx", flush: true });
    await rename(temporaryPath, targetPath);
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
  }
};

const readExternalizedCollection = async <Value>(input: {
  filePath: string;
  collectionName: "source-packages" | "content-releases";
  entityIds: string[];
  hashes?: Record<string, string>;
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
      externalEntityFilePath(input.filePath, input.collectionName, entityId, input.hashes?.[entityId]),
      "utf8"
    );
    if (input.hashes && createHash("sha256").update(raw).digest("hex") !== input.hashes[entityId]) {
      throw new Error(`Externalized ${input.collectionName} entry '${entityId}' has a hash mismatch.`);
    }
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
    input.entityIds.map(entityId => encodeURIComponent(entityId))
  );
  try {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (
        entry.isFile() &&
        !expectedFileNames.has(entry.name.replace(/\.json$/, "")) &&
        !expectedFileNames.has(entry.name.replace(/\.[a-f0-9]{64}\.json$/, "")) &&
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
  externalizedCollections: ExternalizedCollectionManifest | null;
  dirtySourcePackageIds: Set<string>;
  dirtyContentReleaseIds: Set<string>;
}): Promise<VersionedExternalizedCollectionManifest> => {
  const previous = input.externalizedCollections?.version === 2 ? input.externalizedCollections : null;
  const sourcePackageIds = Object.keys(input.state.sourcePackages).sort();
  const contentReleaseIds = Object.keys(input.state.contentReleases).sort();
  const sourcePackageHashes: Record<string, string> = Object.create(null);
  const contentReleaseHashes: Record<string, string> = Object.create(null);
  const createdPaths: string[] = [];
  const persistCollection = async (collectionName: "source-packages" | "content-releases", ids: string[],
    values: Record<string, unknown>, dirtyIds: Set<string>, previousHashes: Record<string, string> | undefined,
    hashes: Record<string, string>): Promise<void> => {
    for (const id of ids) {
      if (previousHashes && Object.hasOwn(previousHashes, id) && !dirtyIds.has(id)) {
        hashes[id] = previousHashes[id]!;
        continue;
      }
      const raw = JSON.stringify(values[id]);
      const hash = createHash("sha256").update(raw).digest("hex");
      const path = externalEntityFilePath(input.filePath, collectionName, id, hash);
      let exists = true;
      try {
        const existing = await readFile(path, "utf8");
        if (createHash("sha256").update(existing).digest("hex") !== hash) {
          throw new Error(`Externalized ${collectionName} entry '${id}' has a hash mismatch.`);
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        exists = false;
      }
      if (!exists) {
        await writeRawAtomically(path, raw);
        createdPaths.push(path);
      }
      hashes[id] = hash;
    }
  };
  const manifest: VersionedExternalizedCollectionManifest = {
    version: 2, sourcePackageIds, contentReleaseIds, sourcePackageHashes, contentReleaseHashes
  };
  try {
    await persistCollection("source-packages", sourcePackageIds, input.state.sourcePackages,
      input.dirtySourcePackageIds, previous?.sourcePackageHashes, sourcePackageHashes);
    await persistCollection("content-releases", contentReleaseIds, input.state.contentReleases,
      input.dirtyContentReleaseIds, previous?.contentReleaseHashes, contentReleaseHashes);
    // The atomic manifest rename is the publication point for the whole mutation.
    // Existing sidecars are never overwritten before or after that point.
    await writeJsonAtomically(input.filePath, {
      ...input.state, sourcePackages: {}, contentReleases: {}, externalizedCollections: manifest
    }, true);
  } catch (error) {
    await Promise.all(createdPaths.map(path => rm(path, { force: true }).catch(() => undefined)));
    throw error;
  }
  // Keep prior versions of live entities for readers of an earlier manifest.
  // Deletion prunes all versions of removed entities; cleanup failures retry on the next mutation.
  await Promise.all([
    removeUnreferencedExternalFiles({ filePath: input.filePath, collectionName: "source-packages", entityIds: sourcePackageIds }),
    removeUnreferencedExternalFiles({ filePath: input.filePath, collectionName: "content-releases", entityIds: contentReleaseIds })
  ]);
  return manifest;
};

const readStateFromFile = async (
  filePath: string
): Promise<LoadedFirstSliceState> => {
  let manifestRead = false;
  try {
    const raw = await readFile(filePath, "utf8");
    manifestRead = true;
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
        hashes: externalizedCollections.version === 2 ? externalizedCollections.sourcePackageHashes : undefined,
        resolveEntityId: sourcePackage => sourcePackage.sourcePackageId
      });
      state.contentReleases = await readExternalizedCollection<ContentRelease>({
        filePath,
        collectionName: "content-releases",
        entityIds: externalizedCollections.contentReleaseIds,
        hashes: externalizedCollections.version === 2 ? externalizedCollections.contentReleaseHashes : undefined,
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
      externalizedCollections: (externalizedCollections as ExternalizedCollectionManifest | undefined) ?? null
    };
  } catch (error) {
    // Only an absent main manifest initializes a store, never an absent sidecar.
    if (!manifestRead && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return { state: createInitialState(), externalizedCollections: null };
    }
    throw error;
  }
};

const nearestExistingDirectory = async (directory: string): Promise<string> => {
  try {
    const info = await stat(directory);
    if (!info.isDirectory()) throw new Error(`File-store directory '${directory}' is not a directory.`);
    return directory;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT" || dirname(directory) === directory) throw error;
    return nearestExistingDirectory(dirname(directory));
  }
};

const probeAtomicFileWrite = async (directory: string): Promise<void> => {
  // Collection cleanup only considers .json/.tmp; it cannot delete an active probe.
  const from = join(directory, `.readiness-${randomUUID()}.probe`), to = from + ".renamed";
  let created = false, renamed = false;
  try {
    const handle = await open(from, "wx"); created = true;
    try { await handle.writeFile("ready\n", "utf8"); await handle.sync(); }
    finally { await handle.close(); }
    await rename(from, to); renamed = true;
  } finally {
    if (created && !renamed) await rm(from, { force: true });
    if (renamed) await rm(to, { force: true });
  }
};

const checkFileWriterDirectories = async (filePath: string): Promise<void> => {
  const directories = new Set([dirname(filePath)]);
  for (const collection of ["source-packages", "content-releases"] as const) {
    directories.add(await nearestExistingDirectory(externalCollectionDirectory(filePath, collection)));
  }
  for (const directory of directories) await probeAtomicFileWrite(directory);
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
      await checkFileWriterDirectories(filePath);
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
        externalEntityFilePath(filePath, "source-packages", sourcePackageId,
          document.externalizedCollections.version === 2 ? document.externalizedCollections.sourcePackageHashes[sourcePackageId] : undefined)
      );
    }
    for (const contentReleaseId of document.externalizedCollections
      .contentReleaseIds) {
      await access(
        externalEntityFilePath(filePath, "content-releases", contentReleaseId,
          document.externalizedCollections.version === 2 ? document.externalizedCollections.contentReleaseHashes[contentReleaseId] : undefined)
      );
    }
  }
  await checkFileWriterDirectories(filePath);
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
  if (loaded.externalizedCollections?.version !== 2) {
    await persistExternalizedState({
      filePath,
      state: loaded.state,
      externalizedCollections: loaded.externalizedCollections,
      dirtySourcePackageIds: new Set(),
      dirtyContentReleaseIds: new Set()
    });
  }
  return {
    migrated: loaded.externalizedCollections?.version !== 2,
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
  let externalizedCollections: ExternalizedCollectionManifest | null = null;
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
    externalizedCollections = await persistExternalizedState({
      filePath,
      state,
      externalizedCollections,
      dirtySourcePackageIds,
      dirtyContentReleaseIds
    });
    dirtySourcePackageIds.clear();
    dirtyContentReleaseIds.clear();
  };

  const mutate = <Result>(
    updater: (state: PersistedFirstSliceState) => Result
  ): Promise<Result> => {
    const operation = writeQueue.then(async () => {
      const current = await getState();
      // Mutators replace rows or edit collection membership; share immutable row payloads,
      // but isolate every collection map until the manifest has committed.
      const next = Object.fromEntries(Object.entries(current).map(([key, value]) =>
        [key, value && typeof value === "object" ? { ...value } : value])) as PersistedFirstSliceState;
      const sourceDirtyBefore = new Set(dirtySourcePackageIds), releaseDirtyBefore = new Set(dirtyContentReleaseIds);
      try {
        const result = updater(next);
        await persistState(next);
        cachePromise = Promise.resolve(next);
        return result;
      } catch (error) {
        dirtySourcePackageIds.clear(); dirtyContentReleaseIds.clear();
        for (const id of sourceDirtyBefore) dirtySourcePackageIds.add(id);
        for (const id of releaseDirtyBefore) dirtyContentReleaseIds.add(id);
        throw error;
      }
    });
    writeQueue = operation.then(
      () => undefined,
      () => undefined
    );
    return operation;
  };

  const mutateCommandList = <Result>(
    updater: (state: PersistedFirstSliceState) => Result
  ): Promise<Result> => {
    const operation = writeQueue.then(async () => {
      const current = await getState();
      const next = { ...current, participantRunCommands: { ...current.participantRunCommands } };
      const result = updater(next);
      if (result === null) return result;
      await persistState(next);
      // A failed durable receipt must remain pending in the cached state too.
      cachePromise = Promise.resolve(next);
      return result;
    });
    writeQueue = operation.then(() => undefined, () => undefined);
    return operation;
  };

  const mutateParticipantRunApplication = <Result extends { applied: boolean } | null>(
    updater: (state: PersistedFirstSliceState) => Result
  ): Promise<Result> => {
    const operation = writeQueue.then(async () => {
      const current = await getState();
      const next = { ...current, participantRunCommands: { ...current.participantRunCommands },
        participantProgressDeliveries: { ...current.participantProgressDeliveries },
        testRuns: { ...current.testRuns }, participantSessions: { ...current.participantSessions },
        participantTestLogs: { ...current.participantTestLogs }, workspaceActivityEvents: { ...current.workspaceActivityEvents } };
      const result = updater(next);
      if (!result?.applied) return result;
      await persistState(next);
      cachePromise = Promise.resolve(next);
      return result;
    });
    writeQueue = operation.then(() => undefined, () => undefined);
    return operation;
  };

  const mutateControllerActivation = (
    input: Parameters<FirstSliceRepository["activateParticipantController"]>[0]
  ): ReturnType<FirstSliceRepository["activateParticipantController"]> => {
    const operation = writeQueue.then(async () => {
      const current = await getState();
      const result = prepareParticipantControllerActivation(input,
        current.participantSessions[input.participantSessionId] ?? null, current.testRuns[input.testRunId] ?? null);
      if (!result || !result.activated && !result.entryChanged) return result;
      const next = { ...current, participantSessions: result.activated ? { ...current.participantSessions,
        [input.participantSessionId]: structuredClone(result.participantSession) } : current.participantSessions,
        testRuns: result.entryChanged ? { ...current.testRuns, [input.testRunId]: structuredClone(result.testRun) } : current.testRuns };
      await persistState(next);
      cachePromise = Promise.resolve(next);
      return result;
    });
    writeQueue = operation.then(() => undefined, () => undefined);
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
        deleteMatching(state.participantRunCommands, workspaceMatches);
      deleteMatching(state.participantProgressDeliveries, workspaceMatches);
        for (const run of Object.values(state.testRuns)) {
          if (workspaceMatches(run)) delete state.participantPresence[run.testRunId];
        }
        for (const session of Object.values(state.participantSessions)) {
          if (workspaceMatches(session)) delete state.participantAccessCredentials[session.participantSessionId];
        }
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
    async reserveSourcePackageAssembly(input) {
      return mutate(state => {
        const { assembledSourcePackage, assemblyActivityEvent } = input;
        const sourcePackages = Object.values(state.sourcePackages).filter(
          candidate =>
            candidate.tenantId === assembledSourcePackage.tenantId &&
            candidate.workspaceId === assembledSourcePackage.workspaceId
        );
        const activityEvents = Object.values(
          state.workspaceActivityEvents
        ).filter(
          activityEvent =>
            activityEvent.tenantId === assembledSourcePackage.tenantId &&
            activityEvent.workspaceId === assembledSourcePackage.workspaceId
        );
        if (
          assemblyActivityEvent.tenantId !== assembledSourcePackage.tenantId ||
          assemblyActivityEvent.workspaceId !==
            assembledSourcePackage.workspaceId ||
          assemblyActivityEvent.eventType !== "source_package_assembled" ||
          assemblyActivityEvent.subjectId !==
            assembledSourcePackage.sourcePackageId ||
          state.sourcePackages[assembledSourcePackage.sourcePackageId] ||
          state.workspaceActivityEvents[assemblyActivityEvent.activityEventId] ||
          createWorkspaceSourcePackageReferenceRevision({
            sourcePackages,
            activityEvents
          }) !== input.expectedWorkspaceSourcePackageReferenceRevision
        ) {
          return false;
        }
        dirtySourcePackageIds.add(assembledSourcePackage.sourcePackageId);
        state.sourcePackages[assembledSourcePackage.sourcePackageId] =
          assembledSourcePackage;
        state.workspaceActivityEvents[assemblyActivityEvent.activityEventId] =
          assemblyActivityEvent;
        return true;
      });
    },
    async reserveSourcePackageReplacement(input) {
      return mutate(state => {
        const { replacementSourcePackage, replacementActivityEvent } = input;
        const replacedSourcePackage =
          state.sourcePackages[input.replacedSourcePackageId];
        const sourcePackages = Object.values(state.sourcePackages).filter(
          candidate =>
            candidate.tenantId === replacementSourcePackage.tenantId &&
            candidate.workspaceId === replacementSourcePackage.workspaceId
        );
        const activityEvents = Object.values(
          state.workspaceActivityEvents
        ).filter(
          activityEvent =>
            activityEvent.tenantId === replacementSourcePackage.tenantId &&
            activityEvent.workspaceId === replacementSourcePackage.workspaceId
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
        dirtySourcePackageIds.add(replacementSourcePackage.sourcePackageId);
        state.sourcePackages[replacementSourcePackage.sourcePackageId] =
          replacementSourcePackage;
        state.workspaceActivityEvents[replacementActivityEvent.activityEventId] =
          replacementActivityEvent;
        return true;
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
    async getParticipantAccessCredential(participantSessionId) {
      const credential = (await getState()).participantAccessCredentials[participantSessionId];
      return credential ? { ...credential } : null;
    },
    async saveParticipantAccessCredential(credential) {
      await mutate(state => {
        state.participantAccessCredentials[credential.participantSessionId] = { ...credential };
      });
    },
    async revokeParticipantAccessCredential(input) {
      return mutate(state => {
        const current = state.participantAccessCredentials[input.participantSessionId];
        if ((current?.tokenHash ?? null) !== input.expectedTokenHash) return false;
        state.participantAccessCredentials[input.participantSessionId] = {
          participantSessionId: input.participantSessionId, tokenHash: null, updatedAt: input.updatedAt
        };
        return true;
      });
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
    async resetParticipantLoginAttempts(tenantId, workspaceId, loginKey) {
      await mutate(state => {
        delete state.participantLoginAttempts[
          participantLoginAttemptKey(tenantId, workspaceId, loginKey)
        ];
      });
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
    async getOrCreateTestRunForAssignment(candidate, initialize) {
      const result = await mutateParticipantRunApplication(state => {
        const prepared = prepareParticipantAssignmentRunCreation(candidate,
          state.participantSessions[candidate.participantSessionId] ?? null,
          Object.values(state.testRuns), initialize);
        if (prepared.effect) {
          const effect = prepared.effect;
          if (effect.testLogs.some(log => state.participantTestLogs[log.participantTestLogId]) ||
            effect.activityEvents.some(event => state.workspaceActivityEvents[event.activityEventId])) {
            throw new Error("Initial participant artifacts cannot overwrite existing identities.");
          }
          state.testRuns[candidate.testRunId] = effect.testRun;
          for (const log of effect.testLogs) state.participantTestLogs[log.participantTestLogId] = log;
          for (const event of effect.activityEvents) state.workspaceActivityEvents[event.activityEventId] = event;
          if (effect.participantSession) state.participantSessions[candidate.participantSessionId] = effect.participantSession;
        }
        return { testRun: prepared.testRun, created: prepared.created, applied: prepared.created };
      });
      return { testRun: result.testRun, created: result.created };
    },
    async saveTestRun(testRun) {
      await mutate(state => {
        state.testRuns[testRun.testRunId] = testRun;
      });
    },
    activateParticipantController: mutateControllerActivation,
    async appendParticipantRunCommand(input) {
      return mutateCommandList(state => {
        const command = appendParticipantRunCommand(input, state.testRuns[input.testRunId] ?? null, {
          existing: state.participantRunCommands[JSON.stringify([input.testRunId, input.commandId])] ?? null,
          lastSequence: Object.values(state.participantRunCommands)
            .reduce((max, entry) => entry.testRunId === input.testRunId ? Math.max(max, entry.sequence) : max, 0)
        });
        if (command) state.participantRunCommands[JSON.stringify([command.testRunId, command.commandId])] = structuredClone(command);
        return command;
      });
    },
    async listPendingParticipantRunCommands(scope) {
      const state = await getState();
      if (!matchesParticipantRunCommandScope(state.testRuns[scope.testRunId], scope)) return [];
      return structuredClone(Object.values(state.participantRunCommands)
        .filter(command => matchesParticipantRunCommandScope(command, scope) && command.acknowledgedAt === null)
        .sort((a, b) => a.sequence - b.sequence));
    },
    async acknowledgeParticipantRunCommand(input) {
      return mutateCommandList(state => {
        const key = JSON.stringify([input.testRunId, input.commandId]);
        const command = acknowledgeParticipantRunCommand(input, state.testRuns[input.testRunId] ?? null,
          state.participantRunCommands[key] ?? null);
        if (command) state.participantRunCommands[key] = structuredClone(command);
        return command;
      });
    },
    async mutateParticipantRun(input, transform) {
      return mutateParticipantRunApplication(state => {
      const testRun = state.testRuns[input.testRunId];
      const participantSession = state.participantSessions[input.participantSessionId];
      const prepared = prepareParticipantRunMutation(input, testRun && participantSession ? { testRun, participantSession,
        progressDelivery: input.deliveryId ? state.participantProgressDeliveries[JSON.stringify([input.testRunId, input.deliveryId])] ?? null : null,
        testRuns: Object.values(state.testRuns).filter(run => run.participantSessionId === input.participantSessionId) } : null, transform);
      if (prepared?.effect) {
        const effect = prepared.effect;
        const command = effect.commandInput ? appendParticipantRunCommand(effect.commandInput, effect.testRun, {
          existing: state.participantRunCommands[JSON.stringify([input.testRunId, effect.commandInput.commandId])] ?? null,
          lastSequence: Object.values(state.participantRunCommands).reduce((max, entry) => entry.testRunId === input.testRunId ? Math.max(max, entry.sequence) : max, 0)
        }) : null;
        if (effect.commandInput && !command) throw new Error("The Run no longer accepts the projected command.");
        if (command) state.participantRunCommands[JSON.stringify([command.testRunId, command.commandId])] = command;
        if (effect.progressDelivery) state.participantProgressDeliveries[JSON.stringify([input.testRunId, effect.progressDelivery.deliveryId])] = effect.progressDelivery;
        state.testRuns[input.testRunId] = effect.testRun;
        for (const log of effect.testLogs) state.participantTestLogs[log.participantTestLogId] = log;
        for (const event of effect.activityEvents) state.workspaceActivityEvents[event.activityEventId] = event;
        if (effect.participantSession) state.participantSessions[input.participantSessionId] = effect.participantSession;
      }
      return prepared?.result ?? null;
      });
    },
    async applyParticipantRunCommand(input, transform) {
      return mutateParticipantRunApplication(state => {
        const key = JSON.stringify([input.testRunId, input.commandId]);
        const command = state.participantRunCommands[key];
        const testRun = state.testRuns[input.testRunId];
        const participantSession = state.participantSessions[input.participantSessionId];
        const terminal = command?.commandType === "complete" || command?.commandType === "complete_and_lock";
        const prepared = prepareParticipantRunCommandApplication(input,
          command && testRun && participantSession ? { command, testRun, participantSession,
            testRuns: terminal ? Object.values(state.testRuns).filter(run => run.participantSessionId === input.participantSessionId) : [testRun] } : null,
          Object.values(state.participantRunCommands).reduce((max, record) =>
            record.testRunId === input.testRunId ? Math.max(max, record.executionSequence ?? 0) : max, 0), transform);
        if (!prepared) return null;
        if (prepared.effect) {
          const effect = prepared.effect;
          if (effect.testLogs.some(log => state.participantTestLogs[log.participantTestLogId]) ||
              effect.activityEvents.some(event => state.workspaceActivityEvents[event.activityEventId])) {
            throw new Error("A participant command effect cannot overwrite an existing artifact identity.");
          }
          state.testRuns[input.testRunId] = effect.testRun;
          state.participantRunCommands[key] = prepared.result.command;
          for (const log of effect.testLogs) state.participantTestLogs[log.participantTestLogId] = log;
          for (const event of effect.activityEvents) state.workspaceActivityEvents[event.activityEventId] = event;
          if (effect.participantSession) state.participantSessions[input.participantSessionId] = effect.participantSession;
        }
        return structuredClone(prepared.result);
      });
    },
    async deleteTestRunsByIds(testRunIds) {
      let deletedCount = 0;
      await mutate(state => {
        for (const testRunId of testRunIds) {
          delete state.participantPresence[testRunId];
          for (const [key, command] of Object.entries(state.participantRunCommands)) {
            if (command.testRunId === testRunId) delete state.participantRunCommands[key];
          }
          for (const [key, receipt] of Object.entries(state.participantProgressDeliveries)) {
            if (receipt.testRunId === testRunId) delete state.participantProgressDeliveries[key];
          }
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
          if (testLog.participantTestLogId.startsWith("delivery:") && Object.hasOwn(state.participantTestLogs, testLog.participantTestLogId)) continue;
          state.participantTestLogs[testLog.participantTestLogId] = testLog;
        }
      });
    },
    async updateParticipantPresence(input) {
      return mutate(state => {
        const result = transitionParticipantPresence(input,
          state.participantPresence[input.testRunId] ?? null,
          state.testRuns[input.testRunId] ?? null,
          state.participantSessions[input.participantSessionId] ?? null,
          Object.values(state.participantTestLogs).reduce((latest, log) =>
            log.testRunId === input.testRunId && log.unitKey === null && log.logKey === "CONNECTION"
              ? Math.max(latest, log.timestamp) : latest, 0));
        if (result.presence) state.participantPresence[input.testRunId] = result.presence;
        else delete state.participantPresence[input.testRunId];
        if (result.testLog) state.participantTestLogs[result.testLog.participantTestLogId] = result.testLog;
        return structuredClone(result);
      });
    },
    async listExpiredParticipantPresence(timestamp, limit) {
      const state = await getState();
      return Object.values(state.participantPresence)
        .filter(presence => presence.nextExpiry !== null && presence.nextExpiry <= timestamp)
        .sort((left, right) => left.nextExpiry! - right.nextExpiry!)
        .slice(0, limit).map(({ testRunId, participantSessionId }) => ({ testRunId, participantSessionId }));
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
