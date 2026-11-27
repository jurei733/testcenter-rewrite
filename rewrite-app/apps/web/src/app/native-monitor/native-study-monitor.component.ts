import {DatePipe, DecimalPipe} from '@angular/common';
import {Component, computed, effect, inject, signal, untracked, viewChild} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {ActivatedRoute, RouterLink} from '@angular/router';
import {MatSort, MatSortHeader} from '@angular/material/sort';
import {MatTableDataSource, MatTableModule} from '@angular/material/table';
import {MatToolbar} from '@angular/material/toolbar';
import {MatButton} from '@angular/material/button';
import type {OriginalGroupResult} from '@testcenter-rewrite-app/contracts/original-group-results';
import {ApplicationSettingsService} from '../application-settings.service';
import {InterfaceModeService} from '../interface-mode.service';
import {NativeAssetContext} from '../native-asset-context.service';
import {NativePublicHeaderService} from '../native-public-header.service';
import {NativeThemeContext} from '../native-theme-context.service';
import {readOriginalGroupResultRows} from '../original-group-result-rows';
import {NativeMonitorHttpError, NativeMonitorSessionService} from './native-session.service';

// Study table adapted from the IQB Testcenter. See ORIGINAL-UI-LICENSE.txt.
@Component({
  selector: 'app-native-study-monitor',
  imports: [DatePipe, DecimalPipe, MatToolbar, MatButton, RouterLink, MatTableModule, MatSort, MatSortHeader],
  styleUrls: ['./native-monitor-entry.component.css', '../original-login-theme.scss'],
  styles: `
    :host { color-scheme: light; }
    .study-content { flex: 1; display: flex; min-height: 0; }
    .study-panel {
      box-sizing: content-box;
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
      box-shadow: 5px 10px 20px black;
      background: white;
      min-height: 85%;
      margin: 15px;
      padding: 25px;
    }
    .study-table { flex: 1; min-height: 0; overflow: auto; }
    .study-table:focus-visible { outline: 2px solid var(--mat-sys-primary); outline-offset: -2px; }
    mat-table { min-width: 720px; }
    mat-header-row { background: white; }
    .mat-column-groupName { min-width: 150px; overflow-wrap: anywhere; background: white; }
    .study-status { margin: 0; }
    .study-status:not(:empty) { margin-bottom: 12px; }
    .study-retry { flex: 0 0 auto; margin-bottom: 12px; }
    @media (max-width: 720px) {
      .study-panel { margin: 8px; padding: 12px; }
    }
    .quantity { justify-content: center; }
  `,
  template: `
    <header><mat-toolbar data-cy="header">
      <div class="side"></div>
      <div class="center"><h1>Studienmonitor</h1></div>
      <div class="side logo"><a routerLink="/native-start/starter" aria-label="Gehe zur Startseite">
        <img [src]="settings.assetUrl('logo', settings.settings().mainLogo)" data-cy="logo" alt="Logo der Anwendung" />
      </a></div>
    </mat-toolbar></header>
    <main class="study-content">
      <section class="study-panel">
        <p class="study-status" role="status">{{ resultStatus() }}</p>
        @if (status() === 'retry') {
          <div class="study-retry">
            <p role="alert">
              Die Studienergebnisse konnten nicht geladen werden.
              @if (data.data.length) { Die Anzeige enthält den letzten bestätigten Stand. }
            </p>
            <button mat-stroked-button type="button" [disabled]="refreshing()" (click)="retry()">Erneut laden</button>
          </div>
        } @else if (status() === 'signed-out') {
          <p role="alert">Melden Sie sich an, um die Studienergebnisse zu sehen.</p>
          <a mat-button routerLink="/native-start/login">Zur Anmeldung</a>
        } @else if (status() === 'denied') {
          <p role="alert">Dieser Arbeitsbereich ist für Sie nicht freigegeben.</p>
        }
        <div class="study-table" role="region" aria-label="Studienergebnisse" tabindex="0" [attr.aria-busy]="refreshing()">
          <mat-table [dataSource]="data" [trackBy]="trackGroup" matSort aria-label="Studienmonitor">
            @for (column of columns; track column.key) {
              <ng-container [matColumnDef]="column.key" [sticky]="column.key === 'groupName'">
                <mat-header-cell *matHeaderCellDef mat-sort-header [class.quantity]="column.key !== 'groupName'">
                  {{ column.label }}
                </mat-header-cell>
                <mat-cell *matCellDef="let row" [class.quantity]="column.key !== 'groupName'">
                  @switch (column.key) {
                    @case ('groupName') { {{ row.groupLabel }} }
                    @case ('numUnitsAvg') { {{ row.numUnitsAvg | number:'1.1-1' }} }
                    @case ('lastChange') { @if (row.lastChange > 0) { {{ row.lastChange * 1000 | date:'dd.MM.yyyy HH:mm' }} } }
                    @default { {{ row[column.key] }} }
                  }
                </mat-cell>
              </ng-container>
            }
            <mat-header-row *matHeaderRowDef="columnKeys; sticky: true" />
            <mat-row *matRowDef="let row; columns: columnKeys" />
          </mat-table>
        </div>
      </section>
    </main>
  `
})
export class NativeStudyMonitorComponent {
  readonly settings = inject(ApplicationSettingsService);
  readonly columns = [
    {key: 'groupName', label: 'Login-Gruppe'},
    {key: 'bookletsStarted', label: 'Testhefte gestartet'},
    {key: 'numUnitsMin', label: 'Aufgaben min'},
    {key: 'numUnitsMax', label: 'Aufgaben max'},
    {key: 'numUnitsAvg', label: 'Aufgaben Mittelwert'},
    {key: 'lastChange', label: 'Letzte Änderung'}
  ] as const;
  readonly columnKeys = this.columns.map(column => column.key);
  readonly data = new MatTableDataSource<OriginalGroupResult>();
  readonly trackGroup = (_index: number, row: OriginalGroupResult) => row.groupName;
  readonly status = signal<'loading'|'empty'|'current'|'retry'|'denied'|'signed-out'>('loading');
  readonly resultStatus = computed(() => {
    switch (this.status()) {
      case 'loading': return 'Studienergebnisse werden geladen.';
      case 'empty': return 'In diesem Arbeitsbereich wurde noch kein Testheft gestartet.';
      default: return '';
    }
  });
  readonly refreshing = signal(false);
  private retryCurrent?: () => void;
  private readonly sort = viewChild(MatSort);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, {initialValue: this.route.snapshot.paramMap});
  private readonly session = inject(NativeMonitorSessionService);
  private readonly owner = new AbortController();

  constructor() {
    inject(InterfaceModeService).select('original');
    inject(NativePublicHeaderService).setTitle('Studienmonitor');
    inject(NativeThemeContext).activate(this.owner.signal);
    inject(NativeAssetContext).activate(this.owner.signal);
    const compareGroupLabels = new Intl.Collator('de-DE', {numeric: true, sensitivity: 'base'}).compare;
    const sortResults = this.data.sortData.bind(this.data);
    this.data.sortData = (rows, sort) => {
      if (sort.active !== 'groupName' || !sort.direction) return sortResults(rows, sort);
      const direction = sort.direction === 'asc' ? 1 : -1;
      return rows.sort((left, right) => direction * compareGroupLabels(left.groupLabel, right.groupLabel));
    };
    effect(() => { this.data.sort = this.sort() ?? null; });
    effect(onCleanup => {
      const workspace = this.params().get('workspace');
      const access = this.session.access();
      this.data.data = [];
      this.status.set('loading');
      this.refreshing.set(false);
      if (!workspace || !access?.claims.studyMonitor?.some(claim => claim.id === workspace) || access.flags.includes('codeRequired')) {
        this.status.set(access ? 'denied' : 'signed-out');
        return;
      }
      const view = new AbortController();
      const scope = AbortSignal.any([view.signal, this.owner.signal, this.session.accessSignal]);
      let timer: ReturnType<typeof setTimeout> | undefined;
      scope.addEventListener('abort', () => {
        clearTimeout(timer);
        this.data.data = [];
        this.retryCurrent = undefined;
      }, {once: true});
      onCleanup(() => view.abort());

      const load = async () => {
        if (scope.aborted || this.refreshing()) return;
        clearTimeout(timer);
        this.refreshing.set(true);
        try {
          const response = await this.session.monitorSnapshot('/workspace/' + encodeURIComponent(workspace) + '/studyresults', scope);
          scope.throwIfAborted();
          const rows = readOriginalGroupResultRows(JSON.parse(response));
          this.data.data = rows;
          this.status.set(rows.length ? 'current' : 'empty');
        } catch (error) {
          if (scope.aborted) return;
          if (error instanceof NativeMonitorHttpError && error.status === 404) {
            this.data.data = [];
          }
          this.status.set('retry');
        } finally {
          if (!scope.aborted) {
            this.refreshing.set(false);
            timer = setTimeout(load, 10_000);
          }
        }
      };
      this.retryCurrent = () => { void load(); };
      void untracked(load);
    });
  }

  retry(): void { this.retryCurrent?.(); }

  ngOnDestroy(): void { this.owner.abort(); }
}
