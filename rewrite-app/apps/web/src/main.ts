import { bootstrapApplication } from "@angular/platform-browser";

import { appConfig } from "./app/app.config";
import { BootstrapRootComponent } from "./app/bootstrap-root.component";

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

const normalizeOriginalWorkspaceEntry = (): void => {
  const url = new URL(window.location.href);
  const originalBookmark = /^#(\/admin\/[a-z0-9_-]+(?:\/[a-z0-9_-]+)*\/?)$/i.exec(url.hash);
  if (originalBookmark && /^\/(?:app\/?)?$/.test(url.pathname)) {
    url.pathname = "/app" + originalBookmark[1];
    url.hash = "";
  }
  if (url.pathname.startsWith("/app/admin/") && url.searchParams.get("ui") !== "original") {
    url.searchParams.set("ui", "original");
  }
  if (url.href !== window.location.href) {
    window.history.replaceState(window.history.state, "", url);
  }
};

normalizeOriginalWorkspaceEntry();
bootstrapApplication(BootstrapRootComponent, appConfig)
  .then(() => registerAppShellServiceWorker())
  .catch(error => {
    console.error(error);
  });
