import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import type { OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { JsonPanelComponent } from "./json-panel.component";
import { RecordCollectionComponent } from "./record-collection.component";
import { SummaryCardsComponent } from "./summary-cards.component";
import { WorkspaceViewFacade } from "./workspace-view.facade";

@Component({
  selector: "app-workspace-view",
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
        <h2>Scope</h2>
        <p>Keep tenant and workspace context pinned while you work through the first vertical slice.</p>
        <div class="form-grid">
          <label>
            Tenant Key
            <input id="tenantKey" name="tenantKey" [(ngModel)]="view.workspace.tenantKey" (change)="view.persistState()" />
          </label>
          <label>
            Workspace Key
            <input id="workspaceKey" name="workspaceKey" [(ngModel)]="view.workspace.workspaceKey" (change)="view.persistState()" />
          </label>
          <label>
            Auto Refresh Active View
            <span class="inline-toggle">
              <input
                id="autoRefreshEnabled"
                name="autoRefreshEnabled"
                type="checkbox"
                [(ngModel)]="view.workspace.autoRefreshEnabled"
                (change)="view.onAutoRefreshSettingsChanged()"
              />
              Refresh workspace, content, runtime, and diagnostics views automatically
            </span>
          </label>
          <label>
            Refresh Every (Seconds)
            <input
              id="autoRefreshSeconds"
                name="autoRefreshSeconds"
                type="number"
                min="3"
                step="1"
                [(ngModel)]="view.workspace.autoRefreshSeconds"
                (change)="view.onAutoRefreshSettingsChanged()"
              />
          </label>
        </div>
      </article>

      <article class="card">
        <h2>Workspace Setup</h2>
        <div class="actions">
          <button id="createTenantButton" class="primary" type="button" [disabled]="!view.canUseTenantScope" (click)="view.createTenant()">Create Tenant</button>
          <button id="createWorkspaceButton" class="secondary" type="button" [disabled]="!view.canUseWorkspaceScope" (click)="view.createWorkspace()">Create Workspace</button>
          <button id="refreshWorkspaceOverviewButton" class="ghost" type="button" [disabled]="!view.canUseWorkspaceScope" (click)="view.refreshWorkspaceOverview()">Refresh Workspace Overview</button>
          <button id="refreshStudyMonitorButton" class="ghost" type="button" [disabled]="!view.canUseWorkspaceScope" (click)="view.refreshStudyMonitor()">Refresh Study Monitor</button>
          <button id="refreshTenantDirectoryButton" class="ghost" type="button" (click)="view.refreshTenantDirectory()">Refresh Tenant Directory</button>
          <button id="refreshWorkspaceDirectoryButton" class="ghost" type="button" [disabled]="!view.canUseTenantScope" (click)="view.refreshWorkspaceDirectory()">Refresh Workspace Directory</button>
          <button id="exportStudyMonitorCsvButton" class="ghost" type="button" [disabled]="!view.canUseWorkspaceScope" (click)="view.exportStudyMonitorCsv()">Export Study Monitor CSV</button>
          <button id="exportParticipantMatrixCsvButton" class="ghost" type="button" [disabled]="!view.canUseWorkspaceScope" (click)="view.exportStudyMonitorParticipantMatrixCsv()">Export Participant Matrix CSV</button>
          <button id="exportWorkspaceLogCsvButton" class="ghost" type="button" [disabled]="!view.canUseWorkspaceScope" (click)="view.exportWorkspaceLogCsv()">Export Workspace Logs CSV</button>
        </div>
      </article>

      <article class="card">
        <h2>Workspace Snapshot</h2>
        <p>Keep the current scope, active release line, participant load, and refresh state visible while you operate the slice.</p>
        <app-summary-cards [cards]="view.workspaceCards"></app-summary-cards>
      </article>

      <app-record-collection
        title="Workspace Action Queue"
        subtitle="The next useful operator move for this scope, derived from the current overview."
        [items]="view.workspaceActionItems"
        (itemAction)="view.runWorkspaceSuggestion($event)"
        emptyState="Refresh or bootstrap the workspace to derive the next action."
      ></app-record-collection>

      <app-record-collection
        title="Tenant Directory"
        subtitle="Platform-level tenant list for choosing the current operating scope."
        [items]="view.tenantDirectoryItems"
        (itemAction)="view.selectTenant($event)"
        emptyState="Refresh the tenant directory after signing in as an operator."
      ></app-record-collection>

      <app-record-collection
        title="Workspace Directory"
        subtitle="Tenant-scoped workspace list for choosing the active workspace."
        [items]="view.workspaceDirectoryItems"
        (itemAction)="view.selectWorkspace($event)"
        emptyState="Refresh the workspace directory for the selected tenant."
      ></app-record-collection>

      <app-record-collection
        title="Scope Detail"
        subtitle="Pinned tenant, workspace, and refresh settings without dropping into raw state."
        [items]="view.workspaceScopeItems"
        emptyState="Workspace scope is not configured yet."
      ></app-record-collection>

      <app-record-collection
        title="Workspace Overview Detail"
        subtitle="The current scope with release, import, and participant pressure in one card."
        [items]="view.workspaceOverviewItems"
        emptyState="Refresh the workspace overview to inspect it here."
      ></app-record-collection>

      <app-record-collection
        title="Workspace Pressure"
        subtitle="Current release line, participant pressure, and import activity at a glance."
        [items]="view.workspacePressureItems"
        emptyState="Refresh the workspace overview to inspect workspace pressure."
      ></app-record-collection>

      <app-record-collection
        title="Study Monitor"
        subtitle="Workspace-wide group progress derived from participant sessions and latest run states."
        [items]="view.studyMonitorItems"
        (itemAction)="view.openStudyMonitorItem($event)"
        emptyState="Refresh the study monitor to inspect group progress."
      ></app-record-collection>

      <app-record-collection
        title="Monitor Status Distribution"
        subtitle="Fast operator split across not-started, running, paused, and completed participant states."
        [items]="view.studyMonitorStatusItems"
        emptyState="Refresh the study monitor to inspect participant state distribution."
      ></app-record-collection>

      <app-record-collection
        title="Monitor Booklet Progress"
        subtitle="Booklet-level participant load, run state, response, and review coverage."
        [items]="view.studyMonitorBookletProgressItems"
        (itemAction)="view.openStudyMonitorItem($event)"
        emptyState="Refresh the study monitor to inspect booklet progress."
      ></app-record-collection>

      <app-record-collection
        title="Monitor Unit Progress"
        subtitle="Unit-level answer coverage and missing-response pressure across the workspace."
        [items]="view.studyMonitorUnitProgressItems"
        (itemAction)="view.openStudyMonitorItem($event)"
        emptyState="Refresh the study monitor to inspect unit progress."
      ></app-record-collection>

      <app-record-collection
        title="Monitor Attention Queue"
        subtitle="Prioritized unit, group, and booklet pressure from the latest study monitor summary."
        [items]="view.studyMonitorAttentionItems"
        (itemAction)="view.openStudyMonitorItem($event)"
        emptyState="No monitor pressure is visible in the latest summary."
      ></app-record-collection>

      <app-record-collection
        title="Monitor Review Queue"
        subtitle="Answered participant-unit rows that are ready for operator review follow-up."
        [items]="view.studyMonitorReviewQueueItems"
        (itemAction)="view.openStudyMonitorItem($event)"
        emptyState="Refresh the study monitor to inspect answered units ready for review."
      ></app-record-collection>

      <article class="card">
        <h2>Participant Matrix Filters</h2>
        <p>Keep large monitor matrices focused by participant, group, unit, run status, answer state, and visible-row limit. The participant-matrix CSV export uses the same filters.</p>
        <div class="form-grid">
          <label>
            Login
            <input id="studyMonitorMatrixLoginFilter" name="studyMonitorMatrixLoginFilter" [(ngModel)]="view.workspace.studyMonitorMatrixLoginFilter" (change)="view.persistState()" placeholder="Optional login" />
          </label>
          <label>
            Group
            <input id="studyMonitorMatrixGroupFilter" name="studyMonitorMatrixGroupFilter" [(ngModel)]="view.workspace.studyMonitorMatrixGroupFilter" (change)="view.persistState()" placeholder="Optional group" />
          </label>
          <label>
            Unit
            <input id="studyMonitorMatrixUnitFilter" name="studyMonitorMatrixUnitFilter" [(ngModel)]="view.workspace.studyMonitorMatrixUnitFilter" (change)="view.persistState()" placeholder="Optional unit" />
          </label>
          <label>
            Run Status
            <select id="studyMonitorMatrixStatusFilter" name="studyMonitorMatrixStatusFilter" [(ngModel)]="view.workspace.studyMonitorMatrixStatusFilter" (change)="view.persistState()">
              <option value="">All statuses</option>
              <option value="not_started">not_started</option>
              <option value="created">created</option>
              <option value="running">running</option>
              <option value="paused">paused</option>
              <option value="completed">completed</option>
            </select>
          </label>
          <label>
            Answer State
            <select id="studyMonitorMatrixAnswerFilter" name="studyMonitorMatrixAnswerFilter" [(ngModel)]="view.workspace.studyMonitorMatrixAnswerFilter" (change)="view.persistState()">
              <option value="">All answers</option>
              <option value="answered">answered</option>
              <option value="missing">missing</option>
            </select>
          </label>
          <label>
            Visible Rows
            <input id="studyMonitorMatrixLimit" name="studyMonitorMatrixLimit" type="number" min="1" max="200" step="1" [(ngModel)]="view.workspace.studyMonitorMatrixLimit" (change)="view.persistState()" />
          </label>
        </div>
        <div class="actions">
          <button id="applyStudyMonitorMatrixFiltersButton" class="primary" type="button" [disabled]="!view.canUseWorkspaceScope" (click)="view.applyStudyMonitorMatrixFilters()">Apply Matrix Filters</button>
          <button class="ghost" type="button" [disabled]="!view.canUseWorkspaceScope" (click)="view.clearStudyMonitorMatrixFilters()">Clear Matrix Filters</button>
        </div>
      </article>

      <app-record-collection
        title="Participant Unit Matrix"
        subtitle="Participant-by-unit operator read model with session, run, answer, and review status."
        [items]="view.studyMonitorParticipantMatrixItems"
        (itemAction)="view.openStudyMonitorItem($event)"
        emptyState="Refresh the study monitor to inspect participant-unit rows."
      ></app-record-collection>

      <app-record-collection
        title="Not Started Participants"
        subtitle="Expected roster participants that still have no launched run."
        [items]="view.studyMonitorNotStartedItems"
        (itemAction)="view.openStudyMonitorItem($event)"
        emptyState="No roster participant is waiting to start."
      ></app-record-collection>

      <app-record-collection
        title="Study Monitor Participant Detail"
        subtitle="Selected participant roster, session, run, unit, answer, and review context."
        [items]="view.studyMonitorParticipantItems"
        (itemAction)="view.openStudyMonitorDetailItem($event)"
        emptyState="Open a participant from the matrix or not-started list to inspect detail."
      ></app-record-collection>

      <app-record-collection
        title="Study Monitor Group Detail"
        subtitle="Selected group sessions, runs, responses, and review pressure."
        [items]="view.studyMonitorGroupItems"
        (itemAction)="view.openStudyMonitorDetailItem($event)"
        emptyState="Open a group from the study monitor to inspect participant detail."
      ></app-record-collection>

      <app-record-collection
        title="Study Monitor Booklet Detail"
        subtitle="Selected booklet runs, status pressure, unit coverage, and review pressure."
        [items]="view.studyMonitorBookletItems"
        (itemAction)="view.openStudyMonitorBookletDetailItem($event)"
        emptyState="Open a booklet from the study monitor to inspect booklet detail."
      ></app-record-collection>

      <app-record-collection
        title="Study Monitor Unit Detail"
        subtitle="Selected unit runs, missing responses, answers, and review pressure."
        [items]="view.studyMonitorUnitItems"
        (itemAction)="view.openStudyMonitorDetailItem($event)"
        emptyState="Open a unit from the study monitor to inspect run detail."
      ></app-record-collection>

      <app-record-collection
        title="Study Monitor Run Detail"
        subtitle="Selected test run with participant, booklet, unit response, and review context."
        [items]="view.studyMonitorRunItems"
        (itemAction)="view.openStudyMonitorDetailItem($event)"
        emptyState="Open a run from the study monitor matrix or detail views to inspect it."
      ></app-record-collection>

      <article class="card">
        <h2>Workspace Activity Filters</h2>
        <p>Focus the operator timeline by event, subject, or a concrete subject id before refreshing the activity feed.</p>
        <div class="form-grid">
          <label>
            Event Type
            <select
              id="workspaceActivityEventType"
              name="workspaceActivityEventType"
              [(ngModel)]="view.workspace.workspaceActivityEventType"
              (change)="view.persistState()"
            >
              <option value="">All events</option>
              <option *ngFor="let eventType of view.workspaceActivityEventTypeOptions" [value]="eventType">{{ eventType }}</option>
            </select>
          </label>
          <label>
            Subject Type
            <select
              id="workspaceActivitySubjectType"
              name="workspaceActivitySubjectType"
              [(ngModel)]="view.workspace.workspaceActivitySubjectType"
              (change)="view.persistState()"
            >
              <option value="">All subjects</option>
              <option *ngFor="let subjectType of view.workspaceActivitySubjectTypeOptions" [value]="subjectType">{{ subjectType }}</option>
            </select>
          </label>
          <label>
            Subject Id
            <input
              id="workspaceActivitySubjectId"
              name="workspaceActivitySubjectId"
              [(ngModel)]="view.workspace.workspaceActivitySubjectId"
              (change)="view.persistState()"
              placeholder="Optional exact id"
            />
          </label>
          <label>
            Limit
            <input
              id="workspaceActivityLimit"
              name="workspaceActivityLimit"
              type="number"
              min="1"
              max="500"
              step="1"
              [(ngModel)]="view.workspace.workspaceActivityLimit"
              (change)="view.persistState()"
            />
          </label>
        </div>
        <div class="actions">
          <button id="refreshWorkspaceActivityButton" class="primary" type="button" [disabled]="!view.canUseWorkspaceScope" (click)="view.refreshWorkspaceActivity()">Refresh Activity</button>
          <button class="ghost" type="button" (click)="view.clearWorkspaceActivityFilters()">Clear Filters</button>
        </div>
      </article>

      <app-record-collection
        title="Workspace Activity"
        subtitle="Latest operator and system events for this scope, narrowed by the current filters."
        [items]="view.workspaceActivityItems"
        (itemAction)="view.openActivitySubject($event)"
        emptyState="No workspace activity yet."
      ></app-record-collection>

      <app-record-collection
        title="Workspace Activity Detail"
        subtitle="Recent event payloads without dropping into the raw activity timeline JSON."
        [items]="view.workspaceActivityDetailItems"
        (itemAction)="view.openActivitySubject($event)"
        emptyState="No detailed workspace activity is loaded yet."
      ></app-record-collection>

      <article class="card">
        <h2>Workspace Log CSV Export</h2>
        <p>Workspace activity events in chronological CSV form for audit and operations handoff.</p>
        <pre id="workspaceLogExportPreview">{{ view.workspaceLogExportView }}</pre>
      </article>

      <article class="card">
        <h2>Study Monitor CSV Export</h2>
        <p>Flat monitor export with workspace, group, booklet, unit, and not-started participant rows.</p>
        <pre id="studyMonitorExportPreview">{{ view.studyMonitorExportView }}</pre>
      </article>

      <article class="card">
        <h2>Participant Matrix CSV Export</h2>
        <p>Participant-by-unit monitor export with run status, response coverage, and review counts, narrowed by the current matrix filters and visible-row limit.</p>
        <pre id="studyMonitorParticipantMatrixExportPreview">{{ view.studyMonitorParticipantMatrixExportView }}</pre>
      </article>

      <app-json-panel
        title="Workspace Overview"
        subtitle="Read Model"
        viewId="workspaceOverviewView"
        [content]="view.workspace.workspaceOverviewView"
      ></app-json-panel>

      <app-json-panel
        title="Study Monitor"
        subtitle="Group Progress"
        viewId="studyMonitorView"
        [content]="view.workspace.studyMonitorView"
      ></app-json-panel>

      <app-json-panel
        title="Participant Unit Matrix"
        subtitle="Participant Unit Read Model"
        viewId="studyMonitorParticipantMatrixView"
        [content]="view.workspace.studyMonitorParticipantMatrixView"
      ></app-json-panel>

      <app-json-panel
        title="Study Monitor Participant Detail"
        subtitle="Selected Participant Read Model"
        viewId="studyMonitorParticipantView"
        [content]="view.workspace.studyMonitorParticipantView"
      ></app-json-panel>

      <app-json-panel
        title="Study Monitor Group Detail"
        subtitle="Selected Group Read Model"
        viewId="studyMonitorGroupView"
        [content]="view.workspace.studyMonitorGroupView"
      ></app-json-panel>

      <app-json-panel
        title="Study Monitor Booklet Detail"
        subtitle="Selected Booklet Read Model"
        viewId="studyMonitorBookletView"
        [content]="view.workspace.studyMonitorBookletView"
      ></app-json-panel>

      <app-json-panel
        title="Study Monitor Unit Detail"
        subtitle="Selected Unit Read Model"
        viewId="studyMonitorUnitView"
        [content]="view.workspace.studyMonitorUnitView"
      ></app-json-panel>

      <app-json-panel
        title="Study Monitor Run Detail"
        subtitle="Selected Run Read Model"
        viewId="studyMonitorRunView"
        [content]="view.workspace.studyMonitorRunView"
      ></app-json-panel>

      <app-json-panel
        title="Workspace Activity"
        subtitle="Operator Timeline"
        viewId="workspaceActivityView"
        [content]="view.workspaceActivityView"
      ></app-json-panel>

      <app-json-panel
        title="Workspace Log CSV Export"
        subtitle="Operator Timeline CSV"
        viewId="workspaceLogExportView"
        [content]="view.workspaceLogExportView"
      ></app-json-panel>

      <app-json-panel
        title="Study Monitor CSV Export"
        subtitle="Operator Monitor CSV"
        viewId="studyMonitorExportView"
        [content]="view.studyMonitorExportView"
      ></app-json-panel>

      <app-json-panel
        title="Participant Matrix CSV Export"
        subtitle="Participant Unit Matrix"
        viewId="studyMonitorParticipantMatrixExportView"
        [content]="view.studyMonitorParticipantMatrixExportView"
      ></app-json-panel>
    </div>
  `
})
export class WorkspaceViewComponent implements OnInit {
  readonly view = inject(WorkspaceViewFacade);

  ngOnInit(): void {
    this.view.init();
  }
}
