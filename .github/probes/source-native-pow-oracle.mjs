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
  console.log(`source_native_pow=${name}:passed`);
};
const request = async (method, path, {token, body, status = 200} = {}) => {
  const response = await fetch(base + path, {method, headers: {accept: 'application/json',
    ...(token ? {AuthToken: token} : {}), ...(body !== undefined && !(body instanceof FormData) ? {'content-type': 'application/json'} : {})},
    ...(body === undefined ? {} : {body: body instanceof FormData ? body : JSON.stringify(body)}), signal: AbortSignal.timeout(20000)});
  const bytes = Buffer.from(await response.arrayBuffer());
  let value = null;
  if (bytes.length) { try { value = JSON.parse(bytes.toString('utf8')); } catch { value = bytes.toString('utf8'); } }
  register(value);
  responses.push({method, path, status: response.status, wireSha256: createHash('sha256').update(bytes).digest('hex'), value});
  assert.ok((Array.isArray(status) ? status : [status]).includes(response.status), `${method} ${path}: unexpected HTTP ${response.status}`);
  return {status: response.status, value};
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
    'backend/src/data-collection/AccessSet.class.php', 'backend/composer.lock']) {
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
  console.log(`source_native_pow_success=${receipt.success}; checks=${receipt.checks.length}; http_observations=${responses.length}`);
  if (!receipt.success) console.error(`source_native_pow_failure=${receipt.error.name}`);
}
