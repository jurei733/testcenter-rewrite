import type { ContentReleaseBookletEntry, ContentReleaseUnitEntry, TestRun } from "@testcenter-rewrite-app/domain";
import type { ParticipantNativeCommandRequest } from "@testcenter-rewrite-app/contracts/participant-native-command";

export class ParticipantNativeCommandError extends Error {
  constructor(readonly errorCode: string, message: string) { super(message); }
}

/** Original root handler: exact aliases, immediate-parent unlocks and restored minutes. */
export const projectParticipantNativeCommand = (input: {
  request: ParticipantNativeCommandRequest;
  booklet: ContentReleaseBookletEntry;
  testRun: TestRun;
  timestamp: string;
  timedKey: (unitKey: string | null) => string | null;
  remaining: (timer: NonNullable<TestRun["testletTimers"]>[string]) => number;
  interrupt: (run: TestRun, timerKey: string) => TestRun;
  cancel: (run: TestRun, timerKey: string) => TestRun;
  activate: (run: TestRun) => TestRun;
  accessible: (run: TestRun, unit: ContentReleaseUnitEntry) => boolean;
}): TestRun => {
  const { request, booklet, timestamp } = input;
  const original = input.testRun;
  if (original.status === "completed") throw new ParticipantNativeCommandError("participant_native_run_completed", "The selected Run is completed.");
  let next = structuredClone(original);
  const currentTimedKey = input.timedKey(original.currentUnitKey);
  if (request.keyword === "pause" || request.keyword === "terminate") {
    if (currentTimedKey) next = input.interrupt(next, currentTimedKey);
    return { ...next, status: "paused", pauseSource: request.keyword === "pause" ? "participant" :
      request.controllerStatus === "PAUSED" ? original.pauseSource ?? "participant" : "participant",
      locked: original.locked === true || request.keyword === "terminate" && request.arguments.includes("lock"),
      updatedAt: timestamp, completedAt: null };
  }
  if (request.keyword === "goto") {
    const args = request.arguments;
    let target: ContentReleaseUnitEntry | undefined;
    if (args.length > 1 && args[0] === "id") target = booklet.unitEntries.find(unit => unit.unitKey === args[1]);
    else if (args.length === 1 && args[0] !== "0") {
      const sequence = Number(args[0]);
      if (Number.isSafeInteger(sequence) && sequence > 0) target = booklet.unitEntries[sequence - 1];
    }
    if (!target) throw new ParticipantNativeCommandError("participant_native_goto_target_invalid", "Use an existing Unit sequence or ['id', exactAlias].");
    const targetTimedKey = input.timedKey(target.unitKey);
    const parentKey = target.testletPath?.at(-1) ?? "[0]";
    const parent = booklet.testletEntries?.find(entry => entry.testletKey === parentKey);
    if (targetTimedKey !== currentTimedKey) {
      // The root Source evaluates params[2] even when the target parent is untimed.
      if (args[2] === undefined) throw new ParticipantNativeCommandError("participant_native_goto_time_required", "A cross-timer goto requires its third argument.");
      if (currentTimedKey) next = input.cancel(next, currentTimedKey);
      const timer = next.testletTimers?.[parentKey];
      const timeMax = parentKey === "[0]" ? booklet.rootRestrictions?.timeMax : parent?.restrictions?.timeMax;
      if (timeMax?.minutes && timer && input.remaining(timer) <= 0) {
        const requestedMinutes = Number.parseInt(args[2].trim().split(" ").at(-1) ?? "", 10);
        const minutes = requestedMinutes > 0 ? Math.min(requestedMinutes, timeMax.minutes) : timeMax.minutes;
        const remainingSeconds = Math.max(1, Math.ceil(minutes * 60));
        next.testletTimers = { ...next.testletTimers, [parentKey]: { ...timer, status: "paused",
          durationSeconds: Math.max(1, Math.ceil(timeMax.minutes * 60)), remainingSeconds, expiresAt: null,
          updatedAt: timestamp, endedAt: null, interruptedAtUnitKey: undefined } };
      }
    }
    next = { ...next,
      unlockedTestletKeys: parent?.restrictions?.codeToEnter?.code
        ? [...new Set([...(next.unlockedTestletKeys ?? []), parentKey])] : next.unlockedTestletKeys,
      lockedTestletKeys: (next.lockedTestletKeys ?? []).filter(key => key !== parentKey),
      lockedUnitKeys: (next.lockedUnitKeys ?? []).filter(key => key !== target!.unitKey) };
    next.currentUnitKey = target.unitKey;
  }
  // Both Goto and Resume enter through Original's UnitActivateGuard. A missing
  // current Unit is not an instruction to select the first authored Unit.
  const requestedIndex = booklet.unitEntries.findIndex(unit => unit.unitKey === next.currentUnitKey);
  const requested = booklet.unitEntries[requestedIndex];
  if (requested && !input.accessible(next, requested)) {
    next.currentUnitKey = booklet.unitEntries.slice(requestedIndex + 1)
      .find(unit => input.accessible(next, unit))?.unitKey ?? requested.unitKey;
  }
  if (currentTimedKey) next = input.interrupt(next, currentTimedKey);
  const timerKey = input.timedKey(next.currentUnitKey);
  if (timerKey && next.testletTimers?.[timerKey]?.interruptedAtUnitKey) {
    const timer = next.testletTimers[timerKey]!;
    next.testletTimers = { ...next.testletTimers, [timerKey]: { ...timer, interruptedAtUnitKey: undefined } };
  }
  return input.activate({ ...next, status: "running", pauseSource: undefined, updatedAt: timestamp });
};
