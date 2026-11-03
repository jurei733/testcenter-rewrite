import {Injectable,inject} from '@angular/core';
import {type ActivatedRouteSnapshot,type CanDeactivate,Router,type RouterStateSnapshot,NavigationEnd,NavigationCancel,NavigationError} from '@angular/router';
import {Observable,defer,of,race} from 'rxjs';
import {defaultIfEmpty,filter,finalize,take,tap} from 'rxjs/operators';
import {NativeHttpClient} from '../../native-http-client';
import {UnithostComponent} from '../components/unithost/unithost.component';
import {TestControllerService} from '../services/test-controller.service';
@Injectable()
export class UnitDeactivateGuard implements CanDeactivate<UnithostComponent>{
 private readonly http=inject(NativeHttpClient);
 constructor(private tcs:TestControllerService,private router:Router){}
 canDeactivate(component:UnithostComponent,_route:ActivatedRouteSnapshot,_state:RouterStateSnapshot,next:RouterStateSnapshot){
  if(!this.http.isCurrent)return true;
  const navigation=this.router.currentNavigation(),trigger=navigation?.trigger;
  if(this.tcs.booklet?.config.browserBehaviour==='preventNav'&&(trigger==='popstate'||trigger==='hashchange'))return false;
  return defer(()=>{
   if(!this.http.isCurrent)return of(true);
   const release=component.holdPlayer(),scope=this.http.accessSignal;let decision:boolean|undefined;
   const settled=this.router.events.pipe(filter(event=>(event instanceof NavigationEnd||event instanceof NavigationCancel||event instanceof NavigationError)&&event.id===navigation?.id),take(1)).subscribe(()=>release());
   const retired=new Observable<boolean>(subscriber=>{const done=()=>{subscriber.next(true);subscriber.complete();};if(scope.aborted)done();else scope.addEventListener('abort',done,{once:true});return()=>scope.removeEventListener('abort',done);});
   return race(retired,defer(()=>this.tcs.getUnitDeactivationCheck(next.url))).pipe(defaultIfEmpty(false),take(1),tap(value=>{decision=value;if(!value){settled.unsubscribe();release();}}),finalize(()=>{if(decision!==true||navigation?.id===undefined||!this.http.isCurrent){settled.unsubscribe();release();}}));
  });
 }
}
