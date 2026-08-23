import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import type {
  AdminLoginAttempt,
  AdminUser,
  ContentRelease,
  OperationalLoginMigrationCandidate,
  SourcePackage,
  Workspace
} from "@testcenter-rewrite-app/domain";

import {
  checkFileFirstSliceReadiness,
  createFileFirstSliceRepository,
  migrateFileFirstSliceStorage
} from "./index.js";

const largeEntityFilePath = (
  filePath: string,
  collectionName: "source-packages" | "content-releases",
  entityId: string
): string =>
  join(
    `${filePath}.objects`,
    collectionName,
    `${encodeURIComponent(entityId)}.json`
  );

const createLargeEntityFixture = () => {
  const largePayload = "large-original-payload:".repeat(100_000);
  const sourcePackage: SourcePackage = {
    sourcePackageId: "source-package-large",
    tenantId: "tenant-large",
    workspaceId: "workspace-large",
    fileName: "original-package.zip",
    mediaType: "application/zip",
    contentStructure: null,
    sourceDocument: largePayload,
    status: "accepted",
    uploadedAt: "2026-08-10T00:00:00.000Z"
  };
  const contentRelease: ContentRelease = {
    contentReleaseId: "content-release-large",
    tenantId: sourcePackage.tenantId,
    workspaceId: sourcePackage.workspaceId,
    importJobId: "import-job-large",
    releaseLabel: "Original package import",
    runtimeSnapshot: {
      bookletEntries: [],
      playerEntries: [
        {
          playerKey: "player:large",
          html: largePayload
        }
      ]
    },
    status: "staged",
    createdAt: "2026-08-10T00:01:00.000Z",
    activatedAt: null
  };
  return { contentRelease, sourcePackage };
};

describe("createFileFirstSliceRepository", () => {
  it("externalizes large immutable package data without rewriting it for core mutations", async () => {
    const tempDirectory = await mkdtemp(join(tmpdir(), "file-store-large-"));
    const filePath = join(tempDirectory, "state.json");
    const { contentRelease, sourcePackage } = createLargeEntityFixture();
    const sourcePackagePath = largeEntityFilePath(
      filePath,
      "source-packages",
      sourcePackage.sourcePackageId
    );
    const contentReleasePath = largeEntityFilePath(
      filePath,
      "content-releases",
      contentRelease.contentReleaseId
    );

    try {
      const repository = createFileFirstSliceRepository(filePath);
      await repository.saveSourcePackage(sourcePackage);
      await repository.saveContentRelease(contentRelease);

      const coreDocument = JSON.parse(await readFile(filePath, "utf8")) as {
        sourcePackages: Record<string, unknown>;
        contentReleases: Record<string, unknown>;
        externalizedCollections: {
          version: number;
          sourcePackageIds: string[];
          contentReleaseIds: string[];
        };
      };
      assert.deepEqual(coreDocument.sourcePackages, {});
      assert.deepEqual(coreDocument.contentReleases, {});
      assert.deepEqual(coreDocument.externalizedCollections, {
        version: 1,
        sourcePackageIds: [sourcePackage.sourcePackageId],
        contentReleaseIds: [contentRelease.contentReleaseId]
      });
      assert.equal((await stat(filePath)).size < 100_000, true);

      const sourceSidecar = await readFile(sourcePackagePath, "utf8");
      const releaseSidecar = await readFile(contentReleasePath, "utf8");
      await writeFile(sourcePackagePath, `${sourceSidecar}\n`, "utf8");
      await writeFile(contentReleasePath, `${releaseSidecar}\n`, "utf8");
      await repository.saveApplicationSettings({
        appTitle: "Large package portal",
        mainLogo: "app-icon.svg",
        themeName: "Primar",
        introHtml: "",
        legalNoticeHtml: "",
        privacyNotice: "",
        accessibilityNotice: "",
        customTexts: {},
        assetAssignments: {},
        globalWarningText: null,
        globalWarningExpiresAt: null,
        updatedAt: "2026-08-10T00:02:00.000Z",
        updatedByAdminUserId: null
      });
      assert.equal((await readFile(sourcePackagePath, "utf8")).endsWith("\n"), true);
      assert.equal((await readFile(contentReleasePath, "utf8")).endsWith("\n"), true);

      const restarted = createFileFirstSliceRepository(filePath);
      assert.deepEqual(
        await restarted.getSourcePackageById(sourcePackage.sourcePackageId),
        sourcePackage
      );
      assert.deepEqual(
        await restarted.getContentReleaseById(contentRelease.contentReleaseId),
        contentRelease
      );
      await checkFileFirstSliceReadiness(filePath);
      await rm(contentReleasePath);
      await assert.rejects(() => checkFileFirstSliceReadiness(filePath), {
        code: "ENOENT"
      });
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });

  it("migrates legacy inline package data to external collections explicitly", async () => {
    const tempDirectory = await mkdtemp(join(tmpdir(), "file-store-legacy-large-"));
    const filePath = join(tempDirectory, "state.json");
    const { contentRelease, sourcePackage } = createLargeEntityFixture();

    try {
      await writeFile(
        filePath,
        JSON.stringify({
          sourcePackages: {
            [sourcePackage.sourcePackageId]: sourcePackage
          },
          contentReleases: {
            [contentRelease.contentReleaseId]: contentRelease
          }
        }),
        "utf8"
      );
      const repository = createFileFirstSliceRepository(filePath);
      assert.deepEqual(
        await repository.getSourcePackageById(sourcePackage.sourcePackageId),
        sourcePackage
      );
      assert.deepEqual(
        await repository.getContentReleaseById(contentRelease.contentReleaseId),
        contentRelease
      );

      assert.deepEqual(await migrateFileFirstSliceStorage(filePath), {
        migrated: true,
        formatVersion: 1,
        sourcePackageCount: 1,
        contentReleaseCount: 1
      });
      const migratedCore = JSON.parse(await readFile(filePath, "utf8")) as {
        sourcePackages: Record<string, unknown>;
        contentReleases: Record<string, unknown>;
        externalizedCollections?: { version: number };
      };
      assert.deepEqual(migratedCore.sourcePackages, {});
      assert.deepEqual(migratedCore.contentReleases, {});
      assert.equal(migratedCore.externalizedCollections?.version, 1);

      const restarted = createFileFirstSliceRepository(filePath);
      assert.deepEqual(
        await restarted.getSourcePackageById(sourcePackage.sourcePackageId),
        sourcePackage
      );
      assert.deepEqual(
        await restarted.getContentReleaseById(contentRelease.contentReleaseId),
        contentRelease
      );
      assert.deepEqual(await migrateFileFirstSliceStorage(filePath), {
        migrated: false,
        formatVersion: 1,
        sourcePackageCount: 1,
        contentReleaseCount: 1
      });
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });

  it("removes externalized package aggregates after a guarded deletion", async () => {
    const tempDirectory = await mkdtemp(join(tmpdir(), "file-store-delete-large-"));
    const filePath = join(tempDirectory, "state.json");
    const { contentRelease, sourcePackage } = createLargeEntityFixture();
    const sourcePackagePath = largeEntityFilePath(
      filePath,
      "source-packages",
      sourcePackage.sourcePackageId
    );
    const contentReleasePath = largeEntityFilePath(
      filePath,
      "content-releases",
      contentRelease.contentReleaseId
    );

    try {
      const repository = createFileFirstSliceRepository(filePath);
      await repository.saveSourcePackage(sourcePackage);
      await repository.saveImportJob({
        importJobId: contentRelease.importJobId,
        tenantId: sourcePackage.tenantId,
        workspaceId: sourcePackage.workspaceId,
        sourcePackageId: sourcePackage.sourcePackageId,
        status: "completed",
        createdAt: "2026-08-10T00:00:30.000Z",
        finishedAt: "2026-08-10T00:01:00.000Z",
        diagnostics: []
      });
      await repository.saveContentRelease(contentRelease);
      assert.equal(
        await repository.deleteSourcePackageAggregate({
          tenantId: sourcePackage.tenantId,
          workspaceId: sourcePackage.workspaceId,
          sourcePackageId: sourcePackage.sourcePackageId,
          expectedImportJobIds: [contentRelease.importJobId],
          expectedContentReleaseIds: [contentRelease.contentReleaseId]
        }),
        true
      );
      await assert.rejects(() => stat(sourcePackagePath), { code: "ENOENT" });
      await assert.rejects(() => stat(contentReleasePath), { code: "ENOENT" });

      const restarted = createFileFirstSliceRepository(filePath);
      assert.equal(
        await restarted.getSourcePackageById(sourcePackage.sourcePackageId),
        null
      );
      assert.equal(
        await restarted.getContentReleaseById(contentRelease.contentReleaseId),
        null
      );
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });

  it("persists a renamed workspace without changing its stable identity", async () => {
    const tempDirectory = await mkdtemp(join(tmpdir(), "file-store-workspace-"));
    const filePath = join(tempDirectory, "state.json");
    const workspace: Workspace = {
      workspaceId: "workspace-stable-id",
      tenantId: "tenant-stable-id",
      workspaceKey: "stable-key",
      displayName: "Original Workspace",
      status: "active",
      createdAt: "2026-08-09T00:00:00.000Z"
    };

    try {
      const repository = createFileFirstSliceRepository(filePath);
      await repository.saveWorkspace({
        tenantKey: "stable-tenant",
        workspaceKey: workspace.workspaceKey,
        workspace
      });
      await repository.saveWorkspace({
        tenantKey: "stable-tenant",
        workspaceKey: workspace.workspaceKey,
        workspace: { ...workspace, displayName: "Renamed Workspace" }
      });

      assert.deepEqual(
        await createFileFirstSliceRepository(filePath).getWorkspaceByScope(
          "stable-tenant",
          workspace.workspaceKey
        ),
        { ...workspace, displayName: "Renamed Workspace" }
      );
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });

  it("preserves and deletes attachment images across repository restarts", async () => {
    const tempDirectory = await mkdtemp(join(tmpdir(), "file-store-attachments-"));
    const filePath = join(tempDirectory, "state.json");
    const attachmentFile = {
      attachmentFileId: "image:file-store.png",
      attachmentId: "att-file-store",
      tenantId: "tenant-file-store",
      workspaceId: "workspace-file-store",
      fileName: "capture.png",
      mediaType: "image/png" as const,
      dataBase64: "iVBORw0KGgo=",
      createdAt: "2026-08-08T20:00:00.000Z"
    };

    try {
      await createFileFirstSliceRepository(filePath).saveAttachmentFile(
        attachmentFile
      );
      const restarted = createFileFirstSliceRepository(filePath);
      assert.deepEqual(
        await restarted.listAttachmentFilesByWorkspace(
          attachmentFile.tenantId,
          attachmentFile.workspaceId
        ),
        [attachmentFile]
      );
      assert.deepEqual(
        await restarted.getAttachmentFileById(
          attachmentFile.attachmentFileId
        ),
        attachmentFile
      );
      assert.equal(
        await restarted.deleteAttachmentFile(attachmentFile.attachmentFileId),
        true
      );
      assert.equal(
        await createFileFirstSliceRepository(filePath).getAttachmentFileById(
          attachmentFile.attachmentFileId
        ),
        null
      );
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });

  it("persists and replaces operational login migration candidates", async () => {
    const tempDirectory = await mkdtemp(join(tmpdir(), "file-store-operational-"));
    const filePath = join(tempDirectory, "state.json");
    const candidate: OperationalLoginMigrationCandidate = {
      loginKey: "system-check-migration",
      loginMode: "sys-check-login",
      groupKey: "group:operations",
      passwordRequired: true,
      profileIds: [],
      monitorProfiles: [],
      monitorBookletVisibility: "hidden",
      customTexts: { systemcheck_intro: "Imported check" },
      unresolvedProfileIds: [],
      validForMinutes: 30
    };

    try {
      await createFileFirstSliceRepository(
        filePath
      ).replaceOperationalLoginMigrationCandidatesByWorkspace(
        "tenant-operational",
        "workspace-operational",
        [candidate]
      );
      const restarted = createFileFirstSliceRepository(filePath);
      assert.deepEqual(
        await restarted.listOperationalLoginMigrationCandidatesByWorkspace(
          "tenant-operational",
          "workspace-operational"
        ),
        [candidate]
      );
      await restarted.replaceOperationalLoginMigrationCandidatesByWorkspace(
        "tenant-operational",
        "workspace-operational",
        []
      );
      assert.deepEqual(
        await createFileFirstSliceRepository(
          filePath
        ).listOperationalLoginMigrationCandidatesByWorkspace(
          "tenant-operational",
          "workspace-operational"
        ),
        []
      );
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });

  it("persists administrator-set password change requirements", async () => {
    const tempDirectory = await mkdtemp(join(tmpdir(), "file-store-admin-password-"));
    const filePath = join(tempDirectory, "state.json");
    const adminUser: AdminUser = {
      adminUserId: "password-change-required",
      username: "workspace.password.change",
      displayName: "Workspace Password Change",
      passwordHash: "stored-password-hash",
      passwordChangeRequired: true,
      status: "active",
      customTexts: {},
      validFrom: null,
      validTo: null,
      validForMinutes: null,
      firstSignedInAt: null,
      createdAt: "2026-08-09T00:00:00.000Z"
    };

    try {
      await createFileFirstSliceRepository(filePath).saveAdminUser(adminUser);
      assert.deepEqual(
        await createFileFirstSliceRepository(filePath).getAdminUserById(
          adminUser.adminUserId
        ),
        adminUser
      );
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });

  it("persists and atomically advances admin login failures", async () => {
    const tempDirectory = await mkdtemp(join(tmpdir(), "file-store-admin-login-"));
    const filePath = join(tempDirectory, "state.json");

    try {
      const firstAttempt = await createFileFirstSliceRepository(
        filePath
      ).recordAdminLoginFailure({
        username: "sink.admin",
        attemptedAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2026-01-01T00:30:00.000Z"
      });
      assert.equal(firstAttempt.failedAttempts, 1);

      const restarted = createFileFirstSliceRepository(filePath);
      const secondAttempt = await restarted.recordAdminLoginFailure({
        username: "sink.admin",
        attemptedAt: "2026-01-01T00:01:00.000Z",
        expiresAt: "2026-01-01T00:31:00.000Z"
      });
      assert.equal(secondAttempt.failedAttempts, 2);
      assert.deepEqual(
        await createFileFirstSliceRepository(filePath).getAdminLoginAttempt(
          "sink.admin"
        ),
        secondAttempt satisfies AdminLoginAttempt
      );

      const resetAttempt = await restarted.recordAdminLoginFailure({
        username: "sink.admin",
        attemptedAt: "2026-01-01T01:00:00.000Z",
        expiresAt: "2026-01-01T01:30:00.000Z"
      });
      assert.equal(resetAttempt.failedAttempts, 1);
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });

  it("persists and atomically consumes proof-of-work challenges", async () => {
    const tempDirectory = await mkdtemp(join(tmpdir(), "file-store-proof-"));
    const filePath = join(tempDirectory, "state.json");
    try {
      const repository = createFileFirstSliceRepository(filePath);
      const input = {
        challengeId: "challenge:file-store",
        consumedAt: "2026-08-23T12:00:00.000Z",
        expiresAt: "2099-08-23T12:02:00.000Z"
      };
      const attempts = await Promise.all(
        Array.from({ length: 8 }, () =>
          repository.consumeProofOfWorkChallenge(input)
        )
      );
      assert.equal(attempts.filter(Boolean).length, 1);

      const restarted = createFileFirstSliceRepository(filePath);
      assert.equal(
        await restarted.consumeProofOfWorkChallenge(input),
        false
      );
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });

  it("preserves global application settings across repository restarts", async () => {
    const tempDirectory = await mkdtemp(join(tmpdir(), "file-store-settings-"));
    const filePath = join(tempDirectory, "state.json");

    try {
      const repository = createFileFirstSliceRepository(filePath);
      await repository.saveApplicationSettings({
        appTitle: "Assessment Portal",
        mainLogo: "data:image/png;base64,iVBORw0KGgo=",
        themeName: "Sekundar",
        introHtml: "<p>Welcome to the assessment.</p>",
        legalNoticeHtml: "<p>Provider: Assessment Institute</p>",
        privacyNotice: "<p>Privacy contact</p>",
        accessibilityNotice: "<p>Accessibility statement</p>",
        customTexts: { login_subtitle: "Global start" },
        assetAssignments: {},
        globalWarningText: "Maintenance tonight",
        globalWarningExpiresAt: "2050-12-12T18:00:00.000Z",
        updatedAt: "2026-08-08T20:00:00.000Z",
        updatedByAdminUserId: "platform-admin"
      });

      assert.deepEqual(
        await createFileFirstSliceRepository(filePath).getApplicationSettings(),
        {
          appTitle: "Assessment Portal",
          mainLogo: "data:image/png;base64,iVBORw0KGgo=",
          themeName: "Sekundar",
          introHtml: "<p>Welcome to the assessment.</p>",
          legalNoticeHtml: "<p>Provider: Assessment Institute</p>",
          privacyNotice: "<p>Privacy contact</p>",
          accessibilityNotice: "<p>Accessibility statement</p>",
          customTexts: { login_subtitle: "Global start" },
          assetAssignments: {},
          globalWarningText: "Maintenance tonight",
          globalWarningExpiresAt: "2050-12-12T18:00:00.000Z",
          updatedAt: "2026-08-08T20:00:00.000Z",
          updatedByAdminUserId: "platform-admin"
        }
      );
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });

  it("normalizes legacy application settings with current defaults", async () => {
    const tempDirectory = await mkdtemp(join(tmpdir(), "file-store-branding-"));
    const filePath = join(tempDirectory, "state.json");

    try {
      await writeFile(
        filePath,
        JSON.stringify({
          applicationSettings: {
            appTitle: "Legacy Portal",
            globalWarningText: null,
            globalWarningExpiresAt: null,
            updatedAt: "2026-08-08T20:00:00.000Z",
            updatedByAdminUserId: "legacy-admin"
          }
        }),
        "utf8"
      );
      const settings =
        await createFileFirstSliceRepository(filePath).getApplicationSettings();
      assert.equal(settings?.appTitle, "Legacy Portal");
      assert.equal(settings?.mainLogo, "app-icon.svg");
      assert.equal(settings?.themeName, "Primar");
      assert.equal(settings?.introHtml, "");
      assert.equal(settings?.legalNoticeHtml, "");
      assert.equal(settings?.privacyNotice, "");
      assert.equal(settings?.accessibilityNotice, "");
      assert.deepEqual(settings?.customTexts, {});
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });

  it("normalizes legacy admin users without access windows", async () => {
    const tempDirectory = await mkdtemp(join(tmpdir(), "file-store-admin-"));
    const filePath = join(tempDirectory, "state.json");

    try {
      await writeFile(
        filePath,
        JSON.stringify({
          adminUsers: {
            "admin-user-id": {
              adminUserId: "admin-user-id",
              username: "legacy.admin",
              displayName: "Legacy Admin",
              passwordHash: "stored-password-hash",
              status: "active",
              createdAt: "2026-01-01T00:00:00.000Z"
            }
          },
          adminRoleAssignments: {
            "legacy-role": {
              roleAssignmentId: "legacy-role",
              adminUserId: "admin-user-id",
              role: "group_monitor",
              tenantId: "tenant-id",
              workspaceId: "workspace-id",
              groupKey: "group:legacy",
              createdAt: "2026-01-01T00:00:00.000Z"
            }
          }
        }),
        "utf8"
      );

      const repository = createFileFirstSliceRepository(filePath);
      const [adminUser] = await repository.listAdminUsers();

      assert.equal(adminUser?.username, "legacy.admin");
      assert.equal(adminUser?.validFrom, null);
      assert.equal(adminUser?.validTo, null);
      assert.equal(adminUser?.validForMinutes, null);
      assert.equal(adminUser?.firstSignedInAt, null);
      assert.deepEqual(adminUser?.customTexts, {});
      assert.equal(adminUser?.passwordChangeRequired, false);
      const [roleAssignment] =
        await repository.listAdminRoleAssignmentsByUserId("admin-user-id");
      assert.equal(roleAssignment?.accessMode, "read_write");
      assert.deepEqual(roleAssignment?.monitorProfiles, []);
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });

  it("normalizes legacy participant roster password flags from hash storage", async () => {
    const tempDirectory = await mkdtemp(join(tmpdir(), "file-store-roster-"));
    const filePath = join(tempDirectory, "state.json");

    try {
      await writeFile(
        filePath,
        JSON.stringify({
          participantRosterEntries: {
            "entry-protected": {
              participantRosterEntryId: "entry-protected",
              tenantId: "tenant-id",
              workspaceId: "workspace-id",
              loginKey: "protected-student",
              groupKey: "group:protected",
              bookletKey: null,
              displayName: "Protected Student",
              importedAt: "2026-01-01T00:00:00.000Z"
            },
            "entry-open": {
              participantRosterEntryId: "entry-open",
              tenantId: "tenant-id",
              workspaceId: "workspace-id",
              loginKey: "open-student",
              groupKey: "group:open",
              bookletKey: null,
              displayName: "Open Student",
              importedAt: "2026-01-01T00:00:00.000Z"
            }
          },
          participantRosterPasswordHashes: {
            "tenant-id::workspace-id::protected-student": "stored-password-hash"
          }
        }),
        "utf8"
      );

      const repository = createFileFirstSliceRepository(filePath);
      const entries = await repository.listParticipantRosterEntriesByWorkspace(
        "tenant-id",
        "workspace-id"
      );

      assert.equal(
        entries.find(entry => entry.loginKey === "protected-student")
          ?.passwordRequired,
        true
      );
      assert.equal(
        entries.find(entry => entry.loginKey === "open-student")?.passwordRequired,
        false
      );
      assert.deepEqual(
        entries.find(entry => entry.loginKey === "protected-student")?.customTexts,
        {}
      );
      assert.equal(
        await repository.getParticipantRosterPasswordHash(
          "tenant-id",
          "workspace-id",
          "protected-student"
        ),
        "stored-password-hash"
      );
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });
});
