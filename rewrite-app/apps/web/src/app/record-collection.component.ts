import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";

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
                  [attr.aria-label]="'Copy ' + row.label + ': ' + row.value"
                  [attr.title]="'Copy ' + row.value"
                  (click)="copyRowValue(row)"
                >
                  Copy Link
                </button>
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
export class RecordCollectionComponent {
  @Input({ required: true }) title = "";
  @Input({ required: true }) subtitle = "";
  @Input({ required: true }) items: RecordCollectionItem[] = [];
  @Input() emptyState = "No items yet.";
  @Output() readonly itemAction = new EventEmitter<RecordCollectionItem>();

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
    const value = row.value.trim();
    if (!value) {
      return;
    }

    const clipboard = globalThis.navigator?.clipboard;
    if (!clipboard?.writeText) {
      this.copyRowValueWithFallback(value);
      return;
    }

    try {
      await clipboard.writeText(value);
    } catch {
      this.copyRowValueWithFallback(value);
    }
  }

  private copyRowValueWithFallback(value: string): void {
    const documentRef = globalThis.document;
    const textArea = documentRef?.createElement("textarea");
    if (!documentRef?.body || !textArea) {
      return;
    }

    textArea.value = value;
    textArea.setAttribute("readonly", "true");
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    documentRef.body.append(textArea);
    textArea.select();
    documentRef.execCommand("copy");
    textArea.remove();
  }
}
