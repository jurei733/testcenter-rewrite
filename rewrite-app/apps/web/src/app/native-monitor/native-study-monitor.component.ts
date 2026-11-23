import {DatePipe, DecimalPipe} from '@angular/common';
import {Component, effect, inject, signal, viewChild} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {ActivatedRoute, RouterLink} from '@angular/router';
import {MatSort, MatSortHeader} from '@angular/material/sort';
import {MatTableDataSource, MatTableModule} from '@angular/material/table';
import {MatToolbar} from '@angular/material/toolbar';
import type {OriginalGroupResult} from '@testcenter-rewrite-app/contracts/original-group-results';
import {ApplicationSettingsService} from '../application-settings.service';
import {InterfaceModeService} from '../interface-mode.service';
import {NativeAssetContext} from '../native-asset-context.service';
import {NativePublicHeaderService} from '../native-public-header.service';
import {NativeThemeContext} from '../native-theme-context.service';
import {NativeMonitorSessionService} from './native-session.service';

// Study table adapted from the IQB Testcenter. See ORIGINAL-UI-LICENSE.txt.
@Component({
  selector: 'app-native-study-monitor',
  imports: [DatePipe, DecimalPipe, MatToolbar, RouterLink, MatTableModule, MatSort, MatSortHeader],
  styleUrls: ['./native-monitor-entry.component.css', '../original-login-theme.scss'],
  styles: `
    :host { color-scheme: light; }
    .study-content { flex: 1; display: flex; min-height: 0; }
    .study-panel {
      box-sizing: content-box;
      display: flex;
      flex-direction: column;
      flex: 10 0 900px;
      box-shadow: 5px 10px 20px black;
      background: white;
      min-height: 85%;
      margin: 15px;
      padding: 25px;
    }
    mat-table { height: 100%; }
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
        @if (problem(); as message) {<p role="alert">{{ message }}</p>}
        <mat-table [dataSource]="data" matSort aria-label="Studienmonitor">
          @for (column of columns; track column.key) {
            <ng-container [matColumnDef]="column.key">
              <mat-header-cell *matHeaderCellDef mat-sort-header [class.quantity]="column.key !== 'groupName'">
                {{ column.label }}
              </mat-header-cell>
              <mat-cell *matCellDef="let row" [class.quantity]="column.key !== 'groupName'">
                @switch (column.key) {
                  @case ('groupName') { {{ row.groupLabel }} }
                  @case ('numUnitsAvg') { {{ row.numUnitsAvg | number:'1.1-1' }} }
                  @case ('lastChange') { {{ row.lastChange * 1000 | date:'dd.MM.yyyy HH:mm' }} }
                  @default { {{ row[column.key] }} }
                }
              </mat-cell>
            </ng-container>
          }
          <mat-header-row *matHeaderRowDef="columnKeys" />
          <mat-row *matRowDef="let row; columns: columnKeys" />
        </mat-table>
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
  readonly problem = signal('');
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
    effect(() => { this.data.sort = this.sort() ?? null; });
    effect(onCleanup => {
      const workspace = this.params().get('workspace');
      const access = this.session.access();
      this.data.data = [];
      this.problem.set('');
      if (!workspace || !access?.claims.studyMonitor?.some(claim => claim.id === workspace) || access.flags.includes('codeRequired')) {
        this.problem.set('Dieser Arbeitsbereich ist für Sie nicht freigegeben.');
        return;
      }
      const view = new AbortController();
      const scope = AbortSignal.any([view.signal, this.owner.signal, this.session.accessSignal]);
      let timer: ReturnType<typeof setTimeout> | undefined;
      scope.addEventListener('abort', () => {
        clearTimeout(timer);
        this.data.data = [];
      }, {once: true});
      onCleanup(() => view.abort());

      const load = async () => {
        try {
          const response = await this.session.text('GET', '/workspace/' + encodeURIComponent(workspace) + '/studyresults',
            undefined, access.token, false, scope);
          scope.throwIfAborted();
          this.data.data = JSON.parse(response) as OriginalGroupResult[];
          this.problem.set('');
        } catch {
          if (!scope.aborted) this.problem.set('Die Studienergebnisse konnten nicht geladen werden.');
        } finally {
          if (!scope.aborted) timer = setTimeout(load, 10_000);
        }
      };
      void load();
    });
  }

  ngOnDestroy(): void { this.owner.abort(); }
}
