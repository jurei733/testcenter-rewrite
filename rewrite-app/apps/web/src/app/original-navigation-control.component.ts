import { NgFor, NgIf } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";
import { MatIconButton } from "@angular/material/button";

// Adapted from IQB Testcenter 19 NavigationComponent and its SVG icon set.
// See assets/ORIGINAL-UI-LICENSE.txt for the retained MIT notice.
@Component({
  selector: "app-original-navigation-control",
  standalone: true,
  imports: [NgFor, NgIf, MatIconButton],
  template: `
    <button *ngIf="showBackward" matIconButton class="nav-button previous-button"
      [id]="idPrefix + '-backward'" [attr.data-cy]="dataCy + '-backward'"
      aria-label="Zurück" title="Zurück" [disabled]="!canBackward" (click)="back.emit()">
      <svg viewBox="0 -960 960 960" aria-hidden="true"><path d="M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z" /></svg>
    </button>
    <div class="label-container" [class.readonly]="!showBackward && !showForward" [class.list]="labelMode === 'list'">
      <div class="label" [id]="idPrefix + '-label'" [attr.data-cy]="dataCy + '-label'" aria-live="polite">
        {{ label }}<ng-container *ngIf="labelMode === 'index'"> {{ currentIndex + 1 }}/{{ count }}</ng-container>
      </div>
      <ng-container *ngIf="labelMode === 'list'">
        <div *ngFor="let item of listTabs; let index = index" class="list-item"
          [class.selected]="currentIndex === index" [attr.data-cy]="dataCy + '-list-' + index"
          [attr.aria-current]="currentIndex === index ? 'page' : null">{{ item }}</div>
      </ng-container>
    </div>
    <button *ngIf="showForward" matIconButton class="nav-button next-button"
      [id]="idPrefix + '-forward'" [attr.data-cy]="dataCy + '-forward'"
      aria-label="Weiter" title="Weiter" [disabled]="!canForward" (click)="forward.emit()">
      <svg viewBox="0 -960 960 960" aria-hidden="true"><path d="M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z" /></svg>
    </button>
  `,
  styleUrl: "./original-navigation-control.component.css"
})
export class OriginalNavigationControlComponent {
  @Input() idPrefix = "originalNavigation";
  @Input() dataCy = "navigation";
  @Input() label = "";
  @Input() labelMode: "index" | "label" | "list" = "index";
  @Input() currentIndex = 0;
  @Input() count = 0;
  @Input() showBackward = true;
  @Input() showForward = true;
  @Input() canBackward = false;
  @Input() canForward = false;
  @Output() readonly back = new EventEmitter<void>();
  @Output() readonly forward = new EventEmitter<void>();

  get listTabs(): number[] {
    return Array.from({ length: this.count }, (_, index) => index + 1);
  }
}
