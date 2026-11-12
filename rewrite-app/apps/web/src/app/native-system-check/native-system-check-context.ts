import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom, race, fromEvent, map } from 'rxjs';
import {redactBugReportText} from '@testcenter-rewrite-app/contracts';
import type { SystemCheckQuestion, SystemCheckSpeedParameters, WorkspaceSystemCheck } from '@testcenter-rewrite-app/domain';
import { NativeMonitorSessionService, NativeMonitorHttpError } from '../native-monitor/native-session.service';
import { ApplicationSettingsService } from '../application-settings.service';
import { OriginalSystemCheckSavedDialogComponent } from '../original-system-check-saved-dialog.component';
import type {NativeNetworkConfig, NativeNetworkSpeed} from './native-system-check-network';
import {NativeSystemCheckInstallationService} from './native-system-check-installation.service';
import {NativeLoginFailureService} from '../native-login-failure.service';

export type NativeSystemCheckBinding = {
  workspaceId: string; name: string; token: string; actor: AbortSignal;
  owner: AbortController; authenticated: boolean;
};
type Configuration = {
  name: string; label: string; canSave: boolean; skipNetwork: boolean; hasUnit: boolean;
  questions: SystemCheckQuestion[]; downloadSpeed: WireSpeed; uploadSpeed: WireSpeed;
  customTexts: Record<string, {key: string; value: string}> | {key: string; value: string}[];
};
type WireSpeed = NativeNetworkSpeed;
// Source serializes XML package sizes as strings; its browser uses numeric
// coercion for the requests and charts. Keep that conversion at this boundary.
const speedParameters = (wire: WireSpeed): SystemCheckSpeedParameters => ({
  ...wire, sequenceSizes: Array.isArray(wire.sequenceSizes) ? wire.sequenceSizes.map(Number) : []
});
type Unit = {key?: string; label?: string; def: string; player: string; player_id: string};

/** A route owns its native actor, requests, dialogs and delayed navigation. */
@Injectable()
export class NativeSystemCheckContext {
  readonly session = inject(NativeMonitorSessionService);
  private readonly router = inject(Router);
  private readonly dialogs = inject(MatDialog);
  private readonly settings = inject(ApplicationSettingsService);
  private readonly installation=inject(NativeSystemCheckInstallationService);
  private readonly failure=inject(NativeLoginFailureService);
  private readonly parameters = signal<{workspaceId: string; name: string; step: string} | null>(null);
  private readonly view = new AbortController();
  private readonly networkConfigs = new WeakMap<NativeSystemCheckBinding, NativeNetworkConfig>();
  readonly bindings = signal<NativeSystemCheckBinding[]>([]);
  readonly requestedStep = signal('w');
  readonly problem = signal('');
  private verifyTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    effect(() => {
      const params = this.parameters(), access = this.session.access();
      const pending = this.session.busy() || this.session.restoring();
      untracked(() => {
        if (!params || this.view.signal.aborted) return;
        const current = this.bindings()[0];
        if (current && !this.current(current)) { this.retire(); void this.exit(); return; }
        if (pending) return;
        if (current?.workspaceId === params.workspaceId && current.name === params.name) {
          this.requestedStep.set(params.step); return;
        }
        this.retire(); this.problem.set('');
        if (params.step !== 'w') { void this.exit(); return; }
        if (!/^[1-9][0-9]*$/.test(params.workspaceId) || !params.name || /[\/\\\u0000-\u001f\u007f]/.test(params.name)) {
          this.problem.set('Ungültiger Systemcheck.'); return;
        }
        const claim = access?.claims.sysCheck?.find(item => item.workspaceId === params.workspaceId && item.id === params.name);
        if (access && (!claim || access.flags.includes('codeRequired'))) {
          this.problem.set('Diese Anmeldung ist für den gewählten Systemcheck nicht berechtigt.'); return;
        }
        const binding: NativeSystemCheckBinding = {
          workspaceId: params.workspaceId, name: params.name, token: access?.token ?? '',
          authenticated: !!access, actor: this.session.accessSignal, owner: new AbortController()
        };
        binding.actor.addEventListener('abort', () => {
          binding.owner.abort();
          if (this.bindings()[0] === binding) { this.bindings.set([]); void this.exit(); }
        }, {once: true, signal: binding.owner.signal});
        this.requestedStep.set('w'); this.bindings.set([binding]); this.scheduleVerification(binding);
      });
    });
  }

  configure(workspaceId: string, name: string, step: string) { this.parameters.set({workspaceId, name, step}); }
  get directReports():boolean{return this.installation.loginRequired()!==false;}
  current(binding: NativeSystemCheckBinding): boolean {
    return !this.view.signal.aborted && !binding.owner.signal.aborted && !binding.actor.aborted && binding.actor === this.session.accessSignal;
  }
  private path(binding: NativeSystemCheckBinding) {
    return `/workspace/${encodeURIComponent(binding.workspaceId)}/sys-check/${encodeURIComponent(binding.name)}`;
  }
  private retireExpired(binding: NativeSystemCheckBinding, error: unknown): void {
    if (binding.authenticated && this.current(binding) && error instanceof NativeMonitorHttpError && error.status === 410) {
      this.session.clear();
    }
  }
  private async read(binding: NativeSystemCheckBinding, method: string, path: string, body?: unknown) {
    binding.owner.signal.throwIfAborted();
    try {
      const text = await this.session.text(method, path, body, binding.token, false, binding.owner.signal);
      if (!this.current(binding)) throw new DOMException('Systemcheck view retired.', 'AbortError');
      return text;
    } catch (error) { this.retireExpired(binding, error); throw error; }
  }
  private request(binding: NativeSystemCheckBinding, method: string, suffix: string, body?: unknown) {
    return this.read(binding, method, this.path(binding) + suffix, body);
  }
  async load(binding: NativeSystemCheckBinding): Promise<WorkspaceSystemCheck> {
    // Source loads public configuration independently from the application-mode
    // lookup. An unknown mode keeps its private report default; the server
    // still checks every save against the current actor and configuration.
    const config = JSON.parse(await this.request(binding, 'GET', '')) as Configuration;
    const unit = config.hasUnit ? JSON.parse(await this.request(binding, 'GET', '/unit-and-player')) as Unit : null;
    this.networkConfigs.set(binding, config);
    binding.owner.signal.addEventListener('abort', () => this.networkConfigs.delete(binding), {once: true});
    return {
      checkId: config.name, displayLabel: config.label, sourcePackageId: '',
      canSave: config.canSave, skipNetwork: config.skipNetwork,
      questions: config.questions, downloadSpeed: speedParameters(config.downloadSpeed), uploadSpeed: speedParameters(config.uploadSpeed),
      customTexts: Object.fromEntries(Object.values(config.customTexts).map(item => [item.key, item.value])),
      unit: unit ? {unitKey: unit.key ?? config.name, displayLabel: unit.label ?? config.label, playerKey: unit.player_id, playerHtml: unit.player,
        unitDefinition: unit.def, unitDefinitionType: unit.def.trimStart().startsWith('<') ? 'application/xml' : 'application/json'} : null
    };
  }
  async serverTime(binding: NativeSystemCheckBinding): Promise<{timestamp: number; timezone: string}> {
    return JSON.parse(await this.read(binding, 'GET', '/system/time'));
  }
  network(binding: NativeSystemCheckBinding): NativeNetworkConfig {
    const config = this.networkConfigs.get(binding);
    if (!config || !this.current(binding)) throw new DOMException('Systemcheck view retired.', 'AbortError');
    return config;
  }
  async networkError(binding: NativeSystemCheckBinding, error: Error): Promise<void> {
    const {NativeLoginErrorDialogComponent} = await import('../native-login-error-dialog.component');
    if (!this.current(binding)) return;
    const ref = this.dialogs.open(NativeLoginErrorDialogComponent, {
      panelClass: 'original-native-login-error-dialog', disableClose: true, autoFocus: 'dialog',
      data: {error: {type: 'script', label: `Programmfehler: ${error.name}`, description: redactBugReportText(error.message), details: ''},
        url: redactBugReportText(window.location.href), timestamp: Date.now(), reload: () => {if (this.current(binding)) window.location.reload();}}
    });
    const retire = () => {ref.componentRef?.location.nativeElement.remove(); ref.close();};
    binding.owner.signal.addEventListener('abort', retire, {once: true});
    ref.afterClosed().subscribe(() => binding.owner.signal.removeEventListener('abort', retire));
    if (!this.current(binding)) retire();
  }
  navigate(binding: NativeSystemCheckBinding, step: string) {
    if (this.current(binding)) void this.router.navigate(['/check', binding.workspaceId, binding.name, step]);
  }
  exit() { return this.router.navigate(['/native-start']); }

  async save(binding: NativeSystemCheckBinding, body: unknown): Promise<void> {
    try{await this.request(binding, 'PUT', '/report', body);}
    catch(error){
      if(this.current(binding)&&error instanceof NativeMonitorHttpError)await this.failure.show(error,binding.owner.signal,
        error.status===403?{label:'Falsches Kennwort',description:'Bitte geben Sie unten das Kennwort ein, das Sie von der Projektleitung erhalten haben!'}:undefined);
      throw error;
    }
    if (!this.current(binding)) return;
    const ref = this.dialogs.open(OriginalSystemCheckSavedDialogComponent, {
      panelClass: 'original-system-check-saved-dialog', autoFocus: 'dialog',
      ariaLabelledBy: 'globalConfirmationTitle', ariaDescribedBy: 'globalConfirmationMessage',
      data: {title: 'Bericht gespeichert', message: 'Der Bericht wurde erfolgreich gespeichert. Sie werden nach der Bestätigung weitergeleitet.',
        safeMode: this.settings.effectiveThemeName() === 'Primar'}
    });
    const retire = () => { ref.componentRef?.location.nativeElement.remove(); ref.close(); };
    binding.owner.signal.addEventListener('abort', retire, {once: true});
    try {
      await firstValueFrom(race(ref.afterClosed(), fromEvent(binding.owner.signal, 'abort').pipe(map(() => undefined))));
      if (!this.current(binding)) return;
      await new Promise<void>(resolve => {
        const finish = () => { clearTimeout(timer); binding.owner.signal.removeEventListener('abort', finish); resolve(); };
        const timer = setTimeout(finish, 500);
        binding.owner.signal.addEventListener('abort', finish, {once: true});
      });
      if (this.current(binding)) await this.exit();
    } finally { binding.owner.signal.removeEventListener('abort', retire); retire(); }
  }
  private scheduleVerification(binding: NativeSystemCheckBinding): void {
    if (!binding.authenticated || !this.current(binding)) return;
    this.verifyTimer = setTimeout(async () => {
      this.verifyTimer = undefined;
      try { await this.session.verifyAccess(binding.owner.signal); }
      catch (error) { this.retireExpired(binding, error); /* Transient transport failures retain their existing scope. */ }
      if (this.bindings()[0] === binding) this.scheduleVerification(binding);
    }, 5000);
  }
  private retire() {
    if (this.verifyTimer !== undefined) clearTimeout(this.verifyTimer);
    this.verifyTimer = undefined;
    const bindings = this.bindings(); this.bindings.set([]);
    for (const binding of bindings) binding.owner.abort();
  }
  ngOnDestroy() { this.view.abort(); this.retire(); }
}
