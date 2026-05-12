import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import type { OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { JsonPanelComponent } from "./json-panel.component";
import { RuntimeViewFacade } from "./runtime-view.facade";

@Component({
  selector: "app-runtime-view",
  standalone: true,
  imports: [CommonModule, FormsModule, JsonPanelComponent],
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
        <h2>Guided Flow</h2>
        <p>Drive the participant happy path end to end from sign-in to live runtime state.</p>
        <div class="actions">
          <button class="primary" type="button" (click)="view.participantHappyPathFlow()">Participant Happy Path</button>
          <button class="ghost" type="button" (click)="view.getParticipantSessionDetail()">Participant Session Detail</button>
        </div>
      </article>

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
