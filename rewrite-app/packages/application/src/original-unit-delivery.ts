import {createHash} from 'node:crypto';
import type {ParticipantProgressDelivery} from '@testcenter-rewrite-app/domain';
import {FirstSliceError} from './first-slice-error.js';
import type {OriginalUnitScope} from './original-unit-record.js';

export type OriginalUnitDelivery=Pick<ParticipantProgressDelivery,'deliveryId'|'payloadSha256'|'acceptedAt'>;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const conflict=()=>new FirstSliceError(409,'original_delivery_conflict','An accepted native delivery cannot change its scope or payload.');
const scopeKeys=['testRunId','participantSessionId','tenantId','workspaceId','contentReleaseId'] as const;

/** Optional Rewrite durability metadata. Unadorned Original requests keep
 * their existing append/retry semantics and wire format. */
export function originalUnitDelivery(input:{id:unknown;kind:'state'|'response'|'log';scope:OriginalUnitScope;unitName:string;body:unknown;now:()=>string}):OriginalUnitDelivery|undefined{
 if(input.id===undefined)return undefined;
 if(typeof input.id!=='string'||!uuid.test(input.id))throw new FirstSliceError(400,'original_delivery_invalid','Invalid native delivery identity.');
 return {deliveryId:'native-unit-'+input.kind+':'+input.id,
  payloadSha256:createHash('sha256').update(JSON.stringify({kind:input.kind,scope:Object.fromEntries(scopeKeys.map(k=>[k,input.scope[k]])),unitName:input.unitName,body:input.body})).digest('hex'),acceptedAt:input.now()};
}

/** Called inside the same durable boundary as Unit state and logs. Returns
 * null for an exact acknowledged replay; a receipt never grants authority. */
export function prepareOriginalUnitDelivery(scope:OriginalUnitScope,delivery:OriginalUnitDelivery,previous:ParticipantProgressDelivery|undefined):ParticipantProgressDelivery|null{
 if(!/^native-unit-(?:state|response|log):/.test(delivery.deliveryId)||!uuid.test(delivery.deliveryId.slice(delivery.deliveryId.indexOf(':')+1))||
  !/^[a-f0-9]{64}$/.test(delivery.payloadSha256)||!Number.isFinite(Date.parse(delivery.acceptedAt)))throw conflict();
 if(previous){
  if(scopeKeys.some(k=>previous[k]!==scope[k])||previous.deliveryId!==delivery.deliveryId||previous.payloadSha256!==delivery.payloadSha256||
   !Number.isFinite(Date.parse(previous.acceptedAt)))throw conflict();
  return null;
 }
 return {...Object.fromEntries(scopeKeys.map(k=>[k,scope[k]])) as OriginalUnitScope,...delivery};
}
