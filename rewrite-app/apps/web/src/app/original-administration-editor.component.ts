import { ChangeDetectorRef, Component, inject } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { MatButton } from "@angular/material/button";
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from "@angular/material/dialog";
import { MatFormField, MatLabel, MatError } from "@angular/material/form-field";
import { MatInput } from "@angular/material/input";
import { AppShellFacade } from "./app-shell.facade";

export type OriginalAdministrationEditorData = {
  kind: "create-user" | "create-workspace" | "rename-workspace" | "reset-password";
  name?: string;
  submit: (value: { name:string; password:string }) => Promise<string | null>;
};

// Source new-user/new-workspace/edit-workspace forms, backed by the same
// production password policy and authorization as the Rewrite renderer.
@Component({
  selector:"app-original-administration-editor",standalone:true,
  imports:[ReactiveFormsModule,MatButton,MatDialogActions,MatDialogContent,MatDialogTitle,MatFormField,MatInput,MatLabel,MatError],
  template:`
    <form [formGroup]="form" (ngSubmit)="submit()" [attr.aria-busy]="busy">
      <h1 mat-dialog-title>{{ title }}</h1>
      <mat-dialog-content>
        @if (data.kind !== 'reset-password') {
          <mat-form-field>
            @if (data.kind === 'create-user') { <mat-label>Name</mat-label> }
            <input matInput id="originalAdministrationName" data-cy="new-user-name" formControlName="name"
              placeholder="Name" autocomplete="off" [readonly]="busy" />
            @if (form.controls.name.hasError('minlength')) { <mat-error>Mindestlänge für den Namen ist 3 Zeichen.</mat-error> }
          </mat-form-field>
        }
        @if (hasPassword) {
          <mat-form-field>
            <mat-label>Kennwort</mat-label>
            <input matInput id="originalAdministrationPassword" data-cy="new-user-password" type="password"
              formControlName="password" placeholder="Kennwort" autocomplete="new-password" [readonly]="busy" />
            @if (form.controls.password.hasError('passwordPolicy')) { <mat-error>{{ passwordError }}</mat-error> }
          </mat-form-field>
        }
        @if (data.kind === 'create-workspace') {
          <p>Nach dem Anlegen des Arbeitsbereiches können Sie die Zugriffsrechte zuweisen.</p>
        }
        @if (problem) { <p id="originalAdministrationEditorError" role="alert">{{ problem }}</p> }
      </mat-dialog-content>
      <mat-dialog-actions>
        <button mat-raised-button id="originalAdministrationEditorSave" data-cy="new-user-submit"
          type="submit" [disabled]="form.invalid || busy">Speichern</button>
        <button mat-raised-button id="originalAdministrationEditorCancel" type="button" [disabled]="busy"
          (click)="dialog.close(false)">Abbrechen</button>
      </mat-dialog-actions>
    </form>`,
  styles:[`mat-form-field { width:100%; } [role=alert] { color:var(--mat-sys-error); }`]
})
export class OriginalAdministrationEditorComponent {
  readonly data = inject<OriginalAdministrationEditorData>(MAT_DIALOG_DATA);
  readonly dialog = inject(MatDialogRef<OriginalAdministrationEditorComponent>);
  private readonly app = inject(AppShellFacade);
  private readonly changed = inject(ChangeDetectorRef);
  private destroyed = false;
  readonly hasPassword = this.data.kind==="create-user" || this.data.kind==="reset-password";
  readonly form = new FormGroup({
    name:new FormControl(this.data.name ?? "",{nonNullable:true,
      validators:this.data.kind==="reset-password"?[]:[Validators.required,...(this.data.kind==="create-user"?[Validators.minLength(3)]:[])]}),
    password:new FormControl("",{nonNullable:true,validators:this.hasPassword
      ?[Validators.required,control=>this.app.getAdminPasswordViolation(control.value)===null?null:{passwordPolicy:true}]:[]})
  });
  busy = false;
  problem = "";
  get title(): string {
    return this.data.kind==="create-user"?"Administrator:in hinzufügen"
      :this.data.kind==="create-workspace"?"Neuer Arbeitsbereich"
      :this.data.kind==="reset-password"?`Kennwort für "${this.data.name}" ändern`
      :`Arbeitsbereich "${this.data.name}" ändern`;
  }
  get passwordError(): string {
    const violation = this.app.getAdminPasswordViolation(this.form.controls.password.value);
    return violation==="minimum_length"?`Mindestlänge für das Kennwort ist ${this.app.adminPasswordMinimumLength} Zeichen.`
      :violation==="maximum_length"?`Maximallänge für das Kennwort ist ${this.app.adminPasswordMaximumLength} Zeichen.`
      :`Kennwort muss dem RegEx-Muster ${this.app.adminPasswordPattern} entsprechen.`;
  }
  async submit(): Promise<void> {
    if (this.busy || this.form.invalid) return;
    this.busy = true; this.problem = ""; this.dialog.disableClose = true;
    try {
      const problem = await this.data.submit(this.form.getRawValue()) ?? "";
      if (this.destroyed) return;
      this.problem = problem;
      if (!this.problem) { this.form.reset(); this.dialog.close(true); }
    } catch {
      if (!this.destroyed) this.problem = "Die Aktion konnte nicht abgeschlossen werden. Bitte versuchen Sie es erneut.";
    } finally {
      if (!this.destroyed) { this.busy = false; this.dialog.disableClose = false; this.changed.markForCheck(); }
    }
  }
  ngOnDestroy(): void { this.destroyed = true; this.form.reset(); }
}
