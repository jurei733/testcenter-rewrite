import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import type { OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { JsonPanelComponent } from "./json-panel.component";
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
    SummaryCardsComponent,
    RecordCollectionComponent
  ],
  template: `
    <div class="stack">
      <article class="card">
        <h2>Participant Runtime</h2>
        <div class="form-grid">
          <label>
            Login Key
            <input id="loginKey" name="loginKey" [(ngModel)]="view.runtime.loginKey" (change)="view.persistState()" />
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
        <div class="actions">
          <button class="primary" type="button" (click)="view.participantSignIn()">Sign In</button>
          <button class="secondary" type="button" (click)="view.resumeSession()">Resume Session</button>
          <button class="ghost" type="button" (click)="view.refreshRuntimeReads()">Refresh Runtime Reads</button>
          <button class="ghost" type="button" (click)="view.saveProgressPaused()">Save Paused</button>
          <button class="ghost" type="button" (click)="view.saveProgressRunning()">Save Running</button>
          <button class="ghost" type="button" (click)="view.resumeRun()">Resume Run</button>
          <button class="ghost" type="button" (click)="view.completeRun()">Complete Run</button>
          <button class="ghost" type="button" (click)="view.openRuns()">Monitor Open Runs</button>
          <button class="ghost" type="button" (click)="view.loadDetailedResponses()">Detailed Responses</button>
          <button class="ghost" type="button" (click)="view.createReview()">Create Review</button>
          <button class="ghost" type="button" (click)="view.updateReview()">Update Review</button>
          <button class="ghost" type="button" (click)="view.deleteReview()">Delete Review</button>
          <button class="ghost" type="button" (click)="view.loadReviews()">Load Reviews</button>
          <button class="ghost" type="button" (click)="view.confirmDeleteGroupResults()">Delete Group Results</button>
          <button class="ghost" type="button" (click)="view.exportResponsesCsv()">Export Responses CSV</button>
          <button class="ghost" type="button" (click)="view.exportReviewsCsv()">Export Review CSV</button>
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
          <button class="primary" type="button" (click)="view.participantHappyPathFlow()">Participant Happy Path</button>
          <button class="ghost" type="button" (click)="view.getParticipantSessionDetail()">Participant Session Detail</button>
        </div>
      </article>

      <article class="card">
        <h2>Participant Session Filters</h2>
        <p>Narrow the operator session list by status, group, login, release, or a small result limit.</p>
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
          <button id="refreshParticipantSessionsButton" class="primary" type="button" (click)="view.refreshParticipantSessions()">Refresh Sessions</button>
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

      <article class="card">
        <h2>Participant Entry Links</h2>
        <p>Generate participant start links from pasted rows. Use one row per participant: loginKey, groupKey, optional bookletKey.</p>
        <label>
          Roster Rows
          <textarea id="entryRosterText" name="entryRosterText" [(ngModel)]="view.runtime.entryRosterText" (change)="view.persistState()" placeholder="student-a,group:demo-a,booklet:demo"></textarea>
        </label>
        <div class="actions">
          <button id="generateEntryLinksButton" class="primary" type="button" (click)="view.generateEntryLinks()">Generate Entry Links</button>
          <button class="ghost" type="button" (click)="view.useSelectedParticipantAsEntryRoster()">Use Selected Participant</button>
        </div>
      </article>

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
        title="Unit Responses"
        subtitle="Saved participant responses for the selected run."
        [items]="view.unitResponseItems"
        (itemAction)="view.selectTestRun($event)"
        emptyState="No unit responses saved for the selected run yet."
      ></app-record-collection>

      <article class="card">
        <h2>Detailed Response Filters</h2>
        <p>Narrow response inspection and response CSV export by participant, run, unit, status, or limit.</p>
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
          <button class="primary" type="button" (click)="view.applyDetailedResponseFilters()">Apply Response Filters</button>
          <button class="ghost" type="button" (click)="view.useSelectedRuntimeAsDetailedResponseFilters()">Use Selected Run</button>
          <button class="ghost" type="button" (click)="view.clearDetailedResponseFilters()">Clear Response Filters</button>
        </div>
      </article>

      <app-record-collection
        title="Detailed Responses"
        subtitle="Workspace-wide response inspection with participant, run, unit, and status context."
        [items]="view.detailedResponseItems"
        (itemAction)="view.selectTestRun($event)"
        emptyState="Load detailed responses to inspect saved answers across the workspace."
      ></app-record-collection>

      <article class="card">
        <h2>Review Filters</h2>
        <p>Narrow review reads and review CSV export by participant, run, unit, reviewer, category, or limit.</p>
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
          <button class="primary" type="button" (click)="view.applyReviewFilters()">Apply Review Filters</button>
          <button class="ghost" type="button" (click)="view.useSelectedRuntimeAsReviewFilters()">Use Selected Review Scope</button>
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
        <h2>Response CSV Export</h2>
        <p>Workspace-wide participant responses in CSV format, ready for operator download or inspection.</p>
        <pre id="responseExportPreview">{{ view.runtime.responseExportView }}</pre>
      </article>

      <article class="card">
        <h2>Review CSV Export</h2>
        <p>Workspace-wide review comments in CSV format with participant and run context.</p>
        <pre id="reviewExportPreview">{{ view.runtime.reviewExportView }}</pre>
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

      <app-record-collection
        title="Open Monitor Runs"
        subtitle="Runs that currently keep the activation guard active."
        [items]="view.openRunItems"
        (itemAction)="view.selectTestRun($event)"
        emptyState="No open runs are currently loaded."
      ></app-record-collection>

      <app-json-panel title="Participant Sessions" subtitle="Operator Read" viewId="participantSessionsView" [content]="view.participantSessionsView"></app-json-panel>
      <app-json-panel title="Participant Session Detail" subtitle="Run History" viewId="participantSessionDetailView" [content]="view.runtime.participantSessionDetailView"></app-json-panel>
      <app-json-panel title="Runtime State" subtitle="Session Status" viewId="runtimeStateView" [content]="view.runtime.runtimeStateView"></app-json-panel>
      <app-json-panel title="Current Run State" subtitle="Booklet Context" viewId="currentRunStateView" [content]="view.runtime.currentRunStateView"></app-json-panel>
      <app-json-panel title="Monitor Open Runs" subtitle="Activation Guard Signal" viewId="openRunsView" [content]="view.runtime.openRunsView"></app-json-panel>
      <app-json-panel title="Detailed Responses" subtitle="Workspace Response Read Model" viewId="detailedResponsesView" [content]="view.runtime.detailedResponsesView"></app-json-panel>
      <app-json-panel title="Reviews" subtitle="Workspace Review Read Model" viewId="reviewsView" [content]="view.runtime.reviewsView"></app-json-panel>
      <app-json-panel title="Response CSV Export" subtitle="Workspace Responses" viewId="responseExportView" [content]="view.runtime.responseExportView"></app-json-panel>
      <app-json-panel title="Review CSV Export" subtitle="Workspace Reviews" viewId="reviewExportView" [content]="view.runtime.reviewExportView"></app-json-panel>
      <app-json-panel title="Runtime And Monitor" subtitle="Live Session State" viewId="runtimeMonitorView" [content]="view.runtime.runtimeMonitorView"></app-json-panel>
    </div>
  `
})
export class RuntimeViewComponent implements OnInit {
  readonly view = inject(RuntimeViewFacade);

  ngOnInit(): void {
    this.view.init();
  }
}
