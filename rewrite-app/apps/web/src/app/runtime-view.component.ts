import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import type { OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { JsonPanelComponent } from "./json-panel.component";
import { AttachmentManagerComponent } from "./attachment-manager.component";
import { RecordCollectionComponent } from "./record-collection.component";
import { RuntimeViewFacade } from "./runtime-view.facade";
import { SummaryCardsComponent } from "./summary-cards.component";

@Component({
  selector: "app-runtime-view",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    JsonPanelComponent,
    AttachmentManagerComponent,
    SummaryCardsComponent,
    RecordCollectionComponent
  ],
  template: `
    <div class="stack">
      <article id="monitorConnectionCard" class="card">
        <div class="section-heading">
          <div>
            <span class="eyebrow">Near-real-time monitor</span>
            <h2>Live Connection</h2>
          </div>
          <span
            id="monitorConnectionStatus"
            class="status-pill"
            [attr.data-status]="view.runtime.monitorConnectionStatus"
          >{{ view.monitorConnectionLabel }}</span>
        </div>
        <p id="monitorConnectionDetail">{{ view.runtime.monitorConnectionDetail }}</p>
        <div class="form-grid">
          <div>
            <strong>Open runs</strong>
            <p id="monitorConnectionOpenRunCount">{{ view.runtime.monitorConnectionOpenRunCount }}</p>
          </div>
          <div>
            <strong>Last event</strong>
            <p id="monitorConnectionLastEvent">{{ view.monitorConnectionLastEventLabel }}</p>
          </div>
        </div>
        <div class="actions">
          <button
            id="reconnectMonitorEventStreamButton"
            class="ghost"
            type="button"
            [disabled]="!view.canUseWorkspaceScope"
            (click)="view.reconnectMonitorEventStream()"
          >Reconnect Live Monitor</button>
        </div>
      </article>

      <article id="monitorOperatorConsole" class="card" *ngIf="view.isMonitorOnlySession">
        <div class="section-heading">
          <div>
            <span class="eyebrow">{{ view.monitorText("gm_controls", "Scoped operator console") }}</span>
            <h2 id="monitorCustomHeadline">{{ view.monitorText("gm_headline", view.operatorAccessLabel) }}</h2>
          </div>
          <span class="status-pill">Server-enforced scope</span>
        </div>
        <p>Choose the assigned study scope, refresh its live runs, then select a run below before issuing a command. Group monitors see only their assigned groups even if a broader filter is entered.</p>
        <div class="form-grid">
          <label>
            Tenant Key
            <input id="monitorTenantKey" name="monitorTenantKey" [(ngModel)]="view.workspace.tenantKey" />
          </label>
          <label>
            Workspace Key
            <input id="monitorWorkspaceKey" name="monitorWorkspaceKey" [(ngModel)]="view.workspace.workspaceKey" />
          </label>
          <label *ngIf="view.monitorProfiles.length > 0">
            Monitor Profile
            <select
              id="monitorProfile"
              name="monitorProfile"
              [ngModel]="view.activeMonitorProfileId"
              (ngModelChange)="view.selectMonitorProfile($event)"
            >
              <option *ngFor="let profile of view.monitorProfiles" [value]="profile.profileId">
                {{ profile.label || profile.profileId }}
              </option>
            </select>
          </label>
          <label>
            Selected Test Run
            <input id="monitorSelectedTestRunId" name="monitorSelectedTestRunId" readonly [value]="view.runtime.testRunId || 'Select an open run below'" />
          </label>
          <label *ngIf="view.monitorBlockNavigationTargets.length > 0; else monitorTargetUnitInput">
            {{ view.monitorText("gm_col_blockLabel", "Target Block") }}
            <select id="monitorTargetUnitKey" name="monitorTargetUnitKey" [(ngModel)]="view.runtime.monitorTargetUnitKey" (change)="view.persistState()">
              <option value="">Choose a block</option>
              <option *ngFor="let target of view.monitorBlockNavigationTargets" [value]="target.targetUnitKey">
                {{ target.blockLabel }} ({{ target.blockKey }})
              </option>
            </select>
          </label>
          <ng-template #monitorTargetUnitInput>
            <label>
              Target Unit
              <input id="monitorTargetUnitKey" name="monitorTargetUnitKey" [(ngModel)]="view.runtime.monitorTargetUnitKey" (change)="view.persistState()" />
            </label>
          </ng-template>
          <label>
            Timer Seconds
            <input id="monitorConsoleTimeSeconds" name="monitorConsoleTimeSeconds" type="number" min="1" max="86400" step="1" [(ngModel)]="view.runtime.monitorTimeSeconds" (change)="view.persistState()" />
          </label>
        </div>
        <p id="monitorProfileDetail">{{ view.monitorProfileDetail }}</p>
        <div class="actions">
          <button id="monitorApplyScopeButton" class="primary" type="button" [disabled]="!view.canUseWorkspaceScope" (click)="view.applyMonitorScope()">Load Monitor Scope</button>
          <button id="monitorConsoleExportButton" class="ghost" type="button" [disabled]="!view.canUseWorkspaceScope" (click)="view.exportOpenRunsCsv()">Export Open Runs</button>
          <button id="monitorConsolePauseButton" class="ghost" type="button" [disabled]="!view.canUseMonitorRunActions" (click)="view.issueMonitorPause()">{{ view.monitorText("gm_control_pause", "Pause") }}</button>
          <button id="monitorConsoleResumeButton" class="ghost" type="button" [disabled]="!view.canUseMonitorRunActions" (click)="view.issueMonitorResume()">{{ view.monitorText("gm_control_resume", "Resume") }}</button>
          <button id="monitorConsoleGotoButton" class="ghost" type="button" [disabled]="!view.canIssueMonitorGoto" (click)="view.issueMonitorGoto()">{{ view.monitorText("gm_control_goto", "Go To Block") }}</button>
          <button id="monitorConsoleUnlockButton" class="ghost" type="button" [disabled]="!view.canUseMonitorRunActions" (click)="view.issueMonitorUnlockNavigation()">Unlock Navigation</button>
          <button id="monitorConsoleLockTestButton" class="ghost" type="button" [disabled]="!view.canUseMonitorRunActions" (click)="view.issueMonitorLockTest()">Lock Test</button>
          <button id="monitorConsoleUnlockTestButton" class="ghost" type="button" [disabled]="!view.canUseMonitorRunActions" (click)="view.issueMonitorUnlockTest()">{{ view.monitorText("gm_control_unlock", "Unlock Test") }}</button>
          <button id="monitorConsoleLockButton" class="ghost" type="button" [disabled]="!view.canUseMonitorRunActions" (click)="view.issueMonitorLockNavigation()">Lock Navigation</button>
          <button id="monitorConsoleSetTimeButton" class="ghost" type="button" [disabled]="!view.canSetMonitorTestletTime" (click)="view.issueMonitorSetTestletTime()">Set Testlet Time</button>
          <button id="monitorConsoleCompleteButton" class="danger" type="button" [disabled]="!view.canUseMonitorRunActions" (click)="view.issueMonitorComplete()">{{ view.monitorText("gm_control_finish_everything", "Complete") }}</button>
        </div>
      </article>

      <article id="monitorOverviewCard" class="card" *ngIf="view.isMonitorOnlySession">
        <div class="section-heading">
          <div>
            <span class="eyebrow">Scoped live dashboard</span>
            <h2>Test Overview</h2>
          </div>
          <span class="status-pill">Profile-aware</span>
        </div>
        <p id="monitorOverviewDetail">{{ view.monitorOverviewDetail }}</p>
        <app-summary-cards [cards]="view.monitorOverviewCards"></app-summary-cards>
      </article>

      <app-attachment-manager
        *ngIf="view.canUseAttachmentManager"
        [sessionToken]="view.attachmentSessionToken"
        [tenantKey]="view.workspace.tenantKey"
        [workspaceKey]="view.workspace.workspaceKey"
        [readOnly]="view.attachmentManagerReadOnly"
      ></app-attachment-manager>

      <app-record-collection
        *ngIf="view.isMonitorOnlySession"
        title="Groups In Scope"
        subtitle="Visible live runs grouped after server authorization, request filters, and the active monitor profile."
        [items]="view.monitorGroupOverviewItems"
        (itemAction)="view.filterMonitorOverviewGroup($event)"
        emptyState="No groups currently have a visible open run."
      ></app-record-collection>

      <ng-container *ngIf="!view.isMonitorOnlySession">

      <article class="card">
        <h2>Participant Runtime</h2>
        <div class="form-grid">
          <label>
            Login Key
            <input id="loginKey" name="loginKey" [(ngModel)]="view.runtime.loginKey" (change)="view.persistState()" />
          </label>
          <label>
            Participant Name
            <input id="participantDisplayName" name="participantDisplayName" readonly [value]="view.runtime.participantDisplayName || 'No saved roster name'" />
          </label>
          <label>
            Password
            <input id="runtimeParticipantPassword" name="runtimeParticipantPassword" type="password" autocomplete="current-password" [(ngModel)]="view.runtime.participantPassword" (change)="view.persistState()" />
          </label>
          <label>
            Participant Code
            <input id="runtimeParticipantCode" name="runtimeParticipantCode" autocomplete="one-time-code" [(ngModel)]="view.runtime.participantCode" />
          </label>
          <label>
            Group Key
            <input id="groupKey" name="groupKey" [(ngModel)]="view.runtime.groupKey" (change)="view.persistState()" />
          </label>
          <label>
            Booklet Key
            <input id="bookletKey" name="bookletKey" [(ngModel)]="view.runtime.bookletKey" (change)="view.persistState()" />
          </label>
          <label>
            Session Id
            <input id="participantSessionId" name="participantSessionId" placeholder="Filled from sign-in" [(ngModel)]="view.runtime.participantSessionId" (change)="view.persistState()" />
          </label>
          <label>
            Test Run Id
            <input id="testRunId" name="testRunId" placeholder="Filled from runtime actions" [(ngModel)]="view.runtime.testRunId" (change)="view.persistState()" />
          </label>
          <label>
            Current Unit Key
            <input id="currentUnitKey" name="currentUnitKey" [(ngModel)]="view.runtime.currentUnitKey" (change)="view.persistState()" />
          </label>
          <label>
            Monitor Target Unit
            <input id="monitorTargetUnitKey" name="monitorTargetUnitKey" [(ngModel)]="view.runtime.monitorTargetUnitKey" (change)="view.persistState()" />
          </label>
          <label>
            Monitor Timer Seconds
            <input id="monitorTimeSeconds" name="monitorTimeSeconds" type="number" min="1" max="86400" step="1" [(ngModel)]="view.runtime.monitorTimeSeconds" (change)="view.persistState()" />
          </label>
          <label>
            Review Id
            <input id="reviewId" name="reviewId" placeholder="Filled after creating or selecting a review" [(ngModel)]="view.runtime.reviewId" (change)="view.persistState()" />
          </label>
          <label>
            Reviewer Id
            <input id="reviewerId" name="reviewerId" [(ngModel)]="view.runtime.reviewerId" (change)="view.persistState()" />
          </label>
          <label>
            Review Category
            <input id="reviewCategory" name="reviewCategory" [(ngModel)]="view.runtime.reviewCategory" (change)="view.persistState()" />
          </label>
        </div>
        <label>
          Review Comment
          <textarea id="reviewComment" name="reviewComment" [(ngModel)]="view.runtime.reviewComment" (change)="view.persistState()" placeholder="Operator note for the selected run or unit."></textarea>
        </label>
        <div class="action-groups" aria-label="Participant runtime operator actions">
          <section class="action-group">
            <span>Participant Setup</span>
            <div class="actions">
              <button id="runtimeParticipantSignInButton" class="primary" type="button" [disabled]="!view.canUseParticipantLoginActions" (click)="view.participantSignIn()">Sign In</button>
              <button id="runtimeParticipantLaunchButton" class="primary" type="button" [disabled]="!view.canUseParticipantLoginActions" (click)="view.participantLaunch()">Start Participant</button>
              <button id="runtimeResumeSessionButton" class="secondary" type="button" [disabled]="!view.canResumeParticipantSession" (click)="view.resumeSession()">Resume Session</button>
              <button id="runtimeRefreshRuntimeReadsButton" class="ghost" type="button" [disabled]="!view.canUseWorkspaceScope" (click)="view.refreshRuntimeReads()">Refresh Runtime Reads</button>
            </div>
          </section>
          <section class="action-group">
            <span>Run Lifecycle</span>
            <div class="actions">
              <button class="ghost" type="button" [disabled]="!view.canSaveProgressActions" (click)="view.saveProgressPaused()">Save Paused</button>
              <button class="ghost" type="button" [disabled]="!view.canSaveProgressActions" (click)="view.saveProgressRunning()">Save Running</button>
              <button class="ghost" type="button" [disabled]="!view.canUseRunActions" (click)="view.resumeRun()">Resume Run</button>
              <button class="ghost" type="button" [disabled]="!view.canUseRunActions" (click)="view.completeRun()">Complete Run</button>
            </div>
          </section>
          <section class="action-group">
            <span>Monitor Control</span>
            <div class="actions">
              <button class="ghost" type="button" [disabled]="!view.canUseMonitorRunActions" (click)="view.issueMonitorPause()">Monitor Pause</button>
              <button class="ghost" type="button" [disabled]="!view.canUseMonitorRunActions" (click)="view.issueMonitorResume()">Monitor Resume</button>
              <button id="runtimeMonitorGotoButton" class="ghost" type="button" [disabled]="!view.canIssueMonitorGoto" (click)="view.issueMonitorGoto()">Monitor Go To Unit</button>
              <button id="runtimeMonitorLockTestButton" class="ghost" type="button" [disabled]="!view.canUseMonitorRunActions" (click)="view.issueMonitorLockTest()">Monitor Lock Test</button>
              <button id="runtimeMonitorUnlockTestButton" class="ghost" type="button" [disabled]="!view.canUseMonitorRunActions" (click)="view.issueMonitorUnlockTest()">Monitor Unlock Test</button>
              <button id="runtimeMonitorUnlockNavigationButton" class="ghost" type="button" [disabled]="!view.canUseMonitorRunActions" (click)="view.issueMonitorUnlockNavigation()">Monitor Unlock Navigation</button>
              <button id="runtimeMonitorLockNavigationButton" class="ghost" type="button" [disabled]="!view.canUseMonitorRunActions" (click)="view.issueMonitorLockNavigation()">Monitor Lock Navigation</button>
              <button id="runtimeMonitorSetTestletTimeButton" class="ghost" type="button" [disabled]="!view.canSetMonitorTestletTime" (click)="view.issueMonitorSetTestletTime()">Monitor Set Testlet Time</button>
              <button class="ghost" type="button" [disabled]="!view.canUseMonitorRunActions" (click)="view.issueMonitorComplete()">Monitor Complete</button>
              <button id="runtimeOpenRunsButton" class="ghost" type="button" [disabled]="!view.canUseWorkspaceScope" (click)="view.openRuns()">Monitor Open Runs</button>
              <button id="runtimeExportOpenRunsCsvButton" class="ghost" type="button" [disabled]="!view.canUseWorkspaceScope" (click)="view.exportOpenRunsCsv()">Export Open Runs CSV</button>
            </div>
          </section>
          <section class="action-group">
            <span>Review And Export</span>
            <div class="actions">
              <button id="runtimeLoadDetailedResponsesButton" class="ghost" type="button" [disabled]="!view.canUseWorkspaceScope" (click)="view.loadDetailedResponses()">Detailed Responses</button>
              <button id="runtimeLoadGroupResultsButton" class="ghost" type="button" [disabled]="!view.canUseWorkspaceScope" (click)="view.loadGroupResults()">Load Result Groups</button>
              <button class="ghost" type="button" [disabled]="!view.canCreateReviewAction" (click)="view.createReview()">Create Review</button>
              <button class="ghost" type="button" [disabled]="!view.canUseSelectedReviewActions" (click)="view.updateReview()">Update Review</button>
              <button class="ghost" type="button" [disabled]="!view.canUseSelectedReviewActions" (click)="view.confirmDeleteReview()">Delete Review</button>
              <button id="runtimeLoadReviewsButton" class="ghost" type="button" [disabled]="!view.canUseWorkspaceScope" (click)="view.loadReviews()">Load Reviews</button>
              <button class="ghost" type="button" [disabled]="!view.canDeleteGroupResultsAction" (click)="view.confirmDeleteGroupResults()">Delete Group Results</button>
              <button id="runtimeExportResponsesCsvButton" class="ghost" type="button" [disabled]="!view.canUseWorkspaceScope" (click)="view.exportResponsesCsv()">Export Responses CSV</button>
              <button id="runtimeExportReviewsCsvButton" class="ghost" type="button" [disabled]="!view.canUseWorkspaceScope" (click)="view.exportReviewsCsv()">Export Review CSV</button>
            </div>
          </section>
        </div>
      </article>

      <article class="card">
        <h2>Runtime Snapshot</h2>
        <p>See the current participant state at a glance before diving into the detailed runtime payloads.</p>
        <app-summary-cards [cards]="view.runtimeCards"></app-summary-cards>
      </article>

      <article class="card" id="participantPlayerPreview">
        <h2>Participant Player Preview</h2>
        <p>A minimal participant-facing view of the selected run, sourced from the current-state read model.</p>
        <div class="record-card" [class.is-selected]="view.playerPreview.hasRun">
          <header>
            <div>
              <h3 id="playerPreviewUnit">{{ view.playerPreview.unitLabel }}</h3>
              <span id="playerPreviewBooklet">{{ view.playerPreview.bookletLabel }}</span>
            </div>
            <span id="playerPreviewStatus">{{ view.playerPreview.runStatus }}</span>
          </header>
          <dl>
            <div>
              <dt>Unit Key</dt>
              <dd id="playerPreviewUnitKey">{{ view.playerPreview.unitKey }}</dd>
            </div>
            <div>
              <dt>Run</dt>
              <dd id="playerPreviewRunId">{{ view.playerPreview.runId }}</dd>
            </div>
            <div>
              <dt>Available Actions</dt>
              <dd id="playerPreviewActions">{{ view.playerPreview.availableActions.join(", ") || "none" }}</dd>
            </div>
            <div>
              <dt>Current Response</dt>
              <dd id="playerPreviewUnitResponseText">{{ view.playerPreview.unitResponse || "empty" }}</dd>
            </div>
          </dl>
          <label>
            Current Unit Response
            <textarea
              id="runtimeUnitResponse"
              name="runtimeUnitResponse"
              [disabled]="!view.playerPreview.canSaveProgress"
              [(ngModel)]="view.runtime.currentUnitResponse"
              (change)="view.persistState()"
              placeholder="Write or inspect the response saved for this unit."
            ></textarea>
          </label>
          <p>{{ view.playerPreview.hint }}</p>
          <div class="actions">
            <button class="secondary" type="button" [disabled]="!view.playerPreview.canSaveProgress" (click)="view.saveProgressFromPreview()">Preview {{ view.playerPreview.saveProgressLabel }}</button>
            <button class="ghost" type="button" [disabled]="!view.playerPreview.canResume" (click)="view.resumeRun()">Resume</button>
            <button class="ghost" type="button" [disabled]="!view.playerPreview.canComplete" (click)="view.completeRun()">Complete</button>
          </div>
        </div>
      </article>

      <app-record-collection
        title="Runtime Action Queue"
        subtitle="Suggested next actions derived from the selected session, current run, and monitor blockers."
        [items]="view.runtimeActionItems"
        (itemAction)="view.runRuntimeSuggestion($event)"
        emptyState="Refresh runtime reads to derive the next action."
      ></app-record-collection>

      <article class="card">
        <h2>Guided Flow</h2>
        <p>Drive the participant happy path end to end from sign-in to live runtime state.</p>
        <div class="actions">
          <button id="participantHappyPathButton" class="primary" type="button" [disabled]="!view.canUseParticipantLoginActions" (click)="view.participantHappyPathFlow()">Participant Happy Path</button>
          <button id="runtimeParticipantSessionDetailButton" class="ghost" type="button" [disabled]="!view.canUseParticipantSessionActions" (click)="view.getParticipantSessionDetail()">Participant Session Detail</button>
        </div>
      </article>

      <article class="card">
        <h2>Participant Session Filters</h2>
        <p>Narrow the operator session list by status, group, login, booklet, release, or a small result limit.</p>
        <div class="form-grid">
          <label>
            Status
            <select
              id="participantSessionStatusFilter"
              name="participantSessionStatusFilter"
              [(ngModel)]="view.runtime.participantSessionStatusFilter"
              (change)="view.persistState()"
            >
              <option value="">All statuses</option>
              <option *ngFor="let status of view.participantSessionStatusOptions" [value]="status">{{ status }}</option>
            </select>
          </label>
          <label>
            Group Key
            <input
              id="participantSessionGroupFilter"
              name="participantSessionGroupFilter"
              [(ngModel)]="view.runtime.participantSessionGroupFilter"
              (change)="view.persistState()"
              placeholder="Optional group key"
            />
          </label>
          <label>
            Login Key
            <input
              id="participantSessionLoginFilter"
              name="participantSessionLoginFilter"
              [(ngModel)]="view.runtime.participantSessionLoginFilter"
              (change)="view.persistState()"
              placeholder="Optional login key"
            />
          </label>
          <label>
            Booklet Key
            <input
              id="participantSessionBookletFilter"
              name="participantSessionBookletFilter"
              [(ngModel)]="view.runtime.participantSessionBookletFilter"
              (change)="view.persistState()"
              placeholder="Optional booklet key"
            />
          </label>
          <label>
            Content Release Id
            <input
              id="participantSessionReleaseFilter"
              name="participantSessionReleaseFilter"
              [(ngModel)]="view.runtime.participantSessionReleaseFilter"
              (change)="view.persistState()"
              placeholder="Optional release id"
            />
          </label>
          <label>
            Limit
            <input
              id="participantSessionLimit"
              name="participantSessionLimit"
              type="number"
              min="1"
              max="500"
              step="1"
              [(ngModel)]="view.runtime.participantSessionLimit"
              (change)="view.persistState()"
            />
          </label>
        </div>
        <div class="actions">
          <button id="refreshParticipantSessionsButton" class="primary" type="button" [disabled]="!view.canUseWorkspaceScope" (click)="view.refreshParticipantSessions()">Refresh Sessions</button>
          <button id="exportParticipantSessionsCsvButton" class="ghost" type="button" [disabled]="!view.canUseWorkspaceScope" (click)="view.exportParticipantSessionsCsv()">Export Sessions CSV</button>
          <button class="ghost" type="button" (click)="view.clearParticipantSessionFilters()">Clear Filters</button>
        </div>
      </article>

      <app-record-collection
        title="Participant Sessions"
        subtitle="Known sessions, their latest run state, and release context, narrowed by the current filters."
        [items]="view.participantSessionItems"
        (itemAction)="view.selectParticipantSession($event)"
        emptyState="No participant sessions loaded yet."
      ></app-record-collection>

      <app-record-collection
        title="Selected Participant Session"
        subtitle="The active session with its release and group context."
        [items]="view.participantSessionDetailItems"
        (itemAction)="view.selectParticipantSession($event)"
        emptyState="Load a participant session detail to inspect it here."
      ></app-record-collection>

      <app-record-collection
        title="Participant Run History"
        subtitle="Runs that belong to the selected participant session."
        [items]="view.participantRunHistoryItems"
        (itemAction)="view.selectTestRun($event)"
        emptyState="No session run history loaded yet."
      ></app-record-collection>

      <article class="card" id="participantLaunchpad">
        <h2>Participant Launchpad</h2>
        <p>Prepare participant handoff from one place: saved roster, generated entry links, started sessions, and the CSV that can be distributed.</p>
        <app-summary-cards [cards]="view.participantLaunchpadCards"></app-summary-cards>
      </article>

      <app-record-collection
        title="Participant Launchpad Actions"
        subtitle="Suggested next steps for handing out links and checking whether participants have started."
        [items]="view.participantLaunchpadActionItems"
        (itemAction)="view.runParticipantLaunchpadSuggestion($event)"
        emptyState="Launchpad actions appear after roster or session data is loaded."
      ></app-record-collection>

      <app-record-collection
        title="Participant Launch Status"
        subtitle="Generated links joined with loaded participant sessions so operators can spot missing starts."
        [items]="view.participantLaunchStatusItems"
        (itemAction)="view.selectParticipantLaunchStatus($event)"
        emptyState="Generate entry links and refresh participant sessions to inspect launch status."
      ></app-record-collection>

      <article class="card">
        <h2>Participant Entry Links</h2>
        <p>Import participant rows into the workspace roster, then generate start links from saved entries. CSV/TSV/semicolon rows can use headers such as login, group, booklet, name or the canonical loginKey, groupKey, bookletKey, displayName columns; positional rows, Testtaker/Participant-style XML, and JSON roster structures are accepted too.</p>
        <label>
          Load Roster File
          <input
            id="entryRosterFile"
            name="entryRosterFile"
            type="file"
            accept=".csv,.tsv,.txt,.xml,.json,text/csv,text/tab-separated-values,text/plain,application/xml,text/xml,application/json"
            (change)="view.loadEntryRosterFile($event)"
          />
        </label>
        <label>
          Roster Rows, XML, or JSON
          <textarea id="entryRosterText" name="entryRosterText" [(ngModel)]="view.runtime.entryRosterText" (change)="view.persistState()" placeholder="login,group,booklet,name&#10;student-a,group:demo-a,booklet:demo,Ada Demo&#10;&lt;Testtaker login=&quot;student-b&quot; group=&quot;group:demo-a&quot; booklet=&quot;booklet:demo&quot; name=&quot;Ben Demo&quot; /&gt;&#10;{&quot;groups&quot;:[{&quot;groupKey&quot;:&quot;group:demo-a&quot;,&quot;participants&quot;:[{&quot;loginKey&quot;:&quot;student-c&quot;,&quot;displayName&quot;:&quot;Cara Demo&quot;}]}]}"></textarea>
        </label>
        <app-record-collection
          title="Roster Input Preview"
          subtitle="Local parser result before importing or generating links."
          [items]="view.entryRosterPreviewItems"
          emptyState="Paste CSV/TSV/semicolon, XML, or JSON roster text to preview parsed participants."
        ></app-record-collection>
        <div class="actions">
          <button id="importParticipantRosterButton" class="primary" type="button" [disabled]="!view.canImportParticipantRoster" (click)="view.importParticipantRoster()">Import Saved Roster</button>
          <button id="loadParticipantRosterButton" class="secondary" type="button" [disabled]="!view.canUseWorkspaceScope" (click)="view.loadParticipantRoster()">Load Saved Roster</button>
          <button id="exportParticipantRosterCsvButton" class="secondary" type="button" [disabled]="!view.canUseWorkspaceScope" (click)="view.exportParticipantRosterCsv()">Export Saved Roster CSV</button>
          <button id="generateEntryLinksButton" class="primary" type="button" [disabled]="!view.canGenerateEntryLinks" (click)="view.generateEntryLinks()">Generate Entry Links</button>
          <button id="generateSavedRosterEntryLinksButton" class="secondary" type="button" [disabled]="!view.canGenerateSavedRosterEntryLinks" (click)="view.generateEntryLinksFromSavedRoster()">Generate From Saved Roster</button>
          <button id="downloadEntryLinksCsvButton" class="secondary" type="button" [disabled]="!view.canDownloadEntryLinksCsv" (click)="view.downloadEntryLinksCsv()">Download Entry Links CSV</button>
          <button id="useSelectedParticipantAsEntryRosterButton" class="ghost" type="button" [disabled]="!view.canUseWorkspaceScope" (click)="view.useSelectedParticipantAsEntryRoster()">Use Selected Participant</button>
        </div>
        <div class="entry-link-summary-grid" id="entryLinkSummary">
          <div *ngFor="let card of view.entryLinkCards">
            <span>{{ card.label }}</span>
            <strong>{{ card.headline }}</strong>
            <p>{{ card.detail }}</p>
          </div>
        </div>
        <pre id="entryLinksCsvPreview">{{ view.entryLinksCsvPreview }}</pre>
      </article>

      <app-record-collection
        title="Saved Participant Roster"
        subtitle="Persisted operator roster rows for the selected workspace."
        [items]="view.participantRosterItems"
        (itemAction)="view.selectEntryLink($event)"
        emptyState="Import or load participant roster rows to inspect saved entries."
      ></app-record-collection>

      <app-record-collection
        title="Operational Login Migration Candidates"
        subtitle="Password-redacted original Testtakers logins that need an explicit non-escalating role mapping."
        [items]="view.operationalLoginCandidateItems"
        (itemAction)="view.prepareOperationalLoginAccount($event)"
        emptyState="The latest roster import did not contain operational logins."
      ></app-record-collection>

      <app-record-collection
        title="Generated Entry Links"
        subtitle="Participant URLs scoped to the selected workspace and optional booklet."
        [items]="view.entryLinkItems"
        (itemAction)="view.selectEntryLink($event)"
        emptyState="Generate entry links from roster rows to inspect them here."
      ></app-record-collection>

      <app-record-collection
        title="Selected Session Reviews"
        subtitle="Review comments attached to the active participant session."
        [items]="view.selectedSessionReviewItems"
        (itemAction)="view.selectReview($event)"
        emptyState="No reviews attached to this participant session yet."
      ></app-record-collection>

      <app-record-collection
        title="Review Action Queue"
        subtitle="Suggested review actions derived from the selected session, run, unit, and review form."
        [items]="view.reviewActionItems"
        (itemAction)="view.runReviewSuggestion($event)"
        emptyState="Select a runtime run to derive review actions."
      ></app-record-collection>

      <app-record-collection
        title="Unit Responses"
        subtitle="Saved participant responses for the selected run."
        [items]="view.unitResponseItems"
        (itemAction)="view.selectTestRun($event)"
        emptyState="No unit responses saved for the selected run yet."
      ></app-record-collection>

      <app-record-collection
        title="Review Readiness"
        subtitle="Answered units and attached reviews for the selected participant run."
        [items]="view.reviewReadinessItems"
        (itemAction)="view.selectReviewReadinessItem($event)"
        emptyState="Select a participant run and load its current state to inspect review readiness."
      ></app-record-collection>

      <article class="card">
        <h2>Detailed Response Filters</h2>
        <p>Narrow response inspection and response CSV export by participant, booklet, run, unit, status, or limit.</p>
        <div class="form-grid">
          <label>
            Login Key
            <input id="detailedResponseLoginFilter" name="detailedResponseLoginFilter" [(ngModel)]="view.runtime.detailedResponseLoginFilter" (change)="view.persistState()" placeholder="Optional login key" />
          </label>
          <label>
            Group Key
            <input id="detailedResponseGroupFilter" name="detailedResponseGroupFilter" [(ngModel)]="view.runtime.detailedResponseGroupFilter" (change)="view.persistState()" placeholder="Optional group key" />
          </label>
          <label>
            Booklet Key
            <input id="detailedResponseBookletFilter" name="detailedResponseBookletFilter" [(ngModel)]="view.runtime.detailedResponseBookletFilter" (change)="view.persistState()" placeholder="Optional booklet key" />
          </label>
          <label>
            Session Id
            <input id="detailedResponseSessionFilter" name="detailedResponseSessionFilter" [(ngModel)]="view.runtime.detailedResponseSessionFilter" (change)="view.persistState()" placeholder="Optional session id" />
          </label>
          <label>
            Test Run Id
            <input id="detailedResponseRunFilter" name="detailedResponseRunFilter" [(ngModel)]="view.runtime.detailedResponseRunFilter" (change)="view.persistState()" placeholder="Optional run id" />
          </label>
          <label>
            Unit Key
            <input id="detailedResponseUnitFilter" name="detailedResponseUnitFilter" [(ngModel)]="view.runtime.detailedResponseUnitFilter" (change)="view.persistState()" placeholder="Optional unit key" />
          </label>
          <label>
            Status
            <select id="detailedResponseStatusFilter" name="detailedResponseStatusFilter" [(ngModel)]="view.runtime.detailedResponseStatusFilter" (change)="view.persistState()">
              <option value="">All statuses</option>
              <option *ngFor="let status of view.testRunStatusOptions" [value]="status">{{ status }}</option>
            </select>
          </label>
          <label>
            Limit
            <input id="detailedResponseLimit" name="detailedResponseLimit" type="number" min="1" max="500" step="1" [(ngModel)]="view.runtime.detailedResponseLimit" (change)="view.persistState()" />
          </label>
        </div>
        <div class="actions">
          <button id="applyDetailedResponseFiltersButton" class="primary" type="button" [disabled]="!view.canUseWorkspaceScope" (click)="view.applyDetailedResponseFilters()">Apply Response Filters</button>
          <button id="useSelectedRuntimeAsDetailedResponseFiltersButton" class="ghost" type="button" [disabled]="!view.canUseWorkspaceScope" (click)="view.useSelectedRuntimeAsDetailedResponseFilters()">Use Selected Run</button>
          <button class="ghost" type="button" (click)="view.clearDetailedResponseFilters()">Clear Response Filters</button>
        </div>
      </article>

      <article class="card" id="resultGroupSelectionActions">
        <h2>Result Group Selection</h2>
        <p>Select one or more result groups for an Original-compatible response, log, and review archive, individual CSV exports, or a confirmed bulk deletion.</p>
        <div class="selection-summary" role="status" aria-live="polite">
          {{ view.selectedResultGroupCount }} selected group{{ view.selectedResultGroupCount === 1 ? "" : "s" }}
        </div>
        <div class="actions">
          <button id="selectAllVisibleResultGroupsButton" class="ghost" type="button" [disabled]="view.groupResultItems.length === 0" (click)="view.selectAllVisibleResultGroups()">Select All Visible</button>
          <button id="clearResultGroupSelectionButton" class="ghost" type="button" [disabled]="view.selectedResultGroupCount === 0" (click)="view.clearResultGroupSelection()">Clear Selection</button>
          <button id="exportSelectedGroupResultArchiveButton" class="primary" type="button" [disabled]="!view.canUseSelectedResultGroups" (click)="view.exportSelectedGroupResultArchive()">Download Result Archive</button>
          <button id="exportSelectedGroupResponsesButton" class="ghost" type="button" [disabled]="!view.canUseSelectedResultGroups" (click)="view.exportSelectedGroupResponsesCsv()">Export Selected Responses</button>
          <button id="exportSelectedGroupLogsButton" class="ghost" type="button" [disabled]="!view.canUseSelectedResultGroups" (click)="view.exportSelectedGroupLogsCsv()">Export Selected Logs</button>
          <button id="exportSelectedGroupReviewsButton" class="ghost" type="button" [disabled]="!view.canUseSelectedResultGroups" (click)="view.exportSelectedGroupReviewsCsv()">Export Selected Reviews</button>
          <button id="deleteSelectedGroupResultsButton" class="danger" type="button" [disabled]="!view.canUseSelectedResultGroups" (click)="view.confirmDeleteSelectedGroupResults()">Delete Selected Results</button>
        </div>
      </article>

      <app-record-collection
        title="Result Groups"
        subtitle="Original-compatible group result inventory with started booklets, unit statistics, latest test activity, and multi-selection."
        [items]="view.groupResultItems"
        (itemAction)="view.selectResultGroup($event)"
        emptyState="Load result groups to inspect collected results by login group."
      ></app-record-collection>

      <app-record-collection
        title="Detailed Responses"
        subtitle="Workspace-wide response inspection with participant, run, unit, and status context."
        [items]="view.detailedResponseItems"
        (itemAction)="view.selectTestRun($event)"
        emptyState="Load detailed responses to inspect saved answers across the workspace."
      ></app-record-collection>

      <article class="card">
        <h2>Review Filters</h2>
        <p>Narrow review reads and review CSV export by participant, booklet, run, unit, reviewer, category, or limit.</p>
        <div class="form-grid">
          <label>
            Login Key
            <input id="reviewLoginFilter" name="reviewLoginFilter" [(ngModel)]="view.runtime.reviewLoginFilter" (change)="view.persistState()" placeholder="Optional login key" />
          </label>
          <label>
            Group Key
            <input id="reviewGroupFilter" name="reviewGroupFilter" [(ngModel)]="view.runtime.reviewGroupFilter" (change)="view.persistState()" placeholder="Optional group key" />
          </label>
          <label>
            Booklet Key
            <input id="reviewBookletFilter" name="reviewBookletFilter" [(ngModel)]="view.runtime.reviewBookletFilter" (change)="view.persistState()" placeholder="Optional booklet key" />
          </label>
          <label>
            Session Id
            <input id="reviewSessionFilter" name="reviewSessionFilter" [(ngModel)]="view.runtime.reviewSessionFilter" (change)="view.persistState()" placeholder="Optional session id" />
          </label>
          <label>
            Test Run Id
            <input id="reviewRunFilter" name="reviewRunFilter" [(ngModel)]="view.runtime.reviewRunFilter" (change)="view.persistState()" placeholder="Optional run id" />
          </label>
          <label>
            Unit Key
            <input id="reviewUnitFilter" name="reviewUnitFilter" [(ngModel)]="view.runtime.reviewUnitFilter" (change)="view.persistState()" placeholder="Optional unit key" />
          </label>
          <label>
            Reviewer Id
            <input id="reviewReviewerFilter" name="reviewReviewerFilter" [(ngModel)]="view.runtime.reviewReviewerFilter" (change)="view.persistState()" placeholder="Optional reviewer id" />
          </label>
          <label>
            Category
            <input id="reviewCategoryFilter" name="reviewCategoryFilter" [(ngModel)]="view.runtime.reviewCategoryFilter" (change)="view.persistState()" placeholder="Optional category" />
          </label>
          <label>
            Limit
            <input id="reviewLimit" name="reviewLimit" type="number" min="1" max="500" step="1" [(ngModel)]="view.runtime.reviewLimit" (change)="view.persistState()" />
          </label>
        </div>
        <div class="actions">
          <button id="applyReviewFiltersButton" class="primary" type="button" [disabled]="!view.canUseWorkspaceScope" (click)="view.applyReviewFilters()">Apply Review Filters</button>
          <button id="useSelectedRuntimeAsReviewFiltersButton" class="ghost" type="button" [disabled]="!view.canUseWorkspaceScope" (click)="view.useSelectedRuntimeAsReviewFilters()">Use Selected Review Scope</button>
          <button class="ghost" type="button" (click)="view.clearReviewFilters()">Clear Review Filters</button>
        </div>
      </article>

      <app-record-collection
        title="Reviews"
        subtitle="Operator review comments attached to participant test runs or units."
        [items]="view.reviewItems"
        (itemAction)="view.selectReview($event)"
        emptyState="Create or load reviews to inspect operator notes."
      ></app-record-collection>

      <article class="card">
        <h2>Participant Sessions CSV Export</h2>
        <p>Filtered participant session rows in CSV format with latest run, release, and roster context.</p>
        <pre id="participantSessionsExportPreview">{{ view.runtime.participantSessionsExportView }}</pre>
      </article>

      <article class="card">
        <h2>Open Runs CSV Export</h2>
        <p>Activation-blocking open test runs in CSV format with participant and roster context.</p>
        <pre id="openRunsExportPreview">{{ view.runtime.openRunsExportView }}</pre>
      </article>

      <article class="card">
        <h2>Response CSV Export</h2>
        <p>Workspace-wide participant responses in CSV format, ready for operator download or inspection.</p>
        <pre id="responseExportPreview">{{ view.runtime.responseExportView }}</pre>
      </article>

      <article class="card">
        <h2>Review CSV Export</h2>
        <p>Workspace-wide review comments in CSV format with participant and run context.</p>
        <pre id="reviewExportPreview">{{ view.runtime.reviewExportView }}</pre>
      </article>

      <article class="card">
        <h2>Participant Roster CSV Export</h2>
        <p>Saved participant roster rows in CSV format for operator handoff and entry-link audits.</p>
        <pre id="participantRosterExportPreview">{{ view.runtime.participantRosterExportView }}</pre>
      </article>

      <app-record-collection
        title="Runtime State Detail"
        subtitle="The current session-level runtime status and next action."
        [items]="view.runtimeStateItems"
        (itemAction)="view.selectParticipantSession($event)"
        emptyState="Refresh runtime reads to inspect the current runtime state."
      ></app-record-collection>

      <app-record-collection
        title="Current Run Detail"
        subtitle="The active booklet and unit for the selected test run."
        [items]="view.currentRunStateItems"
        (itemAction)="view.selectTestRun($event)"
        emptyState="No current run state loaded yet."
      ></app-record-collection>
      </ng-container>

      <article class="card">
        <h2>Open Run Filters</h2>
        <p>Filter open runs and CSV by status and booklet species.</p>
        <div class="form-grid">
          <label>
            Login Key
            <input id="openRunLoginFilter" name="openRunLoginFilter" [(ngModel)]="view.runtime.openRunLoginFilter" (change)="view.persistState()" placeholder="Optional login key" />
          </label>
          <label>
            Group Key
            <input id="openRunGroupFilter" name="openRunGroupFilter" [(ngModel)]="view.runtime.openRunGroupFilter" (change)="view.persistState()" placeholder="Optional group key" />
          </label>
          <label>
            Booklet Key
            <input id="openRunBookletFilter" name="openRunBookletFilter" [(ngModel)]="view.runtime.openRunBookletFilter" (change)="view.persistState()" placeholder="Optional booklet key" />
          </label>
          <label>
            Booklet Species
            <input id="openRunSpeciesFilter" name="openRunSpeciesFilter" [(ngModel)]="view.runtime.openRunSpeciesFilter" (change)="view.persistState()" placeholder="species: 2" />
          </label>
          <label>
            Session Id
            <input id="openRunSessionFilter" name="openRunSessionFilter" [(ngModel)]="view.runtime.openRunSessionFilter" (change)="view.persistState()" placeholder="Optional session id" />
          </label>
          <label>
            Test Run Id
            <input id="openRunRunFilter" name="openRunRunFilter" [(ngModel)]="view.runtime.openRunRunFilter" (change)="view.persistState()" placeholder="Optional run id" />
          </label>
          <label>
            Unit Key
            <input id="openRunUnitFilter" name="openRunUnitFilter" [(ngModel)]="view.runtime.openRunUnitFilter" (change)="view.persistState()" placeholder="Optional current unit" />
          </label>
          <label>
            Status
            <select id="openRunStatusFilter" name="openRunStatusFilter" [(ngModel)]="view.runtime.openRunStatusFilter" (change)="view.persistState()">
              <option value="">All statuses</option>
              <option *ngFor="let status of view.testRunStatusOptions" [value]="status">{{ status }}</option>
            </select>
          </label>
          <label>
            Limit
            <input id="openRunLimit" name="openRunLimit" type="number" min="1" max="500" step="1" [(ngModel)]="view.runtime.openRunLimit" (change)="view.persistState()" />
          </label>
        </div>
        <div class="actions">
          <button id="applyOpenRunFiltersButton" class="primary" type="button" [disabled]="!view.canUseWorkspaceScope" (click)="view.applyOpenRunFilters()">Apply Open Run Filters</button>
          <button id="useSelectedRuntimeAsOpenRunFiltersButton" class="ghost" type="button" [disabled]="!view.canUseWorkspaceScope" (click)="view.useSelectedRuntimeAsOpenRunFilters()">Use Selected Run</button>
          <button class="ghost" type="button" (click)="view.clearOpenRunFilters()">Clear Open Run Filters</button>
        </div>
      </article>

      <article class="card">
        <h2>Monitor Batch Command Preview</h2>
        <p>Select visible open runs, review the exact run ids, then confirm one command for the batch. Per-run failures remain selected for correction or retry.</p>
        <div class="record-collection-summary" role="status" aria-live="polite">
          {{ view.monitorBatchCount }} selected run{{ view.monitorBatchCount === 1 ? "" : "s" }}
        </div>
        <ul *ngIf="view.monitorBatchRunIds.length > 0">
          <li *ngFor="let testRunId of view.monitorBatchRunIds"><code>{{ testRunId }}</code></li>
        </ul>
        <div class="actions">
          <button id="selectAllVisibleMonitorRunsButton" class="ghost" type="button" [disabled]="!view.canUseWorkspaceScope" (click)="view.selectAllVisibleMonitorRuns()">Select All Visible</button>
          <button id="clearMonitorBatchSelectionButton" class="ghost" type="button" [disabled]="view.monitorBatchCount === 0" (click)="view.clearMonitorBatchSelection()">Clear Selection</button>
          <button id="monitorBatchPauseButton" class="ghost" type="button" [disabled]="!view.canIssueMonitorBatch" (click)="view.issueMonitorBatchCommand('pause')">Pause Selected</button>
          <button id="monitorBatchResumeButton" class="ghost" type="button" [disabled]="!view.canIssueMonitorBatch" (click)="view.issueMonitorBatchCommand('resume')">Resume Selected</button>
          <button id="monitorBatchGotoButton" class="ghost" type="button" [disabled]="!view.canIssueMonitorBatchGoto" (click)="view.issueMonitorBatchCommand('goto')">Go To Target Unit</button>
          <button id="monitorBatchUnlockButton" class="ghost" type="button" [disabled]="!view.canIssueMonitorBatch" (click)="view.issueMonitorBatchCommand('unlock_navigation')">Unlock Navigation</button>
          <button id="monitorBatchLockButton" class="ghost" type="button" [disabled]="!view.canIssueMonitorBatch" (click)="view.issueMonitorBatchCommand('lock_navigation')">Lock Navigation</button>
          <button id="monitorBatchLockTestButton" class="ghost" type="button" [disabled]="!view.canIssueMonitorBatch" (click)="view.issueMonitorBatchCommand('lock_test')">Lock Tests</button>
          <button id="monitorBatchUnlockTestButton" class="ghost" type="button" [disabled]="!view.canIssueMonitorBatch" (click)="view.issueMonitorBatchCommand('unlock_test')">Unlock Tests</button>
          <button id="monitorBatchSetTimeButton" class="ghost" type="button" [disabled]="!view.canIssueMonitorBatchTime" (click)="view.issueMonitorBatchCommand('set_testlet_time')">Set Time On Selected</button>
          <button id="monitorBatchCompleteButton" class="danger" type="button" [disabled]="!view.canIssueMonitorBatch" (click)="view.issueMonitorBatchCommand('complete')">Complete Selected</button>
        </div>
      </article>

      <app-record-collection
        title="Open Monitor Runs"
        subtitle="Runs that currently keep the activation guard active."
        [items]="view.openRunItems"
        [density]="view.monitorProfileDensity"
        (itemAction)="view.selectTestRun($event)"
        emptyState="No open runs are currently loaded."
      ></app-record-collection>

      <ng-container *ngIf="!view.isMonitorOnlySession">

      <article class="card">
        <h2>Monitor Command History Filters</h2>
        <p>Narrow persisted operator command acknowledgements by test run and result window.</p>
        <div class="form-grid">
          <label>
            Test Run Id
            <input id="monitorCommandHistoryRunFilter" name="monitorCommandHistoryRunFilter" [(ngModel)]="view.runtime.monitorCommandHistoryRunFilter" (change)="view.persistState()" placeholder="Optional run id" />
          </label>
          <label>
            Limit
            <input id="monitorCommandHistoryLimit" name="monitorCommandHistoryLimit" type="number" min="1" max="500" step="1" [(ngModel)]="view.runtime.monitorCommandHistoryLimit" (change)="view.persistState()" />
          </label>
        </div>
        <div class="actions">
          <button id="applyMonitorCommandHistoryFiltersButton" class="primary" type="button" [disabled]="!view.canUseWorkspaceScope" (click)="view.applyMonitorCommandHistoryFilters()">Apply Command Filters</button>
          <button id="useSelectedRuntimeAsMonitorCommandHistoryFilterButton" class="ghost" type="button" [disabled]="!view.canUseWorkspaceScope" (click)="view.useSelectedRuntimeAsMonitorCommandHistoryFilter()">Use Selected Run</button>
          <button class="ghost" type="button" (click)="view.clearMonitorCommandHistoryFilters()">Clear Command Filters</button>
        </div>
      </article>

      <app-record-collection
        title="Monitor Command History"
        subtitle="Persisted operator command acknowledgements for lifecycle and navigation control."
        [items]="view.monitorCommandHistoryItems"
        (itemAction)="view.selectTestRun($event)"
        emptyState="No monitor commands have been issued yet."
      ></app-record-collection>

      <app-json-panel title="Participant Sessions" subtitle="Operator Read" viewId="participantSessionsView" [content]="view.participantSessionsView"></app-json-panel>
      <app-json-panel title="Participant Sessions CSV Export" subtitle="Filtered Sessions" viewId="participantSessionsExportView" [content]="view.runtime.participantSessionsExportView"></app-json-panel>
      <app-json-panel title="Open Runs CSV Export" subtitle="Activation Guard Export" viewId="openRunsExportView" [content]="view.runtime.openRunsExportView"></app-json-panel>
      <app-json-panel title="Monitor Command History" subtitle="Workspace Activity Filter" viewId="monitorCommandHistoryView" [content]="view.runtime.monitorCommandHistoryView"></app-json-panel>
      <app-json-panel title="Participant Roster" subtitle="Saved Entry Rows" viewId="participantRosterView" [content]="view.runtime.participantRosterView"></app-json-panel>
      <app-json-panel title="Participant Roster CSV Export" subtitle="Saved Entry Rows" viewId="participantRosterExportView" [content]="view.runtime.participantRosterExportView"></app-json-panel>
      <app-json-panel title="Participant Session Detail" subtitle="Run History" viewId="participantSessionDetailView" [content]="view.runtime.participantSessionDetailView"></app-json-panel>
      <app-json-panel title="Runtime State" subtitle="Session Status" viewId="runtimeStateView" [content]="view.runtime.runtimeStateView"></app-json-panel>
      <app-json-panel title="Current Run State" subtitle="Booklet Context" viewId="currentRunStateView" [content]="view.runtime.currentRunStateView"></app-json-panel>
      <app-json-panel title="Monitor Open Runs" subtitle="Activation Guard Signal" viewId="openRunsView" [content]="view.runtime.openRunsView"></app-json-panel>
      <app-json-panel title="Detailed Responses" subtitle="Workspace Response Read Model" viewId="detailedResponsesView" [content]="view.runtime.detailedResponsesView"></app-json-panel>
      <app-json-panel title="Result Groups" subtitle="Workspace Result Inventory" viewId="groupResultsView" [content]="view.runtime.groupResultsView"></app-json-panel>
      <app-json-panel title="Reviews" subtitle="Workspace Review Read Model" viewId="reviewsView" [content]="view.runtime.reviewsView"></app-json-panel>
      <app-json-panel title="Response CSV Export" subtitle="Workspace Responses" viewId="responseExportView" [content]="view.runtime.responseExportView"></app-json-panel>
      <app-json-panel title="Review CSV Export" subtitle="Workspace Reviews" viewId="reviewExportView" [content]="view.runtime.reviewExportView"></app-json-panel>
      <app-json-panel title="Runtime And Monitor" subtitle="Live Session State" viewId="runtimeMonitorView" [content]="view.runtime.runtimeMonitorView"></app-json-panel>
      </ng-container>
      <app-json-panel *ngIf="view.isMonitorOnlySession" title="Scoped Open Runs" subtitle="Monitor Read Model" viewId="openRunsView" [content]="view.runtime.openRunsView"></app-json-panel>
    </div>
  `
})
export class RuntimeViewComponent implements OnInit {
  readonly view = inject(RuntimeViewFacade);

  ngOnInit(): void {
    this.view.init();
  }
}
