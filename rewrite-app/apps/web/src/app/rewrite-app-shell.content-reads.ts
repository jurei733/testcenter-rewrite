import type {
  GetWorkspaceOverviewResponse,
  ListContentReleasesResponse,
  ListImportJobsResponse,
  ListParticipantSessionsResponse,
  ListSourcePackagesResponse,
  ListWorkspaceActivityEventsResponse
} from "@testcenter-rewrite-app/contracts";

import {
  applyContentReads,
  applyWorkspaceOverviewRead,
  type WorkspaceContentPresentationHost
} from "./rewrite-app-shell.content";

export interface ShellContentReadsHost {
  request<T>(
    label: string,
    method: string,
    path: string,
    body?: unknown,
    options?: { quiet?: boolean }
  ): Promise<T>;
  getWorkspaceOverviewPath(): string;
  getWorkspaceActivityPath(): string;
  getSourcePackagesPath(): string;
  getSourcePackagesExportPath(): string;
  getImportJobsPath(): string;
  getImportJobsExportPath(): string;
  getParticipantSessionsPath(): string;
  getContentReleasesPath(): string;
  getContentReleasesExportPath(): string;
  createWorkspaceContentPresentationHost(): WorkspaceContentPresentationHost;
}

export async function refreshWorkspaceOverviewAction(
  host: ShellContentReadsHost,
  quiet = false
): Promise<void> {
  const payload = await host.request<GetWorkspaceOverviewResponse>(
    "Workspace Overview",
    "GET",
    host.getWorkspaceOverviewPath(),
    undefined,
    { quiet }
  );
  applyWorkspaceOverviewRead(
    host.createWorkspaceContentPresentationHost(),
    payload,
    quiet
  );
}

export async function refreshContentReadsAction(
  host: ShellContentReadsHost,
  quiet = false
): Promise<void> {
  const [workspaceActivity, sourcePackages, importJobs, participantSessions, contentReleases] =
    await Promise.all([
      host.request<ListWorkspaceActivityEventsResponse>(
        "Workspace Activity",
        "GET",
        host.getWorkspaceActivityPath(),
        undefined,
        { quiet }
      ),
      host.request<ListSourcePackagesResponse>(
        "Source Packages",
        "GET",
        host.getSourcePackagesPath(),
        undefined,
        { quiet }
      ),
      host.request<ListImportJobsResponse>(
        "Import Jobs",
        "GET",
        host.getImportJobsPath(),
        undefined,
        { quiet }
      ),
      host.request<ListParticipantSessionsResponse>(
        "Participant Sessions",
        "GET",
        host.getParticipantSessionsPath(),
        undefined,
        { quiet }
      ),
      host.request<ListContentReleasesResponse>(
        "Content Releases",
        "GET",
        host.getContentReleasesPath(),
        undefined,
        { quiet }
      )
    ]);

  applyContentReads(
    host.createWorkspaceContentPresentationHost(),
    {
      workspaceActivity,
      sourcePackages,
      importJobs,
      participantSessions,
      contentReleases
    },
    quiet
  );
}
