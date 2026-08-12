import type { Routes } from "@angular/router";

import {
  rejectSystemCheckOperator,
  requireAuthenticatedOperator,
  requireAdministrativeOperator
} from "./rewrite-app-admin-route.guard";
import { preventParticipantBrowserNavigation } from "./participant-navigation.guard";

export const appRoutes: Routes = [
  { path: "", pathMatch: "full", redirectTo: "home" },
  {
    path: "home",
    loadComponent: () =>
      import("./home-view.component").then(module => module.HomeViewComponent)
  },
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
    canActivate: [requireAuthenticatedOperator]
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
    path: "attachment-capture",
    loadComponent: () =>
      import("./attachment-capture.component").then(
        module => module.AttachmentCaptureComponent
      ),
    canActivate: [requireAuthenticatedOperator]
  },
  {
    path: "legal-notice",
    loadComponent: () =>
      import("./legal-notice.component").then(
        module => module.LegalNoticeComponent
      )
  },
  {
    path: "ops",
    loadComponent: () =>
      import("./ops-view.component").then(module => module.OpsViewComponent),
    canActivate: [rejectSystemCheckOperator]
  },
  { path: "**", redirectTo: "home" }
];
