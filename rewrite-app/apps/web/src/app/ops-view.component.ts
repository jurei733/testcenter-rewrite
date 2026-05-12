import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import type { OnInit } from "@angular/core";

import { JsonPanelComponent } from "./json-panel.component";
import { OpsViewFacade } from "./ops-view.facade";

@Component({
  selector: "app-ops-view",
  standalone: true,
  imports: [CommonModule, JsonPanelComponent],
  template: `
    <div class="stack">
      <article class="card">
        <h2>Diagnostics</h2>
        <p>Inspect health, readiness, metrics, and effective runtime configuration without leaving the app.</p>
        <div class="actions">
          <button class="primary" type="button" (click)="view.refreshDiagnostics()">Refresh Diagnostics</button>
          <button class="ghost" type="button" (click)="view.refreshMetrics()">Refresh Metrics</button>
        </div>
      </article>

      <app-json-panel title="Readiness And Manifest" subtitle="Runtime Surface" viewId="runtimeHealthView" [content]="view.ops.runtimeHealthView"></app-json-panel>
      <app-json-panel title="Metrics" subtitle="Process Counters" viewId="runtimeMetricsView" [content]="view.ops.runtimeMetricsView"></app-json-panel>
      <app-json-panel title="Runtime Diagnostics" subtitle="Recent Events" viewId="runtimeDiagnosticsView" [content]="view.ops.runtimeDiagnosticsView"></app-json-panel>
      <app-json-panel title="Runtime Config" subtitle="Effective Config" viewId="runtimeConfigView" [content]="view.ops.runtimeConfigView"></app-json-panel>
    </div>
  `
})
export class OpsViewComponent implements OnInit {
  readonly view = inject(OpsViewFacade);

  ngOnInit(): void {
    this.view.init();
  }
}
