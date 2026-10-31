import {type AfterViewInit,Component,ElementRef,ViewChild,inject,signal} from '@angular/core';
import {AsyncPipe,NgTemplateOutlet} from '@angular/common';
import {Router} from '@angular/router';
import {MatAccordion,MatExpansionPanel,MatExpansionPanelHeader,MatExpansionPanelTitle} from '@angular/material/expansion';
import {NativeMonitorSessionService} from '../../native-monitor/native-session.service';
import type {OriginalTestGroupMonitorAccess} from '@testcenter-rewrite-app/contracts/original-session';
import {NativeTestStarterService} from '../native-test-starter.service';
import {TestCardComponent} from './test-card.component';
import {AssetService} from '../shared/services/asset.service';
import {CustomtextService} from '../shared/services/customtext/customtext.service';
import {CustomtextPipe} from '../shared/pipes/customtext/customtext.pipe';
import {NativeMonitorIconComponent as MatIcon} from '../../native-monitor/native-monitor-icon.component';
@Component({selector:'app-native-starter',standalone:true,
 imports:[TestCardComponent,AsyncPipe,NgTemplateOutlet,CustomtextPipe,MatAccordion,MatExpansionPanel,MatExpansionPanelHeader,MatExpansionPanelTitle,MatIcon],
 providers:[NativeTestStarterService,AssetService,CustomtextService],styleUrls:['./starter.component.scss'],
 template:`<div class="intro"><img class="companion-image" [src]="assets.getAssetSrc('starterCompanion')" alt="companion-image"/><div class="flex-column"><p class="intro-heading">Schön, dass du da bist!</p><p>Komm, wir legen los. Wähle einen Teil aus.</p></div></div>
 @if(problem()){<p role="alert">{{problem()}}</p>}
 <div class="cards">
 <ng-template #testCardList>@for(booklet of booklets;track booklet.id;let i=$index){<tc-test-card [name]="booklet.name" [index]="i" [mode]="booklet.mode" [disabled]="!!starter.pendingBooklet()" [attr.data-cy]="'booklet-'+booklet.id" (select)="start(booklet.id)" />}</ng-template>
 @if(claims?.testGroupMonitor;as groups){<h3>Testgruppen-Überwachung</h3>@for(group of groups;track $index;let i=$index){<tc-test-card [name]="group.label" [subLabel]="groupLabel(group)" buttonLabel="Gruppen-Monitor Starten" [disabled]="groupDisabled(group)" [attr.data-cy]="'gm-card-'+i" (select)="monitor(group)" />}
 @if(claims?.test&&visibility!=='hidden'){<mat-accordion><mat-expansion-panel [expanded]="visibility!=='collapsed'"><mat-expansion-panel-header><mat-panel-title>{{'Testhefte anzeigen'|customtext:'gm_show_test'|async}}</mat-panel-title></mat-expansion-panel-header><ng-container [ngTemplateOutlet]="testCardList" /></mat-expansion-panel></mat-accordion>}}
 @if(claims?.test&&!claims?.testGroupMonitor){<ng-container [ngTemplateOutlet]="testCardList" />}
 </div>
 @if(!booklets.length&&!claims?.testGroupMonitor?.length){<p role="status">{{'Für diese Anmeldung wurde kein Test gefunden.'|customtext:'login_noBookletsAvailable'|async}}</p>}
 <div #bottomSentinel class="sentinel"></div>@if(showScrollButton()){<button class="scroll-button" (click)="scrollDown()">Unten geht es weiter<mat-icon svgIcon="arrow_cool_down" /></button>}`})
export class NativeStarterComponent implements AfterViewInit {
 readonly session=inject(NativeMonitorSessionService);readonly starter=inject(NativeTestStarterService);readonly assets=inject(AssetService);
 private readonly router=inject(Router);private readonly element=inject<ElementRef<HTMLElement>>(ElementRef);
 private readonly owner=new AbortController();private readonly scope=this.session.accessSignal;
 private readonly observer=new IntersectionObserver(([entry])=>this.showScrollButton.set(!entry.isIntersecting));
 @ViewChild('bottomSentinel',{static:true})private bottom!:ElementRef<HTMLElement>;
 readonly problem=signal('');readonly showScrollButton=signal(false);
 private verifyTimer:ReturnType<typeof setTimeout>|undefined;
 private readonly retire=()=>{if(this.verifyTimer!==undefined)clearTimeout(this.verifyTimer);this.verifyTimer=undefined;this.owner.abort();this.starter.ngOnDestroy();this.element.nativeElement.replaceChildren();};
 constructor(){this.scope.addEventListener('abort',this.retire,{once:true});this.scheduleAccessCheck();}
 private scheduleAccessCheck(){
  if(!this.current)return;
  this.verifyTimer=setTimeout(async()=>{
   this.verifyTimer=undefined;
   try{await this.session.verifyAccess(this.owner.signal);}catch{ /* Current401/403 already retires the actor; transient failures keep its existing scope. */ }
   this.scheduleAccessCheck();
  },5000);
 }
 get claims(){return this.current?this.session.access()?.claims:undefined;}
 get current(){return !this.owner.signal.aborted&&!this.scope.aborted&&this.scope===this.session.accessSignal;}
 get booklets(){return this.claims?.test?.map(claim=>({id:claim.id,name:claim.label,mode:(claim.flags.locked?'locked':claim.flags.running?'continue':this.claims?.testGroupMonitor?'view':'start') as 'locked'|'continue'|'view'|'start'}))??[];}
 get visibility(){const settings=this.session.access()?.viewSettings;if(settings&&!Array.isArray(settings)&&'monitorBookletVisibility'in settings){const v=settings.monitorBookletVisibility;if(v==='collapsed'||v==='hidden')return v;}return 'visible';}
 groupLabel(group:OriginalTestGroupMonitorAccess){return Array.isArray(group.flags)?'':group.flags.subLabel;}
 groupDisabled(group:OriginalTestGroupMonitorAccess){return !Array.isArray(group.flags)&&!!(group.flags.scheduled||group.flags.expired);}
 async start(bookletName:string){if(!this.current)return;this.problem.set('');try{const id=await this.starter.start(bookletName,this.owner.signal);if(this.current)await this.router.navigate(['/native-test',id]);}catch(error){if(this.current)this.problem.set(error instanceof Error?error.message:'Problem beim Start.');}}
 async monitor(group:OriginalTestGroupMonitorAccess){if(!this.current||this.groupDisabled(group))return;const profile=Array.isArray(group.flags)?'':group.flags.profile;await this.router.navigate(['/group-monitor',group.id,...(profile?[profile]:[])]);}
 ngAfterViewInit(){this.observer.observe(this.bottom.nativeElement);}
 scrollDown(){this.element.nativeElement.closest<HTMLElement>('.page')?.scrollBy({top:300,behavior:'smooth'});}
 ngOnDestroy(){this.scope.removeEventListener('abort',this.retire);this.observer.disconnect();this.retire();}
}
