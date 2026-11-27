import { Injector, inject } from "@angular/core";
import { Router, type ResolveFn, type UrlMatcher } from "@angular/router";
import type { OriginalOperatorWorkspaceChoice } from "@testcenter-rewrite-app/contracts";

import { InterfaceModeService } from "./interface-mode.service";
import { redirectToOriginalPasswordStarter } from "./rewrite-app-admin-route.guard";
import { RewriteAppOperatorAccessService } from "./rewrite-app-operator-access.service";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";

export type OriginalNumericWorkspaceRoute =
  | { kind: "workspace"; token: string; workspace: OriginalOperatorWorkspaceChoice & { mode: "RO" | "RW" } }
  | { kind: "denied" | "unavailable" };

export const matchOriginalNumericWorkspace: UrlMatcher = segments => {
  if (segments[0]?.path !== "admin" || !segments[1]) return null;
  const posParams = { workspaceNumber: segments[1] };
  return {
    consumed: segments,
    // Original's wildcard child renders Files without activating a tab link.
    posParams: segments.length === 3 && segments[2]
      ? { ...posParams, workspaceTab: segments[2] }
      : posParams
  };
};

export const resolveOriginalNumericWorkspace: ResolveFn<OriginalNumericWorkspaceRoute> = async route => {
  const state = inject(RewriteAppUiStateService);
  const operatorAccess = inject(RewriteAppOperatorAccessService);
  const router = inject(Router);
  const mode = inject(InterfaceModeService);
  const injector = inject(Injector);
  const token = state.ops.adminSessionToken;
  const workspaceNumber = route.paramMap.get("workspaceNumber");
  if (!token || !workspaceNumber || !/^[1-9][0-9]{0,18}$/.test(workspaceNumber)) {
    return { kind: "denied" };
  }
  try {
    const { RewriteAppOpsService } = await import("./rewrite-app-ops.service");
    const session = await injector.get(RewriteAppOpsService).refreshAdminSession({
      publishOriginalRights: true,
      includeOriginalWorkspaceChoices: true
    });
    if (!session || token !== state.ops.adminSessionToken) return { kind: "denied" };
    if (operatorAccess.requiresWorkspacePasswordChange) {
      return redirectToOriginalPasswordStarter(router, mode);
    }
    const workspace = session.originalWorkspaceChoices?.find(choice => choice.workspaceNumber === workspaceNumber);
    if (!workspace || (workspace.mode !== "RO" && workspace.mode !== "RW")) {
      return { kind: "denied" };
    }
    return { kind: "workspace", token, workspace: { ...workspace, mode: workspace.mode } };
  } catch {
    return { kind: "unavailable" };
  }
};
