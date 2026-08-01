import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { createFileFirstSliceRepository } from "./index.js";

describe("createFileFirstSliceRepository", () => {
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
