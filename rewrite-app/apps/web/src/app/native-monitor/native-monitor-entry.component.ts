import {filter,fromEvent,Subscription,take,takeUntil} from 'rxjs';
import {BookletService} from './group-monitor/booklet/booklet.service';
import {TestSessionManager} from './group-monitor/test-session-manager/test-session-manager.service';
import {GROUP_MONITOR_CONFIG} from './group-monitor/group-monitor.config';
import {ChangeDetectorRef,Component,inject,signal,type OnDestroy} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {Router,RouterOutlet,RouterLink,ActivatedRoute,NavigationEnd} from '@angular/router';
import {MatButton,MatIconButton} from '@angular/material/button';
import {MatInput} from '@angular/material/input';
import {MatFormField,MatLabel,MatSuffix} from '@angular/material/form-field';
import {MatToolbar} from '@angular/material/toolbar';
import {MatMenu,MatMenuItem,MatMenuTrigger,MAT_MENU_DEFAULT_OPTIONS} from '@angular/material/menu';
import {NativeMonitorIconComponent as MatIcon} from './native-monitor-icon.component';
import {MatDialog} from '@angular/material/dialog';
import type {OriginalTestGroupMonitorAccess} from '@testcenter-rewrite-app/contracts/original-session';
import {NativeMonitorSessionService,NativeMonitorHttpError} from './native-session.service';
import {InterfaceModeService} from '../interface-mode.service';
import {ApplicationSettingsService} from '../application-settings.service';
import {OriginalOverlayStylesComponent} from '../original-overlay-styles.component';
import {OriginalFooterComponent} from '../original-footer.component';
import {NativeLoginBrowserNoticeComponent} from '../native-login-browser-notice.component';
import {OriginalParticipantLogoutDialogComponent} from '../original-participant-logout-dialog.component';
import {MainDataService} from './shared/shared.module';
import {HeaderService} from './shared/services/header.service';
import {BackendService} from './group-monitor/backend.service';
import {NativeStarterComponent} from '../native-participant/starter/native-starter.component';
@Component({selector:'app-native-monitor-entry',standalone:true,
 imports:[FormsModule,RouterOutlet,RouterLink,MatButton,MatIconButton,MatInput,MatFormField,MatLabel,MatSuffix,MatToolbar,MatMenu,MatMenuItem,MatMenuTrigger,MatIcon,OriginalOverlayStylesComponent,OriginalFooterComponent,NativeLoginBrowserNoticeComponent,NativeStarterComponent],
 providers:[BackendService,BookletService,TestSessionManager,{provide:MAT_MENU_DEFAULT_OPTIONS,useFactory:()=>({...inject(MAT_MENU_DEFAULT_OPTIONS,{skipSelf:true}),overlayPanelClass:'original-native-monitor-menu'})},{provide:GROUP_MONITOR_CONFIG,useValue:{checkForIdleInterval:180000}}],
 templateUrl:'./native-monitor-entry.component.html',styleUrls:['./native-monitor-entry.component.css','../original-login-theme.scss']})
export class NativeMonitorEntryComponent implements OnDestroy {
 readonly backendProblem=signal('');
 readonly session=inject(NativeMonitorSessionService);readonly settings=inject(ApplicationSettingsService);
 readonly header=inject(HeaderService);readonly backend=inject(BackendService);
 private readonly backendSubscription=this.backend.problem$.subscribe(problem=>this.backendProblem.set(problem));
 private readonly view=new AbortController();
 private retireLogout:(()=>void)|undefined;
 ngOnDestroy(){this.view.abort();this.retireLogout?.();this.backendSubscription.unsubscribe();}
 readonly ready=signal(false);readonly problem=signal('');readonly passwordStep=signal(false);
 readonly starterRefreshing=signal(false);readonly starterRefreshFailed=signal(false);
 private starterRefresh:{scope:AbortSignal}|undefined;
 name='';password='';showPassword=false;
 private readonly router=inject(Router);private readonly route=inject(ActivatedRoute);private readonly dialog=inject(MatDialog);
 constructor(){inject(InterfaceModeService).select('original');inject(MainDataService).appTitle$.next(this.settings.settings().appTitle);
  const detector=inject(ChangeDetectorRef);
  this.router.events.pipe(filter(event=>event instanceof NavigationEnd),takeUntil(fromEvent(this.view.signal,'abort'))).subscribe(()=>{
   detector.markForCheck();
   if(this.session.access()&&!(this.hasChild&&this.allowedChild))void this.refreshStarter();
  });
  this.ready.set(true);
 }
 get hasChild(){return !!this.route.firstChild;}
 get headerTitle(){if(!this.session.access())return 'Anmelden';return this.hasChild&&this.allowedChild?this.header.title||this.settings.settings().appTitle:this.session.access()&&!this.hasChild?'Übersicht':this.settings.settings().appTitle;}
 get showAccountPanel(){return !!this.session.access()&&!(this.hasChild&&this.allowedChild);}
 get starterOwners(){this.session.access();return [this.session.accessSignal];}
 get allowedChild(){
  const params=this.route.firstChild?.snapshot.paramMap,group=params?.get('group-name'),profile=params?.get('profile-id')??'';
  return !!group&&this.session.access()?.claims.testGroupMonitor?.some(claim=>{
   const flags=Array.isArray(claim.flags)?{}:claim.flags;
   return claim.id===group&&(flags.profile??'')===profile;
  });
 }
 async submit(){if(this.session.busy()||this.name.trim().length<3)return;this.problem.set('');
  try{const access=await this.session.login(this.name.trim(),this.passwordStep()?this.password:'',this.view.signal);if(this.view.signal.aborted||this.session.busy()||this.session.access()!==access)return;this.password='';this.passwordStep.set(false);await this.selection();}
  catch(error){if(this.view.signal.aborted||(error instanceof Error&&error.name==='AbortError'))return;if(!this.passwordStep()&&error instanceof NativeMonitorHttpError&&[400,401].includes(error.status)){this.passwordStep.set(true);this.session.problem.set('');}else{this.problem.set(error instanceof Error?error.message:'Problem bei der Anmeldung.');this.password='';}}
 }
 async open(claim:OriginalTestGroupMonitorAccess){if(this.view.signal.aborted)return;const flags=Array.isArray(claim.flags)?{}:claim.flags;const target=['/group-monitor',claim.id,...(flags.profile?[flags.profile]:[])];await this.router.navigate(target);}
 claimLabel(claim:OriginalTestGroupMonitorAccess){return Array.isArray(claim.flags)?'':claim.flags.subLabel??'';}
 async selection(){if(!this.view.signal.aborted)await this.router.navigate(['/group-monitor']);}
 async refreshStarter(){
  if(this.view.signal.aborted||!this.session.access())return;
  const scope=this.session.accessSignal;
  if(scope.aborted||this.starterRefresh?.scope===scope)return;
  const attempt={scope};this.starterRefresh=attempt;
  this.starterRefreshing.set(true);this.starterRefreshFailed.set(false);this.problem.set('');
  try{await this.session.refresh(this.view.signal);}
  catch(error){if(!this.view.signal.aborted&&this.starterRefresh===attempt&&scope===this.session.accessSignal&&!scope.aborted){
   this.starterRefreshFailed.set(true);this.problem.set(error instanceof Error?error.message:'Die Übersicht konnte nicht aktualisiert werden.');
  }}finally{if(!this.view.signal.aborted&&this.starterRefresh===attempt){this.starterRefresh=undefined;this.starterRefreshing.set(false);}}
 }
 logout(){
  const scope=this.session.accessSignal;if(this.view.signal.aborted||scope.aborted||this.retireLogout)return;
  const ref=this.dialog.open(OriginalParticipantLogoutDialogComponent,{data:{safeMode:false},autoFocus:'dialog'});
  const subscription=new Subscription();
  const retire=()=>{subscription.unsubscribe();ref.close();if(this.retireLogout===retire)this.retireLogout=undefined;};
  this.retireLogout=retire;
  subscription.add(fromEvent(scope,'abort').subscribe(retire));
  subscription.add(ref.afterClosed().pipe(take(1)).subscribe(confirmed=>{
   retire();if(!confirmed||this.view.signal.aborted||scope!==this.session.accessSignal||scope.aborted)return;
   const pending=this.session.logout(),clearedScope=this.session.accessSignal;
   const current=()=>!this.view.signal.aborted&&clearedScope===this.session.accessSignal&&!this.session.access()&&!this.session.busy();
   void pending.then(()=>{if(current())return this.router.navigate(['/group-monitor']);return undefined;})
    .catch(error=>{if(current())this.problem.set(error instanceof Error?error.message:'Abmeldung fehlgeschlagen.');});
  }));
 }
}
