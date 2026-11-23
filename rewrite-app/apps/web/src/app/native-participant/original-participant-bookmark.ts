const reservedEntryNames = new Set([
  'r', 't', 'gm', 'sm', 'am', 'admin', 'superadmin', 'check',
  'home', 'workspace', 'operator-start', 'content', 'runtime', 'participant',
  'native-start', 'native-test', 'native-info', 'group-monitor', 'study-monitor', 'system-check', 'attachment-capture',
  'ops', 'legal-notice', 'privacy', 'accessibility'
]);
const originalAdminLoginPath = '/ops?ui=original&legacyLogin=1';
const originalRootDestinations = new Map([
  ['', '/native-start/dispatch'],
  ['r', '/native-start/dispatch'],
  ['r/route-dispatcher', '/native-start/dispatch'],
  ['r/code-input', '/native-start/dispatch'],
  ['r/starter', '/native-start/starter'],
  ['r/login', '/native-start/login'],
  ['r/admin-login', originalAdminLoginPath],
  ['r/check-starter', '/r/check-starter'],
  ['legal-notice', '/native-info/legal-notice'],
  ['privacy', '/native-info/privacy'],
  ['accessibility', '/native-info/accessibility'],
]);
const invalidSegment = (value: string) =>
  value === '.' || value === '..' || /[\/\\?#();\x00-\x1f\x7f]/.test(value);
export const legacyBookmarkQueryKey = 'legacyBookmark';

function protectedDestination(path: string): string | null {
  if (path === '/t/status') return '/native-test/status';
  const study = /^\/sm\/0*([1-9]\d*)$/.exec(path);
  if (study) return '/study-monitor/' + study[1];
  if (/^\/t\/[1-9]\d*(?:\/(?:status|u\/[1-9]\d*))?$/.test(path)) {
    return path.replace(/^\/t\//, '/native-test/');
  }
  if (/^\/gm\/[^/]+(?:\/[^/]+)?$/.test(path)) {
    return path.replace(/^\/gm\//, '/group-monitor/');
  }
  return null;
}

function originalSystemCheckBookmark(path: string): string | null {
  const match = /^\/check\/0*([1-9]\d*)\/([^/]+)(?:\/([wnuqr]))?$/.exec(path);
  if (!match) return null;
  const [, workspace, check, step = 'w'] = match;
  // The Original guards later steps until the current document has loaded a check.
  return step === 'w' ? `/check/${workspace}/${check}/w` : '/native-start/dispatch';
}

export function originalParticipantBookmark(hash: string): string | null {
  const path = hash.split('?', 1)[0];
  const login = /^#\/r\/login(?:\/([^/?#]+))?\/?$/.exec(hash);
  const direct = /^#\/([^/?#;]+)$/.exec(hash);
  try {
    if (path?.startsWith('#/')) {
      const segments = path.slice(2).replace(/([^/])\/$/, '$1').split('/').map(decodeURIComponent);
      if (segments.every(segment => !invalidSegment(segment))) {
        const destination = originalRootDestinations.get(segments.join('/'));
        if (destination) return destination;
        const encodedPath = '/' + segments.map(encodeURIComponent).join('/');
        const check = originalSystemCheckBookmark(encodedPath);
        if (check) return check;
        const operatorBookmark = /^\/(?:admin\/[^/]+|superadmin)(?:\/[^/]+)*$/.test(encodedPath);
        const protectedPath = operatorBookmark ? encodedPath : protectedDestination(encodedPath);
        if (protectedPath) return protectedPath + '?' + new URLSearchParams({[legacyBookmarkQueryKey]: '1'});
      }
    }
    if (login) {
      return login[1]
        ? '/native-start/login?' + new URLSearchParams({returnTo: decodeURIComponent(login[1])})
        : '/native-start/login';
    }
    if (!direct?.[1]) return null;
    const name = decodeURIComponent(direct[1]);
    if (reservedEntryNames.has(name) || invalidSegment(name)) return null;
    return '/native-start/direct?' + new URLSearchParams({name});
  } catch {
    return null;
  }
}

export function originalMissingRouteBookmark(hash: string): string | null {
  const nested = /^#\/([^/?#]+)\/([^/?#]+)/.exec(hash);
  if (!nested) return null;
  try {
    const first = decodeURIComponent(nested[1]!);
    const second = decodeURIComponent(nested[2]!);
    if (reservedEntryNames.has(first) && (first !== 'r' || originalRootDestinations.has('r/' + second))) return null;
    return '/native-start/not-found?' + new URLSearchParams({path: hash.slice(1)});
  } catch {
    return null;
  }
}

export function originalParticipantReturnPath(target: string): string {
  const [path, ...queryParts] = target.split('?');
  if (!path?.startsWith('/')) return '/native-start';
  try {
    if (path.split('/').some(segment => invalidSegment(decodeURIComponent(segment)))) return '/native-start';
  } catch {
    return '/native-start';
  }
  const root = originalRootDestinations.get(path.slice(1).replace(/([^/])\/$/, '$1'));
  if (root && root !== '/r/check-starter') return root;
  const protectedPath = protectedDestination(path);
  if (!protectedPath && !/^\/(?:r\/check-starter|check\/[^/]+\/[^/]+(?:\/[wnuqr])?)$/.test(path)) {
    return '/native-start';
  }
  const destination = protectedPath ?? path;
  return queryParts.length ? destination + '?' + queryParts.join('?') : destination;
}

export function isExplicitOriginalAdminLogin(url: string): boolean {
  const [path, query] = url.split('?', 2);
  return path === '/ops' && new URLSearchParams(query).get('legacyLogin') === '1';
}
