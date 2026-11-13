import {Injectable,signal} from '@angular/core';
import {NativeMonitorHttpError} from '../native-monitor/native-http-error';
import {NativeErrorPresenterService} from '../native-error-presenter.service';

/** Public application state. Source reads it at startup and after its own
 * administrative uploads; external changes retain the same-document cache. */
@Injectable({providedIn:'root'})
export class NativeSystemCheckInstallationService {
 readonly loginRequired=signal<boolean|null>(null);
 readonly problem=signal<unknown>(null);
 private readonly owner=new AbortController();
 private revision=0;
 private pending:Promise<boolean>;
 constructor(private readonly errors:NativeErrorPresenterService){this.pending=this.refresh();}
 refresh():Promise<boolean>{
  const pending=this.read(++this.revision);this.pending=pending;
  // The root presents failures. View-specific waiters may also retire without
  // abandoning the shared read or producing an unhandled rejection.
  void pending.catch(()=>undefined);return pending;
 }
 private async read(revision:number):Promise<boolean>{
  try{
  // Source already has its global dialog code when this startup request begins.
  // This dependency is document-owned and independent from any routed wizard.
  await this.errors.ready();this.owner.signal.throwIfAborted();
  const response=await fetch('/sys-check-mode',{headers:{Accept:'application/json'},cache:'no-store',credentials:'omit',redirect:'error',
   signal:AbortSignal.any([this.owner.signal,AbortSignal.timeout(20000)])});
  const text=await response.text();this.owner.signal.throwIfAborted();
  if(!response.ok)throw new NativeMonitorHttpError(response.status,text,{url:response.url,statusText:response.statusText,errorId:response.headers.get('error-id'),testMode:response.headers.get('test-mode')});
  const mode:unknown=JSON.parse(text);if(typeof mode!=='boolean')throw new Error('Ungültiger Systemcheck-Modus.');
  if(revision!==this.revision)return this.pending;
  this.problem.set(null);this.loginRequired.set(mode);return mode;
  }catch(error){
   if(revision!==this.revision)return this.pending;
   if(!this.owner.signal.aborted)this.problem.set(error);
   throw error;
  }
 }
 ready(owner:AbortSignal):Promise<boolean>{
  owner.throwIfAborted();
  return new Promise((resolve,reject)=>{
   const abort=()=>{cleanup();reject(new DOMException('Systemcheck view retired.','AbortError'));};
   const cleanup=()=>owner.removeEventListener('abort',abort);
   owner.addEventListener('abort',abort,{once:true});
   this.pending.then(value=>{cleanup();if(owner.aborted)abort();else resolve(value);},error=>{
    cleanup();if(owner.aborted){abort();return;}
    // A failed refresh preserves Source's last successful application flag.
    // The root still presents the failure; an unknown startup stays blocked.
    const known=this.loginRequired();if(known===null)reject(error);else resolve(known);
   });
  });
 }
 ngOnDestroy(){this.owner.abort();}
}
