import type { Routes } from "@angular/router";

import { ContentViewComponent } from "./content-view.component";
import { OpsViewComponent } from "./ops-view.component";
import { RuntimeViewComponent } from "./runtime-view.component";
import { WorkspaceViewComponent } from "./workspace-view.component";
import { requireAdministrativeOperator } from "./rewrite-app-admin-route.guard";

export const appRoutes: Routes = [
  { path: "", pathMatch: "full", redirectTo: "workspace" },
  {
    path: "workspace",
    component: WorkspaceViewComponent,
    canActivate: [requireAdministrativeOperator]
  },
  {
    path: "content",
    component: ContentViewComponent,
    canActivate: [requireAdministrativeOperator]
  },
  { path: "runtime", component: RuntimeViewComponent },
  {
    path: "participant",
    loadComponent: () =>
      import("./participant-view.component").then(
        module => module.ParticipantViewComponent
      )
  },
  {
    path: "system-check",
    loadComponent: () =>
      import("./system-check-view.component").then(
        module => module.SystemCheckViewComponent
      )
  },
  { path: "ops", component: OpsViewComponent },
  { path: "**", redirectTo: "workspace" }
];
