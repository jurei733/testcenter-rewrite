import {DOMParser,type Element} from '@xmldom/xmldom';
import type {SourcePackage,WorkspaceActivityEvent,Workspace,Tenant} from '@testcenter-rewrite-app/domain';
import {buildWorkspaceFileCatalog,selectCurrentWorkspaceFiles,type WorkspaceCatalogInput} from './workspace-file-catalog.js';
import type {OriginalWorkspaceNumberRecord} from './original-workspace-number.js';

export type OriginalWorkspaceContentType='mixed'|'test'|'sysCheck';
export type OriginalSystemCheckDirectorySnapshot={mode:boolean;workspaces:Array<{workspaceNumber:string;sourcePackages:SourcePackage[];activityEvents:WorkspaceActivityEvent[]}>};
type Files={sourcePackages:SourcePackage[];activityEvents:WorkspaceActivityEvent[]};
type Project=(source:SourcePackage)=>WorkspaceCatalogInput;
export const selectOriginalPhysicalWorkspaceFiles=(files:Files)=>{
 const ids=new Set(files.activityEvents.flatMap(event=>event.eventType==='source_package_created'&&event.details.intakeMode==='workspace_file'?[event.subjectId]:
  event.eventType==='source_package_replaced'&&event.details.replacementMode==='workspace_file'&&typeof event.details.replacementSourcePackageId==='string'?[event.details.replacementSourcePackageId]:[]));
 return selectCurrentWorkspaceFiles(files.sourcePackages,files.activityEvents).filter(source=>ids.has(source.sourcePackageId)&&source.status!=='rejected');
};
/** Source updates workspaces.content_type from valid physical Testtakers files,
 * independently of imported Login rows or any existing person sessions. */
export function deriveOriginalWorkspaceContentType(files:Files,project:Project):OriginalWorkspaceContentType {
 const testtakers=selectOriginalPhysicalWorkspaceFiles(files).filter(source=>source.fileName.startsWith('Testtakers/')&&/\.xml$/i.test(source.fileName));
 if(!testtakers.length)return 'mixed';
 for(const source of testtakers){
  const text=project(source).sourceText;if(text===null||/<!DOCTYPE\b/i.test(text))continue;
  let invalid=false;
  try{
   const root=new DOMParser({onError(){invalid=true;}}).parseFromString(text,'application/xml').documentElement;
   if(invalid||root?.tagName!=='Testtakers')continue;
   for(const group of Array.from(root.childNodes).filter(node=>node.nodeType===1&&(node as Element).tagName==='Group') as Element[])
    for(const login of Array.from(group.childNodes).filter(node=>node.nodeType===1&&(node as Element).tagName==='Login') as Element[])
     if(login.getAttribute('mode')==='sys-check-login')return 'sysCheck';
  }catch{/* A cached valid row with an unreadable physical file still selects test. */}
 }
 return 'test';
}
/** Once native physical Testtakers files own the workspace, a retained import
 * row must not resurrect a Login removed from those files. Legacy explicit
 * roster imports have no physical-file lineage and retain their own adapter. */
export function readOriginalPhysicalLoginMode(files:Files,loginKey:string,project:Project):{managed:boolean;mode:string|null}{
 const managed=files.activityEvents.some(event=>event.eventType==='source_package_created'&&event.details.intakeMode==='workspace_file'&&
  typeof event.details.fileName==='string'&&event.details.fileName.startsWith('Testtakers/'));
 if(!managed)return{managed:false,mode:null};
 const matches:string[]=[];
 for(const source of selectOriginalPhysicalWorkspaceFiles(files).filter(row=>row.fileName.startsWith('Testtakers/'))){
  const text=project(source).sourceText;if(text===null||/<!DOCTYPE\b/i.test(text))continue;
  try{
   let invalid=false;const root=new DOMParser({onError(){invalid=true;}}).parseFromString(text,'application/xml').documentElement;
   if(invalid||root?.tagName!=='Testtakers')continue;
   for(const group of Array.from(root.childNodes).filter(node=>node.nodeType===1&&(node as Element).tagName==='Group') as Element[])
    for(const login of Array.from(group.childNodes).filter(node=>node.nodeType===1&&(node as Element).tagName==='Login') as Element[])
     if(login.getAttribute('name')===loginKey)matches.push(login.getAttribute('mode')||'run-demo');
  }catch{/* An unreadable current file cannot authenticate a retained row. */}
 }
 return{managed:true,mode:matches.length===1?matches[0]!:null};
}
type Collection<Row>=Map<string,Row>|Record<string,Row>;
const values=<Row>(rows:Collection<Row>)=>rows instanceof Map?[...rows.values()]:Object.values(rows);
export type OriginalWorkspaceContentCollections={tenants:Collection<Tenant>;workspacesByScope:Collection<Workspace>;
 sourcePackages:Collection<SourcePackage>;workspaceActivityEvents:Collection<WorkspaceActivityEvent>;
 originalWorkspaceNumbers?:Collection<OriginalWorkspaceNumberRecord>;originalWorkspaceContentTypes?:Collection<OriginalWorkspaceContentType>};
export function refreshOriginalWorkspaceContentCollection(state:OriginalWorkspaceContentCollections,scope:{tenantId:string;workspaceId:string},project:Project):void{
 if(!values(state.workspacesByScope).some(row=>row.tenantId===scope.tenantId&&row.workspaceId===scope.workspaceId))return;
 const scoped=(row:{tenantId:string;workspaceId:string})=>row.tenantId===scope.tenantId&&row.workspaceId===scope.workspaceId;
 const type=deriveOriginalWorkspaceContentType({sourcePackages:values(state.sourcePackages).filter(scoped),activityEvents:values(state.workspaceActivityEvents).filter(scoped)},project);
 const target=state.originalWorkspaceContentTypes??(state.originalWorkspaceContentTypes={});
 if(target instanceof Map)target.set(scope.workspaceId,type);else target[scope.workspaceId]=type;
}
export function readOriginalSystemCheckDirectoryCollection(state:OriginalWorkspaceContentCollections):OriginalSystemCheckDirectorySnapshot{
 const activeTenants=new Set(values(state.tenants).filter(row=>row.status==='active').map(row=>row.tenantId));
 const active=values(state.workspacesByScope).filter(row=>row.status==='active'&&activeTenants.has(row.tenantId));
 const types=state.originalWorkspaceContentTypes??{},type=(id:string)=>types instanceof Map?types.get(id):types[id];
 const numbers=values(state.originalWorkspaceNumbers??{});
 return{mode:active.some(row=>type(row.workspaceId)==='sysCheck'),workspaces:active.flatMap(workspace=>{
  const number=numbers.find(row=>row.workspaceId===workspace.workspaceId&&row.tenantId===workspace.tenantId);if(!number)return[];
  const scoped=(row:{tenantId:string;workspaceId:string})=>row.tenantId===workspace.tenantId&&row.workspaceId===workspace.workspaceId;
  return[{workspaceNumber:number.workspaceNumber,sourcePackages:values(state.sourcePackages).filter(scoped),activityEvents:values(state.workspaceActivityEvents).filter(scoped)}];
 })};
}
export function readOriginalSystemCheckModeCollection(state:OriginalWorkspaceContentCollections):boolean{
 const tenants=new Set(values(state.tenants).filter(row=>row.status==='active').map(row=>row.tenantId));
 const types=state.originalWorkspaceContentTypes??{};
 return values(state.workspacesByScope).some(row=>row.status==='active'&&tenants.has(row.tenantId)&&
  (types instanceof Map?types.get(row.workspaceId):types[row.workspaceId])==='sysCheck');
}
/** PHP glob sorts folder/file names bytewise. Keep int64 workspace IDs raw. */
export function formatOriginalSystemCheckDirectory(snapshot:OriginalSystemCheckDirectorySnapshot,project:Project):string|null{
 const entries:string[]=[];
 for(const workspace of [...snapshot.workspaces].sort((a,b)=>a.workspaceNumber<b.workspaceNumber?-1:a.workspaceNumber>b.workspaceNumber?1:0)){
  if(!/^[1-9][0-9]{0,18}$/.test(workspace.workspaceNumber))throw Error('Invalid native workspace number.');
  const files=selectOriginalPhysicalWorkspaceFiles(workspace).filter(source=>/\.xml$/i.test(source.fileName)&&project(source).fileType==='SysCheck');
  const catalog=buildWorkspaceFileCatalog(files.map(project));
  for(const file of [...catalog.items].sort((a,b)=>a.fileName<b.fileName?-1:a.fileName>b.fileName?1:0))
   entries.push('{"workspaceId":'+workspace.workspaceNumber+',"name":'+JSON.stringify(file.metadata.identifier)+',"label":'+JSON.stringify(file.metadata.label)+',"description":'+JSON.stringify(file.metadata.description)+'}');
 }
 return entries.length?'['+entries.join(',')+']':null;
}
