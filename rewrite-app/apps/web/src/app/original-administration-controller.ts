import {
  productionApiRoutes, resolveRoutePath,
  type AdminUserDirectoryItem, type CreateTenantResponse, type CreateWorkspaceResponse,
  type ListAdminUsersResponse, type ListTenantsResponse, type ListWorkspacesResponse,
  type UpdateWorkspaceResponse
} from "@testcenter-rewrite-app/contracts";
import type { Tenant, WorkspaceDirectoryItem } from "@testcenter-rewrite-app/domain";

export type OriginalWorkspace = WorkspaceDirectoryItem & { tenantKey: string };
export type OriginalWorkspaceAccess = "" | "RO" | "RW";
export type OriginalPermissionChange = { adminUserId: string; workspaceId: string; access: OriginalWorkspaceAccess };
export type OriginalAdministrationTransport = <T>(method: string, path: string, body: unknown,
  sessionToken: string) => Promise<T>;
type Owner = { epoch: number; token: string };

// The Original has a flat workspace directory. Newly created workspaces use a
// dedicated internal container; never guess a tenant from the last open test.
export const originalAdministrationTenantKey = "original-interface";
const newWorkspaceKey = (): string => "workspace-" + [...crypto.getRandomValues(new Uint8Array(16))]
  .map(value => value.toString(16).padStart(2, "0")).join("");
const permissionKey = (adminUserId: string, workspaceId: string): string => JSON.stringify([adminUserId, workspaceId]);
// Source's flat directory queries order by name, across every workspace scope.
const orderWorkspaces = (rows:OriginalWorkspace[]):OriginalWorkspace[] => rows.sort((a,b)=>a.displayName.localeCompare(b.displayName));
const orderAdmins = (rows:AdminUserDirectoryItem[]):AdminUserDirectoryItem[] => rows.sort((a,b)=>a.adminUser.username.localeCompare(b.adminUser.username));


/** Presentation adapter over the existing authenticated production API.
 * Every continuation owns its session, including the next write in a batch.
 * No password or bearer token enters persisted UI state or a directory row.
 */
export class OriginalAdministrationController {
  admins: AdminUserDirectoryItem[] = [];
  workspaces: OriginalWorkspace[] = [];
  tenants: Tenant[] = [];
  selectedAdminId = "";
  selectedWorkspaceId = "";
  busy = false;
  problem = "";
  problemCode = "";
  notice = "";
  readonly changes = new Map<string, OriginalPermissionChange>();
  private epoch = 0;
  private token = "";
  private destroyed = false;

  constructor(private readonly transport: OriginalAdministrationTransport,
    private readonly currentSession: () => { token: string; adminUserId: string },
    private readonly changed: () => void, private readonly makeWorkspaceKey = newWorkspaceKey) {}

  private owns(owner: Owner): boolean {
    return !this.destroyed && owner.epoch === this.epoch && owner.token === this.token &&
      owner.token === this.currentSession().token && owner.token !== "";
  }

  private async request<T>(owner: Owner, method: string, path: string, body?: unknown): Promise<T> {
    if (!this.owns(owner)) throw Error("Original administrator session changed.");
    const result = await this.transport<T>(method, path, body, owner.token);
    if (!this.owns(owner)) throw Error("Original administrator session changed.");
    return result;
  }

  private async run(action: (owner: Owner) => Promise<void>, success: string): Promise<boolean> {
    const owner = { epoch:this.epoch, token:this.token };
    if (this.busy || !this.owns(owner)) return false;
    this.busy = true; this.problem = ""; this.problemCode = ""; this.notice = ""; this.changed();
    try {
      await action(owner);
      if (!this.owns(owner)) return false;
      this.notice = success;
      return true;
    } catch (error) {
      if (this.owns(owner)) {
        this.problemCode = typeof error === "object" && error !== null && "error" in error
          ? String(error.error) : "unexpected_error";
        this.problem = this.problemCode === "admin_password_confirmation_invalid" ? "Falsches Kennwort."
          : "Die Aktion konnte nicht abgeschlossen werden. Bitte prüfen Sie die Eingaben und versuchen Sie es erneut.";
      }
      return false;
    } finally {
      if (this.owns(owner)) { this.busy = false; this.changed(); }
    }
  }

  async connect(token: string): Promise<boolean> {
    this.epoch++; this.token = token; this.busy = false;
    this.admins = []; this.workspaces = []; this.tenants = [];
    this.clearSelection(); this.problem = ""; this.problemCode = ""; this.notice = ""; this.changed();
    return this.run(async owner => {
      const [users, tenants] = await Promise.all([
        this.request<ListAdminUsersResponse>(owner,"GET",productionApiRoutes.admin.listUsers),
        this.request<ListTenantsResponse>(owner,"GET",productionApiRoutes.platform.listTenants)
      ]);
      const workspaces: OriginalWorkspace[] = [];
      for (const tenant of tenants.items) {
        const result = await this.request<ListWorkspacesResponse>(owner,"GET",
          resolveRoutePath(productionApiRoutes.workspace.listWorkspaces,{tenantKey:tenant.tenantKey}));
        workspaces.push(...result.items.map(workspace=>({...workspace,tenantKey:tenant.tenantKey})));
      }
      this.admins = orderAdmins([...users.items]); this.tenants = tenants.items; this.workspaces = orderWorkspaces(workspaces);
    }, "");
  }

  destroy(): void {
    this.destroyed = true; this.epoch++; this.token = "";
    this.admins = []; this.workspaces = []; this.tenants = []; this.busy = false; this.clearSelection();
  }

  clearSelection(): void { this.selectedAdminId = ""; this.selectedWorkspaceId = ""; this.changes.clear(); }
  selectAdmin(id: string): void {
    if (this.busy || !this.admins.some(item=>item.adminUser.adminUserId===id)) return;
    this.clearSelection(); this.selectedAdminId = id; this.changed();
  }
  selectWorkspace(id: string): void {
    if (this.busy || !this.workspaces.some(item=>item.workspaceId===id)) return;
    this.clearSelection(); this.selectedWorkspaceId = id; this.changed();
  }

  get selectedAdmin(): AdminUserDirectoryItem | undefined {
    return this.admins.find(item=>item.adminUser.adminUserId===this.selectedAdminId);
  }
  get selectedWorkspace(): OriginalWorkspace | undefined {
    return this.workspaces.find(item=>item.workspaceId===this.selectedWorkspaceId);
  }
  isSuperadmin(admin: AdminUserDirectoryItem): boolean { return admin.roleAssignments.some(role=>role.role==="platform_admin"); }
  private assignment(adminUserId: string, workspaceId: string) {
    return this.admins.find(item=>item.adminUser.adminUserId===adminUserId)?.roleAssignments
      .find(role=>role.role==="workspace_admin" && role.workspaceId===workspaceId);
  }
  access(adminUserId: string, workspaceId: string): OriginalWorkspaceAccess {
    const draft = this.changes.get(permissionKey(adminUserId,workspaceId));
    if (draft) return draft.access;
    const assignment = this.assignment(adminUserId,workspaceId);
    return assignment ? assignment.accessMode==="read_only" ? "RO" : "RW" : "";
  }
  togglePermission(adminUserId: string, workspaceId: string, control: "RO" | "RW"): void {
    if (this.busy ||
      !this.admins.some(item=>item.adminUser.adminUserId===adminUserId) ||
      !this.workspaces.some(item=>item.workspaceId===workspaceId)) return;
    const previous = this.access(adminUserId,workspaceId);
    const access = control==="RW" ? previous==="RW" ? "RO" : "RW" : previous ? "" : "RO";
    const assignment = this.assignment(adminUserId,workspaceId);
    const saved = assignment ? assignment.accessMode==="read_only" ? "RO" : "RW" : "";
    const key = permissionKey(adminUserId,workspaceId);
    if (access===saved) this.changes.delete(key);
    else this.changes.set(key,{adminUserId,workspaceId,access});
    this.changed();
  }
  private applyAdmin(item: AdminUserDirectoryItem): void {
    const index = this.admins.findIndex(existing=>existing.adminUser.adminUserId===item.adminUser.adminUserId);
    this.admins = orderAdmins(index<0 ? [...this.admins,item] : this.admins.map((old,i)=>i===index?item:old));
  }
  async savePermissions(): Promise<boolean> {
    const edits = [...this.changes.values()].map(edit=>({...edit}));
    if (!edits.length) return false;
    return this.run(async owner => {
      for (const edit of edits) {
        const workspace = this.workspaces.find(item=>item.workspaceId===edit.workspaceId);
        if (!workspace) throw Error("The selected workspace no longer exists.");
        const assignment = this.assignment(edit.adminUserId,edit.workspaceId);
        if (edit.access) {
          this.applyAdmin(await this.request<AdminUserDirectoryItem>(owner,"POST",
            resolveRoutePath(productionApiRoutes.admin.assignRole,{adminUserId:edit.adminUserId}),
            {role:"workspace_admin",tenantKey:workspace.tenantKey,workspaceKey:workspace.workspaceKey,
              accessMode:edit.access==="RO"?"read_only":"read_write"}));
        } else if (assignment) {
          this.applyAdmin(await this.request<AdminUserDirectoryItem>(owner,"DELETE",
            resolveRoutePath(productionApiRoutes.admin.revokeRole,{adminUserId:edit.adminUserId,roleAssignmentId:assignment.roleAssignmentId}),{}));
        }
        // An acknowledged row is never replayed after a later row fails.
        this.changes.delete(permissionKey(edit.adminUserId,edit.workspaceId)); this.changed();
      }
    }, "Zugriffsrechte geändert");
  }

  async createUser(username: string, password: string): Promise<boolean> {
    return this.run(async owner => {
      this.applyAdmin(await this.request<AdminUserDirectoryItem>(owner,"POST",productionApiRoutes.admin.createUser,
        {username:username.trim(),displayName:username.trim(),password,roleAssignments:[]}));
      this.clearSelection();
    }, "Administrator:in hinzugefügt");
  }
  async resetPassword(adminUserId: string, password: string): Promise<boolean> {
    return this.run(async owner => {
      this.applyAdmin(await this.request<AdminUserDirectoryItem>(owner,"POST",
        resolveRoutePath(productionApiRoutes.admin.resetPassword,{adminUserId}),{password}));
    }, "Kennwort geändert");
  }
  async changeSuperadmin(adminUserId: string, confirmationPassword: string): Promise<boolean> {
    if (adminUserId===this.currentSession().adminUserId) return false;
    const assignment = this.admins.find(item=>item.adminUser.adminUserId===adminUserId)?.roleAssignments.find(role=>role.role==="platform_admin");
    return this.run(async owner => {
      this.applyAdmin(await this.request<AdminUserDirectoryItem>(owner,assignment?"DELETE":"POST",
        assignment ? resolveRoutePath(productionApiRoutes.admin.revokeRole,{adminUserId,roleAssignmentId:assignment.roleAssignmentId})
          : resolveRoutePath(productionApiRoutes.admin.assignRole,{adminUserId}),
        {confirmationPassword,...(!assignment?{role:"platform_admin"}:{})}));
    }, "Superadmin-Status geändert");
  }
  async deleteUser(adminUserId: string, confirmationPassword: string): Promise<boolean> {
    if (adminUserId===this.currentSession().adminUserId) return false;
    return this.run(async owner => {
      await this.request(owner,"DELETE",resolveRoutePath(productionApiRoutes.admin.deleteUser,{adminUserId}),{confirmationPassword});
      this.admins = this.admins.filter(item=>item.adminUser.adminUserId!==adminUserId); this.clearSelection();
    }, "Administrator:in gelöscht");
  }

  async createWorkspace(displayName: string): Promise<boolean> {
    return this.run(async owner => {
      let tenant = this.tenants.find(item=>item.tenantKey===originalAdministrationTenantKey);
      if (!tenant) {
        try {
          tenant = (await this.request<CreateTenantResponse>(owner,"POST",productionApiRoutes.platform.createTenant,
            {tenantKey:originalAdministrationTenantKey,displayName:"Testcenter"})).tenant;
        } catch (error) {
          // Concurrent first-workspace creation may have created this container.
          if (!(typeof error==="object" && error!==null && "statusCode" in error && error.statusCode===409)) throw error;
          tenant = (await this.request<ListTenantsResponse>(owner,"GET",productionApiRoutes.platform.listTenants))
            .items.find(item=>item.tenantKey===originalAdministrationTenantKey);
          if (!tenant) throw error;
        }
        this.tenants = [...this.tenants,tenant];
      }
      if (tenant.status!=="active") throw Error("Original workspace container is unavailable.");
      const result = await this.request<CreateWorkspaceResponse>(owner,"POST",
        resolveRoutePath(productionApiRoutes.workspace.createWorkspace,{tenantKey:tenant.tenantKey}),
        {workspaceKey:this.makeWorkspaceKey(),displayName:displayName.trim()});
      this.workspaces = orderWorkspaces([...this.workspaces,{...result.workspace,tenantKey:tenant.tenantKey,latestFileModificationAt:null}]);
      this.clearSelection();
    }, "Arbeitsbereich hinzugefügt");
  }
  async renameWorkspace(workspaceId: string, displayName: string): Promise<boolean> {
    const workspace = this.workspaces.find(item=>item.workspaceId===workspaceId);
    if (!workspace) return false;
    return this.run(async owner => {
      const result = await this.request<UpdateWorkspaceResponse>(owner,"PATCH",
        resolveRoutePath(productionApiRoutes.workspace.updateWorkspace,{tenantKey:workspace.tenantKey,workspaceKey:workspace.workspaceKey}),
        {displayName:displayName.trim()});
      this.workspaces = orderWorkspaces(this.workspaces.map(item=>item.workspaceId===workspaceId?{...item,...result.workspace}:item));
    }, "Arbeitsbereich geändert");
  }
  async deleteWorkspace(workspaceId: string, confirmationPassword: string): Promise<boolean> {
    const workspace = this.workspaces.find(item=>item.workspaceId===workspaceId);
    if (!workspace) return false;
    return this.run(async owner => {
      await this.request(owner,"DELETE",resolveRoutePath(productionApiRoutes.workspace.deleteWorkspace,
        {tenantKey:workspace.tenantKey,workspaceKey:workspace.workspaceKey}),{confirmation:workspace.workspaceKey,confirmationPassword});
      this.workspaces = this.workspaces.filter(item=>item.workspaceId!==workspaceId);
      this.admins = this.admins.map(item=>({...item,roleAssignments:item.roleAssignments.filter(role=>role.workspaceId!==workspaceId)}));
      this.clearSelection();
    }, "Arbeitsbereich gelöscht");
  }
}
