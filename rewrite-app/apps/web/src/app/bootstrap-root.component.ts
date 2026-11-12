import {Component,Injector,effect,inject,signal} from '@angular/core';
import {Router,RouterOutlet,NavigationEnd} from '@angular/router';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ApplicationSettingsService} from './application-settings.service';
import {InterfaceModeService} from './interface-mode.service';
import {NativeSystemCheckInstallationService} from './native-system-check/native-system-check-installation.service';

/** The native UI and canonical UI each own their routed shell and private DOM. */
@Component({selector:'app-root',standalone:true,imports:[RouterOutlet],
 template:`@if(nativeView()&&settings.activeWarningText();as warning){<section class="application-warning-banner" role="alert" aria-live="assertive"><strong>Service notice</strong><span>{{warning}}</span></section>}
 @if(nativeView()&&!online()){<section class="offline-shell-banner" role="status" aria-live="polite"><strong>Offline mode</strong><span>The application shell is available, but signing in, loading test content, and saving require a connection.</span></section>}
 <router-outlet />`,
 styles:`:host{display:contents}.application-warning-banner,.offline-shell-banner{display:flex;gap:12px;align-items:center;padding:12px 24px;background:#fff4cf;color:#292a2c}`})
export class BootstrapRootComponent {
 readonly settings=inject(ApplicationSettingsService);readonly nativeView=signal(false);readonly online=signal(navigator.onLine);
 private readonly router=inject(Router);
 private readonly installation=inject(NativeSystemCheckInstallationService);
 private readonly injector=inject(Injector);
 private readonly owner=new AbortController();
 private errorRevision=0;
 private dismissedInstallationProblem:unknown;
 private closeInstallationError:(()=>void)|undefined;
 private loadingNativeSettings=false;
 private readonly updateOnline=()=>this.online.set(navigator.onLine);
 private readonly dismissInstallationError=()=>{
  this.dismissedInstallationProblem=this.installation.problem();this.errorRevision++;
 };
 constructor(){
  // Capture the entry presentation before an authentication guard redirects
  // its URL and the lazy canonical shell is constructed.
  inject(InterfaceModeService);
  effect(()=>{const problem=this.installation.problem();if(problem&&problem!==this.dismissedInstallationProblem)void this.showInstallationError(problem);});
  const update=()=>{const url=this.router.url.split('?',1)[0];const native=['/native-start','/native-test','/group-monitor','/check','/r/check-starter'].some(path=>url===path||url.startsWith(path+'/'));this.nativeView.set(native);if(native&&!this.settings.loaded()&&!this.loadingNativeSettings){this.loadingNativeSettings=true;void this.settings.load().catch(()=>undefined).finally(()=>this.loadingNativeSettings=false);}};
  this.router.events.pipe(takeUntilDestroyed()).subscribe(event=>{if(event instanceof NavigationEnd)update();});
  window.addEventListener('online',this.updateOnline);window.addEventListener('offline',this.updateOnline);
  // Source closes an error on browser-history navigation. Also retire a
  // presentation whose lazy module has not arrived yet, without suppressing
  // a genuinely new request failure occurring after that navigation.
  window.addEventListener('popstate',this.dismissInstallationError);window.addEventListener('hashchange',this.dismissInstallationError);
 }
 private async showInstallationError(error:unknown){
  const revision=++this.errorRevision;
  const {openNativeSystemCheckInstallationError}=await import('./native-system-check/native-system-check-installation-error');
  if(this.owner.signal.aborted||revision!==this.errorRevision)return;
  this.closeInstallationError?.();this.closeInstallationError=openNativeSystemCheckInstallationError(this.injector,error,this.owner.signal);
 }
 ngOnDestroy(){this.owner.abort();this.closeInstallationError?.();window.removeEventListener('online',this.updateOnline);window.removeEventListener('offline',this.updateOnline);window.removeEventListener('popstate',this.dismissInstallationError);window.removeEventListener('hashchange',this.dismissInstallationError);}
}
