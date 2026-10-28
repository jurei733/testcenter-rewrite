import type {OriginalAuthenticationPort} from './original-authentication.js';
import type {OriginalMonitorRepository} from './original-monitor-store.js';
import {formatOriginalMonitorSessionsJson, type OriginalMonitorActor} from './original-monitor-session.js';
import {FirstSliceError} from './first-slice-error.js';

export type OriginalMonitorPort = {
  requireMonitor(input: {token: string}): Promise<void>;
  sessions(input: {token: string; groupKey?: string}): Promise<string>;
};
export function createOriginalMonitorPort(input: {auth: OriginalAuthenticationPort; repository: OriginalMonitorRepository}): OriginalMonitorPort {
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
  return {
    async requireMonitor({token}) {await actor(token);},
    async sessions({token, groupKey}) {return formatOriginalMonitorSessionsJson(await input.repository.readOriginalMonitorSessions(await actor(token), groupKey));}
  };
}
