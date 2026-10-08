import type { ActivationGuardHost } from "./rewrite-app-shell.activation";
import type { ShellFeedbackHost } from "./rewrite-app-shell.feedback";
import type {
  ShellContentState,
  ShellRuntimeState
} from "./rewrite-app-shell.state";
import type { ActivityFeedItem, SummaryCard } from "./rewrite-app-shell.types";

export function createActivationGuardHost(args: {
  getActivationGuardView(): string;
  setActivationGuardView(nextValue: string): void;
  getRuntimeMonitorView(): string;
  setRuntimeMonitorView(nextValue: string): void;
  updateMonitorSummary(headline: string, detail: string): void;
  rememberActivity(title: string, detail: string): void;
}): ActivationGuardHost {
  return {
    getActivationGuardView: args.getActivationGuardView,
    setActivationGuardView: args.setActivationGuardView,
    getRuntimeMonitorView: args.getRuntimeMonitorView,
    setRuntimeMonitorView: args.setRuntimeMonitorView,
    updateMonitorSummary: args.updateMonitorSummary,
    rememberActivity: args.rememberActivity
  };
}

export function createActivationGuardStateHost(args: {
  contentState: ShellContentState;
  runtimeState: ShellRuntimeState;
  updateMonitorSummary(headline: string, detail: string): void;
  rememberActivity(title: string, detail: string): void;
}): ActivationGuardHost {
  return {
    getActivationGuardView: () => args.contentState.activationGuardView,
    setActivationGuardView: nextValue => {
      args.contentState.activationGuardView = nextValue;
    },
    getRuntimeMonitorView: () => args.runtimeState.runtimeMonitorView,
    setRuntimeMonitorView: nextValue => {
      args.runtimeState.runtimeMonitorView = nextValue;
    },
    updateMonitorSummary: args.updateMonitorSummary,
    rememberActivity: args.rememberActivity
  };
}

export function createShellFeedbackHost(args: {
  getSummaryCards(): SummaryCard[];
  setSummaryCards(nextValue: SummaryCard[]): void;
  getActivityFeed(): ActivityFeedItem[];
  setActivityFeed(nextValue: ActivityFeedItem[]): void;
}): ShellFeedbackHost {
  return {
    getSummaryCards: args.getSummaryCards,
    setSummaryCards: args.setSummaryCards,
    getActivityFeed: args.getActivityFeed,
    setActivityFeed: args.setActivityFeed
  };
}
