import type { ShellOpsHost } from "./rewrite-app-shell.ops";
import type { ShellOpsState } from "./rewrite-app-shell.state";

export function createShellOpsStateHost(args: {
  requestJson<T = Record<string, unknown>>(
    label: string,
    path: string,
    quiet?: boolean
  ): Promise<T>;
  opsState: ShellOpsState;
  rememberActivity(title: string, detail: string): void;
}): ShellOpsHost {
  return {
    requestJson: args.requestJson,
    getRuntimeHealthView: () => args.opsState.runtimeHealthView,
    setRuntimeHealthView: nextValue => {
      args.opsState.runtimeHealthView = nextValue;
    },
    getRuntimeMetricsView: () => args.opsState.runtimeMetricsView,
    setRuntimeMetricsView: nextValue => {
      args.opsState.runtimeMetricsView = nextValue;
    },
    getRuntimeDiagnosticsView: () => args.opsState.runtimeDiagnosticsView,
    setRuntimeDiagnosticsView: nextValue => {
      args.opsState.runtimeDiagnosticsView = nextValue;
    },
    getRuntimeConfigView: () => args.opsState.runtimeConfigView,
    setRuntimeConfigView: nextValue => {
      args.opsState.runtimeConfigView = nextValue;
    },
    getStorageKind: () => args.opsState.storageKind,
    setStorageKind: nextValue => {
      args.opsState.storageKind = nextValue;
    },
    getStorageSchemaVersion: () => args.opsState.storageSchemaVersion,
    setStorageSchemaVersion: nextValue => {
      args.opsState.storageSchemaVersion = String(nextValue);
    },
    getReadinessBadge: () => args.opsState.readinessBadge,
    setReadinessBadge: nextValue => {
      args.opsState.readinessBadge = nextValue;
    },
    setRouteCount: nextValue => {
      args.opsState.routeCount = String(nextValue);
    },
    setRuntimePort: nextValue => {
      args.opsState.runtimePort = String(nextValue);
    },
    setOperatorAuthMode: nextValue => {
      args.opsState.operatorAuthMode = nextValue;
    },
    setBuildRef: nextValue => {
      args.opsState.buildRef = nextValue;
    },
    setDiagnosticsLoaded: nextValue => {
      args.opsState.diagnosticsLoaded = nextValue;
    },
    rememberActivity: args.rememberActivity
  };
}
