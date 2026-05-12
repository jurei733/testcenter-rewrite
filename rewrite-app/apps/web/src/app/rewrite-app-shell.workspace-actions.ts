import type {
  CreateTenantRequest,
  CreateTenantResponse,
  CreateWorkspaceRequest,
  CreateWorkspaceResponse,
  productionApiRoutes
} from "@testcenter-rewrite-app/contracts";

export interface ShellWorkspaceActionsHost {
  request<T>(
    label: string,
    method: string,
    path: string,
    body?: unknown
  ): Promise<T>;
  getCreateTenantPath(): string;
  getCreateWorkspacePath(): string;
  getTenantKey(): string;
  getWorkspaceKey(): string;
  rememberActivity(title: string, detail: string): void;
}

export async function createTenantAction(
  host: ShellWorkspaceActionsHost
): Promise<void> {
  const tenantKey = host.getTenantKey().trim();
  const payload = await host.request<CreateTenantResponse>(
    "Create Tenant",
    "POST",
    host.getCreateTenantPath(),
    {
      tenantKey,
      displayName: tenantKey
    } satisfies CreateTenantRequest
  );
  host.rememberActivity(
    "Tenant Created",
    `Tenant ${payload.tenant.tenantKey} is ready.`
  );
}

export async function createWorkspaceAction(
  host: ShellWorkspaceActionsHost
): Promise<void> {
  const tenantKey = host.getTenantKey().trim();
  const workspaceKey = host.getWorkspaceKey().trim();
  const payload = await host.request<CreateWorkspaceResponse>(
    "Create Workspace",
    "POST",
    host.getCreateWorkspacePath(),
    {
      workspaceKey,
      displayName: workspaceKey
    } satisfies CreateWorkspaceRequest
  );
  host.rememberActivity(
    "Workspace Created",
    `Workspace ${payload.workspace.workspaceKey} is ready inside tenant ${tenantKey}.`
  );
}
