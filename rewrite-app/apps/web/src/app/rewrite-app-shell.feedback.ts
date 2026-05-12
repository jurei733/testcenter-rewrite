import {
  prependActivityFeedItem,
  updateSummaryCards
} from "./rewrite-app-shell.presentation";
import type { ShellFeedbackState } from "./rewrite-app-shell.state";
import type { ActivityFeedItem, SummaryCard } from "./rewrite-app-shell.types";

export interface ShellFeedbackHost {
  getSummaryCards(): SummaryCard[];
  setSummaryCards(nextValue: SummaryCard[]): void;
  getActivityFeed(): ActivityFeedItem[];
  setActivityFeed(nextValue: ActivityFeedItem[]): void;
}

export function updateShellSummaryCard(
  host: ShellFeedbackHost,
  label: SummaryCard["label"],
  headline: string,
  detail: string
): void {
  host.setSummaryCards(
    updateSummaryCards(host.getSummaryCards(), label, headline, detail)
  );
}

export function rememberShellActivity(
  host: ShellFeedbackHost,
  title: string,
  detail: string
): void {
  host.setActivityFeed(
    prependActivityFeedItem(host.getActivityFeed(), title, detail)
  );
}

export function updateShellSummaryCardInState(
  state: ShellFeedbackState,
  label: SummaryCard["label"],
  headline: string,
  detail: string
): void {
  state.summaryCards = updateSummaryCards(state.summaryCards, label, headline, detail);
}

export function rememberShellActivityInState(
  state: ShellFeedbackState,
  title: string,
  detail: string
): void {
  state.activityFeed = prependActivityFeedItem(state.activityFeed, title, detail);
}
