import {createServer, request} from 'node:http';
import {createProductionApiServer} from '../apps/api/dist/apps/api/src/index.js';
import {bindNativeSmokeServerOwner} from './native-monitor-smoke-io.mjs';

// Actual API/store and actual TCP failures. No synthetic endpoint responses.
const backend = await createProductionApiServer();
await new Promise(resolve => backend.listen(0, '127.0.0.1', resolve));
let fault = '';
let modeFault=false;
let modeHold=false;
const heldModeSockets=new Set();
let heldAssetPath='';
const heldAssets=new Set();
const forward=(incoming,outgoing)=>{
  const forwarded=request({hostname:'127.0.0.1',port:backend.address().port,path:incoming.url,method:incoming.method,headers:{...incoming.headers,connection:'close'}},response=>{
    outgoing.writeHead(response.statusCode,response.headers);response.pipe(outgoing);
  });
  forwarded.on('error',()=>{if(!outgoing.destroyed)outgoing.destroy();});outgoing.on('close',()=>forwarded.destroy());incoming.on('aborted',()=>forwarded.destroy());incoming.pipe(forwarded);
};
const proxy = createServer((incoming, outgoing) => {
  const path = new URL(incoming.url, 'http://localhost').pathname;
  if(path===heldAssetPath){
    const held={incoming,outgoing};heldAssets.add(held);outgoing.once('close',()=>heldAssets.delete(held));process.send?.({heldAssetRequest:true,path});return;
  }
  if(modeHold&&path==='/sys-check-mode'){
    heldModeSockets.add(incoming.socket);incoming.socket.once('close',()=>heldModeSockets.delete(incoming.socket));process.send?.({heldModeRequest:true});return;
  }
  if ((modeFault&&path==='/sys-check-mode') || (fault === 'download' && path.startsWith('/speed-test/random-package/')) ||
      (fault === 'upload' && incoming.method === 'POST' && path === '/speed-test/random-package')) {
    incoming.socket.destroy(); return;
  }
  forward(incoming,outgoing);
});
bindNativeSmokeServerOwner(proxy, {extraServers: [backend]});
process.on('message', message => {
  if(message?.nativeHeldAssetPath!==undefined){
    if(typeof message.nativeHeldAssetPath!=='string'||message.nativeHeldAssetPath!==''&&!/^\/app\/chunk-[A-Z0-9]+\.js$/.test(message.nativeHeldAssetPath))throw Error('Unknown owned asset hold.');
    heldAssetPath=message.nativeHeldAssetPath;if(!heldAssetPath){for(const held of heldAssets)if(!held.outgoing.destroyed)forward(held.incoming,held.outgoing);heldAssets.clear();}
    process.send?.({configured:true,heldAssetPath,id:message.id});
  }
  if(message?.nativeModeHold!==undefined){
    if(typeof message.nativeModeHold!=='boolean')throw Error('Unknown owned installation-mode hold.');
    modeHold=message.nativeModeHold;if(!modeHold){for(const socket of heldModeSockets)socket.destroy();heldModeSockets.clear();}
    process.send?.({configured:true,modeHold,id:message.id});
  }
  if(message?.nativeModeFault!==undefined){
    if(typeof message.nativeModeFault!=='boolean')throw Error('Unknown owned installation-mode fault.');
    modeFault=message.nativeModeFault;process.send?.({configured:true,modeFault,id:message.id});
  }
  if (message?.nativeNetworkFault !== undefined) {
    if (!['', 'download', 'upload'].includes(message.nativeNetworkFault)) throw Error('Unknown owned network fault.');
    fault = message.nativeNetworkFault; process.send?.({configured: true, fault, id: message.id});
  }
});
await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve));
process.send?.({port: proxy.address().port});
