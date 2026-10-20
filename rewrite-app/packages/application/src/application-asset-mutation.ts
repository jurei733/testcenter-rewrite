import type { AdminAuditEvent, ApplicationAsset, ApplicationSettings, OperationalLoginMigrationCandidate } from "@testcenter-rewrite-app/domain";
import { FirstSliceError } from "./first-slice-error.js";
export type ApplicationAssetDeletionInput = {
  applicationAssetId:string; cascadeAssignments:boolean; auditEvent:AdminAuditEvent;
};
export type ApplicationAssetAssignmentRow = {
  participantRosterEntryId:string;tenantId:string;workspaceId:string;loginKey:string;assetAssignments:Record<string,string>;
};
export type ApplicationAssetDeletionContext = {
  asset:ApplicationAsset|null;settings:ApplicationSettings|null;
  roster:ApplicationAssetAssignmentRow[];
  operational:Array<{tenantId:string;workspaceId:string;candidates:OperationalLoginMigrationCandidate[]}>;
  scopes:Array<{tenantId:string;workspaceId:string;tenantKey:string;workspaceKey:string}>;
};
/** Validate in the same write boundary used by catalog deletion. */
export function validateApplicationAssetReferences(assignments:Record<string,string>|undefined, assets:ReadonlyArray<Pick<ApplicationAsset,"originalName">>):void{
  const available=new Set(assets.map(asset=>asset.originalName));
  for(const name of Object.values(assignments??{}))if(!available.has(name))throw new FirstSliceError(400,
    "application_asset_assignment_missing","Application asset '"+name+"' does not exist.");
}
/** Pure projection; stores commit these edits, deletion and audit atomically. */
export function prepareApplicationAssetDeletion(input:ApplicationAssetDeletionInput,context:ApplicationAssetDeletionContext){
  const asset=context.asset;if(!asset||asset.applicationAssetId!==input.applicationAssetId)return null;
  const matches=(map:Record<string,string>|undefined)=>Object.entries(map??{}).filter(([,name])=>name===asset.originalName).map(([slot])=>slot);
  const without=(map:Record<string,string>|undefined)=>Object.fromEntries(Object.entries(map??{}).filter(([,name])=>name!==asset.originalName));
  const assignedSlots=matches(context.settings?.assetAssignments);
  const references=[...context.roster.flatMap(row=>{
    const slots=matches(row.assetAssignments);return slots.length?[{...row,source:"participant" as const,slots}]:[];
  }),...context.operational.flatMap(group=>group.candidates.flatMap(candidate=>{
    const slots=matches(candidate.assetAssignments);return slots.length?[{...group,loginKey:candidate.loginKey,source:"operational" as const,slots}]:[];
  }))].map(row=>{
    const scope=context.scopes.find(scope=>scope.tenantId===row.tenantId&&scope.workspaceId===row.workspaceId);
    return {tenantKey:scope?.tenantKey??row.tenantId,workspaceKey:scope?.workspaceKey??row.workspaceId,loginKey:row.loginKey,source:row.source,slots:row.slots};
  });
  if(!input.cascadeAssignments&&(assignedSlots.length||references.length))throw new FirstSliceError(409,"application_asset_in_use",
    "Application asset '"+asset.originalName+"' is still assigned.",{assignedSlots,rosterReferenceCount:references.length,rosterReferences:references.slice(0,50)});
  const roster=context.roster.filter(row=>matches(row.assetAssignments).length).map(row=>({...row,assetAssignments:without(row.assetAssignments)}));
  const operational=context.operational.filter(group=>group.candidates.some(candidate=>matches(candidate.assetAssignments).length)).map(group=>({...group,
    candidates:group.candidates.map(candidate=>matches(candidate.assetAssignments).length?{...candidate,assetAssignments:without(candidate.assetAssignments)}:candidate)}));
  const settings=context.settings&&assignedSlots.length?{...context.settings,assetAssignments:without(context.settings.assetAssignments),
    updatedAt:input.auditEvent.occurredAt,updatedByAdminUserId:input.auditEvent.actorAdminUserId}:null;
  return {asset,settings,roster,operational,auditEvent:{...input.auditEvent,details:{...input.auditEvent.details,
    originalName:asset.originalName,cascadeAssignments:input.cascadeAssignments,clearedGlobalSlots:assignedSlots,clearedRosterReferenceCount:references.length}}};
}
