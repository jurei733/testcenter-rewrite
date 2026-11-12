import {createServer, request} from 'node:http';
import {createProductionApiServer} from '../apps/api/dist/apps/api/src/index.js';
import {bindNativeSmokeServerOwner} from './native-monitor-smoke-io.mjs';

// Actual API/store and actual TCP failures. No synthetic endpoint responses.
const backend = await createProductionApiServer();
await new Promise(resolve => backend.listen(0, '127.0.0.1', resolve));
let fault = '';
const proxy = createServer((incoming, outgoing) => {
  const path = new URL(incoming.url, 'http://localhost').pathname;
  if ((fault === 'download' && path.startsWith('/speed-test/random-package/')) ||
      (fault === 'upload' && incoming.method === 'POST' && path === '/speed-test/random-package')) {
    incoming.socket.destroy(); return;
  }
  const forwarded = request({hostname: '127.0.0.1', port: backend.address().port,
    path: incoming.url, method: incoming.method, headers: {...incoming.headers, connection: 'close'}}, response => {
    outgoing.writeHead(response.statusCode, response.headers); response.pipe(outgoing);
  });
  forwarded.on('error', () => {if (!outgoing.destroyed) outgoing.destroy();});
  outgoing.on('close', () => forwarded.destroy());
  incoming.on('aborted', () => forwarded.destroy());
  incoming.pipe(forwarded);
});
bindNativeSmokeServerOwner(proxy, {extraServers: [backend]});
process.on('message', message => {
  if (message?.nativeNetworkFault !== undefined) {
    if (!['', 'download', 'upload'].includes(message.nativeNetworkFault)) throw Error('Unknown owned network fault.');
    fault = message.nativeNetworkFault; process.send?.({configured: true, fault, id: message.id});
  }
});
await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve));
process.send?.({port: proxy.address().port});
