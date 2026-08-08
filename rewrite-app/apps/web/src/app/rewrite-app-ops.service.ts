import { Injectable, inject } from "@angular/core";

import type {
  AdminSignInRequest,
  AdminSignInResponse,
  AdminSignOutResponse,
  AssignAdminRoleRequest,
  AssignAdminRoleResponse,
  BootstrapAdminUserRequest,
  BootstrapAdminUserResponse,
  CreateAdminUserRequest,
  CreateAdminUserResponse,
  GetAdminCurrentSessionResponse,
  ListAdminSessionsResponse,
  ListAdminAuditEventsResponse,
  ListAdminUsersResponse,
  ResetAdminUserPasswordRequest,
  ResetAdminUserPasswordResponse,
  RevokeAdminRoleResponse,
  RevokeAdminSessionsRequest,
  RevokeAdminSessionsResponse,
  RevokeAdminSessionResponse,
  UpdateAdminUserRequest,
  UpdateAdminUserResponse
} from "@testcenter-rewrite-app/contracts";
import {
  productionApiRoutes,
  resolveRoutePath
} from "@testcenter-rewrite-app/contracts";
import type {
  AdminUserStatus,
  MonitorViewProfile
} from "@testcenter-rewrite-app/domain";

import { RewriteAppShellFeedbackService } from "./rewrite-app-shell-feedback.service";
import { RewriteAppShellPersistenceService } from "./rewrite-app-shell-persistence.service";
import { RewriteAppShellRequestService } from "./rewrite-app-shell-request.service";
import { downloadTextFile } from "./download-text-file";
import {
  refreshMetricsOnlyAction,
  refreshOperationalDiagnosticsAction
} from "./rewrite-app-shell.ops";
import { prettyPrintJson } from "./rewrite-app-shell.readers";
import { RewriteAppShellOpsHostsService } from "./rewrite-app-shell-ops-hosts.service";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";

export type AdminUserStatusBatchResult = {
  requestedCount: number;
  succeededAdminUserIds: string[];
  failures: Array<{
    adminUserId: string;
    error: string;
  }>;
};

export type AdminUserRoleBatchResult = {
  requestedCount: number;
  succeededAdminUserIds: string[];
  failures: Array<{
    adminUserId: string;
    error: string;
  }>;
};

@Injectable({ providedIn: "root" })
export class RewriteAppOpsService {
  private readonly hosts = inject(RewriteAppShellOpsHostsService);
  private readonly requestState = inject(RewriteAppShellRequestService);
  private readonly feedback = inject(RewriteAppShellFeedbackService);
  private readonly persistence = inject(RewriteAppShellPersistenceService);
  private readonly uiState = inject(RewriteAppUiStateService);

  private readonly opsState = this.uiState.ops;

  async refreshOperationalDiagnostics(quiet = false): Promise<void> {
    await refreshOperationalDiagnosticsAction(this.hosts.createShellOpsHost(), quiet);
  }

  async refreshMetricsOnly(): Promise<void> {
    await refreshMetricsOnlyAction(this.hosts.createShellOpsHost());
  }

  async bootstrapOrSignInAdmin(): Promise<void> {
    try {
      await this.bootstrapAdminUser();
    } catch (error) {
      if (
        !this.requestState.isApiError(error) ||
        error.error !== "admin_bootstrap_already_completed"
      ) {
        throw error;
      }
      this.feedback.rememberActivity(
        "Admin Bootstrap Skipped",
        "An admin user already exists; signing in with the provided credentials."
      );
    }

    await this.signInAdmin();
  }

  async bootstrapAdmin(): Promise<void> {
    await this.bootstrapAdminUser();
    this.opsState.adminPassword = "";
    this.persistence.persistShellState();
  }

  async signInAdmin(): Promise<void> {
    const payload = await this.requestState.request<AdminSignInResponse>(
      "Admin Sign In",
      "POST",
      productionApiRoutes.admin.signIn,
      {
        username: this.opsState.adminUsername.trim(),
        password: this.opsState.adminPassword
      } satisfies AdminSignInRequest
    );

    this.applyAdminAuthPayload(payload);
    this.opsState.adminSessionToken = payload.sessionToken;
    this.opsState.adminPassword = "";
    this.feedback.rememberActivity(
      "Admin Signed In",
      `${payload.adminUser.username} has ${payload.roleAssignments.length} role assignment(s).`
    );
    this.persistence.persistShellState();
  }

  async refreshAdminSession(): Promise<void> {
    if (!this.hasAdminSession()) {
      return;
    }
    const payload = await this.requestState.request<GetAdminCurrentSessionResponse>(
      "Admin Current Session",
      "GET",
      productionApiRoutes.admin.currentSession,
      undefined,
      { headers: this.createAdminHeaders() }
    );

    this.applyAdminAuthPayload(payload);
    this.feedback.rememberActivity(
      "Admin Session Refreshed",
      `${payload.adminUser.username} is authenticated.`
    );
    this.persistence.persistShellState();
  }

  async refreshAdminSessions(): Promise<void> {
    if (!this.hasAdminSession()) {
      return;
    }
    const payload = await this.requestState.request<ListAdminSessionsResponse>(
      "Admin Sessions",
      "GET",
      this.buildAdminSessionsPath(),
      undefined,
      { headers: this.createAdminHeaders() }
    );

    this.opsState.adminSessionsView = prettyPrintJson(
      payload,
      this.opsState.adminSessionsView
    );
    this.feedback.rememberActivity(
      "Admin Sessions Refreshed",
      `${payload.items.length} admin session(s) loaded from persistent storage.`
    );
  }

  async signOutAdmin(): Promise<void> {
    if (!this.hasAdminSession()) {
      return;
    }
    const payload = await this.requestState.request<AdminSignOutResponse>(
      "Admin Sign Out",
      "POST",
      productionApiRoutes.admin.signOut,
      undefined,
      { headers: this.createAdminHeaders() }
    );

    this.opsState.adminSessionView = prettyPrintJson(
      payload,
      this.opsState.adminSessionView
    );
    this.opsState.adminSessionToken = "";
    this.feedback.rememberActivity(
      "Admin Signed Out",
      `Session ${payload.adminSession.adminSessionId} was revoked.`
    );
    this.persistence.persistShellState();
  }

  async revokeAdminSession(): Promise<void> {
    if (!this.hasAdminSession()) {
      return;
    }
    const adminSessionId = this.opsState.adminSessionRevokeTargetId.trim();
    const payload = await this.requestState.request<RevokeAdminSessionResponse>(
      "Revoke Admin Session",
      "DELETE",
      resolveRoutePath(productionApiRoutes.admin.revokeSession, {
        adminSessionId
      }),
      undefined,
      { headers: this.createAdminHeaders() }
    );

    this.opsState.adminSessionRevokeTargetId = "";
    this.feedback.rememberActivity(
      "Admin Session Revoked",
      `Session ${payload.adminSession.adminSessionId} was revoked.`
    );
    this.persistence.persistShellState();
    await this.refreshAdminSessions();
  }

  async revokeAdminSessions(
    adminSessionIds: string[]
  ): Promise<RevokeAdminSessionsResponse> {
    if (!this.hasAdminSession()) {
      return {
        requestedCount: 0,
        adminSessions: [],
        failures: []
      };
    }
    const uniqueAdminSessionIds = [
      ...new Set(
        adminSessionIds.map(adminSessionId => adminSessionId.trim()).filter(Boolean)
      )
    ].slice(0, 50);
    const payload = await this.requestState.request<RevokeAdminSessionsResponse>(
      "Revoke Selected Admin Sessions",
      "POST",
      productionApiRoutes.admin.revokeSessions,
      {
        adminSessionIds: uniqueAdminSessionIds
      } satisfies RevokeAdminSessionsRequest,
      { headers: this.createAdminHeaders() }
    );

    this.feedback.rememberActivity(
      "Admin Session Batch Revoked",
      `${payload.adminSessions.length}/${payload.requestedCount} selected session(s) revoked; ${payload.failures.length} failed.`
    );
    await this.refreshAdminSessions();
    return payload;
  }

  async exportAdminSessionsCsv(): Promise<void> {
    if (!this.hasAdminSession()) {
      return;
    }
    const csv = await this.requestState.request<string>(
      "Admin Sessions CSV",
      "GET",
      this.buildAdminSessionsExportPath(),
      undefined,
      {
        headers: {
          ...this.createAdminHeaders(),
          Accept: "text/csv"
        }
      }
    );

    this.opsState.adminSessionsExportView = csv;
    downloadTextFile({
      filename: "admin-sessions.csv",
      mediaType: "text/csv;charset=utf-8",
      text: csv
    });
    this.feedback.rememberActivity(
      "Admin Sessions CSV Downloaded",
      `${csv.split(/\r?\n/).filter(Boolean).length - 1} admin session row(s) exported to admin-sessions.csv.`
    );
  }

  async refreshAdminUsers(): Promise<void> {
    if (!this.hasAdminSession()) {
      return;
    }
    const payload = await this.requestState.request<ListAdminUsersResponse>(
      "Admin Users",
      "GET",
      this.buildAdminUsersPath(),
      undefined,
      { headers: this.createAdminHeaders() }
    );

    this.opsState.adminUsersView = prettyPrintJson(
      payload,
      this.opsState.adminUsersView
    );
    this.feedback.rememberActivity(
      "Admin Users Refreshed",
      `${payload.items.length} admin user(s) loaded from the protected directory.`
    );
  }

  async exportAdminUsersCsv(): Promise<void> {
    if (!this.hasAdminSession()) {
      return;
    }
    const csv = await this.requestState.request<string>(
      "Admin Users CSV",
      "GET",
      this.buildAdminUsersExportPath(),
      undefined,
      {
        headers: {
          ...this.createAdminHeaders(),
          Accept: "text/csv"
        }
      }
    );

    this.opsState.adminUsersExportView = csv;
    downloadTextFile({
      filename: "admin-users.csv",
      mediaType: "text/csv;charset=utf-8",
      text: csv
    });
    this.feedback.rememberActivity(
      "Admin Users CSV Downloaded",
      "Filtered admin users were exported to admin-users.csv."
    );
  }

  async refreshAdminAuditEvents(): Promise<void> {
    if (!this.hasAdminSession()) {
      return;
    }
    const payload = await this.requestState.request<ListAdminAuditEventsResponse>(
      "Admin Audit Events",
      "GET",
      this.buildAdminAuditEventsPath(),
      undefined,
      { headers: this.createAdminHeaders() }
    );

    this.opsState.adminAuditView = prettyPrintJson(
      payload,
      this.opsState.adminAuditView
    );
    this.feedback.rememberActivity(
      "Admin Audit Events Refreshed",
      `${payload.items.length} admin audit event(s) loaded from persistent storage.`
    );
  }

  async exportAdminAuditEventsCsv(): Promise<void> {
    if (!this.hasAdminSession()) {
      return;
    }
    const csv = await this.requestState.request<string>(
      "Admin Audit Events CSV",
      "GET",
      this.buildAdminAuditEventsExportPath(),
      undefined,
      {
        headers: {
          ...this.createAdminHeaders(),
          Accept: "text/csv"
        }
      }
    );

    this.opsState.adminAuditExportView = csv;
    downloadTextFile({
      filename: "admin-audit-events.csv",
      mediaType: "text/csv;charset=utf-8",
      text: csv
    });
    this.feedback.rememberActivity(
      "Admin Audit CSV Downloaded",
      "Filtered admin audit events were exported to admin-audit-events.csv."
    );
  }

  async createAdminUser(): Promise<void> {
    if (!this.hasAdminSession()) {
      return;
    }
    const payload = await this.requestState.request<CreateAdminUserResponse>(
      "Create Admin User",
      "POST",
      productionApiRoutes.admin.createUser,
      {
        username: this.opsState.adminCreateUsername.trim(),
        displayName: this.opsState.adminCreateDisplayName.trim() || undefined,
        password: this.opsState.adminCreatePassword,
        validFrom: this.opsState.adminCreateValidFrom.trim() || undefined,
        validTo: this.opsState.adminCreateValidTo.trim() || undefined,
        validForMinutes: this.opsState.adminCreateValidForMinutes.trim()
          ? Number(this.opsState.adminCreateValidForMinutes.trim())
          : undefined,
        roleAssignments: [
          this.createRoleAssignmentRequest(
            this.opsState.adminCreateRole,
            this.opsState.adminCreateAccessMode,
            this.opsState.adminCreateTenantKey,
            this.opsState.adminCreateWorkspaceKey,
            this.opsState.adminCreateGroupKey,
            this.opsState.adminCreateMonitorProfilesJson
          )
        ]
      } satisfies CreateAdminUserRequest,
      { headers: this.createAdminHeaders() }
    );

    this.opsState.adminCreatePassword = "";
    this.opsState.adminCreateValidFrom = "";
    this.opsState.adminCreateValidTo = "";
    this.opsState.adminCreateValidForMinutes = "";
    this.opsState.adminCreateMonitorProfilesJson = "[]";
    this.opsState.adminRoleTargetUserId = payload.adminUser.adminUserId;
    this.opsState.adminRevokeTargetUserId = payload.adminUser.adminUserId;
    this.opsState.adminRevokeRoleAssignmentId =
      payload.roleAssignments[0]?.roleAssignmentId ?? "";
    this.opsState.adminStatusTargetUserId = payload.adminUser.adminUserId;
    this.opsState.adminResetTargetUserId = payload.adminUser.adminUserId;
    this.feedback.rememberActivity(
      "Admin User Created",
      `${payload.adminUser.username} was created with ${payload.roleAssignments.length} role assignment(s).`
    );
    this.persistence.persistShellState();
    await this.refreshAdminUsers();
  }

  async assignAdminRole(): Promise<void> {
    if (!this.hasAdminSession()) {
      return;
    }
    const adminUserId = this.opsState.adminRoleTargetUserId.trim();
    const payload = await this.requestState.request<AssignAdminRoleResponse>(
      "Assign Admin Role",
      "POST",
      resolveRoutePath(productionApiRoutes.admin.assignRole, { adminUserId }),
      this.createRoleAssignmentRequest(
        this.opsState.adminRoleRole,
        this.opsState.adminRoleAccessMode,
        this.opsState.adminRoleTenantKey,
        this.opsState.adminRoleWorkspaceKey,
        this.opsState.adminRoleGroupKey,
        this.opsState.adminRoleMonitorProfilesJson
      ) satisfies AssignAdminRoleRequest,
      { headers: this.createAdminHeaders() }
    );

    this.opsState.adminStatusTargetUserId = payload.adminUser.adminUserId;
    this.opsState.adminResetTargetUserId = payload.adminUser.adminUserId;
    this.opsState.adminRevokeTargetUserId = payload.adminUser.adminUserId;
    this.opsState.adminRevokeRoleAssignmentId =
      payload.roleAssignments[payload.roleAssignments.length - 1]?.roleAssignmentId ??
      "";
    this.feedback.rememberActivity(
      "Admin Role Assigned",
      `${payload.adminUser.username} now has ${payload.roleAssignments.length} role assignment(s).`
    );
    this.persistence.persistShellState();
    await this.refreshAdminUsers();
  }

  async assignAdminRoles(
    adminUserIds: string[]
  ): Promise<AdminUserRoleBatchResult> {
    if (!this.hasAdminSession()) {
      return {
        requestedCount: 0,
        succeededAdminUserIds: [],
        failures: []
      };
    }
    const uniqueAdminUserIds = [
      ...new Set(adminUserIds.map(adminUserId => adminUserId.trim()).filter(Boolean))
    ].slice(0, 50);
    const roleAssignment = this.createRoleAssignmentRequest(
      this.opsState.adminRoleRole,
      this.opsState.adminRoleAccessMode,
      this.opsState.adminRoleTenantKey,
      this.opsState.adminRoleWorkspaceKey,
      this.opsState.adminRoleGroupKey,
      this.opsState.adminRoleMonitorProfilesJson
    );
    const succeededAdminUserIds: string[] = [];
    const failures: AdminUserRoleBatchResult["failures"] = [];

    for (const adminUserId of uniqueAdminUserIds) {
      try {
        await this.requestState.request<AssignAdminRoleResponse>(
          "Assign Role To Selected Admin User",
          "POST",
          resolveRoutePath(productionApiRoutes.admin.assignRole, { adminUserId }),
          roleAssignment satisfies AssignAdminRoleRequest,
          { headers: this.createAdminHeaders(), quiet: true }
        );
        succeededAdminUserIds.push(adminUserId);
      } catch (error) {
        failures.push({
          adminUserId,
          error: this.requestState.isApiError(error)
            ? error.error
            : "unexpected_error"
        });
      }
    }

    this.feedback.rememberActivity(
      "Admin Role Batch Assigned",
      `${succeededAdminUserIds.length}/${uniqueAdminUserIds.length} selected account(s) received ${roleAssignment.role}; ${failures.length} failed.`
    );
    await this.refreshAdminUsers();
    return {
      requestedCount: uniqueAdminUserIds.length,
      succeededAdminUserIds,
      failures
    };
  }

  async revokeAdminRole(): Promise<void> {
    if (!this.hasAdminSession()) {
      return;
    }
    const adminUserId = this.opsState.adminRevokeTargetUserId.trim();
    const roleAssignmentId = this.opsState.adminRevokeRoleAssignmentId.trim();
    const payload = await this.requestState.request<RevokeAdminRoleResponse>(
      "Revoke Admin Role",
      "DELETE",
      resolveRoutePath(productionApiRoutes.admin.revokeRole, {
        adminUserId,
        roleAssignmentId
      }),
      undefined,
      { headers: this.createAdminHeaders() }
    );

    this.opsState.adminRoleTargetUserId = payload.adminUser.adminUserId;
    this.opsState.adminRevokeTargetUserId = payload.adminUser.adminUserId;
    this.opsState.adminStatusTargetUserId = payload.adminUser.adminUserId;
    this.opsState.adminResetTargetUserId = payload.adminUser.adminUserId;
    this.opsState.adminRevokeRoleAssignmentId =
      payload.roleAssignments[0]?.roleAssignmentId ?? "";
    this.feedback.rememberActivity(
      "Admin Role Revoked",
      `${payload.adminUser.username} now has ${payload.roleAssignments.length} role assignment(s).`
    );
    this.persistence.persistShellState();
    await this.refreshAdminUsers();
  }

  async updateAdminUserStatus(): Promise<void> {
    if (!this.hasAdminSession()) {
      return;
    }
    const adminUserId = this.opsState.adminStatusTargetUserId.trim();
    const payload = await this.requestState.request<UpdateAdminUserResponse>(
      "Update Admin User",
      "PATCH",
      resolveRoutePath(productionApiRoutes.admin.updateUser, { adminUserId }),
      {
        status: this.opsState.adminStatusValue
      } satisfies UpdateAdminUserRequest,
      { headers: this.createAdminHeaders() }
    );

    this.opsState.adminRoleTargetUserId = payload.adminUser.adminUserId;
    this.opsState.adminResetTargetUserId = payload.adminUser.adminUserId;
    this.feedback.rememberActivity(
      "Admin User Updated",
      `${payload.adminUser.username} is now ${payload.adminUser.status}.`
    );
    this.persistence.persistShellState();
    await this.refreshAdminUsers();
  }

  async updateAdminUsersStatus(
    adminUserIds: string[],
    status: AdminUserStatus
  ): Promise<AdminUserStatusBatchResult> {
    if (!this.hasAdminSession()) {
      return {
        requestedCount: 0,
        succeededAdminUserIds: [],
        failures: []
      };
    }

    const uniqueAdminUserIds = [
      ...new Set(adminUserIds.map(adminUserId => adminUserId.trim()).filter(Boolean))
    ].slice(0, 50);
    const succeededAdminUserIds: string[] = [];
    const failures: AdminUserStatusBatchResult["failures"] = [];

    for (const adminUserId of uniqueAdminUserIds) {
      try {
        await this.requestState.request<UpdateAdminUserResponse>(
          "Update Selected Admin User",
          "PATCH",
          resolveRoutePath(productionApiRoutes.admin.updateUser, { adminUserId }),
          { status } satisfies UpdateAdminUserRequest,
          { headers: this.createAdminHeaders(), quiet: true }
        );
        succeededAdminUserIds.push(adminUserId);
      } catch (error) {
        failures.push({
          adminUserId,
          error: this.requestState.isApiError(error)
            ? error.error
            : "unexpected_error"
        });
      }
    }

    this.feedback.rememberActivity(
      "Admin User Batch Updated",
      `${succeededAdminUserIds.length}/${uniqueAdminUserIds.length} selected account(s) changed to ${status}; ${failures.length} failed.`
    );
    await this.refreshAdminUsers();

    return {
      requestedCount: uniqueAdminUserIds.length,
      succeededAdminUserIds,
      failures
    };
  }

  async resetAdminUserPassword(): Promise<void> {
    if (!this.hasAdminSession()) {
      return;
    }
    const adminUserId = this.opsState.adminResetTargetUserId.trim();
    const payload = await this.requestState.request<ResetAdminUserPasswordResponse>(
      "Reset Admin Password",
      "POST",
      resolveRoutePath(productionApiRoutes.admin.resetPassword, { adminUserId }),
      {
        password: this.opsState.adminResetPassword
      } satisfies ResetAdminUserPasswordRequest,
      { headers: this.createAdminHeaders() }
    );

    this.opsState.adminResetPassword = "";
    this.feedback.rememberActivity(
      "Admin Password Reset",
      `${payload.adminUser.username} can sign in with the new password.`
    );
    this.persistence.persistShellState();
    await this.refreshAdminUsers();
  }

  private buildAdminUsersPath(): string {
    return this.appendQuery(productionApiRoutes.admin.listUsers, [
      ["username", this.opsState.adminUserUsernameFilter],
      ["status", this.opsState.adminUserStatusFilter],
      ["role", this.opsState.adminUserRoleFilter],
      ["tenantKey", this.opsState.adminUserTenantFilter],
      ["workspaceKey", this.opsState.adminUserWorkspaceFilter],
      ["limit", this.opsState.adminUserLimit]
    ]);
  }

  private buildAdminSessionsPath(): string {
    return this.appendQuery(productionApiRoutes.admin.listSessions, [
      ["adminUserId", this.opsState.adminSessionUserFilter],
      ["status", this.opsState.adminSessionStatusFilter],
      ["limit", this.opsState.adminSessionLimit]
    ]);
  }

  private buildAdminSessionsExportPath(): string {
    return this.appendQuery(productionApiRoutes.admin.exportSessionsCsv, [
      ["adminUserId", this.opsState.adminSessionUserFilter],
      ["status", this.opsState.adminSessionStatusFilter],
      ["limit", this.opsState.adminSessionLimit]
    ]);
  }

  private buildAdminUsersExportPath(): string {
    return this.appendQuery(productionApiRoutes.admin.exportUsersCsv, [
      ["username", this.opsState.adminUserUsernameFilter],
      ["status", this.opsState.adminUserStatusFilter],
      ["role", this.opsState.adminUserRoleFilter],
      ["tenantKey", this.opsState.adminUserTenantFilter],
      ["workspaceKey", this.opsState.adminUserWorkspaceFilter],
      ["limit", this.opsState.adminUserLimit]
    ]);
  }

  private buildAdminAuditEventsPath(): string {
    return this.appendQuery(productionApiRoutes.admin.listAuditEvents, [
      ["eventType", this.opsState.adminAuditEventTypeFilter],
      ["actorAdminUserId", this.opsState.adminAuditActorFilter],
      ["subjectAdminUserId", this.opsState.adminAuditSubjectFilter],
      ["limit", this.opsState.adminAuditLimit]
    ]);
  }

  private buildAdminAuditEventsExportPath(): string {
    return this.appendQuery(productionApiRoutes.admin.exportAuditEventsCsv, [
      ["eventType", this.opsState.adminAuditEventTypeFilter],
      ["actorAdminUserId", this.opsState.adminAuditActorFilter],
      ["subjectAdminUserId", this.opsState.adminAuditSubjectFilter],
      ["limit", this.opsState.adminAuditLimit]
    ]);
  }

  private appendQuery(path: string, entries: Array<[string, string]>): string {
    const query = new URLSearchParams();

    for (const [key, value] of entries) {
      const trimmedValue = value.trim();
      if (trimmedValue) {
        query.set(key, trimmedValue);
      }
    }

    const queryString = query.toString();
    return queryString ? `${path}?${queryString}` : path;
  }

  private async bootstrapAdminUser(): Promise<BootstrapAdminUserResponse> {
    const payload = await this.requestState.request<BootstrapAdminUserResponse>(
      "Bootstrap Admin",
      "POST",
      productionApiRoutes.admin.bootstrap,
      {
        username: this.opsState.adminUsername.trim(),
        displayName: this.opsState.adminDisplayName.trim() || undefined,
        password: this.opsState.adminPassword
      } satisfies BootstrapAdminUserRequest
    );

    this.applyAdminAuthPayload(payload);
    this.feedback.rememberActivity(
      "Admin Bootstrapped",
      `${payload.adminUser.username} is ready as platform admin.`
    );
    this.persistence.persistShellState();
    return payload;
  }

  private applyAdminAuthPayload(
    payload:
      | BootstrapAdminUserResponse
      | AdminSignInResponse
      | GetAdminCurrentSessionResponse
  ): void {
    this.opsState.adminSessionView = prettyPrintJson(
      payload,
      this.opsState.adminSessionView
    );
    this.opsState.adminUsername = payload.adminUser.username;
    this.opsState.adminDisplayName = payload.adminUser.displayName;
  }

  private createAdminHeaders(): Record<string, string> {
    const token = this.opsState.adminSessionToken.trim();
    return token ? { authorization: `Bearer ${token}` } : {};
  }

  private hasAdminSession(): boolean {
    return this.opsState.adminSessionToken.trim() !== "";
  }

  private createRoleAssignmentRequest(
    role: AssignAdminRoleRequest["role"],
    accessMode: NonNullable<AssignAdminRoleRequest["accessMode"]>,
    tenantKey: string,
    workspaceKey: string,
    groupKey: string,
    monitorProfilesJson?: string
  ): AssignAdminRoleRequest {
    if (role === "platform_admin") {
      return { role };
    }

    if (role === "tenant_admin") {
      return {
        role,
        tenantKey: tenantKey.trim()
      };
    }

    return {
      role,
      ...(role === "workspace_admin" ? { accessMode } : {}),
      tenantKey: tenantKey.trim(),
      workspaceKey: workspaceKey.trim(),
      ...(role === "group_monitor" ? { groupKey: groupKey.trim() } : {}),
      ...((role === "group_monitor" || role === "study_monitor") &&
      monitorProfilesJson !== undefined
        ? { monitorProfiles: this.parseMonitorProfiles(monitorProfilesJson) }
        : {})
    };
  }

  private parseMonitorProfiles(value: string): MonitorViewProfile[] {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? (parsed as MonitorViewProfile[]) : [];
    } catch {
      return [];
    }
  }
}
