import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdtemp, mkdir, readFile, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {extname, join, relative, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {originalBrowserSource, verifyOriginalBuild} from './original-browser-reference.mjs';
import {waitForMaterialTabs} from './material-tab-ready.mjs';
import {raceWithSmokeDeadline} from './smoke-deadline.mjs';
import {compareScreenshots} from './exact-rgba-comparison.mjs';

assert.equal(process.env.UI_SMOKE_HEADFUL, 'true');
assert.ok(!process.env.UI_SMOKE_BROWSER_CHANNEL, 'Source and Rewrite use the lockfile Chromium.');
assert.equal(process.env.ORIGINAL_PLAYER_REFERENCE_COMMIT, originalBrowserSource.commit);
const root = resolve(process.env.ORIGINAL_PLAYER_REFERENCE_ROOT);
const artifacts = resolve(process.env.UI_SMOKE_ARTIFACT_DIR);
const manifest = await verifyOriginalBuild(root);
const scratch = await mkdtemp(join(tmpdir(), 'original-settings-paired-'));
await mkdir(artifacts, {recursive: true});
const notices = {privacyNotice: 'Eigener Datenschutz aus dem Bestand',
  accessibilityNotice: 'Bestand Barrierefreiheit', legalNoticeHtml: 'Bestand Impressum'};
const sourceServer = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (relative(root, file).startsWith('..')) return response.writeHead(404).end();
    response.setHeader('content-type', ({'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
      '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png'})[extname(file)] || 'application/octet-stream');
    response.end(await readFile(file));
  } catch { response.writeHead(404).end(); }
});
await new Promise(done => sourceServer.listen(0, '127.0.0.1', done));
const sourceBase = 'http://127.0.0.1:' + sourceServer.address().port;
const module = pathToFileURL(resolve('apps/api/dist/apps/api/src/index.js')).href;
const apiServer = spawn(process.execPath, ['--input-type=module', '-e',
  'import{createProductionApiServer}from ' + JSON.stringify(module) + ';const server=await createProductionApiServer();' +
  "server.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));" +
  "process.once('SIGTERM',()=>server.close(()=>process.exit(0)));"], {
  stdio: ['ignore', 'ignore', 'inherit', 'ipc'], env: {...process.env, PORT: '4310', FIRST_SLICE_STORE: 'sqlite',
    FIRST_SLICE_SQLITE_FILE: join(scratch, 'owned.sqlite'), FIRST_SLICE_BOOTSTRAP_DEMO: 'true',
    FIRST_SLICE_OPERATOR_AUTH_REQUIRED: 'true', FIRST_SLICE_PROOF_OF_WORK_SCOPES: ''}
});
const apiClosed = new Promise(done => apiServer.once('close', done));
let browser;
const states = {}, comparisons = {}, errors = [], unknown = [];
const options = width => ({viewport: {width, height: 844}, deviceScaleFactor: 1,
  locale: 'de-DE', timezoneId: 'Europe/Berlin', colorScheme: 'light'});
async function capture(page, kind, theme, width) {
  await page.locator('[data-cy="admin-setting-app-name"]').waitFor();
  for (const [name, tab] of [['general', 'Allgemein'], ['images', 'Bildersetzungen']]) {
    // Initial states start in a fresh document, without a preceding wheel's native scrollbar fade.
    if (name === 'images') {
      await page.reload({waitUntil: 'networkidle'}); await page.locator('[data-cy="admin-setting-app-name"]').waitFor();
    }
    await page.getByRole('tab', {name: tab, exact: true}).click(); await waitForMaterialTabs(page);
    for (const position of ['initial', 'bottom']) {
    if (position === 'bottom') {
      const panel = page.locator('mat-tab-nav-panel'); await panel.hover({position: {x: 1, y: 1}}); await page.mouse.wheel(0, 10000);
      await page.waitForFunction(() => {
        const panel = document.querySelector('mat-tab-nav-panel');
        return panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 1;
      });
    }
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => document.getAnimations()
      .filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity)
      .every(animation => !animation.pending && animation.playState !== 'running'));
    await page.locator('[data-cy="header"] h1').click(); await page.mouse.move(0, 0);
    try {
      await page.waitForFunction(() => !document.querySelector('.mat-ripple-element:not(.mat-radio-persistent-ripple)') && document.getAnimations()
        .filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity)
        .every(animation => !animation.pending && animation.playState !== 'running'), null, {timeout: 5000});
    } catch (error) {
      await writeFile(join(artifacts, 'neutral-state-failure.json'), JSON.stringify(await page.evaluate(() => ({
        focused: {tag: document.activeElement.tagName, id: document.activeElement.id},
        ripples: [...document.querySelectorAll('.mat-ripple-element')].map(element => ({classes: element.className,
          parent: element.parentElement.className, opacity: getComputedStyle(element).opacity, transform: getComputedStyle(element).transform})),
        animations: document.getAnimations().map(animation => ({state: animation.playState, pending: animation.pending,
          iterations: animation.effect?.getComputedTiming().iterations,
          target: animation.effect?.target?.className}))
      })), null, 2));
      throw error;
    }
    await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    const key = theme + '-' + width + '-' + name + '-' + position;
    const measure = () => page.evaluate(() => {
      const read = element => {if (!element) return null; const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
        return {text: element.textContent, x: rect.x, y: rect.y, width: rect.width, height: rect.height,
          font: style.font, padding: style.padding, margin: style.margin, display: style.display, boxSizing: style.boxSizing, flex: style.flex, minWidth: style.minWidth, letterSpacing: style.letterSpacing};};
      const upload = document.querySelector('.image-gallery-panel button');
      return {viewport: {width: innerWidth, height: innerHeight, dpr: devicePixelRatio},
        headingDiagnostics: [...document.querySelectorAll('h2,h4')].map(element => {
          const range = document.createRange(); range.selectNodeContents(element);
          const style = getComputedStyle(element);
          return {...read(element), textRange: range.getBoundingClientRect().toJSON(),
            styles: Object.fromEntries(['font', 'line-height', 'letter-spacing', 'box-sizing', 'overflow',
              'white-space', 'word-spacing', 'text-rendering', 'font-kerning', 'color-scheme']
              .map(key => [key, style.getPropertyValue(key)]))};
        }),
        themes: [...document.querySelectorAll('.theme-config,.theme-config mat-radio-button,.theme-config label,.theme-config .theme-preview,.theme-config p')].map(read),
        tabs: [...document.querySelectorAll('[role="tab"]')].map(element => {
          const rect = element.getBoundingClientRect(); return {text: element.textContent.trim(),
            selected: element.getAttribute('aria-selected'), x: rect.x, y: rect.y, width: rect.width, height: rect.height};
        }), upload: upload ? {button: read(upload), icon: read(upload.querySelector('mat-icon')),
          label: read(upload.querySelector('.mdc-button__label'))} : null};
    });
    const geometry = await measure();
    await writeFile(join(artifacts, kind + '-' + key + '.json'), JSON.stringify(geometry, null, 2));
    const bytes = await page.screenshot({path: join(artifacts, kind + '-' + key + '.png'), fullPage: false});
    assert.deepEqual(await measure(), geometry, 'Taking the image must preserve the actual viewport and navigation layout.');
    (states[key] ??= {})[kind] = {geometry, bytes};
    if (kind === 'rewrite') {
      assert.ok(states[key].source, 'A real Source screenshot is required first.');
      comparisons[key] = {geometry: {source: states[key].source.geometry, rewrite: geometry},
        ...await compareScreenshots(page, states[key].source.bytes, bytes)};
      console.log('paired_original_settings=' + key + ': ' + comparisons[key].differingPixels + ' differing pixels');
    }
    }
  }
}
try {
  const port = await raceWithSmokeDeadline(new Promise((done, reject) => {
    apiServer.once('message', message => done(message.port)); apiServer.once('error', reject);
    apiServer.once('exit', () => reject(Error('Owned API exited before listening.')));
  }), 20000, () => { throw Error('Owned API startup timed out.'); });
  const base = 'http://127.0.0.1:' + port;
  let token;
  const api = async (path, body, method = body === undefined ? 'GET' : 'POST') => {
    const response = await fetch(base + path, {method, headers: {...(token ? {authorization: 'Bearer ' + token} : {}),
      ...(body === undefined ? {} : {'content-type': 'application/json'})}, ...(body === undefined ? {} : {body: JSON.stringify(body)})});
    assert.ok(response.ok, 'Owned setup HTTP ' + response.status + ': ' + method + ' ' + path); return response.json();
  };
  token = (await api('/api/v1/admin/auth/sign-in', {username: 'demo-admin', password: 'demo-admin-password'})).sessionToken;
  const before = (await api('/api/v1/system/application-settings')).applicationSettings;
  browser = await chromium.launch({headless: false});
  for (const theme of ['Primar', 'Sekundar', 'Erwachsene']) {
    await api('/api/v1/admin/application-settings', {...before, ...notices, themeName: theme}, 'PATCH');
    // The visual contexts receive only state created by this actual protected UI sign-in.
    const login = await browser.newContext(options(1280)), page = await login.newPage(); await page.bringToFront();
    page.on('pageerror', error => errors.push({kind: 'real-login', theme, error: String(error)}));
    await page.goto(base + '/app/ops?ui=original', {waitUntil: 'networkidle'});
    await page.locator('#adminUsername').fill('demo-admin'); await page.locator('#adminPassword').fill('demo-admin-password');
    const signedIn = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/admin/auth/sign-in' && response.ok());
    await page.locator('#adminSignInButton').click(); const browserToken = (await (await signedIn).json()).sessionToken;
    assert.notEqual(browserToken, token); await page.locator('#originalSystemAdministration[aria-busy="false"]').waitFor();
    const storageState = await login.storageState(); await login.close();
    for (const width of [1280, 390]) for (const kind of ['source', 'rewrite']) {
      const context = await browser.newContext({...options(width), ...(kind === 'rewrite' ? {storageState} : {})});
      if (kind === 'source') {
        await context.addInitScript(theme => localStorage.setItem('iqb-tc-a', JSON.stringify({token: 'owned-settings-reference',
          displayName: 'Owned Admin', loginName: 'demo-admin', groupLabel: '', id: 1, flags: [], customTexts: {},
          claims: {superAdmin: [{id: '1', label: 'Systemverwaltung', type: 'superAdmin', flags: {}, workspaceId: '', description: ''}]},
          viewSettings: {theme}})), theme);
        await context.route(sourceBase + '/api/**', async route => {
          const method = route.request().method(), path = new URL(route.request().url()).pathname; let body;
          if (method !== 'GET') { unknown.push({method, path}); return route.fulfill({status: 403, body: '{}'}); }
          if (path === '/api/system/config') body = {version: 'Owned settings reference', customTexts: {},
            appConfig: {appTitle: before.appTitle, themeName: theme, ...notices}, veronaPlayerApiVersionMin: 2,
            veronaPlayerApiVersionMax: 6, iqbStandardResponseTypeMin: 1, iqbStandardResponseTypeMax: 5, xmlSchemaVersions: {},
            bruteForceProtection: [], broadcastingServiceUri: '', fileServiceUri: '', passwordMinLength: 0, passwordPattern: ''};
          else if (path === '/api/sys-check-mode') body = false;
          else if (path === '/api/asset-assignments') body = {};
          else if (path === '/api/assets') body = [];
          else { unknown.push({method, path}); return route.fulfill({status: 404, body: '{}'}); }
          await route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(body)});
        });
      }
      const current = await context.newPage(); await current.bringToFront();
      current.on('pageerror', error => errors.push({kind, theme, width, error: String(error)}));
      await current.goto(kind === 'source' ? sourceBase + '/#/superadmin/settings' : base + '/app/ops?ui=original&adminSection=settings', {waitUntil: 'networkidle'});
      await capture(current, kind, theme, width); await context.close();
    }
  }
  assert.equal(Object.keys(states).length, 24);
  for (const [key, state] of Object.entries(states)) {
    assert.ok(state.source && state.rewrite, 'Every case requires actual Source and actual Rewrite screenshots.');
    assert.ok(comparisons[key], 'Every Source pair must be compared.');
  }
  assert.deepEqual(errors, []); assert.deepEqual(unknown, []);
  assert.deepEqual(Object.entries(comparisons).filter(([, value]) => value.differingPixels).map(([key, value]) => ({key, ...value})), [],
    'Every complete initial/bottom settings viewport must match the unchanged Source exactly.');
} finally {
  await writeFile(join(artifacts, 'settings.json'), JSON.stringify({source: originalBrowserSource, manifest,
    scope: 'Unchanged Source frontend on read-only API fixtures versus Rewrite with a real protected SQLite session; no Source backend authorization proof.',
    states: comparisons, errors, unknown}, null, 2));
  await browser?.close(); apiServer.kill('SIGTERM');
  await raceWithSmokeDeadline(apiClosed, 10000, () => { apiServer.kill('SIGKILL'); throw Error('Owned API shutdown timed out.'); });
  await new Promise(done => sourceServer.close(done));
  await verifyOriginalBuild(root);
}
