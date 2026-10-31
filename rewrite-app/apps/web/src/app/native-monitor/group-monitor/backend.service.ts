import {observeNativeRealtime} from '../../native-realtime';
import {Injectable,inject} from '@angular/core';
import {BehaviorSubject,EMPTY,Observable,of,Subject,timer} from 'rxjs';
import {catchError,map,tap,takeUntil} from 'rxjs/operators';
import type {BookletError,CommandResponse,Profile,TestSessionData} from './group-monitor.interfaces';
import type {ConnectionStatus} from '../shared/shared.module';
import {NativeMonitorSessionService} from '../native-session.service';
import {parseNativeMonitorBroadcast,parseNativeMonitorSnapshot,nativeMonitorSelectionBody,nativeMonitorBookletFileId} from '../native-monitor-wire';
@Injectable()
export class BackendService {
 private readonly session=inject(NativeMonitorSessionService);
 readonly connectionStatus$=new BehaviorSubject<ConnectionStatus>('initial');
 readonly problem$=new BehaviorSubject('');
 private readonly connectionClosed=new Subject<void>();
 readonly connectionClosed$=this.connectionClosed.asObservable();
 get cacheIdentity(){return this.session.access();}
 get accessSignal(){return this.session.accessSignal;}
 pendingFinishTargets(group:string){return this.session.pendingFinishTargets(group);}
 rememberFinishTargets(group:string,ids:string[]){this.session.rememberFinishTargets(group,ids); }
 private request(method:string,path:string,body?:unknown,raw=false):Observable<string>{
  return new Observable(subscriber=>{
   const abort=new AbortController();
   void this.session.text(method,path,body,undefined,raw,abort.signal)
    .then(text=>{if(!subscriber.closed){subscriber.next(text);subscriber.complete();}})
    .catch(error=>{if(!subscriber.closed)subscriber.error(error);});
   return()=>abort.abort();
  });
 }
 getSessionsMonitor(groupName:string):Observable<TestSessionData[]>{
  return this.request('GET','/monitor/group/'+encodeURIComponent(groupName)+'/test-sessions').pipe(map(parseNativeMonitorSnapshot));
 }
 observeSessionsMonitor(groupName:string):Observable<TestSessionData[]>{
  const scope=this.session.accessSignal;
  return observeNativeRealtime<TestSessionData[]>({channel:'test-sessions',scope,current:()=>scope===this.session.accessSignal&&!scope.aborted,
   read:async(signal)=>{let subscribeToken:string|null=null;const text=await this.session.text('GET','/monitor/group/'+encodeURIComponent(groupName)+'/test-sessions',undefined,undefined,false,signal,value=>{subscribeToken=value;});return{data:parseNativeMonitorSnapshot(text),subscribeToken};},
   decode:parseNativeMonitorBroadcast,revalidate:()=>this.session.verifyAccess(scope),
   status:status=>{this.connectionStatus$.next(status);if(status==='polling-sleep'||status==='ws-online')this.problem$.next('');},
   error:error=>this.problem$.next(error instanceof Error?error.message:'Verbindungsfehler')
  }).pipe(takeUntil(this.connectionClosed));
 }
 cutConnection(){this.connectionClosed.next();this.connectionStatus$.next('initial');this.problem$.next('');}
 getBooklet(name:string):Observable<string|BookletError>{return this.request('GET','/booklet/'+encodeURIComponent(nativeMonitorBookletFileId(name))).pipe(catchError(error=>of({error:error.status===404?'missing-file':'general',species:null} as BookletError)));}
 private write(path:string,ids:string[],fields:Record<string,unknown>={},method='POST'):Observable<CommandResponse>{
  return this.request(method,path,nativeMonitorSelectionBody(ids,fields),true).pipe(map(()=>({commandType:String(fields['keyword']??(path.endsWith('/unlock')?'unlock':'lock')),testIds:ids})),tap(()=>this.problem$.next('')),catchError(error=>{this.problem$.next(error instanceof Error?error.message:'Befehl fehlgeschlagen');throw error;}));
 }
 command(keyword:string,args:string[],testIds:string[]):Observable<CommandResponse>{return this.write('/monitor/command',testIds,{keyword,arguments:args,timestamp:Date.now()/1000},'PUT');}
 unlock(group:string,ids:string[]){return this.write('/monitor/group/'+encodeURIComponent(group)+'/tests/unlock',ids);}
 lock(group:string,ids:string[]){return this.write('/monitor/group/'+encodeURIComponent(group)+'/tests/lock',ids);}
 getProfile(id:string):Observable<Profile>{return this.request('GET','/monitor/profile/'+encodeURIComponent(id)).pipe(map(text=>JSON.parse(text) as Profile));}
}
