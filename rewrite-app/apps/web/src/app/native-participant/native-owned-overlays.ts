import {EnvironmentInjector, Injectable, inject} from '@angular/core';
import {DOCUMENT} from '@angular/common';
import type {ComponentType} from '@angular/cdk/portal';
import {MatDialog, type MatDialogConfig} from '@angular/material/dialog';
import {MatSnackBar, type MatSnackBarConfig, type MatSnackBarRef, type TextOnlySnackBar} from '@angular/material/snack-bar';
import {EMPTY, type Observable, Subject, filter, takeUntil} from 'rxjs';
import {NativeHttpClient} from './native-http-client';
import {VeronaAPIService} from './test-controller/services/verona-api.service';

/** The Source callers consume afterClosed; retired contexts complete without
 * opening UI or inventing a user decision. Providers belong to one run. */
@Injectable()
export class NativeOwnedDialog {
 private readonly parent=inject(MatDialog);
 private readonly http=inject(NativeHttpClient);
 private readonly api=inject(VeronaAPIService);
 private readonly injector=inject(EnvironmentInjector);
 private readonly records=new Set<()=>void>();
 private retired=false;
 private readonly retire=()=>{this.retired=true;for(const close of [...this.records])close();};
 constructor(){this.http.accessSignal.addEventListener('abort',this.retire,{once:true});}
 open<T,D=any,R=any>(component:ComponentType<T>,config:MatDialogConfig<D>={}):{afterClosed():Observable<R|undefined>}{
  if(this.retired||!this.http.isCurrent)return {afterClosed:()=>EMPTY};
  const lease=this.api.channel.ownedLease(),release=this.api.channel.hold(),cancelled=new Subject<void>();
  let ref;
  try{ref=this.parent.open<T,D,R>(component,{...config,injector:this.injector});}
  catch(error){release();throw error;}
  let cleaned=false;
  const cleanup=()=>{if(cleaned)return;cleaned=true;this.records.delete(cancel);lease?.signal.removeEventListener('abort',cancel);release();};
  const cancel=()=>{cancelled.next();cancelled.complete();cleanup();ref.componentRef?.location.nativeElement.remove();ref.close();};
  this.records.add(cancel);lease?.signal.addEventListener('abort',cancel,{once:true});
  const current=()=>!this.retired&&this.http.isCurrent&&(!lease||this.api.channel.isCurrent(lease));
  const closed=ref.afterClosed().pipe(takeUntil(cancelled),filter(current));
  ref.afterClosed().subscribe({next:cleanup,complete:()=>{cleanup();cancelled.complete();}});
  // Initialize Source forms once under the app's zoneless scheduler.
  try{ref.componentRef?.changeDetectorRef.detectChanges();}catch(error){cancel();throw error;}
  if(!current())cancel();
  return {afterClosed:()=>closed};
 }
 ngOnDestroy(){this.http.accessSignal.removeEventListener('abort',this.retire);this.retire();}
}

/** Source timer notices retain Material's single-notice behavior, while a
 * retired run can dismiss only the refs it actually opened. */
@Injectable()
export class NativeOwnedSnackBar {
 private readonly parent=inject(MatSnackBar);
 private readonly http=inject(NativeHttpClient);
 private readonly document=inject(DOCUMENT);
 private readonly refs=new Map<MatSnackBarRef<TextOnlySnackBar>,string>();
 private retired=false;
 private readonly retire=()=>{this.retired=true;for(const [ref,panel] of [...this.refs]){this.document.querySelectorAll('.'+panel).forEach(node=>node.remove());ref.dismiss();}this.refs.clear();};
 constructor(){this.http.accessSignal.addEventListener('abort',this.retire,{once:true});}
 open(message:string,action?:string,config?:MatSnackBarConfig):MatSnackBarRef<TextOnlySnackBar>|undefined{
  if(this.retired||!this.http.isCurrent)return;
  const panel='native-participant-notice-'+crypto.randomUUID().replaceAll('-','');
  const panelClass=typeof config?.panelClass==='string'?[config.panelClass]:config?.panelClass??[];
  const ref=this.parent.open(message,action,{...config,panelClass:[...panelClass,panel]});this.refs.set(ref,panel);
  ref.afterDismissed().subscribe(()=>this.refs.delete(ref));
  if(this.retired||!this.http.isCurrent){this.document.querySelectorAll('.'+panel).forEach(node=>node.remove());ref.dismiss();this.refs.delete(ref);}
  return ref;
 }
 ngOnDestroy(){this.http.accessSignal.removeEventListener('abort',this.retire);this.retire();}
}
