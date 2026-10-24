import {randomInt} from 'node:crypto';
import {defaultParticipantExecutionMode,participantExecutionModeDefinitions} from '@testcenter-rewrite-app/domain';
import type {OriginalLoginBinding,ParticipantSession} from '@testcenter-rewrite-app/domain';

const alphabet='abcdefghijklmnopqrstuvwxyz0123456789_-';
// PHP treats both the empty string and "0" as false when forming the suffix.
const prefix=(code:string|null|undefined):string=>code && code!=='0'?code:'';
export function createOriginalPersonNameSuffix(code:string|null,alwaysNew:boolean):string {
  const base=prefix(code);
  if(!alwaysNew)return base;
  const random=Array.from({length:8},()=>alphabet[randomInt(alphabet.length)]).join('');
  return base?base+'/'+random:random;
}

/** Preserve observed native person history under an ordinary parent save.
 * Missing old suffixes stay unknown; only fresh authenticated creation sets one. */
export function prepareOriginalParticipantSession(candidate:ParticipantSession,
  previous:ParticipantSession|undefined|null,binding:OriginalLoginBinding|undefined|null):ParticipantSession {
  const key=previous?.originalLoginKey??candidate.originalLoginKey;
  if(key===undefined){
    if(candidate.originalNameSuffix!==undefined)throw new TypeError('A native person suffix requires a native login identity.');
    return {...candidate};
  }
  if(previous && previous.originalLoginKey===undefined)throw new TypeError('An existing legacy person cannot acquire an inferred native identity.');
  if(previous?.originalLoginKey!==undefined && (previous.tenantId!==candidate.tenantId ||
      previous.workspaceId!==candidate.workspaceId || previous.originalLoginKey!==(candidate.originalLoginKey??key) ||
      previous.loginKey!==candidate.loginKey))throw new TypeError('Native person cannot change its login identity.');
  if(!binding || binding.tenantId!==candidate.tenantId || binding.workspaceId!==candidate.workspaceId ||
      binding.loginKey!==key || candidate.loginKey!==binding.loginKey)throw new TypeError('Native person requires its current scoped login binding.');
  let code=candidate.participantCode, suffix=candidate.originalNameSuffix;
  if(previous?.originalLoginKey!==undefined){
    if(code!==undefined && code!==(previous.participantCode??null))throw new TypeError('Native person cannot change its first stored code.');
    code=previous.participantCode;
    if(previous.originalNameSuffix===undefined){
      if(suffix!==undefined)throw new TypeError('Unknown native person suffix must stay unknown.');
    }else{
      if(suffix!==undefined && suffix!==previous.originalNameSuffix)throw new TypeError('Native person cannot change its stored suffix.');
      suffix=previous.originalNameSuffix;
    }
  }else if(suffix!==undefined){
    if(typeof suffix!=='string')throw new TypeError('Invalid native person suffix.');
    const mode=candidate.executionMode??defaultParticipantExecutionMode;
    if(!Object.hasOwn(participantExecutionModeDefinitions,mode))throw new TypeError('Invalid native person mode.');
    const alwaysNew=participantExecutionModeDefinitions[mode].alwaysNewSession;
    const base=prefix(code),randomPart=base?suffix.slice(base.length+1):suffix;
    if(alwaysNew ? !(suffix.startsWith(base?base+'/':'') && /^[a-z0-9_-]{8}$/.test(randomPart)) : suffix!==base){
      throw new TypeError('Invalid native person suffix.');
    }
  }
  const result={...candidate,originalLoginKey:key,groupKey:binding.groupKey,participantCode:code};
  if(suffix===undefined)delete result.originalNameSuffix;else result.originalNameSuffix=suffix;
  return result;
}
