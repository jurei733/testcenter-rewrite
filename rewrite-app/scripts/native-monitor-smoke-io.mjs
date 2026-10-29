import {raceWithSmokeDeadline} from './smoke-deadline.mjs';

// The deadline includes receiving the entire response body, not only headers.
export async function readNativeSmokeResponse(url, init = {}, {timeoutMs = 20_000, fetchImpl = fetch} = {}) {
  const controller = new AbortController();
  const failure = Error('Owned native request timed out.');
  const signal = init.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal;
  const response = (async () => {
    const result = await fetchImpl(url, {...init, signal});
    const text = await result.text();
    return {ok: result.ok, status: result.status, text};
  })();
  return raceWithSmokeDeadline(response, timeoutMs, () => {
    controller.abort(failure);
    throw failure;
  });
}

export async function stopNativeSmokeServer(child, {timeoutMs = 10_000, killGraceMs = 2_000} = {}) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  let onClose, onError;
  const closed = new Promise((done, reject) => {
    onClose = done; onError = reject;
    child.once('close', onClose); child.once('error', onError);
  });
  let timedOut = false;
  const failure = Error('Owned native server shutdown timed out.');
  try {
    child.kill('SIGTERM');
    await raceWithSmokeDeadline(closed, timeoutMs, async () => {
      timedOut = true;
      child.kill('SIGKILL');
      await raceWithSmokeDeadline(closed, killGraceMs, () => {throw failure;});
    });
    if (timedOut) throw failure;
  } finally {
    child.removeListener('close', onClose); child.removeListener('error', onError);
  }
}

// The API subprocess must release inherited pipes when its test owner dies.
// Its IPC lease is independent of a parent finally block or supervisor timer.
export function bindNativeSmokeServerOwner(server, {owner = process, graceMs = 2_000} = {}) {
  if (!Number.isSafeInteger(graceMs) || graceMs <= 0) throw Error('Owned native server grace must be finite and positive.');
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => owner.exit(1), graceMs);
    try {
      server.closeAllConnections();
      server.close(() => {clearTimeout(deadline); owner.exit(0);});
    } catch {
      clearTimeout(deadline); owner.exit(1);
    }
  };
  owner.once('SIGTERM', stop);
  owner.once('disconnect', stop);
  return stop;
}
