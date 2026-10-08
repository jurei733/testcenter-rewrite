import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import { RouterLink } from "@angular/router";

export type LiveContextSection = {
  title: string;
  route: string;
  items: Array<{
    label: string;
    value: string;
  }>;
};

@Component({
  selector: "app-live-context",
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <article class="card live-context-card">
      <header class="live-context-header">
        <div>
          <span class="eyebrow">Live Context</span>
          <h2>Current Scope And Working Ids</h2>
        </div>
        <p>
          The frontend now keeps the latest workspace, content, and runtime ids visible, so
          you do not have to fish them out of the raw response pane.
        </p>
      </header>

      <div class="live-context-grid">
        <a
          *ngFor="let section of sections"
          class="live-context-section"
          [routerLink]="section.route"
        >
          <strong>{{ section.title }}</strong>
          <div class="live-context-items">
            <div class="live-context-item" *ngFor="let item of section.items">
              <span>{{ item.label }}</span>
              <code>{{ item.value }}</code>
            </div>
          </div>
        </a>
      </div>
    </article>
  `
})
export class LiveContextComponent {
  @Input({ required: true }) sections: LiveContextSection[] = [];
}
