import {
  ErrorHandler,
  provideBrowserGlobalErrorListeners,
  type ApplicationConfig
} from "@angular/core";
import { provideRouter } from "@angular/router";

import { appRoutes } from "./app.routes";
import { GlobalErrorHandler } from "./global-error-handler";

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    { provide: ErrorHandler, useClass: GlobalErrorHandler }
  ]
};
