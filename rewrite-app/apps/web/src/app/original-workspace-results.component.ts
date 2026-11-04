import {CommonModule} from '@angular/common';
import {ChangeDetectorRef,Component,EventEmitter,Input,Output,ViewChild,inject,type OnChanges,type OnDestroy} from '@angular/core';
import {MatButton} from '@angular/material/button';
import {MatCheckbox} from '@angular/material/checkbox';
import {MatDialog,type MatDialogRef} from '@angular/material/dialog';
import {MatExpansionModule} from '@angular/material/expansion';
import {MatProgressBar} from '@angular/material/progress-bar';
import {MatSnackBar} from '@angular/material/snack-bar';
import {MatSort,MatSortHeader,type Sort} from '@angular/material/sort';
import {MatTableModule,MatTableDataSource} from '@angular/material/table';
import {MatTooltip} from '@angular/material/tooltip';
import {ApplicationSettingsService} from './application-settings.service';
import {OriginalParticipantConfirmationDialogComponent} from './original-participant-confirmation-dialog.component';
import {OriginalWorkspaceFileIconComponent} from './original-workspace-file-icon.component';
import {OriginalWorkspaceFileNoticeComponent} from './original-workspace-file-notice.component';
import {OriginalWorkspaceResultsController,type OriginalResultsView,type OriginalResultRow,type OriginalTestRow} from './original-workspace-results-controller';
import {createOriginalWorkspaceResultsTransport} from './original-workspace-results-http';
import {RewriteAppUiStateService} from './rewrite-app-ui-state.service';

@Component({selector:'app-original-workspace-results',standalone:true,
 imports:[CommonModule,MatButton,MatCheckbox,MatExpansionModule,MatProgressBar,MatSort,MatSortHeader,MatTableModule,MatTooltip,
  OriginalWorkspaceFileIconComponent,OriginalWorkspaceFileNoticeComponent],
 templateUrl:'./original-workspace-results.component.html',
 styleUrls:['./original-workspace-results.component.css','./original-workspace-tests.component.css']})
export class OriginalWorkspaceResultsComponent implements OnChanges,OnDestroy {
 @Input({required:true}) sessionToken='';
 @Input({required:true}) tenantKey='';
 @Input({required:true}) workspaceKey='';
 @Input({required:true}) view:OriginalResultsView='results';
 @Output() roleChange=new EventEmitter<''|'RO'|'RW'>();
 private readonly state=inject(RewriteAppUiStateService);
 private readonly changed=inject(ChangeDetectorRef);
 private readonly dialogs=inject(MatDialog);
 private readonly snacks=inject(MatSnackBar);
 private readonly settings=inject(ApplicationSettingsService);
 private destroyed=false;
 private deletion:MatDialogRef<OriginalParticipantConfirmationDialogComponent>|null=null;
 readonly resultDataSource=new MatTableDataSource<OriginalResultRow>([]);
 readonly displayedColumns=['selectCheckbox','groupName','bookletsStarted','numUnitsMin','numUnitsMax','numUnitsAvg','lastChange'];
 readonly groupDataSources=new Map<string,MatTableDataSource<OriginalTestRow>>();
 readonly controller=new OriginalWorkspaceResultsController(createOriginalWorkspaceResultsTransport(),
  ()=>({token:this.state.ops.adminSessionToken.trim(),tenantKey:this.tenantKey,workspaceKey:this.workspaceKey,view:this.view}),
  ()=>{if(!this.destroyed){
   this.resultDataSource.data=this.controller.rows;
   const names=new Set(this.controller.groups.map(g=>g.name));for(const key of this.groupDataSources.keys())if(!names.has(key))this.groupDataSources.delete(key);
   for(const group of this.controller.groups){let source=this.groupDataSources.get(group.name);if(!source){source=new MatTableDataSource<OriginalTestRow>([]);this.groupDataSources.set(group.name,source);}source.data=group.rows;}
   this.roleChange.emit(this.controller.role);this.changed.markForCheck();
  }});
 @ViewChild(MatSort) set sort(value:MatSort){if(this.view==='results')this.resultDataSource.sort=value;}
 get groupNames():string[]{return this.controller.groups.map(group=>group.name);}
 rowsFor(name:string):OriginalTestRow[]{return this.controller.groups.find(group=>group.name===name)?.rows??[];}
 getDataSourceForGroup(name:string):MatTableDataSource<OriginalTestRow>{return this.groupDataSources.get(name)!;}
 ngOnChanges():void{this.deletion?.close(false);void this.controller.connect();}
 ngOnDestroy():void{this.destroyed=true;this.deletion?.close(false);this.controller.destroy();}
 setTableSorting(sort:Sort):void{
  const key=sort.active==='login'?'loginName':sort.active==='code'?'code':sort.active==='booklet'?'bookletName':null;
  if(!key)return;const direction=sort.direction==='asc'?1:-1;
  for(const group of this.controller.groups){group.rows.sort((a,b)=>a[key].localeCompare(b[key])*direction);
   const source=this.groupDataSources.get(group.name);if(source)source.data=[...group.rows];}
 }
 downloadResponsesCSV():void{void this.download('response');}
 downloadLogsCSV():void{void this.download('log');}
 downloadReviewsCSV():void{void this.download('review');}
 downloadNewReviewsCSV():void{void this.download('review',true);}
 private async download(type:'response'|'log'|'review',enhanced=false):Promise<void>{
  const result=await this.controller.download(type,enhanced);
  if(!result||!result.current()||this.destroyed)return;
  if(!result.blob.size){this.snacks.open('Keine Daten verfügbar.','',{duration:3000});return;}
  const url=URL.createObjectURL(result.blob),link=document.createElement('a');link.href=url;
  link.download='iqb-testcenter-'+({response:'responses',log:'logs',review:'reviews'}[type])+'.csv';
  document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 deleteData():void{this.deleteSelectedSessions();}
 deleteSelectedSessions():void{
  const captured=this.controller.captureDeletion();if(!captured||this.deletion)return;
  const groups=this.view==='results',plural=captured.count>1;
  const message=groups?'Es werden alle Antwort- und Logdaten in der Datenbank für diese '+
   (plural?`${captured.count} Gruppen `:`Gruppe "${captured.groups[0]}" `)+'gelöscht. Fortsetzen?':
   `Sie haben ${plural?captured.count:'eine'} Test-Session${plural?'s':''} ausgewählt. Soll${plural?'en':''} diese gelöscht werden?`;
  this.deletion=this.dialogs.open(OriginalParticipantConfirmationDialogComponent,{panelClass:'original-participant-confirmation-dialog',
   data:{title:groups?'Löschen von Gruppendaten':'Löschen von Test-Sessions',message,confirmLabel:groups?'Gruppendaten löschen':'Löschen',
    cancelLabel:'Abbrechen',safeMode:this.settings.settings().themeName==='Primar'}});
  this.deletion.afterClosed().subscribe(async accepted=>{
   this.deletion=null;if(!accepted||this.destroyed||!captured.current())return;
   if(await captured.confirm()&&!this.destroyed&&this.controller.notice)this.snacks.open(this.controller.notice,groups?'OK':'Schließen',{duration:groups?5000:3000});
  });
 }
}
