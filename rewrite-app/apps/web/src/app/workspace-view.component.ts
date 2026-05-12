import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import type { OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { JsonPanelComponent } from "./json-panel.component";
import { WorkspaceViewFacade } from "./workspace-view.facade";

@Component({
  selector: "app-workspace-view",
  standalone: true,
  imports: [CommonModule, FormsModule, JsonPanelComponent],
  template: `
    <div class="stack">
      <article class="card">
        <h2>Scope</h2>
        <p>Keep tenant and workspace context pinned while you work through the first vertical slice.</p>
        <div class="form-grid">
          <label>
            Tenant Key
            <input id="tenantKey" name="tenantKey" [(ngModel)]="view.workspace.tenantKey" (change)="view.persistState()" />
          </label>
          <label>
            Workspace Key
            <input id="workspaceKey" name="workspaceKey" [(ngModel)]="view.workspace.workspaceKey" (change)="view.persistState()" />
          </label>
          <label>
            Auto Refresh Active View
            <span class="inline-toggle">
              <input
                id="autoRefreshEnabled"
                name="autoRefreshEnabled"
                type="checkbox"
                [(ngModel)]="view.workspace.autoRefreshEnabled"
                (change)="view.onAutoRefreshSettingsChanged()"
              />
              Refresh workspace, content, runtime, and diagnostics views automatically
            </span>
          </label>
          <label>
            Refresh Every (Seconds)
            <input
              id="autoRefreshSeconds"
                name="autoRefreshSeconds"
                type="number"
                min="3"
                step="1"
                [(ngModel)]="view.workspace.autoRefreshSeconds"
                (change)="view.onAutoRefreshSettingsChanged()"
              />
          </label>
        </div>
      </article>

      <article class="card">
        <h2>Workspace Setup</h2>
        <div class="actions">
          <button class="primary" type="button" (click)="view.createTenant()">Create Tenant</button>
          <button class="secondary" type="button" (click)="view.createWorkspace()">Create Workspace</button>
          <button class="ghost" type="button" (click)="view.refreshWorkspaceOverview()">Refresh Workspace Overview</button>
        </div>
      </article>

      <app-json-panel
        title="Workspace Overview"
        subtitle="Read Model"
        viewId="workspaceOverviewView"
        [content]="view.workspace.workspaceOverviewView"
      ></app-json-panel>

      <app-json-panel
        title="Workspace Activity"
        subtitle="Operator Timeline"
        viewId="workspaceActivityView"
        [content]="view.workspaceActivityView"
      ></app-json-panel>
    </div>
  `
})
export class WorkspaceViewComponent implements OnInit {
  readonly view = inject(WorkspaceViewFacade);

  ngOnInit(): void {
    this.view.init();
  }
}
