import { Component, inject } from "@angular/core";
import { MatIconButton } from "@angular/material/button";
import { MAT_DIALOG_DATA, MatDialogClose, MatDialogContent, MatDialogTitle } from "@angular/material/dialog";
import { OriginalOverlayStylesComponent } from "./original-overlay-styles.component";
import { OriginalParticipantConfirmationLauncherComponent } from "./original-participant-confirmation-dialog.component";
import type { ParticipantConfirmationDialog } from "./participant-view.facade";

// Adapted from the pinned Original InfoDialog and its close SVG. The shared
// controller owns denial; closing this surface cannot approve a navigation.
@Component({
  selector: "app-original-participant-information-dialog", standalone: true,
  host: { id: "participantConfirmationBackdrop" },
  imports: [MatIconButton, MatDialogClose, MatDialogContent, MatDialogTitle, OriginalOverlayStylesComponent],
  template: `<app-original-overlay-styles />
    <div class="header-line">
      <h2 mat-dialog-title id="participantConfirmationTitle">{{ data.title }}</h2>
      <button matIconButton mat-dialog-close aria-label="Schließen" data-cy="close-deny-navigation-message">
        <span class="mat-icon close-icon" aria-hidden="true"><svg height="24px" viewBox="0 -960 960 960" width="24px" focusable="false"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" /></svg></span>
      </button>
    </div>
    <mat-dialog-content><p id="participantConfirmationMessage" data-cy="deny-navigation-message"> {{ data.message }}</p></mat-dialog-content>`,
  styles: `app-original-overlay-styles { display: none; }
    .header-line { display: flex; flex-direction: row; justify-content: space-between; align-items: center; padding-top: 20px; padding-right: 25px; }
    .header-line .mdc-icon-button { color: var(--mat-sys-primary); border: 1px solid var(--mat-sys-primary); border-radius: 12px; font: 24px Arial; }
    :host ::ng-deep .header-line .mat-mdc-button-persistent-ripple { border-radius: inherit; }
    mat-dialog-content.mat-mdc-dialog-content { padding-top: 10px; }
    .mdc-dialog__title::before { height: auto; }
    .close-icon { display: inline-block; width: 24px; height: auto; fill: currentColor; overflow: hidden; user-select: none; background-repeat: no-repeat; position: relative; }
    .close-icon svg { display: inline; }`
})
export class OriginalParticipantInformationDialogComponent {
  readonly data = inject<NonNullable<ParticipantConfirmationDialog["original"]>>(MAT_DIALOG_DATA);
}

@Component({selector: "app-original-participant-information-launcher", standalone: true, template: ""})
export class OriginalParticipantInformationLauncherComponent extends OriginalParticipantConfirmationLauncherComponent {
  protected override readonly dialogComponent = OriginalParticipantInformationDialogComponent;
}
