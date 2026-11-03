import {nativeMonitorDefaultTexts} from '../../../native-monitor-default-texts';
import {Injectable,inject} from '@angular/core';
import {BehaviorSubject} from 'rxjs';
import {NativeMonitorSessionService} from '../../../native-session.service';
@Injectable({providedIn:'root'})
export class CustomtextService {
 private session=inject(NativeMonitorSessionService);
 getCustomText(key:string):string|null{return this.session.access()?.customTexts[key]??nativeMonitorDefaultTexts[key]??null;}
 getCustomText$(key:string){return new BehaviorSubject(this.getCustomText(key));}
}
