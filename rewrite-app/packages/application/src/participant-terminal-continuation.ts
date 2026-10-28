import type { ParticipantRunCommandEffect, ParticipantSession, TestRun } from "@testcenter-rewrite-app/domain";

/** The saved-buffer continuation owns departure/lock, not a second controller projection. */
export const projectSupersededParticipantTermination = (
  run: TestRun, session: ParticipantSession, lock: boolean, timestamp: string
): Pick<ParticipantRunCommandEffect, "testRun" | "participantSession" | "controllerEntryActive" | "superseded"> => ({
  testRun: { ...run, ...(lock ? { locked: true } : {}), updatedAt: timestamp },
  participantSession: { ...session, status: "signed_in" },
  controllerEntryActive: false,
  superseded: true
  // No controllerDispatch: the later highwater is retained by the store helper.
});
