import {Component,Injector,effect,inject,signal,untracked} from '@angular/core';
import {Router,RouterOutlet,NavigationEnd} from '@angular/router';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ApplicationSettingsService} from './application-settings.service';
import {InterfaceModeService} from './interface-mode.service';
import {NativeSystemCheckInstallationService} from './native-system-check/native-system-check-installation.service';
import {NativeErrorPresenterService,type NativeErrorPresenter} from './native-error-presenter.service';

/** The native UI and canonical UI each own their routed shell and private DOM. */
@Component({selector:'app-root',standalone:true,imports:[RouterOutlet],
 template:`@if(nativeView()&&settings.activeWarningText();as warning){<section class="application-warning-banner" role="alert" aria-live="assertive"><strong>Service notice</strong><span>{{warning}}</span></section>}
 @if(nativeView()&&!online()&&interfaceMode.mode()==='rewrite'){<section class="offline-shell-banner" role="status" aria-live="polite"><strong>Offline mode</strong><span>The application shell is available, but signing in, loading test content, and saving require a connection.</span></section>}
 <router-outlet />`,
 styles:`:host{display:contents}.application-warning-banner,.offline-shell-banner{display:flex;gap:12px;align-items:center;padding:12px 24px;background:#fff4cf;color:#292a2c}`})
export class BootstrapRootComponent {
 readonly settings=inject(ApplicationSettingsService);readonly nativeView=signal(false);readonly online=signal(navigator.onLine);
 readonly interfaceMode=inject(InterfaceModeService);
 private readonly errors=inject(NativeErrorPresenterService);
 private readonly router=inject(Router);
 private readonly installation=inject(NativeSystemCheckInstallationService);
 private readonly injector=inject(Injector);
 private readonly owner=new AbortController();
 private errorRevision=0;
 private dismissedInstallationProblem:unknown;
 private presentedInstallationProblem:unknown;
 private closeInstallationError:(()=>void)|undefined;
 private loadingNativeSettings=false;
 private readonly updateOnline=()=>this.online.set(navigator.onLine);
 private readonly dismissInstallationError=()=>{
  this.dismissedInstallationProblem=this.installation.problem();this.errorRevision++;
 };
 constructor(){
  // Source loads public settings independently from its lazy routed modules.
  if(!this.settings.loaded()){
   this.loadingNativeSettings=true;
   void this.settings.load().catch(()=>undefined).finally(()=>this.loadingNativeSettings=false);
  }
  // Capture the entry presentation before an authentication guard redirects
  // its URL and the lazy canonical shell is constructed.
  effect(()=>{const problem=this.installation.problem(),presenter=this.errors.presenter();if(problem&&problem!==this.dismissedInstallationProblem&&problem!==this.presentedInstallationProblem)untracked(()=>{void this.showInstallationError(problem,presenter);});});
  const update=()=>{const url=this.router.url.split('?',1)[0];const native=['/native-start','/native-test','/group-monitor','/check','/r/check-starter'].some(path=>url===path||url.startsWith(path+'/'));this.nativeView.set(native);if(native&&!this.settings.loaded()&&!this.loadingNativeSettings){this.loadingNativeSettings=true;void this.settings.load().catch(()=>undefined).finally(()=>this.loadingNativeSettings=false);}};
  this.router.events.pipe(takeUntilDestroyed()).subscribe(event=>{if(event instanceof NavigationEnd)update();});
  window.addEventListener('online',this.updateOnline);window.addEventListener('offline',this.updateOnline);
  // Source closes an error on browser-history navigation. Also retire a
  // presentation whose lazy module has not arrived yet, without suppressing
  // a genuinely new request failure occurring after that navigation.
  window.addEventListener('popstate',this.dismissInstallationError);window.addEventListener('hashchange',this.dismissInstallationError);
 }
 private async showInstallationError(error:unknown,presenter?:NativeErrorPresenter){
  const revision=++this.errorRevision;
  const open=presenter??(await import('./native-system-check/native-system-check-installation-error')).openNativeSystemCheckInstallationError;
  if(this.owner.signal.aborted||revision!==this.errorRevision)return;
  this.closeInstallationError?.();this.closeInstallationError=open(this.injector,error,this.owner.signal);
  this.presentedInstallationProblem=error;
 }
 ngOnDestroy(){this.owner.abort();this.closeInstallationError?.();window.removeEventListener('online',this.updateOnline);window.removeEventListener('offline',this.updateOnline);window.removeEventListener('popstate',this.dismissInstallationError);window.removeEventListener('hashchange',this.dismissInstallationError);}
}
