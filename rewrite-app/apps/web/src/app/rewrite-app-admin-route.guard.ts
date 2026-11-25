import { Injector, inject, runInInjectionContext } from "@angular/core";
import { RedirectCommand, Router, type CanActivateFn, type UrlTree } from "@angular/router";
import { resolveOperatorAccessMode } from "@testcenter-rewrite-app/contracts";
import { firstValueFrom, isObservable } from "rxjs";

import { RewriteAppOperatorAccessService } from "./rewrite-app-operator-access.service";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";
import { legacyBookmarkQueryKey, OriginalStarterSessionRejection, originalStarterRole } from "./native-participant/original-participant-bookmark";

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

export const requireOriginalWorkspaceSession: CanActivateFn = (_route, state) =>
  !!inject(RewriteAppUiStateService).ops.adminSessionToken ||
  inject(Router).createUrlTree(["/ops"], {
    queryParams: { ui: "original", returnUrl: state.url }
  });

export const requireOriginalNumericWorkspaceActor: CanActivateFn = (route, state) => {
  if (route.queryParamMap.get(legacyBookmarkQueryKey) === "1" &&
      !inject(RewriteAppUiStateService).ops.adminSessionToken.trim()) {
    return inject(Router).parseUrl("/native-start/dispatch");
  }
  return requireAdministrativeOperator(route, state);
};

export const resolveLegacyStarterBookmark: CanActivateFn = async () => {
  const router = inject(Router);
  const injector = inject(Injector);
  const login = router.parseUrl("/native-start/login");
  const preferredRole = originalStarterRole();
  let rejection: OriginalStarterSessionRejection | undefined;
  const rejectedOrLogin = () => rejection
    ? new RedirectCommand(router.parseUrl("/native-start/rejected-starter"), {info: rejection})
    : login;
  try {
    if (preferredRole !== "admin") {
      const [{NativeMonitorSessionService}, {afterNativeSessionRestore}] = await Promise.all([
        import("./native-monitor/native-session.service"),
        import("./native-monitor/native-session-route.guard")
      ]);
      const native = injector.get(NativeMonitorSessionService);
      const restored = runInInjectionContext(injector, () =>
        afterNativeSessionRestore(native, () => !!native.access())
      );
      if (isObservable(restored) ? await firstValueFrom(restored) : restored) {
        return router.parseUrl("/native-start/starter");
      }
      rejection = native.takeRestoreRejection();
      if (preferredRole === "native") return rejectedOrLogin();
    }

    const { AppShellFacade } = await import("./app-shell.facade");
    injector.get(AppShellFacade).init();
    if (!injector.get(RewriteAppUiStateService).ops.adminSessionToken.trim()) return rejectedOrLogin();

    const { RewriteAppOpsService } = await import("./rewrite-app-ops.service");
    rejection = undefined;
    const session = await injector.get(RewriteAppOpsService).refreshAdminSession({
      publishOriginalRights: true,
      onAdminSessionRejected: error => {
        rejection = new OriginalStarterSessionRejection(error.response?.errorId ?? null);
      }
    });
    if (!session) return login;
    const mode = resolveOperatorAccessMode(session.roleAssignments);
    return mode === "admin" || mode === "admin_read_only"
      ? router.createUrlTree(["/operator-start"], {queryParams: {ui: "original"}})
      : login;
  } catch {
    return rejectedOrLogin();
  }
};

export const requireOriginalStarterRejection: CanActivateFn = () => {
  const router = inject(Router);
  return router.currentNavigation()?.extras.info instanceof OriginalStarterSessionRejection
    || router.parseUrl("/native-start/login");
};

export const resolveLegacySuperadminBookmark: CanActivateFn = async route => {
  const router = inject(Router);
  const injector = inject(Injector);
  const dispatch = router.parseUrl("/native-start/dispatch");
  if (!inject(RewriteAppUiStateService).ops.adminSessionToken.trim()) return dispatch;
  try {
    const { RewriteAppOpsService } = await import("./rewrite-app-ops.service");
    const session = await injector.get(RewriteAppOpsService).refreshAdminSession({publishOriginalRights: true});
    if (!session) return dispatch;
    if (!session.roleAssignments.some(assignment => assignment.role === "platform_admin")) {
      return router.createUrlTree(["/operator-start"], {queryParams: {ui: "original"}});
    }
    const requested = route.paramMap.get("section");
    const adminSection = requested === "workspaces" || requested === "settings" || requested === "users"
      ? requested
      : requested || route.data["fallbackSection"] ? "default" : "users";
    return router.createUrlTree(["/ops"], {queryParams: {ui: "original", adminSection}});
  } catch {
    return dispatch;
  }
};
