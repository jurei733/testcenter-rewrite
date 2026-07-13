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
      <article class="card participant-entry-card">
        <header class="participant-entry-hero">
          <div>
            <span>Participant Entry</span>
            <h2>Start or Resume Test</h2>
            <p>Use a direct link or enter the assigned workspace and login key. The test opens the assigned booklet directly.</p>
          </div>
          <div class="participant-entry-status">
            <span>Session Status</span>
            <strong id="participantEntryStatus">{{ view.player.runStatus }}</strong>
            <small id="participantEntryNextStep">
              {{ view.player.nextStepLabel }} · {{ view.player.nextStepDetail }}
            </small>
          </div>
        </header>
        <div class="participant-entry-context">
          <span>{{ view.player.loginLabel }}</span>
          <span>{{ view.player.groupLabel }}</span>
          <span>{{ view.player.bookletLabel }}</span>
        </div>
        <section class="participant-session-link" *ngIf="view.player.sessionEntryLink">
          <div>
            <span>Session Re-Entry</span>
            <strong>Bookmark this session link</strong>
            <p>Use it to reopen the same running or completed test without starting a duplicate session.</p>
          </div>
          <a id="participantRouteSessionAnchor" class="button-link secondary" [href]="view.player.sessionEntryLink">Open Session</a>
          <input id="participantRouteSessionLink" name="participantRouteSessionLink" readonly [value]="view.player.sessionEntryLink" />
        </section>
        <div class="form-grid">
          <label>
            Tenant Key
            <input id="participantTenantKey" name="participantTenantKey" [(ngModel)]="view.workspace.tenantKey" (change)="view.persistState()" />
          </label>
          <label>
            Workspace Key
            <input id="participantWorkspaceKey" name="participantWorkspaceKey" [(ngModel)]="view.workspace.workspaceKey" (change)="view.persistState()" />
          </label>
          <label>
            Login Key
            <input id="participantLoginKey" name="participantLoginKey" [(ngModel)]="view.runtime.loginKey" (change)="view.persistState()" />
          </label>
          <label>
            Group Key
            <input id="participantRouteGroupKey" name="participantRouteGroupKey" [(ngModel)]="view.runtime.groupKey" (change)="view.persistState()" />
          </label>
          <label>
            Booklet Key
            <input id="participantRouteBookletKey" name="participantRouteBookletKey" [(ngModel)]="view.runtime.bookletKey" (change)="view.persistState()" />
          </label>
          <label>
            Session Id
            <input id="participantRouteSessionId" name="participantRouteSessionId" placeholder="Filled after start" readonly [(ngModel)]="view.runtime.participantSessionId" />
          </label>
          <label>
            Current Unit Key
            <input id="participantRouteCurrentUnitKey" name="participantRouteCurrentUnitKey" [(ngModel)]="view.runtime.currentUnitKey" (change)="view.persistState()" />
          </label>
        </div>
        <div class="actions">
          <button id="participantRouteSignInButton" class="secondary" type="button" (click)="view.signIn()">
            Sign In
          </button>
          <button class="primary" type="button" (click)="view.resumeSession()">Start Or Resume</button>
          <button class="ghost" type="button" (click)="view.refreshCurrentState()">Refresh Current State</button>
        </div>
      </article>

      <article class="card" id="participantRoutePlayer">
        <h2>Current Test</h2>
        <div class="record-card" [class.is-selected]="view.player.runStatus !== 'idle'">
          <div class="participant-meta-grid">
            <div>
              <span>Login</span>
              <strong id="participantRouteLoginLabel">{{ view.player.loginLabel }}</strong>
            </div>
            <div>
              <span>Group</span>
              <strong id="participantRouteGroupLabel">{{ view.player.groupLabel }}</strong>
            </div>
            <div>
              <span>Session</span>
              <strong id="participantRouteSessionLabel">{{ view.player.sessionLabel }}</strong>
            </div>
          </div>
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
          <section class="participant-progress" aria-label="Test progress">
            <header>
              <span>Progress</span>
              <strong id="participantRouteProgressLabel">{{ view.player.responseProgressLabel }}</strong>
            </header>
            <div class="progress-track" aria-hidden="true">
              <span [style.width.%]="view.player.progressPercent"></span>
            </div>
            <p id="participantRouteMissingLabel">{{ view.player.missingResponseLabel }}</p>
            <p id="participantRouteCompletionLabel" [class.is-complete]="view.player.isComplete">{{ view.player.completionLabel }}</p>
          </section>
          <section class="participant-unit-prompt" aria-label="Current unit prompt">
            <span>Unit Prompt</span>
            <p id="participantRouteUnitDescription">{{ view.player.unitDescription }}</p>
            <strong id="participantRouteUnitContent">{{ view.player.unitContent }}</strong>
          </section>
          <label>
            Unit Response
            <textarea
              id="participantRouteUnitResponse"
              name="participantRouteUnitResponse"
              [disabled]="!view.player.canSaveProgress"
              [(ngModel)]="view.runtime.currentUnitResponse"
              (change)="view.persistState()"
              placeholder="Write the participant response for this unit."
            ></textarea>
          </label>
          <section
            class="participant-draft-state"
            [class.has-unsaved-response]="view.player.hasUnsavedResponse"
            aria-live="polite"
          >
            <span>Answer Status</span>
            <strong id="participantRouteDraftLabel">{{ view.player.draftStateLabel }}</strong>
            <p id="participantRouteDraftDetail">{{ view.player.draftStateDetail }}</p>
          </section>
          <section
            class="participant-completion-readiness"
            [class.is-ready]="view.player.completionReadinessState === 'ready'"
            [class.is-complete]="view.player.completionReadinessState === 'complete'"
            aria-live="polite"
          >
            <span>Completion Readiness</span>
            <strong id="participantRouteCompletionReadinessLabel">{{ view.player.completionReadinessLabel }}</strong>
            <p id="participantRouteCompletionReadinessDetail">{{ view.player.completionReadinessDetail }}</p>
          </section>
          <section class="unit-rail" aria-label="Booklet units" *ngIf="view.player.unitItems.length > 0">
            <header>
              <span>Booklet Units</span>
              <strong>{{ view.player.unitPosition }}</strong>
            </header>
            <div class="unit-rail-grid" id="participantRouteUnitRail">
              <button
                *ngFor="let unit of view.player.unitItems"
                type="button"
                class="unit-chip"
                [class.is-current]="unit.isCurrent"
                [class.has-response]="unit.hasResponse"
                [disabled]="!unit.canOpen"
                [attr.data-unit-key]="unit.unitKey"
                (click)="view.goToUnit(unit.unitKey)"
              >
                <span>{{ unit.position }}</span>
                <strong>{{ unit.label }}</strong>
              </button>
            </div>
          </section>
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
      tenantKey: query.get("tenantKey"),
      workspaceKey: query.get("workspaceKey"),
      loginKey: query.get("loginKey"),
      groupKey: query.get("groupKey"),
      bookletKey: query.get("bookletKey"),
      participantSessionId: query.get("participantSessionId"),
      currentUnitKey: query.get("currentUnitKey"),
      unitResponse: query.get("unitResponse")
    });
  }
}
