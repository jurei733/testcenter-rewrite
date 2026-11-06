import {NATIVE_RUN_TEST_ID,NATIVE_RENDER_NOTIFY,NATIVE_ERROR_RECEIVER} from './native-tokens';
import {Injectable,inject} from '@angular/core';
import {Observable,BehaviorSubject,firstValueFrom,type Subscriber,type Subscription} from 'rxjs';
import {NativeUnitJournal,type NativeUnitDelivery} from './native-unit-journal';
import {NativeTestJournal,parseNativeTestStateBase,type NativeTestStateBase,type NativeTestDelivery} from './native-test-journal';
import {HttpResponse,HttpHeaders,HttpEventType,HttpErrorResponse} from '@angular/common/http';
import {parseNativeParticipantJson} from './native-wire';
import {NativeMonitorSessionService} from '../native-monitor/native-session.service';
import {nativeTestRetryDelays,nativeRetryExcludedStatus,nativeRequestError} from './native-http-policy';
import {ownAsyncError} from '../owned-error-routing';
import {AppError} from './app.interfaces';
import {nativeBackground} from './native-background';
import {restoreNativeUnit} from './native-unit-restore';
class NativeStateSupersededError extends AppError { constructor(){super({code:409,label:'Testzustand geändert',type:'backend',description:'Der Testzustand wurde inzwischen geändert. Bitte den Test neu laden.'});} }
@Injectable()
export class NativeHttpClient {
 private readonly session=inject(NativeMonitorSessionService);
 private readonly runTestId=inject(NATIVE_RUN_TEST_ID);
 private readonly notify=inject(NATIVE_RENDER_NOTIFY,{optional:true})??(()=>{});
 private readonly receiveError=inject(NATIVE_ERROR_RECEIVER,{optional:true});
 private readonly ownerScope=this.session.accessSignal;
 private readonly lifetime=new AbortController();
 readonly accessSignal=AbortSignal.any([this.ownerScope,this.lifetime.signal]);
 private credential=this.session.access()?.token;
 private readonly background=nativeBackground(this.credential,this.ownerScope);
 private readonly foregroundUnits=this.background?.holdUnits(this.runTestId,this.accessSignal);
 private preferredUnitAlias?:string;
 private unitJournal?:NativeUnitJournal;
 private readonly unitWaiters=new Map<string,Set<Subscriber<any>>>();
 private readonly unitRequests=new Map<string,Subscription>();
 private readonly unitStorageUnsecured=new BehaviorSubject(false);
 readonly unitStorageUnsecured$=this.unitStorageUnsecured.asObservable();
 get hasUnsecuredUnitWrites(){return this.unitJournal?.hasUnsecured??false;}
 private readonly beforeUnload=(event:BeforeUnloadEvent)=>{if(this.isCurrent&&this.hasUnsecuredUnitWrites){event.preventDefault();event.returnValue='';}};
 private unitRecovery?:Promise<void>;
 private unitRecoveryRequested=0;
 private readonly unitRecoveryPending=new BehaviorSubject(false);
 readonly unitRecoveryPending$=this.unitRecoveryPending.asObservable();
 private readonly onOnline=()=>{void this.retryPendingUnits();};
 private journalPreparation?:Promise<void>;
 private testJournal?:NativeTestJournal;
 private testStateBase?:NativeTestStateBase;
 private testJournalPreparation?:Promise<boolean>;
 private testJournalReferences=1;
 private releasedTestJournal=false;
 verifyAccess(owner:AbortSignal){return this.session.verifyAccess(owner);}
 get isCurrent(){return !!this.credential&&!this.accessSignal.aborted&&this.ownerScope===this.session.accessSignal;}
 private retire=()=>{
  this.unitJournal?.close();this.unitJournal=undefined;
  if(!this.releasedTestJournal){this.releasedTestJournal=true;this.releaseTestJournal();}
  if(this.ownerScope.aborted){this.testJournal?.close();this.testJournal=undefined;}
  this.unitRecoveryPending.complete();this.unitStorageUnsecured.complete();this.credential=undefined;this.lifetime.abort();
  for(const request of this.unitRequests.values())request.unsubscribe();this.unitRequests.clear();
  for(const waiters of this.unitWaiters.values())for(const subscriber of waiters)subscriber.complete();this.unitWaiters.clear();
 };
 private readonly pageHide=(event:PageTransitionEvent)=>{if(!event.persisted)this.retire();};
 constructor(){void this.foregroundUnits?.catch(()=>{});this.ownerScope.addEventListener('abort',this.retire,{once:true});window.addEventListener?.('pagehide',this.pageHide);window.addEventListener?.('online',this.onOnline);window.addEventListener?.('beforeunload',this.beforeUnload);}
 ngOnDestroy(){this.ownerScope.removeEventListener('abort',this.retire);window.removeEventListener?.('pagehide',this.pageHide);window.removeEventListener?.('online',this.onOnline);window.removeEventListener?.('beforeunload',this.beforeUnload);this.retire();}
 ownError<T>(error:T):T {
  if(this.receiveError&&error&&typeof error==='object')ownAsyncError(error,()=>this.receiveError?.(error));
  return error;
 }
 prepareUnitJournal(saving:boolean):Promise<void>{
  if(!saving)return Promise.resolve();
  return this.journalPreparation??=this.recoverUnitJournal().catch(error=>{throw this.ownError(error);});
 }
 prepareJournals(saving:boolean):Promise<boolean>{
  if(!saving)return Promise.resolve(false);
  const recover=()=>this.recoverTestJournal().then(async recovered=>{await this.prepareUnitJournal(true);return recovered;});
  return this.testJournalPreparation??=(this.background?this.background.recover(this.runTestId,recover):recover())
   .catch(error=>{throw this.ownError(error);});
 }
 private async recoverTestJournal():Promise<boolean>{
  if(!this.isCurrent||!this.credential||!this.testStateBase)throw Error('Native Test-state base unavailable.');
  const journal=await NativeTestJournal.open({token:this.credential,testId:this.runTestId,base:this.testStateBase,storage:localStorage,locks:navigator.locks,crypto,mirror:this.background?.mirror,seal:this.background?.seal});
  if(!this.isCurrent){journal.close();throw Error('Native run retired.');}
  this.testJournal=journal;let recoveredState=false;
  for(const entry of journal.recoveries()){
   if(!this.isCurrent)throw Error('Native run retired.');
   await firstValueFrom(this.sendTestDelivery(journal,entry,true));recoveredState||=entry.kind==='state';
  }
  return recoveredState;
 }
 private releaseTestJournal():void{if(--this.testJournalReferences===0){this.testJournal?.close();this.testJournal=undefined;}}
 retainTestJournal():{journal:NativeTestJournal;release:()=>void}|undefined{
  if(!this.isCurrent||!this.testJournal)return undefined;
  this.testJournalReferences++;let released=false;
  return {journal:this.testJournal,release:()=>{if(!released){released=true;this.releaseTestJournal();}}};
 }
 captureTestState(state:unknown[]):void{
  if(!this.isCurrent||!this.testJournal)throw this.ownError(Error('Lokale Testsicherung ist noch nicht bereit.'));
  try{this.testJournal.captureState(state);
   for(const row of state)if(row&&typeof row==='object'&&'key'in row&&row.key==='CURRENT_UNIT_ID'&&'content'in row&&typeof row.content==='string'){this.preferredUnitAlias=row.content;this.background?.preferUnit(this.runTestId,row.content);}
  }catch(error){throw this.ownError(error);}
 }
 testWrite<T>(kind:'state'|'log',testId:string,body:unknown[]):Observable<T>{
  if(testId!==this.runTestId||!this.isCurrent)return new Observable(subscriber=>subscriber.error(this.ownError(Error('Native request outside its authenticated scope.'))));
  if(!this.testJournal)return this.request(kind==='state'?'PATCH':'PUT',`/test/${testId}/${kind}`,body);
  try{const journal=this.testJournal;return this.sendTestDelivery(journal,journal.freeze(kind,body));}
  catch(error){return new Observable(subscriber=>subscriber.error(this.ownError(error)));}
 }
 private sendTestDelivery<T>(journal:NativeTestJournal,entry:NativeTestDelivery,recovering=false):Observable<T>{
  return this.request(entry.kind==='state'?'PATCH':'PUT',`/test/${this.runTestId}/${entry.kind}`,undefined,
   {nativePayload:entry.payload,nativeDeliveryId:entry.id,nativeStateBase:entry.base,nativeAccepted:(headers:Headers)=>{
    let superseded=false;
    if(entry.kind==='state'){
     const result=JSON.parse(headers.get('x-native-state-result')??'null');
     if(!result||result.version!==1||!Number.isSafeInteger(result.revision)||result.revision<0||!Number.isSafeInteger(result.controlEpoch)||result.controlEpoch<0||result.controlEpoch>result.revision||typeof result.superseded!=='boolean')throw Error('Native Test-state acknowledgement unavailable.');
     if(result.currentSuperseded!==undefined&&typeof result.currentSuperseded!=='boolean')throw Error('Native Test-state acknowledgement unavailable.');
     superseded=result.currentSuperseded??result.superseded;
    }
    journal.acknowledge(entry);
    if(superseded&&!recovering)throw new NativeStateSupersededError();
   }});
 }
 private async recoverUnitJournal():Promise<void>{
  if(!this.isCurrent||!this.credential)throw Error('Native run retired.');
  await this.foregroundUnits;
  const journal=await NativeUnitJournal.open({token:this.credential,testId:this.runTestId,storage:localStorage,locks:navigator.locks,crypto,retainUnsecured:true,unsecuredChanged:pending=>{if(this.isCurrent){this.unitStorageUnsecured.next(pending);this.notify();}},mirror:this.background?.mirror,seal:this.background?.seal});
  if(!this.isCurrent){journal.close();throw Error('Native run retired.');}
  this.unitJournal=journal;
  void this.retryPendingUnits();
 }
 retryPendingUnits():Promise<void>{
  this.unitRecoveryRequested++;
  return this.unitRecovery??=(async()=>{for(;;){
   const requested=this.unitRecoveryRequested,journal=this.unitJournal;
   if(!this.isCurrent||!journal)return;
   const blocked=new Set<string>();let failed=false;
   try{journal.retryPersistence();let abandoned:NativeUnitDelivery[]=[];try{abandoned=journal.recoveries(this.preferredUnitAlias);}catch{failed=true;}for(const entry of [...abandoned,...journal.readyOwnDeliveries(this.preferredUnitAlias)].sort((a,b)=>Number(b.unitAlias===this.preferredUnitAlias)-Number(a.unitAlias===this.preferredUnitAlias)||(a.kind==='state'?0:1)-(b.kind==='state'?0:1)||a.queuedAt-b.queuedAt)){
    if(!this.isCurrent)return;if(blocked.has(entry.unitAlias)||this.unitRequests.has(entry.id))continue;
    const base=`/test/${this.runTestId}/unit/${encodeURIComponent(entry.unitAlias)}`;
    try{
     if(entry.kind==='response')await firstValueFrom(this.request('PATCH',base+'/state',{newState:[],originalUnitId:entry.originalUnitId},{nativeDeliveryId:entry.id,nativeNoRetry:true}));
     await firstValueFrom(this.request(entry.kind==='state'?'PATCH':'PUT',base+'/'+entry.kind,undefined,
      {nativePayload:entry.payload,nativeDeliveryId:entry.id,nativeNoRetry:true,nativeAccepted:()=>this.unitAccepted(journal,entry)}));
    }catch{if(!this.isCurrent)return;failed=true;blocked.add(entry.unitAlias);}
   }}catch{failed=true;}
   if(this.isCurrent){this.unitRecoveryPending.next(failed);this.notify();}
   if(requested===this.unitRecoveryRequested)return;
  }})().finally(()=>{this.unitRecovery=undefined;});
 }

 captureUnitResponse(unitAlias:string,originalUnitId:string,dataParts:Record<string,string>,responseType:string):void{
  if(!this.isCurrent||!this.unitJournal)throw this.ownError(new Error('Lokale Antwortsicherung ist noch nicht bereit.'));
  try{this.unitJournal.captureResponse(unitAlias,originalUnitId,dataParts,responseType);}catch(error){throw this.ownError(error);}
 }
 captureUnitState(unitAlias:string,originalUnitId:string,state:unknown[]):void{
  if(!this.isCurrent||!this.unitJournal)throw this.ownError(new Error('Lokale Antwortsicherung ist noch nicht bereit.'));
  try{this.unitJournal.captureState(unitAlias,originalUnitId,state);}catch(error){throw this.ownError(error);}
 }
 unitWrite<T>(kind:NativeUnitDelivery['kind'],testId:string,unitAlias:string,body:Record<string,unknown>):Observable<T>{
  if(testId!==this.runTestId||!this.isCurrent)return new Observable(subscriber=>subscriber.error(this.ownError(new Error('Native request outside its authenticated scope.'))));
  const path=`/test/${this.runTestId}/unit/${encodeURIComponent(unitAlias)}/${kind}`;
  if(!this.unitJournal)return this.request(kind==='state'?'PATCH':'PUT',path,body);
  try{
   const journal=this.unitJournal,entry=journal.freeze(kind,unitAlias,body);
   return new Observable(subscriber=>{
    let waiters=this.unitWaiters.get(entry.id);if(!waiters){waiters=new Set();this.unitWaiters.set(entry.id,waiters);}waiters.add(subscriber);
    if(!this.unitRequests.has(entry.id)){
     const request=this.request(kind==='state'?'PATCH':'PUT',path,undefined,{nativePayload:entry.payload,nativeDeliveryId:entry.id,nativeAccepted:()=>this.unitAccepted(journal,entry)}).subscribe({
      error:error=>{this.unitRequests.delete(entry.id);if(this.isCurrent&&journal.hasUnsecured){this.unitStorageUnsecured.next(true);this.notify();return;}this.failUnit(entry.id,error);},
      complete:()=>this.unitRequests.delete(entry.id)
     });if(!request.closed)this.unitRequests.set(entry.id,request);
    }
    return()=>{waiters.delete(subscriber);if(!waiters.size){this.unitWaiters.delete(entry.id);this.unitRequests.get(entry.id)?.unsubscribe();this.unitRequests.delete(entry.id);}};
   });
  }catch(error){return new Observable(subscriber=>subscriber.error(this.ownError(error)));}
 }
 private unitAccepted(journal:NativeUnitJournal,entry:NativeUnitDelivery):void{
  journal.acknowledge(entry);const waiters=this.unitWaiters.get(entry.id);this.unitWaiters.delete(entry.id);this.unitRequests.delete(entry.id);
  for(const subscriber of waiters??[]){subscriber.next(null);subscriber.complete();}
 }
 private failUnit(id:string,error:unknown):void{
  const waiters=this.unitWaiters.get(id);this.unitWaiters.delete(id);for(const subscriber of waiters??[])subscriber.error(error);
 }
 get<T=unknown>(url:string,options?:any):Observable<any>{return this.request('GET',url,undefined,options);}
 patch<T=unknown>(url:string,body:unknown,options?:any):Observable<T>{return this.request('PATCH',url,body,options);}
 put<T=unknown>(url:string,body:unknown,options?:any):Observable<T>{return this.request('PUT',url,body,options);}
 post<T=unknown>(url:string,body:unknown,options?:any):Observable<T>{return this.request('POST',url,body,options);}
 delete<T=unknown>(url:string,options?:any):Observable<T>{return this.request('DELETE',url,undefined,options);}
 private request(method:string,path:string,body:unknown,options:any={}):Observable<any>{
  return new Observable(subscriber=>{
   const token=this.credential,scope=this.ownerScope,signal=this.accessSignal,abort=new AbortController();
   const url=new URL(path,location.origin);
   const target=url.pathname.match(/^\/test\/([^/]+)(?:\/|$)/);
   if((target&&target[1]!==this.runTestId)||!token||signal.aborted||scope!==this.session.accessSignal||url.origin!==location.origin||!(/^\/(?:test|file|session)(?:\/|$)/.test(url.pathname)||url.pathname==='/system/status')){subscriber.error(this.ownError(new Error('Native request outside its authenticated scope.')));return;}
   const operation=AbortSignal.any([signal,abort.signal,AbortSignal.timeout(20000)]);
   // All retries send the same captured bytes and timestamp, never later edits.
   const unitRead=method==='GET'?options.nativeUnitRead:undefined;
   const readSnapshot=unitRead?this.unitJournal?.snapshot(unitRead.alias)??[]:[];
   const payload=options.nativePayload??(body===undefined?undefined:JSON.stringify(body));
   const testWrite=method==='PATCH'&&url.pathname===`/test/${this.runTestId}/state`||method==='PUT'&&url.pathname===`/test/${this.runTestId}/log`;
   const deliveryId=options.nativeDeliveryId??(testWrite?crypto.randomUUID():undefined);
   const stateBaseHeader=options.nativeStateBase?JSON.stringify(options.nativeStateBase):undefined;
   const commandBase=method==='PATCH'&&/^\/test\/[^/]+\/command\/[^/]+\/executed$/.test(url.pathname)&&!!this.testJournal;
   const current=()=>!subscriber.closed&&!signal.aborted&&scope===this.session.accessSignal;
   const retire=()=>subscriber.complete();signal.addEventListener('abort',retire,{once:true});
   const wait=(delay:number)=>new Promise<void>((resolve,reject)=>{
    const cancel=()=>{clearTimeout(timer);operation.removeEventListener('abort',cancel);reject(operation.reason);};
    const timer=setTimeout(()=>{operation.removeEventListener('abort',cancel);resolve();},delay);
    if(operation.aborted)cancel();else operation.addEventListener('abort',cancel,{once:true});
   });
   void (async()=>{
    for(let attempt=0;;attempt++){
     try{
      operation.throwIfAborted();
      const response=await fetch(url,{method,cache:'no-store',credentials:'omit',redirect:'error',signal:operation,headers:{AuthToken:token,...(payload===undefined?{}:{'Content-Type':'application/json'}),...(deliveryId?{'X-Native-Delivery-Id':deliveryId}:{}),
       ...(unitRead?{'X-Native-Unit-Protocol':'1'}:{}),...(options.nativeStateProtocol||commandBase?{'X-Native-State-Protocol':'1'}:{}),...(stateBaseHeader?{'X-Native-State-Base':stateBaseHeader}:{})},...(payload===undefined?{}:{body:payload})});
      let text:string;
      if(response.ok&&response.body&&options.observe==='events'&&options.reportProgress){
       const reader=response.body.getReader(),decoder=new TextDecoder(),chunks:string[]=[];
       const length=response.headers.get('content-length');const total=length&&/^[0-9]+$/.test(length)&&Number.isSafeInteger(Number(length))?Number(length):undefined;let loaded=0;
       try{for(;;){const part=await reader.read();if(!current())return;if(part.done)break;loaded+=part.value.byteLength;chunks.push(decoder.decode(part.value,{stream:true}));subscriber.next({type:HttpEventType.DownloadProgress,loaded,...(total===undefined?{}:{total})});this.notify();}chunks.push(decoder.decode());text=chunks.join('');}
       finally{reader.releaseLock();}
      }else text=await response.text();
      if(!current())return;
      const headers:Record<string,string>={};response.headers.forEach((v,k)=>headers[k]=v);
      if(!response.ok){
       if(nativeRetryExcludedStatus.some(code=>code===response.status)){this.session.clear();return;}
       let errorBody:unknown=text.replaceAll(token,'[redacted]');
       if(options.responseType!=='text'){try{errorBody=JSON.parse(errorBody as string);}catch{}}
       const safeUrl=url.href.replace(/(\/file\/)[^/]+/,'$1[resource-capability]');
       throw new HttpErrorResponse({status:response.status,statusText:response.statusText,headers:new HttpHeaders(headers),url:safeUrl,error:errorBody});
      }
      let value=options.responseType==='text'?text:text.length?parseNativeParticipantJson(url.pathname,text):null;
      if(unitRead){
       const pending=new Map(readSnapshot.map(entry=>[entry.id,entry]));for(const entry of this.unitJournal?.snapshot(unitRead.alias)??[])pending.set(entry.id,entry);
       value=restoreNativeUnit(value,[...pending.values()].sort((a,b)=>a.queuedAt-b.queuedAt),unitRead.originalUnitId);
      }
      if(options.nativeStateProtocol){
       this.testStateBase=parseNativeTestStateBase(response.headers.get('x-native-state-base'));
       this.testJournal?.useFreshBase(this.testStateBase);
       const alias=(value as {laststate?:{CURRENT_UNIT_ID?:unknown}}|null)?.laststate?.CURRENT_UNIT_ID;
       if(typeof alias==='string'){this.preferredUnitAlias=alias;this.background?.preferUnit(this.runTestId,alias);}
      }
      if(commandBase)this.testJournal?.useCommandBase(parseNativeTestStateBase(response.headers.get('x-native-state-base')));
      options.nativeAccepted?.(response.headers);
      const result=new HttpResponse({body:value,status:response.status,headers:new HttpHeaders(headers),url:url.href});
      subscriber.next(options.observe==='events'||options.observe==='response'?result:value);subscriber.complete();this.notify();return;
     }catch(error){
      if(!current())return;
      if(options.nativeNoRetry||error instanceof NativeStateSupersededError||operation.aborted||attempt===nativeTestRetryDelays.length)throw error;
      await wait(nativeTestRetryDelays[attempt]);
     }
    }
   })().catch(raw=>{
    if(!current())return;
    const error=nativeRequestError(raw);
    if(method==='GET'&&url.pathname===`/test/${this.runTestId}`&&!this.unitJournal)this.background?.releaseUnits(this.runTestId);
    subscriber.error(this.ownError(error));this.notify();
   });
   return()=>{signal.removeEventListener('abort',retire);abort.abort();};
  });
 }
}
