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
    'backend/src/data-collection/AccessSet.class.php', 'backend/src/dao/AdminDAO.class.php', 'backend/src/dao/TestDAO.class.php', 'backend/src/controller/WorkspaceController.class.php', 'backend/composer.lock', 'scripts/database/full.sql', 'backend/src/helper/CSV.class.php', 'backend/src/helper/ReviewCSVFormatter.php', 'backend/src/helper/TimeStamp.class.php', 'backend/src/workspace/Report.php', 'backend/src/workspace/ResponseReportOutput.php', 'backend/src/workspace/LogReportOutput.php', 'backend/src/workspace/ReviewReportOutput.php', 'backend/src/data-collection/ReportFormat.php', 'backend/src/files/XMLFileBooklet.class.php', 'backend/src/controller/TestController.class.php', 'backend/src/data-collection/TestName.class.php', 'backend/src/middleware/IsTestOwner.class.php', 'backend/src/helper/RequestHelper.class.php', 'backend/src/helper/State.class.php', 'backend/src/workspace/Workspace.class.php', 'backend/src/dao/WorkspaceDAO.class.php', 'backend/src/helper/FileResponse.class.php', 'backend/src/helper/FileExt.class.php', 'backend/src/helper/Folder.class.php', 'backend/src/files/XMLFileUnit.class.php', 'backend/src/helper/FileID.class.php', 'backend/src/data-collection/UnitLog.php']) {
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
