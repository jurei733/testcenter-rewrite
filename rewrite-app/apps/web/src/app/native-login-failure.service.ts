import {HttpErrorResponse,HttpHeaders} from '@angular/common/http';
import {Injectable,inject,type OnDestroy} from '@angular/core';
import {MatDialog,type MatDialogRef} from '@angular/material/dialog';
import {redactBugReportText} from '@testcenter-rewrite-app/contracts';
import {NativeMonitorHttpError,NativeMonitorSessionService} from './native-monitor/native-session.service';
import {nativeRequestError} from './native-participant/native-http-policy';
import {NativeLoginErrorDialogComponent} from './native-login-error-dialog.component';
import {AppError} from './native-participant/app.interfaces';
import {NativeErrorPresenterService} from './native-error-presenter.service';
import {openNativeSystemCheckInstallationError} from './native-system-check/native-system-check-installation-error';

/** Source's global error dialog, owned by this unauthenticated entry view. */
@Injectable()
export class NativeLoginFailureService implements OnDestroy {
 private readonly dialogs=inject(MatDialog);
 private readonly session=inject(NativeMonitorSessionService);
 private destroyed=false;
 private close:(()=>void)|undefined;
 constructor(){inject(NativeErrorPresenterService).register(openNativeSystemCheckInstallationError);}
 async show(error:NativeMonitorHttpError,view:AbortSignal,copy?:{label:string;description:string}):Promise<void>{
  if(this.destroyed)return;this.close?.();
  const scope=this.session.accessSignal;
  if(view.aborted||scope.aborted)return;
  let retired=false,ref:MatDialogRef<NativeLoginErrorDialogComponent>|undefined;
  const current=()=>!retired&&!view.aborted&&!scope.aborted&&scope===this.session.accessSignal;
  const retire=()=>{
   if(retired)return;retired=true;
   view.removeEventListener('abort',retire);scope.removeEventListener('abort',retire);
   ref?.componentRef?.location.nativeElement.remove();ref?.close();
   if(this.close===retire)this.close=undefined;
  };
  this.close=retire;view.addEventListener('abort',retire,{once:true});scope.addEventListener('abort',retire,{once:true});
  try{
   // Preserve the asynchronous owner-retirement boundary with preloaded UI.
   await Promise.resolve();
   if(!current())return;
   let payload:unknown=error.message;try{payload=JSON.parse(error.message);}catch{}
   let mapped=nativeRequestError(new HttpErrorResponse({status:error.status,error:payload,
    statusText:error.response?.statusText,url:error.response?.url,headers:new HttpHeaders({...error.response?.errorId?{'error-id':error.response.errorId}:{},...error.response?.testMode?{'test-mode':error.response.testMode}:{}})}));
   if(copy)mapped=new AppError(copy);
   mapped.description=redactBugReportText(mapped.description);mapped.details=redactBugReportText(mapped.details??'');
   ref=this.dialogs.open(NativeLoginErrorDialogComponent,{panelClass:'original-native-login-error-dialog',disableClose:true,autoFocus:'dialog',
    data:{error:mapped,url:redactBugReportText(window.location.href),timestamp:Date.now(),reload:()=>{
     if(!current())return;retire();if(mapped.type==='session')this.session.clear();window.location.href=new URL('native-start',document.baseURI).href;
    }}});
   ref.afterClosed().subscribe(retire);
   if(!current())retire();
  }catch(problem){retire();throw problem;}
 }
 ngOnDestroy(){this.destroyed=true;this.close?.();}
}
