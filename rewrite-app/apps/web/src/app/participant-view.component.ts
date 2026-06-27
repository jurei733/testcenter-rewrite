import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import type { OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { ParticipantViewFacade } from "./participant-view.facade";

@Component({
  selector: "app-participant-view",
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="stack">
      <article class="card">
        <h2>Participant Entry</h2>
        <p>Use this focused route to start or continue a participant session without opening operator tooling. Links with a workspace and login key start the session automatically.</p>
        <div class="form-grid">
          <label>
            Workspace Key
            <input id="participantWorkspaceKey" name="participantWorkspaceKey" [(ngModel)]="view.workspace.workspaceKey" (change)="view.persistState()" />
          </label>
          <label>
            Login Key
            <input id="participantLoginKey" name="participantLoginKey" [(ngModel)]="view.runtime.loginKey" (change)="view.persistState()" />
          </label>
          <label>
            Session Id
            <input id="participantRouteSessionId" name="participantRouteSessionId" placeholder="Filled after sign-in" [(ngModel)]="view.runtime.participantSessionId" (change)="view.persistState()" />
          </label>
          <label>
            Current Unit Key
            <input id="participantRouteCurrentUnitKey" name="participantRouteCurrentUnitKey" [(ngModel)]="view.runtime.currentUnitKey" (change)="view.persistState()" />
          </label>
        </div>
        <div class="actions">
          <button class="primary" type="button" (click)="view.signIn()">Participant Sign In</button>
          <button class="secondary" type="button" (click)="view.resumeSession()">Start Or Resume</button>
          <button class="ghost" type="button" (click)="view.refreshCurrentState()">Refresh Current State</button>
        </div>
      </article>

      <article class="card" id="participantRoutePlayer">
        <h2>Current Test</h2>
        <div class="record-card" [class.is-selected]="view.player.runStatus !== 'idle'">
          <header>
            <div>
              <h3 id="participantRouteUnit">{{ view.player.headline }}</h3>
              <span id="participantRouteBooklet">{{ view.player.detail }}</span>
            </div>
            <span id="participantRouteStatus">{{ view.player.runStatus }}</span>
          </header>
          <dl>
            <div>
              <dt>Booklet</dt>
              <dd>{{ view.player.bookletLabel }}</dd>
            </div>
            <div>
              <dt>Unit Key</dt>
              <dd id="participantRouteUnitKey">{{ view.player.unitKey }}</dd>
            </div>
            <div>
              <dt>Unit Position</dt>
              <dd id="participantRouteUnitPosition">{{ view.player.unitPosition }}</dd>
            </div>
            <div>
              <dt>Run</dt>
              <dd id="participantRouteRunId">{{ view.player.runId }}</dd>
            </div>
            <div>
              <dt>Available Actions</dt>
              <dd id="participantRouteActions">{{ view.player.actions.join(", ") || "none" }}</dd>
            </div>
          </dl>
          <label>
            Unit Response
            <textarea
              id="participantRouteUnitResponse"
              name="participantRouteUnitResponse"
              [disabled]="!view.player.canSaveProgress"
              [(ngModel)]="view.runtime.currentUnitResponse"
              placeholder="Write the participant response for this unit."
            ></textarea>
          </label>
          <div class="actions">
            <button id="participantRoutePreviousUnitButton" class="ghost" type="button" [disabled]="!view.player.canGoPreviousUnit" (click)="view.goToPreviousUnit()">Previous Unit</button>
            <button id="participantRouteNextUnitButton" class="secondary" type="button" [disabled]="!view.player.canGoNextUnit" (click)="view.goToNextUnit()">Next Unit</button>
            <button class="secondary" type="button" [disabled]="!view.player.canSaveProgress" (click)="view.saveProgressFromPlayer()">{{ view.player.saveProgressLabel }}</button>
            <button class="ghost" type="button" [disabled]="!view.player.canResumeRun" (click)="view.resumeRun()">Resume Run</button>
            <button class="ghost" type="button" [disabled]="!view.player.canComplete" (click)="view.completeRun()">Complete Test</button>
          </div>
        </div>
      </article>
    </div>
  `
})
export class ParticipantViewComponent implements OnInit {
  readonly view = inject(ParticipantViewFacade);

  ngOnInit(): void {
    this.view.init();
    const query = new URLSearchParams(window.location.search);
    this.view.startFromEntryParameters({
      workspaceKey: query.get("workspaceKey"),
      loginKey: query.get("loginKey"),
      participantSessionId: query.get("participantSessionId"),
      currentUnitKey: query.get("currentUnitKey")
    });
  }
}
