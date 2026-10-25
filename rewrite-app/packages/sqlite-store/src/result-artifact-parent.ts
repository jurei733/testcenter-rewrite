import {rollbackAfterFailure} from './transaction-rollback.js';
import type {DatabaseSync} from 'node:sqlite';
import {assertResultArtifactParent, resultParentUnavailable, type ResultArtifactParent} from '@testcenter-rewrite-app/application';
export function guardResultArtifactParent(database: DatabaseSync, input: ResultArtifactParent | null): void {
  if (!input) return;
  const run = input.testRunId === undefined ? undefined : database.prepare('SELECT test_run_id AS testRunId,participant_session_id AS participantSessionId,tenant_id AS tenantId,workspace_id AS workspaceId FROM test_runs WHERE test_run_id=?').get(input.testRunId);
  const personId = input.participantSessionId ?? run?.participantSessionId;
  if (typeof personId !== 'string') throw resultParentUnavailable();
  const person = database.prepare('SELECT participant_session_id AS participantSessionId,tenant_id AS tenantId,workspace_id AS workspaceId FROM participant_sessions WHERE participant_session_id=?').get(personId);
  assertResultArtifactParent(input, person as {participantSessionId:string;tenantId:string;workspaceId:string} | undefined,
    run as {testRunId:string;participantSessionId:string;tenantId:string;workspaceId:string} | undefined);
}
export function withResultArtifactParent<Result>(database: DatabaseSync, input: ResultArtifactParent | null, operation: () => Result): Result {
  database.exec('BEGIN IMMEDIATE');
  try {guardResultArtifactParent(database, input); const result = operation(); database.exec('COMMIT'); return result;}
  catch (error) {return rollbackAfterFailure(database, error);}
}
