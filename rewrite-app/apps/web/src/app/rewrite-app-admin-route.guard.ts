import { inject } from "@angular/core";
import { Router, type CanActivateFn } from "@angular/router";

import { RewriteAppOperatorAccessService } from "./rewrite-app-operator-access.service";

export const requireAdministrativeOperator: CanActivateFn = () => {
  const operatorAccess = inject(RewriteAppOperatorAccessService);
  if (!operatorAccess.isMonitorOnly) {
    return true;
  }
  return inject(Router).createUrlTree(["/runtime"]);
};
