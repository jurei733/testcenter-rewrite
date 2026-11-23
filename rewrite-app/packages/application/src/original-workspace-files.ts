import type {WorkspaceCatalogFile, WorkspaceFileCatalog} from '@testcenter-rewrite-app/domain';
import {FirstSliceError} from './first-slice-error.js';

type FileType = Exclude<WorkspaceCatalogFile['fileType'], 'Package'>;
type Dependency = {object_name: string; relationship_type: WorkspaceCatalogFile['dependencies'][number]['relationship']};
type FileDigest = {
  name: string;
  size: number;
  modificationTime: number;
  type: FileType;
  id: string;
  report: {error: string[]; warning: string[]; info: string[]};
  dependencies: Dependency[];
  info: {label: string; description: string; testtakers?: number; veronaModuleType?: string; veronaVersion?: string; version?: string};
};

export function readOriginalWorkspaceFileSelection(value: unknown): Set<string> {
  const names = value !== null && typeof value === 'object' && Object.hasOwn(value, 'body')
    ? (value as {body?: unknown}).body : undefined;
  if (names == null) {
    throw new FirstSliceError(400, 'original_file_selection_missing', 'Required body-parameter is missing: `body`');
  }
  // The Original UI sends one null placeholder for each absent file type.
  if (!Array.isArray(names) || names.some(name => name !== null && typeof name !== 'string')) {
    throw new FirstSliceError(400, 'original_file_selection_invalid', 'File selection must be an array of file names.');
  }
  return new Set(names.filter((name): name is string => typeof name === 'string'));
}

const originalName = (name: string): string => name.split(/[\\/]/).at(-1) ?? name;

export function findOriginalWorkspaceFile(catalog: WorkspaceFileCatalog, fileType: string, fileName: string): WorkspaceCatalogFile | undefined {
  const matches = catalog.items.filter(file => file.fileType !== 'Package' &&
    file.fileType === fileType && originalName(file.fileName) === fileName);
  return matches.length === 1 ? matches[0] : undefined;
}

function dependenciesOf(file: WorkspaceCatalogFile): Dependency[] {
  const distinct = new Map<string, Dependency>();
  for (const dependency of file.dependencies) {
    const relation = {object_name: originalName(dependency.fileName), relationship_type: dependency.relationship};
    distinct.set(JSON.stringify([relation.object_name, relation.relationship_type]), relation);
  }
  return [...distinct.values()];
}

export function projectOriginalWorkspaceFileDigests(catalog: WorkspaceFileCatalog, names?: ReadonlySet<string>):
  Partial<Record<FileType, FileDigest[]>> | [] {
  const visible = catalog.items.filter((file): file is WorkspaceCatalogFile & {fileType:FileType} => file.fileType !== 'Package');
  const selected = names === undefined ? visible : visible.filter(file => names.has(originalName(file.fileName)));
  if (!selected.length) return [];

  const grouped: Partial<Record<FileType, FileDigest[]>> = {};
  const ordered = selected.map(file => {
    const name = originalName(file.fileName);
    return {file, name, bytes:Buffer.from(name, 'utf8')};
  }).sort((a, b) => Buffer.compare(a.bytes, b.bytes));
  for (const {file, name} of ordered) {
    const metadata = file.metadata;
    const report: FileDigest['report'] = {error: [], warning: [], info: []};
    for (const entry of file.validationDiagnostics ?? []) {
      if (entry.severity === 'warning' && entry.message.includes('is never used')) continue;
      report[entry.severity].push(entry.message);
    }
    for (const reference of file.unresolvedReferences) {
      report.error.push('Fehlende oder mehrdeutige Abhängigkeit: ' + reference.reference);
    }
    const timestamp = Date.parse(file.uploadedAt);
    (grouped[file.fileType] ??= []).push({
      name,
      size: file.fileSizeBytes ?? 0,
      modificationTime: Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : 0,
      type: file.fileType,
      id: metadata.identifier,
      report,
      dependencies: names === undefined ? [] : dependenciesOf(file),
      info: {
        label: metadata.label,
        description: metadata.description,
        ...(metadata.participantCount === null ? {} : {testtakers: metadata.participantCount}),
        ...(metadata.veronaModuleType === undefined ? {} : {veronaModuleType: metadata.veronaModuleType}),
        ...(metadata.veronaVersion === null ? {} : {veronaVersion: metadata.veronaVersion}),
        ...(metadata.moduleVersion === null ? {} : {version: metadata.moduleVersion})
      }
    });
  }
  return grouped;
}
