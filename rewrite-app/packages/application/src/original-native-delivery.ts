import {createHash} from 'node:crypto';
import type {ParticipantProgressDelivery} from '@testcenter-rewrite-app/domain';
import {FirstSliceError} from './first-slice-error.js';
import type {OriginalUnitScope} from './original-unit-record.js';
import type {OriginalTestNumberRecord} from './original-test-number.js';

export type OriginalNativeDelivery=Pick<ParticipantProgressDelivery,'deliveryId'|'payloadSha256'|'acceptedAt'>;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const keys=['testRunId','participantSessionId','tenantId','workspaceId','contentReleaseId'] as const;
const conflict=()=>new FirstSliceError(409,'original_delivery_conflict','An accepted native delivery cannot change its scope or payload.');

/** Hash parsed, Source-coded entries, not PhpNumber/PhpObject containers.
 * Those containers retain BigInt and Map values and cannot be JSON.stringify'd.
 * Encoded log content and originalClientTimestamp retain their exact semantics. */
export function originalTestDelivery(input:{id:unknown;kind:'state'|'log';scope:OriginalTestNumberRecord;entries:unknown;now:()=>string}):OriginalNativeDelivery|undefined{
 if(input.id===undefined)return undefined;
 if(typeof input.id!=='string'||!uuid.test(input.id))throw new FirstSliceError(400,'original_delivery_invalid','Invalid native delivery identity.');
 return{deliveryId:'native-test-'+input.kind+':'+input.id,payloadSha256:createHash('sha256').update(JSON.stringify({kind:input.kind,scope:Object.fromEntries(keys.map(k=>[k,input.scope[k]])),testNumber:input.scope.testNumber,entries:input.entries})).digest('hex'),acceptedAt:input.now()};
}

/** Called inside the artifact transaction after current parent ownership.
 * Unit callers retain their original namespace and fingerprint unchanged. */
export function prepareOriginalNativeDelivery(scope:OriginalUnitScope,delivery:OriginalNativeDelivery,previous:ParticipantProgressDelivery|undefined,family:'unit'|'test'):ParticipantProgressDelivery|null{
 const prefix=family==='unit'?/^native-unit-(?:state|response|log):/:/^native-test-(?:state|log):/;
 if(!prefix.test(delivery.deliveryId)||!uuid.test(delivery.deliveryId.slice(delivery.deliveryId.indexOf(':')+1))||!/^[a-f0-9]{64}$/.test(delivery.payloadSha256)||!Number.isFinite(Date.parse(delivery.acceptedAt)))throw conflict();
 if(previous){
  if(keys.some(k=>previous[k]!==scope[k])||previous.deliveryId!==delivery.deliveryId||previous.payloadSha256!==delivery.payloadSha256||!Number.isFinite(Date.parse(previous.acceptedAt)))throw conflict();
  return null;
 }
 return{...Object.fromEntries(keys.map(k=>[k,scope[k]])) as OriginalUnitScope,...delivery};
}
