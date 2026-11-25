import {ChangeDetectorRef,Component,Input,ViewChild,inject,type OnChanges,type OnDestroy} from '@angular/core';
import {MatButton} from '@angular/material/button';
import {MatCheckbox} from '@angular/material/checkbox';
import {MatDialog,type MatDialogRef} from '@angular/material/dialog';
import {MatProgressBar} from '@angular/material/progress-bar';
import {MatSnackBar} from '@angular/material/snack-bar';
import {MatSort,MatSortHeader} from '@angular/material/sort';
import {MatTableModule,MatTableDataSource} from '@angular/material/table';
import {MatTooltip} from '@angular/material/tooltip';
import type {SystemCheckReportBreakdown} from '@testcenter-rewrite-app/domain';
import {OriginalSystemCheckReportsController,type SystemCheckTableRow} from './original-system-check-reports-controller';
import {OriginalParticipantConfirmationDialogComponent} from './original-participant-confirmation-dialog.component';
import {OriginalToastContainerComponent} from './original-toast-container.component';
import {OriginalToastService} from './original-toast.service';
import {OriginalWorkspaceFileIconComponent} from './original-workspace-file-icon.component';
import {RewriteAppApiService} from './rewrite-app-api.service';
import {RewriteAppShellRequestService} from './rewrite-app-shell-request.service';
import {RewriteAppUiStateService} from './rewrite-app-ui-state.service';

@Component({selector:'app-original-system-check-reports',standalone:true,
 providers:[OriginalToastService],
 imports:[MatButton,MatCheckbox,MatProgressBar,MatSort,MatSortHeader,MatTableModule,MatTooltip,
  OriginalWorkspaceFileIconComponent,OriginalToastContainerComponent],
 templateUrl:'./original-system-check-reports.component.html',
 styles:[`:host { display:block; min-width:0; } .columnhost { display:flex; flex-direction:column; }
  .flex-row { display:flex; flex-direction:row; } .flex-column { display:flex; flex-direction:column; }
  .mat-mdc-raised-button { min-width:100px; margin:2px; }
  button.mat-mdc-button-base:disabled { opacity:1; }
  button:hover { transform:none; }
  [role=alert] { color:var(--mat-sys-error); }`]
})
export class OriginalSystemCheckReportsComponent implements OnChanges,OnDestroy {
 @Input({required:true}) sessionToken='';
 @Input({required:true}) tenantKey='';
 @Input({required:true}) workspaceKey='';
 @Input() workspaceNumber='';
 @Input() nativeRole?:'RO'|'RW';
 private readonly state=inject(RewriteAppUiStateService);
 private readonly request=inject(RewriteAppShellRequestService);
 private readonly api=inject(RewriteAppApiService);
 private readonly changed=inject(ChangeDetectorRef);
 private readonly dialogs=inject(MatDialog);
 private readonly snacks=inject(MatSnackBar);
 private readonly toasts=inject(OriginalToastService);
 private destroyed=false;
 private deletion:MatDialogRef<OriginalParticipantConfirmationDialogComponent>|null=null;
 readonly data=new MatTableDataSource<SystemCheckTableRow>([]);
 readonly columns=['selectCheckbox','syscheckLabel','number','details-os','details-browser'];
 readonly controller=new OriginalSystemCheckReportsController(<T>(method:string,path:string,body:unknown,token:string)=>path.startsWith('/workspace/')?
  this.api.send<T>(method,path,body,{AuthToken:token}).then(result=>result.payload):
  this.request.request<T>('Systemcheck Berichte',method,path,body,{quiet:true,headers:{authorization:'Bearer '+token}}),
  ()=>({token:this.state.ops.adminSessionToken.trim(),tenantKey:this.tenantKey,workspaceKey:this.workspaceKey,
    workspaceNumber:this.workspaceNumber,nativeRole:this.nativeRole}),
  ()=>{if(!this.destroyed){this.data.data=this.controller.rows;this.changed.markForCheck();}});
 @ViewChild(MatSort) set sort(value:MatSort){this.data.sort=value;}
 constructor(){
  this.data.sortingDataAccessor=(row,key)=>key==='syscheckLabel'?row.checkLabel:key==='number'?row.reportCount:
   this.details(key==='details-os'?row.operatingSystemVersions:row.browserVersions).map(item=>item.value).join('\n');
 }
 details(rows:SystemCheckReportBreakdown[]):SystemCheckReportBreakdown[]{return [...rows].sort((a,b)=>a.value<b.value?-1:a.value>b.value?1:0);}
 ngOnChanges():void {this.deletion?.close(false);void this.controller.connect();}
 ngOnDestroy():void {this.destroyed=true;this.deletion?.close(false);this.controller.destroy();}
 async download():Promise<void>{
  const result=await this.controller.download(async(path,token)=>(await this.api.download(path,path.startsWith('/workspace/')?
    {AuthToken:token,Accept:'text/csv'}:{authorization:'Bearer '+token})).blob);
  if(!result || !result.current() || this.destroyed)return;
  if(this.workspaceNumber && !result.blob.size){this.toasts.show('Keine Daten verfügbar.');return;}
  const url=URL.createObjectURL(result.blob),link=document.createElement('a');
  link.href=url;link.download='iqb-testcenter-syscheckreports.csv';document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 deleteReports():void {
  const captured=this.controller.captureDeletion();if(!captured || this.deletion)return;
  const prompt=captured.ids.length>1?`Es werden alle Berichte für diese ${captured.ids.length} Systemchecks `:
   `Es werden alle Berichte für diesen Systemcheck "${captured.ids[0]}" `;
  this.deletion=this.dialogs.open(OriginalParticipantConfirmationDialogComponent,{panelClass:'original-participant-confirmation-dialog',autoFocus:'dialog',
   data:{title:'Löschen von Berichten',message:prompt+'gelöscht. Fortsetzen?',confirmLabel:'Berichtsdaten löschen',cancelLabel:'Abbrechen',
    safeMode:false}});
  this.deletion.afterClosed().subscribe(async accepted=>{
   this.deletion=null;if(!accepted || this.destroyed)return;
   await captured.confirm((message,action)=>{
    if(!this.destroyed && captured.current())this.snacks.open(message,action,{
      duration:1000,...(this.workspaceNumber?{panelClass:'original-workspace-report-snackbar'}:{})
    });
   });
  });
 }
}
