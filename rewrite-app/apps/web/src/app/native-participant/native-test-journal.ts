export const NATIVE_TEST_JOURNAL_PREFIX = 'testcenter-native-test-journal:v1:';
export type NativeTestStateBase = {version: 1; revision: number; controlEpoch: number; previousDeliveryId?: string;
 segments?:Array<{start:number;revision:number;controlEpoch:number}>};
type Entry = {id: string; kind: 'state' | 'log'; queuedAt: number; phase: 'staged' | 'ready'; payload: string; base?: NativeTestStateBase};
type Document = {version: 1; actor: string; testId: string; entries: Entry[]};
export type NativeTestDelivery = Readonly<Entry & {bucket: string}>;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const maxEntries = 10_000, maxChars = 4_500_000;
const failure = () => new Error('Der Testzustand konnte nicht lokal gesichert werden. Bitte diesen Tab geöffnet lassen und den Speicher prüfen.');
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
export function parseNativeTestStateBase(input: unknown): NativeTestStateBase {
 let value: any = input;
 if (typeof input === 'string') { if (input.length > 8192) throw failure(); try { value = JSON.parse(input); } catch { throw failure(); } }
 if (!value || value.version !== 1 || !integer(value.revision) || !integer(value.controlEpoch) || value.controlEpoch > value.revision ||
   Object.keys(value).some(key => !['version','revision','controlEpoch','previousDeliveryId','segments'].includes(key)) ||
   value.previousDeliveryId !== undefined && (typeof value.previousDeliveryId !== 'string' || !uuid.test(value.previousDeliveryId))) throw failure();
 let previous=0;
 if(value.segments!==undefined&&(!Array.isArray(value.segments)||!value.segments.length||value.segments.length>32||value.segments.some((segment:any)=>{
  if(!segment||typeof segment!=='object'||Object.keys(segment).some(key=>!['start','revision','controlEpoch'].includes(key))||!integer(segment.start)||segment.start<=previous||!integer(segment.revision)||!integer(segment.controlEpoch)||segment.controlEpoch>segment.revision)return true;
  previous=segment.start;return false;
 })))throw failure();
 return {version: 1, revision: value.revision, controlEpoch: value.controlEpoch,
   ...(value.previousDeliveryId === undefined ? {} : {previousDeliveryId: value.previousDeliveryId}),
   ...(value.segments===undefined?{}:{segments:structuredClone(value.segments)})};
}
const contextAt=(base:NativeTestStateBase,index:number)=>{
 const segment=base.segments?.filter(segment=>segment.start<=index).at(-1);
 return {revision:segment?.revision??base.revision,controlEpoch:segment?.controlEpoch??base.controlEpoch};
};

/** Capture before the Source buffer. Its timers and grouped request bodies stay
 * in the controller; only a retired document's packets are recovered here. */
export class NativeTestJournal {
 private readonly leases = new Map<string, () => void>();
 private closed = false;
 private previousStateId?: string;
 private constructor(private readonly storage: Storage, private readonly locks: LockManager, private readonly crypto: Crypto,
  private readonly actor: string, private readonly testId: string, private readonly prefix: string, private readonly ownBucket: string,
  private base: NativeTestStateBase) {}
 static async open(input: {token: string; testId: string; storage: Storage; locks: LockManager; crypto: Crypto; base: NativeTestStateBase}): Promise<NativeTestJournal> {
  if (!input.token || !/^[1-9]\d*$/.test(input.testId) || BigInt(input.testId) > 9223372036854775807n ||
    !input.locks?.request || !input.crypto?.subtle || !input.crypto.randomUUID) throw failure();
  const base = parseNativeTestStateBase(input.base), hash = await input.crypto.subtle.digest('SHA-256', new TextEncoder().encode(input.token));
  const actor = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
  const prefix = NATIVE_TEST_JOURNAL_PREFIX + actor + ':' + input.testId + ':';
  const journal = new NativeTestJournal(input.storage, input.locks, input.crypto, actor, input.testId, prefix, prefix + input.crypto.randomUUID(), base);
  try {
   for (const key of journal.keys().filter(key => key.startsWith(prefix))) if (await journal.claim(key)) journal.read(key);
   if (!await journal.claim(journal.ownBucket)) throw failure();
   return journal;
  } catch { journal.close(); throw failure(); }
 }
 close(): void { if (this.closed) return; this.closed = true; for (const release of this.leases.values()) release(); this.leases.clear(); }
 private current(): void { if (this.closed) throw failure(); }
 private keys(): string[] { const keys: string[] = []; for (let i=0; i<this.storage.length; i++) { const key=this.storage.key(i); if(key)keys.push(key); } return keys; }
 private claim(key: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
   void this.locks.request(key, {ifAvailable: true}, lock => {
    if (!lock || this.closed) { resolve(false); return; }
    return new Promise<void>(release => { this.leases.set(key, release); resolve(true); });
   }).catch(reject);
  });
 }
 private validate(doc: Document): Document {
  if (!doc || doc.version !== 1 || doc.actor !== this.actor || doc.testId !== this.testId || !Array.isArray(doc.entries) ||
    doc.entries.length > maxEntries || new Set(doc.entries.map(row => row?.id)).size !== doc.entries.length) throw failure();
  for (const row of doc.entries) {
   if (!row || !uuid.test(row.id) || !['state','log'].includes(row.kind) || !['staged','ready'].includes(row.phase) ||
     !integer(row.queuedAt) || typeof row.payload !== 'string' || !Array.isArray(JSON.parse(row.payload)) || row.kind === 'log' && row.phase !== 'ready') throw failure();
   if (row.kind === 'state') { parseNativeTestStateBase(row.base); if (row.base?.previousDeliveryId === row.id || row.base?.segments?.some(segment=>segment.start>=JSON.parse(row.payload).length)) throw failure(); }
   else if (row.base !== undefined) throw failure();
  }
  return doc;
 }
 private read(key: string): Document {
  this.current(); if (!this.leases.has(key) || !key.startsWith(this.prefix) || !uuid.test(key.slice(this.prefix.length))) throw failure();
  const text = this.storage.getItem(key); if (text === null) return {version: 1, actor: this.actor, testId: this.testId, entries: []};
  if (text.length > maxChars) throw failure(); return this.validate(JSON.parse(text));
 }
 private write(key: string, doc: Document): void {
  this.current(); this.validate(doc); const serialized=JSON.stringify(doc); let chars=serialized.length, count=doc.entries.length;
  for (const other of this.keys().filter(name=>name.startsWith(NATIVE_TEST_JOURNAL_PREFIX)&&name!==key)) {
   const value=this.storage.getItem(other);if(value===null)continue;chars+=value.length;
   if(other.startsWith(this.prefix)) { const peer=JSON.parse(value);if(!Array.isArray(peer?.entries))throw failure();count+=peer.entries.length; }
  }
  if(chars>maxChars||count>maxEntries)throw failure();
  try { if(doc.entries.length)this.storage.setItem(key,serialized);else this.storage.removeItem(key); } catch { throw failure(); }
 }
 captureState(entries: unknown[], now=Date.now()): void {
  const doc=this.read(this.ownBucket),previous=doc.entries.find(row=>row.kind==='state'&&row.phase==='staged');
  const priorEntries:unknown[]=previous?JSON.parse(previous.payload):[];
  const base:NativeTestStateBase=previous?.base?structuredClone(previous.base):{...this.base,...(this.previousStateId?{previousDeliveryId:this.previousStateId}:{})};
  if(previous&&entries.length){const context=contextAt(base,priorEntries.length-1);
   if(context.revision!==this.base.revision||context.controlEpoch!==this.base.controlEpoch)base.segments=[...(base.segments??[]),{start:priorEntries.length,revision:this.base.revision,controlEpoch:this.base.controlEpoch}];
  }
  const row:Entry={id:previous?.id??this.crypto.randomUUID(),kind:'state',queuedAt:previous?.queuedAt??now,phase:'staged',
   base,payload:JSON.stringify([...priorEntries,...entries])};
  doc.entries=doc.entries.filter(entry=>entry!==previous);doc.entries.push(row);this.write(this.ownBucket,doc);
 }
 useFreshBase(base:NativeTestStateBase):void {
  if(this.previousStateId||this.read(this.ownBucket).entries.length)throw failure();
  this.base=parseNativeTestStateBase(base);
 }
 /** Only future events use the command ACK snapshot. Existing staged entries
  * retain their original contexts even when Source groups them in one packet. */
 useCommandBase(base:NativeTestStateBase):void{this.current();this.base=parseNativeTestStateBase(base);}
 freeze(kind: 'state'|'log', body: unknown[]): NativeTestDelivery {
  const doc=this.read(this.ownBucket),previous=kind==='state'?doc.entries.find(row=>row.kind==='state'&&row.phase==='staged'):undefined;
  const row:Entry={id:previous?.id??this.crypto.randomUUID(),kind,queuedAt:previous?.queuedAt??Date.now(),phase:'ready',payload:JSON.stringify(body),
   ...(kind==='state'?{base:previous?.base??{...this.base,...(this.previousStateId?{previousDeliveryId:this.previousStateId}:{})}}:{})};
  if(previous&&row.base){
   const captured:unknown[]=JSON.parse(previous.payload),originalBase=row.base;let index=0;
   const contexts=body.map(entry=>{
    if(index<captured.length&&JSON.stringify(entry)===JSON.stringify(captured[index]))return contextAt(originalBase,index++);
    return contextAt(originalBase,0);
   });
   if(index!==captured.length)throw failure();
   const segments:NonNullable<NativeTestStateBase['segments']>=[];for(let i=1;i<contexts.length;i++)if(contexts[i]!.revision!==contexts[i-1]!.revision||contexts[i]!.controlEpoch!==contexts[i-1]!.controlEpoch)segments.push({start:i,...contexts[i]!});
   row.base={version:1,revision:contexts[0]?.revision??originalBase.revision,controlEpoch:contexts[0]?.controlEpoch??originalBase.controlEpoch,
    ...(originalBase.previousDeliveryId?{previousDeliveryId:originalBase.previousDeliveryId}:{}),...(segments.length?{segments}:{})};
  }
  doc.entries=doc.entries.filter(entry=>entry!==previous);doc.entries.push(row);this.write(this.ownBucket,doc);
  if(kind==='state')this.previousStateId=row.id;
  return Object.freeze({...row,bucket:this.ownBucket});
 }
 recoveries(): NativeTestDelivery[] {
  const rows:NativeTestDelivery[]=[];
  for(const key of this.leases.keys())if(key!==this.ownBucket)for(const row of this.read(key).entries)rows.push({...row,phase:'ready',bucket:key});
  const pending=new Map(rows.map(row=>[row.id,row]));if(pending.size!==rows.length)throw failure();
  const sorted:NativeTestDelivery[]=[];const visiting=new Set<string>(),visited=new Set<string>();
  const visit=(row:NativeTestDelivery)=>{
   if(visited.has(row.id))return;if(visiting.has(row.id))throw failure();visiting.add(row.id);
   const predecessor=row.base?.previousDeliveryId?pending.get(row.base.previousDeliveryId):undefined;if(predecessor)visit(predecessor);
   visiting.delete(row.id);visited.add(row.id);sorted.push(Object.freeze(row));
  };
  rows.sort((a,b)=>a.queuedAt-b.queuedAt||a.id.localeCompare(b.id)).forEach(visit);
  for(const key of new Set(rows.map(row=>row.bucket))) { const doc=this.read(key);for(const row of doc.entries)row.phase='ready';this.write(key,doc); }
  return sorted;
 }
 acknowledge(delivery:NativeTestDelivery):void {
  const doc=this.read(delivery.bucket),row=doc.entries.find(entry=>entry.id===delivery.id);if(!row)return;
  if(row.kind!==delivery.kind||row.phase!=='ready'||row.payload!==delivery.payload||JSON.stringify(row.base)!==JSON.stringify(delivery.base))throw failure();
  doc.entries=doc.entries.filter(entry=>entry.id!==delivery.id);this.write(delivery.bucket,doc);
 }
}
