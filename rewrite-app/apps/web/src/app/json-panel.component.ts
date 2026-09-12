import { CommonModule } from "@angular/common";
import { Component, Input, inject } from "@angular/core";

import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";

@Component({
  selector: "app-json-panel",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="collection raw-debug-panel" *ngIf="debugEnabled">
      <header>
        <span>{{ title }}</span>
        <span>{{ subtitle }}</span>
      </header>
      <div class="json-panel-toolbar">
        <span class="json-panel-badge">Raw Debug</span>
        <button
          class="ghost"
          type="button"
          [attr.aria-expanded]="expanded"
          [attr.aria-controls]="viewId"
          (click)="expanded = !expanded"
        >
          {{ expanded ? "Hide Raw Debug" : "Show Raw Debug" }}
        </button>
      </div>
      <div class="json-panel-preview" *ngIf="!expanded">
        {{ collapsedPreview }}
      </div>
      <pre [id]="viewId" *ngIf="expanded">{{ content }}</pre>
    </div>
  `
})
export class JsonPanelComponent {
  private readonly uiState = inject(RewriteAppUiStateService);

  @Input({ required: true }) title = "";
  @Input({ required: true }) subtitle = "";
  @Input({ required: true }) viewId = "";
  @Input({ required: true }) content = "";
  expanded = false;

  get debugEnabled(): boolean {
    return this.uiState.showRawDebug;
  }

  get collapsedPreview(): string {
    const normalized = this.content.replace(/\s+/g, " ").trim();
    if (!normalized) {
      return 'No raw debug payload loaded yet. Use the view actions above to populate this panel.';
    }
    return normalized.length > 220
      ? `${normalized.slice(0, 217)}...`
      : normalized;
  }
}
