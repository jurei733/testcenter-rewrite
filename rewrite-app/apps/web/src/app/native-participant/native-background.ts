import {createRuntime,snapshot,type NativeSaveRuntime} from '../../native-save-runtime/runtime.js';

const contexts=new WeakMap<AbortSignal,NativeBackgroundContext>();
const grants=new Map<string,Promise<unknown>>();
const latestOwners=new Map<string,AbortSignal>();
let runtime:NativeSaveRuntime|undefined;
const storageKeys=()=>{const keys:string[]=[];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key)keys.push(key);}return keys;};
const available=()=>typeof indexedDB!=='undefined'&&!!navigator.locks?.request&&!!crypto.subtle;

/** One captured grant owns background credentials; retiring a view only seals
 * its documents. A grant abort retires both page and worker delivery. */
export class NativeBackgroundContext {
 readonly ready:Promise<void>;
 private actor='';private preferredUnitAlias?:string;
 private readonly writes=new Map<string,Promise<void>>();
 private readonly recoveredTestStates=new Set<string>();
 private reconciling?:Promise<void>;private reconcileRequested=0;private sealRequested=false;
 private worker:ServiceWorker|null=null;
 private readonly onPageHide=()=>{this.kick();};
 private readonly onOnline=()=>{this.kick();};
 private readonly onReceipt=(event:MessageEvent)=>{
  if(event.source&&event.data?.type==='testcenter-native-save-receipt-v1'&&(event.source===this.worker||event.source===navigator.serviceWorker?.controller))void this.reconcile(false).catch(()=>{});
 };
 constructor(private readonly api:NativeSaveRuntime,private readonly token:string,private readonly owner:AbortSignal){
  const serviceWorker=navigator.serviceWorker;
  this.worker=serviceWorker?.controller??null;
  if(serviceWorker)void serviceWorker.ready.then(registration=>{this.worker=registration.active??serviceWorker.controller;
   if(owner.aborted){if(latestOwners.get(token)===owner)this.post({action:'retire',token});}else{this.post({action:'authorize',token});this.kick();}
  }).catch(()=>{});
  serviceWorker?.addEventListener?.('message',this.onReceipt);
  owner.addEventListener('abort',this.retire,{once:true});
  window.addEventListener('online',this.onOnline);window.addEventListener('pagehide',this.onPageHide);
  const previous=grants.get(token)??Promise.resolve();this.ready=previous.catch(()=>{}).then(()=>this.prepare());grants.set(token,this.ready);void this.ready.catch(()=>{});
 }
 private async prepare():Promise<void>{
  this.owner.throwIfAborted();this.actor=await this.api.authorize(this.token);this.owner.throwIfAborted();
  await this.reconcile(true);this.owner.throwIfAborted();this.kick();
 }
 private reconcile(sealAll:boolean):Promise<void>{
  this.reconcileRequested++;this.sealRequested||=sealAll;
  return this.reconciling??=(async()=>{for(;;){const observed=this.reconcileRequested,seal=this.sealRequested;this.sealRequested=false;await this.scan(seal);if(observed===this.reconcileRequested)return;}})().finally(()=>{this.reconciling=undefined;});
 }
 private async scan(sealAll:boolean):Promise<void>{
  this.owner.throwIfAborted();
  for(const key of storageKeys().filter(key=>key.startsWith('testcenter-native-')&&key.includes(':'+this.actor+':'))){
   await navigator.locks.request(key,{ifAvailable:true},async lock=>{
    if(!lock)return;this.owner.throwIfAborted();const text=localStorage.getItem(key);if(text===null)return;
    const value=snapshot(key,text);if(value.actor!==this.actor)return;
    const accepted=await this.api.readRecord(key);let content=text,changed=false;
    if(accepted?.actor===this.actor&&accepted.testId===value.testId&&accepted.receipts){
     const keep=[];for(const entry of value.document.entries){
      if(accepted.receipts[entry.id]!==await this.api.entryFingerprint(entry))keep.push(entry);
      else if(value.kind==='test'&&entry.kind==='state')this.recoveredTestStates.add(value.testId);
     }
     if(keep.length!==value.document.entries.length){
      value.document.entries=keep;value.document.revision=Math.max(value.revision,accepted.revision)+1;content=JSON.stringify(value.document);changed=true;
      this.owner.throwIfAborted();if(keep.length)localStorage.setItem(key,content);else localStorage.removeItem(key);
     }
    }
    this.owner.throwIfAborted();if(sealAll||changed)await this.api.putSnapshot(key,content,true,this.preferredUnitAlias);
   });
  }
 }
 private post(message:Record<string,unknown>):boolean{
  if(!this.worker)return false;this.worker.postMessage({type:'testcenter-native-save-v1',...message});return true;
 }
 private readonly retire=()=>{
  window.removeEventListener('online',this.onOnline);window.removeEventListener('pagehide',this.onPageHide);
  navigator.serviceWorker?.removeEventListener?.('message',this.onReceipt);
  this.post({action:'retire',token:this.token});const retired=this.ready.catch(()=>{}).then(()=>this.api.retire(this.token));grants.set(this.token,retired);void retired.catch(()=>{});
 };
 preferUnit(alias:string):void{this.preferredUnitAlias=alias;}
 mirror=(bucket:string,text:string):void=>{
  if(this.owner.aborted)return;
  const previous=this.writes.get(bucket)??Promise.resolve();
  const next=previous.catch(()=>{}).then(()=>{this.owner.throwIfAborted();return this.api.putSnapshot(bucket,text,false,this.preferredUnitAlias);});
  this.writes.set(bucket,next);void next.catch(()=>{});
 };
 seal=(bucket:string,text:string):void=>{
  if(this.owner.aborted)return;
  // The worker owns this final snapshot's transaction after page closure. It
  // never promotes an older unsealed mirror merely because a lock disappeared.
  this.post({action:'seal',bucket,text,preferredUnitAlias:this.preferredUnitAlias});
  const previous=this.writes.get(bucket)??Promise.resolve();
  const next=previous.catch(()=>{}).then(()=>{this.owner.throwIfAborted();return this.api.putSnapshot(bucket,text,true,this.preferredUnitAlias);}).then(()=>{this.kick();});
  this.writes.set(bucket,next);void next.catch(()=>{});
 };
 async settled():Promise<void>{await this.ready;await Promise.all([...this.writes.values()]);}
 async recover(testId:string,operation:()=>Promise<boolean>):Promise<boolean>{
  await this.ready;this.owner.throwIfAborted();return this.api.runRecovery(this.actor,testId,this.owner,async()=>{
   // A receipt scan may have removed the only local evidence of a Test-state
   // write after the loader's first GET. Join it before claiming documents and
   // retain that invalidation until a successful foreground recovery consumes it.
   await this.reconcile(false);const recovered=await operation();
   const workerRecovered=this.recoveredTestStates.delete(testId);return recovered||workerRecovered;
  });
 }
 kick():void{
  if(this.owner.aborted)return;
  if(!this.post({action:'drain'}))void this.api.drain().then(()=>this.reconcile(false),()=>this.reconcile(false)).catch(()=>{});
 }
}
export function nativeBackground(token:string|undefined,owner:AbortSignal):NativeBackgroundContext|undefined{
 if(!token||owner.aborted||!available())return undefined;
 let context=contexts.get(owner);
 if(!context){runtime??=createRuntime({indexedDB,crypto,locks:navigator.locks,fetch:(input,options)=>fetch(input,options),origin:location.origin});latestOwners.set(token,owner);context=new NativeBackgroundContext(runtime,token,owner);contexts.set(owner,context);}
 return context;
}
