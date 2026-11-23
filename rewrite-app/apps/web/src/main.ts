import { bootstrapApplication } from "@angular/platform-browser";

import { appConfig } from "./app/app.config";
import { BootstrapRootComponent } from "./app/bootstrap-root.component";
import { originalMissingRouteBookmark, originalParticipantBookmark } from "./app/native-participant/original-participant-bookmark";

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

const normalizeOriginalEntry = (): void => {
  const url = new URL(window.location.href);
  if (/^\/(?:app\/?)?$/.test(url.pathname)) {
    const destination = originalParticipantBookmark(url.hash) ?? originalMissingRouteBookmark(url.hash);
    if (destination) {
      const bookmark = new URL("/app" + destination, url.origin);
      url.pathname = bookmark.pathname;
      // The legacy sign-in cannot opt into the modern operator demo or return hooks.
      if (bookmark.pathname === "/app/ops") url.search = "";
      bookmark.searchParams.forEach((value, key) => url.searchParams.set(key, value));
      url.hash = "";
    }
  }
  if ((url.pathname.startsWith("/app/admin/") || /^\/app\/superadmin(?:\/|$)/.test(url.pathname)) &&
      url.searchParams.get("ui") !== "original") {
    url.searchParams.set("ui", "original");
  }
  if (url.href !== window.location.href) {
    window.history.replaceState(window.history.state, "", url);
  }
};

normalizeOriginalEntry();
bootstrapApplication(BootstrapRootComponent, appConfig)
  .then(() => registerAppShellServiceWorker())
  .catch(error => {
    console.error(error);
  });
