import { productionApiRoutes, resolveRoutePath } from "@testcenter-rewrite-app/contracts";

import type { ShellWorkspaceActionsHost } from "./rewrite-app-shell.workspace-actions";
import type { ShellWorkspaceState } from "./rewrite-app-shell.state";

export function createWorkspaceActionsStateHost(args: {
  request<T>(label: string, method: string, path: string, body?: unknown): Promise<T>;
  workspaceState: ShellWorkspaceState;
  rememberActivity(title: string, detail: string): void;
}): ShellWorkspaceActionsHost {
  return {
    request: args.request,
    getCreateTenantPath: () => productionApiRoutes.platform.createTenant,
    getCreateWorkspacePath: () =>
      resolveRoutePath(productionApiRoutes.workspace.createWorkspace, {
        tenantKey: args.workspaceState.tenantKey.trim()
      }),
    getTenantKey: () => args.workspaceState.tenantKey,
    getWorkspaceKey: () => args.workspaceState.workspaceKey,
    rememberActivity: args.rememberActivity
  };
}
