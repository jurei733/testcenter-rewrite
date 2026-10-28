import type { TestRun } from "@testcenter-rewrite-app/domain";

/** Project only server-authorized entry transitions from the currently locked Run. */
export const withParticipantControllerEntry = (
  previous: TestRun, projected: TestRun, active?: boolean
): TestRun => {
  const entry = previous.controllerEntry;
  if (entry !== undefined && (!entry || typeof entry.active !== "boolean" ||
      !Number.isSafeInteger(entry.revision) || entry.revision < 1)) {
    throw new Error("The persisted participant controller entry is invalid.");
  }
  if (active !== undefined && typeof active !== "boolean") throw new Error("A controller entry transition requires a boolean.");
  if (projected.status === "completed") active = false;
  const next = { ...projected };
  if (active === undefined) {
    if (entry) next.controllerEntry = { ...entry };
    else delete next.controllerEntry;
    return next;
  }
  const revision = entry && entry.active === active ? entry.revision : (entry?.revision ?? 0) + 1;
  if (!Number.isSafeInteger(revision)) throw new Error("Participant controller entry revision is exhausted.");
  return { ...next, controllerEntry: { active, revision } };
};
