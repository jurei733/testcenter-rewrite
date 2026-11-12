import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir, mkdtemp, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {createSqliteFirstSliceStorage} from '@testcenter-rewrite-app/sqlite-store';
import {createFirstSliceServices} from '@testcenter-rewrite-app/application';
import {prepareOriginalXmlSchemaValidator} from '../packages/application/dist/packages/application/src/original-xml-schema.js';
import {setupNativeSystemCheck, systemCheckXml, systemCheckRoster} from './native-system-check-fixture.mjs';
import {prepareNativeNetworkChecks, runNativeNetworkChecks, sourceNetwork} from './native-system-check-network-smoke.mjs';
import {isSupervisedSmokeChild, runSupervisedSmoke, reportSmokePhase} from './supervised-smoke.mjs';
import {raceWithSmokeDeadline} from './smoke-deadline.mjs';
import {runNativeAnonymousSystemChecks} from './native-system-check-anonymous-smoke.mjs';
import {stopNativeSmokeServer} from './native-monitor-smoke-io.mjs';

const root = process.env.UI_SMOKE_ARTIFACT_DIR ? resolve(process.env.UI_SMOKE_ARTIFACT_DIR) : await mkdtemp(join(tmpdir(), 'owned-native-syscheck-ui-'));
if (!isSupervisedSmokeChild(import.meta.url)) {
  process.exitCode = await runSupervisedSmoke({entry: fileURLToPath(import.meta.url), artifactDirectory: join(root, 'native-system-check-supervision'),
    env: {...process.env, UI_SMOKE_ARTIFACT_DIR: root}, phaseTimeoutMs: 60000, totalTimeoutMs: 240000});
} else {
  const out = join(root, 'native-system-check'); await mkdir(out, {recursive: true});
  const checks = [], errors = [], wire = [], reportBodies = [], lifecycleReceipts = [];
  let browser, server, storage, page;
  const mark = label => {checks.push(label); reportSmokePhase(label);};
  try {
    reportSmokePhase('native-system-check-owned-fixture');
    const file = join(await mkdtemp(join(out, 'runtime-')), 'owned.sqlite');
    storage = createSqliteFirstSliceStorage(file);
    const validator = await prepareOriginalXmlSchemaValidator(resolve(process.env.FIRST_SLICE_XML_SCHEMA_CACHE || '.data/original-xml-schemas'), false);
    const repository = storage.repository, services = createFirstSliceServices({repository, originalXmlSchemaValidator: validator, xmlSchemaProfile: 'original-19'});
    const setup = await setupNativeSystemCheck(services, repository);
    await setup.upload('people.xml',systemCheckRoster());
    await prepareNativeNetworkChecks(setup);
    const metadata = {$schema: 'https://raw.githubusercontent.com/verona-interfaces/metadata/master/verona-module-metadata.json', id: 'owned-native-syscheck-player', version: '1.0.0', specVersion: '6.0', metadataVersion: '2.0', type: 'player', name: [{lang: 'de', value: 'Owned native Systemcheck Player'}]};
    const player = '<!doctype html><html><script type="application/ld+json">' + JSON.stringify(metadata) + '</script><body><label>Owned Systemcheck answer<input aria-label="Owned Systemcheck answer" disabled></label><script>let sessionId;addEventListener("message",event=>{if(event.data?.type==="vopStartCommand"){sessionId=event.data.sessionId;document.querySelector("input").disabled=false;document.body.dataset.started="true";}});document.querySelector("input").addEventListener("input",event=>parent.postMessage({type:"vopStateChangedNotification",sessionId,unitState:{dataParts:{answer:event.target.value},unitStateDataType:"owned-syscheck-response",responseProgress:"complete",presentationProgress:"complete"}},"*"));parent.postMessage({type:"vopReadyNotification",metadata:{specVersion:"6.0"}},"*");</script></body></html>';
    await setup.upload('owned-native-syscheck-player-1.0.html', player, 'text/html');
    await setup.upload('flow-unit.xml', systemCheckXml('Unit', '<Metadata><Id>R101.UNIT</Id><Label>Owned Systemcheck Unit</Label></Metadata><Definition player="owned-native-syscheck-player-1.0">{"owned":true}</Definition>'));
    const questions = '<Q id="heading" type="header" prompt="Owned questions"/><Q id="answer" type="string" prompt="Owned required answer" required="true"/><Q id="agree" type="check" prompt="Owned required agreement" required="true"/><Q id="choice" type="select" prompt="Owned selection">A#B</Q><Q id="radio" type="radio" prompt="Owned radio">C#D</Q><Q id="notes" type="text" prompt="Owned notes"/>';
    await setup.upload('flow-check.xml', systemCheckXml('SysCheck', '<Metadata><Id>R101.FLOW</Id><Label>Owned native flow</Label><Description>Owned native flow description</Description></Metadata><Config unit="R101.UNIT" savekey="owned-key"><UploadSpeed min="1" good="2" maxSequenceRepetitions="1">64,128</UploadSpeed><DownloadSpeed min="1" good="2" maxSequenceRepetitions="1">64,128</DownloadSpeed>' + questions + '</Config>'));
    const singleWorkspace = await services.platform.createWorkspace({tenantKey: setup.scope.tenantKey, workspaceKey: 'single', displayName: 'Owned single Systemcheck'});
    const singleScope = {tenantKey: setup.scope.tenantKey, workspaceKey: singleWorkspace.workspaceKey};
    await services.contentIntake.uploadWorkspaceFile({...singleScope, fileName: 'single.xml', mediaType: 'application/xml', sourceDocument: systemCheckXml('SysCheck', '<Metadata><Id>R101.SINGLE</Id><Label>Owned single check</Label></Metadata><Config skipnetwork="true" savekey="owned-key"><Q id="single" type="string" prompt="Owned single answer"/></Config>')});
    await services.workspaceAdminRead.importParticipantRoster({...singleScope, rosterText: systemCheckXml('Testtakers', '<Metadata/><Group id="R101.SINGLE.GROUP" label="Owned single group"><Login name="r101-single" pw="owned-r98-theme-password" mode="sys-check-login"/></Group>')});
    const reports = async () => (await repository.listWorkspaceActivityEventsByWorkspace(setup.ids.tenantId, setup.ids.workspaceId)).filter(event => event.eventType === 'system_check_report_saved');
    server = spawn(process.execPath, [resolve('scripts/native-system-check-server.mjs')], {
      stdio: ['ignore', 'ignore', 'inherit', 'ipc'], env: {...process.env, FIRST_SLICE_STORE: 'sqlite', FIRST_SLICE_SQLITE_FILE: file,
        FIRST_SLICE_BOOTSTRAP_DEMO: 'false', FIRST_SLICE_OPERATOR_AUTH_REQUIRED: 'true', FIRST_SLICE_XML_SCHEMA_PROFILE: 'original-19', REQUIRE_LOGIN_PASSWORD: 'false',
        FIRST_SLICE_PROOF_OF_WORK_SCOPES: 'participant,second_code', FIRST_SLICE_PROOF_OF_WORK_SECRET: 'owned-native-system-check-smoke-secret', FIRST_SLICE_PROOF_OF_WORK_PREVIOUS_SECRET: '', FIRST_SLICE_PROOF_OF_WORK_MAX_NUMBER: '12', FIRST_SLICE_PROOF_OF_WORK_TTL_MS: '60000'}
    });
    const port = await raceWithSmokeDeadline(new Promise((done, reject) => {server.once('message', message => done(message.port)); server.once('error', reject); server.once('exit', () => reject(Error('Owned Systemcheck API exited.')));}), 20000, () => {throw Error('Owned Systemcheck API startup timed out.');});
    const base = 'http://127.0.0.1:' + port, flow = '/app/check/' + setup.workspaceNumber + '/R101.FLOW/w';
    browser = await chromium.launch({headless: process.env.CI === 'true', channel: process.env.UI_SMOKE_BROWSER_CHANNEL || 'chrome'});
    page = await browser.newPage({viewport: {width: 1280, height: 850}}); page.setDefaultTimeout(20000);
    page.on('pageerror', error => errors.push(String(error)));
    page.on('request', request => {
      const path = new URL(request.url()).pathname, headers = request.headers();
      if (path.includes('/sys-check/') || path === '/session' || path === '/system/time' || path.startsWith('/speed-test/')) {
        wire.push({method: request.method(), path, nativeToken: !!headers.authtoken, canonicalToken: !!headers.authorization});
        if (path.endsWith('/report') && request.method() === 'PUT') reportBodies.push(request.postDataJSON());
      }
    });
    const login = async name => {
      await page.goto(base + '/app/native-start'); await page.locator('input[name="name"]').fill(name);
      await page.locator('[data-cy="login-user"]').click(); await page.locator('input[name="password"]').fill('owned-r98-theme-password');
      await page.locator('[data-cy="login-user"]').click();
    };
    const openFlow = async () => {
      await page.locator('[data-cy="syscheck-R101.FLOW"]').click();
      await page.locator('#syscheck-next-step:not([disabled])').waitFor();
    };
    const next = async letter => {
      await page.locator('#syscheck-next-step').click(); await page.waitForURL(new RegExp('/' + letter + '$'));
    };
    const fillQuestions = async () => {
      await page.locator('#answer').fill('Owned native answer'); await page.locator('#agree input').check();
      await page.locator('#choice').click(); await page.getByRole('option', {name: 'B', exact: true}).click();
      await page.locator('#radio').getByLabel('D', {exact: true}).check(); await page.locator('#notes').fill('Owned multiline notes');
    };
    await login('r98-syscheck');
    await page.locator('[data-cy="syscheck-R101.FLOW"]').waitFor();
    assert.equal(await page.locator('[data-cy^="syscheck-"]').count(), 3 + sourceNetwork.networkCases.length);
    assert.equal(await page.getByText('Für diese Anmeldung wurde kein Test gefunden.', {exact: true}).count(), 0);
    mark('native-system-check-source-starter-selection');
    await openFlow();
    await page.screenshot({path: join(out, 'welcome.png')});
    assert.equal(await page.locator('.system-check-login').count(), 0);
    await next('n'); await page.locator('#systemCheckNetworkStatus').filter({hasText: 'Die folgenden Netzwerkeigenschaften wurden festgestellt:'}).waitFor();
    await page.locator('#syscheck-next-step:not([disabled])').waitFor();
    assert.ok(wire.some(row => row.path.startsWith('/speed-test/random-package/64&uid=')));
    mark('native-system-check-real-time-and-network');
    await next('u');
    const answer = page.frameLocator('app-original-system-check-unit iframe').getByLabel('Owned Systemcheck answer');
    await answer.fill('Owned opaque Player answer');
    const sandbox = await page.locator('app-original-system-check-unit iframe').getAttribute('sandbox');
    assert.ok(sandbox.includes('allow-scripts')); assert.ok(!sandbox.includes('allow-same-origin'));
    mark('native-system-check-opaque-player-handshake-response');
    await next('q'); await fillQuestions(); await page.screenshot({path: join(out, 'questionnaire.png')});
    await next('r');
    await page.locator('#syscheck-previous-step').click(); await page.waitForURL(/\/q$/);
    assert.equal(await page.locator('#answer').inputValue(), 'Owned native answer');
    assert.equal(await page.locator('#agree input').isChecked(), true);
    await next('r'); await page.screenshot({path: join(out, 'report.png')});
    await page.locator('#saveSystemCheckReportButton').click(); await page.locator('#globalConfirmationTitle').waitFor();
    assert.equal(await page.locator('#systemCheckSaveReportBackdrop').count(), 0);
    const saved = await reports(); assert.equal(saved.length, 1);
    assert.equal(saved[0].details.report.title, 'r98-syscheck');
    assert.ok(saved[0].details.report.responses.some(row => row.id === 'answer' && row.content === 'Owned opaque Player answer'));
    assert.ok(saved[0].details.report.questionnaire.some(row => row.id === 'agree' && row.value === true));
    assert.ok(!Object.hasOwn(reportBodies[0], 'keyPhrase')); assert.ok(!Object.hasOwn(reportBodies[0], 'title'));
    await page.screenshot({path: join(out, 'saved-dialog.png')});
    await page.locator('#globalConfirmationCancelButton').click(); await page.waitForURL(/\/native-start$/);
    mark('native-system-check-questionnaire-report-native-put-persistence');
    assert.ok(wire.every(row => !row.canonicalToken));
    assert.ok(wire.filter(row => row.path.includes('/sys-check/')).every(row => row.nativeToken));
    mark('native-system-check-no-canonical-bearer-or-admin-promotion');
    await runNativeNetworkChecks({page, base, server, mark, reportBodies});
    await page.goto(base + flow.replace(/\/w$/, '/q')); await page.waitForURL(/\/native-start$/);
    await page.goto(base + flow); await page.locator('#syscheck-next-step:not([disabled])').waitFor();
    mark('native-system-check-direct-welcome-and-fresh-child-route-guard');
    let release; const held = new Promise(resolve => {release = resolve;}); let observed;
    const intercepted = new Promise(resolve => {observed = resolve;});
    await page.goto(base + '/app/native-start');
    const configPattern = '**/workspace/' + setup.workspaceNumber + '/sys-check/R101.FLOW';
    await page.route(configPattern, async route => {const response = await route.fetch(); observed(); await held; try {await route.fulfill({response});} catch { /* Browser canceled this owned request. */ }});
    await page.locator('[data-cy="syscheck-R101.FLOW"]').click(); await intercepted;
    await page.getByRole('link', {name: 'Gehe zur Startseite'}).click(); await page.waitForURL(/\/native-start$/);
    release(); await page.unroute(configPattern);
    assert.equal(await page.locator('app-original-system-check-content').count(), 0);
    mark('native-system-check-delayed-config-navigation-retirement');
    const token = await page.evaluate(() => localStorage.getItem('testcenter-native-monitor-session'));
    await page.goto(base + flow); await page.locator('#syscheck-next-step:not([disabled])').waitFor();
    const logout = await fetch(base + '/session', {method: 'DELETE', headers: {AuthToken: token}}); assert.equal(logout.status, 205);
    await page.waitForURL(/\/native-start$/);
    assert.equal(await page.locator('app-original-system-check-content').count(), 0);
    mark('native-system-check-revoked-person-retires-view');
    await login('r98-syscheck'); await page.locator('[data-cy="syscheck-R101.FLOW"]').waitFor();
    await openFlow(); await next('n');
    await page.locator('#systemCheckNetworkStatus').filter({hasText: 'Die folgenden Netzwerkeigenschaften wurden festgestellt:'}).waitFor();
    await next('u'); await page.frameLocator('app-original-system-check-unit iframe').getByLabel('Owned Systemcheck answer').fill('Owned private answer before expiry');
    const expiringToken = await page.evaluate(() => localStorage.getItem('testcenter-native-monitor-session'));
    const expiringPerson = (await services.originalAuthentication.read({token: expiringToken})).participantSession;
    await repository.updateParticipantSessionValidity({...expiringPerson, validUntil: new Date(Date.now() - 1000).toISOString()});
    const expired = await fetch(base + '/session', {headers: {AuthToken: expiringToken}});
    lifecycleReceipts.push({kind: 'server-confirmed-expired-person', status: expired.status}); assert.equal(expired.status, 410);
    await page.waitForURL(/\/native-start$/);
    assert.equal(await page.locator('app-original-system-check-content,app-verona-player-host iframe').count(), 0);
    assert.equal(await page.evaluate(() => localStorage.getItem('testcenter-native-monitor-session')), null);
    mark('native-system-check-real-expiry-retires-private-player-and-token');

    await login('r101-single'); await page.waitForURL(/\/R101\.SINGLE\/w$/);
    await page.locator('#syscheck-next-step:not([disabled])').waitFor();
    mark('native-system-check-single-claim-login-autostart');
    await page.getByRole('link', {name: 'Gehe zur Startseite'}).click(); await page.waitForURL(/\/native-start$/);
    await page.locator('[data-cy="syscheck-R101.SINGLE"]').waitFor();
    await page.reload(); await page.waitForURL(/\/R101\.SINGLE\/w$/); await page.locator('#syscheck-next-step:not([disabled])').waitFor();
    mark('native-system-check-single-claim-fresh-restoration-shortcut-without-return-loop');
    const anonymous=await runNativeAnonymousSystemChecks({browser,out:join(out,'anonymous'),validator,mark});
    assert.deepEqual(errors, []);
    await writeFile(join(out, 'result.json'), JSON.stringify({success: true, browser: browser.version(), checks, wire, reportBodies,
      reportsPersisted: (await reports()).length, anonymous, lifecycleReceipts, errors, actualSourceFrontendReference: false, visualParityProven: false}, null, 2) + '\n');
  } catch (error) {
    errors.push(String(error));
    if (page) await page.screenshot({path: join(out, 'failure.png')}).catch(() => {});
    await writeFile(join(out, 'result.json'), JSON.stringify({success: false, checks, wire, lifecycleReceipts, errors, visualParityProven: false}, null, 2) + '\n');
    throw error;
  } finally {
    await browser?.close(); if (server) await stopNativeSmokeServer(server); await storage?.shutdown();
  }
}
