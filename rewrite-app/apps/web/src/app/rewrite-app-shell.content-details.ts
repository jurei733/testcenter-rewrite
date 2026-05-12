import type {
  GetContentReleaseActivationReadinessResponse,
  GetContentReleaseResponse,
  GetImportJobResponse,
  GetSourcePackageResponse
} from "@testcenter-rewrite-app/contracts";
import { productionApiRoutes, resolveRoutePath } from "@testcenter-rewrite-app/contracts";

import { prettyPrintJson } from "./rewrite-app-shell.readers";

export interface ContentDetailsHost {
  request<T>(
    label: string,
    method: string,
    path: string,
    body?: unknown,
    options?: { quiet?: boolean }
  ): Promise<T>;
  getTenantKey(): string;
  getWorkspaceKey(): string;
  getSourcePackageId(): string;
  getImportJobId(): string;
  getContentReleaseId(): string;
  getSourcePackageDetailView(): string;
  setSourcePackageDetailView(nextValue: string): void;
  getImportJobDetailView(): string;
  setImportJobDetailView(nextValue: string): void;
  getContentReleaseActivationReadinessView(): string;
  setContentReleaseActivationReadinessView(nextValue: string): void;
  getContentReleaseDetailView(): string;
  setContentReleaseDetailView(nextValue: string): void;
  setImportJobId(nextValue: string): void;
  setContentReleaseId(nextValue: string): void;
  persistShellState(): void;
  rememberActivity(title: string, detail: string): void;
  applyActivationReadiness(
    payload: GetContentReleaseActivationReadinessResponse
  ): void;
}

export async function loadSourcePackageDetailAction(
  host: ContentDetailsHost
): Promise<GetSourcePackageResponse> {
  const payload = await host.request<GetSourcePackageResponse>(
    "Source Package Detail",
    "GET",
    resolveRoutePath(productionApiRoutes.workspace.getSourcePackage, {
      tenantKey: host.getTenantKey(),
      workspaceKey: host.getWorkspaceKey(),
      sourcePackageId: host.getSourcePackageId()
    })
  );
  host.setSourcePackageDetailView(
    prettyPrintJson(payload, host.getSourcePackageDetailView())
  );
  const sourcePackage = payload.sourcePackageDetail.sourcePackage;
  host.rememberActivity(
    "Source Package Detail",
    `${sourcePackage.fileName} is currently ${sourcePackage.status}.`
  );
  return payload;
}

export async function loadImportJobDetailAction(
  host: ContentDetailsHost
): Promise<GetImportJobResponse> {
  const payload = await host.request<GetImportJobResponse>(
    "Import Job Detail",
    "GET",
    resolveRoutePath(productionApiRoutes.workspace.getImportJob, {
      tenantKey: host.getTenantKey(),
      workspaceKey: host.getWorkspaceKey(),
      importJobId: host.getImportJobId()
    })
  );
  host.setImportJobDetailView(prettyPrintJson(payload, host.getImportJobDetailView()));
  const importJob = payload.importJobDetail.importJob;
  const firstDiagnostic = importJob.diagnostics[0]?.code;
  host.rememberActivity(
    "Import Job Detail",
    `Import ${importJob.importJobId} is ${importJob.status}.${firstDiagnostic ? ` First diagnostic: ${firstDiagnostic}.` : ""}`
  );
  host.setImportJobId(importJob.importJobId);
  host.setContentReleaseId(
    payload.importJobDetail.contentRelease?.contentReleaseId ?? host.getContentReleaseId()
  );
  host.persistShellState();
  return payload;
}

export async function loadContentReleaseActivationReadinessAction(
  host: ContentDetailsHost
): Promise<GetContentReleaseActivationReadinessResponse> {
  const payload = await host.request<GetContentReleaseActivationReadinessResponse>(
    "Content Release Activation Readiness",
    "GET",
    resolveRoutePath(productionApiRoutes.workspace.getContentReleaseActivationReadiness, {
      tenantKey: host.getTenantKey(),
      workspaceKey: host.getWorkspaceKey(),
      contentReleaseId: host.getContentReleaseId()
    })
  );
  host.setContentReleaseActivationReadinessView(
    prettyPrintJson(payload, host.getContentReleaseActivationReadinessView())
  );
  host.applyActivationReadiness(payload);
  return payload;
}

export async function loadContentReleaseDetailAction(
  host: ContentDetailsHost
): Promise<GetContentReleaseResponse> {
  const payload = await host.request<GetContentReleaseResponse>(
    "Content Release Detail",
    "GET",
    resolveRoutePath(productionApiRoutes.workspace.getContentRelease, {
      tenantKey: host.getTenantKey(),
      workspaceKey: host.getWorkspaceKey(),
      contentReleaseId: host.getContentReleaseId()
    })
  );
  host.setContentReleaseDetailView(
    prettyPrintJson(payload, host.getContentReleaseDetailView())
  );
  const release = payload.contentReleaseDetail.contentRelease;
  host.rememberActivity(
    "Release Detail",
    `Release ${release.contentReleaseId} is currently ${release.status}.`
  );
  return payload;
}
