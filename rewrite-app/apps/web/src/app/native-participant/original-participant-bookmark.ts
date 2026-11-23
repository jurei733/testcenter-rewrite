const reservedEntryNames = new Set([
  'r', 't', 'gm', 'sm', 'am', 'admin', 'superadmin', 'check',
  'home', 'workspace', 'operator-start', 'content', 'runtime', 'participant',
  'native-start', 'native-test', 'group-monitor', 'system-check', 'attachment-capture',
  'ops', 'legal-notice', 'privacy', 'accessibility'
]);
const invalidSegment = (value: string) =>
  value === '.' || value === '..' || /[\/\\?#();\x00-\x1f\x7f]/.test(value);

export function originalParticipantBookmark(hash: string): string | null {
  const login = /^#\/r\/login(?:\/([^/?#]+))?\/?$/.exec(hash);
  const direct = /^#\/([^/?#;]+)$/.exec(hash);
  try {
    if (login) {
      return login[1]
        ? '/native-start/login?' + new URLSearchParams({returnTo: decodeURIComponent(login[1])})
        : '/native-start';
    }
    if (!direct?.[1]) return null;
    const name = decodeURIComponent(direct[1]);
    if (reservedEntryNames.has(name) || invalidSegment(name)) return null;
    return '/native-start/direct?' + new URLSearchParams({name});
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
  if (/^\/r\/(?:starter|code-input|route-dispatcher)\/?$/.test(path) || /^\/r\/?$/.test(path)) {
    return '/native-start';
  }
  let destination = path;
  if (/^\/t\/[1-9]\d*(?:\/(?:status|u\/[1-9]\d*))?$/.test(path)) {
    destination = path.replace(/^\/t\//, '/native-test/');
  } else if (/^\/gm\/[^/]+(?:\/[^/]+)?$/.test(path)) {
    destination = path.replace(/^\/gm\//, '/group-monitor/');
  } else if (!/^\/(?:legal-notice|privacy|accessibility|r\/check-starter|check\/[^/]+\/[^/]+(?:\/[wnuqr])?)$/.test(path)) {
    return '/native-start';
  }
  return queryParts.length ? destination + '?' + queryParts.join('?') : destination;
}
