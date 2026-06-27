import type { Routes } from "@angular/router";

import { ContentViewComponent } from "./content-view.component";
import { OpsViewComponent } from "./ops-view.component";
import { ParticipantViewComponent } from "./participant-view.component";
import { RuntimeViewComponent } from "./runtime-view.component";
import { WorkspaceViewComponent } from "./workspace-view.component";

export const appRoutes: Routes = [
  { path: "", pathMatch: "full", redirectTo: "workspace" },
  { path: "workspace", component: WorkspaceViewComponent },
  { path: "content", component: ContentViewComponent },
  { path: "runtime", component: RuntimeViewComponent },
  { path: "participant", component: ParticipantViewComponent },
  { path: "ops", component: OpsViewComponent },
  { path: "**", redirectTo: "workspace" }
];
