import { productionApiRoutes } from "@testcenter-rewrite-app/contracts";

export const productionWebShell = {
  workspace: "rewrite-app/web",
  shells: [
    "platform-admin",
    "workspace-admin",
    "monitor"
  ],
  firstSliceNavigation: [
    {
      id: "workspace-setup",
      title: "Workspace Setup",
      routes: [
        productionApiRoutes.platform.createTenant,
        productionApiRoutes.workspace.createWorkspace
      ]
    },
    {
      id: "content-activation",
      title: "Content Activation",
      routes: [
        productionApiRoutes.workspace.createSourcePackage,
        productionApiRoutes.workspace.createImportJob,
        productionApiRoutes.workspace.activateContentRelease
      ]
    },
    {
      id: "runtime-monitoring",
      title: "Runtime And Monitor",
      routes: [
        productionApiRoutes.participant.signIn,
        productionApiRoutes.participant.launch,
        productionApiRoutes.monitor.openRuns
      ]
    }
  ]
} as const;
