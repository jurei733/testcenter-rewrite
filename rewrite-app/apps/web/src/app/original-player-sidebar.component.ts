import { DOCUMENT, NgTemplateOutlet } from "@angular/common";
import { CdkTrapFocus } from "@angular/cdk/a11y";
import { Component, DestroyRef, ElementRef, EventEmitter, HostListener, Input, Output, TemplateRef, inject } from "@angular/core";
import type { AfterViewChecked } from "@angular/core";
import { MatButton } from "@angular/material/button";

@Component({
  selector: "app-original-player-sidebar",
  standalone: true,
  imports: [NgTemplateOutlet, CdkTrapFocus, MatButton],
  template: `
    <button class="backdrop" [class.is-review]="review" type="button" tabindex="-1" aria-label="Seitenleiste schließen"
      (click)="close.emit()"></button>
    <section role="dialog" aria-modal="true" aria-labelledby="originalPlayerSidebarTitle" [class.is-review]="review"
      cdkTrapFocus [cdkTrapFocusAutoCapture]="true">
      @if (!review) {
      <header><h2 id="originalPlayerSidebarTitle">{{ title }}</h2>
        <button matButton cdkFocusInitial id="originalPlayerSidebarCloseButton"
          (click)="close.emit()">Schließen</button></header>
      }
      <div class="content"><ng-container [ngTemplateOutlet]="content" /></div>
    </section>
  `,
  styles: [`
    :host { position: absolute; inset: 0; z-index: 10; display: block; }
    .backdrop { position: absolute; inset: 0; width: 100%; height: 100%; border: 0;
      border-radius: 0; background: rgb(0 0 0 / 32%); }
    /* Original Material's neutral-variant20 scrim. This custom drawer does
       not import MatSidenav, so its component token may not be installed. */
    .backdrop.is-review { background: var(--mat-sidenav-scrim-color, color(srgb 0.160784 0.196078 0.207843 / 0.4)); }
    section { position: absolute; right: 0; top: 0; bottom: 0; width: 420px;
      max-width: 90%; background: white; display: flex; flex-direction: column;
      box-shadow: -4px 0 12px rgb(0 0 0 / 25%); font-family: 'Nunito Sans', sans-serif; }
    header { display: flex; align-items: center; padding: 8px 15px; flex: 0 0 auto; }
    h2 { font-size: 18px; font-weight: 700; margin: 0; flex: 1; }
    .content { flex: 1; min-height: 0; overflow: auto; }
    section.is-review { width: 700px; overflow: auto; border-radius: 16px 0 0 16px; box-shadow: none; }
    .is-review .content { min-width: 700px; overflow: visible; height: 100%; }
  `],
  styleUrl: "./original-login-theme.scss"
})
export class OriginalPlayerSidebarComponent implements AfterViewChecked {
  private readonly document = inject(DOCUMENT);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  @Input({ required: true }) title = "";
  @Input() review = false;
  @Input({ required: true }) content: TemplateRef<unknown> | null = null;
  @Output() readonly close = new EventEmitter<void>();
  private hasForegroundDialog(): boolean {
    return Boolean(this.document.querySelector('#participantConfirmationBackdrop, [role="menu"]'));
  }

  ngAfterViewChecked(): void {
    // Deleting the focused Review removes its button. Keep keyboard focus in
    // the open drawer after the nested confirmation has finished rendering.
    queueMicrotask(() => {
      if (!this.destroyRef.destroyed && this.document.activeElement === this.document.body &&
          !this.hasForegroundDialog()) {
        const closeSelector = this.review
          ? ".review-list:not([hidden]) .close-button, form:not([hidden]) [data-cy='comment-diag-close']"
          : "#originalPlayerSidebarCloseButton";
        this.element.nativeElement.querySelector<HTMLButtonElement>(closeSelector)?.focus();
      }
    });
  }

  @HostListener("document:keydown.escape", ["$event"])
  onEscape(event: Event): void {
    if (event.defaultPrevented || this.hasForegroundDialog()) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.close.emit();
  }
}
