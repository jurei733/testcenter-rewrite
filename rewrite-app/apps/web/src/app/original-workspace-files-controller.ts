import {productionApiRoutes, resolveRoutePath, type DeleteSourcePackagesResponse,
  type GetWorkspaceFileCatalogResponse, type GetWorkspaceOverviewResponse,
  type PublicAdminRoleAssignment, type UploadWorkspaceFileResponse} from '@testcenter-rewrite-app/contracts';
import type {WorkspaceCatalogFile, WorkspaceOverview, WorkspaceFileType} from '@testcenter-rewrite-app/domain';

export type OriginalWorkspaceFilesScope = {token:string; tenantKey:string; workspaceKey:string; roles:PublicAdminRoleAssignment[]};
export type OriginalWorkspaceFilesTransport = <T>(method:string,path:string,body:unknown,token:string)=>Promise<T>;
export type OriginalWorkspaceFile = WorkspaceCatalogFile & {name:string; isChecked:boolean};
export type OriginalWorkspaceUpload = {name:string; type:string; read:()=>Promise<string>};
export type OriginalWorkspaceUploadResult = {name:string; status:'queued'|'uploading'|'completed'|'error'; message:string};
type Owner = {epoch:number; token:string; tenantKey:string; workspaceKey:string};
const sameScope = (a:Owner,b:OriginalWorkspaceFilesScope):boolean =>
  a.token===b.token && a.tenantKey===b.tenantKey && a.workspaceKey===b.workspaceKey;
const problemText = (error:unknown,fallback:string):string => {
  if (!error || typeof error!=='object')return fallback;
  const record=error as {message?:unknown;details?:{diagnostics?:Array<{severity?:unknown;message?:unknown}>}};
  const values=record.details?.diagnostics;
  const diagnostics=Array.isArray(values)?values.filter(row=>row && row.severity==='error' && typeof row.message==='string').map(row=>row.message as string):[];
  return diagnostics?.length ? diagnostics.join('\n') : typeof record.message==='string' ? record.message : fallback;
};
const basename = (value:string):string => value.split(/[\\/]/).at(-1) ?? value;

/** Native file administration owns its exact login/workspace across every
 * await. Selection and file bytes never enter persisted shell state. */
export class OriginalWorkspaceFilesController {
  files:OriginalWorkspaceFile[]=[];
  overview:WorkspaceOverview|null=null;
  busy=false;
  problem='';
  notice='';
  uploads:OriginalWorkspaceUploadResult[]=[];
  selectedRowId='';
  deletionReport:DeleteSourcePackagesResponse['report']|null=null;
  private epoch=0;
  private owner:Owner|null=null;
  private destroyed=false;
  private sort={active:'name',direction:'asc'};
  private grouped=new Map<WorkspaceFileType,{source:OriginalWorkspaceFile[];rows:OriginalWorkspaceFile[]}>();
  constructor(private readonly transport:OriginalWorkspaceFilesTransport,
    private readonly current:()=>OriginalWorkspaceFilesScope,private readonly changed:()=>void) {}
  private owns(owner:Owner):boolean {
    return !this.destroyed && this.owner===owner && owner.epoch===this.epoch &&
      !!owner.token && sameScope(owner,this.current());
  }
  private path(owner:Owner,route:string,sourcePackageId?:string):string {
    return resolveRoutePath(route,{tenantKey:owner.tenantKey,workspaceKey:owner.workspaceKey,...(sourcePackageId?{sourcePackageId}:{})});
  }
  private async request<T>(owner:Owner,method:string,route:string,body?:unknown):Promise<T> {
    if(!this.owns(owner))throw Error('Die Anmeldung oder der Arbeitsbereich hat sich geändert.');
    const result=await this.transport<T>(method,this.path(owner,route),body,owner.token);
    if(!this.owns(owner))throw Error('Die Anmeldung oder der Arbeitsbereich hat sich geändert.');
    return result;
  }
  get canWrite():boolean {
    if(!this.owner || !this.owns(this.owner) || !this.overview)return false;
    const {tenant,workspace}=this.overview;
    return this.current().roles.some(role=>role.role==='platform_admin' ||
      role.role==='tenant_admin' && role.tenantId===tenant.tenantId ||
      role.role==='workspace_admin' && role.workspaceId===workspace.workspaceId &&
        role.tenantId===tenant.tenantId && role.accessMode==='read_write');
  }
  get selected():OriginalWorkspaceFile[] { return this.files.filter(file=>file.isChecked); }
  get dependencyRowIds():string[] {
    if(!this.selectedRowId)return [];
    return this.files.filter(file=>file.dependencies.some(dep=>dep.sourcePackageId===this.selectedRowId)).map(file=>file.sourcePackageId);
  }
  usedBy(file:OriginalWorkspaceFile):OriginalWorkspaceFile[] {
    return this.files.filter(candidate=>candidate.dependencies.some(dep=>dep.sourcePackageId===file.sourcePackageId));
  }
  rows(type:WorkspaceFileType):OriginalWorkspaceFile[] {
    const cached=this.grouped.get(type);if(cached?.source===this.files)return cached.rows;
    const rows=this.files.filter(file=>file.fileType===type);this.grouped.set(type,{source:this.files,rows});return rows;
  }
  checkAll(type:WorkspaceFileType,checked:boolean):void {
    if(this.busy || !this.owner || !this.owns(this.owner))return;
    this.rows(type).forEach(file=>file.isChecked=checked);this.changed();
  }
  check(file:OriginalWorkspaceFile,checked:boolean):void {
    if(this.busy || !this.owner || !this.owns(this.owner) || !this.files.includes(file))return;
    file.isChecked=checked;this.changed();
  }
  selectRow(file:OriginalWorkspaceFile):void {
    if(!this.owner || !this.owns(this.owner) || !this.files.includes(file))return;
    this.selectedRowId=this.selectedRowId===file.sourcePackageId?'':file.sourcePackageId;this.changed();
  }
  setSort(active:string,direction:string):void { this.sort={active,direction};this.order();this.changed(); }
  private order():void {
    this.grouped.clear();
    const direction=this.sort.direction==='asc'?1:-1;
    this.files.sort((a,b)=>{
      const key=this.sort.active;
      if(key==='name')return a.name.localeCompare(b.name)*direction;
      const left=key==='size'?a.fileSizeBytes??0:key==='checked'?Number(a.isChecked):Date.parse(a.uploadedAt);
      const right=key==='size'?b.fileSizeBytes??0:key==='checked'?Number(b.isChecked):Date.parse(b.uploadedAt);
      return (left<right?-1:1)*direction;
    });
  }
  private async load(owner:Owner):Promise<void> {
    const [response,catalog]=await Promise.all([
      this.request<GetWorkspaceOverviewResponse>(owner,'GET',productionApiRoutes.workspace.getWorkspaceOverview),
      this.request<GetWorkspaceFileCatalogResponse>(owner,'GET',productionApiRoutes.workspace.getWorkspaceFileCatalog)
    ]);
    if(!this.owns(owner))return;
    if(response.workspaceOverview.tenant.tenantKey!==owner.tenantKey || response.workspaceOverview.workspace.workspaceKey!==owner.workspaceKey ||
      response.workspaceOverview.workspace.tenantId!==response.workspaceOverview.tenant.tenantId)throw Error('Der Arbeitsbereich konnte nicht zugeordnet werden.');
    this.overview=response.workspaceOverview;
    this.files=catalog.items.map(file=>({...file,name:basename(file.fileName),isChecked:false}));
    this.selectedRowId='';this.order();
  }
  async connect():Promise<void> {
    const scope=this.current();this.epoch++;
    const owner={epoch:this.epoch,token:scope.token,tenantKey:scope.tenantKey,workspaceKey:scope.workspaceKey};this.owner=owner;
    this.grouped.clear();this.files=[];this.overview=null;this.uploads=[];this.deletionReport=null;this.problem='';this.notice='';this.selectedRowId='';
    this.busy=!!owner.token && !!owner.tenantKey && !!owner.workspaceKey;this.changed();
    if(!this.busy)return;
    try { await this.load(owner); }
    catch(error) {if(this.owns(owner))this.problem=problemText(error,'Dateien konnten nicht geladen werden.');}
    finally {if(this.owns(owner)){this.busy=false;this.changed();}}
  }
  async refresh():Promise<void> {
    const owner=this.owner;if(!owner || !this.owns(owner) || this.busy)return;
    this.busy=true;this.problem='';this.changed();
    try {await this.load(owner);}catch(error){if(this.owns(owner))this.problem=problemText(error,'Dateien konnten nicht geladen werden.');}
    finally{if(this.owns(owner)){this.busy=false;this.changed();}}
  }
  async upload(files:OriginalWorkspaceUpload[]):Promise<void> {
    const owner=this.owner;if(!owner || !this.owns(owner) || !this.canWrite || this.busy || !files.length)return;
    this.busy=true;this.problem='';this.notice='';this.uploads=files.map(file=>({name:file.name,status:'queued',message:''}));this.changed();
    try {
      for(let index=0;index<files.length;index++) {
        if(!this.owns(owner))return;
        if(!this.canWrite){this.cancelPendingUploads();return;}
        const file=files[index]!,row=this.uploads[index]!;row.status='uploading';this.changed();
        try {
          const sourceDocument=await file.read();
          if(!this.owns(owner))return;
          if(!this.canWrite){this.cancelPendingUploads();return;}
          const result=await this.request<UploadWorkspaceFileResponse>(owner,'POST',productionApiRoutes.workspace.uploadWorkspaceFile,
            {fileName:file.name,mediaType:file.type||'application/octet-stream',sourceDocument});
          const availability=result.workspaceAvailability?.status;
          row.status=result.importJob?.status==='failed' || availability==='failed' || availability==='conflict'?'error':'completed';
          row.message=result.importJob?.status==='failed'?'Import fehlgeschlagen.':
            availability==='failed'?'Datei gespeichert. Die Bereitstellung für Teilnehmende ist fehlgeschlagen.':
            availability==='conflict'?'Datei gespeichert. Gleichzeitige Änderungen haben die Bereitstellung verhindert.':
            result.replacedSourcePackageId?'Datei aktualisiert.':'Datei hochgeladen.';
        } catch(error) {
          if(!this.owns(owner))return;
          row.status='error';row.message=problemText(error,'Hochladen fehlgeschlagen.');
        }
        this.changed();
      }
      if(this.owns(owner))await this.load(owner);
    } catch(error){if(this.owns(owner))this.problem=problemText(error,'Dateien konnten nicht aktualisiert werden.');}
    finally{if(this.owns(owner)){this.busy=false;this.changed();}}
  }
  private cancelPendingUploads():void {
    for(const row of this.uploads)if(row.status==='queued' || row.status==='uploading'){
      row.status='error';row.message='Hochladen abgebrochen. Die Berechtigung hat sich geändert.';
    }
  }
  clearUploads():void {if(!this.busy){this.uploads=[];this.changed();}}
  captureDeletion():{confirm:()=>Promise<boolean>;count:number}|null {
    const owner=this.owner,selected=this.selected.map(file=>({sourcePackageId:file.sourcePackageId,confirmation:file.fileName}));
    if(!owner || !this.owns(owner) || !this.canWrite || this.busy || !selected.length)return null;
    let used=false;
    return {count:selected.length,confirm:async()=>{
      if(used || !this.owns(owner) || !this.canWrite || this.busy)return false;
      used=true;this.busy=true;this.problem='';this.notice='';this.changed();
      try {
        const result=await this.request<DeleteSourcePackagesResponse>(owner,'POST',productionApiRoutes.workspace.deleteSourcePackages,{items:selected});
        this.deletionReport=result.report;
        const report=result.report,messages=[];
        if(report.deleted.length)messages.push(`${report.deleted.length} Dateien erfolgreich gelöscht.`);
        if(report.notAllowed.length)messages.push(`${report.notAllowed.length} Dateien konnten nicht gelöscht werden.`);
        if(report.wasUsed.length)messages.push(`${report.wasUsed.length} Dateien werden von anderen verwendet und wurden nicht gelöscht.`);
        if(report.didNotExist.length)messages.push(`${report.didNotExist.length} Dateien existieren nicht mehr.`);
        if(report.errors.length)messages.push(`${report.errors.length} Dateien konnten wegen eines Fehlers nicht gelöscht werden.`);
        this.notice=messages.join('\n');await this.load(owner);return true;
      } catch(error){if(this.owns(owner))this.problem=problemText(error,'Löschen fehlgeschlagen.');return false;}
      finally{if(this.owns(owner)){this.busy=false;this.changed();}}
    }};
  }
  captureDownload(file:OriginalWorkspaceFile):{path:string;name:string;token:string;current:()=>boolean}|null {
    const owner=this.owner;if(!owner || !this.owns(owner) || !this.files.includes(file))return null;
    return {path:this.path(owner,productionApiRoutes.workspace.downloadWorkspaceFile,file.sourcePackageId),name:file.name,token:owner.token,
      current:()=>this.owns(owner)};
  }
  destroy():void {this.destroyed=true;this.epoch++;this.owner=null;this.grouped.clear();this.files=[];this.overview=null;this.uploads=[];this.deletionReport=null;this.selectedRowId='';this.busy=false;this.problem='';this.notice='';this.changed();}
}
