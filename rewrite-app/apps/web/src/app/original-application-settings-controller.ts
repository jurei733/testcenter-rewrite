import { productionApiRoutes, type ApplicationAssetSummary, type GetApplicationSettingsResponse,
  type ListApplicationAssetsResponse, type PatchOriginalApplicationSettingsRequest,
  type UpdateApplicationSettingsResponse, type UploadApplicationAssetRequest,
  type UploadApplicationAssetResponse } from "@testcenter-rewrite-app/contracts";
import { defaultApplicationSettings, type ApplicationAssetSlotName, type ApplicationSettings } from "@testcenter-rewrite-app/domain";
import type { OriginalAdministrationTransport } from "./original-administration-controller";
import { originalSettingsCustomTextCatalog } from "./original-settings-catalog";

export type OriginalGeneralSettings = Pick<ApplicationSettings,
  "appTitle"|"legalNoticeHtml"|"privacyNotice"|"accessibilityNotice"|"themeName"> & {
    globalWarningText:string; warningDay:string; warningHour:string;
  };
type Owner = { epoch:number; token:string };
const clone = <T>(value:T):T => structuredClone(value);
export const originalWarningDay = (date:Date):string => [date.getFullYear(),
  String(date.getMonth()+1).padStart(2,"0"),String(date.getDate()).padStart(2,"0")].join("-");
export const originalWarningExpiration = (day:string,hour:string):string|null => {
  if(!day)return null;
  const [year,month,date]=day.split("-").map(Number),value=new Date(year!,month!-1,date!,Number(hour||0));
  if(!Number.isFinite(value.getTime())||originalWarningDay(value)!==day)throw Error("Invalid warning date.");
  return value.toISOString();
};
const generalSettings = (settings:ApplicationSettings):OriginalGeneralSettings => {
  const expiry=settings.globalWarningExpiresAt?new Date(settings.globalWarningExpiresAt):null;
  return {appTitle:settings.appTitle,legalNoticeHtml:settings.legalNoticeHtml,privacyNotice:settings.privacyNotice,
    accessibilityNotice:settings.accessibilityNotice,themeName:settings.themeName,
    globalWarningText:settings.globalWarningText??"",warningDay:expiry?originalWarningDay(expiry):"",
    warningHour:expiry?String(expiry.getHours()).padStart(2,"0"):""};
};
/** Source's three separate settings editors, using the existing protected API.
 * Every continuation and File read belongs to one captured administrator.
 */
export class OriginalApplicationSettingsController {
  settings:ApplicationSettings=clone(defaultApplicationSettings);
  general=generalSettings(this.settings);
  private generalBaseline=clone(this.general);
  customTextValues:Record<string,string>={};
  readonly customTextChanges=new Map<string,string>();
  assignments:ApplicationSettings["assetAssignments"]={};
  assets:ApplicationAssetSummary[]=[];
  ready=false;busy=false;problem="";notice="";
  private epoch=0;private token="";private destroyed=false;
  constructor(private readonly transport:OriginalAdministrationTransport,
    private readonly currentSession:()=>string,private readonly accept:(settings:ApplicationSettings)=>void,
    private readonly changed:()=>void){}
  private owns(owner:Owner):boolean {
    return !this.destroyed&&owner.epoch===this.epoch&&!!owner.token&&owner.token===this.token&&owner.token===this.currentSession();
  }
  private async request<T>(owner:Owner,method:string,path:string,body?:unknown):Promise<T>{
    if(!this.owns(owner))throw Error("Administrator session changed.");
    const result=await this.transport<T>(method,path,body,owner.token);
    if(!this.owns(owner))throw Error("Administrator session changed.");return result;
  }
  private async run(action:(owner:Owner)=>Promise<void>,notice=""):Promise<boolean>{
    const owner={epoch:this.epoch,token:this.token};if(this.busy||!this.owns(owner))return false;
    this.busy=true;this.problem="";this.notice="";this.changed();
    try{await action(owner);if(!this.owns(owner))return false;this.notice=notice;return true;}
    catch(error){if(this.owns(owner)){
      const code=typeof error==="object"&&error!==null&&"error"in error?String(error.error):"";
      this.problem=code==="application_asset_in_use"?"Das Bild ist noch zugeordnet. Bitte entfernen Sie zuerst seine Zuordnungen."
        :"Die Einstellungen konnten nicht gespeichert oder geladen werden. Bitte prüfen Sie die Eingaben und versuchen Sie es erneut.";
    }return false;}
    finally{if(this.owns(owner)){this.busy=false;this.changed();}}
  }
  async connect(token:string):Promise<boolean>{
    this.epoch++;this.token=token;this.busy=false;this.ready=false;this.problem="";this.notice="";
    this.settings=clone(defaultApplicationSettings);this.resetGeneral();this.resetCustomValues();this.assignments={};this.assets=[];
    return this.run(async owner=>{
      const settings=await this.readSettings(owner);this.settings=clone(settings);this.resetGeneral();this.resetCustomValues();
      this.assignments=clone(settings.assetAssignments);this.ready=true;this.accept(settings);this.changed();
      this.assets=(await this.request<ListApplicationAssetsResponse>(owner,"GET",productionApiRoutes.admin.applicationAssets)).items;
    });
  }
  destroy():void{this.destroyed=true;this.epoch++;this.token="";this.busy=false;this.ready=false;
    this.settings=clone(defaultApplicationSettings);this.resetGeneral();this.resetCustomValues();this.assets=[];this.assignments={};}
  private async readSettings(owner:Owner):Promise<ApplicationSettings>{
    return (await this.request<GetApplicationSettingsResponse>(owner,"GET",productionApiRoutes.system.getApplicationSettings)).applicationSettings;
  }
  private async patch(owner:Owner,input:PatchOriginalApplicationSettingsRequest):Promise<ApplicationSettings>{
    const response=await this.request<UpdateApplicationSettingsResponse>(owner,"PATCH",productionApiRoutes.admin.patchOriginalApplicationSettings,input);
    this.settings=clone(response.applicationSettings);this.accept(response.applicationSettings);return response.applicationSettings;
  }
  get generalDirty():boolean{return JSON.stringify(this.general)!==JSON.stringify(this.generalBaseline);}
  resetGeneral():void{this.general=generalSettings(this.settings);this.generalBaseline=clone(this.general);this.changed();}
  async saveGeneral():Promise<boolean>{
    if(!this.generalDirty)return false;
    const draft=clone(this.general);
    return this.run(async owner=>{
      const {warningDay,warningHour,...fields}=draft;
      await this.patch(owner,{...fields,
        globalWarningExpiresAt:originalWarningExpiration(warningDay,warningHour)});
      this.resetGeneral();
    },"Konfigurationsdaten der Anwendung gespeichert");
  }
  private resetCustomValues():void{
    this.customTextChanges.clear();this.customTextValues=Object.fromEntries(originalSettingsCustomTextCatalog.map(item=>[
      item.key,this.settings.customTexts[item.key]||item.defaultValue]));
  }
  setCustomText(key:string,value:string):void{
    if(this.busy)return;const entry=originalSettingsCustomTextCatalog.find(item=>item.key===key);if(!entry)return;
    const actual=value||entry.defaultValue;this.customTextValues={...this.customTextValues,[key]:actual};
    const saved=this.settings.customTexts[key]||entry.defaultValue;
    if(actual===saved)this.customTextChanges.delete(key);else this.customTextChanges.set(key,actual);
    this.changed();
  }
  async saveCustomTexts():Promise<boolean>{
    if(!this.customTextChanges.size)return false;const changes=Object.fromEntries(this.customTextChanges);
    return this.run(async owner=>{
      await this.patch(owner,{customTexts:changes});
      for(const key of Object.keys(changes))this.customTextChanges.delete(key);
    },"Textersetzungen gespeichert");
  }
  setAssignment(slot:ApplicationAssetSlotName,name:string|undefined):void{
    if(this.busy)return;this.assignments={...this.assignments};
    if(name)this.assignments[slot]=name;else delete this.assignments[slot];this.changed();
  }
  async saveAssignments():Promise<boolean>{
    const assignments=clone(this.assignments);
    return this.run(async owner=>{await this.patch(owner,{assetAssignments:assignments});},"Zuordnungen aktualisiert");
  }
  async uploadAsset(read:()=>Promise<UploadApplicationAssetRequest>):Promise<boolean>{
    return this.run(async owner=>{
      const file=await read();
      await this.request<UploadApplicationAssetResponse>(owner,"POST",productionApiRoutes.admin.applicationAssets,file);
      this.assets=(await this.request<ListApplicationAssetsResponse>(owner,"GET",productionApiRoutes.admin.applicationAssets)).items;
    },"Asset hochgeladen");
  }
  async deleteAsset(id:string):Promise<boolean>{
    return this.run(async owner=>{
      await this.request(owner,"DELETE",productionApiRoutes.admin.applicationAssets+"?applicationAssetId="+encodeURIComponent(id),{cascadeAssignments:true});
      // The acknowledged deletion is never replayed if the following read fails.
      this.assets=this.assets.filter(asset=>asset.applicationAssetId!==id);
      const settings=await this.readSettings(owner);
      this.settings=clone(settings);this.assignments=clone(settings.assetAssignments);this.accept(settings);
    },"Bild entfernt");
  }
}
