import {ChildrenOutletContexts,ActivatedRoute,Router} from '@angular/router';
import {ErrorHandler,Injectable,inject,EnvironmentInjector,Injector,createEnvironmentInjector,signal,type ComponentRef,type ViewContainerRef} from '@angular/core';
import {Subscription,type Observable} from 'rxjs';
import {NativeMonitorSessionService} from '../native-monitor/native-session.service';
import {NativeHttpClient} from './native-http-client';
import {NATIVE_RUN_CONTEXT,type NativeRunContext} from './native-run-context';
import {NATIVE_RUN_TEST_ID,NATIVE_BACKEND_URL,NATIVE_FILE_SERVER_URL,NATIVE_BROADCASTER_URL,NATIVE_PRODUCTION,NATIVE_RENDER_NOTIFY,NATIVE_ERROR_RECEIVER} from './native-tokens';
import {dispatchOwnedError,ownAsyncError} from '../owned-error-routing';
import {AppError} from './app.interfaces';
import {nativeOwnedRouter} from './native-owned-router';
import {UnitActivateGuard} from './test-controller/routing/unit-activate.guard';
import {UnitDeactivateGuard} from './test-controller/routing/unit-deactivate.guard';
import {TestControllerErrorPausedActivateGuard} from './test-controller/routing/test-controller-error-paused-activate.guard';
import {TestControllerDeactivateGuard} from './test-controller/routing/test-controller-deactivate.guard';
import {MAT_FORM_FIELD_DEFAULT_OPTIONS} from '@angular/material/form-field';
import {TestControllerComponent} from './test-controller/components/test-controller/test-controller.component';
import {TestControllerService} from './test-controller/services/test-controller.service';
import {TestLoaderService} from './test-controller/services/test-loader.service';
import {BackendService} from './test-controller/services/backend.service';
import {CommandService} from './test-controller/services/command.service';
import {PageService} from './test-controller/services/page.service';
import {VeronaAPIService} from './test-controller/services/verona-api.service';
import {MainDataService} from './shared/services/maindata/maindata.service';
import {CustomtextService} from './shared/services/customtext/customtext.service';
import {MessageService} from './shared/services/message.service';
import {ToastService} from './shared/services/toast.service';
import {HeaderService} from './shared/services/header.service';
import {ThemeService} from './shared/services/theme.service';
import {AssetService} from './shared/services/asset.service';
import {UserAgentService} from './shared/services/user-agent.service';
import {NativeSharedBackendService} from './native-shared-backend.service';
import {NativeOwnedDialog,NativeOwnedSnackBar} from './native-owned-overlays';

export const validNativeTestId=(id:string)=>/^[1-9]\d*$/.test(id)&&BigInt(id)<=9223372036854775807n;
@Injectable({providedIn:'root'})
export class NativeRunRuntime {
 private readonly root=inject(EnvironmentInjector);
 private readonly session=inject(NativeMonitorSessionService);
 private readonly router=inject(Router);
 readonly active=signal<NativeRunContext|null>(null);
 mount(testId:string,slot:ViewContainerRef,route:ActivatedRoute,children:ChildrenOutletContexts):NativeRunContext {
  if(!validNativeTestId(testId)||!this.session.access()?.token||this.session.access()?.flags.includes('codeRequired'))throw new Error('Dieser Test ist nicht freigegeben.');
  this.active()?.destroy();
  const actorScope=this.session.accessSignal,lifetime=new AbortController(),subscriptions=new Subscription();
  actorScope.throwIfAborted();let destroyed=false,scheduled=false,view:ComponentRef<TestControllerComponent>|undefined;
  let env:EnvironmentInjector|undefined,http:NativeHttpClient|undefined;
  const ctx:NativeRunContext={testId,actorScope,signal:AbortSignal.any([actorScope,lifetime.signal]),
   get current(){return !destroyed&&!ctx.signal.aborted&&thisRuntime.active()===ctx&&thisRuntime.session.accessSignal===actorScope;},
   injector:undefined as unknown as EnvironmentInjector,view:undefined,
   notify(){if(!ctx.current||scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;if(ctx.current&&view&&!view.hostView.destroyed)view.changeDetectorRef.markForCheck();});},
   destroy(){if(destroyed)return;destroyed=true;actorScope.removeEventListener('abort',retire);lifetime.abort();subscriptions.unsubscribe();http?.ngOnDestroy();view?.destroy();env?.destroy();ctx.view=undefined;if(thisRuntime.active()===ctx)thisRuntime.active.set(null);}
  };
  const thisRuntime=this,retire=()=>ctx.destroy();this.active.set(ctx);
  const report=(error:unknown)=>{
   if(!ctx.current)return;
   const value=error instanceof AppError?error:new AppError({type:'script',label:`Programmfehler: ${error instanceof Error?error.name:'Error'}`,description:error instanceof Error?error.message:String(error)});
   ctx.injector.get(MainDataService).appError=value;ctx.notify();
  };
  try{
   env=createEnvironmentInjector([
    {provide:NATIVE_RUN_CONTEXT,useValue:ctx},{provide:NATIVE_RUN_TEST_ID,useValue:testId},
    {provide:NATIVE_BACKEND_URL,useValue:'/'},{provide:NATIVE_FILE_SERVER_URL,useValue:'/'},{provide:NATIVE_BROADCASTER_URL,useValue:''},{provide:NATIVE_PRODUCTION,useValue:true},
    {provide:NATIVE_RENDER_NOTIFY,useValue:()=>ctx.notify()},{provide:Router,useFactory:()=>nativeOwnedRouter(this.router,()=>ctx)},
    {provide:NATIVE_ERROR_RECEIVER,useValue:report},
    {provide:ErrorHandler,useValue:{handleError(error:unknown){
     if(dispatchOwnedError(error))return;
     const cause=error&&typeof error==='object'?error:new Error(String(error));
     ownAsyncError(cause,()=>report(error));dispatchOwnedError(cause);
    }}},
    {provide:MAT_FORM_FIELD_DEFAULT_OPTIONS,useValue:{subscriptSizing:'dynamic'}},UnitActivateGuard,UnitDeactivateGuard,TestControllerErrorPausedActivateGuard,TestControllerDeactivateGuard,
    NativeHttpClient,NativeSharedBackendService,MainDataService,CustomtextService,MessageService,ToastService,HeaderService,ThemeService,AssetService,UserAgentService,
    NativeOwnedDialog,NativeOwnedSnackBar,TestControllerService,TestLoaderService,BackendService,CommandService,PageService,VeronaAPIService
   ],this.root,'native-run-'+testId);
   ctx.injector=env;http=ctx.injector.get(NativeHttpClient);
   actorScope.addEventListener('abort',retire,{once:true});
   const injector=Injector.create({providers:[{provide:ActivatedRoute,useValue:route},{provide:ChildrenOutletContexts,useValue:children}],parent:ctx.injector});
   view=slot.createComponent(TestControllerComponent,{injector,environmentInjector:env});ctx.view=view as ComponentRef<unknown>;
   const tcs=ctx.injector.get(TestControllerService),mds=ctx.injector.get(MainDataService),pages=ctx.injector.get(PageService);
   // Notifications follow actual Source producers. No timer or artificial poll
   // is allowed to make an otherwise unobserved state change appear on screen.
   const events:Observable<unknown>[]=[tcs.state$,tcs.unitContentReady$,tcs.currentUnitSequenceId$,tcs.configChanged$,tcs.timers$,tcs.navigation$,mds.appError$,mds.appSubTitle$,mds.appWindowHasFocus$,mds.postMessage$,pages.pagesUpdated];
   for(const stream of events)subscriptions.add(stream.subscribe(()=>ctx.notify()));
   view.changeDetectorRef.detectChanges();return ctx;
  }catch(error){ctx.destroy();throw error;}
 }
}
