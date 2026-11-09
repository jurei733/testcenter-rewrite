import {Injectable,effect,inject,signal,untracked} from '@angular/core';
import {ApplicationSettingsService} from './application-settings.service';
import {NativeMonitorSessionService} from './native-monitor/native-session.service';

/** Actor-bound resolved URLs. No credential or private session identifier is
 * copied into settings, image URLs, reports, or browser storage. */
@Injectable({providedIn:'root'})
export class NativeAssetContext {
  private readonly session=inject(NativeMonitorSessionService);
  private readonly settings=inject(ApplicationSettingsService);
  private readonly owners=new Set<AbortSignal>();
  private current:{scope:AbortSignal;token:string;controller:AbortController;urls?:Record<string,string>;settled:boolean;cleanup?:()=>void}|undefined;
  readonly ready=signal(false);
  readonly problem=signal('');
  constructor(){effect(()=>{this.session.access();this.session.busy();this.session.restoring();untracked(()=>{if(this.owners.size)this.refresh();});});}
  activate(owner:AbortSignal):void {
    owner.throwIfAborted();
    if(!this.owners.has(owner)){
      this.owners.add(owner);
      owner.addEventListener('abort',()=>{
        this.owners.delete(owner);
        if(!this.owners.size){this.current?.cleanup?.();this.current?.controller.abort();this.current=undefined;this.settings.clearNativeAssetUrls();this.ready.set(false);}
      },{once:true});
    }
    this.refresh();
  }
  private refresh():void {
    const scope=this.session.accessSignal,token=this.session.access()?.token??'';
    if(scope.aborted||this.session.busy()||this.session.restoring()){
      this.current?.cleanup?.();this.current?.controller.abort();this.current=undefined;this.settings.clearNativeAssetUrls();this.ready.set(false);return;
    }
    if(this.current?.scope===scope&&this.current.token===token)return;
    this.current?.cleanup?.();this.current?.controller.abort();
    const state={scope,token,controller:new AbortController(),settled:false,cleanup:undefined as (()=>void)|undefined,urls:undefined as Record<string,string>|undefined};
    this.current=state;this.ready.set(false);this.problem.set('');this.settings.setNativeAssetUrls({});
    const current=()=>this.owners.size>0&&this.current===state&&!state.controller.signal.aborted&&!scope.aborted&&this.session.accessSignal===scope&&(this.session.access()?.token??'')===token;
    const retired=()=>{state.controller.abort();if(this.current===state){this.current=undefined;this.settings.clearNativeAssetUrls();this.ready.set(false);}};
    scope.addEventListener('abort',retired,{once:true});state.cleanup=()=>scope.removeEventListener('abort',retired);
    void this.session.text('GET','/asset-assignments',undefined,token,false,AbortSignal.any([scope,state.controller.signal])).then(text=>{
      const value:unknown=JSON.parse(text);
      if(!value||typeof value!=='object'||Array.isArray(value)&&value.length)throw Error('Invalid native asset assignments.');
      const urls=Object.fromEntries(Object.entries(value).map(([slot,row])=>{
        if(!row||typeof row!=='object'||!Number.isInteger(row.assetID)||row.assetID<1||row.assetID>2147483647||
           typeof row.url!=='string'||!/^public\/uploaded_assets\/asset_[a-f0-9]{32}\.(?:png|jpe?g|webp)$/.test(row.url))throw Error('Invalid native asset assignment.');
        return [slot,'/'+row.url];
      }));
      if(current()){state.urls=urls;this.settings.setNativeAssetUrls(urls);}
    }).catch(()=>{if(current())this.problem.set('Die Anwendungsbilder konnten nicht geladen werden.');}).finally(()=>{
      if(!current())scope.removeEventListener('abort',retired);
      if(current()){state.settled=true;this.ready.set(true);}
    });
  }
}
