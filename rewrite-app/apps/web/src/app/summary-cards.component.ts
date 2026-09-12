import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import type { SummaryCard } from "./rewrite-app-shell.types";

@Component({
  selector: "app-summary-cards",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="collection">
      <header><span>Operational Summary</span><span>At A Glance</span></header>
      <div
        class="summary-grid"
        role="list"
        aria-label="Operational summary cards"
      >
        <div
          class="summary-card"
          role="listitem"
          [attr.aria-label]="card.label + ': ' + card.headline + '. ' + card.detail"
          [attr.title]="card.label + ': ' + card.headline"
          *ngFor="let card of cards"
        >
          <strong>{{ card.label }}</strong>
          <h3>{{ card.headline }}</h3>
          <p>{{ card.detail }}</p>
        </div>
      </div>
    </div>
  `
})
export class SummaryCardsComponent {
  @Input({ required: true }) cards: SummaryCard[] = [];
}
