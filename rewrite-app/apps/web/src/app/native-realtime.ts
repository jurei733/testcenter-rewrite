import {Observable} from 'rxjs';
export type NativeConnectionStatus='initial'|'polling-fetch'|'polling-sleep'|'ws-online'|'ws-offline'|'error';
export interface NativeRealtimeOptions<T>{
 channel:'commands'|'test-sessions';scope:AbortSignal;current:()=>boolean;
 read:(signal:AbortSignal)=>Promise<{data:T;subscribeToken:string|null}>;
 decode:(wire:string)=>T|undefined;status:(status:NativeConnectionStatus)=>void;
 error?:(error:unknown)=>void;revalidate?:()=>Promise<void>;pollingInterval?:number;retry?:Observable<unknown>;
}
/** One subscriber owns its HTTP read, socket, reconnect timer and private data. */
export function observeNativeRealtime<T>(options:NativeRealtimeOptions<T>):Observable<T>{
 return new Observable(subscriber=>{
  const owner=new AbortController(),signal=AbortSignal.any([owner.signal,options.scope]);
  let socket:WebSocket|undefined,timer:ReturnType<typeof setTimeout>|undefined,opening:ReturnType<typeof setTimeout>|undefined;
  let polling=true,reading=false;const interval=options.pollingInterval??5000;
  const current=()=>!subscriber.closed&&!signal.aborted&&options.current();
  const stopSocket=()=>{
   const old=socket;socket=undefined;clearTimeout(opening);opening=undefined;
   if(old){old.onopen=null;old.onmessage=null;old.onclose=null;old.onerror=null;try{if(old.readyState===WebSocket.OPEN)old.send(JSON.stringify({event:'unsubscribe:'+options.channel}));old.close();}catch{}}
  };
  const stop=()=>{clearInterval(ticks);clearTimeout(timer);timer=undefined;stopSocket();owner.abort();};
  const retire=()=>{stop();subscriber.complete();};
  const schedule=()=>{polling=true;};
  const reconnect=()=>{if(current())timer=setTimeout(()=>{polling=true;void poll();},interval);};
  const fallback=(expected:WebSocket,revalidate=false)=>{
   if(socket!==expected)return;stopSocket();if(!current())return;
   options.status('ws-offline');polling=false;clearTimeout(timer);
   if(revalidate&&options.revalidate)void options.revalidate().catch(()=>{}).finally(reconnect);else reconnect();
  };
  const connect=(token:string)=>{
   polling=false;const url=new URL('/ws',location.origin);url.protocol=location.protocol==='https:'?'wss:':'ws:';url.searchParams.set('token',token);
   let ws:WebSocket;try{ws=new WebSocket(url);}catch{options.status('polling-sleep');schedule();return;}socket=ws;
   opening=setTimeout(()=>fallback(ws),20000);
   ws.onopen=()=>{if(socket!==ws)return;if(!current()){stopSocket();return;}clearTimeout(opening);options.status('ws-online');ws.send(JSON.stringify({event:'subscribe:'+options.channel}));};
   ws.onmessage=event=>{
    if(!current()||socket!==ws)return;
    try{if(typeof event.data!=='string'||event.data.length>16*1024*1024)throw Error('Invalid native broadcast');const data=options.decode(event.data);if(data!==undefined)subscriber.next(data);}
    catch{fallback(ws);}
   };
   ws.onerror=()=>fallback(ws);
   ws.onclose=event=>fallback(ws,event.code===1008);
  };
  const poll=async()=>{
   if(!current()||reading)return;reading=true;stopSocket();options.status('polling-fetch');
   try{
    const response=await options.read(signal);if(!current())return;subscriber.next(response.data);if(!current())return;
    if(response.subscribeToken&&/^[A-Za-z0-9_-]{20,128}$/.test(response.subscribeToken))connect(response.subscribeToken);
    else{options.status('polling-sleep');schedule();}
   }catch(error){if(current()){options.status('error');options.error?.(error);schedule();}}finally{reading=false;}
  };
  const ticks=setInterval(()=>{if(polling&&!socket&&!reading)void poll();},interval);
  const recovery=options.retry?.subscribe(()=>{if(socket)fallback(socket);});
  options.scope.addEventListener('abort',retire,{once:true});
  if(current())void poll();else retire();
  return()=>{recovery?.unsubscribe();options.scope.removeEventListener('abort',retire);stop();};
 });
}
