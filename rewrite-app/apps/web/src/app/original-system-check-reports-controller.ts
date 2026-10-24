import {productionApiRoutes,resolveRoutePath,type GetWorkspaceOverviewResponse,
 type GetSystemCheckReportStatisticsResponse,type DeleteSystemCheckReportsResponse} from '@testcenter-rewrite-app/contracts';
import type {SystemCheckReportStatistics,WorkspaceOverview} from '@testcenter-rewrite-app/domain';
import type {OriginalWorkspaceFilesScope,OriginalWorkspaceFilesTransport} from './original-workspace-files-controller';

type Owner={epoch:number;token:string;tenantKey:string;workspaceKey:string};
type Scope=Pick<OriginalWorkspaceFilesScope,'token'|'tenantKey'|'workspaceKey'>;
const errorText=(error:unknown):string=>error && typeof error==='object' && 'message' in error && typeof error.message==='string'
 ? error.message : 'Die Berichte konnten nicht verarbeitet werden.';

/** The native report selection belongs to one exact login/workspace. Neither
 * report payloads nor selection are written into persisted shell state. */
export class OriginalSystemCheckReportsController {
 rows:SystemCheckReportStatistics[]=[];
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
   !!owner.token && owner.token===scope.token && owner.tenantKey===scope.tenantKey && owner.workspaceKey===scope.workspaceKey;
 }
 private path(owner:Owner,route:string):string {return resolveRoutePath(route,{tenantKey:owner.tenantKey,workspaceKey:owner.workspaceKey});}
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
  const [scope,result]=await Promise.all([
   this.request<GetWorkspaceOverviewResponse>(owner,'GET',productionApiRoutes.workspace.getWorkspaceOverview),
   this.request<GetSystemCheckReportStatisticsResponse>(owner,'GET',productionApiRoutes.workspace.getSystemCheckReportStatistics)]);
  if(!this.owns(owner))return;
  const overview=scope.workspaceOverview;
  if(overview.tenant.tenantKey!==owner.tenantKey || overview.workspace.workspaceKey!==owner.workspaceKey ||
   overview.workspace.tenantId!==overview.tenant.tenantId)throw Error('Der Arbeitsbereich konnte nicht zugeordnet werden.');
  this.overview=overview;this.rows=result.items;this.selected=new Set();
 }
 async connect():Promise<void>{
  const scope=this.current(),owner={epoch:++this.epoch,token:scope.token,tenantKey:scope.tenantKey,workspaceKey:scope.workspaceKey};
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
  const query=new URLSearchParams();ids.forEach(id=>query.append('checkId',id));
  this.busy=true;this.problem='';this.changed();
  try{
   const blob=await read(this.path(owner,productionApiRoutes.workspace.exportSystemCheckReportsCsv)+'?'+query,owner.token);
   if(!this.owns(owner))return null;
   this.selected=new Set();return {blob,current:()=>this.owns(owner)};
  }catch(error){if(this.owns(owner))this.problem=errorText(error);return null;}
  finally{if(this.owns(owner)){this.busy=false;this.changed();}}
 }
 captureDeletion():{ids:string[];current:()=>boolean;confirm:()=>Promise<boolean>}|null {
  const owner=this.owner;if(!owner || !this.owns(owner) || !this.overview || this.busy)return null;
  const ids=this.rows.filter(row=>this.selected.has(row.checkId)).map(row=>row.checkId);if(!ids.length)return null;
  let used=false;
  return {ids:[...ids],current:()=>this.owns(owner),confirm:async()=>{
   if(used || !this.owns(owner) || this.busy)return false;used=true;
   this.busy=true;this.problem='';this.notice='';this.changed();let deleted=0,accepted=0,completed=false;
   try{
    // The protected API accepts at most 100 Check IDs per request. Capture all
    // selected IDs once and retain their exact owner across every batch.
    for(let offset=0;offset<ids.length;offset+=100){
     // Source offers this confirmation to every authorized report reader.
     // The protected API decides each write, including RO/revoked grants.
     const result=await this.request<DeleteSystemCheckReportsResponse>(owner,'DELETE',productionApiRoutes.workspace.deleteSystemCheckReports,
      {checkIds:ids.slice(offset,offset+100),confirmation:owner.workspaceKey});
     accepted++;deleted+=result.deletion.deletedCount;
    }
    completed=true;
   }catch(error){if(this.owns(owner))this.problem=errorText(error);}
   finally{
    if(this.owns(owner)){
     if(accepted || completed){
      this.notice=`${deleted} Berichte erfolgreich gelöscht.`;
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
