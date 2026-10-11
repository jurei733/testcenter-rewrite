import type { ParticipantRunCommandScope } from "@testcenter-rewrite-app/domain";

export const participantDebugWindows = ["main", "config", "testmode", "booklet", "unit", "customtexts", "variables", "states", "system", "tools"] as const;
export type ParticipantDebugWindow = typeof participantDebugWindows[number];
export type ParticipantDebugControlState = { enabled: boolean; activeWindows: ParticipantDebugWindow[] };
export type ParticipantDebugControl = {
  observeScope(): void;
  command(args: readonly string[]): boolean;
  toggleWindow(window: ParticipantDebugWindow): void;
  closeWindow(window: ParticipantDebugWindow): void;
  stop(): void;
  matches(scope: ParticipantRunCommandScope): boolean;
};

const controllers = new Set<ParticipantDebugControl>();
const owners = new Map<ParticipantDebugControl, { window: Window; consoleCommand?: (args: readonly string[]) => void }>();
const bindings = new Map<Window, { tc: Record<string, unknown>; previousTc: unknown;
  previousDebug: PropertyDescriptor | undefined; method: (args?: string[]) => void; owners: number }>();
const validArguments = (args: unknown): args is string[] => Array.isArray(args) && args.every(value => typeof value === "string");
const scopeKey = (scope: ParticipantRunCommandScope | null): string | null => scope
  ? JSON.stringify([scope.tenantId, scope.workspaceId, scope.participantSessionId, scope.testRunId]) : null;

/** Browser-local preferences; remote delivery still requires the scoped ACK/application receipt. */
export const createParticipantDebugControl = (options: {
  readScope: () => ParticipantRunCommandScope | null;
  isProductionMode: boolean;
  changed: (state: ParticipantDebugControlState) => void;
  consoleCommand?: (args: readonly string[]) => void;
  window?: Window;
}): ParticipantDebugControl => {
  const window = options.window ?? globalThis.window;
  const storage = (): Storage | null => { try { return window?.localStorage ?? null; } catch { return null; } };
  const read = (): string | null => { try { return storage()?.getItem("tc-debug") ?? null; } catch { return null; } };
  const write = (windows: ParticipantDebugWindow[] | null): void => {
    try { if (windows) storage()?.setItem("tc-debug", JSON.stringify(windows)); else storage()?.removeItem("tc-debug"); } catch {}
  };
  const restore = (): ParticipantDebugWindow[] => {
    try {
      const value: unknown = JSON.parse(read() ?? "null");
      if (Array.isArray(value)) return [...new Set(value)].filter((id): id is ParticipantDebugWindow => participantDebugWindows.includes(id));
    } catch {}
    return ["main"];
  };
  let enabled = false, activeWindows = restore(), stopped = false;
  let previousScope: string | null | undefined;
  const publish = (): void => options.changed({ enabled, activeWindows: [...activeWindows] });
  const control: ParticipantDebugControl = {
    observeScope() {
      if (stopped) return;
      const currentScope = scopeKey(options.readScope());
      if (previousScope === currentScope) return;
      previousScope = currentScope;
      // Source restores preferences on controller creation only outside production.
      enabled = currentScope !== null && !options.isProductionMode && Boolean(read());
      activeWindows = restore(); publish();
    },
    command(args) {
      if (stopped || !validArguments(args) || !options.readScope()) return false;
      control.observeScope();
      enabled = args.length === 0 || args[0]!.toLowerCase() !== "off";
      if (enabled) { activeWindows = ["main"]; write(activeWindows); } else write(null);
      publish(); return true;
    },
    toggleWindow(id) {
      if (stopped || !enabled || !participantDebugWindows.includes(id)) return;
      activeWindows = activeWindows.includes(id) ? activeWindows.filter(value => value !== id) : [...activeWindows, id];
      write(activeWindows); publish();
    },
    closeWindow(id) {
      if (stopped || !enabled) return;
      activeWindows = activeWindows.filter(value => value !== id); write(activeWindows); publish();
    },
    matches(scope) { return !stopped && scopeKey(options.readScope()) === scopeKey(scope); },
    stop() {
      if (stopped) return;
      stopped = true; controllers.delete(control); owners.delete(control);
      const binding = bindings.get(window);
      if (binding && --binding.owners === 0) {
        const currentTc = (window as Window & { tc?: unknown }).tc;
        if (currentTc === binding.tc && binding.tc["debug"] === binding.method) {
          if (binding.previousDebug) Object.defineProperty(binding.tc, "debug", binding.previousDebug);
          else delete binding.tc["debug"];
          if (binding.previousTc !== binding.tc && Object.keys(binding.tc).length === 0) {
            if (binding.previousTc === undefined) delete (window as Window & { tc?: unknown }).tc;
            else (window as Window & { tc?: unknown }).tc = binding.previousTc;
          }
        }
        bindings.delete(window);
      }
    }
  };
  controllers.add(control);
  owners.set(control, { window, consoleCommand: options.consoleCommand });
  if (window) {
    const existing = bindings.get(window);
    if (existing) existing.owners++;
    else {
      const previousTc = (window as Window & { tc?: unknown }).tc;
      const tc = previousTc && typeof previousTc === "object" ? previousTc as Record<string, unknown> : {};
      const previousDebug = Object.getOwnPropertyDescriptor(tc, "debug");
      const method = (args: string[] = []): void => {
        // A terminal debug command has no remote ACK, exactly like the Source console API.
        const owner = [...controllers].reverse().find(item => owners.get(item)?.window === window && item.command(args));
        if (owner) owners.get(owner)?.consoleCommand?.(args);
      };
      try {
        Object.defineProperty(tc, "debug", { configurable: true, enumerable: true, writable: true, value: method });
        (window as Window & { tc?: unknown }).tc = tc;
        bindings.set(window, { tc, previousTc, previousDebug, method, owners: 1 });
      } catch {}
    }
  }
  control.observeScope();
  return control;
};

export const applyParticipantDebugArguments = (args: readonly string[], scope: ParticipantRunCommandScope): void => {
  const control = [...controllers].reverse().find(item => item.matches(scope));
  if (!control?.command(args)) throw Object.assign(new Error("The selected controller's debug pane is not ready."), { retryable: true });
};
