import { Component, Input, inject, signal } from "@angular/core";
import type { OnDestroy } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { MatButton } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatFormField, MatLabel } from "@angular/material/form-field";
import { MatInput } from "@angular/material/input";
import { RouterLink } from "@angular/router";
import { OpsViewFacade } from "./ops-view.facade";
import { RewriteAppApiService } from "./rewrite-app-api.service";
import { OriginalEntrySurfaceStylesComponent } from "./original-entry-surface-styles.component";

// Adapted from pinned IQB Testcenter 19 AdminLogin (MIT); see ORIGINAL-UI-LICENSE.txt.
// Only presentation is local. The parent calls the same authorized operator
// sign-in, proof-of-work, session persistence and guarded return navigation.
@Component({
  selector: "app-original-admin-login", standalone: true,
  imports: [ReactiveFormsModule, MatButton, MatCardModule, MatFormField, MatLabel,
    MatInput, RouterLink, OriginalEntrySurfaceStylesComponent],
  template: `
    <app-original-entry-surface-styles />
    <div id="originalAdminLogin" class="login-wrapper">
      <form [formGroup]="form" (ngSubmit)="submit()" [style.display]="'flex'" [attr.aria-busy]="busy()">
        <mat-card appearance="raised">
          <mat-card-header><mat-card-title>Admin-Bereich</mat-card-title></mat-card-header>
          <mat-card-content>
            <mat-form-field appearance="outline">
              <mat-label>Anmeldename</mat-label>
              <input id="adminUsername" matInput formControlName="name" autocapitalize="off"
                autocomplete="username" [readOnly]="busy()" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Kennwort</mat-label>
              <input id="adminPassword" matInput formControlName="pw" type="password"
                autocomplete="current-password" [readOnly]="busy()" (keyup)="passwordKeyUp($event)" />
            </mat-form-field>
            @if (problem()) {
              <span [attr.data-cy]="'login-problem:' + problemCode()" role="alert"><div class="alert">
                <div class="vertical-align-middle"><span class="mat-icon" [class.alert-warning]="warning()"
                    [class.alert-error]="!warning()" aria-hidden="true">
                  <svg width="100%" height="100%" viewBox="0 -960 960 960" focusable="false">
                    @if (warning()) {
                      <path d="m40-120 440-760 440 760H40Zm138-80h604L480-720 178-200Zm302-40q17 0 28.5-11.5T520-280q0-17-11.5-28.5T480-320q-17 0-28.5 11.5T440-280q0 17 11.5 28.5T480-240Zm-40-120h80v-200h-80v200Zm40-100Z" />
                    } @else {
                      <path d="M508.5-291.5Q520-303 520-320t-11.5-28.5Q497-360 480-360t-28.5 11.5Q440-337 440-320t11.5 28.5Q463-280 480-280t28.5-11.5ZM440-440h80v-240h-80v240Zm40 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z" />
                    }
                  </svg>
                </span><span>{{ problem() }}</span></div>
              </div></span>
            }
          </mat-card-content>
          <mat-card-actions [style.justify-content]="'space-between'">
            <button id="adminSignInButton" matButton="filled" type="submit" data-cy="login-admin"
              [disabled]="form.invalid || busy() || view.proofOfWorkBusy">Anmelden</button>
          </mat-card-actions>
        </mat-card>
      </form>
      <div class="button-box">
        <a routerLink="/participant" matButton="tonal" data-cy="login-testtaker-form">Testtakerbereich</a>
      </div>
    </div>
  `,
  styleUrls: ["./original-admin-login.component.css", "./original-login-theme.scss"]
})
export class OriginalAdminLoginComponent implements OnDestroy {
  private static oldLoginName = "";
  readonly view = inject(OpsViewFacade);
  private readonly api = inject(RewriteAppApiService);
  @Input({ required: true }) authenticate!: () => Promise<void>;
  readonly form = new FormGroup({
    name: new FormControl(OriginalAdminLoginComponent.oldLoginName, {
      nonNullable: true, validators: [Validators.required, Validators.minLength(3)]
    }),
    pw: new FormControl("", { nonNullable: true, validators: [Validators.required] })
  });
  readonly busy = signal(false);
  readonly problem = signal("");
  readonly problemCode = signal(0);
  readonly warning = signal(false);
  private destroyed = false;

  passwordKeyUp(event: KeyboardEvent): void {
    if (this.busy()) return;
    this.problem.set(""); this.problemCode.set(0); this.warning.set(false);
    if (typeof event.getModifierState === "function" && event.getModifierState("CapsLock")) {
      this.problem.set("Feststelltaste ist aktiviert!"); this.warning.set(true);
    }
  }

  async submit(): Promise<void> {
    if (this.destroyed || this.busy() || this.form.invalid || this.view.proofOfWorkBusy) return;
    const { name, pw } = this.form.getRawValue();
    OriginalAdminLoginComponent.oldLoginName = name;
    this.view.ops.adminUsername = name;
    this.view.ops.adminPassword = pw;
    this.busy.set(true); this.problem.set(""); this.problemCode.set(0); this.warning.set(false);
    try {
      await this.authenticate();
    } catch (error) {
      if (this.destroyed) return;
      const code = this.api.isApiError(error) ? error.error : "";
      // Rewrite HTTP 401 means invalid credentials, not Source's scheduled
      // access. Map semantic error identifiers, never blindly map HTTP codes.
      const known = {
        admin_credentials_invalid: [400, "Anmeldedaten sind nicht gültig. Bitte noch einmal versuchen!"],
        admin_username_required: [400, "Anmeldedaten sind nicht gültig. Bitte noch einmal versuchen!"],
        admin_access_not_started: [401, "Anmeldung abgelehnt. Anmeldedaten sind noch nicht freigeben."],
        admin_access_expired: [410, "Anmeldedaten sind abgelaufen"],
        admin_login_rate_limited: [429, "Zu viele Fehlversuche! Probieren Sie es zu einem späteren Zeitpunkt noch einmal."]
      } as const;
      const problem = known[code as keyof typeof known];
      this.problemCode.set(problem?.[0] ?? 0);
      this.problem.set(problem?.[1] ?? "Problem bei der Anmeldung.");
      this.form.reset({ name: "", pw: "" });
    } finally {
      this.form.controls.pw.setValue("");
      // A destroyed view may have been replaced by a different login. Do not
      // erase that replacement's secret when this old promise settles.
      if (!this.destroyed) this.view.ops.adminPassword = "";
      this.busy.set(false);
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.form.controls.pw.setValue("");
    this.view.ops.adminPassword = "";
  }
}
