import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { ApplicationSettingsService } from "./application-settings.service";
import { ParticipantViewFacade } from "./participant-view.facade";
import { RewriteAppApiService } from "./rewrite-app-api.service";
import { BrowserCompatibilityService } from "./browser-compatibility.service";

@Component({
  selector: "app-original-participant-login",
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: "./original-participant-login.component.html",
  styleUrl: "./original-participant-login.component.css"
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

  back(): void {
    if (this.busy()) return;
    this.passwordStep.set(false);
    this.view.runtime.participantPassword = "";
    this.problem.set("");
    this.showPassword.set(false);
  }

  async submit(): Promise<void> {
    if (this.busy() || !this.view.canSignIn || this.view.runtime.loginKey.trim().length < 3) return;
    const wasPasswordStep = this.passwordStep();
    if (!wasPasswordStep) this.view.runtime.participantPassword = "";
    this.busy.set(true);
    this.problem.set("");
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
