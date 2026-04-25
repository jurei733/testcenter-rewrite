import { randomUUID } from "node:crypto";

export type SourcePackageFormat = "xml-archive" | "xml-manifest";
export type SourcePackageStatus = "uploaded";
export type ImportJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface SourcePackage {
  sourcePackageId: string;
  tenantId: string;
  workspaceId: string;
  fileName: string;
  manifestHash: string;
  format: SourcePackageFormat;
  status: SourcePackageStatus;
  uploadedAt: string;
  uploadedBy: string;
}

export interface ImportJob {
  importJobId: string;
  tenantId: string;
  workspaceId: string;
  sourcePackageId: string;
  status: ImportJobStatus;
  createdAt: string;
  completedAt: string | null;
  failureMessage: string | null;
}

const createGeneratedId = (prefix: string): string => `${prefix}-${randomUUID()}`;

export const createSourcePackage = (input: {
  tenantId: string;
  workspaceId: string;
  fileName: string;
  manifestHash: string;
  format: SourcePackageFormat;
  uploadedBy: string;
}): SourcePackage => ({
  sourcePackageId: createGeneratedId("source-package"),
  tenantId: input.tenantId,
  workspaceId: input.workspaceId,
  fileName: input.fileName,
  manifestHash: input.manifestHash,
  format: input.format,
  status: "uploaded",
  uploadedAt: new Date().toISOString(),
  uploadedBy: input.uploadedBy
});

export const createImportJob = (input: {
  tenantId: string;
  workspaceId: string;
  sourcePackageId: string;
}): ImportJob => ({
  importJobId: createGeneratedId("import-job"),
  tenantId: input.tenantId,
  workspaceId: input.workspaceId,
  sourcePackageId: input.sourcePackageId,
  status: "queued",
  createdAt: new Date().toISOString(),
  completedAt: null,
  failureMessage: null
});
