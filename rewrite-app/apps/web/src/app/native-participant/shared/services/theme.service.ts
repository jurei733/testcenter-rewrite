import {Injectable,inject} from '@angular/core';
import {ApplicationSettingsService} from '../../../application-settings.service';
@Injectable()
export class ThemeService {private settings=inject(ApplicationSettingsService);get activeTheme(){const name=this.settings.effectiveThemeName();return {name,targetAudience:name==='Primar'?'children':name==='Erwachsene'?'adults':'teenager',cssClassName:name==='Erwachsene'?'theme-adult':'theme-'+name.toLowerCase()};}}
