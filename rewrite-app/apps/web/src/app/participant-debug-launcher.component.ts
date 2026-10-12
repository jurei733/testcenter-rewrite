import { Component, Input, inject, isDevMode, signal } from "@angular/core";
import type { OnInit, OnDestroy, DoCheck } from "@angular/core";
import type { ParticipantCurrentRunState } from "@testcenter-rewrite-app/domain";
import { ParticipantDebugPaneComponent } from "./participant-debug-pane.component";
import { createParticipantDebugControl, type ParticipantDebugControl } from "./participant-debug-control";
import { createParticipantDebugLog } from "./participant-debug-log";
import { createParticipantNativeCommands } from "./participant-native-command";
import { ParticipantViewFacade } from "./participant-view.facade";

@Component({ selector: "app-participant-debug-launcher", standalone: true, imports: [ParticipantDebugPaneComponent],
  template: `@defer (when enabled()) { @if (enabled() && state && control) {
    <app-participant-debug-pane [state]="state" [control]="control" [activeWindows]="activeWindows()" />
  } }` })
export class ParticipantDebugLauncherComponent implements OnInit, OnDestroy, DoCheck {
  @Input() state: ParticipantCurrentRunState | null = null;
  private log: ReturnType<typeof createParticipantDebugLog> | null = null;
  private native: ReturnType<typeof createParticipantNativeCommands> | null = null;
  private readonly view = inject(ParticipantViewFacade);
  readonly enabled = signal(false);
  readonly activeWindows = signal<string[]>([]);
  control: ParticipantDebugControl | null = null;
  ngOnInit(): void {
    this.log = createParticipantDebugLog({ readState: () => this.state });
    this.native = createParticipantNativeCommands({ readState: () => this.state,
      controllerStatus: () => this.view.hasControllerError ? "ERROR" : this.state?.testRun.status === "paused" ? "PAUSED" : "RUNNING",
      generation: () => this.view.consoleControllerGeneration,
      prepare: isCurrent => this.view.prepareNativeConsoleCommand(isCurrent),
      applied: (result, isCurrent) => this.view.applyNativeConsoleCommand(result, isCurrent),
      failed: error => this.view.nativeConsoleCommandFailed(error) });
    this.control = createParticipantDebugControl({ readScope: () => this.state?.testRun ?? null, isProductionMode: !isDevMode(),
      changed: state => { this.enabled.set(state.enabled); this.activeWindows.set(state.activeWindows); },
      consoleCommand: args => this.log?.log(args), nativeCommand: (keyword, args) => this.native?.command(keyword, args) });
  }
  ngDoCheck(): void { this.control?.observeScope(); this.log?.observeScope(); this.native?.observeScope(); }
  ngOnDestroy(): void { this.control?.stop(); this.log?.stop(); this.native?.stop(); }
}
