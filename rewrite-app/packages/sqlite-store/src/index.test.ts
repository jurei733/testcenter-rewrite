import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import type {
  AdminLoginAttempt,
  AdminRoleAssignment,
  AdminUser,
  ApplicationAsset,
  OperationalLoginMigrationCandidate,
  ParticipantRosterEntry,
  TestRun,
  Workspace
} from "@testcenter-rewrite-app/domain";

import { createSqliteFirstSliceRepository } from "./index.js";

test("SQLite preserves global application assets across repository restarts", async () => {
  const tempDirectory = await mkdtemp(join(tmpdir(), "sqlite-app-assets-"));
  const databasePath = join(tempDirectory, "application-assets.sqlite");
  const applicationAsset: ApplicationAsset = {
    applicationAssetId: "asset:school-logo",
    originalName: "school.png",
    mediaType: "image/png",
    dataBase64: "iVBORw0KGgo=",
    byteLength: 8,
    createdAt: "2026-08-12T00:00:00.000Z",
    updatedAt: "2026-08-12T00:00:00.000Z"
  };
  try {
    await createSqliteFirstSliceRepository(databasePath).saveApplicationAsset(
      applicationAsset
    );
    const restarted = createSqliteFirstSliceRepository(databasePath);
    assert.deepEqual(await restarted.listApplicationAssets(), [applicationAsset]);
    assert.deepEqual(
      await restarted.getApplicationAssetByOriginalName("school.png"),
      applicationAsset
    );
    assert.equal(
      await restarted.deleteApplicationAsset(applicationAsset.applicationAssetId),
      true
    );
    assert.equal(
      await restarted.getApplicationAssetById(applicationAsset.applicationAssetId),
      null
    );
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
});

test("SQLite persists a renamed workspace without changing its stable identity", async () => {
  const tempDirectory = await mkdtemp(join(tmpdir(), "sqlite-workspace-"));
  const databasePath = join(tempDirectory, "workspace.sqlite");
  const workspace: Workspace = {
    workspaceId: "workspace-stable-id",
    tenantId: "tenant-stable-id",
    workspaceKey: "stable-key",
    displayName: "Original Workspace",
    status: "active",
    createdAt: "2026-08-09T00:00:00.000Z"
  };

  try {
    const repository = createSqliteFirstSliceRepository(databasePath);
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
      await createSqliteFirstSliceRepository(databasePath).getWorkspaceByScope(
        "stable-tenant",
        workspace.workspaceKey
      ),
      { ...workspace, displayName: "Renamed Workspace" }
    );
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
});

test("SQLite preserves whole-test locks and monitor pauses through every run lookup", async () => {
  const repository = createSqliteFirstSliceRepository(":memory:");
  const testRun: TestRun = {
    testRunId: "run-locked",
    participantSessionId: "session-locked",
    tenantId: "tenant-locked",
    workspaceId: "workspace-locked",
    contentReleaseId: "release-locked",
    bookletKey: "booklet-locked",
    executionMode: "run-hot-return",
    bookletAssignmentKey: "booklet-locked",
    status: "paused",
    pauseSource: "monitor",
    locked: true,
    currentUnitKey: "unit-locked",
    unitResponses: {},
    presetBookletStates: {},
    bookletStates: {},
    bookletStateOverrides: {},
    unlockedTestletKeys: [],
    monitorNavigationUnlocked: false,
    testletTimers: {},
    lockedTestletKeys: [],
    lockedUnitKeys: [],
    createdAt: "2026-08-03T00:00:00.000Z",
    updatedAt: "2026-08-03T00:00:00.000Z",
    completedAt: null
  };

  await repository.saveTestRun(testRun);

  assert.equal((await repository.getTestRunById(testRun.testRunId))?.locked, true);
  assert.equal(
    (await repository.getTestRunById(testRun.testRunId))?.pauseSource,
    "monitor"
  );
  assert.equal(
    (await repository.listTestRunsByParticipantSessionId(testRun.participantSessionId))[0]
      ?.locked,
    true
  );
  assert.equal(
    (await repository.listTestRunsByParticipantSessionId(testRun.participantSessionId))[0]
      ?.pauseSource,
    "monitor"
  );
  assert.equal(
    (await repository.getOpenTestRunByParticipantSessionId(testRun.participantSessionId))
      ?.locked,
    true
  );
  assert.equal(
    (await repository.getOpenTestRunByParticipantSessionId(testRun.participantSessionId))
      ?.pauseSource,
    "monitor"
  );
  assert.equal(
    (await repository.listTestRunsByWorkspace(testRun.tenantId, testRun.workspaceId))[0]
      ?.locked,
    true
  );
  assert.equal(
    (await repository.listTestRunsByWorkspace(testRun.tenantId, testRun.workspaceId))[0]
      ?.pauseSource,
    "monitor"
  );
});

test("SQLite persists participant view settings and asset assignments across repository restarts", async () => {
  const tempDirectory = await mkdtemp(join(tmpdir(), "sqlite-participant-view-"));
  const databasePath = join(tempDirectory, "participant-view.sqlite");
  const rosterEntry: ParticipantRosterEntry = {
    participantRosterEntryId: "roster-view-settings",
    tenantId: "tenant-view-settings",
    workspaceId: "workspace-view-settings",
    loginKey: "participant-view-settings",
    executionMode: "run-hot-return",
    groupKey: "group:view-settings",
    groupLabel: "View Settings Group",
    bookletKey: "booklet:view-settings",
    displayName: "View Settings Participant",
    passwordRequired: false,
    validFrom: null,
    validTo: null,
    validForMinutes: null,
    customTexts: {},
    viewSettings: {
      theme: "Sekundar",
      codeInput: { type: "keypad-symbols-alt", length: 3 }
    },
    assetAssignments: {
      logo: "school.png",
      starterCompanion: "start.webp"
    },
    importedAt: "2026-08-12T00:00:00.000Z"
  };

  try {
    await createSqliteFirstSliceRepository(databasePath).saveParticipantRosterEntry(
      rosterEntry,
      null
    );
    assert.deepEqual(
      await createSqliteFirstSliceRepository(
        databasePath
      ).listParticipantRosterEntriesByWorkspace(
        rosterEntry.tenantId,
        rosterEntry.workspaceId
      ),
      [rosterEntry]
    );
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
});

test("SQLite persists and replaces operational login migration candidates", async () => {
  const tempDirectory = await mkdtemp(join(tmpdir(), "sqlite-operational-"));
  const databasePath = join(tempDirectory, "operational.sqlite");
  const candidate: OperationalLoginMigrationCandidate = {
    loginKey: "study-monitor-migration",
    loginMode: "monitor-study",
    groupKey: "group:operations",
    groupLabel: "Operations Group",
    passwordRequired: true,
    profileIds: [],
    monitorProfiles: [],
    monitorBookletVisibility: "collapsed",
    customTexts: { gm_headline: "Imported monitor" },
    unresolvedProfileIds: [],
    validForMinutes: 45
  };

  try {
    await createSqliteFirstSliceRepository(
      databasePath
    ).replaceOperationalLoginMigrationCandidatesByWorkspace(
      "tenant-operational",
      "workspace-operational",
      [candidate]
    );
    const restarted = createSqliteFirstSliceRepository(databasePath);
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
      await createSqliteFirstSliceRepository(
        databasePath
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

test("SQLite persists and atomically advances admin login failures", async () => {
  const tempDirectory = await mkdtemp(join(tmpdir(), "sqlite-admin-login-"));
  const databasePath = join(tempDirectory, "admin-login.sqlite");

  try {
    const firstAttempt = await createSqliteFirstSliceRepository(
      databasePath
    ).recordAdminLoginFailure({
      username: "sink.admin",
      attemptedAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-01-01T00:30:00.000Z"
    });
    assert.equal(firstAttempt.failedAttempts, 1);

    const restarted = createSqliteFirstSliceRepository(databasePath);
    const secondAttempt = await restarted.recordAdminLoginFailure({
      username: "sink.admin",
      attemptedAt: "2026-01-01T00:01:00.000Z",
      expiresAt: "2026-01-01T00:31:00.000Z"
    });
    assert.equal(secondAttempt.failedAttempts, 2);
    assert.deepEqual(
      await createSqliteFirstSliceRepository(databasePath).getAdminLoginAttempt(
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

test("SQLite preserves workspace-admin access modes", async () => {
  const repository = createSqliteFirstSliceRepository(":memory:");
  const roleAssignment: AdminRoleAssignment = {
    roleAssignmentId: "role-read-only",
    adminUserId: "admin-read-only",
    role: "workspace_admin",
    accessMode: "read_only",
    tenantId: "tenant-read-only",
    workspaceId: "workspace-read-only",
    groupKey: null,
    monitorProfiles: [],
    monitorBookletVisibility: "visible",
    createdAt: "2026-08-03T00:00:00.000Z"
  };

  await repository.saveAdminRoleAssignment(roleAssignment);

  assert.equal(
    (await repository.listAdminRoleAssignmentsByUserId("admin-read-only"))[0]
      ?.accessMode,
    "read_only"
  );
  assert.equal(
    (await repository.listAdminRoleAssignmentsByUserId("admin-read-only"))[0]
      ?.monitorBookletVisibility,
    "visible"
  );
});

test("SQLite preserves global application settings", async () => {
  const repository = createSqliteFirstSliceRepository(":memory:");
  await repository.saveApplicationSettings({
    appTitle: "Assessment Portal",
    mainLogo: "data:image/png;base64,iVBORw0KGgo=",
    themeName: "Erwachsene",
    introHtml: "<p>Welcome to the assessment.</p>",
    legalNoticeHtml: "<p>Provider: Assessment Institute</p>",
    customTexts: { login_subtitle: "Global start" },
    assetAssignments: {},
    globalWarningText: "Maintenance tonight",
    globalWarningExpiresAt: "2050-12-12T18:00:00.000Z",
    updatedAt: "2026-08-08T20:00:00.000Z",
    updatedByAdminUserId: "platform-admin"
  });

  assert.deepEqual(await repository.getApplicationSettings(), {
    appTitle: "Assessment Portal",
    mainLogo: "data:image/png;base64,iVBORw0KGgo=",
    themeName: "Erwachsene",
    introHtml: "<p>Welcome to the assessment.</p>",
    legalNoticeHtml: "<p>Provider: Assessment Institute</p>",
    customTexts: { login_subtitle: "Global start" },
    assetAssignments: {},
    globalWarningText: "Maintenance tonight",
    globalWarningExpiresAt: "2050-12-12T18:00:00.000Z",
    updatedAt: "2026-08-08T20:00:00.000Z",
    updatedByAdminUserId: "platform-admin"
  });
});

test("SQLite preserves login-specific admin custom texts", async () => {
  const repository = createSqliteFirstSliceRepository(":memory:");
  const adminUser: AdminUser = {
    adminUserId: "monitor-custom-texts",
    username: "monitor.custom",
    displayName: "Monitor Custom",
    passwordHash: "stored-password-hash",
    passwordChangeRequired: true,
    status: "active",
    customTexts: {
      gm_headline: "Scoped monitor",
      gm_control_pause: "Hold"
    },
    validFrom: null,
    validTo: null,
    validForMinutes: null,
    firstSignedInAt: null,
    createdAt: "2026-08-09T00:00:00.000Z"
  };

  await repository.saveAdminUser(adminUser);

  assert.deepEqual(
    await repository.getAdminUserByUsername(adminUser.username),
    adminUser
  );
});

test("SQLite adds current defaults to legacy application settings", async () => {
  const tempDirectory = await mkdtemp(join(tmpdir(), "sqlite-branding-"));
  const databasePath = join(tempDirectory, "legacy.sqlite");
  const database = new DatabaseSync(databasePath);
  try {
    database.exec(`
      CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
      INSERT INTO schema_migrations (version, name, applied_at)
      VALUES (39, 'add_attachment_files', '2026-08-08T20:00:00.000Z');
      CREATE TABLE test_runs (test_run_id TEXT PRIMARY KEY);
      CREATE TABLE participant_roster_entries (
        participant_roster_entry_id TEXT PRIMARY KEY
      );
      CREATE TABLE application_settings (
        settings_key TEXT PRIMARY KEY,
        app_title TEXT NOT NULL,
        global_warning_text TEXT,
        global_warning_expires_at TEXT,
        updated_at TEXT,
        updated_by_admin_user_id TEXT
      );
      INSERT INTO application_settings (
        settings_key, app_title, global_warning_text,
        global_warning_expires_at, updated_at, updated_by_admin_user_id
      ) VALUES (
        'global', 'Legacy Portal', NULL, NULL,
        '2026-08-08T20:00:00.000Z', 'legacy-admin'
      );
    `);
  } finally {
    database.close();
  }

  try {
    const settings = await createSqliteFirstSliceRepository(
      databasePath
    ).getApplicationSettings();
    assert.equal(settings?.appTitle, "Legacy Portal");
    assert.equal(settings?.mainLogo, "app-icon.svg");
    assert.equal(settings?.themeName, "Primar");
    assert.equal(settings?.introHtml, "");
    assert.equal(settings?.legalNoticeHtml, "");
    assert.deepEqual(settings?.customTexts, {});
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
});

test("SQLite preserves and deletes attachment images", async () => {
  const repository = createSqliteFirstSliceRepository(":memory:");
  const attachmentFile = {
    attachmentFileId: "image:sqlite.png",
    attachmentId: "att-sqlite",
    tenantId: "tenant-sqlite",
    workspaceId: "workspace-sqlite",
    fileName: "capture.png",
    mediaType: "image/png" as const,
    dataBase64: "iVBORw0KGgo=",
    createdAt: "2026-08-08T20:00:00.000Z"
  };

  await repository.saveAttachmentFile(attachmentFile);
  assert.deepEqual(
    await repository.listAttachmentFilesByWorkspace(
      attachmentFile.tenantId,
      attachmentFile.workspaceId
    ),
    [attachmentFile]
  );
  assert.deepEqual(
    await repository.getAttachmentFileById(attachmentFile.attachmentFileId),
    attachmentFile
  );
  assert.equal(
    await repository.deleteAttachmentFile(attachmentFile.attachmentFileId),
    true
  );
  assert.equal(
    await repository.getAttachmentFileById(attachmentFile.attachmentFileId),
    null
  );
});

test("SQLite upgrades legacy admin roles to read-write access", async () => {
  const tempDirectory = await mkdtemp(join(tmpdir(), "sqlite-admin-mode-"));
  const databasePath = join(tempDirectory, "legacy.sqlite");
  const database = new DatabaseSync(databasePath);
  try {
    database.exec(`
      CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
      INSERT INTO schema_migrations (version, name, applied_at)
      VALUES (36, 'add_test_run_lock', '2026-08-03T00:00:00.000Z');
      CREATE TABLE test_runs (test_run_id TEXT PRIMARY KEY);
      CREATE TABLE participant_roster_entries (
        participant_roster_entry_id TEXT PRIMARY KEY
      );
      CREATE TABLE admin_role_assignments (
        role_assignment_id TEXT PRIMARY KEY,
        admin_user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        tenant_id TEXT,
        workspace_id TEXT,
        group_key TEXT,
        monitor_profiles_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL
      );
      INSERT INTO admin_role_assignments (
        role_assignment_id, admin_user_id, role, tenant_id, workspace_id,
        group_key, monitor_profiles_json, created_at
      ) VALUES (
        'legacy-role', 'legacy-admin', 'workspace_admin', 'legacy-tenant',
        'legacy-workspace', NULL, '[]', '2026-08-03T00:00:00.000Z'
      );
    `);
  } finally {
    database.close();
  }

  try {
    const repository = createSqliteFirstSliceRepository(databasePath);
    assert.equal(
      (await repository.listAdminRoleAssignmentsByUserId("legacy-admin"))[0]
        ?.accessMode,
      "read_write"
    );
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
});
