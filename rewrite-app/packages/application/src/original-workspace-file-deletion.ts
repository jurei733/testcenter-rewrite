import type {OriginalWorkspaceFileDeletionReport, WorkspaceCatalogFile, WorkspaceFileCatalog, WorkspaceSourcePackageDeletionReadiness} from '@testcenter-rewrite-app/domain';
import type {ContentIntakePort} from './index.js';
import {FirstSliceError} from './first-slice-error.js';
import {findOriginalWorkspaceFile} from './original-workspace-files.js';
import type {OriginalWorkspaceAdministrationScope} from './original-workspace-administration.js';
import type {OriginalWorkspaceWriteAuthority} from './original-workspace-write.js';

export function readOriginalWorkspaceFileDeletion(body: unknown): string[] {
  const paths = body !== null && typeof body === 'object' && Object.hasOwn(body, 'f')
    ? (body as {f: unknown}).f : undefined;
  if (paths == null) {
    throw new FirstSliceError(400, 'original_file_deletion_missing', 'Required body-parameter is missing: `f`');
  }
  if (!Array.isArray(paths) || paths.some(path => typeof path !== 'string')) {
    throw new FirstSliceError(400, 'original_file_deletion_invalid', 'File selection must be an array of paths.');
  }
  return paths;
}

type DeletionStatus = keyof OriginalWorkspaceFileDeletionReport;
type Selection = {path: string; status: DeletionStatus; file?: undefined}
  | {path: string; status?: DeletionStatus; file: WorkspaceCatalogFile};

function selectPath(catalog: WorkspaceFileCatalog, path: string): Selection {
  const separator = path.indexOf('/');
  if (separator < 0) return {path, status: 'incorrect_path'};
  const type = path.slice(0, separator);
  const name = path.slice(separator + 1);
  if (!type || !name || name === '.' || name === '..' || /[/\\\x00-\x1f\x7f]/.test(type + name)) {
    return {path, status: 'not_allowed'};
  }
  const file = findOriginalWorkspaceFile(catalog, type, name);
  return file ? {path, file} : {path, status: 'did_not_exist'};
}

export async function deleteOriginalWorkspaceFiles(
  scope: OriginalWorkspaceAdministrationScope & {authority: OriginalWorkspaceWriteAuthority},
  catalog: WorkspaceFileCatalog,
  paths: string[],
  deleteSourcePackage: ContentIntakePort['deleteSourcePackage']
): Promise<OriginalWorkspaceFileDeletionReport> {
  const selection = paths.map(path => selectPath(catalog, path));
  let pending = selection.filter(row => row.file !== undefined);
  while (pending.length) {
    const selectedIds = new Set(pending.map(row => row.file.sourcePackageId));
    const deferred: typeof pending = [];
    let deleted = false;
    for (const row of pending) {
      try {
        await deleteSourcePackage({
          ...scope, sourcePackageId: row.file.sourcePackageId, confirmation: row.file.fileName
        });
        row.status = 'deleted';
        deleted = true;
      } catch (error) {
        if (!(error instanceof FirstSliceError)) throw error;
        switch (error.errorCode) {
          case 'source_package_not_found':
            row.status = 'did_not_exist';
            break;
          case 'source_package_delete_conflict':
            row.status = 'error';
            break;
          case 'source_package_delete_blocked': {
            const blockers = (error.details as WorkspaceSourcePackageDeletionReadiness).blockingDependencies;
            if (blockers.length && blockers.every(blocker => blocker.dependencyType === 'workspace_source_package_reference'
              && blocker.dependencyId !== row.file.sourcePackageId && selectedIds.has(blocker.dependencyId))) {
              deferred.push(row);
            } else {
              row.status = 'was_used';
            }
            break;
          }
          default:
            throw error;
        }
      }
    }
    if (!deleted) {
      for (const row of deferred) row.status = 'was_used';
      break;
    }
    pending = deferred;
  }
  const report: OriginalWorkspaceFileDeletionReport = {
    deleted: [], did_not_exist: [], not_allowed: [], was_used: [], incorrect_path: [], error: []
  };
  for (const row of selection) report[row.status ?? 'error'].push(row.path);
  return report;
}
