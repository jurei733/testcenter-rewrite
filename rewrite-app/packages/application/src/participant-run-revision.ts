import type { TestRun } from "@testcenter-rewrite-app/domain";
import { isDeepStrictEqual } from "node:util";

/** Number each committed Run projection under its store lock, never a caller's snapshot. */
export const withParticipantRunRevision = (previous: TestRun, projected: TestRun): TestRun => {
  const revision = previous.stateRevision ?? 0;
  if (previous.stateRevision !== undefined && (!Number.isSafeInteger(revision) || revision < 1)) {
    throw new Error("The persisted participant Run revision is invalid.");
  }
  const next = { ...projected };
  if (previous.stateRevision === undefined) delete next.stateRevision;
  else next.stateRevision = previous.stateRevision;
  const fields = (run: TestRun) => Object.fromEntries(Object.entries(run).filter(([, value]) => value !== undefined));
  if (isDeepStrictEqual(fields(next), fields(previous))) return { ...previous };
  if (!Number.isSafeInteger(revision + 1)) throw new Error("Participant Run revision is exhausted.");
  return { ...next, stateRevision: revision + 1 };
};
