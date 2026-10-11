import { Component, Input, isDevMode, signal } from "@angular/core";
import type { OnInit, OnDestroy, DoCheck } from "@angular/core";
import type { ParticipantCurrentRunState } from "@testcenter-rewrite-app/domain";
import { ParticipantDebugPaneComponent } from "./participant-debug-pane.component";
import { createParticipantDebugControl, type ParticipantDebugControl } from "./participant-debug-control";
import { createParticipantDebugLog } from "./participant-debug-log";

@Component({ selector: "app-participant-debug-launcher", standalone: true, imports: [ParticipantDebugPaneComponent],
  template: `@defer (when enabled()) { @if (enabled() && state && control) {
    <app-participant-debug-pane [state]="state" [control]="control" [activeWindows]="activeWindows()" />
  } }` })
export class ParticipantDebugLauncherComponent implements OnInit, OnDestroy, DoCheck {
  @Input() state: ParticipantCurrentRunState | null = null;
  private log: ReturnType<typeof createParticipantDebugLog> | null = null;
  readonly enabled = signal(false);
  readonly activeWindows = signal<string[]>([]);
  control: ParticipantDebugControl | null = null;
  ngOnInit(): void {
    this.log = createParticipantDebugLog({ readState: () => this.state });
    this.control = createParticipantDebugControl({ readScope: () => this.state?.testRun ?? null, isProductionMode: !isDevMode(),
      changed: state => { this.enabled.set(state.enabled); this.activeWindows.set(state.activeWindows); },
      consoleCommand: args => this.log?.log(args) });
  }
  ngDoCheck(): void { this.control?.observeScope(); this.log?.observeScope(); }
  ngOnDestroy(): void { this.control?.stop(); this.log?.stop(); }
}
