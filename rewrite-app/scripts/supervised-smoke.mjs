import {spawn, execFile} from 'node:child_process';
import {mkdir, writeFile, rename, realpath} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {promisify} from 'node:util';

const execute = promisify(execFile);
const childMarker = 'TESTCENTER_SUPERVISED_SMOKE_ENTRY';
export const isSupervisedSmokeChild = url => process.env[childMarker] === url;
export function reportSmokePhase(phase) {
  if (process.connected) process.send({type: 'owned-smoke-phase', phase: String(phase).slice(0, 200)});
}
// Operation breadcrumbs are evidence, not progress: they never reset a deadline.
export function reportSmokeObservation(observation) {
  if (process.connected) process.send({type: 'owned-smoke-observation', observation: String(observation).slice(0, 200)});
}

export function signalOwnedSmokeProcess(pid, name, failures, kill = process.kill) {
  if (!Number.isSafeInteger(pid) || Math.abs(pid) <= 1) throw Error('Invalid owned smoke process ID');
  try { kill(pid, name); }
  catch (error) {
    if (error.code !== 'ESRCH') failures.push({pid, signal: name, code: String(error.code ?? 'UNKNOWN').slice(0, 40)});
  }
}

export function createSmokeEvidenceWriter(snapshot, write) {
  let pending = false, active;
  return () => {
    pending = true;
    if (!active) {
      active = Promise.resolve().then(async () => {
        while (pending) {
          pending = false;
          await write(snapshot());
        }
      }).finally(() => { active = undefined; });
    }
    return active;
  };
}

// The supervisor has its own event loop: a blocked browser evaluation, route
// cleanup or even child Node event loop cannot prevent timeout evidence.
export async function runSupervisedSmoke({entry, artifactDirectory, env = process.env,
  phaseTimeoutMs = 60_000, totalTimeoutMs = 480_000, killGraceMs = 2_000}) {
  if (process.platform === 'win32') throw Error('Owned process supervision requires POSIX process groups');
  for (const value of [phaseTimeoutMs, totalTimeoutMs, killGraceMs]) {
    if (!Number.isSafeInteger(value) || value <= 0) throw Error('Smoke deadlines must be positive integer milliseconds');
  }
  const directory = resolve(artifactDirectory);
  const actualEntry = await realpath(resolve(entry));
  await mkdir(directory, {recursive: true});
  const startedAt = Date.now(), phases = [], observations = [];
  const child = spawn(process.execPath, [actualEntry], {detached: true,
    env: {...env, [childMarker]: pathToFileURL(actualEntry).href},
    stdio: ['ignore', 'inherit', 'inherit', 'ipc']});
  const closed = new Promise((done, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => done({code, signal}));
  });
  // Record only the owned entry, phase names and process IDs, never environment,
  // credentials, request bodies or the SQLite scratch database.
  const record = {entry: actualEntry, childPid: child.pid, startedAt,
    phaseTimeoutMs, totalTimeoutMs, phases, observations, outcome: 'running'};
  let phaseTimer, totalTimer, stopping;
  // Keep one active write and one pending snapshot. A burst of child IPC must
  // not queue thousands of serialized copies while storage is slower than IPC.
  const persist = createSmokeEvidenceWriter(() => JSON.stringify(record, null, 2) + '\n', async bytes => {
    const temporary = join(directory, 'supervision.json.tmp');
    await writeFile(temporary, bytes); await rename(temporary, join(directory, 'supervision.json'));
  });
  const signalFailures = [];
  const signal = (pid, name) => signalOwnedSmokeProcess(pid, name, signalFailures);
  const processTable = async () => {
    const {stdout} = await execute('ps', ['-A', '-o', 'pid=,ppid=,lstart='], {timeout: 2000, maxBuffer: 2 * 1024 * 1024});
    return stdout.trim().split('\n').map(line => {
      const [, pid, ppid, started] = line.match(/^\s*(\d+)\s+(\d+)\s+(.+)$/) ?? [];
      if (!pid) throw Error('Cannot identify owned smoke processes');
      return {pid: Number(pid), ppid: Number(ppid), started};
    });
  };
  const stop = reason => {
    if (stopping) return stopping;
    clearTimeout(phaseTimer); clearTimeout(totalTimer);
    stopping = (async () => {
      record.outcome = reason; record.failedAt = Date.now();
      // Chromium can create a separate process group. Snapshot only descendants
      // of the child we just spawned, before terminating their parent.
      const rows = await processTable().catch(error => {
        record.processInspectionFailure = String(error.message).slice(0, 500); return [];
      });
      const owned = new Set([child.pid]);
      for (let changed = true; changed;) {
        changed = false;
        for (const {pid, ppid} of rows) if (owned.has(ppid) && !owned.has(pid)) {owned.add(pid); changed = true;}
      }
      record.ownedPids = [...owned];
      let evidenceError;
      try {await persist();} catch (error) {evidenceError = error;}
      console.error(`owned_smoke_supervision=${reason}; last_phase=${phases.at(-1)?.phase}; last_observation=${observations.at(-1)?.observation ?? 'none'}`);
      for (const pid of [...owned].reverse()) signal(pid, 'SIGTERM');
      if (child.exitCode === null && child.signalCode === null) signal(-child.pid, 'SIGTERM');
      await new Promise(done => setTimeout(done, killGraceMs));
      // Match creation time as well as PID before escalation: a recycled PID
      // must never turn an owned cleanup into a signal to an unrelated process.
      const current = await processTable();
      for (const row of rows.filter(row => owned.has(row.pid)).reverse()) {
        if (current.some(value => value.pid === row.pid && value.started === row.started)) signal(row.pid, 'SIGKILL');
      }
      if (child.exitCode === null && child.signalCode === null) signal(-child.pid, 'SIGKILL');
      // A denied signal must not prevent cleanup of the remaining owned
      // descendants or the owned group. Preserve the exact failure as evidence
      // and still fail supervision after all permitted cleanup was attempted.
      if (signalFailures.length) {
        record.signalFailures = signalFailures;
        try {await persist();} catch (error) {evidenceError ??= error;}
      }
      const cleanupErrors = signalFailures.map(failure => Error(
        `Owned smoke cleanup ${failure.signal} pid=${failure.pid}: ${failure.code}`));
      if (evidenceError) cleanupErrors.push(evidenceError);
      if (cleanupErrors.length) throw new AggregateError(cleanupErrors, 'Owned smoke cleanup failed');
    })();
    return stopping;
  };
  const phase = value => {
    if (stopping) return;
    phases.push({phase: value, at: Date.now()});
    // A malfunctioning child cannot grow diagnostic storage without bound.
    if (phases.length > 1000) phases.splice(0, phases.length - 1000);
    clearTimeout(phaseTimer);
    phaseTimer = setTimeout(() => {void stop('phase-timeout').catch(error => child.emit('error', error));}, phaseTimeoutMs);
    void persist().catch(error => child.emit('error', error));
  };
  child.on('message', message => {
    if (message?.type === 'owned-smoke-phase' && typeof message.phase === 'string') phase(message.phase.slice(0, 200));
    if (!stopping && message?.type === 'owned-smoke-observation' && typeof message.observation === 'string') {
      observations.push({observation: message.observation.slice(0, 200), at: Date.now()});
      if (observations.length > 1000) observations.splice(0, observations.length - 1000);
      void persist().catch(error => child.emit('error', error));
    }
  });
  const terminated = () => {void stop('terminated').catch(error => child.emit('error', error));};
  const interrupted = () => {void stop('interrupted').catch(error => child.emit('error', error));};
  process.once('SIGTERM', terminated); process.once('SIGINT', interrupted);
  try {
    phase('bootstrap');
    totalTimer = setTimeout(() => {void stop('total-timeout').catch(error => child.emit('error', error));}, totalTimeoutMs);
    const result = await closed;
    clearTimeout(phaseTimer); clearTimeout(totalTimer);
    if (stopping) await stopping;
    else {record.outcome = result.code === 0 ? 'passed' : 'failed'; record.exit = result;}
    record.completedAt = Date.now(); await persist();
    return stopping ? 1 : result.code ?? 1;
  } catch (error) {
    try {await stop('supervisor-error');}
    catch (cleanupError) {if(cleanupError !== error) throw new AggregateError([error, cleanupError], 'Smoke supervision and cleanup failed');}
    throw error;
  } finally {
    clearTimeout(phaseTimer); clearTimeout(totalTimer);
    process.removeListener('SIGTERM', terminated); process.removeListener('SIGINT', interrupted);
  }
}
