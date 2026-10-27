import assert from 'node:assert/strict';
import {raceWithSmokeDeadline} from './smoke-deadline.mjs';
import {settleFailedSmokeRoute} from './smoke-route-failure.mjs';

/** Retire only this scenario's handlers, then prove every owned callback has
 * settled. Do not wait on Playwright's global history of unrelated routes.
 * A never-matching guard retains the page interceptor while owned callbacks
 * finish: removing its last pattern otherwise auto-continues held responses. */
export function createOwnedSmokeRoutes(page, {timeout = 20_000, observe = () => {}} = {}) {
  const registrations = [], active = new Set(), failures = [];
  const guardPattern = /(?!)/;
  const guardHandler = () => { throw Error('The owned route guard must never match'); };
  let guardInstalled = false;
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
      if (!guardInstalled) {
        await page.route(guardPattern, guardHandler); guardInstalled = true;
      }
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
        if (guardInstalled) {
          await page.unroute(guardPattern, guardHandler); guardInstalled = false;
        }
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
  let entered, release, unrelatedEntered, releaseUnrelated, unrelatedSettled=false;
  const entry = new Promise(resolve => {entered = resolve;}), gate = new Promise(resolve => {release = resolve;});
  const unrelatedEntry=new Promise(resolve=>{unrelatedEntered=resolve;}),unrelatedGate=new Promise(resolve=>{releaseUnrelated=resolve;});
  try {
    await page.goto(base + '/app/', {waitUntil: 'domcontentloaded'});
    await page.route('**/__owned_unrelated_route', route => route.fulfill({body: 'unrelated retained'}));
    await page.route('**/__owned_unrelated_held_route',async route=>{
      unrelatedEntered();await unrelatedGate;await route.fulfill({body:'unrelated held completed'});unrelatedSettled=true;
    });
    await scope.route('**/__owned_scoped_route', async (route, stage) => {
      stage('held'); entered(); await gate; stage('fulfill'); await route.fulfill({body: 'owned completed'});
    }, 'owned-fixture');
    await page.evaluate(() => {
      window.ownedScopedReply=fetch('/__owned_scoped_route').then(response=>response.text());
      window.ownedUnrelatedReply=fetch('/__owned_unrelated_held_route').then(response=>response.text());
    });
    await raceWithSmokeDeadline(Promise.all([entry,unrelatedEntry]),5000,()=>{throw Error('Owned or unrelated held route did not enter');});
    assert.deepEqual(scope.snapshot(), [{label: 'owned-fixture', stage: 'held'}]);
    await scope.remove();
    assert.equal(await page.evaluate(() => fetch('/__owned_unrelated_route').then(response => response.text())), 'unrelated retained');
    assert.equal(scope.snapshot().length, 1, 'Unregistering must not cancel or pretend to finish the held callback');
    release(); await scope.drain();
    assert.equal(await page.evaluate(() => window.ownedScopedReply), 'owned completed'); assert.deepEqual(scope.snapshot(), []);
    assert.equal(unrelatedSettled,false,'An owned drain must finish while the unrelated callback remains genuinely held.');
    releaseUnrelated();assert.equal(await page.evaluate(()=>window.ownedUnrelatedReply),'unrelated held completed');
    await scope.route('**/__owned_failed_scoped_route', async () => {throw Error('Owned unexpected route failure');}, 'owned-failure');
    const failed = page.waitForEvent('requestfailed', {predicate: request => new URL(request.url()).pathname === '/__owned_failed_scoped_route'});
    await page.evaluate(() => {void fetch('/__owned_failed_scoped_route').catch(() => {});});
    // Observe the actual callback failure before draining; the scope records it
    // and aborts the browser request rather than losing a rejected async handler.
    await raceWithSmokeDeadline(failed, 5000, () => {throw Error('Owned failed callback did not abort its request');});
    await assert.rejects(scope.drain(), error => error instanceof AggregateError && error.errors[0].message === 'Owned unexpected route failure');
  } finally {release();releaseUnrelated();await scope.drain().catch(() => {});await page.close();}

  // No unrelated route may accidentally keep the page interceptor alive.
  const onlyPage = await browser.newPage(), onlyScope = createOwnedSmokeRoutes(onlyPage, {timeout:5000});
  let enterOnly, releaseOnly;
  const onlyEntered = new Promise(resolve => {enterOnly=resolve;});
  const onlyGate = new Promise(resolve => {releaseOnly=resolve;});
  try {
    await onlyPage.goto(base + '/app/', {waitUntil:'domcontentloaded'});
    await onlyScope.route('**/__owned_only_route', async (route, stage) => {
      stage('held'); enterOnly(); await onlyGate;
      stage('fulfill'); await route.fulfill({body:'owned last response'});
    }, 'only-owned-fixture');
    await onlyPage.evaluate(() => {window.ownedOnlyReply=fetch('/__owned_only_route').then(response=>response.text());});
    await raceWithSmokeDeadline(onlyEntered,5000,()=>{throw Error('The sole owned route did not enter');});
    await onlyScope.remove();
    assert.equal(onlyScope.snapshot().length,1,'Removing the last owned pattern must retain its held callback');
    releaseOnly(); await onlyScope.drain();
    assert.equal(await onlyPage.evaluate(()=>window.ownedOnlyReply),'owned last response');
    assert.deepEqual(onlyScope.snapshot(),[]);
  } finally {releaseOnly();await onlyScope.drain().catch(()=>{});await onlyPage.close();}
}
