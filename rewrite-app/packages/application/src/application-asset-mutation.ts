import type { AdminAuditEvent, ApplicationAsset, ApplicationSettings, OperationalLoginMigrationCandidate, OriginalAssetAssignmentLayers } from "@testcenter-rewrite-app/domain";
import { FirstSliceError } from "./first-slice-error.js";
export type ApplicationAssetDeletionInput = {
  applicationAssetId:string; cascadeAssignments:boolean; auditEvent:AdminAuditEvent;
};
export type ApplicationAssetAssignmentRow = {
  participantRosterEntryId:string;tenantId:string;workspaceId:string;loginKey:string;assetAssignments:Record<string,string>;originalAssetAssignmentLayers?:OriginalAssetAssignmentLayers;
};
export type ApplicationAssetDeletionContext = {
  asset:ApplicationAsset|null;settings:ApplicationSettings|null;
  roster:ApplicationAssetAssignmentRow[];
  operational:Array<{tenantId:string;workspaceId:string;candidates:OperationalLoginMigrationCandidate[]}>;
  scopes:Array<{tenantId:string;workspaceId:string;tenantKey:string;workspaceKey:string}>;
};
export function readOriginalAssetAssignmentLayers(value:unknown):OriginalAssetAssignmentLayers|undefined {
  if(value==null)return undefined;
  const object=(v:unknown):v is Record<string,unknown>=>Boolean(v&&typeof v==='object'&&!Array.isArray(v));
  if(!object(value)||Object.keys(value).some(k=>!['group','user'].includes(k))||!object(value.group)||!object(value.user)||
    [...Object.values(value.group),...Object.values(value.user)].some(v=>typeof v!=='string'))throw new FirstSliceError(409,'original_asset_layers_unknown','The native asset assignment layers are unavailable.');
  return {group:{...value.group} as Record<string,string>,user:{...value.user} as Record<string,string>};
}
/** Validate in the same write boundary used by catalog deletion. */
export function validateApplicationAssetReferences(assignments:Record<string,string>|undefined, assets:ReadonlyArray<Pick<ApplicationAsset,"originalName">>,layers?:OriginalAssetAssignmentLayers):void{
  const available=new Set(assets.map(asset=>asset.originalName));
  for(const name of [...Object.values(assignments??{}),...Object.values(layers?.group??{}),...Object.values(layers?.user??{})])if(!available.has(name))throw new FirstSliceError(400,
    "application_asset_assignment_missing","Application asset '"+name+"' does not exist.");
}
/** Pure projection; stores commit these edits, deletion and audit atomically. */
export function prepareApplicationAssetDeletion(input:ApplicationAssetDeletionInput,context:ApplicationAssetDeletionContext){
  const asset=context.asset;if(!asset||asset.applicationAssetId!==input.applicationAssetId)return null;
  const matches=(map:Record<string,string>|undefined)=>Object.entries(map??{}).filter(([,name])=>name===asset.originalName).map(([slot])=>slot);
  const without=(map:Record<string,string>|undefined)=>Object.fromEntries(Object.entries(map??{}).filter(([,name])=>name!==asset.originalName));
  const slots=(row:{assetAssignments?:Record<string,string>;originalAssetAssignmentLayers?:OriginalAssetAssignmentLayers})=>[...new Set([...matches(row.assetAssignments),...matches(row.originalAssetAssignmentLayers?.group),...matches(row.originalAssetAssignmentLayers?.user)])];
  const prune=<T extends {assetAssignments?:Record<string,string>;originalAssetAssignmentLayers?:OriginalAssetAssignmentLayers}>(row:T):T=>{
    if(!row.originalAssetAssignmentLayers)return {...row,assetAssignments:without(row.assetAssignments)};
    const layers={group:without(row.originalAssetAssignmentLayers.group),user:without(row.originalAssetAssignmentLayers.user)};
    return {...row,originalAssetAssignmentLayers:layers,assetAssignments:{...layers.group,...layers.user}};
  };
  const assignedSlots=matches(context.settings?.assetAssignments);
  const references=[...context.roster.flatMap(row=>{
    const references=slots(row);return references.length?[{...row,source:"participant" as const,slots:references}]:[];
  }),...context.operational.flatMap(group=>group.candidates.flatMap(candidate=>{
    const references=slots(candidate);return references.length?[{...group,loginKey:candidate.loginKey,source:"operational" as const,slots:references}]:[];
  }))].map(row=>{
    const scope=context.scopes.find(scope=>scope.tenantId===row.tenantId&&scope.workspaceId===row.workspaceId);
    return {tenantKey:scope?.tenantKey??row.tenantId,workspaceKey:scope?.workspaceKey??row.workspaceId,loginKey:row.loginKey,source:row.source,slots:row.slots};
  });
  if(!input.cascadeAssignments&&(assignedSlots.length||references.length))throw new FirstSliceError(409,"application_asset_in_use",
    "Application asset '"+asset.originalName+"' is still assigned.",{assignedSlots,rosterReferenceCount:references.length,rosterReferences:references.slice(0,50)});
  const roster=context.roster.filter(row=>slots(row).length).map(prune);
  const operational=context.operational.filter(group=>group.candidates.some(candidate=>slots(candidate).length)).map(group=>({...group,
    candidates:group.candidates.map(candidate=>slots(candidate).length?prune(candidate):candidate)}));
  const settings=context.settings&&assignedSlots.length?{...context.settings,assetAssignments:without(context.settings.assetAssignments),
    updatedAt:input.auditEvent.occurredAt,updatedByAdminUserId:input.auditEvent.actorAdminUserId}:null;
  return {asset,settings,roster,operational,auditEvent:{...input.auditEvent,details:{...input.auditEvent.details,
    originalName:asset.originalName,cascadeAssignments:input.cascadeAssignments,clearedGlobalSlots:assignedSlots,clearedRosterReferenceCount:references.length}}};
}
