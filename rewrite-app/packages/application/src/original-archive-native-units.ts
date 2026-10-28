import type {OriginalNativeUnit, ParticipantSession, TestRun} from '@testcenter-rewrite-app/domain';
import type {FirstSliceRepository} from './index.js';
import {assertOriginalUnitParent, assertOriginalUnitRecord, originalUnitHistoryUnavailable} from './original-unit-record.js';

/** Native answers are independent of canonical Run.unitResponses. Read them
 * in one scoped batch and validate each selected Unit against its parent. */
export async function readOriginalArchiveNativeUnits(repository: FirstSliceRepository, input: {
  tenantId: string; workspaceId: string; testRuns: TestRun[];
  participantSessions: ParticipantSession[]; groupKeys: string[];
}): Promise<OriginalNativeUnit[]> {
  if (!input.groupKeys.length) return [];
  const people = new Map(input.participantSessions.map(person => [person.participantSessionId, person]));
  const runs = new Map(input.testRuns.map(run => [run.testRunId, run]));
  const units: OriginalNativeUnit[] = [];
  for (const unit of await repository.listOriginalUnitsByWorkspace(input.tenantId, input.workspaceId)) {
    const run = runs.get(unit.testRunId), person = people.get(unit.participantSessionId);
    if (!person || !input.groupKeys.includes(person.groupKey)) continue;
    assertOriginalUnitRecord(unit);
    assertOriginalUnitParent(unit, run, person);
    if (unit.unknownHistory) throw originalUnitHistoryUnavailable();
    units.push(unit);
  }
  return units;
}
