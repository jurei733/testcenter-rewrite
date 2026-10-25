import type {OriginalLoginBinding, ParticipantRosterEntry, ParticipantSession, Workspace} from '@testcenter-rewrite-app/domain';
import type {FirstSliceRepository} from './index.js';
import type {ParticipantAccessPort} from './participant-access.js';
import {createOriginalSessionToken, hashOriginalSessionToken, OriginalSessionTokenCollisionError,
  type OriginalSessionToken} from './original-session-token.js';

export type OriginalAuthenticationPrincipal = {
  workspace: Workspace;
  rosterEntry: ParticipantRosterEntry;
  binding: OriginalLoginBinding;
};
/** Internal authentication state. The native HTTP AccessSet serializer is a separate boundary. */
export type OriginalAuthenticationState = {
  kind: 'login'; token: string; groupToken: string; codeRequired: boolean;
  login: Pick<ParticipantRosterEntry, 'loginKey' | 'groupLabel' | 'customTexts' | 'viewSettings' | 'executionMode'>;
} | {
  kind: 'person'; token: string; groupToken: string; participantSession: ParticipantSession;
  /** Immediate person response uses requested code; subsequent reads use first stored spelling. */
  requestedCode: string;
};
export type OriginalAuthenticationPort = {
  login(input: {name: string; password: string}): Promise<OriginalAuthenticationState>;
  person(input: {loginToken: string; code: string}): Promise<OriginalAuthenticationState>;
  read(input: {token: string}): Promise<OriginalAuthenticationState>;
  logout(input: {token: string}): Promise<void>;
};

export function createOriginalAuthentication(input: {
  repository: FirstSliceRepository;
  access: ParticipantAccessPort;
  authenticate: (name: string, password: string) => Promise<OriginalAuthenticationPrincipal>;
  resolve: (scope: Pick<OriginalSessionToken, 'tenantId' | 'workspaceId' | 'subjectKey'>) => Promise<OriginalAuthenticationPrincipal>;
  enter: (principal: OriginalAuthenticationPrincipal, code: string) => Promise<ParticipantSession>;
  requiresCode: (entry: ParticipantRosterEntry) => boolean;
  error: (status: number, code: string, message: string) => Error;
  now: () => string;
}): OriginalAuthenticationPort {
  const invalid = () => input.error(401, 'original_session_invalid', 'The Original session token is invalid.');
  const wrongType = () => input.error(403, 'original_session_wrong_type', 'This Original session token cannot perform that operation.');
  const digest = (token: string) => {
    if (typeof token !== 'string' || !token || token.length > 256) throw invalid();
    return hashOriginalSessionToken(token);
  };
  const capability = async (principal: OriginalAuthenticationPrincipal, kind: 'login' | 'group') => {
    for (let attempt = 0; attempt < 32; attempt++) {
      try {
        const token = await input.repository.getOrCreateOriginalSessionToken({
          tenantId: principal.workspace.tenantId, workspaceId: principal.workspace.workspaceId, kind,
          subjectKey: kind === 'login' ? principal.binding.loginKey : principal.binding.groupSnapshotKey,
          token: createOriginalSessionToken(), createdAt: input.now()
        });
        if (!token) throw input.error(409, 'original_login_scope_changed', 'The Original login scope changed during authentication.');
        return token.token;
      } catch (error) {
        if (!(error instanceof OriginalSessionTokenCollisionError)) throw error;
      }
    }
    throw input.error(503, 'original_session_token_exhausted', 'Could not allocate an Original session token.');
  };
  const principalFromLogin = async (token: string) => {
    const hash = digest(token);
    const stored = await input.repository.findOriginalSessionTokenByHash(hash);
    if (stored?.kind === 'login') return input.resolve(stored);
    if (stored || await input.repository.findParticipantSessionByAccessTokenHash(hash) ||
      await input.repository.getAdminSessionByToken(token)) throw wrongType();
    throw invalid();
  };
  const loginState = async (principal: OriginalAuthenticationPrincipal, token: string): Promise<OriginalAuthenticationState> => ({
    kind: 'login', token, groupToken: await capability(principal, 'group'),
    codeRequired: input.requiresCode(principal.rosterEntry),
    login: {loginKey: principal.rosterEntry.loginKey, groupLabel: principal.rosterEntry.groupLabel,
      customTexts: principal.rosterEntry.customTexts, viewSettings: principal.rosterEntry.viewSettings,
      executionMode: principal.rosterEntry.executionMode}
  });
  const enter = async (principal: OriginalAuthenticationPrincipal, code: string): Promise<OriginalAuthenticationState> => {
    if (typeof code !== 'string') throw input.error(400, 'participant_code_invalid', 'The participant code is invalid.');
    const person = await input.enter(principal, code);
    const token = await input.access.issueCredential({participantSessionId: person.participantSessionId, format: 'original'});
    return {kind: 'person', token, groupToken: await capability(principal, 'group'), participantSession: person, requestedCode: code};
  };
  const personFromToken = async (token: string): Promise<{person: ParticipantSession; principal: OriginalAuthenticationPrincipal}> => {
    const person = await input.repository.findParticipantSessionByAccessTokenHash(digest(token));
    if (!person || person.originalLoginKey === undefined) {
      if (await input.repository.findOriginalSessionTokenByHash(digest(token)) ||
        await input.repository.getAdminSessionByToken(token)) throw wrongType();
      throw invalid();
    }
    const principal = await input.resolve({tenantId: person.tenantId, workspaceId: person.workspaceId, subjectKey: person.originalLoginKey});
    const authorized = await input.access.authorize({participantSessionId: person.participantSessionId, sessionToken: token});
    return {person: authorized, principal};
  };
  return {
    async login({name, password}) {
      const principal = await input.authenticate(name, password);
      const token = await capability(principal, 'login');
      return input.requiresCode(principal.rosterEntry) ? loginState(principal, token) : enter(principal, '');
    },
    async person({loginToken, code}) { return enter(await principalFromLogin(loginToken), code); },
    async read({token}) {
      const stored = await input.repository.findOriginalSessionTokenByHash(digest(token));
      if (stored?.kind === 'login') return loginState(await input.resolve(stored), token);
      if (stored) throw wrongType();
      const {person, principal} = await personFromToken(token);
      return {kind: 'person', token, groupToken: await capability(principal, 'group'), participantSession: person, requestedCode: person.participantCode ?? ''};
    },
    async logout({token}) {
      const stored = await input.repository.findOriginalSessionTokenByHash(digest(token));
      if (stored?.kind === 'login') { await input.resolve(stored); return; }
      if (stored) throw wrongType();
      const {person} = await personFromToken(token);
      await input.access.revoke({participantSessionId: person.participantSessionId, sessionToken: token});
    }
  };
}
