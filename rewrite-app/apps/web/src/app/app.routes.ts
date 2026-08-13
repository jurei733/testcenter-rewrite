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
      import("./public-info-page.component").then(
        module => module.PublicInfoPageComponent
      ),
    data: {
      title: "Legal notice",
      contentKey: "legalNoticeHtml",
      contentId: "applicationLegalNoticeContent",
      emptyId: "applicationLegalNoticeEmptyState"
    }
  },
  {
    path: "privacy",
    loadComponent: () =>
      import("./public-info-page.component").then(
        module => module.PublicInfoPageComponent
      ),
    data: {
      title: "Privacy",
      contentKey: "privacyNotice",
      contentId: "applicationPrivacyNoticeContent",
      emptyId: "applicationPrivacyNoticeEmptyState"
    }
  },
  {
    path: "accessibility",
    loadComponent: () =>
      import("./public-info-page.component").then(
        module => module.PublicInfoPageComponent
      ),
    data: {
      title: "Accessibility",
      contentKey: "accessibilityNotice",
      contentId: "applicationAccessibilityNoticeContent",
      emptyId: "applicationAccessibilityNoticeEmptyState"
    }
  },
  {
    path: "ops",
    loadComponent: () =>
      import("./ops-view.component").then(module => module.OpsViewComponent),
    canActivate: [rejectSystemCheckOperator]
  },
  { path: "**", redirectTo: "home" }
];
