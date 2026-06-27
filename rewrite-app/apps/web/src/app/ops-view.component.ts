import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import type { OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { JsonPanelComponent } from "./json-panel.component";
import { OpsViewFacade } from "./ops-view.facade";
import { RecordCollectionComponent } from "./record-collection.component";
import { SummaryCardsComponent } from "./summary-cards.component";

@Component({
  selector: "app-ops-view",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    JsonPanelComponent,
    SummaryCardsComponent,
    RecordCollectionComponent
  ],
  template: `
    <div class="stack">
      <article class="card">
        <h2>Diagnostics</h2>
        <p>Inspect health, readiness, metrics, and effective runtime configuration without leaving the app.</p>
        <div class="actions">
          <button class="primary" type="button" (click)="view.refreshDiagnostics()">Refresh Diagnostics</button>
          <button class="ghost" type="button" (click)="view.refreshMetrics()">Refresh Metrics</button>
        </div>
      </article>

      <app-record-collection
        title="Local Demo Access"
        subtitle="When local demo bootstrap is enabled, use these ready-made credentials and direct participant entry link."
        [items]="view.localDemoAccessItems"
        (itemAction)="view.runLocalDemoAccessAction($event)"
        emptyState="Refresh diagnostics to detect whether local demo bootstrap is enabled."
      ></app-record-collection>

      <article class="card">
        <h2>Admin Access</h2>
        <p>Bootstrap the first platform admin, sign in, and verify the active bearer session from the browser.</p>
        <div class="form-grid">
          <label>
            Admin Username
            <input id="adminUsername" name="adminUsername" [(ngModel)]="view.ops.adminUsername" (change)="view.persistState()" />
          </label>
          <label>
            Display Name
            <input id="adminDisplayName" name="adminDisplayName" [(ngModel)]="view.ops.adminDisplayName" (change)="view.persistState()" />
          </label>
          <label>
            Password
            <input id="adminPassword" name="adminPassword" type="password" autocomplete="current-password" [(ngModel)]="view.ops.adminPassword" />
          </label>
          <label>
            Session Token
            <input id="adminSessionToken" name="adminSessionToken" [(ngModel)]="view.ops.adminSessionToken" (change)="view.persistState()" placeholder="Filled after sign-in" />
          </label>
        </div>
        <div class="actions">
          <button id="adminBootstrapOrSignInButton" class="primary" type="button" (click)="view.bootstrapOrSignInAdmin()">Bootstrap / Sign In</button>
          <button id="adminBootstrapButton" class="ghost" type="button" (click)="view.bootstrapAdmin()">Bootstrap Only</button>
          <button id="adminSignInButton" class="ghost" type="button" (click)="view.signInAdmin()">Sign In</button>
          <button id="adminCurrentSessionButton" class="ghost" type="button" (click)="view.refreshAdminSession()">Current Session</button>
          <button id="adminUsersButton" class="ghost" type="button" (click)="view.refreshAdminUsers()">Admin Users</button>
          <button id="adminAuditEventsButton" class="ghost" type="button" (click)="view.refreshAdminAuditEvents()">Admin Audit Events</button>
          <button id="adminSignOutButton" class="ghost" type="button" (click)="view.signOutAdmin()">Sign Out</button>
        </div>
      </article>

      <app-record-collection
        title="Admin Session"
        subtitle="The currently known admin identity, role assignment, and session lifecycle."
        [items]="view.adminSessionItems"
        emptyState="Bootstrap or sign in to inspect the admin session."
      ></app-record-collection>

      <article class="card">
        <h2>Admin User Management</h2>
        <p>Create operator accounts, grant scoped roles, and activate or disable users from the protected admin surface.</p>
        <div class="form-grid">
          <label>
            New Username
            <input id="adminCreateUsername" name="adminCreateUsername" [(ngModel)]="view.ops.adminCreateUsername" (change)="view.persistState()" />
          </label>
          <label>
            New Display Name
            <input id="adminCreateDisplayName" name="adminCreateDisplayName" [(ngModel)]="view.ops.adminCreateDisplayName" (change)="view.persistState()" />
          </label>
          <label>
            New Password
            <input id="adminCreatePassword" name="adminCreatePassword" type="password" autocomplete="new-password" [(ngModel)]="view.ops.adminCreatePassword" />
          </label>
          <label>
            Initial Role
            <select id="adminCreateRole" name="adminCreateRole" [(ngModel)]="view.ops.adminCreateRole" (change)="view.persistState()">
              <option *ngFor="let role of view.adminRoleOptions" [ngValue]="role">{{ role }}</option>
            </select>
          </label>
          <label>
            Initial Tenant Key
            <input id="adminCreateTenantKey" name="adminCreateTenantKey" [(ngModel)]="view.ops.adminCreateTenantKey" (change)="view.persistState()" [disabled]="view.ops.adminCreateRole === 'platform_admin'" />
          </label>
          <label>
            Initial Workspace Key
            <input id="adminCreateWorkspaceKey" name="adminCreateWorkspaceKey" [(ngModel)]="view.ops.adminCreateWorkspaceKey" (change)="view.persistState()" [disabled]="view.ops.adminCreateRole !== 'workspace_admin'" />
          </label>
        </div>
        <div class="actions">
          <button id="adminCreateUserButton" class="primary" type="button" (click)="view.createAdminUser()">Create Admin User</button>
        </div>

        <div class="form-grid">
          <label>
            Role Target Admin User ID
            <input id="adminRoleTargetUserId" name="adminRoleTargetUserId" placeholder="Select an admin user below" [(ngModel)]="view.ops.adminRoleTargetUserId" (change)="view.persistState()" />
          </label>
          <label>
            Role To Assign
            <select id="adminRoleRole" name="adminRoleRole" [(ngModel)]="view.ops.adminRoleRole" (change)="view.persistState()">
              <option *ngFor="let role of view.adminRoleOptions" [ngValue]="role">{{ role }}</option>
            </select>
          </label>
          <label>
            Role Tenant Key
            <input id="adminRoleTenantKey" name="adminRoleTenantKey" [(ngModel)]="view.ops.adminRoleTenantKey" (change)="view.persistState()" [disabled]="view.ops.adminRoleRole === 'platform_admin'" />
          </label>
          <label>
            Role Workspace Key
            <input id="adminRoleWorkspaceKey" name="adminRoleWorkspaceKey" [(ngModel)]="view.ops.adminRoleWorkspaceKey" (change)="view.persistState()" [disabled]="view.ops.adminRoleRole !== 'workspace_admin'" />
          </label>
        </div>
        <div class="actions">
          <button id="adminAssignRoleButton" class="ghost" type="button" (click)="view.assignAdminRole()">Assign Role</button>
        </div>

        <div class="form-grid">
          <label>
            Revoke Target Admin User ID
            <input id="adminRevokeTargetUserId" name="adminRevokeTargetUserId" placeholder="Select an admin user below" [(ngModel)]="view.ops.adminRevokeTargetUserId" (change)="view.persistState()" />
          </label>
          <label>
            Role Assignment ID To Revoke
            <input id="adminRevokeRoleAssignmentId" name="adminRevokeRoleAssignmentId" placeholder="Shown in role scopes below" [(ngModel)]="view.ops.adminRevokeRoleAssignmentId" (change)="view.persistState()" />
          </label>
        </div>
        <div class="actions">
          <button id="adminRevokeRoleButton" class="ghost" type="button" (click)="view.revokeAdminRole()">Revoke Role</button>
        </div>

        <div class="form-grid">
          <label>
            Password Target Admin User ID
            <input id="adminResetTargetUserId" name="adminResetTargetUserId" placeholder="Select an admin user below" [(ngModel)]="view.ops.adminResetTargetUserId" (change)="view.persistState()" />
          </label>
          <label>
            New Admin Password
            <input id="adminResetPassword" name="adminResetPassword" type="password" autocomplete="new-password" [(ngModel)]="view.ops.adminResetPassword" />
          </label>
        </div>
        <div class="actions">
          <button id="adminResetPasswordButton" class="ghost" type="button" (click)="view.resetAdminUserPassword()">Reset Password</button>
        </div>

        <div class="form-grid">
          <label>
            Status Target Admin User ID
            <input id="adminStatusTargetUserId" name="adminStatusTargetUserId" placeholder="Select an admin user below" [(ngModel)]="view.ops.adminStatusTargetUserId" (change)="view.persistState()" />
          </label>
          <label>
            New Status
            <select id="adminStatusValue" name="adminStatusValue" [(ngModel)]="view.ops.adminStatusValue" (change)="view.persistState()">
              <option *ngFor="let status of view.adminStatusOptions" [ngValue]="status">{{ status }}</option>
            </select>
          </label>
        </div>
        <div class="actions">
          <button id="adminUpdateStatusButton" class="ghost" type="button" (click)="view.updateAdminUserStatus()">Update Status</button>
        </div>
      </article>

      <app-record-collection
        title="Admin Users"
        subtitle="Protected platform-admin directory with public user fields and role scopes."
        [items]="view.adminUserItems"
        (itemAction)="view.selectAdminUser($event)"
        emptyState="Sign in as platform admin, then refresh admin users."
      ></app-record-collection>

      <app-record-collection
        title="Admin Role Assignments"
        subtitle="Concrete role assignments that can be selected for safe revocation."
        [items]="view.adminRoleAssignmentItems"
        (itemAction)="view.selectAdminRoleAssignment($event)"
        emptyState="Refresh admin users to inspect role assignments."
      ></app-record-collection>

      <app-record-collection
        title="Admin Audit Events"
        subtitle="Persistent platform-admin trail for admin sign-ins, user management, and role changes."
        [items]="view.adminAuditItems"
        emptyState="Sign in as platform admin, then refresh admin audit events."
      ></app-record-collection>

      <article class="card">
        <h2>Operational Snapshot</h2>
        <p>Read the most important runtime signals first, then drill into the raw diagnostics below if something looks wrong.</p>
        <app-summary-cards [cards]="view.operationalCards"></app-summary-cards>
      </article>

      <app-record-collection
        title="Ops Action Queue"
        subtitle="Suggested diagnostic follow-ups from readiness, metrics, and recent runtime events."
        [items]="view.opsActionItems"
        (itemAction)="view.runOpsSuggestion($event)"
        emptyState="Refresh diagnostics to derive operational follow-ups."
      ></app-record-collection>

      <app-record-collection
        title="Readiness Detail"
        subtitle="The current readiness edge, build identity, and storage shape."
        [items]="view.readinessItems"
        emptyState="Refresh diagnostics to inspect readiness details."
      ></app-record-collection>

      <app-record-collection
        title="Runtime Surface"
        subtitle="Health, readiness, manifest phase, and storage identity in one typed card."
        [items]="view.runtimeSurfaceItems"
        emptyState="Refresh diagnostics to inspect the runtime surface."
      ></app-record-collection>

      <app-record-collection
        title="Build Identity"
        subtitle="Current build and phase context without opening the manifest JSON."
        [items]="view.buildIdentityItems"
        emptyState="Refresh diagnostics to inspect build identity."
      ></app-record-collection>

      <app-record-collection
        title="Lifecycle Detail"
        subtitle="Runtime phase, uptime, shutdown state, and request load."
        [items]="view.lifecycleItems"
        emptyState="Refresh diagnostics to inspect runtime lifecycle."
      ></app-record-collection>

      <app-record-collection
        title="Recent Operational Events"
        subtitle="The newest runtime events without digging through raw diagnostics JSON."
        [items]="view.runtimeDiagnosticsItems"
        emptyState="No operational events loaded yet."
      ></app-record-collection>

      <app-record-collection
        title="Operational Event Summary"
        subtitle="A compact view of recent event volume and the latest operational signal."
        [items]="view.operationalEventSummaryItems"
        emptyState="Refresh diagnostics to inspect operational event summaries."
      ></app-record-collection>

      <app-record-collection
        title="Effective Runtime Config"
        subtitle="The config that the current API process is actually running with."
        [items]="view.runtimeConfigItems"
        emptyState="Refresh diagnostics to inspect runtime configuration."
      ></app-record-collection>

      <app-record-collection
        title="Process Metrics"
        subtitle="Lifecycle, request volume, and memory pressure in one typed view."
        [items]="view.processMetricsItems"
        emptyState="Refresh metrics to inspect process health."
      ></app-record-collection>

      <app-record-collection
        title="Requests By Method"
        subtitle="How the current process has been exercised by HTTP method."
        [items]="view.requestMethodItems"
        emptyState="Refresh metrics to inspect method counters."
      ></app-record-collection>

      <app-record-collection
        title="Requests By Route"
        subtitle="Route volume plus lightweight latency context."
        [items]="view.requestRouteItems"
        emptyState="Refresh metrics to inspect route counters."
      ></app-record-collection>

      <app-record-collection
        title="Route Latency Buckets"
        subtitle="Latency distribution per route without opening raw metrics JSON."
        [items]="view.routeLatencyBucketItems"
        emptyState="Refresh metrics to inspect route latency buckets."
      ></app-record-collection>

      <app-record-collection
        title="Response Status Counts"
        subtitle="A compact view of status-code distribution."
        [items]="view.responseStatusItems"
        emptyState="Refresh metrics to inspect response counters."
      ></app-record-collection>

      <app-record-collection
        title="Error Counters"
        subtitle="Current error buckets without digging through raw metrics JSON."
        [items]="view.errorCountItems"
        emptyState="Refresh metrics to inspect error counters."
      ></app-record-collection>

      <app-json-panel title="Readiness And Manifest" subtitle="Runtime Surface" viewId="runtimeHealthView" [content]="view.ops.runtimeHealthView"></app-json-panel>
      <app-json-panel title="Metrics" subtitle="Process Counters" viewId="runtimeMetricsView" [content]="view.ops.runtimeMetricsView"></app-json-panel>
      <app-json-panel title="Runtime Diagnostics" subtitle="Recent Events" viewId="runtimeDiagnosticsView" [content]="view.ops.runtimeDiagnosticsView"></app-json-panel>
      <app-json-panel title="Runtime Config" subtitle="Effective Config" viewId="runtimeConfigView" [content]="view.ops.runtimeConfigView"></app-json-panel>
    </div>
  `
})
export class OpsViewComponent implements OnInit {
  readonly view = inject(OpsViewFacade);

  ngOnInit(): void {
    this.view.init();
  }
}
