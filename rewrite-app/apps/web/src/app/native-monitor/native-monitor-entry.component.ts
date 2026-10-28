import {BookletService} from './group-monitor/booklet/booklet.service';
import {TestSessionManager} from './group-monitor/test-session-manager/test-session-manager.service';
import {GROUP_MONITOR_CONFIG} from './group-monitor/group-monitor.config';
import {Component,inject,signal,type OnDestroy} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {Router,RouterOutlet,RouterLink,ActivatedRoute} from '@angular/router';
import {MatButton,MatIconButton} from '@angular/material/button';
import {MatInput} from '@angular/material/input';
import {MatFormField,MatLabel,MatSuffix} from '@angular/material/form-field';
import {MatToolbar} from '@angular/material/toolbar';
import {MatMenu,MatMenuItem,MatMenuTrigger} from '@angular/material/menu';
import {NativeMonitorIconComponent as MatIcon} from './native-monitor-icon.component';
import {MatDialog} from '@angular/material/dialog';
import type {OriginalTestGroupMonitorAccess} from '@testcenter-rewrite-app/contracts/original-session';
import {NativeMonitorSessionService,NativeMonitorHttpError} from './native-session.service';
import {InterfaceModeService} from '../interface-mode.service';
import {ApplicationSettingsService} from '../application-settings.service';
import {OriginalOverlayStylesComponent} from '../original-overlay-styles.component';
import {OriginalParticipantLogoutDialogComponent} from '../original-participant-logout-dialog.component';
import {MainDataService} from './shared/shared.module';
import {HeaderService} from './shared/services/header.service';
import {BackendService} from './group-monitor/backend.service';
@Component({selector:'app-native-monitor-entry',standalone:true,
 imports:[FormsModule,RouterOutlet,RouterLink,MatButton,MatIconButton,MatInput,MatFormField,MatLabel,MatSuffix,MatToolbar,MatMenu,MatMenuItem,MatMenuTrigger,MatIcon,OriginalOverlayStylesComponent],
 providers:[BackendService,BookletService,TestSessionManager,{provide:GROUP_MONITOR_CONFIG,useValue:{checkForIdleInterval:180000}}],
 templateUrl:'./native-monitor-entry.component.html',styleUrls:['./native-monitor-entry.component.css','../original-login-theme.scss']})
export class NativeMonitorEntryComponent implements OnDestroy {
 readonly backendProblem=signal('');
 readonly session=inject(NativeMonitorSessionService);readonly settings=inject(ApplicationSettingsService);
 readonly header=inject(HeaderService);readonly backend=inject(BackendService);
 private readonly backendSubscription=this.backend.problem$.subscribe(problem=>this.backendProblem.set(problem));
 ngOnDestroy(){this.backendSubscription.unsubscribe();}
 readonly ready=signal(false);readonly problem=signal('');readonly passwordStep=signal(false);
 name='';password='';showPassword=false;
 private readonly router=inject(Router);private readonly route=inject(ActivatedRoute);private readonly dialog=inject(MatDialog);
 constructor(){inject(InterfaceModeService).select('original');inject(MainDataService).appTitle$.next(this.settings.settings().appTitle);
  this.ready.set(true);
 }
 get hasChild(){return !!this.route.firstChild;}
 get allowedChild(){
  const params=this.route.firstChild?.snapshot.paramMap,group=params?.get('group-name'),profile=params?.get('profile-id')??'';
  return !!group&&this.session.access()?.claims.testGroupMonitor?.some(claim=>{
   const flags=Array.isArray(claim.flags)?{}:claim.flags;
   return claim.id===group&&(flags.profile??'')===profile;
  });
 }
 async submit(){if(this.session.busy()||this.name.trim().length<3)return;this.problem.set('');
  try{const access=await this.session.login(this.name.trim(),this.passwordStep()?this.password:'');this.password='';this.passwordStep.set(false);const claims=access.claims.testGroupMonitor??[];if(claims.length===1)await this.open(claims[0]!);}
  catch(error){if(!this.passwordStep()&&error instanceof NativeMonitorHttpError&&[400,401].includes(error.status)){this.passwordStep.set(true);this.session.problem.set('');}else{this.problem.set(error instanceof Error?error.message:'Problem bei der Anmeldung.');this.password='';}}
 }
 async open(claim:OriginalTestGroupMonitorAccess){const flags=Array.isArray(claim.flags)?{}:claim.flags;const target=['/group-monitor',claim.id,...(flags.profile?[flags.profile]:[])];await this.router.navigate(target);}
 claimLabel(claim:OriginalTestGroupMonitorAccess){return Array.isArray(claim.flags)?'':claim.flags.subLabel??'';}
 async selection(){await this.router.navigate(['/group-monitor']);}
 logout(){this.dialog.open(OriginalParticipantLogoutDialogComponent,{data:{safeMode:false},autoFocus:'dialog'}).afterClosed().subscribe(confirmed=>{if(confirmed)void this.session.logout().then(()=>this.router.navigate(['/group-monitor'])).catch(error=>this.problem.set(error instanceof Error?error.message:'Abmeldung fehlgeschlagen.'));});}
}
