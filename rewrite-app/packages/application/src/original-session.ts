import {originalParticipantGroupKeysEqual} from './original-participant-group.js';
import type {ParticipantBookletAssignment, ParticipantRosterEntry, TestRun} from '@testcenter-rewrite-app/domain';
import type {FirstSliceRepository} from './index.js';
import type {OriginalAuthenticationPort, OriginalAuthenticationState} from './original-authentication.js';
import {FirstSliceError} from './first-slice-error.js';
import {isOriginalOperationalLogin,type OriginalOperationalDefinition} from './original-operational-login.js';
import {originalPersonAlwaysNew} from './original-person-identity.js';
import {hashOriginalSessionToken} from './original-session-token.js';

import type {OriginalAccessSet, OriginalTestAccess} from '@testcenter-rewrite-app/contracts/original-session';
export type {OriginalAccessSet} from '@testcenter-rewrite-app/contracts/original-session';
export type OriginalSessionTest = Pick<TestRun, 'testRunId' | 'participantSessionId' | 'tenantId' | 'workspaceId' |
  'contentReleaseId' | 'bookletKey' | 'bookletAssignmentKey' | 'locked'> & {lastOpenedAt?: string | null};
export function projectOriginalSessionTest(run: Pick<TestRun, 'testRunId' | 'participantSessionId' | 'tenantId' | 'workspaceId' |
  'contentReleaseId' | 'bookletKey' | 'bookletAssignmentKey' | 'locked' | 'originalResultState'>): OriginalSessionTest {
  const result: OriginalSessionTest = {testRunId: run.testRunId, participantSessionId: run.participantSessionId,
    tenantId: run.tenantId, workspaceId: run.workspaceId, contentReleaseId: run.contentReleaseId, bookletKey: run.bookletKey,
    ...(run.bookletAssignmentKey === undefined ? {} : {bookletAssignmentKey: run.bookletAssignmentKey}), locked: run.locked === true};
  const opened = run.originalResultState?.lastOpenedAt;
  if (opened !== undefined) {
    if (opened !== null && (typeof opened !== 'string' || !Number.isFinite(Date.parse(opened)))) throw Error('Invalid persisted Original Test opening time.');
    result.lastOpenedAt = opened;
  }
  return result;
}
export type OriginalSessionPort = {
  login(input: {name: string; password: string}): Promise<OriginalAccessSet>;
  person(input: {loginToken: string; code: string}): Promise<OriginalAccessSet>;
  read(input: {token: string}): Promise<OriginalAccessSet>;
  logout(input: {token: string}): Promise<void>;
  requireLogin(input: {token: string}): Promise<void>;
};

/** Participant-native AccessSet boundary. No release activation, Test creation,
 * password replay, guessed ownership, or private session IDs enter its reads. */
export function createOriginalSessionPort(input: {
  auth: OriginalAuthenticationPort; repository: FirstSliceRepository;
  assignments: (entry: ParticipantRosterEntry, code: string) => ParticipantBookletAssignment[];
  operational: (scope:{tenantId:string;workspaceId:string},loginKey:string)=>Promise<OriginalOperationalDefinition|null>;
  monitorAssignments: (entry:OriginalOperationalDefinition)=>Promise<ParticipantBookletAssignment[]>;
  bookletLabels: (scope: {tenantId: string; workspaceId: string}) => Promise<Map<string, string>>;
}): OriginalSessionPort {
  const format = async (state: OriginalAuthenticationState, immediate: boolean): Promise<OriginalAccessSet> => {
    const person = state.kind === 'person' ? state.participantSession : null;
    const operational=person?await input.operational(person,person.originalLoginKey!):null;
    const entry = operational ?? (person ? (await input.repository.listParticipantRosterEntriesByWorkspace(person.tenantId, person.workspaceId))
      .find(row => row.originalLoginIdentity === true && row.loginKey === person.originalLoginKey) : null);
    if (person && !entry) throw new FirstSliceError(410, 'original_login_gone', 'The Original login is no longer available.');
    const login = state.kind === 'login' ? state.login : entry!;
    let groupLabel = login.groupLabel ?? '';
    if (person && !immediate) {
      // Source's immediate Login/person response uses current Login metadata;
      // GET /session for a person uses its credential-stage group's first label.
      // Resolve that exact snapshot through the already authenticated group's
      // capability, so a later binding change cannot mix its label and token.
      const groupToken = await input.repository.findOriginalSessionTokenByHash(hashOriginalSessionToken(state.groupToken));
      const group = groupToken?.kind === 'group' && groupToken.tenantId === person.tenantId && groupToken.workspaceId === person.workspaceId
        ? (await input.repository.listOriginalParticipantGroupsByWorkspace(person.tenantId, person.workspaceId)).find(row => row.groupKey === groupToken.subjectKey) : undefined;
      if (!group) throw new FirstSliceError(409, 'original_group_history_unavailable', 'The Original group snapshot is unavailable.');
      groupLabel = group.groupLabel;
    }
    let suffix = '';
    if (person) {
      if (person.originalNameSuffix === undefined) throw new FirstSliceError(409, 'original_person_history_unknown', 'The Original person identity is unavailable.');
      suffix = !immediate || originalPersonAlwaysNew({...person,executionMode:login.executionMode,originalOperationalMode:'originalOperationalMode' in login?login.originalOperationalMode:undefined})
        ? person.originalNameSuffix : state.kind === 'person' && state.requestedCode && state.requestedCode !== '0' ? state.requestedCode : '';
    }
    const result: OriginalAccessSet = {token: state.token, displayName: `${groupLabel}/${login.loginKey}${suffix ? '/' + suffix : ''}`,
      loginName: login.loginKey, groupLabel, id: null, pwSetByAdmin: null, customTexts: structuredClone(login.customTexts ?? {}),
      flags: state.kind === 'login' && state.codeRequired ? ['codeRequired'] : [], claims: {}, groupToken: state.groupToken,
      viewSettings: Object.keys(login.viewSettings ?? {}).length ? structuredClone(login.viewSettings!) : [], access: {}};
    if (state.kind === 'login') return result;
    const assignments = isOriginalOperationalLogin(entry!) ? await input.monitorAssignments(entry!) : input.assignments(entry!, state.requestedCode);
    if (assignments.length) {
      const [labels, runs] = await Promise.all([input.bookletLabels(person!), input.repository.listOriginalSessionTestFlags(person!.participantSessionId)]);
      const claims: OriginalTestAccess[] = [];
      for (const assignment of assignments) {
        const fileId = assignment.bookletKey.replace(/[a-z]/g, letter => letter.toUpperCase());
        const label = labels.get(fileId);
        if (label === undefined) throw new FirstSliceError(409, 'original_booklet_unavailable', 'An assigned Booklet is unavailable.');
        const owned = runs.filter(run => run.participantSessionId === person!.participantSessionId && run.tenantId === person!.tenantId &&
          run.workspaceId === person!.workspaceId && run.contentReleaseId === person!.contentReleaseId &&
          originalParticipantGroupKeysEqual(run.bookletAssignmentKey ?? run.bookletKey, assignment.assignmentKey));
        if (owned.length > 1) throw new FirstSliceError(409, 'original_test_history_ambiguous', 'The Original Test identity is ambiguous.');
        const run = owned[0];
        if (run && run.lastOpenedAt === undefined) throw new FirstSliceError(409, 'original_test_history_unknown', 'The Original Test opening state is unavailable.');
        claims.push({id: assignment.assignmentKey, type: 'test', label,
          flags: {locked: run?.locked === true, running: Boolean(run?.lastOpenedAt)}});
      }
      result.claims.test = claims; result.access.test = claims.map(claim => claim.id);
    }
    if (isOriginalOperationalLogin(entry!)) {
      result.claims.testGroupMonitor=[{id:entry!.groupKey,type:'testGroupMonitor',label:entry!.groupLabel??entry!.groupKey,flags:[]}];
      result.access.testGroupMonitor=[entry!.groupKey];
    }
    if (entry!.executionMode === 'run-review') { result.claims.review = []; result.access.review = []; }
    return result;
  };
  return {
    login: async request => format(await input.auth.login(request), true),
    person: async request => format(await input.auth.person(request), true),
    read: async request => format(await input.auth.read(request), false),
    logout: request => input.auth.logout(request),
    async requireLogin(request) {
      if ((await input.auth.read(request)).kind !== 'login') throw new FirstSliceError(403, 'original_session_wrong_type', 'A Login token is required.');
    }
  };
}
