import type { TestRun } from "@testcenter-rewrite-app/domain";

// Lazy foreground exit preparation; keep this route out of the initial login
// catalog. The API derives the eligible timer action from the current Run.
export const participantStarterExitPreparationRoute =
  "/api/v1/participant/test-runs/:testRunId/prepare-starter-exit";

export type PrepareParticipantStarterExitRequest = {
  currentUnitKey: string;
  responseUnitKey?: string | null;
  unitResponse?: string | null;
  transientUnitResponses?: Record<string, string>;
};

export type PrepareParticipantStarterExitResponse = {
  testRun: TestRun;
  timerEffect: "cancelled" | "interrupted" | null;
};
