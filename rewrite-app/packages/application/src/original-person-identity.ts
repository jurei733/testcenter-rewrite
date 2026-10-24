import {randomInt} from 'node:crypto';
import {defaultParticipantExecutionMode,participantExecutionModeDefinitions} from '@testcenter-rewrite-app/domain';
import type {OriginalLoginBinding,ParticipantSession,TestRun} from '@testcenter-rewrite-app/domain';
import {originalParticipantGroupKeysEqual} from './original-participant-group.js';

export type OriginalPersonResolution = {participantSession:ParticipantSession;created:boolean};
export class OriginalPersonIdentityConflictError extends Error {}

/** Login mode is current authorization metadata, not a saved Test-state edit. */
export function projectOriginalPersonSessions(person:ParticipantSession,people:ParticipantSession[]):ParticipantSession[] {
  let found=false;
  const projected=people.map(other=>{
    if(other.participantSessionId===person.participantSessionId)found=true;
    if(!sameLogin(person,other))return other;
    if(other.groupKey===person.groupKey && other.executionMode===person.executionMode)return other;
    return {...other,groupKey:person.groupKey,executionMode:person.executionMode};
  });
  if(!found)projected.push(person);
  return projected;
}

export function projectOriginalPersonRuns(person:ParticipantSession,runs:TestRun[],people:ParticipantSession[]=[person]):TestRun[] {
  const ids=new Set(people.filter(other=>sameLogin(person,other)).map(other=>other.participantSessionId));ids.add(person.participantSessionId);
  return runs.map(run=>{
    if(!ids.has(run.participantSessionId))return run;
    if(run.tenantId!==person.tenantId || run.workspaceId!==person.workspaceId)throw new OriginalPersonIdentityConflictError('Native person has an inconsistent Test scope.');
    return run.executionMode===person.executionMode?run:{...run,executionMode:person.executionMode};
  });
}

const sameLogin=(left:ParticipantSession,right:ParticipantSession):boolean=>left.tenantId===right.tenantId &&
  left.workspaceId===right.workspaceId && left.originalLoginKey!==undefined && left.originalLoginKey===right.originalLoginKey;

/** Call under the store's workspace/writer lock, including ordinary parent saves. */
export function assertOriginalPersonUnique(person:ParticipantSession,people:ParticipantSession[]):void {
  if(person.originalLoginKey===undefined || person.originalNameSuffix===undefined)return;
  if(people.some(other=>other.participantSessionId!==person.participantSessionId && sameLogin(person,other) &&
      other.originalNameSuffix!==undefined && originalParticipantGroupKeysEqual(person.originalNameSuffix!,other.originalNameSuffix))){
    throw new OriginalPersonIdentityConflictError('Native person suffix already belongs to another person.');
  }
}

/** Resolve Source's Login + german2_ci suffix identity inside one durable write.
 * Unknown historical suffixes retain the preceding compatibility lookup only;
 * they must never acquire an inferred suffix or mask a known native identity. */
export function resolveOriginalPerson(candidate:ParticipantSession,binding:OriginalLoginBinding|undefined|null,
  people:ParticipantSession[],validate?:(person:Readonly<ParticipantSession>)=>void):OriginalPersonResolution {
  let fresh=prepareOriginalParticipantSession(candidate,null,binding);
  if(fresh.originalLoginKey===undefined || fresh.originalNameSuffix===undefined)throw new TypeError('Native person resolution requires a known native suffix.');
  const sameId=people.find(person=>person.participantSessionId===fresh.participantSessionId);
  if(sameId)throw new OriginalPersonIdentityConflictError('New native person ID already belongs to a stored person.');
  const mode=participantExecutionModeDefinitions[fresh.executionMode??defaultParticipantExecutionMode];
  const linked=people.filter(person=>sameLogin(fresh,person));
  const matches=linked.filter(person=>person.originalNameSuffix!==undefined && originalParticipantGroupKeysEqual(person.originalNameSuffix,fresh.originalNameSuffix!));
  if(matches.length>1)throw new OriginalPersonIdentityConflictError('Native person history contains ambiguous suffix identities.');
  if(!mode.alwaysNewSession){
    const legacyCode=(code:string|null|undefined)=>String(code??'').trim().replace(/[A-Z]/g,letter=>letter.toLowerCase());
    const existing=matches[0]??linked.filter(person=>person.originalNameSuffix===undefined &&
      legacyCode(person.participantCode)===legacyCode(fresh.participantCode) && person.contentReleaseId===fresh.contentReleaseId &&
      (person.executionMode??defaultParticipantExecutionMode)===(fresh.executionMode??defaultParticipantExecutionMode) && person.status!=='closed')
      .sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];
    if(existing){
      validate?.(structuredClone(existing));
      return {participantSession:{...existing,groupKey:binding!.groupKey,executionMode:fresh.executionMode},created:false};
    }
  }else if(matches.length){
    // A random collision creates another person, never an alias of the winner.
    let allocated=false;
    for(let attempt=0;attempt<32;attempt++){
      fresh={...fresh,originalNameSuffix:createOriginalPersonNameSuffix(fresh.participantCode??null,true)};
      if(!linked.some(person=>person.originalNameSuffix!==undefined && originalParticipantGroupKeysEqual(person.originalNameSuffix,fresh.originalNameSuffix!))){allocated=true;break;}
    }
    if(!allocated)throw new OriginalPersonIdentityConflictError('Unable to allocate a fresh native person suffix.');
  }
  validate?.(structuredClone(fresh));return {participantSession:fresh,created:true};
}

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
  const result={...candidate,...(previous?.originalLoginKey===undefined?{}:{executionMode:previous.executionMode}),
    originalLoginKey:key,groupKey:binding.groupKey,participantCode:code};
  if(suffix===undefined)delete result.originalNameSuffix;else result.originalNameSuffix=suffix;
  return result;
}
