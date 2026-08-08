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
  roleAssignments?: PublicAdminRoleAssignment[];
};

@Injectable({ providedIn: "root" })
export class RewriteAppOperatorAccessService {
  private readonly uiState = inject(RewriteAppUiStateService);

  get roleAssignments(): PublicAdminRoleAssignment[] {
    const session = parseJsonDocument<OperatorSessionView>(
      this.uiState.ops.adminSessionView
    );
    return session?.roleAssignments ?? [];
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
}
