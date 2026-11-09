import {Injectable,effect,inject,untracked} from '@angular/core';import {BehaviorSubject} from 'rxjs';
import {ApplicationSettingsService} from '../../../application-settings.service';
@Injectable()
export class AssetService {
 private settings=inject(ApplicationSettingsService);
 readonly assetSlots$=new BehaviorSubject({});
 constructor(){effect(()=>{
  const urls=Object.fromEntries(['logo','loginIllustration','codeInputIllustration','codeInputCompanion','starterCompanion','starterCardDone','loadingProgress','confirmDialog'].map(slot=>[slot,this.getAssetSrc(slot)]));
  untracked(()=>this.assetSlots$.next(urls));
 });}
 getAssetSrc(slot:any){return this.settings.assetUrl(slot);}
}
