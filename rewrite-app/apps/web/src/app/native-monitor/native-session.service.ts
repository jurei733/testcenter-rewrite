import {Injectable,signal} from '@angular/core';
import type {OriginalAccessSet,OriginalWorkChallenge} from '@testcenter-rewrite-app/contracts/original-session';
export class NativeMonitorHttpError extends Error {constructor(readonly status:number,message:string,readonly response?:{url:string;statusText:string;errorId?:string|null;testMode?:string|null}){super(message);}}
const key='testcenter-native-monitor-session';
const finishKey=key+'-unfinished-finish';
const purposeKey=key+'-purpose';
type NativeSessionPurpose='monitor'|'participant';
type CredentialRequest={kind:'login';name:string;password:string}|{kind:'person';code:string;token:string};
const allows=(access:OriginalAccessSet,purpose:NativeSessionPurpose)=>!!access.token&&!!access.claims&&
 (purpose==='monitor'?!!access.claims.testGroupMonitor?.length:Array.isArray(access.flags));
// Opening a Test updates running flags. That is not an actor or grant change.
const participantBinding=(access:OriginalAccessSet)=>JSON.stringify({token:access.token,groupToken:access.groupToken,loginName:access.loginName,
 flags:[...access.flags].sort(),claims:{...access.claims,test:access.claims.test?.map(claim=>({...claim,label:undefined,flags:{...claim.flags,running:undefined}}))},access:access.access});
@Injectable({providedIn:'root'})
export class NativeMonitorSessionService {
 readonly access=signal<OriginalAccessSet|null>(null);
 readonly purpose=signal<NativeSessionPurpose>('monitor');
 readonly busy=signal(false);
 readonly restoring=signal(false);
 private revision=0;
 private readonly finishTargets=new Map<string,string[]>();
 private loginController:AbortController|null=null;
 private accessController=new AbortController();
 get accessSignal():AbortSignal{return this.accessController.signal;}
 private renewAccessScope(){this.accessController.abort();this.accessController=new AbortController();}
 readonly problem=signal('');
 constructor(){try{const token=localStorage.getItem(key);if(token)void this.restore(token,localStorage.getItem(purposeKey)==='participant'?'participant':'monitor');}catch{}}
 private async restore(token:string,purpose:NativeSessionPurpose){
  const revision=this.revision;this.restoring.set(true);
  try{const access=await this.json<OriginalAccessSet>('GET','/session',undefined,token);if(revision===this.revision)this.set(access,purpose);}
  catch{if(revision===this.revision)this.clear();}
  finally{if(revision===this.revision)this.restoring.set(false);}
 }
 async login(name:string,password:string,owner?:AbortSignal):Promise<OriginalAccessSet>{
  return this.authenticate({kind:'login',name,password},'monitor',owner);
 }
 async loginParticipant(name:string,password:string,owner?:AbortSignal):Promise<OriginalAccessSet>{
  return this.authenticate({kind:'login',name,password},'participant',owner);
 }
 async person(code:string,owner?:AbortSignal):Promise<OriginalAccessSet>{
  owner?.throwIfAborted();
  const access=this.access();
  if(this.purpose()!=='participant'||!access?.flags.includes('codeRequired'))throw new Error('Es ist keine Code-Anmeldung aktiv.');
  return this.authenticate({kind:'person',code,token:access.token},'participant',owner);
 }
 private async authenticate(request:CredentialRequest,purpose:NativeSessionPurpose,owner?:AbortSignal):Promise<OriginalAccessSet>{
  owner?.throwIfAborted();
  this.loginController?.abort();
  const attempt=new AbortController();this.loginController=attempt;
  this.renewAccessScope();const revision=++this.revision;this.restoring.set(false);this.busy.set(true);this.problem.set('');
  const cancel=()=>{attempt.abort();if(revision===this.revision){this.revision++;this.busy.set(false);}};
  owner?.addEventListener('abort',cancel,{once:true});
  const current=()=>{attempt.signal.throwIfAborted();if(revision!==this.revision)throw new Error('Die Anmeldung wurde abgebrochen.');};
  try{
   if(request.kind==='login'&&request.password&&!globalThis.isSecureContext)throw new Error('Die Anmeldung ist nur über eine verschlüsselte Verbindung (HTTPS) möglich.');
   const token=request.kind==='person'?request.token:'';
   // A credential write may commit before cancellation. Keep reading its finite
   // response so a retired owner can revoke the orphan credential it created.
   const credentialJson=async<T>(method:string,path:string,body:unknown):Promise<T>=>JSON.parse(await this.readText(method,path,body,token,false,undefined,undefined,false)) as T;
   let access:OriginalAccessSet;
   try{access=await credentialJson('PUT',request.kind==='login'?'/session/login':'/session/person',request.kind==='login'?{name:request.name,password:request.password}:{code:request.code});}
   catch(error){
    current();
    if(!(error instanceof NativeMonitorHttpError)||error.status!==400||!error.message.includes('Brute Force protection active'))throw error;
    const challenge=await credentialJson<OriginalWorkChallenge&{maxnumber?:number}>('POST',request.kind==='login'?'/session/challenge':'/session/person/challenge',request.kind==='login'?{loginType:'login',name:request.name,password:request.password}:{code:request.code});
    current();const {solveChallengeWorkers}=await import('altcha-lib');current();
    const workers:Worker[]=[];let abortWork:()=>void=()=>{},failWork:(error:Error)=>void=()=>{},workTimer:ReturnType<typeof setTimeout>|undefined;
    const workerFailed=(event:Event)=>{event.preventDefault();failWork(new Error('Die Sicherheitsprüfung konnte nicht geladen werden. Bitte erneut versuchen.'));};
    let solved;
    try{
     solved=await Promise.race([
      solveChallengeWorkers(()=>{const worker=new Worker(new URL('altcha-lib/dist/worker.js',document.baseURI),{type:'module'});workers.push(worker);worker.addEventListener('error',workerFailed);worker.addEventListener('messageerror',workerFailed);return worker;},Math.max(1,Math.min(8,navigator.hardwareConcurrency??4)),challenge.challenge,challenge.salt,challenge.algorithm,challenge.maxNumber??challenge.maxnumber??1_000_000),
      new Promise<never>((_,reject)=>{failWork=reject;abortWork=()=>reject(new DOMException('Die Anmeldung wurde abgebrochen.','AbortError'));attempt.signal.addEventListener('abort',abortWork,{once:true});workTimer=setTimeout(()=>reject(new Error('Die Sicherheitsprüfung wurde nicht rechtzeitig abgeschlossen. Bitte erneut versuchen.')),20000);})
     ]);
    }finally{if(workTimer!==undefined)clearTimeout(workTimer);attempt.signal.removeEventListener('abort',abortWork);workers.forEach(worker=>{worker.removeEventListener('error',workerFailed);worker.removeEventListener('messageerror',workerFailed);worker.terminate();});}
    current();if(!solved)throw new Error('Die Sicherheitsprüfung konnte nicht abgeschlossen werden.');
    access=await credentialJson('PUT','/session',{algorithm:challenge.algorithm,salt:challenge.salt,challenge:challenge.challenge,signature:challenge.signature,number:solved.number});
   }
   // Credential writes may already have committed when the view retires.
   // Read their result and revoke only an orphan, never a replacement access.
   if(attempt.signal.aborted||revision!==this.revision){if(access.token&&access.token!==this.access()?.token)await this.text('DELETE','/session',undefined,access.token);current();}
   if(!allows(access,purpose)){if(access.token)await this.text('DELETE','/session',undefined,access.token);throw new Error('Dieser Zugang hat keine Berechtigung für den Gruppenmonitor.');}
   current();this.set(access,purpose);return access;
  }catch(error){if(attempt.signal.aborted||revision!==this.revision)throw new DOMException('Die Anmeldung wurde abgebrochen.','AbortError');if(request.kind==='person'&&error instanceof NativeMonitorHttpError&&[401,403].includes(error.status))this.clear();this.problem.set(error instanceof Error?error.message:'Problem bei der Anmeldung.');throw error;}
  finally{owner?.removeEventListener('abort',cancel);if(this.loginController===attempt)this.loginController=null;if(revision===this.revision)this.busy.set(false);}
 }
 async refresh(owner?:AbortSignal){owner?.throwIfAborted();const token=this.access()?.token,revision=this.revision,purpose=this.purpose();if(token){const access=JSON.parse(await this.text('GET','/session',undefined,token,false,owner)) as OriginalAccessSet;owner?.throwIfAborted();if(revision===this.revision)this.set(access,purpose,true);}}
 async verifyAccess(owner:AbortSignal){
  owner.throwIfAborted();const previous=this.access(),scope=this.accessSignal,revision=this.revision,purpose=this.purpose();
  if(!previous||scope.aborted)return;
  const access=JSON.parse(await this.text('GET','/session',undefined,previous.token,false,owner)) as OriginalAccessSet;
  owner.throwIfAborted();scope.throwIfAborted();
  // A byte-for-byte identical complete access response renews no capability.
  // Any changed field still takes the normal grant replacement/retirement path.
  if(revision===this.revision&&scope===this.accessSignal&&this.access()===previous&&JSON.stringify(access)!==JSON.stringify(previous))this.set(access,purpose,true);
 }
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
 private set(access:OriginalAccessSet,purpose:NativeSessionPurpose,refresh=false){
  if(!allows(access,purpose)){this.clear();throw new Error('Dieser Zugang hat keine Berechtigung für den Gruppenmonitor.');}
  const previous=this.access(),sameParticipant=refresh&&purpose==='participant'&&this.purpose()===purpose&&previous&&participantBinding(previous)===participantBinding(access);
  if(this.access()?.token!==access.token)this.restoreFinishTargets(access.token);
  if(!sameParticipant)this.renewAccessScope();this.purpose.set(purpose);this.access.set(access);try{if(purpose==='participant')localStorage.setItem(purposeKey,purpose);else localStorage.removeItem(purposeKey);localStorage.setItem(key,access.token);}catch{}
  for(const group of this.finishTargets.keys())if(!access.claims.testGroupMonitor?.some(claim=>claim.id===group))this.rememberFinishTargets(group,[]);
 }
 clear(){this.finishTargets.clear();try{sessionStorage.removeItem(finishKey);}catch{}this.loginController?.abort();this.loginController=null;this.renewAccessScope();this.revision++;this.restoring.set(false);this.busy.set(false);this.access.set(null);this.purpose.set('monitor');try{localStorage.removeItem(key);localStorage.removeItem(purposeKey);}catch{}}
 async text(method:string,path:string,body?:unknown,token=this.access()?.token??'',rawBody=false,signal?:AbortSignal,subscribeToken?:(value:string|null)=>void):Promise<string>{
  const scope=token&&token===this.access()?.token?this.accessSignal:undefined;
  return this.readText(method,path,body,token,rawBody,signal,scope,true,subscribeToken);
 }
 private async readText(method:string,path:string,body:unknown,token:string,rawBody:boolean,signal?:AbortSignal,scope?:AbortSignal,invalidate=true,subscribeToken?:(value:string|null)=>void):Promise<string>{
  const signals=[AbortSignal.timeout(20000),...(signal?[signal]:[]),...(scope?[scope]:[])];
  const response=await fetch(path,{method,headers:{Accept:'application/json',...(token?{AuthToken:token}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:rawBody?String(body):JSON.stringify(body)}),signal:AbortSignal.any(signals),cache:'no-store',credentials:'omit',redirect:'error'});
  const text=await response.text();scope?.throwIfAborted();if(!response.ok){
   if(invalidate&&[401,403].includes(response.status)&&token&&token===this.access()?.token)this.clear();
   throw new NativeMonitorHttpError(response.status,token?text.replaceAll(token,'[redacted]'):text,{url:response.url,statusText:response.statusText,errorId:response.headers.get('error-id'),testMode:response.headers.get('test-mode')});
  }subscribeToken?.(response.headers.get('SubscribeToken'));return text;
 }
 async json<T>(method:string,path:string,body?:unknown,token=this.access()?.token??''):Promise<T>{return JSON.parse(await this.text(method,path,body,token)) as T;}
}
