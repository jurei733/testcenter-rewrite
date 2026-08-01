import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import type { OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";

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
        <h2>Operator Access</h2>
        <p>Sign in and verify the active bearer session. Administrative tools appear only for accounts with an admin role.</p>
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
          <button id="adminBootstrapOrSignInButton" *ngIf="!view.isMonitorOnlySession" class="primary" type="button" [disabled]="!view.canUseAdminCredentials" (click)="view.bootstrapOrSignInAdmin()">Bootstrap / Sign In</button>
          <button id="adminBootstrapButton" *ngIf="!view.isMonitorOnlySession" class="ghost" type="button" [disabled]="!view.canUseAdminCredentials" (click)="view.bootstrapAdmin()">Bootstrap Only</button>
          <button id="adminSignInButton" class="ghost" type="button" [disabled]="!view.canUseAdminCredentials" (click)="view.signInAdmin()">Sign In</button>
          <button id="adminCurrentSessionButton" class="ghost" type="button" [disabled]="!view.canUseAdminSession" (click)="view.refreshAdminSession()">Current Session</button>
          <button id="adminSessionsButton" *ngIf="!view.isMonitorOnlySession" class="ghost" type="button" [disabled]="!view.canUseAdminSession" (click)="view.refreshAdminSessions()">Admin Sessions</button>
          <button id="adminUsersButton" *ngIf="!view.isMonitorOnlySession" class="ghost" type="button" [disabled]="!view.canUseAdminSession" (click)="view.refreshAdminUsers()">Admin Users</button>
          <button id="adminAuditEventsButton" *ngIf="!view.isMonitorOnlySession" class="ghost" type="button" [disabled]="!view.canUseAdminSession" (click)="view.refreshAdminAuditEvents()">Admin Audit Events</button>
          <button id="adminSignOutButton" class="ghost" type="button" [disabled]="!view.canUseAdminSession" (click)="view.signOutAdmin()">Sign Out</button>
        </div>
      </article>

      <app-record-collection
        title="Operator Session"
        [subtitle]="'Active access: ' + view.operatorAccessLabel"
        [items]="view.adminSessionItems"
        emptyState="Bootstrap or sign in to inspect the admin session."
      ></app-record-collection>

      <ng-container *ngIf="!view.isMonitorOnlySession">

      <article class="card">
        <h2>Admin Session Filters</h2>
        <p>Narrow persisted admin bearer sessions by user, lifecycle status, or a bounded result limit.</p>
        <div class="form-grid">
          <label>
            Admin User ID
            <input id="adminSessionUserFilter" name="adminSessionUserFilter" placeholder="admin user id" [(ngModel)]="view.ops.adminSessionUserFilter" (change)="view.persistState()" />
          </label>
          <label>
            Status
            <select id="adminSessionStatusFilter" name="adminSessionStatusFilter" [(ngModel)]="view.ops.adminSessionStatusFilter" (change)="view.persistState()">
              <option value="">All session statuses</option>
              <option *ngFor="let status of view.adminSessionStatusOptions" [ngValue]="status">{{ status }}</option>
            </select>
          </label>
          <label>
            Session Limit
            <input id="adminSessionLimit" name="adminSessionLimit" inputmode="numeric" [(ngModel)]="view.ops.adminSessionLimit" (change)="view.persistState()" />
          </label>
          <label>
            Revoke Session ID
            <input id="adminSessionRevokeTargetId" name="adminSessionRevokeTargetId" placeholder="select a session below" [(ngModel)]="view.ops.adminSessionRevokeTargetId" (change)="view.persistState()" />
          </label>
        </div>
        <div class="actions">
          <button id="applyAdminSessionFiltersButton" class="primary" type="button" [disabled]="!view.canUseAdminSession" (click)="view.applyAdminSessionFilters()">Apply Session Filters</button>
          <button id="exportAdminSessionsCsvButton" class="secondary" type="button" [disabled]="!view.canUseAdminSession" (click)="view.exportAdminSessionsCsv()">Export Sessions CSV</button>
          <button id="useCurrentAdminUserAsSessionFilterButton" class="secondary" type="button" [disabled]="!view.canUseAdminSession" (click)="view.useCurrentAdminUserAsSessionFilter()">Use Current User</button>
          <button id="adminRevokeSessionButton" class="danger" type="button" [disabled]="!view.canRevokeAdminSession" (click)="view.confirmRevokeAdminSession()">Revoke Selected Session</button>
          <button class="ghost" type="button" (click)="view.clearAdminSessionFilters()">Clear Session Filters</button>
        </div>
      </article>

      <app-record-collection
        title="Admin Sessions"
        subtitle="Protected platform-admin read model for issued admin bearer sessions without exposing tokens."
        [items]="view.adminSessionDirectoryItems"
        (itemAction)="view.selectAdminSession($event)"
        emptyState="Sign in as platform admin, then refresh admin sessions."
      ></app-record-collection>

      <article class="card">
        <h2>Admin Sessions CSV Export</h2>
        <p>CSV preview for the current session filters, excluding bearer tokens.</p>
        <pre id="adminSessionsExportPreview">{{ view.ops.adminSessionsExportView }}</pre>
      </article>

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
            <input id="adminCreateWorkspaceKey" name="adminCreateWorkspaceKey" [(ngModel)]="view.ops.adminCreateWorkspaceKey" (change)="view.persistState()" [disabled]="view.ops.adminCreateRole === 'platform_admin' || view.ops.adminCreateRole === 'tenant_admin'" />
          </label>
          <label>
            Initial Group Key
            <input id="adminCreateGroupKey" name="adminCreateGroupKey" [(ngModel)]="view.ops.adminCreateGroupKey" (change)="view.persistState()" [disabled]="view.ops.adminCreateRole !== 'group_monitor'" />
          </label>
          <label>
            Access Starts (ISO timestamp)
            <input id="adminCreateValidFrom" name="adminCreateValidFrom" placeholder="2026-08-01T08:00:00Z" [(ngModel)]="view.ops.adminCreateValidFrom" (change)="view.persistState()" />
          </label>
          <label>
            Access Ends (ISO timestamp)
            <input id="adminCreateValidTo" name="adminCreateValidTo" placeholder="2026-08-31T18:00:00Z" [(ngModel)]="view.ops.adminCreateValidTo" (change)="view.persistState()" />
          </label>
          <label>
            Valid For After First Sign-In (minutes)
            <input id="adminCreateValidForMinutes" name="adminCreateValidForMinutes" type="number" min="1" max="5256000" step="1" [(ngModel)]="view.ops.adminCreateValidForMinutes" (change)="view.persistState()" />
          </label>
        </div>
        <p *ngIf="view.isCreatingOperationalAccount">
          Operational accounts receive only the selected workspace/group scope. For
          imported original logins, assign a new password here because source
          passwords are deliberately never copied. Original access dates and
          first-login durations are copied into these fields and enforced at sign-in.
        </p>
        <p *ngIf="!view.isAdminCreateAccessWindowValid">
          Enter valid ISO timestamps with the start no later than the end, and a
          whole duration between 1 and 5,256,000 minutes.
        </p>
        <div class="actions">
          <button id="adminCreateUserButton" class="primary" type="button" [disabled]="!view.canCreateAdminUser" (click)="view.createAdminUser()">{{ view.isCreatingSystemCheckAccount ? "Create System Check Account" : view.isCreatingMonitorAccount ? "Create Monitor Account" : "Create Admin User" }}</button>
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
            <input id="adminRoleWorkspaceKey" name="adminRoleWorkspaceKey" [(ngModel)]="view.ops.adminRoleWorkspaceKey" (change)="view.persistState()" [disabled]="view.ops.adminRoleRole === 'platform_admin' || view.ops.adminRoleRole === 'tenant_admin'" />
          </label>
          <label>
            Role Group Key
            <input id="adminRoleGroupKey" name="adminRoleGroupKey" [(ngModel)]="view.ops.adminRoleGroupKey" (change)="view.persistState()" [disabled]="view.ops.adminRoleRole !== 'group_monitor'" />
          </label>
        </div>
        <div class="actions">
          <button id="adminAssignRoleButton" class="ghost" type="button" [disabled]="!view.canAssignAdminRole" (click)="view.assignAdminRole()">Assign Role</button>
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
          <button id="adminRevokeRoleButton" class="ghost" type="button" [disabled]="!view.canRevokeAdminRole" (click)="view.confirmRevokeAdminRole()">Revoke Role</button>
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
          <button id="adminResetPasswordButton" class="ghost" type="button" [disabled]="!view.canResetAdminUserPassword" (click)="view.confirmResetAdminUserPassword()">Reset Password</button>
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
          <button id="adminUpdateStatusButton" class="ghost" type="button" [disabled]="!view.canUpdateAdminUserStatus" (click)="view.confirmUpdateAdminUserStatus()">Update Status</button>
        </div>
      </article>

      <article class="card">
        <h2>Admin User Filters</h2>
        <p>Narrow the protected admin directory by username, status, role, scope, or a bounded result limit.</p>
        <div class="form-grid">
          <label>
            Username Contains
            <input id="adminUserUsernameFilter" name="adminUserUsernameFilter" placeholder="workspace" [(ngModel)]="view.ops.adminUserUsernameFilter" (change)="view.persistState()" />
          </label>
          <label>
            Status
            <select id="adminUserStatusFilter" name="adminUserStatusFilter" [(ngModel)]="view.ops.adminUserStatusFilter" (change)="view.persistState()">
              <option value="">All statuses</option>
              <option *ngFor="let status of view.adminStatusOptions" [ngValue]="status">{{ status }}</option>
            </select>
          </label>
          <label>
            Role
            <select id="adminUserRoleFilter" name="adminUserRoleFilter" [(ngModel)]="view.ops.adminUserRoleFilter" (change)="view.persistState()">
              <option value="">All roles</option>
              <option *ngFor="let role of view.adminRoleOptions" [ngValue]="role">{{ role }}</option>
            </select>
          </label>
          <label>
            Tenant Key
            <input id="adminUserTenantFilter" name="adminUserTenantFilter" placeholder="tenant key" [(ngModel)]="view.ops.adminUserTenantFilter" (change)="view.persistState()" />
          </label>
          <label>
            Workspace Key
            <input id="adminUserWorkspaceFilter" name="adminUserWorkspaceFilter" placeholder="workspace key" [(ngModel)]="view.ops.adminUserWorkspaceFilter" (change)="view.persistState()" />
          </label>
          <label>
            User Limit
            <input id="adminUserLimit" name="adminUserLimit" inputmode="numeric" [(ngModel)]="view.ops.adminUserLimit" (change)="view.persistState()" />
          </label>
        </div>
        <div class="actions">
          <button id="applyAdminUserFiltersButton" class="primary" type="button" [disabled]="!view.canUseAdminSession" (click)="view.applyAdminUserFilters()">Apply User Filters</button>
          <button id="useAdminManagementScopeAsUserFiltersButton" class="secondary" type="button" [disabled]="!view.canUseAdminSession" (click)="view.useAdminManagementScopeAsUserFilters()">Use Role Scope</button>
          <button id="exportAdminUsersCsvButton" class="secondary" type="button" [disabled]="!view.canUseAdminSession" (click)="view.exportAdminUsersCsv()">Export Users CSV</button>
          <button class="ghost" type="button" (click)="view.clearAdminUserFilters()">Clear User Filters</button>
        </div>
      </article>

      <app-record-collection
        title="Admin Users"
        subtitle="Protected platform-admin directory with public user fields and role scopes."
        [items]="view.adminUserItems"
        (itemAction)="view.selectAdminUser($event)"
        emptyState="Sign in as platform admin, then refresh admin users."
      ></app-record-collection>

      <article class="card">
        <h2>Admin Users CSV Export</h2>
        <p>Preview the filtered admin directory as CSV for access reviews, account handoff, or operator archiving.</p>
        <pre id="adminUsersExportPreview">{{ view.ops.adminUsersExportView }}</pre>
      </article>

      <app-record-collection
        title="Admin Role Assignments"
        subtitle="Concrete role assignments that can be selected for safe revocation."
        [items]="view.adminRoleAssignmentItems"
        (itemAction)="view.selectAdminRoleAssignment($event)"
        emptyState="Refresh admin users to inspect role assignments."
      ></app-record-collection>

      <article class="card">
        <h2>Admin Audit Filters</h2>
        <p>Narrow the protected audit trail by event type, actor, subject, or a bounded result limit.</p>
        <div class="form-grid">
          <label>
            Event Type
            <select id="adminAuditEventTypeFilter" name="adminAuditEventTypeFilter" [(ngModel)]="view.ops.adminAuditEventTypeFilter" (change)="view.persistState()">
              <option value="">All audit events</option>
              <option *ngFor="let eventType of view.adminAuditEventTypeOptions" [ngValue]="eventType">{{ eventType }}</option>
            </select>
          </label>
          <label>
            Actor Admin User ID
            <input id="adminAuditActorFilter" name="adminAuditActorFilter" placeholder="actor admin user id" [(ngModel)]="view.ops.adminAuditActorFilter" (change)="view.persistState()" />
          </label>
          <label>
            Subject Admin User ID
            <input id="adminAuditSubjectFilter" name="adminAuditSubjectFilter" placeholder="subject admin user id" [(ngModel)]="view.ops.adminAuditSubjectFilter" (change)="view.persistState()" />
          </label>
          <label>
            Audit Limit
            <input id="adminAuditLimit" name="adminAuditLimit" inputmode="numeric" [(ngModel)]="view.ops.adminAuditLimit" (change)="view.persistState()" />
          </label>
        </div>
        <div class="actions">
          <button id="applyAdminAuditFiltersButton" class="primary" type="button" [disabled]="!view.canUseAdminSession" (click)="view.applyAdminAuditFilters()">Apply Audit Filters</button>
          <button id="useSelectedAdminUserAsAuditSubjectButton" class="secondary" type="button" [disabled]="!view.canUseAdminSession" (click)="view.useSelectedAdminUserAsAuditSubject()">Use Selected User As Subject</button>
          <button id="exportAdminAuditCsvButton" class="secondary" type="button" [disabled]="!view.canUseAdminSession" (click)="view.exportAdminAuditEventsCsv()">Export Audit CSV</button>
          <button class="ghost" type="button" (click)="view.clearAdminAuditFilters()">Clear Audit Filters</button>
        </div>
      </article>

      <app-record-collection
        title="Admin Audit Events"
        subtitle="Persistent platform-admin trail for admin sign-ins, user management, and role changes."
        [items]="view.adminAuditItems"
        (itemAction)="view.selectAdminAuditEvent($event)"
        emptyState="Sign in as platform admin, then refresh admin audit events."
      ></app-record-collection>

      <article class="card">
        <h2>Admin Audit CSV Export</h2>
        <p>Preview the filtered audit trail as CSV for platform handoff, incident review, or external archiving.</p>
        <pre id="adminAuditExportPreview">{{ view.ops.adminAuditExportView }}</pre>
      </article>
      </ng-container>

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
        title="Manifest Capabilities"
        subtitle="Advertised operator, runtime, import, and production capabilities grouped from the live manifest."
        [items]="view.manifestCapabilityItems"
        emptyState="Refresh diagnostics to inspect manifest capabilities."
      ></app-record-collection>

      <app-record-collection
        title="Manifest Route Groups"
        subtitle="The live route surface grouped by API area, derived from the same manifest used by probes."
        [items]="view.manifestRouteGroupItems"
        emptyState="Refresh diagnostics to inspect manifest route groups."
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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  ngOnInit(): void {
    this.view.init();
    if (this.route.snapshot.queryParamMap.get("demoAdmin") === "sign-in") {
      this.view.signInLocalDemoAdmin();
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { demoAdmin: null },
        queryParamsHandling: "merge",
        replaceUrl: true
      });
    }
  }
}
