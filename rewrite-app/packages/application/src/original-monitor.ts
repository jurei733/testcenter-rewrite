import {originalTestLogIdPrefix} from '@testcenter-rewrite-app/domain';
import {originalMonitorGroupSelection} from './original-monitor-session.js';
import {originalMonitorLockSelection,originalMonitorLockTestNumber} from './original-monitor-lock.js';
import type {OriginalMonitorProfile} from '@testcenter-rewrite-app/contracts';
import type {ParticipantSession} from '@testcenter-rewrite-app/domain';
import {originalMonitorProfileIdsEqual} from './original-monitor-profile.js';
import {originalParticipantGroupKeysEqual} from './original-participant-group.js';
import {parseOriginalTestName} from './original-test.js';
import {readOriginalPerson} from './original-test-access.js';
import type {OriginalAuthenticationPort} from './original-authentication.js';
import type {OriginalMonitorRepository} from './original-monitor-store.js';
import type {FirstSliceRepository} from './index.js';
import type {OriginalGroupResult} from '@testcenter-rewrite-app/contracts/original-group-results';
import {projectOriginalGroupResults} from './original-group-results.js';
import {parseOriginalWorkspaceNumber} from './original-workspace-administration.js';
import {formatOriginalMonitorSessionsJson, type OriginalMonitorActor} from './original-monitor-session.js';
import {FirstSliceError} from './first-slice-error.js';

export type OriginalMonitorPort = {
  requireMonitor(input: {token: string; groupKey?: string}): Promise<void>;
  changeLocks(input: {token: string; groupKey: string; locked: boolean; body: unknown}): Promise<void>;
  profile(input: {token: string; profileId: string}): Promise<OriginalMonitorProfile>;
  booklet(input: {token: string; bookletName: string}): Promise<string>;
  sessions(input: {token: string; groupKey?: string}): Promise<string>;
  studyResults(input: {token: string; workspacePathSegment: string; groups: string}): Promise<OriginalGroupResult[]>;
};
export function createOriginalMonitorPort(input: {auth: OriginalAuthenticationPort; repository: OriginalMonitorRepository & Pick<FirstSliceRepository,'appendOriginalTestLogs'|'findOriginalWorkspaceAdministrationScope'|'getOriginalGroupResultInventory'>; now:()=>string; id:()=>string;
  profiles: (actor: OriginalMonitorActor) => Promise<OriginalMonitorProfile[] | undefined>;
  assignedBooklets: (person: ParticipantSession) => Promise<string[]>;
  readBooklet: (scope: {tenantId: string; workspaceId: string}, name: string) => Promise<{xml: string}>;
}): OriginalMonitorPort {
  const actor = async (token: string): Promise<OriginalMonitorActor> => {
    const state = await input.auth.read({token});
    if (state.kind !== 'person' || state.participantSession.originalLoginKey === undefined ||
      !['monitor-group', 'monitor-study'].includes(state.participantSession.originalOperationalMode ?? '')) {
      throw new FirstSliceError(403, 'original_monitor_forbidden', 'A current native monitor is required.');
    }
    const person = state.participantSession;
    return {participantSessionId: person.participantSessionId, tenantId: person.tenantId, workspaceId: person.workspaceId,
      originalLoginKey: person.originalLoginKey!, groupKey: person.groupKey, mode: person.originalOperationalMode as OriginalMonitorActor['mode']};
  };
  const studyMonitor = async (token: string): Promise<OriginalMonitorActor> => {
    const monitor = await actor(token);
    if (monitor.mode !== 'monitor-study') {
      throw new FirstSliceError(403, 'original_study_monitor_forbidden', 'A current study monitor is required.');
    }
    return monitor;
  };
  return {
    async requireMonitor({token,groupKey}) {const monitor=await actor(token);if(groupKey!==undefined)originalMonitorGroupSelection(monitor,groupKey);},
    async changeLocks({token,groupKey,locked,body}) {
      const monitor=await actor(token);originalMonitorGroupSelection(monitor,groupKey);
      for(const value of originalMonitorLockSelection(body)) {
        const testNumber=originalMonitorLockTestNumber(value);
        const {scope,actorPersonNumber}=await input.repository.changeOriginalMonitorTestLock(monitor,groupKey,testNumber,locked,input.now());
        if(locked)await input.repository.appendOriginalTestLogs(scope,[{participantTestLogId:originalTestLogIdPrefix+input.id(),
          tenantId:scope.tenantId,workspaceId:scope.workspaceId,participantSessionId:scope.participantSessionId,testRunId:scope.testRunId,
          unitKey:null,originalUnitId:null,logKey:'locked by monitor',logContent:actorPersonNumber,timestamp:0,originalTimestamp:0,recordedAt:input.now()}]);
      }
    },
    async profile({token, profileId}) {
      const profiles = await input.profiles(await actor(token));
      if (profiles === undefined) throw new FirstSliceError(409, 'original_monitor_profile_history_unknown', 'The original authored profile is unavailable; import its validated Testtakers XML again.');
      const profile = profiles.find(profile => originalMonitorProfileIdsEqual(profile.id, profileId));
      if (!profile) throw new FirstSliceError(404, 'original_monitor_profile_missing', `Profile not found \`${profileId}\``);
      return structuredClone(profile);
    },
    async booklet({token, bookletName}) {
      const person = await readOriginalPerson(input.auth, token);
      const monitor = ['monitor-group', 'monitor-study'].includes(person.originalOperationalMode ?? '');
      if (!monitor && !(await input.assignedBooklets(person)).some(name => originalParticipantGroupKeysEqual(parseOriginalTestName(name).fileId, bookletName))) {
        throw new FirstSliceError(403, 'original_booklet_forbidden', 'The requested Booklet is not assigned to this person.');
      }
      return (await input.readBooklet(person, bookletName)).xml;
    },
    async sessions({token, groupKey}) {return formatOriginalMonitorSessionsJson(await input.repository.readOriginalMonitorSessions(await actor(token), groupKey));},
    async studyResults({token, workspacePathSegment, groups}) {
      const monitor = await studyMonitor(token);
      let reference: string;
      try { reference = decodeURIComponent(workspacePathSegment); }
      catch { throw new FirstSliceError(400, 'original_study_workspace_invalid', 'Invalid workspace path.'); }
      const missing = () => new FirstSliceError(404, 'original_study_workspace_not_found', 'Workspace not found.');
      const number = parseOriginalWorkspaceNumber(reference);
      if (!number) throw missing();
      const scope = await input.repository.findOriginalWorkspaceAdministrationScope(number);
      if (scope?.tenantId !== monitor.tenantId || scope.workspaceId !== monitor.workspaceId) throw missing();
      const inventory = await input.repository.getOriginalGroupResultInventory(scope.tenantId, scope.workspaceId);
      // Do not publish an inventory read under a permission that ended while it was pending.
      const currentScope = await input.repository.findOriginalWorkspaceAdministrationScope(number);
      const currentMonitor = await studyMonitor(token);
      if (currentScope?.tenantId !== scope.tenantId || currentScope.workspaceId !== scope.workspaceId ||
          currentMonitor.tenantId !== scope.tenantId || currentMonitor.workspaceId !== scope.workspaceId) {
        throw missing();
      }
      if (currentMonitor.participantSessionId !== monitor.participantSessionId) {
        throw new FirstSliceError(403, 'original_study_monitor_forbidden', 'A current study monitor is required.');
      }
      return projectOriginalGroupResults({...inventory, tenantId: scope.tenantId, workspaceId: scope.workspaceId,
        selectedGroups: groups ? groups.split(',') : undefined});
    }
  };
}
