import type {AdminUser,ApplicationSettings} from '@testcenter-rewrite-app/domain';
import {defaultApplicationSettings} from '@testcenter-rewrite-app/domain';
import type {ApplicationSettingsPort,FirstSliceRepository} from './index.js';
import type {OriginalAuthenticationPort} from './original-authentication.js';
import type {OriginalApplicationAsset} from './original-application-asset.js';
import {FirstSliceError} from './first-slice-error.js';
import {originalCommandInteger} from './original-command-codec.js';

const url=(row:OriginalApplicationAsset)=>'public/uploaded_assets/'+row.storedName;
const object=(value:unknown):value is Record<string,unknown>=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));
const malformed=()=>new FirstSliceError(500,'original_asset_request_invalid','Internal error.');
const metadata=(row:OriginalApplicationAsset)=>({id:row.assetNumber,originalName:row.asset.originalName,storedName:row.storedName,url:url(row)});
function createdAt(value:string):string {
  return new Date(value).toISOString().replace('T',' ').replace(/\.([0-9]*?)0+Z$/,(_,digits:string)=>digits?'.'+digits+'Z':'Z').replace(/Z$/,'+00');
}
export type OriginalAssetPort={
  list(input:{token:string}):Promise<unknown>;
  upload(input:{token:string;originalName:string;mediaType:string;dataBase64:string}):Promise<unknown>;
  delete(input:{token:string;reference:string}):Promise<void>;
  getAssignments(input:{token?:string}):Promise<unknown>;
  setAssignments(input:{token:string;body:unknown}):Promise<void>;
  file(input:{storedName:string}):ReturnType<FirstSliceRepository['getOriginalApplicationAssetByStoredName']>;
};
export function createOriginalAssetPort(input:{repository:FirstSliceRepository;settings:ApplicationSettingsPort;auth:OriginalAuthenticationPort;
  upload:(request:Parameters<ApplicationSettingsPort['uploadApplicationAsset']>[0])=>Promise<OriginalApplicationAsset>;
  admin:(token:string,root:boolean)=>Promise<AdminUser>;now:()=>string;id:()=>string}):OriginalAssetPort {
  return {
    async list({token}){
      await input.admin(token,true);
      return (await input.repository.getOriginalApplicationAssets()).assets.map(row=>({id:row.assetNumber,originalName:row.asset.originalName,storedName:row.storedName,createdAt:createdAt(row.asset.createdAt),url:url(row)}));
    },
    async upload(request){
      await input.admin(request.token,true);
      // Retain this operation's committed identity across audit awaits and
      // concurrent replacement/deletion, as the Source controller does.
      return metadata(await input.upload({sessionToken:request.token,...request}));
    },
    async delete({token,reference}){
      await input.admin(token,true);
      const number=originalCommandInteger(reference);
      const row=(await input.repository.getOriginalApplicationAssets()).assets.find(row=>BigInt(row.assetNumber)===number);
      if(!row)throw new FirstSliceError(404,'original_asset_not_found','Asset `'+reference+'` not found');
      await input.settings.deleteApplicationAsset({sessionToken:token,applicationAssetId:row.applicationAssetId,cascadeAssignments:true});
    },
    async getAssignments({token}){
      let context:import("./original-application-asset.js").OriginalApplicationAssetContext|undefined;
      if(token){
        if(await input.repository.getAdminSessionByToken(token))await input.admin(token,false);
        else context=await input.auth.assetContext({token});
      }
      const snapshot=await input.repository.getOriginalApplicationAssets(context);
      const assignments={...snapshot.settings?.assetAssignments,...snapshot.scopedAssignments};
      const rows=Object.entries(assignments).map(([slot,name])=>{
        const asset=snapshot.assets.find(row=>row.asset.originalName===name);
        if(!asset)throw new FirstSliceError(409,'original_asset_assignment_unknown','The native asset assignment history is unavailable.');
        return [slot,{assetID:asset.assetNumber,url:url(asset)}];
      });
      return rows.length?Object.fromEntries(rows):[];
    },
    async setAssignments({token,body}){
      const admin=await input.admin(token,true);
      const assignments=object(body)?body.assignments??[]:[];
      if(!Array.isArray(assignments))throw malformed();
      await input.repository.mutateApplicationSettings((previous,catalog)=>{
        if(!catalog)throw Error('Missing native asset catalog boundary.');
        const settings:ApplicationSettings={...(previous??defaultApplicationSettings),assetAssignments:{...previous?.assetAssignments},updatedAt:input.now(),updatedByAdminUserId:admin.adminUserId};
        const bindings=settings.assetAssignments as Record<string,string>,upserts=new Map<string,number>();
        for(const assignment of assignments){
          if(!object(assignment)||typeof assignment.slotName!=='string'||[...assignment.slotName].length>100||assignment.slotName.includes('\0'))throw malformed();
          const slot=assignment.slotName;
          if(assignment.assetID===null){delete bindings[slot];continue;}
          if(upserts.has(slot))throw malformed();
          const number=originalCommandInteger(assignment.assetID);
          const asset=catalog.find(row=>BigInt(row.assetNumber)===number);
          if(!asset)throw malformed();
          upserts.set(slot,asset.assetNumber);
        }
        // Source performs all deletions before its upserts, irrespective of
        // the input order. Failed batches remain atomic in the rewrite.
        for(const [slot,number]of upserts)Object.defineProperty(bindings,slot,{value:catalog.find(row=>row.assetNumber===number)!.asset.originalName,enumerable:true,writable:true,configurable:true});
        return {settings,auditEvent:{adminAuditEventId:input.id(),eventType:'application_settings_updated',actorAdminUserId:admin.adminUserId,subjectAdminUserId:null,occurredAt:input.now(),summary:'Native application asset assignments updated.',details:{native:true,slots:assignments.length}}};
      },true);
    },
    file:({storedName})=>/^asset_[a-f0-9]{32}\.(?:png|jpe?g|webp)$/.test(storedName)?input.repository.getOriginalApplicationAssetByStoredName(storedName):Promise.resolve(null)
  };
}
