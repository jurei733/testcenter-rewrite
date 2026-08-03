const CACHE_PREFIX = "testcenter-rewrite-app-shell-";
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const APP_SHELL_URL = new URL("./", self.registration.scope).href;

const isCacheableResponse = response =>
  response && response.ok && response.type !== "opaque";

const discoverShellAssets = html => {
  const assetUrls = new Set([APP_SHELL_URL]);
  const attributePattern = /(?:src|href)=["']([^"'#]+)["']/g;

  for (const match of html.matchAll(attributePattern)) {
    const assetUrl = new URL(match[1], APP_SHELL_URL);
    if (
      assetUrl.origin === self.location.origin &&
      assetUrl.pathname.startsWith(new URL(APP_SHELL_URL).pathname)
    ) {
      assetUrls.add(assetUrl.href);
    }
  }

  return [...assetUrls];
};

const cacheShellFromNetwork = async () => {
  const shellResponse = await fetch(APP_SHELL_URL, { cache: "reload" });
  if (!isCacheableResponse(shellResponse)) {
    throw new Error(`Application shell returned ${shellResponse.status}.`);
  }

  const shellHtml = await shellResponse.clone().text();
  const cache = await caches.open(CACHE_NAME);
  await cache.put(APP_SHELL_URL, shellResponse);

  await Promise.all(
    discoverShellAssets(shellHtml)
      .filter(assetUrl => assetUrl !== APP_SHELL_URL)
      .map(async assetUrl => {
        const assetResponse = await fetch(assetUrl, { cache: "reload" });
        if (isCacheableResponse(assetResponse)) {
          await cache.put(assetUrl, assetResponse);
        }
      })
  );
};

self.addEventListener("install", event => {
  event.waitUntil(cacheShellFromNetwork());
});

self.addEventListener("activate", event => {
  event.waitUntil(
    Promise.all(
      [
        caches.keys().then(cacheNames =>
          Promise.all(
            cacheNames
              .filter(
                cacheName =>
                  cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME
              )
              .map(cacheName => caches.delete(cacheName))
          )
        ),
        self.clients.claim()
      ]
    )
  );
});

const serveNavigation = async request => {
  try {
    const response = await fetch(request);
    if (isCacheableResponse(response)) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(APP_SHELL_URL, response.clone());
    }
    return response;
  } catch {
    const cachedShell = await caches.match(APP_SHELL_URL);
    return cachedShell ?? Response.error();
  }
};

const serveStaticAsset = async request => {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  const response = await fetch(request);
  if (isCacheableResponse(response)) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
};

self.addEventListener("fetch", event => {
  const request = event.request;
  const requestUrl = new URL(request.url);
  const appPath = new URL(APP_SHELL_URL).pathname;

  if (
    request.method !== "GET" ||
    requestUrl.origin !== self.location.origin ||
    !requestUrl.pathname.startsWith(appPath) ||
    requestUrl.pathname.endsWith("/service-worker.js")
  ) {
    return;
  }

  event.respondWith(
    request.mode === "navigate"
      ? serveNavigation(request)
      : serveStaticAsset(request)
  );
});
