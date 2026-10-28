import type { ParticipantDebugSnapshot } from "@testcenter-rewrite-app/domain";

export const participantDebugStateRoute = "/api/v1/participant/sessions/:participantSessionId/debug-state";
export type ParticipantDebugStateRequest = {
  /** Read-only local captures, including non-saving modes; never written to the store. */
  unitResponses?: Record<string, string>;
  conditionXml?: string;
};
export type ParticipantDebugStateResponse = { debugState: ParticipantDebugSnapshot };
