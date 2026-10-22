import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const mirrors = [
  'https://archive.ubuntu.com/ubuntu/',
  'https://security.ubuntu.com/ubuntu/',
  'http://azure.archive.ubuntu.com/ubuntu/'
];

// The pinned runner already uses these three signed Ubuntu archives. Prefer
// its existing HTTPS archive rather than waiting on a slowly streaming Azure
// package. Retain both fallbacks and all APT signature/transport verification.
export function preferOfficialUbuntuArchive(source) {
  const entries = source.split(/\r?\n/).filter(line => line.trim() && !line.trimStart().startsWith('#'))
    .map(line => line.trim().split(/\s+/));
  if (entries.length !== mirrors.length || new Set(entries.map(row => row[0])).size !== mirrors.length ||
      entries.some(row => !mirrors.includes(row[0]) || row.length !== 2 || !/^priority:[1-3]$/.test(row[1]))) {
    throw Error('Unexpected runner APT mirror profile; no package source was changed.');
  }
  return mirrors.map((uri, i) => `${uri}\tpriority:${i + 1}\n`).join('');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { process.stdout.write(preferOfficialUbuntuArchive(readFileSync('/etc/apt/apt-mirrors.txt', 'utf8'))); }
  catch { console.error('Runner APT mirror preference could not be prepared.'); process.exitCode = 1; }
}
