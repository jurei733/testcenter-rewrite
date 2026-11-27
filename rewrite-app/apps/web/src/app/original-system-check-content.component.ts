import { Component, Input } from "@angular/core";
import { NgFor, NgIf } from "@angular/common";
import { MatFabButton } from "@angular/material/button";
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from "@angular/material/card";
import { MatTooltip } from "@angular/material/tooltip";
import type { SystemCheckViewComponent } from "./system-check-view.component";
import { NativeMonitorIconComponent } from "./native-monitor/native-monitor-icon.component";
import { OriginalSystemCheckQuestionnaireComponent } from "./original-system-check-questionnaire.component";
import { OriginalSystemCheckNetworkComponent } from "./original-system-check-network.component";
import { OriginalSystemCheckUnitComponent } from "./original-system-check-unit.component";
import { OriginalSystemCheckReportComponent } from "./original-system-check-report.component";

// Adapted from IQB Testcenter 19 sys-check/welcome and sys-check.component (MIT).
// See assets/ORIGINAL-UI-LICENSE.txt. The shared controller owns every step,
// measurement and response; this surface does not create another check state.
@Component({
  selector: "app-original-system-check-content", standalone: true,
  imports: [NgFor, NgIf, MatFabButton, MatCard, MatCardContent, MatCardHeader, MatCardTitle, MatTooltip, NativeMonitorIconComponent, OriginalSystemCheckQuestionnaireComponent, OriginalSystemCheckNetworkComponent, OriginalSystemCheckUnitComponent, OriginalSystemCheckReportComponent],
  template: `
    @if (view.systemCheck || (view.native && view.canUseSystemChecks)) {
      @let confirmationOpen = view.native?.savedReportConfirmationOpen() ?? false;
      <div class="header" [attr.inert]="confirmationOpen ? '' : null">
        <h2>Systemcheck: {{ view.systemCheck?.displayLabel ?? view.native?.label() }}</h2>
        <button id="syscheck-previous-step" matFab matTooltip="Zurück"
          matTooltipClass="original-system-check-navigation-tooltip" aria-label="Zurück"
          [disabled]="!view.systemCheck || view.stepIndex === 0 || (view.busy && !confirmationOpen) || view.networkBusy" (click)="view.previousStep()">
          <mat-icon svgIcon="keyboard_arrow_left" />
        </button>
        <button id="syscheck-next-step" matFab matTooltip="Weiter"
          matTooltipClass="original-system-check-navigation-tooltip" aria-label="Weiter"
          [disabled]="!view.systemCheck || view.nextButtonDisabled || view.networkBusy" (click)="view.nextStep()">
          <mat-icon svgIcon="keyboard_arrow_right" />
        </button>
      </div>
    }
    <ng-container *ngIf="view.systemCheck as check">
      @defer (when view.step === 'network') {
        @if (view.step === 'network') {
          <app-original-system-check-network [view]="view" />
        }
      }
      @defer (when view.step === 'questionnaire') {
        @if (view.step === 'questionnaire') {
          <app-original-system-check-questionnaire [view]="view" />
        }
      }
      @defer (when view.step === 'unit') {
        @if (view.step === 'unit') {
          <app-original-system-check-unit [view]="view" />
        }
      }
      @defer (when view.step === 'report') {
        @if (view.step === 'report') {
          <app-original-system-check-report [view]="view" />
        }
      }
      <div class="sys-check-body" *ngIf="view.step === 'welcome'" id="originalSystemCheckWelcome">
        <div class="welcome-cards">
          <mat-card appearance="raised">
            <mat-card-header><mat-card-title>{{ check.displayLabel }}</mat-card-title></mat-card-header>
            <mat-card-content>
              <p id="systemCheckIntroText">{{ view.customText('syscheck_intro', 'Dieser Systemcheck soll gewährleisten, dass das von Ihnen verwendete Endgerät für eine bestimmte Befragung oder Testung geeignet ist.') }}</p>
              <h3>Schritte</h3>
              <ol><li *ngFor="let step of view.steps">{{ labels[step] }}</li></ol>
              <p *ngIf="view.steps.length > 1">Bitte oben die Schaltfläche nutzen für den nächsten Schritt!</p>
            </mat-card-content>
          </mat-card>
          <mat-card appearance="raised">
            <mat-card-header><mat-card-title>{{ labels.welcome }}</mat-card-title></mat-card-header>
            <mat-card-content>
              <table><tbody>
                <tr *ngFor="let entry of view.environmentEntries" [id]="'systemCheckEnvironment-' + entry.id">
                  <td>{{ entry.label }}: </td><td>&nbsp;{{ entry.value }}</td>
                </tr>
              </tbody></table>
            </mat-card-content>
          </mat-card>
        </div>
      </div>
    </ng-container>
  `,
  styles: [`
    :host { display: block; min-width: 0; overflow: auto; color: var(--mat-sys-on-surface); }
    .header { display: flex; justify-content: center; align-items: center; gap: 15px; padding-top: 10px; }
    .header h2 { min-width: 0; overflow-wrap: anywhere; font-size: 1.5em; font-weight: bold; line-height: normal; margin: .83em 0; }
    .sys-check-body { padding: 5px; }
    .welcome-cards { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
    mat-card { flex-basis: 400px; min-width: 0; max-width: 100%; }
    .mat-mdc-card-title { margin-bottom: 10px; }
    table, tbody, tr, td { box-sizing: content-box; }
    button.mat-mdc-fab { font: revert; }
    button.mat-mdc-fab:hover { transform: none; }
    button.mat-mdc-fab:disabled { opacity: 1; }
  `],
  styleUrl: "./original-system-check-content-theme.scss"
})
export class OriginalSystemCheckContentComponent {
  @Input({ required: true }) view!: SystemCheckViewComponent;
  readonly labels = {
    welcome: "Ermitteln von Systemdaten (Betriebssystem, Browser)",
    network: "Schätzung der Qualität der Internetverbindung",
    unit: "Prüfen von typischen Eingabeelementen",
    questionnaire: "Beantworten einiger Fragen",
    report: "Senden eines Berichtes"
  };
}
