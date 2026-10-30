import {Injectable} from '@angular/core';
import {BehaviorSubject,Observable,Subscription,Subject,firstValueFrom,EMPTY,fromEvent} from 'rxjs';
import {takeUntil} from 'rxjs/operators';
import {HttpResponse} from '@angular/common/http';
import {NativeHttpClient} from '../../native-http-client';
import {parseNativeParticipantBroadcast} from '../../native-wire';
import {observeNativeRealtime,type NativeConnectionStatus} from '../../../native-realtime';
@Injectable()
export abstract class WebsocketBackendService<T> {
 protected abstract pollingEndpoint:string;protected abstract pollingInterval:number;protected abstract wsChannelName:string;protected abstract initialData:T;
 readonly connectionStatus$=new BehaviorSubject<NativeConnectionStatus>('initial');
 private subscription:Subscription|undefined;private data:BehaviorSubject<T>|undefined;
 private readonly recovery=new Subject<void>();
 constructor(protected broadcasterUrl:string,protected backendUrl:string,protected http:NativeHttpClient){http.accessSignal.addEventListener('abort',()=>this.cutConnection(),{once:true});}
 protected recoverPolling(){this.recovery.next();}
 protected observeEndpointAndChannel():Observable<T>{
  this.cutConnection();if(!this.http.isCurrent)return EMPTY;
  const endpoint=this.pollingEndpoint,data=new BehaviorSubject(this.initialData);this.data=data;
  this.subscription=observeNativeRealtime<T>({channel:'commands',scope:this.http.accessSignal,current:()=>this.http.isCurrent,
   pollingInterval:this.pollingInterval,retry:this.recovery,
   read:async(signal)=>{const response=await firstValueFrom(this.http.get<T>(this.backendUrl+endpoint,{observe:'response'}).pipe(takeUntil(fromEvent(signal,'abort')))) as HttpResponse<T>;return{data:response.body as T,subscribeToken:response.headers.get('SubscribeToken')};},
   decode:wire=>parseNativeParticipantBroadcast('/'+endpoint,wire) as T|undefined,
   revalidate:()=>this.http.verifyAccess(this.http.accessSignal),status:status=>this.connectionStatus$.next(status)
  }).subscribe(value=>data.next(value));return data.asObservable();
 }
 cutConnection(){this.subscription?.unsubscribe();this.subscription=undefined;this.data?.complete();this.data=undefined;this.connectionStatus$.next('initial');}
 ngOnDestroy(){this.cutConnection();this.recovery.complete();this.connectionStatus$.complete();}
}
