import {createHash,randomBytes} from 'node:crypto';
import type {IncomingMessage,Server} from 'node:http';
import type {Duplex} from 'node:stream';
import {WebSocket,WebSocketServer,type RawData} from 'ws';
import {FirstSliceError,type FirstSliceServices} from '@testcenter-rewrite-app/application';

type Target={channel:'commands';testNumber:string}|{channel:'test-sessions';groupKey?:string};
type Ticket={target:Target;credential:string;expires:number};
type Peer={ws:WebSocket;ticket:Ticket;subscribed:boolean;retired:boolean;reading:boolean;dirty:boolean;alive:boolean;deadline?:ReturnType<typeof setTimeout>;wire?:string};
type Track=<T>(operation:()=>Promise<T>)=>Promise<T>;
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
const maxPeers=10000,maxPendingPerOwner=4,maxWireBytes=16*1024*1024;

/** Source SubscribeToken / event+data protocol, with process-owned private leases. */
export class NativeBroadcaster {
 private readonly tickets=new Map<string,Ticket>();
 private readonly peers=new Set<Peer>();
 private readonly sockets=new Set<Duplex>();
 private readonly wss=new WebSocketServer({noServer:true,maxPayload:4096,perMessageDeflate:false});
 private readonly interval:ReturnType<typeof setInterval>;
 private server:Server|undefined;
 private closed=false;
 private lastHeartbeat=Date.now();
 private upgrading=0;
 constructor(private readonly services:FirstSliceServices,private readonly track:Track,private readonly report:(stage:'read'|'cleanup')=>void=()=>{}){
  this.interval=setInterval(()=>this.sweep(),1000);this.interval.unref();
 }
 attach(server:Server){this.server=server;server.on('upgrade',this.upgrade);}
 async issue(target:Target,credential:string):Promise<string|undefined>{
  if(this.closed)return;
  await this.services.originalSession.read({token:credential});
  if(this.closed)return;
  this.expire();
  const owner=JSON.stringify([credential,target]);
  const pending=[...this.tickets].filter(([,ticket])=>JSON.stringify([ticket.credential,ticket.target])===owner);
  while(pending.length>=maxPendingPerOwner)this.tickets.delete(pending.shift()![0]);
  if(this.tickets.size+this.wss.clients.size+this.upgrading>=maxPeers)return;
  const token=randomBytes(32).toString('base64url');
  this.tickets.set(digest(token),{target:{...target},credential,expires:Date.now()+30000});
  return token;
 }
 /** A successful HTTP commit wakes readers immediately; the sweep also observes other processes. */
 wake(){for(const peer of this.peers){peer.dirty=true;void this.publish(peer);}}
 close(){
  if(this.closed)return;this.closed=true;clearInterval(this.interval);this.tickets.clear();
  this.server?.removeListener('upgrade',this.upgrade);
  for(const socket of this.sockets)socket.destroy();this.sockets.clear();
  for(const peer of [...this.peers]){this.retire(peer);peer.ws.terminate();}
  for(const ws of this.wss.clients)ws.terminate();
  this.wss.close();
 }
 private expire(){const now=Date.now();for(const [key,ticket]of this.tickets)if(ticket.expires<=now)this.tickets.delete(key);}
 private async authorize(ticket:Ticket){
  await this.services.originalSession.read({token:ticket.credential});
  const target=ticket.target;
  if(target.channel==='commands')await this.services.originalCommand.requireOwner({token:ticket.credential,testNumber:target.testNumber});
  else await this.services.originalMonitor.requireMonitor({token:ticket.credential,groupKey:target.groupKey});
 }
 private reject(socket:Duplex,status=403){if(!socket.destroyed)socket.end(`HTTP/1.1 ${status} Rejected\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);}
 private upgrade=(request:IncomingMessage,socket:Duplex,head:Buffer)=>{
  socket.on('error',()=>{});
  let url:URL,origin:URL;try{url=new URL(request.url??'','http://native.invalid');origin=new URL(String(request.headers.origin));}catch{this.reject(socket);return;}
  const token=url.searchParams.get('token');
  if(this.closed||url.pathname!=='/ws'||request.method!=='GET'||url.searchParams.size!==1||!token||!/^[A-Za-z0-9_-]{43}$/.test(token)||
    !['http:','https:'].includes(origin.protocol)||origin.origin!==request.headers.origin||origin.host.toLowerCase()!==request.headers.host?.toLowerCase()){
   this.reject(socket);return;
  }
  this.expire();const key=digest(token),ticket=this.tickets.get(key);this.tickets.delete(key);
  if(!ticket||this.wss.clients.size+this.upgrading>=maxPeers){this.reject(socket);return;}
  this.upgrading++;this.sockets.add(socket);
  const timeout=setTimeout(()=>socket.destroy(),20000);timeout.unref();
  void this.track(async()=>{
   try{
    await this.authorize(ticket);
    if(this.closed||socket.destroyed)return;
    this.wss.handleUpgrade(request,socket,head,ws=>{
     const peer:Peer={ws,ticket,subscribed:false,retired:false,reading:false,dirty:true,alive:true};this.peers.add(peer);
     ws.on('error',()=>{});ws.on('close',()=>this.retire(peer));ws.on('pong',()=>{peer.alive=true;});
     ws.on('message',(data,isBinary)=>this.receive(peer,data,isBinary));
     // Even an authenticated peer must subscribe promptly; never retain an idle capability indefinitely.
     const subscribeTimeout=setTimeout(()=>{if(!peer.subscribed){this.retire(peer);ws.terminate();}},30000);subscribeTimeout.unref();ws.once('close',()=>clearTimeout(subscribeTimeout));
    });
   }catch{this.reject(socket);}
   finally{clearTimeout(timeout);this.upgrading--;this.sockets.delete(socket);}
  });
 };
 private receive(peer:Peer,data:RawData,isBinary:boolean){
  if(peer.retired||this.closed)return;
  let message:unknown;try{if(isBinary)throw Error();message=JSON.parse(data.toString());}catch{peer.ws.close(1008,'Invalid subscription');return;}
  if(!message||typeof message!=='object'||Array.isArray(message)||Object.keys(message).length!==1){peer.ws.close(1008,'Invalid subscription');return;}
  const event=(message as {event?:unknown}).event;
  if(event==='subscribe:'+peer.ticket.target.channel){peer.subscribed=true;peer.dirty=true;void this.publish(peer);}
  else if(event==='unsubscribe:'+peer.ticket.target.channel){this.retire(peer);peer.ws.close(1000);}
  else peer.ws.close(1008,'Invalid channel');
 }
 private async publish(peer:Peer){
  if(this.closed||peer.retired||!peer.subscribed||peer.ws.readyState!==WebSocket.OPEN)return;
  if(peer.reading){peer.dirty=true;return;}
  peer.reading=true;peer.dirty=false;
  peer.deadline=setTimeout(()=>{if(!peer.retired){this.report('read');this.retire(peer);peer.ws.terminate();}},20000);peer.deadline.unref();
  try{
   await this.track(async()=>{
    await this.authorize(peer.ticket);
    const target=peer.ticket.target,wire=target.channel==='commands'
     ?await this.services.originalCommand.pending({token:peer.ticket.credential,testNumber:target.testNumber})
     :await this.services.originalMonitor.sessions({token:peer.ticket.credential,groupKey:target.groupKey});
    if(this.closed||peer.retired||peer.ws.readyState!==WebSocket.OPEN||wire===peer.wire)return;
    if(Buffer.byteLength(wire)>maxWireBytes||peer.ws.bufferedAmount>maxWireBytes){peer.ws.close(1013,'Use polling');return;}
    // Do not parse/re-serialize native signed-int64 IDs through JavaScript Number.
    peer.ws.send('{"event":'+JSON.stringify(target.channel)+',"data":'+wire+'}');peer.wire=wire;
   });
  }catch(error){if(!peer.retired&&!this.closed){const forbidden=error instanceof FirstSliceError&&[401,403,409].includes(error.statusCode);if(!forbidden)this.report('read');peer.ws.close(forbidden?1008:1013,forbidden?'Access unavailable':'Use polling');}}
  finally{clearTimeout(peer.deadline);peer.deadline=undefined;peer.reading=false;if(peer.dirty&&!peer.retired&&!this.closed)queueMicrotask(()=>void this.publish(peer));}
 }
 private retire(peer:Peer){
  if(peer.retired)return;peer.retired=true;clearTimeout(peer.deadline);peer.deadline=undefined;this.peers.delete(peer);
  const target=peer.ticket.target;
  if(target.channel==='commands'){
   const stillDisconnected=()=>![...this.peers].some(other=>!other.retired&&other.ticket.target.channel==='commands'&&other.ticket.target.testNumber===target.testNumber);
   if(stillDisconnected())void this.track(async()=>{
    try{await this.services.originalCommand.connectionLost({token:peer.ticket.credential,testNumber:target.testNumber,stillDisconnected});this.wake();}catch(error){if(!(error instanceof FirstSliceError)||![401,403,409].includes(error.statusCode))this.report('cleanup');}
   });
  }
 }
 private sweep(){
  if(this.closed)return;this.expire();this.wake();
  if(Date.now()-this.lastHeartbeat<30000)return;this.lastHeartbeat=Date.now();
  for(const peer of [...this.peers]){
   if(!peer.alive){this.retire(peer);peer.ws.terminate();continue;}
   peer.alive=false;peer.ws.ping();
  }
 }
}
