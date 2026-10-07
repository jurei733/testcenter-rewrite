import { Component, ElementRef, afterRenderEffect, inject, signal, viewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatCard, MatCardContent } from "@angular/material/card";
import { RouterLink } from "@angular/router";
import { ApplicationSettingsService } from "./application-settings.service";
import { ParticipantViewFacade } from "./participant-view.facade";
import { RewriteAppApiService } from "./rewrite-app-api.service";
import { BrowserCompatibilityService } from "./browser-compatibility.service";
import { OriginalLoginNoticeComponent } from "./original-login-notice.component";

@Component({
  selector: "app-original-participant-login",
  standalone: true,
  imports: [FormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatInputModule, MatCard, MatCardContent, OriginalLoginNoticeComponent],
  templateUrl: "./original-participant-login.component.html",
  styleUrls: ["./original-participant-login.component.css", "./original-login-theme.scss"]
})
export class OriginalParticipantLoginComponent {
  readonly view = inject(ParticipantViewFacade);
  readonly settings = inject(ApplicationSettingsService);
  readonly browserCompatibility = inject(BrowserCompatibilityService);
  private readonly api = inject(RewriteAppApiService);
  readonly passwordStep = signal(false);
  readonly busy = signal(false);
  readonly problem = signal("");
  readonly showPassword = signal(false);
  readonly capsLock = signal(false);
  private readonly nameInput = viewChild<ElementRef<HTMLInputElement>>("nameInput");
  private readonly passwordInput = viewChild<ElementRef<HTMLInputElement>>("passwordInput");

  constructor() {
    afterRenderEffect(() => {
      if (this.busy()) return;
      const input = this.passwordStep() ? this.passwordInput() : this.nameInput();
      input?.nativeElement.focus();
    });
  }

  passwordKeyUp(event: KeyboardEvent): void {
    this.capsLock.set(typeof event.getModifierState === "function" && event.getModifierState("CapsLock"));
    this.problem.set("");
  }

  back(): void {
    if (this.busy()) return;
    this.passwordStep.set(false);
    this.view.runtime.participantPassword = "";
    this.problem.set("");
    this.showPassword.set(false);
    this.capsLock.set(false);
  }

  get canSubmit(): boolean {
    return !this.busy() && !this.view.proofOfWorkBusy && this.view.canEnterParticipantCredentials &&
      this.view.runtime.loginKey.trim().length >= 3 &&
      (!this.passwordStep() || !this.view.signInProtectionUnavailable);
  }

  async submit(): Promise<void> {
    if (!this.canSubmit) return;
    const wasPasswordStep = this.passwordStep();
    if (!wasPasswordStep) this.view.runtime.participantPassword = "";
    // Retain the Original name/password presentation without sending even a
    // name-first credential probe when this deployment requires HTTPS.
    if (this.view.signInProtectionUnavailable) {
      this.passwordStep.set(true);
      return;
    }
    this.busy.set(true);
    this.problem.set("");
    this.capsLock.set(false);
    try {
      await this.view.signInFromOriginalInterface();
    } catch (error) {
      const code = this.api.isApiError(error) ? error.error : "";
      if (!wasPasswordStep && ["participant_password_invalid", "participant_login_invalid"].includes(code)) {
        this.passwordStep.set(true);
      } else {
        this.problem.set(code === "participant_login_rate_limited"
          ? "Zu viele Fehlversuche! Probieren Sie es zu einem späteren Zeitpunkt noch einmal."
          : ["participant_password_invalid", "participant_login_invalid"].includes(code)
            ? "Anmeldedaten sind nicht gültig. Bitte noch einmal versuchen!"
            : "Problem bei der Anmeldung. Bitte versuchen Sie es erneut.");
        this.passwordStep.set(false);
        this.view.runtime.loginKey = "";
        this.view.runtime.participantPassword = "";
        this.showPassword.set(false);
      }
    } finally {
      this.busy.set(false);
    }
  }
}
