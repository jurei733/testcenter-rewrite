import type {
  CreateImportJobRequest,
  CreateImportJobResponse,
  CreateSourcePackageRequest,
  CreateSourcePackageResponse,
  GetContentReleaseResponse,
  GetImportJobResponse,
  GetSourcePackageResponse,
  RetrySourcePackageImportRequest,
  RetrySourcePackageImportResponse
} from "@testcenter-rewrite-app/contracts";
import { productionApiRoutes, resolveRoutePath } from "@testcenter-rewrite-app/contracts";

export interface ContentActionsHost {
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
  getSourceFileName(): string;
  getSourceMediaType(): string;
  getSourceDocument(): string;
  getImportJobId(): string;
  getContentReleaseId(): string;
  setSourcePackageId(nextValue: string): void;
  setImportJobId(nextValue: string): void;
  setContentReleaseId(nextValue: string): void;
  persistShellState(): void;
  rememberActivity(title: string, detail: string): void;
  refreshContentReads(quiet?: boolean): Promise<void>;
  loadSourcePackageDetail(): Promise<GetSourcePackageResponse>;
  loadImportJobDetail(): Promise<GetImportJobResponse>;
  loadContentReleaseDetail(): Promise<GetContentReleaseResponse>;
  loadContentReleaseActivationReadiness(): Promise<unknown>;
}

export async function createSourcePackageAction(
  host: ContentActionsHost
): Promise<void> {
  const payload = await host.request<CreateSourcePackageResponse>(
    "Create Source Package",
    "POST",
    resolveRoutePath(productionApiRoutes.workspace.createSourcePackage, {
      tenantKey: host.getTenantKey(),
      workspaceKey: host.getWorkspaceKey()
    }),
    {
      fileName: host.getSourceFileName(),
      mediaType: host.getSourceMediaType(),
      sourceDocument: host.getSourceDocument()
    } satisfies CreateSourcePackageRequest
  );

  host.setSourcePackageId(payload.sourcePackage.sourcePackageId);
  host.persistShellState();
  host.rememberActivity(
    "Source Package Created",
    `${payload.sourcePackage.fileName} uploaded as ${payload.sourcePackage.sourcePackageId}.`
  );
  await host.loadSourcePackageDetail();
}

export async function createImportJobAction(host: ContentActionsHost): Promise<void> {
  const payload = await host.request<CreateImportJobResponse>(
    "Create Import Job",
    "POST",
    resolveRoutePath(productionApiRoutes.workspace.createImportJob, {
      tenantKey: host.getTenantKey(),
      workspaceKey: host.getWorkspaceKey()
    }),
    {
      sourcePackageId: host.getSourcePackageId()
    } satisfies CreateImportJobRequest
  );

  host.setImportJobId(payload.importJob.importJobId);
  host.setContentReleaseId(
    payload.stagedContentRelease?.contentReleaseId ?? host.getContentReleaseId()
  );
  host.persistShellState();
  host.rememberActivity(
    "Import Started",
    `Import ${payload.importJob.importJobId} finished as ${payload.importJob.status}.`
  );

  await host.refreshContentReads();
  await host.loadImportJobDetail();
  if (host.getContentReleaseId()) {
    await host.loadContentReleaseActivationReadiness();
    await host.loadContentReleaseDetail();
  }
}

export async function retrySourcePackageImportAction(
  host: ContentActionsHost
): Promise<void> {
  const payload = await host.request<RetrySourcePackageImportResponse>(
    "Retry Source Package Import",
    "POST",
    resolveRoutePath(productionApiRoutes.workspace.retrySourcePackageImport, {
      tenantKey: host.getTenantKey(),
      workspaceKey: host.getWorkspaceKey(),
      sourcePackageId: host.getSourcePackageId()
    }),
    {
      fileName: host.getSourceFileName(),
      mediaType: host.getSourceMediaType(),
      sourceDocument: host.getSourceDocument()
    } satisfies RetrySourcePackageImportRequest
  );

  host.setImportJobId(payload.importJob?.importJobId ?? host.getImportJobId());
  host.setContentReleaseId(
    payload.stagedContentRelease?.contentReleaseId ?? host.getContentReleaseId()
  );
  host.persistShellState();
  host.rememberActivity(
    "Import Retried",
    `Package ${host.getSourcePackageId()} produced import ${payload.importJob?.importJobId ?? "n/a"} with status ${payload.importJob?.status ?? "unknown"}.`
  );

  await host.refreshContentReads();
  await host.loadSourcePackageDetail();
  if (host.getImportJobId()) {
    await host.loadImportJobDetail();
  }
  if (host.getContentReleaseId()) {
    await host.loadContentReleaseDetail();
  }
}
