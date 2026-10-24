import { workspaceFileReplacementIdentity, type WorkspaceCatalogInput } from './workspace-file-catalog.js';

/** Source Workspace::categorizeFile overwrite constraints. The protected file
 * endpoint derives the existing filename server-side; canonical package history
 * still uses the existing reservation/revision boundary after this preflight.
 */
export function workspaceFileReplacementConflict(previous: WorkspaceCatalogInput, next: WorkspaceCatalogInput): {
  code: string; message: string;
} | null {
  const oldFile = workspaceFileReplacementIdentity(previous), newFile = workspaceFileReplacementIdentity(next);
  const error = (kind: string, detail: string) => ({code: 'workspace_file_' + kind,
    message: `File of name \`${previous.fileName}\` did already exist. Overwriting was rejected since ${detail}.`});
  if (oldFile.fileType === 'Package' || newFile.fileType === 'Package') {
    return error('container_replacement_unsupported', 'workspace file replacement requires a loose typed file');
  }
  if (oldFile.fileType !== newFile.fileType) return error('type_mismatch', 'the replacement has a different file type');
  if (oldFile.identifier !== newFile.identifier) return error('identifier_mismatch',
    `new file's ID (\`${newFile.identifier}\`) differs from old one (\`${oldFile.identifier}\`)`);
  if (oldFile.moduleId !== newFile.moduleId) return error('module_id_mismatch',
    `new file's Verona-Module-ID (\`${newFile.moduleId}\`) differs from old one (\`${oldFile.moduleId}\`)`);
  const version = (value: string) => value.split(/[.-]/).map(part => Number.parseInt(part, 10) || 0);
  const [oldMajor = 0, oldMinor = 0] = version(oldFile.version);
  const [newMajor = 0, newMinor = 0] = version(newFile.version);
  if (oldMajor !== newMajor || newMinor < oldMinor) return error('version_mismatch',
    `version conflict between old (${oldFile.version}) and new (${newFile.version}) file`);
  return null;
}
