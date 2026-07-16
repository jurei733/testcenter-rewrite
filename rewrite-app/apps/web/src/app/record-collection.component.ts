import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";
import type { OnDestroy } from "@angular/core";

import { copyTextToClipboard } from "./copy-text-to-clipboard";

export type RecordCollectionRow = {
  label: string;
  value: string;
  href?: string;
};

export type RecordCollectionAction = {
  label: string;
  payload: Record<string, string>;
};

export type RecordCollectionItem = {
  headline: string;
  subline: string;
  badges: string[];
  rows: RecordCollectionRow[];
  selected?: boolean;
  actionLabel?: string;
  actionPayload?: Record<string, string>;
  actions?: RecordCollectionAction[];
};

@Component({
  selector: "app-record-collection",
  standalone: true,
  imports: [CommonModule],
  template: `
    <article class="card">
      <h3>{{ title }}</h3>
      <p>{{ subtitle }}</p>

      <div class="record-collection-summary" role="status" aria-live="polite" *ngIf="items.length > 0">
        {{ items.length }} visible record{{ items.length === 1 ? "" : "s" }}
      </div>

      <div class="record-collection-empty" *ngIf="items.length === 0">
        {{ emptyState }}
      </div>

      <div class="record-collection-grid" *ngIf="items.length > 0">
        <article
          class="record-card"
          [class.is-selected]="item.selected"
          [attr.aria-current]="item.selected ? 'true' : null"
          [attr.aria-label]="item.headline + ': ' + item.subline"
          *ngFor="let item of items"
        >
          <div class="record-card-header">
            <div>
              <h4>{{ item.headline }}</h4>
              <p>{{ item.subline }}</p>
            </div>
            <div class="record-card-badges" *ngIf="item.badges.length > 0">
              <span *ngFor="let badge of item.badges">{{ badge }}</span>
            </div>
          </div>

          <div class="record-card-selection" *ngIf="item.selected">
            Active selection
          </div>

          <dl class="record-card-rows">
            <div *ngFor="let row of item.rows">
              <dt>{{ row.label }}</dt>
              <dd>
                <a
                  *ngIf="row.href; else plainRowValue"
                  [href]="row.href"
                  [attr.aria-label]="row.label + ': ' + row.value"
                  [attr.title]="row.value"
                  target="_blank"
                  rel="noreferrer"
                >
                  {{ row.value }}
                </a>
                <button
                  *ngIf="row.href"
                  type="button"
                  class="record-card-copy-link"
                  [class.is-copied]="isCopiedRow(row)"
                  [attr.aria-label]="(isCopiedRow(row) ? 'Copied ' : 'Copy ') + row.label + ': ' + row.value"
                  [attr.title]="'Copy ' + row.value"
                  (click)="copyRowValue(row)"
                >
                  {{ isCopiedRow(row) ? "Copied" : "Copy Link" }}
                </button>
                <span
                  *ngIf="isCopiedRow(row)"
                  class="record-card-copy-status"
                  role="status"
                  aria-live="polite"
                >
                  Link copied
                </span>
                <ng-template #plainRowValue>
                  <span
                    class="record-card-row-value"
                    [attr.aria-label]="row.label + ': ' + row.value"
                    [attr.title]="row.value"
                  >
                    {{ row.value }}
                  </span>
                </ng-template>
              </dd>
            </div>
          </dl>

          <div class="record-card-actions" *ngIf="item.actionLabel || item.actions?.length">
            <button
              *ngIf="item.actionLabel"
              type="button"
              class="ghost"
              [attr.aria-description]="item.headline"
              [attr.title]="item.headline"
              (click)="emitAction(item)"
            >
              {{ item.actionLabel }}
            </button>
            <button
              type="button"
              class="ghost"
              [attr.aria-description]="item.headline"
              [attr.title]="item.headline"
              (click)="emitAction(item, action)"
              *ngFor="let action of item.actions"
            >
              {{ action.label }}
            </button>
          </div>
        </article>
      </div>
    </article>
  `
})
export class RecordCollectionComponent implements OnDestroy {
  @Input({ required: true }) title = "";
  @Input({ required: true }) subtitle = "";
  @Input({ required: true }) items: RecordCollectionItem[] = [];
  @Input() emptyState = "No items yet.";
  @Output() readonly itemAction = new EventEmitter<RecordCollectionItem>();
  private copiedRowKey = "";
  private copyResetHandle?: ReturnType<typeof globalThis.setTimeout>;

  ngOnDestroy(): void {
    if (this.copyResetHandle) {
      globalThis.clearTimeout(this.copyResetHandle);
    }
  }

  emitAction(item: RecordCollectionItem, action?: RecordCollectionAction): void {
    if (!action) {
      this.itemAction.emit(item);
      return;
    }

    this.itemAction.emit({
      ...item,
      actionLabel: action.label,
      actionPayload: action.payload
    });
  }

  async copyRowValue(row: RecordCollectionRow): Promise<void> {
    if (await copyTextToClipboard(row.value)) {
      this.markRowCopied(row);
    }
  }

  isCopiedRow(row: RecordCollectionRow): boolean {
    return this.copiedRowKey === this.createRowKey(row);
  }

  private markRowCopied(row: RecordCollectionRow): void {
    this.copiedRowKey = this.createRowKey(row);
    if (this.copyResetHandle) {
      globalThis.clearTimeout(this.copyResetHandle);
    }
    this.copyResetHandle = globalThis.setTimeout(() => {
      this.copiedRowKey = "";
      this.copyResetHandle = undefined;
    }, 2500);
  }

  private createRowKey(row: RecordCollectionRow): string {
    return `${row.label}\u0000${row.value}`;
  }

}
