import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {access, mkdtemp, mkdir, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {createServerRequestFailureGate} from './server-request-failure-gate.mjs';

// Real browser WebCrypto + Source's five-field native client protocol. This
// qualifies the transport, not production UI adoption or paired-page visuals.
const root = resolve(process.env.UI_SMOKE_FRONTEND_ROOT || '.');
await access(join(root, 'dist/apps/web/browser/index.html'));
const scratch = await mkdtemp(join(tmpdir(), 'owned-native-session-browser-'));
const artifacts = process.env.UI_SMOKE_ARTIFACT_DIR ? resolve(process.env.UI_SMOKE_ARTIFACT_DIR, 'native-session') : join(scratch, 'public');
await mkdir(artifacts, {recursive: true});
const gate = createServerRequestFailureGate(), checks = [], expectedServerFailures = [];
const module = pathToFileURL(resolve('apps/api/dist/apps/api/src/index.js')).href;
const server = spawn(process.execPath, ['--input-type=module', '-e', `
 import {createProductionApiServer} from ${JSON.stringify(module)};
 const server=await createProductionApiServer();
 server.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));
 process.once('SIGTERM',()=>server.close(()=>process.exit(0)));
`], {cwd: root, env: {...process.env, FIRST_SLICE_STORE: 'sqlite', FIRST_SLICE_SQLITE_FILE: join(scratch, 'owned.sqlite'),
  FIRST_SLICE_BOOTSTRAP_DEMO: 'false', FIRST_SLICE_OPERATOR_AUTH_REQUIRED: 'true', REQUIRE_LOGIN_PASSWORD: 'false',
  FIRST_SLICE_XML_SCHEMA_PROFILE: 'original-19', FIRST_SLICE_PROOF_OF_WORK_SCOPES: 'participant,second_code',
  FIRST_SLICE_PROOF_OF_WORK_SECRET: randomBytes(32).toString('hex'), FIRST_SLICE_PROOF_OF_WORK_PREVIOUS_SECRET: '',
  FIRST_SLICE_PROOF_OF_WORK_MAX_NUMBER: '12', FIRST_SLICE_PROOF_OF_WORK_TTL_MS: '60000'}, stdio: ['ignore', 'pipe', 'pipe', 'ipc']});
gate.observeStream(server.stdout); gate.observeStream(server.stderr);
const closed = new Promise(resolve => server.once('close', resolve));
let browser, page, phase = 'initializing';
const setPhase = value => {phase = value; console.log('original_session_browser_phase=' + value);};
const mark = value => {checks.push(value); console.log('original_session_browser=' + value + ':passed');};
try {
  setPhase('owned-api-startup');
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Owned API startup timed out')), 20_000);
    server.once('message', ({port}) => {clearTimeout(timer); resolve(port);});
    server.once('error', error => {clearTimeout(timer); reject(error);});
    server.once('exit', () => {clearTimeout(timer); reject(Error('Owned API exited before startup'));});
  });
  const base = 'http://127.0.0.1:' + port;
  const operatorApi = async (path, body, token, expected = 200) => {
    const response = await fetch(base + path, {method: 'POST', headers: {'content-type': 'application/json', ...(token ? {authorization: 'Bearer ' + token} : {})}, body: JSON.stringify(body)});
    assert.equal(response.status, expected, 'Owned admin fixture request failed'); return response.json();
  };
  setPhase('owned-admin-fixture');
  const operatorPassword = 'Owned-native-browser-admin-2026!';
  await operatorApi('/api/v1/admin/auth/bootstrap', {username: 'owned-native-browser', password: operatorPassword}, undefined, 201);
  const operator = (await operatorApi('/api/v1/admin/auth/sign-in', {username: 'owned-native-browser', password: operatorPassword})).sessionToken;
  const tenantKey = 'owned-native-browser', workspaceKey = 'owned';
  await operatorApi('/api/v1/platform/tenants', {tenantKey, displayName: 'Owned native browser'}, operator, 201);
  await operatorApi('/api/v1/tenants/' + tenantKey + '/workspaces', {workspaceKey, displayName: 'Owned native browser'}, operator, 201);
  const workspace = '/api/v1/tenants/' + tenantKey + '/workspaces/' + workspaceKey;
  const upload = (fileName, sourceDocument, mediaType = 'application/xml') => {
    setPhase('owned-fixture-upload-' + fileName);
    return operatorApi(workspace + '/files', {fileName, sourceDocument, mediaType}, operator, 201);
  };
  const metadata = {id: 'owned-native-browser-player', version: '6.0.4', specVersion: '6.0', metadataVersion: '2.0', type: 'player',
    name: [{lang: 'de', value: 'Owned native browser Player'}], description: [{lang: 'de', value: 'Owned fixture'}]};
  await upload('player.html', '<html><script type="application/ld+json">' + JSON.stringify(metadata) + '</script><main>Owned fixture</main><script>addEventListener("message",event=>{if(event.data?.type==="vopStartCommand")document.querySelector("main").dataset.started="true";});parent.postMessage({type:"vopReadyNotification",metadata:{specVersion:"6.0"}},"*");</script></html>', 'text/html');
  await upload('unit.xml', '<Unit xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/unit-xml/17.6"><Metadata><Id>OWNED.UNIT</Id><Label>Owned unit</Label></Metadata><Definition player="owned-native-browser-player@6.0.4">Owned definition</Definition></Unit>');
  await upload('booklet.xml', '<Booklet xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/testcenter-booklet-xml/18.0"><Metadata><Id>OWNED.BROWSER</Id><Label>Owned native Booklet</Label></Metadata><Units><Unit id="OWNED.UNIT" label="Owned unit"/></Units></Booklet>');
  setPhase('owned-roster-fixture');
  const password = 'Owned-native-browser-private-2026!';
  await operatorApi(workspace + '/participant-roster', {rosterText: '<Testtakers xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/testcenter-testtaker-xml/18.0"><Metadata/><Group id="OWNED.NATIVE.BROWSER" label="Owned native browser">' +
    ['native-browser', 'native-peer'].map(name => `<Login name="${name}" pw="${password}" mode="run-hot-return"><Booklet codes="Shared">OWNED.BROWSER</Booklet></Login>`).join('') + `<Login name="native-monitor" pw="${password}" mode="monitor-group"/></Group></Testtakers>`}, operator, 201);
  setPhase('browser-launch');
  browser = await chromium.launch({channel: process.env.UI_SMOKE_BROWSER_CHANNEL?.trim() || undefined, headless: process.env.CI === 'true' && process.env.UI_SMOKE_HEADFUL !== 'true'});
  page = await browser.newPage({viewport: {width: 1280, height: 720}, locale: 'de-DE'});
  setPhase('owned-document-load');
  await page.goto(base + '/app/participant?ui=original', {waitUntil: 'domcontentloaded'});
  const request = async (method, path, body, token, status = 200) => {
    setPhase('native-http:' + method + ' ' + path);
    const result = await page.evaluate(async ({method, path, body, token}) => {
      const response = await fetch(path, {method, headers: {...(body === undefined ? {} : {'content-type': 'application/json'}), ...(token ? {AuthToken: token} : {})},
        ...(body === undefined ? {} : {body: JSON.stringify(body)})});
      const text = await response.text(); return {status: response.status, cache: response.headers.get('cache-control'), value: text ? JSON.parse(text) : null, empty: text.length === 0, rawText: text, contentType: response.headers.get('content-type')};
    }, {method, path, body, token});
    assert.equal(result.status, status, 'Unexpected native session HTTP status'); assert.equal(result.cache, 'private, no-store'); return result;
  };
  const solve = challenge => {
    setPhase('browser-work-solution');
    return page.evaluate(async challenge => {
      const encoder = new TextEncoder();
      for (let number = 0; number <= challenge.maxNumber; number++) {
        const digest = await crypto.subtle.digest('SHA-256', encoder.encode(challenge.salt + number));
        const hex = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
        if (hex === challenge.challenge) return {algorithm: challenge.algorithm, challenge: challenge.challenge, salt: challenge.salt, signature: challenge.signature, number};
      }
      throw Error('The actual native challenge was not solvable');
    }, challenge);
  };
  await request('PUT', '/session/login', {name: 'native-browser', password}, undefined, 400);
  await request('GET', '/session', undefined, undefined, 401);
  mark('configured-protection-refuses-direct-secrets');
  const loginChallenge = (await request('POST', '/session/challenge', {loginType: 'login', name: 'native-browser', password})).value;
  assert.equal(JSON.stringify(loginChallenge).includes(password), false);
  const loginSolution = await solve(loginChallenge);
  assert.deepEqual(Object.keys(loginSolution).sort(), ['algorithm', 'challenge', 'number', 'salt', 'signature']);
  const login = (await request('PUT', '/session', loginSolution)).value;
  assert.deepEqual(login.flags, ['codeRequired']); assert.deepEqual(login.claims, {}); assert.deepEqual(login.access, {});
  await request('PUT', '/session', loginSolution, undefined, 409);
  mark('browser-webcrypto-solves-source-five-field-login-and-replay-is-refused');
  const invalidCodeChallenge = (await request('POST', '/session/person/challenge', {code: ' Shared'}, login.token)).value;
  await request('PUT', '/session', await solve(invalidCodeChallenge), login.token, 400);
  mark('native-raw-code-is-not-trimmed-by-challenge-processing');
  const challenge = (await request('POST', '/session/person/challenge', {code: 'sHaReD'}, login.token)).value;
  assert.equal(JSON.stringify(challenge).includes('sHaReD'), false);
  const solution = await solve(challenge);
  await request('PUT', '/session', solution, undefined, 401);
  let person = (await request('PUT', '/session', solution, login.token)).value;
  assert.equal(person.displayName, 'Owned native browser/native-browser/sHaReD');
  assert.deepEqual(person.access.test, ['OWNED.BROWSER']); assert.deepEqual(person.claims.test[0].flags, {locked: false, running: false});
  assert.equal(person.claims.test[0].label, 'Owned native Booklet');
  await request('PUT', '/session', solution, login.token, 409);
  await request('POST', '/session/person/challenge', {code: 'Shared'}, person.token, 403);
  mark('native-person-accessset-retains-typed-bearers-current-label-and-unopened-test-flags');
  await request('PUT', '/test', {bookletName: 'owned.browser'}, login.token, 403);
  const createdTest = await request('PUT', '/test', {bookletName: 'owned.browser'}, person.token, 201);
  assert.match(createdTest.rawText, /^[1-9][0-9]*$/); assert.equal(createdTest.contentType, 'text/html; charset=UTF-8');
  assert.equal((await request('PUT', '/test', {bookletName: 'OWNED.BROWSER'}, person.token, 201)).rawText, createdTest.rawText);
  assert.deepEqual((await request('GET', '/session', undefined, person.token)).value.claims.test[0].flags, {locked: false, running: false});
  mark('browser-native-test-put-returns-stable-raw-number-without-opening-the-test');
  const peerWork = (await request('POST', '/session/challenge', {loginType: 'login', name: 'native-peer', password})).value;
  const peer = (await request('PUT', '/session', await solve(peerWork))).value;
  const peerChallenge=(await request('POST','/session/person/challenge',{code:'Shared'},peer.token)).value;
  const peerPerson=(await request('PUT','/session',await solve(peerChallenge),peer.token)).value;
  const peerTest=await request('PUT','/test',{bookletName:'OWNED.BROWSER'},peerPerson.token,201);
  await request('GET','/test/'+peerTest.rawText,undefined,person.token,403);
  const opened=(await request('GET','/test/'+peerTest.rawText,undefined,peerPerson.token)).value;
  assert.deepEqual(Object.keys(opened),['mode','laststate','xml','resources','firstStart','workspaceId','presetBookletStates']);
  assert.equal(opened.firstStart,true);assert.deepEqual(opened.laststate,[]);assert.deepEqual(opened.resources,{'OWNED.UNIT':{usesPlayer:['Resource/player.html']}});
  assert.equal((await request('GET','/test/'+peerTest.rawText,undefined,peerPerson.token)).value.firstStart,false);
  await request('PATCH','/test/'+peerTest.rawText+'/state',[{key:'browserChoice',content:false,timeStamp:9},{key:'browserObject',content:{b:'Ω/x',a:1},timeStamp:1}],peerPerson.token);
  await request('PATCH','/test/'+peerTest.rawText+'/state',[{key:'browserChoice',content:'later packet',timeStamp:1}],peerPerson.token);
  const state=(await request('GET','/test/'+peerTest.rawText,undefined,peerPerson.token)).value.laststate;
  assert.deepEqual(state,{browserChoice:'later packet',browserObject:'{"b":"\\u03a9\\/x","a":1}'});
  mark('browser-native-test-read-opens-once-and-preserves-source-typed-packet-state');
  setPhase('browser-native-group-resource');
  const resource=await page.evaluate(async({token,workspaceId})=>{
    const response=await fetch('/file/'+token+'/ws_'+workspaceId+'/Resource/player.html');
    return{status:response.status,cache:response.headers.get('cache-control'),type:response.headers.get('content-type'),source:response.headers.get('x-source'),text:await response.text()};
  },{token:peerPerson.groupToken,workspaceId:opened.workspaceId});
  assert.equal(resource.status,200);assert.equal(resource.cache,'private');assert.equal(resource.type,'text/html;charset=UTF-8');assert.equal(resource.source,'backend');assert.ok(resource.text.includes('<main>Owned fixture</main>'));
  mark('browser-native-group-resource-preserves-current-player-headers-and-bytes');
  const unitPath='/test/'+peerTest.rawText+'/unit/OWNED.BROWSER.ALIAS',unitRead='/test/'+peerTest.rawText+'/unit/OWNED.UNIT/alias/OWNED.BROWSER.ALIAS';
  const emptyUnit=(await request('GET',unitRead,undefined,peerPerson.token)).value;
  assert.deepEqual(Object.keys(emptyUnit),['state','dataParts','unitResponseType','definition','definitionType']);assert.deepEqual(emptyUnit.state,{});assert.deepEqual(emptyUnit.dataParts,{});assert.equal(emptyUnit.definition,'Owned definition');assert.equal(emptyUnit.definitionType,'owned-native-browser-player-6.0');
  await request('PUT',unitPath+'/response',{timeStamp:5,dataParts:{a:'not initialized'}},peerPerson.token,404);
  await request('PATCH',unitPath+'/state',{originalUnitId:'FIRST.BROWSER.ID',newState:[{key:'choice',content:'newest',timeStamp:9}]},peerPerson.token);
  await request('PATCH',unitPath+'/state',[{key:'choice',content:'stale across packets',timeStamp:1}],peerPerson.token);
  await request('PUT',unitPath+'/response',{timeStamp:5,dataParts:{a:'Exact browser Ω/x'},responseType:'owned/browser'},peerPerson.token,201);
  await request('PUT',unitPath+'/response',{timeStamp:5,dataParts:{a:'equal rejected',b:'new default type'}},peerPerson.token,201);
  const unit=(await request('GET',unitRead,undefined,peerPerson.token)).value;assert.deepEqual(unit.state,{choice:'newest'});assert.deepEqual(unit.dataParts,{a:'Exact browser Ω/x',b:'new default type'});assert.equal(unit.unitResponseType,'unknown');
  await request('PUT',unitPath+'/log',{logEntries:[{key:'browserNativeUnit',content:{owned:true},timeStamp:0}]},peerPerson.token,201);
  mark('browser-native-unit-restores-five-fields-with-persistent-state-clocks-and-independent-response-parts');
  setPhase('browser-native-test-log');
  const beforeLogState=(await request('GET','/test/'+peerTest.rawText,undefined,peerPerson.token)).value;
  const nativeLog=await request('PUT','/test/'+peerTest.rawText+'/log',[{key:'browserNativeTestlog',content:{b:'Ω/x',a:1},timeStamp:0},{key:'browserDefaultContent',content:null,timeStamp:1}],peerPerson.token,201);
  assert.equal(nativeLog.empty,true);assert.equal(nativeLog.contentType,'text/html; charset=UTF-8');
  await request('PUT','/test/000'+peerTest.rawText+'/log',[],peerPerson.token,201);
  const deniedLog=await page.evaluate(async({id,token})=>{const response=await fetch('/test/'+id+'/log',{method:'PUT',headers:{AuthToken:token,'content-type':'application/json'},body:'[{\"key\":\"foreign\",\"timeStamp\":0}]'});return{status:response.status,text:await response.text()};},{id:peerTest.rawText,token:person.token});
  assert.equal(deniedLog.status,403);assert.equal(deniedLog.text.includes(person.token),false);
  const afterLogState=(await request('GET','/test/'+peerTest.rawText,undefined,peerPerson.token)).value;
  assert.deepEqual(afterLogState,beforeLogState);assert.deepEqual((await request('GET',unitRead,undefined,peerPerson.token)).value,unit);
  mark('browser-native-test-log-appends-without-changing-test-or-unit-state');
  const repeat = await solve((await request('POST', '/session/person/challenge', {code: 'SHARED'}, login.token)).value);
  await request('PUT', '/session', repeat, peer.token, 400);
  const former = person.token; person = (await request('PUT', '/session', repeat, login.token)).value;
  assert.ok(person.displayName.endsWith('/SHARED')); await request('GET', '/session', undefined, former, 401);
  mark('cross-login-work-cannot-burn-owner-ticket-and-reentry-rotates-only-the-person');
  setPhase('document-reload');
  await page.reload({waitUntil: 'domcontentloaded'});
  const reread = (await request('GET', '/session', undefined, person.token)).value;
  assert.ok(reread.displayName.endsWith('/sHaReD')); assert.deepEqual(reread.access.test, ['OWNED.BROWSER']);
  assert.equal((await request('DELETE', '/session', undefined, login.token, 205)).empty, true);
  assert.equal((await request('GET', '/session', undefined, login.token)).value.token, login.token);
  assert.equal((await request('DELETE', '/session', undefined, person.token, 205)).empty, true);
  await request('GET', '/session', undefined, person.token, 401);
  mark('reload-preserves-first-person-spelling-and-empty-205-logout-keeps-login-capability');
  setPhase('actual-ui-entry-for-native-created-test');
  await page.goto(base + '/app/participant?ui=original&tenantKey=' + tenantKey + '&workspaceKey=' + workspaceKey, {waitUntil: 'domcontentloaded'});
  await page.locator('#originalLoginName').fill('native-browser');
  await page.getByRole('button', {name: 'Weiter', exact: true}).click();
  setPhase('actual-ui-password');
  await page.locator('#originalLoginPassword').fill(password);
  await page.getByRole('button', {name: 'Anmelden', exact: true}).click();
  setPhase('actual-ui-second-code');
  await page.locator('#participantCode').fill('Shared');
  const authenticated = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/participant/auth/sign-in' && response.ok());
  await page.locator('#participantRouteSignInButton').click();
  const identity = await (await authenticated).json();
  setPhase('actual-ui-single-booklet-auto-entry');
  await page.frameLocator('iframe').locator('main[data-started="true"]').waitFor();
  setPhase('actual-ui-native-created-controller-readback');
  const currentResponse = await fetch(base + '/api/v1/participant/sessions/' + identity.participantSession.participantSessionId + '/current-state', {headers: {authorization: 'Bearer ' + identity.sessionToken}});
  assert.equal(currentResponse.status, 200);
  const current = (await currentResponse.json()).currentRunState.testRun;
  assert.equal(current.status, 'running'); assert.equal(current.currentUnitKey, 'OWNED.UNIT'); assert.equal(current.controllerEntry.active, true);
  assert.equal(current.originalResultState.bookletName, 'owned.browser'); assert.ok(current.originalResultState.lastOpenedAt);
  assert.equal((await request('PUT', '/test', {bookletName: 'OWNED.BROWSER'}, identity.sessionToken, 201)).rawText, createdTest.rawText);
  assert.equal((await request('GET', '/session', undefined, identity.sessionToken)).value.claims.test[0].flags.running, true);
  mark('actual-protected-original-ui-enters-the-same-native-created-test-and-starts-its-controller');
  setPhase('browser-native-test-lock');
  const foreignLock=await page.evaluate(async({id,token})=>{const response=await fetch('/test/'+id+'/lock',{method:'PATCH',headers:{AuthToken:token,'content-type':'application/json'},body:'{'});return{status:response.status,text:await response.text()};},{id:peerTest.rawText,token:identity.sessionToken});
  assert.equal(foreignLock.status,403);assert.equal(foreignLock.text.includes(identity.sessionToken),false);
  const nativeLock=await request('PATCH','/test/000'+peerTest.rawText+'/lock',{timeStamp:0,message:'browserNativeLock Ω'},peerPerson.token);
  assert.equal(nativeLock.empty,true);assert.equal(nativeLock.contentType,'text/html; charset=UTF-8');
  await request('GET','/test/'+peerTest.rawText,undefined,peerPerson.token,423);
  await request('PUT','/test',{bookletName:'OWNED.BROWSER'},peerPerson.token,423);
  assert.deepEqual((await request('GET',unitRead,undefined,peerPerson.token)).value,unit);
  const flags=(await request('GET','/session',undefined,peerPerson.token)).value.claims.test[0].flags;assert.equal(flags.locked,true);assert.equal(flags.running,true);
  const failedLockTest=await request('PUT','/test',{bookletName:'OWNED.BROWSER#lock:constructor-failure'},peerPerson.token,201);
  const partial=await page.evaluate(async({id,token})=>{const response=await fetch('/test/'+id+'/lock',{method:'PATCH',headers:{AuthToken:token,'content-type':'application/json'},body:'{"timeStamp":"invalid integer","message":"strict native clock"}'});return{status:response.status,text:await response.text(),type:response.headers.get('content-type'),requestId:response.headers.get('x-request-id')};},{id:failedLockTest.rawText,token:peerPerson.token});
  assert.equal(partial.status,500);assert.equal(partial.text,'Internal error.');assert.equal(partial.type,'text/html;charset=UTF-8');
  assert.match(partial.requestId,/^[0-9a-f-]{36}$/i);expectedServerFailures.push({requestId:partial.requestId,method:'PATCH',route:'PATCH /test/:testId/lock',path:'/test/:testId/lock',statusCode:500});
  await request('GET','/test/'+failedLockTest.rawText,undefined,peerPerson.token,423);
  await page.frameLocator('iframe').locator('main[data-started="true"]').waitFor();
  mark('browser-native-test-lock-preserves-unit-data-and-keeps-source-proven-lock-after-constructor-error');
  setPhase('browser-native-monitor-person');
  await request('PUT','/session/login',{name:'native-monitor',password},undefined,400);
  const monitorWork=(await request('POST','/session/challenge',{loginType:'login',name:'native-monitor',password})).value;
  const monitor=(await request('PUT','/session',await solve(monitorWork))).value;
  assert.deepEqual(monitor.flags,[]);assert.equal(monitor.id,null);assert.equal(monitor.pwSetByAdmin,null);
  assert.deepEqual(monitor.claims.testGroupMonitor,[{id:'OWNED.NATIVE.BROWSER',type:'testGroupMonitor',label:'Owned native browser',flags:[]}]);
  assert.deepEqual(monitor.access,{test:['OWNED.BROWSER'],testGroupMonitor:['OWNED.NATIVE.BROWSER']});
  assert.deepEqual(monitor.claims.test[0].flags,{locked:false,running:false});
  const monitorTest=await request('PUT','/test',{bookletName:'OWNED.BROWSER'},monitor.token,201);
  assert.notEqual(monitorTest.rawText,createdTest.rawText);
  const monitorOpened=(await request('GET','/test/'+monitorTest.rawText,undefined,monitor.token)).value;
  assert.equal(monitorOpened.mode,'monitor-group');assert.equal(monitorOpened.firstStart,true);
  await request('GET','/test/'+monitorTest.rawText,undefined,identity.sessionToken,403);
  await request('POST','/session/person/challenge',{code:'Shared'},monitor.token,403);
  const originalMonitorToken=monitor.token,monitorAgain=(await request('PUT','/session',await solve((await request('POST','/session/challenge',{loginType:'login',name:'native-monitor',password})).value))).value;
  assert.notEqual(monitorAgain.token,originalMonitorToken);assert.equal(monitorAgain.groupToken,monitor.groupToken);
  await request('GET','/session',undefined,originalMonitorToken,401);
  assert.equal((await request('PUT','/test',{bookletName:'OWNED.BROWSER'},monitorAgain.token,201)).rawText,monitorTest.rawText);
  await page.frameLocator('iframe').locator('main[data-started="true"]').waitFor();
  mark('browser-native-monitor-has-dual-claims-honest-own-test-mode-and-isolated-bearer');
  setPhase('browser-native-command-producer-and-shared-delivery');
  const commandRequest=async(method,path,body,token,status=200)=>{
    setPhase('native-command-http:'+method+' '+path);
    const result=await page.evaluate(async({method,path,body,token})=>{
      const response=await fetch(path,{method,headers:{...(token?{AuthToken:token}:{}),...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)})});
      const text=await response.text();let value=null;try{value=text?JSON.parse(text):null;}catch{value=text;}
      return{status:response.status,reason:response.statusText,text,value,contentType:response.headers.get('content-type'),cache:response.headers.get('cache-control')};
    },{method,path,body,token});console.log('native_command_http_status='+result.status+'; expected='+status);assert.equal(result.status,status,'Native browser command HTTP status');assert.equal(result.cache,'private, no-store');return result;
  };
  await commandRequest('PUT','/monitor/command','{',identity.sessionToken,403);
  await commandRequest('GET','/test/'+peerTest.rawText+'/commands',undefined,identity.sessionToken,403);
  const issued=1793158810,targets=[Number(createdTest.rawText),Number(peerTest.rawText),Number(createdTest.rawText)];
  const delivered=await commandRequest('PUT','/monitor/command',{keyword:'owned.browser.command',arguments:['Ω/x',0,false,true,null,42,1.5],timestamp:issued,testIds:targets},monitorAgain.token,201);assert.equal(delivered.text,'');
  const commands=(await commandRequest('GET','/test/'+createdTest.rawText+'/commands',undefined,identity.sessionToken)).value;
  const peerCommands=(await commandRequest('GET','/test/'+peerTest.rawText+'/commands',undefined,peerPerson.token)).value;
  assert.equal(commands.length,1);assert.deepEqual(peerCommands,commands);assert.deepEqual(commands[0].arguments,['Ω/x','0','','1','','42','1.5']);assert.equal(commands[0].timestamp,issued);assert.deepEqual(Object.keys(commands[0]),['id','keyword','arguments','timestamp']);
  assert.deepEqual((await commandRequest('GET','/test/'+createdTest.rawText+'/commands?lastCommandId='+commands[0].id,undefined,identity.sessionToken)).value,commands);
  mark('browser-native-command-producer-keeps-shared-id-typed-arguments-clock-and-locked-recipient');
  setPhase('browser-native-command-acknowledgement');
  const commandId=commands[0].id,commandPath='/test/'+createdTest.rawText+'/command/'+commandId+'/executed';
  const ack=await commandRequest('PATCH',commandPath,'{',identity.sessionToken),repeated=await commandRequest('PATCH',commandPath,undefined,identity.sessionToken);
  assert.equal(ack.text,'');assert.equal(ack.reason,'OK');assert.equal(repeated.text,'');assert.equal(repeated.reason,'OK, was already marked as executed');
  assert.deepEqual((await commandRequest('GET','/test/'+createdTest.rawText+'/commands',undefined,identity.sessionToken)).value,[]);
  assert.deepEqual((await commandRequest('GET','/test/'+peerTest.rawText+'/commands',undefined,peerPerson.token)).value,commands);
  await commandRequest('PATCH','/test/'+createdTest.rawText+'/command/'+commandId+'/executed',undefined,peerPerson.token,403);
  await commandRequest('PATCH','/test/'+peerTest.rawText+'/command/'+commandId+'/executed',undefined,peerPerson.token);
  const untouchedResponse=await fetch(base+'/api/v1/participant/sessions/'+identity.participantSession.participantSessionId+'/current-state',{headers:{authorization:'Bearer '+identity.sessionToken}});assert.equal(untouchedResponse.status,200);
  const untouched=(await untouchedResponse.json()).currentRunState.testRun;
  assert.equal(untouched.status,current.status);assert.equal(untouched.currentUnitKey,current.currentUnitKey);assert.deepEqual(untouched.unitResponses,current.unitResponses);assert.deepEqual(untouched.controllerEntry,current.controllerEntry);assert.deepEqual(untouched.testletTimers,current.testletTimers);
  await page.frameLocator('iframe').locator('main[data-started="true"]').waitFor();
  mark('browser-native-command-ack-is-scoped-idempotent-and-preserves-controller-with-exact-source-reason');



} catch (error) {
  await page?.screenshot({path: join(artifacts, 'failure.png'), fullPage: true}).catch(() => {});
  // Retain a useful bounded failure location without serializing Playwright's
  // exception, which can contain evaluated arguments, credentials or HTML.
  const errorName = error instanceof assert.AssertionError ? 'AssertionError' : error instanceof TypeError ? 'TypeError' : 'Error';
  const failureKind = phase === 'browser-launch' && /Missing X server|without having a XServer|DISPLAY environment variable/.test(String(error.message))
    ? 'headed-browser-display-unavailable' : 'unclassified';
  const failure = {errorName, phase, failureKind, checks};
  await writeFile(join(artifacts, 'failure.json'), JSON.stringify(failure, null, 2));
  process.exitCode = 1; console.error('original_session_browser=failed; category=' + errorName + '; phase=' + phase + '; kind=' + failureKind);
} finally {
  await page?.close(); await browser?.close(); server.kill('SIGTERM');
  await closed; gate.assertHealthy(expectedServerFailures);
  console.log('unexpected_server_failures=0; exact_expected_source_failures='+expectedServerFailures.length);
  await writeFile(join(artifacts, 'native-session-protocol.json'), JSON.stringify({checks, expectedServerFailures}, null, 2));
  console.log('owned_api=shutdown');
}
