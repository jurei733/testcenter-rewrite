import assert from 'node:assert/strict';
import {raceWithSmokeDeadline} from './smoke-deadline.mjs';

// Returning from a route callback does not complete Playwright's separate
// route-handling promise. A fetch that throws before fulfill therefore needs
// an explicit abort, even when the browser has already cancelled the request.
export async function settleFailedSmokeRoute(route, error) {
  const failure = route.request().failure();
  const cancelled = failure && /abort|cancel/i.test(failure.errorText)
    ? failure.errorText : null;
  let settlementError;
  try { await route.abort('aborted'); }
  catch (caught) {
    // A failed fulfill can already have completed the route. Preserve every
    // other settlement error, and never suppress an unexpected fetch failure.
    if (caught.message !== 'Route is already handled!') settlementError = caught;
  }
  return {cancelled, error: !cancelled ? error : settlementError};
}

// Exercise actual Chromium cancellation and Playwright's route lifecycle in
// the existing browser job, without another browser installation or API server.
export async function qualifySmokeRouteFailureSettlement(browser, base) {
  for (const cancel of [true, false]) {
    const page = await browser.newPage();
    let entered, release, returned;
    const entry = new Promise(done => {entered = done;});
    const gate = new Promise(done => {release = done;});
    const completion = new Promise(done => {returned = done;});
    const expected = Error('Owned pre-fulfill failure');
    const outcomes = [];
    try {
      await page.goto(base + '/app/', {waitUntil:'domcontentloaded'});
      await page.route('**/__owned_route_failure__', async route => {
        entered(route.request());
        await gate;
        // Inject the error before fulfill. The browser request
        // itself is real; the cancelled branch must have a native failure.
        outcomes.push(await settleFailedSmokeRoute(route, expected));
        returned();
      });
      const failed = page.waitForEvent('requestfailed', {
        predicate: request => new URL(request.url()).pathname === '/__owned_route_failure__'
      });
      await page.evaluate(() => {
        window.ownedSmokeAbort = new AbortController();
        void fetch('/__owned_route_failure__', {signal:window.ownedSmokeAbort.signal}).catch(() => {});
      });
      await raceWithSmokeDeadline(entry, 5000, () => {throw Error('Owned route was not intercepted');});
      if (cancel) {
        await page.evaluate(() => window.ownedSmokeAbort.abort());
        await raceWithSmokeDeadline(failed, 5000, () => {throw Error('Browser cancellation was not observed');});
      }
      release();
      await raceWithSmokeDeadline(completion, 5000, () => {throw Error('Failed route did not return');});
      await raceWithSmokeDeadline(page.unrouteAll({behavior:'wait'}), 5000,
        () => {throw Error('Returning from a failed route left Playwright waiting for route handling');});
      await raceWithSmokeDeadline(failed, 5000, () => {throw Error('Aborted request did not settle');});
      assert.equal(outcomes.length, 1);
      if (cancel) {
        assert.match(outcomes[0].cancelled, /abort|cancel/i);
        assert.equal(outcomes[0].error, undefined);
      } else {
        assert.equal(outcomes[0].cancelled, null);
        assert.equal(outcomes[0].error, expected);
      }
    } finally {
      release();
      await page.unrouteAll({behavior:'ignoreErrors'}).catch(() => {});
      await page.close();
    }
  }
}
