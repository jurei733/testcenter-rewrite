import type { ParticipantCurrentRunState, ParticipantDebugSnapshot } from "@testcenter-rewrite-app/domain";
import { resolveRoutePath } from "@testcenter-rewrite-app/contracts";
import { participantDebugStateRoute } from "@testcenter-rewrite-app/contracts/participant-debug";
import { readParticipantSessionCredential } from "./participant-access-credentials";
import { withSelectedParticipantRun } from "./participant-session-links";

export const participantDebugScopeKey = (state: Pick<ParticipantCurrentRunState, "testRun">): string => JSON.stringify([
  state.testRun.tenantId, state.testRun.workspaceId, state.testRun.participantSessionId,
  state.testRun.testRunId, state.testRun.contentReleaseId, state.testRun.bookletKey
]);

/** Reject late/foreign data before exposing definitions, coding schemes or responses. */
export const readParticipantDebugSnapshot = async (
  state: Pick<ParticipantCurrentRunState, "testRun">, signal: AbortSignal
): Promise<ParticipantDebugSnapshot> => {
  const run = state.testRun;
  const credential = readParticipantSessionCredential(run.participantSessionId);
  if (!credential) throw new Error("The participant session is signed out.");
  const response = await fetch(withSelectedParticipantRun(resolveRoutePath(participantDebugStateRoute,
    { participantSessionId: run.participantSessionId }), run.testRunId), {
    cache: "no-store", signal, headers: { authorization: `Bearer ${credential}` }
  });
  if (!response.ok) throw new Error(`Debug state request failed (HTTP ${response.status}).`);
  const value: unknown = await response.json();
  const snapshot = (value as { debugState?: ParticipantDebugSnapshot } | null)?.debugState;
  if (!snapshot || !snapshot.scope || !snapshot.booklet || !Array.isArray(snapshot.booklet.unitEntries) ||
    !Array.isArray(snapshot.variables) || !Array.isArray(snapshot.states) ||
    snapshot.booklet.bookletKey !== run.bookletKey ||
    (["tenantId", "workspaceId", "participantSessionId", "testRunId", "contentReleaseId", "bookletKey"] as const)
      .some(key => snapshot.scope[key] !== run[key])) throw new Error("The debug state does not belong to the selected Run.");
  return snapshot;
};
