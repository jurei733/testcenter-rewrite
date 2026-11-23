import {DatePipe, NgTemplateOutlet} from '@angular/common';
import {BreakpointObserver, Breakpoints} from '@angular/cdk/layout';
import {Component, effect, inject, signal, viewChild} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {RouterLink} from '@angular/router';
import {MatButton, MatFabButton, MatIconButton} from '@angular/material/button';
import {MatSidenavModule} from '@angular/material/sidenav';
import {MatSnackBar} from '@angular/material/snack-bar';
import {MatSort, MatSortHeader} from '@angular/material/sort';
import {MatTableDataSource, MatTableModule} from '@angular/material/table';
import type {OriginalAttachment} from '@testcenter-rewrite-app/contracts';
import {ApplicationSettingsService} from '../application-settings.service';
import {attachmentTextValue, resolveAttachmentText, type AttachmentCustomTextKey} from '../attachment-custom-texts';
import {NativeAttachmentContext} from './native-attachment-context';
import {NativeMonitorIconComponent} from './native-monitor-icon.component';

// Attachment layout adapted from IQB Testcenter. See ORIGINAL-UI-LICENSE.txt.
@Component({
  selector: 'app-native-attachment-overview',
  imports: [DatePipe, NgTemplateOutlet, MatButton, MatFabButton, MatIconButton, MatSidenavModule,
    MatSort, MatSortHeader, MatTableModule, NativeMonitorIconComponent, RouterLink],
  styles: `
    :host { color: var(--mat-sys-on-surface-variant); }
    .corner-menu {position: absolute; right: 0; top: 0; z-index: 10000; border-bottom-left-radius: 10px; background: white; display: flex}
    mat-sidenav {width: min(500px, 100%); margin-top: 15px; padding: 15px}
    mat-sidenav-container {position: initial; background: none}
    mat-sidenav-content {position: absolute; inset: 0; height: initial; overflow: initial}
    .adminbackground {
      box-shadow: 5px 10px 20px black; background: white; margin-left: 15px;
      box-sizing: content-box; padding: 0 15px 10px; min-height: 100%; overflow: auto; scroll-behavior: smooth;
    }
    .mobile .adminbackground {margin-left: 0}
    h2 {font-size: 1.5em; margin: 0 0 .83em}
    h3 {margin: 1em 0}
    .toolbar-section {margin-bottom: 1em}
    .toolbar-section-bottom {position: absolute; bottom: 0}
    .control + .control {margin-left: 15px}
    .preview {display: block; width: 100%; aspect-ratio: 1; background: #b2b2b2; object-fit: contain}
    .image-controls {text-align: center}
    .alert {display: block; margin-bottom: 2px}
    .alert-content {display: inline-flex; align-items: center; vertical-align: middle}
    .alert mat-icon {margin-right: .2em; overflow: visible}
    .warning {color: goldenrod}
    .success {color: green}
    .attachment-table {border-collapse: collapse; display: table; width: 100%}
    .attachment-table td {margin-right: 1em; padding: .2em 2em .2em 16px; border-bottom: 1px solid silver}
    .attachment-table tr {cursor: pointer}
    .attachment-table tr[aria-selected="true"] td {background: rgba(0, 0, 0, .3)}
  `,
  template: `
    <mat-sidenav-container [class.mobile]="mobile()?.matches">
      <mat-sidenav [mode]="mobile()?.matches ? 'over' : 'side'" [opened]="sidebarOpen()"
        (openedChange)="sidebarOpen.set($event)" fixedInViewport [fixedTopGap]="55">
        <div class="corner-menu">
          @if (sidebarOpen()) {
            <button mat-icon-button [attr.aria-label]="text('am_sidebar_button')" (click)="sidebarOpen.set(false)">
              <mat-icon svgIcon="close" />
            </button>
          }
        </div>
        <h2>Verwaltung der Aufgabenanhänge</h2>
        @if (selected(); as item) {
          <h3>{{ title(item) }}</h3>
          @if (item.dataType === 'missing') {
            <div class="toolbar-section"><div class="alert"><div class="alert-content">
              <mat-icon svgIcon="warning" class="warning" /><span>Dieser Anhang muss noch hinzugefügt werden.</span>
            </div></div></div>
          }
          <div class="toolbar-section">
            <table>
              <tr><td>Typ:</td><td>{{ item.attachmentType === 'capture-image' ? text('am_attachment_type_capture-image') : '' }}</td></tr>
              <tr><td>Variable:</td><td>{{ item.variableId }}</td></tr>
              <tr><td>Testperson:</td><td>{{ item.personLabel }}</td></tr>
              <tr><td>Test:</td><td>{{ item.testLabel }}</td></tr>
              <tr><td>Aufgabe:</td><td>{{ item.unitLabel }}</td></tr>
            </table>
          </div>
          @if (item.attachmentFileIds.length) {
            <div class="toolbar-section image-controls">
              <button mat-mini-fab aria-label="Previous instance from this image-attachment" [disabled]="busy()" (click)="move(-1)">
                <mat-icon svgIcon="chevron_left" />
              </button>
              {{ fileIndex() + 1 }} / {{ item.attachmentFileIds.length }}
              <button mat-mini-fab aria-label="Next instance from this image-attachment" [disabled]="busy()" (click)="move(1)">
                <mat-icon svgIcon="chevron_right" />
              </button>
            </div>
            @if (item.dataType === 'image') {
              <div class="toolbar-section">
                @if (preview(); as url) {
                  <img class="preview" [src]="url" alt="Vorschau des Aufgabenanhangs" />
                } @else {<div class="preview"></div>}
              </div>
            }
          }
          <div class="toolbar-section">
            @if (item.attachmentType === 'capture-image') {
              <button mat-raised-button class="control" (click)="download(item.attachmentId)">
                <mat-icon svgIcon="description" /> Seitenvorlage
              </button>
            }
            @if (item.attachmentFileIds.length) {
              <button mat-raised-button class="control" [disabled]="busy()" (click)="remove(item)">
                <mat-icon svgIcon="delete" /> {{ text('am_button_delete_attachment') }}
              </button>
            }
          </div>
          <div [class.toolbar-section-bottom]="!item.attachmentFileIds.length">
            <ng-container *ngTemplateOutlet="commonControls" />
          </div>
        } @else {
          <ng-container *ngTemplateOutlet="commonControls" />
        }
        <ng-template #commonControls>
          <div class="toolbar-section">
            <h3>{{ text('am_add_headline') }}</h3>
            <a mat-raised-button routerLink="../capture-image"><mat-icon svgIcon="photo_camera" /> {{ text('am_capture_image') }}</a>
          </div>
          @if (hasCapture()) {
            <div class="toolbar-section">
              <h3>{{ text('am_tools_headline') }}</h3>
              <button mat-raised-button (click)="download()"><mat-icon svgIcon="library_books" /> Alle Seitenvorlagen herunterladen</button>
            </div>
          }
        </ng-template>
      </mat-sidenav>
      <mat-sidenav-content>
        <div class="adminbackground">
          <div class="corner-menu">
            @if (!sidebarOpen()) {
              <button mat-icon-button [attr.aria-label]="text('am_add_button')" (click)="openTools()">
                <mat-icon svgIcon="add_circle" />
              </button>
            }
          </div>
          @if (problem(); as error) {<p role="alert">{{ error }}</p>}
          <table mat-table [dataSource]="table" matSort class="attachment-table">
            @for (column of columns; track column.key) {
              <ng-container [matColumnDef]="column.key">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>{{ column.label }}</th>
                <td mat-cell *matCellDef="let item" (click)="select(item)">
                  @switch (column.key) {
                    @case ('personLabel') {
                      <span tabindex="0" (keydown.enter)="select(item)">{{ item.personLabel }}</span>
                    }
                    @case ('status') {
                      <div class="alert"><div class="alert-content">
                        @if (item.attachmentFileIds.length) {<mat-icon svgIcon="check_circle" class="success" />}
                        @else {<mat-icon svgIcon="warning" class="warning" />}
                        <span>{{ item.attachmentFileIds.length }}</span>
                      </div></div>
                    }
                    @case ('attachmentType') { {{ item.attachmentType === 'capture-image' ? text('am_attachment_type_capture-image') : '' }} }
                    @case ('lastModified') { {{ item.lastModified | date:'dd.MM.yy HH:mm' }} }
                    @default { {{ item[column.key] }} }
                  }
                </td>
              </ng-container>
            }
            <tr mat-header-row *matHeaderRowDef="keys"></tr>
            <tr mat-row *matRowDef="let item; columns: keys" [attr.aria-selected]="selected()?.attachmentId === item.attachmentId"></tr>
          </table>
        </div>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `
})
export class NativeAttachmentOverviewComponent {
  readonly columns = [{key: 'status', label: 'Dateien'}, {key: 'personLabel', label: 'Person'},
    {key: 'testLabel', label: 'Test'}, {key: 'unitLabel', label: 'Aufgabe'}, {key: 'variableId', label: 'Variable'},
    {key: 'attachmentType', label: 'Typ'}, {key: 'lastModified', label: 'Letzte Änderung'}] as const;
  readonly keys = this.columns.map(column => column.key);
  readonly table = new MatTableDataSource<OriginalAttachment>();
  readonly selected = signal<OriginalAttachment | null>(null);
  readonly fileIndex = signal(0);
  readonly preview = signal('');
  readonly problem = signal('');
  readonly busy = signal(false);
  readonly hasCapture = signal(false);
  readonly sidebarOpen = signal(true);
  readonly mobile = toSignal(inject(BreakpointObserver).observe([Breakpoints.Medium, Breakpoints.Small, Breakpoints.XSmall]));
  private readonly sort = viewChild(MatSort);
  private readonly settings = inject(ApplicationSettingsService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly context = inject(NativeAttachmentContext);
  private imageRevision = 0;
  private destroyed = false;

  constructor() {
    effect(() => { this.table.sort = this.sort() ?? null; });
    effect(() => { this.sidebarOpen.set(!this.mobile()?.matches); });
    this.table.sortingDataAccessor = (row, key) => key === 'status'
      ? row.attachmentFileIds.length
      : String(row[key as keyof OriginalAttachment] ?? '');
    void this.refresh();
  }
  text(key: AttachmentCustomTextKey) {
    return resolveAttachmentText(this.settings.settings().customTexts, this.context.customTexts, key);
  }
  title(item: OriginalAttachment) {
    return attachmentTextValue(this.settings.settings().customTexts, this.context.customTexts, 'am_page_template_label')
      .replace('%TESTTAKER%', item.personLabel).replace('%BOOKLET%', item.testLabel)
      .replace('%UNIT%', item.unitLabel).replace('%VAR%', item.variableId);
  }
  private clearPreview() {
    const current = this.preview();
    if (current) URL.revokeObjectURL(current);
    this.preview.set('');
  }
  private fail(error: unknown) {
    if (!this.destroyed && !(error instanceof DOMException && error.name === 'AbortError')) {
      this.problem.set(error instanceof Error ? error.message : 'Die Anhänge konnten nicht geladen werden.');
    }
  }
  private async refresh() {
    try {
      const rows = await this.context.list();
      if (this.destroyed) return;
      this.table.data = rows;
      this.hasCapture.set(rows.some(row => row.attachmentType === 'capture-image'));
    } catch (error) { this.fail(error); }
  }
  openTools() {
    this.imageRevision++;
    this.selected.set(null);
    this.clearPreview();
    this.sidebarOpen.set(true);
  }
  select(item: OriginalAttachment) {
    this.sidebarOpen.set(true);
    this.selected.set(item);
    this.fileIndex.set(0);
    void this.loadPreview(item);
  }
  move(offset: number) {
    const item = this.selected();
    const index = this.fileIndex() + offset;
    if (!item || index < 0 || index >= item.attachmentFileIds.length) return;
    this.fileIndex.set(index);
    void this.loadPreview(item);
  }
  private async loadPreview(item: OriginalAttachment) {
    const fileId = item.attachmentFileIds[this.fileIndex()];
    const revision = ++this.imageRevision;
    this.clearPreview();
    if (!fileId) return;
    try {
      const image = await this.context.file(item.attachmentId, fileId);
      if (!this.destroyed && revision === this.imageRevision) this.preview.set(URL.createObjectURL(image));
    } catch (error) { if (revision === this.imageRevision) this.fail(error); }
  }
  async remove(item: OriginalAttachment) {
    const fileId = item.attachmentFileIds[this.fileIndex()];
    if (!fileId || this.busy()) return;
    this.busy.set(true);
    try {
      await this.context.delete(item.attachmentId, fileId);
      if (this.destroyed) return;
      if (this.selected()?.attachmentId === item.attachmentId) {
        this.imageRevision++;
        this.selected.set(null);
        this.clearPreview();
      }
      await this.refresh();
      if (!this.destroyed) this.snackBar.open('Anhang gelöscht!', 'Ok.', {duration: 3000});
    } catch (error) { this.fail(error); }
    finally { this.busy.set(false); }
  }
  async download(id?: string) {
    try {
      const label = attachmentTextValue(this.settings.settings().customTexts, this.context.customTexts, 'am_page_template_label');
      const blob = await this.context.pages(id, label);
      if (this.destroyed) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'Anhänge.pdf';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) { this.fail(error); }
  }
  ngOnDestroy() { this.destroyed = true; this.clearPreview(); }
}
