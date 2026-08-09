import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { createFileFirstSliceRepository } from "./index.js";

describe("createFileFirstSliceRepository", () => {
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

  it("preserves global application settings across repository restarts", async () => {
    const tempDirectory = await mkdtemp(join(tmpdir(), "file-store-settings-"));
    const filePath = join(tempDirectory, "state.json");

    try {
      const repository = createFileFirstSliceRepository(filePath);
      await repository.saveApplicationSettings({
        appTitle: "Assessment Portal",
        mainLogo: "data:image/png;base64,iVBORw0KGgo=",
        themeName: "Sekundar",
        customTexts: { login_subtitle: "Global start" },
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
          customTexts: { login_subtitle: "Global start" },
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
