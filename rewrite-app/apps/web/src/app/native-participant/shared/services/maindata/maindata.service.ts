import {NativeHttpClient} from '../../../native-http-client';
import {Injectable,inject,type OnDestroy} from '@angular/core';
import {BehaviorSubject,fromEvent,defer,takeUntil,EMPTY,firstValueFrom} from 'rxjs';
import {NativeMonitorSessionService} from '../../../../native-monitor/native-session.service';
import {type AuthData,AppError} from '../../../app.interfaces';
@Injectable()
export class MainDataService implements OnDestroy {
 readonly session=inject(NativeMonitorSessionService);
 readonly http=inject(NativeHttpClient);
 readonly ownerScope=this.http.accessSignal;
 readonly appError$=new BehaviorSubject<AppError|null>(null);
 readonly appSubTitle$=new BehaviorSubject('');
 readonly appWindowHasFocus$=new BehaviorSubject(document.hasFocus());
 readonly postMessage$=defer(()=>this.ownerScope.aborted||!this.http.isCurrent?EMPTY:fromEvent<MessageEvent>(window,'message').pipe(takeUntil(fromEvent(this.ownerScope,'abort'))));
 // Protocol bounds of the pinned Original19 frontend and its bundled response SDK.
 readonly sysStatus={fileService:'unknown',broadcastingService:'unknown',cacheService:'unknown'};
 async refreshSysStatus(){
  const scope=this.ownerScope;if(scope.aborted||!this.http.isCurrent)return;
  try{const value=await firstValueFrom(this.http.get('/system/status'));if(!this.http.isCurrent||scope.aborted)return;for(const key of ['fileService','broadcastingService','cacheService'] as const){if(typeof value[key]!=='string')throw Error('Invalid native service status.');this.sysStatus[key]=value[key];}}
  catch(error){if(this.http.isCurrent&&!scope.aborted)this.appError=error instanceof AppError?error:new AppError({type:'backend',label:'Systemstatus nicht verfügbar',description:String(error)});}
 }
 readonly appConfig={fileServiceUri:'',veronaPlayerApiVersionMin:2,veronaPlayerApiVersionMax:6,iqbStandardResponseTypeMin:1,iqbStandardResponseTypeMax:5};
 private focus=()=>this.appWindowHasFocus$.next(true);private blur=()=>this.appWindowHasFocus$.next(false);
 constructor(){window.addEventListener('focus',this.focus);window.addEventListener('blur',this.blur);if(this.ownerScope.aborted)this.retire();else this.ownerScope.addEventListener('abort',this.retire,{once:true});}
 getAuthData(){return this.http.isCurrent&&!this.ownerScope.aborted?this.session.access() as unknown as AuthData|null:null;}
 get isFullScreen(){return !!document.fullscreenElement;}
 set appError(value:AppError|null){this.appError$.next(value);}
 get appError(){return this.appError$.value;}
 reloadPage(_clearCache=true){if(this.http.isCurrent&&!this.ownerScope.aborted)window.location.reload();}
 clearErrorBuffer(){this.appError$.next(null);}
 private retired=false;
 private retire=()=>{if(this.retired)return;this.retired=true;window.removeEventListener('focus',this.focus);window.removeEventListener('blur',this.blur);this.appError$.next(null);this.appSubTitle$.next('');this.appError$.complete();this.appWindowHasFocus$.complete();this.appSubTitle$.complete();};
 ngOnDestroy(){this.ownerScope.removeEventListener('abort',this.retire);this.retire();}
}
