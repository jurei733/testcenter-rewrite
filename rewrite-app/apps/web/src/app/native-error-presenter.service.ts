import {Injectable,signal,type Injector} from '@angular/core';

export type NativeErrorPresenter=(injector:Injector,error:unknown,owner:AbortSignal)=>()=>void;

/** Document-lifetime code capability, with no actor data or view-owned closures.
 * Routed shells install their already loaded dialog before rendering the UI. */
@Injectable({providedIn:'root'})
export class NativeErrorPresenterService {
 private readonly value=signal<NativeErrorPresenter|undefined>(undefined);
 readonly presenter=this.value.asReadonly();
 register(presenter:NativeErrorPresenter){this.value.set(presenter);}
}
