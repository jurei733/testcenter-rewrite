import type { BookletLeaveRestriction, BookletNavigationDeniedReason, BookletRuntimePolicy } from "@testcenter-rewrite-app/domain";

export const bookletNavigationDeniedReasons = (input: {
  policy: BookletRuntimePolicy;
  direction: "forward" | "backward";
  presentationProgress?: string | null;
  responseProgress?: string | null;
}): BookletNavigationDeniedReason[] => {
  const applies = (restriction: BookletLeaveRestriction): boolean =>
    restriction === "always" || (restriction === "forward" && input.direction === "forward");
  const complete = (progress: string | null | undefined): boolean =>
    ["complete", "complete-and-valid"].includes(progress?.toLowerCase() ?? "");
  const reasons: BookletNavigationDeniedReason[] = [];
  if (applies(input.policy.navigation.requirePresentationComplete) && !complete(input.presentationProgress)) {
    reasons.push("presentation_incomplete");
  }
  if (applies(input.policy.navigation.requireResponseComplete) && input.responseProgress && !complete(input.responseProgress)) {
    reasons.push("response_incomplete");
  }
  return reasons;
};

// Source's exit check keeps the Verona 2 response-complete value, but requires
// exactly "complete" for presentation. Missing response progress is not a denial.
export const bookletStarterExitDeniedReasons = (
  input: Omit<Parameters<typeof bookletNavigationDeniedReasons>[0], "direction">
): BookletNavigationDeniedReason[] => bookletNavigationDeniedReasons({
  ...input,
  direction: "forward",
  presentationProgress: input.presentationProgress === "complete" ? "complete" : undefined,
  responseProgress: ["none", "some"].includes(input.responseProgress ?? "") ? input.responseProgress : undefined
});
