import { Component, inject } from "@angular/core";
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from "@angular/material/card";
import { MatSidenav, MatSidenavContainer, MatSidenavContent } from "@angular/material/sidenav";
import { OriginalPlayerToolbarComponent } from "./original-player-toolbar.component";
import { ParticipantViewFacade } from "./participant-view.facade";

// Adapted from IQB Testcenter 19 test-status (MIT). See ORIGINAL-UI-LICENSE.txt.
// The shared participant controller continues to own the paused Run.
@Component({
  selector: "app-original-participant-paused",
  standalone: true,
  imports: [
    MatCard, MatCardContent, MatCardHeader, MatCardTitle,
    MatSidenav, MatSidenavContainer, MatSidenavContent, OriginalPlayerToolbarComponent
  ],
  template: `
    <app-original-player-toolbar />
    <mat-sidenav-container>
      <mat-sidenav mode="over" position="end" [opened]="false" />
      <mat-sidenav-content>
        <div class="paused-cards" id="participantRoutePausedState" role="status" aria-live="assertive">
          <mat-card appearance="raised" class="mat-card-box">
            <mat-card-header><mat-card-title>{{ view.player.bookletLabel }}</mat-card-title></mat-card-header>
            <mat-card-content>
              <p><b>Angemeldet als "{{ view.player.displayNameLabel }}"</b></p>
              <p><b>{{ view.player.executionModeLabel }}</b></p>
              <p class="paused-message"><b>{{ view.customText('booklet_pausedmessage') }}</b></p>
            </mat-card-content>
          </mat-card>
        </div>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; flex: 1; min-width: 0; min-height: 0; color: var(--mat-sys-on-surface); font: 16px 'Nunito Sans', sans-serif; }
    mat-sidenav-container { flex: 1; }
    .paused-cards { display: flex; flex-wrap: wrap; justify-content: center; }
    p { margin: 1em 0; font: inherit; color: inherit; }
    b { font-weight: bold; }
    .paused-message { color: chocolate; }
  `],
  styleUrl: "./original-participant-paused-theme.scss"
})
export class OriginalParticipantPausedComponent {
  readonly view = inject(ParticipantViewFacade);
}
