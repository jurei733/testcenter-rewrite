import {Injectable,inject,signal} from '@angular/core';
import {NativeMonitorSessionService} from '../native-monitor/native-session.service';

/** A card names a Booklet. Only the native server creates/resumes its Test ID. */
@Injectable()
export class NativeTestStarterService {
 private readonly session=inject(NativeMonitorSessionService);
 readonly pendingBooklet=signal('');
 private retired=false;
 private attempt:{scope:AbortSignal;owner:AbortSignal;cancel:AbortController}|undefined;
 async start(bookletName:string,owner:AbortSignal):Promise<string>{
  owner.throwIfAborted();
  if(this.retired)throw new DOMException('Die Ansicht wurde beendet.','AbortError');
  const scope=this.session.accessSignal,access=this.session.access();
  scope.throwIfAborted();
  const claim=access?.claims.test?.find(item=>item.id===bookletName);
  if(!access||!claim||claim.flags.locked)throw new Error('Dieser Test ist nicht freigegeben.');
  if(this.attempt?.scope===scope&&!this.attempt.owner.aborted&&!this.attempt.cancel.signal.aborted)throw new Error('Ein Test wird bereits geöffnet.');
  this.attempt?.cancel.abort();
  const attempt={scope,owner,cancel:new AbortController()};this.attempt=attempt;this.pendingBooklet.set(bookletName);
  const retire=()=>{attempt.cancel.abort();if(this.attempt===attempt){this.attempt=undefined;this.pendingBooklet.set('');}};
  scope.addEventListener('abort',retire,{once:true});owner.addEventListener('abort',retire,{once:true});
  try{
   const raw=await this.session.text('PUT','/test',{bookletName},access.token,false,AbortSignal.any([owner,attempt.cancel.signal]));
   owner.throwIfAborted();scope.throwIfAborted();attempt.cancel.signal.throwIfAborted();
   if(scope!==this.session.accessSignal)throw new DOMException('Die Sitzung wurde beendet.','AbortError');
   const id=raw.trim();
   if(!/^[1-9]\d*$/.test(id)||BigInt(id)>9223372036854775807n)throw new Error('Der Server hat keine gültige Test-ID geliefert.');
   return id;
  }finally{scope.removeEventListener('abort',retire);owner.removeEventListener('abort',retire);if(this.attempt===attempt){this.attempt=undefined;this.pendingBooklet.set('');}}
 }
 ngOnDestroy(){this.retired=true;this.attempt?.cancel.abort();this.attempt=undefined;this.pendingBooklet.set('');}
}
