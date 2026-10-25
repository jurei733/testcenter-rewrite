import assert from 'node:assert/strict';
import {raceWithSmokeDeadline} from './smoke-deadline.mjs';
import {settleFailedSmokeRoute} from './smoke-route-failure.mjs';

/** Retire only this scenario's handlers, then prove every owned callback has
 * settled. Do not wait on Playwright's global history of unrelated routes. */
export function createOwnedSmokeRoutes(page, {timeout = 20_000, observe = () => {}} = {}) {
  const registrations = [], active = new Set(), failures = [];
  const snapshot = () => [...active].map(item => ({label: item.label, stage: item.stage}));
  const remove = async pattern => {
    for (const entry of [...registrations]) {
      if (pattern !== undefined && entry.pattern !== pattern) continue;
      await page.unroute(entry.pattern, entry.handler);
      registrations.splice(registrations.indexOf(entry), 1);
    }
  };
  return {
    async route(pattern, callback, label) {
      const handler = async route => {
        let finish;
        const done = new Promise(resolve => { finish = resolve; });
        const state = {label, stage: 'entered', done}; active.add(state);
        try { await callback(route, stage => {state.stage = stage;}); }
        catch (error) {
          state.stage = 'settle-failure';
          const outcome = await settleFailedSmokeRoute(route, error);
          if (outcome.error) failures.push(outcome.error);
        } finally { active.delete(state); finish(); }
      };
      registrations.push({pattern, handler}); await page.route(pattern, handler);
    },
    remove, snapshot,
    async drain() {
      await raceWithSmokeDeadline((async () => {
        await remove();
        await Promise.all([...active].map(item => item.done));
      })(), timeout, () => {
        const pending = snapshot(); observe(pending);
        throw Error('Owned smoke routes did not settle: ' + JSON.stringify(pending));
      });
      if (failures.length) throw new AggregateError(failures, 'An owned smoke route failed.');
    }
  };
}

export async function qualifyOwnedSmokeRouteDrain(browser, base) {
  const page = await browser.newPage(), scope = createOwnedSmokeRoutes(page, {timeout: 5000});
  let entered, release;
  const entry = new Promise(resolve => {entered = resolve;}), gate = new Promise(resolve => {release = resolve;});
  try {
    await page.goto(base + '/app/', {waitUntil: 'domcontentloaded'});
    await page.route('**/__owned_unrelated_route', route => route.fulfill({body: 'unrelated retained'}));
    await scope.route('**/__owned_scoped_route', async (route, stage) => {
      stage('held'); entered(); await gate; stage('fulfill'); await route.fulfill({body: 'owned completed'});
    }, 'owned-fixture');
    await page.evaluate(() => {window.ownedScopedReply = fetch('/__owned_scoped_route').then(response => response.text());});
    await raceWithSmokeDeadline(entry, 5000, () => {throw Error('Owned scoped route did not enter');});
    assert.deepEqual(scope.snapshot(), [{label: 'owned-fixture', stage: 'held'}]);
    await scope.remove();
    assert.equal(await page.evaluate(() => fetch('/__owned_unrelated_route').then(response => response.text())), 'unrelated retained');
    assert.equal(scope.snapshot().length, 1, 'Unregistering must not cancel or pretend to finish the held callback');
    release(); await scope.drain();
    assert.equal(await page.evaluate(() => window.ownedScopedReply), 'owned completed'); assert.deepEqual(scope.snapshot(), []);
    await scope.route('**/__owned_failed_scoped_route', async () => {throw Error('Owned unexpected route failure');}, 'owned-failure');
    const failed = page.waitForEvent('requestfailed', {predicate: request => new URL(request.url()).pathname === '/__owned_failed_scoped_route'});
    await page.evaluate(() => {void fetch('/__owned_failed_scoped_route').catch(() => {});});
    // Observe the actual callback failure before draining; the scope records it
    // and aborts the browser request rather than losing a rejected async handler.
    await raceWithSmokeDeadline(failed, 5000, () => {throw Error('Owned failed callback did not abort its request');});
    await assert.rejects(scope.drain(), error => error instanceof AggregateError && error.errors[0].message === 'Owned unexpected route failure');
  } finally {release(); await scope.drain().catch(() => {}); await page.close();}
}
