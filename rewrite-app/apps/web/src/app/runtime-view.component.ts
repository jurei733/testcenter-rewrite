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
        </div>
        <div class="actions">
          <button class="primary" type="button" (click)="view.participantSignIn()">Sign In</button>
          <button class="secondary" type="button" (click)="view.resumeSession()">Resume Session</button>
          <button class="ghost" type="button" (click)="view.refreshRuntimeReads()">Refresh Runtime Reads</button>
          <button class="ghost" type="button" (click)="view.saveProgressPaused()">Save Paused</button>
          <button class="ghost" type="button" (click)="view.saveProgressRunning()">Save Running</button>
          <button class="ghost" type="button" (click)="view.resumeRun()">Resume Run</button>
          <button class="ghost" type="button" (click)="view.completeRun()">Complete Run</button>
          <button class="ghost" type="button" (click)="view.openRuns()">Monitor Open Runs</button>
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
          </dl>
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

      <app-record-collection
        title="Participant Sessions"
        subtitle="Known sessions, their latest run state, and release context."
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
