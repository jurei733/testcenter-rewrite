import type {PoolClient} from 'pg';
import {prepareOriginalApplicationAssets,type OriginalApplicationAssetSummary,type OriginalApplicationAssetIdentity} from '@testcenter-rewrite-app/application';

/** Caller owns the same asset registry write transaction as settings/deletion. */
export async function originalApplicationAssets(client:PoolClient,replacementId?:string){
  const assets=(await client.query('SELECT application_asset_id,original_name,media_type,byte_length,created_at,updated_at FROM application_assets')).rows.map(row=>({
    applicationAssetId:String(row.application_asset_id),originalName:String(row.original_name),
    mediaType:String(row.media_type) as OriginalApplicationAssetSummary['mediaType'],byteLength:Number(row.byte_length),createdAt:String(row.created_at),updatedAt:String(row.updated_at)
  }));
  const identities=(await client.query('SELECT * FROM original_application_assets')).rows.map(row=>({
    applicationAssetId:String(row.application_asset_id),assetNumber:Number(row.asset_number),storedName:String(row.stored_name)
  } satisfies OriginalApplicationAssetIdentity));
  const counter=Number((await client.query('SELECT last_number FROM original_application_asset_counter WHERE singleton=1 FOR UPDATE')).rows[0]?.last_number);
  const prepared=prepareOriginalApplicationAssets(assets,identities,counter,replacementId);
  if(prepared.changed){
    for(const row of prepared.identities.filter(row=>!identities.some(old=>old.applicationAssetId===row.applicationAssetId&&old.assetNumber===row.assetNumber&&old.storedName===row.storedName)))await client.query('INSERT INTO original_application_assets(application_asset_id,asset_number,stored_name) VALUES($1,$2,$3) ON CONFLICT(application_asset_id) DO UPDATE SET stored_name=excluded.stored_name',[row.applicationAssetId,row.assetNumber,row.storedName]);
    await client.query('UPDATE original_application_asset_counter SET last_number=$1 WHERE singleton=1',[prepared.counter]);
  }
  return prepared.catalog;
}
