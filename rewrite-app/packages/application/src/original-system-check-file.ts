import {DOMParser,type Element} from '@xmldom/xmldom';
import type {SourcePackage,WorkspaceActivityEvent,WorkspaceCatalogFile} from '@testcenter-rewrite-app/domain';
import {buildWorkspaceFileCatalog,selectCurrentWorkspaceFiles,workspaceFileReplacementIdentity,type WorkspaceCatalogInput} from './workspace-file-catalog.js';
import {FirstSliceError} from './first-slice-error.js';
import {originalParticipantGroupKeysEqual} from './original-participant-group.js';
import {originalCommandInteger} from './original-command-codec.js';
import {encodeOriginalReportJson} from './original-workspace-report-wire.js';

export type OriginalSystemCheckFiles={sourcePackages:SourcePackage[];activityEvents:WorkspaceActivityEvent[]};
export type OriginalSystemCheckFileDependencies={project:(source:SourcePackage)=>WorkspaceCatalogInput;decode:(source:SourcePackage)=>{bytes:Uint8Array}|null};
type Speed={min:string;good:string;maxDevianceBytesPerSecond:string;maxErrorsPerSequence:string;maxSequenceRepetitions:string;sequenceSizes:string[]|0};
export type OriginalSystemCheckDefinition={sourcePackageId:string;name:string;label:string;saveKey:string;unitId:string;
 questions:Array<{id:string;type:string;prompt:string;required:boolean;options:string[]}>;customTexts:Record<string,{key:string;value:string}>;
 skipNetwork:boolean;downloadSpeed:Speed;uploadSpeed:Speed};
const children=(node:Element|undefined,name:string):Element[]=>Array.from(node?.childNodes??[]).filter(child=>child.nodeType===1&&(child as Element).tagName===name) as Element[];
// PHP 8.3 strtoupper changes ASCII bytes only, including inside UTF-8 text.
export const originalSystemCheckUpper=(value:string):string=>value.replace(/[a-z]/g,letter=>letter.toUpperCase());
const speed=(node:Element|undefined):Speed=>{
 const value:Speed={min:'0',good:'0',maxDevianceBytesPerSecond:'0',maxErrorsPerSequence:'0',maxSequenceRepetitions:'0',sequenceSizes:[]};
 if(!node)return value;
 for(const key of ['min','good','maxDevianceBytesPerSecond','maxErrorsPerSequence','maxSequenceRepetitions'] as const)value[key]=originalCommandInteger(node.getAttribute(key)??'').toString();
 const text=node.textContent??'';
 // PHP's loop first casts the absent sequenceSizes attribute to zero. Only
 // truthy text then replaces it with trimmed strings, not numeric sizes.
 value.sequenceSizes=text&&text!=='0'?text.split(',').map(part=>part.replace(/^[ \t\n\r\v\0]+|[ \t\n\r\v\0]+$/g,'')):0;
 return value;
};
const physical=(snapshot:OriginalSystemCheckFiles)=>selectCurrentWorkspaceFiles(snapshot.sourcePackages,snapshot.activityEvents).filter(source=>source.status!=='rejected');
export function readOriginalSystemCheckDefinition(snapshot:OriginalSystemCheckFiles,name:string,workspaceNumber:string,deps:OriginalSystemCheckFileDependencies):OriginalSystemCheckDefinition{
 const ids=new Set(snapshot.activityEvents.flatMap(event=>event.eventType==='source_package_created'&&event.details.intakeMode==='workspace_file'?[event.subjectId]:
  event.eventType==='source_package_replaced'&&event.details.replacementMode==='workspace_file'&&typeof event.details.replacementSourcePackageId==='string'?[event.details.replacementSourcePackageId]:[]));
 const sources=physical(snapshot).filter(source=>ids.has(source.sourcePackageId)&&/\.xml$/i.test(source.fileName)&&deps.project(source).fileType==='SysCheck');
 const catalog=buildWorkspaceFileCatalog(sources.map(deps.project)),matches=catalog.items.filter(file=>originalParticipantGroupKeysEqual(file.metadata.identifier,name));
 if(matches.length!==1)throw new FirstSliceError(matches.length?409:404,'original_system_check_unavailable',`No SysCheck with id \`${name}\` found on workspace \`${workspaceNumber}\`!`);
 const file=matches[0]!,source=sources.find(row=>row.sourcePackageId===file.sourcePackageId)!,text=deps.project(source).sourceText;
 if(typeof text!=='string')throw new FirstSliceError(409,'original_system_check_history_unknown','The current physical Systemcheck is unavailable.');
 const root=new DOMParser({onError(){}}).parseFromString(text,'application/xml').documentElement!,config=children(root,'Config')[0];
 return{sourcePackageId:source.sourcePackageId,name:file.metadata.identifier,label:file.metadata.label,
  saveKey:originalSystemCheckUpper(config?.getAttribute('savekey')??''),unitId:originalSystemCheckUpper(config?.getAttribute('unit')??''),
  questions:children(config,'Q').map(q=>({id:q.getAttribute('id')??'',type:q.getAttribute('type')??'',prompt:q.getAttribute('prompt')??'',required:q.getAttribute('required')==='true',options:q.textContent?.length?q.textContent.split('#'):[]})),
  customTexts:Object.fromEntries(children(config,'CustomText').map((node,index)=>[String(index),{key:node.getAttribute('key')??'',value:node.textContent??''}])),
  skipNetwork:config?.getAttribute('skipnetwork')==='true',downloadSpeed:speed(children(config,'DownloadSpeed')[0]),uploadSpeed:speed(children(config,'UploadSpeed')[0])};
}
/** Keep the PHP int64 workspace and speed tokens exact on the wire. */
export function formatOriginalSystemCheckConfig(check:OriginalSystemCheckDefinition,workspaceNumber:string):string{
 if(!/^[1-9][0-9]{0,18}$/.test(workspaceNumber)||BigInt(workspaceNumber)>9223372036854775807n)throw Error('Invalid native workspace number.');
 const speedJson=(value:Speed)=>'{'+Object.entries(value).map(([key,item])=>encodeOriginalReportJson(key)+':'+(key==='sequenceSizes'?encodeOriginalReportJson(item):String(item))).join(',')+'}';
 const fields={name:check.name,label:check.label,canSave:check.saveKey.length>0,hasUnit:check.unitId.length>0,questions:check.questions,customTexts:check.customTexts,skipNetwork:check.skipNetwork};
 return '{'+Object.entries(fields).map(([key,value])=>encodeOriginalReportJson(key)+':'+encodeOriginalReportJson(value)).join(',')+',"downloadSpeed":'+speedJson(check.downloadSpeed)+',"uploadSpeed":'+speedJson(check.uploadSpeed)+',"workspaceId":'+workspaceNumber+'}';
}
export function readOriginalSystemCheckUnit(snapshot:OriginalSystemCheckFiles,check:OriginalSystemCheckDefinition,deps:OriginalSystemCheckFileDependencies):{player_id:string;def:string;player:string}{
 const result={player_id:'',def:'',player:''};if(!check.unitId)return result;
 const sources=physical(snapshot),catalog=buildWorkspaceFileCatalog(sources.map(deps.project),{requireDependencies:true});
 const matches=catalog.items.filter(file=>file.fileType==='Unit'&&originalParticipantGroupKeysEqual(file.metadata.identifier,check.unitId));
 if(matches.length!==1||matches[0]!.unresolvedReferences.length)throw new FirstSliceError(404,'original_system_check_unit_unavailable','The current physical Systemcheck Unit is unavailable.');
 const unit=matches[0]!,source=sources.find(row=>row.sourcePackageId===unit.sourcePackageId)!,text=deps.project(source).sourceText;
 const resource=(relationship:'isDefinedBy'|'usesPlayer'):WorkspaceCatalogFile|undefined=>{const edges=unit.dependencies.filter(edge=>edge.relationship===relationship);return edges.length===1?catalog.items.find(file=>file.sourcePackageId===edges[0]!.sourcePackageId&&file.fileType==='Resource'):undefined;};
 const content=(file:WorkspaceCatalogFile)=>{const row=sources.find(item=>item.sourcePackageId===file.sourcePackageId),decoded=row?deps.decode(row):null;
  if(!decoded)throw new FirstSliceError(404,'original_system_check_resource_unavailable','The current Systemcheck resource is unavailable.');
  try{return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(decoded.bytes);}catch{throw new FirstSliceError(409,'original_system_check_resource_encoding','The Systemcheck resource is not valid UTF-8.');}};
 const definition=resource('isDefinedBy');if(definition)result.def=content(definition);
 if((!result.def||result.def==='0')&&typeof text==='string'){
  const root=new DOMParser({onError(){}}).parseFromString(text,'application/xml').documentElement!,inline=children(root,'Definition')[0];
  result.def=inline?.textContent??result.def;
 }
 const player=resource('usesPlayer');if(player){result.player=content(player);const row=sources.find(item=>item.sourcePackageId===player.sourcePackageId)!;result.player_id=workspaceFileReplacementIdentity(deps.project(row)).moduleId;}
 return result;
}
