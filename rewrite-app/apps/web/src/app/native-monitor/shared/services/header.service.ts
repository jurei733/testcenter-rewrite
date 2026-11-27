import {Injectable,inject,signal} from '@angular/core';
import type {ActivatedRouteSnapshot} from '@angular/router';
import {defaultApplicationSettings} from '@testcenter-rewrite-app/domain';
import {ApplicationSettingsService} from '../../../application-settings.service';
import {nativeMonitorDefaultTexts} from '../../native-monitor-default-texts';
import {NativeMonitorSessionService} from '../../native-session.service';

type HeadingSettings = { appTitle: string; globalSubtitle: string } | null;

/** The toolbar keeps its opening caption. The browser tab follows the public
 * application title while the current monitor owns its private subtitle. */

@Injectable({providedIn:'root'})
export class HeaderService {
 private readonly session=inject(NativeMonitorSessionService);
 private readonly settings=inject(ApplicationSettingsService);
 private readonly heading=signal<{title:string; subtitle:string; groupLabel:string}|null>(null);
 private readonly routeSettings=new WeakMap<ActivatedRouteSnapshot,HeadingSettings>();
 private initialSettings:HeadingSettings|undefined;
 private release:(()=>void)|undefined;

 captureInitialRoute(route:ActivatedRouteSnapshot):void{
  // A profile-only legacy bookmark can redirect during its first navigation.
  if(this.initialSettings===undefined)this.initialSettings=this.readSettings();
  this.routeSettings.set(route,this.initialSettings);
 }

 showGroup(route:ActivatedRouteSnapshot,groupLabel:string):()=>void{
  this.release?.();
  const access=this.session.access();
  const scope=this.session.accessSignal;
  if(!access||scope.aborted)return()=>{};

  const captured=this.routeSettings.get(route);
  const settings = captured === undefined ? this.readSettings() : captured;
  const subtitle = settings ? (access.customTexts?.['gm_headline'] ?? settings.globalSubtitle) : '';
  const appTitle=settings?.appTitle??defaultApplicationSettings.appTitle;
  const releaseTab=this.settings.claimTabSubtitle(subtitle);
  const retire=()=>{
   if(this.release!==retire)return;
   scope.removeEventListener('abort',retire);
   this.release=undefined;
   this.heading.set(null);
   releaseTab();
  };
  this.release=retire;
  scope.addEventListener('abort',retire,{once:true});
  this.heading.set({title:`${appTitle} ${subtitle} - ${groupLabel}`,subtitle,groupLabel});
  return retire;
 }

 get title(){return this.heading()?.title??'';}
 get groupHeading(){return this.heading();}

 private readSettings():HeadingSettings{
  if(!this.settings.loaded())return null;
  const settings=this.settings.settings();
  return {
   appTitle: settings.appTitle,
   globalSubtitle: settings.customTexts['gm_headline'] ?? nativeMonitorDefaultTexts['gm_headline'] ?? ''
  };
 }

}
