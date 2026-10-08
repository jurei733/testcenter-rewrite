import { Component, afterRenderEffect, inject, signal } from "@angular/core";
import { FocusMonitor } from "@angular/cdk/a11y";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { MatButton } from "@angular/material/button";
import { MatDialogActions, MatDialogContent, MatDialogTitle } from "@angular/material/dialog";
import { MatFormField } from "@angular/material/form-field";
import { MatInput } from "@angular/material/input";
import { PasswordConfirmationDialogComponent } from "./password-confirmation-dialog.component";

// Template/wording adapted from pinned Testcenter 19 ConfirmWithPassword (MIT).
// The shared controller retains the secret, pending/duplicate guards and the
// request-ID-safe callback. This renderer never authorizes or deletes accounts.
@Component({
  selector: "app-original-password-confirmation-dialog", standalone: true,
  imports: [ReactiveFormsModule, MatButton, MatDialogTitle, MatDialogContent, MatDialogActions, MatFormField, MatInput],
  template: `
    @if (confirmation.dialog()?.originalPasswordDialog; as copy) {
      <form id="globalConfirmationBackdrop" data-cy="dialog-change-superadmin" autocomplete="off"
        [formGroup]="form" (ngSubmit)="submit()" (keydown)="handleKeydown($event)" [attr.aria-busy]="busy()">
        <h1 mat-dialog-title id="globalConfirmationTitle">{{ copy.title }}</h1>
        <mat-dialog-content id="globalConfirmationMessage">
          <p>{{ copy.message }}</p>
          <div><p>Bitte geben Sie zur Sicherheit Ihr eigenes Kennwort noch einmal ein.</p></div>
          <p>
            <mat-form-field>
              <input #passwordInput id="globalConfirmationPasswordInput" data-cy="dialog-change-superadmin-pw"
                matInput type="password" placeholder="Kennwort" aria-label="Kennwort" autocomplete="new-password"
                formControlName="pw" [readOnly]="busy()" (input)="updatePassword($event)"
                [attr.aria-invalid]="error() ? 'true' : null"
                [attr.aria-describedby]="error() ? 'globalConfirmationPasswordError' : null" />
            </mat-form-field>
          </p>
          @if (error()) {
            <span id="globalConfirmationPasswordError" data-cy="dialog-change-superadmin-error" role="alert"><div class="alert">
              <div class="vertical-align-middle"><span class="mat-icon alert-error" aria-hidden="true">
                <svg width="100%" height="100%" viewBox="0 -960 960 960" focusable="false"><path d="M508.5-291.5Q520-303 520-320t-11.5-28.5Q497-360 480-360t-28.5 11.5Q440-337 440-320t11.5 28.5Q463-280 480-280t28.5-11.5ZM440-440h80v-240h-80v240Zm40 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z" /></svg>
              </span>
                <span>{{ originalError }}</span></div>
            </div></span>
          }
        </mat-dialog-content>
        <mat-dialog-actions>
          <button #confirmButton mat-raised-button id="globalConfirmationConfirmButton" data-cy="pw-submit"
            type="submit" [disabled]="!canConfirm()">{{ copy.confirmLabel }}</button>
          <button #cancelButton mat-raised-button id="globalConfirmationCancelButton"
            type="button" [disabled]="busy()" (click)="cancel()">Abbrechen</button>
        </mat-dialog-actions>
      </form>
    }
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .alert { margin-bottom: 2px; }
    .vertical-align-middle { display: inline-flex; vertical-align: middle; align-items: center; }
    .alert-error { color: #821324; }
    .mat-icon { display: inline-block; width: 24px; height: 24px; fill: currentColor;
      flex-shrink: 0; margin-right: .2em; overflow: visible !important; }
  `
})
export class OriginalPasswordConfirmationDialogComponent extends PasswordConfirmationDialogComponent {
  readonly form = new FormGroup({ pw: new FormControl("", {
    nonNullable: true, validators: [Validators.required, Validators.minLength(7)]
  }) });
  private readonly focusMonitor = inject(FocusMonitor);
  private readonly retryFocus = signal<{ requestId: number; origin: "mouse" | "keyboard" } | null>(null);
  constructor() {
    super();
    afterRenderEffect(() => {
      const retry = this.retryFocus();
      if (!retry || this.busy() || !this.error()) return;
      if (this.confirmation.dialog()?.requestId === retry.requestId && this.confirmButton) {
        // Wait for Angular to actually re-enable the button, not just the
        // backing signal. A focus() on a still-disabled element is ignored.
        this.focusMonitor.focusVia(this.confirmButton.nativeElement, retry.origin);
      }
      this.retryFocus.set(null);
    });
  }
  override canConfirm(): boolean { return super.canConfirm() && this.passwordValue().length >= 7; }
  override cancel(): void {
    if (!this.busy()) this.form.reset({ pw: "" }, { emitEvent: false });
    super.cancel();
  }
  override ngOnDestroy(): void {
    this.form.reset({ pw: "" }, { emitEvent: false });
    super.ngOnDestroy();
  }
  override async submit(): Promise<void> {
    const requestId = this.confirmation.dialog()?.requestId;
    const fromButton = document.activeElement === this.confirmButton?.nativeElement;
    const origin = this.confirmButton?.nativeElement.classList?.contains("cdk-keyboard-focused") ? "keyboard" : "mouse";
    await super.submit();
    if (this.confirmation.dialog()?.requestId !== requestId) this.form.reset({ pw: "" }, { emitEvent: false });
    // Source leaves a clicked submit focused on an expected password error.
    // During the pending request, the shared controller still focuses the
    // readonly secret input so disabling buttons cannot release dialog focus.
    if (fromButton && requestId !== undefined && this.error() && this.confirmation.dialog()?.requestId === requestId && !this.busy()) {
      this.retryFocus.set({ requestId, origin });
    }
  }
  override handleKeydown(event: KeyboardEvent): void {
    // Material/CDK traps the actual Original DOM order (submit, then cancel).
    // The Native renderer has the opposite order and its own manual trap.
    if (event.key !== "Tab") super.handleKeydown(event);
  }
  get originalError(): string {
    return this.error() === "Incorrect current administrator password. Please try again."
      ? "Falsches Kennwort."
      : "Die Aktion konnte nicht abgeschlossen werden. Bitte prüfen Sie die Auswahl und versuchen Sie es erneut.";
  }
}
