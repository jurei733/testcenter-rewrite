import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";

export type RecordCollectionRow = {
  label: string;
  value: string;
  href?: string;
};

export type RecordCollectionItem = {
  headline: string;
  subline: string;
  badges: string[];
  rows: RecordCollectionRow[];
  selected?: boolean;
  actionLabel?: string;
  actionPayload?: Record<string, string>;
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

          <div class="record-card-actions" *ngIf="item.actionLabel">
            <button
              type="button"
              class="ghost"
              [attr.aria-description]="item.headline"
              [attr.title]="item.headline"
              (click)="itemAction.emit(item)"
            >
              {{ item.actionLabel }}
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
}
