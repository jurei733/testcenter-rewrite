import {createHash} from 'node:crypto';
import type {ContentRelease,ImportJob,SourcePackage,WorkspaceActivityEvent} from '@testcenter-rewrite-app/domain';
import {selectCurrentWorkspaceFiles} from './workspace-file-catalog.js';
import {createContentReleaseActivationRevision} from './content-release-activation.js';

/** Generated archives do not change the live-file revision they represent.
 * Fixed-key scalar rows also hash identically after JSONB/File round trips. */
export function createWorkspaceFilePublicationRevision(input:{sourcePackages:SourcePackage[];activityEvents:WorkspaceActivityEvent[]}):string {
  const rows=selectCurrentWorkspaceFiles(input.sourcePackages,input.activityEvents)
    .map(source=>({sourcePackageId:source.sourcePackageId,fileName:source.fileName,mediaType:source.mediaType,
      sourceDocument:source.sourceDocument,status:source.status}))
    .sort((a,b)=>a.sourcePackageId.localeCompare(b.sourcePackageId));
  return 'sha256:'+createHash('sha256').update(JSON.stringify(rows)).digest('hex');
}
export type WorkspaceFilePublicationInput={
  sourcePackage:SourcePackage;
  importJob:ImportJob;
  contentRelease:ContentRelease|null;
  activityEvents:WorkspaceActivityEvent[];
  expectedWorkspaceFileRevision:string;
  expectedActiveContentReleaseId:string|null;
  expectedActiveContentReleaseRevision:string;
};
export type WorkspaceFilePublicationContext={
  workspaceExists:boolean;
  identitiesAvailable:boolean;
  sourcePackages:SourcePackage[];
  activityEvents:WorkspaceActivityEvent[];
  contentReleases:ContentRelease[];
};

/** Validate under the same workspace lock as every write. In particular a
 * fresh read after compilation must never bless an older compiled snapshot. */
export function prepareWorkspaceFilePublication(input:WorkspaceFilePublicationInput,context:WorkspaceFilePublicationContext):ContentRelease[]|null {
  const source=input.sourcePackage,job=input.importJob,release=input.contentRelease;
  const scoped=(value:{tenantId:string;workspaceId:string})=>value.tenantId===source.tenantId && value.workspaceId===source.workspaceId;
  const events=input.activityEvents;
  const assembly=events.find(event=>event.eventType==='source_package_assembled');
  const imported=events.find(event=>event.eventType==='import_job_completed');
  const activated=events.find(event=>event.eventType==='content_release_activated');
  const active=context.contentReleases.filter(value=>value.status==='active');
  const live=new Map(selectCurrentWorkspaceFiles(context.sourcePackages,context.activityEvents).map(value=>[value.sourcePackageId,value]));
  const members=assembly?.details.sourcePackages;
  const memberIds=Array.isArray(members)?members.map(value=>value && typeof value==='object' && 'sourcePackageId' in value ? value.sourcePackageId : null):[];
  if(!context.workspaceExists || !context.identitiesAvailable || !source.sourcePackageId || source.status!=='accepted' ||
    source.mediaType!=='application/zip' || !source.sourceDocument?.startsWith('data:application/zip;base64,') ||
    context.contentReleases.some(value=>value.runtimeSnapshot.workspaceFilePublication) ||
    !scoped(job) || job.status!=='completed' || job.sourcePackageId!==source.sourcePackageId || !job.finishedAt ||
    events.length!==(release?3:2) || new Set(events.map(event=>event.activityEventId)).size!==events.length ||
    events.some(event=>!event.activityEventId || !scoped(event) || !Number.isFinite(Date.parse(event.occurredAt))) ||
    !assembly || assembly.subjectType!=='source_package' || assembly.subjectId!==source.sourcePackageId ||
    assembly.details.importJobId!==job.importJobId || assembly.details.contentReleaseId!==(release?.contentReleaseId??null) ||
    assembly.details.assemblyMode!=='workspace_files' || assembly.details.workspaceFileRevision!==input.expectedWorkspaceFileRevision ||
    memberIds.length===0 || new Set(memberIds).size!==memberIds.length || memberIds.some(id=>typeof id!=='string' || !live.has(id)) ||
    !imported || imported.subjectType!=='import_job' || imported.subjectId!==job.importJobId ||
    imported.details.sourcePackageId!==source.sourcePackageId ||
    imported.details.contentReleaseId!==(release?.contentReleaseId??null) ||
    active.length>1 || (active[0]?.contentReleaseId??null)!==input.expectedActiveContentReleaseId ||
    createContentReleaseActivationRevision({contentReleases:active,participantSessions:[],testRuns:[]})!==input.expectedActiveContentReleaseRevision ||
    createWorkspaceFilePublicationRevision(context)!==input.expectedWorkspaceFileRevision ||
    context.activityEvents.some(event=>event.eventType==='source_package_assembled' &&
      event.details.assemblyMode==='workspace_files' && event.details.workspaceFileRevision===input.expectedWorkspaceFileRevision) ||
    release && (!scoped(release) || release.status!=='active' || release.importJobId!==job.importJobId || !release.activatedAt ||
      release.runtimeSnapshot.workspaceFilePublication?.revision!==input.expectedWorkspaceFileRevision ||
      release.runtimeSnapshot.workspaceFilePublication.sourcePackageId!==source.sourcePackageId ||
      !activated || activated.subjectType!=='content_release' || activated.subjectId!==release.contentReleaseId ||
      activated.details.previousActiveContentReleaseId!==input.expectedActiveContentReleaseId) ||
    !release && activated) return null;
  return release ? active.map(value=>({...value,status:'superseded' as const})) : [];
}
