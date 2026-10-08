import { CommonModule } from "@angular/common";
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild
} from "@angular/core";
import type { AfterViewInit } from "@angular/core";
import { FormsModule } from "@angular/forms";

export type SystemCheckSaveReportDialogResult = {
  key: string;
  title: string;
};

@Component({
  selector: "app-system-check-save-report-dialog",
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section
      id="systemCheckSaveReportBackdrop"
      class="save-report-backdrop"
      (keydown)="handleKeydown($event)"
    >
      <form
        class="save-report-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="systemCheckSaveReportTitle"
        aria-describedby="systemCheckSaveReportDescription"
        (ngSubmit)="submit()"
      >
        <span class="eyebrow">System check report</span>
        <h2 id="systemCheckSaveReportTitle">Bericht senden</h2>
        <p id="systemCheckSaveReportDescription">{{ aboutPassword }}</p>
        <label>
          System-Check-Kennwort
          <span class="password-field">
            <input
              #keyInput
              id="systemCheckSaveReportKey"
              [type]="showPassword ? 'text' : 'password'"
              autocomplete="new-password"
              required
              minlength="3"
              [(ngModel)]="key"
              name="systemCheckSaveReportKey"
            />
            <button
              #passwordToggle
              id="systemCheckSaveReportPasswordToggle"
              class="ghost"
              type="button"
              [attr.aria-label]="showPassword ? 'Kennwort verbergen' : 'Kennwort anzeigen'"
              [attr.aria-pressed]="showPassword"
              (click)="showPassword = !showPassword"
            >{{ showPassword ? 'Verbergen' : 'Anzeigen' }}</button>
          </span>
        </label>
        <p>{{ aboutReportId }}</p>
        <label>
          {{ reportIdLabel }}
          <input
            #titleInput
            id="systemCheckSaveReportId"
            required
            minlength="3"
            [(ngModel)]="title"
            name="systemCheckSaveReportId"
          />
        </label>
        <div class="actions">
          <button
            #saveButton
            id="systemCheckSaveReportConfirmButton"
            class="primary"
            type="submit"
            [disabled]="!canSave"
          >Speichern</button>
          <button
            #cancelButton
            id="systemCheckSaveReportCancelButton"
            class="secondary"
            type="button"
            (click)="cancel.emit()"
          >Abbrechen</button>
        </div>
      </form>
    </section>
  `,
  styles: `
    .save-report-backdrop {
      position: fixed;
      z-index: 1090;
      inset: 0;
      display: grid;
      place-items: center;
      overflow: auto;
      padding: 24px;
      background: rgba(20, 35, 38, 0.72);
      backdrop-filter: blur(5px);
    }

    .save-report-dialog {
      display: grid;
      gap: 18px;
      width: min(100%, 560px);
      max-height: calc(100vh - 48px);
      overflow: auto;
      box-sizing: border-box;
      padding: clamp(24px, 5vw, 42px);
      border: 1px solid var(--line);
      border-radius: var(--radius-xl);
      background: var(--surface);
      box-shadow: 0 28px 80px rgba(8, 22, 25, 0.36);
    }

    .save-report-dialog h2,
    .save-report-dialog p {
      margin: 0;
    }

    .save-report-dialog p {
      color: var(--muted);
      line-height: 1.5;
    }

    .password-field {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: center;
    }

    .password-field button {
      min-height: 44px;
    }

    @media (max-width: 520px) {
      .save-report-backdrop {
        padding: 12px;
      }

      .save-report-dialog {
        max-height: calc(100vh - 24px);
      }

      .password-field {
        grid-template-columns: 1fr;
      }
    }
  `
})
export class SystemCheckSaveReportDialogComponent implements AfterViewInit {
  @Input() aboutPassword = "";
  @Input() aboutReportId = "";
  @Input() reportIdLabel = "Report title";

  @Output() readonly cancel = new EventEmitter<void>();
  @Output() readonly save =
    new EventEmitter<SystemCheckSaveReportDialogResult>();

  @ViewChild("keyInput", { static: true })
  private readonly keyInput!: ElementRef<HTMLInputElement>;

  @ViewChild("passwordToggle", { static: true })
  private readonly passwordToggle!: ElementRef<HTMLButtonElement>;

  @ViewChild("titleInput", { static: true })
  private readonly titleInput!: ElementRef<HTMLInputElement>;

  @ViewChild("saveButton", { static: true })
  private readonly saveButton!: ElementRef<HTMLButtonElement>;

  @ViewChild("cancelButton", { static: true })
  private readonly cancelButton!: ElementRef<HTMLButtonElement>;

  key = "";
  title = "";
  showPassword = false;

  get canSave(): boolean {
    return this.key.trim().length >= 3 && this.title.trim().length >= 3;
  }

  ngAfterViewInit(): void {
    this.keyInput.nativeElement.focus();
  }

  handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      this.cancel.emit();
      return;
    }
    if (event.key !== "Tab") {
      return;
    }

    const focusableElements = [
      this.keyInput.nativeElement,
      this.passwordToggle.nativeElement,
      this.titleInput.nativeElement,
      this.saveButton.nativeElement,
      this.cancelButton.nativeElement
    ].filter(element => !element.disabled);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements.at(-1);
    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement?.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement?.focus();
    }
  }

  submit(): void {
    if (!this.canSave) {
      return;
    }
    this.save.emit({
      key: this.key,
      title: this.title.trim()
    });
  }
}
