import { Component, EventEmitter, Input, Output, inject } from "@angular/core";
import { NgFor, NgIf } from "@angular/common";
import { RouterLink } from "@angular/router";
import { MatButton } from "@angular/material/button";
import { MatCard, MatCardActions, MatCardContent, MatCardHeader, MatCardSubtitle, MatCardTitle } from "@angular/material/card";
import type { SystemCheckChoice } from "@testcenter-rewrite-app/domain";
import { ApplicationSettingsService } from "./application-settings.service";
import { OriginalSystemCheckContentComponent } from "./original-system-check-content.component";
import type { SystemCheckViewComponent } from "./system-check-view.component";

// Adapted from IQB Testcenter 19 sys-check-starter (MIT).
// See assets/ORIGINAL-UI-LICENSE.txt. The existing authorized controller owns
// loading and selection; this component creates no sessions or report data.
@Component({
  selector: "app-original-system-check-starter", standalone: true,
  imports: [NgFor, NgIf, RouterLink, MatButton, MatCard, MatCardActions, MatCardContent, MatCardHeader, MatCardSubtitle, MatCardTitle, OriginalSystemCheckContentComponent],
  template: `
    @if (view.systemCheck) {
      <app-original-system-check-content [view]="view" />
    } @else {
    <div class="flex-row-wrap" id="originalSystemCheckStarter">
      <mat-card appearance="raised">
        <mat-card-header>
          <mat-card-title>{{ settings.settings().appTitle }}</mat-card-title>
          <mat-card-subtitle>Systemcheck Auswahl</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <p>Hier können Sie ermitteln, ob das Computersystem, das Sie gerade benutzen, für
            die hier vorgesehenen Testungen geeignet ist.</p>
          <p *ngIf="loading" id="originalSystemCheckLoading" role="status">Bitte warten... Konfiguration wird geladen</p>
          <span *ngIf="!loading && !error">
            <p *ngIf="choices.length === 0" id="originalSystemCheckEmpty">Auf diesem Server ist aktuell kein Systemcheck verfügbar.</p>
            <p *ngIf="choices.length > 1">Bitte wählen Sie einen Check aus!</p>
            <p *ngIf="choices.length === 1">Bitte klicken Sie auf den Schalter, um den Check zu starten!</p>
          </span>
          <p *ngIf="error" id="originalSystemCheckError" role="alert">{{ error }}</p>
          <button *ngIf="error" matButton="elevated" id="originalSystemCheckRetryButton"
            [disabled]="loading" (click)="retry.emit()">Erneut versuchen</button>
          <div class="flex-column">
            <button *ngFor="let check of choices" matButton="elevated" class="starter"
              [attr.data-system-check-id]="check.checkId" [attr.data-tenant-key]="check.tenantKey"
              [attr.data-workspace-key]="check.workspaceKey" [disabled]="loading"
              (click)="select.emit(check)">
              <div class="booklet_title">{{ check.displayLabel }}</div>
              <div class="booklet_status">{{ check.description }}</div>
            </button>
          </div>
        </mat-card-content>
        <mat-card-actions>
          <a routerLink="/home" matButton="elevated" id="originalSystemCheckHomeButton">
            <svg viewBox="0 -960 960 960" aria-hidden="true"><path d="m313-440 224 224-57 56-320-320 320-320 57 56-224 224h487v80H313Z" /></svg> zurück zur Startseite
          </a>
        </mat-card-actions>
      </mat-card>
    </div>
    }
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .flex-row-wrap { display: flex; flex-wrap: wrap; justify-content: center; }
    .flex-column { display: flex; flex-direction: column; gap: 10px; }
    div.booklet_title { font-size: 16pt; text-align: center; white-space: pre-wrap; word-break: break-word; line-height: 130%; }
    div.booklet_status { font-size: 8pt; margin-top: 0; color: mediumturquoise; text-align: center; }
    .mat-mdc-card { width: 400px; max-width: 100%; }
    .mat-mdc-raised-button.starter { padding: 1em; height: auto; display: flex; justify-content: center; align-items: center; }
    svg { width: 18px; height: 18px; fill: currentColor; margin-right: 8px; }
  `],
  styleUrl: "./original-login-theme.scss"
})
export class OriginalSystemCheckStarterComponent {
  readonly settings = inject(ApplicationSettingsService);
  @Input({ required: true }) view!: SystemCheckViewComponent;
  @Input() choices: SystemCheckChoice[] = [];
  @Input() loading = false;
  @Input() error = "";
  @Output() readonly select = new EventEmitter<SystemCheckChoice>();
  @Output() readonly retry = new EventEmitter<void>();
}
