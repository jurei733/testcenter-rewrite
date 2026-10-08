import { Component, inject } from "@angular/core";
import { MatButton } from "@angular/material/button";
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle } from "@angular/material/dialog";
import { ApplicationSettingsService } from "./application-settings.service";

// Adapted from IQB Testcenter 19's confirm dialog and header logout template (MIT).
@Component({
  selector: "app-original-participant-logout-dialog",
  standalone: true,
  imports: [MatButton, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle],
  template: `
    <h2 mat-dialog-title id="originalParticipantLogoutTitle" data-cy="dialog-title">Sicher, dass du dich abmelden möchtest?</h2>
    <mat-dialog-content data-cy="dialog-content">
      <div class="logout-dialog">
        <p id="originalParticipantLogoutMessage">Du bist dabei, dich abzumelden.<br>
          Willst du lieber weitermachen?<br>
          Dann drücke einfach auf <b>Hier bleiben!</b>
        </p>
        <img [src]="settings.assetUrl('confirmDialog')" alt="" />
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="start">
      @if (data.safeMode) {
        <button matButton="filled" [mat-dialog-close]="false" id="originalParticipantLogoutCancelButton" data-cy="dialog-cancel">Hier bleiben</button>
        <button matButton="outlined" [mat-dialog-close]="true" id="originalParticipantLogoutConfirmButton" data-cy="dialog-confirm">Abmelden</button>
      } @else {
        <button matButton="outlined" [mat-dialog-close]="true" id="originalParticipantLogoutConfirmButton" data-cy="dialog-confirm">Abmelden</button>
        <button matButton="outlined" [mat-dialog-close]="false" id="originalParticipantLogoutCancelButton" data-cy="dialog-cancel">Hier bleiben</button>
      }
    </mat-dialog-actions>
  `,
  styles: [`
    .logout-dialog { display: flex; justify-content: space-between; align-items: center; }
    .logout-dialog img { width: 141px; height: 141px; object-fit: contain; }
  `]
})
export class OriginalParticipantLogoutDialogComponent {
  readonly data = inject<{ safeMode: boolean }>(MAT_DIALOG_DATA);
  readonly settings = inject(ApplicationSettingsService);
}
