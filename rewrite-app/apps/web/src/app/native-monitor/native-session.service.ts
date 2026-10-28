import {Injectable,signal} from '@angular/core';
import type {OriginalAccessSet,OriginalWorkChallenge} from '@testcenter-rewrite-app/contracts/original-session';
export class NativeMonitorHttpError extends Error {constructor(readonly status:number,message:string){super(message);}}
const key='testcenter-native-monitor-session';
@Injectable({providedIn:'root'})
export class NativeMonitorSessionService {
 readonly access=signal<OriginalAccessSet|null>(null);
 readonly busy=signal(false);
 readonly restoring=signal(false);
 private revision=0;
 private accessController=new AbortController();
 get accessSignal():AbortSignal{return this.accessController.signal;}
 private renewAccessScope(){this.accessController.abort();this.accessController=new AbortController();}
 readonly problem=signal('');
 constructor(){try{const token=localStorage.getItem(key);if(token)void this.restore(token);}catch{}}
 private async restore(token:string){
  const revision=this.revision;this.restoring.set(true);
  try{const access=await this.json<OriginalAccessSet>('GET','/session',undefined,token);if(revision===this.revision)this.set(access);}
  catch{if(revision===this.revision)this.clear();}
  finally{if(revision===this.revision)this.restoring.set(false);}
 }
 async login(name:string,password:string):Promise<OriginalAccessSet>{
  this.renewAccessScope();const revision=++this.revision;this.restoring.set(false);this.busy.set(true);this.problem.set('');
  try{
   if(password&&!globalThis.isSecureContext)throw new Error('Die Anmeldung ist nur über eine verschlüsselte Verbindung (HTTPS) möglich.');
   let access:OriginalAccessSet;
   try{access=await this.json('PUT','/session/login',{name,password},'');}
   catch(error){if(!(error instanceof NativeMonitorHttpError)||error.status!==400||!error.message.includes('Brute Force protection active'))throw error;
    const challenge=await this.json<OriginalWorkChallenge&{maxnumber?:number}>('POST','/session/challenge',{loginType:'login',name,password},'');
    const {solveChallengeWorkers}=await import('altcha-lib');
    const solved=await solveChallengeWorkers(new URL('altcha-lib/dist/worker.js',document.baseURI).toString(),Math.max(1,Math.min(8,navigator.hardwareConcurrency??4)),challenge.challenge,challenge.salt,challenge.algorithm,challenge.maxNumber??challenge.maxnumber??1_000_000);
    if(!solved)throw new Error('Die Sicherheitsprüfung konnte nicht abgeschlossen werden.');
    access=await this.json('PUT','/session',{algorithm:challenge.algorithm,salt:challenge.salt,challenge:challenge.challenge,signature:challenge.signature,number:solved.number},'');
   }
   if(!access.claims.testGroupMonitor?.length){if(access.token)await this.text('DELETE','/session',undefined,access.token);throw new Error('Dieser Zugang hat keine Berechtigung für den Gruppenmonitor.');}
   if(revision!==this.revision){await this.text('DELETE','/session',undefined,access.token);throw new Error('Die Anmeldung wurde abgebrochen.');}
   this.set(access);return access;
  }catch(error){this.problem.set(error instanceof Error?error.message:'Problem bei der Anmeldung.');throw error;}finally{if(revision===this.revision)this.busy.set(false);}
 }
 async refresh(){const token=this.access()?.token,revision=this.revision;if(token){const access=await this.json<OriginalAccessSet>('GET','/session',undefined,token);if(revision===this.revision)this.set(access);}}
 async logout(){const token=this.access()?.token;this.clear();if(token)await this.text('DELETE','/session',undefined,token);}
 private set(access:OriginalAccessSet){if(!access.token||!access.claims?.testGroupMonitor?.length){this.clear();throw new Error('Dieser Zugang hat keine Berechtigung für den Gruppenmonitor.');}this.renewAccessScope();this.access.set(access);try{localStorage.setItem(key,access.token);}catch{}}
 clear(){this.renewAccessScope();this.revision++;this.restoring.set(false);this.busy.set(false);this.access.set(null);try{localStorage.removeItem(key);}catch{}}
 async text(method:string,path:string,body?:unknown,token=this.access()?.token??'',rawBody=false,signal?:AbortSignal):Promise<string>{
  const scope=token&&token===this.access()?.token?this.accessSignal:undefined;
  const signals=[AbortSignal.timeout(20000),...(signal?[signal]:[]),...(scope?[scope]:[])];
  const response=await fetch(path,{method,headers:{Accept:'application/json',...(token?{AuthToken:token}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:rawBody?String(body):JSON.stringify(body)}),signal:AbortSignal.any(signals),cache:'no-store'});
  const text=await response.text();scope?.throwIfAborted();if(!response.ok){
   if([401,403].includes(response.status)&&token&&token===this.access()?.token)this.clear();
   throw new NativeMonitorHttpError(response.status,token?text.replaceAll(token,'[redacted]'):text);
  }return text;
 }
 async json<T>(method:string,path:string,body?:unknown,token=this.access()?.token??''):Promise<T>{return JSON.parse(await this.text(method,path,body,token)) as T;}
}
