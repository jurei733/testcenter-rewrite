import { CommonModule } from "@angular/common";
import { Component, ElementRef, ViewChild, inject } from "@angular/core";
import type { AfterViewChecked } from "@angular/core";

import { BugReportService } from "./bug-report.service";

@Component({
  selector: "app-bug-report-dialog",
  standalone: true,
  imports: [CommonModule],
  template: `
    <section
      *ngIf="reports.isOpen()"
      id="bugReportBackdrop"
      class="bug-report-backdrop"
      (keydown)="handleKeydown($event)"
    >
      <article
        id="bugReportDialog"
        class="bug-report-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bugReportTitle"
        aria-describedby="bugReportPrivacy"
      >
        <span class="eyebrow">Fehlerbericht</span>
        <h2 id="bugReportTitle">Ein unerwarteter Fehler ist aufgetreten.</h2>
        <p>
          Laden Sie den bereinigten Bericht herunter oder kopieren Sie ihn für
          den Support. Ein erneuter Seitenaufruf behebt möglicherweise das Problem.
        </p>
        <pre id="bugReportText" tabindex="0">{{ reports.reportText() }}</pre>
        <p id="bugReportPrivacy" class="privacy-note">
          Nur der oben sichtbare Inhalt wird übermittelt. Bei direktem Versand
          kann er beim konfigurierten Drittanbieter gespeichert werden.
        </p>
        <p
          *ngIf="reports.status().message"
          id="bugReportStatus"
          class="report-status"
          [class.is-error]="reports.status().kind === 'error'"
          role="status"
        >{{ reports.status().message }}</p>
        <a
          *ngIf="reports.issueUrl() as issueUrl"
          id="bugReportIssueLink"
          [href]="issueUrl"
          target="_blank"
          rel="noopener noreferrer"
        >Gesendeten Bericht öffnen</a>
        <div class="actions">
          <button
            #closeButton
            id="bugReportCloseButton"
            class="secondary"
            type="button"
            (click)="reports.close()"
          >Schließen</button>
          <button
            id="bugReportCopyButton"
            class="ghost"
            type="button"
            (click)="reports.copy()"
          >Kopieren</button>
          <button
            id="bugReportDownloadButton"
            class="ghost"
            type="button"
            (click)="reports.download()"
          >Herunterladen</button>
          <button
            *ngIf="reports.config().enabled"
            id="bugReportSubmitButton"
            class="primary"
            type="button"
            [disabled]="reports.status().kind === 'working'"
            (click)="reports.submit()"
          >Senden</button>
        </div>
      </article>
    </section>
  `,
  styles: `
    .bug-report-backdrop {
      position: fixed;
      z-index: 1200;
      inset: 0;
      display: grid;
      place-items: center;
      padding: 24px;
      background: rgba(20, 35, 38, 0.76);
      backdrop-filter: blur(5px);
    }

    .bug-report-dialog {
      display: grid;
      gap: 16px;
      width: min(100%, 760px);
      max-height: calc(100vh - 48px);
      overflow: auto;
      padding: clamp(24px, 5vw, 38px);
      border: 1px solid var(--line);
      border-radius: var(--radius-xl);
      background: var(--surface);
      box-shadow: 0 28px 80px rgba(8, 22, 25, 0.4);
    }

    h2,
    p {
      margin: 0;
    }

    p {
      color: var(--muted);
      line-height: 1.5;
    }

    pre {
      max-height: min(42vh, 420px);
      margin: 0;
      overflow: auto;
      padding: 16px;
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      background: var(--ink);
      color: #f7faf8;
      font-size: 12px;
      line-height: 1.5;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .privacy-note {
      font-size: 13px;
    }

    .report-status {
      color: var(--secondary);
      font-weight: 700;
    }

    .report-status.is-error {
      color: var(--danger, #9c2e20);
    }

    .actions {
      justify-content: flex-end;
    }
  `
})
export class BugReportDialogComponent implements AfterViewChecked {
  readonly reports = inject(BugReportService);

  @ViewChild("closeButton")
  private closeButton?: ElementRef<HTMLButtonElement>;

  private focused = false;

  ngAfterViewChecked(): void {
    if (!this.reports.isOpen()) {
      this.focused = false;
      return;
    }
    if (!this.focused) {
      this.focused = true;
      this.closeButton?.nativeElement.focus();
    }
  }

  handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      this.reports.close();
    }
  }
}
