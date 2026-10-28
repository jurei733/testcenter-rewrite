import type {PoolClient} from 'pg';
import type {ParticipantSession} from '@testcenter-rewrite-app/domain';
import {prepareOriginalTestNumber, type OriginalTestNumberInput, type OriginalTestNumberRun} from '@testcenter-rewrite-app/application';

/** Caller owns a transaction and parent-before-Run locks. Re-read the mapping
 * after the global counter lock so concurrent same-Run reservations agree. */
export async function allocateOriginalTestNumber(client: PoolClient, input: OriginalTestNumberInput, run: OriginalTestNumberRun | null, person: ParticipantSession | null): Promise<string> {
  const counter = (await client.query('SELECT last_number FROM original_test_number_counter WHERE singleton=1 FOR UPDATE')).rows[0];
  const row = (await client.query('SELECT * FROM original_test_numbers WHERE test_run_id=$1',[input.testRunId])).rows[0];
  const existing = row ? {testNumber:String(row.test_number),testRunId:String(row.test_run_id),participantSessionId:String(row.participant_session_id),tenantId:String(row.tenant_id),workspaceId:String(row.workspace_id),contentReleaseId:String(row.content_release_id)} : undefined;
  const prepared = prepareOriginalTestNumber(input, run, person, existing, String(counter?.last_number));
  if (prepared.changed) {
    await client.query('UPDATE original_test_number_counter SET last_number=$1 WHERE singleton=1',[prepared.counter]);
    if (!existing) await client.query('INSERT INTO original_test_numbers(test_number,test_run_id,participant_session_id,tenant_id,workspace_id,content_release_id) VALUES($1,$2,$3,$4,$5,$6)',
      [prepared.record.testNumber,input.testRunId,input.participantSessionId,input.tenantId,input.workspaceId,input.contentReleaseId]);
  }
  return prepared.record.testNumber;
}
