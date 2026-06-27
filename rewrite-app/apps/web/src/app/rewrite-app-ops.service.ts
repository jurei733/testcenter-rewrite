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
  ListAdminAuditEventsResponse,
  ListAdminUsersResponse,
  ResetAdminUserPasswordRequest,
  ResetAdminUserPasswordResponse,
  RevokeAdminRoleResponse,
  UpdateAdminUserRequest,
  UpdateAdminUserResponse
} from "@testcenter-rewrite-app/contracts";
import {
  productionApiRoutes,
  resolveRoutePath
} from "@testcenter-rewrite-app/contracts";

import { RewriteAppShellFeedbackService } from "./rewrite-app-shell-feedback.service";
import { RewriteAppShellPersistenceService } from "./rewrite-app-shell-persistence.service";
import { RewriteAppShellRequestService } from "./rewrite-app-shell-request.service";
import {
  refreshMetricsOnlyAction,
  refreshOperationalDiagnosticsAction
} from "./rewrite-app-shell.ops";
import { prettyPrintJson } from "./rewrite-app-shell.readers";
import { RewriteAppShellOpsHostsService } from "./rewrite-app-shell-ops-hosts.service";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";

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

  async signOutAdmin(): Promise<void> {
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

  async refreshAdminUsers(): Promise<void> {
    const payload = await this.requestState.request<ListAdminUsersResponse>(
      "Admin Users",
      "GET",
      productionApiRoutes.admin.listUsers,
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

  async refreshAdminAuditEvents(): Promise<void> {
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

  async createAdminUser(): Promise<void> {
    const payload = await this.requestState.request<CreateAdminUserResponse>(
      "Create Admin User",
      "POST",
      productionApiRoutes.admin.createUser,
      {
        username: this.opsState.adminCreateUsername.trim(),
        displayName: this.opsState.adminCreateDisplayName.trim() || undefined,
        password: this.opsState.adminCreatePassword,
        roleAssignments: [
          this.createRoleAssignmentRequest(
            this.opsState.adminCreateRole,
            this.opsState.adminCreateTenantKey,
            this.opsState.adminCreateWorkspaceKey
          )
        ]
      } satisfies CreateAdminUserRequest,
      { headers: this.createAdminHeaders() }
    );

    this.opsState.adminCreatePassword = "";
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
    const adminUserId = this.opsState.adminRoleTargetUserId.trim();
    const payload = await this.requestState.request<AssignAdminRoleResponse>(
      "Assign Admin Role",
      "POST",
      resolveRoutePath(productionApiRoutes.admin.assignRole, { adminUserId }),
      this.createRoleAssignmentRequest(
        this.opsState.adminRoleRole,
        this.opsState.adminRoleTenantKey,
        this.opsState.adminRoleWorkspaceKey
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

  async revokeAdminRole(): Promise<void> {
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

  async resetAdminUserPassword(): Promise<void> {
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

  private buildAdminAuditEventsPath(): string {
    const query = new URLSearchParams();
    const entries: Array<[string, string]> = [
      ["eventType", this.opsState.adminAuditEventTypeFilter],
      ["actorAdminUserId", this.opsState.adminAuditActorFilter],
      ["subjectAdminUserId", this.opsState.adminAuditSubjectFilter],
      ["limit", this.opsState.adminAuditLimit]
    ];

    for (const [key, value] of entries) {
      const trimmedValue = value.trim();
      if (trimmedValue) {
        query.set(key, trimmedValue);
      }
    }

    const queryString = query.toString();
    return queryString
      ? `${productionApiRoutes.admin.listAuditEvents}?${queryString}`
      : productionApiRoutes.admin.listAuditEvents;
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

  private createRoleAssignmentRequest(
    role: AssignAdminRoleRequest["role"],
    tenantKey: string,
    workspaceKey: string
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
      tenantKey: tenantKey.trim(),
      workspaceKey: workspaceKey.trim()
    };
  }
}
