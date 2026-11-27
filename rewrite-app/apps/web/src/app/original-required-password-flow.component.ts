import { HttpErrorResponse, HttpHeaders } from "@angular/common/http";
import { Component, inject, type AfterViewInit, type OnDestroy } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { MatButton } from "@angular/material/button";
import {
  MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle
} from "@angular/material/dialog";
import { MatError, MatFormField, MatLabel } from "@angular/material/form-field";
import { MatInput } from "@angular/material/input";
import { redactBugReportText } from "@testcenter-rewrite-app/contracts";
import type { OriginalAdminAccessSet } from "@testcenter-rewrite-app/contracts/original-session";
import { firstValueFrom } from "rxjs";

import { AppShellFacade } from "./app-shell.facade";
import { nativeRequestError } from "./native-participant/native-http-policy";
import { NativeLoginErrorDialogComponent } from "./native-login-error-dialog.component";
import { createOriginalAdministrationTransport, OriginalAdministrationHttpError } from "./original-administration-http";
import { OriginalParticipantConfirmationDialogComponent } from "./original-participant-confirmation-dialog.component";
import { OriginalToastContainerComponent } from "./original-toast-container.component";
import { OriginalToastService } from "./original-toast.service";
import { RewriteAppShellPersistenceService } from "./rewrite-app-shell-persistence.service";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";

type PasswordChange = { oldPassword: string; p: string };

// Adapted from Original NewPasswordComponent, see assets/ORIGINAL-UI-LICENSE.txt.
@Component({
  selector: "app-original-required-password-dialog",
  imports: [ReactiveFormsModule, MatButton, MatDialogActions, MatDialogClose, MatDialogContent,
    MatDialogTitle, MatError, MatFormField, MatInput, MatLabel],
  styles: [`mat-dialog-content { display: flex; flex-direction: column; }`],
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()">
      <h2 mat-dialog-title>Kennwort ändern für Benutzer: {{ username }}</h2>
      <mat-dialog-content>
        <mat-form-field>
          <mat-label>Aktuelles Kennwort</mat-label>
          <input matInput data-cy="newPasswordForm-used-pw" type="password" formControlName="oldPassword"
            placeholder="Aktuelles Kennwort" autocomplete="current-password" />
          @if (form.controls.oldPassword.invalid && (form.controls.oldPassword.dirty || form.controls.oldPassword.touched)) {
            <mat-error>Bitte geben Sie Ihr aktuelles Kennwort ein.</mat-error>
          }
        </mat-form-field>
        <mat-form-field>
          <mat-label>Kennwort</mat-label>
          <input matInput data-cy="newPasswordForm-new-pw" type="password" formControlName="p" placeholder="Kennwort" />
          @if (form.controls.p.invalid && (form.controls.p.dirty || form.controls.p.touched)) {
            @if (form.controls.p.hasError('minlength')) {
              <mat-error>Mindestlänge für das Kennwort ist {{ app.adminPasswordMinimumLength }} Zeichen.</mat-error>
            }
            @if (form.controls.p.hasError('pattern')) {
              <mat-error>Kennwort muss dem RegEx-Muster {{ app.adminPasswordPattern }} entsprechen.</mat-error>
            }
          }
        </mat-form-field>
        <mat-form-field>
          <mat-label>Kennwort wiederholen</mat-label>
          <input matInput data-cy="newPasswordForm-confirm-pw" type="password" formControlName="confirmation"
            placeholder="Kennwort wiederholen" />
        </mat-form-field>
        @if (form.hasError('samePassword') && form.controls.p.dirty && form.controls.confirmation.dirty) {
          <mat-error>Die Kennwörter stimmen nicht überein.</mat-error>
        }
      </mat-dialog-content>
      <mat-dialog-actions>
        <button matButton type="submit" data-cy="newPasswordForm-submit" [disabled]="form.invalid">Bestätigen</button>
        <button matButton type="button" mat-dialog-close>Abbrechen</button>
      </mat-dialog-actions>
    </form>`
})
export class OriginalRequiredPasswordDialogComponent implements OnDestroy {
  readonly username = inject<string>(MAT_DIALOG_DATA);
  readonly app = inject(AppShellFacade);
  private readonly dialog = inject<MatDialogRef<OriginalRequiredPasswordDialogComponent, PasswordChange>>(MatDialogRef);
  private readonly newPasswordValidators = [
    Validators.required,
    Validators.minLength(this.app.adminPasswordMinimumLength),
    Validators.pattern(new RegExp(this.app.adminPasswordPattern))
  ];
  readonly form = new FormGroup({
    oldPassword: new FormControl("", { nonNullable: true, validators: Validators.required }),
    p: new FormControl("", { nonNullable: true, validators: this.newPasswordValidators }),
    confirmation: new FormControl("", { nonNullable: true, validators: this.newPasswordValidators })
  }, { validators: ({ value }) => value.p === value.confirmation ? null : { samePassword: true } });

  submit(): void {
    if (this.form.invalid) return;
    const { oldPassword, p } = this.form.getRawValue();
    this.dialog.close({ oldPassword, p });
  }

  ngOnDestroy(): void {
    this.form.reset();
  }
}

@Component({
  selector: "app-original-required-password-flow",
  imports: [OriginalToastContainerComponent],
  providers: [OriginalToastService],
  template: `<app-original-toast-container />`
})
export class OriginalRequiredPasswordFlowComponent implements AfterViewInit, OnDestroy {
  private readonly app = inject(AppShellFacade);
  private readonly state = inject(RewriteAppUiStateService);
  private readonly persistence = inject(RewriteAppShellPersistenceService);
  private readonly dialogs = inject(MatDialog);
  private readonly toasts = inject(OriginalToastService);
  private readonly request = createOriginalAdministrationTransport();
  private readonly owner = new AbortController();
  private readonly token = this.state.ops.adminSessionToken;
  private readonly ownerGeneration = this.state.adminSessionOwnerGeneration();
  private readonly login = this.app.operatorAccountUsername;
  private dialog?: MatDialogRef<unknown>;
  private renewedToken?: string;

  private get current(): boolean {
    return !this.owner.signal.aborted &&
      this.state.adminSessionOwnerGeneration() === this.ownerGeneration &&
      this.state.ops.adminSessionToken === this.token;
  }

  ngAfterViewInit(): void {
    void this.run();
  }

  private async run(): Promise<void> {
    try {
      const notice = this.dialogs.open<OriginalParticipantConfirmationDialogComponent, unknown, boolean>(
        OriginalParticipantConfirmationDialogComponent, {
          panelClass: "original-participant-confirmation-dialog", autoFocus: "dialog",
          data: {
            title: "Ihr Kennwort wurde vom Administrator zurückgesetzt",
            message: "Sie müssen im nächsten Schritt ein neues Kennwort vergeben.",
            confirmLabel: "Bestätigen", cancelLabel: "Abbrechen", confirmMeansContinue: true, safeMode: false
          }
        });
      this.dialog = notice;
      const confirmed = await firstValueFrom(notice.afterClosed());
      if (!this.current) return;
      if (!confirmed) {
        await this.signOut();
        return;
      }

      const { value } = await this.request("GET", "/session", undefined, this.token, this.owner.signal);
      if (!this.current) return;
      const access = value as OriginalAdminAccessSet;
      if (access?.token !== this.token) throw new Error("Die Sitzung hat sich geändert.");
      const form = this.dialogs.open<OriginalRequiredPasswordDialogComponent, string, PasswordChange>(
        OriginalRequiredPasswordDialogComponent, {
          panelClass: "original-required-password-dialog", width: "600px", data: access.displayName ?? this.login
        });
      this.dialog = form;
      const password = await firstValueFrom(form.afterClosed());
      if (!this.current) return;
      if (password) {
        // Read an acknowledged write even if the view is retired, so the
        // response's replacement token can be revoked without touching a new login.
        const { authToken } = await this.request("PATCH", "/user/" + access.id + "/password",
          password, this.token, new AbortController().signal);
        if (!authToken) throw new Error("Die erneuerte Sitzung fehlt.");
        if (!this.current) {
          this.revoke(authToken);
          return;
        }
        this.renewedToken = authToken;
      }
      this.toasts.show(password
        ? "Kennwort erfolgreich geändert. Sie werden abgemeldet."
        : "Fehler beim Ändern des Kennworts. Sie werden abgemeldet.",
      () => { void this.signOut().catch(error => this.showError(error)); });
    } catch (error) {
      this.showError(error);
    }
  }

  private async signOut(): Promise<void> {
    if (!this.current) return;
    await this.request("DELETE", "/session", undefined, this.renewedToken ?? this.token, this.owner.signal);
    this.renewedToken = undefined;
    this.reloadLogin(true);
  }

  private showError(error: unknown): void {
    if (!this.current) return;
    const response = error instanceof OriginalAdministrationHttpError ? error.response : undefined;
    const mapped = nativeRequestError(error instanceof OriginalAdministrationHttpError ? new HttpErrorResponse({
      status: error.statusCode, error: error.message, statusText: response?.statusText, url: response?.url,
      headers: new HttpHeaders({
        ...(response?.errorId ? { "error-id": response.errorId } : {}),
        ...(response?.testMode ? { "test-mode": response.testMode } : {})
      })
    }) : error);
    mapped.description = redactBugReportText(mapped.description);
    mapped.details = redactBugReportText(mapped.details ?? "");
    this.dialog = this.dialogs.open(NativeLoginErrorDialogComponent, {
      panelClass: "original-native-login-error-dialog", disableClose: true, autoFocus: "dialog", ariaLabel: mapped.label,
      data: {
        error: mapped, url: redactBugReportText(window.location.href), timestamp: Date.now(), login: this.login,
        reload: () => this.reloadLogin(mapped.type === "session" || this.renewedToken !== undefined)
      }
    });
  }

  private reloadLogin(clearSession: boolean): void {
    if (!this.current) return;
    if (clearSession) {
      this.state.setAdminSessionToken("");
      this.state.ops.adminSessionView = "";
      try { this.persistence.persistShellState(); } catch { /* In-memory session is already retired. */ }
    }
    window.location.replace(new URL(clearSession ? "native-start/login" : "operator-start?ui=original", document.baseURI));
  }

  private revoke(token: string): void {
    void this.request("DELETE", "/session", undefined, token, new AbortController().signal).catch(() => {});
  }

  ngOnDestroy(): void {
    this.owner.abort();
    const dialog = this.dialog;
    if (dialog?.componentInstance instanceof OriginalRequiredPasswordDialogComponent) {
      dialog.componentInstance.form.reset();
    }
    dialog?.close();
    if (this.renewedToken) this.revoke(this.renewedToken);
  }
}
