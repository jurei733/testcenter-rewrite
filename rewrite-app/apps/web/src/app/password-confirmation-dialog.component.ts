import { Component, ElementRef, ViewChild, inject, signal } from "@angular/core";
import type { AfterViewInit, OnDestroy } from "@angular/core";
import { ConfirmationDialogService } from "./confirmation-dialog.service";

// Loaded only for irreversible account/workspace operations. Keep password
// storage local and reauthorize through the existing application services.
@Component({
  selector: "app-password-confirmation-dialog",
  standalone: true,
  template: `
    @if (confirmation.dialog(); as dialog) {
      <section id="globalConfirmationBackdrop" class="backdrop" (keydown)="handleKeydown($event)">
        <article id="globalConfirmationDialog" role="alertdialog" aria-modal="true"
          aria-labelledby="globalConfirmationTitle" aria-describedby="globalConfirmationMessage"
          [attr.aria-busy]="busy()">
          <span class="eyebrow">Confirm action</span>
          <h2 id="globalConfirmationTitle">{{ dialog.title }}</h2>
          <p id="globalConfirmationMessage">{{ dialog.message }}</p>
          @if (dialog.verification; as verification) {
            <label for="globalConfirmationVerificationInput">
              <span>{{ verification.label }}</span>
              <input #verificationInput id="globalConfirmationVerificationInput" type="text"
                autocomplete="off" autocapitalize="off" spellcheck="false" [readOnly]="busy()"
                [value]="verificationValue()" (input)="verificationValue.set(value($event))" />
              <small>Type <code>{{ verification.expectedValue }}</code> to continue.</small>
            </label>
          }
          <label for="globalConfirmationPasswordInput">
            <span>Current administrator password</span>
            <input #passwordInput id="globalConfirmationPasswordInput" type="password"
              autocomplete="current-password" maxlength="60" [readOnly]="busy()"
              [value]="passwordValue()" (input)="updatePassword($event)"
              [attr.aria-invalid]="error() ? 'true' : null"
              [attr.aria-describedby]="error() ? 'globalConfirmationPasswordError' : null" />
          </label>
          @if (error()) { <p id="globalConfirmationPasswordError" class="error" role="alert">{{ error() }}</p> }
          <div class="actions">
            <button #cancelButton id="globalConfirmationCancelButton" class="secondary" type="button"
              [disabled]="busy()" (click)="cancel()">{{ dialog.cancelLabel }}</button>
            <button #confirmButton id="globalConfirmationConfirmButton" class="danger" type="button"
              [disabled]="!canConfirm()" (click)="submit()">{{ busy() ? 'Please wait …' : dialog.confirmLabel }}</button>
          </div>
        </article>
      </section>
    }
  `,
  styles: `
    .backdrop { position: fixed; z-index: 1100; inset: 0; display: grid; place-items: center;
      padding: 24px; background: rgba(20, 35, 38, .72); backdrop-filter: blur(5px); }
    article { display: grid; gap: 18px; width: min(100%, 560px); max-height: calc(100dvh - 48px);
      overflow: auto; padding: clamp(24px, 5vw, 42px); border: 1px solid var(--line);
      border-radius: var(--radius-xl); background: var(--surface, #fff); color: var(--ink);
      box-shadow: 0 28px 80px rgba(8, 22, 25, .36); }
    h2, p { margin: 0; }
    p { color: var(--muted); line-height: 1.5; white-space: pre-line; }
    label { display: grid; gap: 8px; font-weight: 700; }
    input { width: 100%; box-sizing: border-box; }
    small { color: var(--muted); font-weight: 500; line-height: 1.4; }
    code { color: var(--text, var(--ink)); overflow-wrap: anywhere; }
    .error { color: #a12020; }
  `
})
export class PasswordConfirmationDialogComponent implements AfterViewInit, OnDestroy {
  readonly confirmation = inject(ConfirmationDialogService);
  readonly passwordValue = signal("");
  readonly verificationValue = signal("");
  readonly busy = signal(false);
  readonly error = signal("");
  @ViewChild("verificationInput", { read: ElementRef }) private verificationInput?: ElementRef<HTMLInputElement>;
  @ViewChild("passwordInput", { read: ElementRef }) private passwordInput?: ElementRef<HTMLInputElement>;
  @ViewChild("cancelButton", { read: ElementRef }) private cancelButton?: ElementRef<HTMLButtonElement>;
  @ViewChild("confirmButton", { read: ElementRef }) protected confirmButton?: ElementRef<HTMLButtonElement>;

  ngAfterViewInit(): void {
    (this.verificationInput ?? this.passwordInput)?.nativeElement.focus();
  }
  ngOnDestroy(): void { this.passwordValue.set(""); this.error.set(""); }
  cancel(): void {
    if (this.busy()) return;
    this.passwordValue.set("");
    this.error.set("");
    this.confirmation.resolve(false);
  }
  value(event: Event): string { return (event.target as HTMLInputElement).value; }
  updatePassword(event: Event): void {
    if (this.busy()) return;
    this.passwordValue.set(this.value(event));
    this.error.set("");
  }
  canConfirm(): boolean {
    const dialog = this.confirmation.dialog();
    return !this.busy() && Boolean(dialog?.passwordSubmit) && this.passwordValue() !== ""
      && this.passwordValue().length <= 60
      && (!dialog?.verification || this.verificationValue() === dialog.verification.expectedValue);
  }
  async submit(): Promise<void> {
    const dialog = this.confirmation.dialog();
    if (!this.canConfirm() || !dialog?.passwordSubmit) return;
    this.busy.set(true);
    this.error.set("");
    // Disabled action buttons must not move focus outside a pending dialog.
    this.passwordInput?.nativeElement.focus();
    try {
      const problem = await dialog.passwordSubmit(this.passwordValue());
      if (this.confirmation.dialog()?.requestId !== dialog.requestId) return;
      if (problem) this.error.set(problem);
      else { this.passwordValue.set(""); this.confirmation.resolve(true); }
    } catch {
      if (this.confirmation.dialog()?.requestId === dialog.requestId) {
        this.error.set("The action could not be completed. Check the retained selection before trying again.");
      }
    } finally {
      if (this.confirmation.dialog()?.requestId === dialog.requestId) this.busy.set(false);
    }
  }
  handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      this.cancel();
      return;
    }
    if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
      event.preventDefault();
      void this.submit();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [this.verificationInput?.nativeElement, this.passwordInput?.nativeElement,
      this.cancelButton?.nativeElement, this.confirmButton?.nativeElement]
      .filter((element): element is HTMLInputElement | HTMLButtonElement => Boolean(element && !element.disabled));
    if (event.shiftKey && document.activeElement === focusable[0]) {
      event.preventDefault(); focusable.at(-1)?.focus();
    } else if (!event.shiftKey && document.activeElement === focusable.at(-1)) {
      event.preventDefault(); focusable[0]?.focus();
    }
  }
}
