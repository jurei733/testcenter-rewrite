import type { ActivityFeedItem, SummaryCard } from "./rewrite-app-shell.types";

export const updateSummaryCards = (
  cards: SummaryCard[],
  label: SummaryCard["label"],
  headline: string,
  detail: string
): SummaryCard[] =>
  cards.map(card => (card.label === label ? { ...card, headline, detail } : card));

export const prependActivityFeedItem = (
  items: ActivityFeedItem[],
  title: string,
  detail: string,
  maxItems = 8
): ActivityFeedItem[] => [{ title, detail }, ...items].slice(0, maxItems);
