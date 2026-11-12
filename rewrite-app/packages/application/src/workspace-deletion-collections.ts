import type {AdminRoleAssignment,Workspace,WorkspaceAggregateDeletionCounts} from '@testcenter-rewrite-app/domain';
type Rows<T>=Map<string,T>|Record<string,T>;
type Scope={tenantId:string;workspaceId:string};
export type WorkspaceDeletionScope=Scope&{tenantKey:string;workspaceKey:string};
const entries=<T>(rows:Rows<T>):[string,T][]=>rows instanceof Map?[...rows]:Object.entries(rows);
const values=<T>(rows:Rows<T>):T[]=>rows instanceof Map?[...rows.values()]:Object.values(rows);
const remove=<T>(rows:Rows<T>,key:string)=>{if(rows instanceof Map)rows.delete(key);else delete rows[key];};
const get=<T>(rows:Rows<T>,key:string)=>rows instanceof Map?rows.get(key):Object.hasOwn(rows,key)?rows[key]:undefined;
const set=<T>(rows:Rows<T>,key:string,v:T)=>{if(rows instanceof Map)rows.set(key,v);else rows[key]=v;};
export type WorkspaceDeletionCollections={
 workspacesByScope:Rows<Workspace>;workspacesByKey:Rows<Workspace>;adminRoleAssignments:Rows<AdminRoleAssignment>;
 participantRunCommands:Rows<Scope>;originalNativeCommands:Rows<Scope>;participantProgressDeliveries:Rows<Scope>;originalLoginBindings:Rows<Scope>;
 originalSessionTokens:Rows<Scope>;originalParticipantGroups:Rows<Scope>;originalNativeUnits:Rows<Scope>;originalNativeReviews:Rows<Scope>;originalPersonNumbers:Rows<Scope>;
 originalTestNumbers?:Rows<Scope&{testNumber:string}>;originalTestRunsByNumber:Rows<string>;originalWorkspaceNumbers?:Rows<Scope>;originalWorkspaceContentTypes?:Rows<unknown>;
 testRuns:Rows<Scope&{testRunId:string}>;participantPresence:Rows<unknown>;participantSessions:Rows<Scope&{participantSessionId:string}>;participantAccessCredentials:Rows<unknown>;
 attachmentFiles:Rows<Scope>;workspaceActivityEvents:Rows<Scope>;workspaceReviews:Rows<Scope>;sourcePackages:Rows<Scope&{sourcePackageId:string}>;
 importJobs:Rows<Scope>;contentReleases:Rows<Scope&{contentReleaseId:string}>;participantRosterEntries:Rows<Scope>;participantLoginAttempts:Rows<Scope>;participantTestLogs:Rows<Scope>;
 participantRosterPasswordHashes:Rows<string>;operationalLoginMigrationCandidates:Rows<unknown>;originalOperationalLogins:Rows<unknown>;
};
export function workspaceDeletionScopeExists(state:WorkspaceDeletionCollections,input:WorkspaceDeletionScope):boolean {
 const w=get(state.workspacesByScope,input.tenantKey+'::'+input.workspaceKey);
 return Boolean(w&&w.workspaceId===input.workspaceId&&w.tenantId===input.tenantId&&w.workspaceKey===input.workspaceKey);
}
/** Shared by canonical and native deletion, inside their existing durable
 * boundary. Only scope metadata is inspected; private sidecars stay lazy. */
export function deleteWorkspaceCollections(state:WorkspaceDeletionCollections,input:WorkspaceDeletionScope,dirty?:{source:Set<string>;release:Set<string>}):WorkspaceAggregateDeletionCounts|null {
 if(!workspaceDeletionScopeExists(state,input))return null;
 const matches=(row:Scope)=>row.tenantId===input.tenantId&&row.workspaceId===input.workspaceId;
 const erase=<T>(rows:Rows<T>,predicate:(value:T)=>boolean)=>{let count=0;for(const[k,v]of entries(rows))if(predicate(v)){remove(rows,k);count++;}return count;};
 for(const rows of [state.participantRunCommands,state.originalNativeCommands,state.participantProgressDeliveries,state.originalLoginBindings,state.originalSessionTokens,state.originalParticipantGroups,state.originalNativeUnits,state.originalNativeReviews,state.originalPersonNumbers])erase(rows,matches);
 if(state.originalTestNumbers)erase(state.originalTestNumbers,row=>{if(!matches(row))return false;remove(state.originalTestRunsByNumber,row.testNumber);return true;});
 if(state.originalWorkspaceNumbers)erase(state.originalWorkspaceNumbers,matches);
 if(state.originalWorkspaceContentTypes)remove(state.originalWorkspaceContentTypes,input.workspaceId);
 for(const run of values(state.testRuns))if(matches(run))remove(state.participantPresence,run.testRunId);
 for(const session of values(state.participantSessions))if(matches(session))remove(state.participantAccessCredentials,session.participantSessionId);
 if(dirty){for(const row of values(state.sourcePackages))if(matches(row))dirty.source.add(row.sourcePackageId);for(const row of values(state.contentReleases))if(matches(row))dirty.release.add(row.contentReleaseId);}
 const counts={deletedWorkspaceCount:1,deletedAdminRoleAssignmentCount:erase(state.adminRoleAssignments,r=>r.workspaceId===input.workspaceId&&r.tenantId===input.tenantId),
  deletedAttachmentFileCount:erase(state.attachmentFiles,matches),deletedActivityEventCount:erase(state.workspaceActivityEvents,matches),deletedReviewCount:erase(state.workspaceReviews,matches),
  deletedSourcePackageCount:erase(state.sourcePackages,matches),deletedImportJobCount:erase(state.importJobs,matches),deletedContentReleaseCount:erase(state.contentReleases,matches),
  deletedParticipantSessionCount:erase(state.participantSessions,matches),deletedRosterEntryCount:erase(state.participantRosterEntries,matches),deletedLoginAttemptCount:erase(state.participantLoginAttempts,matches),
  deletedTestRunCount:erase(state.testRuns,matches),deletedTestLogCount:erase(state.participantTestLogs,matches)};
 for(const[key]of entries(state.participantRosterPasswordHashes))if(key.startsWith(input.tenantId+'::'+input.workspaceId+'::'))remove(state.participantRosterPasswordHashes,key);
 remove(state.operationalLoginMigrationCandidates,input.tenantId+'::'+input.workspaceId);remove(state.originalOperationalLogins,input.tenantId+'::'+input.workspaceId);
 remove(state.workspacesByScope,input.tenantKey+'::'+input.workspaceKey);
 // Preserve a foreign short-key alias exactly. Repoint only the deleted scope's alias.
 if(get(state.workspacesByKey,input.workspaceKey)?.workspaceId===input.workspaceId){
  const remaining=values(state.workspacesByScope).find(w=>w.workspaceKey===input.workspaceKey);
  if(remaining)set(state.workspacesByKey,input.workspaceKey,remaining);else remove(state.workspacesByKey,input.workspaceKey);
 }
 return counts;
}
