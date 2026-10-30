import { ErrorHandler, Injectable, inject } from "@angular/core";

import { BugReportService } from "./bug-report.service";
import {dispatchOwnedError} from './owned-error-routing';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly bugReports = inject(BugReportService);

  handleError(error: unknown): void {
    if(dispatchOwnedError(error))return;
    console.error(error);
    this.bugReports.capture(error);
  }
}
