import { Injectable, inject } from "@angular/core";

import {
  resolveOperatorAccessMode,
  type OperatorAccessMode,
  type PublicAdminRoleAssignment
} from "@testcenter-rewrite-app/contracts";
import type { MonitorViewProfile } from "@testcenter-rewrite-app/domain";

import { parseJsonDocument } from "./rewrite-app-shell.readers";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";

type OperatorSessionView = {
  adminUser?: {
    customTexts?: Record<string, string>;
    displayName?: string;
    passwordChangeRequired?: boolean;
    username?: string;
  };
  adminSession?: {
    expiresAt?: string;
  };
  roleAssignments?: PublicAdminRoleAssignment[];
};

export type OperatorAccountAccessItem = {
  role: string;
  scope: string;
};

@Injectable({ providedIn: "root" })
export class RewriteAppOperatorAccessService {
  private readonly uiState = inject(RewriteAppUiStateService);
  private accountAccessSource = "";
  private accountAccessCache: OperatorAccountAccessItem[] = [];

  private get session(): OperatorSessionView | null {
    return parseJsonDocument<OperatorSessionView>(
      this.uiState.ops.adminSessionView
    );
  }

  get roleAssignments(): PublicAdminRoleAssignment[] {
    return this.session?.roleAssignments ?? [];
  }

  get customTexts(): Record<string, string> {
    return this.session?.adminUser?.customTexts ?? {};
  }

  get username(): string {
    return this.session?.adminUser?.username?.trim() || "Operator";
  }

  get displayName(): string {
    return this.session?.adminUser?.displayName?.trim() || this.username;
  }

  get sessionExpiresAt(): string {
    return this.session?.adminSession?.expiresAt?.trim() || "unknown";
  }

  get accountAccessItems(): OperatorAccountAccessItem[] {
    const source = this.uiState.ops.adminSessionView;
    if (source === this.accountAccessSource) {
      return this.accountAccessCache;
    }
    this.accountAccessSource = source;
    this.accountAccessCache = this.roleAssignments.map(assignment => ({
      role: this.formatRole(assignment),
      scope: this.formatScope(assignment)
    }));
    return this.accountAccessCache;
  }

  get mode(): OperatorAccessMode | "signed_out" {
    if (!this.uiState.ops.adminSessionToken.trim()) {
      return "signed_out";
    }
    return resolveOperatorAccessMode(this.roleAssignments);
  }

  get isMonitorOnly(): boolean {
    return this.mode === "study_monitor" || this.mode === "group_monitor";
  }

  get isSystemCheckOnly(): boolean {
    return this.mode === "system_check";
  }

  get isReadOnlyAdmin(): boolean {
    return this.mode === "admin_read_only";
  }

  get isPlatformAdmin(): boolean {
    return this.roleAssignments.some(
      assignment => assignment.role === "platform_admin"
    );
  }

  get requiresPasswordChange(): boolean {
    if (!this.uiState.ops.adminSessionToken.trim()) {
      return false;
    }
    return this.session?.adminUser?.passwordChangeRequired === true;
  }

  get canReadWorkspaceDirectory(): boolean {
    return (
      this.mode === "signed_out" ||
      this.roleAssignments.some(
        assignment =>
          assignment.role === "platform_admin" ||
          assignment.role === "tenant_admin"
      )
    );
  }

  get hasMonitorRole(): boolean {
    return this.roleAssignments.some(
      assignment =>
        assignment.role === "study_monitor" || assignment.role === "group_monitor"
    );
  }

  get monitorProfiles(): MonitorViewProfile[] {
    const profiles = new Map<string, MonitorViewProfile>();
    for (const assignment of this.roleAssignments) {
      if (
        assignment.role !== "study_monitor" &&
        assignment.role !== "group_monitor"
      ) {
        continue;
      }
      for (const profile of assignment.monitorProfiles ?? []) {
        if (!profiles.has(profile.profileId)) {
          profiles.set(profile.profileId, profile);
        }
      }
    }
    return Array.from(profiles.values());
  }

  get monitorBookletVisibility(): "visible" | "collapsed" | "hidden" {
    const monitorAssignment = this.roleAssignments.find(
      assignment =>
        assignment.role === "study_monitor" ||
        assignment.role === "group_monitor"
    );
    return monitorAssignment?.monitorBookletVisibility === "collapsed" ||
      monitorAssignment?.monitorBookletVisibility === "hidden"
      ? monitorAssignment.monitorBookletVisibility
      : "visible";
  }

  get label(): string {
    switch (this.mode) {
      case "study_monitor":
        return "Study monitor";
      case "group_monitor":
        return "Group monitor";
      case "system_check":
        return "System check";
      case "admin":
        return "Administrator";
      case "admin_read_only":
        return "Read-only workspace administrator";
      case "unassigned":
        return "Unassigned operator";
      default:
        return "Signed out";
    }
  }

  private formatRole(assignment: PublicAdminRoleAssignment): string {
    switch (assignment.role) {
      case "platform_admin":
        return "Platform administrator";
      case "tenant_admin":
        return "Tenant administrator";
      case "workspace_admin":
        return assignment.accessMode === "read_only"
          ? "Workspace administrator (read-only)"
          : "Workspace administrator";
      case "study_monitor":
        return "Study monitor";
      case "group_monitor":
        return "Group monitor";
      case "system_check":
        return "System check";
    }
  }

  private formatScope(assignment: PublicAdminRoleAssignment): string {
    if (assignment.role === "platform_admin") {
      return "All tenants and workspaces";
    }
    const parts: string[] = [];
    if (assignment.tenantId) {
      parts.push(`Tenant ${assignment.tenantId}`);
    }
    if (assignment.workspaceId) {
      parts.push(`Workspace ${assignment.workspaceId}`);
    }
    if (assignment.groupKey) {
      parts.push(`Group ${assignment.groupKey}`);
    }
    return parts.join(" · ") || "Unscoped";
  }
}
