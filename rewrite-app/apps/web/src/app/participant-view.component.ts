import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import type { OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { ParticipantViewFacade } from "./participant-view.facade";
import { VeronaPlayerHostComponent } from "./verona-player-host.component";

@Component({
  selector: "app-participant-view",
  standalone: true,
  imports: [CommonModule, FormsModule, VeronaPlayerHostComponent],
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
          <span id="participantEntryDisplayName">{{ view.player.displayNameLabel }}</span>
          <span>{{ view.player.loginLabel }}</span>
          <span>{{ view.player.groupLabel }}</span>
          <span>{{ view.player.bookletLabel }}</span>
        </div>
        <section
          class="participant-entry-issue"
          *ngIf="view.entryIssue as issue"
          aria-live="polite"
        >
          <div>
            <span id="participantEntryIssueStatus">{{ issue.statusCode }}</span>
            <h3 id="participantEntryIssueTitle">{{ issue.title }}</h3>
            <p id="participantEntryIssueDetail">{{ issue.detail }}</p>
            <strong id="participantEntryIssueAction">{{ issue.action }}</strong>
          </div>
          <code id="participantEntryIssueCode">{{ issue.errorCode }}</code>
        </section>
        <section class="participant-session-link" *ngIf="view.player.sessionEntryLink">
          <div>
            <span>Session Re-Entry</span>
            <strong>Bookmark this session link</strong>
            <p>Use it to reopen the same running or completed test without starting a duplicate session.</p>
          </div>
          <a
            id="participantRouteSessionAnchor"
            class="button-link secondary"
            [href]="view.player.sessionEntryLink"
            [attr.aria-label]="'Session Re-Entry: ' + view.player.sessionEntryLink"
            [attr.title]="view.player.sessionEntryLink"
            target="_blank"
            rel="noreferrer"
          >
            Open Session
          </a>
          <button
            id="participantRouteCopySessionLinkButton"
            class="ghost"
            type="button"
            [attr.aria-label]="(view.isSessionEntryLinkCopied(view.player.sessionEntryLink) ? 'Copied Session Re-Entry: ' : 'Copy Session Re-Entry: ') + view.player.sessionEntryLink"
            [attr.title]="'Copy ' + view.player.sessionEntryLink"
            (click)="view.copySessionEntryLink(view.player.sessionEntryLink)"
          >
            {{ view.isSessionEntryLinkCopied(view.player.sessionEntryLink) ? "Copied" : "Copy Session Link" }}
          </button>
          <span
            id="participantRouteSessionLinkCopyStatus"
            class="participant-session-link-copy-status"
            *ngIf="view.isSessionEntryLinkCopied(view.player.sessionEntryLink)"
            role="status"
            aria-live="polite"
          >
            Session link copied
          </span>
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
            Password
            <input id="participantPassword" name="participantPassword" type="password" autocomplete="current-password" [(ngModel)]="view.runtime.participantPassword" (change)="view.persistState()" />
          </label>
          <label>
            Group Key
            <input id="participantRouteGroupKey" name="participantRouteGroupKey" [(ngModel)]="view.runtime.groupKey" (change)="view.persistState()" />
          </label>
          <label>
            Booklet Key
            <select
              *ngIf="view.assignedBooklets.length > 0; else manualBookletKey"
              id="participantRouteBookletKey"
              name="participantRouteBookletKey"
              [(ngModel)]="view.runtime.bookletKey"
              (change)="view.persistState()"
            >
              <option
                *ngFor="let booklet of view.assignedBooklets"
                [value]="booklet.bookletKey"
                [disabled]="booklet.status === 'completed'"
              >
                {{ booklet.displayLabel }} · {{ booklet.status }}
              </option>
            </select>
            <ng-template #manualBookletKey>
              <input id="participantRouteBookletKey" name="participantRouteBookletKey" [(ngModel)]="view.runtime.bookletKey" (change)="view.persistState()" />
            </ng-template>
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
        <section class="participant-booklet-list" *ngIf="view.assignedBooklets.length > 1" aria-label="Assigned booklets">
          <span>Assigned Booklets</span>
          <div>
            <button
              *ngFor="let booklet of view.assignedBooklets"
              type="button"
              class="unit-chip"
              [class.is-current]="booklet.bookletKey === view.runtime.bookletKey"
              [class.has-response]="booklet.status === 'completed'"
              [disabled]="booklet.status !== 'available'"
              [attr.data-booklet-key]="booklet.bookletKey"
              (click)="view.runtime.bookletKey = booklet.bookletKey; view.persistState()"
            >
              <strong>{{ booklet.displayLabel }}</strong>
              <em>{{ booklet.status }}</em>
            </button>
          </div>
        </section>
        <div class="actions">
          <button id="participantRouteSignInButton" class="secondary" type="button" [disabled]="!view.canSignIn" (click)="view.signIn()">
            Sign In
          </button>
          <button id="participantRouteStartOrResumeButton" class="primary" type="button" [disabled]="!view.canStartOrResume" (click)="view.resumeSession()">Start Or Resume</button>
          <button id="participantRouteRefreshCurrentStateButton" class="ghost" type="button" [disabled]="!view.canRefreshCurrentState" (click)="view.refreshCurrentState()">Refresh Current State</button>
          <button id="participantRouteClearSessionButton" class="ghost" type="button" [disabled]="!view.player.canClearSession" (click)="view.clearSession()">Leave Session</button>
        </div>
      </article>

      <article class="card" id="participantRoutePlayer">
        <h2>Current Test</h2>
        <div class="record-card" [class.is-selected]="view.player.runStatus !== 'idle'">
          <div class="participant-meta-grid">
            <div>
              <span>Name</span>
              <strong id="participantRouteDisplayName">{{ view.player.displayNameLabel }}</strong>
            </div>
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
            <div
              class="progress-track"
              role="progressbar"
              aria-labelledby="participantRouteProgressLabel"
              [attr.aria-valuemin]="0"
              [attr.aria-valuemax]="100"
              [attr.aria-valuenow]="view.player.progressPercent"
              [attr.aria-valuetext]="view.player.responseProgressLabel"
            >
              <span [style.width.%]="view.player.progressPercent"></span>
            </div>
            <p id="participantRouteMissingLabel">{{ view.player.missingResponseLabel }}</p>
            <p id="participantRouteCompletionLabel" [class.is-complete]="view.player.isComplete">{{ view.player.completionLabel }}</p>
          </section>
          <app-verona-player-host
            *ngIf="view.veronaPlayer as verona; else textResponsePlayer"
            [playerHtml]="verona.playerHtml"
            [playerKey]="verona.playerKey"
            [testRunId]="verona.testRunId"
            [unitKey]="verona.unitKey"
            [unitTitle]="verona.unitTitle"
            [unitDefinition]="verona.unitDefinition"
            [unitDefinitionType]="verona.unitDefinitionType"
            [savedResponse]="verona.savedResponse"
            [unitNumber]="verona.unitNumber"
            [canGoPrevious]="verona.canGoPrevious"
            [canGoNext]="verona.canGoNext"
            [canComplete]="verona.canComplete"
            [saveStatus]="view.veronaSaveStatus"
            (responseChange)="view.saveVeronaResponse($event)"
            (navigationRequest)="view.navigateFromVerona($event)"
            (retrySave)="view.retryVeronaSave()"
          ></app-verona-player-host>
          <ng-template #textResponsePlayer>
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
          </ng-template>
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
              <div>
                <span>Booklet Units</span>
                <small id="participantRouteUnitOverview">{{ view.player.unitOverviewLabel }}</small>
              </div>
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
                [attr.aria-current]="unit.isCurrent ? 'step' : null"
                [attr.aria-label]="unit.accessibilityLabel"
                [attr.title]="unit.accessibilityLabel"
                (click)="view.goToUnit(unit.unitKey)"
              >
                <span>{{ unit.position }}</span>
                <strong>{{ unit.label }}</strong>
                <em>{{ unit.statusLabel }}</em>
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
