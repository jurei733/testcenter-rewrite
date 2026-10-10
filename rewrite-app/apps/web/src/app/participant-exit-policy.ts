export { participantStarterExitPreparationRoute } from "@testcenter-rewrite-app/contracts/participant-starter-exit";
import { parseVeronaUnitResponse } from "@testcenter-rewrite-app/contracts";
import { bookletStarterExitDeniedReasons } from "@testcenter-rewrite-app/contracts/booklet-completeness";
import type { ParticipantCustomTextKey } from "@testcenter-rewrite-app/contracts";
import type { ParticipantCurrentRunState } from "@testcenter-rewrite-app/domain";
import type { ParticipantConfirmationDialog, ParticipantViewFacade } from "./participant-view.facade";

type ExitPlan = {
  confirmTestletTimeLeave: boolean;
  confirmTestletLeaveLock: boolean;
  information?: ParticipantConfirmationDialog;
  confirmation?: ParticipantConfirmationDialog;
  advisory?: { title: string; message: string };
  originalNotices: string[];
  afterTimerNotices: string[];
  confirmedNotices: string[];
  prepareTimer: boolean;
};

// Lazy with the foreground exit action: keep dialog copy and completeness
// evaluation out of the initial login bundle without weakening the API guard.
export function planParticipantStarterExit(input: {
  state: ParticipantCurrentRunState;
  response: string;
  timer: ParticipantViewFacade["player"]["testletTimer"];
  lock: ParticipantViewFacade["player"]["leaveLock"];
  customText: (key: ParticipantCustomTextKey, fallback?: string) => string;
}): ExitPlan {
  const { state, lock, customText } = input;
  const timer = input.timer && !["paused", "cancelled", "expired"].includes(input.timer.status) ? input.timer : null;
  const plan: ExitPlan = { confirmTestletTimeLeave: false, confirmTestletLeaveLock: false, originalNotices: [], afterTimerNotices: [], confirmedNotices: [], prepareTimer: false };
  const policy = state.booklet.policy;
  // Source's status page does not deactivate a unit. Visible pauses leave
  // directly; a forced silent pause keeps only the ordinary end-test question.
  if (state.testRun.status === "paused") {
    if (state.executionMode.saveResponses && policy.display.silentMode &&
        (state.executionMode.forceTimeRestrictions || state.executionMode.forceNaviRestrictions)) {
      plan.confirmation = {
        title: "Return to test selection?", message: "Your saved progress will remain available.",
        cancelLabel: "Continue working", confirmLabel: "Return to tests",
        original: {title: "Sicher, dass du den Test beenden möchtest?", message: "",
          cancelLabel: "Abbrechen", confirmLabel: "Bestätigen", confirmMeansContinue: true}
      };
    }
    return plan;
  }
  const parsed = parseVeronaUnitResponse(input.response);
  const hasResponse = input.response.length > 0 || state.currentUnit.unitKey != null &&
    state.testRun.unitResponses?.[state.currentUnit.unitKey] !== undefined;
  const completeness = bookletStarterExitDeniedReasons({
    policy: { ...policy, navigation: { ...policy.navigation, ...state.currentUnit.completenessPolicy } },
    presentationProgress: state.currentUnit.unitKey == null ? "complete" : parsed ? parsed.unitState.presentationProgress : hasResponse ? "complete" : undefined,
    responseProgress: state.currentUnit.unitKey == null ? "complete" : parsed ? parsed.unitState.responseProgress : hasResponse ? input.response.trim() ? "complete" : "none" : undefined
  });
  if (completeness.length && !state.testRun.monitorNavigationUnlocked) {
    if (state.executionMode.forceNaviRestrictions) {
      const title = customText("booklet_msgNavigationDeniedTitle");
      const message = completeness.map(reason => customText(reason === "presentation_incomplete"
        ? "booklet_msgNavigationDeniedText_presentationIncomplete" : "booklet_msgNavigationDeniedText_responsesIncomplete")).join(" ");
      plan.information = { kind: "information", title, message, cancelLabel: "Close", confirmLabel: "",
        original: { title, message, cancelLabel: "", confirmLabel: "", confirmMeansContinue: false } };
      return plan;
    }
    plan.originalNotices.push(`Im Testmodus dürfte hier nicht weiter geblättert\n      werden: ${completeness.map(reason => reason === "presentation_incomplete"
      ? "Es wurde nicht alles gesehen oder abgespielt." : "Es wurde nicht alles bearbeitet.").join(" ")}`);
  }
  if (state.executionMode.forceTimeRestrictions && timer?.leave === "forbidden") {
    plan.originalNotices.push("Es darf erst weiter geblättert werden, wenn die Zeit abgelaufen ist.");
    plan.advisory = {
      title: customText("booklet_warningLeaveTimerBlockTitle", "Leave timed block?"),
      message: customText("booklet_warningLeaveTimerBlockTextPrompt", `The timed block "${timer.displayLabel}" cannot be left while its timer is active.`)
    };
    return plan;
  }
  plan.prepareTimer = !!timer && (timer.leave === "allowed" || !state.executionMode.forceTimeRestrictions);
  if (timer && !state.executionMode.forceTimeRestrictions && timer.leave !== "allowed") {
    plan.afterTimerNotices.push(timer.leave === "forbidden"
      ? "Im Testmodus wäre die Navigation vor Ablauf der Zeit nicht möglich."
      : "Im normalen Testablauf wird beim Verlassen des zeitbegrenzten Blocks eine Warnung angezeigt.");
  }
  plan.confirmTestletTimeLeave = state.executionMode.forceTimeRestrictions && timer?.leave === "confirm";
  // A timed confirmation stops Source's leave-check chain before leave locks.
  plan.confirmTestletLeaveLock = !plan.confirmTestletTimeLeave && lock?.confirm === true;
  if (lock && !plan.confirmTestletTimeLeave && !state.executionMode.forceNaviRestrictions) {
    const notice = `${lock.scope} würde im Testmodus nun gesperrt werden.`;
    (lock.confirm ? plan.confirmedNotices : plan.afterTimerNotices).push(notice);
  }
  const restriction = plan.confirmTestletTimeLeave ? {
    title: customText("booklet_warningLeaveTimerBlockTitle", "Leave timed block?"),
    message: customText("booklet_warningLeaveTimerBlockTextPrompt", `Leave the timed block "${timer?.displayLabel}" and close it permanently?`),
    cancelLabel: "Stay here", confirmLabel: "Leave anyway"
  } : plan.confirmTestletLeaveLock ? {
    title: customText(lock?.scope === "unit" ? "booklet_warningLeaveTitle-unit" : "booklet_warningLeaveTitle-testlet", lock?.scope === "unit" ? "Leave task?" : "Leave section?"),
    message: customText(lock?.scope === "unit" ? "booklet_warningLeaveTextPrompt-unit" : "booklet_warningLeaveTextPrompt-testlet", `${lock?.detail} Continue?`),
    cancelLabel: "Stay here", confirmLabel: "Leave anyway"
  } : null;
  const confirmation = restriction ? { ...restriction, title: state.executionMode.saveResponses ? "Return to test selection?" : restriction.title }
    : state.executionMode.saveResponses ? { title: "Return to test selection?", message: "Your saved progress will remain available.", cancelLabel: "Continue working", confirmLabel: "Return to tests" } : null;
  if (confirmation) {
    plan.confirmation = { ...confirmation, original: {
      title: state.executionMode.saveResponses ? "Sicher, dass du den Test beenden möchtest?"
        : plan.confirmTestletTimeLeave ? customText("booklet_warningLeaveTimerBlockTitle")
          : customText(lock?.scope === "unit" ? "booklet_warningLeaveTitle-unit" : "booklet_warningLeaveTitle-testlet"),
      message: plan.confirmTestletTimeLeave ? customText("booklet_warningLeaveTimerBlockTextPrompt")
        : plan.confirmTestletLeaveLock ? customText(lock?.scope === "unit" ? "booklet_warningLeaveTextPrompt-unit" : "booklet_warningLeaveTextPrompt-testlet") : "",
      cancelLabel: restriction ? "Trotzdem weiter" : "Abbrechen", confirmLabel: restriction ? "Hier bleiben" : "Bestätigen", confirmMeansContinue: !restriction
    } };
  }
  return plan;
}
