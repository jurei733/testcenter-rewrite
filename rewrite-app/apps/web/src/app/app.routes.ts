import type { Routes } from "@angular/router";
import {Injector,inject} from '@angular/core';

import {
  rejectSystemCheckOperator,
  requireAuthenticatedOperator,
  requireAdministrativeOperator,
  requireOriginalWorkspaceSession,
  requireOriginalNumericWorkspaceActor,
  resolveLegacySuperadminBookmark
} from "./rewrite-app-admin-route.guard";
import { matchOriginalNumericWorkspace, resolveOriginalNumericWorkspace } from "./original-workspace-browser-route";
import { preventParticipantBrowserNavigation } from "./participant-navigation.guard";
import { gateAttachmentManager, gateLegacyGroupMonitorBookmark, gateStudyMonitor } from "./native-monitor/native-session-route.guard";

const canonicalRoutes: Routes = [
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
    path: "operator-start",
    loadComponent: () =>
      import("./original-operator-starter.component").then(
        module => module.OriginalOperatorStarterComponent
      ),
    canActivate: [requireAdministrativeOperator, requireOriginalWorkspaceSession]
  },
  {
    matcher: matchOriginalNumericWorkspace,
    loadComponent: () => import("./original-numeric-workspace.component").then(module => module.OriginalNumericWorkspaceComponent),
    canActivate: [requireOriginalNumericWorkspaceActor, requireOriginalWorkspaceSession],
    resolve: { originalWorkspace: resolveOriginalNumericWorkspace }
  },
  {path: "superadmin", children: [
    {path: "", pathMatch: "full", canActivate: [resolveLegacySuperadminBookmark], children: []},
    {path: ":section", pathMatch: "full", canActivate: [resolveLegacySuperadminBookmark], children: []},
    {path: "**", canActivate: [resolveLegacySuperadminBookmark], data: {fallbackSection: true}, children: []}
  ]},
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

const participantEntry = () => import('./native-participant/native-participant-entry.component')
  .then(module => module.NativeParticipantEntryComponent);
const nativeInfoPage = () => import('./native-public-info-page.component').then(module => module.NativePublicInfoPageComponent);

export const appRoutes: Routes = [
  ...['legal-notice','privacy','accessibility'].map(notice=>({path:'native-info/'+notice,loadComponent:nativeInfoPage,data:{notice}})),
  {path:'r/check-starter',pathMatch:'full',loadComponent:()=>import('./native-system-check/native-system-check-starter.component').then(module=>module.NativeSystemCheckStarterComponent)},
  {path:'check/:workspaceId/:checkName/:step',loadComponent:()=>import('./native-system-check/native-system-check-entry.component').then(module=>module.NativeSystemCheckEntryComponent)},
  {path:'check/:workspaceId/:checkName',pathMatch:'full',redirectTo:'check/:workspaceId/:checkName/w'},
  {path:'native-start/direct',loadComponent:participantEntry,data:{directLogin:true}},
  {path:'native-start/login',loadComponent:participantEntry,data:{explicitLogin:true}},
  {path:'native-start/not-found',loadComponent:participantEntry,data:{notFound:true}},
  {path:'native-start/starter',loadComponent:participantEntry,data:{legacyEntry:'starter'}},
  {path:'native-start/dispatch',loadComponent:participantEntry,data:{legacyEntry:'dispatch'}},
  {path:'native-start',loadComponent:participantEntry},
  {path:'native-test',loadChildren:()=>import('./native-participant/native-routes').then(module=>module.nativeParticipantRoutes)},
  {path:'study-monitor/:workspace',canActivate:[gateStudyMonitor],loadComponent:()=>
    import('./native-monitor/native-study-monitor.component').then(module=>module.NativeStudyMonitorComponent)},
  {path:'attachment-manager/:group',canActivate:[gateAttachmentManager],loadComponent:()=>
    import('./native-monitor/native-attachment-entry.component').then(module=>module.NativeAttachmentEntryComponent),children:[
      {path:'',pathMatch:'full',redirectTo:'attachment-overview'},
      {path:'attachment-overview',loadComponent:()=>
        import('./native-monitor/native-attachment-overview.component').then(module=>module.NativeAttachmentOverviewComponent)},
      {path:'capture-image',loadComponent:()=>import('./native-monitor/native-attachment-capture.component')
        .then(module=>module.NativeAttachmentCaptureComponent)}
    ]},
  {path:'group-monitor',canActivate:[gateLegacyGroupMonitorBookmark],
    loadComponent:()=>import('./native-monitor/native-monitor-entry.component').then(module=>module.NativeMonitorEntryComponent),
    loadChildren:()=>import('./native-monitor/group-monitor/group-monitor.routes').then(module=>module.groupMonitorRoutes)
  },
  {path:"",canActivate:[async()=>{
    const injector=inject(Injector);
    const {AppShellFacade}=await import('./app-shell.facade');
    injector.get(AppShellFacade).init();
    return true;
  }],loadComponent:()=>import("./app.component").then(module=>module.AppComponent),children:canonicalRoutes}
];
