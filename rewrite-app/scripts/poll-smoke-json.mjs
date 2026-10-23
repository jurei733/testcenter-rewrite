import {setTimeout as delay} from 'node:timers/promises';
import {raceWithSmokeDeadline} from './smoke-deadline.mjs';

// A loop's Date.now() condition cannot bound an individual fetch/body await.
// Keep a referenced deadline until every byte is parsed, then dispose it.
export async function pollSmokeJson(url, {fetcher = globalThis.fetch, timeoutMs = 40_000,
  intervalMs = 1_000, attemptTimeoutMs = 5_000, onPhase = () => {}} = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || !Number.isSafeInteger(intervalMs) || intervalMs < 0 ||
      !Number.isSafeInteger(attemptTimeoutMs) || attemptTimeoutMs <= 0) {
    throw Error('Polling deadlines must be positive integer milliseconds');
  }
  const controller = new AbortController(), path = new URL(url).pathname;
  let phase = 'request', attempt = 0, lastError;
  const report = (value, status) => {phase = value; onPhase({path, phase, attempt, ...(status === undefined ? {} : {status})});};
  try {
    const work = (async () => {
      while (!controller.signal.aborted) {
        attempt++; report('request');
        // A published Docker port can accept a connection before its backend
        // is reachable. Bound that connection as well as the entire poll;
        // otherwise the first SYN/body can consume every remaining attempt.
        const attemptController = new AbortController();
        const timer = setTimeout(() => attemptController.abort(Error(`HTTP JSON attempt timed out for ${path}; phase=${phase}`)), attemptTimeoutMs);
        const clearAttemptTimer = () => clearTimeout(timer);
        controller.signal.addEventListener('abort', clearAttemptTimer, {once:true});
        try {
          const response = await fetcher(url, {signal: AbortSignal.any([controller.signal, attemptController.signal])});
          report('headers', response.status);
          if (!response.ok) {
            await response.body?.cancel();
            throw Error(`Unexpected HTTP ${response.status} for ${path}`);
          }
          report('body');
          const result = await response.json(); report('parsed'); return result;
        } catch (error) {
          if (controller.signal.aborted) throw error;
          lastError = error; report('retry');
          await delay(intervalMs, undefined, {signal: controller.signal});
        } finally {clearAttemptTimer();controller.signal.removeEventListener('abort',clearAttemptTimer);}
      }
      throw controller.signal.reason;
    })();
    return await raceWithSmokeDeadline(work, timeoutMs, () => {
      const error = new Error(`HTTP JSON timeout after ${timeoutMs}ms for ${path}; phase=${phase}; attempt=${attempt}`, {cause: lastError});
      controller.abort(error); throw error;
    });
  } finally {controller.abort();}
}
