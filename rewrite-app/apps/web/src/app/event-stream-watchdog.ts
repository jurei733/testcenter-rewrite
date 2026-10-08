// SSE heartbeats are emitted every 15 seconds. A channel without a valid
// scoped event for a minute must not remain live indefinitely (Original 19.0
// detects a silent WebSocket with two 30-second heartbeat rounds).
export const EVENT_STREAM_MAX_SILENCE_MS = 60_000;

export const createEventStreamWatchdog = (
  controller: AbortController
): { readonly timedOut: boolean; receivedEvent(): void; stop(): void } => {
  let handle: ReturnType<typeof setTimeout> | undefined;
  let revision = 0;
  let stopped = false;
  let timedOut = false;

  const stop = (): void => {
    stopped = true;
    revision += 1;
    if (handle !== undefined) clearTimeout(handle);
    handle = undefined;
    controller.signal.removeEventListener("abort", stop);
  };
  const arm = (): void => {
    if (stopped) return;
    if (handle !== undefined) clearTimeout(handle);
    const expectedRevision = ++revision;
    handle = setTimeout(() => {
      if (stopped || revision !== expectedRevision) return;
      timedOut = true;
      stop();
      controller.abort(new Error("Live channel heartbeat timed out."));
    }, EVENT_STREAM_MAX_SILENCE_MS);
  };

  controller.signal.addEventListener("abort", stop, { once: true });
  if (controller.signal.aborted) stop();
  else arm();
  return { get timedOut() { return timedOut; }, receivedEvent: arm, stop };
};
