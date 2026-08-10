import { CommonModule } from "@angular/common";
import {
  Component,
  ElementRef,
  ViewChild,
  inject
} from "@angular/core";
import type { AfterViewChecked, OnDestroy } from "@angular/core";

import { ConfirmationDialogService } from "./confirmation-dialog.service";

@Component({
  selector: "app-confirmation-dialog",
  standalone: true,
  imports: [CommonModule],
  template: `
    <section
      *ngIf="confirmation.dialog() as dialog"
      id="globalConfirmationBackdrop"
      class="confirmation-backdrop"
      (keydown)="handleKeydown($event)"
    >
      <article
        id="globalConfirmationDialog"
        class="confirmation-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="globalConfirmationTitle"
        aria-describedby="globalConfirmationMessage"
      >
        <span class="eyebrow">Confirm action</span>
        <h2 id="globalConfirmationTitle">{{ dialog.title }}</h2>
        <p id="globalConfirmationMessage">{{ dialog.message }}</p>
        <div class="actions">
          <button
            #cancelButton
            id="globalConfirmationCancelButton"
            class="secondary"
            type="button"
            (click)="confirmation.resolve(false)"
          >{{ dialog.cancelLabel }}</button>
          <button
            #confirmButton
            id="globalConfirmationConfirmButton"
            type="button"
            [class.primary]="dialog.tone === 'primary'"
            [class.danger]="dialog.tone === 'danger'"
            (click)="confirmation.resolve(true)"
          >{{ dialog.confirmLabel }}</button>
        </div>
      </article>
    </section>
  `,
  styles: `
    .confirmation-backdrop {
      position: fixed;
      z-index: 1100;
      inset: 0;
      display: grid;
      place-items: center;
      padding: 24px;
      background: rgba(20, 35, 38, 0.72);
      backdrop-filter: blur(5px);
    }

    .confirmation-dialog {
      display: grid;
      gap: 18px;
      width: min(100%, 560px);
      padding: clamp(24px, 5vw, 42px);
      border: 1px solid var(--line);
      border-radius: var(--radius-xl);
      background: var(--surface);
      box-shadow: 0 28px 80px rgba(8, 22, 25, 0.36);
    }

    .confirmation-dialog h2,
    .confirmation-dialog p {
      margin: 0;
    }

    .confirmation-dialog p {
      color: var(--muted);
      line-height: 1.5;
    }
  `
})
export class ConfirmationDialogComponent
  implements AfterViewChecked, OnDestroy
{
  readonly confirmation = inject(ConfirmationDialogService);

  @ViewChild("cancelButton")
  private cancelButton?: ElementRef<HTMLButtonElement>;

  @ViewChild("confirmButton")
  private confirmButton?: ElementRef<HTMLButtonElement>;

  private focusedRequestId: number | null = null;

  ngAfterViewChecked(): void {
    const requestId = this.confirmation.dialog()?.requestId ?? null;
    if (requestId === null) {
      this.focusedRequestId = null;
      return;
    }
    if (requestId === this.focusedRequestId) {
      return;
    }
    this.focusedRequestId = requestId;
    this.cancelButton?.nativeElement.focus();
  }

  ngOnDestroy(): void {
    this.confirmation.resolve(false);
  }

  handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      this.confirmation.resolve(false);
      return;
    }
    if (event.key !== "Tab") {
      return;
    }

    const cancelButton = this.cancelButton?.nativeElement;
    const confirmButton = this.confirmButton?.nativeElement;
    if (!cancelButton || !confirmButton) {
      return;
    }
    if (event.shiftKey && globalThis.document.activeElement === cancelButton) {
      event.preventDefault();
      confirmButton.focus();
    } else if (
      !event.shiftKey &&
      globalThis.document.activeElement === confirmButton
    ) {
      event.preventDefault();
      cancelButton.focus();
    }
  }
}
