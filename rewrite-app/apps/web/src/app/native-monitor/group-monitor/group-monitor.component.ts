import {NativeMonitorEntriesView} from '../native-monitor-entries.pipe';
import {FormsModule} from '@angular/forms';
import {NativeMonitorIconComponent as MatIcon} from '../native-monitor-icon.component';
import {MatButton,MatIconButton} from '@angular/material/button';
import {MatMenu,MatMenuItem,MatMenuTrigger} from '@angular/material/menu';
import {MatDrawerContainer,MatDrawer,MatDrawerContent} from '@angular/material/sidenav';
import {MatSlideToggle} from '@angular/material/slide-toggle';
import {MatCheckbox} from '@angular/material/checkbox';
import {MatSort,MatSortHeader} from '@angular/material/sort';
import {MatTooltip} from '@angular/material/tooltip';
import {MatCard,MatCardContent} from '@angular/material/card';
import {CdkTrapFocus} from '@angular/cdk/a11y';
import {CustomtextPipe,AlertComponent} from '../shared/shared.module';
import {TestSessionComponent} from './test-session/test-session.component';
import {
  Component, inject, signal, ElementRef, type OnDestroy, type OnInit, ViewChild, ViewContainerRef
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import type { Sort } from '@angular/material/sort';
import { MatSidenav } from '@angular/material/sidenav';
import {
  EMPTY, fromEvent, interval, Observable, of, Subject, Subscription
} from 'rxjs';
import { MatDialog, type MatDialogRef } from '@angular/material/dialog';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';
import { MatCheckboxChange } from '@angular/material/checkbox';
import { catchError, delay, filter, finalize, switchMap, take, takeUntil, tap } from 'rxjs/operators';
import type { KeyValue } from '@angular/common';
import {
  CustomtextService, type ConnectionStatus,
  MainDataService
} from '../shared/shared.module';
import { BackendService } from './backend.service';
import {
  type TestViewDisplayOptions,
  type TestViewDisplayOptionKey,
  type Selected,
  type TestSession,
  type TestSessionSetStat,
  type CommandResponse,
  type UIMessage,
  isBooklet,
  type TestSessionFilter,
  type TestSessionFilterListEntry,
  testSessionFilterListEntrySources, type Profile, isColumnOption, isViewOption, isYesNoOption
} from './group-monitor.interfaces';
import { TestSessionManager } from './test-session-manager/test-session-manager.service';
import { BookletUtil } from './booklet/booklet.util';
import { AddFilterDialogComponent } from './components/add-filter-dialog/add-filter-dialog.component';
import {
  TimeRestrictionDialogComponent,
  type TimeRestrictionDialogData
} from './time-restriction-dialog/time-restriction-dialog.component';
import { ComponentUtilService } from '../shared/services/component-util.service';
import { HeaderService } from '../shared/services/header.service';
import { MessageService } from '../shared/services/message.service';

@Component({
  selector: 'tc-group-monitor',
  templateUrl: './group-monitor.component.html',
  styleUrls: [
    './group-monitor.component.css'
  ],
  standalone: true,
  imports: [FormsModule, MatIcon, MatButton, MatIconButton, MatMenu, MatMenuItem, MatMenuTrigger, MatDrawerContainer, MatDrawer, MatDrawerContent, MatSlideToggle, MatCheckbox, MatSort, MatSortHeader, MatTooltip, MatCard, MatCardContent, CdkTrapFocus, AlertComponent, TestSessionComponent]
})
export class GroupMonitorComponent implements OnInit, OnDestroy {
  readonly entries = new NativeMonitorEntriesView().transform;
  private readonly filterDialogView = inject(ViewContainerRef);
  private readonly nativeText = new CustomtextPipe(inject(CustomtextService));
  readonly customtext = this.nativeText.transform.bind(this.nativeText);
  readonly connectionStatus = signal<ConnectionStatus>('initial');
  readonly sessionRows = signal<TestSession[]>([]);
  readonly checkedStats = signal<TestSessionSetStat | null>(null);
  readonly sessionsStats = signal<TestSessionSetStat | null>(null);

  groupLabel = '';

  currentlySelected: Selected | null = null;
  CurrentlyMarked: Selected | null = null;

  private static defaultDisplayOptions(): TestViewDisplayOptions { return {
    view: 'medium',
    groupColumn: 'hide',
    bookletColumn: 'show',
    blockColumn: 'show',
    unitColumn: 'hide',
    bookletStatesColumns: [],
    highlightSpecies: false,
    manualChecking: false,
    autoselectNextBlock: true
  }; }
  displayOptions = GroupMonitorComponent.defaultDisplayOptions();

  isScrollable = false;
  isClosing = false;
  checkedSessionCount = 0;

  quickFilter: string = '';
  quickFilterBoxOpen: boolean = false;

  messages: UIMessage[] = [];

  bookletStates: { [p: string]: string } = {};

  private subscriptions: Subscription[] = [];
  private readonly routeChanged$ = new Subject<void>();

  @ViewChild('adminbackground') mainElem!: ElementRef;
  @ViewChild('sidenav', { static: true }) sidenav!: MatSidenav;

  constructor(
    public dialog: MatDialog,
    private route: ActivatedRoute,
    private bs: BackendService,
    public tsm: TestSessionManager,
    private router: Router,
    private cts: CustomtextService,
    public mds: MainDataService,
    private addFilterDialog: MatDialog,
    private componentUtilService: ComponentUtilService,
    private headerService: HeaderService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.subscriptions = [
      this.tsm.sessions$.subscribe(rows => this.sessionRows.set(rows)),
      this.bs.connectionStatus$.subscribe(status => this.connectionStatus.set(status)),
      this.route.params.pipe(switchMap(params => {
        this.routeChanged$.next();
        this.tsm.disconnect();
        this.tsm.resetFilters();
        this.displayOptions = GroupMonitorComponent.defaultDisplayOptions();
        this.currentlySelected = null;
        this.CurrentlyMarked = null;
        this.quickFilter = '';
        this.quickFilterBoxOpen = false;
        this.messages = [];
        this.bookletStates = {};
        this.groupLabel = this.mds.getAccessObject('testGroupMonitor', params['group-name']).label;
        this.headerService.title = `${this.mds.appTitle$.value} ${this.cts.getCustomText('gm_headline') ?? ''} - ${this.groupLabel}`;
        const profileId = params['profile-id'];
        const profile$: Observable<Profile | null> = profileId ? this.bs.getProfile(profileId) : of(null);
        return profile$.pipe(
          tap(profile => {
            this.tsm.connect(params['group-name']);
            if (profile) this.applyProfile(profile);
          }),
          catchError(() => {
            this.messages.push({ level: 'error', customtext: '', text: 'Das Monitorprofil konnte nicht geladen werden.' });
            return EMPTY;
          })
        );
      })).subscribe(),
      this.tsm.sessionsStats$.subscribe(stats => {
        this.sessionsStats.set(stats);
        this.onSessionsUpdate(stats);
      }),
      this.tsm.checkedStats$.subscribe(stats => {
        this.checkedStats.set(stats);
        this.onCheckedChange(stats);
      }),
      this.tsm.commandResponses$.subscribe(commandResponse => {
        this.messages.push(this.commandResponseToMessage(commandResponse));
      }),
      this.tsm.commandResponses$
        .pipe(switchMap(() => interval(7000)))
        .subscribe(() => { this.messages.shift(); })
    ];

    this.mds.appSubTitle$.next(this.cts.getCustomText('gm_headline') ?? '');
    this.headerService.title = `${this.mds.appTitle$.value} ${this.mds.appSubTitle$.value} - ${this.groupLabel}`;
  }

  private commandResponseToMessage(commandResponse: CommandResponse): UIMessage {
    const command = this.cts.getCustomText(`gm_control_${commandResponse.commandType}`) || commandResponse.commandType;
    const successWarning = this.cts.getCustomText(`gm_control_${commandResponse.commandType}_success_warning`) || '';
    if (!commandResponse.testIds.length) {
      return {
        level: 'warning',
        text: 'Keine Tests Betroffen von: `%s`',
        customtext: 'gm_message_no_session_affected_by_command',
        replacements: [command, commandResponse.testIds.length.toString(10)]
      };
    }
    return {
      level: successWarning ? 'warning' : 'info',
      text: '`%s` an `%s` tests gesendet! %s',
      customtext: 'gm_message_command_sent_n_sessions',
      replacements: [command, commandResponse.testIds.length.toString(10), successWarning]
    };
  }

  ngOnDestroy(): void {
    this.routeChanged$.next();
    this.routeChanged$.complete();
    this.tsm.disconnect();
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  ngAfterViewChecked(): void {
    this.isScrollable = this.mainElem.nativeElement.clientHeight < this.mainElem.nativeElement.scrollHeight;
  }

  private onSessionsUpdate(stats: TestSessionSetStat): void {
    this.displayOptions.highlightSpecies = (stats.differentBookletSpecies > 1);

    if (!this.tsm.checkingOptions.enableAutoCheckAll) {
      this.displayOptions.manualChecking = true;
    }

    this.bookletStates = stats.bookletStateLabels;
  }

  private onCheckedChange(stats: TestSessionSetStat): void {
    // the test commands act on the checked sessions, so the toolbar disables them when there are none
    this.checkedSessionCount = stats.numberOfSessions;

    if (stats.differentBookletSpecies > 1) {
      this.currentlySelected = null;
    }
  }

  // eslint-disable-next-line class-methods-use-this
  trackSession = (index: number, session: TestSession): string => session.data.testId;

  setTableSorting(sort: Sort): void {
    if (!sort.active || sort.direction === '') {
      return;
    }
    this.tsm.sortBy$?.next(sort);
  }

  setDisplayOption(option: TestViewDisplayOptionKey, value: TestViewDisplayOptions[TestViewDisplayOptionKey]): void {
    if (Object.keys(this.displayOptions).includes(option)) {
      (this.displayOptions as {
        [option in TestViewDisplayOptionKey]: TestViewDisplayOptions[TestViewDisplayOptionKey]
      })[option] = value;
    }
  }

  toggleBookletStatesColumn(column: string): void {
    this.displayOptions.bookletStatesColumns =
      (this.displayOptions.bookletStatesColumns.includes(column)) ?
        this.displayOptions.bookletStatesColumns.filter(c => c !== column) :
        [...this.displayOptions.bookletStatesColumns, column].sort();
  }

  scrollDown(): void {
    this.mainElem.nativeElement.scrollTo(0, this.mainElem.nativeElement.scrollHeight);
  }

  updateScrollHint(): void {
    const elem = this.mainElem.nativeElement;
    const reachedBottom = (elem.scrollTop + elem.clientHeight === elem.scrollHeight);
    elem.classList[reachedBottom ? 'add' : 'remove']('hide-scroll-hint');
  }

  getSessionColor(session: TestSession): string {
    const stripes = (c1: string, c2: string) => `repeating-linear-gradient(45deg, ${c1}, ${c1} 10px, ${c2} 10px, ${c2} 20px)`;
    const hsl = (h: number, s: number, l: number) => `hsl(${h}, ${s}%, ${l}%)`;
    const colorful = this.displayOptions.highlightSpecies && session.booklet.species;
    const h = colorful ? (
      session.booklet.species.length *
      session.booklet.species.charCodeAt(0) *
      session.booklet.species.charCodeAt(session.booklet.species.length / 4) *
      session.booklet.species.charCodeAt(session.booklet.species.length / 4) *
      session.booklet.species.charCodeAt(session.booklet.species.length / 2) *
      session.booklet.species.charCodeAt(3 * (session.booklet.species.length / 4)) *
      session.booklet.species.charCodeAt(session.booklet.species.length - 1)
    ) % 360 : 0;

    switch (session.state) {
      case 'paused':
        return hsl(h, colorful ? 45 : 0, 90);
      case 'pending':
      case 'locked':
        return stripes(hsl(h, colorful ? 75 : 0, 95), hsl(0, 0, 92));
      case 'error':
        return stripes(hsl(h, colorful ? 75 : 0, 95), hsl(0, 30, 95));
      default:
        return hsl(h, colorful ? 75 : 0, colorful ? 95 : 100);
    }
  }

  markElement(marking: Selected): void {
    this.CurrentlyMarked = marking;
  }

  selectElement(selected: Selected): void {
    this.tsm.checkSessionsBySelection(selected);
    this.currentlySelected = selected;
  }

  finishEverythingCommand(): void {
    const scope = this.bs.accessSignal;
    this.subscriptions.push(this.messageService.showConfirmDialog({
      title: 'Testdurchführung beenden',
      content: 'Achtung! Diese Aktion sperrt und beendet sämtliche Tests dieser Sitzung.',
      confirmText: 'Ja, ich möchte die Testdurchführung beenden'
    }).pipe(
      take(1),
      filter((confirmed: boolean) => confirmed),
      tap(() => { this.isClosing = true; }),
      switchMap(() => this.tsm.commandFinishEverything()),
      delay(2000),
      takeUntil(this.routeChanged$),
      takeUntil(fromEvent(scope, 'abort')),
      finalize(() => { this.isClosing = false; })
    ).subscribe({
      next: () => { void this.router.navigateByUrl('/group-monitor'); },
      error: () => { this.messages.push({ level: 'error', customtext: '', text: 'Die Testdurchführung konnte nicht beendet werden.' }); }
    }));
  }

  testCommandGoto(): void {
    if (!this.currentlySelected?.element?.blockId) {
      this.messages.push({
        level: 'warning',
        customtext: 'gm_test_command_no_selected_block',
        text: 'Kein Zielblock ausgewählt'
      });
      return;
    }

    const selection = this.currentlySelected;
    const targets = this.tsm.checked;
    const ids = targets.map(session => session.data.testId);
    const scope = this.bs.accessSignal;
    const current = () => this.currentlySelected === selection && scope === this.bs.accessSignal && !scope.aborted &&
      JSON.stringify(this.tsm.checked.map(session => session.data.testId)) === JSON.stringify(ids);
    this.subscriptions.push((targets
      .some(testSession => isBooklet(testSession.booklet) &&
          selection.element &&
          testSession.timeLeft &&
          (testSession.timeLeft[selection.element.id] <= 0)
      ) ?
      this.initializeDialog(this.dialog.open(
        TimeRestrictionDialogComponent, {
          width: 'auto',
          data: <TimeRestrictionDialogData>{
            title:
                this.cts.getCustomText('gm_control_goto_unlock_blocks_confirm_headline'),
            content:
                this.cts.getCustomText('gm_control_goto_unlock_blocks_confirm_text'),
            confirmbuttonlabel: 'OK',
            showcancel: true,
            remainingTime: this.tsm.getMaxTimeAcrossAllSessions(selection)
          }
        }
      )).afterClosed() :
      of(1) // 1 as in 'true'
    ).pipe(
      take(1),
      filter((confirmed?: number | boolean) => !!confirmed && current()),
      switchMap(confirmed => this.tsm.testCommandGoto(selection, Number(confirmed), targets)),
      takeUntil(this.routeChanged$),
      takeUntil(fromEvent(scope, 'abort'))
    ).subscribe({
      next: () => { if (current()) this.selectNextBlock(); },
      error: () => { this.messages.push({ level: 'error', customtext: '', text: 'Der Sprung konnte nicht ausgeführt werden.' }); }
    }));
  }

  private selectNextBlock(): void {
    if (!this.displayOptions.autoselectNextBlock) return;
    if (!this.currentlySelected) return;
    if (!isBooklet(this.currentlySelected.originSession.booklet)) return;
    this.currentlySelected = {
      element: this.currentlySelected.element?.nextBlockId ?
        BookletUtil.getBlockById(
          this.currentlySelected.element.nextBlockId,
          this.currentlySelected.originSession.booklet
        ) : null,
      inversion: false,
      originSession: this.currentlySelected.originSession,
      nthClick: this.currentlySelected.nthClick
    };
  }

  unlockCommand(): void {
    this.tsm.testCommandUnlock();
  }

  toggleChecked(session: TestSession): void {
    if (!this.tsm.isChecked(session)) {
      this.tsm.checkSession(session);
    } else {
      if (session.data.testId === this.currentlySelected?.originSession?.data?.testId) {
        this.currentlySelected = null;
      }
      this.tsm.uncheckSession(session);
    }
  }

  invertChecked(event: Event): boolean {
    event.preventDefault();
    this.tsm.invertChecked();
    return false;
  }

  toggleAlwaysCheckAll(event: MatSlideToggleChange): void {
    if (this.tsm.checkingOptions.enableAutoCheckAll && event.checked) {
      // TODO not ideal - try to reset the state properly, instead of reloading the component
      this.componentUtilService.reloadComponent(true);
    } else {
      this.tsm.checkNone();
      this.displayOptions.manualChecking = true;
      this.tsm.checkingOptions.autoCheckAll = false;
      this.currentlySelected = null;
    }
  }

  toggleCheckAll(event: MatCheckboxChange): void {
    if (event.checked) {
      this.tsm.checkAll();
    } else {
      this.tsm.checkNone();
      this.currentlySelected = null;
    }
  }

  addFilter(): void {
    this.openFilterDialog();
  }

  editFilter(key: string): void {
    this.openFilterDialog(this.tsm.filterOptions[key]);
  }

  private initializeDialog<T, R>(dialog: MatDialogRef<T, R>): MatDialogRef<T, R> {
    // A zoneless overlay exposes its DOM before its scheduled first update.
    // Bind controls now so an immediate input cannot be overwritten by setup.
    dialog.componentRef?.changeDetectorRef.detectChanges();
    return dialog;
  }

  private openFilterDialog(filterEntry: TestSessionFilterListEntry | undefined = undefined) {
    const scope = this.bs.accessSignal;
    if (scope.aborted) return;
    const data = filterEntry ? filterEntry.filter : {};
    const dialogRef = this.initializeDialog(this.addFilterDialog.open(AddFilterDialogComponent, { width: 'auto', data, viewContainerRef: this.filterDialogView }));

    this.subscriptions.push(dialogRef.afterClosed().pipe(
      take(1), takeUntil(this.routeChanged$), takeUntil(fromEvent(scope, 'abort')),
      finalize(() => dialogRef.close())
    ).subscribe((newFilter: TestSessionFilter) => {
      if (!newFilter) return;
      this.tsm.filterOptions[newFilter.id] = {
        selected: true,
        filter: newFilter,
        source: filterEntry?.source || 'custom'
      };
      this.tsm.refreshFilters();
    }));
  }

  // eslint-disable-next-line class-methods-use-this
  sortFilterMenuEntries(
    a: KeyValue<string, TestSessionFilterListEntry>,
    b: KeyValue<string, TestSessionFilterListEntry>
  ): number {
    const aLevel = testSessionFilterListEntrySources.indexOf(a.value.source);
    const bLevel = testSessionFilterListEntrySources.indexOf(b.value.source);
    if (aLevel !== bLevel) return aLevel - bLevel;
    return a.value.filter.label > b.value.filter.label ? 1 : -1;
  }

  quickFilterOnUpdateModel() {
    if (!this.quickFilter) {
      this.tsm.filterOptions.quick.selected = false;
    } else {
      this.tsm.filterOptions.quick.selected = true;
      this.tsm.filterOptions.quick.filter.value = this.quickFilter;
    }

    this.tsm.refreshFilters();
  }

  toggleQuickFilterBox(): void {
    this.quickFilterBoxOpen = !this.quickFilterBoxOpen;
  }

  quickFilterOnFocusOut(): void {
    if (!this.quickFilter) this.quickFilterBoxOpen = false;
  }

  private applyProfile(p: Profile): void {
    if (isColumnOption(p.settings.blockColumn)) this.displayOptions.blockColumn = p.settings.blockColumn;
    if (isColumnOption(p.settings.unitColumn)) this.displayOptions.unitColumn = p.settings.unitColumn;
    if (isColumnOption(p.settings.groupColumn)) this.displayOptions.groupColumn = p.settings.groupColumn;
    if (isColumnOption(p.settings.bookletColumn)) this.displayOptions.bookletColumn = p.settings.bookletColumn;
    if (isViewOption(p.settings.view)) this.displayOptions.view = p.settings.view;
    if (isYesNoOption(p.settings.autoselectNextBlock)) this.displayOptions.autoselectNextBlock = p.settings.autoselectNextBlock !== 'no';

    (p.filters || [])
      .forEach((filter: TestSessionFilter, index: number) => {
        filter.id = `profile_filter:${index}`;
        this.tsm.filterOptions[filter.id] = { selected: true, filter, source: 'profile' };
      });

    this.displayOptions.bookletStatesColumns = (p.settings.bookletStatesColumns || '').split(/[\W,]+/);

    Object.entries(p.filtersEnabled || [])
      .forEach(([f, onOff]) => {
        if (this.tsm.filterOptions[f]) {
          this.tsm.filterOptions[f].selected = ['1', 'true', 'on', 'yes'].includes(onOff);
        }
      });
    this.tsm.refreshFilters();
  }
}
