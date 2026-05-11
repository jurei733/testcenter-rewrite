import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";

type ActivityFeedItem = {
  title: string;
  detail: string;
};

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
  `
})
export class ActivityFeedComponent {
  @Input({ required: true }) items: ActivityFeedItem[] = [];
}
