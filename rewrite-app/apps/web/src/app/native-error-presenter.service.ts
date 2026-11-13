import {Injectable,signal,type Injector} from '@angular/core';

export type NativeErrorPresenter=(injector:Injector,error:unknown,owner:AbortSignal)=>()=>void;

/** Document-lifetime code capability, with no actor data or view-owned closures.
 * Routed shells install their already loaded dialog before rendering the UI. */
@Injectable({providedIn:'root'})
export class NativeErrorPresenterService {
 private readonly value=signal<NativeErrorPresenter|undefined>(undefined);
 private loading:Promise<NativeErrorPresenter>|undefined;
 private resolveReady:((presenter:NativeErrorPresenter)=>void)|undefined;
 readonly presenter=this.value.asReadonly();
 register(presenter:NativeErrorPresenter){
  this.value.set(presenter);this.resolveReady?.(presenter);this.resolveReady=undefined;
 }
 /** Load independently from routed UI. A shell that already has this code
  * can also satisfy readiness while the small import wrapper is still pending. */
 ready():Promise<NativeErrorPresenter>{
  const current=this.value();if(current)return Promise.resolve(current);
  if(!this.loading)this.loading=new Promise((resolve,reject)=>{
   this.resolveReady=resolve;
   void import('./native-system-check/native-system-check-installation-error').then(
    module=>this.register(module.openNativeSystemCheckInstallationError),
    error=>{if(!this.value()){this.loading=undefined;this.resolveReady=undefined;reject(error);}}
   );
  });
  return this.loading;
 }
}
