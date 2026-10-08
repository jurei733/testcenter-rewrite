import type {
  GetRuntimeConfigResponse,
  GetRuntimeDiagnosticsResponse
} from "@testcenter-rewrite-app/contracts";
import { productionApiRoutes } from "@testcenter-rewrite-app/contracts";

import {
  prettyPrintJson,
  readNumberValue,
  readScalarValue,
  readStringValue,
  readUnknownValue
} from "./rewrite-app-shell.readers";

export interface ShellOpsHost {
  requestJson<T = Record<string, unknown>>(
    label: string,
    path: string,
    quiet?: boolean
  ): Promise<T>;
  getRuntimeHealthView(): string;
  setRuntimeHealthView(nextValue: string): void;
  getRuntimeMetricsView(): string;
  setRuntimeMetricsView(nextValue: string): void;
  getRuntimeDiagnosticsView(): string;
  setRuntimeDiagnosticsView(nextValue: string): void;
  getRuntimeConfigView(): string;
  setRuntimeConfigView(nextValue: string): void;
  getStorageKind(): string;
  setStorageKind(nextValue: string): void;
  getStorageSchemaVersion(): string | number;
  setStorageSchemaVersion(nextValue: string | number): void;
  getReadinessBadge(): string;
  setReadinessBadge(nextValue: string): void;
  setRouteCount(nextValue: string | number): void;
  setRuntimePort(nextValue: string | number): void;
  setOperatorAuthMode(nextValue: string): void;
  setBuildRef(nextValue: string): void;
  setDiagnosticsLoaded(nextValue: boolean): void;
  rememberActivity(title: string, detail: string): void;
}

const countRouteLeaves = (value: unknown): number => {
  if (typeof value === "string") {
    return 1;
  }

  if (!value || typeof value !== "object") {
    return 0;
  }

  return Object.values(value).reduce(
    (total, child) => total + countRouteLeaves(child),
    0
  );
};

const readBooleanValue = (value: unknown, path: string[]): boolean | null => {
  const scalar = readUnknownValue(value, path);
  return typeof scalar === "boolean" ? scalar : null;
};

const formatBuildRef = (manifest: unknown, runtimeConfig: unknown): string => {
  const commitSha =
    readStringValue(manifest, ["build", "commitSha"]) ??
    readStringValue(runtimeConfig, ["build", "commitSha"]);
  if (commitSha) {
    return commitSha.slice(0, 12);
  }

  const builtAt =
    readStringValue(manifest, ["build", "builtAt"]) ??
    readStringValue(runtimeConfig, ["build", "builtAt"]);
  return builtAt ? "timestamped" : "local";
};

export async function refreshOperationalDiagnosticsAction(
  host: ShellOpsHost,
  quiet = false
): Promise<void> {
  const [health, readiness, manifest, metrics, runtimeDiagnostics, runtimeConfig] =
    await Promise.all([
      host.requestJson("Health", "/healthz", quiet),
      host.requestJson("Readiness", "/readyz", quiet),
      host.requestJson("Manifest", "/manifest", quiet),
      host.requestJson("Metrics", "/metrics", quiet),
      host.requestJson<GetRuntimeDiagnosticsResponse>(
        "Runtime Diagnostics",
        productionApiRoutes.system.getRuntimeDiagnostics,
        quiet
      ),
      host.requestJson<GetRuntimeConfigResponse>(
        "Runtime Config",
        productionApiRoutes.system.getRuntimeConfig,
        quiet
      )
    ]);

  host.setRuntimeHealthView(
    prettyPrintJson(
      {
        health,
        readiness,
        manifest
      },
      host.getRuntimeHealthView()
    )
  );
  host.setRuntimeMetricsView(
    prettyPrintJson(metrics, host.getRuntimeMetricsView())
  );
  host.setRuntimeDiagnosticsView(
    prettyPrintJson(runtimeDiagnostics, host.getRuntimeDiagnosticsView())
  );
  host.setRuntimeConfigView(
    prettyPrintJson(runtimeConfig, host.getRuntimeConfigView())
  );
  host.setStorageKind(
    readStringValue(manifest, ["storage", "kind"]) ?? host.getStorageKind()
  );
  host.setStorageSchemaVersion(
    readScalarValue(manifest, ["storage", "schemaVersion"]) ??
      host.getStorageSchemaVersion()
  );
  host.setReadinessBadge(
    readStringValue(readiness, ["status"]) ?? host.getReadinessBadge()
  );
  host.setRouteCount(countRouteLeaves(readUnknownValue(manifest, ["routes"])));
  host.setRuntimePort(
    readNumberValue(runtimeConfig, ["runtimeConfig", "port"]) ?? "n/a"
  );
  const operatorAuthRequired = readBooleanValue(runtimeConfig, [
    "runtimeConfig",
    "operatorAuthRequired"
  ]);
  host.setOperatorAuthMode(
    operatorAuthRequired == null
      ? "unknown"
      : operatorAuthRequired
        ? "required"
        : "open"
  );
  host.setBuildRef(formatBuildRef(manifest, runtimeConfig));
  host.setDiagnosticsLoaded(true);

  if (!quiet) {
    host.rememberActivity(
      "Diagnostics Refreshed",
      `Runtime is ${host.getReadinessBadge()} on storage ${host.getStorageKind()}.`
    );
  }
}

export async function refreshMetricsOnlyAction(host: ShellOpsHost): Promise<void> {
  const metrics = await host.requestJson("Metrics", "/metrics");
  host.setRuntimeMetricsView(
    prettyPrintJson(metrics, host.getRuntimeMetricsView())
  );
  const completedRequests = readNumberValue(metrics, ["runtime", "completedRequests"]) ?? 0;
  host.rememberActivity(
    "Metrics Refreshed",
    `Process has served ${completedRequests} completed request(s).`
  );
}
