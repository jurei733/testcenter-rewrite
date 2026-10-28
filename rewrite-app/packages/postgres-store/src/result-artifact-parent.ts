import type {Pool, PoolClient} from 'pg';
import {assertResultArtifactParent, resultParentUnavailable, type ResultArtifactParent} from '@testcenter-rewrite-app/application';

/** Lock the parent before its Run, consistently with deletion and mutations.
 * Only identity columns are transported; private result data is not decoded. */
export async function guardResultArtifactParent(client: PoolClient, input: ResultArtifactParent | null, exclusive=false): Promise<void> {
  if (!input) return;
  const initial = input.testRunId === undefined ? undefined : (await client.query('SELECT participant_session_id FROM test_runs WHERE test_run_id=$1', [input.testRunId])).rows[0];
  const personId = input.participantSessionId ?? initial?.participant_session_id;
  if (personId === undefined) throw resultParentUnavailable();
  const person = (await client.query('SELECT participant_session_id AS "participantSessionId",tenant_id AS "tenantId",workspace_id AS "workspaceId" FROM participant_sessions WHERE participant_session_id=$1 FOR '+(exclusive?'UPDATE':'KEY SHARE'), [personId])).rows[0];
  const run = input.testRunId === undefined ? undefined : (await client.query('SELECT test_run_id AS "testRunId",participant_session_id AS "participantSessionId",tenant_id AS "tenantId",workspace_id AS "workspaceId" FROM test_runs WHERE test_run_id=$1 FOR '+(exclusive?'UPDATE':'KEY SHARE'), [input.testRunId])).rows[0];
  assertResultArtifactParent(input, person, run);
}
export async function withResultArtifactParent<Result>(pool: Pool, input: ResultArtifactParent | null, operation: (client: PoolClient) => Promise<Result>, exclusive=false): Promise<Result> {
  const client = await pool.connect();
  try {await client.query('BEGIN'); await guardResultArtifactParent(client, input, exclusive); const result = await operation(client); await client.query('COMMIT'); return result;}
  catch (error) {await client.query('ROLLBACK'); throw error;} finally {client.release();}
}

/** Batch writers acquire all people before any Run, in database order. */
export async function guardResultArtifactBatch(client: PoolClient, inputs: Array<ResultArtifactParent & {participantSessionId: string; testRunId: string}>): Promise<void> {
  const people = (await client.query('SELECT participant_session_id AS "participantSessionId",tenant_id AS "tenantId",workspace_id AS "workspaceId" FROM participant_sessions WHERE participant_session_id=ANY($1::text[]) ORDER BY participant_session_id FOR KEY SHARE', [Array.from(new Set(inputs.map(row => row.participantSessionId)))])).rows;
  const runs = (await client.query('SELECT test_run_id AS "testRunId",participant_session_id AS "participantSessionId",tenant_id AS "tenantId",workspace_id AS "workspaceId" FROM test_runs WHERE test_run_id=ANY($1::text[]) ORDER BY test_run_id FOR KEY SHARE', [Array.from(new Set(inputs.map(row => row.testRunId)))])).rows;
  const byPerson = new Map(people.map(row => [row.participantSessionId, row])), byRun = new Map(runs.map(row => [row.testRunId, row]));
  for (const input of inputs) assertResultArtifactParent(input, byPerson.get(input.participantSessionId), byRun.get(input.testRunId));
}
