import { Component, Input } from "@angular/core";
import { NgFor, NgIf } from "@angular/common";
import { MatFabButton } from "@angular/material/button";
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from "@angular/material/card";
import { MatTooltip } from "@angular/material/tooltip";
import type { SystemCheckViewComponent } from "./system-check-view.component";
import { OriginalSystemCheckQuestionnaireComponent } from "./original-system-check-questionnaire.component";

// Adapted from IQB Testcenter 19 sys-check/welcome and sys-check.component (MIT).
// See assets/ORIGINAL-UI-LICENSE.txt. The shared controller owns every step,
// measurement and response; this surface does not create another check state.
@Component({
  selector: "app-original-system-check-content", standalone: true,
  imports: [NgFor, NgIf, MatFabButton, MatCard, MatCardContent, MatCardHeader, MatCardTitle, MatTooltip, OriginalSystemCheckQuestionnaireComponent],
  template: `
    <ng-container *ngIf="view.systemCheck as check">
      <div class="header">
        <h2>Systemcheck: {{ check.displayLabel }}</h2>
        <button id="syscheck-previous-step" matFab matTooltip="Zurück" aria-label="Zurück"
          [disabled]="view.stepIndex === 0 || view.busy || view.networkBusy" (click)="view.previousStep()">
          <svg viewBox="0 -960 960 960" aria-hidden="true"><path d="M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z" /></svg>
        </button>
        <button id="syscheck-next-step" matFab matTooltip="Weiter" aria-label="Weiter"
          [disabled]="view.nextButtonDisabled || view.networkBusy" (click)="view.nextStep()">
          <svg viewBox="0 -960 960 960" aria-hidden="true"><path d="m400-240-56-56 184-184-184-184 56-56 240 240-240 240Z" /></svg>
        </button>
      </div>
      @defer (when view.step === 'questionnaire') {
        @if (view.step === 'questionnaire') {
          <app-original-system-check-questionnaire [view]="view" />
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
    :host { display: block; min-width: 0; overflow: auto; }
    .header { display: flex; justify-content: center; align-items: center; gap: 15px; padding-top: 10px; }
    .header h2 { min-width: 0; overflow-wrap: anywhere; font-size: 1.5em; font-weight: bold; line-height: normal; margin: .83em 0; }
    .sys-check-body { padding: 5px; }
    .welcome-cards { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
    mat-card { flex-basis: 400px; min-width: 0; max-width: 100%; }
    .mat-mdc-card-title { margin-bottom: 10px; }
    table { width: 100%; }
    td:last-child { overflow-wrap: anywhere; }
    svg { width: 24px; height: 24px; fill: currentColor; }
  `],
  styleUrl: "./original-login-theme.scss"
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
