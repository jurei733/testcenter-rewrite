import { Component, Input } from "@angular/core";
import { NgIf } from "@angular/common";
import { MatButton } from "@angular/material/button";
import { MatButtonToggle, MatButtonToggleGroup } from "@angular/material/button-toggle";
import { MatTooltip } from "@angular/material/tooltip";
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from "@angular/material/card";
import type { VeronaPlayerHostComponent } from "./verona-player-host.component";

// Adapted from IQB Testcenter 19 sys-check/page-nav-bar and unit-check (MIT).
// See assets/ORIGINAL-UI-LICENSE.txt. All page state and navigation remain in
// the existing Verona host, including its source/session validation.
@Component({
  selector: "app-original-system-check-player-controls", standalone: true,
  imports: [NgIf, MatButton, MatButtonToggle, MatButtonToggleGroup, MatTooltip,
    MatCard, MatCardContent, MatCardHeader, MatCardTitle],
  template: `
    <nav class="pageNav" id="originalSystemCheckPageNavigation" aria-label="Seitennavigation" *ngIf="!view.errorMessage">
      <span style="color:white; padding-right:8px;">{{ view.pageNavigationPrompt }}</span>
      <button mat-stroked-button data-cy="page-navigation-backward" aria-label="Vorherige Seite"
        [disabled]="!view.hasPreviousPage" (click)="view.goToRelativePage(-1)">
        <svg viewBox="0 -960 960 960" aria-hidden="true"><path d="M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z" /></svg>
      </button>
      <mat-button-toggle-group [value]="view.currentPageIndex" [hideSingleSelectionIndicator]="true" aria-label="Seite auswählen"
        (change)="view.goToPage($event.value)">
        @for (page of view.pages; track page.id; let index = $index) {
          <mat-button-toggle [class.selected-value]="view.currentPageIndex === index" [matTooltip]="page.label"
            [attr.data-cy]="'page-navigation-' + index" [value]="index">{{ index + 1 }}</mat-button-toggle>
        }
      </mat-button-toggle-group>
      <button mat-stroked-button data-cy="page-navigation-forward" aria-label="Nächste Seite"
        [disabled]="!view.hasNextPage" (click)="view.goToRelativePage(1)">
        <svg viewBox="0 -960 960 960" aria-hidden="true"><path d="m400-240-56-56 184-184-184-184 56-56 240 240-240 240Z" /></svg>
      </button>
    </nav>
    <mat-card appearance="outlined" *ngIf="view.errorMessage" id="originalSystemCheckUnitError" role="alert">
      <mat-card-header><mat-card-title>Fehler!</mat-card-title></mat-card-header>
      <mat-card-content><p>Beim Abspielen der Unit ist folgender Laufzeitfehler aufgetreten: {{ view.errorMessage }}</p></mat-card-content>
    </mat-card>
  `,
  styles: [`
    :host { display:block; }
    .pageNav { position:absolute; right:0; bottom:0; height:45px; padding:0 30px; font-size:1.2em; background:transparent; display:flex; align-items:center; }
    .selected-value { background-color:var(--accent) !important; }
    button { height:34px !important; margin-bottom:2px; }
    mat-button-toggle-group { height:34px; align-items:center; flex-shrink:0; }
    .pageNav > span { min-width:0; overflow:hidden; }
    /* Material's inner toggle button has no own radius or hover transform;
       do not let the Rewrite's generic capsule button clip its label. */
    :host ::ng-deep .mat-button-toggle-button { border-radius:0; transform:none; }
    svg { width:24px; height:24px; fill:currentColor; }
    mat-card { width:700px; max-width:100%; margin:auto; }
    @media(max-width:640px) { .pageNav { max-width:100%; padding:0 8px; overflow:auto; } }
  `],
  styleUrl: "./original-login-theme.scss"
})
export class OriginalSystemCheckPlayerControlsComponent {
  @Input({ required: true }) view!: VeronaPlayerHostComponent;
}
