import { Component, inject } from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";

import { OriginalWorkspaceFilesComponent } from "./original-workspace-files.component";
import type { OriginalNumericWorkspaceRoute } from "./original-workspace-browser-route";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";

@Component({
  selector: "app-original-numeric-workspace",
  imports: [RouterLink, OriginalWorkspaceFilesComponent],
  template: `
    @if (workspace; as active) {
      <app-original-workspace-files
        [sessionToken]="state.ops.adminSessionToken"
        [tenantKey]="active.tenantKey" [workspaceKey]="active.workspaceKey"
        [workspaceNumber]="active.workspaceNumber" [nativeRole]="active.mode" />
    } @else {
      <section class="workspace-unavailable" role="alert">
        @if (resolution.kind === "unavailable") {
          <p>Der Arbeitsbereich konnte nicht geladen werden.</p>
          <button type="button" (click)="reload()">Erneut laden</button>
        } @else {
          <p>Dieser Arbeitsbereich ist für Sie nicht freigegeben.</p>
        }
        <a routerLink="/operator-start" [queryParams]="{ui:'original'}">Zur Übersicht</a>
      </section>
    }
  `,
  styles: [`
    :host { display: flex; flex: 1; flex-direction: column; min-height: 0; }
    .workspace-unavailable { padding: 24px; }
    .workspace-unavailable button { margin-right: 16px; }
  `]
})
export class OriginalNumericWorkspaceComponent {
  readonly state = inject(RewriteAppUiStateService);
  private readonly route = inject(ActivatedRoute);

  get resolution(): OriginalNumericWorkspaceRoute {
    return this.route.snapshot.data["originalWorkspace"] as OriginalNumericWorkspaceRoute;
  }

  get workspace() {
    this.state.renderVersion();
    const current = this.resolution;
    return current.kind === "workspace" && current.token === this.state.ops.adminSessionToken
      ? current.workspace : null;
  }

  reload(): void {
    window.location.reload();
  }
}
