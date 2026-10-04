import { Component, ElementRef, Input, ViewChild, signal } from "@angular/core";
import type { AfterViewInit, OnDestroy } from "@angular/core";
import { NgIf } from "@angular/common";
import type { SystemCheckViewComponent } from "./system-check-view.component";
import { VeronaPlayerHostComponent } from "./verona-player-host.component";
import { OriginalSystemCheckPlayerControlsComponent } from "./original-system-check-player-controls.component";

// Adapted from IQB Testcenter 19 sys-check/unit-check (MIT).
// See assets/ORIGINAL-UI-LICENSE.txt. The original task surface uses the same
// guarded Verona iframe and saved response as the Rewrite layout, not a second
// Player implementation or another persisted report state.
@Component({
  selector: "app-original-system-check-unit", standalone: true,
  imports: [NgIf, VeronaPlayerHostComponent, OriginalSystemCheckPlayerControlsComponent],
  template: `
    <ng-container *ngIf="view.systemCheck?.unit as unit">
      <div #title class="unit-title" id="originalSystemCheckUnitTitle" *ngIf="!unitError">
        <h2>{{ view.customText('syscheck_unitPrompt', 'Bitte prüfen Sie die folgenden Aufgaben-Elemente') }}</h2>
        <div class="mat-divider mat-divider-horizontal" role="separator" aria-orientation="horizontal"></div>
      </div>
      <div class="unit-frame" [class.is-error]="!!unitError" [style.top.px]="frameOffset()" id="originalSystemCheckUnit">
        <app-verona-player-host #player *ngIf="unit.playerHtml && unit.unitDefinition; else unavailable"
          [originalSystemCheckUi]="true" [playerHtml]="unit.playerHtml!" [playerKey]="unit.playerKey || 'system-check-player'"
          testRunId="system-check" [unitKey]="unit.unitKey" [unitTitle]="unit.displayLabel"
          [unitDefinition]="unit.unitDefinition!" [unitDefinitionType]="unit.unitDefinitionType || ''"
          [savedResponse]="view.unitResponse" [canComplete]="true" logPolicy="disabled"
          [pageNavigationPrompt]="view.customText('login_pagesNaviPrompt', '')" (responseChange)="view.onUnitResponse($event)"
          (viewStateChange)="unitError = player.errorMessage">
          <app-original-system-check-player-controls original-system-check-page-controls [view]="player" />
        </app-verona-player-host>
        <ng-template #unavailable><p role="alert">Test-Aufgabe konnte nicht angezeigt werden: Unit oder Player ist nicht verfügbar.</p></ng-template>
      </div>
    </ng-container>
  `,
  styles: [`
    :host { display:block; min-width:0; }
    .unit-title h2 { font-weight:normal; text-align:center; background:white; margin:0; padding:5px; }
    .mat-divider { display:block; margin:0; border-top-style:solid; border-top-color:var(--mat-divider-color, var(--mat-sys-outline-variant)); border-top-width:var(--mat-divider-width, 1px); }
    .unit-frame { position:fixed; left:0; right:0; top:191px; bottom:0; padding:0; background:white; }
    .unit-frame.is-error { position:static; }
    app-verona-player-host { display:block; height:100%; }
  `],
  styleUrl: "./original-login-theme.scss"
})
export class OriginalSystemCheckUnitComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) view!: SystemCheckViewComponent;
  @ViewChild("title") private title?: ElementRef<HTMLElement>;
  unitError = "";
  readonly frameOffset = signal(191);
  private resizeObserver: ResizeObserver | null = null;
  private layoutFrame = 0;
  ngAfterViewInit(): void {
    const title = this.title?.nativeElement;
    if (!title) return;
    this.resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(this.layoutFrame);
      this.layoutFrame = requestAnimationFrame(() => this.frameOffset.set(Math.max(191, Math.ceil(title.getBoundingClientRect().bottom))));
    });
    this.resizeObserver.observe(title);
  }
  ngOnDestroy(): void { this.resizeObserver?.disconnect(); cancelAnimationFrame(this.layoutFrame); }
}
