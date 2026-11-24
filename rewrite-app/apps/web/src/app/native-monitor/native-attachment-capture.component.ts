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
import { originalAttachmentTextFallbacks } from "../attachment-custom-texts";
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
  readonly captureOptionsOpen = signal(false);
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

  get cameraInstructions(): string {
    const key = "am_capture_image_instructions";
    const defaultInstructions = originalAttachmentTextFallbacks[key];
    const instructions = this.customText(key, defaultInstructions);
    return this.cameraGeometry?.mirrored && instructions === defaultInstructions
      ? "Halten Sie die Seite so in die Kamera, dass der aufgedruckte QR-Code in der oberen rechten Ecke liegt"
      : instructions;
  }

  openCaptureOptions(): void {
    this.sidebarOpen.set(true);
    this.captureOptionsOpen.set(true);
  }

  override resetTarget(): void {
    super.resetTarget(this.resumeRequestedCamera);
  }

  protected override onCameraStartFailure(error: unknown): void {
    super.onCameraStartFailure(error);
    this.resumeRequestedCamera = false;
    switch (error instanceof DOMException ? error.name : "") {
      case "NotAllowedError":
        this.status = "Kamerazugriff verweigert. Prüfen Sie die Kameraberechtigung im Browser.";
        break;
      case "NotFoundError":
        this.status = "Keine Kamera gefunden. Schließen Sie eine Kamera an und versuchen Sie es erneut.";
        break;
      case "NotReadableError":
        this.status = "Die Kamera ist nicht verfügbar. Schließen Sie andere Anwendungen, die die Kamera nutzen.";
        break;
      default:
        this.status = "Die Kamera konnte nicht gestartet werden.";
    }
  }
}
