import {Injectable,inject} from '@angular/core';
import {BehaviorSubject,Observable,from,of,timer} from 'rxjs';
import {catchError,map,switchMap,finalize,tap} from 'rxjs/operators';
import type {BookletError,CommandResponse,Profile,TestSessionData} from './group-monitor.interfaces';
import type {ConnectionStatus} from '../shared/shared.module';
import {NativeMonitorSessionService} from '../native-session.service';
import {parseNativeMonitorSnapshot,nativeMonitorSelectionBody} from '../native-monitor-wire';
@Injectable()
export class BackendService {
 private readonly session=inject(NativeMonitorSessionService);
 readonly connectionStatus$=new BehaviorSubject<ConnectionStatus>('initial');
 readonly problem$=new BehaviorSubject('');
 get cacheIdentity(){return this.session.access();}
 observeSessionsMonitor(groupName:string):Observable<TestSessionData[]>{
  return timer(0,5000).pipe(
   tap(()=>this.connectionStatus$.next('polling-fetch')),
   switchMap(()=>new Observable<TestSessionData[]>(subscriber=>{
    const abort=new AbortController();
    void this.session.text('GET','/monitor/group/'+encodeURIComponent(groupName)+'/test-sessions',undefined,undefined,false,abort.signal)
     .then(text=>{if(!subscriber.closed){subscriber.next(parseNativeMonitorSnapshot(text));subscriber.complete();}})
     .catch(error=>{if(!subscriber.closed)subscriber.error(error);});
    return()=>abort.abort();
   }).pipe(
    tap(()=>{this.connectionStatus$.next('polling-sleep');this.problem$.next('');}),
    catchError(error=>{this.connectionStatus$.next('error');this.problem$.next(error instanceof Error?error.message:'Verbindungsfehler');return of(null);})
   )),
   // Failed observations must never be mistaken for an empty, successful snapshot.
   switchMap(rows=>rows===null?of():of(rows))
  );
 }
 cutConnection(){this.connectionStatus$.next('initial');}
 getBooklet(name:string):Observable<string|BookletError>{return from(this.session.text('GET','/booklet/'+encodeURIComponent(name))).pipe(catchError(error=>of({error:error.status===404?'missing-file':'general',species:null} as BookletError)));}
 private write(path:string,ids:string[],fields:Record<string,unknown>={},method='POST'):Observable<CommandResponse>{
  return from(this.session.text(method,path,nativeMonitorSelectionBody(ids,fields),undefined,true)).pipe(map(()=>({commandType:String(fields['keyword']??(path.endsWith('/unlock')?'unlock':'lock')),testIds:ids})),tap(()=>this.problem$.next('')),catchError(error=>{this.problem$.next(error instanceof Error?error.message:'Befehl fehlgeschlagen');throw error;}));
 }
 command(keyword:string,args:string[],testIds:string[]):Observable<CommandResponse>{return this.write('/monitor/command',testIds,{keyword,arguments:args,timestamp:Date.now()/1000},'PUT');}
 unlock(group:string,ids:string[]){return this.write('/monitor/group/'+encodeURIComponent(group)+'/tests/unlock',ids);}
 lock(group:string,ids:string[]){return this.write('/monitor/group/'+encodeURIComponent(group)+'/tests/lock',ids);}
 getProfile(id:string):Observable<Profile>{return from(this.session.json<Profile>('GET','/monitor/profile/'+encodeURIComponent(id)));}
}
