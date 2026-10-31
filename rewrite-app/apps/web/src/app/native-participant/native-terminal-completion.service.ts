import {Injectable,inject,type OnDestroy} from '@angular/core';
import {NativeMonitorSessionService,NativeMonitorHttpError} from '../native-monitor/native-session.service';
import {nativeTestRetryDelays,nativeRetryExcludedStatus} from './native-http-policy';

type PendingCompletion={scope:AbortSignal;done:Promise<void>;cancel:()=>void};
export type NativeTerminalCompletion={complete:()=>Promise<void>;cancel:()=>void};

/** Accepted terminal logs finish after navigation, under their captured actor. */
@Injectable({providedIn:'root'})
export class NativeTerminalCompletionService implements OnDestroy {
 private readonly session=inject(NativeMonitorSessionService);
 private readonly pending=new Set<PendingCompletion>();

 begin(testId:string,command:string):NativeTerminalCompletion {
  const scope=this.session.accessSignal,token=this.session.access()?.token;
  if(!token||scope.aborted||!/^[1-9]\d{0,18}$/.test(testId)||BigInt(testId)>9223372036854775807n)
   return {complete:()=>Promise.resolve(),cancel:()=>{}};
  const current=()=>!scope.aborted&&scope===this.session.accessSignal&&this.session.access()?.token===token;
  const cancelRequest=new AbortController();let finished=false,resolveDone!:()=>void,completion:Promise<void>|undefined;
  const done=new Promise<void>(resolve=>{resolveDone=resolve;});
  const settle=()=>{if(finished)return;finished=true;scope.removeEventListener('abort',cancel);this.pending.delete(entry);resolveDone();};
  const cancel=()=>{cancelRequest.abort();settle();};
  const entry:PendingCompletion={scope,done,cancel};this.pending.add(entry);
  scope.addEventListener('abort',cancel,{once:true});
  return {cancel,complete:()=>{
   if(completion)return completion;
   if(finished||!current()){cancel();return Promise.resolve();}
   const operation=AbortSignal.any([scope,cancelRequest.signal,AbortSignal.timeout(20000)]);
   const body=[Object.freeze({key:'command executed',timeStamp:Date.now(),content:command})];
   const wait=(ms:number)=>new Promise<void>((resolve,reject)=>{
    const abort=()=>{clearTimeout(timer);operation.removeEventListener('abort',abort);reject(operation.reason);};
    const timer=setTimeout(()=>{operation.removeEventListener('abort',abort);resolve();},ms);
    if(operation.aborted)abort();else operation.addEventListener('abort',abort,{once:true});
   });
   completion=(async()=>{try{
    for(let attempt=0;;attempt++){
     if(!current())return;operation.throwIfAborted();
     try{await this.session.text('PUT',`/test/${testId}/log`,body,token,false,operation);return;}
     catch(error){
      if(!current()||cancelRequest.signal.aborted)return;
      if(operation.aborted||attempt===nativeTestRetryDelays.length||error instanceof NativeMonitorHttpError&&nativeRetryExcludedStatus.some(status=>status===error.status))throw error;
      await wait(nativeTestRetryDelays[attempt]);
     }
    }
   }catch(error){if(current()&&!cancelRequest.signal.aborted)throw error;}finally{settle();}})();return completion;
  }};
 }

 /** Refreshing claims can renew the grant scope; finish its accepted logs first. */
 async whenSettled(scope:AbortSignal):Promise<void>{
  await Promise.all([...this.pending].filter(entry=>entry.scope===scope).map(entry=>entry.done));
 }
 ngOnDestroy(){for(const entry of [...this.pending])entry.cancel();}
}
