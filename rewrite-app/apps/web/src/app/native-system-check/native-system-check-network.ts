import type {SystemCheckReportEntry, SystemCheckSpeedParameters} from '@testcenter-rewrite-app/domain';

// Adapted from pinned IQB Testcenter19 Syscheck network-check/BackendService
// (MIT, assets/ORIGINAL-UI-LICENSE.txt). Keep its raw XML sizes, empty-sequence
// arithmetic, failed-request durations and report semantics at the native edge.
export type NativeNetworkSpeed = Omit<SystemCheckSpeedParameters, 'sequenceSizes'> & {sequenceSizes: string[] | 0};
export type NativeNetworkConfig = {downloadSpeed: NativeNetworkSpeed; uploadSpeed: NativeNetworkSpeed};
type Direction = 'download' | 'upload';
type Rating = 'good' | 'ok' | 'insufficient' | 'unstable';
export type NativeNetworkMeasurement = {size: string; duration: number; error: string | null};
export type NativeNetworkProgress = {message: string; direction?: Direction; average?: number; points?: [number, number][]};
export type NativeNetworkConnection = {rtt?: number; effectiveType?: string; type?: string; downlink?: number};

export function nativeNetworkBytes(input: number | string, bits = false): string {
  const value = bits ? Number(input) * 8 : input;
  const index = Math.floor(Math.log(Number(value)) / Math.log(1000));
  return !value && '0' || (Number(value) / 1000 ** index).toFixed(2) + ' ' + (bits ? ['bit', 'kbit', 'Mbit', 'Gbit', 'Tbit'] : ['B', 'kB', 'MB', 'GB', 'TB'])[index];
}

const timestamp = () => performance.timeOrigin + performance.now();
export async function benchmarkNativeNetwork(direction: Direction, size: string, signal: AbortSignal): Promise<NativeNetworkMeasurement> {
  signal.throwIfAborted();
  const result: NativeNetworkMeasurement = {size, duration: direction === 'download' ? 5000 : 10000, error: null};
  const bytes = Number(size);
  if (direction === 'upload' && (!Number.isFinite(bytes) || bytes < 0 || bytes > 64 * 1024 * 1024)) {
    return {...result, error: 'Unsupported upload package size.'};
  }
  const controller = new AbortController();
  const timeoutMs = direction === 'download' ? 45000 : 10000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const started = timestamp();
  try {
    // Keep Source's observable XHR results with the existing no-cookie,
    // no-redirect fetch transport and the route/person cancellation scope.
    const response = await fetch(direction === 'download'
      ? `/speed-test/random-package/${encodeURIComponent(size)}&uid=${Date.now()}` : '/speed-test/random-package', {
      method: direction === 'download' ? 'GET' : 'POST', credentials: 'omit', redirect: 'error', cache: 'no-store',
      headers: {'Content-Type': direction === 'download' ? 'application/json' : 'text/plain'},
      ...(direction === 'upload' ? {body: 'a'.repeat(Math.floor(bytes))} : {}), signal: AbortSignal.any([signal, controller.signal])
    });
    const text = await response.text();
    signal.throwIfAborted();
    if (response.status !== 200) result.error = `Error ${response.statusText} (${response.status}) `;
    result.duration = timestamp() - started;
    if (direction === 'download') {
      if (text.length !== bytes) result.error = 'Error: Data package has wrong size!';
    } else {
      try { if (parseFloat(JSON.parse(text).packageReceivedSize) !== bytes) result.error = 'Error: Data package has wrong size!'; }
      catch { result.error = 'bogus server response'; }
    }
  } catch {
    signal.throwIfAborted();
    if (controller.signal.aborted) {result.duration = timeoutMs; result.error = 'timeout';}
    else result.error = 'Network Error';
  } finally { clearTimeout(timeout); }
  return result;
}

export async function runNativeNetwork(config: NativeNetworkConfig, signal: AbortSignal,
  progress: (value: NativeNetworkProgress) => void, connection?: NativeNetworkConnection,
  benchmark = benchmarkNativeNetwork): Promise<{rating: Rating; entries: SystemCheckReportEntry[]}> {
  signal.throwIfAborted();
  // Source prepares BOTH charts before starting its promise chain. A scalar0
  // must keep the real TypeError/dialog boundary, rather than inventing a pass.
  for (const parameters of [config.downloadSpeed, config.uploadSpeed]) {
    Math.max(...parameters.sequenceSizes as unknown as number[]);
  }
  const stats: Record<Direction, number[]> = {download: [], upload: []};
  const average = (direction: Direction) => stats[direction].reduce((sum, value) => sum + value, 0) / stats[direction].length;
  const loop = async (direction: Direction) => {
    const definition = direction === 'download' ? config.downloadSpeed : config.uploadSpeed;
    while (true) {
      signal.throwIfAborted();
      const sequence: NativeNetworkMeasurement[] = [];
      const round = stats[direction].length + 1;
      for (const size of definition.sequenceSizes as string[]) {
        signal.throwIfAborted();
        progress({message: `${direction === 'download' ? 'Downloadgeschwindigkeit' : 'Uploadgeschwindigkeit'} Testrunde ${round} - Testgröße: ${nativeNetworkBytes(size)}${direction === 'download' ? ' bytes' : ')'}`});
        sequence.push(await benchmark(direction, size, signal));
      }
      signal.throwIfAborted();
      const sequenceAverage = sequence.reduce((sum, measurement) => sum + Number(measurement.size) / (measurement.duration / 1000), 0) / sequence.length;
      const previous = average(direction);
      stats[direction].push(sequenceAverage);
      progress({message: '', direction, average: average(direction), points: sequence.filter(value => value.error === null).map(value => [Number(value.size), value.duration])});
      if (sequence.filter(value => value.error !== null).length > definition.maxErrorsPerSequence) return false;
      // Keep the existing15-round client budget while retaining Source's
      // length>configuredMaximum final repetition and stability comparisons.
      if (stats[direction].length > definition.maxSequenceRepetitions || stats[direction].length >= 15) return true;
      if (stats[direction].length >= 3 && !(Math.abs(previous - sequenceAverage) > definition.maxDevianceBytesPerSecond)) return true;
    }
  };
  const stable = await loop('download') && await loop('upload');
  signal.throwIfAborted();
  const rate = (value: number, definition: NativeNetworkSpeed): Rating => {
    let rating: Rating = 'good';
    if (value < definition.good) rating = 'ok';
    if (value < definition.min) rating = 'insufficient';
    return rating;
  };
  const download = stable ? rate(average('download'), config.downloadSpeed) : 'unstable';
  const upload = stable ? rate(average('upload'), config.uploadSpeed) : 'unstable';
  const rating: Rating = !stable ? 'unstable' : download === 'insufficient' || upload === 'insufficient' ? 'insufficient' : download === 'ok' || upload === 'ok' ? 'ok' : 'good';
  const entry = (id: string, label: string, value: string, warning = false): SystemCheckReportEntry => ({id, type: 'network', label, value, warning});
  const entries = [
    entry('nw-download', 'Downloadgeschwindigkeit', nativeNetworkBytes(average('download'), true) + '/s'),
    entry('nw-download-needed', 'Downloadgeschwindigkeit benötigt', nativeNetworkBytes(config.downloadSpeed.min, true) + '/s'),
    entry('nw-download-evaluation', 'Downloadbewertung', download, download === 'insufficient'),
    entry('nw-upload', 'Uploadgeschwindigkeit', nativeNetworkBytes(average('upload'), true) + '/s'),
    entry('nw-upload-needed', 'Uploadgeschwindigkeit benötigt', nativeNetworkBytes(config.uploadSpeed.min, true) + '/s'),
    entry('nw-upload-evaluation', 'Uploadbewertung', upload, upload === 'insufficient'),
    entry('nw-overall', 'Gesamtbewertung', rating, rating === 'insufficient')
  ];
  if (connection) {
    if (connection.rtt) entries.push(entry('bnni-roundtrip', 'RoundTrip in ms', String(connection.rtt)));
    if (connection.effectiveType) entries.push(entry('bnni-effective-network-type', 'Netzwerktyp nach Leistung', connection.effectiveType));
    if (connection.type) entries.push(entry('bnni-network-type', 'Netzwerktyp', connection.type));
    if (connection.downlink) entries.push(entry('bnni-downlink', 'Downlink MB/s', String(connection.downlink)));
  } else entries.push(entry('bnni-fail', 'Netzwerkprofil des Browsers', 'nicht verfügbar', true));
  return {rating, entries};
}
