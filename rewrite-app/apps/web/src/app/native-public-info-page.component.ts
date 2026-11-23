import {Component, inject} from '@angular/core';
import {ActivatedRoute, RouterLink} from '@angular/router';
import {MatToolbar} from '@angular/material/toolbar';
import {ApplicationSettingsService} from './application-settings.service';
import {InterfaceModeService} from './interface-mode.service';
import {NativeAssetContext} from './native-asset-context.service';
import {NativePublicHeaderService} from './native-public-header.service';
import {NativeThemeContext} from './native-theme-context.service';
import {originalNoticeDefaults} from './original-notice-defaults';

// Public information layout and unset defaults adapted from the IQB Testcenter.
// See ORIGINAL-UI-LICENSE.txt.
const notices = {
  'legal-notice': {
    title: 'Rechtliches',
    key: 'legalNoticeHtml',
    empty: originalNoticeDefaults.legalNoticeHtml
  },
  privacy: {
    title: 'Datenschutz',
    key: 'privacyNotice',
    empty: originalNoticeDefaults.privacyNotice
  },
  accessibility: {
    title: 'Barrierefreiheit',
    key: 'accessibilityNotice',
    empty: originalNoticeDefaults.accessibilityNotice
  }
} as const;

@Component({
  selector: 'app-native-public-info-page',
  imports: [MatToolbar, RouterLink],
  styleUrls: ['./native-monitor/native-monitor-entry.component.css', './original-login-theme.scss'],
  styles: `
    :host { color-scheme: light; background: var(--mat-sys-surface); color: var(--mat-sys-on-surface); }
    main { flex: 1; display: flex; flex-direction: column; align-items: center; overflow: auto; }
    .body-text { font-size: larger; }
  `,
  template: `
    <header><mat-toolbar data-cy="header">
      <div class="side"></div>
      <div class="center"><h1>{{ notice.title }}</h1></div>
      <div class="side logo">
        <a routerLink="/native-start/starter" aria-label="Gehe zur Startseite">
          <img [src]="settings.assetUrl('logo', settings.settings().mainLogo)" data-cy="logo" alt="Logo der Anwendung" />
        </a>
      </div>
    </mat-toolbar></header>
    <main><div class="body-text" [innerHTML]="settings.settings()[notice.key] || notice.empty"></div></main>
  `
})
export class NativePublicInfoPageComponent {
  readonly settings = inject(ApplicationSettingsService);
  readonly notice = notices[inject(ActivatedRoute).snapshot.data['notice'] as keyof typeof notices];
  private readonly owner = new AbortController();

  constructor() {
    inject(InterfaceModeService).select('original');
    inject(NativePublicHeaderService).setTitle(this.notice.title);
    inject(NativeThemeContext).activate(this.owner.signal);
    inject(NativeAssetContext).activate(this.owner.signal);
  }

  ngOnDestroy(): void { this.owner.abort(); }
}
