import type { Routes } from "@angular/router";

import { OpsViewComponent } from "./ops-view.component";
import { RuntimeViewComponent } from "./runtime-view.component";
import { WorkspaceViewComponent } from "./workspace-view.component";
import {
  rejectSystemCheckOperator,
  requireAdministrativeOperator
} from "./rewrite-app-admin-route.guard";

export const appRoutes: Routes = [
  { path: "", pathMatch: "full", redirectTo: "workspace" },
  {
    path: "workspace",
    component: WorkspaceViewComponent,
    canActivate: [requireAdministrativeOperator]
  },
  {
    path: "content",
    loadComponent: () =>
      import("./content-view.component").then(
        module => module.ContentViewComponent
      ),
    canActivate: [requireAdministrativeOperator]
  },
  {
    path: "runtime",
    component: RuntimeViewComponent,
    canActivate: [rejectSystemCheckOperator]
  },
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
  {
    path: "ops",
    component: OpsViewComponent,
    canActivate: [rejectSystemCheckOperator]
  },
  { path: "**", redirectTo: "workspace" }
];
