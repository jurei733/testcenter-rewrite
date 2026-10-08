import { inject } from "@angular/core";
import { Router, type CanDeactivateFn } from "@angular/router";

type BrowserNavigationGuardedParticipant = {
  preventBrowserNavigation: boolean;
  notifyBrowserNavigationPrevented(): void;
};

export const preventParticipantBrowserNavigation: CanDeactivateFn<
  BrowserNavigationGuardedParticipant
> = participant => {
  const router = inject(Router);
  if (
    router.currentNavigation()?.trigger !== "popstate" ||
    !participant.preventBrowserNavigation
  ) {
    return true;
  }
  participant.notifyBrowserNavigationPrevented();
  return false;
};
