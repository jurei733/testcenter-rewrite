import {Component,effect,inject,signal,untracked} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {Router,RouterLink} from '@angular/router';
import {MatToolbar} from '@angular/material/toolbar';
import {MatInput} from '@angular/material/input';
import {MatFormField,MatLabel,MatSuffix} from '@angular/material/form-field';
import {MatButton,MatIconButton} from '@angular/material/button';
import {MatMenu,MatMenuItem,MatMenuTrigger} from '@angular/material/menu';
import {MatDialog} from '@angular/material/dialog';
import {Subscription,fromEvent,take} from 'rxjs';
import {NativeMonitorSessionService,NativeMonitorHttpError} from '../native-monitor/native-session.service';
import {NativeMonitorIconComponent as MatIcon} from '../native-monitor/native-monitor-icon.component';
import {ApplicationSettingsService} from '../application-settings.service';
import {InterfaceModeService} from '../interface-mode.service';
import {OriginalOverlayStylesComponent} from '../original-overlay-styles.component';
import {OriginalFooterComponent} from '../original-footer.component';
import {OriginalParticipantLogoutDialogComponent} from '../original-participant-logout-dialog.component';
import {NativeStarterComponent} from './starter/native-starter.component';
import {CodeInputComponent} from './shared/components/code-input/code-input.component';
import {AssetService} from './shared/services/asset.service';
import {NativeTerminalCompletionService} from './native-terminal-completion.service';
import {CustomtextService} from './shared/services/customtext/customtext.service';
import type {CodeInputType} from './app.interfaces';
@Component({selector:'app-native-participant-entry',standalone:true,
 imports:[FormsModule,RouterLink,OriginalFooterComponent,MatToolbar,MatInput,MatFormField,MatLabel,MatSuffix,MatButton,MatIconButton,MatMenu,MatMenuItem,MatMenuTrigger,MatIcon,OriginalOverlayStylesComponent,NativeStarterComponent,CodeInputComponent],
 providers:[AssetService,CustomtextService],styleUrls:['../native-monitor/native-monitor-entry.component.css','../original-login-theme.scss'],
 template:`<app-original-overlay-styles /><header><mat-toolbar data-cy="header"><div class="side">@if(session.access()&&!session.busy()){<button matIconButton class="account-button" [matMenuTriggerFor]="accountMenu" aria-label="Nutzerinformationen"><mat-icon svgIcon="person" /></button><mat-menu #accountMenu="matMenu"><div class="account-heading">Nutzerinformationen</div><dl><dt>Anmeldename:</dt><dd>{{session.access()?.loginName}}</dd><dt>Gruppe:</dt><dd>{{session.access()?.groupLabel}}</dd></dl><button mat-menu-item (click)="logout()" data-cy="logout-button">Abmelden</button></mat-menu>}</div><div class="center"><h1>{{!session.access()?'Anmelden':!codeRequired?'Übersicht':settings.settings().appTitle}}</h1></div><div class="side logo"><img [src]="settings.assetUrl('logo',settings.settings().mainLogo)" alt="Logo der Anwendung" /></div></mat-toolbar></header>
 @if(problem()){<p class="native-error" role="alert">{{problem()}}</p>}
 @if(session.restoring()||refreshing()){<p role="status">Sitzung wird geprüft …</p>}
 @else if(!session.access()){
 <div class="login-page"><div class="welcome-section"><img [src]="settings.assetUrl('loginIllustration')" alt=""/><div><p class="heading">Willkommen im IQB‑Testcenter</p><p>Das IQB-Testcenter ist eine Anwendung des Instituts zur Qualitätsentwicklung im Bildungswesen (IQB) zur Durchführung digitaler Tests und Befragungen. Der Zugang ist mit den Zugangsdaten möglich, die Sie vorab erhalten haben.</p></div></div>
 <div class="login-section">@if(!passwordStep()){<form (ngSubmit)="submit()"><h2>Anmeldenamen eingeben</h2><mat-form-field appearance="outline"><mat-label>Anmeldename</mat-label><input matInput name="name" [(ngModel)]="name" required minlength="3" autocomplete="username" autocapitalize="off" /></mat-form-field><button matButton="filled" class="login-submit" type="submit" data-cy="login-user" [disabled]="session.busy()||name.trim().length<3">@if(!passwordStep()){<mat-icon svgIcon="chevron_right" />}{{passwordStep()?'Anmelden':'Weiter'}}</button>@if(session.busy()){<p role="status">Sicherheitsprüfung …</p>}</form>}@else{<form (ngSubmit)="submit()"><div class="password-headline"><button matIconButton type="button" (click)="passwordStep.set(false);password=''" aria-label="Zurück"><mat-icon svgIcon="chevron_left" /></button><h2>Kennwort eingeben</h2></div><mat-form-field appearance="outline"><mat-label>Kennwort</mat-label><input matInput name="password" autofocus [(ngModel)]="password" [type]="showPassword?'text':'password'" autocomplete="current-password"/><button mat-icon-button matSuffix type="button" aria-label="Kennwort anzeigen" [attr.aria-pressed]="showPassword" (click)="showPassword=!showPassword"><mat-icon svgIcon="visibility" /></button></mat-form-field><button matButton="filled" class="login-submit" type="submit" data-cy="login-user" [disabled]="session.busy()||name.trim().length<3">@if(!passwordStep()){<mat-icon svgIcon="chevron_right" />}{{passwordStep()?'Anmelden':'Weiter'}}</button>@if(session.busy()){<p role="status">Sicherheitsprüfung …</p>}</form>}<div class="button-section"><button matButton="tonal" type="button" routerLink="/ops" data-cy="login-admin-form">Adminbereich</button></div></div></div>
 }@else if(codeRequired){<tc-code-input [inputType]="codeInputType" [length]="codeLength" [disabled]="session.busy()" [problemText]="problem()" (submitCode)="code($event)" />}
 @else if(refreshFailed()){<button matButton="filled" (click)="refreshStarter()">Übersicht erneut laden</button>}
 @else{@for(scope of ownerKeys;track scope){<app-native-starter />}}@if(!session.access()){<app-original-footer />}`})
export class NativeParticipantEntryComponent {
 readonly session=inject(NativeMonitorSessionService);readonly settings=inject(ApplicationSettingsService);
 private readonly cts=inject(CustomtextService);private readonly router=inject(Router);private readonly dialog=inject(MatDialog);
 private readonly view=new AbortController();private logoutCleanup:(()=>void)|undefined;
 private readonly completions=inject(NativeTerminalCompletionService);
 readonly refreshing=signal(false);
 readonly refreshFailed=signal(false);
 private textScope:AbortSignal|undefined;
 private readonly clearTexts=()=>this.cts.restoreDefault(true);
 readonly passwordStep=signal(false);readonly problem=signal('');name='';password='';showPassword=false;
 constructor(){inject(InterfaceModeService).select('original');effect(()=>{const access=this.session.access();untracked(()=>this.bindTexts(access?.customTexts??{}));});
  if(this.session.access()&&!this.codeRequired)void this.refreshStarter();
 }
 async refreshStarter(){
  if(this.refreshing()||this.view.signal.aborted)return;
  this.refreshing.set(true);this.refreshFailed.set(false);this.problem.set('');
  const scope=this.session.accessSignal,current=()=>!this.view.signal.aborted&&!scope.aborted&&scope===this.session.accessSignal;
  try{await this.completions.whenSettled(scope);if(current())await this.session.refresh(this.view.signal);}
  catch(error){if(current()){this.refreshFailed.set(true);this.problem.set(error instanceof Error?error.message:'Die Übersicht konnte nicht aktualisiert werden.');}}
  finally{if(!this.view.signal.aborted)this.refreshing.set(false);}
 }
 private bindTexts(texts:Record<string,string>){
  const scope=this.session.accessSignal;if(this.textScope===scope)return;
  this.refreshFailed.set(false);this.problem.set('');
  this.textScope?.removeEventListener('abort',this.clearTexts);this.clearTexts();this.textScope=scope;
  if(!scope.aborted){this.cts.addCustomTexts(texts);scope.addEventListener('abort',this.clearTexts,{once:true});}
 }
 get codeRequired(){return this.session.access()?.flags.includes('codeRequired')??false;}
 get ownerKeys(){this.session.access();this.session.busy();return [this.session.accessSignal];}
 get codeInputType():CodeInputType{const s=this.session.access()?.viewSettings;return s&&!Array.isArray(s)?s.codeInput?.type??'text-field':'text-field';}
 get codeLength(){const s=this.session.access()?.viewSettings;return s&&!Array.isArray(s)?s.codeInput?.length:undefined;}
 async submit(){if(this.session.busy()||this.name.trim().length<3)return;this.problem.set('');try{
  const access=await this.session.loginParticipant(this.name.trim(),this.passwordStep()?this.password:'',this.view.signal);if(this.view.signal.aborted||this.session.access()!==access)return;this.bindTexts(access.customTexts);this.password='';this.passwordStep.set(false);
 }catch(error){if(this.view.signal.aborted||(error instanceof Error&&error.name==='AbortError'))return;if(!this.passwordStep()&&error instanceof NativeMonitorHttpError&&[400,401].includes(error.status)){this.passwordStep.set(true);this.session.problem.set('');}else this.problem.set(error instanceof Error?error.message:'Problem bei der Anmeldung.');}}
 async code(value:string){if(this.session.busy())return;this.problem.set('');try{const access=await this.session.person(value,this.view.signal);if(!this.view.signal.aborted&&this.session.access()===access)this.bindTexts(access.customTexts);}catch(error){if(!this.view.signal.aborted)this.problem.set(error instanceof Error?error.message:'Problem bei der Anmeldung.');}}
 logout(){if(this.logoutCleanup||this.view.signal.aborted)return;const scope=this.session.accessSignal,ref=this.dialog.open(OriginalParticipantLogoutDialogComponent,{data:{safeMode:this.settings.settings().themeName==='Primar'},autoFocus:'dialog'}),subscriptions=new Subscription();
  const retire=()=>{subscriptions.unsubscribe();ref.componentRef?.location.nativeElement.remove();ref.close();if(this.logoutCleanup===retire)this.logoutCleanup=undefined;};this.logoutCleanup=retire;subscriptions.add(fromEvent(scope,'abort').subscribe(retire));
  subscriptions.add(ref.afterClosed().pipe(take(1)).subscribe(result=>{retire();if(result&&!this.view.signal.aborted&&scope===this.session.accessSignal&&!scope.aborted){void this.session.logout().catch(error=>{if(!this.view.signal.aborted&&!this.session.access())this.problem.set(String(error));});}}));
 }
 ngOnDestroy(){this.view.abort();this.logoutCleanup?.();this.textScope?.removeEventListener('abort',this.clearTexts);this.clearTexts();}
}
