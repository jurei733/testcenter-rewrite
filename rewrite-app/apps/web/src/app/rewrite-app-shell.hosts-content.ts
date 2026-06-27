import type {
  GetContentReleaseActivationReadinessResponse,
  GetContentReleaseResponse,
  GetImportJobResponse,
  GetSourcePackageResponse
} from "@testcenter-rewrite-app/contracts";
import { productionApiRoutes, resolveRoutePath } from "@testcenter-rewrite-app/contracts";

import type { ShellActivationActionsHost } from "./rewrite-app-shell.activation-actions";
import type { ActivationGuardHost } from "./rewrite-app-shell.activation";
import type { ContentActionsHost } from "./rewrite-app-shell.content-actions";
import type { ContentDetailsHost } from "./rewrite-app-shell.content-details";
import type { ShellContentReadsHost } from "./rewrite-app-shell.content-reads";
import type { WorkspaceContentPresentationHost } from "./rewrite-app-shell.content";
import type { ShellContentState, ShellWorkspaceState } from "./rewrite-app-shell.state";

export function createContentReadsStateHost(args: {
  request<T>(
    label: string,
    method: string,
    path: string,
    body?: unknown,
    options?: { quiet?: boolean }
  ): Promise<T>;
  workspaceState: ShellWorkspaceState;
  contentState: ShellContentState;
  createWorkspaceContentPresentationHost(): WorkspaceContentPresentationHost;
}): ShellContentReadsHost {
  const readQueryValue = (value: unknown): string =>
    typeof value === "string" ? value.trim() : String(value ?? "").trim();

  const appendQuery = (
    path: string,
    entries: Array<[string, unknown]>
  ): string => {
    const query = new URLSearchParams();
    for (const [key, value] of entries) {
      const trimmedValue = readQueryValue(value);
      if (trimmedValue) {
        query.set(key, trimmedValue);
      }
    }

    const queryString = query.toString();
    return queryString ? `${path}?${queryString}` : path;
  };

  const buildWorkspaceActivityPath = (): string => {
    const path = resolveRoutePath(
      productionApiRoutes.workspace.listWorkspaceActivityEvents,
      {
        tenantKey: args.workspaceState.tenantKey.trim(),
        workspaceKey: args.workspaceState.workspaceKey.trim()
      }
    );
    const query = new URLSearchParams();
    const eventType = readQueryValue(args.workspaceState.workspaceActivityEventType);
    const subjectType = readQueryValue(args.workspaceState.workspaceActivitySubjectType);
    const subjectId = readQueryValue(args.workspaceState.workspaceActivitySubjectId);
    const limit = readQueryValue(args.workspaceState.workspaceActivityLimit);

    if (eventType) {
      query.set("eventType", eventType);
    }
    if (subjectType) {
      query.set("subjectType", subjectType);
    }
    if (subjectId) {
      query.set("subjectId", subjectId);
    }
    if (limit) {
      query.set("limit", limit);
    }

    const queryString = query.toString();
    return queryString ? `${path}?${queryString}` : path;
  };

  const buildSourcePackagesPath = (): string =>
    appendQuery(
      resolveRoutePath(productionApiRoutes.workspace.listSourcePackages, {
        tenantKey: args.workspaceState.tenantKey.trim(),
        workspaceKey: args.workspaceState.workspaceKey.trim()
      }),
      [
        ["status", args.contentState.sourcePackageStatusFilter],
        ["mediaType", args.contentState.sourcePackageMediaTypeFilter],
        ["fileName", args.contentState.sourcePackageFileNameFilter],
        [
          "latestImportStatus",
          args.contentState.sourcePackageLatestImportStatusFilter
        ],
        ["limit", args.contentState.sourcePackageLimit]
      ]
    );

  const buildImportJobsPath = (): string =>
    appendQuery(
      resolveRoutePath(productionApiRoutes.workspace.listImportJobs, {
        tenantKey: args.workspaceState.tenantKey.trim(),
        workspaceKey: args.workspaceState.workspaceKey.trim()
      }),
      [
        ["status", args.contentState.importJobStatusFilter],
        ["sourcePackageId", args.contentState.importJobSourcePackageFilter],
        ["limit", args.contentState.importJobLimit]
      ]
    );

  const buildContentReleasesPath = (): string =>
    appendQuery(
      resolveRoutePath(productionApiRoutes.workspace.listContentReleases, {
        tenantKey: args.workspaceState.tenantKey.trim(),
        workspaceKey: args.workspaceState.workspaceKey.trim()
      }),
      [
        ["status", args.contentState.contentReleaseStatusFilter],
        ["importJobId", args.contentState.contentReleaseImportJobFilter],
        ["sourcePackageId", args.contentState.contentReleaseSourcePackageFilter],
        ["limit", args.contentState.contentReleaseLimit]
      ]
    );

  return {
    request: args.request,
    getWorkspaceOverviewPath: () =>
      resolveRoutePath(productionApiRoutes.workspace.getWorkspaceOverview, {
        tenantKey: args.workspaceState.tenantKey.trim(),
        workspaceKey: args.workspaceState.workspaceKey.trim()
      }),
    getWorkspaceActivityPath: buildWorkspaceActivityPath,
    getSourcePackagesPath: buildSourcePackagesPath,
    getImportJobsPath: buildImportJobsPath,
    getParticipantSessionsPath: () =>
      resolveRoutePath(productionApiRoutes.workspace.listParticipantSessions, {
        tenantKey: args.workspaceState.tenantKey.trim(),
        workspaceKey: args.workspaceState.workspaceKey.trim()
      }),
    getContentReleasesPath: buildContentReleasesPath,
    createWorkspaceContentPresentationHost: args.createWorkspaceContentPresentationHost
  };
}

export function createContentActionsStateHost(args: {
  request<T>(
    label: string,
    method: string,
    path: string,
    body?: unknown,
    options?: { quiet?: boolean }
  ): Promise<T>;
  workspaceState: ShellWorkspaceState;
  contentState: ShellContentState;
  persistShellState(): void;
  rememberActivity(title: string, detail: string): void;
  refreshContentReads(quiet?: boolean): Promise<void>;
  loadSourcePackageDetail(): Promise<GetSourcePackageResponse>;
  loadImportJobDetail(): Promise<GetImportJobResponse>;
  loadContentReleaseDetail(): Promise<GetContentReleaseResponse>;
  loadContentReleaseActivationReadiness(): Promise<unknown>;
}): ContentActionsHost {
  return {
    request: args.request,
    getTenantKey: () => args.workspaceState.tenantKey.trim(),
    getWorkspaceKey: () => args.workspaceState.workspaceKey.trim(),
    getSourcePackageId: () => args.contentState.sourcePackageId.trim(),
    getSourceFileName: () => args.contentState.sourceFileName.trim(),
    getSourceMediaType: () => args.contentState.sourceMediaType.trim(),
    getSourceDocument: () => args.contentState.sourceDocument,
    getImportJobId: () => args.contentState.importJobId.trim(),
    getContentReleaseId: () => args.contentState.contentReleaseId.trim(),
    setSourcePackageId: nextValue => {
      args.contentState.sourcePackageId = nextValue;
    },
    setImportJobId: nextValue => {
      args.contentState.importJobId = nextValue;
    },
    setContentReleaseId: nextValue => {
      args.contentState.contentReleaseId = nextValue;
    },
    persistShellState: args.persistShellState,
    rememberActivity: args.rememberActivity,
    refreshContentReads: args.refreshContentReads,
    loadSourcePackageDetail: args.loadSourcePackageDetail,
    loadImportJobDetail: args.loadImportJobDetail,
    loadContentReleaseDetail: args.loadContentReleaseDetail,
    loadContentReleaseActivationReadiness:
      args.loadContentReleaseActivationReadiness
  };
}

export function createContentDetailsStateHost(args: {
  request<T>(
    label: string,
    method: string,
    path: string,
    body?: unknown,
    options?: { quiet?: boolean }
  ): Promise<T>;
  workspaceState: ShellWorkspaceState;
  contentState: ShellContentState;
  persistShellState(): void;
  rememberActivity(title: string, detail: string): void;
  applyActivationReadiness(
    payload: GetContentReleaseActivationReadinessResponse
  ): void;
}): ContentDetailsHost {
  return {
    request: args.request,
    getTenantKey: () => args.workspaceState.tenantKey.trim(),
    getWorkspaceKey: () => args.workspaceState.workspaceKey.trim(),
    getSourcePackageId: () => args.contentState.sourcePackageId.trim(),
    getImportJobId: () => args.contentState.importJobId.trim(),
    getContentReleaseId: () => args.contentState.contentReleaseId.trim(),
    getSourcePackageDetailView: () => args.contentState.sourcePackageDetailView,
    setSourcePackageDetailView: nextValue => {
      args.contentState.sourcePackageDetailView = nextValue;
    },
    getImportJobDetailView: () => args.contentState.importJobDetailView,
    setImportJobDetailView: nextValue => {
      args.contentState.importJobDetailView = nextValue;
    },
    getContentReleaseActivationReadinessView: () =>
      args.contentState.contentReleaseActivationReadinessView,
    setContentReleaseActivationReadinessView: nextValue => {
      args.contentState.contentReleaseActivationReadinessView = nextValue;
    },
    getContentReleaseDetailView: () => args.contentState.contentReleaseDetailView,
    setContentReleaseDetailView: nextValue => {
      args.contentState.contentReleaseDetailView = nextValue;
    },
    setImportJobId: nextValue => {
      args.contentState.importJobId = nextValue;
    },
    setContentReleaseId: nextValue => {
      args.contentState.contentReleaseId = nextValue;
    },
    persistShellState: args.persistShellState,
    rememberActivity: args.rememberActivity,
    applyActivationReadiness: args.applyActivationReadiness
  };
}

export function createActivationActionsStateHost(args: {
  request<T>(label: string, method: string, path: string, body?: unknown): Promise<T>;
  isBlockedActivationError(error: unknown): boolean;
  workspaceState: ShellWorkspaceState;
  contentState: ShellContentState;
  createActivationGuardHost(): ActivationGuardHost;
  rememberActivity(title: string, detail: string): void;
  refreshContentReads(): Promise<void>;
  loadContentReleaseActivationReadiness(): Promise<unknown>;
  loadContentReleaseDetail(): Promise<unknown>;
}): ShellActivationActionsHost {
  return {
    request: args.request,
    isBlockedActivationError: args.isBlockedActivationError,
    getActivateContentReleasePath: () =>
      resolveRoutePath(productionApiRoutes.workspace.activateContentRelease, {
        tenantKey: args.workspaceState.tenantKey.trim(),
        workspaceKey: args.workspaceState.workspaceKey.trim(),
        contentReleaseId: args.contentState.contentReleaseId.trim()
      }),
    getContentReleaseId: () => args.contentState.contentReleaseId.trim(),
    getForceActivation: () => args.contentState.forceActivation,
    createActivationGuardHost: args.createActivationGuardHost,
    rememberActivity: args.rememberActivity,
    refreshContentReads: args.refreshContentReads,
    loadContentReleaseActivationReadiness:
      args.loadContentReleaseActivationReadiness,
    loadContentReleaseDetail: args.loadContentReleaseDetail
  };
}
