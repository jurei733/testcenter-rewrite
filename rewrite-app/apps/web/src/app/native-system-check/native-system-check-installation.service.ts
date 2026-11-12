import {Injectable,signal} from '@angular/core';
import {NativeMonitorHttpError} from '../native-monitor/native-http-error';

/** Source reads the installation mode once when the application starts.
 * It is public application state, independent from any retained actor. */
@Injectable({providedIn:'root'})
export class NativeSystemCheckInstallationService {
 readonly loginRequired=signal<boolean|null>(null);
 private readonly owner=new AbortController();
 private readonly initial=this.read();
 constructor(){void this.initial.catch(()=>undefined);}
 private async read():Promise<boolean>{
  const response=await fetch('/sys-check-mode',{headers:{Accept:'application/json'},cache:'no-store',credentials:'omit',redirect:'error',
   signal:AbortSignal.any([this.owner.signal,AbortSignal.timeout(20000)])});
  const text=await response.text();this.owner.signal.throwIfAborted();
  if(!response.ok)throw new NativeMonitorHttpError(response.status,text,{url:response.url,statusText:response.statusText,errorId:response.headers.get('error-id'),testMode:response.headers.get('test-mode')});
  const mode:unknown=JSON.parse(text);if(typeof mode!=='boolean')throw new Error('Ungültiger Systemcheck-Modus.');
  this.loginRequired.set(mode);return mode;
 }
 ready(owner:AbortSignal):Promise<boolean>{
  owner.throwIfAborted();
  return new Promise((resolve,reject)=>{
   const abort=()=>{cleanup();reject(new DOMException('Systemcheck view retired.','AbortError'));};
   const cleanup=()=>owner.removeEventListener('abort',abort);
   owner.addEventListener('abort',abort,{once:true});
   this.initial.then(value=>{cleanup();if(owner.aborted)abort();else resolve(value);},error=>{cleanup();reject(error);});
  });
 }
 ngOnDestroy(){this.owner.abort();}
}
