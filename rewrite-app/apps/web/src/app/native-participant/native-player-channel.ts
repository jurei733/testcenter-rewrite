export interface NativePlayerLease {
 readonly nonce:string;
 readonly alias:string;
 readonly frame:HTMLIFrameElement;
 readonly current:()=>boolean;
 readonly signal:AbortSignal;
 state:'waiting'|'preparing'|'active'|'retired';
}
const types=new Set(['vopReadyNotification','vopStateChangedNotification','vopUnitNavigationRequestedNotification','vopWindowFocusChangedNotification','vopRuntimeErrorNotification']);
/** One opaque, actor/run-owned channel. No ambient window or alias-only trust. */
export class NativePlayerChannel {
 private lease:NativePlayerLease|undefined;
 private readonly lifetimes=new WeakMap<NativePlayerLease,AbortController>();
 private readonly holds=new WeakMap<NativePlayerLease,{previous:boolean;tokens:Set<symbol>}>();
 private readonly retire=()=>this.clear();
 constructor(private readonly scope:AbortSignal,private readonly current:()=>boolean){scope.addEventListener('abort',this.retire,{once:true});}
 bind(frame:HTMLIFrameElement,alias:string,current:()=>boolean):NativePlayerLease{
  this.clear();const lifetime=new AbortController();const lease:NativePlayerLease={nonce:crypto.randomUUID(),alias,frame,current,signal:lifetime.signal,state:'waiting'};this.lifetimes.set(lease,lifetime);
  if(this.scope.aborted||!this.current()){lease.state='retired';frame.remove();lifetime.abort();return lease;}
  this.lease=lease;return lease;
 }
 isCurrent(lease:NativePlayerLease):boolean{return this.lease===lease&&lease.state!=='retired'&&!this.scope.aborted&&this.current()&&lease.current()&&lease.frame.isConnected&&!!lease.frame.contentWindow;}
 ownedLease():NativePlayerLease|undefined{return this.lease&&this.isCurrent(this.lease)?this.lease:undefined;}
 receive(event:MessageEvent):{lease:NativePlayerLease;message:Record<string,any>}|undefined{
  const lease=this.lease,data:unknown=event.data;
  if(!lease||!this.isCurrent(lease)||event.source!==lease.frame.contentWindow||event.origin!=='null'||!data||typeof data!=='object'||Array.isArray(data))return;
  const message=data as Record<string,any>;if(typeof message['type']!=='string'||!types.has(message['type']))return;
  if(message['type']==='vopReadyNotification'){
   if(lease.state!=='waiting')return;
  }else{
   if(lease.state!=='active')return;
   if(message['type']==='vopWindowFocusChangedNotification'){
    if(typeof message['hasFocus']!=='boolean'||(message['sessionId']!==undefined&&message['sessionId']!==lease.nonce))return;
   }else if(message['sessionId']!==lease.nonce)return;
  }
  return {lease,message:{...message,sessionId:lease.alias}};
 }
 beginReady(lease:NativePlayerLease):boolean{if(!this.isCurrent(lease)||lease.state!=='waiting')return false;lease.state='preparing';return true;}
 completeReady(lease:NativePlayerLease):boolean{if(!this.isCurrent(lease)||lease.state!=='preparing')return false;lease.state='active';return true;}
 send(message:unknown):void{
  const lease=this.lease;if(!lease||!this.isCurrent(lease)||lease.state!=='active'||!message||typeof message!=='object'||Array.isArray(message))return;
  const data=message as Record<string,unknown>;if(data['sessionId']!==lease.alias)return;
  // Opaque sandbox origins require '*'; the target is the bound private frame.
  lease.frame.contentWindow!.postMessage({...data,sessionId:lease.nonce},'*');
 }
 hold():()=>void{
  const lease=this.lease;if(!lease||!this.isCurrent(lease))return()=>{};
  const state=this.holds.get(lease)??{previous:!!lease.frame.inert,tokens:new Set<symbol>()},token=Symbol();
  state.tokens.add(token);this.holds.set(lease,state);lease.frame.inert=true;
  return()=>{if(!state.tokens.delete(token)||state.tokens.size)return;if(this.isCurrent(lease))lease.frame.inert=state.previous;this.holds.delete(lease);};
 }
 clear(expected?:NativePlayerLease):void{if(expected&&this.lease!==expected)return;const lease=this.lease;this.lease=undefined;if(lease){lease.state='retired';lease.frame.remove();this.lifetimes.get(lease)?.abort();this.lifetimes.delete(lease);}}
 destroy():void{this.scope.removeEventListener('abort',this.retire);this.clear();}
}
