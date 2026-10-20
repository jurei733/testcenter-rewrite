import { Component, Input } from "@angular/core";
import type { AppComponent } from "./app.component";

// Render the existing password controller only when a password flow is open.
// Validation, credentials, session revocation and cleanup stay in that controller.
export type AdminPasswordDialogHost = Pick<AppComponent,
  "app" |
  "requiredAdminPassword" |
  "requiredAdminPasswordConfirmation" |
  "requiredAdminPasswordError" |
  "ownAdminPasswordDialogOpen" |
  "currentAdminPassword" |
  "ownAdminPassword" |
  "ownAdminPasswordConfirmation" |
  "ownAdminPasswordError" |
  "adminPasswordMinimumLength" |
  "adminPasswordMaximumLength" |
  "adminPasswordPattern" |
  "canSubmitRequiredAdminPassword" |
  "submitRequiredAdminPassword" |
  "updateRequiredAdminPassword" |
  "updateRequiredAdminPasswordConfirmation" |
  "signOutRequiredAdmin" |
  "canSubmitOwnAdminPassword" |
  "submitOwnAdminPassword" |
  "updateCurrentAdminPassword" |
  "updateOwnAdminPassword" |
  "updateOwnAdminPasswordConfirmation" |
  "closeOwnAdminPasswordDialog">;
@Component({
  selector:"app-admin-password-dialogs",standalone:true,
  templateUrl:"./admin-password-dialogs.component.html",styleUrl:"./admin-password-dialogs.component.css"
})
export class AdminPasswordDialogsComponent {
  @Input({required:true}) host!: AdminPasswordDialogHost;
}
