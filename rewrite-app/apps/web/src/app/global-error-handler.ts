import { ErrorHandler, Injectable, inject } from "@angular/core";

import { BugReportService } from "./bug-report.service";

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly bugReports = inject(BugReportService);

  handleError(error: unknown): void {
    console.error(error);
    this.bugReports.capture(error);
  }
}
