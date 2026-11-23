import {Component, inject} from '@angular/core';
import {RouterLink} from '@angular/router';
import {MatToolbar} from '@angular/material/toolbar';
import {ApplicationSettingsService} from '../application-settings.service';
import {InterfaceModeService} from '../interface-mode.service';
import {NativeAssetContext} from '../native-asset-context.service';
import {NativePublicHeaderService} from '../native-public-header.service';
import {NativeThemeContext} from '../native-theme-context.service';

/** On a cold status entry there is no test instance and no player to mount. */
@Component({
  selector: 'app-native-standalone-test-status',
  imports: [MatToolbar, RouterLink],
  styleUrls: ['../native-monitor/native-monitor-entry.component.css', '../original-login-theme.scss'],
  template: `
    <header><mat-toolbar data-cy="header">
      <div class="side"></div>
      <div class="center">@if (header.title(); as title) {<h1>{{ title }}</h1>}</div>
      <div class="side logo"><a routerLink="/native-start/starter" aria-label="Gehe zur Startseite">
        <img [src]="settings.assetUrl('logo', settings.settings().mainLogo)" data-cy="logo" alt="Logo der Anwendung" />
      </a></div>
    </mat-toolbar></header>
  `
})
export class NativeStandaloneTestStatusComponent {
  readonly settings = inject(ApplicationSettingsService);
  readonly header = inject(NativePublicHeaderService);
  private readonly owner = new AbortController();

  constructor() {
    inject(InterfaceModeService).select('original');
    inject(NativeThemeContext).activate(this.owner.signal);
    inject(NativeAssetContext).activate(this.owner.signal);
  }

  ngOnDestroy(): void { this.owner.abort(); }
}
