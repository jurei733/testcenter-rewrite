import type { SourcePackageStatus, WorkspaceFileType } from './index.js';

export type WorkspaceFileRelationship = 'hasBooklet' | 'containsUnit' | 'usesPlayer' |
  'usesScheme' | 'usesPlayerResource' | 'isDefinedBy';
export type WorkspaceFileReference = {
  reference: string;
  fileType: WorkspaceFileType;
  relationship: WorkspaceFileRelationship;
};
export type WorkspaceCatalogDependency = {
  sourcePackageId: string;
  fileName: string;
  relationship: WorkspaceFileRelationship;
};
export type WorkspaceCatalogFile = {
  sourcePackageId: string;
  fileName: string;
  fileType: WorkspaceFileType;
  status: SourcePackageStatus;
  uploadedAt: string;
  fileSizeBytes: number | null;
  metadata: {
    identifier: string;
    label: string;
    description: string;
    participantCount: number | null;
    veronaVersion: string | null;
    moduleVersion: string | null;
  };
  dependencies: WorkspaceCatalogDependency[];
  unresolvedReferences: Array<WorkspaceFileReference & { candidateSourcePackageIds: string[] }>;
  totalSizeBytes: number | null;
  validationDiagnostics?: Array<{code: string; severity: 'error' | 'warning' | 'info'; message: string}>;
};
export type WorkspaceFileCatalog = {
  items: WorkspaceCatalogFile[];
  totalCount: number;
  dependencySizesCalculated: boolean;
};
