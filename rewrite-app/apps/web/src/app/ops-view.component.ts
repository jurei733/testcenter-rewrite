import { CommonModule } from "@angular/common";
import { Component, DestroyRef, inject } from "@angular/core";
import type { OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

import {
  AdministrationNavComponent,
  type AdministrationSection
} from "./administration-nav.component";
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
    AdministrationNavComponent,
    JsonPanelComponent,
    SummaryCardsComponent,
    RecordCollectionComponent
  ],
  template: `
    <div class="stack">
      <article class="card" *ngIf="view.canUseAdminSession">
        <h2>Diagnostics</h2>
        <p>Inspect health, readiness, metrics, and effective runtime configuration without leaving the app.</p>
        <div class="actions">
          <button class="primary" type="button" (click)="view.refreshDiagnostics()">Refresh Diagnostics</button>
          <button class="ghost" type="button" (click)="view.refreshMetrics()">Refresh Metrics</button>
        </div>
      </article>

      <app-record-collection
        *ngIf="view.localDemoAccessItems.length"
        title="Local Demo Access"
        subtitle="When local demo bootstrap is enabled, use these ready-made credentials and direct participant entry link."
        [items]="view.localDemoAccessItems"
        (itemAction)="view.runLocalDemoAccessAction($event)"
        emptyState="Refresh diagnostics to detect whether local demo bootstrap is enabled."
      ></app-record-collection>

      <article id="operatorAccessCard" class="card operator-access-card" [class.is-signed-out]="!view.canUseAdminSession">
        <span class="eyebrow">Protected operator access</span>
        <h2>{{ view.canUseAdminSession ? "Operator Session" : "Sign In To The Operator Console" }}</h2>
        <p>{{ view.canUseAdminSession
          ? "The active account controls which administration and monitoring surfaces are available."
          : "Use an administrator, study-monitor, or group-monitor account. You will return to the requested protected view after sign-in." }}</p>

        <ng-container *ngIf="!view.canUseAdminSession; else activeOperatorSession">
          <form class="operator-sign-in-form" (ngSubmit)="signInAdmin()">
            <input id="adminSessionToken" name="adminSessionToken" type="hidden" [(ngModel)]="view.ops.adminSessionToken" />
            <label>
              Username
              <input id="adminUsername" name="adminUsername" autocomplete="username" [(ngModel)]="view.ops.adminUsername" (change)="view.persistState()" />
            </label>
            <label>
              Password
              <input id="adminPassword" name="adminPassword" type="password" autocomplete="current-password" [(ngModel)]="view.ops.adminPassword" />
            </label>
            <button id="adminSignInButton" class="primary" type="submit" [disabled]="!view.canUseAdminCredentials">Sign In</button>
          </form>

          <details id="firstDeploymentSetup" class="operator-bootstrap-details" *ngIf="view.canBootstrapAdmin">
            <summary>First deployment setup</summary>
            <p>Create the first platform administrator only when this instance has not been initialized yet.</p>
            <label>
              Display Name
              <input id="adminDisplayName" name="adminDisplayName" [(ngModel)]="view.ops.adminDisplayName" (change)="view.persistState()" />
            </label>
            <div class="actions">
              <button id="adminBootstrapOrSignInButton" class="secondary" type="button" [disabled]="!view.canUseAdminCredentials" (click)="bootstrapOrSignInAdmin()">Bootstrap / Sign In</button>
              <button id="adminBootstrapButton" class="ghost" type="button" [disabled]="!view.canUseAdminCredentials" (click)="view.bootstrapAdmin()">Create Without Signing In</button>
            </div>
          </details>
        </ng-container>

        <ng-template #activeOperatorSession>
          <div class="form-grid operator-session-fields">
            <label>
              Username
              <input id="adminUsername" name="adminUsername" [value]="view.ops.adminUsername" readonly />
            </label>
            <details class="technical-session-details">
              <summary>Technical session details</summary>
              <label>
                Bearer Token
                <input id="adminSessionToken" name="adminSessionToken" type="password" autocomplete="off" [(ngModel)]="view.ops.adminSessionToken" (change)="view.persistState()" readonly />
              </label>
            </details>
          </div>
          <div class="actions">
            <button id="adminCurrentSessionButton" class="secondary" type="button" (click)="view.refreshAdminSession()">Refresh Session</button>
            <button id="adminSessionsButton" *ngIf="view.canUseAdminManagement" class="ghost" type="button" (click)="view.refreshAdminSessions()">Admin Sessions</button>
            <button id="adminUsersButton" *ngIf="view.canUseAdminManagement" class="ghost" type="button" (click)="view.refreshAdminUsers()">Admin Users</button>
            <button id="adminAuditEventsButton" *ngIf="view.canUseAdminManagement" class="ghost" type="button" (click)="view.refreshAdminAuditEvents()">Admin Audit Events</button>
            <button id="adminSignOutButton" class="ghost" type="button" (click)="view.signOutAdmin()">Sign Out</button>
          </div>
        </ng-template>
        <p
          *ngIf="view.ops.adminAccessWindowNotice"
          id="adminAccessWindowNotice"
          class="operator-access-window-notice"
          role="alert"
          aria-live="assertive"
        >{{ view.ops.adminAccessWindowNotice }}</p>
      </article>

      <app-record-collection
        *ngIf="view.canUseAdminSession"
        title="Operator Session"
        [subtitle]="'Active access: ' + view.operatorAccessLabel"
        [items]="view.adminSessionItems"
        emptyState="Bootstrap or sign in to inspect the admin session."
      ></app-record-collection>

      <ng-container *ngIf="view.canUseAdminManagement">

      <app-administration-nav
        *ngIf="view.canManageApplicationSettings"
        [activeSection]="activeAdminSection"
        (sectionSelected)="selectAdminSection($event)"
      ></app-administration-nav>

      <article id="applicationSettingsCard" class="card" *ngIf="view.canManageApplicationSettings && activeAdminSection === 'settings'">
        <div class="section-heading">
          <div>
            <span class="eyebrow">Instance configuration</span>
            <h2>Application Settings</h2>
          </div>
          <span class="status-pill">Platform admin</span>
        </div>
        <p>Set the public title, logo, original audience theme, start-page introduction, separate legal/privacy/accessibility notices, and an optional time-bounded warning shown above every participant and operator view.</p>
        <div class="form-grid">
          <label>
            Application Title
            <input
              id="applicationTitleInput"
              name="applicationTitleInput"
              maxlength="120"
              [(ngModel)]="view.applicationTitleDraft"
            />
          </label>
          <label>
            Theme
            <select
              id="applicationThemeSelect"
              name="applicationThemeSelect"
              [(ngModel)]="view.applicationThemeDraft"
            >
              <option *ngFor="let theme of view.applicationThemeOptions" [ngValue]="theme">{{ theme }}</option>
            </select>
          </label>
          <div class="span-all application-logo-editor">
            <div>
              <strong>Application Logo</strong>
              <p>PNG, JPEG, GIF, WebP, or safe SVG; up to 20 MiB.</p>
              <input
                id="applicationLogoInput"
                name="applicationLogoInput"
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                (change)="view.selectApplicationLogo($event)"
              />
            </div>
            <img
              id="applicationLogoPreview"
              class="settings-logo-preview"
              [src]="view.applicationSettings.assetUrl('logo', view.applicationLogoDraft)"
              alt="Application logo preview"
            />
            <button id="resetApplicationLogoButton" class="ghost" type="button" (click)="view.resetApplicationLogo()">Use Default Logo</button>
          </div>
          <section class="span-all application-asset-editor">
            <div class="section-heading">
              <div>
                <strong>Original application assets</strong>
                <p>Upload shared PNG, JPEG, or WebP images up to 2 MiB, then assign them to the original Testcenter presentation slots.</p>
              </div>
              <div class="actions compact-actions">
                <label class="button-link secondary" for="applicationAssetInput">Upload asset</label>
                <input
                  id="applicationAssetInput"
                  name="applicationAssetInput"
                  class="visually-hidden"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  (change)="view.selectApplicationAsset($event)"
                />
                <button id="refreshApplicationAssetsButton" class="ghost" type="button" (click)="view.refreshApplicationAssets()">Refresh assets</button>
              </div>
            </div>
            <p id="applicationAssetUploadError" *ngIf="view.applicationAssetUploadError">{{ view.applicationAssetUploadError }}</p>
            <div class="application-asset-grid" *ngIf="view.applicationAssets.assets().length; else noApplicationAssets">
              <article class="application-asset-card" *ngFor="let asset of view.applicationAssets.assets()">
                <img [src]="view.applicationSettings.applicationAssetUrl(asset.originalName)" alt="" />
                <div>
                  <strong>{{ asset.originalName }}</strong>
                  <span>{{ asset.mediaType }} · {{ view.formatApplicationAssetBytes(asset.byteLength) }}</span>
                </div>
                <button class="ghost" type="button" (click)="view.confirmDeleteApplicationAsset(asset)">Delete</button>
              </article>
            </div>
            <ng-template #noApplicationAssets>
              <p>No shared application assets loaded. Refresh the registry or upload the first image.</p>
            </ng-template>
            <div class="application-asset-assignments">
              <label *ngFor="let slot of view.applicationAssetSlotOptions">
                {{ slot.label }}
                <select
                  [id]="'applicationAssetSlot-' + slot.name"
                  [name]="'applicationAssetSlot-' + slot.name"
                  [ngModel]="view.applicationAssetAssignmentsDraft[slot.name] || ''"
                  (ngModelChange)="view.setApplicationAssetAssignment(slot.name, $event)"
                >
                  <option value="">Built-in / unassigned</option>
                  <option *ngFor="let asset of view.applicationAssets.assets()" [value]="asset.originalName">{{ asset.originalName }}</option>
                </select>
              </label>
            </div>
          </section>
          <label class="span-all">
            Start Page HTML
            <textarea
              id="applicationIntroHtmlInput"
              name="applicationIntroHtmlInput"
              maxlength="100000"
              rows="7"
              [(ngModel)]="view.applicationIntroHtmlDraft"
              placeholder="Optional formatted introduction shown on participant entry."
            ></textarea>
          </label>
          <section class="span-all configured-content-preview" *ngIf="view.applicationIntroHtmlDraft.trim()">
            <strong>Sanitized start-page preview</strong>
            <div id="applicationIntroHtmlPreview" [innerHTML]="view.applicationIntroHtmlDraft"></div>
          </section>
          <label class="span-all">
            Legal Notice HTML
            <textarea
              id="applicationLegalNoticeHtmlInput"
              name="applicationLegalNoticeHtmlInput"
              maxlength="100000"
              rows="9"
              [(ngModel)]="view.applicationLegalNoticeHtmlDraft"
              placeholder="Optional Impressum or provider information."
            ></textarea>
          </label>
          <section class="span-all configured-content-preview" *ngIf="view.applicationLegalNoticeHtmlDraft.trim()">
            <strong>Sanitized legal-notice preview</strong>
            <div id="applicationLegalNoticeHtmlPreview" [innerHTML]="view.applicationLegalNoticeHtmlDraft"></div>
          </section>
          <label class="span-all">
            Privacy Notice HTML
            <textarea
              id="applicationPrivacyNoticeInput"
              name="applicationPrivacyNoticeInput"
              maxlength="100000"
              rows="9"
              [(ngModel)]="view.applicationPrivacyNoticeDraft"
              placeholder="Optional privacy information."
            ></textarea>
          </label>
          <section class="span-all configured-content-preview" *ngIf="view.applicationPrivacyNoticeDraft.trim()">
            <strong>Sanitized privacy preview</strong>
            <div id="applicationPrivacyNoticePreview" [innerHTML]="view.applicationPrivacyNoticeDraft"></div>
          </section>
          <label class="span-all">
            Accessibility Notice HTML
            <textarea
              id="applicationAccessibilityNoticeInput"
              name="applicationAccessibilityNoticeInput"
              maxlength="100000"
              rows="9"
              [(ngModel)]="view.applicationAccessibilityNoticeDraft"
              placeholder="Optional accessibility information."
            ></textarea>
          </label>
          <section class="span-all configured-content-preview" *ngIf="view.applicationAccessibilityNoticeDraft.trim()">
            <strong>Sanitized accessibility preview</strong>
            <div id="applicationAccessibilityNoticePreview" [innerHTML]="view.applicationAccessibilityNoticeDraft"></div>
          </section>
          <details id="applicationCustomTextsEditor" class="span-all application-custom-texts-editor">
            <summary>Custom text overrides ({{ view.applicationCustomTextKeys.length }})</summary>
            <p>Original precedence is global, then workspace Testtakers login, then active Booklet. Empty global values inherit the built-in default.</p>
            <div class="application-custom-text-add">
              <label>
                Additional key
                <input id="applicationCustomTextNewKey" name="applicationCustomTextNewKey" maxlength="120" [(ngModel)]="view.applicationCustomTextNewKey" placeholder="syscheck_intro" />
              </label>
              <label>
                Override
                <textarea id="applicationCustomTextNewValue" name="applicationCustomTextNewValue" rows="2" [(ngModel)]="view.applicationCustomTextNewValue"></textarea>
              </label>
              <button id="addApplicationCustomTextButton" class="secondary" type="button" [disabled]="!view.canAddApplicationCustomText" (click)="view.addApplicationCustomText()">Add override</button>
            </div>
            <div class="application-custom-text-list">
              <div class="application-custom-text-row" *ngFor="let key of view.applicationCustomTextKeys">
                <label>
                  <span>{{ key }}</span>
                  <textarea
                    [id]="'applicationCustomText-' + key"
                    [name]="'applicationCustomText-' + key"
                    rows="2"
                    [(ngModel)]="view.applicationCustomTextDrafts[key]"
                    [placeholder]="view.applicationCustomTextDefault(key) || 'No global override'"
                  ></textarea>
                </label>
                <div class="actions compact-actions">
                  <button class="ghost" type="button" *ngIf="view.applicationCustomTextDefault(key)" (click)="view.setApplicationCustomTextToDefault(key)">Use default</button>
                  <button class="ghost" type="button" [disabled]="!view.applicationCustomTextDrafts[key]" (click)="view.removeApplicationCustomText(key)">Inherit</button>
                </div>
              </div>
            </div>
            <p *ngIf="!view.applicationCustomTextsValid">Custom texts exceed the supported key or size limits.</p>
            <button id="resetApplicationCustomTextsButton" class="ghost" type="button" (click)="view.resetApplicationCustomTexts()">Clear all global overrides</button>
          </details>
          <label>
            Warning Expires
            <input
              id="applicationWarningExpiresAtInput"
              name="applicationWarningExpiresAtInput"
              type="datetime-local"
              [(ngModel)]="view.applicationWarningExpiresAtDraft"
            />
          </label>
          <label class="span-all">
            Global Warning
            <textarea
              id="applicationWarningTextInput"
              name="applicationWarningTextInput"
              maxlength="4000"
              rows="4"
              [(ngModel)]="view.applicationWarningTextDraft"
              placeholder="Leave empty to show no global warning."
            ></textarea>
          </label>
        </div>
        <p *ngIf="!view.isApplicationWarningExpirationValid">
          Enter a valid local date and time, or leave the expiration empty.
        </p>
        <p *ngIf="!view.applicationContentHtmlValid">
          Start-page, legal, privacy, and accessibility HTML must each stay within 100,000 UTF-8 bytes.
        </p>
        <p id="applicationLogoError" *ngIf="view.applicationLogoDraftError">{{ view.applicationLogoDraftError }}</p>
        <p id="applicationSettingsStatus">{{ view.applicationSettingsStatus }}</p>
        <div class="actions">
          <button id="saveApplicationSettingsButton" class="primary" type="button" [disabled]="!view.canSaveApplicationSettings" (click)="view.saveApplicationSettings()">Save Application Settings</button>
          <button id="clearApplicationWarningButton" class="secondary" type="button" [disabled]="!view.applicationWarningTextDraft && !view.applicationWarningExpiresAtDraft" (click)="view.clearApplicationWarning()">Clear Warning Draft</button>
          <button id="refreshApplicationSettingsButton" class="ghost" type="button" (click)="view.refreshApplicationSettings()">Refresh Settings</button>
        </div>
      </article>

      <ng-container *ngIf="activeAdminSection === 'users'">
      <ng-container *ngIf="view.canUseAdminSession">
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
        subtitle="Scoped admin read model for issued bearer sessions without exposing tokens."
        [items]="view.adminSessionDirectoryItems"
        (itemAction)="view.selectAdminSession($event)"
        emptyState="Sign in with an administrative delegation role, then refresh admin sessions."
      ></app-record-collection>

      <article id="adminSessionBatchRevokeCard" class="card">
        <div class="section-heading">
          <div>
            <span class="eyebrow">Bulk session management</span>
            <h2>Selected Admin Sessions</h2>
          </div>
          <span class="status-pill">{{ view.adminSessionBatchCount }}/50 selected</span>
        </div>
        <p>Select active sessions from the scoped directory and review their exact IDs below. The signed-in session cannot be selected; successful revocations are removed while failed targets remain available for retry.</p>
        <div class="actions">
          <button id="adminBatchRevokeSessionsButton" class="danger" type="button" [disabled]="!view.canRevokeAdminSessionBatch" (click)="view.confirmRevokeAdminSessionBatch()">Revoke Selected Sessions</button>
          <button id="clearAdminSessionBatchSelectionButton" class="ghost" type="button" [disabled]="view.adminSessionBatchCount === 0 && !view.adminSessionBatchResult" (click)="view.clearAdminSessionBatchSelection()">Clear Batch</button>
        </div>
      </article>

      <app-record-collection
        title="Selected Admin Sessions"
        subtitle="Exact best-effort batch preview and the most recent per-session result."
        [items]="view.adminSessionBatchPreviewItems"
        (itemAction)="view.selectAdminSession($event)"
        emptyState="No admin sessions are selected for revocation."
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
            <input id="adminCreatePassword" name="adminCreatePassword" type="password" autocomplete="new-password" [attr.minlength]="view.adminPasswordMinimumLength" [attr.maxlength]="view.adminPasswordMaximumLength" [(ngModel)]="view.ops.adminCreatePassword" />
          </label>
          <label>
            Initial Role
            <select id="adminCreateRole" name="adminCreateRole" [(ngModel)]="view.ops.adminCreateRole" (change)="view.adminCreateRoleChanged()">
              <option *ngFor="let role of view.adminRoleOptions" [ngValue]="role">{{ role }}</option>
            </select>
          </label>
          <label>
            Initial Access Mode
            <select id="adminCreateAccessMode" name="adminCreateAccessMode" [(ngModel)]="view.ops.adminCreateAccessMode" (change)="view.persistState()" [disabled]="view.ops.adminCreateRole !== 'workspace_admin'">
              <option *ngFor="let option of view.adminRoleAccessModeOptions" [value]="option.value">{{ option.label }}</option>
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
          <label *ngIf="view.isCreatingMonitorAccount">
            Test Booklet List
            <select id="adminCreateMonitorBookletVisibility" name="adminCreateMonitorBookletVisibility" [(ngModel)]="view.ops.adminCreateMonitorBookletVisibility" (change)="view.persistState()">
              <option value="visible">Visible</option>
              <option value="collapsed">Initially collapsed</option>
              <option value="hidden">Hidden</option>
            </select>
          </label>
          <label *ngIf="view.requiresPlatformRoleConfirmation">
            Confirm Current Platform Admin Password
            <input
              id="adminPlatformRoleConfirmationPassword"
              name="adminPlatformRoleConfirmationPassword"
              type="password"
              autocomplete="current-password"
              [attr.maxlength]="view.adminPasswordMaximumLength"
              [attr.aria-invalid]="view.platformRoleConfirmationError ? 'true' : null"
              [attr.aria-describedby]="view.platformRoleConfirmationError ? 'adminPlatformRoleConfirmationError' : null"
              [(ngModel)]="view.platformRoleConfirmationPassword"
              (ngModelChange)="view.platformRoleConfirmationChanged()"
            />
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
        <p
          id="adminPlatformRoleConfirmationError"
          *ngIf="view.platformRoleConfirmationError"
          role="alert"
        >{{ view.platformRoleConfirmationError }}</p>
        <p *ngIf="view.isCreatingOperationalAccount">
          Operational accounts receive only the selected workspace/group scope. For
          imported original logins, assign a new password here because source
          passwords are deliberately never copied. Original access dates and
          first-login durations are copied into these fields and enforced at sign-in.
          <ng-container *ngIf="view.isCreatingMonitorAccount">
            {{ view.adminCreateMonitorProfileCount }} imported monitor profile(s)
            and {{ view.adminCreateCustomTextCount }} login-specific custom text(s)
            will be stored with the account.
          </ng-container>
        </p>
        <p *ngIf="!view.isAdminCreateAccessWindowValid">
          Enter valid ISO timestamps with the start no later than the end, and a
          whole duration between 1 and 5,256,000 minutes.
        </p>
        <p *ngIf="view.requiresPlatformRoleConfirmation">
          Creating, assigning, batch-assigning, or revoking a platform_admin role
          requires the current acting administrator password. The confirmation is
          held in memory only and cleared after a successful sensitive action.
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
            <select id="adminRoleRole" name="adminRoleRole" [(ngModel)]="view.ops.adminRoleRole" (change)="view.adminRoleRoleChanged()">
              <option *ngFor="let role of view.adminRoleOptions" [ngValue]="role">{{ role }}</option>
            </select>
          </label>
          <label>
            Role Access Mode
            <select id="adminRoleAccessMode" name="adminRoleAccessMode" [(ngModel)]="view.ops.adminRoleAccessMode" (change)="view.persistState()" [disabled]="view.ops.adminRoleRole !== 'workspace_admin'">
              <option *ngFor="let option of view.adminRoleAccessModeOptions" [value]="option.value">{{ option.label }}</option>
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
          <label *ngIf="view.isAssigningMonitorRole">
            Test Booklet List
            <select id="adminRoleMonitorBookletVisibility" name="adminRoleMonitorBookletVisibility" [(ngModel)]="view.ops.adminRoleMonitorBookletVisibility" (change)="view.persistState()">
              <option value="visible">Visible</option>
              <option value="collapsed">Initially collapsed</option>
              <option value="hidden">Hidden</option>
            </select>
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
            <input id="adminResetPassword" name="adminResetPassword" type="password" autocomplete="new-password" [attr.minlength]="view.adminPasswordMinimumLength" [attr.maxlength]="view.adminPasswordMaximumLength" [(ngModel)]="view.ops.adminResetPassword" />
          </label>
          <label>
            Confirm New Admin Password
            <input id="adminResetPasswordConfirmation" name="adminResetPasswordConfirmation" type="password" autocomplete="new-password" [attr.minlength]="view.adminPasswordMinimumLength" [attr.maxlength]="view.adminPasswordMaximumLength" [(ngModel)]="view.adminResetPasswordConfirmation" />
          </label>
        </div>
        <p id="adminResetPasswordMismatch" *ngIf="view.hasAdminResetPasswordMismatch" role="alert">
          The password confirmation does not match.
        </p>
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

        <div class="form-grid">
          <label>
            Display Name Target Admin User ID
            <input id="adminDisplayNameTargetUserId" name="adminDisplayNameTargetUserId" placeholder="Select an admin user below" [(ngModel)]="view.adminDisplayNameTargetUserId" />
          </label>
          <label>
            New Display Name
            <input id="adminDisplayNameUpdateDraft" name="adminDisplayNameUpdateDraft" autocomplete="off" [(ngModel)]="view.adminDisplayNameUpdateDraft" />
          </label>
        </div>
        <p>Display-name edits keep the stable username, roles, status, and session identity unchanged and are recorded in the admin audit trail.</p>
        <div class="actions">
          <button id="adminUpdateDisplayNameButton" class="ghost" type="button" [disabled]="!view.canUpdateAdminUserDisplayName" (click)="view.confirmUpdateAdminUserDisplayName()">Update Display Name</button>
        </div>

        <div class="form-grid">
          <label>
            Access Window Target Admin User ID
            <input id="adminAccessWindowTargetUserId" name="adminAccessWindowTargetUserId" placeholder="Select an admin user below" [(ngModel)]="view.adminAccessWindowTargetUserId" />
          </label>
          <label>
            Access Starts
            <input id="adminAccessWindowValidFrom" name="adminAccessWindowValidFrom" placeholder="2026-08-01T08:00:00Z" [(ngModel)]="view.adminAccessWindowValidFromDraft" />
          </label>
          <label>
            Access Ends
            <input id="adminAccessWindowValidTo" name="adminAccessWindowValidTo" placeholder="2026-08-31T18:00:00Z" [(ngModel)]="view.adminAccessWindowValidToDraft" />
          </label>
          <label>
            Valid For Minutes After First Sign-In
            <input id="adminAccessWindowValidForMinutes" name="adminAccessWindowValidForMinutes" type="number" min="1" max="5256000" step="1" [(ngModel)]="view.adminAccessWindowValidForMinutesDraft" />
          </label>
        </div>
        <p id="adminAccessWindowValidationError" *ngIf="!view.isAdminAccessWindowUpdateValid" role="alert">Use valid timestamps, keep the start before the end, and enter 1–5256000 whole minutes or leave a field empty.</p>
        <p>Empty fields clear their boundary. Active sessions are ended or shortened when they fall outside the confirmed window.</p>
        <div class="actions">
          <button id="adminUpdateAccessWindowButton" class="ghost" type="button" [disabled]="!view.canUpdateAdminUserAccessWindow" (click)="view.confirmUpdateAdminUserAccessWindow()">Update Access Window</button>
        </div>

        <div class="form-grid">
          <label>
            Custom Text Target Admin User ID
            <input id="adminCustomTextsTargetUserId" name="adminCustomTextsTargetUserId" placeholder="Select an admin user below" [(ngModel)]="view.adminCustomTextsTargetUserId" />
          </label>
          <label>
            Login-Specific Custom Texts (JSON)
            <textarea id="adminCustomTextsUpdateDraft" name="adminCustomTextsUpdateDraft" rows="8" spellcheck="false" [(ngModel)]="view.adminCustomTextsUpdateDraft"></textarea>
          </label>
        </div>
        <p id="adminCustomTextsValidationError" *ngIf="view.normalizedAdminCustomTextsUpdate === null" role="alert">Use a JSON object with at most 250 valid keys and string values within the supported size limits.</p>
        <p>{{ view.adminCustomTextsUpdateCount }} non-empty login-specific custom text(s) will replace the complete current map. Values are trimmed; empty values remove their key.</p>
        <div class="actions">
          <button id="adminUpdateCustomTextsButton" class="ghost" type="button" [disabled]="!view.canUpdateAdminUserCustomTexts" (click)="view.confirmUpdateAdminUserCustomTexts()">Update Custom Texts</button>
        </div>
      </article>

      <ng-container *ngIf="view.isCreatingMonitorAccount || view.isAssigningMonitorRole">
        <article class="card">
          <h2>Monitor Profile Editor</h2>
          <p>
            Author the monitor layout, visibility rules, and reusable run filters
            without editing raw profile JSON. Save the profile here, then create the
            account or update the selected role scope above.
          </p>
          <div class="form-grid">
            <label>
              Profile Destination
              <select
                id="monitorProfileEditorTarget"
                name="monitorProfileEditorTarget"
                [ngModel]="view.monitorProfileEditorTarget"
                (ngModelChange)="view.setMonitorProfileEditorTarget($event)"
              >
                <option value="create" [disabled]="!view.isCreatingMonitorAccount">New monitor account</option>
                <option value="role" [disabled]="!view.isAssigningMonitorRole">Selected role scope</option>
              </select>
            </label>
            <label>
              Profile ID
              <input id="monitorProfileDraftId" name="monitorProfileDraftId" maxlength="128" placeholder="room-overview" [(ngModel)]="view.monitorProfileDraftId" />
            </label>
            <label>
              Profile Label
              <input id="monitorProfileDraftLabel" name="monitorProfileDraftLabel" maxlength="256" placeholder="Room overview" [(ngModel)]="view.monitorProfileDraftLabel" />
            </label>
            <label>
              View Density
              <select id="monitorProfileDraftView" name="monitorProfileDraftView" [(ngModel)]="view.monitorProfileDraftView">
                <option *ngFor="let option of view.monitorProfileViewOptions" [value]="option">{{ option }}</option>
              </select>
            </label>
            <label>
              Block Column
              <select id="monitorProfileDraftBlockColumn" name="monitorProfileDraftBlockColumn" [(ngModel)]="view.monitorProfileDraftBlockColumn">
                <option *ngFor="let option of view.monitorProfileColumnOptions" [value]="option">{{ option }}</option>
              </select>
            </label>
            <label>
              Unit Column
              <select id="monitorProfileDraftUnitColumn" name="monitorProfileDraftUnitColumn" [(ngModel)]="view.monitorProfileDraftUnitColumn">
                <option *ngFor="let option of view.monitorProfileColumnOptions" [value]="option">{{ option }}</option>
              </select>
            </label>
            <label>
              Group Column
              <select id="monitorProfileDraftGroupColumn" name="monitorProfileDraftGroupColumn" [(ngModel)]="view.monitorProfileDraftGroupColumn">
                <option *ngFor="let option of view.monitorProfileColumnOptions" [value]="option">{{ option }}</option>
              </select>
            </label>
            <label>
              Booklet Column
              <select id="monitorProfileDraftBookletColumn" name="monitorProfileDraftBookletColumn" [(ngModel)]="view.monitorProfileDraftBookletColumn">
                <option *ngFor="let option of view.monitorProfileColumnOptions" [value]="option">{{ option }}</option>
              </select>
            </label>
            <label>
              Booklet State Columns
              <input id="monitorProfileDraftBookletStatesColumns" name="monitorProfileDraftBookletStatesColumns" placeholder="stateA,stateB" [(ngModel)]="view.monitorProfileDraftBookletStatesColumns" />
            </label>
            <label>
              Auto-select Next Block
              <select id="monitorProfileDraftAutoselectNextBlock" name="monitorProfileDraftAutoselectNextBlock" [(ngModel)]="view.monitorProfileDraftAutoselectNextBlock">
                <option value="yes">yes</option>
                <option value="no">no</option>
              </select>
            </label>
            <label>
              Hide Pending Runs
              <select id="monitorProfileDraftPending" name="monitorProfileDraftPending" [(ngModel)]="view.monitorProfileDraftPending">
                <option value="no">no</option>
                <option value="yes">yes</option>
              </select>
            </label>
            <label>
              Hide Locked Runs
              <select id="monitorProfileDraftLocked" name="monitorProfileDraftLocked" [(ngModel)]="view.monitorProfileDraftLocked">
                <option value="no">no</option>
                <option value="yes">yes</option>
              </select>
            </label>
          </div>

          <div class="action-groups">
            <section class="action-group">
              <span>Add run exclusion filter</span>
              <div class="form-grid">
                <label>
                  Target
                  <select id="monitorFilterDraftTarget" name="monitorFilterDraftTarget" [(ngModel)]="view.monitorFilterDraftTarget">
                    <option *ngFor="let option of view.monitorProfileFilterTargetOptions" [value]="option">{{ option }}</option>
                  </select>
                </label>
                <label *ngIf="view.monitorFilterDraftTarget !== 'state'">
                  Comparison
                  <select id="monitorFilterDraftType" name="monitorFilterDraftType" [(ngModel)]="view.monitorFilterDraftType">
                    <option *ngFor="let option of view.monitorProfileFilterTypeOptions" [value]="option">{{ option }}</option>
                  </select>
                </label>
                <label *ngIf="view.monitorFilterDraftTarget !== 'state'">
                  Value
                  <input id="monitorFilterDraftValue" name="monitorFilterDraftValue" placeholder="group:room-a" [(ngModel)]="view.monitorFilterDraftValue" />
                </label>
                <label *ngIf="view.monitorFilterDraftTarget !== 'state'">
                  Sub-value
                  <input id="monitorFilterDraftSubValue" name="monitorFilterDraftSubValue" placeholder="Optional expected value" [(ngModel)]="view.monitorFilterDraftSubValue" />
                </label>
                <label *ngIf="view.monitorFilterDraftTarget === 'state'">
                  Super States
                  <select id="monitorFilterDraftStates" name="monitorFilterDraftStates" multiple size="7" [(ngModel)]="view.monitorFilterDraftStates">
                    <option *ngFor="let option of view.monitorProfileSuperStateOptions" [value]="option">{{ option }}</option>
                  </select>
                </label>
                <label>
                  Filter Label
                  <input id="monitorFilterDraftLabel" name="monitorFilterDraftLabel" placeholder="Hide another room" [(ngModel)]="view.monitorFilterDraftLabel" />
                </label>
                <label class="inline-check">
                  <input id="monitorFilterDraftNot" name="monitorFilterDraftNot" type="checkbox" [(ngModel)]="view.monitorFilterDraftNot" />
                  Invert match
                </label>
              </div>
              <div class="actions">
                <button id="addMonitorProfileFilterButton" class="secondary" type="button" [disabled]="!view.canAddMonitorProfileFilter" (click)="view.addMonitorProfileDraftFilter()">Add Filter</button>
              </div>
            </section>
          </div>

          <div class="actions">
            <button id="saveMonitorProfileButton" class="primary" type="button" [disabled]="!view.canSaveMonitorProfile" (click)="view.saveMonitorProfile()">Save Profile</button>
            <button id="newMonitorProfileButton" class="ghost" type="button" (click)="view.startNewMonitorProfile()">New Profile</button>
          </div>
        </article>

        <app-record-collection
          title="Profile Draft Filters"
          subtitle="Exclusion filters currently attached to the profile draft."
          [items]="view.monitorProfileDraftFilterItems"
          (itemAction)="view.removeMonitorProfileDraftFilter($event)"
          emptyState="No custom run filters are attached to this profile."
        ></app-record-collection>

        <app-record-collection
          title="Monitor Profile Library"
          [subtitle]="view.monitorProfileEditorTarget === 'create' ? 'Profiles for the new monitor account.' : 'Profiles persisted with the selected monitor role scope.'"
          [items]="view.monitorProfileEditorItems"
          (itemAction)="view.handleMonitorProfileAction($event)"
          emptyState="No profiles have been authored for this destination."
        ></app-record-collection>
      </ng-container>

      <article class="card">
        <h2>Admin User Filters</h2>
        <p>Narrow the protected admin directory by username, account status, current access state, password handoff, role, scope, or a bounded result limit.</p>
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
            Current Access
            <select id="adminUserAccessStatusFilter" name="adminUserAccessStatusFilter" [(ngModel)]="view.ops.adminUserAccessStatusFilter" (change)="view.persistState()">
              <option value="">All access states</option>
              <option *ngFor="let status of view.adminAccessStatusOptions" [ngValue]="status">{{ status }}</option>
            </select>
          </label>
          <label>
            Password Handoff
            <select id="adminUserPasswordChangeFilter" name="adminUserPasswordChangeFilter" [(ngModel)]="view.ops.adminUserPasswordChangeFilter" (change)="view.persistState()">
              <option value="">All handoff states</option>
              <option value="true">Required</option>
              <option value="false">Complete</option>
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
        subtitle="Scoped admin directory with password-handoff state, public user fields, and delegable role scopes."
        [items]="view.adminUserItems"
        (itemAction)="view.selectAdminUser($event)"
        emptyState="Sign in with an administrative delegation role, then refresh admin users."
      ></app-record-collection>

      <article id="adminWorkspaceAccessMatrixCard" class="card">
        <div class="section-heading">
          <div>
            <span class="eyebrow">Original Superadmin parity</span>
            <h2>Admin Workspace Access Matrix</h2>
          </div>
          <span class="status-pill">RO / RW</span>
        </div>
        <p>Select an account from Admin Users, then review that administrator across every visible workspace in one tenant. Inherited platform or tenant access is explicit; direct workspace access can be granted, changed, or revoked through the existing delegation boundary.</p>
        <div class="form-grid">
          <label>
            Tenant Key
            <input id="adminWorkspaceMatrixTenantKey" name="adminWorkspaceMatrixTenantKey" [(ngModel)]="view.workspace.tenantKey" (change)="view.persistState()" />
          </label>
          <label>
            Selected Admin User ID
            <input id="adminWorkspaceMatrixUserId" name="adminWorkspaceMatrixUserId" readonly [value]="view.ops.adminRoleTargetUserId" />
          </label>
        </div>
        <div class="actions">
          <button id="refreshAdminWorkspaceAccessMatrixButton" class="primary" type="button" [disabled]="!view.canRefreshAdminWorkspaceAccessMatrix" (click)="view.refreshAdminWorkspaceAccessMatrix()">Refresh Access Matrix</button>
        </div>
      </article>

      <app-record-collection
        title="Admin Workspace Access"
        subtitle="Administrator-centred workspace access with effective inherited and direct RO/RW roles."
        [items]="view.adminWorkspaceAccessMatrixItems"
        (itemAction)="view.runAdminWorkspaceAccessAction($event)"
        emptyState="Select an admin user, enter a tenant key, then refresh the access matrix."
      ></app-record-collection>

      <article id="workspaceAdminAccessMatrixCard" class="card">
        <div class="section-heading">
          <div>
            <span class="eyebrow">Original Superadmin parity</span>
            <h2>Workspace Admin Access Matrix</h2>
          </div>
          <span class="status-pill">RO / RW</span>
        </div>
        <p>Review every visible account against one workspace. Platform and tenant access is shown as inherited; direct workspace roles can be granted, changed, or revoked through the existing server delegation boundary.</p>
        <div class="form-grid">
          <label>
            Tenant Key
            <input id="workspaceAdminMatrixTenantKey" name="workspaceAdminMatrixTenantKey" [(ngModel)]="view.workspace.tenantKey" (change)="view.persistState()" />
          </label>
          <label>
            Workspace Key
            <input id="workspaceAdminMatrixWorkspaceKey" name="workspaceAdminMatrixWorkspaceKey" [(ngModel)]="view.workspace.workspaceKey" (change)="view.persistState()" />
          </label>
        </div>
        <div class="actions">
          <button id="refreshWorkspaceAdminAccessMatrixButton" class="primary" type="button" [disabled]="!view.canRefreshWorkspaceAdminAccessMatrix" (click)="view.refreshWorkspaceAdminAccessMatrix()">Refresh Access Matrix</button>
        </div>
      </article>

      <app-record-collection
        title="Workspace Admin Access"
        subtitle="Workspace-centred administrator access with effective inherited and direct RO/RW roles."
        [items]="view.workspaceAdminAccessMatrixItems"
        (itemAction)="view.runWorkspaceAdminAccessAction($event)"
        emptyState="Enter a tenant and workspace key, then refresh the access matrix."
      ></app-record-collection>

      <article id="adminUserBatchStatusCard" class="card">
        <div class="section-heading">
          <div>
            <span class="eyebrow">Bulk account management</span>
            <h2>Selected Account Status</h2>
          </div>
          <span class="status-pill">{{ view.adminUserBatchCount }}/50 selected</span>
        </div>
        <p>Select accounts from the scoped directory, review the exact IDs below, then apply one status. The signed-in account cannot be selected and every update is independently re-authorized by the server.</p>
        <div class="form-grid">
          <label>
            Batch Target Status
            <select id="adminBatchStatusValue" name="adminBatchStatusValue" [(ngModel)]="view.ops.adminStatusValue" (change)="view.persistState()">
              <option *ngFor="let status of view.adminStatusOptions" [ngValue]="status">{{ status }}</option>
            </select>
          </label>
        </div>
        <div class="actions">
          <button id="adminBatchStatusButton" class="danger" type="button" [disabled]="!view.canUpdateAdminUserBatchStatus" (click)="view.confirmUpdateAdminUserBatchStatus()">Update Selected Accounts</button>
          <button id="adminBatchDeleteButton" class="danger" type="button" [disabled]="!view.canDeleteAdminUserBatch" (click)="view.confirmDeleteAdminUserBatch()">Permanently Delete Selected Accounts</button>
          <button id="clearAdminBatchSelectionButton" class="ghost" type="button" [disabled]="view.adminUserBatchCount === 0 && !view.adminUserStatusBatchResult && !view.adminUserRoleBatchResult && !view.adminUserPasswordBatchResult && !view.adminUserDeletionBatchResult" (click)="view.clearAdminUserBatchSelection()">Clear Batch</button>
        </div>
      </article>

      <article id="adminUserBatchRoleCard" class="card">
        <div class="section-heading">
          <div>
            <span class="eyebrow">Bulk role management</span>
            <h2>Selected Account Role</h2>
          </div>
          <span class="status-pill">{{ view.adminUserBatchCount }}/50 selected</span>
        </div>
        <p>Apply the role and scope configured in Admin User Management to the exact selected accounts. Existing identical assignments remain unchanged; each target is independently re-authorized and failed accounts stay selected for retry.</p>
        <div class="actions">
          <button id="adminBatchAssignRoleButton" class="danger" type="button" [disabled]="!view.canAssignAdminUserBatchRole" (click)="view.confirmAssignAdminUserBatchRole()">Assign Role To Selected Accounts</button>
        </div>
      </article>

      <article id="adminUserBatchPasswordCard" class="card">
        <div class="section-heading">
          <div>
            <span class="eyebrow">Bulk password handoff</span>
            <h2>Selected Account Passwords</h2>
          </div>
          <span class="status-pill">{{ view.adminUserBatchCount }}/50 selected</span>
        </div>
        <p>Generate a different 24-character password for every selected account and apply each reset through the existing server delegation boundary. Successful credentials remain only in memory until they are downloaded or the batch is cleared; active sessions are not revoked.</p>
        <div class="actions">
          <button id="adminBatchResetPasswordsButton" class="danger" type="button" [disabled]="!view.canResetAdminUserBatchPasswords" (click)="view.confirmResetAdminUserBatchPasswords()">Generate Passwords For Selected Accounts</button>
          <button id="downloadAdminBatchPasswordsButton" class="secondary" type="button" [disabled]="!view.canDownloadAdminUserBatchPasswords" (click)="view.downloadAndClearAdminUserBatchPasswords()">Download Credentials CSV &amp; Clear</button>
        </div>
      </article>

      <app-record-collection
        title="Selected Admin Accounts"
        subtitle="Exact best-effort batch preview, password handoff, and the most recent per-account result."
        [items]="view.adminUserBatchPreviewItems"
        (itemAction)="view.selectAdminUser($event)"
        emptyState="No admin accounts are selected for a batch action."
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
        subtitle="Persistent scope-filtered trail for admin sign-ins, user management, and role changes."
        [items]="view.adminAuditItems"
        (itemAction)="view.selectAdminAuditEvent($event)"
        emptyState="Sign in with an administrative delegation role, then refresh visible admin audit events."
      ></app-record-collection>

      <article class="card">
        <h2>Admin Audit CSV Export</h2>
        <p>Preview the filtered audit trail as CSV for platform handoff, incident review, or external archiving.</p>
        <pre id="adminAuditExportPreview">{{ view.ops.adminAuditExportView }}</pre>
      </article>
      </ng-container>
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
      </ng-container>
    </div>
  `
})
export class OpsViewComponent implements OnInit {
  readonly view = inject(OpsViewFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  activeAdminSection: AdministrationSection = "users";

  ngOnInit(): void {
    this.view.init();
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        this.activeAdminSection =
          params.get("adminSection") === "settings" ? "settings" : "users";
      });
    if (this.route.snapshot.queryParamMap.get("demoAdmin") === "sign-in") {
      void this.signInLocalDemoAdmin();
    }
  }

  async signInAdmin(): Promise<void> {
    await this.view.signInAdmin();
    await this.continueToRequestedView();
  }

  async bootstrapOrSignInAdmin(): Promise<void> {
    await this.view.bootstrapOrSignInAdmin();
    await this.continueToRequestedView();
  }

  private async signInLocalDemoAdmin(): Promise<void> {
    await this.view.signInLocalDemoAdmin();
    if (await this.continueToRequestedView()) {
      return;
    }
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { demoAdmin: null },
      queryParamsHandling: "merge",
      replaceUrl: true
    });
  }

  private async continueToRequestedView(): Promise<boolean> {
    if (!this.view.canUseAdminSession) {
      return false;
    }
    const returnUrl = this.route.snapshot.queryParamMap.get("returnUrl")?.trim();
    if (!returnUrl || !returnUrl.startsWith("/") || returnUrl.startsWith("//")) {
      return false;
    }
    await this.router.navigateByUrl(returnUrl, { replaceUrl: true });
    return true;
  }

  selectAdminSection(section: AdministrationSection): void {
    this.activeAdminSection = section;
    if (section === "settings") {
      this.view.refreshApplicationAssets();
    }
  }
}
