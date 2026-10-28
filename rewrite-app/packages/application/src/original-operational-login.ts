import type {OriginalMonitorProfile} from '@testcenter-rewrite-app/contracts';
import {copyOriginalMonitorProfiles} from './original-monitor-profile.js';
import type {OperationalLoginMigrationCandidate} from '@testcenter-rewrite-app/domain';

/** Private server-side identity established only by the validated Original XML import.
 * This record must never be included in the public migration-candidate response. */
export type OriginalOperationalLogin = {
  loginKey: string;
  loginMode: OperationalLoginMigrationCandidate['loginMode'];
  passwordHash: string | null;
  originalMonitorProfiles?: OriginalMonitorProfile[];
};

/** Validate before entering any store transaction; never persist caller-owned objects. */
export function prepareOriginalOperationalLogins(candidates: OperationalLoginMigrationCandidate[],
  logins: OriginalOperationalLogin[] = []): OriginalOperationalLogin[] {
  const seen = new Set<string>();
  return logins.map(login => {
    const matches = candidates.filter(candidate => candidate.loginKey === login.loginKey);
    const candidate = matches[0];
    if (matches.length !== 1 || !candidate || seen.has(login.loginKey) ||
      candidate.loginMode !== login.loginMode ||
      !['monitor-group', 'monitor-study', 'sys-check-login'].includes(login.loginMode) ||
      (login.passwordHash !== null && !/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/.test(login.passwordHash)) ||
      candidate.passwordRequired !== (login.passwordHash !== null)) {
      throw new TypeError('Invalid private Original operational login.');
    }
    seen.add(login.loginKey);
    return {loginKey: login.loginKey, loginMode: login.loginMode, passwordHash: login.passwordHash, ...(login.originalMonitorProfiles === undefined ? {} : {originalMonitorProfiles: copyOriginalMonitorProfiles(login.originalMonitorProfiles)})};
  });
}


export type OriginalOperationalDefinition = Omit<import('@testcenter-rewrite-app/domain').ParticipantRosterEntry,
  'participantRosterEntryId' | 'bookletKey' | 'executionMode' | 'importedAt' | 'displayName'> & {
  originalLoginIdentity: true;
  originalOperationalMode: 'monitor-group' | 'monitor-study';
  monitorProfiles: import('@testcenter-rewrite-app/domain').MonitorViewProfile[];
  originalMonitorProfiles?: OriginalMonitorProfile[];
  executionMode?: never;
};
export type OriginalNativeLogin = (import('@testcenter-rewrite-app/domain').ParticipantRosterEntry & {originalOperationalMode?: never}) | OriginalOperationalDefinition;
export function isOriginalOperationalLogin(login: OriginalNativeLogin): login is OriginalOperationalDefinition {
  return login.originalOperationalMode === 'monitor-group' || login.originalOperationalMode === 'monitor-study';
}

/** Only current private provenance can turn a public candidate into a native principal. */
export async function findOriginalOperationalDefinition(repository: import('./index.js').FirstSliceRepository,
  scope: {tenantId:string;workspaceId:string}, loginKey: string,
  normalizeBoundary: (value:string|null|undefined)=>string|null): Promise<{definition:OriginalOperationalDefinition;passwordHash:string|null}|null> {
  const privateRows=await repository.listOriginalOperationalLoginsByWorkspace(scope.tenantId,scope.workspaceId);
  const matches=privateRows.filter(row=>row.loginKey===loginKey);
  if(!matches.length)return null;
  if(matches.length!==1 || !['monitor-group','monitor-study'].includes(matches[0]!.loginMode))throw new TypeError('This native operational Login mode is not qualified.');
  const candidates=(await repository.listOperationalLoginMigrationCandidatesByWorkspace(scope.tenantId,scope.workspaceId)).filter(row=>row.loginKey===loginKey);
  const candidate=candidates[0];
  if(candidates.length!==1 || !candidate || !candidate.groupKey)throw new TypeError('Native operational Login definition is unavailable.');
  prepareOriginalOperationalLogins(candidates,matches);
  const validFrom=normalizeBoundary(candidate.validFrom),validTo=normalizeBoundary(candidate.validTo);
  if((candidate.validFrom&&!validFrom)||(candidate.validTo&&!validTo)||(validFrom&&validTo&&validFrom>validTo))throw new TypeError('Native operational Login validity is invalid.');
  return {passwordHash:matches[0]!.passwordHash,definition:{...candidate,...scope,originalLoginIdentity:true,
    ...(matches[0]!.originalMonitorProfiles === undefined ? {} : {originalMonitorProfiles: copyOriginalMonitorProfiles(matches[0]!.originalMonitorProfiles)}),
    originalOperationalMode:matches[0]!.loginMode as 'monitor-group'|'monitor-study',groupKey:candidate.groupKey,validFrom,validTo,
    // A missing authored ViewSettings stays absent, rather than inventing UI defaults.
    viewSettings:candidate.viewSettings??{}}};
}

/** Project current native operational modes without decoding or editing Test evidence. */
export function projectOriginalOperationalModes(scope:{tenantId:string;workspaceId:string},logins:OriginalOperationalLogin[],
  people:import('@testcenter-rewrite-app/domain').ParticipantSession[],runs:import('@testcenter-rewrite-app/domain').TestRun[]) {
  const modes=new Map(logins.map(login=>[login.loginKey,login.loginMode]));
  const ids=new Set<string>();
  const participantSessions=people.map(person=>{
    const mode=person.tenantId===scope.tenantId&&person.workspaceId===scope.workspaceId&&person.originalLoginKey!==undefined?modes.get(person.originalLoginKey):undefined;
    if(mode===undefined)return person;ids.add(person.participantSessionId);
    const result={...person,originalOperationalMode:mode};delete result.executionMode;return result;
  });
  const testRuns=runs.map(run=>{if(!ids.has(run.participantSessionId))return run;
    if(run.tenantId!==scope.tenantId||run.workspaceId!==scope.workspaceId)throw new TypeError('Native Test scope is inconsistent.');
    const result={...run};delete result.executionMode;return result;
  });
  return{participantSessions,testRuns};
}
