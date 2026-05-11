import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { AddressInfo } from "node:net";

import { createProductionApiServer } from "./index.js";

let server: Awaited<ReturnType<typeof createProductionApiServer>>;

let baseUrl = "";

type JsonResponse<T> = {
  status: number;
  body: T;
};

const requestJson = async <T>(
  path: string,
  init?: {
    method?: string;
    body?: unknown;
  }
): Promise<JsonResponse<T>> => {
  const response = await fetch(baseUrl + path, {
    method: init?.method ?? "GET",
    headers: {
      "content-type": "application/json"
    },
    body:
      init?.body === undefined ? undefined : JSON.stringify(init.body)
  });
  return {
    status: response.status,
    body: (await response.json()) as T
  };
};

const requestText = async (
  path: string,
  init?: {
    method?: string;
  }
): Promise<{ status: number; body: string; contentType: string | null }> => {
  const response = await fetch(baseUrl + path, {
    method: init?.method ?? "GET"
  });
  return {
    status: response.status,
    body: await response.text(),
    contentType: response.headers.get("content-type")
  };
};

before(async () => {
  server = await createProductionApiServer();
  await new Promise<void>(resolve => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close(error => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
});

test("failed import can be retried on the same source package", async () => {
  const tenantKey = "integration-tenant-retry";
  const workspaceKey = "integration-workspace-retry";

  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey, displayName: tenantKey }
  });
  await requestJson(`/api/v1/tenants/${tenantKey}/workspaces`, {
    method: "POST",
    body: { workspaceKey, displayName: workspaceKey }
  });

  const sourcePackage = await requestJson<{
    sourcePackage: { sourcePackageId: string; status: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`, {
    method: "POST",
    body: {
      fileName: "broken.json",
      mediaType: "application/json",
      sourceDocument: "{\"booklets\":[]}"
    }
  });

  const failedImport = await requestJson<{
    importJob: { status: string; diagnostics: Array<{ code: string }> };
    stagedContentRelease: null;
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`, {
    method: "POST",
    body: {
      sourcePackageId: sourcePackage.body.sourcePackage.sourcePackageId
    }
  });

  assert.equal(failedImport.status, 201);
  assert.equal(failedImport.body.importJob.status, "failed");
  assert.equal(
    failedImport.body.importJob.diagnostics[0]?.code,
    "source_document_runtime_structure_invalid"
  );
  assert.equal(failedImport.body.stagedContentRelease, null);

  const retriedImport = await requestJson<{
    sourcePackage: { sourcePackageId: string; status: string };
    importJob: { status: string };
    stagedContentRelease: { contentReleaseId: string } | null;
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages/${sourcePackage.body.sourcePackage.sourcePackageId}/retry-import`,
    {
      method: "POST",
      body: {
        fileName: "fixed.xml",
        mediaType: "application/xml",
        sourceDocument:
          "<assessment><booklet key=\"booklet:fixed\" label=\"Fixed\"><unit key=\"unit-fixed\" label=\"Fixed Unit\" /></booklet></assessment>"
      }
    }
  );

  assert.equal(retriedImport.status, 200);
  assert.equal(retriedImport.body.sourcePackage.status, "accepted");
  assert.equal(retriedImport.body.importJob.status, "completed");
  assert.ok(retriedImport.body.stagedContentRelease?.contentReleaseId);
});

test("activation guard returns blocking open-run details", async () => {
  const tenantKey = "integration-tenant-activation";
  const workspaceKey = "integration-workspace-activation";

  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey, displayName: tenantKey }
  });
  await requestJson(`/api/v1/tenants/${tenantKey}/workspaces`, {
    method: "POST",
    body: { workspaceKey, displayName: workspaceKey }
  });

  const firstPackage = await requestJson<{
    sourcePackage: { sourcePackageId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`, {
    method: "POST",
    body: {
      fileName: "alpha.xml",
      mediaType: "application/xml",
      sourceDocument:
        "<assessment><booklet key=\"booklet:alpha\" label=\"Alpha\"><unit key=\"unit-alpha\" label=\"Alpha Unit\" /></booklet></assessment>"
    }
  });
  const firstImport = await requestJson<{
    stagedContentRelease: { contentReleaseId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`, {
    method: "POST",
    body: {
      sourcePackageId: firstPackage.body.sourcePackage.sourcePackageId
    }
  });

  const firstReleaseId = firstImport.body.stagedContentRelease.contentReleaseId;
  await requestJson(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${firstReleaseId}/activate`,
    {
      method: "POST",
      body: { activatedByActorId: "integration-test" }
    }
  );

  const signIn = await requestJson<{
    participantSession: { participantSessionId: string };
  }>("/api/v1/participant/auth/sign-in", {
    method: "POST",
    body: {
      workspaceKey,
      loginKey: "activation-student"
    }
  });

  await requestJson(
    `/api/v1/participant/sessions/${signIn.body.participantSession.participantSessionId}/resume`,
    { method: "POST" }
  );

  const secondPackage = await requestJson<{
    sourcePackage: { sourcePackageId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`, {
    method: "POST",
    body: {
      fileName: "beta.xml",
      mediaType: "application/xml",
      sourceDocument:
        "<assessment><booklet key=\"booklet:beta\" label=\"Beta\"><unit key=\"unit-beta\" label=\"Beta Unit\" /></booklet></assessment>"
    }
  });
  const secondImport = await requestJson<{
    stagedContentRelease: { contentReleaseId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`, {
    method: "POST",
    body: {
      sourcePackageId: secondPackage.body.sourcePackage.sourcePackageId
    }
  });

  const readiness = await requestJson<{
    activationReadiness: {
      canActivate: boolean;
      activeContentReleaseId: string | null;
      blockingOpenRuns: Array<{ status: string }>;
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${secondImport.body.stagedContentRelease.contentReleaseId}/activation-readiness`
  );

  assert.equal(readiness.status, 200);
  assert.equal(readiness.body.activationReadiness.canActivate, false);
  assert.equal(
    readiness.body.activationReadiness.activeContentReleaseId,
    firstReleaseId
  );
  assert.equal(readiness.body.activationReadiness.blockingOpenRuns.length, 1);
  assert.equal(
    readiness.body.activationReadiness.blockingOpenRuns[0]?.status,
    "running"
  );

  const blockedActivation = await requestJson<{
    error: string;
    message: string;
    details: {
      activeContentReleaseId: string;
      openRuns: Array<{ status: string; loginKey: string }>;
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${secondImport.body.stagedContentRelease.contentReleaseId}/activate`,
    {
      method: "POST",
      body: { activatedByActorId: "integration-test" }
    }
  );

  assert.equal(blockedActivation.status, 409);
  assert.equal(blockedActivation.body.error, "active_content_release_has_open_runs");
  assert.equal(
    blockedActivation.body.details.activeContentReleaseId,
    firstReleaseId
  );
  assert.equal(blockedActivation.body.details.openRuns.length, 1);
  assert.equal(blockedActivation.body.details.openRuns[0]?.status, "running");
  assert.equal(
    blockedActivation.body.details.openRuns[0]?.loginKey,
    "activation-student"
  );

  const activityEvents = await requestJson<{
    items: Array<{
      activityEvent: { eventType: string; details: { activeContentReleaseId?: string } };
    }>;
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/activity-events`
  );

  assert.equal(activityEvents.status, 200);
  assert.equal(
    activityEvents.body.items.some(
      item =>
        item.activityEvent.eventType === "content_release_activation_blocked" &&
        item.activityEvent.details.activeContentReleaseId === firstReleaseId
    ),
    true
  );
});

test("workspace participant-session list shows latest run and active release", async () => {
  const tenantKey = "integration-tenant-sessions";
  const workspaceKey = "integration-workspace-sessions";

  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey, displayName: tenantKey }
  });
  await requestJson(`/api/v1/tenants/${tenantKey}/workspaces`, {
    method: "POST",
    body: { workspaceKey, displayName: workspaceKey }
  });

  const sourcePackage = await requestJson<{
    sourcePackage: { sourcePackageId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`, {
    method: "POST",
    body: {
      fileName: "session.xml",
      mediaType: "application/xml",
      sourceDocument:
        "<assessment><booklet key=\"booklet:session\" label=\"Session\"><unit key=\"unit-session\" label=\"Session Unit\" /></booklet></assessment>"
    }
  });
  const importResult = await requestJson<{
    stagedContentRelease: { contentReleaseId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`, {
    method: "POST",
    body: {
      sourcePackageId: sourcePackage.body.sourcePackage.sourcePackageId
    }
  });

  const contentReleaseId = importResult.body.stagedContentRelease.contentReleaseId;
  await requestJson(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${contentReleaseId}/activate`,
    {
      method: "POST",
      body: { activatedByActorId: "integration-test" }
    }
  );

  const signIn = await requestJson<{
    participantSession: { participantSessionId: string; loginKey: string };
  }>("/api/v1/participant/auth/sign-in", {
    method: "POST",
    body: {
      workspaceKey,
      loginKey: "session-student"
    }
  });
  const resumedRun = await requestJson<{
    testRun: { testRunId: string; status: string };
  }>(
    `/api/v1/participant/sessions/${signIn.body.participantSession.participantSessionId}/resume`,
    { method: "POST" }
  );

  const participantSessions = await requestJson<{
    items: Array<{
      participantSession: { loginKey: string; participantSessionId: string };
      latestTestRun: { testRunId: string; status: string } | null;
      contentRelease: { contentReleaseId: string; status: string } | null;
    }>;
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-sessions`
  );

  assert.equal(participantSessions.status, 200);
  assert.equal(participantSessions.body.items.length, 1);
  assert.equal(
    participantSessions.body.items[0]?.participantSession.loginKey,
    "session-student"
  );
  assert.equal(
    participantSessions.body.items[0]?.latestTestRun?.testRunId,
    resumedRun.body.testRun.testRunId
  );
  assert.equal(
    participantSessions.body.items[0]?.latestTestRun?.status,
    "running"
  );
  assert.equal(
    participantSessions.body.items[0]?.contentRelease?.contentReleaseId,
    contentReleaseId
  );
  assert.equal(participantSessions.body.items[0]?.contentRelease?.status, "active");

  const participantSessionDetail = await requestJson<{
    participantSessionDetail: {
      participantSession: { participantSessionId: string; loginKey: string };
      contentRelease: { contentReleaseId: string; status: string } | null;
      testRuns: Array<{ testRunId: string; status: string }>;
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-sessions/${signIn.body.participantSession.participantSessionId}`
  );

  assert.equal(participantSessionDetail.status, 200);
  assert.equal(
    participantSessionDetail.body.participantSessionDetail.participantSession.loginKey,
    "session-student"
  );
  assert.equal(
    participantSessionDetail.body.participantSessionDetail.contentRelease?.contentReleaseId,
    contentReleaseId
  );
  assert.equal(
    participantSessionDetail.body.participantSessionDetail.testRuns[0]?.testRunId,
    resumedRun.body.testRun.testRunId
  );

  const activityEvents = await requestJson<{
    items: Array<{
      activityEvent: { eventType: string; subjectId: string };
    }>;
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/activity-events`
  );

  assert.equal(activityEvents.status, 200);
  assert.equal(
    activityEvents.body.items.some(
      item =>
        item.activityEvent.eventType === "participant_signed_in" &&
        item.activityEvent.subjectId ===
          signIn.body.participantSession.participantSessionId
    ),
    true
  );
  assert.equal(
    activityEvents.body.items.some(
      item =>
        item.activityEvent.eventType === "participant_session_resumed" &&
        item.activityEvent.subjectId === resumedRun.body.testRun.testRunId
    ),
    true
  );
});

test("metrics endpoint exposes runtime counters and request ids", async () => {
  const healthResponse = await fetch(`${baseUrl}/healthz`);
  assert.equal(healthResponse.status, 200);
  assert.ok(healthResponse.headers.get("x-request-id"));

  const metricsResponse = await fetch(`${baseUrl}/metrics`);
  assert.equal(metricsResponse.status, 200);
  assert.ok(metricsResponse.headers.get("x-request-id"));

  const metrics = (await metricsResponse.json()) as {
    phase: string;
    runtime: {
      activeRequests: number;
      totalRequests: number;
      completedRequests: number;
    };
    memory: {
      rssBytes: number;
      heapTotalBytes: number;
      heapUsedBytes: number;
      externalBytes: number;
      arrayBuffersBytes: number;
    };
    requestCountsByMethod: Record<string, number>;
    requestCountsByRoute: Record<string, number>;
    responseCountsByStatusCode: Record<string, number>;
    requestLatencyByRoute: Record<
      string,
      { count: number; totalMs: number; maxMs: number; bucketCounts: Record<string, number> }
    >;
    errorCounts: {
      firstSlice: number;
      invalidJson: number;
      routeNotFound: number;
      storageNotReady: number;
      internal: number;
    };
  };

  assert.equal(metrics.phase, "production-baseline");
  assert.ok(metrics.runtime.totalRequests >= 2);
  assert.ok(metrics.runtime.completedRequests >= 1);
  assert.ok(metrics.requestCountsByMethod.GET >= 2);
  assert.ok(metrics.requestCountsByRoute["GET /healthz"] >= 1);
  assert.ok(metrics.requestCountsByRoute["GET /metrics"] >= 1);
  assert.ok(metrics.responseCountsByStatusCode["200"] >= 1);
  assert.equal(typeof metrics.memory.rssBytes, "number");
  assert.ok(metrics.memory.rssBytes > 0);
  assert.ok(metrics.requestLatencyByRoute["GET /healthz"]?.count >= 1);
  assert.ok(
    typeof metrics.requestLatencyByRoute["GET /healthz"]?.bucketCounts["+Inf"] ===
      "number"
  );
  assert.equal(typeof metrics.errorCounts.internal, "number");

  const prometheusResponse = await fetch(`${baseUrl}/metrics/prometheus`);
  assert.equal(prometheusResponse.status, 200);
  assert.match(
    prometheusResponse.headers.get("content-type") ?? "",
    /text\/plain/
  );

  const prometheusBody = await prometheusResponse.text();
  assert.match(prometheusBody, /rewrite_app_total_requests /);
  assert.match(prometheusBody, /rewrite_app_build_info\{/);
  assert.match(prometheusBody, /rewrite_app_request_count_by_route\{route="GET \/healthz"\}/);
  assert.match(prometheusBody, /rewrite_app_request_duration_ms_bucket\{route="GET \/healthz",le="\+Inf"\}/);
  assert.match(prometheusBody, /rewrite_app_process_resident_memory_bytes /);

  const diagnosticsResponse = await fetch(`${baseUrl}/diagnostics/runtime`);
  assert.equal(diagnosticsResponse.status, 200);
  const diagnostics = (await diagnosticsResponse.json()) as {
    storage: { kind: string; location: string | null };
    recentEvents: Array<{ event: string; details: { route?: string } }>;
  };

  assert.equal(typeof diagnostics.storage.kind, "string");
  assert.equal(Array.isArray(diagnostics.recentEvents), true);
  assert.equal(
    diagnostics.recentEvents.some(
      event =>
        event.event === "http_request_completed" &&
        event.details.route === "GET /healthz"
    ),
    true
  );

  const configResponse = await fetch(`${baseUrl}/diagnostics/config`);
  assert.equal(configResponse.status, 200);
  const config = (await configResponse.json()) as {
    runtimeConfig: {
      port: number;
      shutdownDrainDelayMs: number;
      storage: { kind: string; location: string | null };
      environment: {
        firstSliceStore: string;
        firstSlicePostgresUrlPresent: boolean;
      };
    };
  };

  assert.equal(typeof config.runtimeConfig.port, "number");
  assert.equal(typeof config.runtimeConfig.shutdownDrainDelayMs, "number");
  assert.equal(config.runtimeConfig.storage.kind, diagnostics.storage.kind);
  assert.equal(
    typeof config.runtimeConfig.environment.firstSliceStore,
    "string"
  );
  assert.equal(
    typeof config.runtimeConfig.environment.firstSlicePostgresUrlPresent,
    "boolean"
  );
});

test("frontend shell exposes multi-view navigation and diagnostics entrypoints", async () => {
  const appResponse = await requestText("/app");

  assert.equal(appResponse.status, 200);
  assert.match(appResponse.contentType ?? "", /text\/html/);
  assert.match(appResponse.body, /<app-root><\/app-root>/);
  assert.match(appResponse.body, /<base href="\/app\/">/);
  assert.match(appResponse.body, /<title>Testcenter Rewrite App<\/title>/);

  const scriptMatch = appResponse.body.match(
    /<script src="([^"]*main[^"]*\.js)" type="module"><\/script>/
  );
  assert.ok(scriptMatch, "Expected Angular app shell to reference a main bundle.");

  const stylesheetMatch = appResponse.body.match(
    /<link rel="stylesheet" href="([^"]*styles[^"]*\.css)"/
  );
  assert.ok(
    stylesheetMatch,
    "Expected Angular app shell to reference a stylesheet bundle."
  );

  const scriptResponse = await fetch(`${baseUrl}/app/${scriptMatch[1]}`);
  assert.equal(scriptResponse.status, 200);
  assert.match(scriptResponse.headers.get("content-type") ?? "", /javascript/);

  const stylesheetResponse = await fetch(`${baseUrl}/app/${stylesheetMatch[1]}`);
  assert.equal(stylesheetResponse.status, 200);
  assert.match(stylesheetResponse.headers.get("content-type") ?? "", /text\/css/);
});
