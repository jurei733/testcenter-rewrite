import { Injectable, effect, inject, untracked } from '@angular/core';
import { ApplicationSettingsService } from './application-settings.service';
import { NativeMonitorSessionService } from './native-monitor/native-session.service';

/** Apply authored view settings only while a verified native actor owns a view. */
@Injectable({ providedIn: 'root' })
export class NativeThemeContext {
  private readonly session = inject(NativeMonitorSessionService);
  private readonly settings = inject(ApplicationSettingsService);
  private readonly owners = new Set<AbortSignal>();
  private binding: { scope: AbortSignal; retire: () => void } | undefined;

  constructor() {
    effect(() => {
      this.session.access(); this.session.busy(); this.session.restoring();
      untracked(() => { if (this.owners.size) this.refresh(); });
    });
  }

  activate(owner: AbortSignal): void {
    owner.throwIfAborted();
    if (!this.owners.has(owner)) {
      this.owners.add(owner);
      owner.addEventListener('abort', () => {
        this.owners.delete(owner);
        if (!this.owners.size) { this.unbind(); this.settings.clearNativeTheme(); }
      }, { once: true });
    }
    this.refresh();
  }

  private unbind(): void {
    if (this.binding) this.binding.scope.removeEventListener('abort', this.binding.retire);
    this.binding = undefined;
  }

  private refresh(): void {
    const scope = this.session.accessSignal;
    if (this.binding?.scope !== scope) {
      this.unbind();
      const retire = () => {
        if (this.binding?.scope === scope) { this.unbind(); this.settings.setNativeTheme(); }
      };
      this.binding = { scope, retire };
      scope.addEventListener('abort', retire, { once: true });
    }
    const viewSettings = this.session.access()?.viewSettings;
    this.settings.setNativeTheme(
      scope.aborted || this.session.busy() || this.session.restoring()
        ? null : viewSettings && !Array.isArray(viewSettings) ? viewSettings.theme : null
    );
  }
}
