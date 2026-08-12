import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import type { OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { ApplicationSettingsService } from "./application-settings.service";
import { ParticipantViewFacade } from "./participant-view.facade";
import { VeronaPlayerHostComponent } from "./verona-player-host.component";

@Component({
  selector: "app-participant-view",
  standalone: true,
  imports: [CommonModule, FormsModule, VeronaPlayerHostComponent],
  template: `
    <div class="stack">
      <article
        *ngIf="!view.isParticipantPlayerFocused"
        id="participantRouteEntry"
        class="card participant-entry-card"
      >
        <header class="participant-entry-hero">
          <div>
            <span>Participant Entry</span>
            <h2 id="participantCustomLoginSubtitle">{{ view.customText('login_subtitle', 'Start or Resume Test') }}</h2>
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
        <img
          id="participantLoginIllustration"
          class="participant-assigned-asset"
          *ngIf="applicationSettings.assetUrl('loginIllustration') as assetUrl"
          [src]="assetUrl"
          alt=""
        />
        <section
          id="applicationIntroContent"
          class="configured-application-content"
          *ngIf="applicationSettings.settings().introHtml.trim()"
          [innerHTML]="applicationSettings.settings().introHtml"
        ></section>
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
            <input id="participantLoginKey" name="participantLoginKey" [(ngModel)]="view.runtime.loginKey" (ngModelChange)="view.resetParticipantCodeChallenge()" (change)="view.persistState()" />
          </label>
          <label>
            Password
            <input id="participantPassword" name="participantPassword" type="password" autocomplete="current-password" [(ngModel)]="view.runtime.participantPassword" (change)="view.persistState()" />
          </label>
          <div *ngIf="view.participantCodeRequired" class="participant-code-control">
            <img
              id="participantCodeInputIllustration"
              class="participant-assigned-asset"
              *ngIf="applicationSettings.assetUrl('codeInputIllustration') as assetUrl"
              [src]="assetUrl"
              alt=""
            />
            <img
              id="participantCodeInputCompanion"
              class="participant-assigned-asset"
              *ngIf="applicationSettings.assetUrl('codeInputCompanion') as assetUrl"
              [src]="assetUrl"
              alt=""
            />
            <span>{{ view.customText('login_codeInputTitle', 'Participant Code') }}</span>
            <input
              *ngIf="!view.usesParticipantCodeKeypad"
              id="participantCode"
              name="participantCode"
              autocomplete="one-time-code"
              [(ngModel)]="view.runtime.participantCode"
            />
            <section
              *ngIf="view.usesParticipantCodeKeypad"
              id="participantCodeKeypad"
              class="participant-code-keypad"
              role="group"
              [attr.aria-label]="view.customText('login_codeInputTitle', 'Participant Code')"
            >
              <div class="participant-code-slots" aria-live="polite">
                <span *ngFor="let slot of view.participantCodeSlots" [class.is-filled]="slot < view.runtime.participantCode.length">●</span>
              </div>
              <div class="participant-code-keypad-grid">
                <button
                  *ngFor="let option of view.participantCodeKeypadOptions"
                  type="button"
                  [id]="'participantCodeKeypadValue-' + option.value"
                  [attr.aria-label]="option.label"
                  (click)="view.selectParticipantCodeKeypadValue(option.value)"
                >{{ option.symbol }}</button>
                <button
                  id="participantCodeKeypadDelete"
                  type="button"
                  class="participant-code-keypad-delete"
                  aria-label="Delete last code value"
                  [disabled]="!view.runtime.participantCode"
                  (click)="view.removeParticipantCodeKeypadValue()"
                >⌫</button>
              </div>
            </section>
          </div>
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
                [disabled]="booklet.status === 'completed' || booklet.status === 'locked'"
              >
                {{ booklet.displayLabel }}{{ view.formatBookletVariant(booklet) }} · {{ booklet.status }}
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
          <img
            id="participantStarterCompanion"
            class="participant-assigned-asset"
            *ngIf="applicationSettings.assetUrl('starterCompanion') as assetUrl"
            [src]="assetUrl"
            alt=""
          />
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
              [attr.data-source-booklet-key]="booklet.sourceBookletKey"
              (click)="view.runtime.bookletKey = booklet.bookletKey; view.persistState()"
            >
              <strong>{{ booklet.displayLabel }}{{ view.formatBookletVariant(booklet) }}</strong>
              <em>{{ booklet.status }}</em>
            </button>
          </div>
        </section>
        <p
          id="participantBookletSelectionPrompt"
          class="hint"
          *ngIf="view.bookletSelectionPrompt"
        >{{ view.bookletSelectionPrompt }}</p>
        <p id="participantCodePrompt" class="hint" *ngIf="view.participantCodeRequired">
          {{ view.customText('login_codeInputPrompt', 'This login requires the second code assigned by the test supervisor.') }}
        </p>
        <div class="actions">
          <button id="participantRouteSignInButton" class="secondary" type="button" [disabled]="!view.canSignIn" (click)="view.signIn()">
            Sign In
          </button>
          <button id="participantRouteStartOrResumeButton" class="primary" type="button" [disabled]="!view.canStartOrResume" (click)="view.resumeSession()">{{ view.customText('login_testResumeButtonLabel', 'Start Or Resume') }}</button>
          <button id="participantRouteRefreshCurrentStateButton" class="ghost" type="button" [disabled]="!view.canRefreshCurrentState" (click)="view.refreshCurrentState()">Refresh Current State</button>
          <button id="participantRouteClearSessionButton" class="ghost" type="button" [disabled]="!view.player.canClearSession" (click)="view.clearSession()">Leave Session</button>
        </div>
      </article>

      <article class="card" id="participantRoutePlayer">
        <input
          *ngIf="view.isParticipantPlayerFocused"
          id="participantRouteSessionId"
          name="participantRouteSessionId"
          type="hidden"
          [value]="view.runtime.participantSessionId"
        />
        <h2>Current Test</h2>
        <section
          *ngIf="view.showParticipantConnectionState"
          id="participantRouteConnectionState"
          class="participant-connection-state"
          [class.is-degraded]="view.participantConnectionState.status === 'reconnecting' || view.participantConnectionState.status === 'offline'"
          [attr.data-status]="view.participantConnectionState.status"
          role="status"
          aria-live="polite"
        >
          <span>Live updates</span>
          <strong id="participantRouteConnectionStatus">{{ view.participantConnectionLabel }}</strong>
          <p id="participantRouteConnectionDetail">{{ view.participantConnectionState.detail }}</p>
        </section>
        <section
          *ngIf="view.showFullscreenPrompt"
          id="participantRouteFullscreenPrompt"
          class="participant-fullscreen-prompt"
          role="dialog"
          aria-labelledby="participantRouteFullscreenPromptTitle"
        >
          <div>
            <span>Display Check</span>
            <strong id="participantRouteFullscreenPromptTitle">{{ view.customText('booklet_requestFullscreen', 'Use fullscreen for this test?') }}</strong>
            <p>The booklet requests a distraction-free fullscreen presentation.</p>
          </div>
          <div class="actions">
            <button id="participantRouteEnterFullscreenButton" class="primary" type="button" (click)="view.requestFullscreen()">Enter Fullscreen</button>
            <button id="participantRouteDismissFullscreenButton" class="ghost" type="button" (click)="view.dismissFullscreenPrompt()">Continue In Window</button>
          </div>
        </section>
        <div
          *ngIf="view.screenHeaderLabel || view.showFullscreenButton || view.showReloadButton || (view.isParticipantPlayerFocused && !view.hasControllerError)"
          class="participant-runtime-toolbar"
        >
          <strong id="participantRouteScreenHeader" *ngIf="view.screenHeaderLabel">{{ view.screenHeaderLabel }}</strong>
          <button
            *ngIf="view.showReloadButton"
            id="participantRouteReloadButton"
            class="ghost"
            type="button"
            (click)="view.reloadPage()"
          >Reload</button>
          <button
            *ngIf="view.showFullscreenButton"
            id="participantRouteFullscreenButton"
            class="ghost"
            type="button"
            (click)="view.toggleFullscreen()"
          >{{ view.fullscreenActive() ? "Exit Fullscreen" : "Fullscreen" }}</button>
          <div
            *ngIf="view.isParticipantPlayerFocused && !view.hasControllerError"
            class="participant-runtime-actions"
          >
            <a
              *ngIf="view.player.sessionEntryLink"
              id="participantRouteSessionAnchor"
              class="button-link secondary"
              [href]="view.player.sessionEntryLink"
              [attr.aria-label]="'Session Re-Entry: ' + view.player.sessionEntryLink"
              [attr.title]="view.player.sessionEntryLink"
              target="_blank"
              rel="noreferrer"
            >Open Session</a>
            <button
              *ngIf="view.player.sessionEntryLink"
              id="participantRouteCopySessionLinkButton"
              class="ghost"
              type="button"
              [attr.aria-label]="(view.isSessionEntryLinkCopied(view.player.sessionEntryLink) ? 'Copied Session Re-Entry: ' : 'Copy Session Re-Entry: ') + view.player.sessionEntryLink"
              [attr.title]="'Copy ' + view.player.sessionEntryLink"
              (click)="view.copySessionEntryLink(view.player.sessionEntryLink)"
            >{{ view.isSessionEntryLinkCopied(view.player.sessionEntryLink) ? "Copied" : "Copy Session Link" }}</button>
            <button
              *ngIf="view.player.canClearSession"
              id="participantRouteClearSessionButton"
              class="ghost"
              type="button"
              (click)="view.clearSession()"
            >Leave Session</button>
          </div>
        </div>
        <span
          *ngIf="view.isParticipantPlayerFocused && view.isSessionEntryLinkCopied(view.player.sessionEntryLink)"
          id="participantRouteSessionLinkCopyStatus"
          class="participant-session-link-copy-status"
          role="status"
          aria-live="polite"
        >Session link copied</span>
        <p
          *ngIf="view.fullscreenStatusText"
          id="participantRouteFullscreenStatus"
          class="participant-fullscreen-status"
          role="status"
        >{{ view.fullscreenStatusText }}</p>
        <p
          *ngIf="view.bookletLoadedUnitCount"
          id="participantRouteBookletLoadingStatus"
          class="participant-fullscreen-status"
          role="status"
        >Booklet ready · {{ view.bookletLoadedUnitCount }} {{ view.bookletLoadedUnitCount === 1 ? "unit asset" : "unit assets" }} loaded</p>
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
          <ng-container *ngIf="view.player.isComplete; else participantActiveRun">
            <section
              id="participantRouteCompletedState"
              class="participant-completed-state"
              role="status"
              aria-live="assertive"
              aria-labelledby="participantRouteCompletedTitle"
            >
              <img
                id="participantCompletedAsset"
                class="participant-assigned-asset"
                *ngIf="applicationSettings.assetUrl('starterCardDone') as assetUrl"
                [src]="assetUrl"
                alt=""
              />
              <span>Test completed</span>
              <strong id="participantRouteCompletedTitle">Your test is finished.</strong>
              <p id="participantRouteCompletedDetail">Your responses are closed and can no longer be changed. You can leave this session or select another available test above.</p>
              <dl class="participant-completed-summary">
                <div>
                  <dt>Status</dt>
                  <dd id="participantRouteStatus">{{ view.player.runStatus }}</dd>
                </div>
                <div>
                  <dt>Run</dt>
                  <dd id="participantRouteRunId">{{ view.player.runId }}</dd>
                </div>
                <div>
                  <dt>Saved progress</dt>
                  <dd id="participantRouteProgressLabel">{{ view.player.responseProgressLabel }}</dd>
                </div>
                <div>
                  <dt>Completed</dt>
                  <dd id="participantRouteCompletionLabel">{{ view.player.completionLabel }}</dd>
                </div>
              </dl>
              <p id="participantRouteMissingLabel">{{ view.player.missingResponseLabel }}</p>
            </section>
          </ng-container>
          <ng-template #participantActiveRun>
          <ng-container *ngIf="view.hasControllerError; else participantRunnableState">
            <section
              id="participantRouteControllerErrorState"
              class="participant-controller-error-state"
              role="alert"
              aria-live="assertive"
              aria-labelledby="participantRouteControllerErrorTitle"
            >
              <span id="participantRouteStatus">error</span>
              <strong id="participantRouteControllerErrorTitle">The test cannot continue.</strong>
              <p id="participantRouteControllerErrorText">{{ view.controllerErrorText }}</p>
              <details>
                <summary>Technical details</summary>
                <code id="participantRouteControllerErrorDetail">{{ view.controllerErrorMessage }}</code>
              </details>
              <button
                id="participantRouteControllerReloadButton"
                class="primary"
                type="button"
                (click)="view.reloadAfterControllerError()"
              >{{ view.customText('booklet_reload', 'Neu Laden') }}</button>
            </section>
          </ng-container>
          <ng-template #participantRunnableState>
          <header>
            <div>
              <h3 *ngIf="view.showUnitTitle" id="participantRouteUnit">{{ view.player.headline }}</h3>
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
              <dt>Execution Mode</dt>
              <dd id="participantRouteExecutionMode">{{ view.player.executionMode }} · {{ view.player.executionModeLabel }}</dd>
            </div>
            <div>
              <dt>Response Storage</dt>
              <dd id="participantRouteResponsePersistence">{{ view.player.responsePersistenceLabel }}</dd>
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
          <ng-container *ngIf="!view.isRunPaused; else participantPaused">
          <section
            *ngIf="view.canChangeAdaptiveStates"
            id="participantRouteAdaptiveStates"
            class="participant-adaptive-states"
            aria-labelledby="participantRouteAdaptiveStatesTitle"
          >
            <header>
              <div>
                <span>Adaptive Routing</span>
                <strong id="participantRouteAdaptiveStatesTitle">Choose the booklet path</strong>
                <p>The automatic route remains visible while your selection controls which units are available.</p>
              </div>
            </header>
            <label *ngFor="let state of view.adaptiveStates" class="participant-adaptive-state">
              <span>{{ state.displayLabel }}</span>
              <select
                [attr.id]="'participantRouteAdaptiveState-' + state.stateKey"
                [attr.data-state-key]="state.stateKey"
                [ngModel]="state.overrideOptionKey ?? ''"
                [disabled]="!!view.adaptiveStateChangePending"
                (ngModelChange)="view.selectAdaptiveState(state.stateKey, $event)"
              >
                <option value="" disabled>Automatic ({{ state.automaticOptionLabel }})</option>
                <option *ngFor="let option of state.options" [value]="option.optionKey">{{ option.displayLabel }}</option>
              </select>
              <small>
                Automatic: {{ state.automaticOptionLabel }}
                <ng-container *ngIf="state.overrideOptionKey"> · Manual selection active</ng-container>
              </small>
            </label>
            <p *ngIf="view.adaptiveStateFeedback" id="participantRouteAdaptiveStateFeedback" class="participant-adaptive-state-feedback" role="status">{{ view.adaptiveStateFeedback }}</p>
          </section>
          <ng-container *ngIf="!view.eagerBookletLoading; else eagerBookletLoading">
            <app-verona-player-host
              *ngIf="view.veronaPlayer as verona; else textResponsePlayer"
              [playerHtml]="verona.playerHtml"
              [playerKey]="verona.playerKey"
              [testRunId]="verona.testRunId"
              [unitKey]="verona.unitKey"
              [unitTitle]="verona.unitTitle"
              [unitDefinition]="verona.unitDefinition"
              [unitDefinitionType]="verona.unitDefinitionType"
              [resourceBasePath]="verona.resourceBasePath"
              [savedResponse]="verona.savedResponse"
              [unitNumber]="verona.unitNumber"
              [unitCount]="verona.unitCount"
              [canGoPrevious]="verona.canGoPrevious"
              [canGoNext]="verona.canGoNext"
              [canComplete]="verona.canComplete"
              [canNavigateUnits]="verona.canNavigateUnits"
              [navigationUnits]="verona.navigationUnits"
              [backwardDeniedReasons]="verona.backwardDeniedReasons"
              [forwardDeniedReasons]="verona.forwardDeniedReasons"
              [logPolicy]="verona.logPolicy"
              [pagingMode]="verona.pagingMode"
              [restoreCurrentPageOnReturn]="verona.restoreCurrentPageOnReturn"
              [pageNavigationLabelMode]="verona.pageNavigationLabelMode"
              [pageNavigationControlsHidden]="verona.pageNavigationControlsHidden"
              [globalBackwardButtonMode]="verona.globalBackwardButtonMode"
              [globalForwardButtonMode]="verona.globalForwardButtonMode"
              [saveStatus]="view.veronaSaveStatus"
              [loadingLabel]="view.veronaLoadingLabel"
              [loadingTitle]="view.veronaLoadingTitle"
              [loadingStatus]="view.veronaLoadingStatus"
              [loadingPendingStatus]="view.veronaLoadingPendingStatus"
              [loadingCompleteStatus]="view.veronaLoadingCompleteStatus"
              [errorText]="view.veronaErrorText"
              (logEntries)="view.queueVeronaLogs($event)"
              (testLogEntries)="view.saveVeronaTestLogs($event)"
              (controllerError)="view.handleVeronaControllerError($event)"
              (responseUpdate)="view.saveVeronaResponse($event)"
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
                  [ngModel]="view.runtime.currentUnitResponse"
                  (ngModelChange)="view.updateCurrentTextResponse($event)"
                  (change)="view.persistState()"
                  placeholder="Write the participant response for this unit."
                ></textarea>
              </label>
            </ng-template>
          </ng-container>
          <ng-template #eagerBookletLoading>
            <section
              id="participantRouteBookletLoading"
              class="participant-unit-prompt"
              role="status"
              aria-live="polite"
            >
              <img
                id="participantLoadingProgressAsset"
                class="participant-assigned-asset"
                *ngIf="applicationSettings.assetUrl('loadingProgress') as assetUrl"
                [src]="assetUrl"
                alt=""
              />
              <span>{{ view.veronaLoadingLabel }}</span>
              <strong>Booklet is loading</strong>
              <p>{{ view.veronaLoadingPendingStatus }}</p>
            </section>
          </ng-template>
          <section
            *ngIf="view.player.canReview"
            id="participantRouteReviewPanel"
            class="participant-review-panel"
            aria-labelledby="participantRouteReviewTitle"
          >
            <header>
              <div>
                <span>Review Mode</span>
                <strong id="participantRouteReviewTitle">Comments and assessments</strong>
                <p>Add feedback for the whole test or the unit currently shown. Your comments are saved even when responses are not.</p>
              </div>
              <strong id="participantRouteReviewCount">{{ view.participantReviews.length }} comment{{ view.participantReviews.length === 1 ? "" : "s" }}</strong>
            </header>
            <div class="participant-review-target" role="group" aria-label="Comment target">
              <button
                id="participantRouteReviewTargetUnit"
                type="button"
                class="unit-chip"
                [class.is-current]="view.reviewTarget === 'unit'"
                [disabled]="!view.player.unitKey || view.player.unitKey === 'n/a'"
                (click)="view.reviewTarget = 'unit'"
              >{{ view.reviewUnitTargetLabel }}</button>
              <button
                id="participantRouteReviewTargetTask"
                type="button"
                class="unit-chip"
                [class.is-current]="view.reviewTarget === 'task'"
                [disabled]="!view.player.unitKey || view.player.unitKey === 'n/a'"
                (click)="view.reviewTarget = 'task'"
              >Current Task / Page</button>
              <button
                id="participantRouteReviewTargetTest"
                type="button"
                class="unit-chip"
                [class.is-current]="view.reviewTarget === 'test'"
                (click)="view.reviewTarget = 'test'"
              >Whole Test</button>
            </div>
            <label *ngIf="view.reviewTarget === 'task'" class="participant-review-page-label">
              Task or page label
              <input
                id="participantRouteReviewPageLabel"
                name="participantRouteReviewPageLabel"
                [(ngModel)]="view.reviewPageLabel"
                placeholder="Optional label for the current task or page"
              />
              <small>{{ view.currentReviewPageReference }}</small>
            </label>
            <div class="form-grid participant-review-form">
              <label>
                Reviewer name (optional)
                <input id="participantRouteReviewReviewer" name="participantRouteReviewReviewer" [(ngModel)]="view.reviewerId" placeholder="Defaults to participant login" />
              </label>
              <label>
                Priority
                <select id="participantRouteReviewPriority" name="participantRouteReviewPriority" [(ngModel)]="view.reviewPriority">
                  <option *ngFor="let option of view.reviewPriorityOptions" [ngValue]="option.value">{{ option.label }}</option>
                </select>
              </label>
            </div>
            <fieldset class="participant-review-categories">
              <legend>Categories</legend>
              <label *ngFor="let option of view.reviewCategoryOptions">
                <input
                  type="checkbox"
                  [attr.id]="'participantRouteReviewCategory-' + option.value"
                  [checked]="view.hasReviewCategory(option.value)"
                  (change)="view.toggleReviewCategory(option.value, $any($event.target).checked)"
                />
                <span>{{ option.label }}</span>
              </label>
            </fieldset>
            <label>
              Comment
              <textarea
                id="participantRouteReviewComment"
                name="participantRouteReviewComment"
                [(ngModel)]="view.reviewComment"
                placeholder="Describe the issue, observation, or recommendation."
              ></textarea>
            </label>
            <div class="actions">
              <button id="participantRouteReviewSaveButton" class="primary" type="button" [disabled]="!view.canSubmitReview" (click)="view.saveReview()">{{ view.reviewActionLabel }}</button>
              <button *ngIf="view.editingReviewId" id="participantRouteReviewCancelButton" class="ghost" type="button" (click)="view.cancelReviewEdit()">Cancel Edit</button>
            </div>
            <p *ngIf="view.reviewFeedback" id="participantRouteReviewFeedback" class="participant-review-feedback" role="status">{{ view.reviewFeedback }}</p>
            <div class="participant-review-list" *ngIf="view.participantReviews.length > 0; else noParticipantReviews">
              <article *ngFor="let review of view.participantReviews" class="participant-review-item" [attr.data-review-id]="review.reviewId">
                <header>
                  <div>
                    <strong>{{ view.reviewTargetLabel(review) }}</strong>
                    <span>{{ view.reviewPriorityLabel(review.priority) }} · {{ view.reviewCategoriesLabel(review) }} · {{ review.reviewerId }}</span>
                    <span>Original unit {{ review.originalUnitId ?? "none" }} · Browser {{ view.reviewBrowserLabel(review) }}</span>
                  </div>
                  <time [attr.datetime]="review.updatedAt">{{ review.updatedAt }}</time>
                </header>
                <p>{{ review.comment }}</p>
                <div class="actions">
                  <button class="secondary" type="button" (click)="view.beginReviewEdit(review)">Edit</button>
                  <button class="ghost" type="button" (click)="view.deleteReview(review)">Delete</button>
                </div>
              </article>
            </div>
            <ng-template #noParticipantReviews>
              <p id="participantRouteReviewEmpty" class="hint">No comments have been added for this run.</p>
            </ng-template>
          </section>
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
          <section
            *ngIf="view.player.timerLifecycleEvent as timerEvent"
            id="participantRouteTimerLifecycleEvent"
            class="participant-timer-lifecycle-event"
            [class.is-expired]="timerEvent.kind === 'expired'"
            [class.is-cancelled]="timerEvent.kind === 'cancelled'"
            role="status"
            aria-live="assertive"
          >
            <span>Timed block</span>
            <strong id="participantRouteTimerLifecycleMessage">{{ timerEvent.message }}</strong>
          </section>
          <section
            *ngIf="view.player.testletTimer as timer"
            id="participantRouteTestletTimer"
            class="participant-testlet-timer"
            [class.is-paused]="timer.status === 'paused'"
            [class.is-warning]="timer.warningMessage"
            aria-live="polite"
          >
            <div>
              <span>Timed Block</span>
              <strong id="participantRouteTestletTimerLabel">{{ timer.displayLabel }}</strong>
              <p id="participantRouteTestletTimerLeave">{{ timer.leaveLabel }}</p>
            </div>
            <div *ngIf="timer.showTimeLeft" class="participant-testlet-timer-value">
              <span>{{ timer.status === "paused" ? "Paused" : "Time remaining" }}</span>
              <strong id="participantRouteTestletTimerValue">{{ timer.remainingLabel }}</strong>
            </div>
            <div *ngIf="timer.showTimeLeft" class="participant-testlet-timer-track" aria-hidden="true">
              <span [style.width.%]="timer.progressPercent"></span>
            </div>
            <p
              *ngIf="timer.warningMessage"
              id="participantRouteTestletTimerWarning"
              class="participant-testlet-timer-warning"
              role="alert"
            >{{ timer.warningMessage }}</p>
          </section>
          <section
            *ngIf="view.player.leaveLock as leaveLock"
            id="participantRouteLeaveLock"
            class="participant-leave-lock"
          >
            <span>Locks after leaving</span>
            <strong id="participantRouteLeaveLockLabel">
              {{ leaveLock.scope === "unit" ? leaveLock.unitDisplayLabel : leaveLock.displayLabel }}
            </strong>
            <p id="participantRouteLeaveLockDetail">{{ leaveLock.detail }}</p>
            <small *ngIf="leaveLock.confirm">You will be asked to confirm before leaving.</small>
          </section>
          <section
            *ngIf="view.player.nextTestletGate as gate"
            class="participant-testlet-gate"
            aria-labelledby="participantRouteTestletGateLabel"
          >
            <div>
              <span>{{ view.customText('booklet_codeToEnterTitle', 'Protected Block') }}</span>
              <strong id="participantRouteTestletGateLabel">{{ gate.displayLabel }}</strong>
              <p id="participantRouteTestletGatePrompt">{{ view.customText('booklet_codeToEnterPrompt', gate.prompt || 'Enter the block code supplied by the test supervisor.') }}</p>
              <small id="participantRouteTestletGateWarning">{{ view.customText('booklet_codeToEnterWarning', 'Letters are entered in uppercase automatically.') }}</small>
            </div>
            <label *ngIf="!view.usesParticipantCodeKeypad">
              Block Code
              <input
                id="participantRouteTestletUnlockCode"
                name="participantRouteTestletUnlockCode"
                type="password"
                autocomplete="off"
                [(ngModel)]="view.testletUnlockCode"
                (ngModelChange)="view.testletUnlockCode = $event.toUpperCase()"
                (keyup.enter)="view.unlockNextTestlet()"
              />
            </label>
            <section
              *ngIf="view.usesParticipantCodeKeypad"
              id="participantRouteTestletUnlockKeypad"
              class="participant-code-keypad"
              role="group"
              aria-label="Block Code"
            >
              <div class="participant-code-slots" aria-live="polite">
                <span *ngFor="let slot of view.participantCodeSlots" [class.is-filled]="slot < view.testletUnlockCode.length">●</span>
              </div>
              <div class="participant-code-keypad-grid">
                <button
                  *ngFor="let option of view.participantCodeKeypadOptions"
                  type="button"
                  [id]="'participantRouteTestletUnlockKeypadValue-' + option.value"
                  [attr.aria-label]="option.label"
                  (click)="view.selectTestletUnlockCodeKeypadValue(option.value)"
                >{{ option.symbol }}</button>
                <button
                  id="participantRouteTestletUnlockKeypadDelete"
                  type="button"
                  class="participant-code-keypad-delete"
                  aria-label="Delete last block code value"
                  [disabled]="!view.testletUnlockCode"
                  (click)="view.removeTestletUnlockCodeKeypadValue()"
                >⌫</button>
              </div>
            </section>
            <button
              id="participantRouteTestletUnlockButton"
              class="primary"
              type="button"
              [disabled]="!view.testletUnlockCode.trim()"
              (click)="view.unlockNextTestlet()"
            >
              {{ view.customText('booketlet_continueButtonLockedUnit', 'Open Block') }}
            </button>
          </section>
          <section
            *ngIf="view.player.navigationNotice"
            id="participantRouteNavigationNotice"
            class="participant-navigation-notice"
            role="status"
          >
            <strong id="participantRouteNavigationNoticeTitle">{{ view.player.navigationNoticeTitle }}</strong>
            <p>{{ view.player.navigationNotice }}</p>
          </section>
          <section class="unit-rail" [attr.aria-label]="view.customText('booklet_tasklisttitle', 'Booklet units')" *ngIf="view.player.showUnitMenu && view.player.unitItems.length > 0">
            <header>
              <div>
                <span id="participantRouteTaskListTitle">{{ view.customText('booklet_tasklisttitle', 'Booklet Units') }}</span>
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
            <span
              *ngIf="view.player.unitNavigationLabel"
              id="participantRouteUnitNavigationLabel"
              class="participant-unit-navigation-label"
              aria-live="polite"
            >{{ view.player.unitNavigationLabel }}</span>
            <button *ngIf="view.player.showPreviousUnitControl" id="participantRoutePreviousUnitButton" class="ghost" type="button" [disabled]="!view.player.canGoPreviousUnit" (click)="view.goToPreviousUnit()">Previous Unit</button>
            <nav
              *ngIf="view.player.showUnitNavigationList"
              id="participantRouteUnitNavigationList"
              class="participant-unit-navigation-list"
              aria-label="Direct unit navigation"
            >
              <button
                *ngFor="let unit of view.player.unitItems"
                type="button"
                class="ghost participant-unit-navigation-item"
                [class.is-current]="unit.isCurrent"
                [class.has-response]="unit.hasResponse"
                [disabled]="!unit.canOpen"
                [attr.data-unit-key]="unit.unitKey"
                [attr.aria-current]="unit.isCurrent ? 'step' : null"
                [attr.aria-label]="unit.accessibilityLabel"
                [attr.title]="unit.accessibilityLabel"
                (click)="view.goToUnit(unit.unitKey)"
              >{{ unit.navigationLabel }}</button>
            </nav>
            <button *ngIf="view.player.showNextUnitControl" id="participantRouteNextUnitButton" class="secondary" type="button" [disabled]="!view.player.canGoNextUnit" (click)="view.goToNextUnit()">Next Unit</button>
            <button class="secondary" type="button" [disabled]="!view.player.canSaveProgress" (click)="view.saveProgressFromPlayer()">{{ view.player.saveProgressLabel }}</button>
            <button class="ghost" type="button" [disabled]="!view.player.canResumeRun" (click)="view.resumeRun()">Resume Run</button>
            <button id="participantRouteCompleteButton" class="ghost" type="button" [disabled]="!view.player.canComplete" (click)="view.completeRun()">{{ view.customText('login_testEndButtonLabel', 'Complete Test') }}</button>
          </div>
          </ng-container>
          <ng-template #participantPaused>
            <section
              id="participantRoutePausedState"
              class="participant-paused-state"
              role="status"
              aria-live="assertive"
            >
              <span>Test paused</span>
              <strong>{{ view.pausedMessage }}</strong>
              <p *ngIf="view.isMonitorPaused">Please wait until your test supervisor continues the test.</p>
              <p *ngIf="!view.isMonitorPaused">Your answers are saved. You can continue when you are ready.</p>
              <button
                *ngIf="view.player.canResumeRun"
                id="participantRouteResumeRunButton"
                class="primary"
                type="button"
                (click)="view.resumeRun()"
              >Continue Test</button>
            </section>
          </ng-template>
          </ng-template>
          </ng-template>
        </div>
      </article>
      <section
        *ngIf="view.confirmationDialog() as confirmation"
        id="participantConfirmationBackdrop"
        class="participant-confirmation-backdrop"
      >
        <article
          class="participant-confirmation-dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="participantConfirmationTitle"
          aria-describedby="participantConfirmationMessage"
        >
          <img
            id="participantConfirmationAsset"
            class="participant-assigned-asset"
            *ngIf="applicationSettings.assetUrl('confirmDialog') as assetUrl"
            [src]="assetUrl"
            alt=""
          />
          <h2 id="participantConfirmationTitle">{{ confirmation.title }}</h2>
          <p id="participantConfirmationMessage">{{ confirmation.message }}</p>
          <div class="actions">
            <button
              id="participantConfirmationStayButton"
              class="secondary"
              type="button"
              autofocus
              (click)="view.resolveConfirmation(false)"
            >{{ confirmation.cancelLabel }}</button>
            <button
              id="participantConfirmationContinueButton"
              class="ghost"
              type="button"
              (click)="view.resolveConfirmation(true)"
            >{{ confirmation.confirmLabel }}</button>
          </div>
        </article>
      </section>
    </div>
  `
})
export class ParticipantViewComponent implements OnInit, OnDestroy {
  readonly view = inject(ParticipantViewFacade);
  readonly applicationSettings = inject(ApplicationSettingsService);

  get preventBrowserNavigation(): boolean {
    return this.view.preventBrowserNavigation;
  }

  notifyBrowserNavigationPrevented(): void {
    this.view.notifyBrowserNavigationPrevented();
  }

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

  ngOnDestroy(): void {
    this.view.destroy();
  }
}
