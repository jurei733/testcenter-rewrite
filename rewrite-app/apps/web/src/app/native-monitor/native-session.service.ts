import {Injectable,signal} from '@angular/core';
import type {OriginalAccessSet,OriginalWorkChallenge} from '@testcenter-rewrite-app/contracts/original-session';
export class NativeMonitorHttpError extends Error {constructor(readonly status:number,message:string){super(message);}}
const key='testcenter-native-monitor-session';
const finishKey=key+'-unfinished-finish';
@Injectable({providedIn:'root'})
export class NativeMonitorSessionService {
 readonly access=signal<OriginalAccessSet|null>(null);
 readonly busy=signal(false);
 readonly restoring=signal(false);
 private revision=0;
 private readonly finishTargets=new Map<string,string[]>();
 private loginController:AbortController|null=null;
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
 async login(name:string,password:string,owner?:AbortSignal):Promise<OriginalAccessSet>{
  owner?.throwIfAborted();
  this.loginController?.abort();
  const attempt=new AbortController();this.loginController=attempt;
  this.renewAccessScope();const revision=++this.revision;this.restoring.set(false);this.busy.set(true);this.problem.set('');
  const cancel=()=>{attempt.abort();if(revision===this.revision){this.revision++;this.busy.set(false);}};
  owner?.addEventListener('abort',cancel,{once:true});
  const current=()=>{attempt.signal.throwIfAborted();if(revision!==this.revision)throw new Error('Die Anmeldung wurde abgebrochen.');};
  try{
   if(password&&!globalThis.isSecureContext)throw new Error('Die Anmeldung ist nur über eine verschlüsselte Verbindung (HTTPS) möglich.');
   let access:OriginalAccessSet;
   try{access=await this.json('PUT','/session/login',{name,password},'');}
   catch(error){
    current();
    if(!(error instanceof NativeMonitorHttpError)||error.status!==400||!error.message.includes('Brute Force protection active'))throw error;
    const challenge=await this.json<OriginalWorkChallenge&{maxnumber?:number}>('POST','/session/challenge',{loginType:'login',name,password},'');
    current();const {solveChallengeWorkers}=await import('altcha-lib');current();
    const workers:Worker[]=[];let abortWork:()=>void=()=>{};
    let solved;
    try{
     solved=await Promise.race([
      solveChallengeWorkers(()=>{const worker=new Worker(new URL('altcha-lib/dist/worker.js',document.baseURI),{type:'module'});workers.push(worker);return worker;},Math.max(1,Math.min(8,navigator.hardwareConcurrency??4)),challenge.challenge,challenge.salt,challenge.algorithm,challenge.maxNumber??challenge.maxnumber??1_000_000),
      new Promise<never>((_,reject)=>{abortWork=()=>reject(new DOMException('Die Anmeldung wurde abgebrochen.','AbortError'));attempt.signal.addEventListener('abort',abortWork,{once:true});})
     ]);
    }finally{attempt.signal.removeEventListener('abort',abortWork);workers.forEach(worker=>worker.terminate());}
    current();if(!solved)throw new Error('Die Sicherheitsprüfung konnte nicht abgeschlossen werden.');
    access=await this.json('PUT','/session',{algorithm:challenge.algorithm,salt:challenge.salt,challenge:challenge.challenge,signature:challenge.signature,number:solved.number},'');
   }
   // Credential writes may already have committed when the view retires.
   // Read their result and revoke only an orphan, never a replacement access.
   if(attempt.signal.aborted||revision!==this.revision){if(access.token&&access.token!==this.access()?.token)await this.text('DELETE','/session',undefined,access.token);current();}
   if(!access.claims.testGroupMonitor?.length){if(access.token)await this.text('DELETE','/session',undefined,access.token);throw new Error('Dieser Zugang hat keine Berechtigung für den Gruppenmonitor.');}
   current();this.set(access);return access;
  }catch(error){if(attempt.signal.aborted||revision!==this.revision)throw new DOMException('Die Anmeldung wurde abgebrochen.','AbortError');this.problem.set(error instanceof Error?error.message:'Problem bei der Anmeldung.');throw error;}
  finally{owner?.removeEventListener('abort',cancel);if(this.loginController===attempt)this.loginController=null;if(revision===this.revision)this.busy.set(false);}
 }
 async refresh(){const token=this.access()?.token,revision=this.revision;if(token){const access=await this.json<OriginalAccessSet>('GET','/session',undefined,token);if(revision===this.revision)this.set(access);}}
 async logout(){const token=this.access()?.token;this.clear();if(token)await this.text('DELETE','/session',undefined,token);}
 pendingFinishTargets(group:string):string[]{return this.access()?[...(this.finishTargets.get(group)??[])]:[];}
 rememberFinishTargets(group:string,ids:string[]){
  const token=this.access()?.token;if(!token)return;
  if(ids.length)this.finishTargets.set(group,[...ids]);else this.finishTargets.delete(group);
  // Tab-local recovery survives reload. Its owner is the already-retained
  // native credential; it is never copied into reports or sent to another API.
  try{if(this.finishTargets.size)sessionStorage.setItem(finishKey,JSON.stringify({token,groups:Object.fromEntries(this.finishTargets)}));else sessionStorage.removeItem(finishKey);}catch{}
 }
 private restoreFinishTargets(token:string){
  this.finishTargets.clear();
  try{
   const saved=JSON.parse(sessionStorage.getItem(finishKey)??'null');
   if(saved?.token!==token){sessionStorage.removeItem(finishKey);return;}
   for(const [group,ids]of Object.entries(saved.groups??{}))if(Array.isArray(ids)&&ids.every(id=>typeof id==='string'&&/^[1-9]\d*$/.test(id)&&BigInt(id)<=9223372036854775807n))this.finishTargets.set(group,[...ids]);
  }catch{try{sessionStorage.removeItem(finishKey);}catch{}}
 }
 private set(access:OriginalAccessSet){
  if(!access.token||!access.claims?.testGroupMonitor?.length){this.clear();throw new Error('Dieser Zugang hat keine Berechtigung für den Gruppenmonitor.');}
  if(this.access()?.token!==access.token)this.restoreFinishTargets(access.token);
  this.renewAccessScope();this.access.set(access);try{localStorage.setItem(key,access.token);}catch{}
  for(const group of this.finishTargets.keys())if(!access.claims.testGroupMonitor.some(claim=>claim.id===group))this.rememberFinishTargets(group,[]);
 }
 clear(){this.finishTargets.clear();try{sessionStorage.removeItem(finishKey);}catch{}this.loginController?.abort();this.loginController=null;this.renewAccessScope();this.revision++;this.restoring.set(false);this.busy.set(false);this.access.set(null);try{localStorage.removeItem(key);}catch{}}
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
