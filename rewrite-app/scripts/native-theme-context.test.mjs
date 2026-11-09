import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as core from '@angular/core';
import {BehaviorSubject} from 'rxjs';
import * as domain from '@testcenter-rewrite-app/domain';
import * as contracts from '@testcenter-rewrite-app/contracts';
class Api{}class Session{}let bindings,effects,ApplicationSettingsService;
function load(name){
 const code=ts.transpileModule(readFileSync(new URL('../apps/web/src/app/'+name,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
 const exports={};new Function('exports','require',code)(exports,spec=>{
  if(spec==='@angular/core')return {...core,Injectable:()=>v=>v,inject:key=>{assert.ok(bindings.has(key));return bindings.get(key);},effect:fn=>{effects.push(fn);},untracked:fn=>fn()};
  if(spec==='@testcenter-rewrite-app/domain')return domain;if(spec==='@testcenter-rewrite-app/contracts')return contracts;
  if(spec==='rxjs')return {BehaviorSubject};
  if(spec.endsWith('rewrite-app-api.service'))return {RewriteAppApiService:Api};
  if(spec.endsWith('native-session.service'))return {NativeMonitorSessionService:Session};
  if(spec.endsWith('application-settings.service'))return {ApplicationSettingsService};
  throw Error('Unexpected test module '+spec);
 });return exports;
}
ApplicationSettingsService=load('application-settings.service.ts').ApplicationSettingsService;
const {NativeThemeContext}=load('native-theme-context.service.ts');
const {ThemeService}=load('native-participant/shared/services/theme.service.ts');
const {AssetService}=load('native-participant/shared/services/asset.service.ts');
const themes=['Primar','Sekundar','Erwachsene'];
function fixture(globalTheme='Primar',loginTheme='Sekundar',activate=true){
 globalThis.document={documentElement:{dataset:{}},title:''};effects=[];let scope=new AbortController();
 const session={access:core.signal({token:'actor-A',viewSettings:loginTheme?{theme:loginTheme}:[]}),busy:core.signal(false),restoring:core.signal(false),get accessSignal(){return scope.signal;}};
 bindings=new Map([[Api,{}],[Session,session]]);const settings=new ApplicationSettingsService();settings.applyServerSettings({...domain.defaultApplicationSettings,themeName:globalTheme});bindings.set(ApplicationSettingsService,settings);
 const context=new NativeThemeContext(),owner=new AbortController();if(activate)context.activate(owner.signal);
 return {session,settings,context,owner,flush(){effects.forEach(fn=>fn());},replace(theme,token='actor-B'){scope.abort();scope=new AbortController();session.access.set(token?{token,viewSettings:theme?{theme}:[]}:null);}};
}
for(const global of themes)for(const authored of [null,...themes])test('verified login theme '+String(authored)+' over global '+global+' controls CSS, audience and fallback illustration',()=>{
 const f=fixture(global,authored),expected=authored??global,theme=new ThemeService();
 assert.equal(f.settings.effectiveThemeName(),expected);assert.equal(document.documentElement.dataset.applicationTheme,expected);
 assert.equal(theme.activeTheme.name,expected);assert.equal(theme.activeTheme.targetAudience,expected==='Primar'?'children':expected==='Sekundar'?'teenager':'adults');
 assert.equal(theme.activeTheme.cssClassName,expected==='Erwachsene'?'theme-adult':'theme-'+expected.toLowerCase());
 assert.equal(f.settings.assetUrl('codeInputIllustration'),'assets/images/code-input-illustration-'+(expected==='Sekundar'?'teens':'kids')+'.png');f.owner.abort();
});
test('retiring an actor restores the global theme synchronously before a replacement reactive turn',()=>{
 const f=fixture('Erwachsene','Primar');f.replace('Sekundar');assert.equal(document.documentElement.dataset.applicationTheme,'Erwachsene');assert.equal(f.settings.effectiveThemeName(),'Erwachsene');
 f.flush();assert.equal(f.settings.effectiveThemeName(),'Sekundar');f.replace(null,null);assert.equal(f.settings.effectiveThemeName(),'Erwachsene');f.flush();assert.equal(f.settings.effectiveThemeName(),'Erwachsene');f.owner.abort();
});
test('verified refresh of the same actor and scope applies changed view settings',()=>{
 const f=fixture('Erwachsene','Primar'),scope=f.session.accessSignal;
 f.session.access.set({...f.session.access(),viewSettings:{theme:'Sekundar'}});f.flush();assert.equal(f.session.accessSignal,scope);assert.equal(f.settings.effectiveThemeName(),'Sekundar');
 f.session.access.set({...f.session.access(),viewSettings:[]});f.flush();assert.equal(f.settings.effectiveThemeName(),'Erwachsene');f.owner.abort();
});
for(const state of ['busy','restoring'])test(state+' credentials cannot apply retained authored settings until verified',()=>{
 const f=fixture('Erwachsene','Primar',false);f.session[state].set(true);f.context.activate(f.owner.signal);assert.equal(f.settings.effectiveThemeName(),'Erwachsene');
 f.session[state].set(false);f.flush();assert.equal(f.settings.effectiveThemeName(),'Primar');f.session[state].set(true);f.flush();assert.equal(f.settings.effectiveThemeName(),'Erwachsene');f.owner.abort();
});
test('native empty authored theme suppresses stale canonical settings while preserving another view owner',()=>{
 const f=fixture('Primar',null),other=new AbortController();f.settings.applyParticipantTheme('Erwachsene');assert.equal(f.settings.effectiveThemeName(),'Primar');
 f.context.activate(other.signal);f.owner.abort();assert.equal(f.settings.effectiveThemeName(),'Primar');
 other.abort();assert.equal(f.settings.effectiveThemeName(),'Erwachsene');f.settings.clearParticipantTheme();assert.equal(f.settings.effectiveThemeName(),'Primar');
});
for(const invalid of ['Unknown','theme-adult','<style>',{},false])test('invalid authored theme returns to global without injecting a document value: '+String(invalid),()=>{
 const f=fixture('Sekundar',invalid);assert.equal(f.settings.effectiveThemeName(),'Sekundar');assert.equal(document.documentElement.dataset.applicationTheme,'Sekundar');f.owner.abort();
});
test('global settings updates retain a current authored theme and become effective immediately on retirement',()=>{
 const f=fixture('Primar','Sekundar');f.settings.applyServerSettings({...domain.defaultApplicationSettings,themeName:'Erwachsene'});assert.equal(f.settings.effectiveThemeName(),'Sekundar');
 f.replace(null,null);assert.equal(f.settings.effectiveThemeName(),'Erwachsene');f.owner.abort();
});
test('an already retired view cannot claim theme ownership',()=>{
 const f=fixture('Primar','Erwachsene',false);f.owner.abort();assert.throws(()=>f.context.activate(f.owner.signal),{name:'AbortError'});f.flush();assert.equal(f.settings.effectiveThemeName(),'Primar');
});
test('native asset subscribers refresh assigned images and theme fallback for retained components',()=>{
 const f=fixture('Primar','Primar'),service=new AssetService(),observed=[];
 const subscription=service.assetSlots$.subscribe(()=>observed.push([service.getAssetSrc('codeInputIllustration'),service.getAssetSrc('logo')]));
 f.settings.setNativeAssetUrls({logo:'/public/uploaded_assets/asset_'+('1'.repeat(32))+'.png'});f.flush();assert.match(observed.at(-1)[1],/asset_1{32}\.png$/);
 f.session.access.set({...f.session.access(),viewSettings:{theme:'Sekundar'}});f.flush();assert.match(observed.at(-1)[0],/illustration-teens\.png$/);
 f.settings.setNativeAssetUrls({});f.flush();assert.equal(observed.at(-1)[1],'assets/images/IQB-Logo-2025.png');subscription.unsubscribe();f.owner.abort();
});
