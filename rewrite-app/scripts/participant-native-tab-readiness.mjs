import assert from 'node:assert/strict';
import {raceWithSmokeDeadline} from './smoke-deadline.mjs';

export function nativeTabFailureEvidence(error, checks, pending, origin) {
  const allowed = ['Error', 'AssertionError', 'TimeoutError', 'TypeError', 'ReferenceError', 'AggregateError'];
  return {errorName: allowed.includes(error?.name) ? error.name : 'Error',
    checks: checks.slice(-100).map(value => String(value).slice(0, 200)),
    pendingRequests: [...pending].flatMap(([request, label]) => {
      const url = new URL(request.url());
      return url.origin === origin ? [{tab: label, method: request.method(), path: url.pathname}] : [];
    }).slice(0, 200)};
}

export async function waitForParticipantNativeTabReady(page, timeout = 30_000) {
  await page.waitForLoadState('domcontentloaded', {timeout});
  await page.waitForFunction(() => ['debug', 'pause', 'resume', 'terminate', 'goto']
    .every(key => typeof window.tc?.[key] === 'function'), undefined, {timeout});
}

// Qualify the driver's readiness criterion in an independent, owned fixture.
// Product Run/answer/clock/journal assertions remain in the real app journey.
export async function verifyNativeTabReadiness(browser, base, mark) {
  const page = await browser.newPage();
  let held;
  try {
    const root = base + '/__owned-native-readiness', stream = root + '/background';
    let acknowledge;
    const started = new Promise(done => {acknowledge = done;});
    await page.route(stream, route => {held = route; acknowledge();});
    await page.route(root, route => route.fulfill({contentType: 'text/html', body:
      `<html><script>window.tc={debug(){},pause(){},resume(){},goto(){}};fetch(${JSON.stringify(stream)});</script></html>`}));
    await page.goto(root, {waitUntil: 'domcontentloaded'});
    await raceWithSmokeDeadline(started, 30_000, () => {throw Error('Owned background readiness request did not start.');});
    await assert.rejects(waitForParticipantNativeTabReady(page, 200), {name: 'TimeoutError'});
    mark('readiness-rejects-a-missing-native-method');
    await page.evaluate(() => {window.tc.terminate = () => {};});
    await waitForParticipantNativeTabReady(page, 3000);
    await assert.rejects(page.waitForLoadState('networkidle', {timeout: 200}), {name: 'TimeoutError'});
    mark('ready-native-bindings-do-not-require-a-background-transport-to-finish');
  } finally {
    if (held) await held.fulfill({status: 204});
    await page.close();
  }
}
