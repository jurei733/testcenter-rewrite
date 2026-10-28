import { CommonModule } from "@angular/common";
import { ChangeDetectorRef, Component, Input, inject } from "@angular/core";
import type { OnChanges, OnDestroy } from "@angular/core";
import { RouterLink } from "@angular/router";

import type { WorkspaceAttachment } from "@testcenter-rewrite-app/domain";

import { AttachmentManagerService } from "./attachment-manager.service";
import { downloadBlobFile } from "./download-text-file";
import { InterfaceModeService } from "./interface-mode.service";
import { ApplicationSettingsService } from "./application-settings.service";
import { RewriteAppOperatorAccessService } from "./rewrite-app-operator-access.service";
import { attachmentTextValue, resolveAttachmentText, type AttachmentCustomTextKey } from "./attachment-custom-texts";

type AttachmentManagerScope = {
  sessionToken: string;
  tenantKey: string;
  workspaceKey: string;
};

@Component({
  selector: "app-attachment-manager",
  standalone: true,
  imports: [CommonModule, RouterLink],
  styles: [`
    :host { display: block; width: 100%; max-width: 100%; min-width: 0; overflow-x: clip; }
    .attachment-layout { display: grid; gap: 1rem; grid-template-columns: minmax(0, 1fr); min-width: 0; max-width: 100%; }
    .attachment-list { display: grid; gap: .65rem; min-width: 0; max-width: 100%; }
    .attachment-row { border: 1px solid var(--border-subtle, #d9dee8); border-radius: .75rem; padding: .8rem; background: var(--surface-raised, #fff); text-align: left; width: 100%; min-width: 0; max-width: 100%; }
    .attachment-row.is-selected { border-color: var(--accent, #3157d5); box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent, #3157d5) 18%, transparent); }
    .attachment-row-header, .attachment-meta, .attachment-files { display: flex; gap: .5rem; align-items: center; flex-wrap: wrap; }
    .attachment-row-header { justify-content: space-between; }
    .attachment-meta { color: var(--text-muted, #596273); font-size: .88rem; margin-top: .35rem; }
    .attachment-code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .72rem; overflow-wrap: anywhere; }
    .attachment-preview { max-width: 100%; max-height: 26rem; border-radius: .75rem; border: 1px solid var(--border-subtle, #d9dee8); background: #f5f6f8; }
    .attachment-side { min-width: 0; }
    .attachment-file-actions { display: flex; gap: .4rem; flex-wrap: wrap; margin-top: .5rem; }
    .attachment-status { min-height: 1.4rem; }
  `],
  template: `
    <article id="attachmentManagerCard" class="card">
      <div class="section-heading">
        <div>
          <h2>{{ originalInterface ? 'Verwaltung der Aufgabenanhänge' : 'Attachment Manager' }}</h2>
        </div>
        <span class="status-pill">{{ attachments.length }} requested · {{ captureCount }} capture-ready · {{ imageCount }} captured</span>
      </div>
      <p>Inspect every requested participant attachment by group, login, test, unit, and variable. Camera capture is available for the original <code>capture-image</code> format; other imported formats remain visible without pretending to offer an unsupported workflow.</p>
      <h3 *ngIf="originalInterface">{{ customText('am_tools_headline', 'Tools') }}</h3>
      <div class="actions">
        <button id="loadAttachmentsButton" class="primary" type="button" [disabled]="busy || !hasScope" (click)="load()">{{ busy ? 'Working…' : 'Load Attachments' }}</button>
        <button id="downloadAttachmentPagesButton" class="secondary" type="button" [disabled]="busy || captureCount === 0" (click)="downloadPages()">Download capture QR pages</button>
        <a id="openAttachmentCaptureButton" class="button-link secondary" routerLink="/attachment-capture" *ngIf="captureCount > 0">{{ customText('am_capture_image', 'Open camera capture') }}</a>
      </div>
      <label>
        QR page label template
        <input id="attachmentLabelTemplate" type="text" maxlength="500" [value]="labelTemplate" (input)="setLabelTemplate($event)" />
      </label>
      <p class="attachment-meta">Placeholders: %GROUP%, %TESTTAKER%, %BOOKLET%, %UNIT%, %VAR%, %LOGIN%, %CODE%</p>
      <p id="attachmentManagerStatus" class="attachment-status" role="status">{{ status }}</p>

      <div class="attachment-layout" *ngIf="attachments.length > 0; else attachmentEmpty">
        <div id="attachmentRows" class="attachment-list">
          <button
            class="attachment-row"
            type="button"
            *ngFor="let attachment of attachments; trackBy: trackAttachment"
            [class.is-selected]="attachment.attachmentId === selectedAttachmentId"
            [attr.data-attachment-id]="attachment.attachmentId"
            (click)="select(attachment)"
          >
            <span class="attachment-row-header">
              <strong>{{ attachment.personLabel }}</strong>
              <span class="status-pill">{{ attachment.dataType }}</span>
            </span>
            <span class="attachment-meta">
              <span>{{ attachment.groupKey }} / {{ attachment.loginKey }}</span>
              <span>{{ attachment.testLabel }}</span>
              <span>{{ attachment.unitLabel }} · {{ attachment.variableId }}</span>
              <span>type: {{ isCaptureImage(attachment) ? customText('am_attachment_type_capture-image', 'capture-image') : attachment.attachmentType || 'unspecified' }}</span>
            </span>
          </button>
        </div>

        <section class="attachment-side" *ngIf="selectedAttachment as selected" [attr.data-attachment-type]="selected.attachmentType">
          <h3>{{ selected.unitLabel }} · {{ selected.variableId }}</h3>
          <p>Attachment type: <code>{{ isCaptureImage(selected) ? customText('am_attachment_type_capture-image', 'capture-image') : selected.attachmentType || 'unspecified' }}</code></p>
          <p class="attachment-code" id="selectedAttachmentCode">{{ selected.attachmentId }}</p>
          <div class="actions">
            <button class="ghost" type="button" (click)="copyCode(selected.attachmentId)">Copy attachment code</button>
            <button id="downloadSelectedAttachmentPageButton" class="secondary" type="button" [disabled]="busy" (click)="downloadSelectedPage(selected)" *ngIf="isCaptureImage(selected)">Download QR page</button>
            <a
              id="captureSelectedAttachmentButton"
              class="button-link secondary"
              routerLink="/attachment-capture"
              [queryParams]="{ code: selected.attachmentId }"
              *ngIf="!readOnly && isCaptureImage(selected)"
            >{{ customText('am_capture_image', 'Capture on this device') }}</a>
          </div>
          <p id="unsupportedAttachmentType" *ngIf="!isCaptureImage(selected)">
            This attachment declaration is retained for Original Testcenter compatibility. No {{ selected.attachmentType || 'unspecified' }} capture workflow is implemented yet.
          </p>
          <label *ngIf="isCaptureImage(selected)">
            Add PNG or JPEG (max. 10 MiB)
            <input
              id="attachmentFileInput"
              type="file"
              accept="image/png,image/jpeg"
              [disabled]="busy || readOnly"
              (change)="uploadSelected($event)"
            />
          </label>
          <div class="attachment-files" *ngIf="selected.attachmentFileIds.length > 0">
            <div *ngFor="let fileId of selected.attachmentFileIds">
              <span class="attachment-code">{{ fileId }}</span>
              <div class="attachment-file-actions">
                <button class="secondary" type="button" [disabled]="busy" (click)="preview(selected, fileId)">Preview</button>
                <button class="danger" type="button" [disabled]="busy || readOnly" (click)="deleteFile(selected, fileId)">{{ customText('am_button_delete_attachment', 'Delete') }}</button>
              </div>
            </div>
          </div>
          <img id="attachmentPreview" class="attachment-preview" *ngIf="previewUrl" [src]="previewUrl" alt="Selected participant attachment preview" />
        </section>
      </div>

      <ng-template #attachmentEmpty>
        <p id="attachmentEmptyState">No requested attachments are loaded for this workspace.</p>
      </ng-template>
    </article>
  `
})
export class AttachmentManagerComponent implements OnChanges, OnDestroy {
  private readonly manager = inject(AttachmentManagerService);
  private readonly interfaceMode = inject(InterfaceModeService);
  private readonly applicationSettings = inject(ApplicationSettingsService);
  private readonly operatorAccess = inject(RewriteAppOperatorAccessService);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private requestVersion = 0;
  private destroyed = false;

  @Input({ required: true }) sessionToken = "";
  @Input({ required: true }) tenantKey = "";
  @Input({ required: true }) workspaceKey = "";
  @Input() readOnly = false;

  attachments: WorkspaceAttachment[] = [];
  selectedAttachmentId = "";
  status = "Load the workspace attachment inventory to begin.";
  busy = false;
  previewUrl: string | null = null;
  private labelTemplateOverride: string | null = null;

  get originalInterface(): boolean { return this.interfaceMode.mode() === "original"; }

  customText(key: AttachmentCustomTextKey, rewriteFallback: string): string {
    return resolveAttachmentText(this.applicationSettings.settings().customTexts,
      this.operatorAccess.customTexts, key, this.originalInterface ? undefined : rewriteFallback);
  }

  get labelTemplate(): string {
    const configured = attachmentTextValue(this.applicationSettings.settings().customTexts,
      this.operatorAccess.customTexts, "am_page_template_label");
    return this.labelTemplateOverride ?? (this.originalInterface ? configured
      : configured || "%TESTTAKER% | %BOOKLET% | %UNIT% | %VAR%");
  }

  get hasScope(): boolean {
    return Boolean(
      this.sessionToken.trim() &&
      this.tenantKey.trim() &&
      this.workspaceKey.trim()
    );
  }

  get selectedAttachment(): WorkspaceAttachment | null {
    return (
      this.attachments.find(
        attachment => attachment.attachmentId === this.selectedAttachmentId
      ) ?? null
    );
  }

  get missingCount(): number {
    return this.attachments.filter(item => item.dataType === "missing").length;
  }

  get imageCount(): number {
    return this.attachments.filter(item => item.dataType === "image").length;
  }

  get captureCount(): number {
    return this.attachments.filter(item => this.isCaptureImage(item)).length;
  }

  ngOnChanges(): void {
    this.requestVersion += 1;
    this.busy = false;
    this.status = "Load the workspace attachment inventory to begin.";
    this.labelTemplateOverride = null;
    this.attachments = [];
    this.selectedAttachmentId = "";
    this.clearPreview();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.requestVersion += 1;
    this.busy = false;
    this.clearPreview();
  }

  async load(): Promise<void> {
    if (!this.hasScope || this.busy) {
      return;
    }
    await this.run(async (scope, isCurrent) => {
      const attachments = await this.manager.list(scope);
      if (!isCurrent()) return;
      this.attachments = attachments;
      if (
        this.selectedAttachmentId &&
        !this.attachments.some(
          attachment => attachment.attachmentId === this.selectedAttachmentId
        )
      ) {
        this.selectedAttachmentId = "";
        this.clearPreview();
      }
      this.status = `${this.attachments.length} requested attachment(s) loaded.`;
    });
  }

  select(attachment: WorkspaceAttachment): void {
    if (attachment.attachmentId !== this.selectedAttachmentId) {
      this.clearPreview();
    }
    this.selectedAttachmentId = attachment.attachmentId;
  }

  isCaptureImage(attachment: WorkspaceAttachment): boolean {
    return attachment.attachmentType === "capture-image";
  }

  async uploadSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const attachment = this.selectedAttachment;
    input.value = "";
    if (
      !file ||
      !attachment ||
      !this.isCaptureImage(attachment) ||
      this.busy ||
      this.readOnly
    ) {
      return;
    }
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      this.status = "Choose a PNG or JPEG no larger than 10 MiB.";
      return;
    }
    await this.run(async (scope, isCurrent) => {
      const buffer = await file.arrayBuffer();
      if (!isCurrent()) return;
      const dataBase64 = this.arrayBufferToBase64(buffer);
      const updated = await this.manager.upload(
        scope,
        attachment.attachmentId,
        {
          fileName: file.name,
          mediaType: file.type,
          dataBase64
        }
      );
      if (!isCurrent()) return;
      this.replaceAttachment(updated);
      this.status = `Uploaded ${file.name}.`;
    });
  }

  setLabelTemplate(event: Event): void {
    this.labelTemplateOverride = (event.target as HTMLInputElement).value;
  }

  async downloadPages(): Promise<void> {
    if (!this.hasScope || this.captureCount === 0) return;
    await this.run(async (scope, isCurrent) => {
      const download = await this.manager.downloadPages(scope, {
        labelTemplate: this.labelTemplate,
        layout: this.interfaceMode.mode()
      });
      if (!isCurrent()) return;
      downloadBlobFile({
        filename:
          download.filename || `${this.workspaceKey}-attachment-pages.pdf`,
        blob: download.blob
      });
      this.status = `${this.captureCount} capture QR page(s) downloaded.`;
    });
  }

  async downloadSelectedPage(
    attachment: WorkspaceAttachment
  ): Promise<void> {
    await this.run(async (scope, isCurrent) => {
      const download = await this.manager.downloadPage(
        scope,
        attachment.attachmentId,
        this.labelTemplate,
        this.interfaceMode.mode()
      );
      if (!isCurrent()) return;
      downloadBlobFile({
        filename:
          download.filename ||
          `${attachment.loginKey}-${attachment.variableId}-attachment-page.pdf`,
        blob: download.blob
      });
      this.status = "Attachment QR page downloaded.";
    });
  }

  async preview(
    attachment: WorkspaceAttachment,
    attachmentFileId: string
  ): Promise<void> {
    await this.run(async (scope, isCurrent) => {
      const download = await this.manager.download(
        scope,
        attachment.attachmentId,
        attachmentFileId
      );
      if (!isCurrent() || this.selectedAttachmentId !== attachment.attachmentId) return;
      this.clearPreview();
      this.previewUrl = URL.createObjectURL(download.blob);
      this.status = `Previewing ${download.filename ?? attachmentFileId}.`;
    });
  }

  async deleteFile(
    attachment: WorkspaceAttachment,
    attachmentFileId: string
  ): Promise<void> {
    if (this.readOnly) {
      return;
    }
    await this.run(async (scope, isCurrent) => {
      const updated = await this.manager.delete(
        scope,
        attachment.attachmentId,
        attachmentFileId
      );
      if (!isCurrent()) return;
      this.replaceAttachment(updated);
      if (this.selectedAttachmentId === attachment.attachmentId) this.clearPreview();
      this.status = "Attachment image deleted.";
    });
  }

  async copyCode(attachmentId: string): Promise<void> {
    const version = this.requestVersion;
    const scope = this.scope();
    try {
      await navigator.clipboard.writeText(attachmentId);
      if (version !== this.requestVersion || !this.isCurrentScope(scope)) return;
      this.status = "Attachment code copied.";
    } catch {
      if (version !== this.requestVersion || !this.isCurrentScope(scope)) return;
      this.status = "The browser could not copy the attachment code.";
    }
  }

  trackAttachment(_index: number, attachment: WorkspaceAttachment): string {
    return attachment.attachmentId;
  }

  private scope(): AttachmentManagerScope {
    return {
      sessionToken: this.sessionToken.trim(),
      tenantKey: this.tenantKey.trim(),
      workspaceKey: this.workspaceKey.trim()
    };
  }

  private isCurrentScope(scope: AttachmentManagerScope): boolean {
    const current = this.scope();
    return !this.destroyed && scope.sessionToken === current.sessionToken &&
      scope.tenantKey === current.tenantKey && scope.workspaceKey === current.workspaceKey;
  }

  private async run(action: (scope: AttachmentManagerScope, isCurrent: () => boolean) => Promise<void>): Promise<void> {
    if (this.destroyed || this.busy || !this.hasScope) return;
    const version = ++this.requestVersion;
    const scope = this.scope();
    const ownsOperation = (): boolean => !this.destroyed && version === this.requestVersion;
    const isCurrent = (): boolean => ownsOperation() && this.isCurrentScope(scope);
    this.busy = true;
    try {
      await action(scope, isCurrent);
    } catch (error) {
      if (isCurrent()) this.status = this.manager.describeError(error);
    } finally {
      if (ownsOperation()) {
        this.busy = false;
        this.changeDetectorRef.detectChanges();
      }
    }
  }

  private replaceAttachment(updated: WorkspaceAttachment): void {
    this.attachments = this.attachments.map(attachment =>
      attachment.attachmentId === updated.attachmentId ? updated : attachment
    );
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 32_768) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
    }
    return btoa(binary);
  }

  private clearPreview(): void {
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = null;
    }
  }
}
