import type {OperationalLoginMigrationCandidate} from '@testcenter-rewrite-app/domain';

/** Private server-side identity established only by the validated Original XML import.
 * This record must never be included in the public migration-candidate response. */
export type OriginalOperationalLogin = {
  loginKey: string;
  loginMode: OperationalLoginMigrationCandidate['loginMode'];
  passwordHash: string | null;
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
    return {loginKey: login.loginKey, loginMode: login.loginMode, passwordHash: login.passwordHash};
  });
}
