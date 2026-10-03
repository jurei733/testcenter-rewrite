import { Component, EventEmitter, Output, inject } from "@angular/core";
import { MatButton, MatIconButton } from "@angular/material/button";
import { MatMenu, MatMenuItem, MatMenuTrigger } from "@angular/material/menu";
import { ParticipantViewFacade } from "./participant-view.facade";
import { OriginalPlayerSurfaceStylesComponent } from "./original-player-surface-styles.component";
import { OriginalOverlayStylesComponent } from "./original-overlay-styles.component";

// Adapted from IQB Testcenter 19's toolbar-header. See ORIGINAL-UI-LICENSE.txt.
@Component({
  selector: "app-original-player-toolbar",
  standalone: true,
  imports: [MatButton, MatIconButton, MatMenu, MatMenuItem, MatMenuTrigger,
    OriginalPlayerSurfaceStylesComponent, OriginalOverlayStylesComponent],
  template: `
    <app-original-overlay-styles />
    <app-original-player-surface-styles />
    <div id="originalPlayerToolbar" class="toolbar-header" data-cy="unit-screenheader">
      @if (view.showUnitTitle) { <p data-cy="unit-title">{{ view.player.headline }}</p> }
      <div class="toolbar-right" data-cy="toolbar-right">
        @if (view.player.testletTimer?.showTimeLeft) {
          <p data-cy="time-value">Verbleibende Zeit: {{ view.player.testletTimer?.remainingLabel }}</p>
        }
        @if (view.player.canReview) {
          <button matButton data-cy="send-comments" aria-label="Kommentar verfassen"
            (click)="openPanel.emit('review')">
            <svg viewBox="0 -960 960 960" aria-hidden="true"><path d="M240-400h122l200-200q9-9 13.5-20.5T580-643q0-11-5-21.5T562-684l-36-38q-9-9-20-13.5t-23-4.5q-11 0-22.5 4.5T440-722L240-522v122Zm280-243-37-37 37 37ZM300-460v-38l101-101 20 18 18 20-101 101h-38Zm121-121 18 20-38-38 20 18Zm26 181h273v-80H527l-80 80ZM80-80v-720q0-33 23.5-56.5T160-880h640q33 0 56.5 23.5T880-800v480q0 33-23.5 56.5T800-240H240L80-80Zm126-240h594v-480H160v525l46-45Zm-46 0v-480 480Z"/></svg>
            Kommentare
          </button>
        }
        @if (view.player.showUnitMenu) {
          <button matButton data-cy="unit-menu" (click)="openPanel.emit('units')">
            <svg viewBox="0 -960 960 960" aria-hidden="true"><path d="M324-111.5Q251-143 197-197t-85.5-127Q80-397 80-480t31.5-156Q143-709 197-763t127-85.5Q397-880 480-880t156 31.5Q709-817 763-763t85.5 127Q880-563 880-480t-31.5 156Q817-251 763-197t-127 85.5Q563-80 480-80t-156-31.5ZM253-253l227-227v-320q-134 0-227 93t-93 227q0 64 24 123t69 104Z"/></svg>
            Bearbeitungsstand
          </button>
        }
        @if (view.showFullscreenButton || view.showReloadButton) {
          <button matIconButton [matMenuTriggerFor]="menu" aria-label="Weitere Aktionen"
            id="originalPlayerMoreButton">
            <svg viewBox="0 -960 960 960" aria-hidden="true"><path d="M480-160q-33 0-56.5-23.5T400-240q0-33 23.5-56.5T480-320q33 0 56.5 23.5T560-240q0 33-23.5 56.5T480-160Zm0-240q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Zm0-240q-33 0-56.5-23.5T400-720q0-33 23.5-56.5T480-800q33 0 56.5 23.5T560-720q0 33-23.5 56.5T480-640Z"/></svg>
          </button>
          <mat-menu #menu="matMenu" class="original-player-menu">
            @if (view.showFullscreenButton) {
              <button mat-menu-item id="originalPlayerFullscreenButton" data-cy="fullscreen"
                (click)="view.toggleFullscreen()">
                <svg viewBox="0 -960 960 960" aria-hidden="true"><path d="M120-120v-240h80v104l124-124 56 56-124 124h104v80H120Zm480 0v-80h104L580-324l56-56 124 124v-104h80v240H600ZM324-580 200-704v104h-80v-240h240v80H256l124 124-56 56Zm312 0-56-56 124-124H600v-80h240v240h-80v-104L636-580ZM480-400q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Z"/></svg>Vollbild</button>
            }
            @if (view.showReloadButton) {
              <button mat-menu-item id="originalPlayerReloadButton" data-cy="reloadPage"
                (click)="view.reloadPage()">
                <svg viewBox="0 -960 960 960" aria-hidden="true"><path d="M204-318q-22-38-33-78t-11-82q0-134 93-228t227-94h7l-64-64 56-56 160 160-160 160-56-56 64-64h-7q-100 0-170 70.5T240-478q0 26 6 51t18 49l-60 60ZM481-40 321-200l160-160 56 56-64 64h7q100 0 170-70.5T720-482q0-26-6-51t-18-49l60-60q22 38 33 78t11 82q0 134-93 228t-227 94h-7l64 64-56 56Z"/></svg>Neu laden</button>
            }
          </mat-menu>
        }
      </div>
    </div>
  `,
  styleUrls: ["./original-player-toolbar.component.css", "./original-login-theme.scss"]
})
export class OriginalPlayerToolbarComponent {
  readonly view = inject(ParticipantViewFacade);
  @Output() readonly openPanel = new EventEmitter<"review" | "units">();
}
