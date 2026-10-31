import {type AfterViewInit,Component,ViewChild,ViewContainerRef,inject,signal,effect,untracked} from '@angular/core';
import {ActivatedRoute,ChildrenOutletContexts,Router} from '@angular/router';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {MatToolbar} from '@angular/material/toolbar';
import {MatButton,MatIconButton} from '@angular/material/button';
import {NativeMonitorIconComponent as MatIcon} from '../native-monitor/native-monitor-icon.component';
import {NativeMonitorSessionService} from '../native-monitor/native-session.service';
import {ApplicationSettingsService} from '../application-settings.service';
import {InterfaceModeService} from '../interface-mode.service';
import {OriginalOverlayStylesComponent} from '../original-overlay-styles.component';
import {NativeRunRuntime} from './native-run-runtime.service';
import type {NativeRunContext} from './native-run-context';
import {HeaderService} from './shared/services/header.service';
@Component({selector:'app-native-run-host',standalone:true,imports:[MatToolbar,MatButton,MatIconButton,MatIcon,OriginalOverlayStylesComponent],
 template:`<app-original-overlay-styles />
 @if(!header?.isHeaderHidden){<header><mat-toolbar><button matIconButton aria-label="Zur Übersicht" (click)="back()"><mat-icon svgIcon="chevron_left" /></button><h1>{{header?.title||settings.settings().appTitle}}</h1><img [src]="settings.assetUrl('logo',settings.settings().mainLogo)" alt="Logo der Anwendung" /></mat-toolbar></header>}
 @if(problem()){<p role="alert">{{problem()}}</p>}
 @if(session.restoring()){<p role="status">Sitzung wird geprüft …</p>}
 @if(!session.restoring()&&!session.access()){<button matButton="filled" (click)="back()">Anmelden</button>}
 <ng-container #controller />`,
 styles:`:host{display:flex;flex-direction:column;height:100%;min-height:0}mat-toolbar{display:flex;gap:16px}h1{flex:1;margin:0;text-align:center;font-size:20px}img{max-width:170px;max-height:48px}`})
export class NativeRunHostComponent implements AfterViewInit {
 @ViewChild('controller',{read:ViewContainerRef,static:true}) private slot!:ViewContainerRef;
 readonly runtime=inject(NativeRunRuntime);readonly session=inject(NativeMonitorSessionService);readonly settings=inject(ApplicationSettingsService);
 readonly problem=signal('');private readonly ready=signal(false);private readonly testId=signal('');
 ownedContext:NativeRunContext|undefined;
 private readonly route=inject(ActivatedRoute);private readonly children=inject(ChildrenOutletContexts);private readonly router=inject(Router);
 constructor(){
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
