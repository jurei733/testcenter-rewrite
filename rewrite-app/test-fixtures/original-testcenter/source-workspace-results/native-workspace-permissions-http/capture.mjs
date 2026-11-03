import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {join} from 'node:path';

const out = process.env.ORIGINAL_PERMISSIONS_OUTPUT_DIR;
const original = process.env.ORIGINAL_PERMISSIONS_SOURCE_ROOT;
const container = process.env.ORIGINAL_PERMISSIONS_CONTAINER;
assert.ok(out && original && container);
await mkdir(out, {recursive: true});
const hash = value => createHash('sha256').update(value).digest('hex');
const git = (...args) => execFileSync('git', ['-C', original, ...args], {encoding:'utf8'}).trim();
assert.equal(git('rev-parse', 'HEAD'), 'eedae41840cbe90e5547c0211da818bdf620f5aa');
assert.equal(git('status', '--porcelain', '--untracked-files=no'), '');
const paths = git('ls-files', 'backend/src', 'backend/index.php', 'backend/routes.php',
  'backend/initialize.php', 'definitions/testtaker', 'scripts/database/full.sql').split('\n');
const sourceHashes = Object.fromEntries(await Promise.all(paths.map(async path =>
  [path, hash(await readFile(join(original, path)))])));
const verifyImage = () => {
  const php = '$paths=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);$out=[];foreach($paths as $p){$f="/var/www/testcenter/".$p;if(!is_file($f))throw new RuntimeException("Missing pinned source: ".$p);$out[$p]=hash_file("sha256",$f);}echo json_encode($out,JSON_THROW_ON_ERROR);';
  const found = JSON.parse(execFileSync('docker', ['exec', '-i', container, 'php', '-r', php],
    {encoding:'utf8', input:JSON.stringify(paths)}));
  assert.deepEqual(found, sourceHashes);
};
verifyImage();
const lockBytes = await readFile(join(original, 'backend/composer.lock'));
const lock = JSON.parse(lockBytes);
const installedBytes = execFileSync('docker', ['exec', container, 'php', '-r',
  'echo file_get_contents("/var/www/testcenter/backend/vendor/composer/installed.json");']);
const installed = JSON.parse(installedBytes);
const known = new Map([...lock.packages, ...lock['packages-dev']].map(p => [p.name, p]));
for (const item of installed.packages) {
  assert.equal(item.version, known.get(item.name)?.version);
  assert.equal(item.source?.reference, known.get(item.name)?.source?.reference);
}
for (const item of lock.packages) assert.ok(installed.packages.some(p => p.name === item.name));
const port = execFileSync('docker', ['port', container, '8080'], {encoding:'utf8'}).trim();
assert.match(port, /^127\.0\.0\.1:\d+$/);
const base = 'http://' + port;
const rootPassword = 'owned-source-super-secret';
const userPassword = 'Owned permissions password';
const aliases = new Map([[rootPassword, '[owned-root-password]'], [userPassword, '[owned-user-password]']]);
const rows = [];
const register = value => {
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    if (/^(token|groupToken|salt|signature)$/i.test(key) && typeof item === 'string') {
      if (!aliases.has(item)) aliases.set(item, '[owned-' + key + '-' + aliases.size + ']');
    } else register(item);
  }
};
const redact = value => {
  if (typeof value === 'string') {
    for (const [secret, alias] of [...aliases].sort((a,b) => b[0].length - a[0].length)) value = value.replaceAll(secret, alias);
    return value;
  }
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key,item]) => [key,redact(item)]));
  return value;
};
async function request(label, method, path, {token, body, rawBody, expected} = {}) {
  const response = await fetch(base + path, {method,
    headers:{Accept:'application/json', ...(token === undefined ? {} : {AuthToken:token}),
      ...(body === undefined && rawBody === undefined ? {} : {'Content-Type':'application/json'})},
    ...(rawBody === undefined ? body === undefined ? {} : {body:JSON.stringify(body)} : {body:rawBody}),
    signal:AbortSignal.timeout(20_000)});
  const rawText = await response.text();
  let value; try {value = JSON.parse(rawText);} catch {value = rawText;}
  register(value);
  const row = {label, method, path, status:response.status, contentType:response.headers.get('content-type'),
    errorId:response.headers.get('error-id'), testMode:response.headers.get('test-mode'),
    requestBody:rawBody ?? body, rawText, value, bodySha256:hash(rawText)};
  rows.push(row);
  if (expected !== undefined) assert.equal(row.status, expected, label + ': ' + rawText);
  return row;
}

try {
  const config = await request('config', 'GET', '/system/config', {expected:200});
  assert.deepEqual(config.value.bruteForceProtection, ['login','person']);
  const auth = await request('root-login', 'PUT', '/session/admin',
    {body:{name:'super',password:rootPassword},expected:200});
  const token = auth.value.token;
  const one = Number((await request('create-workspace-one', 'PUT', '/workspace',
    {token,body:{name:'Owned permissions One Ω'},expected:201})).value);
  const two = Number((await request('create-workspace-two', 'PUT', '/workspace',
    {token,body:{name:'Owned permissions Two β'},expected:201})).value);
  const a = Number((await request('create-user-a', 'PUT', '/user',
    {token,body:{n:'Owned permissions A',p:userPassword},expected:201})).value);
  const b = Number((await request('create-user-b', 'PUT', '/user',
    {token,body:{n:'Owned permissions B',p:userPassword},expected:201})).value);
  const workspaceUsers = '/workspace/' + one + '/users';
  const userWorkspaces = '/user/' + a + '/workspaces';
  const list = (label, path) => request(label, 'GET', path, {token,expected:200});
  const setUsers = (label, entries) => request(label, 'PATCH', workspaceUsers,
    {token,body:{u:entries},expected:200});
  const setWorkspaces = (label, entries) => request(label, 'PATCH', userWorkspaces,
    {token,body:{ws:entries},expected:200});
  await list('initial-workspace-users', workspaceUsers);
  await list('initial-user-workspaces', userWorkspaces);
  await setUsers('assign-mixed-users', [{id:a,role:'RW'},{id:b,role:'RO'}]);
  await list('mixed-workspace-users', workspaceUsers);
  await list('a-workspaces-after-mixed', userWorkspaces);
  await list('b-workspaces-after-mixed', '/user/' + b + '/workspaces');
  await setWorkspaces('replace-a-workspaces', [{id:one,role:'RO'},{id:two,role:'RW'}]);
  await list('a-workspaces-after-replace', userWorkspaces);
  await list('one-users-after-a-replace', workspaceUsers);
  await list('two-users-after-a-replace', '/workspace/' + two + '/users');
  await setUsers('selected-flag-is-not-authority', [{id:a,role:'RW',selected:false}]);
  await list('workspace-after-selected-false', workspaceUsers);
  await list('b-after-workspace-replacement', '/user/' + b + '/workspaces');
  await list('a-other-workspace-preserved', userWorkspaces);
  const userAuth = await request('user-a-login', 'PUT', '/session/admin',
    {body:{name:'Owned permissions A',password:userPassword},expected:200});
  const userToken = userAuth.value.token;
  for (const path of [workspaceUsers,userWorkspaces]) {
    await request('user-read-denied-' + path, 'GET', path, {token:userToken,expected:403});
    await request('user-write-denied-' + path, 'PATCH', path,
      {token:userToken,body:path.includes('/users')?{u:[{id:a,role:''}]}:{ws:[{id:one,role:''}]},expected:403});
    await request('missing-token-' + path, 'GET', path, {expected:401});
    await request('empty-token-' + path, 'GET', path, {token:'',expected:401});
    await request('unknown-token-' + path, 'GET', path, {token:'owned-invalid',expected:403});
  }
  for (const [family,path,field] of [['workspace',workspaceUsers,'u'],['user',userWorkspaces,'ws']]) {
    for (const [name,body] of [['missing',{}],['null',{[field]:null}],['empty',{[field]:[]}],
      ['scalar',{[field]:'bad'}],['object',{[field]:{id:a,role:'RW'}}]]) {
      await request(family + '-invalid-' + name, 'PATCH', path, {token,body});
      await list(family + '-after-invalid-' + name, path);
    }
    await request(family + '-invalid-json', 'PATCH', path, {token,rawBody:'{broken'});
    await list(family + '-after-invalid-json', path);
  }
  await setUsers('clear-users-with-blank-role', [{id:a,role:''}]);
  await list('all-users-cleared', workspaceUsers);
  await list('other-workspace-survives-clear', userWorkspaces);
  await request('live-user-session-after-revoke', 'GET', '/session', {token:userToken,expected:200});
  await setUsers('string-id-and-untrimmed-role', [{id:String(a),role:'RO'}]);
  await list('string-id-selected', workspaceUsers);
  for (const reference of ['0','999999','01','1.9','1abc',' +1','9007199254740993']) {
    await list('workspace-path-' + reference, '/workspace/' + encodeURIComponent(reference) + '/users');
    await list('user-path-' + reference, '/user/' + encodeURIComponent(reference) + '/workspaces');
  }
  // These actual malformed writes are measured with their following state;
  // Source's non-transactional partial failure is not silently called atomic.
  for (const [name,entries] of [['unknown-user',[{id:999999,role:'RW'}]],
    ['duplicate-user',[{id:a,role:'RO'},{id:a,role:'RW'}]],
    ['unknown-role',[{id:a,role:'XX'}]], ['padded-role',[{id:a,role:' RW '}]],
    ['null-role',[{id:a,role:null}]], ['missing-role',[{id:a}]],
    ['fractional-id',[{id:a + .5,role:'RW'}]], ['zero-id',[{id:0,role:'RO'}]]]) {
    await setUsers('restore-before-' + name, [{id:a,role:'RO'},{id:b,role:'RW'}]);
    await request('probe-' + name, 'PATCH', workspaceUsers, {token,body:{u:entries}});
    await list('state-after-' + name, workspaceUsers);
    await request('session-after-' + name, 'GET', '/session', {token:userToken});
  }
  await setUsers('final-restored-users', [{id:a,role:'RO'},{id:b,role:'RW'}]);
  await list('final-workspace-users', workspaceUsers);
  await list('final-user-workspaces', userWorkspaces);
  await list('unknown-user-matrix', '/user/999999/workspaces');
  await list('unknown-workspace-matrix', '/workspace/999999/users');
  verifyImage();
  for (const [path,digest] of Object.entries(sourceHashes)) assert.equal(hash(await readFile(join(original,path))), digest);
  assert.equal(git('status','--porcelain','--untracked-files=no'), '');
  const recorded = redact(rows).map(row => ({...row,redactedBodySha256:hash(row.rawText)}));
  const result = {verified:true,sourceCommit:git('rev-parse','HEAD'),sourceHashes,
    sourceFilesVerifiedBeforeAndAfter:paths.length,sourceCodeAndVendorUnmodified:true,
    backendImage:'sha256:d7045f22e834e2907ed39b5f8c99eed3d81f37643c50c3f66746e3f654381328',
    vendor:{sourceComposerLockSha256:hash(lockBytes),installedMetadataSha256:hash(installedBytes),
      installedPackages:installed.packages.length,requiredProductionPackages:lock.packages.length},
    setup:{one,two,a,b},actualSourceHttpRequests:rows.length,rows:recorded,
    sqlSeedsOrDaoStubs:false,mutationsOverActualHttp:true,fullOriginalParityProven:false};
  await writeFile(join(out,'observations.json'), JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({verified:true,requests:rows.length,sourceFiles:paths.length,packages:installed.packages.length}));
} catch(error) {
  await writeFile(join(out,'failure.json'),JSON.stringify({error:String(error),rows:redact(rows)},null,2)+'\n');
  throw error;
}
