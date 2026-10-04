import { Component, Input } from "@angular/core";
import { NgFor, NgIf } from "@angular/common";
import { MatButton } from "@angular/material/button";
import { MatCard, MatCardActions, MatCardContent, MatCardHeader, MatCardTitle } from "@angular/material/card";
import type { SystemCheckViewComponent } from "./system-check-view.component";

// Adapted from IQB Testcenter 19 sys-check/report (MIT).
// See assets/ORIGINAL-UI-LICENSE.txt. The shared controller remains responsible
// for required answers, authorized submission, confirmation and cancellation.
@Component({
  selector: "app-original-system-check-report", standalone: true,
  imports: [NgFor, NgIf, MatButton, MatCard, MatCardActions, MatCardContent, MatCardHeader, MatCardTitle],
  template: `
    <div class="sys-check-body flex-row-center" id="originalSystemCheckReport">
      <mat-card appearance="raised">
        <mat-card-header><mat-card-title>Bericht</mat-card-title></mat-card-header>
        <mat-card-content>
          <section id="systemCheckQuestionnaireWarnings" *ngIf="view.unansweredRequiredQuestions.length > 0">
            <p class="warning-text">{{ view.customText('syscheck_questionsRequiredMessage', 'Bitte prüfen Sie die Eingaben (unvollständig):') }}</p>
            <ul><li *ngFor="let question of view.unansweredRequiredQuestions">{{ question.prompt }}</li></ul>
          </section>
          <section id="systemCheckReportEnvironment" *ngIf="view.environmentEntries.length > 0">
            <h2>Computer (Betriebssystem, Browser)</h2>
            <ul><li *ngFor="let entry of view.environmentEntries" [id]="'systemCheckReportEnvironment-' + entry.id">{{ entry.label }}: {{ entry.value }}</li></ul>
          </section>
          <section id="systemCheckReportNetwork" *ngIf="networkEntries.length > 0">
            <h2>Netzwerk/Internetverbindung</h2>
            <ul><li *ngFor="let entry of networkEntries" [id]="'systemCheckReportNetwork-' + entry.id">{{ entry.label }}: {{ entry.value }}</li></ul>
          </section>
          <section id="systemCheckReportQuestionnaire" *ngIf="view.questionnaireEntries.length > 0">
            <h2>Fragen</h2>
            <ul><li *ngFor="let entry of view.questionnaireEntries" [id]="'systemCheckReportQuestionnaire-' + entry.id">{{ entry.label }}: {{ entry.value }}</li></ul>
          </section>
        </mat-card-content>
        <mat-card-actions>
          <button id="saveSystemCheckReportButton" mat-raised-button data-cy="send sc-report"
            [disabled]="view.busy || !view.canSaveReport" (click)="view.startReportSave()">Bericht senden</button>
          <button id="cancelSystemCheckReportButton" mat-raised-button [disabled]="view.busy"
            (click)="view.cancelSystemCheckReport()">Systemcheck abbrechen</button>
        </mat-card-actions>
      </mat-card>
    </div>
  `,
  styles: [`
    :host { display:block; min-width:0; }
    .sys-check-body { padding:5px; }
    .flex-row-center { display:flex; flex-direction:row; justify-content:center; }
    mat-card { width:810px; min-width:0; max-width:100%; }
    ul li { word-break:break-all; margin:3px; }
    .warning-text { color:red; font-weight:bold; }
  `],
  styleUrl: "./original-login-theme.scss"
})
export class OriginalSystemCheckReportComponent {
  @Input({ required: true }) view!: SystemCheckViewComponent;
  // Keep the Rewrite-only application probe in the shared durable payload,
  // without inserting an extra diagnostic into the Original's report list.
  get networkEntries() { return this.view.networkEntries.filter(entry => entry.id !== "latency"); }
}
