import { Component, inject } from '@angular/core';
import { MatCard, MatCardContent } from '@angular/material/card';

import { BrowserCompatibilityService } from './browser-compatibility.service';
import { NativeMonitorIconComponent as MatIcon } from './native-monitor/native-monitor-icon.component';

// Adapted from IQB Testcenter 19's login. See ORIGINAL-UI-LICENSE.txt.
@Component({
  selector: 'app-native-login-browser-notice',
  standalone: true,
  imports: [MatCard, MatCardContent, MatIcon],
  // Anonymous entry must not inherit another actor's customized warning text.
  providers: [BrowserCompatibilityService],
  template: `
    @if (browser.originalWarning; as warning) {
      <mat-card class="help-box">
        <mat-icon svgIcon="warning" />
        <mat-card-content>{{ warning.message }}</mat-card-content>
      </mat-card>
    }
  `,
  styles: `
    :host { display: contents; }
    .help-box {
      display: flex;
      flex-direction: row;
      justify-content: start;
      align-items: center;
      padding: 10px 10px 10px 24px;
      border: 1px solid var(--mat-sys-primary);
      border-radius: 10px;
      width: 80%;
      --mat-card-elevated-container-color: var(--mat-sys-surface);
    }
    mat-icon {
      width: 5%;
      height: 100%;
      color: var(--mat-sys-primary);
      flex-shrink: 0;
    }
  `
})
export class NativeLoginBrowserNoticeComponent {
  readonly browser = inject(BrowserCompatibilityService);
}
