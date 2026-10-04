import { Component, Input } from "@angular/core";
import type { AfterViewInit, OnDestroy } from "@angular/core";
import { NgIf, NgSwitch, NgSwitchCase } from "@angular/common";
import { MatButton } from "@angular/material/button";
import { MatCard, MatCardActions, MatCardContent, MatCardHeader, MatCardSubtitle, MatCardTitle } from "@angular/material/card";
import type { SystemCheckViewComponent } from "./system-check-view.component";
import { OriginalSystemCheckSpeedChartComponent } from "./original-system-check-speed-chart.component";

// Adapted from IQB Testcenter 19 network-check.component.html (MIT).
// See assets/ORIGINAL-UI-LICENSE.txt. The shared controller owns measurements,
// cancellation and reports; this optional surface never starts a second engine.
@Component({
  selector: "app-original-system-check-network", standalone: true,
  imports: [NgIf, NgSwitch, NgSwitchCase, MatButton, MatCard, MatCardActions, MatCardContent,
    MatCardHeader, MatCardSubtitle, MatCardTitle, OriginalSystemCheckSpeedChartComponent],
  template: `
    <div class="sys-check-body" id="originalSystemCheckNetwork" *ngIf="view.systemCheck as check">
      <mat-card appearance="raised">
        <mat-card-header>
          <mat-card-title>Netzwerk<span *ngIf="!done" style="color:red"> - Test läuft, bitte warten.</span></mat-card-title>
          <mat-card-subtitle>
            <span id="systemCheckNetworkStatus">{{ view.networkStatusMessage }}</span>{{ ' ' }}
            <span *ngIf="done" [ngSwitch]="view.networkRating">Ihre Verbindung zum Testserver ist
              <span *ngSwitchCase="'insufficient'" style="color:red; font-weight:bold;">unzureichend</span>
              <span *ngSwitchCase="'ok'" style="color:orange; font-weight:bold;">vorauss. ausreichend</span>
              <span *ngSwitchCase="'good'" style="color:green; font-weight:bold;">gut</span>
              <span *ngSwitchCase="'unstable'" style="color:orangered; font-weight:bold;">sehr instabil</span>.
            </span>
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="flex-row">
            <div class="speed-chart">
              <span style="font-weight:normal">Geschwindigkeit Download: </span>
              <span id="originalSystemCheckDownload">{{ speed(view.networkDownloadBytesPerSecond) }}</span>
              <app-original-system-check-speed-chart [download]="true" [sizes]="check.downloadSpeed.sequenceSizes"
                [sequences]="view.networkDownloadPoints" label="Download: Paketgröße und Antwortzeit" />
            </div>
            <div class="speed-chart">
              <span style="font-weight:normal">Geschwindigkeit Upload: </span>
              <span id="originalSystemCheckUpload">{{ speed(view.networkUploadBytesPerSecond) }}</span>
              <app-original-system-check-speed-chart [sizes]="check.uploadSpeed.sequenceSizes"
                [sequences]="view.networkUploadPoints" label="Upload: Paketgröße und Antwortzeit" />
            </div>
          </div>
        </mat-card-content>
        <mat-card-actions>
          <button id="runSystemCheckNetworkButton" mat-raised-button [disabled]="!done" (click)="view.runNetworkCheck()">Neustart</button>
        </mat-card-actions>
      </mat-card>
    </div>
  `,
  styles: [`
    :host { display:block; min-width:0; }
    .sys-check-body { padding:5px; display:flex; flex-wrap:wrap; justify-content:center; }
    mat-card { flex-basis:810px; min-width:0; max-width:100%; }
    .mat-mdc-card-title { margin-bottom:10px; }
    .flex-row { display:flex; flex-direction:row; }
    .speed-chart { width:50%; min-width:0; margin:10px; }
  `],
  styleUrl: "./original-login-theme.scss"
})
export class OriginalSystemCheckNetworkComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) view!: SystemCheckViewComponent;
  private startFrame = 0;
  get done(): boolean { return !this.view.networkBusy && this.view.networkEntries.length > 0; }
  ngAfterViewInit(): void {
    this.startFrame = requestAnimationFrame(() => {
      if (!this.done && this.view.step === "network") void this.view.runNetworkCheck();
    });
  }
  ngOnDestroy(): void { cancelAnimationFrame(this.startFrame); }
  speed(bytesPerSecond: number): string {
    if (bytesPerSecond < 0) return "Test noch nicht gestartet";
    if (!bytesPerSecond) return "⌀ 0/s";
    const bits = bytesPerSecond * 8;
    const index = Math.min(4, Math.floor(Math.log(bits) / Math.log(1000)));
    return `⌀ ${(bits / 1000 ** index).toFixed(2)} ${["bit", "kbit", "Mbit", "Gbit", "Tbit"][index]}/s`;
  }
}
