import { Component, ChangeDetectorRef, Input, inject, type OnChanges, type OnDestroy } from "@angular/core";
import { FormsModule, type NgModel } from "@angular/forms";
import { CdkTextareaAutosize } from "@angular/cdk/text-field";
import { MatButton, MatFabButton, MatIconButton } from "@angular/material/button";
import { MatCard, MatCardHeader, MatCardTitle, MatCardImage, MatCardActions } from "@angular/material/card";
import { MAT_DATE_LOCALE, provideNativeDateAdapter } from "@angular/material/core";
import { MatDatepicker, MatDatepickerInput, MatDatepickerToggle } from "@angular/material/datepicker";
import { MatDivider } from "@angular/material/divider";
import { MatAccordion, MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle } from "@angular/material/expansion";
import { MatFormField, MatLabel } from "@angular/material/form-field";
import { MatGridList, MatGridTile } from "@angular/material/grid-list";
import { MatInput } from "@angular/material/input";
import { MatRadioButton, MatRadioGroup } from "@angular/material/radio";
import { MatSelect, MatOption } from "@angular/material/select";
import { MatTabGroup, MatTab, MatTabLabel } from "@angular/material/tabs";
import { MatTooltip } from "@angular/material/tooltip";
import { ApplicationSettingsService } from "./application-settings.service";
import { RewriteAppShellRequestService } from "./rewrite-app-shell-request.service";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";
import { OriginalAdministrationIconComponent } from "./original-administration-icon.component";
import { OriginalApplicationSettingsController, originalWarningDay, originalWarningExpiration } from "./original-application-settings-controller";
import { originalSettingsCustomTextCatalog } from "./original-settings-catalog";

@Component({
  selector:"app-original-application-settings",standalone:true,
  imports:[FormsModule,CdkTextareaAutosize,MatButton,MatFabButton,MatIconButton,MatCard,MatCardHeader,MatCardTitle,MatCardImage,MatCardActions,
    MatDatepicker,MatDatepickerInput,MatDatepickerToggle,MatDivider,MatAccordion,MatExpansionPanel,MatExpansionPanelHeader,MatExpansionPanelTitle,
    MatFormField,MatLabel,MatGridList,MatGridTile,MatInput,MatRadioButton,MatRadioGroup,MatSelect,MatOption,
    MatTabGroup,MatTab,MatTabLabel,MatTooltip,OriginalAdministrationIconComponent],
  providers:[provideNativeDateAdapter(),{provide:MAT_DATE_LOCALE,useValue:"de-DE"}],
  templateUrl:"./original-application-settings.component.html",
  styleUrls:["./original-login-theme.scss","./original-application-settings.component.scss"]
})
export class OriginalApplicationSettingsComponent implements OnChanges,OnDestroy {
  @Input({required:true}) sessionToken="";
  readonly applicationSettings=inject(ApplicationSettingsService);
  private readonly request=inject(RewriteAppShellRequestService);
  private readonly state=inject(RewriteAppUiStateService);
  private readonly changed=inject(ChangeDetectorRef);
  private connectedToken="";private destroyed=false;
  readonly controller=new OriginalApplicationSettingsController(
    (method,path,body,token)=>this.request.request("Einstellungen",method,path,body,{quiet:true,headers:{authorization:"Bearer "+token}}),
    ()=>this.state.ops.adminSessionToken.trim(),settings=>this.applicationSettings.applyServerSettings(settings),
    ()=>{if(!this.destroyed)this.changed.markForCheck();});
  readonly groups=[{key:"booklet",label:"Testheft"},{key:"gm",label:"Gruppenmonitor"},
    {key:"login",label:"Login"},{key:"syscheck",label:"Systemcheck"}].map(group=>({...group,
      texts:originalSettingsCustomTextCatalog.filter(entry=>entry.group===group.key)}));
  readonly themes=[
    {name:"Primar",color:"#196175",description:"Zielgruppe Schüler*innen der Primarstufe"},
    {name:"Sekundar",color:"#0B2D84",description:"Zielgruppe Schüler*innen der Sekundarstufe I"},
    {name:"Erwachsene",color:"#6B369A",description:"Zielgruppe Erwachsenen (z. B. Lehrkräfte)"}
  ];
  readonly hours=["",...Array.from({length:23},(_,index)=>String(index+1).padStart(2,"0"))];
  readonly slots=[{key:"logo",label:"Logo"},{key:"loginIllustration",label:"Login-Illustration"},
    {key:"codeInputIllustration",label:"Code-Eingabe-Illustration"},{key:"codeInputCompanion",label:"Code-Eingabe-Begleiter"},
    {key:"starterCompanion",label:"Startmenü-Begleiter"},{key:"starterCardDone",label:"Startmenü-Karte-Fertig"},
    {key:"loadingProgress",label:"Ladeanimation"},{key:"confirmDialog",label:"Bestätigungsdialog"}] as const;
  ngOnChanges():void{if(this.connectedToken!==this.sessionToken.trim()){
    this.connectedToken=this.sessionToken.trim();void this.controller.connect(this.connectedToken);
  }}
  private calendarDay="";private calendarValue:Date|null=null;
  get warningDate():Date|null{
    const day=this.controller.general.warningDay;
    if(day!==this.calendarDay){this.calendarDay=day;const [year,month,date]=day.split("-").map(Number);
      this.calendarValue=day?new Date(year!,month!-1,date!):null;}
    return this.calendarValue;
  }
  set warningDate(value:Date|null){this.calendarValue=value&&Number.isFinite(value.getTime())?value:null;
    this.calendarDay=this.calendarValue?originalWarningDay(this.calendarValue):"";this.controller.general.warningDay=this.calendarDay;}
  get warningIsExpired():boolean{
    try{const expiry=originalWarningExpiration(this.controller.general.warningDay,this.controller.general.warningHour);
      return !!expiry&&Date.parse(expiry)<Date.now();}catch{return false;}
  }
  changeCustomText(key:string,value:string,control:NgModel):void{
    this.controller.setCustomText(key,value);
    if(value!==this.controller.customTextValues[key])control.control.setValue(this.controller.customTextValues[key],{emitEvent:false});
  }
  uploadAsset(event:Event):void{
    const input=event.target as HTMLInputElement,file=input.files?.[0];input.value="";if(!file)return;
    if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>2*1024*1024){
      this.controller.problem="Bitte wählen Sie ein PNG-, JPEG- oder WebP-Bild bis 2 MiB.";return;
    }
    void this.controller.uploadAsset(()=>new Promise((done,reject)=>{
      const reader=new FileReader();reader.onerror=()=>reject(Error("Das Bild konnte nicht gelesen werden."));
      reader.onload=()=>{const value=String(reader.result),comma=value.indexOf(",");
        if(comma<0)reject(Error("Das Bild konnte nicht gelesen werden."));
        else done({originalName:file.name,mediaType:file.type,dataBase64:value.slice(comma+1)});};
      reader.readAsDataURL(file);
    }));
  }
  ngOnDestroy():void{this.destroyed=true;this.controller.destroy();}
}
