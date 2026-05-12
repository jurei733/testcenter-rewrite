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
      <div id="summaryCards" class="summary-grid">
        <div class="summary-card" *ngFor="let card of cards">
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
