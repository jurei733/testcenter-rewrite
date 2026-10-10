import { Component, Input, inject } from "@angular/core";
import type { OnDestroy, OnInit } from "@angular/core";
import { MatButton } from "@angular/material/button";
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogTitle } from "@angular/material/dialog";
import type { MatDialogRef } from "@angular/material/dialog";
import { MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle } from "@angular/material/expansion";
import { redactBugReportText } from "@testcenter-rewrite-app/contracts";
import UAParser from "ua-parser-js";
import { OriginalOverlayStylesComponent } from "./original-overlay-styles.component";
import { originalErrorTimestamp } from "./original-error-timestamp";
import { ParticipantViewFacade } from "./participant-view.facade";
import type { VeronaControllerError } from "./verona-player-host.component";

type ErrorDialogData = {
  error: VeronaControllerError;
  helpText: string;
  url: string;
  booklet: string;
  login: string;
  mode: string;
  reload: () => void;
};

// Adapted from pinned IQB Testcenter 19 shared/error-dialog (MIT).
// Keep the existing controller, durable saves and selected-Run authorization.
@Component({
  selector: "app-original-participant-error-dialog", standalone: true,
  imports: [MatButton, MatDialogActions, MatDialogContent, MatDialogTitle,
    MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle, OriginalOverlayStylesComponent],
  template: `<app-original-overlay-styles />
    <h2 mat-dialog-title id="participantRuntimeErrorTitle"><span class="mat-icon" role="img" aria-hidden="true"><svg height="24px" viewBox="0 -960 960 960" width="24px"><path d="M508.5-291.5Q520-303 520-320t-11.5-28.5Q497-360 480-360t-28.5 11.5Q440-337 440-320t11.5 28.5Q463-280 480-280t28.5-11.5ZM440-440h80v-240h-80v240Zm40 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/></svg></span>Fehler beim Abspielen der Aufgabe</h2>
    <mat-dialog-content>
      @if (data.helpText) {
        <p style="white-space: pre-wrap"> {{ data.helpText }} </p>
      } @else {
        Es ist ein Programmfehler aufgetreten.
        Laden Sie die Seite neu und probieren es noch einmal. Sollte das Problem weiterhin bestehen bleiben,
        melden Sie es dem zuständigen Systemadministrator.
      }
      <mat-expansion-panel>
        <mat-expansion-panel-header><mat-panel-title>Fehlerdetails</mat-panel-title></mat-expansion-panel-header>
        <h3>Fehlerbericht: Fehler beim Abspielen der Aufgabe</h3>
        <p [innerHTML]="description"></p>
        <p><b>Zeitpunkt:</b> {{ timestamp }}</p>
        <p><b>Url: </b>{{ data.url }}</p>
        <p><b>Browser: </b>{{ browser.browser.name }} {{ browser.browser.version }}</p>
        <p><b>Betriebssystem: </b>{{ browser.os.name }} {{ browser.os.version }}</p>
        <p><b>Gerät: </b>{{ browser.device.type }} {{ browser.device.vendor }} {{ browser.device.model }}</p>
        <p><b>Booklet: </b>{{ data.booklet }}</p>
        <p><b>Login: </b>{{ data.login }}</p>
        <p><b>Mode: </b>{{ data.mode }}</p>
        <p>{{ details }}</p>
      </mat-expansion-panel>
    </mat-dialog-content>
    <mat-dialog-actions>
      <button mat-raised-button id="participantRouteControllerReloadButton" data-cy="close"
        (click)="data.reload()">Schließen und neu laden</button>
    </mat-dialog-actions>`,
  styles: [`
    app-original-overlay-styles { display: none; }
    .mat-mdc-dialog-actions { --mat-dialog-actions-alignment: center; }
    h2 .mat-icon { margin-right: 15px; color: #A92319; display: inline-block;
      width: 24px; height: 24px; fill: currentColor; overflow: hidden;
      flex-shrink: 0; box-sizing: content-box; user-select: none; }
    .mat-expansion-panel { margin-bottom: 10px; }
    p { margin: 1em 0; font: inherit; }
    h3 { font: bold 1.17em 'Nunito Sans', sans-serif; margin: 1em 0; }
  `]
})
export class OriginalParticipantErrorDialogComponent {
  readonly data = inject<ErrorDialogData>(MAT_DIALOG_DATA);
  readonly browser = new UAParser().getResult();
  readonly timestamp = originalErrorTimestamp(this.data.error.timestamp ?? Date.now());
  readonly description = redactBugReportText(this.data.error.description ?? this.data.error.message);
  readonly details = redactBugReportText(this.data.error.details ?? "");

}

@Component({ selector: "app-original-participant-error-launcher", standalone: true, template: "" })
export class OriginalParticipantErrorLauncherComponent implements OnInit, OnDestroy {
  @Input({ required: true }) error!: VeronaControllerError;
  private readonly dialogs = inject(MatDialog);
  private readonly view = inject(ParticipantViewFacade);
  private dialog?: MatDialogRef<OriginalParticipantErrorDialogComponent>;

  ngOnInit(): void {
    const error = this.error;
    this.dialog = this.dialogs.open(OriginalParticipantErrorDialogComponent, {
      panelClass: "original-participant-error-dialog",
      disableClose: true, autoFocus: "dialog", restoreFocus: false,
      ariaLabelledBy: "participantRuntimeErrorTitle",
      data: {
        error, helpText: this.view.customText("booklet_errormessage"),
        url: redactBugReportText(globalThis.window?.location.href ?? ""),
        booklet: this.view.player.bookletLabel, login: this.view.player.displayNameLabel,
        mode: this.view.player.executionModeLabel,
        reload: () => this.view.reloadAfterControllerError(error)
      } satisfies ErrorDialogData
    });
  }

  ngOnDestroy(): void { this.dialog?.close(); }
}
