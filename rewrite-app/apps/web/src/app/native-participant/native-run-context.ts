import {InjectionToken,type ComponentRef,type EnvironmentInjector} from '@angular/core';
export interface NativeRunContext {
 readonly testId:string;
 readonly actorScope:AbortSignal;
 readonly signal:AbortSignal;
 readonly current:boolean;
 injector:EnvironmentInjector;
 view:ComponentRef<unknown>|undefined;
 notify():void;
 destroy():void;
}
export const NATIVE_RUN_CONTEXT=new InjectionToken<NativeRunContext>('Owned native participant run');
