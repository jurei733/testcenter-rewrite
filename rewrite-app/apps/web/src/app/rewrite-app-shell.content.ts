import type {
  GetWorkspaceOverviewResponse,
  ListContentReleasesResponse,
  ListImportJobsResponse,
  ListParticipantSessionsResponse,
  ListSourcePackagesResponse,
  ListWorkspaceActivityEventsResponse
} from "@testcenter-rewrite-app/contracts";

import { prettyPrintJson } from "./rewrite-app-shell.readers";

export interface WorkspaceContentPresentationHost {
  getWorkspaceOverviewView(): string;
  setWorkspaceOverviewView(nextValue: string): void;
  setWorkspaceLoaded(nextValue: boolean): void;
  updateWorkspaceSummary(headline: string, detail: string): void;
  rememberActivity(title: string, detail: string): void;

  getWorkspaceActivityView(): string;
  setWorkspaceActivityView(nextValue: string): void;
  getSourcePackagesView(): string;
  setSourcePackagesView(nextValue: string): void;
  getImportJobsView(): string;
  setImportJobsView(nextValue: string): void;
  getParticipantSessionsView(): string;
  setParticipantSessionsView(nextValue: string): void;
  getContentReleasesView(): string;
  setContentReleasesView(nextValue: string): void;
  setContentLoaded(nextValue: boolean): void;
  updateContentSummary(headline: string, detail: string): void;

  getSourcePackageId(): string;
  setSourcePackageId(nextValue: string): void;
  getImportJobId(): string;
  setImportJobId(nextValue: string): void;
  getContentReleaseId(): string;
  setContentReleaseId(nextValue: string): void;
}

export function applyWorkspaceOverviewRead(
  host: WorkspaceContentPresentationHost,
  payload: GetWorkspaceOverviewResponse,
  quiet: boolean
): void {
  host.setWorkspaceOverviewView(
    prettyPrintJson(payload, host.getWorkspaceOverviewView())
  );
  host.setWorkspaceLoaded(true);

  const overview = payload.workspaceOverview;
  host.updateWorkspaceSummary(
    overview.workspace.displayName || overview.workspace.workspaceKey,
    `${overview.sourcePackageCount} package(s), ${overview.importJobCount} import(s), ${overview.contentReleaseCount} release(s), ${overview.openTestRunCount} open run(s)`
  );

  if (!quiet) {
    host.rememberActivity(
      "Workspace Refreshed",
      `${overview.workspace.workspaceKey} now shows ${overview.openTestRunCount} open run(s) and ${overview.contentReleaseCount} release(s).`
    );
  }
}

export function applyContentReads(
  host: WorkspaceContentPresentationHost,
  payload: {
    workspaceActivity: ListWorkspaceActivityEventsResponse;
    sourcePackages: ListSourcePackagesResponse;
    importJobs: ListImportJobsResponse;
    participantSessions: ListParticipantSessionsResponse;
    contentReleases: ListContentReleasesResponse;
  },
  quiet: boolean
): void {
  host.setWorkspaceActivityView(
    prettyPrintJson(payload.workspaceActivity, host.getWorkspaceActivityView())
  );
  host.setSourcePackagesView(
    prettyPrintJson(payload.sourcePackages, host.getSourcePackagesView())
  );
  host.setImportJobsView(
    prettyPrintJson(payload.importJobs, host.getImportJobsView())
  );
  host.setParticipantSessionsView(
    prettyPrintJson(payload.participantSessions, host.getParticipantSessionsView())
  );
  host.setContentReleasesView(
    prettyPrintJson(payload.contentReleases, host.getContentReleasesView())
  );
  host.setContentLoaded(true);

  const latestImport = payload.importJobs.items[0]?.importJob;
  const latestRelease = payload.contentReleases.items[0]?.contentRelease;
  const failedImportCount = payload.importJobs.items.filter(
    item => item.importJob.status === "failed"
  ).length;

  host.updateContentSummary(
    latestRelease?.status ?? latestImport?.status ?? "empty",
    `${payload.sourcePackages.items.length} package(s), ${payload.importJobs.items.length} import(s), ${payload.participantSessions.items.length} session(s), ${payload.contentReleases.items.length} release(s), ${failedImportCount} failed import(s)`
  );

  host.setSourcePackageId(
    payload.sourcePackages.items[0]?.sourcePackage.sourcePackageId ??
      host.getSourcePackageId()
  );
  host.setImportJobId(
    payload.importJobs.items[0]?.importJob.importJobId ?? host.getImportJobId()
  );
  host.setContentReleaseId(
    payload.contentReleases.items[0]?.contentRelease.contentReleaseId ??
      host.getContentReleaseId()
  );

  const latestActivity = payload.workspaceActivity.items[0]?.activityEvent;
  if (latestActivity) {
    host.rememberActivity("Workspace Activity", latestActivity.summary);
  } else if (!quiet) {
    host.rememberActivity(
      "Content Refreshed",
      `Loaded ${payload.contentReleases.items.length} release(s) and ${payload.importJobs.items.length} import job(s).`
    );
  }
}
