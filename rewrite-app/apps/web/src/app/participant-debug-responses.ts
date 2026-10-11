import type { ParticipantCurrentRunState } from "@testcenter-rewrite-app/domain";
import { findParticipantSaveOutboxEntryForUnit } from "./participant-save-outbox";

type Capture = { testRunId: string; unitKey: string; response: string } | null;
type Sources = { pending: Capture; optimistic: Capture; ephemeral: ReadonlyMap<string, ReadonlyMap<string, string>> };

/** The diagnostic reads local captures without advancing or acknowledging their delivery. */
export const readParticipantDebugResponses = (
  state: ParticipantCurrentRunState | null, sources: Sources,
  findOutbox: typeof findParticipantSaveOutboxEntryForUnit = findParticipantSaveOutboxEntryForUnit
): Record<string, string> => {
  if (!state) return {};
  const run = state.testRun.testRunId;
  return Object.fromEntries(state.bookletUnits.map(unit => [unit.unitKey,
    (sources.pending?.testRunId === run && sources.pending.unitKey === unit.unitKey ? sources.pending.response : null) ??
    (sources.optimistic?.testRunId === run && sources.optimistic.unitKey === unit.unitKey ? sources.optimistic.response : null) ??
    findOutbox(run, unit.unitKey)?.response ?? sources.ephemeral.get(run)?.get(unit.unitKey) ?? state.testRun.unitResponses[unit.unitKey] ?? ""
  ]));
};
