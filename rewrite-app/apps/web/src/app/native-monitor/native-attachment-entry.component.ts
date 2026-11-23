import {Component, inject} from '@angular/core';
import {RouterLink, RouterOutlet} from '@angular/router';
import {MatToolbar} from '@angular/material/toolbar';
import {ApplicationSettingsService} from '../application-settings.service';
import {InterfaceModeService} from '../interface-mode.service';
import {NativeAssetContext} from '../native-asset-context.service';
import {NativePublicHeaderService} from '../native-public-header.service';
import {NativeThemeContext} from '../native-theme-context.service';
import {NativeAttachmentContext} from './native-attachment-context';

@Component({
  selector: 'app-native-attachment-entry',
  providers: [NativeAttachmentContext],
  imports: [MatToolbar, RouterLink, RouterOutlet],
  styleUrls: ['./native-monitor-entry.component.css', '../original-login-theme.scss'],
  styles: `:host { color-scheme: light; } .group-label { margin: 1em 0; }`,
  template: `
    <header><mat-toolbar data-cy="header">
      <div class="side"></div>
      <div class="center">@if(header.title(); as title){<h1>{{ title }}</h1>}</div>
      <div class="side logo"><a routerLink="/native-start/starter" aria-label="Gehe zur Startseite">
        <img [src]="settings.assetUrl('logo', settings.settings().mainLogo)" data-cy="logo" alt="Logo der Anwendung" />
      </a></div>
    </mat-toolbar></header>
    @if (context.claim(); as claim) {
      <p class="group-label">{{ settings.settings().appTitle }} - {{ claim.label }}</p>
      <router-outlet />
    } @else {
      <p role="alert">Diese Gruppe ist nicht für die Anhangsverwaltung freigegeben.</p>
    }
  `
})
export class NativeAttachmentEntryComponent {
  readonly settings = inject(ApplicationSettingsService);
  readonly context = inject(NativeAttachmentContext);
  readonly header = inject(NativePublicHeaderService);
  private readonly owner = new AbortController();

  constructor() {
    inject(InterfaceModeService).select('original');
    inject(NativeThemeContext).activate(this.owner.signal);
    inject(NativeAssetContext).activate(this.owner.signal);
  }

  ngOnDestroy(): void { this.owner.abort(); }
}
