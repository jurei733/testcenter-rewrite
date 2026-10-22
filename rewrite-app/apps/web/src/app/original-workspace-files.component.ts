import {ChangeDetectorRef,Component,Input,inject,type OnChanges,type OnDestroy} from '@angular/core';
import {MatButton,MatIconButton} from '@angular/material/button';
import {MatDivider} from '@angular/material/divider';
import {MatMenu,MatMenuTrigger} from '@angular/material/menu';
import {MatToolbar} from '@angular/material/toolbar';
import {Router,RouterLink} from '@angular/router';
import {AppShellFacade} from './app-shell.facade';
import {OriginalOverlayStylesComponent} from './original-overlay-styles.component';
import {OriginalParticipantLogoutDialogComponent} from './original-participant-logout-dialog.component';
import {OriginalWorkspaceFileSurfaceStylesComponent} from './original-workspace-file-surface-styles.component';
import {MatCard,MatCardHeader,MatCardTitle,MatCardSubtitle,MatCardContent,MatCardActions} from '@angular/material/card';
import {MatCheckbox} from '@angular/material/checkbox';
import {MatDialog,type MatDialogRef} from '@angular/material/dialog';
import {MatAccordion,MatExpansionPanel,MatExpansionPanelHeader,MatExpansionPanelTitle,MatExpansionPanelDescription} from '@angular/material/expansion';
import {MatProgressBar} from '@angular/material/progress-bar';
import {MatProgressSpinner} from '@angular/material/progress-spinner';
import {MatSort,MatSortHeader,type Sort} from '@angular/material/sort';
import {MatTable,MatColumnDef,MatHeaderCellDef,MatHeaderCell,MatCellDef,MatCell,MatHeaderRowDef,MatHeaderRow,MatRowDef,MatRow} from '@angular/material/table';
import {MatTooltip} from '@angular/material/tooltip';
import {MatSnackBar} from '@angular/material/snack-bar';
import type {WorkspaceFileType} from '@testcenter-rewrite-app/domain';
import {OriginalWorkspaceFilesController,type OriginalWorkspaceFile} from './original-workspace-files-controller';
import {RewriteAppShellRequestService} from './rewrite-app-shell-request.service';
import {RewriteAppApiService} from './rewrite-app-api.service';
import {RewriteAppOperatorAccessService} from './rewrite-app-operator-access.service';
import {OriginalWorkspaceFileIconComponent} from './original-workspace-file-icon.component';
import {OriginalWorkspaceFileNoticeComponent} from './original-workspace-file-notice.component';
import {OriginalParticipantConfirmationDialogComponent} from './original-participant-confirmation-dialog.component';
import {ApplicationSettingsService} from './application-settings.service';
import {RewriteAppUiStateService} from './rewrite-app-ui-state.service';

@Component({selector:'app-original-workspace-files',standalone:true,
 imports:[RouterLink,MatToolbar,MatMenu,MatMenuTrigger,MatDivider,MatIconButton,OriginalOverlayStylesComponent,OriginalWorkspaceFileSurfaceStylesComponent,MatButton,MatCard,MatCardHeader,MatCardTitle,MatCardSubtitle,MatCardContent,MatCardActions,
   MatCheckbox,MatAccordion,MatExpansionPanel,MatExpansionPanelHeader,MatExpansionPanelTitle,MatExpansionPanelDescription,
   MatProgressBar,MatProgressSpinner,MatSort,MatSortHeader,MatTable,MatColumnDef,MatHeaderCellDef,MatHeaderCell,MatCellDef,MatCell,
   MatHeaderRowDef,MatHeaderRow,MatRowDef,MatRow,MatTooltip,OriginalWorkspaceFileIconComponent,OriginalWorkspaceFileNoticeComponent],
 templateUrl:'./original-workspace-files.component.html',styleUrls:['./original-login-theme.scss','./original-workspace-files.component.css']})
export class OriginalWorkspaceFilesComponent implements OnChanges,OnDestroy {
 @Input({required:true}) sessionToken='';
 @Input({required:true}) tenantKey='';
 @Input({required:true}) workspaceKey='';
 private readonly state=inject(RewriteAppUiStateService);
 private readonly request=inject(RewriteAppShellRequestService);
 private readonly api=inject(RewriteAppApiService);
 private readonly access=inject(RewriteAppOperatorAccessService);
 private readonly changed=inject(ChangeDetectorRef);
 private readonly dialogs=inject(MatDialog);
 readonly settings=inject(ApplicationSettingsService);
 readonly app=inject(AppShellFacade);
 private readonly router=inject(Router);
 private logout:MatDialogRef<OriginalParticipantLogoutDialogComponent>|null=null;
 private readonly snacks=inject(MatSnackBar);
 private destroyed=false;
 private deletion:MatDialogRef<OriginalParticipantConfirmationDialogComponent>|null=null;
 readonly controller=new OriginalWorkspaceFilesController((method,path,body,token)=>
   this.request.request('Dateiverwaltung',method,path,body,{quiet:true,headers:{authorization:'Bearer '+token}}),
   ()=>({token:this.state.ops.adminSessionToken.trim(),tenantKey:this.tenantKey,workspaceKey:this.workspaceKey,roles:this.access.roleAssignments}),
   ()=>{if(!this.destroyed)this.changed.markForCheck();});
 readonly fileTypes:WorkspaceFileType[]=['Testtakers','Booklet','SysCheck','Unit','Resource','Package'];
 readonly labels:Record<WorkspaceFileType,string>={Testtakers:'Teilnehmerlisten',Booklet:'Testhefte',SysCheck:'Systemcheck-Definitionen',Unit:'Units',Resource:'Ressourcen',Package:'Pakete'};
 private readonly dateFormat=new Intl.DateTimeFormat('de-DE',{
   day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 formatDate(value:string):string {
   const date=new Date(value);if(!Number.isFinite(date.getTime()))return '';
   const parts=Object.fromEntries(this.dateFormat.formatToParts(date).map(part=>[part.type,part.value]));
   return `${parts['day']}.${parts['month']}.${parts['year']} ${parts['hour']}:${parts['minute']}`;
 }
 readonly displayedColumns=['checked','name','size','modificationTime'];
 readonly versions=[{label:'Teilnehmerlisten',versions:'17–18'},{label:'Testhefte',versions:'18'},
   {label:'Systemcheck-Definitionen',versions:'18'},{label:'Units',versions:'17'},{label:'Verona-Player',versions:'2–6'}];
 readonly trackFile=(_index:number,file:OriginalWorkspaceFile)=>file.sourcePackageId;
 ngOnChanges():void {this.deletion?.close(false);this.logout?.close(false);void this.controller.connect();}
 ngOnDestroy():void {this.destroyed=true;this.deletion?.close(false);this.logout?.close(false);this.controller.destroy();}
 get title():string {
   const workspace=this.controller.overview?.workspace;
   return workspace ? `Verwaltung "${workspace.displayName}" (${this.controller.canWrite?'RW':'RO'})` : 'Verwaltung';
 }
 confirmLogout(trigger:MatMenuTrigger):void {
   if(this.destroyed || this.logout)return;const token=this.state.ops.adminSessionToken;trigger.closeMenu();
   this.logout=this.dialogs.open(OriginalParticipantLogoutDialogComponent,{panelClass:'original-participant-logout-dialog',
     data:{safeMode:this.settings.settings().themeName==='Primar'},autoFocus:'dialog',restoreFocus:true,
     ariaLabelledBy:'originalParticipantLogoutTitle',ariaDescribedBy:'originalParticipantLogoutMessage'});
   this.logout.afterClosed().subscribe(accepted=>{
     this.logout=null;if(!accepted || this.destroyed || this.state.ops.adminSessionToken!==token)return;
     void this.app.signOutAdmin().finally(()=>{
       if(!this.state.ops.adminSessionToken || this.state.ops.adminSessionToken===token)void this.router.navigateByUrl('/ops');
     });
   });
 }
 size(bytes:number|null):string {
   if(bytes===null || !Number.isFinite(bytes))return 'nicht berechnet';
   if(bytes<=0)return '0';const index=Math.floor(Math.log(bytes)/Math.log(1024));
   return `${(bytes/1024**index).toFixed(1)} ${['B','KB','MB','GB','TB','PB'][index]}`;
 }
 errors(file:OriginalWorkspaceFile):string[] {
   const errors=(file.validationDiagnostics??[]).filter(row=>row.severity==='error').map(row=>row.message);
   if(file.unresolvedReferences.length)errors.push(...file.unresolvedReferences.map(row=>`Fehlende oder mehrdeutige Abhängigkeit: ${row.reference}`));
   const major=Number.parseInt(file.metadata.veronaVersion??'',10);
   if(Number.isFinite(major) && (major<2 || major>6))errors.push(`Verona Version \`${major}\` is not supported (only versions between \`2\` and \`6\`)`);
   return errors;
 }
 warnings(file:OriginalWorkspaceFile):string[] {
   return (file.validationDiagnostics??[]).filter(row=>row.severity==='warning').map(row=>row.message);
 }
 neverUsed(file:OriginalWorkspaceFile):boolean {return file.fileType!=='Testtakers' && file.fileType!=='SysCheck' && !this.controller.usedBy(file).length;}
 invalid(type?:WorkspaceFileType):number {return this.controller.files.filter(file=>(!type || file.fileType===type) && this.errors(file).length).length;}
 get participants():number {return this.controller.files.reduce((sum,file)=>sum+(file.metadata.participantCount??0),0);}
 sort(value:Sort):void {this.controller.setSort(value.active,value.direction);}
 selectRow(event:Event,file:OriginalWorkspaceFile):void {
   if(event.target instanceof HTMLElement && event.target.tagName==='MAT-CELL')this.controller.selectRow(file);
 }
 async chooseFiles(event:Event):Promise<void> {
   const input=event.target as HTMLInputElement,files=Array.from(input.files??[]);input.value='';
   await this.controller.upload(files.map(file=>({name:file.name,type:file.type,read:()=>new Promise<string>((done,reject)=>{
     const reader=new FileReader();reader.onload=()=>typeof reader.result==='string'?done(reader.result):reject(Error('Datei konnte nicht gelesen werden.'));
     reader.onerror=()=>reject(Error('Datei konnte nicht gelesen werden.'));reader.onabort=()=>reject(Error('Lesen abgebrochen.'));
     reader.readAsDataURL(file);
   })})));
 }
 async download(file:OriginalWorkspaceFile):Promise<void> {
   const captured=this.controller.captureDownload(file);if(!captured)return;
   try {
     const result=await this.api.download(captured.path,{authorization:'Bearer '+captured.token});
     if(!captured.current() || this.destroyed)return;
     const url=URL.createObjectURL(result.blob),link=document.createElement('a');link.href=url;link.download=captured.name;
     document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
   } catch(error){if(captured.current() && !this.destroyed){this.controller.problem=error instanceof Error?error.message:'Herunterladen fehlgeschlagen.';this.changed.markForCheck();}}
 }
 deleteFiles():void {
   const captured=this.controller.captureDeletion();if(!captured || this.deletion)return;
   const plural=captured.count>1;
   this.deletion=this.dialogs.open(OriginalParticipantConfirmationDialogComponent,{panelClass:'original-participant-confirmation-dialog',
     data:{title:'Löschen von Dateien',message:`Sie haben ${plural?captured.count:'eine'} Datei${plural?'en':''} ausgewählt. Soll${plural?'en':''} diese gelöscht werden?`,
       confirmLabel:'Löschen',cancelLabel:'Abbrechen',safeMode:this.settings.settings().themeName==='Primar'}});
   this.deletion.afterClosed().subscribe(async accepted=>{
     this.deletion=null;if(!accepted || this.destroyed)return;
     if(await captured.confirm() && !this.destroyed && this.controller.notice)this.snacks.open(this.controller.notice,'',{duration:1000});
   });
 }
}
