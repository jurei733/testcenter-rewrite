import {Injectable,inject} from '@angular/core';
import {NativeMonitorSessionService} from '../native-session.service';
export * from './interfaces/booklet.interfaces';
export {BookletConfig} from './classes/booklet-config.class';
export {CustomtextService} from './services/customtext/customtext.service';
export {CustomtextPipe} from './pipes/customtext/customtext.pipe';
export {AlertComponent} from './components/alert/alert.component';
export {TestModeData as TestMode} from '../common/test-mode-data.class';
export type ConnectionStatus='initial'|'ws-offline'|'ws-online'|'polling-sleep'|'polling-fetch'|'error';
@Injectable({providedIn:'root'})
export class MainDataService {
 private session=inject(NativeMonitorSessionService);
 getAccessObject(_type:string,id:string){return this.session.access()?.claims.testGroupMonitor?.find(claim=>claim.id===id)??{label:id};}
}
