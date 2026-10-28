import type {SourcePackage,WorkspaceFileCatalog} from '@testcenter-rewrite-app/domain';
import type {FirstSliceRepository} from './index.js';
import {buildWorkspaceFileCatalog,selectCurrentWorkspaceFiles,type WorkspaceCatalogInput} from './workspace-file-catalog.js';
import {originalParticipantGroupKeysEqual} from './original-participant-group.js';
import {FirstSliceError} from './first-slice-error.js';
import {originalResourceMediaType} from './original-resource-media-type.js';
import {createWorkspaceFilePublicationRevision} from './workspace-file-publication.js';
import {DOMParser,type Element} from '@xmldom/xmldom';
import {normalizeWorkspacePlayerResourceId} from './workspace-file-catalog.js';
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
  async unit(scope:Scope,fileId:string):Promise<{definition:string;definitionType:string}>{
   const{physical,catalog}=await current(scope),matches=catalog.items.filter(file=>file.fileType==='Unit'&&originalParticipantGroupKeysEqual(file.metadata.identifier,fileId));
   if(matches.length!==1)throw new FirstSliceError(matches.length?409:404,'original_unit_file_unavailable','The current physical Unit is unavailable.');
   const file=matches[0]!;if(file.unresolvedReferences.length)throw new FirstSliceError(404,'original_unit_file_unavailable','The current physical Unit is unavailable.');
   const source=physical.find(row=>row.sourcePackageId===file.sourcePackageId)!,xml=deps.project(source).sourceText;
   if(typeof xml!=='string')throw new FirstSliceError(404,'original_unit_file_unavailable','The current physical Unit is unavailable.');
   const document=new DOMParser({onError(){}}).parseFromString(xml,'application/xml'),root=document.documentElement;
   const definitions:Element[]=[];for(let child=root?.firstChild;child;child=child.nextSibling)if(child.nodeType===1&&['Definition','DefinitionRef'].includes((child as Element).tagName))definitions.push(child as Element);
   const inline=definitions.find(node=>node.tagName==='Definition');let definition='';for(let node=inline?.firstChild;node;node=node.nextSibling)if(node.nodeType===3||node.nodeType===4)definition+=node.nodeValue??'';
   if(!inline&&definitions.some(node=>node.tagName==='DefinitionRef')){
    // Resolve through the validated current catalog, never through an arbitrary
    // filesystem path or a resource from another workspace/publication.
    const references=file.dependencies.filter(row=>row.relationship==='isDefinedBy');
    const resource=references.length===1?catalog.items.find(row=>row.sourcePackageId===references[0]!.sourcePackageId&&row.fileType==='Resource'):null;
    const resourceSource=resource?physical.find(row=>row.sourcePackageId===resource.sourcePackageId):null;
    const decoded=resourceSource?deps.decode(resourceSource):null;
    if(!decoded)throw new FirstSliceError(404,'original_unit_file_unavailable','The current physical Unit definition is unavailable.');
    try{definition=new TextDecoder('utf-8',{fatal:true}).decode(decoded.bytes);}
    catch{throw new FirstSliceError(409,'original_unit_definition_encoding','The Unit definition is not valid UTF-8.');}
   }
   const player=file.dependencies.find(row=>row.relationship==='usesPlayer'),target=player?catalog.items.find(row=>row.sourcePackageId===player.sourcePackageId):null;
   const raw=definitions[0]?.getAttribute('player')??'',definitionType=(target?.metadata.identifier??normalizeWorkspacePlayerResourceId(raw)??'').replace(/[A-Z]/g,c=>c.toLowerCase());
   return{definition,definitionType};
  },
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
