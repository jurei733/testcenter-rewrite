import assert from 'node:assert/strict';
import {createProductionApiServer} from '../apps/api/dist/apps/api/src/index.js';
import {bindNativeSmokeServerOwner} from './native-monitor-smoke-io.mjs';
const server=await createProductionApiServer(),sockets=new Set();let blocked=false,phase='online',ackPhase='',ackFailures=0;
const [apiRequest,...otherRequests]=server.listeners('request');assert.equal(typeof apiRequest,'function');assert.deepEqual(otherRequests,[]);server.removeListener('request',apiRequest);
const heldAcks=new Map();
// Fail or hold before entering the real API handler, so an injected 503 cannot
// acknowledge a command or commit a business effect behind the browser's back.
server.on('request',(request,response)=>{
 const path=new URL(request.url,'http://owned.invalid').pathname;
 if(request.method==='PATCH'&&/^\/test\/[^/]+\/command\/[^/]+\/executed$/.test(path)){
  const record={phase:ackPhase,path,hasNativeToken:!!request.headers.authtoken};response.once('finish',()=>process.send?.({nativeWsAck:{...record,status:response.statusCode}}));
  if(ackPhase){
   if(ackFailures>0){ackFailures--;request.resume();response.writeHead(503,{'Content-Type':'text/plain','error-id':'OWNED-WS-ACK-FAILURE','test-mode':'integration'}).end('Owned temporary ACK failure');return;}
   const value={request,response};heldAcks.set(ackPhase,value);
   response.once('close',()=>{if(heldAcks.get(record.phase)===value)heldAcks.delete(record.phase);});process.send?.({nativeWsAckHeld:ackPhase});return;
  }
 }
 apiRequest.call(server,request,response);
});
server.prependListener('upgrade',(request,socket)=>{
 process.send?.({nativeWsUpgrade:{phase,path:new URL(request.url,'http://owned.invalid').pathname}});
 if(blocked){socket.destroy();return;}sockets.add(socket);socket.once('close',()=>sockets.delete(socket));
});
server.on('request',(request,response)=>{
 const path=new URL(request.url,'http://owned.invalid').pathname;
 if(request.method==='GET'&&(/^\/test\/[^/]+\/commands$/.test(path)||/^\/monitor\/group\/[^/]+\/test-sessions$/.test(path)))
  response.once('finish',()=>process.send?.({nativeWsPoll:{phase,path,status:response.statusCode}}));
});
process.on('message',message=>{
 if(message?.nativeWsAckFault){ackPhase=message.nativeWsAckFault.phase;ackFailures=message.nativeWsAckFault.failures;assert.ok(Number.isSafeInteger(ackFailures)&&ackFailures>=0);process.send?.({nativeWsAckFaultReady:ackPhase});}
 if(message?.nativeWsAckRelease){const value=heldAcks.get(message.nativeWsAckRelease);heldAcks.delete(message.nativeWsAckRelease);ackPhase='';ackFailures=0;if(value&&!value.response.destroyed&&!value.request.aborted)apiRequest.call(server,value.request,value.response);process.send?.({nativeWsAckReleased:message.nativeWsAckRelease,released:!!value});}
 if(message?.nativeWsControl){const control=message.nativeWsControl;blocked=control.blocked;phase=control.phase;const dropped=control.drop?sockets.size:0;if(control.drop)for(const socket of sockets)socket.destroy();process.send?.({nativeWsControlReady:phase,dropped});}
});
bindNativeSmokeServerOwner(server);server.listen(0,'127.0.0.1',()=>process.send?.({port:server.address().port}));
