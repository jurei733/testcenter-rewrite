import assert from 'node:assert/strict';
import test from 'node:test';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {readNativeSmokeResponse, stopNativeSmokeServer} from './native-monitor-smoke-io.mjs';

async function serverFixture(t, handle) {
  const server = createServer(handle);
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  t.after(async () => {
    const stopped = new Promise(done => server.close(done));
    server.closeAllConnections(); await stopped;
  });
  return 'http://127.0.0.1:' + server.address().port;
}

for (const stage of ['headers', 'body']) test('native smoke bounds stalled ' + stage, async t => {
  const url = await serverFixture(t, (_request, response) => {
    if (stage === 'body') {response.writeHead(200); response.write('{');}
  });
  await assert.rejects(readNativeSmokeResponse(url, {}, {timeoutMs: 40}), /Owned native request timed out/);
});

test('native smoke reads the whole body and preserves native credentials and status', async t => {
  const url = await serverFixture(t, (request, response) => {
    assert.equal(request.headers.authtoken, 'owned-token');
    assert.equal(request.headers.authorization, undefined);
    response.writeHead(201); response.write('{"owned":'); response.end('true}');
  });
  assert.deepEqual(await readNativeSmokeResponse(url, {headers: {AuthToken: 'owned-token'}}),
    {ok: true, status: 201, text: '{"owned":true}'});
});

test('native smoke preserves transport errors without waiting for its deadline', async () => {
  const failure = Error('Owned transport failure');
  await assert.rejects(readNativeSmokeResponse('http://owned.invalid', {}, {
    fetchImpl: async () => {throw failure;}
  }), error => error === failure);
});

test('native smoke escalates an actual owned child that ignores SIGTERM and still fails', async t => {
  const child = spawn(process.execPath, ['-e',
    "process.on('SIGTERM',()=>{});process.send('ready');setInterval(()=>{},1000)"],
  {stdio: ['ignore', 'ignore', 'ignore', 'ipc']});
  t.after(() => {if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');});
  await once(child, 'message');
  await assert.rejects(stopNativeSmokeServer(child, {timeoutMs: 40}), /shutdown timed out/);
  assert.equal(child.signalCode, 'SIGKILL');
});

test('native smoke accepts a clean owned child shutdown', async () => {
  const child = spawn(process.execPath, ['-e', "process.send('ready');setInterval(()=>{},1000)"],
    {stdio: ['ignore', 'ignore', 'ignore', 'ipc']});
  await once(child, 'message'); await stopNativeSmokeServer(child);
  assert.equal(child.signalCode, 'SIGTERM');
});
