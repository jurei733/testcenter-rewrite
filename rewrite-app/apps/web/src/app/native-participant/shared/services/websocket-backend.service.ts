import {Injectable} from '@angular/core';
import {BehaviorSubject,Observable,Subscription,timer,EMPTY,fromEvent} from 'rxjs';
import {catchError,exhaustMap,tap,map,takeUntil} from 'rxjs/operators';
import {NativeHttpClient} from '../../native-http-client';
@Injectable()
export abstract class WebsocketBackendService<T> {
 protected abstract pollingEndpoint:string;protected abstract pollingInterval:number;protected abstract wsChannelName:string;protected abstract initialData:T;
 readonly connectionStatus$=new BehaviorSubject('initial');private subscription:Subscription|undefined;private data:BehaviorSubject<T>|undefined;
 constructor(protected broadcasterUrl:string,protected backendUrl:string,protected http:NativeHttpClient){http.accessSignal.addEventListener('abort',()=>this.cutConnection(),{once:true});}
 protected observeEndpointAndChannel():Observable<T>{
  this.cutConnection();if(!this.http.isCurrent)return EMPTY;const endpoint=this.pollingEndpoint;const data=new BehaviorSubject(this.initialData);this.data=data;
  this.subscription=timer(0,this.pollingInterval).pipe(exhaustMap(()=>{
   this.connectionStatus$.next('polling-fetch');return this.http.get<T>(this.backendUrl+endpoint).pipe(tap(()=>this.connectionStatus$.next('polling-sleep')),catchError(()=>{this.connectionStatus$.next('error');return EMPTY;}));
  }),takeUntil(fromEvent(this.http.accessSignal,'abort'))).subscribe(value=>data.next(value));return data.asObservable();
 }
 cutConnection(){this.subscription?.unsubscribe();this.subscription=undefined;this.data?.complete();this.data=undefined;this.connectionStatus$.next('initial');}
 ngOnDestroy(){this.cutConnection();this.connectionStatus$.complete();}
}
