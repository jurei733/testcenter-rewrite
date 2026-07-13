import { Injectable, inject } from "@angular/core";

import type {
  AdminSignInResponse,
  AdminSignOutResponse,
  BootstrapAdminUserResponse,
  GetAdminCurrentSessionResponse,
  ListAdminSessionsResponse,
  ListAdminAuditEventsResponse,
  ListAdminUsersResponse,
  GetRuntimeConfigResponse,
  GetRuntimeDiagnosticsResponse
} from "@testcenter-rewrite-app/contracts";
import {
  adminAuditEventTypes,
  type AdminRole,
  type AdminSessionStatus,
  type AdminUserStatus
} from "@testcenter-rewrite-app/domain";

import type { RecordCollectionItem } from "./record-collection.component";
import type { SummaryCard } from "./rewrite-app-shell.types";
import { buildParticipantEntryUrl } from "./participant-session-links";
import {
  parseJsonDocument,
  readNumberValue,
  readStringValue
} from "./rewrite-app-shell.readers";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";
import { RewriteAppOpsService } from "./rewrite-app-ops.service";
import { RewriteAppViewStateService } from "./rewrite-app-view-state.service";

type RuntimeMetricsPayload = {
  runtime: {
    startedAt: string;
    uptimeSeconds: number;
    lifecycle: {
      phase: "running" | "draining";
      shutdownRequestedAt: string | null;
    };
    activeRequests: number;
    totalRequests: number;
    completedRequests: number;
  };
  memory: {
    rssBytes: number;
    heapTotalBytes: number;
    heapUsedBytes: number;
    externalBytes: number;
    arrayBuffersBytes: number;
  };
  storage: {
    kind: string;
    schemaVersion: number | null;
  };
  requestCountsByMethod: Record<string, number>;
  requestCountsByRoute: Record<string, number>;
  responseCountsByStatusCode: Record<string, number>;
  requestLatencyByRoute: Record<
    string,
    {
      count: number;
      totalMs: number;
      maxMs: number;
      bucketCounts: Record<string, number>;
    }
  >;
  errorCounts: Record<string, number>;
};

type RuntimeHealthPayload = {
  manifest?: {
    capabilities?: string[];
    routes?: Record<string, unknown>;
  };
};

type AdminSessionViewPayload = Partial<
  BootstrapAdminUserResponse &
    AdminSignInResponse &
    GetAdminCurrentSessionResponse &
    AdminSignOutResponse
>;

const localDemoAccess = {
  adminUsername: "demo-admin",
  adminDisplayName: "Demo Platform Admin",
  adminPassword: "demo-admin-password",
  tenantKey: "demo-tenant",
  workspaceKey: "demo-workspace",
  participantLoginKey: "student-demo",
  participantPath: buildParticipantEntryUrl(
    {
      tenantKey: "demo-tenant",
      workspaceKey: "demo-workspace",
      loginKey: "student-demo",
      groupKey: "group:student-demo",
      bookletKey: "booklet:demo"
    },
    { includeOrigin: false }
  )
} as const;

@Injectable({ providedIn: "root" })
export class OpsViewFacade {
  private readonly uiState = inject(RewriteAppUiStateService);
  private readonly opsService = inject(RewriteAppOpsService);
  private readonly viewState = inject(RewriteAppViewStateService);

  readonly ops = this.uiState.ops;
  readonly adminRoleOptions: AdminRole[] = [
    "workspace_admin",
    "tenant_admin",
    "platform_admin"
  ];
  readonly adminStatusOptions: AdminUserStatus[] = ["active", "disabled"];
  readonly adminSessionStatusOptions: AdminSessionStatus[] = [
    "active",
    "expired",
    "revoked"
  ];
  readonly adminAuditEventTypeOptions = adminAuditEventTypes;

  init(): void {
    this.viewState.setActiveView("ops");
  }

  get canCreateAdminUser(): boolean {
    return (
      this.ops.adminCreateUsername.trim() !== "" &&
      this.ops.adminCreatePassword !== "" &&
      this.isScopedAdminRoleInputComplete(
        this.ops.adminCreateRole,
        this.ops.adminCreateTenantKey,
        this.ops.adminCreateWorkspaceKey
      )
    );
  }

  get canRevokeAdminSession(): boolean {
    return this.ops.adminSessionRevokeTargetId.trim() !== "";
  }

  get canAssignAdminRole(): boolean {
    return (
      this.ops.adminRoleTargetUserId.trim() !== "" &&
      this.isScopedAdminRoleInputComplete(
        this.ops.adminRoleRole,
        this.ops.adminRoleTenantKey,
        this.ops.adminRoleWorkspaceKey
      )
    );
  }

  get canRevokeAdminRole(): boolean {
    return (
      this.ops.adminRevokeTargetUserId.trim() !== "" &&
      this.ops.adminRevokeRoleAssignmentId.trim() !== ""
    );
  }

  get canResetAdminUserPassword(): boolean {
    return (
      this.ops.adminResetTargetUserId.trim() !== "" &&
      this.ops.adminResetPassword !== ""
    );
  }

  get canUpdateAdminUserStatus(): boolean {
    return (
      this.ops.adminStatusTargetUserId.trim() !== "" &&
      this.adminStatusOptions.includes(this.ops.adminStatusValue)
    );
  }

  refreshDiagnostics(): void {
    this.viewState.onActionAsync(() => this.opsService.refreshOperationalDiagnostics());
  }

  refreshMetrics(): void {
    this.viewState.onActionAsync(() => this.opsService.refreshMetricsOnly());
  }

  bootstrapOrSignInAdmin(): void {
    this.viewState.onActionAsync(() => this.opsService.bootstrapOrSignInAdmin());
  }

  bootstrapAdmin(): void {
    this.viewState.onActionAsync(() => this.opsService.bootstrapAdmin());
  }

  signInAdmin(): void {
    this.viewState.onActionAsync(() => this.opsService.signInAdmin());
  }

  refreshAdminSession(): void {
    this.viewState.onActionAsync(() => this.opsService.refreshAdminSession());
  }

  refreshAdminSessions(): void {
    this.viewState.onActionAsync(() => this.opsService.refreshAdminSessions());
  }

  exportAdminSessionsCsv(): void {
    this.viewState.onActionAsync(() => this.opsService.exportAdminSessionsCsv());
  }

  signOutAdmin(): void {
    this.viewState.onActionAsync(() => this.opsService.signOutAdmin());
  }

  confirmRevokeAdminSession(): void {
    const adminSessionId = this.ops.adminSessionRevokeTargetId.trim();
    if (!adminSessionId) {
      return;
    }
    const confirmed = globalThis.window?.confirm(
      `Revoke admin session '${adminSessionId}'?`
    );
    if (confirmed) {
      this.revokeAdminSession();
    }
  }

  private revokeAdminSession(): void {
    this.viewState.onActionAsync(() => this.opsService.revokeAdminSession());
  }

  refreshAdminUsers(): void {
    this.viewState.onActionAsync(() => this.opsService.refreshAdminUsers());
  }

  exportAdminUsersCsv(): void {
    this.viewState.onActionAsync(() => this.opsService.exportAdminUsersCsv());
  }

  refreshAdminAuditEvents(): void {
    this.viewState.onActionAsync(() => this.opsService.refreshAdminAuditEvents());
  }

  exportAdminAuditEventsCsv(): void {
    this.viewState.onActionAsync(() =>
      this.opsService.exportAdminAuditEventsCsv()
    );
  }

  createAdminUser(): void {
    this.viewState.onActionAsync(() => this.opsService.createAdminUser());
  }

  assignAdminRole(): void {
    this.viewState.onActionAsync(() => this.opsService.assignAdminRole());
  }

  confirmRevokeAdminRole(): void {
    const adminUserId = this.ops.adminRevokeTargetUserId.trim();
    const roleAssignmentId = this.ops.adminRevokeRoleAssignmentId.trim();
    if (!adminUserId || !roleAssignmentId) {
      return;
    }
    const confirmed = globalThis.window?.confirm(
      `Revoke role assignment '${roleAssignmentId}' from admin user '${adminUserId}'?`
    );
    if (confirmed) {
      this.revokeAdminRole();
    }
  }

  private revokeAdminRole(): void {
    this.viewState.onActionAsync(() => this.opsService.revokeAdminRole());
  }

  confirmUpdateAdminUserStatus(): void {
    const adminUserId = this.ops.adminStatusTargetUserId.trim();
    const status = this.ops.adminStatusValue;
    if (!adminUserId) {
      return;
    }
    const confirmed = globalThis.window?.confirm(
      `Change admin user '${adminUserId}' status to '${status}'?`
    );
    if (confirmed) {
      this.updateAdminUserStatus();
    }
  }

  private updateAdminUserStatus(): void {
    this.viewState.onActionAsync(() => this.opsService.updateAdminUserStatus());
  }

  confirmResetAdminUserPassword(): void {
    const adminUserId = this.ops.adminResetTargetUserId.trim();
    if (!adminUserId || !this.ops.adminResetPassword) {
      return;
    }
    const confirmed = globalThis.window?.confirm(
      `Reset password for admin user '${adminUserId}'?`
    );
    if (confirmed) {
      this.resetAdminUserPassword();
    }
  }

  private resetAdminUserPassword(): void {
    this.viewState.onActionAsync(() => this.opsService.resetAdminUserPassword());
  }

  applyAdminUserFilters(): void {
    this.persistState();
    this.refreshAdminUsers();
  }

  clearAdminUserFilters(): void {
    this.ops.adminUserUsernameFilter = "";
    this.ops.adminUserStatusFilter = "";
    this.ops.adminUserRoleFilter = "";
    this.ops.adminUserTenantFilter = "";
    this.ops.adminUserWorkspaceFilter = "";
    this.ops.adminUserLimit = "100";
    this.persistState();
  }

  applyAdminSessionFilters(): void {
    this.persistState();
    this.refreshAdminSessions();
  }

  clearAdminSessionFilters(): void {
    this.ops.adminSessionUserFilter = "";
    this.ops.adminSessionStatusFilter = "";
    this.ops.adminSessionLimit = "100";
    this.ops.adminSessionRevokeTargetId = "";
    this.persistState();
  }

  useCurrentAdminUserAsSessionFilter(): void {
    const payload = parseJsonDocument<AdminSessionViewPayload>(
      this.ops.adminSessionView
    );
    const adminUserId = payload?.adminUser?.adminUserId;
    if (!adminUserId) {
      return;
    }

    this.ops.adminSessionUserFilter = adminUserId;
    this.persistState();
  }

  useAdminManagementScopeAsUserFilters(): void {
    this.ops.adminUserRoleFilter = this.ops.adminRoleRole;
    this.ops.adminUserTenantFilter = this.ops.adminRoleTenantKey;
    this.ops.adminUserWorkspaceFilter =
      this.ops.adminRoleRole === "workspace_admin"
        ? this.ops.adminRoleWorkspaceKey
        : "";
    this.persistState();
  }

  applyAdminAuditFilters(): void {
    this.persistState();
    this.refreshAdminAuditEvents();
  }

  clearAdminAuditFilters(): void {
    this.ops.adminAuditEventTypeFilter = "";
    this.ops.adminAuditActorFilter = "";
    this.ops.adminAuditSubjectFilter = "";
    this.ops.adminAuditLimit = "100";
    this.persistState();
  }

  useSelectedAdminUserAsAuditSubject(): void {
    const adminUserId =
      this.ops.adminStatusTargetUserId.trim() ||
      this.ops.adminRoleTargetUserId.trim() ||
      this.ops.adminRevokeTargetUserId.trim() ||
      this.ops.adminResetTargetUserId.trim();
    if (!adminUserId) {
      return;
    }

    this.ops.adminAuditSubjectFilter = adminUserId;
    this.persistState();
  }

  signInLocalDemoAdmin(): void {
    this.viewState.onActionAsync(async () => {
      this.ops.adminUsername = localDemoAccess.adminUsername;
      this.ops.adminDisplayName = localDemoAccess.adminDisplayName;
      this.ops.adminPassword = localDemoAccess.adminPassword;
      this.persistState();
      await this.opsService.signInAdmin();
    });
  }

  selectAdminUser(item: RecordCollectionItem): void {
    const adminUserId = item.actionPayload?.adminUserId;
    if (!adminUserId) {
      return;
    }

    this.ops.adminRoleTargetUserId = adminUserId;
    this.ops.adminRevokeTargetUserId = adminUserId;
    this.ops.adminStatusTargetUserId = adminUserId;
    this.ops.adminResetTargetUserId = adminUserId;
    this.ops.adminRevokeRoleAssignmentId =
      item.actionPayload?.roleAssignmentId ??
      this.ops.adminRevokeRoleAssignmentId;
    const status = item.actionPayload?.adminUserStatus;
    if (status === "active" || status === "disabled") {
      this.ops.adminStatusValue = status;
    }
    this.persistState();
  }

  selectAdminSession(item: RecordCollectionItem): void {
    const adminUserId = item.actionPayload?.adminUserId;
    const adminSessionId = item.actionPayload?.adminSessionId;
    if (!adminUserId || !adminSessionId) {
      return;
    }

    this.ops.adminSessionUserFilter = adminUserId;
    this.ops.adminSessionRevokeTargetId = adminSessionId;
    this.persistState();
  }

  selectAdminRoleAssignment(item: RecordCollectionItem): void {
    const adminUserId = item.actionPayload?.adminUserId;
    const roleAssignmentId = item.actionPayload?.roleAssignmentId;
    if (!adminUserId || !roleAssignmentId) {
      return;
    }

    this.ops.adminRoleTargetUserId = adminUserId;
    this.ops.adminRevokeTargetUserId = adminUserId;
    this.ops.adminRevokeRoleAssignmentId = roleAssignmentId;
    this.ops.adminStatusTargetUserId = adminUserId;
    this.ops.adminResetTargetUserId = adminUserId;
    const status = item.actionPayload?.adminUserStatus;
    if (status === "active" || status === "disabled") {
      this.ops.adminStatusValue = status;
    }
    this.persistState();
  }

  selectAdminAuditEvent(item: RecordCollectionItem): void {
    const eventType = item.actionPayload?.adminAuditEventType;
    const actorAdminUserId = item.actionPayload?.actorAdminUserId;
    const subjectAdminUserId = item.actionPayload?.subjectAdminUserId;

    if (eventType) {
      this.ops.adminAuditEventTypeFilter = eventType;
    }
    if (actorAdminUserId) {
      this.ops.adminAuditActorFilter = actorAdminUserId;
    }
    if (subjectAdminUserId) {
      this.ops.adminAuditSubjectFilter = subjectAdminUserId;
      this.ops.adminRoleTargetUserId = subjectAdminUserId;
      this.ops.adminRevokeTargetUserId = subjectAdminUserId;
      this.ops.adminStatusTargetUserId = subjectAdminUserId;
      this.ops.adminResetTargetUserId = subjectAdminUserId;
    }
    this.persistState();
  }

  persistState(): void {
    this.viewState.persistShellState();
  }

  get adminSessionItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<AdminSessionViewPayload>(
      this.ops.adminSessionView
    );
    const adminUser = payload?.adminUser ?? null;
    const adminSession = payload?.adminSession ?? null;
    const roleAssignments = payload?.roleAssignments ?? [];
    const tokenPresent = this.ops.adminSessionToken.trim() !== "";

    return [
      {
        headline: adminUser?.username ?? this.ops.adminUsername,
        subline: tokenPresent
          ? "Bearer token is stored in this browser"
          : "No admin bearer token stored",
        badges: [
          tokenPresent ? "signed-in" : "signed-out",
          ...roleAssignments.map(roleAssignment => roleAssignment.role)
        ],
        rows: [
          {
            label: "Display Name",
            value: adminUser?.displayName ?? this.ops.adminDisplayName
          },
          {
            label: "Session",
            value: adminSession?.adminSessionId ?? "n/a"
          },
          {
            label: "Expires",
            value: adminSession?.expiresAt
              ? this.formatDateTime(adminSession.expiresAt)
              : "n/a"
          },
          {
            label: "Revoked",
            value: adminSession?.revokedAt
              ? this.formatDateTime(adminSession.revokedAt)
              : "no"
          }
        ]
      }
    ];
  }

  get adminSessionDirectoryItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<ListAdminSessionsResponse>(
      this.ops.adminSessionsView
    );
    if (!payload) {
      return [];
    }

    return [
      this.buildReadWindowItem(
        "Admin session window",
        "admin session",
        payload.items.length,
        this.ops.adminSessionLimit,
        [
          this.ops.adminSessionUserFilter.trim() ? "admin user" : "",
          this.ops.adminSessionStatusFilter.trim() ? "status" : ""
        ].filter(Boolean)
      ),
      ...payload.items.map(item => ({
        headline: item.adminUser.username,
        subline: `${item.status} session ${item.adminSession.adminSessionId}`,
        badges: [item.status, item.adminUser.status],
        rows: [
          { label: "Admin User ID", value: item.adminUser.adminUserId },
          {
            label: "Created",
            value: this.formatDateTime(item.adminSession.createdAt)
          },
          {
            label: "Expires",
            value: this.formatDateTime(item.adminSession.expiresAt)
          },
          {
            label: "Revoked",
            value: item.adminSession.revokedAt
              ? this.formatDateTime(item.adminSession.revokedAt)
              : "no"
          }
        ],
        actionLabel: "Select Session",
        actionPayload: {
          adminSessionId: item.adminSession.adminSessionId,
          adminUserId: item.adminUser.adminUserId
        }
      }))
    ];
  }

  get adminUserItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<ListAdminUsersResponse>(
      this.ops.adminUsersView
    );
    if (!payload) {
      return [];
    }

    return [
      this.buildReadWindowItem(
        "Admin user window",
        "admin user",
        payload.items.length,
        this.ops.adminUserLimit,
        [
          this.ops.adminUserUsernameFilter.trim() ? "username" : "",
          this.ops.adminUserStatusFilter.trim() ? "status" : "",
          this.ops.adminUserRoleFilter.trim() ? "role" : "",
          this.ops.adminUserTenantFilter.trim() ? "tenant" : "",
          this.ops.adminUserWorkspaceFilter.trim() ? "workspace" : ""
        ].filter(Boolean)
      ),
      ...payload.items.map(item => ({
        headline: item.adminUser.username,
        subline: item.adminUser.displayName,
        badges: [
          item.adminUser.status,
          ...item.roleAssignments.map(roleAssignment => roleAssignment.role)
        ],
        rows: [
          {
            label: "Admin User ID",
            value: item.adminUser.adminUserId
          },
          {
            label: "Created",
            value: this.formatDateTime(item.adminUser.createdAt)
          },
          {
            label: "Role Scopes",
            value: item.roleAssignments
              .map(roleAssignment =>
                [
                  roleAssignment.role,
                  roleAssignment.tenantId ?? "platform",
                  roleAssignment.workspaceId ?? "all-workspaces",
                  roleAssignment.roleAssignmentId
                ].join(" / ")
              )
              .join(", ")
          }
        ],
        selected:
          item.adminUser.adminUserId === this.ops.adminRoleTargetUserId ||
          item.adminUser.adminUserId === this.ops.adminRevokeTargetUserId ||
          item.adminUser.adminUserId === this.ops.adminStatusTargetUserId,
        actionLabel: "Use For Admin Actions",
        actionPayload: {
          adminUserId: item.adminUser.adminUserId,
          roleAssignmentId: item.roleAssignments[0]?.roleAssignmentId ?? "",
          adminUserStatus: item.adminUser.status
        }
      }))
    ];
  }

  get adminRoleAssignmentItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<ListAdminUsersResponse>(
      this.ops.adminUsersView
    );
    if (!payload) {
      return [];
    }

    const roleAssignmentItems = payload.items.flatMap(item =>
      item.roleAssignments.map(roleAssignment => ({
        headline: roleAssignment.role,
        subline: item.adminUser.username,
        badges: [
          item.adminUser.status,
          roleAssignment.workspaceId
            ? "workspace-scope"
            : roleAssignment.tenantId
              ? "tenant-scope"
              : "platform-scope"
        ],
        rows: [
          {
            label: "Admin User ID",
            value: item.adminUser.adminUserId
          },
          {
            label: "Role Assignment ID",
            value: roleAssignment.roleAssignmentId
          },
          {
            label: "Tenant ID",
            value: roleAssignment.tenantId ?? "platform"
          },
          {
            label: "Workspace ID",
            value: roleAssignment.workspaceId ?? "all-workspaces"
          },
          {
            label: "Created",
            value: this.formatDateTime(roleAssignment.createdAt)
          }
        ],
        selected:
          roleAssignment.roleAssignmentId === this.ops.adminRevokeRoleAssignmentId,
        actionLabel: "Use For Revoke",
        actionPayload: {
          adminUserId: item.adminUser.adminUserId,
          roleAssignmentId: roleAssignment.roleAssignmentId,
          adminUserStatus: item.adminUser.status
        }
      }))
    );

    return [
      {
        headline: "Admin role assignment window",
        subline: `${roleAssignmentItems.length} role assignment row(s) loaded from admin users`,
        badges: [`${payload.items.length} source user(s)`, "role scopes"],
        rows: [
          { label: "Loaded Assignments", value: String(roleAssignmentItems.length) },
          { label: "Source Users", value: String(payload.items.length) },
          {
            label: "Selected Assignment",
            value: this.ops.adminRevokeRoleAssignmentId.trim() || "none"
          }
        ]
      },
      ...roleAssignmentItems
    ];
  }

  get adminAuditItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<ListAdminAuditEventsResponse>(
      this.ops.adminAuditView
    );
    if (!payload) {
      return [];
    }

    return [
      this.buildReadWindowItem(
        "Admin audit window",
        "admin audit event",
        payload.items.length,
        this.ops.adminAuditLimit,
        [
          this.ops.adminAuditEventTypeFilter.trim() ? "event type" : "",
          this.ops.adminAuditActorFilter.trim() ? "actor" : "",
          this.ops.adminAuditSubjectFilter.trim() ? "subject" : ""
        ].filter(Boolean)
      ),
      ...payload.items.map(auditEvent => ({
        headline: auditEvent.eventType,
        subline: this.formatDateTime(auditEvent.occurredAt),
        badges: [
          auditEvent.actorAdminUserId ? "actor" : "system",
          auditEvent.subjectAdminUserId ? "subject" : "no-subject"
        ],
        rows: [
          {
            label: "Summary",
            value: auditEvent.summary
          },
          {
            label: "Audit Event ID",
            value: auditEvent.adminAuditEventId
          },
          {
            label: "Actor Admin User ID",
            value: auditEvent.actorAdminUserId ?? "system"
          },
          {
            label: "Subject Admin User ID",
            value: auditEvent.subjectAdminUserId ?? "n/a"
          },
          {
            label: "Details",
            value: this.stringifyValue(auditEvent.details)
          }
        ],
        selected:
          auditEvent.subjectAdminUserId != null &&
          auditEvent.subjectAdminUserId === this.ops.adminAuditSubjectFilter.trim(),
        actionLabel: "Use Audit Scope",
        actionPayload: {
          adminAuditEventType: auditEvent.eventType,
          actorAdminUserId: auditEvent.actorAdminUserId ?? "",
          subjectAdminUserId: auditEvent.subjectAdminUserId ?? ""
        }
      }))
    ];
  }

  get opsActionItems(): RecordCollectionItem[] {
    const health = parseJsonDocument(this.ops.runtimeHealthView);
    const metrics = parseJsonDocument<RuntimeMetricsPayload>(this.ops.runtimeMetricsView);
    const diagnostics = parseJsonDocument<GetRuntimeDiagnosticsResponse>(
      this.ops.runtimeDiagnosticsView
    );
    const config = parseJsonDocument<GetRuntimeConfigResponse>(
      this.ops.runtimeConfigView
    )?.runtimeConfig;
    const items: RecordCollectionItem[] = [];
    const readinessStatus =
      readStringValue(health, ["readiness", "status"]) ?? this.ops.readinessBadge;

    if (!health || !metrics || !diagnostics || !config) {
      items.push({
        headline: "Refresh full diagnostics",
        subline: "Some operational read models are not loaded yet",
        badges: ["diagnostics", "read model"],
        rows: [
          {
            label: "Readiness",
            value: readinessStatus || "unknown"
          },
          {
            label: "Expected Result",
            value: "Load health, readiness, manifest, metrics, diagnostics, and config"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { opsCommand: "refreshDiagnostics" }
      });
      return items;
    }

    if (readinessStatus !== "ready") {
      items.push({
        headline: "Re-check readiness edge",
        subline: `Current readiness is ${readinessStatus}`,
        badges: ["readiness", "attention"],
        rows: [
          {
            label: "Storage",
            value: `${this.ops.storageKind} schema ${this.ops.storageSchemaVersion}`
          },
          {
            label: "Expected Result",
            value: "Refresh diagnostics and recent runtime events"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { opsCommand: "refreshDiagnostics" }
      });
    }

    const errorEntries = Object.entries(metrics.errorCounts)
      .filter(([, count]) => count > 0)
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
    const latestError = diagnostics.recentEvents.find(event => event.level === "error");
    if (errorEntries.length > 0 || latestError) {
      items.push({
        headline: latestError?.event ?? "Inspect error counters",
        subline: latestError
          ? this.formatDateTime(latestError.occurredAt)
          : `${errorEntries.length} non-zero error bucket(s)`,
        badges: ["errors", "diagnostics"],
        rows: [
          {
            label: "Top Error Bucket",
            value: errorEntries[0] ? `${errorEntries[0][0]} (${errorEntries[0][1]})` : "none"
          },
          {
            label: "Expected Result",
            value: "Refresh diagnostics and inspect recent operational events"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { opsCommand: "refreshDiagnostics" }
      });
    }

    if (config.storage.kind === "memory" || config.storage.kind === "file") {
      items.push({
        headline: "Review production storage posture",
        subline: `${config.storage.kind} storage is active`,
        badges: ["deployability", "storage"],
        rows: [
          {
            label: "Location",
            value: config.storage.location ?? "in-memory"
          },
          {
            label: "Expected Result",
            value: "Confirm whether this environment should move to sqlite or postgres"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { opsCommand: "refreshDiagnostics" }
      });
    }

    items.push({
      headline: "Refresh process metrics",
      subline: `${metrics.runtime.completedRequests} completed request(s)`,
      badges: ["metrics", metrics.runtime.lifecycle.phase],
      rows: [
        {
          label: "Active Requests",
          value: String(metrics.runtime.activeRequests)
        },
        {
          label: "Expected Result",
          value: "Update request volume, latency, memory, and status counters"
        }
      ],
      actionLabel: "Apply Suggestion",
      actionPayload: { opsCommand: "refreshMetrics" }
    });

    return items;
  }

  get localDemoAccessItems(): RecordCollectionItem[] {
    const config = parseJsonDocument<GetRuntimeConfigResponse>(
      this.ops.runtimeConfigView
    )?.runtimeConfig;
    if (!config?.environment.firstSliceBootstrapDemo) {
      return [];
    }

    return [
      {
        headline: "Local demo is ready",
        subline: `${localDemoAccess.tenantKey} / ${localDemoAccess.workspaceKey}`,
        badges: ["demo bootstrap", config.storage.kind],
        rows: [
          {
            label: "Admin",
            value: `${localDemoAccess.adminUsername} / ${localDemoAccess.adminPassword}`
          },
          {
            label: "Participant",
            value: localDemoAccess.participantPath,
            href: localDemoAccess.participantPath
          },
          {
            label: "Login Key",
            value: localDemoAccess.participantLoginKey
          }
        ],
        actionLabel: "Sign In Demo Admin",
        actionPayload: { demoCommand: "signInLocalDemoAdmin" }
      }
    ];
  }

  runLocalDemoAccessAction(item: RecordCollectionItem): void {
    if (item.actionPayload?.demoCommand === "signInLocalDemoAdmin") {
      this.signInLocalDemoAdmin();
    }
  }

  runOpsSuggestion(item: RecordCollectionItem): void {
    switch (item.actionPayload?.opsCommand) {
      case "refreshMetrics":
        this.refreshMetrics();
        break;
      case "refreshDiagnostics":
      default:
        this.refreshDiagnostics();
        break;
    }
  }

  get readinessItems(): RecordCollectionItem[] {
    const health = parseJsonDocument(this.ops.runtimeHealthView);
    const healthStatus = readStringValue(health, ["health", "status"]) ?? "unknown";
    const readinessStatus = readStringValue(health, ["readiness", "status"]) ?? "unknown";
    const buildCommit =
      readStringValue(health, ["manifest", "build", "commitSha"]) ?? "n/a";

    return [
      {
        headline: readinessStatus,
        subline: `health ${healthStatus}`,
        badges: [this.ops.storageKind, `schema ${this.ops.storageSchemaVersion}`],
        rows: [
          { label: "Build Commit", value: buildCommit },
          {
            label: "Build Timestamp",
            value: readStringValue(health, ["manifest", "build", "builtAt"]) ?? "n/a"
          }
        ]
      }
    ];
  }

  get runtimeSurfaceItems(): RecordCollectionItem[] {
    const health = parseJsonDocument(this.ops.runtimeHealthView);
    const healthStatus = readStringValue(health, ["health", "status"]) ?? "unknown";
    const readinessStatus = readStringValue(health, ["readiness", "status"]) ?? "unknown";
    const phase = readStringValue(health, ["manifest", "phase"]) ?? "unknown";
    const storageKind =
      readStringValue(health, ["manifest", "storage", "kind"]) ?? this.ops.storageKind;
    const storageSchemaVersion =
      readStringValue(health, ["manifest", "storage", "schemaVersion"]) ??
      String(this.ops.storageSchemaVersion);
    const routeGroups = readStringValue(health, ["manifest", "routes"]) ?? "n/a";

    return [
      {
        headline: phase,
        subline: `health ${healthStatus} · readiness ${readinessStatus}`,
        badges: [storageKind, `schema ${storageSchemaVersion}`],
        rows: [
          {
            label: "Route Groups",
            value: routeGroups
          },
          {
            label: "Build Commit",
            value: readStringValue(health, ["manifest", "build", "commitSha"]) ?? "n/a"
          },
          {
            label: "Build Timestamp",
            value: readStringValue(health, ["manifest", "build", "builtAt"]) ?? "n/a"
          }
        ]
      }
    ];
  }

  get buildIdentityItems(): RecordCollectionItem[] {
    const health = parseJsonDocument(this.ops.runtimeHealthView);
    const phase = readStringValue(health, ["manifest", "phase"]) ?? "unknown";
    const buildCommit =
      readStringValue(health, ["manifest", "build", "commitSha"]) ?? "n/a";
    const buildTimestamp =
      readStringValue(health, ["manifest", "build", "builtAt"]) ?? "n/a";

    return [
      {
        headline: buildCommit,
        subline: phase,
        badges: [this.ops.storageKind, `schema ${this.ops.storageSchemaVersion}`],
        rows: [
          {
            label: "Build Timestamp",
            value: buildTimestamp
          },
          {
            label: "Readiness",
            value: this.ops.readinessBadge
          }
        ]
      }
    ];
  }

  get manifestCapabilityItems(): RecordCollectionItem[] {
    const manifest = parseJsonDocument<RuntimeHealthPayload>(
      this.ops.runtimeHealthView
    )?.manifest;
    const capabilities = manifest?.capabilities ?? [];
    if (capabilities.length === 0) {
      return [];
    }

    const groupedCapabilities = capabilities.reduce<Record<string, string[]>>(
      (groups, capability) => {
        const groupName = this.capabilityGroupName(capability);
        groups[groupName] = [...(groups[groupName] ?? []), capability];
        return groups;
      },
      {}
    );

    return Object.entries(groupedCapabilities)
      .sort(
        (left, right) =>
          right[1].length - left[1].length || left[0].localeCompare(right[0])
      )
      .map(([groupName, groupCapabilities]) => ({
        headline: groupName,
        subline: `${groupCapabilities.length} capability(s)`,
        badges: groupCapabilities.slice(0, 3).map(capability =>
          this.humanizeKey(capability)
        ),
        rows: [
          {
            label: "Capabilities",
            value: groupCapabilities.map(capability => this.humanizeKey(capability)).join(", ")
          },
          {
            label: "Manifest Coverage",
            value: `${capabilities.length} total advertised capability(s)`
          }
        ]
      }));
  }

  get manifestRouteGroupItems(): RecordCollectionItem[] {
    const manifest = parseJsonDocument<RuntimeHealthPayload>(
      this.ops.runtimeHealthView
    )?.manifest;
    const routeGroups = manifest?.routes ?? {};

    return Object.entries(routeGroups)
      .sort(([leftGroup], [rightGroup]) => leftGroup.localeCompare(rightGroup))
      .map(([groupName, routes]) => {
        const routeNames = this.flattenRouteNames(routes);
        const listedRouteNames = routeNames.slice(0, 8);
        const hiddenRouteCount = Math.max(
          routeNames.length - listedRouteNames.length,
          0
        );
        return {
          headline: this.humanizeKey(groupName),
          subline: `${this.countRouteLeaves(routes)} route(s)`,
          badges: routeNames.slice(0, 3).map(routeName => this.humanizeKey(routeName)),
          rows: [
            {
              label: "Route Names",
              value: listedRouteNames.map(routeName => this.humanizeKey(routeName)).join(", ")
            },
            {
              label: "Total Routes",
              value: String(routeNames.length)
            },
            {
              label: "Listed Routes",
              value: String(listedRouteNames.length)
            },
            {
              label: "Hidden Routes",
              value: String(hiddenRouteCount)
            },
            {
              label: "Raw Group",
              value: groupName
            }
          ]
        } satisfies RecordCollectionItem;
      });
  }

  get lifecycleItems(): RecordCollectionItem[] {
    const diagnostics = parseJsonDocument<GetRuntimeDiagnosticsResponse>(
      this.ops.runtimeDiagnosticsView
    );
    const runtime = diagnostics?.runtime;
    if (!runtime) {
      return [];
    }

    return [
      {
        headline: runtime.lifecycle.phase,
        subline: `${runtime.uptimeSeconds.toFixed(1)}s uptime`,
        badges: [
          `${runtime.activeRequests} active`,
          `${runtime.completedRequests} completed`
        ],
        rows: [
          {
            label: "Started",
            value: this.formatDateTime(runtime.startedAt)
          },
          {
            label: "Shutdown Requested",
            value: runtime.lifecycle.shutdownRequestedAt
              ? this.formatDateTime(runtime.lifecycle.shutdownRequestedAt)
              : "no"
          },
          {
            label: "Total Requests",
            value: String(runtime.totalRequests)
          }
        ]
      }
    ];
  }

  get runtimeDiagnosticsItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetRuntimeDiagnosticsResponse>(
      this.ops.runtimeDiagnosticsView
    );
    return (
      payload?.recentEvents.map(event => ({
        headline: event.event,
        subline: this.formatDateTime(event.occurredAt),
        badges: [event.level],
        rows: Object.entries(event.details).map(([key, value]) => ({
          label: this.humanizeKey(key),
          value: this.stringifyValue(value)
        }))
      })) ?? []
    );
  }

  get operationalEventSummaryItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetRuntimeDiagnosticsResponse>(
      this.ops.runtimeDiagnosticsView
    );
    if (!payload) {
      return [];
    }

    const infoCount = payload.recentEvents.filter(event => event.level === "info").length;
    const errorCount = payload.recentEvents.filter(event => event.level === "error").length;
    const latestEvent = payload.recentEvents[0];

    return [
      {
        headline: latestEvent?.event ?? "no events",
        subline: latestEvent ? this.formatDateTime(latestEvent.occurredAt) : "n/a",
        badges: [`${infoCount} info`, `${errorCount} error`],
        rows: [
          {
            label: "Recent Event Count",
            value: String(payload.recentEvents.length)
          },
          {
            label: "Latest Level",
            value: latestEvent?.level ?? "n/a"
          },
          {
            label: "Storage",
            value: payload.storage.kind
          }
        ]
      }
    ];
  }

  get runtimeConfigItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetRuntimeConfigResponse>(
      this.ops.runtimeConfigView
    );
    const config = payload?.runtimeConfig;
    if (!config) {
      return [];
    }

    return [
      {
        headline: config.storage.kind,
        subline: `port ${config.port}`,
        badges: [
          `schema ${config.storage.schemaVersion ?? "n/a"}`,
          `drain ${config.shutdownDrainDelayMs}ms`
        ],
        rows: [
          {
            label: "Location",
            value: config.storage.location ?? "in-memory"
          },
          {
            label: "Build Sha Present",
            value: config.environment.appBuildShaPresent ? "yes" : "no"
          },
          {
            label: "Build Timestamp Present",
            value: config.environment.appBuildTimestampPresent ? "yes" : "no"
          },
          {
            label: "Operator Auth Required",
            value: config.operatorAuthRequired ? "yes" : "no"
          },
          {
            label: "JSON Body Limit",
            value: `${config.maxJsonBodyBytes} bytes`
          },
          {
            label: "HTTP Timeouts",
            value: `headers ${config.httpTimeouts.headersTimeoutMs}ms, request ${config.httpTimeouts.requestTimeoutMs}ms, keep-alive ${config.httpTimeouts.keepAliveTimeoutMs}ms`
          },
          {
            label: "Postgres Url Present",
            value: config.environment.firstSlicePostgresUrlPresent ? "yes" : "no"
          }
        ]
      }
    ];
  }

  get processMetricsItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<RuntimeMetricsPayload>(this.ops.runtimeMetricsView);
    if (!payload) {
      return [];
    }

    return [
      {
        headline: payload.runtime.lifecycle.phase,
        subline: `uptime ${payload.runtime.uptimeSeconds.toFixed(1)}s`,
        badges: [
          `${payload.runtime.activeRequests} active`,
          `${payload.runtime.completedRequests} completed`
        ],
        rows: [
          {
            label: "Total Requests",
            value: String(payload.runtime.totalRequests)
          },
          {
            label: "RSS Memory",
            value: this.formatMiB(payload.memory.rssBytes)
          },
          {
            label: "Heap Used",
            value: this.formatMiB(payload.memory.heapUsedBytes)
          },
          {
            label: "Heap Total",
            value: this.formatMiB(payload.memory.heapTotalBytes)
          }
        ]
      }
    ];
  }

  get requestMethodItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<RuntimeMetricsPayload>(this.ops.runtimeMetricsView);
    return this.mapCounterItems(
      payload?.requestCountsByMethod,
      "method",
      value => [`${value} request(s)`]
    );
  }

  get requestRouteItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<RuntimeMetricsPayload>(this.ops.runtimeMetricsView);
    if (!payload) {
      return [];
    }

    return Object.entries(payload.requestCountsByRoute)
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .map(([route, count]) => {
        const latency = payload.requestLatencyByRoute[route];
        const averageLatencyMs =
          latency && latency.count > 0 ? (latency.totalMs / latency.count).toFixed(1) : "n/a";
        return {
          headline: route,
          subline: `${count} request(s)`,
          badges: latency ? [`max ${latency.maxMs.toFixed(1)}ms`] : [],
          rows: [
            {
              label: "Average Latency",
              value: averageLatencyMs === "n/a" ? averageLatencyMs : `${averageLatencyMs}ms`
            },
            {
              label: "Samples",
              value: latency ? String(latency.count) : "0"
            }
          ]
        } satisfies RecordCollectionItem;
      });
  }

  get routeLatencyBucketItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<RuntimeMetricsPayload>(this.ops.runtimeMetricsView);
    if (!payload) {
      return [];
    }

    return Object.entries(payload.requestLatencyByRoute)
      .sort((left, right) => right[1].maxMs - left[1].maxMs || left[0].localeCompare(right[0]))
      .map(([route, latency]) => {
        const bucketSummary = Object.entries(latency.bucketCounts)
          .filter(([, count]) => count > 0)
          .slice(0, 4)
          .map(([bucket, count]) => `${bucket}ms:${count}`)
          .join(" · ");

        return {
          headline: route,
          subline: `${latency.count} sample(s)`,
          badges: [
            `avg ${(latency.totalMs / Math.max(latency.count, 1)).toFixed(1)}ms`,
            `max ${latency.maxMs.toFixed(1)}ms`
          ],
          rows: [
            {
              label: "Latency Buckets",
              value: bucketSummary || "none"
            },
            {
              label: "Total Time",
              value: `${latency.totalMs.toFixed(1)}ms`
            }
          ]
        } satisfies RecordCollectionItem;
      });
  }

  get responseStatusItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<RuntimeMetricsPayload>(this.ops.runtimeMetricsView);
    return this.mapCounterItems(
      payload?.responseCountsByStatusCode,
      "status",
      value => [`${value} response(s)`]
    );
  }

  get errorCountItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<RuntimeMetricsPayload>(this.ops.runtimeMetricsView);
    return this.mapCounterItems(payload?.errorCounts, "error", value => [
      value > 0 ? "attention" : "clear"
    ]);
  }

  get operationalCards(): SummaryCard[] {
    const health = parseJsonDocument(this.ops.runtimeHealthView);
    const metrics = parseJsonDocument(this.ops.runtimeMetricsView);

    const lifecycle = readStringValue(metrics, ["runtime", "lifecycle"]) ?? "unknown";
    const uptimeSeconds =
      readNumberValue(metrics, ["runtime", "uptimeSeconds"]) ?? null;
    const completedRequests =
      readNumberValue(metrics, ["runtime", "completedRequests"]) ?? 0;
    const totalRequests =
      readNumberValue(metrics, ["runtime", "totalRequests"]) ?? 0;
    const activeRequests =
      readNumberValue(metrics, ["runtime", "activeRequests"]) ?? 0;
    const rssBytes = readNumberValue(metrics, ["memory", "rssBytes"]) ?? 0;
    const buildCommit =
      readStringValue(health, ["manifest", "build", "commitSha"]) ?? "n/a";

    return [
      {
        label: "Readiness",
        headline: this.ops.readinessBadge,
        detail: `${this.ops.storageKind} schema ${this.ops.storageSchemaVersion}`
      },
      {
        label: "Lifecycle",
        headline: lifecycle,
        detail:
          uptimeSeconds == null
            ? `Build ${buildCommit}`
            : `${uptimeSeconds.toFixed(1)}s uptime · build ${buildCommit}`
      },
      {
        label: "Requests",
        headline: String(completedRequests),
        detail: `${activeRequests} active · ${totalRequests} total`
      },
      {
        label: "Memory",
        headline: this.formatMiB(rssBytes),
        detail: "Resident set size"
      }
    ];
  }

  private formatMiB(bytes: number): string {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
  }

  private mapCounterItems(
    counters: Record<string, number> | undefined,
    label: string,
    badgeFactory: (value: number) => string[]
  ): RecordCollectionItem[] {
    return Object.entries(counters ?? {})
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .map(([key, value]) => ({
        headline: key,
        subline: `${label} counter`,
        badges: badgeFactory(value),
        rows: [
          {
            label: "Count",
            value: String(value)
          }
        ]
      }));
  }

  private formatDateTime(value: string): string {
    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  }

  private buildReadWindowItem(
    headline: string,
    recordLabel: string,
    loadedCount: number,
    limit: string,
    activeFilters: string[]
  ): RecordCollectionItem {
    return {
      headline,
      subline: `${loadedCount} ${recordLabel} row(s) loaded for the current filters`,
      badges: [`${activeFilters.length} active filter(s)`, `limit ${limit}`],
      rows: [
        { label: "Loaded Records", value: String(loadedCount) },
        { label: "Limit", value: limit },
        {
          label: "Active Filters",
          value: activeFilters.length > 0 ? activeFilters.join(", ") : "none"
        }
      ]
    };
  }

  private humanizeKey(value: string): string {
    return value
      .replace(/([A-Z])/g, " $1")
      .replace(/[_-]/g, " ")
      .replace(/^\w/, firstCharacter => firstCharacter.toUpperCase());
  }

  private capabilityGroupName(capability: string): string {
    if (capability.startsWith("admin_")) {
      return "Admin Control";
    }
    if (
      capability.startsWith("source_") ||
      capability.startsWith("import_") ||
      capability.startsWith("content_")
    ) {
      return "Content Release";
    }
    if (
      capability.startsWith("participant_") ||
      capability.startsWith("test_run_")
    ) {
      return "Participant Runtime";
    }
    if (capability.startsWith("workspace_") || capability.startsWith("tenant_")) {
      return "Workspace Setup";
    }
    if (capability.startsWith("study_") || capability.startsWith("monitor_")) {
      return "Monitoring";
    }
    if (
      capability.startsWith("response_") ||
      capability.startsWith("review_") ||
      capability.startsWith("log_") ||
      capability.startsWith("result_") ||
      capability.startsWith("detailed_")
    ) {
      return "Operator Reads";
    }
    if (capability.startsWith("system_") || capability.startsWith("frontend_")) {
      return "Runtime Surface";
    }
    return "Other";
  }

  private countRouteLeaves(value: unknown): number {
    if (typeof value === "string") {
      return 1;
    }
    if (!value || typeof value !== "object") {
      return 0;
    }
    return Object.values(value).reduce(
      (total, child) => total + this.countRouteLeaves(child),
      0
    );
  }

  private flattenRouteNames(value: unknown): string[] {
    if (!value || typeof value !== "object") {
      return [];
    }
    return Object.entries(value).flatMap(([key, child]) =>
      typeof child === "string" ? [key] : this.flattenRouteNames(child)
    );
  }

  private isScopedAdminRoleInputComplete(
    role: AdminRole,
    tenantKey: string,
    workspaceKey: string
  ): boolean {
    if (role === "platform_admin") {
      return true;
    }

    if (role === "tenant_admin") {
      return tenantKey.trim() !== "";
    }

    return tenantKey.trim() !== "" && workspaceKey.trim() !== "";
  }

  private stringifyValue(value: unknown): string {
    if (value == null) {
      return "null";
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    try {
      return JSON.stringify(value);
    } catch {
      return "[unserializable]";
    }
  }
}
