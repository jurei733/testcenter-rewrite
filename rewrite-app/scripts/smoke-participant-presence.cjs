const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { access, mkdtemp } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { resolve, join } = require('node:path');
const { pathToFileURL } = require('node:url');
const { DatabaseSync } = require('node:sqlite');
const { setTimeout: delay } = require('node:timers/promises');
const { chromium } = require('playwright');
const REPOSITORY = resolve(__dirname, '..');
const TARGET_FRONTEND_ROOT = resolve(process.env.UI_SMOKE_FRONTEND_ROOT || '.');

(async () => {
  await access(join(TARGET_FRONTEND_ROOT, 'dist/apps/web/browser/index.html'));
  const artifacts = await mkdtemp(join(tmpdir(), 'testcenter-participant-presence-browser-'));
  console.log(`owned_artifacts=${artifacts}`);
  const sqlitePath = join(artifacts, 'store.sqlite');
  const moduleUrl = pathToFileURL(join(REPOSITORY, 'apps/api/dist/apps/api/src/index.js')).href;
  const server = spawn(process.execPath, ['--input-type=module', '-e', `
    import { createProductionApiServer } from ${JSON.stringify(moduleUrl)};
    const server = await createProductionApiServer();
    server.listen(0, '127.0.0.1', () => process.send({port:server.address().port}));
    process.once('SIGTERM', () => server.close(() => process.exit(0)));
  `], { cwd: TARGET_FRONTEND_ROOT, stdio: ['ignore', 'ignore', 'inherit', 'ipc'], env: {
    ...process.env, FIRST_SLICE_STORE: 'sqlite', FIRST_SLICE_SQLITE_FILE: sqlitePath,
    FIRST_SLICE_BOOTSTRAP_DEMO: 'true', FIRST_SLICE_OPERATOR_AUTH_REQUIRED: 'true',
    FIRST_SLICE_PROOF_OF_WORK_SCOPES: '', FIRST_SLICE_XML_SCHEMA_PROFILE: 'legacy-compatibility'
  }});
  let browser, baseUrl, adminToken, database, participantPage;
  const api = async (path, body, token = adminToken, expected = 200) => {
    const response = await fetch(baseUrl + path, {method: body === undefined ? 'GET' : 'POST',
      headers: {...(body === undefined ? {} : {'content-type':'application/json'}),
        ...(token ? {authorization:`Bearer ${token}`} : {})},
      ...(body === undefined ? {} : {body:JSON.stringify(body)})});
    assert.equal(response.status, expected, `${path}: HTTP ${response.status}`);
    return response.json();
  };
  const wait = async (condition, detail, timeout = 12_000) => {
    const end = Date.now() + timeout;
    while (!await condition()) { assert.ok(Date.now() < end, detail); await delay(100); }
  };
  const monitorPath = '/api/v1/tenants/demo-tenant/workspaces/demo-workspace/monitor/open-runs';
  const mode = async id => (await api(monitorPath)).items.find(item => item.testRunId === id)?.testState.CONNECTION;
  const state = id => database.prepare('SELECT unit_responses_json,status FROM test_runs WHERE test_run_id=?').get(id);
  const ackResponse = (page, sid) => page.waitForResponse(response =>
    response.url().includes(`/sessions/${sid || ''}`) && response.url().endsWith('/events/acknowledgements') && response.ok(), {timeout:15_000});
  const errors = [];
  try {
    const port = await new Promise((done,reject) => {
      const timeout = setTimeout(() => reject(Error('Owned API startup timeout')), 20_000);
      server.once('message', message => {clearTimeout(timeout);done(message.port)});
      server.once('error', error => {clearTimeout(timeout);reject(error)});
      server.once('exit', () => {clearTimeout(timeout);reject(Error('Owned API exited'))});
    });
    baseUrl = `http://127.0.0.1:${port}`;
    adminToken = (await api('/api/v1/admin/auth/sign-in', {username:'demo-admin',password:'demo-admin-password'}, null)).sessionToken;
    const cases = [['rewrite',1280,720],['original',1280,720],['rewrite',390,844],['original',390,844]];
    const password = 'owned-presence-password';
    await api('/api/v1/tenants/demo-tenant/workspaces/demo-workspace/participant-roster', {
      rosterText: 'loginKey,groupKey,bookletKey,displayName,pw\n' + cases.map(([ui,width]) =>
        `presence-${ui}-${width},presence,booklet:demo,Presence ${ui} ${width},${password}`).join('\n')
    }, adminToken, 201);
    database = new DatabaseSync(sqlitePath, {readOnly:true}); database.exec('PRAGMA busy_timeout=5000');
    const headful = ['1','true'].includes(process.env.UI_SMOKE_HEADFUL);
    browser = await chromium.launch({headless:process.env.CI === 'true' && !headful});
    const monitorContext = await browser.newContext({viewport:{width:1280,height:720}});
    const monitor = await monitorContext.newPage(); monitor.on('pageerror', error => errors.push(String(error)));
    await monitor.goto(baseUrl + '/app/ops?ui=rewrite', {waitUntil:'domcontentloaded'});
    await monitor.locator('#adminUsername').fill('demo-admin');
    await monitor.locator('#adminPassword').fill('demo-admin-password');
    await monitor.locator('#adminSignInButton').click();
    await monitor.locator('#adminSignOutButton').waitFor();
    await monitor.goto(baseUrl + '/app/runtime', {waitUntil:'domcontentloaded'});
    await monitor.locator('#runtimeOpenRunsButton').click();
    let last;
    for (const [ui,width,height] of cases) {
      const login = `presence-${ui}-${width}`;
      const context = await browser.newContext({viewport:{width,height}});
      const page = await context.newPage(); participantPage=page; page.on('pageerror', error => errors.push(String(error)));
      page.on('response', response => {if(response.url().endsWith('/participant/auth/sign-in'))console.log(`browser_sign_in=${ui}/${width}:HTTP${response.status()}`)});
      await page.goto(`${baseUrl}/app/participant?ui=${ui}&tenantKey=demo-tenant&workspaceKey=demo-workspace&groupKey=presence&bookletKey=booklet%3Ademo`, {waitUntil:'domcontentloaded'});
      const signInPath = ui === 'original' ? '/participant/auth/sign-in' : '/participant/starter:launch';
      const signedIn = page.waitForResponse(response => response.url().endsWith(signInPath) && response.ok()).then(response=>({response}),error=>({error}));
      const received = ackResponse(page).then(response=>({response}),error=>({error}));
      if (ui === 'original') {
        await page.getByLabel('Anmeldename',{exact:true}).fill(login);
        await page.getByRole('button',{name:'Weiter',exact:true}).click();
        await page.getByLabel('Kennwort',{exact:true}).fill(password);
        await page.getByRole('button',{name:'Anmelden',exact:true}).click();
      } else {
        await page.locator('#participantLoginKey').fill(login);
        await page.locator('#participantPassword').fill(password);
        await page.locator('#participantRouteStartOrResumeButton').click();
      }
      const signInResult = await signedIn; if(signInResult.error)throw signInResult.error;
      assert.equal(signInResult.response.ok(),true);
      const identity = await signInResult.response.json();
      const ackResult = await received; if(ackResult.error)throw ackResult.error;
      const acknowledged = ackResult.response;
      const acknowledgement = acknowledged.request().postDataJSON();
      assert.equal(acknowledged.request().headers().authorization, `Bearer ${identity.sessionToken}`);
      const sid = identity.participantSession.participantSessionId;
      const runId = acknowledgement.testRunId;
      await wait(async () => await mode(runId) === 'WEBSOCKET', 'Actual browser frame was not acknowledged');
      const current = await api(`/api/v1/participant/sessions/${sid}/current-state`, undefined, identity.sessionToken);
      const unit = current.currentRunState.testRun.currentUnitKey;
      await api(`/api/v1/participant/test-runs/${runId}/save-progress`, {
        currentUnitKey:unit,responseUnitKey:unit,status:'running',unitResponse:'owned protected saved answer'
      }, identity.sessionToken);
      const preserved = state(runId);
      const second = await context.newPage(); participantPage=second;
      second.on('pageerror', error => errors.push(String(error)));
      const secondAck = ackResponse(second,sid).then(response=>({response}),error=>({error}));
      await second.goto(`${baseUrl}/app/participant?ui=${ui}&participantSessionId=${sid}`, {waitUntil:'domcontentloaded'});
      const secondResult = await secondAck; if(secondResult.error)throw secondResult.error;
      await page.close();
      await wait(async () => await mode(runId) === 'WEBSOCKET', 'Closing one tab must preserve another acknowledged tab');
      await second.close();
      await wait(async () => await mode(runId) === 'LOST', 'Last tab closure must record connection loss');
      const row = monitor.locator('#openMonitorRunsCollection .record-card').filter({hasText:login});
      await row.waitFor();
      await wait(async () => await row.getAttribute('data-presentation-state') === 'connection_lost', 'Live monitor must render actual connection loss');
      await row.screenshot({path:join(artifacts,`${ui}-${width}-lost.png`)});
      await api(`/api/v1/participant/sessions/${sid}/events/acknowledgements`, acknowledgement, identity.sessionToken,409);
      await api(`/api/v1/participant/sessions/${sid}/current-state`, undefined,identity.sessionToken);
      assert.equal(await mode(runId),'POLLING');
      const exported = await fetch(`${baseUrl}/api/v1/tenants/demo-tenant/workspaces/demo-workspace/exports/logs.csv?testRunId=${runId}&logKey=CONNECTION`, {
        headers: {authorization:`Bearer ${adminToken}`}
      });
      assert.equal(exported.status,200);
      const csv = await exported.text();
      assert.ok(csv.includes('"0";"""CONNECTION"" : LOST"'));
      assert.ok(csv.includes('"0";"""CONNECTION"" : POLLING"'));
      await wait(async () => await row.getAttribute('data-presentation-state') !== 'connection_lost', 'Polling restoration must update the visible monitor');
      const again = await context.newPage(); participantPage=again;
      again.on('pageerror', error => errors.push(String(error)));
      const freshAck = ackResponse(again,sid).then(response=>({response}),error=>({error}));
      await again.goto(`${baseUrl}/app/participant?ui=${ui}&participantSessionId=${sid}`, {waitUntil:'domcontentloaded'});
      const freshResult = await freshAck; if(freshResult.error)throw freshResult.error;
      assert.equal(await mode(runId),'WEBSOCKET');
      assert.deepEqual(state(runId),preserved,'Connection changes must leave saved responses and status intact');
      await context.close();
      last = {sid,runId,token:identity.sessionToken};
      console.log(`presence_browser=${ui}/${width}: live, two tabs, real close, visible loss, polling, reconnect, answers intact`);
    }
    // Keep an actual SSE socket open but never acknowledge subsequent heartbeats.
    // Server writes cannot renew the client lease; the real 60-second deadline is exercised.
    const controller = new AbortController();
    const response = await fetch(`${baseUrl}/api/v1/participant/sessions/${last.sid}/events`, {
      headers:{authorization:`Bearer ${last.token}`,accept:'text/event-stream'},signal:controller.signal
    });
    assert.equal(response.status,200);
    const reader = response.body.getReader(); let buffer=''; let frame;
    while (!frame) {
      const chunk=await reader.read(); assert.equal(chunk.done,false);
      buffer+=new TextDecoder().decode(chunk.value);
      const match=buffer.match(/data: (.+)\n/); if(match)frame=JSON.parse(match[1]);
    }
    await api(`/api/v1/participant/sessions/${last.sid}/events/acknowledgements`,
      {testRunId:last.runId,connectionId:frame.connectionId},last.token);
    const confirmedAt=Date.now();
    await delay(55_000); assert.equal(await mode(last.runId),'WEBSOCKET');
    await wait(async()=>await mode(last.runId)==='LOST','Unacknowledged live TCP stream must expire',11_000);
    const elapsed=Date.now()-confirmedAt;
    assert.ok(elapsed>=59_000&&elapsed<66_000,`Actual lease expired after ${elapsed}ms`);
    controller.abort(); await reader.cancel().catch(()=>{});
    console.log(`presence_silent_socket=${elapsed}ms: real server expiry despite an open SSE socket`);
    assert.deepEqual(errors,[]);
    await monitorContext.close();
  } catch(error) {
    if(participantPage&&!participantPage.isClosed()) {
      await participantPage.screenshot({path:join(artifacts,'failure.png'),fullPage:true}).catch(()=>{});
      console.log('visible_failure='+await participantPage.locator('.status-banner.is-error').allTextContents().catch(()=>[]));
    }
    throw error;
  } finally {
    database?.close(); await browser?.close();
    if(server.exitCode===null) {
      server.kill('SIGTERM'); const timeout=setTimeout(()=>server.kill('SIGKILL'),5_000);
      await new Promise(done=>server.once('exit',done));clearTimeout(timeout);
    }
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
