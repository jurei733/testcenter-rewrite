import { Component, effect, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatToolbar } from '@angular/material/toolbar';
import { NativeSystemCheckContext } from './native-system-check-context';
import { NativeAssetContext } from '../native-asset-context.service';
import { NativeThemeContext } from '../native-theme-context.service';
import { ApplicationSettingsService } from '../application-settings.service';
import { InterfaceModeService } from '../interface-mode.service';
import { SystemCheckViewComponent } from '../system-check-view.component';
import { OriginalOverlayStylesComponent } from '../original-overlay-styles.component';
import { NativeLoginFailureService } from '../native-login-failure.service';
import { NativePublicHeaderService } from '../native-public-header.service';

@Component({
  selector: 'app-native-system-check-entry', standalone: true,
  providers: [NativeSystemCheckContext,NativeLoginFailureService],
  imports: [MatToolbar, RouterLink, SystemCheckViewComponent, OriginalOverlayStylesComponent],
  styleUrls: ['../native-monitor/native-monitor-entry.component.css', '../original-login-theme.scss'],
  template: `<app-original-overlay-styles />
    <header><mat-toolbar data-cy="header"><div class="side"></div>
      <div class="center"><h1>Systemcheck</h1></div>
      <div class="side logo"><a routerLink="/native-start" aria-label="Gehe zur Startseite"><img [src]="settings.assetUrl('logo',settings.settings().mainLogo)" alt="Logo der Anwendung" /></a></div>
    </mat-toolbar></header>
    @if(context.problem()){<p role="alert" class="native-error">{{context.problem()}}</p>}
    <main class="native-login-outlet">@for(binding of context.bindings();track binding){<app-system-check-view />}</main>`
})
export class NativeSystemCheckEntryComponent {
  readonly context = inject(NativeSystemCheckContext);
  readonly settings = inject(ApplicationSettingsService);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, {initialValue: this.route.snapshot.paramMap});
  private readonly owner = new AbortController();
  constructor() {
    inject(NativePublicHeaderService).setTitle('Systemcheck');
    inject(NativeAssetContext).activate(this.owner.signal);
    inject(NativeThemeContext).activate(this.owner.signal);
    inject(InterfaceModeService).select('original');
    effect(() => {
      const params = this.params();
      this.context.configure(params.get('workspaceId') ?? '', params.get('checkName') ?? '', params.get('step') ?? 'w');
    });
  }
  ngOnDestroy() { this.owner.abort(); }
}
