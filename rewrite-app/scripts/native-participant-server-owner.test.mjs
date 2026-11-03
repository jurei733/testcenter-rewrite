import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
const app=fileURLToPath(new URL('..',import.meta.url));
test('the actual participant fault proxy and backend retire when their IPC owner disappears',{timeout:10000},async t=>{
 const child=spawn(process.execPath,['scripts/native-participant-server.mjs'],{cwd:app,stdio:['ignore','ignore','ignore','ipc'],env:{...process.env,FIRST_SLICE_STORE:'memory',FIRST_SLICE_BOOTSTRAP_DEMO:'false',FIRST_SLICE_NATIVE_WEBSOCKET_ENABLED:'false'}});
 t.after(()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');});const [{port}]=await once(child,'message');assert.ok(Number.isInteger(port));const exit=once(child,'exit');child.disconnect();const [code]=await exit;assert.equal(code,0);await assert.rejects(fetch('http://127.0.0.1:'+port,{signal:AbortSignal.timeout(1000)}));
});
