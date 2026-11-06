import type {SourcePackage,WorkspaceActivityEvent} from '@testcenter-rewrite-app/domain';
import {FirstSliceError} from './first-slice-error.js';

type Entry={fileName:string;uncompressedSize:number;modifiedAt?:string};
export type WorkspaceArchiveOrigin={archiveFileName:string;archiveSha256:string;archiveEntryName:string;archiveEntryModifiedAt?:string};

/** Physical ZIP members retain their Source modification time without changing
 * the immutable intake/audit timestamp of the source-package record. */
export function applyWorkspaceArchiveTimestamps<T extends {sourcePackageId:string;uploadedAt:string}>(files:T[],events:Pick<WorkspaceActivityEvent,'eventType'|'subjectId'|'details'>[]):T[]{
  const times=new Map<string,string>();
  for(const event of events){
    const id=event.eventType==='source_package_created'?event.subjectId:event.eventType==='source_package_replaced'&&typeof event.details.replacementSourcePackageId==='string'?event.details.replacementSourcePackageId:null;
    const time=event.details.archiveEntryModifiedAt;
    if(id&&typeof time==='string'&&Number.isFinite(Date.parse(time)))times.set(id,time);
  }
  return files.map(file=>times.has(file.sourcePackageId)?{...file,uploadedAt:times.get(file.sourcePackageId)!}:file);
}

export function assertWorkspaceUploadName(value:unknown):asserts value is string {
  if(typeof value!=='string'||!value.trim()||/[\\/\x00-\x1f\x7f]/.test(value)||value==='.'||value==='..')
    throw new FirstSliceError(400,'workspace_file_name_invalid','A workspace file requires a basename without paths or control characters.');
  if(Buffer.byteLength(value,'utf8')>120)throw new FirstSliceError(400,'source_package_file_name_too_long',
    'Source package file names must not exceed 120 UTF-8 bytes.');
}

/** Validate the complete container before publishing any physical member.
 * Ordinary nested ZIPs are opaque resources. Only ITCR resources have their
 * own independently bounded installation contract. Never extract to disk. */
export function createOriginalWorkspaceArchives<E extends Entry>(deps:{
  decode:(source:SourcePackage)=>{bytes:Uint8Array}|null;
  entries:(bytes:Buffer,maximumEntries:number)=>E[]|null;
  read:(bytes:Buffer,entry:E,maximumBytes:number)=>Buffer|null;
  safe:(path:string,directory:boolean)=>boolean;
  normalize:(path:string)=>string;
}) {
  const invalid=()=>new FirstSliceError(400,'workspace_archive_invalid','The ZIP archive is invalid.');
  const oversized=()=>new FirstSliceError(413,'workspace_archive_too_large','The ZIP archive exceeds its bounded archive, member, entry or expanded-size limit.');
  return {read(source:SourcePackage):Array<{entryName:string;bytes:Buffer;modifiedAt?:string}>{
    const decoded=deps.decode(source);if(!decoded)throw invalid();
    if(decoded.bytes.byteLength>64*1024*1024)throw oversized();
    const bytes=Buffer.from(decoded.bytes),entries=deps.entries(bytes,10_000);if(!entries)throw invalid();
    const identities=new Set<string>(),files=new Set<string>(),paths:string[]=[];let expanded=0;
    for(const entry of entries){
      const directory=entry.fileName.endsWith('/');if(!deps.safe(entry.fileName,directory))throw invalid();
      const path=deps.normalize(entry.fileName),key=path.toLowerCase();if(identities.has(key))throw invalid();identities.add(key);paths.push(path);
      const limit=/\.itcr\.zip$/i.test(path)?64*1024*1024:20*1024*1024;
      if(!Number.isSafeInteger(entry.uncompressedSize)||entry.uncompressedSize<0)throw invalid();
      expanded+=entry.uncompressedSize;if(entry.uncompressedSize>limit||expanded>50*1024*1024)throw oversized();
      if(!directory)files.add(key);
    }
    for(const path of paths){const parts=path.toLowerCase().split('/');for(let i=1;i<parts.length;i++)if(files.has(parts.slice(0,i).join('/')))throw invalid();}
    const members:Array<{entryName:string;bytes:Buffer;modifiedAt?:string}>=[];
    for(const entry of entries){
      const directory=entry.fileName.endsWith('/'),path=deps.normalize(entry.fileName);
      const content=deps.read(bytes,entry,directory?0:/\.itcr\.zip$/i.test(path)?64*1024*1024:20*1024*1024);
      if(content===null)throw invalid();if(!directory)members.push({entryName:path,bytes:Buffer.from(content),...(entry.modifiedAt?{modifiedAt:entry.modifiedAt}:{})});
    }
    return members;
  }};
}
