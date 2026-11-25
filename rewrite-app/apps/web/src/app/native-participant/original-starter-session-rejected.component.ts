import { Component, inject, type AfterViewInit, type OnDestroy } from '@angular/core';
import { MatDialog, type MatDialogRef } from '@angular/material/dialog';
import { MatToolbar } from '@angular/material/toolbar';
import { Router } from '@angular/router';

import { ApplicationSettingsService } from '../application-settings.service';
import { InterfaceModeService } from '../interface-mode.service';
import { NativeLoginErrorDialogComponent, type NativeErrorDialogData } from '../native-login-error-dialog.component';
import { NativeMonitorIconComponent as MatIcon } from '../native-monitor/native-monitor-icon.component';
import { OriginalOverlayStylesComponent } from '../original-overlay-styles.component';
import { AppError } from './app.interfaces';
import { OriginalStarterSessionRejection } from './original-participant-bookmark';

@Component({
  selector: 'app-original-starter-session-rejected',
  imports: [MatToolbar, MatIcon, OriginalOverlayStylesComponent],
  styleUrls: ['../native-monitor/native-monitor-entry.component.css', '../original-login-theme.scss'],
  template: `
    <app-original-overlay-styles />
    <header>
      <mat-toolbar data-cy="header">
        <div class="side"><span class="account" aria-hidden="true"><mat-icon svgIcon="person" /></span></div>
        <div class="center"><h1>Übersicht</h1></div>
        <div class="side logo">
          @if (settings.settings().assetAssignments.logo) {
            <img [src]="settings.assetUrl('logo')" alt="Logo der Anwendung" />
          }
        </div>
      </mat-toolbar>
    </header>
    <main class="native-login-outlet">
      <div class="intro">
        @if (settings.settings().assetAssignments.starterCompanion) {
          <img class="companion" [src]="settings.assetUrl('starterCompanion')" alt="" />
        } @else {
          <span class="companion"></span>
        }
        <div class="copy">
          <p><strong>Schön, dass du da bist!</strong></p>
          <p>Komm, wir legen los. Wähle einen Teil aus.</p>
        </div>
      </div>
    </main>
  `,
  styles: `
    .account {
      width: 40px; height: 40px; display: grid; place-items: center; border-radius: 12px;
      background: var(--mat-sys-on-primary); color: var(--mat-sys-primary);
    }
    .account mat-icon { width: 24px; height: 24px; }
    main { align-items: center; color: var(--mat-sys-on-surface); }
    .intro { width: 684px; margin: 48px 0; display: flex; align-items: center; gap: 24px; }
    .companion { width: 94px; height: 94px; flex-shrink: 0; object-fit: contain; }
    .copy { display: flex; flex-direction: column; }
  `
})
export class OriginalStarterSessionRejectedComponent implements AfterViewInit, OnDestroy {
  readonly settings = inject(ApplicationSettingsService);
  private readonly router = inject(Router);
  private readonly dialogs = inject(MatDialog);
  private readonly rejection = this.router.currentNavigation()?.extras.info;
  private dialog?: MatDialogRef<NativeLoginErrorDialogComponent>;

  constructor() {
    inject(InterfaceModeService).select('original');
  }

  ngAfterViewInit(): void {
    if (!(this.rejection instanceof OriginalStarterSessionRejection)) return;
    const error = new AppError({
      type: 'session',
      code: 403,
      label: 'Sitzung nicht mehr gültig.',
      description: '',
      details: 'Die gespeicherte Sitzung ist nicht mehr gültig.',
      errorId: this.rejection.errorId
    });
    this.dialog = this.dialogs.open(NativeLoginErrorDialogComponent, {
      panelClass: 'original-native-login-error-dialog',
      backdropClass: 'original-starter-rejection-backdrop',
      disableClose: true,
      autoFocus: 'dialog',
      restoreFocus: false,
      ariaLabel: error.label,
      data: {
        error,
        url: '',
        timestamp: Date.now(),
        reload: () => {
          if (!this.dialog) return;
          window.location.replace(new URL('native-start/login', document.baseURI));
        }
      } satisfies NativeErrorDialogData
    });
  }

  ngOnDestroy(): void {
    this.dialog?.close();
    this.dialog = undefined;
  }
}
