import {NATIVE_BACKEND_URL,NATIVE_BROADCASTER_URL,NATIVE_PRODUCTION,NATIVE_RUN_TEST_ID} from '../../native-tokens';
import {
  Inject, Injectable, type OnDestroy
, inject } from '@angular/core';
import {
  of, Subject, Subscription, timer, defer, EMPTY, fromEvent
} from 'rxjs';
import {
  catchError, finalize, takeUntil, concatMap,
  distinctUntilChanged,
  filter,
  ignoreElements,
  map,
  mergeMap,
  startWith,
  switchMap,
  tap
} from 'rxjs/operators';
import {NativeHttpClient as HttpClient} from '../../native-http-client';
import { AppError } from '../../app.interfaces';
import {
  type Command, type CommandKeyword, commandKeywords, isKnownCommand, type TcPublicApi, type TestControllerState
} from '../interfaces/test-controller.interfaces';
import { TestControllerService } from './test-controller.service';
import { WebsocketBackendService } from '../../shared/shared.module';

type TestStartedOrStopped = 'started' | 'terminated' | '';

@Injectable({
  providedIn: 'root'
})
export class CommandService extends WebsocketBackendService<Command[]> implements OnDestroy {
  command$: Subject<Command> = new Subject<Command>();

  protected initialData = [];
  protected pollingEndpoint = '';
  protected pollingInterval = 5000;
  protected wsChannelName = 'commands';

  private commandReceived$: Subject<Command> = new Subject<Command>();
  private commandSubscription: Subscription | null = null;
  private testStartedSubscription: Subscription | null = null;
  private executedCommandIds: Array<string | number> = [];
  private readonly pendingCommands = new Set<string | number>();
  private readonly unconfirmedAcks = new Map<Command['id'], Command>();
  private debugCommands: TcPublicApi | undefined;

  readonly isProductionMode=inject(NATIVE_PRODUCTION);
  private readonly ownedTestId=inject(NATIVE_RUN_TEST_ID);
  private readonly tcs:TestControllerService;
  constructor(){
    const http=inject(HttpClient);
    super(inject(NATIVE_BROADCASTER_URL),inject(NATIVE_BACKEND_URL),http);
    this.tcs=inject(TestControllerService);
    if (!this.isProductionMode) this.setUpGlobalCommandsForDebug();

    this.commandSubscription = this.subscribeReceivedCommands();
    this.testStartedSubscription = this.subscribeTestStarted();
  }

  static commandToString(command: Command): string {
    return [command.keyword, ...command.arguments].join(' ');
  }

  private static testStartedOrStopped(testStatus: TestControllerState): TestStartedOrStopped {
    if (['RUNNING', 'PAUSED'].includes(testStatus)) {
      return 'started';
    }
    if (['TERMINATED_PAUSED', 'TERMINATED', 'ERROR'].includes(testStatus)) {
      return 'terminated';
    }
    return '';
  }

  // services are normally meant to live forever, so unsubscription *should* be unnecessary
  // this unsubscriptions are only for the case, the project's architecture will be changed dramatically once
  // while not having a OnInit-hook services *do have* an OnDestroy-hook (see: https://v9.angular.io/api/core/OnDestroy)
  override ngOnDestroy(): void {
    if (this.commandSubscription) {
      this.commandSubscription.unsubscribe();
    }
    if (this.testStartedSubscription) {
      this.testStartedSubscription.unsubscribe();
    }
    if(this.debugCommands && (window as any).tc===this.debugCommands) delete (window as any).tc;
    this.pendingCommands.clear();this.unconfirmedAcks.clear();
    this.command$.complete();this.commandReceived$.complete();super.ngOnDestroy();
  }

  private subscribeReceivedCommands(): Subscription {
    let lastControllerCommand=0n;
    let lastTimerCommand = 0n;
    return this.commandReceived$.pipe(
      filter(command => this.tcs.testId===this.ownedTestId && this.http.isCurrent && !this.executedCommandIds.includes(command.id) && !this.pendingCommands.has(command.id)),
      tap(command => this.pendingCommands.add(command.id)),
      map(command => ({command,testId:this.ownedTestId})),
      // Source starts ACKs at least one second apart; completion may overlap.
      concatMap(envelope => timer(1000).pipe(ignoreElements(),startWith(envelope))),
      mergeMap(({command,testId}) => defer(() => this.http.isCurrent && testId === this.tcs.testId ?
        this.http.patch(`${this.backendUrl}test/${testId}/command/${command.id}/executed`,{}).pipe(
          filter(() => this.http.isCurrent && testId === this.tcs.testId),
          map(() => ({command, recovered: this.unconfirmedAcks.delete(command.id)})),
          tap(({command: confirmed}) => this.executedCommandIds.push(confirmed.id))
        ) : EMPTY).pipe(
          catchError((error: unknown) => {
            // The server may have committed the ACK before the connection broke.
            // It then omits the command from future snapshots. Retry the same
            // idempotent ACK when an owned command snapshot arrives again.
            if (error instanceof AppError && [0, 502, 503, 504].includes(error.code ?? -1)) {
              this.unconfirmedAcks.set(command.id, command);
            } else {
              this.unconfirmedAcks.delete(command.id);
            }
            this.connectionStatus$.next('error');
            this.recoverPolling();
            return EMPTY;
          }),
          finalize(() => this.pendingCommands.delete(command.id))
        )),
      takeUntil(fromEvent(this.http.accessSignal,'abort'))
    ).subscribe(({command, recovered}) => {
      const id=BigInt(command.id);
      const keyword=command.keyword.toLowerCase();
      const controller = keyword === 'pause' || keyword === 'resume' || keyword === 'terminate';
      const affectsTimer = controller || keyword === 'goto';
      if (keyword === 'goto' && id < lastControllerCommand) return;
      // An ACK retry can finish after a newer control. The server leaves that
      // newer control in force, so skip the old command's local effect as well.
      if (recovered && affectsTimer && id < lastTimerCommand) return;
      if (controller && id > lastControllerCommand) lastControllerCommand = id;
      if (affectsTimer && id > lastTimerCommand) lastTimerCommand = id;
      this.command$.next(command);
    });
  }

  private subscribeTestStarted(): Subscription {
    if (typeof this.testStartedSubscription !== 'undefined') {
      this.testStartedSubscription?.unsubscribe();
    }

    return this.tcs.state$
      .pipe(
        distinctUntilChanged(),
        map(CommandService.testStartedOrStopped),
        filter(testStartedOrStopped => testStartedOrStopped !== ''),
        map(testStartedOrStopped => (((testStartedOrStopped === 'started') && (this.tcs.testMode.receiveRemoteCommands)) ? `test/${this.tcs.testId}/commands` : '')),
        filter(newPollingEndpoint => newPollingEndpoint !== this.pollingEndpoint),
        switchMap((pollingEndpoint: string) => {
          this.pollingEndpoint = pollingEndpoint;
          if (this.pollingEndpoint) {
            return this.observeEndpointAndChannel();
          }
          this.unconfirmedAcks.clear();
          this.cutConnection();
          return of([]);
        }),
        switchMap(commands => of(...this.unconfirmedAcks.values(), ...commands)),
        takeUntil(fromEvent(this.http.accessSignal,'abort'))
      ).subscribe(this.commandReceived$);
  }

  private setUpGlobalCommandsForDebug() {
    this.debugCommands = (window as { tc: TcPublicApi } & Window & typeof globalThis).tc =
      commandKeywords
        .reduce((acc, keyword) => {
          acc[keyword] = args => { this.commandFromTerminal(keyword, args); };
          return acc;
        }, <{ [key in CommandKeyword]: (arr: string[]) => void; } & object>{});
  }

  private commandFromTerminal(keyword: string, args: string[]): void {
    if(!this.http.isCurrent || this.tcs.testId!==this.ownedTestId)return;
    const newArgs = (typeof args === 'undefined') ? [] : args;
    const id = Math.round(Math.random() * -10000000);
    const command = {
      keyword,
      arguments: newArgs,
      id,
      timestamp: Date.now()
    };
    if (!isKnownCommand(keyword)) {
      return;
    }
    this.command$.next(command);
  }
}
