import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runSupervisedSmoke} from './supervised-smoke.mjs';

const names = new Set(['original-timer-reference', 'participant-controller-timer']);
export function createTimerSmokeConfiguration({entry, name, artifactRoot, env = process.env}) {
  if (!names.has(name)) throw Error('Unknown owned timer smoke entry.');
  if (typeof artifactRoot !== 'string' || !artifactRoot.trim()) throw Error('Timer evidence requires an owned directory.');
  const directory = resolve(artifactRoot);
  return {entry: fileURLToPath(entry), artifactDirectory: join(directory, name),
    env: {...env, UI_SMOKE_CONTROLLER_TIMER_ARTIFACT_ROOT: directory},
    phaseTimeoutMs: 60_000, totalTimeoutMs: 480_000};
}
export async function superviseTimerSmoke(entry, name) {
  const artifactRoot = process.env.UI_SMOKE_CONTROLLER_TIMER_ARTIFACT_ROOT?.trim()
    || await mkdtemp(join(tmpdir(), 'owned-timer-supervision-'));
  return runSupervisedSmoke(createTimerSmokeConfiguration({entry, name, artifactRoot}));
}
