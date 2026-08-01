import { Injectable, inject } from "@angular/core";

import {
  resolveOperatorAccessMode,
  type OperatorAccessMode,
  type PublicAdminRoleAssignment
} from "@testcenter-rewrite-app/contracts";

import { parseJsonDocument } from "./rewrite-app-shell.readers";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";

type OperatorSessionView = {
  roleAssignments?: PublicAdminRoleAssignment[];
};

@Injectable({ providedIn: "root" })
export class RewriteAppOperatorAccessService {
  private readonly uiState = inject(RewriteAppUiStateService);

  get mode(): OperatorAccessMode | "signed_out" {
    if (!this.uiState.ops.adminSessionToken.trim()) {
      return "signed_out";
    }
    const session = parseJsonDocument<OperatorSessionView>(
      this.uiState.ops.adminSessionView
    );
    return resolveOperatorAccessMode(session?.roleAssignments ?? []);
  }

  get isMonitorOnly(): boolean {
    return this.mode === "study_monitor" || this.mode === "group_monitor";
  }

  get label(): string {
    switch (this.mode) {
      case "study_monitor":
        return "Study monitor";
      case "group_monitor":
        return "Group monitor";
      case "admin":
        return "Administrator";
      case "unassigned":
        return "Unassigned operator";
      default:
        return "Signed out";
    }
  }
}
