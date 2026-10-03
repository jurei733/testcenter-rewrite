import { NgIf } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";
import { MatButton } from "@angular/material/button";
import { OriginalNavigationControlComponent } from "./original-navigation-control.component";

// Layout adapted from IQB Testcenter 19's test-controller nav-header.
// See assets/ORIGINAL-UI-LICENSE.txt. Events reuse the existing controller.
@Component({
  selector: "app-original-player-navigation",
  standalone: true,
  imports: [NgIf, MatButton, OriginalNavigationControlComponent],
  template: `
    <nav id="originalPlayerNavigation" aria-label="Testnavigation">
      <button *ngIf="showGlobalBackward" matButton="tonal" class="nav-button"
        id="participantVeronaGlobalBackwardButton" data-cy="separate-unit-backward-button"
        [disabled]="!canPreviousUnit && !hasPreviousPage" (click)="globalBackward.emit()">
        <svg viewBox="0 -960 960 960" aria-hidden="true"><path d="M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z" /></svg>Zurück
      </button>
      <app-original-navigation-control *ngIf="unitLabelMode !== 'hidden'"
        idPrefix="originalUnitNavigation" dataCy="unit-navigation"
        [label]="unitLabelMode === 'index' ? 'Aufgabe' : unitTitle"
        [labelMode]="unitLabelMode === 'index' ? 'index' : 'label'"
        [currentIndex]="unitNumber - 1" [count]="unitCount"
        [showBackward]="unitControls === 'both'" [showForward]="unitControls !== 'hidden'"
        [canBackward]="canPreviousUnit" [canForward]="canNextUnit"
        (back)="previousUnit.emit()" (forward)="nextUnit.emit()" />
      <app-original-navigation-control *ngIf="pageLabelMode !== 'hidden' && pageCount > 0"
        idPrefix="originalPageNavigation" dataCy="page-navigation"
        [label]="pageLabelMode === 'label' ? pageLabel : 'Teilaufgabe'" [labelMode]="pageLabelMode"
        [currentIndex]="currentPageIndex" [count]="pageCount"
        [showBackward]="!pageControlsHidden" [showForward]="!pageControlsHidden"
        [canBackward]="hasPreviousPage" [canForward]="hasNextPage"
        (back)="previousPage.emit()" (forward)="nextPage.emit()" />
      <button *ngIf="showGlobalForward" matButton="tonal" class="nav-button"
        id="participantVeronaGlobalForwardButton" data-cy="separate-unit-forward-button"
        [disabled]="!canNextUnit && !hasNextPage" (click)="globalForward.emit()">
        Weiter<svg viewBox="0 -960 960 960" aria-hidden="true"><path d="M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z" /></svg>
      </button>
    </nav>
  `,
  styleUrls: ["./original-player-navigation.component.css", "./original-login-theme.scss"]
})
export class OriginalPlayerNavigationComponent {
  @Input() unitLabelMode: "hidden" | "index" | "label" = "index";
  @Input() unitTitle = "";
  @Input() unitNumber = 1;
  @Input() unitCount = 1;
  @Input() unitControls: "both" | "forward_only" | "hidden" = "both";
  @Input() canPreviousUnit = false;
  @Input() canNextUnit = false;
  @Input() pageLabelMode: "hidden" | "index" | "label" | "list" = "index";
  @Input() pageLabel = "";
  @Input() currentPageIndex = -1;
  @Input() pageCount = 0;
  @Input() pageControlsHidden = false;
  @Input() hasPreviousPage = false;
  @Input() hasNextPage = false;
  @Input() showGlobalBackward = false;
  @Input() showGlobalForward = false;
  @Output() readonly previousUnit = new EventEmitter<void>();
  @Output() readonly nextUnit = new EventEmitter<void>();
  @Output() readonly previousPage = new EventEmitter<void>();
  @Output() readonly nextPage = new EventEmitter<void>();
  @Output() readonly globalBackward = new EventEmitter<void>();
  @Output() readonly globalForward = new EventEmitter<void>();
}
