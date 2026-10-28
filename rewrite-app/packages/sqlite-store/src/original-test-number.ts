import type {DatabaseSync} from 'node:sqlite';
import type {ParticipantSession} from '@testcenter-rewrite-app/domain';
import {prepareOriginalTestNumber, type OriginalTestNumberInput, type OriginalTestNumberRun} from '@testcenter-rewrite-app/application';

/** Caller owns BEGIN IMMEDIATE and the current parent/Run scope. */
export function allocateOriginalTestNumber(database: DatabaseSync, input: OriginalTestNumberInput, run: OriginalTestNumberRun | null, person: ParticipantSession | null): string {
  const row = database.prepare('SELECT * FROM original_test_numbers WHERE test_run_id=?').get(input.testRunId);
  const existing = row ? {testNumber:String(row.test_number),testRunId:String(row.test_run_id),participantSessionId:String(row.participant_session_id),tenantId:String(row.tenant_id),workspaceId:String(row.workspace_id),contentReleaseId:String(row.content_release_id)} : undefined;
  const counter = database.prepare('SELECT last_number FROM original_test_number_counter WHERE singleton=1').get();
  const prepared = prepareOriginalTestNumber(input, run, person, existing, String(counter?.last_number));
  if (prepared.changed) {
    database.prepare('UPDATE original_test_number_counter SET last_number=? WHERE singleton=1').run(prepared.counter);
    if (!existing) database.prepare('INSERT INTO original_test_numbers(test_number,test_run_id,participant_session_id,tenant_id,workspace_id,content_release_id) VALUES(?,?,?,?,?,?)')
      .run(prepared.record.testNumber,input.testRunId,input.participantSessionId,input.tenantId,input.workspaceId,input.contentReleaseId);
  }
  return prepared.record.testNumber;
}
