import {Injectable,effect,inject,untracked} from '@angular/core';
import {NativeMonitorSessionService} from '../native-monitor/native-session.service';
import {nativeBackground} from './native-background';

@Injectable({providedIn:'root'})
export class NativeBackgroundService {
 private readonly session=inject(NativeMonitorSessionService);
 constructor(){effect(()=>{const access=this.session.access(),purpose=this.session.purpose();
  untracked(()=>{if(access&&purpose==='participant')nativeBackground(access.token,this.session.accessSignal);});
 });}
}
