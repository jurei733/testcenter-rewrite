import {randomBytes} from 'node:crypto';
import type {ApplicationAsset} from '@testcenter-rewrite-app/domain';
import {FirstSliceError} from './first-slice-error.js';

export type OriginalApplicationAssetIdentity = {
  applicationAssetId:string; assetNumber:number; storedName:string;
};
export type OriginalApplicationAssetSummary = Omit<ApplicationAsset,'dataBase64'>;
export type OriginalApplicationAsset = OriginalApplicationAssetIdentity & {asset:OriginalApplicationAssetSummary};
export type OriginalApplicationAssetContext={tenantId:string;workspaceId:string;loginKey:string;kind:'participant'|'operational'};

/** Resolve bindings in the asset registry snapshot, rather than carrying a
 * filename map across authentication and a concurrent delete/reupload. */
export function originalApplicationAssetScope(context:OriginalApplicationAssetContext|undefined,
  participant:import('@testcenter-rewrite-app/domain').ParticipantRosterEntry|null|undefined,
  candidates:ReadonlyArray<import('@testcenter-rewrite-app/domain').OperationalLoginMigrationCandidate>=[],
  privateLogins:ReadonlyArray<{loginKey:string;loginMode:string}>=[]):Record<string,string>{
  if(!context)return {};
  if(context.kind==='participant'&&participant?.originalLoginIdentity&&participant.tenantId===context.tenantId&&
    participant.workspaceId===context.workspaceId&&participant.loginKey===context.loginKey)return {...participant.assetAssignments};
  if(context.kind==='operational'){
    const rows=candidates.filter(row=>row.loginKey===context.loginKey),native=privateLogins.filter(row=>row.loginKey===context.loginKey);
    if(rows.length===1&&native.length===1&&rows[0]!.loginMode===native[0]!.loginMode&&['monitor-group','monitor-study'].includes(native[0]!.loginMode))return {...rows[0]!.assetAssignments};
  }
  throw new FirstSliceError(410,'original_login_gone','The Original login is no longer available.');
}

/** Source uses PostgreSQL integer identities for assets, independently of its
 * bigint Test/User/Workspace sequences. Never derive an ID from display order. */
export function prepareOriginalApplicationAssets(
  assets:ReadonlyArray<OriginalApplicationAssetSummary>,
  identities:ReadonlyArray<OriginalApplicationAssetIdentity>,
  counter:number,
  replacementId?:string
):{catalog:OriginalApplicationAsset[];identities:OriginalApplicationAssetIdentity[];counter:number;changed:boolean} {
  if(!Number.isSafeInteger(counter)||counter<0||counter>2147483647)throw Error('Invalid native asset sequence.');
  const numbers=new Set<number>(),names=new Set<string>(),ids=new Map<string,OriginalApplicationAssetIdentity>();
  for(const row of identities){
    if(typeof row.applicationAssetId!=='string'||!row.applicationAssetId||!Number.isSafeInteger(row.assetNumber)||row.assetNumber<1||row.assetNumber>counter||
       !/^asset_[a-f0-9]{32}\.(?:png|jpe?g|webp)$/.test(row.storedName)||
       numbers.has(row.assetNumber)||names.has(row.storedName)||ids.has(row.applicationAssetId))throw Error('Invalid native asset identity.');
    numbers.add(row.assetNumber);names.add(row.storedName);ids.set(row.applicationAssetId,{...row});
  }
  const live=new Set<string>();let changed=false;
  const catalog:OriginalApplicationAsset[]=[];
  for(const asset of assets.slice().sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)||a.applicationAssetId.localeCompare(b.applicationAssetId))){
    if(!asset.applicationAssetId||live.has(asset.applicationAssetId)||!Number.isFinite(Date.parse(asset.createdAt)))throw Error('Invalid native asset parent.');
    live.add(asset.applicationAssetId);
    let identity=ids.get(asset.applicationAssetId);
    if(!identity){
      if(counter===2147483647)throw Error('Native asset sequence is exhausted.');
      identity={applicationAssetId:asset.applicationAssetId,assetNumber:++counter,storedName:''};changed=true;
    }
    if(!identity.storedName||replacementId===asset.applicationAssetId){
      const extension=/\.(png|jpe?g|webp)$/i.exec(asset.originalName)?.[1]?.toLowerCase()??(asset.mediaType==='image/jpeg'?'jpeg':asset.mediaType==='image/webp'?'webp':'png');
      let storedName:string;
      do{storedName='asset_'+randomBytes(16).toString('hex')+'.'+extension;}while(names.has(storedName));
      names.add(storedName);identity={...identity,storedName};changed=true;
    }
    const {applicationAssetId,originalName,mediaType,byteLength,createdAt,updatedAt}=asset;
    catalog.push({...identity,asset:{applicationAssetId,originalName,mediaType,byteLength,createdAt,updatedAt}});
  }
  if(identities.some(row=>!live.has(row.applicationAssetId)))changed=true;
  return {catalog:catalog.sort((a,b)=>Date.parse(b.asset.createdAt)-Date.parse(a.asset.createdAt)||b.assetNumber-a.assetNumber),
    identities:catalog.map(({asset:_,...identity})=>identity),counter,changed};
}
