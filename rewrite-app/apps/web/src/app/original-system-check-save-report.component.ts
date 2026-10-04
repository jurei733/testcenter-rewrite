import { Component, EventEmitter, Input, Output, inject } from "@angular/core";
import type { OnDestroy, OnInit } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { MatButton, MatIconButton } from "@angular/material/button";
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from "@angular/material/dialog";
import { MatFormField, MatSuffix } from "@angular/material/form-field";
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
  imports: [ReactiveFormsModule, MatButton, MatIconButton, MatDialogTitle, MatDialogContent, MatDialogActions, MatFormField, MatInput, MatSuffix],
  template: `
    <form id="systemCheckSaveReportBackdrop" [formGroup]="form" (ngSubmit)="submit()">
      <h1 mat-dialog-title id="systemCheckSaveReportTitle">Bericht senden</h1>
      <mat-dialog-content id="systemCheckSaveReportDescription">
        <p>{{ data.aboutPassword }}</p>
        <mat-form-field appearance="outline">
          <input matInput id="systemCheckSaveReportKey" formControlName="key"
            placeholder="Systemcheck-Kennwort" aria-label="Systemcheck-Kennwort"
            [type]="showPassword ? 'text' : 'password'" autocomplete="new-password" />
          <button mat-icon-button matSuffix id="systemCheckSaveReportPasswordToggle" type="button"
            [attr.aria-label]="showPassword ? 'Kennwort verbergen' : 'Kennwort anzeigen'"
            [attr.aria-pressed]="showPassword" (click)="showPassword = !showPassword">
            <svg aria-hidden="true" focusable="false" viewBox="0 -960 960 960">
              @if (showPassword) {
                <path d="M480-320q75 0 127.5-52.5T660-500q0-75-52.5-127.5T480-680q-75 0-127.5 52.5T300-500q0 75 52.5 127.5T480-320Zm0-72q-45 0-76.5-31.5T372-500q0-45 31.5-76.5T480-608q45 0 76.5 31.5T588-500q0 45-31.5 76.5T480-392Zm0 192q-146 0-266-81.5T40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200Zm0-80q113 0 207.5-59.5T832-500q-50-101-144.5-160.5T480-720q-113 0-207.5 59.5T128-500q50 101 144.5 160.5T480-280Z" />
              } @else {
                <path d="m644-428-58-58q9-47-27-81t-83-27l-58-58q14-5 29-7t33-1q75 0 127.5 52.5T660-480q0 18-3 31t-13 21Zm128 126-58-56q38-29 67.5-63.5T832-480q-50-101-144.5-160.5T480-700q-29 0-57 4t-55 12l-62-62q41-17 84.5-25.5T480-780q146 0 266 81.5T920-480q-23 59-60.5 103.5T772-302Zm20 246L624-222q-35 11-70.5 16.5T480-200q-146 0-266-81.5T40-500q21-53 55-97t78-79L56-792l56-56 736 736-56 56ZM230-620q-32 24-57.5 54T128-500q50 101 144.5 160.5T480-280q23 0 45-2.5t43-7.5l-72-72q-4 1-8 1.5t-8 .5q-75 0-127.5-52.5T300-540q0-4 .5-8t1.5-8l-72-64Z" />
              }
            </svg>
          </button>
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
    svg { width:24px; height:24px; fill:currentColor; }
  `]
})
export class OriginalSystemCheckSaveReportDialogComponent {
  readonly data = inject<ReportDialogCopy>(MAT_DIALOG_DATA);
  readonly dialog = inject<MatDialogRef<OriginalSystemCheckSaveReportDialogComponent, SystemCheckSaveReportDialogResult>>(MatDialogRef);
  readonly form = new FormGroup({
    title: new FormControl("", { nonNullable: true, validators: [Validators.required, Validators.minLength(3)] }),
    key: new FormControl("", { nonNullable: true, validators: [Validators.required, Validators.minLength(3)] })
  });
  showPassword = false;
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
