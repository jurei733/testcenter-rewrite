// Playwright dispatches route callbacks outside the scenario's awaited body.
// Retain their failures for the scenario instead of losing its primary error
// to an unhandled rejection while the page/context is being disposed.
export function describeSmokeRouteFailure(error, depth = 0) {
  if (error == null) return null;
  const result = { name: error.name, message: String(error.message ?? error).split("\nCall log:")[0].slice(0, 4000),
    code: error.code, startedIn: error.startedIn, failedIn: error.failedIn };
  if (depth < 4) {
    if (error.cause) result.cause = describeSmokeRouteFailure(error.cause, depth + 1);
    if (Array.isArray(error.errors)) result.errors = error.errors.slice(0, 10).map(item => describeSmokeRouteFailure(item, depth + 1));
  }
  return result;
}

export function createSmokeRouteFailureGate() {
  const failures = [];
  const pending = new Set();
  let phase = "scenario";
  let lastReported, lastReportedCount = 0;
  const failure = primary => {
    if (!failures.length) return primary;
    if (primary === lastReported && failures.length === lastReportedCount) return primary;
    lastReported = new AggregateError(primary ? [primary, ...failures] : [...failures],
      "Owned browser route operation failed");
    lastReportedCount = failures.length;
    return lastReported;
  };
  return {
    wrap: (label, handler) => (...args) => {
      const startedIn = phase;
      const operation = (async () => {
        try { return await handler(...args); }
        catch (cause) {
          failures.push(Object.assign(new Error(`Owned route ${label} failed`, { cause }), { startedIn, failedIn: phase }));
          // Returning without fulfilling/aborting leaves route handling pending.
          if (typeof args[0]?.abort === "function") {
            try { await args[0].abort("failed"); }
            catch (abortCause) { failures.push(Object.assign(new Error(`Owned route ${label} abort failed`, { cause: abortCause }), { startedIn, failedIn: phase })); }
          }
        }
      })();
      pending.add(operation);
      void operation.finally(() => pending.delete(operation));
      return operation;
    },
    beginCleanup() { phase = "cleanup"; },
    async settle() { while (pending.size) await Promise.all([...pending]); },
    failure,
    assertHealthy() { const error = failure(); if (error) throw error; }
  };
}
