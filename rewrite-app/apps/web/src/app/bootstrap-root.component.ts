import {Component,inject,signal} from '@angular/core';
import {Router,RouterOutlet,NavigationEnd} from '@angular/router';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ApplicationSettingsService} from './application-settings.service';

/** The native UI and canonical UI each own their routed shell and private DOM. */
@Component({selector:'app-root',standalone:true,imports:[RouterOutlet],
 template:`@if(nativeView()&&settings.activeWarningText();as warning){<section class="application-warning-banner" role="alert" aria-live="assertive"><strong>Service notice</strong><span>{{warning}}</span></section>}
 @if(nativeView()&&!online()){<section class="offline-shell-banner" role="status" aria-live="polite"><strong>Offline mode</strong><span>The application shell is available, but signing in, loading test content, and saving require a connection.</span></section>}
 <router-outlet />`,
 styles:`:host{display:contents}.application-warning-banner,.offline-shell-banner{display:flex;gap:12px;align-items:center;padding:12px 24px;background:#fff4cf;color:#292a2c}`})
export class BootstrapRootComponent {
 readonly settings=inject(ApplicationSettingsService);readonly nativeView=signal(false);readonly online=signal(navigator.onLine);
 private readonly router=inject(Router);
 private loadingNativeSettings=false;
 private readonly updateOnline=()=>this.online.set(navigator.onLine);
 constructor(){
  const update=()=>{const native=['/native-start','/native-test','/group-monitor'].some(path=>this.router.url.split('?',1)[0].startsWith(path));this.nativeView.set(native);if(native&&!this.settings.loaded()&&!this.loadingNativeSettings){this.loadingNativeSettings=true;void this.settings.load().catch(()=>undefined).finally(()=>this.loadingNativeSettings=false);}};
  this.router.events.pipe(takeUntilDestroyed()).subscribe(event=>{if(event instanceof NavigationEnd)update();});
  window.addEventListener('online',this.updateOnline);window.addEventListener('offline',this.updateOnline);
 }
 ngOnDestroy(){window.removeEventListener('online',this.updateOnline);window.removeEventListener('offline',this.updateOnline);}
}
