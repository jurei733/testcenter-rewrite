import { Component, EventEmitter, Input, Output, inject } from "@angular/core";
import type { OnDestroy, OnInit } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { MatButton } from "@angular/material/button";
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from "@angular/material/dialog";
import { MatFormField } from "@angular/material/form-field";
import { MatInput } from "@angular/material/input";
import type { Subscription } from "rxjs";
import { OriginalOverlayStylesComponent } from "./original-overlay-styles.component";
import type { SystemCheckSaveReportDialogResult } from "./system-check-save-report-dialog.component";

type ReportDialogCopy = { aboutPassword: string; aboutReportId: string; reportIdLabel: string };

// Adapted from IQB Testcenter 19 sys-check/report/save-report (MIT).
// See assets/ORIGINAL-UI-LICENSE.txt. Closing returns only form values to the
// shared save controller; this dialog does not authorize or register reports.
@Component({
  selector: "app-original-system-check-save-report-dialog", standalone: true,
  imports: [ReactiveFormsModule, MatButton, MatDialogTitle, MatDialogContent, MatDialogActions, MatFormField, MatInput],
  template: `
    <form id="systemCheckSaveReportBackdrop" [formGroup]="form" (ngSubmit)="submit()">
      <h1 mat-dialog-title id="systemCheckSaveReportTitle">Bericht senden</h1>
      <mat-dialog-content id="systemCheckSaveReportDescription">
        <p>{{ data.aboutPassword }}</p>
        <mat-form-field appearance="outline">
          <input matInput id="systemCheckSaveReportKey" formControlName="key"
            placeholder="Systemcheck-Kennwort" aria-label="Systemcheck-Kennwort"
            type="password" autocomplete="new-password" />
          <!-- The pinned Original does not project its unimported matSuffix
               toggle. Keep that actual rendered UI; Rewrite still has reveal. -->
        </mat-form-field>
        <p>{{ data.aboutReportId }}</p>
        <mat-form-field appearance="outline">
          <input matInput id="systemCheckSaveReportId" formControlName="title"
            [placeholder]="data.reportIdLabel" [attr.aria-label]="data.reportIdLabel" />
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions>
        <button mat-raised-button id="systemCheckSaveReportConfirmButton" type="submit" [disabled]="!canSave">Speichern</button>
        <button mat-raised-button id="systemCheckSaveReportCancelButton" type="button" (click)="dialog.close()">Abbrechen</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: [`
    :host { display:block; min-width:0; }
  `]
})
export class OriginalSystemCheckSaveReportDialogComponent {
  readonly data = inject<ReportDialogCopy>(MAT_DIALOG_DATA);
  readonly dialog = inject<MatDialogRef<OriginalSystemCheckSaveReportDialogComponent, SystemCheckSaveReportDialogResult>>(MatDialogRef);
  readonly form = new FormGroup({
    title: new FormControl("", { nonNullable: true, validators: [Validators.required, Validators.minLength(3)] }),
    key: new FormControl("", { nonNullable: true, validators: [Validators.required, Validators.minLength(3)] })
  });
  get canSave(): boolean { return this.form.valid && this.form.controls.key.value.trim().length >= 3 && this.form.controls.title.value.trim().length >= 3; }
  submit(): void {
    if (this.canSave) this.dialog.close({ key: this.form.controls.key.value, title: this.form.controls.title.value.trim() });
  }
}

@Component({
  selector: "app-original-system-check-save-report", standalone: true,
  imports: [OriginalOverlayStylesComponent], template: `<app-original-overlay-styles />`
})
export class OriginalSystemCheckSaveReportComponent implements OnInit, OnDestroy {
  @Input() aboutPassword = "";
  @Input() aboutReportId = "";
  @Input() reportIdLabel = "Schul-ID";
  @Output() readonly cancel = new EventEmitter<void>();
  @Output() readonly save = new EventEmitter<SystemCheckSaveReportDialogResult>();
  private readonly dialogs = inject(MatDialog);
  private dialog?: MatDialogRef<OriginalSystemCheckSaveReportDialogComponent, SystemCheckSaveReportDialogResult>;
  private closed?: Subscription;
  ngOnInit(): void {
    this.dialog = this.dialogs.open(OriginalSystemCheckSaveReportDialogComponent, {
      width: "500px", height: "600px", maxHeight: "calc(100dvh - 32px)",
      panelClass: "original-system-check-save-report-dialog",
      data: { aboutPassword: this.aboutPassword, aboutReportId: this.aboutReportId, reportIdLabel: this.reportIdLabel },
      ariaLabelledBy: "systemCheckSaveReportTitle", ariaDescribedBy: "systemCheckSaveReportDescription",
      autoFocus: "#systemCheckSaveReportKey"
    });
    this.closed = this.dialog.afterClosed().subscribe(result => {
      if (result) this.save.emit(result);
      else this.cancel.emit();
    });
  }
  ngOnDestroy(): void { this.closed?.unsubscribe(); this.dialog?.close(); }
}
