import {Injectable,inject,signal} from '@angular/core';
import {NativeMonitorSessionService} from '../../native-session.service';
@Injectable({providedIn:'root'})
export class HeaderService {
 private readonly session=inject(NativeMonitorSessionService);
 private readonly value=signal('');
 private scope:AbortSignal|undefined;
 private release=()=>{};
 set title(value:string){
  this.release();this.scope=undefined;this.value.set('');
  const scope=this.session.accessSignal;
  if(!this.session.access()||scope.aborted)return;
  // Access replacement and retirement both renew this scope; retain no credential.
  this.scope=scope;
  const retire=()=>{if(this.scope===scope){this.scope=undefined;this.value.set('');this.release=()=>{};}};
  scope.addEventListener('abort',retire,{once:true});
  this.release=()=>scope.removeEventListener('abort',retire);
  this.value.set(value);
 }
 get title(){const value=this.value();return this.session.access()&&this.scope===this.session.accessSignal&&!this.scope.aborted?value:'';}
}
