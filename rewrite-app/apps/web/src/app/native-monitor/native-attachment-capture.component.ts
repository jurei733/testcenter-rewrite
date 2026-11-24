import { BreakpointObserver, Breakpoints } from "@angular/cdk/layout";
import { Component, effect, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { MatButton, MatIconButton } from "@angular/material/button";
import { MatCheckbox } from "@angular/material/checkbox";
import { MatFormField, MatLabel } from "@angular/material/form-field";
import { MatOption, MatSelect } from "@angular/material/select";
import { MatSidenavModule } from "@angular/material/sidenav";
import { RouterLink } from "@angular/router";
import { AttachmentCaptureComponent } from "../attachment-capture.component";
import { NativeMonitorIconComponent } from "./native-monitor-icon.component";

// Attachment layout adapted from IQB Testcenter. See ORIGINAL-UI-LICENSE.txt.
@Component({
  selector: "app-native-attachment-capture",
  imports: [
    FormsModule, MatButton, MatCheckbox, MatFormField, MatIconButton, MatLabel,
    MatOption, MatSelect, MatSidenavModule, NativeMonitorIconComponent, RouterLink
  ],
  templateUrl: "./native-attachment-capture.component.html",
  styleUrl: "./native-attachment-capture.component.css"
})
export class NativeAttachmentCaptureComponent extends AttachmentCaptureComponent {
  readonly mobile = toSignal(
    inject(BreakpointObserver).observe([Breakpoints.Medium, Breakpoints.Small, Breakpoints.XSmall]),
    { requireSync: true }
  );
  readonly sidebarOpen = signal(!this.mobile().matches);
  private resumeRequestedCamera = false;

  constructor() {
    super();
    effect(() => { this.sidebarOpen.set(!this.mobile().matches); });
  }

  async requestCamera(): Promise<void> {
    await this.startCamera();
    this.resumeRequestedCamera = this.cameraActive;
  }

  stopRequestedCamera(): void {
    this.resumeRequestedCamera = false;
    this.stopCamera();
  }

  override resetTarget(): void {
    super.resetTarget(this.resumeRequestedCamera);
  }
}
