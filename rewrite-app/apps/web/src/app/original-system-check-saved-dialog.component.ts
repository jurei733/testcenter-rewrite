import { Component, EventEmitter, Input, Output, inject } from "@angular/core";
import type { OnDestroy, OnInit } from "@angular/core";
import { MatButton } from "@angular/material/button";
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from "@angular/material/dialog";
import type { Subscription } from "rxjs";
import { OriginalOverlayStylesComponent } from "./original-overlay-styles.component";
import { RewriteAppOperatorAccessService } from "./rewrite-app-operator-access.service";

type SavedReportCopy = { title: string; message: string; safeMode: boolean };

// Adapted from IQB Testcenter 19 shared confirm-dialog and MessageService (MIT).
// This acknowledgement has no destructive action: the report is already saved
// and either close result continues the shared controller's return to Start.
@Component({
  selector: "app-original-system-check-saved-dialog", standalone: true,
  imports: [MatButton, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle, OriginalOverlayStylesComponent],
  template: `
    <app-original-overlay-styles />
    <h2 mat-dialog-title id="globalConfirmationTitle" data-cy="dialog-title">{{ data.title }}</h2>
    <mat-dialog-content data-cy="dialog-content"><p id="globalConfirmationMessage">{{ data.message }}</p></mat-dialog-content>
    <mat-dialog-actions align="start">
      @if (data.safeMode) {
        <button matButton="filled" id="globalConfirmationCancelButton" data-cy="dialog-cancel" [mat-dialog-close]="false">Abbrechen</button>
        <button matButton="outlined" id="globalConfirmationConfirmButton" data-cy="dialog-confirm" [mat-dialog-close]="true">Bestätigen</button>
      } @else {
        <button matButton="outlined" id="globalConfirmationConfirmButton" data-cy="dialog-confirm" [mat-dialog-close]="true">Bestätigen</button>
        <button matButton="outlined" id="globalConfirmationCancelButton" data-cy="dialog-cancel" [mat-dialog-close]="false">Abbrechen</button>
      }
    </mat-dialog-actions>
  `
})
export class OriginalSystemCheckSavedDialogComponent {
  readonly data = inject<SavedReportCopy>(MAT_DIALOG_DATA);
}

@Component({ selector: "app-original-system-check-saved-dialog-launcher", standalone: true, template: "" })
export class OriginalSystemCheckSavedDialogLauncherComponent implements OnInit, OnDestroy {
  @Input() title = "";
  @Input() message = "";
  @Output() readonly closed = new EventEmitter<boolean>();
  private readonly dialogs = inject(MatDialog);
  private readonly operatorAccess = inject(RewriteAppOperatorAccessService);
  private dialog?: MatDialogRef<OriginalSystemCheckSavedDialogComponent, boolean>;
  private subscription?: Subscription;
  ngOnInit(): void {
    const operatorMode = this.operatorAccess.mode;
    const isAdultOperator = operatorMode !== "signed_out" && operatorMode !== "system_check";
    this.dialog = this.dialogs.open(OriginalSystemCheckSavedDialogComponent, {
      panelClass: "original-system-check-saved-dialog",
      data: { title: this.title, message: this.message, safeMode: !isAdultOperator && (document.documentElement.dataset["applicationTheme"] ?? "Primar") === "Primar" },
      autoFocus: "dialog", ariaLabelledBy: "globalConfirmationTitle", ariaDescribedBy: "globalConfirmationMessage"
    });
    this.subscription = this.dialog.afterClosed().subscribe(result => this.closed.emit(result === true));
  }
  ngOnDestroy(): void { this.subscription?.unsubscribe(); this.dialog?.close(); }
}
