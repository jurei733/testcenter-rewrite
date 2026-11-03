import {Injectable,inject} from '@angular/core';import {BehaviorSubject} from 'rxjs';
import {ApplicationSettingsService} from '../../../application-settings.service';
@Injectable()
export class AssetService {private settings=inject(ApplicationSettingsService);readonly assetSlots$=new BehaviorSubject({});getAssetSrc(slot:any){return this.settings.assetUrl(slot);}}
