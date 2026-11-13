import {Component,inject,signal} from '@angular/core';
import {Router,RouterLink} from '@angular/router';
import {MatToolbar} from '@angular/material/toolbar';
import {MatCard,MatCardHeader,MatCardTitle,MatCardSubtitle,MatCardContent,MatCardActions} from '@angular/material/card';
import {MatButton} from '@angular/material/button';
import {MatIcon} from '@angular/material/icon';
import {NativeMonitorSessionService,NativeMonitorHttpError} from '../native-monitor/native-session.service';
import {NativeAssetContext} from '../native-asset-context.service';
import {NativeThemeContext} from '../native-theme-context.service';
import {ApplicationSettingsService} from '../application-settings.service';
import {InterfaceModeService} from '../interface-mode.service';
import {NativeLoginFailureService} from '../native-login-failure.service';
import {OriginalOverlayStylesComponent} from '../original-overlay-styles.component';
import {NativePublicHeaderService} from '../native-public-header.service';
import {parseNativeSystemCheckDirectory,type NativeSystemCheckInfo} from './native-system-check-directory';

// Adapted from pinned Original app-root/sys-check-starter (MIT).
// See assets/ORIGINAL-UI-LICENSE.txt.
@Component({selector:'app-native-system-check-starter',standalone:true,providers:[NativeLoginFailureService],
 imports:[RouterLink,MatToolbar,MatCard,MatCardHeader,MatCardTitle,MatCardSubtitle,MatCardContent,MatCardActions,MatButton,MatIcon,OriginalOverlayStylesComponent],
 styleUrls:['../native-monitor/native-monitor-entry.component.css','../original-system-check-content-theme.scss'],
 styles:[`:host{color:var(--mat-sys-on-surface)}.selection{display:flex;flex-wrap:wrap;justify-content:center}.selection .mat-mdc-card{width:400px}.booklet_title{font-size:16pt;text-align:center;white-space:pre-wrap;word-break:break-word;line-height:130%}.booklet_status{font-size:8pt;margin-top:0;color:mediumturquoise;text-align:center}.checks{display:flex;flex-direction:column;gap:10px}.mat-mdc-raised-button.starter{padding:1em;height:auto;display:flex;justify-content:center;align-items:center}`],
 template:`<app-original-overlay-styles /><header><mat-toolbar data-cy="header"><div class="side"></div><div class="center">@if(header.title();as title){<h1>{{title}}</h1>}</div><div class="side logo"><a routerLink="/native-start" aria-label="Gehe zur Startseite"><img [src]="settings.assetUrl('logo',settings.settings().mainLogo)" alt="Logo der Anwendung" /></a></div></mat-toolbar></header>
 <main class="native-login-outlet"><div class="selection"><mat-card appearance="raised"><mat-card-header><mat-card-title>{{settings.settings().appTitle}}</mat-card-title><mat-card-subtitle>Systemcheck Auswahl</mat-card-subtitle></mat-card-header>
 <mat-card-content><p>Hier können Sie ermitteln, ob das Computersystem, das Sie gerade benutzen, für die hier vorgesehenen Testungen geeignet ist.</p>
 @if(loading()){<p>Bitte warten... Konfiguration wird geladen</p>}@else if(!problem()){
 @if(checks().length===0){<p>Auf diesem Server ist aktuell kein Systemcheck verfügbar.</p>}
 @if(checks().length>1){<p>Bitte wählen Sie einen Check aus!</p>}
 @if(checks().length===1){<p>Bitte klicken Sie auf den Schalter, um den Check zu starten!</p>}}
 @if(problem()){<p role="alert">{{problem()}}</p>}
 <div class="checks">@for(check of checks();track $index){<button mat-raised-button class="starter" (click)="start(check)"><div class="booklet_title">{{check.label}}</div><div class="booklet_status">{{check.description}}</div></button>}</div></mat-card-content>
 <mat-card-actions><button routerLink="/native-start" mat-raised-button><mat-icon>arrow_back</mat-icon> zurück zur Startseite</button></mat-card-actions></mat-card></div></main>`})
export class NativeSystemCheckStarterComponent {
 readonly header=inject(NativePublicHeaderService);
 readonly settings=inject(ApplicationSettingsService);readonly checks=signal<NativeSystemCheckInfo[]>([]);readonly loading=signal(true);readonly problem=signal('');
 private readonly session=inject(NativeMonitorSessionService);private readonly router=inject(Router);private readonly failure=inject(NativeLoginFailureService);private readonly owner=new AbortController();
 constructor(){inject(NativeAssetContext).activate(this.owner.signal);inject(NativeThemeContext).activate(this.owner.signal);inject(InterfaceModeService).select('original');void this.load();}
 private async load(){
  try{const text=await this.session.text('GET','/sys-checks',undefined,'',false,this.owner.signal);this.owner.signal.throwIfAborted();this.checks.set(parseNativeSystemCheckDirectory(text));}
  catch(error){if(this.owner.signal.aborted)return;this.problem.set(error instanceof Error?error.message:'Die Systemcheck-Auswahl konnte nicht geladen werden.');if(error instanceof NativeMonitorHttpError)await this.failure.show(error,this.owner.signal);}
  finally{if(!this.owner.signal.aborted)this.loading.set(false);}
 }
 start(check:NativeSystemCheckInfo){if(!this.owner.signal.aborted&&this.checks().includes(check))void this.router.navigate(['/check',check.workspaceId,check.name,'w']);}
 ngOnDestroy(){this.owner.abort();}
}
