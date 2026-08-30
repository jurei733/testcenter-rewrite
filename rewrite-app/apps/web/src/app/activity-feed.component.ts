import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import type { ActivityFeedItem } from "./rewrite-app-shell.types";

@Component({
  selector: "app-activity-feed",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="collection">
      <header><span>Activity Feed</span><span>Recent Meaning</span></header>
      <div id="activityFeed" class="activity-feed">
        <div class="activity-item" *ngFor="let item of items">
          <strong>{{ item.title }}</strong>
          <p>{{ item.detail }}</p>
        </div>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .collection,
    .activity-feed,
    .activity-item {
      min-width: 0;
    }

    .activity-item p {
      overflow-wrap: anywhere;
    }
  `
})
export class ActivityFeedComponent {
  @Input({ required: true }) items: ActivityFeedItem[] = [];
}
