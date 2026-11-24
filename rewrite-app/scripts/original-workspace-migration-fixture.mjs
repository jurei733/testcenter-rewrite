// Remove the workspace file-mutation schema together with its migration record
// when preparing a database from before SQLite 84 or PostgreSQL 78.
export const workspaceFileMutationRollbackSql = `
  ALTER TABLE workspaces DROP COLUMN original_file_mutation_id;
  ALTER TABLE workspaces DROP COLUMN original_file_mutation_expires_at;
`;
