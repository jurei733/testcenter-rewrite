import {inject} from '@angular/core';
import {Router,type Routes,type CanActivateFn,type CanDeactivateFn} from '@angular/router';
import {firstValueFrom,isObservable} from 'rxjs';
import {afterNativeSessionRestore} from '../native-monitor/native-session-route.guard';
import {NativeMonitorSessionService} from '../native-monitor/native-session.service';
import {legacyBookmarkQueryKey} from './original-participant-bookmark';
import {NativeRunRuntime,validNativeTestId} from './native-run-runtime.service';
import type {NativeRunContext} from './native-run-context';
import {NativeRunHostComponent} from './native-run-host.component';
import {UnithostComponent} from './test-controller/components/unithost/unithost.component';
import {TestStatusComponent} from './test-controller/components/test-status/test-status.component';
import {UnitActivateGuard} from './test-controller/routing/unit-activate.guard';
import {UnitDeactivateGuard} from './test-controller/routing/unit-deactivate.guard';
import {TestControllerDeactivateGuard} from './test-controller/routing/test-controller-deactivate.guard';
import {TestControllerErrorPausedActivateGuard} from './test-controller/routing/test-controller-error-paused-activate.guard';

function ownedGuard(ctx:NativeRunContext,run:()=>unknown,retiredResult:boolean):Promise<any>{
 if(!ctx.current)return Promise.resolve(retiredResult);
 return new Promise((resolve,reject)=>{
  const abort=()=>resolve(retiredResult);ctx.signal.addEventListener('abort',abort,{once:true});
  let result:unknown;try{result=run();}catch(error){ctx.signal.removeEventListener('abort',abort);reject(error);return;}
  Promise.resolve(isObservable(result)?firstValueFrom(result):result).then(value=>resolve(ctx.current?value:retiredResult),error=>ctx.current?reject(error):resolve(retiredResult)).finally(()=>ctx.signal.removeEventListener('abort',abort));
 });
}
const access:CanActivateFn=route=>{
 const session=inject(NativeMonitorSessionService),router=inject(Router);
 return afterNativeSessionRestore(session,()=>{
  const current=session.access();
  const testId=route.paramMap.get('t');
  if((testId===null||validNativeTestId(testId))&&current?.claims.test?.length&&!current.flags.includes('codeRequired'))return true;
  return router.parseUrl(route.queryParamMap.get(legacyBookmarkQueryKey)==='1'?'/native-start/dispatch':'/native-start');
 });
};
const unitAccess:CanActivateFn=(route,state)=>{
 const ctx=inject(NativeRunRuntime).active(),router=inject(Router),id=route.parent?.paramMap.get('t')??'';
 if(!ctx?.current||ctx.testId!==id)return router.parseUrl(validNativeTestId(id)?'/native-test/'+id:'/native-start');
 return ownedGuard(ctx,async()=>ctx.injector.get(TestControllerErrorPausedActivateGuard).canActivate()&&await ctx.injector.get(UnitActivateGuard).canActivate(route),false);
};
const unitExit:CanDeactivateFn<UnithostComponent>=(component,route,state,next)=>{
 const ctx=inject(NativeRunRuntime).active();return ctx?ownedGuard(ctx,()=>ctx.injector.get(UnitDeactivateGuard).canDeactivate(component,route,state,next),true):true;
};
const runExit:CanDeactivateFn<NativeRunHostComponent>=(component,route,state,next)=>{
 const ctx=component.ownedContext;if(!ctx)return true;
 return ownedGuard(ctx,()=>ctx.injector.get(TestControllerDeactivateGuard).canDeactivate(ctx.view?.instance as any,route,state,next),true);
};
export const nativeParticipantRoutes:Routes=[
 {path:'status',pathMatch:'full',canActivate:[access],loadComponent:()=>import('./native-standalone-test-status.component').then(module=>module.NativeStandaloneTestStatusComponent)},
 {path:':t',component:NativeRunHostComponent,canActivate:[access],canDeactivate:[runExit],children:[
 {path:'',pathMatch:'full',children:[]},
 {path:'status',component:TestStatusComponent},
 {path:'u/:u',component:UnithostComponent,canActivate:[unitAccess],canDeactivate:[unitExit]}
 ]}];
