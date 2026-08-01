import { inject } from "@angular/core";
import { Router, type CanActivateFn } from "@angular/router";

import { RewriteAppOperatorAccessService } from "./rewrite-app-operator-access.service";

export const requireAdministrativeOperator: CanActivateFn = () => {
  const operatorAccess = inject(RewriteAppOperatorAccessService);
  if (operatorAccess.isSystemCheckOnly) {
    return inject(Router).createUrlTree(["/system-check"]);
  }
  if (!operatorAccess.isMonitorOnly) {
    return true;
  }
  return inject(Router).createUrlTree(["/runtime"]);
};

export const rejectSystemCheckOperator: CanActivateFn = () => {
  const operatorAccess = inject(RewriteAppOperatorAccessService);
  return operatorAccess.isSystemCheckOnly
    ? inject(Router).createUrlTree(["/system-check"])
    : true;
};
