import { Injectable, inject } from "@angular/core";

import type {
  AdminSignOutResponse,
  ChangeAdminPasswordRequest,
  ChangeAdminPasswordResponse
} from "@testcenter-rewrite-app/contracts";
import { productionApiRoutes } from "@testcenter-rewrite-app/contracts";

import { RewriteAppShellFeedbackService } from "./rewrite-app-shell-feedback.service";
import { RewriteAppShellPersistenceService } from "./rewrite-app-shell-persistence.service";
import { RewriteAppShellRequestService } from "./rewrite-app-shell-request.service";
import { prettyPrintJson } from "./rewrite-app-shell.readers";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";

@Injectable({ providedIn: "root" })
export class AdminPasswordChangeService {
  private readonly requestState = inject(RewriteAppShellRequestService);
  private readonly feedback = inject(RewriteAppShellFeedbackService);
  private readonly persistence = inject(RewriteAppShellPersistenceService);
  private readonly uiState = inject(RewriteAppUiStateService);

  async changePassword(input: {
    password: string;
    currentPassword?: string;
  }): Promise<void> {
    const sessionToken = this.uiState.ops.adminSessionToken.trim();
    if (!sessionToken) {
      return;
    }
    const payload = await this.requestState.request<ChangeAdminPasswordResponse>(
      "Change Admin Password",
      "POST",
      productionApiRoutes.admin.changeOwnPassword,
      {
        password: input.password,
        ...(input.currentPassword === undefined
          ? {}
          : { currentPassword: input.currentPassword })
      } satisfies ChangeAdminPasswordRequest,
      { headers: { authorization: `Bearer ${sessionToken}` } }
    );

    this.uiState.ops.adminSessionView = prettyPrintJson(
      payload,
      this.uiState.ops.adminSessionView
    );
    this.uiState.ops.adminSessionToken = "";
    this.feedback.rememberActivity(
      "Admin Password Changed",
      `${payload.adminUser.username} changed their password and ${payload.revokedAdminSessionIds.length} active session(s) were revoked.`
    );
    this.persistence.persistShellState();
  }

  async signOut(): Promise<void> {
    const sessionToken = this.uiState.ops.adminSessionToken.trim();
    if (!sessionToken) {
      return;
    }
    const payload = await this.requestState.request<AdminSignOutResponse>(
      "Admin Sign Out",
      "POST",
      productionApiRoutes.admin.signOut,
      undefined,
      { headers: { authorization: `Bearer ${sessionToken}` } }
    );
    this.uiState.ops.adminSessionView = prettyPrintJson(
      payload,
      this.uiState.ops.adminSessionView
    );
    this.uiState.ops.adminSessionToken = "";
    this.feedback.rememberActivity(
      "Admin Signed Out",
      `Session ${payload.adminSession.adminSessionId} was revoked.`
    );
    this.persistence.persistShellState();
  }
}
