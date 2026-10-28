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
