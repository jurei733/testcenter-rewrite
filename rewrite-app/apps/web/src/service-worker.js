const CACHE_PREFIX = "testcenter-rewrite-app-shell-";
const CACHE_NAME = `${CACHE_PREFIX}v2`;
const APP_SHELL_URL = new URL("./", self.registration.scope).href;
const PARTICIPANT_SAVE_DATABASE = "testcenter-participant-save-outbox-v1";
const PARTICIPANT_SAVE_STORE = "pending-saves";
const PARTICIPANT_SAVE_SYNC_TAG = "testcenter-participant-save-v1";
const PARTICIPANT_SAVE_UPSERT_MESSAGE =
  "testcenter-participant-save-outbox-upsert-v1";
const PARTICIPANT_SAVE_DELETE_MESSAGE =
  "testcenter-participant-save-outbox-delete-v1";
const PARTICIPANT_SAVE_CLEAR_RUN_MESSAGE =
  "testcenter-participant-save-outbox-clear-run-v1";

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

const openParticipantSaveDatabase = () =>
  new Promise((resolvePromise, reject) => {
    const request = indexedDB.open(PARTICIPANT_SAVE_DATABASE, 1);
    request.addEventListener("upgradeneeded", () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PARTICIPANT_SAVE_STORE)) {
        database.createObjectStore(PARTICIPANT_SAVE_STORE, { keyPath: "key" });
      }
    });
    request.addEventListener("success", () => resolvePromise(request.result));
    request.addEventListener("error", () =>
      reject(request.error ?? new Error("Participant save database failed to open."))
    );
  });

const runParticipantSaveTransaction = async (mode, operation) => {
  const database = await openParticipantSaveDatabase();
  try {
    await new Promise((resolvePromise, reject) => {
      const transaction = database.transaction(PARTICIPANT_SAVE_STORE, mode);
      operation(transaction.objectStore(PARTICIPANT_SAVE_STORE));
      transaction.addEventListener("complete", () => resolvePromise());
      transaction.addEventListener("abort", () =>
        reject(transaction.error ?? new Error("Participant save transaction aborted."))
      );
      transaction.addEventListener("error", () =>
        reject(transaction.error ?? new Error("Participant save transaction failed."))
      );
    });
  } finally {
    database.close();
  }
};

const readParticipantBackgroundSaves = async () => {
  const database = await openParticipantSaveDatabase();
  try {
    return await new Promise((resolvePromise, reject) => {
      const transaction = database.transaction(PARTICIPANT_SAVE_STORE, "readonly");
      const request = transaction.objectStore(PARTICIPANT_SAVE_STORE).getAll();
      request.addEventListener("success", () => resolvePromise(request.result));
      request.addEventListener("error", () =>
        reject(request.error ?? new Error("Participant saves could not be read."))
      );
    });
  } finally {
    database.close();
  }
};

const isParticipantSaveEntry = entry => {
  if (!entry || typeof entry !== "object") {
    return false;
  }
  try {
    if (JSON.stringify(entry).length > 4_500_000) {
      return false;
    }
  } catch {
    return false;
  }
  const boundedIdentifier = value =>
    typeof value === "string" && value.length > 0 && value.length <= 500;
  return (
    entry.version === 1 &&
    typeof entry.deliveryId === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(entry.deliveryId) &&
    boundedIdentifier(entry.testRunId) &&
    boundedIdentifier(entry.unitKey) &&
    typeof entry.response === "string" &&
    entry.response.length <= 4_000_000 &&
    (entry.status === "running" || entry.status === "paused") &&
    Array.isArray(entry.logs) &&
    entry.logs.length <= 20
  );
};

const participantSaveKey = entry => `${entry.testRunId}\n${entry.unitKey}`;

const upsertParticipantBackgroundSave = entry =>
  runParticipantSaveTransaction("readwrite", store => {
    store.put({ key: participantSaveKey(entry), entry });
  });

const deleteParticipantBackgroundSaveByKey = (key, deliveryId) =>
  runParticipantSaveTransaction("readwrite", store => {
    const request = store.get(key);
    request.addEventListener("success", () => {
      if (request.result?.entry?.deliveryId === deliveryId) {
        store.delete(key);
      }
    });
  });

const deleteParticipantBackgroundSave = (testRunId, deliveryId) =>
  runParticipantSaveTransaction("readwrite", store => {
    const request = store.openCursor();
    request.addEventListener("success", () => {
      const cursor = request.result;
      if (!cursor) {
        return;
      }
      if (
        cursor.value?.entry?.testRunId === testRunId &&
        cursor.value?.entry?.deliveryId === deliveryId
      ) {
        cursor.delete();
      }
      cursor.continue();
    });
  });

const clearParticipantBackgroundSavesForRun = testRunId =>
  runParticipantSaveTransaction("readwrite", store => {
    const request = store.openCursor();
    request.addEventListener("success", () => {
      const cursor = request.result;
      if (!cursor) {
        return;
      }
      if (cursor.value?.entry?.testRunId === testRunId) {
        cursor.delete();
      }
      cursor.continue();
    });
  });

const registerParticipantSaveSync = async () => {
  if ("sync" in self.registration) {
    await self.registration.sync.register(PARTICIPANT_SAVE_SYNC_TAG);
  }
};

const drainParticipantBackgroundSaves = async () => {
  const records = await readParticipantBackgroundSaves();
  let retryNeeded = false;

  for (const record of records) {
    const entry = record?.entry;
    if (!isParticipantSaveEntry(entry)) {
      await runParticipantSaveTransaction("readwrite", store => {
        store.delete(record.key);
      });
      continue;
    }

    let response;
    try {
      response = await fetch(
        new URL(
          `/api/v1/participant/test-runs/${encodeURIComponent(entry.testRunId)}/save-progress`,
          self.location.origin
        ),
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            deliveryId: entry.deliveryId,
            responseUnitKey: entry.unitKey,
            status: entry.status,
            unitResponse: entry.response,
            logs: entry.logs
          })
        }
      );
    } catch {
      retryNeeded = true;
      continue;
    }

    if (response.ok || (response.status >= 400 && response.status < 500)) {
      await deleteParticipantBackgroundSaveByKey(record.key, entry.deliveryId);
    } else {
      retryNeeded = true;
    }
  }

  if (retryNeeded) {
    throw new Error("Participant saves remain queued for a later retry.");
  }
};

self.addEventListener("message", event => {
  const message = event.data;
  if (!message || typeof message !== "object") {
    return;
  }

  if (
    message.type === PARTICIPANT_SAVE_UPSERT_MESSAGE &&
    isParticipantSaveEntry(message.entry)
  ) {
    event.waitUntil(
      upsertParticipantBackgroundSave(message.entry)
        .then(() => drainParticipantBackgroundSaves())
        .catch(() => registerParticipantSaveSync())
    );
    return;
  }

  if (
    message.type === PARTICIPANT_SAVE_DELETE_MESSAGE &&
    typeof message.testRunId === "string" &&
    message.testRunId.length > 0 &&
    message.testRunId.length <= 500 &&
    typeof message.deliveryId === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(message.deliveryId)
  ) {
    event.waitUntil(
      deleteParticipantBackgroundSave(message.testRunId, message.deliveryId)
    );
    return;
  }

  if (
    message.type === PARTICIPANT_SAVE_CLEAR_RUN_MESSAGE &&
    typeof message.testRunId === "string" &&
    message.testRunId.length > 0 &&
    message.testRunId.length <= 500
  ) {
    event.waitUntil(clearParticipantBackgroundSavesForRun(message.testRunId));
  }
});

self.addEventListener("sync", event => {
  if (event.tag === PARTICIPANT_SAVE_SYNC_TAG) {
    event.waitUntil(drainParticipantBackgroundSaves());
  }
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
