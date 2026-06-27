import { Pool, type QueryResultRow } from "pg";

import type { FirstSliceRepository } from "@testcenter-rewrite-app/application";
import type {
  AdminAuditEvent,
  AdminRoleAssignment,
  AdminSession,
  AdminUser,
  ContentRelease,
  ContentReleaseRuntimeSnapshot,
  ImportJob,
  ImportJobDiagnostic,
  ParticipantSession,
  SourcePackage,
  SourcePackageContentStructure,
  Tenant,
  TestRun,
  Workspace,
  WorkspaceActivityEvent
} from "@testcenter-rewrite-app/domain";

type Row = QueryResultRow & Record<string, unknown>;

type PostgresMigration = {
  version: number;
  name: string;
  sql: string;
};

const mapTenant = (row: Row | undefined): Tenant | null =>
  row
    ? {
        tenantId: String(row.tenant_id),
        tenantKey: String(row.tenant_key),
        displayName: String(row.display_name),
        status: row.status as Tenant["status"],
        createdAt: String(row.created_at)
      }
    : null;

const mapWorkspace = (row: Row | undefined): Workspace | null =>
  row
    ? {
        workspaceId: String(row.workspace_id),
        tenantId: String(row.tenant_id),
        workspaceKey: String(row.workspace_key),
        displayName: String(row.display_name),
        status: row.status as Workspace["status"],
        createdAt: String(row.created_at)
      }
    : null;

const mapAdminUser = (row: Row | undefined): AdminUser | null =>
  row
    ? {
        adminUserId: String(row.admin_user_id),
        username: String(row.username),
        displayName: String(row.display_name),
        passwordHash: String(row.password_hash),
        status: row.status as AdminUser["status"],
        createdAt: String(row.created_at)
      }
    : null;

const mapAdminSession = (row: Row | undefined): AdminSession | null =>
  row
    ? {
        adminSessionId: String(row.admin_session_id),
        adminUserId: String(row.admin_user_id),
        token: String(row.session_token),
        createdAt: String(row.created_at),
        expiresAt: String(row.expires_at),
        revokedAt:
          row.revoked_at === null || row.revoked_at === undefined
            ? null
            : String(row.revoked_at)
      }
    : null;

const mapAdminRoleAssignment = (row: Row | undefined): AdminRoleAssignment | null =>
  row
    ? {
        roleAssignmentId: String(row.role_assignment_id),
        adminUserId: String(row.admin_user_id),
        role: row.role as AdminRoleAssignment["role"],
        tenantId:
          row.tenant_id === null || row.tenant_id === undefined
            ? null
            : String(row.tenant_id),
        workspaceId:
          row.workspace_id === null || row.workspace_id === undefined
            ? null
            : String(row.workspace_id),
        createdAt: String(row.created_at)
      }
    : null;

const mapAdminAuditEvent = (row: Row | undefined): AdminAuditEvent | null =>
  row
    ? {
        adminAuditEventId: String(row.admin_audit_event_id),
        eventType: row.event_type as AdminAuditEvent["eventType"],
        actorAdminUserId:
          row.actor_admin_user_id === null || row.actor_admin_user_id === undefined
            ? null
            : String(row.actor_admin_user_id),
        subjectAdminUserId:
          row.subject_admin_user_id === null ||
          row.subject_admin_user_id === undefined
            ? null
            : String(row.subject_admin_user_id),
        occurredAt: String(row.occurred_at),
        summary: String(row.summary),
        details: JSON.parse(String(row.details_json ?? "{}")) as Record<string, unknown>
      }
    : null;

const mapSourcePackage = (row: Row | undefined): SourcePackage | null =>
  row
    ? {
        sourcePackageId: String(row.source_package_id),
        tenantId: String(row.tenant_id),
        workspaceId: String(row.workspace_id),
        fileName: String(row.file_name),
        mediaType: String(row.media_type),
        contentStructure:
          row.content_structure_json === null || row.content_structure_json === undefined
            ? null
            : (JSON.parse(
                String(row.content_structure_json)
              ) as SourcePackageContentStructure),
        sourceDocument:
          row.source_document_text === null || row.source_document_text === undefined
            ? null
            : String(row.source_document_text),
        status: row.status as SourcePackage["status"],
        uploadedAt: String(row.uploaded_at)
      }
    : null;

const mapImportJob = (row: Row | undefined): ImportJob | null =>
  row
    ? {
        importJobId: String(row.import_job_id),
        tenantId: String(row.tenant_id),
        workspaceId: String(row.workspace_id),
        sourcePackageId: String(row.source_package_id),
        status: row.status as ImportJob["status"],
        createdAt: String(row.created_at),
        finishedAt:
          row.finished_at === null || row.finished_at === undefined
            ? null
            : String(row.finished_at),
        diagnostics: JSON.parse(
          String(row.diagnostics_json ?? "[]")
        ) as ImportJobDiagnostic[]
      }
    : null;

const mapContentRelease = (row: Row | undefined): ContentRelease | null =>
  row
    ? {
        contentReleaseId: String(row.content_release_id),
        tenantId: String(row.tenant_id),
        workspaceId: String(row.workspace_id),
        importJobId: String(row.import_job_id),
        releaseLabel: String(row.release_label),
        runtimeSnapshot: JSON.parse(
          String(row.runtime_snapshot_json ?? "{\"bookletEntries\":[]}")
        ) as ContentReleaseRuntimeSnapshot,
        status: row.status as ContentRelease["status"],
        createdAt: String(row.created_at),
        activatedAt:
          row.activated_at === null || row.activated_at === undefined
            ? null
            : String(row.activated_at)
      }
    : null;

const mapParticipantSession = (row: Row | undefined): ParticipantSession | null =>
  row
    ? {
        participantSessionId: String(row.participant_session_id),
        tenantId: String(row.tenant_id),
        workspaceId: String(row.workspace_id),
        contentReleaseId: String(row.content_release_id),
        loginKey: String(row.login_key),
        groupKey: String(row.group_key),
        status: row.status as ParticipantSession["status"],
        createdAt: String(row.created_at)
      }
    : null;

const mapTestRun = (row: Row | undefined): TestRun | null =>
  row
    ? {
        testRunId: String(row.test_run_id),
        participantSessionId: String(row.participant_session_id),
        tenantId: String(row.tenant_id),
        workspaceId: String(row.workspace_id),
        contentReleaseId: String(row.content_release_id),
        bookletKey: String(row.booklet_key),
        status: row.status as TestRun["status"],
        currentUnitKey:
          row.current_unit_key === null || row.current_unit_key === undefined
            ? null
            : String(row.current_unit_key),
        unitResponses: JSON.parse(
          String(row.unit_responses_json ?? "{}")
        ) as Record<string, string>,
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
        completedAt:
          row.completed_at === null || row.completed_at === undefined
            ? null
            : String(row.completed_at)
      }
    : null;

const mapWorkspaceActivityEvent = (
  row: Row | undefined
): WorkspaceActivityEvent | null =>
  row
    ? {
        activityEventId: String(row.activity_event_id),
        tenantId: String(row.tenant_id),
        workspaceId: String(row.workspace_id),
        eventType: row.event_type as WorkspaceActivityEvent["eventType"],
        actorId:
          row.actor_id === null || row.actor_id === undefined
            ? null
            : String(row.actor_id),
        subjectType: row.subject_type as WorkspaceActivityEvent["subjectType"],
        subjectId: String(row.subject_id),
        occurredAt: String(row.occurred_at),
        summary: String(row.summary),
        details: JSON.parse(String(row.details_json ?? "{}")) as Record<string, unknown>
      }
    : null;

export const POSTGRES_FIRST_SLICE_SCHEMA_VERSION = 5;

const migrations: PostgresMigration[] = [
  {
    version: 1,
    name: "initial_first_slice_schema",
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tenants (
        tenant_id TEXT PRIMARY KEY,
        tenant_key TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workspaces (
        workspace_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        tenant_key TEXT NOT NULL,
        workspace_key TEXT NOT NULL,
        display_name TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (tenant_key, workspace_key)
      );

      CREATE TABLE IF NOT EXISTS workspace_activity_events (
        activity_event_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        actor_id TEXT,
        subject_type TEXT NOT NULL,
        subject_id TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        summary TEXT NOT NULL,
        details_json TEXT NOT NULL DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS source_packages (
        source_package_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        media_type TEXT NOT NULL,
        content_structure_json TEXT,
        source_document_text TEXT,
        status TEXT NOT NULL,
        uploaded_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS import_jobs (
        import_job_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        source_package_id TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        finished_at TEXT,
        diagnostics_json TEXT NOT NULL DEFAULT '[]'
      );

      CREATE TABLE IF NOT EXISTS content_releases (
        content_release_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        import_job_id TEXT NOT NULL,
        release_label TEXT NOT NULL,
        runtime_snapshot_json TEXT NOT NULL DEFAULT '{"bookletEntries":[]}',
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        activated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS participant_sessions (
        participant_session_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        content_release_id TEXT NOT NULL,
        login_key TEXT NOT NULL,
        group_key TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS test_runs (
        test_run_id TEXT PRIMARY KEY,
        participant_session_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        content_release_id TEXT NOT NULL,
        booklet_key TEXT NOT NULL,
        status TEXT NOT NULL,
        current_unit_key TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_workspaces_workspace_key
        ON workspaces (workspace_key);
      CREATE INDEX IF NOT EXISTS idx_workspace_activity_events_workspace
        ON workspace_activity_events (tenant_id, workspace_id, occurred_at);
      CREATE INDEX IF NOT EXISTS idx_source_packages_workspace
        ON source_packages (tenant_id, workspace_id);
      CREATE INDEX IF NOT EXISTS idx_import_jobs_workspace
        ON import_jobs (tenant_id, workspace_id);
      CREATE INDEX IF NOT EXISTS idx_content_releases_workspace
        ON content_releases (tenant_id, workspace_id);
      CREATE INDEX IF NOT EXISTS idx_participant_sessions_workspace
        ON participant_sessions (tenant_id, workspace_id);
      CREATE INDEX IF NOT EXISTS idx_test_runs_workspace
        ON test_runs (tenant_id, workspace_id);
      CREATE INDEX IF NOT EXISTS idx_test_runs_participant_session
        ON test_runs (participant_session_id);
    `
  },
  {
    version: 2,
    name: "add_admin_auth",
    sql: `
      CREATE TABLE IF NOT EXISTS admin_users (
        admin_user_id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS admin_sessions (
        admin_session_id TEXT PRIMARY KEY,
        admin_user_id TEXT NOT NULL,
        session_token TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        revoked_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_admin_sessions_user
        ON admin_sessions (admin_user_id);
    `
  },
  {
    version: 3,
    name: "add_admin_role_assignments",
    sql: `
      CREATE TABLE IF NOT EXISTS admin_role_assignments (
        role_assignment_id TEXT PRIMARY KEY,
        admin_user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        tenant_id TEXT,
        workspace_id TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_admin_role_assignments_user
        ON admin_role_assignments (admin_user_id);
    `
  },
  {
    version: 4,
    name: "add_admin_audit_events",
    sql: `
      CREATE TABLE IF NOT EXISTS admin_audit_events (
        admin_audit_event_id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        actor_admin_user_id TEXT,
        subject_admin_user_id TEXT,
        occurred_at TEXT NOT NULL,
        summary TEXT NOT NULL,
        details_json TEXT NOT NULL DEFAULT '{}'
      );

      CREATE INDEX IF NOT EXISTS idx_admin_audit_events_occurred_at
        ON admin_audit_events (occurred_at);
      CREATE INDEX IF NOT EXISTS idx_admin_audit_events_subject
        ON admin_audit_events (subject_admin_user_id, occurred_at);
      CREATE INDEX IF NOT EXISTS idx_admin_audit_events_actor
        ON admin_audit_events (actor_admin_user_id, occurred_at);
    `
  },
  {
    version: 5,
    name: "add_test_run_unit_responses",
    sql: `
      ALTER TABLE test_runs
      ADD COLUMN unit_responses_json TEXT NOT NULL DEFAULT '{}';
    `
  }
];

const applyMigrations = async (pool: Pool): Promise<void> => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);
  const result = await pool.query<{ version: number }>(
    `SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations`
  );
  const currentVersion = Number(result.rows[0]?.version ?? 0);
  const pending = migrations.filter(migration => migration.version > currentVersion);

  for (const migration of pending) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(migration.sql);
      await client.query(
        `INSERT INTO schema_migrations (version, name, applied_at) VALUES ($1, $2, $3)`,
        [migration.version, migration.name, new Date().toISOString()]
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
};

export type PostgresFirstSliceStorageDiagnostics = {
  currentSchemaVersion: number;
  targetSchemaVersion: number;
};

export const inspectPostgresFirstSliceStorage = async (
  connectionString: string
): Promise<PostgresFirstSliceStorageDiagnostics> => {
  const pool = new Pool({ connectionString });

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      )
    `);
    const result = await pool.query<{ version: number }>(
      `SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations`
    );
    return {
      currentSchemaVersion: Number(result.rows[0]?.version ?? 0),
      targetSchemaVersion: POSTGRES_FIRST_SLICE_SCHEMA_VERSION
    };
  } finally {
    await pool.end();
  }
};

export const migratePostgresFirstSliceStorage = async (
  connectionString: string
): Promise<PostgresFirstSliceStorageDiagnostics> => {
  const pool = new Pool({ connectionString });

  try {
    await applyMigrations(pool);
    const result = await pool.query<{ version: number }>(
      `SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations`
    );
    return {
      currentSchemaVersion: Number(result.rows[0]?.version ?? 0),
      targetSchemaVersion: POSTGRES_FIRST_SLICE_SCHEMA_VERSION
    };
  } finally {
    await pool.end();
  }
};

export const checkPostgresFirstSliceReadiness = async (
  connectionString: string
): Promise<void> => {
  const pool = new Pool({ connectionString });

  try {
    await pool.query("SELECT 1");
  } finally {
    await pool.end();
  }
};

const createRepositoryFromPool = (pool: Pool): FirstSliceRepository => {
  const one = async <T>(
    sql: string,
    values: unknown[],
    map: (row: Row | undefined) => T | null
  ): Promise<T | null> => {
    const result = await pool.query(sql, values);
    return map(result.rows[0] as Row | undefined);
  };

  const many = async <T>(
    sql: string,
    values: unknown[],
    map: (row: Row | undefined) => T | null
  ): Promise<T[]> => {
    const result = await pool.query(sql, values);
    return result.rows.map(row => map(row as Row)).filter(Boolean) as T[];
  };

  return {
    async listAdminUsers() {
      return many(
        `SELECT admin_user_id, username, display_name, password_hash, status, created_at
         FROM admin_users
         ORDER BY created_at ASC`,
        [],
        mapAdminUser
      );
    },
    async getAdminUserById(adminUserId) {
      return one(
        `SELECT admin_user_id, username, display_name, password_hash, status, created_at
         FROM admin_users
         WHERE admin_user_id = $1`,
        [adminUserId],
        mapAdminUser
      );
    },
    async getAdminUserByUsername(username) {
      return one(
        `SELECT admin_user_id, username, display_name, password_hash, status, created_at
         FROM admin_users
         WHERE username = $1`,
        [username],
        mapAdminUser
      );
    },
    async saveAdminUser(adminUser) {
      await pool.query(
        `INSERT INTO admin_users (
          admin_user_id, username, display_name, password_hash, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT(admin_user_id) DO UPDATE SET
          username = EXCLUDED.username,
          display_name = EXCLUDED.display_name,
          password_hash = EXCLUDED.password_hash,
          status = EXCLUDED.status,
          created_at = EXCLUDED.created_at`,
        [
          adminUser.adminUserId,
          adminUser.username,
          adminUser.displayName,
          adminUser.passwordHash,
          adminUser.status,
          adminUser.createdAt
        ]
      );
    },
    async listAdminRoleAssignmentsByUserId(adminUserId) {
      return many(
        `SELECT role_assignment_id, admin_user_id, role, tenant_id, workspace_id, created_at
         FROM admin_role_assignments
         WHERE admin_user_id = $1`,
        [adminUserId],
        mapAdminRoleAssignment
      );
    },
    async saveAdminRoleAssignment(roleAssignment) {
      await pool.query(
        `INSERT INTO admin_role_assignments (
          role_assignment_id, admin_user_id, role, tenant_id, workspace_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT(role_assignment_id) DO UPDATE SET
          admin_user_id = EXCLUDED.admin_user_id,
          role = EXCLUDED.role,
          tenant_id = EXCLUDED.tenant_id,
          workspace_id = EXCLUDED.workspace_id,
          created_at = EXCLUDED.created_at`,
        [
          roleAssignment.roleAssignmentId,
          roleAssignment.adminUserId,
          roleAssignment.role,
          roleAssignment.tenantId,
          roleAssignment.workspaceId,
          roleAssignment.createdAt
        ]
      );
    },
    async deleteAdminRoleAssignment(roleAssignmentId) {
      await pool.query(
        `DELETE FROM admin_role_assignments WHERE role_assignment_id = $1`,
        [roleAssignmentId]
      );
    },
    async listAdminAuditEvents() {
      return many(
        `SELECT admin_audit_event_id, event_type, actor_admin_user_id, subject_admin_user_id, occurred_at, summary, details_json
         FROM admin_audit_events`,
        [],
        mapAdminAuditEvent
      );
    },
    async saveAdminAuditEvent(auditEvent) {
      await pool.query(
        `INSERT INTO admin_audit_events (
          admin_audit_event_id, event_type, actor_admin_user_id, subject_admin_user_id, occurred_at, summary, details_json
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT(admin_audit_event_id) DO UPDATE SET
          event_type = EXCLUDED.event_type,
          actor_admin_user_id = EXCLUDED.actor_admin_user_id,
          subject_admin_user_id = EXCLUDED.subject_admin_user_id,
          occurred_at = EXCLUDED.occurred_at,
          summary = EXCLUDED.summary,
          details_json = EXCLUDED.details_json`,
        [
          auditEvent.adminAuditEventId,
          auditEvent.eventType,
          auditEvent.actorAdminUserId,
          auditEvent.subjectAdminUserId,
          auditEvent.occurredAt,
          auditEvent.summary,
          JSON.stringify(auditEvent.details)
        ]
      );
    },
    async getAdminSessionByToken(token) {
      return one(
        `SELECT admin_session_id, admin_user_id, session_token, created_at, expires_at, revoked_at
         FROM admin_sessions
         WHERE session_token = $1`,
        [token],
        mapAdminSession
      );
    },
    async saveAdminSession(adminSession) {
      await pool.query(
        `INSERT INTO admin_sessions (
          admin_session_id, admin_user_id, session_token, created_at, expires_at, revoked_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT(admin_session_id) DO UPDATE SET
          admin_user_id = EXCLUDED.admin_user_id,
          session_token = EXCLUDED.session_token,
          created_at = EXCLUDED.created_at,
          expires_at = EXCLUDED.expires_at,
          revoked_at = EXCLUDED.revoked_at`,
        [
          adminSession.adminSessionId,
          adminSession.adminUserId,
          adminSession.token,
          adminSession.createdAt,
          adminSession.expiresAt,
          adminSession.revokedAt
        ]
      );
    },
    async getTenantByKey(tenantKey) {
      return one(
        `SELECT tenant_id, tenant_key, display_name, status, created_at
         FROM tenants
         WHERE tenant_key = $1`,
        [tenantKey],
        mapTenant
      );
    },
    async listTenants() {
      return many(
        `SELECT tenant_id, tenant_key, display_name, status, created_at
         FROM tenants`,
        [],
        mapTenant
      );
    },
    async saveTenant(tenant) {
      await pool.query(
        `INSERT INTO tenants (
          tenant_id, tenant_key, display_name, status, created_at
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT(tenant_id) DO UPDATE SET
          tenant_key = EXCLUDED.tenant_key,
          display_name = EXCLUDED.display_name,
          status = EXCLUDED.status,
          created_at = EXCLUDED.created_at`,
        [
          tenant.tenantId,
          tenant.tenantKey,
          tenant.displayName,
          tenant.status,
          tenant.createdAt
        ]
      );
    },
    async getWorkspaceByScope(tenantKey, workspaceKey) {
      return one(
        `SELECT workspace_id, tenant_id, workspace_key, display_name, status, created_at
         FROM workspaces
         WHERE tenant_key = $1 AND workspace_key = $2`,
        [tenantKey, workspaceKey],
        mapWorkspace
      );
    },
    async getWorkspaceByWorkspaceKey(workspaceKey) {
      return one(
        `SELECT workspace_id, tenant_id, workspace_key, display_name, status, created_at
         FROM workspaces
         WHERE workspace_key = $1
         ORDER BY created_at ASC
         LIMIT 1`,
        [workspaceKey],
        mapWorkspace
      );
    },
    async listWorkspacesByTenantId(tenantId) {
      return many(
        `SELECT workspace_id, tenant_id, workspace_key, display_name, status, created_at
         FROM workspaces
         WHERE tenant_id = $1`,
        [tenantId],
        mapWorkspace
      );
    },
    async saveWorkspace(scope) {
      await pool.query(
        `INSERT INTO workspaces (
          workspace_id, tenant_id, tenant_key, workspace_key, display_name, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT(workspace_id) DO UPDATE SET
          tenant_id = EXCLUDED.tenant_id,
          tenant_key = EXCLUDED.tenant_key,
          workspace_key = EXCLUDED.workspace_key,
          display_name = EXCLUDED.display_name,
          status = EXCLUDED.status,
          created_at = EXCLUDED.created_at`,
        [
          scope.workspace.workspaceId,
          scope.workspace.tenantId,
          scope.tenantKey,
          scope.workspace.workspaceKey,
          scope.workspace.displayName,
          scope.workspace.status,
          scope.workspace.createdAt
        ]
      );
    },
    async listWorkspaceActivityEventsByWorkspace(tenantId, workspaceId) {
      return many(
        `SELECT activity_event_id, tenant_id, workspace_id, event_type, actor_id, subject_type, subject_id, occurred_at, summary, details_json
         FROM workspace_activity_events
         WHERE tenant_id = $1 AND workspace_id = $2`,
        [tenantId, workspaceId],
        mapWorkspaceActivityEvent
      );
    },
    async saveWorkspaceActivityEvent(activityEvent) {
      await pool.query(
        `INSERT INTO workspace_activity_events (
          activity_event_id, tenant_id, workspace_id, event_type, actor_id, subject_type, subject_id, occurred_at, summary, details_json
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT(activity_event_id) DO UPDATE SET
          tenant_id = EXCLUDED.tenant_id,
          workspace_id = EXCLUDED.workspace_id,
          event_type = EXCLUDED.event_type,
          actor_id = EXCLUDED.actor_id,
          subject_type = EXCLUDED.subject_type,
          subject_id = EXCLUDED.subject_id,
          occurred_at = EXCLUDED.occurred_at,
          summary = EXCLUDED.summary,
          details_json = EXCLUDED.details_json`,
        [
          activityEvent.activityEventId,
          activityEvent.tenantId,
          activityEvent.workspaceId,
          activityEvent.eventType,
          activityEvent.actorId,
          activityEvent.subjectType,
          activityEvent.subjectId,
          activityEvent.occurredAt,
          activityEvent.summary,
          JSON.stringify(activityEvent.details)
        ]
      );
    },
    async getSourcePackageById(sourcePackageId) {
      return one(
        `SELECT source_package_id, tenant_id, workspace_id, file_name, media_type, content_structure_json, source_document_text, status, uploaded_at
         FROM source_packages
         WHERE source_package_id = $1`,
        [sourcePackageId],
        mapSourcePackage
      );
    },
    async listSourcePackagesByWorkspace(tenantId, workspaceId) {
      return many(
        `SELECT source_package_id, tenant_id, workspace_id, file_name, media_type, content_structure_json, source_document_text, status, uploaded_at
         FROM source_packages
         WHERE tenant_id = $1 AND workspace_id = $2`,
        [tenantId, workspaceId],
        mapSourcePackage
      );
    },
    async saveSourcePackage(sourcePackage) {
      await pool.query(
        `INSERT INTO source_packages (
          source_package_id, tenant_id, workspace_id, file_name, media_type, content_structure_json, source_document_text, status, uploaded_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT(source_package_id) DO UPDATE SET
          tenant_id = EXCLUDED.tenant_id,
          workspace_id = EXCLUDED.workspace_id,
          file_name = EXCLUDED.file_name,
          media_type = EXCLUDED.media_type,
          content_structure_json = EXCLUDED.content_structure_json,
          source_document_text = EXCLUDED.source_document_text,
          status = EXCLUDED.status,
          uploaded_at = EXCLUDED.uploaded_at`,
        [
          sourcePackage.sourcePackageId,
          sourcePackage.tenantId,
          sourcePackage.workspaceId,
          sourcePackage.fileName,
          sourcePackage.mediaType,
          sourcePackage.contentStructure
            ? JSON.stringify(sourcePackage.contentStructure)
            : null,
          sourcePackage.sourceDocument,
          sourcePackage.status,
          sourcePackage.uploadedAt
        ]
      );
    },
    async getImportJobById(importJobId) {
      return one(
        `SELECT import_job_id, tenant_id, workspace_id, source_package_id, status, created_at, finished_at, diagnostics_json
         FROM import_jobs
         WHERE import_job_id = $1`,
        [importJobId],
        mapImportJob
      );
    },
    async listImportJobsByWorkspace(tenantId, workspaceId) {
      return many(
        `SELECT import_job_id, tenant_id, workspace_id, source_package_id, status, created_at, finished_at, diagnostics_json
         FROM import_jobs
         WHERE tenant_id = $1 AND workspace_id = $2`,
        [tenantId, workspaceId],
        mapImportJob
      );
    },
    async saveImportJob(importJob) {
      await pool.query(
        `INSERT INTO import_jobs (
          import_job_id, tenant_id, workspace_id, source_package_id, status, created_at, finished_at, diagnostics_json
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT(import_job_id) DO UPDATE SET
          tenant_id = EXCLUDED.tenant_id,
          workspace_id = EXCLUDED.workspace_id,
          source_package_id = EXCLUDED.source_package_id,
          status = EXCLUDED.status,
          created_at = EXCLUDED.created_at,
          finished_at = EXCLUDED.finished_at,
          diagnostics_json = EXCLUDED.diagnostics_json`,
        [
          importJob.importJobId,
          importJob.tenantId,
          importJob.workspaceId,
          importJob.sourcePackageId,
          importJob.status,
          importJob.createdAt,
          importJob.finishedAt,
          JSON.stringify(importJob.diagnostics)
        ]
      );
    },
    async getContentReleaseById(contentReleaseId) {
      return one(
        `SELECT content_release_id, tenant_id, workspace_id, import_job_id, release_label, runtime_snapshot_json, status, created_at, activated_at
         FROM content_releases
         WHERE content_release_id = $1`,
        [contentReleaseId],
        mapContentRelease
      );
    },
    async listContentReleasesByWorkspace(tenantId, workspaceId) {
      return many(
        `SELECT content_release_id, tenant_id, workspace_id, import_job_id, release_label, runtime_snapshot_json, status, created_at, activated_at
         FROM content_releases
         WHERE tenant_id = $1 AND workspace_id = $2`,
        [tenantId, workspaceId],
        mapContentRelease
      );
    },
    async saveContentRelease(contentRelease) {
      await pool.query(
        `INSERT INTO content_releases (
          content_release_id, tenant_id, workspace_id, import_job_id, release_label, runtime_snapshot_json, status, created_at, activated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT(content_release_id) DO UPDATE SET
          tenant_id = EXCLUDED.tenant_id,
          workspace_id = EXCLUDED.workspace_id,
          import_job_id = EXCLUDED.import_job_id,
          release_label = EXCLUDED.release_label,
          runtime_snapshot_json = EXCLUDED.runtime_snapshot_json,
          status = EXCLUDED.status,
          created_at = EXCLUDED.created_at,
          activated_at = EXCLUDED.activated_at`,
        [
          contentRelease.contentReleaseId,
          contentRelease.tenantId,
          contentRelease.workspaceId,
          contentRelease.importJobId,
          contentRelease.releaseLabel,
          JSON.stringify(contentRelease.runtimeSnapshot),
          contentRelease.status,
          contentRelease.createdAt,
          contentRelease.activatedAt
        ]
      );
    },
    async getParticipantSessionById(participantSessionId) {
      return one(
        `SELECT participant_session_id, tenant_id, workspace_id, content_release_id, login_key, group_key, status, created_at
         FROM participant_sessions
         WHERE participant_session_id = $1`,
        [participantSessionId],
        mapParticipantSession
      );
    },
    async listParticipantSessionsByWorkspace(tenantId, workspaceId) {
      return many(
        `SELECT participant_session_id, tenant_id, workspace_id, content_release_id, login_key, group_key, status, created_at
         FROM participant_sessions
         WHERE tenant_id = $1 AND workspace_id = $2`,
        [tenantId, workspaceId],
        mapParticipantSession
      );
    },
    async saveParticipantSession(participantSession) {
      await pool.query(
        `INSERT INTO participant_sessions (
          participant_session_id, tenant_id, workspace_id, content_release_id, login_key, group_key, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT(participant_session_id) DO UPDATE SET
          tenant_id = EXCLUDED.tenant_id,
          workspace_id = EXCLUDED.workspace_id,
          content_release_id = EXCLUDED.content_release_id,
          login_key = EXCLUDED.login_key,
          group_key = EXCLUDED.group_key,
          status = EXCLUDED.status,
          created_at = EXCLUDED.created_at`,
        [
          participantSession.participantSessionId,
          participantSession.tenantId,
          participantSession.workspaceId,
          participantSession.contentReleaseId,
          participantSession.loginKey,
          participantSession.groupKey,
          participantSession.status,
          participantSession.createdAt
        ]
      );
    },
    async getTestRunById(testRunId) {
      return one(
        `SELECT test_run_id, participant_session_id, tenant_id, workspace_id, content_release_id, booklet_key, status, current_unit_key, unit_responses_json, created_at, updated_at, completed_at
         FROM test_runs
         WHERE test_run_id = $1`,
        [testRunId],
        mapTestRun
      );
    },
    async listTestRunsByParticipantSessionId(participantSessionId) {
      return many(
        `SELECT test_run_id, participant_session_id, tenant_id, workspace_id, content_release_id, booklet_key, status, current_unit_key, unit_responses_json, created_at, updated_at, completed_at
         FROM test_runs
         WHERE participant_session_id = $1`,
        [participantSessionId],
        mapTestRun
      );
    },
    async getOpenTestRunByParticipantSessionId(participantSessionId) {
      return one(
        `SELECT test_run_id, participant_session_id, tenant_id, workspace_id, content_release_id, booklet_key, status, current_unit_key, unit_responses_json, created_at, updated_at, completed_at
         FROM test_runs
         WHERE participant_session_id = $1 AND status != 'completed'
         ORDER BY updated_at ASC
         LIMIT 1`,
        [participantSessionId],
        mapTestRun
      );
    },
    async listTestRunsByWorkspace(tenantId, workspaceId) {
      return many(
        `SELECT test_run_id, participant_session_id, tenant_id, workspace_id, content_release_id, booklet_key, status, current_unit_key, unit_responses_json, created_at, updated_at, completed_at
         FROM test_runs
         WHERE tenant_id = $1 AND workspace_id = $2`,
        [tenantId, workspaceId],
        mapTestRun
      );
    },
    async saveTestRun(testRun) {
      await pool.query(
        `INSERT INTO test_runs (
          test_run_id, participant_session_id, tenant_id, workspace_id, content_release_id, booklet_key, status, current_unit_key, unit_responses_json, created_at, updated_at, completed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT(test_run_id) DO UPDATE SET
          participant_session_id = EXCLUDED.participant_session_id,
          tenant_id = EXCLUDED.tenant_id,
          workspace_id = EXCLUDED.workspace_id,
          content_release_id = EXCLUDED.content_release_id,
          booklet_key = EXCLUDED.booklet_key,
          status = EXCLUDED.status,
          current_unit_key = EXCLUDED.current_unit_key,
          unit_responses_json = EXCLUDED.unit_responses_json,
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at,
          completed_at = EXCLUDED.completed_at`,
        [
          testRun.testRunId,
          testRun.participantSessionId,
          testRun.tenantId,
          testRun.workspaceId,
          testRun.contentReleaseId,
          testRun.bookletKey,
          testRun.status,
          testRun.currentUnitKey,
          JSON.stringify(testRun.unitResponses),
          testRun.createdAt,
          testRun.updatedAt,
          testRun.completedAt
        ]
      );
    }
  };
};

export const createPostgresFirstSliceStorage = async (connectionString: string) => {
  const pool = new Pool({ connectionString });
  await applyMigrations(pool);

  return {
    repository: createRepositoryFromPool(pool),
    readinessCheck: async (): Promise<void> => {
      await pool.query("SELECT 1");
    },
    shutdown: async (): Promise<void> => {
      await pool.end();
    }
  };
};

export const createPostgresFirstSliceRepository = async (
  connectionString: string
): Promise<FirstSliceRepository> => {
  const storage = await createPostgresFirstSliceStorage(connectionString);
  return storage.repository;
};
