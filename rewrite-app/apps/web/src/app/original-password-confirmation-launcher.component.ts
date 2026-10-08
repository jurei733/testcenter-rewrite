import { Component, EventEmitter, Output, inject } from "@angular/core";
import type { OnInit, OnDestroy } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import type { MatDialogRef } from "@angular/material/dialog";
import type { Subscription } from "rxjs";
import { ConfirmationDialogService } from "./confirmation-dialog.service";
import { OriginalOverlayStylesComponent } from "./original-overlay-styles.component";
import type { OriginalPasswordConfirmationDialogComponent } from "./original-password-confirmation-dialog.component";

@Component({
  selector: "app-original-password-confirmation-launcher", standalone: true,
  imports: [OriginalOverlayStylesComponent], template: `<app-original-overlay-styles />`
})
export class OriginalPasswordConfirmationLauncherComponent implements OnInit, OnDestroy {
  @Output() readonly failed = new EventEmitter<void>();
  private readonly confirmation = inject(ConfirmationDialogService);
  private readonly dialogs = inject(MatDialog);
  private dialog?: MatDialogRef<OriginalPasswordConfirmationDialogComponent>;
  private closed?: Subscription;
  private destroyed = false;
  async ngOnInit(): Promise<void> {
    const request = this.confirmation.dialog();
    if (!request?.originalPasswordDialog || !request.passwordSubmit || request.verification) return;
    let component: typeof OriginalPasswordConfirmationDialogComponent;
    try { component = (await import("./original-password-confirmation-dialog.component")).OriginalPasswordConfirmationDialogComponent; }
    catch {
      if (!this.destroyed && this.confirmation.dialog()?.requestId === request.requestId) this.failed.emit();
      return;
    }
    if (this.destroyed || this.confirmation.dialog()?.requestId !== request.requestId) return;
    this.dialog = this.dialogs.open(component, {
      id: "globalConfirmationDialog", width: "600px", role: "alertdialog",
      panelClass: "original-password-confirmation-dialog",
      ariaLabelledBy: "globalConfirmationTitle", ariaDescribedBy: "globalConfirmationMessage",
      autoFocus: "#globalConfirmationPasswordInput",
      // Backdrop/Escape retain normal Material behavior until a real request
      // is pending. Then neither may dismiss or duplicate an irreversible action.
      closePredicate: (_result, _config, component) =>
        !(component as OriginalPasswordConfirmationDialogComponent | null)?.busy()
    });
    this.closed = this.dialog.afterClosed().subscribe(() => {
      if (this.confirmation.dialog()?.requestId === request.requestId) this.confirmation.resolve(false);
    });
  }
  ngOnDestroy(): void {
    this.destroyed = true;
    this.closed?.unsubscribe();
    // A replaced request must close its stale overlay even if its server
    // callback is still outstanding. That callback is request-ID guarded.
    if (this.dialog) { this.dialog.componentInstance?.busy.set(false); this.dialog.close(); }
  }
}
