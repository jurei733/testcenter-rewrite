import { inject, Injectable } from '@angular/core';
import {
  BehaviorSubject, combineLatest, defer, EMPTY, fromEvent, interval, Observable, of, Subject, Subscription, throwError, zip
} from 'rxjs';
import type { Sort } from '@angular/material/sort';
import {
  delay, filter, mergeMap, map, startWith, switchMap, take, takeUntil, tap
} from 'rxjs/operators';
import { BackendService } from '../backend.service';
import { BookletService } from '../booklet/booklet.service';
import { TestSessionUtil } from '../test-session/test-session.util';
import {
  type CheckingOptions,
  type CommandResponse,
  type GroupMonitorConfig,
  isBooklet,
  type Selected,
  type Testlet,
  type TestSession,
  type TestSessionFilter,
  type TestSessionFilterList,
  type TestSessionSetStat,
  TestSessionsSuperStates
} from '../group-monitor.interfaces';
import { BookletUtil } from '../booklet/booklet.util';
import { GROUP_MONITOR_CONFIG } from '../group-monitor.config';
import type { TestSessionByDataTestId } from './test-session-manager.interfaces';

type GotoDestination = {testId: string; alias: string; reopenLimit: number | null};

@Injectable()
export class TestSessionManager {
  private readonly groupMonitorConfig=inject(GROUP_MONITOR_CONFIG);
  static readonly basicFilters: TestSessionFilterList = {
    locked: {
      selected: false,
      source: 'base',
      filter: {
        id: 'locked',
        label: 'gm_filter_locked',
        target: 'testState',
        value: 'status',
        subValue: 'locked',
        type: 'equal',
        not: false
      }
    },
    pending: {
      selected: false,
      source: 'base',
      filter: {
        id: 'pending',
        label: 'gm_filter_pending',
        target: 'testState',
        value: 'status',
        subValue: 'pending',
        type: 'equal',
        not: false
      }
    },
    quick: {
      selected: false,
      source: 'quick',
      filter: {
        id: 'quickFilter',
        label: 'gm_filter_quick',
        target: 'personLabel',
        value: '',
        subValue: '',
        type: 'substring',
        not: true
      }
    }
  };

  sortBy$: Subject<Sort>;
  filters$: Subject<TestSessionFilter[]>;
  filterOptions: TestSessionFilterList = {};
  checkingOptions: CheckingOptions = {
    enableAutoCheckAll: false,
    autoCheckAll: false
  };

  private groupName: string = '';
  private connectionRevision = 0;
  private readonly disconnected$ = new Subject<void>();
  private monitor$: Observable<TestSession[]> = new Observable<TestSession[]>();
  private _sessions$: BehaviorSubject<TestSession[]> = new BehaviorSubject<TestSession[]>([]);
  private _checked: { [sessionTestSessionId: string]: TestSession } = {};
  private _checkedStats$: BehaviorSubject<TestSessionSetStat>;
  private _sessionsStats$: BehaviorSubject<TestSessionSetStat>;
  private _commandResponses$: Subject<CommandResponse> = new Subject<CommandResponse>();
  private _clock$: Observable<number>;
  private monitorSubscription: Subscription | null = null;

  constructor(
    private bs: BackendService,
    private bookletService: BookletService,
  ) {
    this._checkedStats$ = new BehaviorSubject<TestSessionSetStat>(TestSessionManager.getEmptyStats());
    this._sessionsStats$ = new BehaviorSubject<TestSessionSetStat>(TestSessionManager.getEmptyStats());
    this.sortBy$ = new BehaviorSubject<Sort>({ direction: 'asc', active: 'personLabel' });
    this.filters$ = new BehaviorSubject<TestSessionFilter[]>([]);
    this._clock$ = this.groupMonitorConfig.checkForIdleInterval ?
      interval(this.groupMonitorConfig.checkForIdleInterval).pipe(startWith(0)) :
      of(0);
    this.resetFilters();
  }

  get sessions$(): Observable<TestSession[]> {
    return this._sessions$.asObservable();
  }

  get sessions(): TestSession[] {
    return this._sessions$.getValue();
  }

  get checked(): TestSession[] { // this is intentionally not an observable
    return Object.values(this._checked);
  }

  get sessionsStats$(): Observable<TestSessionSetStat> {
    return this._sessionsStats$.asObservable();
  }

  get checkedStats$(): Observable<TestSessionSetStat> {
    return this._checkedStats$.asObservable();
  }

  get commandResponses$(): Observable<CommandResponse> {
    return this._commandResponses$
      .pipe(
        filter(c => !!c)
      );
  }

  connect(groupName: string): void {
    this.disconnect();
    this.groupName = groupName;
    this.sortBy$.next({ direction: 'asc', active: 'personLabel' });
    this.filters$.next([]);
    this.checkingOptions = {
      enableAutoCheckAll: true,
      autoCheckAll: true
    };

    this._checkedStats$.next(TestSessionManager.getEmptyStats());
    this._sessionsStats$.next(TestSessionManager.getEmptyStats());
    // this._commandResponses$.next();

    this.monitor$ = this.bs.observeSessionsMonitor(groupName)
      .pipe(
        switchMap(sessionChanges => sessionChanges.length ? zip(
          ...sessionChanges
            .map(sessionChange => combineLatest([
              this.bookletService.getBooklet(sessionChange.bookletName),
              this._clock$
            ])
              .pipe(
                map(([booklet]) => TestSessionUtil.analyzeTestSession(sessionChange, booklet))
              )
            )
        ) : of([]))
      );

    this._sessions$.next([]);

    this.monitorSubscription = combineLatest([this.sortBy$, this.filters$, this.monitor$])
      .pipe(
        // eslint-disable-next-line max-len
        map(([sortBy, filters, sessions]) => this.sortSessions(sortBy, TestSessionManager.filterSessions(sessions, filters))),
        tap(sessions => this.synchronizeChecked(sessions))
      )
      .subscribe(this._sessions$);
  }

  disconnect(): void {
    this.connectionRevision++;
    this.disconnected$.next();
    this.groupName = '';
    this.monitorSubscription?.unsubscribe();
    this.bs.cutConnection();
    this._sessions$.next([]);
    this._checked={};
    this._sessionsStats$.next(TestSessionManager.getEmptyStats());
    this._checkedStats$.next(TestSessionManager.getEmptyStats());
  }

  switchFilter(filterId: string): void {
    this.filterOptions[filterId].selected = !this.filterOptions[filterId].selected;
    this.refreshFilters();
  }

  refreshFilters(): void {
    this.filters$.next(Object.values(this.filterOptions)
      .filter(filterOption => filterOption.selected)
      .map(filterOption => filterOption.filter)
    );
  }

  resetFilters(): void {
    this.filterOptions = {};
    Object.keys(TestSessionManager.basicFilters)
      .forEach(key => {
        this.filterOptions[key] = {
          selected: TestSessionManager.basicFilters[key].selected,
          source: TestSessionManager.basicFilters[key].source,
          filter: { ...TestSessionManager.basicFilters[key].filter }
        };
      });
  }

  private static filterSessions(sessions: TestSession[], filters: TestSessionFilter[]): TestSession[] {
    return sessions
      .filter(session => session.data.testId && BigInt(session.data.testId) > -1n) // testsession without testId is deprecated
      .filter(session => !TestSessionManager.applyFilters(session, filters));
  }

  private static applyFilters(session: TestSession, filters: TestSessionFilter[]): boolean {
    const regexTest = (regex: string, value: string): boolean => {
      try {
        return new RegExp(regex).test(value);
      } catch (e) {
        return false;
      }
    };
    // eslint-disable-next-line @typescript-eslint/no-shadow
    const apply = (subject: string, filter: TestSessionFilter, inverted: boolean = false): boolean => {
      if (filter.not && !inverted) return !apply(subject, filter, true);
      if (Array.isArray(filter.value)) return filter.value.includes(subject);
      const object = filter.subValue ? filter.subValue : filter.value;
      switch (filter.type) {
        case 'substring':
          return subject.includes(object);
        case 'equal':
          return subject === object;
        case 'regex':
          return regexTest(object, subject);
        default:
          return false;
      }
    };
    const filterOut: TestSessionFilter | undefined = filters
      .find((nextFilter: TestSessionFilter): boolean => {
        switch (nextFilter.target) {
          case 'groupName':
          case 'personLabel':
          case 'mode':
            return apply(session.data[nextFilter.target] || '', nextFilter);
          case 'bookletId':
            return apply(session.data.bookletName || '', nextFilter); // bookletId is clearer for XML-authors
          case 'unitId':
            return apply(session.data.unitName || '', nextFilter); // unitId is clearer for XML-authors
          case 'unitLabel':
            return apply(session.current?.unit?.label || '', nextFilter);
          case 'bookletLabel':
            return apply('metadata' in session.booklet ? session.booklet.metadata.label : '', nextFilter);
          case 'blockId':
            return apply(session.current?.ancestor?.blockId || '', nextFilter);
          case 'blockLabel':
            return apply(session.current?.ancestor?.label || '', nextFilter);
          case 'testState': {
            if (Array.isArray(nextFilter.value)) return false;
            if (typeof session.data.testState[nextFilter.value] === 'undefined') return nextFilter.not;
            return apply(session.data.testState[nextFilter.value], nextFilter);
          }
          case 'bookletStates': {
            if (Array.isArray(nextFilter.value)) return false;
            if (!session.bookletStates || typeof session.bookletStates[nextFilter.value] === 'undefined') return nextFilter.not;
            return apply(session.bookletStates[nextFilter.value], nextFilter);
          }
          case 'state': {
            return apply(session.state, nextFilter);
          }
          case 'bookletSpecies': {
            return apply(session.booklet.species || '', nextFilter);
          }
          default:
            return false;
        }
      });
    return typeof filterOut !== 'undefined';
  }

  private send(request: Observable<CommandResponse>): void {
    const scope = this.bs.accessSignal;
    if (!this.groupName || scope.aborted) return;
    request.pipe(
      takeUntil(this.disconnected$),
      takeUntil(fromEvent(scope, 'abort'))
    ).subscribe({
      next: response => this._commandResponses$.next(response),
      // BackendService already exposes the redacted failure to the view.
      error: () => {}
    });
  }

  testCommandPause(): void {
    const testIds = this.checked
      .filter(session => !TestSessionUtil.isPaused(session))
      .filter(session => !['pending', 'locked'].includes(session.state))
      .map(session => session.data.testId);
    if (!testIds.length) {
      this._commandResponses$.next({ commandType: 'pause', testIds });
      return;
    }
    this.send(this.bs.command('pause', [], testIds));
  }

  testCommandResume(): void {
    const testIds = this.checked
      .filter(session => !['pending', 'locked'].includes(session.state))
      .map(session => session.data.testId);
    if (!testIds.length) {
      this._commandResponses$.next({ commandType: 'resume', testIds });
      return;
    }
    this.send(this.bs.command('resume', [], testIds));
  }

  getGotoReopenLimit(selection: Selected, targets: TestSession[]): number | null {
    return TestSessionManager.reopenLimit(TestSessionManager.gotoDestinations(targets, selection));
  }

  testCommandGoto(selection: Selected, newTimeLeft: number | undefined, targets: TestSession[] = this.checked): Observable<true> {
    const destinations = TestSessionManager.gotoDestinations(targets, selection);
    const group = this.groupName;
    const revision = this.connectionRevision;
    const scope = this.bs.accessSignal;
    return defer(() => {
      if (!group || group !== this.groupName || revision !== this.connectionRevision ||
        scope !== this.bs.accessSignal || scope.aborted) return EMPTY;
      if (!destinations.length) {
        this._commandResponses$.next({commandType: 'goto', testIds: []});
        return EMPTY;
      }
      const reopenLimit = TestSessionManager.reopenLimit(destinations);
      if (reopenLimit !== null && (newTimeLeft === undefined || !Number.isFinite(newTimeLeft) ||
        newTimeLeft <= 0 || newTimeLeft > reopenLimit)) {
        return throwError(() => new Error('Die verfügbare Zeit des Zielblocks hat sich geändert.'));
      }
      const batches = new Map<string, {alias: string; description: string; ids: string[]}>();
      for (const destination of destinations) {
        const description = destination.reopenLimit === null ? '' :
          `| closed timeblock reopened - new remaining time ${newTimeLeft}`;
        const key = JSON.stringify([destination.alias, description]);
        const batch = batches.get(key);
        if (batch) batch.ids.push(destination.testId);
        else batches.set(key, {alias: destination.alias, description, ids: [destination.testId]});
      }
      return zip([...batches.values()].map(destination => this.bs.command(
        'goto',
        ['id', destination.alias, destination.description],
        destination.ids
      ))).pipe(
        takeUntil(this.disconnected$),
        takeUntil(fromEvent(scope, 'abort')),
        tap(responses => {
          this._commandResponses$.next({commandType: 'goto', testIds: responses.flatMap(response => response.testIds)});
        }),
        map(() => true as const)
      );
    });
  }

  testCommandUnlock(): void {
    const testIds = this.checked
      .filter(session => TestSessionUtil.isLocked(session))
      .map(session => session.data.testId);

    if (!testIds.length) {
      this._commandResponses$.next({ commandType: 'unlock', testIds });
      return;
    }

    this.send(this.bs.unlock(this.groupName, testIds));
  }

  commandFinishEverything(): Observable<CommandResponse> {
    // Finish targets come from a fresh complete snapshot. Keep the visible
    // filter and auto-selection intact if the operation fails or is cancelled.
    const group = this.groupName;
    const revision = this.connectionRevision;
    const scope = this.bs.accessSignal;
    const current = () => !!group && revision === this.connectionRevision &&
      group === this.groupName && scope === this.bs.accessSignal && !scope.aborted;
    // Rendered rows may still await XML, or retain an older poll. Finish uses
    // one fresh complete native snapshot, then keeps those exact targets even
    // when the successful lock changes later snapshots to status=locked.
    return defer(() => current() ? this.bs.getSessionsMonitor(group).pipe(
      take(1),
      switchMap(rows => {
        if (!current()) return EMPTY;
        // A reserved Test remains pending until the participant opens it.
        const started = rows.filter(row => BigInt(row.testId) > 0n &&
          !TestSessionUtil.hasState(row.testState, 'status', 'pending'));
        const lockIds = started.filter(row => !TestSessionUtil.hasState(row.testState, 'status', 'locked'))
          .map(row => row.testId);
        const pending = new Set(this.bs.pendingFinishTargets(group));
        const eligible = started.filter(row => !TestSessionUtil.hasState(row.testState, 'CONTROLLER', 'TERMINATED'));
        const remaining = new Set(eligible.map(row => row.testId));
        for (const id of pending) if (!remaining.has(id)) pending.delete(id);
        const terminateIds = eligible.filter(row => pending.has(row.testId) ||
          (!TestSessionUtil.hasState(row.testState, 'status', 'locked') &&
            (TestSessionUtil.hasState(row.testState, 'CONNECTION', 'POLLING') ||
              TestSessionUtil.hasState(row.testState, 'CONNECTION', 'WEBSOCKET'))))
          .map(row => row.testId);
        // Retain before writing: even an error/abort can follow a committed
        // lock. A retry uses a fresh snapshot without adopting unrelated locks.
        terminateIds.forEach(id => pending.add(id));
        this.bs.rememberFinishTargets(group, [...pending]);
        return this.bs.lock(group, lockIds).pipe(
          delay(1500),
          mergeMap(() => current() ? this.bs.command('terminate', ['lock'], terminateIds) : EMPTY),
          tap(() => {
            if (current()) this.bs.rememberFinishTargets(group,
              this.bs.pendingFinishTargets(group).filter(id => !terminateIds.includes(id)));
          })
        );
      }),
      takeUntil(this.disconnected$),
      takeUntil(fromEvent(scope, 'abort'))
    ) : EMPTY);
  }

  sortSessions(sort: Sort, sessions: TestSession[]): TestSession[] {
    return sessions
      .sort((session1, session2) => {
        const sortDirectionFactor = (sort.direction === 'asc' ? 1 : -1);
        if (sort.active === 'timestamp') {
          return (session1.data.timestamp - session2.data.timestamp) * sortDirectionFactor;
        }
        if (sort.active === '_checked') {
          const session1isChecked = this.isChecked(session1);
          const session2isChecked = this.isChecked(session2);
          if (!session1isChecked && session2isChecked) {
            return 1 * sortDirectionFactor;
          }
          if (session1isChecked && !session2isChecked) {
            return -1 * sortDirectionFactor;
          }
          return 0;
        }
        if (sort.active === '_superState') {
          return (TestSessionsSuperStates.indexOf(session1.state) -
            TestSessionsSuperStates.indexOf(session2.state)) * sortDirectionFactor;
        }
        if (sort.active === '_currentBlock') {
          const s1curBlock = session1.current?.ancestor?.blockId ?? 'zzzzzzzzzz';
          const s2curBlock = session2.current?.ancestor?.blockId ?? 'zzzzzzzzzz';
          return s1curBlock.localeCompare(s2curBlock) * sortDirectionFactor;
        }
        if (sort.active === '_currentUnit') {
          const s1currentUnit = session1.current?.unit?.label ?? 'zzzzzzzzzz';
          const s2currentUnit = session2.current?.unit?.label ?? 'zzzzzzzzzz';
          return s1currentUnit.localeCompare(s2currentUnit) * sortDirectionFactor;
        }
        if (sort.active.startsWith('bookletState:')) {
          const bookletState = sort.active.replace('bookletState:', '');
          const label = (session: TestSession): string =>
            TestSessionUtil.bookletStateLabel(session, bookletState) ?? 'zzzzzzzzzz';
          const a = label(session1);
          const b = label(session2);
          return a.localeCompare(b) * sortDirectionFactor;
        }
        let valA = session1.data[sort.active as keyof typeof session1.data] ?? 'zzzzzzzzzz';
        let valB = session2.data[sort.active as keyof typeof session2.data] ?? 'zzzzzzzzzz';
        if (typeof valA === 'number') {
          valA = valA.toString(10);
        }
        if (typeof valB === 'number') {
          valB = valB.toString(10);
        }
        if ((typeof valA === 'object') || (typeof valB === 'object')) {
          return 0;
        }
        return valA.localeCompare(valB) * sortDirectionFactor;
      });
  }

  isChecked(session: TestSession): boolean {
    return (typeof this._checked[session.data.testId] !== 'undefined');
  }

  checkSessionsBySelection(selected: Selected): void {
    if (this.checkingOptions.autoCheckAll) {
      return;
    }
    let toCheck: TestSession[] = [];
    if (selected.element) {
      if (selected.nthClick === 'first') {
        toCheck = [...this.checked, selected.originSession];
      } else if (selected.nthClick === 'second') {
        toCheck = this._sessions$.getValue()
          .filter(session => (!['pending', 'locked'].includes(session.state)))
          .filter(session => (session.booklet.species === selected.originSession.booklet.species))
          .filter(session => (selected.inversion ? !this.isChecked(session) : true));
      } else if (selected.nthClick === 'third') {
        toCheck = [];
      }
    }

    this.replaceCheckedSessions(toCheck);
  }

  invertChecked(): void {
    if (this.checkingOptions.autoCheckAll) {
      return;
    }
    if (!this._sessions$) {
      return;
    }
    const unChecked = this._sessions$.getValue()
      .filter(session => session.data.testId && BigInt(session.data.testId) > -1n)
      .filter(session => (!['pending', 'locked'].includes(session.state)))
      .filter(session => !this.isChecked(session));
    this.replaceCheckedSessions(unChecked);
  }

  checkSession(session: TestSession): void {
    if (this.checkingOptions.autoCheckAll) {
      return;
    }
    this._checked[session.data.testId] = session;
    this.onCheckedChanged();
  }

  uncheckSession(session: TestSession): void {
    if (this.checkingOptions.autoCheckAll) {
      return;
    }
    delete this._checked[session.data.testId];
    this.onCheckedChanged();
  }

  checkAll(): void {
    if (this.checkingOptions.autoCheckAll) {
      return;
    }
    const allSelectable = this._sessions$.getValue()
      .filter(session => (!['pending', 'locked'].includes(session.state)));
    this.replaceCheckedSessions(allSelectable);
  }

  checkNone(): void {
    this.replaceCheckedSessions([]);
  }

  private static reopenLimit(destinations: GotoDestination[]): number | null {
    let limit: number | null = null;
    for (const destination of destinations) {
      if (destination.reopenLimit !== null) {
        limit = limit === null ? destination.reopenLimit : Math.min(limit, destination.reopenLimit);
      }
    }
    return limit;
  }

  private static gotoDestinations(sessions: TestSession[], selection: Selected): GotoDestination[] {
    const blockId = selection.element?.blockId;
    if (!blockId) return [];
    const destinations: GotoDestination[] = [];
    for (const session of sessions) {
      if (!session.data.bookletName || !isBooklet(session.booklet)) continue;

      const ignoreTestlet = (testlet: Testlet) => !!testlet.restrictions.show &&
        !!session.bookletStates &&
        (session.bookletStates[testlet.restrictions.show.if] !== testlet.restrictions.show.is);
      const destination = BookletUtil.getFirstUnitOfBlock(blockId, session.booklet, ignoreTestlet);
      if (!destination) continue;
      const timer = destination.timer;
      const remaining = timer ? session.timeLeft?.[timer.id] : undefined;
      const reopenLimit = typeof remaining === 'number' && remaining <= 0 ?
        timer?.restrictions.timeMax?.minutes ?? null : null;
      destinations.push({testId: session.data.testId, alias: destination.unit.alias, reopenLimit});
    }
    return destinations;
  }

  private static getEmptyStats(): TestSessionSetStat {
    return {
      ...{
        allChecked: false,
        numberOfSessions: 0,
        differentBookletSpecies: 0,
        differentBooklets: 0,
        bookletStateLabels: {},
        pausedSessions: 0,
        lockedSessions: 0
      }
    };
  }

  private static getSessionSetStats(sessionSet: TestSession[], all: number = sessionSet.length): TestSessionSetStat {
    const booklets = new Set();
    const bookletSpecies = new Set();
    const bookletStateLabels: { [key: string]: string } = {};
    let paused = 0;
    let locked = 0;

    sessionSet
      .forEach(session => {
        booklets.add(session.data.bookletName);
        bookletSpecies.add(session.booklet.species);
        Object.values(isBooklet(session.booklet) ? session.booklet?.states : {})
          .forEach(state => {
            bookletStateLabels[state.id] = state.label;
          });
        if (TestSessionUtil.isPaused(session)) paused += 1;
        if (TestSessionUtil.isLocked(session)) locked += 1;
      });

    return {
      numberOfSessions: sessionSet.length,
      differentBooklets: booklets.size,
      differentBookletSpecies: bookletSpecies.size,
      allChecked: (all === sessionSet.length),
      bookletStateLabels,
      pausedSessions: paused,
      lockedSessions: locked
    };
  }

  private synchronizeChecked(sessions: TestSession[]): void {
    const sessionsStats = TestSessionManager.getSessionSetStats(sessions);

    this.checkingOptions.enableAutoCheckAll = (sessionsStats.differentBookletSpecies < 2);

    if (!this.checkingOptions.enableAutoCheckAll) {
      this.checkingOptions.autoCheckAll = false;
    }

    const newCheckedSessions: TestSessionByDataTestId = {};
    sessions
      .forEach(session => {
        if (this.checkingOptions.autoCheckAll || (typeof this._checked[session.data.testId] !== 'undefined')) {
          newCheckedSessions[session.data.testId] = session;
        }
      });
    this._checked = newCheckedSessions;

    this._checkedStats$.next(TestSessionManager.getSessionSetStats(Object.values(this._checked), sessions.length));
    this._sessionsStats$.next(sessionsStats);
  }

  private replaceCheckedSessions(sessionsToCheck: TestSession[]): void {
    const newCheckedSessions: TestSessionByDataTestId = {};
    sessionsToCheck
      .forEach(session => {
        newCheckedSessions[session.data.testId] = session;
      });
    this._checked = newCheckedSessions;
    this.onCheckedChanged();
  }

  private onCheckedChanged(): void {
    this._checkedStats$.next(TestSessionManager.getSessionSetStats(this.checked, this.sessions.length));
  }
}
