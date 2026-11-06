import {NgTemplateOutlet} from '@angular/common';
import {MatTooltip} from '@angular/material/tooltip';
import {type AfterViewInit,Component,ViewChild,ViewContainerRef,inject,signal,effect,untracked} from '@angular/core';
import {ActivatedRoute,ChildrenOutletContexts,Router,RouterLink} from '@angular/router';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {MatToolbar} from '@angular/material/toolbar';
import {MatButton} from '@angular/material/button';
import {NativeMonitorSessionService} from '../native-monitor/native-session.service';
import {ApplicationSettingsService} from '../application-settings.service';
import {InterfaceModeService} from '../interface-mode.service';
import {OriginalOverlayStylesComponent} from '../original-overlay-styles.component';
import {NativeRunRuntime} from './native-run-runtime.service';
import type {NativeRunContext} from './native-run-context';
import {HeaderService} from './shared/services/header.service';
import {NativeBackgroundService} from './native-background.service';
@Component({selector:'app-native-run-host',standalone:true,imports:[NgTemplateOutlet,RouterLink,MatTooltip,MatToolbar,MatButton,OriginalOverlayStylesComponent],
 template:`<app-original-overlay-styles />
 @if(!header?.isHeaderHidden){<header><mat-toolbar data-cy="header"><div class="side"></div><div class="center">@if(header?.title){<h1>{{header?.title}}</h1>}</div><div class="side logo"><ng-container [ngTemplateOutlet]="logo" /></div></mat-toolbar></header>}
 @else{<div class="logo standalone-logo"><ng-container [ngTemplateOutlet]="logo" /></div>}
 <ng-template #logo><a [routerLink]="['/native-start']" aria-label="Gehe zur Startseite"><img [src]="settings.assetUrl('logo',settings.settings().mainLogo)" data-cy="logo" alt="Logo der Anwendung" matTooltip="Zur Startseite" /></a></ng-template>
 @if(problem()){<p role="alert">{{problem()}}</p>}
 @if(session.restoring()){<p role="status">Sitzung wird geprüft …</p>}
 @if(!session.restoring()&&!session.access()){<button matButton="filled" (click)="back()">Anmelden</button>}
 <ng-container #controller />`,
 styleUrls:['./native-run-host.component.scss']})
export class NativeRunHostComponent implements AfterViewInit {
 @ViewChild('controller',{read:ViewContainerRef,static:true}) private slot!:ViewContainerRef;
 readonly runtime=inject(NativeRunRuntime);readonly session=inject(NativeMonitorSessionService);readonly settings=inject(ApplicationSettingsService);
 readonly problem=signal('');private readonly ready=signal(false);private readonly testId=signal('');
 ownedContext:NativeRunContext|undefined;
 private readonly route=inject(ActivatedRoute);private readonly children=inject(ChildrenOutletContexts);private readonly router=inject(Router);
 constructor(){
  inject(NativeBackgroundService);
  inject(InterfaceModeService).select('original');this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(p=>this.testId.set(p.get('t')??''));
  effect(()=>{if(!this.ready()||this.session.restoring()||this.session.busy())return;const access=this.session.access(),id=this.testId();untracked(()=>{
   if(!access){this.ownedContext?.destroy();return;}
   const ctx=this.ownedContext;if(ctx?.current&&ctx.testId===id)return;
   this.problem.set('');try{this.ownedContext=this.runtime.mount(id,this.slot,this.route,this.children);}catch(error){this.problem.set(error instanceof Error?error.message:'Der Test konnte nicht geöffnet werden.');}
  });});
 }
 get header(){const ctx=this.runtime.active();return ctx?.current?ctx.injector.get(HeaderService):null;}
 ngAfterViewInit(){this.ready.set(true);}
 ngOnDestroy(){this.ownedContext?.destroy();}
 back(){void this.router.navigate(['/native-start']);}
}
