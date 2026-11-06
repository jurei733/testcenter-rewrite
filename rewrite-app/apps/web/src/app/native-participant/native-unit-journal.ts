export const NATIVE_UNIT_JOURNAL_PREFIX='testcenter-native-unit-journal:v1:';
const maxUnits=200,maxEntries=10_000,maxChars=4_500_000;
// Synchronous browser storage keeps its existing small budget. A live view may
// retain a larger bounded overlay while prior packets consume that budget;
// callers must expose that overlay as unsecured and protect departure.
const maxUnsecuredChars=64*1024*1024;
type Kind='state'|'response'|'log';
type Entry={id:string;kind:Kind;unitAlias:string;originalUnitId:string;queuedAt:number;phase:'staged'|'ready';payload:string};
type Document={version:1;actor:string;testId:string;entries:Entry[];revision?:number};
export type NativeUnitDelivery=Readonly<Entry&{bucket:string}>;
type Lease={release:()=>void};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const failure=()=>new Error('Die Antwort konnte nicht im lokalen Speicher gesichert werden. Bitte diesen Tab geöffnet lassen und den Speicher prüfen.');

/** Only Unit writes belong here. Test controller state and command ACKs have
 * different ordering contracts. The journal never starts a flush timer. */
export class NativeUnitJournal {
 private readonly leases=new Map<string,Lease>();
 private closed=false;
 private unsecuredOwn?:Document;
 private readonly revisions=new Map<string,number>();
 private constructor(private readonly storage:Storage,private readonly locks:LockManager,private readonly crypto:Crypto,private readonly actor:string,private readonly testId:string,private readonly prefix:string,private readonly ownBucket:string,
  private readonly mirror?:(key:string,text:string)=>void,private readonly seal?:(key:string,text:string)=>void,
  private readonly retainUnsecured=false,private readonly unsecuredChanged?:(pending:boolean)=>void){}

 static async open(input:{token:string;testId:string;storage:Storage;locks:LockManager;crypto:Crypto;retainUnsecured?:boolean;unsecuredChanged?:(pending:boolean)=>void;mirror?:(key:string,text:string)=>void;seal?:(key:string,text:string)=>void}):Promise<NativeUnitJournal>{
  if(!input.token||!/^[1-9]\d*$/.test(input.testId)||BigInt(input.testId)>9223372036854775807n||!input.locks?.request||!input.crypto?.subtle||!input.crypto.randomUUID)throw failure();
  const hash=await input.crypto.subtle.digest('SHA-256',new TextEncoder().encode(input.token));
  const actor=Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join('');
  const prefix=NATIVE_UNIT_JOURNAL_PREFIX+actor+':'+input.testId+':';
  const journal=new NativeUnitJournal(input.storage,input.locks,input.crypto,actor,input.testId,prefix,prefix+input.crypto.randomUUID(),input.mirror,input.seal,input.retainUnsecured,input.unsecuredChanged);
  try{
   // A lock lives only as long as this document. Reload/crash releases it; an
   // active peer tab retains its own buffer window and cannot be replayed here.
   for(const key of journal.keys().filter(key=>key.startsWith(prefix)))if(await journal.claim(key))journal.read(key);
   if(!await journal.claim(journal.ownBucket))throw failure();
   return journal;
  }catch{journal.close();throw failure();}
 }

 close():void{if(this.closed)return;
  for(const key of this.leases.keys())try{const doc=key===this.ownBucket&&this.unsecuredOwn?this.readStored(key):this.read(key);if(doc.entries.length||(doc.revision??0)>0)this.seal?.(key,JSON.stringify(doc));}catch{/* Keep the original local bytes if final mirroring is unavailable. */}
  this.closed=true;for(const lease of this.leases.values())lease.release();this.leases.clear();}
 private current():void{if(this.closed)throw failure();}
 private keys():string[]{const keys:string[]=[];for(let i=0;i<this.storage.length;i++){const key=this.storage.key(i);if(key)keys.push(key);}return keys;}
 private claim(key:string):Promise<boolean>{
  return new Promise((resolve,reject)=>{
   const held=this.locks.request(key,{ifAvailable:true},lock=>{
    if(!lock){resolve(false);return;}
    if(this.closed){resolve(false);return;}
    return new Promise<void>(release=>{this.leases.set(key,{release});resolve(true);});
   });
   void held.catch(reject);
  });
 }
 get hasUnsecured():boolean{return !!this.unsecuredOwn;}
 retryPersistence():void{if(this.unsecuredOwn)this.write(this.ownBucket,this.read(this.ownBucket));}
 unsecuredDeliveries(preferredUnitAlias?:string):NativeUnitDelivery[]{return this.unsecuredOwn?this.readyOwnDeliveries(preferredUnitAlias):[];}
 readyOwnDeliveries(preferredUnitAlias?:string):NativeUnitDelivery[]{
  return this.read(this.ownBucket).entries.filter(row=>row.phase==='ready').map(row=>Object.freeze({...row,bucket:this.ownBucket})).sort((a,b)=>Number(b.unitAlias===preferredUnitAlias)-Number(a.unitAlias===preferredUnitAlias)||a.queuedAt-b.queuedAt);
 }
 private read(key:string):Document{
  this.current();if(key===this.ownBucket&&this.unsecuredOwn)return structuredClone(this.unsecuredOwn);
  return this.readStored(key);
 }
 private readStored(key:string):Document{
  this.current();if(!this.leases.has(key)||!key.startsWith(this.prefix)||!uuid.test(key.slice(this.prefix.length)))throw failure();
  const text=this.storage.getItem(key);
  if(text===null)return{version:1,actor:this.actor,testId:this.testId,entries:[],revision:this.revisions.get(key)??0};
  if(text.length>maxChars)throw failure();
  const doc=this.validate(JSON.parse(text));this.revisions.set(key,Math.max(this.revisions.get(key)??0,doc.revision??0));return doc;
 }
 private validate(doc:Document):Document{
  if(!doc||doc.version!==1||doc.actor!==this.actor||doc.testId!==this.testId||doc.revision!==undefined&&(!Number.isSafeInteger(doc.revision)||doc.revision<0)||!Array.isArray(doc.entries)||doc.entries.length>maxEntries||new Set(doc.entries.map(row=>row?.id)).size!==doc.entries.length)throw failure();
  for(const row of doc.entries){
   if(!row||!uuid.test(row.id)||!['state','response','log'].includes(row.kind)||!['staged','ready'].includes(row.phase)||
    typeof row.unitAlias!=='string'||!row.unitAlias.length||Array.from(row.unitAlias).length>255||/[\/\\\u0000-\u001f\u007f]/.test(row.unitAlias)||
    typeof row.originalUnitId!=='string'||Array.from(row.originalUnitId).length>255||!Number.isSafeInteger(row.queuedAt)||row.queuedAt<0||typeof row.payload!=='string')throw failure();
   const body=JSON.parse(row.payload);
   if(!body||typeof body!=='object'||Array.isArray(body)||body.originalUnitId!==row.originalUnitId||
    row.kind==='response'&&(!Number.isSafeInteger(body.timeStamp)||!body.dataParts||typeof body.dataParts!=='object'||Array.isArray(body.dataParts)||typeof body.responseType!=='string')||
    row.kind==='state'&&!Array.isArray(body.newState)||row.kind==='log'&&!Array.isArray(body.logEntries))throw failure();
  }
  return doc;
 }
 private write(key:string,doc:Document):void{
  this.current();const revision=Math.max(this.revisions.get(key)??0,doc.revision??0)+1;if(!Number.isSafeInteger(revision))throw failure();doc={...doc,revision};this.validate(doc);
  const serialized=JSON.stringify(doc);if(serialized.length>(this.retainUnsecured&&key===this.ownBucket?maxUnsecuredChars:maxChars))throw failure();
  const identity=(bucket:string,alias:string)=>bucket.slice(0,bucket.lastIndexOf(':'))+':'+alias;
  let chars=0,count=doc.entries.length;const units=new Set(doc.entries.map(row=>identity(key,row.unitAlias))),before=new Set<string>();
  for(const existing of this.keys().filter(name=>name.startsWith(NATIVE_UNIT_JOURNAL_PREFIX))){
   const value=this.storage.getItem(existing);if(value===null)continue;const peer=JSON.parse(value);if(!Array.isArray(peer?.entries))throw failure();
   for(const row of peer.entries){if(typeof row?.unitAlias!=='string')throw failure();before.add(identity(existing,row.unitAlias));if(existing!==key)units.add(identity(existing,row.unitAlias));}
   if(existing!==key){chars+=value.length;if(existing.startsWith(this.prefix))count+=peer.entries.length;}
  }
  const capacity=doc.entries.length>0&&(units.size>maxUnits&&units.size>before.size||count>maxEntries||chars+serialized.length>maxChars);
  let persisted=false;
  if(!capacity)try{if(doc.entries.length)this.storage.setItem(key,serialized);else this.storage.removeItem(key);persisted=true;}catch{/* Retain only this view's latest document when the caller can expose that it is not durable. */}
  if(!persisted){
   if(!this.retainUnsecured||key!==this.ownBucket||new Set(doc.entries.map(row=>row.unitAlias)).size>maxUnits)throw failure();
   this.unsecuredOwn=structuredClone(doc);this.revisions.set(key,revision);this.unsecuredChanged?.(true);return;
  }
  if(key===this.ownBucket){this.unsecuredOwn=undefined;this.unsecuredChanged?.(false);}
  this.revisions.set(key,revision);this.mirror?.(key,serialized);
 }
 private stage(kind:Kind,unitAlias:string,originalUnitId:string,body:Record<string,unknown>,now:number):void{
  const doc=this.read(this.ownBucket),previous=doc.entries.find(row=>row.phase==='staged'&&row.kind===kind&&row.unitAlias===unitAlias);
  const merged=previous?JSON.parse(previous.payload):undefined;
  if(previous&&previous.originalUnitId!==originalUnitId)throw failure();
  if(merged){
   if(kind==='response'){body={...body,dataParts:{...merged.dataParts,...body.dataParts as object},responseType:merged.responseType,timeStamp:Math.max(merged.timeStamp,now)};}
   else if(kind==='state')body={...body,newState:[...merged.newState,...body.newState as unknown[]]};
   else body={...body,logEntries:[...merged.logEntries,...body.logEntries as unknown[]]};
  }
  const entry:Entry={id:previous?.id??this.crypto.randomUUID(),kind,unitAlias,originalUnitId,queuedAt:previous?.queuedAt??now,phase:'staged',payload:JSON.stringify(body)};
  doc.entries=doc.entries.filter(row=>row!==previous);doc.entries.push(entry);this.write(this.ownBucket,doc);
 }
 captureResponse(unitAlias:string,originalUnitId:string,dataParts:Record<string,string>,responseType:string,now=Date.now()):void{
  this.stage('response',unitAlias,originalUnitId,{timeStamp:now,dataParts,responseType,originalUnitId},now);
 }
 captureState(unitAlias:string,originalUnitId:string,newState:unknown[],now=Date.now()):void{
  this.stage('state',unitAlias,originalUnitId,{newState,originalUnitId},now);
 }
 freeze(kind:Kind,unitAlias:string,body:Record<string,unknown>):NativeUnitDelivery{
  const doc=this.read(this.ownBucket),previous=doc.entries.find(row=>row.phase==='staged'&&row.kind===kind&&row.unitAlias===unitAlias);
  const entry:Entry={id:previous?.id??this.crypto.randomUUID(),kind,unitAlias,originalUnitId:String(body.originalUnitId??''),queuedAt:previous?.queuedAt??Date.now(),phase:'ready',payload:JSON.stringify(body)};
  doc.entries=doc.entries.filter(row=>row!==previous);doc.entries.push(entry);this.write(this.ownBucket,doc);
  return Object.freeze({...entry,bucket:this.ownBucket});
 }
 snapshot(unitAlias:string):NativeUnitDelivery[]{
  const pending:NativeUnitDelivery[]=[];
  for(const key of this.leases.keys())for(const row of this.read(key).entries)if(row.unitAlias===unitAlias)pending.push(Object.freeze({...row,bucket:key}));
  return pending.sort((a,b)=>a.queuedAt-b.queuedAt);
 }
 recoveries(preferredUnitAlias?:string):NativeUnitDelivery[]{
  const pending:NativeUnitDelivery[]=[];
  for(const key of this.leases.keys()){
   if(key===this.ownBucket)continue;
   const doc=this.read(key);if(!doc.entries.length)continue;
   for(const row of doc.entries){row.phase='ready';pending.push(Object.freeze({...row,bucket:key}));}
   this.write(key,doc);
  }
  // Recreate any captured Unit state before its responses. Existing independent
  // field clocks arbitrate unsent older state/answers against newer remote data.
  return pending.sort((a,b)=>Number(b.unitAlias===preferredUnitAlias)-Number(a.unitAlias===preferredUnitAlias)||(a.kind==='state'?0:1)-(b.kind==='state'?0:1)||a.queuedAt-b.queuedAt);
 }
 acknowledge(delivery:NativeUnitDelivery):void{
  const doc=this.read(delivery.bucket),row=doc.entries.find(entry=>entry.id===delivery.id);
  if(!row)return;
  if(row.kind!==delivery.kind||row.unitAlias!==delivery.unitAlias||row.payload!==delivery.payload||row.phase!=='ready')throw failure();
  doc.entries=doc.entries.filter(entry=>entry.id!==delivery.id);this.write(delivery.bucket,doc);
 }
}
