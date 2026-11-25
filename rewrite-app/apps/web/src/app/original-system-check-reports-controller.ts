import {productionApiRoutes,resolveRoutePath,type GetWorkspaceOverviewResponse,
 type GetSystemCheckReportStatisticsResponse,type DeleteSystemCheckReportsResponse} from '@testcenter-rewrite-app/contracts';
import type {OriginalWorkspaceFileDeletionReport,SystemCheckReportStatistics,WorkspaceOverview} from '@testcenter-rewrite-app/domain';
import type {OriginalWorkspaceFilesScope,OriginalWorkspaceFilesTransport} from './original-workspace-files-controller';

type Scope=Pick<OriginalWorkspaceFilesScope,'token'|'tenantKey'|'workspaceKey'|'nativeRole'|'workspaceNumber'>;
type Owner=Omit<Scope,'nativeRole'>&{epoch:number};
type NativeReportOverview={id:string;label:string;count:number;details:{os:Record<string,number>;browser:Record<string,number>}};
type ReportDeletionConfirmation={
 ids:string[];
 current:()=>boolean;
 confirm:(showNotice?:(message:string,action:string)=>void,showFailure?:(error:unknown,path:string)=>void)=>Promise<boolean>;
};
export type SystemCheckTableRow=Pick<SystemCheckReportStatistics,'checkId'|'checkLabel'|'reportCount'|'operatingSystemVersions'|'browserVersions'>;
const versions=(counts:Record<string,number>)=>Object.entries(counts).map(([value,count])=>({value,count}));
const errorText=(error:unknown):string=>error && typeof error==='object' && 'message' in error && typeof error.message==='string'
 ? error.message : 'Die Berichte konnten nicht verarbeitet werden.';

/** The native report selection belongs to one exact login/workspace. Neither
 * report payloads nor selection are written into persisted shell state. */
export class OriginalSystemCheckReportsController {
 rows:SystemCheckTableRow[]=[];
 overview:WorkspaceOverview|null=null;
 selected=new Set<string>();
 busy=false;
 problem='';
 notice='';
 private epoch=0;
 private owner:Owner|null=null;
 private destroyed=false;
 constructor(private readonly transport:OriginalWorkspaceFilesTransport,
  private readonly current:()=>Scope,private readonly changed:()=>void){}
 private owns(owner:Owner):boolean {
  const scope=this.current();return !this.destroyed && this.owner===owner && this.epoch===owner.epoch &&
   !!owner.token && owner.token===scope.token && owner.tenantKey===scope.tenantKey && owner.workspaceKey===scope.workspaceKey &&
   owner.workspaceNumber===scope.workspaceNumber;
 }
 private path(owner:Owner,route:string):string {return resolveRoutePath(route,{tenantKey:owner.tenantKey,workspaceKey:owner.workspaceKey});}
 private nativePath(owner:Owner,endpoint:string):string|null {
  return owner.workspaceNumber ? '/workspace/'+encodeURIComponent(owner.workspaceNumber)+'/'+endpoint : null;
 }
 private async request<T>(owner:Owner,method:string,route:string,body?:unknown):Promise<T>{
  if(!this.owns(owner))throw Error('Die Anmeldung oder der Arbeitsbereich hat sich geändert.');
  const result=await this.transport<T>(method,this.path(owner,route),body,owner.token);
  if(!this.owns(owner))throw Error('Die Anmeldung oder der Arbeitsbereich hat sich geändert.');return result;
 }
 get allSelected():boolean {return this.rows.length>0 && this.selected.size===this.rows.length;}
 check(id:string,checked:boolean):void {
  if(this.busy || !this.owner || !this.owns(this.owner) || !this.rows.some(row=>row.checkId===id))return;
  checked?this.selected.add(id):this.selected.delete(id);this.changed();
 }
 checkAll():void {
  if(this.busy || !this.owner || !this.owns(this.owner))return;
  this.selected=this.allSelected?new Set():new Set(this.rows.map(row=>row.checkId));this.changed();
 }
 private async load(owner:Owner):Promise<void>{
  const native=this.nativePath(owner,'sys-check/reports/overview');
  const [scope,rows]=await Promise.all([
   this.request<GetWorkspaceOverviewResponse>(owner,'GET',productionApiRoutes.workspace.getWorkspaceOverview),
   native ? this.request<NativeReportOverview[]>(owner,'GET',native).then(items=>items.map(row=>({
    checkId:row.id,checkLabel:row.label,reportCount:row.count,
    operatingSystemVersions:versions(row.details.os),browserVersions:versions(row.details.browser)
   }))) : this.request<GetSystemCheckReportStatisticsResponse>(owner,'GET',productionApiRoutes.workspace.getSystemCheckReportStatistics)
    .then(result=>result.items)]);
  if(!this.owns(owner))return;
  const overview=scope.workspaceOverview;
  if(overview.tenant.tenantKey!==owner.tenantKey || overview.workspace.workspaceKey!==owner.workspaceKey ||
   overview.workspace.tenantId!==overview.tenant.tenantId)throw Error('Der Arbeitsbereich konnte nicht zugeordnet werden.');
  this.overview=overview;this.rows=rows;this.selected=new Set();
 }
 async connect():Promise<void>{
  const {token,tenantKey,workspaceKey,workspaceNumber}=this.current();
  const owner={epoch:++this.epoch,token,tenantKey,workspaceKey,workspaceNumber};
  this.owner=owner;this.rows=[];this.selected=new Set();this.overview=null;this.problem='';this.notice='';
  this.busy=!!owner.token && !!owner.tenantKey && !!owner.workspaceKey;this.changed();if(!this.busy)return;
  try{await this.load(owner);}catch(error){if(this.owns(owner))this.problem=errorText(error);}
  finally{if(this.owns(owner)){this.busy=false;this.changed();}}
 }
 async refresh():Promise<void>{
  const owner=this.owner;if(!owner || !this.owns(owner) || this.busy)return;
  this.busy=true;this.problem='';this.changed();
  try{await this.load(owner);}catch(error){if(this.owns(owner))this.problem=errorText(error);}
  finally{if(this.owns(owner)){this.busy=false;this.changed();}}
 }
 async download(read:(path:string,token:string)=>Promise<Blob>):Promise<{blob:Blob;current:()=>boolean}|null>{
  const owner=this.owner;if(!owner || !this.owns(owner) || this.busy || !this.selected.size)return null;
  const ids=this.rows.filter(row=>this.selected.has(row.checkId)).map(row=>row.checkId);if(!ids.length)return null;
  const native=this.nativePath(owner,'report/sys-check');
  const query=new URLSearchParams();
  if(native && !ids.some(id=>id.includes(','))){
   query.set('dataIds',ids.join(','));
  }else{
   ids.forEach(id=>query.append('checkId',id));
  }
  if(native)query.set('useNewVersion','false');
  this.busy=true;this.problem='';this.changed();
  try{
   const blob=await read((native??this.path(owner,productionApiRoutes.workspace.exportSystemCheckReportsCsv))+'?'+query,owner.token);
   if(!this.owns(owner))return null;
   this.selected=new Set();return {blob,current:()=>this.owns(owner)};
  }catch(error){if(this.owns(owner))this.problem=errorText(error);return null;}
  finally{if(this.owns(owner)){this.busy=false;this.changed();}}
 }
 captureDeletion():ReportDeletionConfirmation|null {
  const owner=this.owner;if(!owner || !this.owns(owner) || !this.overview || this.busy)return null;
  const ids=this.rows.filter(row=>this.selected.has(row.checkId)).map(row=>row.checkId);if(!ids.length)return null;
  let used=false;
  return {ids:[...ids],current:()=>this.owns(owner),confirm:async (showNotice,showFailure)=>{
   if(used || !this.owns(owner) || this.busy)return false;used=true;
   const native=this.nativePath(owner,'sys-check/reports');
   if(!native && this.current().nativeRole==='RO'){
    this.problem='Der Arbeitsbereich ist schreibgeschützt.';
    this.changed();
    return false;
   }
   this.busy=true;this.problem='';this.notice='';this.changed();
   let deleted=0,denied=0,accepted=0,completed=false;
   try{
    if(native){
     const result=await this.request<OriginalWorkspaceFileDeletionReport>(owner,'DELETE',native,{checkIds:ids});
     deleted=result.deleted.length;denied=result.not_allowed.length;
    }else{
     for(let offset=0;offset<ids.length;offset+=100){
      const result=await this.request<DeleteSystemCheckReportsResponse>(owner,'DELETE',productionApiRoutes.workspace.deleteSystemCheckReports,
       {checkIds:ids.slice(offset,offset+100),confirmation:owner.workspaceKey});
      accepted++;deleted+=result.deletion.deletedCount;
     }
    }
    completed=true;
   }catch(error){
    if(this.owns(owner)){
     if(native && showFailure)showFailure(error,native);
     else this.problem=errorText(error);
    }
   }
   finally{
    if(this.owns(owner)){
     if(accepted || completed){
      const messages=[];
      if(deleted || !native)messages.push(`${deleted} Berichte erfolgreich gelöscht.`);
      if(denied)messages.push(`${denied} Berichte konnten nicht gelöscht werden.`);
      this.notice=messages.join('<br>');
      if(this.notice)showNotice?.(this.notice,messages.length>1?'Achtung':'');
      this.rows=[];this.selected=new Set();this.changed();
      try{await this.load(owner);}catch(error){if(this.owns(owner))this.problem=this.problem || errorText(error);}
     }
     if(this.owns(owner)){this.busy=false;this.changed();}
    }
   }
   return completed && this.owns(owner);
  }};
 }
 destroy():void {this.destroyed=true;this.epoch++;this.owner=null;this.rows=[];this.selected=new Set();this.overview=null;this.busy=false;}
}
