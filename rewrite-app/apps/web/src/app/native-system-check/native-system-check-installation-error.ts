import {HttpErrorResponse,HttpHeaders} from '@angular/common/http';
import type {Injector} from '@angular/core';
import {MatDialog} from '@angular/material/dialog';
import {redactBugReportText} from '@testcenter-rewrite-app/contracts';
import {NativeMonitorHttpError} from '../native-monitor/native-http-error';
import {AppError} from '../native-participant/app.interfaces';
import {nativeRequestError} from '../native-participant/native-http-policy';
import {NativeLoginErrorDialogComponent} from '../native-login-error-dialog.component';

/** Routed shells preload this presenter. Public installation errors belong to the document,
 * independent from actor replacement. Material's Source browser-history close
 * behavior remains enabled. */
export function openNativeSystemCheckInstallationError(injector:Injector,error:unknown,owner:AbortSignal):()=>void{
 if(owner.aborted)return()=>{};
 let mapped:AppError;
 if(error instanceof NativeMonitorHttpError){
  let payload:unknown=error.message;try{payload=JSON.parse(error.message);}catch{}
  mapped=nativeRequestError(new HttpErrorResponse({status:error.status,error:payload,statusText:error.response?.statusText,
   url:error.response?.url,headers:new HttpHeaders({...error.response?.errorId?{'error-id':error.response.errorId}:{},...error.response?.testMode?{'test-mode':error.response.testMode}:{}})}));
 }else if(error instanceof TypeError||error instanceof DOMException)mapped=nativeRequestError(error);
 else mapped=new AppError({type:'script',label:'Programmfehler: '+(error instanceof Error?error.name:'Error'),description:error instanceof Error?error.message:String(error)});
 mapped.description=redactBugReportText(mapped.description);mapped.details=redactBugReportText(mapped.details??'');
 let retired=false;
 const ref=injector.get(MatDialog).open(NativeLoginErrorDialogComponent,{panelClass:'original-native-login-error-dialog',disableClose:true,autoFocus:'dialog',
  data:{error:mapped,url:redactBugReportText(window.location.href),timestamp:Date.now(),reload:()=>{if(!retired&&!owner.aborted)window.location.href=new URL('native-start',document.baseURI).href;}}});
 const retire=()=>{if(retired)return;retired=true;owner.removeEventListener('abort',retire);ref.componentRef?.location.nativeElement.remove();ref.close();};
 owner.addEventListener('abort',retire,{once:true});ref.afterClosed().subscribe(retire);if(owner.aborted)retire();return retire;
}
