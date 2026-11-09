import type {DatabaseSync} from 'node:sqlite';
import {prepareOriginalApplicationAssets,type OriginalApplicationAssetSummary,type OriginalApplicationAssetIdentity} from '@testcenter-rewrite-app/application';

/** Caller owns the same asset registry write transaction as settings/deletion. */
export function originalApplicationAssets(database:DatabaseSync,replacementId?:string){
  const assets=database.prepare('SELECT application_asset_id,original_name,media_type,byte_length,created_at,updated_at FROM application_assets').all().map(row=>({
    applicationAssetId:String(row.application_asset_id),originalName:String(row.original_name),
    mediaType:String(row.media_type) as OriginalApplicationAssetSummary['mediaType'],byteLength:Number(row.byte_length),createdAt:String(row.created_at),updatedAt:String(row.updated_at)
  }));
  const identities=database.prepare('SELECT * FROM original_application_assets').all().map(row=>({
    applicationAssetId:String(row.application_asset_id),assetNumber:Number(row.asset_number),storedName:String(row.stored_name)
  } satisfies OriginalApplicationAssetIdentity));
  const counter=Number(database.prepare('SELECT last_number FROM original_application_asset_counter WHERE singleton=1').get()?.last_number);
  const prepared=prepareOriginalApplicationAssets(assets,identities,counter,replacementId);
  if(prepared.changed){
    for(const row of prepared.identities.filter(row=>!identities.some(old=>old.applicationAssetId===row.applicationAssetId&&old.assetNumber===row.assetNumber&&old.storedName===row.storedName)))database.prepare('INSERT INTO original_application_assets(application_asset_id,asset_number,stored_name) VALUES(?,?,?) ON CONFLICT(application_asset_id) DO UPDATE SET stored_name=excluded.stored_name').run(row.applicationAssetId,row.assetNumber,row.storedName);
    database.prepare('UPDATE original_application_asset_counter SET last_number=? WHERE singleton=1').run(prepared.counter);
  }
  return prepared.catalog;
}
