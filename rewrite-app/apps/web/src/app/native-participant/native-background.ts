import {createRuntime,snapshot,unitLock,type NativeSaveRuntime} from '../../native-save-runtime/runtime.js';

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
 private actor='';private readonly preferredUnits=new Map<string,string>();
 private readonly unitClaims=new Map<string,{ready:Promise<void>;release:()=>void;watch:(signal:AbortSignal)=>void}>();
 private readonly writes=new Map<string,Promise<void>>();
 private readonly recoveredTestStates=new Set<string>();
 private foregroundRecovering=false;private recoveryTail:Promise<unknown>=Promise.resolve();
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
  if(serviceWorker)void serviceWorker.ready.then(async registration=>{this.worker=registration.active??serviceWorker.controller;
   for(const testId of this.unitClaims.keys())this.post({action:'yield-units',token,testId});
   let prepared=true;await this.ready.catch(()=>{prepared=false;});
   if(owner.aborted){if(latestOwners.get(token)===owner)this.post({action:'retire',token});}else if(prepared){this.post({action:'authorize',token});this.kick();}
  }).catch(()=>{});
  serviceWorker?.addEventListener?.('message',this.onReceipt);
  owner.addEventListener('abort',this.retire,{once:true});
  window.addEventListener('online',this.onOnline);window.addEventListener('pagehide',this.onPageHide);
  const previous=grants.get(token)??Promise.resolve();this.ready=previous.catch(()=>{}).then(()=>this.prepare());grants.set(token,this.ready);void this.ready.catch(()=>{});
 }
 private async prepare():Promise<void>{
  this.owner.throwIfAborted();
  const initial=/^\/app\/native-test\/([1-9][0-9]*)/.exec(location.pathname??'');
  if(initial)await this.holdUnits(initial[1],this.owner);
  this.actor=await this.api.authorize(this.token);this.owner.throwIfAborted();
  await this.reconcile(true);this.owner.throwIfAborted();this.kick();
 }
 private reconcile(sealAll:boolean,forRecovery=false):Promise<void>{
  this.reconcileRequested++;this.sealRequested||=sealAll;
  if(this.foregroundRecovering&&!forRecovery)return Promise.resolve();
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
    this.owner.throwIfAborted();if(sealAll||changed)await this.api.putSnapshot(key,content,true,this.preferredUnits.get(value.testId));
   });
  }
 }
 private post(message:Record<string,unknown>):boolean{
  if(!this.worker)return false;this.worker.postMessage({type:'testcenter-native-save-v1',...message});return true;
 }
 private readonly retire=()=>{
  window.removeEventListener('online',this.onOnline);window.removeEventListener('pagehide',this.onPageHide);
  navigator.serviceWorker?.removeEventListener?.('message',this.onReceipt);
  for(const claim of this.unitClaims.values())claim.release();this.unitClaims.clear();
  this.post({action:'retire',token:this.token});const retired=this.ready.catch(()=>{}).then(()=>this.api.retire(this.token));grants.set(this.token,retired);void retired.catch(()=>{});
 };
 preferUnit(testId:string,alias:string):void{this.preferredUnits.set(testId,alias);}
 private preference(bucket:string){return this.preferredUnits.get(bucket.split(':').at(-2)??'');}
 holdUnits(testId:string,signal:AbortSignal):Promise<void>{
  let claim=this.unitClaims.get(testId);
  if(!claim){
   const lifetime=new AbortController(),owned=AbortSignal.any([this.owner,signal,lifetime.signal]);let release=()=>{};
   const ready=(async()=>{
    const actor=await this.api.actorHash(this.token);owned.throwIfAborted();
    this.api.yieldUnits(actor,testId);this.post({action:'yield-units',token:this.token,testId});
    await new Promise<void>((resolve,reject)=>{
     void navigator.locks.request(unitLock(actor,testId),{signal:owned},()=>new Promise<void>(done=>{
      const end=()=>{owned.removeEventListener('abort',end);done();};release=end;owned.addEventListener('abort',end,{once:true});if(owned.aborted)end();resolve();
     })).catch(reject);
    });
   })();
   const listeners=new Map<AbortSignal,()=>void>();
   const captured={ready,release:()=>{for(const [source,listener]of listeners)source.removeEventListener('abort',listener);listeners.clear();lifetime.abort();release();},watch:(source:AbortSignal)=>{
    if(listeners.has(source))return;
    const end=()=>{if(this.unitClaims.get(testId)===captured){this.unitClaims.delete(testId);captured.release();this.kick();}};
    listeners.set(source,end);source.addEventListener('abort',end,{once:true});if(source.aborted)end();
   }};claim=captured;this.unitClaims.set(testId,claim);void ready.catch(()=>{});
  }
  claim.watch(signal);return claim.ready;
 }
 releaseUnits(testId:string):void{const claim=this.unitClaims.get(testId);this.unitClaims.delete(testId);claim?.release();this.kick();}
 mirror=(bucket:string,text:string):void=>{
  if(this.owner.aborted)return;
  const previous=this.writes.get(bucket)??Promise.resolve();
  const next=previous.catch(()=>{}).then(()=>{this.owner.throwIfAborted();return this.api.putSnapshot(bucket,text,false,this.preference(bucket));});
  this.writes.set(bucket,next);void next.catch(()=>{});
 };
 seal=(bucket:string,text:string):void=>{
  if(this.owner.aborted)return;
  // The worker owns this final snapshot's transaction after page closure. It
  // never promotes an older unsealed mirror merely because a lock disappeared.
  this.post({action:'seal',bucket,text,preferredUnitAlias:this.preference(bucket)});
  const previous=this.writes.get(bucket)??Promise.resolve();
  const next=previous.catch(()=>{}).then(()=>{this.owner.throwIfAborted();return this.api.putSnapshot(bucket,text,true,this.preference(bucket));}).then(()=>{this.kick();});
  this.writes.set(bucket,next);void next.catch(()=>{});
 };
 async settled():Promise<void>{await this.ready;await Promise.all([...this.writes.values()]);}
 async recover(testId:string,operation:()=>Promise<boolean>):Promise<boolean>{
  const work=this.recoveryTail.catch(()=>{}).then(async()=>{
   await this.ready;this.owner.throwIfAborted();return this.api.runRecovery(this.actor,testId,this.owner,async()=>{
    // Receipt scans must finish before document acquisition. A later scan may
    // not briefly hold a document and make it look like a live peer's buffer.
    this.foregroundRecovering=true;
    try{
     await this.reconcile(false,true);const recovered=await operation();
     const workerRecovered=this.recoveredTestStates.delete(testId);return recovered||workerRecovered;
    }finally{this.foregroundRecovering=false;void this.reconcile(false).catch(()=>{});}
   });
  });this.recoveryTail=work;return work;
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
