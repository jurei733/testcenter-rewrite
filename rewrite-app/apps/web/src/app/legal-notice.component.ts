import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { RouterLink } from "@angular/router";

import { ApplicationSettingsService } from "./application-settings.service";

@Component({
  selector: "app-legal-notice",
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <article class="card legal-notice-card">
      <span class="eyebrow">Public instance information</span>
      <h2>Legal notice, privacy, and accessibility</h2>
      <div
        id="applicationLegalNoticeContent"
        class="configured-application-content"
        *ngIf="applicationSettings.settings().legalNoticeHtml.trim(); else notConfigured"
        [innerHTML]="applicationSettings.settings().legalNoticeHtml"
      ></div>
      <ng-template #notConfigured>
        <p id="applicationLegalNoticeEmptyState">
          No legal notice has been configured for this instance.
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
    .legal-notice-card {
      max-width: 760px;
      margin: 0 auto;
    }
    .configured-application-content {
      overflow-wrap: anywhere;
    }
  `
})
export class LegalNoticeComponent {
  readonly applicationSettings = inject(ApplicationSettingsService);
}
