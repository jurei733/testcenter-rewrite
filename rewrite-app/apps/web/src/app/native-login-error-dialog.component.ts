import {Component,inject} from '@angular/core';
import {DatePipe} from '@angular/common';
import {MatButton} from '@angular/material/button';
import {MAT_DIALOG_DATA,MatDialogActions,MatDialogContent,MatDialogTitle} from '@angular/material/dialog';
import {MatExpansionPanel,MatExpansionPanelHeader,MatExpansionPanelTitle} from '@angular/material/expansion';
import UAParser from 'ua-parser-js';
import type {AppError} from './native-participant/app.interfaces';
import {NativeMonitorIconComponent as MatIcon} from './native-monitor/native-monitor-icon.component';

// Pinned Original shared/error-dialog, before any authenticated Test exists.
@Component({selector:'app-native-login-error',standalone:true,
 imports:[DatePipe,MatButton,MatDialogActions,MatDialogContent,MatDialogTitle,MatExpansionPanel,MatExpansionPanelHeader,MatExpansionPanelTitle,MatIcon],
 template:`<h2 mat-dialog-title><mat-icon svgIcon="error" />{{data.error.label}}</h2>
 <mat-dialog-content>
  @if(data.error.errorId){<p><b>Error-Id:</b> {{data.error.errorId}} {{data.error.testMode ? '(test-mode: ' + data.error.testMode + ')' : ''}}</p>}
  @switch(data.error.type){
   @case('network'){Leider ist ein Verbindungsfehler aufgetreten.
    Prüfen Sie Ihre Internetverbindung, laden Sie die Seite neu und probieren es noch einmal.}
   @case('network_temporally'){Leider ist ein (vermutlich vorübergehender) Verbindungsfehler aufgetreten.
    Prüfen Sie Ihre Internetverbindung, laden Sie die Seite neu und probieren es noch einmal.}
   @case('session'){Haben Sie sich eventuell auf einem anderen Gerät oder Browserfenster angemeldet?
    Versuchen Sie, sich neu anzumelden.}
   @default{Es ist ein Programmfehler aufgetreten.
    Laden Sie die Seite neu und probieren es noch einmal. Sollte das Problem weiterhin bestehen bleiben,
    melden Sie es dem zuständigen Systemadministrator.}
  }
  <mat-expansion-panel><mat-expansion-panel-header><mat-panel-title>Fehlerdetails</mat-panel-title></mat-expansion-panel-header>
   <h3>Fehlerbericht: {{data.error.label}}</h3><p [innerHTML]="data.error.description"></p>
   @if(data.error.errorId){<p><b>Error-Id:</b> {{data.error.errorId}}</p>}
   <p><b>Zeitpunkt:</b> {{data.timestamp | date:'medium'}}</p><p><b>Url: </b>{{data.url}}</p>
   <p><b>Browser: </b>{{browser.browser.name}} {{browser.browser.version}}</p>
   <p><b>Betriebssystem: </b>{{browser.os.name}} {{browser.os.version}}</p>
   <p><b>Gerät: </b>{{browser.device.type}} {{browser.device.vendor}} {{browser.device.model}}</p>
   <p><b>Booklet: </b></p><p><b>Login: </b>??</p><p><b>Mode: </b>Demo</p><p>{{data.error.details}}</p>
  </mat-expansion-panel>
 </mat-dialog-content>
 <mat-dialog-actions><button mat-raised-button (click)="data.reload()" data-cy="close">Schließen und neu laden</button></mat-dialog-actions>`,
 styles:[`.mat-mdc-dialog-actions{--mat-dialog-actions-alignment:center}h2 mat-icon{margin-right:15px;color:#A92319}.mat-expansion-panel{margin-bottom:10px}`]})
export class NativeLoginErrorDialogComponent {
 readonly data=inject<{error:AppError;url:string;timestamp:number;reload:()=>void}>(MAT_DIALOG_DATA);
 readonly browser=new UAParser().getResult();
}
