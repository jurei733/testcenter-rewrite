import "zone.js";

import { bootstrapApplication } from "@angular/platform-browser";

import { appConfig } from "./app/app.config";
import { AppComponent } from "./app/app.component";

const registerAppShellServiceWorker = async (): Promise<void> => {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  const serviceWorkerUrl = new URL("service-worker.js", document.baseURI);
  const serviceWorkerScope = new URL("./", document.baseURI).pathname;

  try {
    await navigator.serviceWorker.register(serviceWorkerUrl, {
      scope: serviceWorkerScope,
      updateViaCache: "none"
    });
  } catch (error) {
    console.warn("The offline application shell could not be installed.", error);
  }
};

bootstrapApplication(AppComponent, appConfig)
  .then(() => registerAppShellServiceWorker())
  .catch(error => {
    console.error(error);
  });
