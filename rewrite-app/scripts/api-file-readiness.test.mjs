import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { chmod, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'api-file-readiness-')), file = join(directory, 'owned.json');
  const api = new URL('../apps/api/dist/apps/api/src/index.js', import.meta.url).href;
  const child = spawn(process.execPath, ['--input-type=module', '-e', `
    const {createProductionApiServer}=await import(${JSON.stringify(api)});
    const server=await createProductionApiServer();
    server.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));
    process.on('message',message=>{if(message==='close')server.close(()=>setImmediate(()=>process.exit(0)));});
  `], { env: { ...process.env, FIRST_SLICE_STORE: 'file', FIRST_SLICE_FILE: file,
    FIRST_SLICE_BOOTSTRAP_DEMO: 'true', FIRST_SLICE_OPERATOR_AUTH_REQUIRED: 'true',
    FIRST_SLICE_PROOF_OF_WORK_SCOPES: '', FIRST_SLICE_XML_SCHEMA_PROFILE: 'legacy-compatibility' }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  let output = '';
  child.stdout.on('data', chunk => output += chunk); child.stderr.on('data', chunk => output += chunk);
  const closed = new Promise(resolve => child.once('close', resolve));
  const stop = async () => {
    await chmod(directory, 0o700);
    for (const collection of ['source-packages', 'content-releases']) await chmod(join(file + '.objects', collection), 0o700).catch(error => { if (error.code !== 'ENOENT') throw error; });
    if (child.exitCode === null && child.signalCode === null) child.send('close');
    const timer = setTimeout(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM'); }, 5000);
    try { await closed; } finally { clearTimeout(timer); await rm(directory, { force: true, recursive: true }); }
  };
  try {
    const {port} = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(Error('Owned File API startup timed out: ' + output)), 20_000);
      child.once('message', message => { clearTimeout(timeout); resolve(message); });
      child.once('error', error => { clearTimeout(timeout); reject(error); });
    });
    const base = 'http://127.0.0.1:' + port;
    assert.equal((await fetch(base + '/readyz')).status, 200, output);
    return { directory, file, base, stop, output: () => output };
  } catch (error) { await stop(); throw error; }
}

test('the real File API reports writer failure with health available and recovers after permissions are restored', async () => {
  const f = await fixture();
  try {
    await chmod(f.directory, 0o500);
    assert.equal((await fetch(f.base + '/healthz')).status, 200);
    const ready = await fetch(f.base + '/readyz');
    assert.equal(ready.status, 503); assert.equal((await ready.json()).error, 'storage_not_ready');
    const signIn = () => fetch(f.base + '/api/v1/admin/auth/sign-in', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'demo-admin', password: 'demo-admin-password' }) });
    const rejected = await signIn(); assert.equal(rejected.status, 500);
    const body = await rejected.json(); assert.equal(body.error, 'internal_server_error'); assert.equal(body.code, undefined);
    const events = () => f.output().split('\n').flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline && !events().some(event => event.event === 'http_request_failed')) await delay(10);
    for (const type of ['storage_readiness_failed', 'http_request_failed']) {
      const event = events().find(event => event.event === type); assert.ok(event, type);
      assert.equal(event.error.code, 'EACCES'); assert.equal(JSON.stringify(event).includes('demo-admin-password'), false);
    }
    await chmod(f.directory, 0o700);
    assert.equal((await fetch(f.base + '/readyz')).status, 200);
    assert.equal((await signIn()).status, 200);
  } finally { await f.stop(); }
});

test('the real File API checks a separately non-writable package directory before the first import', async () => {
  const f = await fixture(), directory = join(f.file + '.objects', 'source-packages');
  try {
    await mkdir(directory, { recursive: true }); await chmod(directory, 0o500);
    assert.equal((await fetch(f.base + '/healthz')).status, 200);
    const ready = await fetch(f.base + '/readyz'); assert.equal(ready.status, 503); assert.equal((await ready.json()).error, 'storage_not_ready');
    await chmod(directory, 0o700); assert.equal((await fetch(f.base + '/readyz')).status, 200);
  } finally { await f.stop(); }
});
