import type { Routes } from "@angular/router";

import {
  rejectSystemCheckOperator,
  requireAdministrativeOperator
} from "./rewrite-app-admin-route.guard";
import { preventParticipantBrowserNavigation } from "./participant-navigation.guard";

export const appRoutes: Routes = [
  { path: "", pathMatch: "full", redirectTo: "workspace" },
  {
    path: "workspace",
    loadComponent: () =>
      import("./workspace-view.component").then(
        module => module.WorkspaceViewComponent
      ),
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
    loadComponent: () =>
      import("./runtime-view.component").then(
        module => module.RuntimeViewComponent
      ),
    canActivate: [rejectSystemCheckOperator]
  },
  {
    path: "participant",
    loadComponent: () =>
      import("./participant-view.component").then(
        module => module.ParticipantViewComponent
      ),
    canDeactivate: [preventParticipantBrowserNavigation]
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
    loadComponent: () =>
      import("./ops-view.component").then(module => module.OpsViewComponent),
    canActivate: [rejectSystemCheckOperator]
  },
  { path: "**", redirectTo: "workspace" }
];
