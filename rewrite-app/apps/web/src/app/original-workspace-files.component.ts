import {ChangeDetectorRef,Component,Input,ViewChild,inject,type AfterViewInit,type OnChanges,type OnDestroy} from '@angular/core';
import {HttpErrorResponse,HttpHeaders} from '@angular/common/http';
import {MatButton} from '@angular/material/button';
import {Router,RouterLink,RouterLinkActive,ActivatedRoute} from '@angular/router';
import {MatTabNav,MatTabLink,MatTabNavPanel} from '@angular/material/tabs';
import {OriginalSystemCheckReportsComponent} from './original-system-check-reports.component';
import {OriginalWorkspaceResultsComponent} from './original-workspace-results.component';
import {OriginalOverlayStylesComponent} from './original-overlay-styles.component';
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
import {combineLatest} from 'rxjs';
import {MatSnackBar} from '@angular/material/snack-bar';
import type {WorkspaceFileType} from '@testcenter-rewrite-app/domain';
import {OriginalWorkspaceFilesController,type OriginalWorkspaceFile,type OriginalWorkspaceUploadTransfer} from './original-workspace-files-controller';
import {RewriteAppShellRequestService} from './rewrite-app-shell-request.service';
import {RewriteAppApiService,type ApiErrorLike} from './rewrite-app-api.service';
import {RewriteAppOperatorAccessService} from './rewrite-app-operator-access.service';
import {redactBugReportText} from '@testcenter-rewrite-app/contracts';
import {nativeRequestError} from './native-participant/native-http-policy';
import {takeOriginalResultsEntryFromOperatorTab} from './native-participant/original-participant-bookmark';
import {NativeLoginErrorDialogComponent,type NativeErrorDialogData} from './native-login-error-dialog.component';
import {OriginalWorkspaceOperatorHeaderState} from './original-workspace-operator-header.component';
import {OriginalWorkspaceFileIconComponent} from './original-workspace-file-icon.component';
import {OriginalWorkspaceFileNoticeComponent} from './original-workspace-file-notice.component';
import {OriginalParticipantConfirmationDialogComponent} from './original-participant-confirmation-dialog.component';
import {RewriteAppUiStateService} from './rewrite-app-ui-state.service';
import {NativeSystemCheckInstallationService} from './native-system-check/native-system-check-installation.service';

@Component({selector:'app-original-workspace-files',standalone:true,
 imports:[RouterLink,RouterLinkActive,MatTabNav,MatTabLink,MatTabNavPanel,OriginalSystemCheckReportsComponent,OriginalWorkspaceResultsComponent,OriginalOverlayStylesComponent,OriginalWorkspaceFileSurfaceStylesComponent,MatButton,MatCard,MatCardHeader,MatCardTitle,MatCardSubtitle,MatCardContent,MatCardActions,
   MatCheckbox,MatAccordion,MatExpansionPanel,MatExpansionPanelHeader,MatExpansionPanelTitle,MatExpansionPanelDescription,
   MatProgressBar,MatProgressSpinner,MatSort,MatSortHeader,MatTable,MatColumnDef,MatHeaderCellDef,MatHeaderCell,MatCellDef,MatCell,
   MatHeaderRowDef,MatHeaderRow,MatRowDef,MatRow,MatTooltip,OriginalWorkspaceFileIconComponent,OriginalWorkspaceFileNoticeComponent],
 templateUrl:'./original-workspace-files.component.html',styleUrls:['./original-login-theme.scss','./original-workspace-files.component.css']})
export class OriginalWorkspaceFilesComponent implements AfterViewInit,OnChanges,OnDestroy {
 @Input({required:true}) sessionToken='';
 @Input({required:true}) tenantKey='';
 @Input({required:true}) workspaceKey='';
 @Input() workspaceNumber='';
 @Input() workspaceLabel='';
 @Input() nativeRole?:'RO'|'RW';
 private readonly state=inject(RewriteAppUiStateService);
 private readonly request=inject(RewriteAppShellRequestService);
 private readonly api=inject(RewriteAppApiService);
 private readonly access=inject(RewriteAppOperatorAccessService);
 private readonly changed=inject(ChangeDetectorRef);
 private readonly header=inject(OriginalWorkspaceOperatorHeaderState);
 private readonly dialogs=inject(MatDialog);
 private readonly router=inject(Router);
 private readonly route=inject(ActivatedRoute);
 tab:'files'|'syscheck'|'results'|'tests'='files';
 readonly tabs=[
   {id:'files',label:'Dateien'},
   {id:'syscheck',label:'Systemcheck Berichte'},
   {id:'results',label:'Ergebnisse/Antworten'},
   {id:'tests',label:'Tests löschen'}
 ] as const;
 // RouterLinkActive supplies the route's activation lifecycle. The selected
 // view still follows the normalized query parameter, including the default.
 readonly tabRouteMatch={paths:'exact',queryParams:'ignored',matrixParams:'ignored',fragment:'ignored'} as const;
 @ViewChild(MatTabNav) private tabNavigation!:MatTabNav;
 private readonly resultsOpenedFromOperatorTab=takeOriginalResultsEntryFromOperatorTab();
 // Original uses Material's default spacing when Results is the document's first view.
 compactResultsToolbar=this.resultsOpenedFromOperatorTab ||
   (this.route.snapshot.paramMap.get('workspaceTab')??this.route.snapshot.queryParamMap.get('tab'))!=='results' ||
   !!(this.router.currentNavigation()??this.router.lastSuccessfulNavigation())?.previousNavigation;
 resultsRole:''|'RO'|'RW'='';
 private readonly snacks=inject(MatSnackBar);
 private readonly systemCheckInstallation=inject(NativeSystemCheckInstallationService);
 private destroyed=false;
 private deletion:MatDialogRef<OriginalParticipantConfirmationDialogComponent>|null=null;
 private deletionError:MatDialogRef<NativeLoginErrorDialogComponent>|null=null;
 readonly controller=new OriginalWorkspaceFilesController(<T>(method:string,path:string,body:unknown,token:string,
   upload?:OriginalWorkspaceUploadTransfer)=>{
   if(upload && body instanceof FormData)return this.api.uploadMultipart<T>(path,body,{AuthToken:token},upload);
   return path.startsWith('/workspace/') ? this.api.send<T>(method,path,body,{AuthToken:token}).then(result=>result.payload) :
     this.request.request<T>('Dateiverwaltung',method,path,body,{quiet:true,headers:{authorization:'Bearer '+token}});
 },
   ()=>({token:this.state.ops.adminSessionToken.trim(),tenantKey:this.tenantKey,workspaceKey:this.workspaceKey,roles:this.access.roleAssignments,nativeRole:this.nativeRole,workspaceNumber:this.workspaceNumber}),
   ()=>{if(!this.destroyed){this.header.title.set(this.title);this.changed.markForCheck();}},
   ()=>{void this.systemCheckInstallation.refresh();});
 private readonly routeChanges=combineLatest([this.route.paramMap,this.route.queryParamMap]).subscribe(([params,query])=>{
   const workspaceNumber=params.get('workspaceNumber')??'';
   const value=workspaceNumber?params.get('workspaceTab'):query.get('tab');
   const next=value==='syscheck'||value==='results'||value==='tests'?value:'files';
   if(next!=='results')this.compactResultsToolbar=true;
   if(this.tab===next)return;
   this.tab=next;
   this.resultsRole='';
   this.deletion?.close(false);
   this.deletionError?.close();
   // On a workspace switch, wait for the verified scope inputs in ngOnChanges.
   if(workspaceNumber===this.workspaceNumber)this.connectFilesTab();
 });
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
 reloadReports():void {globalThis.location.reload();}
 ngAfterViewInit():void {
   if(!this.resultsOpenedFromOperatorTab)return;
   // Legacy addresses open a new document in the Rewrite. Align the active
   // label after its fonts load, as on in-document navigation in the Original.
   void document.fonts.ready.then(()=>{
     if(this.destroyed||this.tab!=='results')return;
     this.tabNavigation.updatePagination();
     this.tabNavigation.selectedIndex=-1;
     this.tabNavigation.updateActiveLink();
   });
 }
 ngOnChanges():void {this.deletion?.close(false);this.deletionError?.close();this.resultsRole='';this.connectFilesTab();}
 private connectFilesTab():void {
   void this.controller.connect(!this.workspaceNumber || this.tab==='files');
 }
 ngOnDestroy():void {
   this.destroyed=true;this.routeChanges.unsubscribe();this.deletion?.close(false);this.deletionError?.close();
   this.controller.destroy();this.header.title.set('Verwaltung');
 }
 setResultsRole(role: ''|'RO'|'RW'):void {
   this.resultsRole=role;
   this.header.title.set(this.title);
 }
 get title():string {
   const label=this.workspaceNumber?this.workspaceLabel:this.controller.overview?.workspace.displayName;
   const role=(this.tab==='results'||this.tab==='tests')&&this.resultsRole?this.resultsRole:
     this.nativeRole??(this.controller.canWrite?'RW':'RO');
   return label ? `Verwaltung "${label}" (${role})` : 'Verwaltung';
 }
 size(bytes:number|null):string {
   if(bytes===null || !Number.isFinite(bytes))return 'nicht berechnet';
   if(bytes<=0)return '0';const index=Math.floor(Math.log(bytes)/Math.log(1024));
   return `${(bytes/1024**index).toFixed(1)} ${['B','KB','MB','GB','TB','PB'][index]}`;
 }
 fileErrors(file:OriginalWorkspaceFile):string[] {
   const errors=(file.validationDiagnostics??[]).filter(row=>row.severity==='error').map(row=>row.message);
   if(file.unresolvedReferences.length)errors.push(...file.unresolvedReferences.map(row=>`Fehlende oder mehrdeutige Abhängigkeit: ${row.reference}`));
   return errors;
 }
 errors(file:OriginalWorkspaceFile):string[] {
   const errors=this.fileErrors(file);
   const major=Number.parseInt(file.metadata.veronaVersion??'',10);
   if(Number.isFinite(major) && (major<2 || major>6))errors.push(`Verona Version \`${major}\` is not supported (only versions between \`2\` and \`6\`)`);
   return errors;
 }
 // Source computes its aggregate before loading dependency DTOs. That second
 // response replaces per-row frontend checks; over1000files it is skipped.
 rowErrors(file:OriginalWorkspaceFile):string[] {
   return this.controller.dependencySizesCalculated?this.fileErrors(file):this.errors(file);
 }
 warnings(file:OriginalWorkspaceFile):string[] {
   return (file.validationDiagnostics??[]).filter(row=>row.severity==='warning').map(row=>row.message);
 }
 information(file:OriginalWorkspaceFile):string[] {
   return (file.validationDiagnostics??[]).filter(row=>row.severity==='info').map(row=>row.message);
 }
 invalid(type?:WorkspaceFileType):number {return this.controller.files.filter(file=>(!type || file.fileType===type) && this.errors(file).length).length;}
 get participants():number {return this.controller.files.reduce((sum,file)=>sum+(file.metadata.participantCount??0),0);}
 sort(value:Sort):void {this.controller.setSort(value.active,value.direction);}
 selectRow(event:Event,file:OriginalWorkspaceFile):void {
   if(event.target instanceof HTMLElement && event.target.tagName==='MAT-CELL')this.controller.selectRow(file);
 }
 async chooseFiles(event:Event):Promise<void> {
   const input=event.target as HTMLInputElement,files=Array.from(input.files??[]);input.value='';
   if(this.workspaceNumber){await this.controller.uploadNative(files);return;}
   await this.controller.upload(files.map(file=>({name:file.name,type:file.type,read:()=>new Promise<string>((done,reject)=>{
     const reader=new FileReader();reader.onload=()=>typeof reader.result==='string'?done(reader.result):reject(Error('Datei konnte nicht gelesen werden.'));
     reader.onerror=()=>reject(Error('Datei konnte nicht gelesen werden.'));reader.onabort=()=>reject(Error('Lesen abgebrochen.'));
     reader.readAsDataURL(file);
   })})));
 }
 async download(file:OriginalWorkspaceFile):Promise<void> {
   const captured=this.controller.captureDownload(file);if(!captured)return;
   try {
     const result=await this.api.download(captured.path,captured.headers);
     if(!captured.current() || this.destroyed)return;
     const url=URL.createObjectURL(result.blob),link=document.createElement('a');link.href=url;link.download=captured.name;
     document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
   } catch(error){if(captured.current() && !this.destroyed){this.controller.problem=error instanceof Error?error.message:'Herunterladen fehlgeschlagen.';this.changed.markForCheck();}}
 }
 deleteFiles():void {
   const captured=this.controller.captureDeletion();if(!captured || this.deletion)return;
   const plural=captured.count>1;
   this.deletion=this.dialogs.open(OriginalParticipantConfirmationDialogComponent,{panelClass:'original-participant-confirmation-dialog',autoFocus:'dialog',
     data:{title:'Löschen von Dateien',message:`Sie haben ${plural?captured.count:'eine'} Datei${plural?'en':''} ausgewählt. Soll${plural?'en':''} diese gelöscht werden?`,
       confirmLabel:'Löschen',cancelLabel:'Abbrechen',safeMode:false}});
   this.deletion.afterClosed().subscribe(async accepted=>{
     this.deletion=null;if(!accepted || this.destroyed)return;
     if(await captured.confirm((error,path,current)=>this.showDeletionConflict(error,path,current)) && !this.destroyed && this.controller.notice){
       const {message,action}=this.controller.notice;
       this.snacks.open(message,action,{duration:1000});
     }
   });
 }

 private showDeletionConflict(error:ApiErrorLike,path:string,current:()=>boolean):void {
   if(this.destroyed || !current() || this.deletionError)return;
   const response=error.response;
   const mapped=nativeRequestError(new HttpErrorResponse({
     status:409,statusText:response?.statusText||'Conflict',
     url:new URL(path,window.location.origin).href,error:error.message,
     headers:new HttpHeaders({
       ...(response?.errorId?{'error-id':response.errorId}:{}),
       ...(response?.testMode?{'test-mode':response.testMode}:{})
     })
   }));
   mapped.description=redactBugReportText(mapped.description);
   mapped.details=redactBugReportText(mapped.details??'');
   const url=new URL(window.location.href);url.search='';url.hash='';
   const dialog=this.dialogs.open(NativeLoginErrorDialogComponent,{
     panelClass:'original-native-login-error-dialog',disableClose:true,autoFocus:'dialog',restoreFocus:false,
     ariaLabel:mapped.label,
     data:{
       error:mapped,url:redactBugReportText(url.href),timestamp:Date.now(),login:this.access.displayName,
       reload:()=>{
         if(!this.destroyed && current()){
           window.location.assign(new URL('operator-start?ui=original',document.baseURI).href);
         }
       }
     } satisfies NativeErrorDialogData
   });
   this.deletionError=dialog;
   dialog.afterClosed().subscribe(()=>{if(this.deletionError===dialog)this.deletionError=null;});
 }
}
