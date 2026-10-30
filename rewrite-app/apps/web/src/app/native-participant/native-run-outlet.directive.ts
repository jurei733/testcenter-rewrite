import {Directive,inject,type OnDestroy} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {NATIVE_RUN_CONTEXT} from './native-run-context';

/** Child routes use the same owned injector as their Source controller. */
@Directive({selector:'router-outlet[nativeRunOutlet]',standalone:true})
export class NativeRunOutletDirective implements OnDestroy {
 private readonly outlet=inject(RouterOutlet);
 private readonly context=inject(NATIVE_RUN_CONTEXT);
 private readonly original=this.outlet.activateWith;
 private readonly activate:RouterOutlet['activateWith']=(route,_injector)=>{
  if(this.context.current)this.original.call(this.outlet,route,this.context.injector);
 };
 constructor(){this.outlet.activateWith=this.activate;}
 ngOnDestroy(){if(this.outlet.activateWith===this.activate)this.outlet.activateWith=this.original;}
}
