import {NATIVE_RUN_TEST_ID,NATIVE_RENDER_NOTIFY,NATIVE_ERROR_RECEIVER} from './native-tokens';
import {Injectable,inject} from '@angular/core';
import {Observable} from 'rxjs';
import {HttpResponse,HttpHeaders,HttpEventType,HttpErrorResponse} from '@angular/common/http';
import {parseNativeParticipantJson} from './native-wire';
import {NativeMonitorSessionService} from '../native-monitor/native-session.service';
import {nativeTestRetryDelays,nativeRetryExcludedStatus,nativeRequestError} from './native-http-policy';
import {ownAsyncError} from '../owned-error-routing';
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
 get isCurrent(){return !!this.credential&&!this.accessSignal.aborted&&this.ownerScope===this.session.accessSignal;}
 private retire=()=>{this.credential=undefined;this.lifetime.abort();};
 constructor(){this.ownerScope.addEventListener('abort',this.retire,{once:true});}
 ngOnDestroy(){this.ownerScope.removeEventListener('abort',this.retire);this.retire();}
 ownError<T>(error:T):T {
  if(this.receiveError&&error&&typeof error==='object')ownAsyncError(error,()=>this.receiveError?.(error));
  return error;
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
   const payload=body===undefined?undefined:JSON.stringify(body);
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
      const response=await fetch(url,{method,cache:'no-store',credentials:'omit',redirect:'error',signal:operation,headers:{AuthToken:token,...(payload===undefined?{}:{'Content-Type':'application/json'})},...(payload===undefined?{}:{body:payload})});
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
      const value=options.responseType==='text'?text:text.length?parseNativeParticipantJson(url.pathname,text):null;
      const result=new HttpResponse({body:value,status:response.status,headers:new HttpHeaders(headers),url:url.href});
      subscriber.next(options.observe==='events'||options.observe==='response'?result:value);subscriber.complete();this.notify();return;
     }catch(error){
      if(!current())return;
      if(operation.aborted||attempt===nativeTestRetryDelays.length)throw error;
      await wait(nativeTestRetryDelays[attempt]);
     }
    }
   })().catch(raw=>{
    if(!current())return;
    const error=nativeRequestError(raw);
    subscriber.error(this.ownError(error));this.notify();
   });
   return()=>{signal.removeEventListener('abort',retire);abort.abort();};
  });
 }
}
