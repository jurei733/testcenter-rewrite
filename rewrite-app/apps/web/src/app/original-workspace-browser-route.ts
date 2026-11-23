import { Injector, inject } from "@angular/core";
import type { ResolveFn, UrlMatcher } from "@angular/router";
import type { OriginalOperatorWorkspaceChoice } from "@testcenter-rewrite-app/contracts";

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
    const workspace = session?.originalWorkspaceChoices?.find(choice => choice.workspaceNumber === workspaceNumber);
    if (!workspace || token !== state.ops.adminSessionToken || (workspace.mode !== "RO" && workspace.mode !== "RW")) {
      return { kind: "denied" };
    }
    return { kind: "workspace", token, workspace: { ...workspace, mode: workspace.mode } };
  } catch {
    return { kind: "unavailable" };
  }
};
