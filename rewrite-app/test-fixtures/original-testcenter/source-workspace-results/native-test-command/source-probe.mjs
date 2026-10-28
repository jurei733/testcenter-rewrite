import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';

const base = process.env.SOURCE_ORACLE_URL;
assert.ok(/^http:\/\/127\.0\.0\.1:\d+$/.test(base ?? ''), 'Require the owned loopback Apache endpoint');
const directory = process.env.SOURCE_ORACLE_ARTIFACT_DIR || 'source-oracle-public';
const sourceCommit = 'eedae41840cbe90e5547c0211da818bdf620f5aa';
const secrets = new Map();
const privateValue = (value, kind) => {
  if (typeof value === 'string' && value && !secrets.has(value)) secrets.set(value, `[redacted-owned-${kind}-${secrets.size + 1}]`);
};
const register = value => {
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    if (/^(?:token|groupToken|salt|challenge|signature)$/i.test(key)) privateValue(item, key);
    else register(item);
  }
};
const redact = value => {
  if (typeof value === 'string') {
    for (const [secret, alias] of [...secrets].sort((a, b) => b[0].length - a[0].length)) value = value.replaceAll(secret, alias);
    return value;
  }
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redact(item)]));
  return value;
};
const receipt = {sourceCommit, transport: 'unchanged production Apache HTTP; actual ALTCHA; no SQL seeds', testMode: false, checks: [], sourceFiles: {}};
const responses = [];
const check = (name, fields = {}) => {
  receipt.checks.push({name, ...fields});
  console.log(`source_native_group_deletion=${name}:passed`);
};
const request = async (method, path, {token, body, status = 200, accept = 'application/json'} = {}) => {
  const response = await fetch(base + path, {method, headers: {accept,
    ...(token ? {AuthToken: token} : {}), ...(body !== undefined && !(body instanceof FormData) ? {'content-type': 'application/json'} : {})},
    ...(body === undefined ? {} : {body: body instanceof FormData ? body : JSON.stringify(body)}), signal: AbortSignal.timeout(20000)});
  const bytes = Buffer.from(await response.arrayBuffer());
  let value = null;
  if (bytes.length) { try { value = JSON.parse(bytes.toString('utf8')); } catch { value = bytes.toString('utf8'); } }
  register(value);
  responses.push({method, path, status: response.status, wireSha256: createHash('sha256').update(bytes).digest('hex'), contentType: response.headers.get('content-type'), value});
  assert.ok((Array.isArray(status) ? status : [status]).includes(response.status), `${method} ${path}: unexpected HTTP ${response.status}`);
  return {status: response.status, value, bytes, contentType: response.headers.get('content-type'), sourceHeader: response.headers.get('x-source'), cacheControl: response.headers.get('cache-control')};
};
const solve = challenge => {
  assert.ok(challenge && challenge.algorithm === 'SHA-256', 'ALTCHA uses the actual SHA-256 algorithm');
  for (const key of ['salt', 'challenge', 'signature']) assert.ok(typeof challenge[key] === 'string' && challenge[key], `ALTCHA ${key} is present`);
  const supplied = challenge.maxnumber ?? challenge.maxNumber ?? 1_000_000;
  assert.ok(Number.isSafeInteger(supplied) && supplied >= 0 && supplied <= 10_000_000, 'Bound the real fixture puzzle search');
  for (let number = 0; number <= supplied; number++) {
    if (createHash('sha256').update(challenge.salt + number).digest('hex') === challenge.challenge) {
      return {algorithm: challenge.algorithm, salt: challenge.salt, challenge: challenge.challenge, signature: challenge.signature, number};
    }
  }
  throw Error('The actual ALTCHA challenge has no solution inside its declared/default bound');
};
const challengeMetadata = challenge => {
  const separator = challenge.salt.indexOf('?');
  const params = new URLSearchParams(separator < 0 ? '' : challenge.salt.slice(separator + 1));
  return {keys: Object.keys(challenge).sort(), algorithm: challenge.algorithm, maxnumber: challenge.maxnumber ?? challenge.maxNumber ?? null,
    saltParameterNames: [...params.keys()].sort(), hasExpiryParameter: params.has('expires') || params.has('expire') || params.has('expiration')};
};

try {
  for (const path of ['backend/routes.php', 'backend/src/controller/SessionController.class.php', 'backend/src/dao/SessionDAO.class.php',
    'backend/src/middleware/RequireToken.class.php', 'backend/src/helper/SystemConfig.class.php', 'backend/src/helper/Token.class.php',
    'backend/src/data-collection/AccessSet.class.php', 'backend/src/dao/AdminDAO.class.php', 'backend/src/dao/TestDAO.class.php', 'backend/src/controller/WorkspaceController.class.php', 'backend/composer.lock', 'scripts/database/full.sql', 'backend/src/helper/CSV.class.php', 'backend/src/helper/ReviewCSVFormatter.php', 'backend/src/helper/TimeStamp.class.php', 'backend/src/workspace/Report.php', 'backend/src/workspace/ResponseReportOutput.php', 'backend/src/workspace/LogReportOutput.php', 'backend/src/workspace/ReviewReportOutput.php', 'backend/src/data-collection/ReportFormat.php', 'backend/src/files/XMLFileBooklet.class.php', 'backend/src/controller/TestController.class.php', 'backend/src/data-collection/TestName.class.php', 'backend/src/middleware/IsTestOwner.class.php', 'backend/src/helper/RequestHelper.class.php', 'backend/src/helper/State.class.php', 'backend/src/workspace/Workspace.class.php', 'backend/src/dao/WorkspaceDAO.class.php', 'backend/src/helper/FileResponse.class.php', 'backend/src/helper/FileExt.class.php', 'backend/src/helper/Folder.class.php', 'backend/src/files/XMLFileUnit.class.php', 'backend/src/helper/FileID.class.php', 'backend/src/data-collection/UnitLog.php', 'backend/src/data-collection/TestLog.class.php', 'backend/src/helper/JSON.class.php']) {
    receipt.sourceFiles[path] = createHash('sha256').update(await readFile(join('original-reference', path))).digest('hex');
  }
  const deadline = Date.now() + 90000;
  while (true) {
    try { receipt.version = (await request('GET', '/version')).value; assert.ok(receipt.version.version); break; }
    catch (error) { if (Date.now() > deadline) throw error; await new Promise(done => setTimeout(done, 1000)); }
  }
  const config = (await request('GET', '/system/config')).value;
  assert.ok(Array.isArray(config.bruteForceProtection), 'Read protection from the actual production API');
  assert.deepEqual([...config.bruteForceProtection].sort(), ['login', 'person']);
  receipt.protectedScopes = config.bruteForceProtection;
  check('actual production Apache requires both native Login and person challenges');

  const adminPassword = 'owned-source-super-secret', password = 'owned-native-pow-secret';
  privateValue(adminPassword, 'password'); privateValue(password, 'password');
  const admin = (await request('PUT', '/session/admin', {body: {name: 'super', password: adminPassword}})).value;
  const workspace = Number((await request('PUT', '/workspace', {token: admin.token, body: {name: 'Owned native proof of work'}, status: 201})).value);
  await request('PATCH', `/user/${admin.id}/workspaces`, {token: admin.token, body: {ws: [{id: workspace, role: 'RW'}]}});
  const xml = (type, repo, version, body) => `<${type} xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/${repo}/${version}">${body}</${type}>`;
  const upload = async (name, text, type = 'application/xml') => {
    const form = new FormData(); form.append('fileforvo[]', new Blob([text], {type}), name);
    return request('POST', `/workspace/${workspace}/file`, {token: admin.token, body: form, status: 201});
  };
  const metadata = {$schema: 'https://raw.githubusercontent.com/verona-interfaces/metadata/master/verona-module-metadata.json', id: 'owned-pow-player', version: '6.0.4', specVersion: '6.0', metadataVersion: '2.0', type: 'player',
    name: [{lang: 'de', value: 'Owned proof player'}], description: [{lang: 'de', value: 'Owned production HTTP fixture'}]};
  await upload('player.html', '<!doctype html><html><script type="application/ld+json">' + JSON.stringify(metadata) + '</script><main>Owned fixture</main></html>', 'text/html');
  await upload('unit.xml', xml('Unit', 'unit-xml', '17.6', '<Metadata><Id>ORACLE.POW.UNIT</Id><Label>Owned unit</Label></Metadata><Definition player="owned-pow-player@6.0.4">Owned definition</Definition>'));
  await upload('booklet.xml', xml('Booklet', 'testcenter-booklet-xml', '18.0', '<Metadata><Id>ORACLE.POW.BOOK</Id><Label>Owned proof booklet</Label></Metadata><Units><Unit id="ORACLE.POW.UNIT" label="Owned unit"/></Units>'));
  const name = 'owned-native-pow', peer = 'owned-native-pow-peer';
  await upload('people.xml', xml('Testtakers', 'testcenter-testtaker-xml', '18.0', '<Metadata/><Group id="ORACLE.POW" label="Owned proof group">' +
    [name, peer].map(login => `<Login name="${login}" pw="${password}" mode="run-hot-return"><Booklet codes="Shared">ORACLE.POW.BOOK</Booklet></Login>`).join('') + '</Group>'));
  check('owned XSD-validated fixture enters only through protected admin HTTP');

  const blocked = await request('PUT', '/session/login', {body: {name, password}, status: 400});
  assert.ok(typeof blocked.value === 'string' && blocked.value.includes('Brute Force protection active'), 'Direct secret login is refused by the configured protection');
  check('configured Login protection refuses direct password authentication');

  const firstChallenge = (await request('POST', '/session/challenge', {body: {loginType: 'login', name, password}})).value;
  const firstSolution = solve(firstChallenge);
  check('actual native Login challenge is solved without replacing the production verifier', {challenge: challengeMetadata(firstChallenge)});
  const wrongSignature = {...firstSolution, signature: '0'.repeat(firstSolution.signature.length)};
  await request('PUT', '/session', {body: wrongSignature, status: 400});
  await request('PUT', '/session', {body: {...firstSolution, number: firstSolution.number + 1}, status: 400});
  check('invalid signature and wrong work cannot authenticate through the native solution route');
  const login = (await request('PUT', '/session', {body: firstSolution})).value;
  assert.deepEqual(login.flags, ['codeRequired']); assert.deepEqual(login.claims, {}); assert.deepEqual(login.access, {});
  assert.equal(login.loginName, name);
  check('a valid Login solution returns the coded Login AccessSet rather than a person');
  const firstReplay = await request('PUT', '/session', {body: firstSolution, status: [200, 400, 401, 403, 409, 410, 429]});
  check('Login-solution replay behavior is measured without assuming one-use semantics', {status: firstReplay.status,
    sameLoginToken: firstReplay.status === 200 ? firstReplay.value.token === login.token : null});

  await request('POST', '/session/person/challenge', {body: {code: 'Shared'}, status: 401});
  await request('POST', '/session/person/challenge', {token: admin.token, body: {code: 'Shared'}, status: 403});
  check('native person challenges require a Login bearer before issuing work');
  const codeBlocked = await request('PUT', '/session/person', {token: login.token, body: {code: 'Shared'}, status: 400});
  assert.ok(typeof codeBlocked.value === 'string' && codeBlocked.value.includes('Brute Force protection active'), 'Direct secret person entry is refused');
  const readable = (await request('GET', '/session', {token: login.token})).value;
  assert.deepEqual(readable.claims, {});
  check('configured person protection refuses direct code entry while Login metadata remains readable');

  const personChallenge = (await request('POST', '/session/person/challenge', {token: login.token, body: {code: 'sHaReD'}})).value;
  const personSolution = solve(personChallenge);
  check('actual native person challenge retains its observed signed parameter shape', {challenge: challengeMetadata(personChallenge)});
  await request('PUT', '/session', {body: personSolution, status: 401});
  await request('PUT', '/session', {token: admin.token, body: personSolution, status: 403});
  await request('PUT', '/session', {token: login.token, body: {...personSolution, number: personSolution.number + 1}, status: 400});
  check('a person solution still requires the correct Login bearer and valid work');
  const person = (await request('PUT', '/session', {token: login.token, body: personSolution})).value;
  assert.equal(person.loginName, name); assert.ok(person.displayName.endsWith('/sHaReD'));
  assert.deepEqual(person.access.test, ['ORACLE.POW.BOOK']);
  assert.equal(person.claims.test[0].flags.running, false); assert.equal(person.claims.test[0].flags.locked, false);
  check('a valid person solution returns exact raw code display and assigned Test claims without opening a Test');

  const personReplay = await request('PUT', '/session', {token: login.token, body: personSolution, status: [200, 400, 401, 403, 409, 410, 429]});
  check('person-solution replay and bearer rotation are observed separately', {status: personReplay.status,
    rotatedPersonToken: personReplay.status === 200 ? personReplay.value.token !== person.token : null});
  const peerChallenge = (await request('POST', '/session/challenge', {body: {loginType: 'login', name: peer, password}})).value;
  const peerLogin = (await request('PUT', '/session', {body: solve(peerChallenge)})).value;
  const crossLogin = await request('PUT', '/session', {token: peerLogin.token, body: personSolution, status: [200, 400, 401, 403, 409, 410, 429]});
  if (crossLogin.status === 200) assert.equal(crossLogin.value.loginName, peer);
  check('person-solution binding to a different authorized Login is measured explicitly', {status: crossLogin.status,
    peerIdentity: crossLogin.status === 200 ? crossLogin.value.loginName : null});

  const modifiedSalt = personSolution.salt + '&ownedChange=1'; privateValue(modifiedSalt, 'salt');
  await request('PUT', '/session', {token: login.token, body: {...personSolution, salt: modifiedSalt}, status: 400});
  check('a signed person challenge cannot be used with modified salt parameters');
  const retainedLogin = (await request('GET', '/session', {token: login.token})).value;
  assert.equal(retainedLogin.token, login.token); assert.deepEqual(retainedLogin.claims, {});
  await request('DELETE', '/session', {token: login.token, status: 205});
  assert.equal((await request('GET', '/session', {token: login.token})).value.token, login.token);
  check('proof-based person entry and Login logout preserve the original first-factor capability');

  // All lifecycle data is owned, XSD-validated and created by production HTTP.
  const fixture = groups => xml('Testtakers', 'testcenter-testtaker-xml', '18.0', '<Metadata/>' + groups.map(([id, label, names]) =>
    `<Group id="${id}" label="${label}">` + names.map(login => `<Login name="${login}" pw="${password}" mode="run-review"><Booklet codes="Shared">ORACLE.POW.BOOK</Booklet></Login>`).join('') + '</Group>').join(''));
  const initial = [['ORACLE.DELETE.MAIN', 'First deletion label', ['owned-delete-main', 'owned-delete-peer']],
    ['ORACLE.DELETE.KEEP', 'Retained label', ['owned-delete-keep']], ['ORACLE.DELETE.FORMER', 'Former label', ['owned-delete-moved']]];
  await upload('delete-people.xml', fixture(initial));
  const authenticate = async loginName => {
    const challenge = (await request('POST', '/session/challenge', {body: {loginType: 'login', name: loginName, password}})).value;
    const login = (await request('PUT', '/session', {body: solve(challenge)})).value;
    const personChallenge = (await request('POST', '/session/person/challenge', {token: login.token, body: {code: 'Shared'}})).value;
    const person = (await request('PUT', '/session', {token: login.token, body: solve(personChallenge)})).value;
    return {login, person};
  };
  const seed = async loginName => {
    const session = await authenticate(loginName), token = session.person.token;
    const id = Number((await request('PUT', '/test', {token, body: {bookletName: 'ORACLE.POW.BOOK'}, status: 201})).value);
    assert.ok(Number.isSafeInteger(id) && id > 0);
    await request('GET', `/test/${id}`, {token});
    await request('PATCH', `/test/${id}/unit/ORACLE.POW.UNIT/state`, {token, body: {newState: [{key: 'PRESENTATION_PROGRESS', content: 'some', timeStamp: 1792929600000}], originalUnitId: 'ORACLE.POW.UNIT'}});
    await request('PUT', `/test/${id}/unit/ORACLE.POW.UNIT/response`, {token, body: {timeStamp: 1792929600000, dataParts: {owned: JSON.stringify({owned: loginName})}, responseType: 'owned'}, status: 201});
    await request('PUT', `/test/${id}/unit/ORACLE.POW.UNIT/review`, {token, body: {priority: 2, categories: 'owned', entry: 'Owned cascade review ' + loginName, reviewer: 'Owned reviewer', originalUnitId: 'ORACLE.POW.UNIT'}, status: 201});
    await request('PUT', `/test/${id}/log`, {token, body: [{key: 'OWNED', content: loginName, timeStamp: 1792929600000}], status: 201});
    return {...session, id};
  };
  const main = await seed('owned-delete-main'), mainPeer = await seed('owned-delete-peer'), kept = await seed('owned-delete-keep'), moved = await seed('owned-delete-moved');
  const resultRows = async () => (await request('GET', `/workspace/${workspace}/results`, {token: admin.token})).value;
  assert.equal((await resultRows()).find(row => row.groupName === 'ORACLE.DELETE.MAIN').bookletsStarted, 2);
  check('native groups contain actual opened Tests, Unit state, answers, reviews and logs before deletion');
  // Rebinding a Login through the current authored definition changes its parent.
  const updated = [initial[0], initial[1], ['ORACLE.DELETE.FORMER', 'Former label', ['owned-delete-empty-former']],
    ['ORACLE.DELETE.NEXT', 'Moved label', ['owned-delete-moved']]];
  await upload('delete-people.xml', fixture(updated));
  const movedChallenge = (await request('POST', '/session/challenge', {body: {loginType: 'login', name: 'owned-delete-moved', password}})).value;
  const rebound = (await request('PUT', '/session', {body: solve(movedChallenge)})).value;
  assert.equal(rebound.token, moved.login.token);
  assert.ok((await resultRows()).some(row => row.groupName === 'ORACLE.DELETE.NEXT'));
  await request('DELETE', `/workspace/${workspace}/responses`, {token: admin.token, body: {groups: ['ORACLE.DELETE.FORMER']}});
  assert.equal((await request('GET', '/session', {token: moved.person.token})).value.loginName, 'owned-delete-moved');
  await request('GET', `/test/${moved.id}`, {token: moved.person.token});
  check('deleting an obsolete group snapshot preserves the Login, person and Test already rebound elsewhere');

  const roPassword = 'Owned-delete-reader-secret'; privateValue(roPassword, 'password');
  const readerId = Number((await request('PUT', '/user', {token: admin.token, body: {n: 'owned-delete-reader', p: roPassword}, status: 201})).value);
  assert.ok(Number.isSafeInteger(readerId) && readerId > 0);
  await request('PATCH', `/user/${readerId}/workspaces`, {token: admin.token, body: {ws: [{id: workspace, role: 'RO'}]}});
  const reader = (await request('PUT', '/session/admin', {body: {name: 'owned-delete-reader', password: roPassword}})).value;
  const beforeDenied = await resultRows();
  await request('DELETE', `/workspace/${workspace}/responses`, {token: reader.token, body: {groups: ['ORACLE.DELETE.MAIN']}, status: 403});
  await request('DELETE', `/workspace/${workspace}/responses`, {body: {groups: ['ORACLE.DELETE.MAIN']}, status: 401});
  await request('DELETE', `/workspace/${workspace}/responses`, {token: main.person.token, body: {groups: ['ORACLE.DELETE.MAIN']}, status: 403});
  await request('DELETE', `/workspace/${workspace}/responses`, {token: admin.token, body: {groups: ['ORACLE.DELETE.UNKNOWN']}});
  assert.deepEqual(await resultRows(), beforeDenied);
  check('read-only, anonymous and participant deletion is denied; an unknown group is a successful no-op');
  const filesBefore = (await request('GET', `/workspace/${workspace}/files`, {token: admin.token})).value;
  const removed = await request('DELETE', `/workspace/${workspace}/responses`, {token: admin.token, body: {groups: ['oracle.delete.main']}});
  assert.equal(removed.value, null);
  assert.ok(!(await resultRows()).some(row => row.groupName === 'ORACLE.DELETE.MAIN'));
  for (const session of [main, mainPeer]) {
    await request('GET', '/session', {token: session.login.token, status: 403});
    await request('GET', '/session', {token: session.person.token, status: 403});
    await request('GET', `/test/${session.id}`, {token: session.person.token, status: 403});
  }
  for (const session of [kept, moved]) {
    await request('GET', '/session', {token: session.login.token});
    await request('GET', '/session', {token: session.person.token});
    await request('GET', `/test/${session.id}`, {token: session.person.token});
    const reviews = (await request('GET', `/test/${session.id}/unit/ORACLE.POW.UNIT/reviews`, {token: session.person.token})).value;
    assert.ok(Array.isArray(reviews) && reviews.length > 0);
  }
  assert.deepEqual((await request('GET', `/workspace/${workspace}/files`, {token: admin.token})).value, filesBefore);
  check('case-equivalent whole-group deletion returns an empty HTTP200 and revokes every selected Login and person while preserving other groups and authored files');
  await upload('delete-people.xml', fixture(updated.map(([id,label,names]) => [id,id === 'ORACLE.DELETE.MAIN' ? 'Recreated deletion label' : label,names])));
  const recreated = await authenticate('owned-delete-main');
  assert.notEqual(recreated.login.token, main.login.token);
  assert.notEqual(recreated.person.token, main.person.token);
  assert.ok(typeof main.person.groupToken === 'string' && typeof recreated.person.groupToken === 'string');
  assert.notEqual(recreated.person.groupToken, main.person.groupToken);
  assert.ok(recreated.person.claims.test.every(claim => claim.flags.running === false));
  await request('GET', `/test/${main.id}`, {token: recreated.person.token, status: [403, 404]});
  for (const token of [main.login.token, main.person.token, mainPeer.login.token, mainPeer.person.token]) await request('GET', '/session', {token, status: 403});
  check('new native authentication recreates fresh Login, group and person capabilities without reviving deleted Tests or old bearers');

  // New native Unit/report controls run after all 21 existing auth/cascade
  // groups. Everything is owned, genuinely authenticated production HTTP.
  const partToken=recreated.person.token;
  const partTest=Number((await request('PUT','/test',{token:partToken,body:{bookletName:'ORACLE.POW.BOOK'},status:201})).value);
  assert.ok(Number.isSafeInteger(partTest)&&partTest>0);
  await request('GET',`/test/${partTest}`,{token:partToken});
  const alias='OWNED.UNIT.ALIAS', unitPath=`/test/${partTest}/unit/${alias}`, clock=1792929600000;
  const reportPath=(type,newVersion=false)=>`/workspace/${workspace}/report/${type}?dataIds=ORACLE.DELETE.MAIN${newVersion?'&useNewVersion=true':''}`;
  await request('PUT',unitPath+'/response',{token:partToken,body:{timeStamp:clock+10,dataParts:{'part-a':'not yet'},responseType:'first/Ω'},status:404});
  assert.equal((await request('GET',reportPath('response'),{token:admin.token})).bytes.length,0);
  await request('PATCH',unitPath+'/state',{token:partToken,body:{originalUnitId:'FIRST.PERSISTED.ID',newState:[
    {key:'PRESENTATION_PROGRESS',content:'some',timeStamp:clock+10},
    {key:'RESPONSE_PROGRESS',content:'none',timeStamp:clock+20},
    {key:'CUSTOM_Ω',content:'  Exact Ä/β\n";  ',timeStamp:clock+30}
  ]}});
  const initialized=(await request('GET',reportPath('response'),{token:admin.token})).value;
  assert.equal(initialized.length,1);assert.equal(initialized[0].unitname,alias);
  assert.equal(initialized[0].originalUnitId,'FIRST.PERSISTED.ID');assert.deepEqual(initialized[0].responses,[]);
  assert.equal(initialized[0].code,'Shared');
  check('native response requires an initialized Unit; state creates an owned alias independently of Booklet membership and records its first original ID and person suffix');

  const answer='  Exact part Ω/β\n"; \\ kept  ';
  await request('PUT',unitPath+'/response',{token:partToken,body:{timeStamp:clock+10,
    dataParts:{'part-a':answer,'part-z':'old z'},responseType:'first/Ω'},status:201});
  await request('PUT',unitPath+'/response',{token:partToken,body:{timeStamp:clock+20,
    dataParts:{'part-z':'new z'},responseType:'second/β'},status:201});
  await request('PUT',unitPath+'/response',{token:partToken,body:{timeStamp:clock+10,
    dataParts:{'part-a':'equal-clock overwrite rejected','part-z':'stale overwrite rejected','part-c':'new c'},responseType:'third/γ'},status:201});
  await request('PUT',unitPath+'/response',{token:partToken,body:{timeStamp:clock+40,
    dataParts:{'part-default':'default type'}},status:201});
  const typed=(await request('GET',reportPath('response'),{token:admin.token})).value;
  assert.deepEqual(typed[0].responses,[
    {id:'part-a',content:answer,ts:clock+10,responseType:'first/Ω'},
    {id:'part-c',content:'new c',ts:clock+10,responseType:'third/γ'},
    {id:'part-default',content:'default type',ts:clock+40,responseType:'unknown'},
    {id:'part-z',content:'new z',ts:clock+20,responseType:'second/β'}
  ]);
  check('response parts retain independent client clocks and response types across partial writes, equal/stale rejection and the omitted-type default',{parts:typed[0].responses});

  await request('PATCH',unitPath+'/state',{token:partToken,body:{originalUnitId:'SECOND.IGNORED.ID',newState:[
    {key:'PRESENTATION_PROGRESS',content:'complete',timeStamp:clock+11},
    {key:'RESPONSE_PROGRESS',content:'stale response state',timeStamp:clock+19},
    {key:'CUSTOM_Ω',content:'stale custom state',timeStamp:clock+29}
  ]}});
  const retained=(await request('GET',reportPath('response'),{token:admin.token})).value;
  assert.equal(retained[0].originalUnitId,'FIRST.PERSISTED.ID');assert.equal(retained[0].code,'Shared');
  assert.deepEqual(retained[0].responses,typed[0].responses);
  assert.deepEqual(JSON.parse(retained[0].laststate),{PRESENTATION_PROGRESS:'complete',RESPONSE_PROGRESS:'none','CUSTOM_Ω':'  Exact Ä/β\n";  '});
  check('Unit field clocks and response clocks stay independent while the original Unit ID remains the first stored value',{laststate:retained[0].laststate,originalUnitId:retained[0].originalUnitId});

  for(const categories of ['10 02','2  1','9223372036854775809','9223372036854775808','9223372036854775807']) {
    await request('PUT',unitPath+'/review',{token:partToken,body:{priority:2,categories,
      entry:'Owned report review Ω\n"; '+categories,reviewer:'Owned report reviewer',userAgent:'Owned report Oracle',
      page:2,pagelabel:'Owned page',originalUnitId:'THIRD.IGNORED.ID'},status:201});
  }
  const beforeLabels=(await request('GET',reportPath('review',true),{token:admin.token})).value;
  assert.equal(beforeLabels.length,5);assert.ok(beforeLabels.every(row=>row.unitlabel===''));
  const firstReview=beforeLabels.find(row=>row.entry==='Owned report review Ω\n"; 10 02');
  const secondReview=beforeLabels.find(row=>row.entry==='Owned report review Ω\n"; 2  1');
  assert.ok(firstReview&&secondReview);
  assert.equal(firstReview.category_02,true);assert.equal(firstReview.category_10,true);
  assert.equal(secondReview.category_02,false);assert.equal(secondReview.category_,true);
  const categoryNames=Object.keys(firstReview).filter(key=>key.startsWith('category_'));
  assert.equal(categoryNames.filter(key=>key.startsWith('category_922337203685477580')).length,3);
  assert.ok(categoryNames.indexOf('category_9223372036854775807')<categoryNames.indexOf('category_9223372036854775808'));
  assert.ok(categoryNames.indexOf('category_9223372036854775808')<categoryNames.indexOf('category_9223372036854775809'));
  check('real PHP review categories retain numeric first spelling, strict selected membership, empty tokens and distinct overflowing integer strings',{categoryNames});

  const currentBookletLabel='  Current Booklet Ω\n  ', currentUnitLabel='  Alias current Ω  ';
  await upload('booklet.xml',xml('Booklet','testcenter-booklet-xml','18.0',
    `<Metadata><Id>ORACLE.POW.BOOK</Id><Label>${currentBookletLabel}</Label></Metadata><Units><Unit id="ORACLE.POW.UNIT" alias="${alias}" label="${currentUnitLabel}"/></Units>`));
  const relabelled=(await request('GET',reportPath('review',true),{token:admin.token})).value;
  assert.ok(relabelled.every(row=>row.unitlabel===currentUnitLabel&&row.bookletlabel===currentBookletLabel&&row.originalUnitId==='FIRST.PERSISTED.ID'));
  check('enhanced report labels resolve the current physical Booklet alias and raw XML labels without rewriting stored Unit identity',{bookletlabel:currentBookletLabel,unitlabel:currentUnitLabel});

  const reportBodies=[];
  await mkdir(directory,{recursive:true});
  for(const [name,type,newVersion]of [['responses','response',false],['logs','log',false],['reviews-legacy','review',false],['reviews-enhanced','review',true]]) {
    for(const [extension,accept]of [['json','application/json'],['csv','text/csv']]) {
      const result=await request('GET',reportPath(type,newVersion),{token:admin.token,accept});
      assert.ok(result.bytes.length>0);const text=result.bytes.toString('utf8');
      for(const secret of secrets.keys())assert.ok(!text.includes(secret),'Raw public reports must omit every registered private value');
      const file=`unit-parts-${name}.${extension}`;await writeFile(join(directory,file),result.bytes);
      reportBodies.push({file,bytes:result.bytes.length,sha256:createHash('sha256').update(result.bytes).digest('hex'),contentType:result.contentType});
      const empty=await request('GET',`/workspace/${workspace}/report/${type}?dataIds=ORACLE.UNKNOWN${newVersion?'&useNewVersion=true':''}`,{token:admin.token,accept});
      assert.equal(empty.bytes.length,0);
    }
  }
  check('all four native report variants retain original JSON and CSV bytes; unknown groups return zero bytes in both formats',{reports:reportBodies});
  const readOnlyReport=await request('GET',reportPath('response'),{token:reader.token});
  assert.deepEqual(readOnlyReport.value,(await request('GET',reportPath('response'),{token:admin.token})).value);
  await request('GET',reportPath('response'),{status:401});
  await request('GET',reportPath('response'),{token:partToken,status:403});
  check('native result downloads permit the owned read-only administrator and reject anonymous or participant capabilities');

  // Native creation is separate from entry. Every Source28 control remains above.
  const unassigned='ORACLE.UNASSIGNED.BOOK',firstLabel='  Unassigned first Ω\n  ',nextLabel='Replacement unassigned Ω';
  const unassignedBooklet=label=>xml('Booklet','testcenter-booklet-xml','18.0',`<Metadata><Id>${unassigned}</Id><Label>${label}</Label></Metadata><Units><Unit id="ORACLE.POW.UNIT" label="Owned unassigned Unit"/></Units>`);
  await upload('unassigned-booklet.xml',unassignedBooklet(firstLabel));
  const beforeUnopened=await resultRows(),claimsBefore=(await request('GET','/session',{token:partToken})).value;
  assert.ok(!claimsBefore.claims.test.some(item=>item.id===unassigned));
  await request('PUT','/test',{body:{bookletName:unassigned},status:401});
  const loginDenied=await request('PUT','/test',{token:recreated.login.token,body:{bookletName:unassigned},status:403});
  const adminDenied=await request('PUT','/test',{token:admin.token,body:{bookletName:unassigned},status:403});
  const rawTest=await request('PUT','/test',{token:partToken,body:{bookletName:unassigned},status:201}),unassignedId=Number(rawTest.value);
  assert.ok(Number.isSafeInteger(unassignedId)&&unassignedId>0);assert.match(rawTest.bytes.toString('utf8'),/^[1-9][0-9]*$/);
  assert.deepEqual(await resultRows(),beforeUnopened);
  assert.ok(!(await request('GET','/session',{token:partToken})).value.claims.test.some(item=>item.id===unassigned));
  check('native Test PUT accepts a real workspace Booklet outside current assignments, returns raw decimal201 and leaves it unopened',{testId:unassignedId,bookletName:unassigned,body:rawTest.bytes.toString('utf8'),contentType:rawTest.contentType,loginDenied:loginDenied.status,adminDenied:adminDenied.status});

  for(const bookletName of [unassigned,unassigned.toLowerCase(),' \t'+unassigned+' \n']) assert.equal(Number((await request('PUT','/test',{token:partToken,body:{bookletName},status:201})).value),unassignedId);
  const presetInput=unassigned+'#b:second;a:first;b:last',presetCanonical=unassigned+'#b:last;a:first';
  const presetId=Number((await request('PUT','/test',{token:partToken,body:{bookletName:presetInput},status:201})).value);
  assert.ok(Number.isSafeInteger(presetId)&&presetId>unassignedId);
  assert.equal(Number((await request('PUT','/test',{token:partToken,body:{bookletName:presetCanonical},status:201})).value),presetId);
  assert.deepEqual(await resultRows(),beforeUnopened);
  check('native Test PUT reuses case-equivalent and whitespace-normalized names while canonicalizing duplicate preset keys in first-key order',{testId:unassignedId,presetId,presetInput,presetCanonical});

  await upload('unassigned-booklet.xml',unassignedBooklet(nextLabel));
  await request('PATCH',`/test/${unassignedId}/lock`,{token:partToken,body:{timeStamp:clock+50,message:'Owned never-opened Test lock'}});
  const locked=await request('PUT','/test',{token:partToken,body:{bookletName:unassigned},status:423});
  assert.ok(typeof locked.value==='string'&&locked.value.includes(firstLabel)&&!locked.value.includes(nextLabel));
  await request('GET',`/test/${unassignedId}`,{token:partToken,status:423});
  check('native Test PUT retains the first raw physical Booklet label and rejects a locked unopened Test before opening',{testId:unassignedId,firstLabel,replacementLabel:nextLabel,status:locked.status});

  await request('GET',`/test/${presetId}`,{token:kept.person.token,status:403});
  const firstOpen=(await request('GET',`/test/${presetId}`,{token:partToken})).value;
  assert.equal(firstOpen.firstStart,true);assert.equal(firstOpen.mode,'run-review');assert.deepEqual(firstOpen.laststate,[]);assert.equal(firstOpen.workspaceId,workspace);
  assert.deepEqual(firstOpen.presetBookletStates,{b:'last',a:'first'});assert.ok(typeof firstOpen.xml==='string'&&firstOpen.xml.includes(nextLabel));
  const again=(await request('GET',`/test/${presetId}`,{token:partToken})).value;assert.equal(again.firstStart,false);
  check('native numeric Test GET enforces person ownership and opens an unassigned Test only once with current XML and canonical preset state',{testId:presetId,firstStart:firstOpen.firstStart,secondStart:again.firstStart,mode:firstOpen.mode,laststate:firstOpen.laststate,presetBookletStates:firstOpen.presetBookletStates,xmlSha256:createHash('sha256').update(firstOpen.xml).digest('hex')});

  const gone='ORACLE.GONE.BOOK';
  await upload('gone-booklet.xml',xml('Booklet','testcenter-booklet-xml','18.0',`<Metadata><Id>${gone}</Id><Label>Owned removed physical Booklet</Label></Metadata><Units><Unit id="ORACLE.POW.UNIT" label="Owned removed Booklet Unit"/></Units>`));
  const goneId=Number((await request('PUT','/test',{token:partToken,body:{bookletName:gone},status:201})).value);
  const deletion=(await request('DELETE',`/workspace/${workspace}/files`,{token:admin.token,body:{f:['Booklet/gone-booklet.xml']},status:207})).value;
  assert.ok(deletion.deleted.includes('Booklet/gone-booklet.xml'));
  assert.equal(Number((await request('PUT','/test',{token:partToken,body:{bookletName:gone.toLowerCase()},status:201})).value),goneId);
  await request('PUT','/test',{token:partToken,body:{bookletName:' '+gone+' '},status:404});
  await request('PUT','/test',{token:kept.person.token,body:{bookletName:gone},status:404});
  await request('GET',`/test/${goneId}`,{token:partToken,status:404});
  check('native Test PUT resolves an already owned raw name before physical-file lookup but a normalization miss and new person require the current file',{testId:goneId,removedBooklet:gone,retainedStatus:201,whitespaceStatus:404,newPersonStatus:404});


  {
  const currentNative=(await request('GET',`/test/${presetId}`,{token:partToken})).value;
  assert.deepEqual(currentNative.resources,{'ORACLE.POW.UNIT':{usesPlayer:['Resource/player.html']}});
  assert.equal(currentNative.workspaceId,workspace);assert.equal(currentNative.firstStart,false);
  const access=(await request('GET','/session',{token:partToken})).value;
  const filePath=`/file/${access.groupToken}/ws_${workspace}/Resource/player.html`;
  const resourceReply=await request('GET',filePath);
  const exactPlayer='<!doctype html><html><script type="application/ld+json">'+JSON.stringify(metadata)+'</script><main>Owned fixture</main></html>';
  assert.deepEqual(resourceReply.bytes,Buffer.from(exactPlayer));assert.equal(resourceReply.sourceHeader,'backend');assert.equal(resourceReply.cacheControl,'private');
  check('native Test GET resolves physical Unit resource relationships and group files preserve exact bytes and private cache headers',{
    resources:currentNative.resources,workspaceId:currentNative.workspaceId,resourceBytes:resourceReply.bytes.length,resourceSha256:createHash('sha256').update(resourceReply.bytes).digest('hex'),contentType:resourceReply.contentType,sourceHeader:resourceReply.sourceHeader,cacheControl:resourceReply.cacheControl});

  await request('GET',`/file/${partToken}/ws_${workspace}/Resource/player.html`,{status:403});
  await request('GET',`/file/${access.groupToken}/ws_${workspace+1}/Resource/player.html`,{status:403});
  await request('GET',`/file/${access.groupToken}/ws_${workspace}/Unit/unit.xml`,{status:403});
  await request('GET',`/file/${access.groupToken}/ws_${workspace}/Resource/%2e%2e%2fTesttakers/people.xml`,{status:404});
  await request('GET','/test/0',{token:partToken,status:400});
  await request('GET','/test/9223372036854775807',{token:partToken,status:403});
  check('native resource and Test reads enforce group-kind workspace containment and ownership before returning missing-test details',{
    personAsGroup:403,foreignWorkspace:403,nonResource:403,traversal:404,nonpositiveTest:400,unknownPositiveTest:403});

  const statePath=`/test/${presetId}/state`;
  await request('PATCH',statePath,{token:partToken,body:[{key:'ownedZero',content:'ignored',timeStamp:0}]});
  assert.deepEqual((await request('GET',`/test/${presetId}`,{token:partToken})).value.laststate,[]);
  // Actual Unicode is supplied through JSON, with the PHP-encoded object string
  // checked independently of normal JSON transport escaping.
  const realArray=[1,'\u03a9/x',{inner:'nested/\u03a9'}];
  const objectValue={b:'\u03a9/x',a:1};
  await request('PATCH',statePath,{token:partToken,body:[
    {key:'ownedChoice',content:'first',timeStamp:5},{key:'ownedChoice',content:'newest in batch',timeStamp:9},{key:'ownedChoice',content:'late older in batch',timeStamp:5},
    {key:'ownedZero',content:'ignored',timeStamp:0},{key:'ownedNumber',content:42,timeStamp:1},{key:'ownedFalse',content:false,timeStamp:1},{key:'ownedEmpty',content:'',timeStamp:1},
    {key:'ownedArray',content:realArray,timeStamp:1},{key:'ownedObject',content:objectValue,timeStamp:1}]});
  const typed=(await request('GET',`/test/${presetId}`,{token:partToken})).value.laststate;
  assert.equal(typed.ownedChoice,'newest in batch');assert.equal(typed.ownedZero,undefined);assert.equal(typed.ownedNumber,42);assert.equal(typed.ownedFalse,false);assert.equal(typed.ownedEmpty,'');
  assert.deepEqual(typed.ownedArray,realArray);assert.equal(typed.ownedObject,'{"b":"\\u03a9\\/x","a":1}');
  const rejected=await request('PATCH',statePath,{token:partToken,body:[{key:'ownedNull',content:null,timeStamp:1}],status:400});
  assert.deepEqual((await request('GET',`/test/${presetId}`,{token:partToken})).value.laststate,typed);
  check('native Test state preserves scalar and array types but PHP-encodes object content; null required content is rejected without mutation',{
    state:typed,nullStatus:rejected.status,mode:currentNative.mode,zeroOnlyState:[]});

  await request('PATCH',statePath,{token:partToken,body:[{key:'ownedChoice',content:'older positive in later batch',timeStamp:1}]});
  assert.equal((await request('GET',`/test/${presetId}`,{token:partToken})).value.laststate.ownedChoice,'older positive in later batch');
  await request('PATCH',statePath,{token:partToken,body:[{key:'ownedChoice',content:'first equal in next batch',timeStamp:1},{key:'ownedChoice',content:'second equal ignored',timeStamp:1},{key:'ownedChoice',content:'zero ignored',timeStamp:0}]});
  const finalState=(await request('GET',`/test/${presetId}`,{token:partToken})).value.laststate;
  assert.equal(finalState.ownedChoice,'first equal in next batch');assert.deepEqual(finalState.ownedArray,realArray);assert.equal(finalState.ownedObject,typed.ownedObject);
  check('native Test state clocks reset across batches while equal and zero entries keep within-batch first-writer semantics',{
    firstBatch:'newest in batch',laterLowerClock:'older positive in later batch',equalBatch:finalState.ownedChoice,finalState});

  }


  {
  const nativeUnitTest=Number((await request('PUT','/test',{token:partToken,body:{bookletName:unassigned+'#unit:transport'},status:201})).value);
  const physical='ORACLE.POW.UNIT',unitAlias='OWNED.FREE.ALIAS',writePath=`/test/${nativeUnitTest}/unit/${unitAlias}`,readPath=`/test/${nativeUnitTest}/unit/${physical}/alias/${unitAlias}`;
  const initialResults=await resultRows();
  const empty=await request('GET',readPath,{token:partToken});
  assert.deepEqual(Object.keys(empty.value),['state','dataParts','unitResponseType','definition','definitionType']);
  assert.deepEqual(empty.value.state,{});assert.deepEqual(empty.value.dataParts,{});assert.equal(empty.value.unitResponseType,'');assert.equal(empty.value.definition,'Owned definition');assert.equal(typeof empty.value.definitionType,'string');
  assert.deepEqual(await resultRows(),initialResults);
  await request('GET',readPath,{token:kept.person.token,status:403});await request('GET',readPath,{token:recreated.login.token,status:403});
  await request('GET',`/test/${nativeUnitTest}/unit/OWNED.MISSING/alias/${unitAlias}`,{token:partToken,status:404});
  assert.equal((await request('GET',`/test/${nativeUnitTest}`,{token:partToken})).value.firstStart,true);
  check('native Unit GET returns five fields from the current physical Unit without creating a saved Unit or opening its Test',{empty:empty.value,contentType:empty.contentType,foreignDenied:403,loginDenied:403,missingPhysical:404});

  await request('PUT',writePath+'/response',{token:partToken,body:{timeStamp:9,dataParts:{a:'before state'}},status:404});
  await request('PATCH',writePath+'/state',{token:partToken,body:{originalUnitId:'FIRST.NATIVE.ID',newState:[{key:'choice',content:'newer',timeStamp:9},{key:'zero',content:'ignored',timeStamp:0}]}});
  await request('PATCH',writePath+'/state',{token:partToken,body:[{key:'choice',content:'stale across packets',timeStamp:1},{key:'second',content:'legacy array',timeStamp:2}]});
  await request('PATCH',writePath+'/state',{token:partToken,body:{originalUnitId:'IGNORED.ID',newState:[{key:'choice',content:'equal rejected',timeStamp:9},{key:'choice',content:'newest',timeStamp:10},{key:'choice',content:'second equal rejected',timeStamp:10}]}});
  const persistent=(await request('GET',readPath,{token:partToken})).value;
  assert.deepEqual(persistent.state,{choice:'newest',second:'legacy array'});assert.deepEqual(persistent.dataParts,{});
  check('native Unit state retains clocks across both body formats and keeps the first stored physical identity',{state:persistent.state,firstOriginalUnitId:'FIRST.NATIVE.ID',bodyFormats:['newState object','legacy array']});

  await request('PUT',writePath+'/response',{token:partToken,body:{timeStamp:5,dataParts:{a:'Exact Ω/x',z:'old z'},responseType:'type/first'},status:201});
  await request('PUT',writePath+'/response',{token:partToken,body:{timeStamp:6,dataParts:{z:'new z'},responseType:'type/second'},status:201});
  await request('PUT',writePath+'/response',{token:partToken,body:{timeStamp:5,dataParts:{a:'equal rejected',z:'stale rejected',c:'new c'},responseType:'type/third'},status:201});
  await request('PUT',writePath+'/response',{token:partToken,body:{timeStamp:0,dataParts:{zero:'zero first insert'}},status:201});
  const parts=(await request('GET',readPath,{token:partToken})).value;
  assert.deepEqual(parts.dataParts,{a:'Exact Ω/x',z:'new z',c:'new c',zero:'zero first insert'});assert.equal(parts.unitResponseType,'unknown');assert.deepEqual(parts.state,persistent.state);
  check('native Unit GET restores independent accepted data parts and Source final-row response type',{dataParts:parts.dataParts,unitResponseType:parts.unitResponseType,state:parts.state});

  await request('PATCH',`/test/${nativeUnitTest}/lock`,{token:partToken,body:{timeStamp:clock+100,message:'Owned native Unit locked read'}});
  const lockedRead=(await request('GET',readPath,{token:partToken})).value;assert.deepEqual(lockedRead,parts);
  await request('PATCH',writePath+'/state',{token:partToken,body:{newState:[{key:'lockedWrite',content:'accepted while Test locked',timeStamp:1}]}});
  await request('PUT',writePath+'/response',{token:partToken,body:{timeStamp:7,dataParts:{late:'accepted while Test locked'},responseType:'locked/type'},status:201});
  const lockedState=(await request('GET',readPath,{token:partToken})).value;assert.equal(lockedState.state.lockedWrite,'accepted while Test locked');assert.equal(lockedState.dataParts.late,'accepted while Test locked');
  const falseAlias=(await request('GET',`/test/${nativeUnitTest}/unit/${physical}/alias/0`,{token:partToken})).value;assert.deepEqual(falseAlias.state,{});assert.deepEqual(falseAlias.dataParts,{});
  check('native Unit reads and writes stay independent of Test lock while a PHP-falsy zero alias falls back to the physical Unit name',{lockedGet:200,lockedState:200,lockedResponse:201,zeroAliasState:falseAlias.state});
  }


  {
  // A new isolated real group makes complete raw JSON/CSV reports reproducible.
  const group='ORACLE.TESTLOG',loginName='owned-native-testlog';
  await upload('native-testlog-people.xml',fixture([[group,'Owned native Testlog',[loginName]]]));
  const session=await authenticate(loginName),token=session.person.token;
  const bookletName='ORACLE.POW.BOOK#log:append';
  const id=Number((await request('PUT','/test',{token,body:{bookletName},status:201})).value);
  const path=`/test/${id}/log`,report=`/workspace/${workspace}/report/log?dataIds=${group}`;
  const rows=async()=>{const result=await request('GET',report,{token:admin.token,status:[200,204]});return result.value??[];};
  const raw=async({token:capability=token,body='{',status})=>{
    const response=await fetch(base+path,{method:'PUT',headers:{'content-type':'application/json',...(capability?{AuthToken:capability}:{})},body,signal:AbortSignal.timeout(20000)});
    const bytes=Buffer.from(await response.arrayBuffer());
    responses.push({method:'PUT',path,status:response.status,wireSha256:createHash('sha256').update(bytes).digest('hex'),contentType:response.headers.get('content-type'),value:null});
    assert.equal(response.status,status);return response.status;
  };
  await request('PUT',path,{body:[],status:401});
  await request('PUT',path,{token:session.login.token,body:[],status:403});
  await request('PUT',path,{token:admin.token,body:[],status:403});
  await request('PUT',path,{token:partToken,body:[],status:403});
  await raw({token:partToken,status:403});
  await request('PUT','/test/0/log',{token,body:[],status:400});
  await request('PUT','/test/9223372036854775807/log',{token,body:[],status:403});
  await request('PUT',`/test/000${id}/log`,{token,body:[],status:201});
  check('native Testlog authorizes person ownership before body parsing and accepts canonical leading-zero Test identities',{
    missing:401,login:403,admin:403,foreign:403,foreignMalformed:403,zero:400,unknown:403,leadingZeros:201});

  const before=await resultRows();
  const optional=[{key:'missing',timeStamp:0},{key:'null',content:null,timeStamp:1},{key:'empty',content:'',timeStamp:2}];
  const reply=await request('PUT',path,{token,body:optional,status:201});
  assert.equal(reply.bytes.length,0);assert.equal(reply.contentType,'text/html; charset=UTF-8');
  const defaults=await rows();assert.deepEqual(defaults.map(row=>row.logentry),['missing : ""','null : ""','empty : ""']);
  assert.deepEqual(defaults.map(row=>row.timestamp),[0,1,2]);assert.deepEqual(await resultRows(),before);
  const first=(await request('GET',`/test/${id}`,{token})).value;assert.equal(first.firstStart,true);assert.deepEqual(first.laststate,[]);
  check('native Testlog defaults missing and null content to empty JSON strings without opening or changing its Test',{
    status:reply.status,bodyBytes:reply.bytes.length,contentType:reply.contentType,entries:defaults,firstStart:first.firstStart,laststate:first.laststate});

  const phpJson=value=>JSON.stringify(value).replace(/\//g,'\\/').replace(/[\u0080-\uffff]/g,letter=>'\\u'+letter.charCodeAt(0).toString(16).padStart(4,'0'));
  const content=['Exact Ω/β\n"; 😀',0,42,1.5,false,true,[1,'Ω/x',{nested:'ä/y'}],{b:'Ω/x',a:1}];
  const typed=content.map((value,index)=>({key:'typed-'+index,content:value,timeStamp:10+index}));
  const unchanged=await resultRows();await request('PUT',path,{token,body:typed,status:201});
  const actual=(await rows()).slice(defaults.length);
  assert.deepEqual(actual.map(row=>row.logentry),typed.map(row=>row.key+(row.content===0?'':' : '+phpJson(row.content))));
  assert.deepEqual(actual.map(row=>row.timestamp),typed.map(row=>row.timeStamp));assert.deepEqual(await resultRows(),unchanged);
  assert.deepEqual((await request('GET',`/test/${id}`,{token})).value.laststate,[]);
  check('native Testlog preserves typed PHP JSON bytes including numeric-zero falsiness and independent client timestamps',{
    input:typed,entries:actual});

  const accepted=await rows();
  for(const invalid of [{},null,[{content:'no key',timeStamp:20}],[{key:'no timestamp',content:'x'}],[{key:'first must roll back',content:'x',timeStamp:21},{key:'invalid second'}]]){
    await request('PUT',path,{token,body:invalid,status:400});assert.deepEqual(await rows(),accepted);
  }
  // Source JSON::decode intentionally throws a server error for malformed JSON.
  // Record that observed boundary rather than silently declaring it HTTP400.
  await raw({status:500});assert.deepEqual(await rows(),accepted);
  await request('GET',path,{token,status:405});
  check('native Testlog validates every batch row before inserting and records the actual malformed-JSON server-error boundary',{
    missingFields:400,nonArray:400,malformedJson:500,wrongMethod:405,batchRowsAfterRejection:accepted.length});

  const duplicate={key:'duplicate',content:'same packet Ω',timeStamp:99};
  await request('PUT',path,{token,body:[duplicate],status:201});await request('PUT',path,{token,body:[duplicate],status:201});
  const duplicates=(await rows()).filter(row=>row.logentry.startsWith('duplicate'));
  assert.equal(duplicates.length,2);assert.deepEqual(duplicates[0],duplicates[1]);
  const emptyBefore=await rows(),stateBeforeEmpty=await resultRows();
  await request('PUT',path,{token,body:[],status:201});assert.deepEqual(await rows(),emptyBefore);assert.deepEqual(await resultRows(),stateBeforeEmpty);
  check('native Testlog appends repeated packets twice while an empty batch leaves both logs and Test timestamps unchanged',{
    duplicateEntries:duplicates,emptyStatus:201,rows:emptyBefore.length});

  await request('PATCH',`/test/${id}/lock`,{token,body:{timeStamp:1792929600100,message:'Owned Testlog lock'}});
  const locked=await resultRows();await request('PUT',path,{token,body:[{key:'locked',content:'accepted',timeStamp:100}],status:201});
  assert.deepEqual(await resultRows(),locked);assert.ok((await rows()).some(row=>row.logentry==='locked : "accepted"'));
  check('native Testlog append remains authorized independently of Test lock and does not advance the locked Test',{status:201});

  const files=[];
  for(const [extension,accept]of [['json','application/json'],['csv','text/csv']]){
    const result=await request('GET',report,{token:admin.token,accept});assert.ok(result.bytes.length>0);
    const file='testlog-append.'+extension;await writeFile(join(directory,file),result.bytes);
    files.push({file,bytes:result.bytes.length,sha256:createHash('sha256').update(result.bytes).digest('hex'),contentType:result.contentType});
  }
  check('actual protected native Testlog reports retain complete JSON and CSV bytes with typed defaults duplicate packets and lock-independent appends',{files});
  }


  // Independent codec observations: keep all 48 prior groups unchanged.
  {
    const group='ORACLE.TESTLOG.CODEC',loginName='owned-native-testlog-codec';
    await upload('native-testlog-codec-people.xml',fixture([[group,'Owned native Testlog codec',[loginName]]]));
    const session=await authenticate(loginName),token=session.person.token;
    const id=Number((await request('PUT','/test',{token,body:{bookletName:'ORACLE.POW.BOOK#codec:raw'},status:201})).value);
    const path=`/test/${id}/log`,report=`/workspace/${workspace}/report/log?dataIds=${group}`;
    const rows=async()=>{const result=await request('GET',report,{token:admin.token,status:[200,204]});return result.value??[];};
    const codecRaw=async(body,status)=>{
      const response=await fetch(base+path,{method:'PUT',headers:{AuthToken:token,'content-type':'application/json',accept:'application/json'},body,signal:AbortSignal.timeout(20000)});
      const bytes=Buffer.from(await response.arrayBuffer());let value=null;
      if(bytes.length){try{value=JSON.parse(bytes.toString('utf8'));}catch{value=bytes.toString('utf8');}}
      register(value);responses.push({method:'PUT',path,status:response.status,wireSha256:createHash('sha256').update(bytes).digest('hex'),contentType:response.headers.get('content-type'),value});
      assert.ok((Array.isArray(status)?status:[status]).includes(response.status),`Owned raw codec request returned unexpected HTTP ${response.status}`);
      return{status:response.status,value,contentType:response.headers.get('content-type')};
    };
    const untouched=await resultRows();
    const controls=[
      {key:'NUL string',content:'a\u0000b',timeStamp:1792929601100},
      {key:'NUL object',content:{['zero\u0000key']:'a\u0000b',empty:[]},timeStamp:1792929601101},
      {key:'line separators',content:'left\u2028middle\u2029right',timeStamp:1792929601102}
    ];
    await request('PUT',path,{token,body:controls,status:201});
    const escaped=await rows();assert.equal(escaped.length,controls.length);
    assert.deepEqual(await resultRows(),untouched);
    check('native Testlog production codec records escaped NUL and line-separator content without opening or modifying a Test',{input:controls,entries:escaped});

    const invalid=[
      ['numeric key','[{"key":7,"content":"owned","timeStamp":100}]'],
      ['boolean key','[{"key":true,"content":"owned","timeStamp":100}]'],
      ['array key','[{"key":[],"content":"owned","timeStamp":100}]'],
      ['object key','[{"key":{},"content":"owned","timeStamp":100}]'],
      ['string timestamp','[{"key":"owned invalid stamp","timeStamp":"100"}]'],
      ['boolean timestamp','[{"key":"owned invalid stamp","timeStamp":true}]'],
      ['float-token timestamp','[{"key":"owned float stamp","timeStamp":1.0}]'],
      ['null timestamp','[{"key":"owned null stamp","timeStamp":null}]'],
      ['null key','[{"key":null,"timeStamp":100}]'],
      ['scalar row','[42]']
    ];
    const errors=[];
    for(const[label,body]of invalid){
      const before=await rows(),result=await codecRaw(body,[400,500]);
      assert.deepEqual(await rows(),before);assert.deepEqual(await resultRows(),untouched);
      errors.push({label,input:JSON.parse(body),literal:body,...result});
    }
    check('native Testlog production codec records strict scalar-field and raw float-token error boundaries with no appended rows',{cases:errors});

    const literals=['0','-0.0','1.0','1e-7','1e-5','1e17','1e20','100000000000000000','9007199254740993','9223372036854775807','9223372036854775808'];
    const numbers=[];
    for(const[index,literal]of literals.entries()){
      const key=`raw-number-${index}`;
      const body=`[{"key":${JSON.stringify(key)},"content":${literal},"timeStamp":${1792929601200+index}}]`;
      await codecRaw(body,201);const actual=await rows();
      const row=actual.find(row=>row.logentry===key||row.logentry.startsWith(key+' : '));assert.ok(row);
      numbers.push({literal,entry:row.logentry});
    }
    assert.deepEqual(await resultRows(),untouched);
    const files=[];
    for(const[extension,accept]of [['json','application/json'],['csv','text/csv']]){
      const result=await request('GET',report,{token:admin.token,accept});
      const file='testlog-codec.'+extension;await writeFile(join(directory,file),result.bytes);
      files.push({file,bytes:result.bytes.length,sha256:createHash('sha256').update(result.bytes).digest('hex'),contentType:result.contentType});
    }
    check('native Testlog production codec records raw negative-zero exponent and int64 JSON number representations with complete report bytes',{numbers,files});
    const boundaryCases=[
      {label:'embedded NUL log key',body:JSON.stringify([{key:'owned\u0000suffix',content:'tail content',timeStamp:1792929601300}]),status:[201,400,500]},
      {label:'numeric object property order',body:'[{"key":"object order","content":{"2":"second","1":"first","02":"zero"},"timeStamp":1792929601301}]',status:[201]},
      {label:'duplicate object property order',body:'[{"key":"duplicate order","content":{"b":1,"a":2,"b":3},"timeStamp":1792929601302}]',status:[201]},
      {label:'invalid leading NUL object property',body:'[{"key":"nul property","content":{"\\u0000invalid":1},"timeStamp":1792929601303}]',status:[500]},
      {label:'non-finite decoded content',body:'[{"key":"overflow content","content":1e400,"timeStamp":1792929601304}]',status:[500]},
      ...['9007199254740991','9007199254740993','9223372036854775807','-9223372036854775808'].map((literal,index)=>({label:'exact client timestamp '+literal,body:`[{"key":"wide timestamp ${index}","content":"exact","timeStamp":${literal}}]`,status:[201,500]})),
      ...[508,509,510,511,512].map(depth=>({label:'nested content depth '+depth,body:`[{"key":"depth ${depth}","content":${'['.repeat(depth)}0${']'.repeat(depth)},"timeStamp":1792929601400}]`,status:[201,500]}))
    ];
    const boundaries=[];
    for(const scenario of boundaryCases){
      const before=(await rows()).length,result=await codecRaw(scenario.body,scenario.status),after=await rows();
      if(result.status!==201)assert.equal(after.length,before);
      boundaries.push({label:scenario.label,literal:scenario.body,status:result.status,addedRows:after.length-before,
        entries:after.slice(before).map(row=>({logentry:row.logentry}))});
    }
    assert.deepEqual(await resultRows(),untouched);
    const boundaryFiles=[];
    for(const[extension,accept]of [['json','application/json'],['csv','text/csv']]){
      const result=await request('GET',report,{token:admin.token,accept}),file='testlog-codec-boundaries.'+extension;
      await writeFile(join(directory,file),result.bytes);boundaryFiles.push({file,bytes:result.bytes.length,sha256:createHash('sha256').update(result.bytes).digest('hex'),contentType:result.contentType});
    }
    check('native Testlog production boundaries retain raw int64 timestamps object ordering NUL keys and exact decoder depth outcomes',{boundaries,files:boundaryFiles});
    const edgeValues=[0,-0,0.0001,0.00001,0.000001,1e16,1e17,1e20,Number.MIN_VALUE,-Number.MIN_VALUE,Number.MAX_VALUE,-Number.MAX_VALUE,
      0.1,0.3,1.2345678901234567,2.2250738585072014e-308,2.225073858507201e-308];
    const floatLiterals=edgeValues.map(value=>Object.is(value,-0)?'-0e0':value.toExponential());
    for(let index=0;index<160;index++){
      const value=createHash('sha256').update('owned-native-source-float-'+index).digest().readDoubleBE(0);
      if(Number.isFinite(value))floatLiterals.push(value.toExponential());
    }
    const packet='['+floatLiterals.map((literal,index)=>`{"key":"float-corpus-${index}","content":${literal},"timeStamp":${1792929602000+index}}`).join(',')+']';
    const priorCount=(await rows()).length;await codecRaw(packet,201);
    const complete=await rows(),actual=complete.filter(row=>row.logentry.startsWith('float-corpus-'));assert.equal(complete.length-priorCount,floatLiterals.length);assert.equal(actual.length,floatLiterals.length);
    assert.deepEqual(await resultRows(),untouched);
    const floatRows=floatLiterals.map((literal,index)=>{
      const key='float-corpus-'+index,row=actual.find(row=>row.logentry===key||row.logentry.startsWith(key+' : '));assert.ok(row);return{literal,entry:row.logentry};
    });
    const floatFiles=[];
    for(const[extension,accept]of [['json','application/json'],['csv','text/csv']]){
      const result=await request('GET',report,{token:admin.token,accept}),file='testlog-codec-floats.'+extension;
      await writeFile(join(directory,file),result.bytes);floatFiles.push({file,bytes:result.bytes.length,sha256:createHash('sha256').update(result.bytes).digest('hex'),contentType:result.contentType});
    }
    check('native Testlog production PHP floating-point corpus preserves boundary subnormal signed-zero and deterministic IEEE754 encodings',{values:floatRows,files:floatFiles});


  }

  // Independent native lock observations; all preceding 53 controls stay intact.
  {
    const group='ORACLE.TEST.LOCK',loginName='owned-native-test-lock';
    await upload('native-test-lock-people.xml',fixture([[group,'Owned native Test lock',[loginName]]]));
    const session=await authenticate(loginName),token=session.person.token;
    const report=`/workspace/${workspace}/report/log?dataIds=${group}`;
    const rows=async()=>{const result=await request('GET',report,{token:admin.token,status:[200,204]});return result.value??[];};
    const create=async suffix=>{
      const bookletName='ORACLE.POW.BOOK#lock:'+suffix;
      const id=Number((await request('PUT','/test',{token,body:{bookletName},status:201})).value);
      assert.ok(Number.isSafeInteger(id)&&id>0);return{id,bookletName};
    };
    const lockRaw=async(test,{body,capability=token,status=[200,400,500],padded=false}={})=>{
      const path=`/test/${padded?'000':''}${test.id}/lock`;
      const reply=await fetch(base+path,{method:'PATCH',headers:{'content-type':'application/json',...(capability?{AuthToken:capability}:{})},...(body===undefined?{}:{body}),signal:AbortSignal.timeout(20000)});
      const bytes=Buffer.from(await reply.arrayBuffer());
      responses.push({method:'PATCH',path,status:reply.status,wireSha256:createHash('sha256').update(bytes).digest('hex'),contentType:reply.headers.get('content-type'),value:null});
      assert.ok((Array.isArray(status)?status:[status]).includes(reply.status),'Record actual native lock response');
      return{status:reply.status,bodyBytes:bytes.length,wireSha256:createHash('sha256').update(bytes).digest('hex'),contentType:reply.headers.get('content-type')};
    };
    const authTest=await create('authorization'),authBefore=await rows();
    for(const[capability,status]of[[null,401],[session.login.token,403],[admin.token,403],[partToken,403]])await lockRaw(authTest,{body:'{',capability,status});
    assert.equal((await request('PUT','/test',{token,body:{bookletName:authTest.bookletName},status:201})).value,authTest.id);
    assert.deepEqual(await rows(),authBefore);
    check('native Test lock checks person and current Test ownership before malformed JSON can affect an unopened Test',{missing:401,login:403,admin:403,foreign:403});
    const vectors=[
      ['empty-body',''],['malformed','{'],['json-null','null'],['json-array','[]'],['missing-clock','{}'],['null-clock','{"timeStamp":null}'],
      ['default-message','{"timeStamp":0}'],['null-message','{"timeStamp":1,"message":null}'],['empty-message','{"timeStamp":2,"message":""}'],
      ['unicode-message','{"timeStamp":3,"message":"Owned Ω/β; \\n 😀"}'],['nul-message','{"timeStamp":4,"message":"owned\\u0000tail"}'],
      ['number-message','{"timeStamp":5,"message":7}'],['false-message','{"timeStamp":6,"message":false}'],['array-message','{"timeStamp":7,"message":[]}'],['object-message','{"timeStamp":8,"message":{}}'],
      ['string-clock','{"timeStamp":"9","message":"string clock"}'],['float-clock','{"timeStamp":1.0,"message":"float clock"}'],['false-clock','{"timeStamp":false,"message":"false clock"}'],
      ['int64-max','{"timeStamp":9223372036854775807,"message":"int64 maximum"}'],['int64-min','{"timeStamp":-9223372036854775808,"message":"int64 minimum"}'],
      ['overflow-clock','{"timeStamp":9223372036854775808,"message":"overflow clock"}']
    ];
    const outcomes=[];
    for(const[label,body]of vectors){
      const test=await create(label),before=await rows();
      const response=await lockRaw(test,{body});
      const probe=await request('PUT','/test',{token,body:{bookletName:test.bookletName},status:[201,423]});
      if(probe.status===201)assert.equal(probe.value,test.id);
      const after=await rows();assert.ok(after.length>=before.length&&after.length<=before.length+1);
      const entries=after.filter(row=>row.bookletname===test.bookletName);assert.equal(entries.length,after.length-before.length);
      outcomes.push({label,body,...response,locked:probe.status===423,appendCount:after.length-before.length,entries});
    }
    check('native Test lock records exact defaults strict typed-constructor failures int64 clocks and durable lock-after-error boundaries',{outcomes});
    const repeated=await create('repeat'),before=await rows();
    const body='{"timeStamp":42,"message":"repeated raw key"}';
    const first=await lockRaw(repeated,{body,status:200,padded:true}),second=await lockRaw(repeated,{body,status:200});
    assert.equal(first.bodyBytes,0);assert.equal(second.bodyBytes,0);
    const appended=(await rows()).filter(row=>row.bookletname===repeated.bookletName);assert.equal(appended.length,2);assert.equal((await rows()).length-before.length,2);assert.deepEqual(appended[0],appended[1]);
    await request('GET',`/test/${repeated.id}`,{token,status:423});
    const opened=await create('opened');const initialRead=(await request('GET',`/test/${opened.id}`,{token})).value;assert.equal(initialRead.firstStart,true);
    await request('PATCH',`/test/${opened.id}/state`,{token,body:[{key:'ownedLockState',content:'preserved',timeStamp:1}]});
    const beforeOpenLock=await resultRows();await lockRaw(opened,{body:'{"timeStamp":99,"message":"opened lock"}',status:200});
    await request('GET',`/test/${opened.id}`,{token,status:423});
    await request('PUT','/test',{token,body:{bookletName:opened.bookletName},status:423});
    const afterOpenLock=await resultRows();
    check('native Test lock repeats append independently accepts padded IDs and refuses subsequent native Test entry for opened and unopened Tests',{repeatEntries:appended,beforeOpenLock,afterOpenLock});
    const files=[];
    for(const[extension,accept]of [['json','application/json'],['csv','text/csv']]){
      const result=await request('GET',report,{token:admin.token,accept}),file='test-lock.'+extension;
      await writeFile(join(directory,file),result.bytes);files.push({file,bytes:result.bytes.length,sha256:createHash('sha256').update(result.bytes).digest('hex'),contentType:result.contentType});
    }
    check('actual protected native Test lock JSON and CSV retain full report bytes after successful failed repeated and opened-Test operations',{files});
  }

  // Independent native command transport: retain all preceding57 controls.
  {
    for(const path of ['backend/src/controller/MonitorController.class.php','backend/src/data-collection/Command.class.php','backend/src/middleware/IsGroupMonitor.class.php','backend/src/helper/Mode.class.php','definitions/testtaker/test-mode.json','frontend/src/app/group-monitor/backend.service.ts','backend/src/dao/DAO.class.php'])receipt.sourceFiles[path]=createHash('sha256').update(await readFile(join('original-reference',path))).digest('hex');
    const group='ORACLE.COMMAND',one='owned-native-command-one',two='owned-native-command-two',monitorName='owned-native-command-monitor';
    await upload('native-command-people.xml',xml('Testtakers','testcenter-testtaker-xml','18.0','<Metadata/><Group id="'+group+'" label="Owned native commands">'+[one,two].map(name=>`<Login name="${name}" pw="${password}" mode="run-review"><Booklet codes="Shared">ORACLE.POW.BOOK</Booklet></Login>`).join('')+`<Login name="${monitorName}" pw="${password}" mode="monitor-group"/></Group>`));
    const first=await authenticate(one),second=await authenticate(two),owner=first.person.token,peer=second.person.token;
    const id=Number((await request('PUT','/test',{token:owner,body:{bookletName:'ORACLE.POW.BOOK#command:one'},status:201})).value),peerId=Number((await request('PUT','/test',{token:peer,body:{bookletName:'ORACLE.POW.BOOK#command:two'},status:201})).value);
    const work=(await request('POST','/session/challenge',{body:{loginType:'login',name:monitorName,password}})).value;
    const monitor=(await request('PUT','/session',{body:solve(work)})).value;assert.equal(monitor.loginName,monitorName);assert.ok(!monitor.flags.includes('codeRequired'));
    await request('GET','/monitor/test-sessions',{token:monitor.token});
    const commandPath='/test/'+id+'/commands',peerPath='/test/'+peerId+'/commands';
    const raw=async(method,path,{token,body,status=200}={})=>{
      const reply=await fetch(base+path,{method,headers:{...(token?{AuthToken:token}:{}),...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body}),signal:AbortSignal.timeout(20000)});
      const bytes=Buffer.from(await reply.arrayBuffer());let value=null;if(bytes.length){try{value=JSON.parse(bytes.toString('utf8'));}catch{value=bytes.toString('utf8');}}register(value);
      responses.push({method,path,status:reply.status,reason:reply.statusText,wireSha256:createHash('sha256').update(bytes).digest('hex'),contentType:reply.headers.get('content-type'),value});
      assert.ok((Array.isArray(status)?status:[status]).includes(reply.status),'Native command request status');return{status:reply.status,reason:reply.statusText,value,bytes,contentType:reply.headers.get('content-type'),subscribeToken:reply.headers.get('SubscribeToken')};
    };
    const getBody=async(path,token,body,status=200)=>{
      const {request:nodeRequest}=await import('node:http'),payload=Buffer.from(body);
      return new Promise((resolve,reject)=>{
        const pending=nodeRequest(base+path,{method:'GET',headers:{AuthToken:token,'content-type':'application/json','content-length':String(payload.length)}},reply=>{
          const chunks=[];reply.on('data',chunk=>chunks.push(chunk));reply.on('end',()=>{try{
            const bytes=Buffer.concat(chunks);let value=null;if(bytes.length){try{value=JSON.parse(bytes.toString('utf8'));}catch{value=bytes.toString('utf8');}}register(value);
            responses.push({method:'GET',path,status:reply.statusCode,reason:reply.statusMessage,wireSha256:createHash('sha256').update(bytes).digest('hex'),contentType:reply.headers['content-type'],requestBodyBytes:payload.length,value});assert.equal(reply.statusCode,status);
            resolve({status:reply.statusCode,value,bytes,reason:reply.statusMessage});
          }catch(error){reject(error);}});
        });pending.setTimeout(20000,()=>pending.destroy(Error('Owned native GET body timed out')));pending.on('error',reject);pending.end(payload);
      });
    };
    const empty=await raw('GET',commandPath,{token:owner});assert.deepEqual(empty.value,[]);assert.equal(empty.subscribeToken,null);
    assert.equal((await request('GET','/session',{token:owner})).value.claims.test[0].flags.running,false);
    check('native command fixture uses genuine protected monitor-person work and empty polling does not open its Test',{monitorLogin:monitorName,empty:empty.value,disabledBroadcastSubscribeToken:empty.subscribeToken});
    await raw('GET',commandPath,{status:401});
    for(const token of[first.login.token,admin.token,peer,monitor.token])await raw('GET',commandPath,{token,status:403});
    await raw('PATCH','/test/'+id+'/command/999999999/executed',{status:401});
    for(const token of[first.login.token,admin.token,peer,monitor.token])await raw('PATCH','/test/'+id+'/command/999999999/executed',{token,body:'{',status:403});
    await raw('PUT','/monitor/command',{status:401,body:'{'});for(const token of[owner,first.login.token,admin.token])await raw('PUT','/monitor/command',{token,body:'{',status:403});
    check('native command polling acknowledgement and delivery enforce person role and Test ownership before request fields',{pollMissing:401,pollForeign:403,ackMissing:401,ackForeign:403,deliveryMissing:401,nonMonitorDelivery:403});
    // Original group-monitor sends Date.now()/1000; SQL timestamps use seconds.
    const clock=1793158800;
    const send=async({keyword,arguments:args=[],timestamp,testIds=[id]})=>request('PUT','/monitor/command',{token:monitor.token,body:{keyword,arguments:args,timestamp,testIds},status:201});
    await send({keyword:'owned.command.first',arguments:['Ω/x',0,false,true,null,42,1.5],timestamp:clock+10,testIds:[id,peerId,id]});
    await send({keyword:'owned.command.second',arguments:['second'],timestamp:clock+20});
    await send({keyword:'owned.command.equal',arguments:['equal timestamp'],timestamp:clock+20});
    const initial=await raw('GET',commandPath,{token:owner}),peerInitial=await raw('GET',peerPath,{token:peer});
    assert.equal(initial.value.length,3);assert.equal(peerInitial.value.length,1);assert.ok(initial.value.every(row=>Number.isSafeInteger(row.id)&&row.id>0));
    assert.deepEqual(initial.value.map(row=>row.timestamp),[clock+10,clock+20,clock+20]);
    assert.deepEqual(initial.value[0].arguments,['Ω/x','0','','1','','42','1.5']);assert.equal(peerInitial.value[0].id,initial.value[0].id);
    assert.deepEqual(Object.keys(initial.value[0]),['id','keyword','arguments','timestamp']);
    const [a,b,c]=initial.value;const packetFiles=[];
    for(const[name,reply]of[['command-initial.json',initial],['command-peer.json',peerInitial]]){await writeFile(join(directory,name),reply.bytes);packetFiles.push({file:name,bytes:reply.bytes.length,sha256:createHash('sha256').update(reply.bytes).digest('hex'),contentType:reply.contentType});}
    check('native monitor delivery deduplicates targets shares command IDs and preserves typed string arguments and client-clock ordering',{commands:initial.value,peerCommands:peerInitial.value,files:packetFiles});
    const query=await raw('GET',commandPath+'?lastCommandId='+a.id,{token:owner});
    const afterA=await getBody(commandPath,owner,JSON.stringify({lastCommandId:a.id})),afterB=await getBody(commandPath,owner,JSON.stringify({lastCommandId:b.id}));
    const unknown=await getBody(commandPath,owner,'{"lastCommandId":999999999}'),zero=await getBody(commandPath,owner,'{"lastCommandId":0}');
    assert.deepEqual(afterA.value.map(x=>x.id),[b.id,c.id]);assert.deepEqual(afterB.value,[]);assert.deepEqual(unknown.value,[]);assert.deepEqual(zero.value,initial.value);
    await getBody(commandPath,owner,JSON.stringify({lastCommandId:String(a.id)}),500);
    assert.deepEqual(query.value,initial.value);
    check('native command last-ID filtering reads the GET JSON body ignores query parameters and excludes all equal-clock commands',{query:query.value,afterFirst:afterA.value,afterEqualTimestamp:afterB.value,unknownScopedId:unknown.value,zero:zero.value,stringBodyId:500});
    const acknowledge=async(testId,commandId,token,status=200)=>raw('PATCH','/test/'+testId+'/command/'+commandId+'/executed',{token,status});
    const ack=await acknowledge(id,a.id,owner),again=await acknowledge(id,a.id,owner);
    assert.equal(ack.reason,'OK');assert.equal(again.reason,'OK, was already marked as executed');assert.equal(ack.bytes.length,0);assert.equal(again.bytes.length,0);
    await acknowledge(id,999999999,owner,404);await acknowledge(peerId,b.id,peer,404);
    assert.deepEqual((await raw('GET',commandPath,{token:owner})).value.map(x=>x.id),[b.id,c.id]);assert.deepEqual((await raw('GET',peerPath,{token:peer})).value,peerInitial.value);
    await acknowledge('000'+id,'000'+b.id,owner);await acknowledge(id,c.id,owner);
    assert.deepEqual((await raw('GET',commandPath,{token:owner})).value,[]);
    check('native command ACK is scoped idempotent accepts padded IDs and returns the exact repeated-execution HTTP reason',{firstReason:ack.reason,repeatedReason:again.reason,unknownCommand:404,unaddressedSharedId:404,peerUnchanged:true});
    await request('PATCH','/test/'+id+'/state',{token:owner,body:[{key:'CONNECTION',content:'LOST',timeStamp:777}]});
    const pollReport='/workspace/'+workspace+'/report/log?dataIds='+group;
    const pollLogs=async()=>(await request('GET',pollReport,{token:admin.token})).value;
    const beforePoll=await pollLogs(),polling=await raw('GET',commandPath,{token:owner});assert.deepEqual(polling.value,[]);
    const afterPoll=await pollLogs(),pollEntry='"CONNECTION" : POLLING';assert.equal(afterPoll.length,beforePoll.length+1);
    const serverLogs=afterPoll.filter(row=>row.logentry===pollEntry);assert.equal(serverLogs.length,1);assert.equal(serverLogs[0].timestamp,0);
    await raw('GET',commandPath,{token:owner});const repeatedPoll=await pollLogs();assert.equal(repeatedPoll.length,afterPoll.length+1);assert.equal(repeatedPoll.filter(row=>row.logentry===pollEntry).length,2);
    const opened=(await request('GET','/test/'+id,{token:owner})).value;assert.equal(opened.firstStart,true);assert.equal(opened.laststate.CONNECTION,'LOST');
    const openedAgain=(await request('GET','/test/'+id,{token:owner})).value;assert.equal(openedAgain.firstStart,false);
    check('native polling retains actual LOST state because the zero-clock server patch is ignored while each poll appends its raw POLLING log',{firstStart:opened.firstStart,laststate:opened.laststate,secondStart:openedAgain.firstStart,subscribeToken:polling.subscribeToken,firstServerLogs:serverLogs,repeatedServerLogs:repeatedPoll.filter(row=>row.logentry===pollEntry)});
    await request('PATCH','/test/'+id+'/lock',{token:owner,body:{timeStamp:clock+50,message:'Owned command locked polling'}});
    await send({keyword:'owned.command.locked',arguments:['still queued'],timestamp:clock+30});
    const locked=await raw('GET',commandPath,{token:owner});assert.equal(locked.value.length,1);assert.equal(locked.value[0].keyword,'owned.command.locked');await acknowledge(id,locked.value[0].id,owner);assert.deepEqual((await raw('GET',commandPath,{token:owner})).value,[]);
    await request('GET','/test/'+id,{token:owner,status:423});
    check('native command delivery polling and acknowledgement stay independent of the Test lock',{lockedCommand:locked.value[0],lockedTestRead:423});
    const files=[];
    for(const[extension,accept]of [['json','application/json'],['csv','text/csv']]){
      const reply=await request('GET','/workspace/'+workspace+'/report/log?dataIds='+group,{token:admin.token,accept}),file='command-polling.'+extension;
      await writeFile(join(directory,file),reply.bytes);files.push({file,bytes:reply.bytes.length,sha256:createHash('sha256').update(reply.bytes).digest('hex'),contentType:reply.contentType});
    }
    const unchanged=await raw('GET',peerPath,{token:peer});assert.deepEqual(unchanged.value,peerInitial.value);
    check('actual native command packets and protected polling-state reports retain exact production bytes and peer scope',{files,remainingPeerCommands:unchanged.value});
  }

  receipt.success = true;
} catch (error) {
  receipt.success = false;
  receipt.error = {name: error.name, message: error.message};
  process.exitCode = 1;
} finally {
  await mkdir(directory, {recursive: true});
  const publicReceipt = redact(receipt), publicResponses = redact(responses);
  const receiptJson = JSON.stringify(publicReceipt, null, 2), responseJson = JSON.stringify(publicResponses, null, 2);
  for (const secret of secrets.keys()) {
    assert.ok(!receiptJson.includes(secret) && !responseJson.includes(secret), 'Public evidence must omit every registered private value');
  }
  await writeFile(join(directory, 'receipt.json'), receiptJson + '\n');
  await writeFile(join(directory, 'http-observations.json'), responseJson + '\n');
  console.log(`source_native_group_deletion_success=${receipt.success}; checks=${receipt.checks.length}; http_observations=${responses.length}`);
  if (!receipt.success) console.error(`source_native_group_deletion_failure=${receipt.error.name}`);
}
