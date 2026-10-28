import {ChangeDetectorRef,Component,Input,ViewChild,inject,type OnChanges,type OnDestroy} from '@angular/core';
import {MatButton} from '@angular/material/button';
import {MatCheckbox} from '@angular/material/checkbox';
import {MatDialog,type MatDialogRef} from '@angular/material/dialog';
import {MatProgressBar} from '@angular/material/progress-bar';
import {MatSnackBar} from '@angular/material/snack-bar';
import {MatSort,MatSortHeader} from '@angular/material/sort';
import {MatTableModule,MatTableDataSource} from '@angular/material/table';
import {MatTooltip} from '@angular/material/tooltip';
import type {SystemCheckReportStatistics,SystemCheckReportBreakdown} from '@testcenter-rewrite-app/domain';
import {ApplicationSettingsService} from './application-settings.service';
import {OriginalSystemCheckReportsController} from './original-system-check-reports-controller';
import {OriginalParticipantConfirmationDialogComponent} from './original-participant-confirmation-dialog.component';
import {OriginalWorkspaceFileIconComponent} from './original-workspace-file-icon.component';
import {RewriteAppApiService} from './rewrite-app-api.service';
import {RewriteAppShellRequestService} from './rewrite-app-shell-request.service';
import {RewriteAppUiStateService} from './rewrite-app-ui-state.service';

@Component({selector:'app-original-system-check-reports',standalone:true,
 imports:[MatButton,MatCheckbox,MatProgressBar,MatSort,MatSortHeader,MatTableModule,MatTooltip,OriginalWorkspaceFileIconComponent],
 templateUrl:'./original-system-check-reports.component.html',
 styles:[`:host { display:block; min-width:0; } .columnhost { display:flex; flex-direction:column; }
  .flex-row { display:flex; flex-direction:row; } .flex-column { display:flex; flex-direction:column; }
  .mat-icon { margin-right:5px; } .mat-mdc-raised-button { min-width:100px; margin:2px; }
  .table-header { font-weight:700; } [role=alert] { color:var(--mat-sys-error); }`]
})
export class OriginalSystemCheckReportsComponent implements OnChanges,OnDestroy {
 @Input({required:true}) sessionToken='';
 @Input({required:true}) tenantKey='';
 @Input({required:true}) workspaceKey='';
 private readonly state=inject(RewriteAppUiStateService);
 private readonly request=inject(RewriteAppShellRequestService);
 private readonly api=inject(RewriteAppApiService);
 private readonly changed=inject(ChangeDetectorRef);
 private readonly dialogs=inject(MatDialog);
 private readonly snacks=inject(MatSnackBar);
 private readonly settings=inject(ApplicationSettingsService);
 private destroyed=false;
 private deletion:MatDialogRef<OriginalParticipantConfirmationDialogComponent>|null=null;
 readonly data=new MatTableDataSource<SystemCheckReportStatistics>([]);
 readonly columns=['selectCheckbox','syscheckLabel','number','details-os','details-browser'];
 readonly controller=new OriginalSystemCheckReportsController((method,path,body,token)=>
  this.request.request('Systemcheck Berichte',method,path,body,{quiet:true,headers:{authorization:'Bearer '+token}}),
  ()=>({token:this.state.ops.adminSessionToken.trim(),tenantKey:this.tenantKey,workspaceKey:this.workspaceKey}),
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
  const result=await this.controller.download(async(path,token)=>(await this.api.download(path,{authorization:'Bearer '+token})).blob);
  if(!result || !result.current() || this.destroyed)return;
  const url=URL.createObjectURL(result.blob),link=document.createElement('a');
  link.href=url;link.download='iqb-testcenter-syscheckreports.csv';document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 deleteReports():void {
  const captured=this.controller.captureDeletion();if(!captured || this.deletion)return;
  const prompt=captured.ids.length>1?`Es werden alle Berichte für diese ${captured.ids.length} Systemchecks `:
   `Es werden alle Berichte für diesen Systemcheck "${captured.ids[0]}" `;
  this.deletion=this.dialogs.open(OriginalParticipantConfirmationDialogComponent,{panelClass:'original-participant-confirmation-dialog',
   data:{title:'Löschen von Berichten',message:prompt+'gelöscht. Fortsetzen?',confirmLabel:'Berichtsdaten löschen',cancelLabel:'Abbrechen',
    safeMode:this.settings.settings().themeName==='Primar'}});
  this.deletion.afterClosed().subscribe(async accepted=>{
   this.deletion=null;if(!accepted || this.destroyed)return;
   await captured.confirm();
   if(!this.destroyed && captured.current() && this.controller.notice)this.snacks.open(this.controller.notice,'',{duration:1000});
  });
 }
}
