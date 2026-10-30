import {Injectable,inject} from '@angular/core';
import {NativeHttpClient} from '../../native-http-client';
import {NativePlayerChannel} from '../../native-player-channel';
@Injectable()
export class VeronaAPIService {
 private readonly http=inject(NativeHttpClient);
 readonly channel=new NativePlayerChannel(this.http.accessSignal,()=>this.http.isCurrent);
 readonly postMessageTarget={postMessage:(message:unknown,_origin?:string)=>this.channel.send(message)};
 sendPageNav(sessionID:string|undefined,target:string):void{this.channel.send({type:'vopPageNavigationCommand',sessionId:sessionID,target});}
 ngOnDestroy(){this.channel.destroy();}
}
