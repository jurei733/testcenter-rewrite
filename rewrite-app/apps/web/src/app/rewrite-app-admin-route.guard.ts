import { Injector, inject } from "@angular/core";
import { Router, type CanActivateFn, type UrlTree } from "@angular/router";

import { RewriteAppOperatorAccessService } from "./rewrite-app-operator-access.service";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";

const redirectSignedOutOperator = async (
  requestedUrl: string
): Promise<UrlTree | null> => {
  const operatorAccess = inject(RewriteAppOperatorAccessService);
  const router = inject(Router);
  if (operatorAccess.mode !== "signed_out") {
    return null;
  }

  const uiState = inject(RewriteAppUiStateService);
  if (uiState.ops.operatorAuthMode === "unknown") {
    const injector = inject(Injector);
    try {
      const { RewriteAppOpsService } = await import("./rewrite-app-ops.service");
      await injector.get(RewriteAppOpsService).refreshOperationalDiagnostics(true);
    } catch {
      // Without a verified open-auth configuration, keep protected UI private.
    }
  }

  return uiState.ops.operatorAuthMode === "open"
    ? null
    : router.createUrlTree(["/ops"], {
        queryParams: { returnUrl: requestedUrl }
      });
};

export const requireAdministrativeOperator: CanActivateFn = async (
  _route,
  state
) => {
  const operatorAccess = inject(RewriteAppOperatorAccessService);
  const router = inject(Router);
  const signInRedirect = await redirectSignedOutOperator(state.url);
  if (signInRedirect) {
    return signInRedirect;
  }
  if (operatorAccess.isSystemCheckOnly) {
    return router.createUrlTree(["/system-check"]);
  }
  if (!operatorAccess.isMonitorOnly) {
    return true;
  }
  return router.createUrlTree(["/runtime"]);
};

export const requireAuthenticatedOperator: CanActivateFn = async (
  _route,
  state
) => {
  const operatorAccess = inject(RewriteAppOperatorAccessService);
  const router = inject(Router);
  const signInRedirect = await redirectSignedOutOperator(state.url);
  if (signInRedirect) {
    return signInRedirect;
  }
  return operatorAccess.isSystemCheckOnly
    ? router.createUrlTree(["/system-check"])
    : true;
};

export const rejectSystemCheckOperator: CanActivateFn = () => {
  const operatorAccess = inject(RewriteAppOperatorAccessService);
  return operatorAccess.isSystemCheckOnly
    ? inject(Router).createUrlTree(["/system-check"])
    : true;
};
