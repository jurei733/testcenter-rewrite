import type { ParticipantControllerDispatch, TestRun } from "@testcenter-rewrite-app/domain";
import { isParticipantControllerDispatch, isParticipantControllerDispatches } from "@testcenter-rewrite-app/contracts/participant-native-command";
export { isParticipantControllerDispatch as validParticipantControllerDispatch } from "@testcenter-rewrite-app/contracts/participant-native-command";

export const participantControllerDispatchSuperseded = (run: TestRun, dispatch?: ParticipantControllerDispatch): boolean => {
  if (dispatch === undefined) return false;
  if (!isParticipantControllerDispatch(dispatch)) throw new Error("The participant controller dispatch is invalid.");
  const previous = Object.hasOwn(run.controllerDispatches ?? {}, dispatch.controllerId) ? run.controllerDispatches![dispatch.controllerId] : 0;
  return dispatch.sequence <= previous;
};

export const withParticipantControllerDispatch = (previous: TestRun, projected: TestRun, dispatch?: ParticipantControllerDispatch): TestRun => {
  const entries = previous.controllerDispatches;
  if (entries !== undefined && !isParticipantControllerDispatches(entries)) {
    throw new Error("The persisted controller dispatches are invalid.");
  }
  const next = { ...projected };
  if (entries) next.controllerDispatches = { ...entries };
  else delete next.controllerDispatches;
  if (dispatch && !participantControllerDispatchSuperseded(previous, dispatch)) {
    next.controllerDispatches = { ...entries, [dispatch.controllerId]: dispatch.sequence };
  }
  return next;
};
