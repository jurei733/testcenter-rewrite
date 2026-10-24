import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';
import { createSqliteFirstSliceRepository } from '@testcenter-rewrite-app/sqlite-store';
import { localDemoSourcePackage } from '../apps/api/dist/apps/api/src/local-demo-bootstrap.js';
import { createServerRequestFailureGate } from './server-request-failure-gate.mjs';

const root = resolve(process.env.UI_SMOKE_FRONTEND_ROOT || '.');
await access(join(root, 'dist/apps/web/browser/index.html'));
const artifacts = await mkdtemp(join(tmpdir(), 'testcenter-command-completion-browser-'));
console.log('owned_artifacts=' + artifacts);
const file = join(artifacts, 'owned.sqlite'), gate = createServerRequestFailureGate();
const server = spawn(process.execPath, ['--input-type=module', '-e', `
 import {createProductionApiServer} from ${JSON.stringify(pathToFileURL(resolve('apps/api/dist/apps/api/src/index.js')).href)};
 const server=await createProductionApiServer();server.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));
 process.once('SIGTERM',()=>server.close(()=>process.exit(0)));`], { cwd: root,
  env: { ...process.env, FIRST_SLICE_STORE: 'sqlite', FIRST_SLICE_SQLITE_FILE: file, FIRST_SLICE_BOOTSTRAP_DEMO: 'true',
    FIRST_SLICE_OPERATOR_AUTH_REQUIRED: 'true', FIRST_SLICE_PROOF_OF_WORK_SCOPES: '', FIRST_SLICE_XML_SCHEMA_PROFILE: 'legacy-compatibility', REQUIRE_LOGIN_PASSWORD: 'false' },
  stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
gate.observeStream(server.stdout); gate.observeStream(server.stderr);
const closed = new Promise(resolve => server.once('close', resolve));
const errors = [], checks = [], releases = [];
let browser;
const poll = async (action, message) => { const end = Date.now() + 20_000; while (Date.now() < end) { if (await action()) return; await delay(50); } throw Error(message); };
try {
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Owned completion API startup timed out')), 20_000);
    server.once('message', value => { clearTimeout(timer); resolve(value.port); }); server.once('error', reject);
  });
  const base = `http://127.0.0.1:${port}`;
  const api = async (path, body, token, method = body === undefined ? 'GET' : 'POST') => {
    const response = await fetch(base + path, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    assert.ok(response.ok, `${method} ${path}: ${response.status}`); return response.json();
  };
  const operator = (await api('/api/v1/admin/auth/sign-in', { username: 'demo-admin', password: 'demo-admin-password' })).sessionToken;
  const workspaceKey = 'owned-command-completion', workspace = '/api/v1/tenants/demo-tenant/workspaces/' + workspaceKey;
  await api('/api/v1/tenants/demo-tenant/workspaces', { workspaceKey, displayName: 'Owned command completion' }, operator);
  const content = JSON.parse(localDemoSourcePackage.sourceDocument), unit = content.bookletEntries[0].unitEntries[0];
  content.bookletEntries = [{ bookletKey: 'first', displayLabel: 'Completion', unitEntries: [{ ...unit, unitKey: 'owned-unit' }] },
    { bookletKey: 'second', displayLabel: 'Sibling', unitEntries: [{ ...unit, unitKey: 'sibling-unit' }] }];
  const source = await api(workspace + '/source-packages', { fileName: 'completion.json', mediaType: 'application/json', contentStructure: content }, operator);
  const imported = await api(workspace + '/import-jobs', { sourcePackageId: source.sourcePackage.sourcePackageId }, operator);
  await api(workspace + `/content-releases/${imported.stagedContentRelease.contentReleaseId}/activate`, { activatedByActorId: 'owned-completion-browser' }, operator);
  await api(workspace + '/participant-roster', { rosterText: JSON.stringify(['native', 'remote'].map(loginKey => ({ loginKey, groupKey: 'owned',
    executionMode: 'run-hot-return', booklets: [{ id: 'first' }, { id: 'second' }] }))) }, operator);
  const repository = createSqliteFirstSliceRepository(file);
  browser = await chromium.launch({ headless: process.env.UI_SMOKE_HEADFUL !== 'true' });
  for (const origin of ['native', 'remote']) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'de-DE' }), page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    let releaseContinuation, held = false, disposed = false, loseReply = true;
    const continuation = new Promise(resolve => { releaseContinuation = resolve; }); releases.push(releaseContinuation);
    const effects = [], completions = [];
    try {
      await page.goto(base + `/app/participant?ui=original&tenantKey=demo-tenant&workspaceKey=${workspaceKey}`, { waitUntil: 'networkidle' });
      await page.locator('#originalLoginName').fill(origin); await page.getByRole('button', { name: 'Weiter', exact: true }).click();
      await page.locator('#originalParticipantStarter mat-card[data-booklet-key="first"] button').click();
      await page.frameLocator('iframe').locator('#demoPlayerAnswer').waitFor();
      const runId = new URL(page.url()).searchParams.get('testRunId'); assert.ok(runId);
      await page.waitForFunction(() => typeof window.tc?.terminate === 'function'); await page.evaluate(() => window.tc.debug());
      await poll(async () => /BS:\s*live/.test(await page.locator('[data-debug-window="main"]').innerText()), 'Completion fixture reception did not become live');
      const initial = await repository.getTestRunById(runId);
      const logs = async () => (await repository.listParticipantTestLogsByWorkspace(initial.tenantId, initial.workspaceId))
        .filter(log => log.testRunId === runId && log.logKey === 'command executed' && log.logContent === 'terminate lock');
      page.on('request', request => {
        if (/\/(native-commands|application)$/.test(new URL(request.url()).pathname)) effects.push(request.postDataJSON());
      });
      await page.route('**/runtime-state*', async route => { held = true; await continuation; if (!disposed) await route.continue(); });
      await page.route('**/command-completions', async route => {
        const body = route.request().postDataJSON(); completions.push(body);
        const response = await route.fetch(); assert.equal(response.status(), 200);
        if (loseReply) { loseReply = false; await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"owned_lost_completion_reply"}' }); }
        else await route.fulfill({ response });
      });
      if (origin === 'native') await page.evaluate(() => window.tc.terminate(['lock']));
      else await api(workspace + `/monitor/open-runs/${runId}/commands`, { commandType: 'complete_and_lock' }, operator);
      await poll(() => held, 'The accepted termination did not reach its held client continuation');
      await poll(() => effects.length === 1, 'The command effect request is missing');
      assert.equal(effects[0].commandCompletion, 'browser-v1'); assert.deepEqual(await logs(), []); assert.deepEqual(completions, []);
      const committed = await repository.getTestRunById(runId); assert.equal(committed.status, 'paused'); assert.equal(committed.locked, true);
      const releasedAt = Date.now(); releaseContinuation();
      await poll(() => completions.length === 1, 'The fulfilled command did not queue its completion');
      assert.ok(completions[0].timeStamp >= releasedAt); assert.equal(completions[0].command.kind, origin);
      await poll(async () => (await logs()).length === 1, 'The separate completion transaction did not save its log');
      const saved = await logs(); assert.equal(saved[0].timestamp, completions[0].timeStamp); assert.equal(saved[0].logContent, 'terminate lock');
      await page.locator('#originalParticipantStarter').waitFor();
      await poll(() => page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('testcenter-rewrite:participant-command-completion:v1:')).length === 1), 'Lost completion reply did not leave its exact durable journal');
      const packet = JSON.stringify(completions[0]); await page.reload({ waitUntil: 'networkidle' });
      await page.locator('#originalParticipantStarter').waitFor();
      await poll(() => completions.length === 2, 'Starter reload did not restore the completed command journal');
      assert.equal(JSON.stringify(completions[1]), packet);
      await poll(() => page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('testcenter-rewrite:participant-command-completion:v1:')).length === 0), 'Acknowledged completion was not removed');
      assert.equal(effects.length, 1); assert.deepEqual(await logs(), saved);
      assert.deepEqual(await repository.getTestRunById(runId), committed);
      await page.bringToFront();
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const card = await page.locator('#originalParticipantStarter mat-card[data-booklet-key="first"]').boundingBox();
      assert.ok(card && card.width > 500 && card.height > 80);
      await page.screenshot({ path: join(artifacts, origin + '-starter.png'), fullPage: true });
      checks.push({ origin, completionTimeStamp: saved[0].timestamp, releasedAt, effectRequests: effects.length, completionRequests: completions.length, durableReloadReplay: true });
      console.log(`participant-command-completion-${origin}:passed`);
    } catch (error) {
      await writeFile(join(artifacts, origin + '-failure.json'), JSON.stringify({ error: String(error), held, effects, completions, errors }, null, 2) + '\n');
      await page.screenshot({ path: join(artifacts, origin + '-failure.png'), fullPage: true }).catch(() => {});
      throw error;
    } finally { disposed = true; releaseContinuation(); await page.unrouteAll({ behavior: 'ignoreErrors' }); await context.close(); }
  }
  assert.deepEqual(errors, []); gate.assertHealthy();
  await writeFile(join(artifacts, 'report.json'), JSON.stringify({ checks, errors, sourceScope: 'Production-built Angular, actual SQLite API, held terminal reconciliation and lost completion reply replay from Starter reload.' }, null, 2) + '\n');
} finally {
  for (const release of releases) release(); await browser?.close();
  if (server.exitCode === null) { server.kill('SIGTERM'); await Promise.race([closed, delay(5_000)]);
    if (server.exitCode === null) { server.kill('SIGKILL'); await closed; } }
  assert.equal(server.exitCode, 0); gate.assertHealthy(); console.log('owned_api=shutdown');
}
