import assert from 'node:assert/strict';
import test from 'node:test';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {once,EventEmitter} from 'node:events';
import {readNativeSmokeResponse, stopNativeSmokeServer, bindNativeSmokeServerOwner} from './native-monitor-smoke-io.mjs';

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

for (const event of ['SIGTERM', 'disconnect']) test('native API lease closes on owner '+event, {timeout: 5000}, async t => {
  const module = new URL('./native-monitor-smoke-io.mjs', import.meta.url).href;
  const child = spawn(process.execPath, ['--input-type=module', '-e',
    `import {createServer} from 'node:http';import {bindNativeSmokeServerOwner} from ${JSON.stringify(module)};const s=createServer((_q,r)=>r.end('owned'));bindNativeSmokeServerOwner(s);s.listen(0,'127.0.0.1',()=>process.send(s.address().port));`],
    {stdio: ['ignore', 'ignore', 'ignore', 'ipc']});
  t.after(() => {if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');});
  const [port] = await once(child, 'message');
  assert.equal((await readNativeSmokeResponse('http://127.0.0.1:'+port)).text, 'owned');
  const closed = once(child, 'exit');
  if (event === 'disconnect') child.disconnect(); else child.kill('SIGTERM');
  const [code] = await closed;assert.equal(code, 0);
  await assert.rejects(readNativeSmokeResponse('http://127.0.0.1:'+port, {}, {timeoutMs: 200}));
});
test('native API lease has a finite failure when server shutdown stalls', async () => {
  const owner = new EventEmitter(), exited = once(owner, 'exit-result');owner.exit = code => owner.emit('exit-result', code);
  let closes = 0, connections = 0;
  bindNativeSmokeServerOwner({closeAllConnections(){connections++;}, close(){closes++;}}, {owner, graceMs: 40});
  owner.emit('disconnect');owner.emit('SIGTERM');
  assert.deepEqual(await exited, [1]);assert.equal(closes, 1);assert.equal(connections, 1);
});

test('native proxy lease closes both owned servers and waits for both completions',()=>{
 const owner=new EventEmitter(),exits=[],closed=[],connections=[];owner.exit=code=>exits.push(code);const callbacks=[];
 const server=id=>({closeAllConnections(){connections.push(id);},close(done){closed.push(id);callbacks.push(done);}});
 bindNativeSmokeServerOwner(server('proxy'),{owner,extraServers:[server('backend')]});owner.emit('disconnect');owner.emit('SIGTERM');assert.deepEqual(connections,['proxy','backend']);assert.deepEqual(closed,['proxy','backend']);
 callbacks[0]();assert.deepEqual(exits,[]);callbacks[1]();assert.deepEqual(exits,[0]);
});
test('native proxy deadline cannot later report success when a stalled extra server finally completes',async()=>{
 const owner=new EventEmitter(),exits=[],callbacks=[];owner.exit=code=>exits.push(code);
 const server={closeAllConnections(){},close(done){callbacks.push(done);}};
 bindNativeSmokeServerOwner(server,{owner,graceMs:20,extraServers:[server]});owner.emit('disconnect');await new Promise(done=>setTimeout(done,40));assert.deepEqual(exits,[1]);for(const callback of callbacks)callback();assert.deepEqual(exits,[1]);
});
