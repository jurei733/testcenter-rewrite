import type {SourcePackage,WorkspaceFileCatalog} from '@testcenter-rewrite-app/domain';
import type {FirstSliceRepository} from './index.js';
import {buildWorkspaceFileCatalog,selectCurrentWorkspaceFiles,type WorkspaceCatalogInput} from './workspace-file-catalog.js';
import {originalParticipantGroupKeysEqual} from './original-participant-group.js';
import {FirstSliceError} from './first-slice-error.js';
import {originalResourceMediaType} from './original-resource-media-type.js';
import {createWorkspaceFilePublicationRevision} from './workspace-file-publication.js';
type Scope={tenantId:string;workspaceId:string};
export type OriginalBookletFiles={xml:string;resources:Record<string,Record<string,string[]>>};
export function createOriginalTestFiles(deps:{repository:FirstSliceRepository;project:(source:SourcePackage)=>WorkspaceCatalogInput;decode:(source:SourcePackage)=>{bytes:Uint8Array}|null}){
 const cache=new Map<string,{revision:string;catalog:WorkspaceFileCatalog;bytes:number}>();let retainedBytes=0;
 const current=async(scope:Scope)=>{
  const[sources,events]=await Promise.all([deps.repository.listSourcePackagesByWorkspace(scope.tenantId,scope.workspaceId),deps.repository.listWorkspaceActivityEventsByWorkspace(scope.tenantId,scope.workspaceId)]);
  const physical=selectCurrentWorkspaceFiles(sources,events).filter(source=>source.status!=='rejected');
  const revision=createWorkspaceFilePublicationRevision({sourcePackages:sources,activityEvents:events}),key=JSON.stringify([scope.tenantId,scope.workspaceId]),known=cache.get(key);
  if(known?.revision===revision)return{physical,catalog:known.catalog};
  const catalog=buildWorkspaceFileCatalog(physical.map(deps.project),{requireDependencies:true}),bytes=Buffer.byteLength(JSON.stringify(catalog),'utf8');
  if(known){retainedBytes-=known.bytes;cache.delete(key);}if(bytes<=64*1024*1024){cache.set(key,{revision,catalog,bytes});retainedBytes+=bytes;
   while(cache.size>16||retainedBytes>64*1024*1024){const oldest=cache.keys().next().value!;retainedBytes-=cache.get(oldest)!.bytes;cache.delete(oldest);}}
  return{physical,catalog};
 };
 return{
  async booklet(scope:Scope,fileId:string):Promise<OriginalBookletFiles>{
   const{physical,catalog}=await current(scope);const matches=catalog.items.filter(file=>file.fileType==='Booklet'&&originalParticipantGroupKeysEqual(file.metadata.identifier,fileId));
   if(matches.length!==1)throw new FirstSliceError(matches.length?409:404,'original_booklet_unavailable','The current physical Booklet is unavailable.');
   const root=matches[0]!,source=physical.find(row=>row.sourcePackageId===root.sourcePackageId)!,xml=deps.project(source).sourceText;
   if(typeof xml!=='string')throw new FirstSliceError(409,'original_booklet_unavailable','The current physical Booklet is unavailable.');
   const resources=new Map<string,Map<string,string[]>>();
   for(const edge of root.dependencies.filter(row=>row.relationship==='containsUnit')){
    const unit=catalog.items.find(row=>row.sourcePackageId===edge.sourcePackageId);if(!unit)continue;
    const groups=new Map<string,string[]>();
    for(const dependency of unit.dependencies){const file=catalog.items.find(row=>row.sourcePackageId===dependency.sourcePackageId);if(file?.fileType!=='Resource')continue;
      const paths=groups.get(dependency.relationship)??[];if(!paths.includes(file.fileName))paths.push(file.fileName);groups.set(dependency.relationship,paths);}
    if(groups.size)resources.set(unit.metadata.identifier,groups);
   }
   return{xml,resources:Object.fromEntries([...resources].map(([id,groups])=>[id,Object.fromEntries(groups)]))};
  },
  async resource(scope:Scope,path:string):Promise<{bytes:Uint8Array;contentType:string}>{
   // A group capability never permits Unit/Testtakers files or parent traversal.
   if(!path.startsWith('Resource/'))throw new FirstSliceError(403,'original_resource_forbidden',`Access to file \`${path}\` not allowed with group-token.`);
   const segments=path.split('/');if(segments.some(part=>!part||part==='.'||part==='..')||/[\\\u0000-\u001f\u007f]/.test(path))throw new FirstSliceError(404,'original_resource_unavailable',`File not found: \`${path}\``);
   const[sources,events]=await Promise.all([deps.repository.listSourcePackagesByWorkspace(scope.tenantId,scope.workspaceId),deps.repository.listWorkspaceActivityEventsByWorkspace(scope.tenantId,scope.workspaceId)]);
   const matches=selectCurrentWorkspaceFiles(sources,events).filter(row=>row.status!=='rejected'&&row.fileName===path);
   if(matches.length!==1)throw new FirstSliceError(404,'original_resource_unavailable',`File not found: \`${path}\``);const decoded=deps.decode(matches[0]!);
   if(!decoded)throw new FirstSliceError(404,'original_resource_unavailable',`File not found: \`${path}\``);
   return{bytes:decoded.bytes,contentType:originalResourceMediaType(path)};
  }
 };
}
