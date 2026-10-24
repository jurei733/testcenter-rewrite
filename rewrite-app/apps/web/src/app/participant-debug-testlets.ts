import type { ParticipantCurrentRunState, ParticipantDebugSnapshot } from "@testcenter-rewrite-app/domain";

export const participantDebugRootTestletKey = "[0]";
const lockTypes = ["show", "time", "code", "afterLeave"] as const;
export type ParticipantDebugTestletState = {
  testletKey: string;
  blockLabel: string;
  timerId: string | null;
  locks: Record<typeof lockTypes[number], boolean>;
  locked: { by: typeof lockTypes[number]; through: string } | null;
};

/** Read-only Source lock precedence, including the ancestor that caused a lock. */
export const readParticipantDebugTestlets = (
  state: ParticipantCurrentRunState, snapshot: ParticipantDebugSnapshot, now: number
): Map<string, ParticipantDebugTestletState> => {
  const result = new Map<string, ParticipantDebugTestletState>();
  const scopeKeys = ["tenantId", "workspaceId", "participantSessionId", "testRunId", "contentReleaseId", "bookletKey"] as const;
  if (scopeKeys.some(key => typeof snapshot.scope?.[key] !== "string" || !snapshot.scope[key] ||
    snapshot.scope[key] !== state.testRun[key])) return result;
  const entries = new Map((snapshot.booklet.testletEntries ?? []).map(entry => [entry.testletKey, entry]));
  const codeRequired = new Map(state.booklet.testlets.map(entry => [entry.testletKey, entry.requiresCode]));
  const states = new Map(snapshot.adaptiveStates.map(entry => [entry.stateKey, entry.optionKey]));
  const keys = [participantDebugRootTestletKey, ...entries.keys()];
  for (const key of keys) {
    const path: string[] = [], seen = new Set<string>();
    let ancestor: string | null = key;
    while (ancestor !== null && !result.has(ancestor)) {
      if (seen.has(ancestor)) throw new Error("The diagnostic booklet has cyclic Testlet parents.");
      seen.add(ancestor); path.push(ancestor);
      ancestor = ancestor === participantDebugRootTestletKey ? null : entries.get(ancestor)?.parentTestletKey ?? participantDebugRootTestletKey;
      if (ancestor !== null && ancestor !== participantDebugRootTestletKey && !entries.has(ancestor)) {
        throw new Error("The diagnostic booklet has an unknown Testlet parent.");
      }
    }
    for (const id of path.reverse()) {
      const entry = entries.get(id), isRoot = id === participantDebugRootTestletKey;
      const parent = isRoot ? null : result.get(entry?.parentTestletKey ?? participantDebugRootTestletKey)!;
      const restrictions = isRoot ? snapshot.booklet.rootRestrictions : entry?.restrictions;
      const timer = state.testRun.testletTimers?.[id];
      const remaining = timer?.status === "running" && timer.expiresAt
        ? Math.min(timer.durationSeconds, Math.max(0, (Date.parse(timer.expiresAt) - now) / 1_000)) : timer?.remainingSeconds;
      const show = entry?.restrictions?.show;
      const requiresCode = codeRequired.get(id) ?? Boolean(entry?.restrictions?.codeToEnter?.code);
      const locks: ParticipantDebugTestletState["locks"] = {
        show: Boolean(show && states.get(show.stateKey) !== show.optionKey),
        time: Boolean(restrictions?.timeMax?.minutes && remaining !== undefined && remaining <= 0),
        code: requiresCode && !state.testRun.unlockedTestletKeys?.includes(id),
        afterLeave: Boolean(entry?.restrictions?.lockAfterLeaving && state.testRun.lockedTestletKeys?.includes(id))
      };
      const by = lockTypes.find(type => locks[type]);
      result.set(id, {
        testletKey: id,
        blockLabel: isRoot ? "" : parent?.testletKey === participantDebugRootTestletKey ? entry?.displayLabel ?? "" : parent?.blockLabel ?? "",
        timerId: parent?.timerId ?? (restrictions?.timeMax?.minutes ? id : null),
        locks,
        locked: parent?.locked ? { ...parent.locked } : by ? { by, through: id } : null
      });
    }
  }
  return result;
};
