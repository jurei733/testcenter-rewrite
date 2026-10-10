import { Component, EventEmitter, Input, Output, inject } from "@angular/core";
import type { OnDestroy, OnInit, Type } from "@angular/core";
import { MatButton } from "@angular/material/button";
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle } from "@angular/material/dialog";
import type { MatDialogRef } from "@angular/material/dialog";
import type { Subscription } from "rxjs";
import { OriginalOverlayStylesComponent } from "./original-overlay-styles.component";
import type { ParticipantConfirmationDialog } from "./participant-view.facade";

type DialogCopy = NonNullable<ParticipantConfirmationDialog["original"]> & { safeMode: boolean };

// Adapted from the current Original shared confirm-dialog (MIT). Button order
// and the reversed restriction result are presentation, not a second action.
@Component({
  selector: "app-original-participant-confirmation-dialog", standalone: true,
  host: { id: "participantConfirmationBackdrop" },
  imports: [MatButton, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle, OriginalOverlayStylesComponent],
  template: `<app-original-overlay-styles />
    <h2 mat-dialog-title id="participantConfirmationTitle" data-cy="dialog-title">{{ data.title }}</h2>
    <mat-dialog-content data-cy="dialog-content"><p id="participantConfirmationMessage">{{ data.message }}</p></mat-dialog-content>
    <mat-dialog-actions align="start">
      @if (data.safeMode) {
        <button matButton="filled" [id]="cancelId" data-cy="dialog-cancel" [mat-dialog-close]="false">{{ data.cancelLabel }}</button>
        <button matButton="outlined" [id]="confirmId" data-cy="dialog-confirm" [mat-dialog-close]="true">{{ data.confirmLabel }}</button>
      } @else {
        <button matButton="outlined" [id]="confirmId" data-cy="dialog-confirm" [mat-dialog-close]="true">{{ data.confirmLabel }}</button>
        <button matButton="outlined" [id]="cancelId" data-cy="dialog-cancel" [mat-dialog-close]="false">{{ data.cancelLabel }}</button>
      }
    </mat-dialog-actions>`,
  styles: [`app-original-overlay-styles { display: none; }`]
})
export class OriginalParticipantConfirmationDialogComponent {
  readonly data = inject<DialogCopy>(MAT_DIALOG_DATA);
  get cancelId(): string { return this.data.confirmMeansContinue ? "participantConfirmationStayButton" : "participantConfirmationContinueButton"; }
  get confirmId(): string { return this.data.confirmMeansContinue ? "participantConfirmationContinueButton" : "participantConfirmationStayButton"; }
}

@Component({ selector: "app-original-participant-confirmation-launcher", standalone: true, template: "" })
export class OriginalParticipantConfirmationLauncherComponent implements OnInit, OnDestroy {
  private static readonly focusOrigins = new WeakMap<MatDialog, WeakRef<HTMLElement>>();
  @Input({ required: true }) confirmation!: ParticipantConfirmationDialog;
  @Output() readonly closed = new EventEmitter<boolean>();
  private readonly dialogs = inject(MatDialog);
  protected readonly dialogComponent: Type<unknown> = OriginalParticipantConfirmationDialogComponent;
  private dialog?: MatDialogRef<unknown, boolean>;
  private subscription?: Subscription;
  ngOnInit(): void {
    const copy = this.confirmation.original ?? { ...this.confirmation, confirmMeansContinue: true };
    const activeElement = document.activeElement as HTMLElement | null;
    const focusOrigin = activeElement?.closest(".original-participant-confirmation-dialog")
      ? OriginalParticipantConfirmationLauncherComponent.focusOrigins.get(this.dialogs)?.deref()
      : activeElement;
    if (focusOrigin) OriginalParticipantConfirmationLauncherComponent.focusOrigins.set(this.dialogs, new WeakRef(focusOrigin));
    this.dialog = this.dialogs.open(this.dialogComponent, {
      // Keep Material's generated ID: a replaced dialog may still be closing.
      panelClass: "original-participant-confirmation-dialog",
      data: { ...copy, safeMode: document.documentElement.dataset["applicationTheme"] === "Primar" },
      autoFocus: "dialog", restoreFocus: false,
      ariaLabelledBy: "participantConfirmationTitle", ariaDescribedBy: "participantConfirmationMessage"
    });
    this.subscription = this.dialog.afterClosed().subscribe(result => {
      // A replacement must restore the original trigger, not its detached
      // predecessor. Destroyed launchers unsubscribe before closing theirs.
      if (this.dialogs.openDialogs.length === 0) {
        OriginalParticipantConfirmationLauncherComponent.focusOrigins.delete(this.dialogs);
        if (focusOrigin?.isConnected) focusOrigin.focus();
      }
      this.closed.emit(typeof result === "boolean" && result === copy.confirmMeansContinue);
    });
  }
  ngOnDestroy(): void { this.subscription?.unsubscribe(); this.dialog?.close(); }
}
