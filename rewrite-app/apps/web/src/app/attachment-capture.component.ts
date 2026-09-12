import { CommonModule } from "@angular/common";
import {
  Component,
  ElementRef,
  ViewChild,
  inject
} from "@angular/core";
import type { AfterViewInit, OnDestroy } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";
import QrScanner from "qr-scanner";

import type { WorkspaceAttachment } from "@testcenter-rewrite-app/domain";

import { AttachmentManagerService } from "./attachment-manager.service";
import { RewriteAppOperatorAccessService } from "./rewrite-app-operator-access.service";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";

type AttachmentScope = {
  sessionToken: string;
  tenantKey: string;
  workspaceKey: string;
};

@Component({
  selector: "app-attachment-capture",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  styles: [`
    :host { display: block; }
    .capture-card { overflow: hidden; }
    .capture-intro { max-width: 70ch; color: var(--muted); }
    .capture-grid { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(18rem, .75fr); gap: 1rem; }
    .camera-shell { position: relative; min-height: 24rem; display: grid; place-items: center; overflow: hidden; border-radius: var(--radius-lg); background: #101519; color: #fff; }
    .camera-shell video { display: block; width: 100%; max-height: 70vh; object-fit: contain; transition: opacity .15s ease; }
    .camera-shell:not(.is-active) video { opacity: 0; }
    .camera-placeholder { position: absolute; inset: 0; display: grid; place-items: center; padding: 2rem; text-align: center; }
    .camera-shell.is-active .camera-placeholder { display: none; }
    .scan-frame { position: absolute; inset: 12% 16%; border: 3px solid rgba(255, 255, 255, .9); border-radius: 1rem; box-shadow: 0 0 0 999px rgba(0, 0, 0, .22); pointer-events: none; }
    .capture-controls { display: grid; gap: .9rem; align-content: start; }
    .capture-panel { padding: 1rem; border: 1px solid var(--line); border-radius: var(--radius-lg); background: rgba(255, 255, 255, .62); }
    .capture-panel h2, .capture-panel h3 { margin-top: 0; }
    .capture-code { overflow-wrap: anywhere; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .78rem; }
    .capture-preview { display: block; width: 100%; max-height: 62vh; object-fit: contain; border-radius: var(--radius-md); border: 1px solid var(--line); background: #eef0f2; }
    .capture-status { min-height: 1.5rem; }
    .capture-status.is-error { color: #8b2419; }
    .scope-line { display: flex; flex-wrap: wrap; gap: .5rem; color: var(--muted); font-size: .9rem; }
    .scope-line span { overflow-wrap: anywhere; }
    input[type="file"] { width: 100%; }
    @media (max-width: 820px) {
      .capture-grid { grid-template-columns: 1fr; }
      .camera-shell { min-height: 18rem; }
    }
  `],
  template: `
    <article id="attachmentCaptureCard" class="card capture-card">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Original Attachment Manager flow</span>
          <h2>Scan, capture, confirm</h2>
        </div>
        <span class="status-pill">Server-scoped</span>
      </div>
      <p class="capture-intro">
        Point the camera at the QR code on a printed attachment page. The code
        selects the participant slot; the image is uploaded only after you
        confirm the scoped participant, booklet, unit, and variable.
      </p>
      <p class="scope-line">
        <span><strong>Tenant:</strong> {{ tenantKey || 'not selected' }}</span>
        <span><strong>Workspace:</strong> {{ workspaceKey || 'not selected' }}</span>
      </p>

      <section class="capture-panel" *ngIf="!hasSessionScope">
        <h3>Operator session and workspace required</h3>
        <p>Sign in as an administrator or monitor, select the workspace, then reopen camera capture.</p>
        <div class="actions">
          <a class="button-link primary" routerLink="/ops">Open operator sign-in</a>
          <a class="button-link secondary" routerLink="/runtime">Open runtime scope</a>
        </div>
      </section>

      <ng-container *ngIf="hasSessionScope">
        <div class="capture-grid">
          <section>
            <div class="camera-shell" [class.is-active]="cameraActive">
              <video #cameraVideo id="attachmentCaptureVideo" playsinline muted></video>
              <div class="camera-placeholder">
                <p>{{ cameraMessage || 'Start the rear camera or use the QR-image and manual-code fallbacks.' }}</p>
              </div>
              <div class="scan-frame" *ngIf="cameraActive" aria-hidden="true"></div>
            </div>
            <canvas #captureCanvas hidden></canvas>
            <div class="actions">
              <button id="startAttachmentCameraButton" class="primary" type="button" [disabled]="busy || cameraActive" (click)="startCamera()">Start camera</button>
              <button id="stopAttachmentCameraButton" class="ghost" type="button" [disabled]="!cameraActive" (click)="stopCamera()">Stop camera</button>
              <button id="toggleAttachmentFlashButton" class="ghost" type="button" [disabled]="!cameraActive || !hasFlash" (click)="toggleFlash()">{{ flashOn ? 'Turn flash off' : 'Turn flash on' }}</button>
            </div>
            <label *ngIf="cameras.length > 1">
              Camera
              <select id="attachmentCameraSelect" [(ngModel)]="selectedCameraId" (change)="selectCamera()">
                <option *ngFor="let camera of cameras" [value]="camera.id">{{ camera.label || camera.id }}</option>
              </select>
            </label>
          </section>

          <section class="capture-controls">
            <div class="capture-panel">
              <h3>1. Resolve QR code</h3>
              <label>
                Scan a saved QR image
                <input id="attachmentQrImageInput" type="file" accept="image/png,image/jpeg,image/webp" [disabled]="busy" (change)="scanQrImage($event)" />
              </label>
              <label>
                Or enter the printed attachment code
                <input id="attachmentCaptureCode" type="text" autocomplete="off" [(ngModel)]="attachmentCode" (keyup.enter)="resolveCode()" />
              </label>
              <div class="actions">
                <button id="resolveAttachmentCodeButton" class="secondary" type="button" [disabled]="busy || !attachmentCode.trim()" (click)="resolveCode()">Resolve code</button>
              </div>
            </div>

            <div id="attachmentCaptureTarget" class="capture-panel" *ngIf="attachment as target">
              <h3>2. Confirm target</h3>
              <p><strong>{{ target.personLabel }}</strong></p>
              <p>{{ target.groupKey }} / {{ target.loginKey }}</p>
              <p>{{ target.testLabel }}</p>
              <p>{{ target.unitLabel }} · {{ target.variableId }}</p>
              <p class="capture-code">{{ target.attachmentId }}</p>
              <span class="status-pill">{{ target.dataType }}</span>
            </div>

            <div class="capture-panel" *ngIf="attachment && canCaptureTarget">
              <h3>3. Capture page</h3>
              <div class="actions">
                <button id="captureAttachmentFrameButton" class="secondary" type="button" [disabled]="busy || !cameraActive" (click)="captureCurrentFrame()">Capture camera frame</button>
              </div>
              <label>
                Or take/select a photo
                <input id="attachmentCaptureFileInput" type="file" accept="image/png,image/jpeg" capture="environment" [disabled]="busy" (change)="selectCaptureFile($event)" />
              </label>
              <img id="attachmentCapturePreview" class="capture-preview" *ngIf="capturePreviewUrl" [src]="capturePreviewUrl" alt="Attachment page ready to upload" />
            </div>

            <div class="capture-panel" *ngIf="attachment && canCaptureTarget && captureBlob">
              <h3>4. Upload confirmed image</h3>
              <div class="actions">
                <button id="uploadCapturedAttachmentButton" class="primary" type="button" [disabled]="busy || !canWrite" (click)="uploadCapture()">{{ busy ? 'Uploading…' : 'Upload attachment' }}</button>
                <button class="ghost" type="button" [disabled]="busy" (click)="clearCapture()">Retake</button>
              </div>
              <p *ngIf="!canWrite">This operator session does not have write access. The server will not accept an upload.</p>
            </div>
          </section>
        </div>

        <p id="attachmentCaptureStatus" class="capture-status" [class.is-error]="statusIsError" role="status" aria-live="polite">{{ status }}</p>
        <div class="actions">
          <button id="resetAttachmentCaptureButton" class="ghost" type="button" [disabled]="busy" (click)="resetTarget()">Scan another page</button>
          <a class="button-link secondary" routerLink="/runtime">Back to Attachment Manager</a>
        </div>
      </ng-container>
    </article>
  `
})
export class AttachmentCaptureComponent
  implements AfterViewInit, OnDestroy
{
  @ViewChild("cameraVideo")
  private readonly cameraVideo!: ElementRef<HTMLVideoElement>;

  @ViewChild("captureCanvas")
  private readonly captureCanvas!: ElementRef<HTMLCanvasElement>;

  private readonly manager = inject(AttachmentManagerService);
  private readonly uiState = inject(RewriteAppUiStateService);
  private readonly operatorAccess = inject(RewriteAppOperatorAccessService);
  private readonly route = inject(ActivatedRoute);
  private scanner: QrScanner | null = null;
  private scanInProgress = false;

  attachmentCode = "";
  attachment: WorkspaceAttachment | null = null;
  captureBlob: Blob | null = null;
  captureFileName = "";
  capturePreviewUrl: string | null = null;
  cameras: QrScanner.Camera[] = [];
  selectedCameraId = "";
  cameraActive = false;
  cameraMessage = "";
  hasFlash = false;
  flashOn = false;
  busy = false;
  status = "Scan a QR code or enter an attachment code to begin.";
  statusIsError = false;

  get tenantKey(): string {
    return this.uiState.workspace.tenantKey.trim();
  }

  get workspaceKey(): string {
    return this.uiState.workspace.workspaceKey.trim();
  }

  get hasSessionScope(): boolean {
    return Boolean(
      this.uiState.ops.adminSessionToken.trim() &&
      this.tenantKey &&
      this.workspaceKey
    );
  }

  get canWrite(): boolean {
    return (
      this.hasSessionScope &&
      !this.operatorAccess.isReadOnlyAdmin &&
      !this.operatorAccess.isSystemCheckOnly
    );
  }

  get canCaptureTarget(): boolean {
    return this.attachment?.attachmentType === "capture-image";
  }

  ngAfterViewInit(): void {
    const initialCode = this.route.snapshot.queryParamMap.get("code")?.trim();
    if (initialCode && this.hasSessionScope) {
      this.attachmentCode = initialCode;
      void this.resolveCode();
    }
  }

  ngOnDestroy(): void {
    this.destroyScanner();
    this.clearCapture();
  }

  async startCamera(): Promise<void> {
    if (this.busy || this.cameraActive || !this.hasSessionScope) return;
    this.cameraMessage = "Requesting camera access…";
    this.statusIsError = false;
    try {
      this.destroyScanner();
      this.scanner = new QrScanner(
        this.cameraVideo.nativeElement,
        result => void this.handleScannedCode(result.data),
        {
          preferredCamera: this.selectedCameraId || "environment",
          highlightScanRegion: false,
          highlightCodeOutline: true,
          maxScansPerSecond: 8,
          returnDetailedScanResult: true
        }
      );
      await this.scanner.start();
      this.cameraActive = true;
      this.cameraMessage = "";
      this.status = "Camera active. Align the printed QR code inside the frame.";
      this.cameras = await QrScanner.listCameras(true).catch(() => []);
      if (!this.selectedCameraId && this.cameras[0]) {
        this.selectedCameraId = this.cameras[0].id;
      }
      this.hasFlash = await this.scanner.hasFlash().catch(() => false);
    } catch (error) {
      this.destroyScanner();
      this.cameraMessage = this.describeCameraError(error);
      this.status = "Camera unavailable. Use a saved QR image or the manual code fallback.";
      this.statusIsError = true;
    }
  }

  stopCamera(): void {
    this.scanner?.stop();
    this.cameraActive = false;
    this.flashOn = false;
    this.hasFlash = false;
    this.status = "Camera stopped. The QR-image and manual-code fallbacks remain available.";
    this.statusIsError = false;
  }

  async selectCamera(): Promise<void> {
    if (!this.scanner || !this.selectedCameraId) return;
    try {
      await this.scanner.setCamera(this.selectedCameraId);
      this.hasFlash = await this.scanner.hasFlash().catch(() => false);
      this.flashOn = this.scanner.isFlashOn();
    } catch (error) {
      this.status = this.describeCameraError(error);
      this.statusIsError = true;
    }
  }

  async toggleFlash(): Promise<void> {
    if (!this.scanner || !this.hasFlash) return;
    try {
      await this.scanner.toggleFlash();
      this.flashOn = this.scanner.isFlashOn();
    } catch (error) {
      this.status = this.describeCameraError(error);
      this.statusIsError = true;
    }
  }

  async scanQrImage(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file || this.busy) return;
    this.busy = true;
    this.statusIsError = false;
    try {
      const result = await QrScanner.scanImage(file, {
        alsoTryWithoutScanRegion: true,
        returnDetailedScanResult: true
      });
      this.attachmentCode = result.data.trim();
      await this.resolveCodeInternal();
    } catch (error) {
      this.status =
        error === QrScanner.NO_QR_CODE_FOUND
          ? "No QR code was found in that image."
          : this.describeCameraError(error);
      this.statusIsError = true;
    } finally {
      this.busy = false;
    }
  }

  async resolveCode(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.statusIsError = false;
    try {
      await this.resolveCodeInternal();
    } finally {
      this.busy = false;
    }
  }

  async captureCurrentFrame(): Promise<void> {
    const video = this.cameraVideo.nativeElement;
    if (!this.cameraActive || !video.videoWidth || !video.videoHeight) {
      this.status = "The camera does not have a frame ready yet.";
      this.statusIsError = true;
      return;
    }
    const canvas = this.captureCanvas.nativeElement;
    const pageRatio = 210 / 297;
    let sourceWidth = video.videoWidth;
    let sourceHeight = sourceWidth / pageRatio;
    if (sourceHeight > video.videoHeight) {
      sourceHeight = video.videoHeight;
      sourceWidth = sourceHeight * pageRatio;
    }
    const sourceX = Math.max(0, (video.videoWidth - sourceWidth) / 2);
    const sourceY = Math.max(0, (video.videoHeight - sourceHeight) / 2);
    const outputScale = Math.min(1, 1_600 / sourceHeight);
    canvas.width = Math.max(1, Math.round(sourceWidth * outputScale));
    canvas.height = Math.max(1, Math.round(sourceHeight * outputScale));
    const context = canvas.getContext("2d");
    if (!context) {
      this.status = "The browser could not prepare the captured image.";
      this.statusIsError = true;
      return;
    }
    context.drawImage(
      video,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      canvas.width,
      canvas.height
    );
    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, "image/png")
    );
    if (!blob) {
      this.status = "The browser could not encode the captured image.";
      this.statusIsError = true;
      return;
    }
    this.setCapture(blob, `attachment-capture-${Date.now()}.png`);
    this.status = "Camera frame captured. Confirm the target and upload when ready.";
    this.statusIsError = false;
  }

  selectCaptureFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (
      (file.type !== "image/png" && file.type !== "image/jpeg") ||
      file.size > 10 * 1024 * 1024
    ) {
      this.status = "Choose a PNG or JPEG no larger than 10 MiB.";
      this.statusIsError = true;
      return;
    }
    this.setCapture(file, file.name || `attachment-capture-${Date.now()}.png`);
    this.status = "Image ready. Confirm the target details before uploading.";
    this.statusIsError = false;
  }

  async uploadCapture(): Promise<void> {
    const attachment = this.attachment;
    const captureBlob = this.captureBlob;
    if (!attachment || !captureBlob || !this.canWrite || this.busy) return;
    this.busy = true;
    this.statusIsError = false;
    try {
      const updated = await this.manager.upload(
        this.scope(),
        attachment.attachmentId,
        {
          fileName: this.captureFileName,
          mediaType: captureBlob.type,
          dataBase64: this.arrayBufferToBase64(await captureBlob.arrayBuffer())
        }
      );
      this.attachment = updated;
      this.clearCapture();
      this.status = `Attachment uploaded for ${updated.personLabel}. Scan another page when ready.`;
    } catch (error) {
      this.status = this.manager.describeError(error);
      this.statusIsError = true;
    } finally {
      this.busy = false;
    }
  }

  clearCapture(): void {
    if (this.capturePreviewUrl) {
      URL.revokeObjectURL(this.capturePreviewUrl);
    }
    this.capturePreviewUrl = null;
    this.captureBlob = null;
    this.captureFileName = "";
  }

  resetTarget(): void {
    this.attachment = null;
    this.attachmentCode = "";
    this.clearCapture();
    this.status = "Scan a QR code or enter an attachment code to begin.";
    this.statusIsError = false;
    if (!this.cameraActive) void this.startCamera();
  }

  private async handleScannedCode(code: string): Promise<void> {
    if (this.scanInProgress || this.busy || !code.trim()) return;
    this.scanInProgress = true;
    try {
      await this.captureCurrentFrame();
      this.stopCamera();
      this.attachmentCode = code.trim();
      await this.resolveCode();
    } finally {
      this.scanInProgress = false;
    }
  }

  private async resolveCodeInternal(): Promise<void> {
    const attachmentId = this.attachmentCode.trim();
    if (!attachmentId) {
      this.status = "Enter or scan an attachment code first.";
      this.statusIsError = true;
      return;
    }
    try {
      this.attachment = await this.manager.get(this.scope(), attachmentId);
      this.attachmentCode = this.attachment.attachmentId;
      if (!this.canCaptureTarget) {
        this.clearCapture();
        this.status = `Attachment type '${this.attachment.attachmentType || "unspecified"}' is retained for compatibility but has no camera-capture workflow.`;
        this.statusIsError = true;
      } else {
        this.status = `Attachment resolved for ${this.attachment.personLabel}.`;
        this.statusIsError = false;
      }
    } catch (error) {
      this.attachment = null;
      this.status = this.manager.describeError(error);
      this.statusIsError = true;
    }
  }

  private setCapture(blob: Blob, fileName: string): void {
    this.clearCapture();
    this.captureBlob = blob;
    this.captureFileName = fileName;
    this.capturePreviewUrl = URL.createObjectURL(blob);
  }

  private scope(): AttachmentScope {
    return {
      sessionToken: this.uiState.ops.adminSessionToken.trim(),
      tenantKey: this.tenantKey,
      workspaceKey: this.workspaceKey
    };
  }

  private destroyScanner(): void {
    this.scanner?.destroy();
    this.scanner = null;
    this.cameraActive = false;
    this.hasFlash = false;
    this.flashOn = false;
  }

  private describeCameraError(error: unknown): string {
    if (error instanceof Error) return error.message;
    return typeof error === "string" ? error : "Camera or QR scan failed.";
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 32_768) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
    }
    return btoa(binary);
  }
}
