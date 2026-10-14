import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { BehaviorSubject, Subject, from, forkJoin, lastValueFrom, merge, of, timer } from 'rxjs';
import { bufferWhen, concatMap, distinctUntilChanged, map, scan, takeWhile, withLatestFrom } from 'rxjs/operators';
import { TestScheduler } from 'rxjs/testing';

export const completionReference = JSON.parse(readFileSync(new URL('./fixtures/original-controller-completion.json', import.meta.url), 'utf8'));
assert.equal(completionReference.originalCommit, 'ee2ab9ab64bd91209ef8534bbe6005838024e46d');
const compiled = ts.transpileModule(`export const load = (Subject, bufferWhen, concatMap, map, scan, takeWhile, withLatestFrom,
  from, forkJoin, lastValueFrom, merge, of, timer, distinctUntilChanged, Date, localStorage) => {
  ${Object.values(completionReference.sources).map(value => value.extracted).join('\n')}
  return {TestControllerService, TestControllerComponent,
    subscribe: function() { return ${completionReference.commandSubscription}; },
    subscribeStatus: function() { ${completionReference.stateSubscription}; }};
};`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { load } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
export const referenceMicrotasks = async () => { for (let index = 0; index < 20; index++) await Promise.resolve(); };

/** Controls external I/O only; the three buffer pipelines and their barrier are Original code. */
export const createOriginalCompletionReference = ({ initial = 'RUNNING', saveResponses = true, navigationResult = true } = {}) => {
  let clock = 10_000, resolveNavigation;
  const scheduler = new TestScheduler(assert.deepEqual);
  const debugPreferences = new Map();
  const storage = { setItem: (key, value) => debugPreferences.set(key, value), removeItem: key => debugPreferences.delete(key) };
  // Original createClosingSignal has its own timer subscriptions. A virtual
  // scheduler prevents reference timers outliving this owned test process.
  const original = load(Subject, bufferWhen, concatMap, map, scan, takeWhile, withLatestFrom, from,
    forkJoin, lastValueFrom, merge, of, milliseconds => timer(milliseconds, scheduler), distinctUntilChanged, { now: () => clock }, storage);
  const events = [], writes = { unitData: [], unitState: [], testState: [] }, logs = [], locks = [], navigations = [];
  const navigation = new Promise(resolve => { resolveNavigation = resolve; });
  const backend = {
    updateDataParts: (...args) => record('unitData', args),
    patchUnitState: (...args) => record('unitState', args),
    patchTestState: (...args) => record('testState', args),
    lockTest: (...args) => {
      const completion = new Subject(); const value = { args, completion };
      locks.push(value); events.push({ phase: 'lock', time: clock }); return completion;
    },
    addTestLog: (_testId, entries) => { logs.push(...entries); events.push({ phase: 'command-complete', time: clock }); }
  };
  const record = (type, args) => {
    const completion = new Subject(); writes[type].push({ args, completion });
    events.push({ phase: 'write:' + type, time: clock }); return completion;
  };
  const service = new original.TestControllerService();
  Object.assign(service, { testId: '42', testState: {}, state$: new BehaviorSubject(initial),
    navigation$: new BehaviorSubject({ targets: { next: 2 } }), units: { 1: { id: 'authored-unit' } },
    unitAliasMap: { alias: 1 }, booklet: { config: {} }, testMode: { saveResponses }, bs: backend,
    currentUnit: { parent: { locked: false } },
    router: { navigate: (...args) => { navigations.push(args); events.push({ phase: 'navigate', time: clock }); return navigation; } },
    interruptTimer: () => events.push({ phase: 'interrupt', time: clock }),
    // This fixture has no tracked/adaptive variables. Actual sortDataParts and
    // every buffer/save/barrier are retained; adaptive coding has separate gates.
    updateVariables: () => false
  });
  service.setupUnitDataPartsBuffer(); service.setupUnitStateBuffer(); service.setupTestStateBuffer();
  const controller = new original.TestControllerComponent();
  Object.assign(controller, { tcs: service, bs: backend, subscriptions: {} });
  original.subscribeStatus.call(controller);
  const flushEvents = [];
  let resolveClosed;
  const buffersClosed = new Promise(resolve => { resolveClosed = resolve; });
  const flushed = service.bufferFlushEventsOnClose$.subscribe(value => {
    flushEvents.push(value);
    if (flushEvents.filter(event => event.event === 'closed').length === 3) resolveClosed();
  });
  const receive = original.subscribe.call(controller);
  return {
    service, controller, events, writes, logs, locks, navigations, flushEvents, buffersClosed, debugPreferences,
    setClock(value) { clock = value; },
    seedAnswer() {
      service.unitDataPartsBuffer$.next({ testId: '42', unitAlias: 'alias', dataParts: { main: 'Exact Ä/β\n"; answer' }, unitStateDataType: 'iqb-standard@1.0' });
      service.unitStateBuffer$.next({ testId: '42', unitAlias: 'alias', state: [{ key: 'RESPONSE_PROGRESS', content: 'complete', timeStamp: clock }] });
    },
    receive(args = []) { receive({ keyword: 'terminate', arguments: args }); },
    receiveDebug(args = []) { receive({ keyword: 'debug', arguments: args }); },
    release(type) { for (const item of writes[type]) { item.completion.next(undefined); item.completion.complete(); } },
    releaseLock() { for (const item of locks) { item.completion.next(true); item.completion.complete(); } },
    releaseNavigation() { resolveNavigation(navigationResult); },
    stop() {
      for (const type of Object.keys(writes)) this.release(type);
      this.releaseLock(); this.releaseNavigation();
      for (const subscription of Object.values(controller.subscriptions)) subscription.unsubscribe();
      for (const name of Object.keys(service.subscriptions)) service.destroySubscription(name);
      flushed.unsubscribe();
    }
  };
};
