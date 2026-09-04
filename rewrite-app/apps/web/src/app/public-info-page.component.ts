import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";

import type { ApplicationSettings } from "@testcenter-rewrite-app/domain";

import { ApplicationSettingsService } from "./application-settings.service";

type PublicInfoPageConfig = {
  title: string;
  contentKey: "legalNoticeHtml" | "privacyNotice" | "accessibilityNotice";
  contentId: string;
  emptyId: string;
};

@Component({
  selector: "app-public-info-page",
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <article class="card public-info-card">
      <span class="eyebrow">Public instance information</span>
      <h2>{{ config.title }}</h2>
      <div
        class="configured-application-content"
        *ngIf="content.trim(); else notConfigured"
        [id]="config.contentId"
        [innerHTML]="content"
      ></div>
      <ng-template #notConfigured>
        <p [id]="config.emptyId">
          No {{ config.title.toLowerCase() }} information has been configured for this instance.
        </p>
      </ng-template>
      <div class="actions">
        <a class="button-link ghost" routerLink="/participant">Back to participant entry</a>
      </div>
    </article>
  `,
  styles: `
    :host {
      display: block;
    }

    .public-info-card {
      max-width: 760px;
      margin: 0 auto;
    }

    .configured-application-content {
      overflow-wrap: anywhere;
    }
  `
})
export class PublicInfoPageComponent {
  readonly applicationSettings = inject(ApplicationSettingsService);
  readonly config = inject(ActivatedRoute).snapshot.data as PublicInfoPageConfig;

  get content(): string {
    return this.applicationSettings.settings()[
      this.config.contentKey
    ] as ApplicationSettings[PublicInfoPageConfig["contentKey"]];
  }
}
