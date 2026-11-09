import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as core from '@angular/core';
import * as domain from '@testcenter-rewrite-app/domain';
import * as contracts from '@testcenter-rewrite-app/contracts';
class Api{}class Session{}let bindings,effects;
function load(name){
 const code=ts.transpileModule(readFileSync(new URL('../apps/web/src/app/'+name,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
 const exports={};new Function('exports','require',code)(exports,spec=>{
  if(spec==='@angular/core')return {...core,Injectable:()=>v=>v,inject:key=>{assert.ok(bindings.has(key));return bindings.get(key);},effect:fn=>{effects.push(fn);},untracked:fn=>fn()};
  if(spec==='@testcenter-rewrite-app/domain')return domain;if(spec==='@testcenter-rewrite-app/contracts')return contracts;
  if(spec.endsWith('rewrite-app-api.service'))return {RewriteAppApiService:Api};
  if(spec.endsWith('native-session.service'))return {NativeMonitorSessionService:Session};
  if(spec.endsWith('application-settings.service'))return {ApplicationSettingsService};
  throw Error('Unexpected test module '+spec);
 });return exports;
}
const {ApplicationSettingsService}=load('application-settings.service.ts'),{NativeAssetContext}=load('native-asset-context.service.ts');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const settle=()=>new Promise(done=>setImmediate(done));
const url=n=>'public/uploaded_assets/asset_'+String(n).repeat(32)+'.png';
function fixture(){
 effects=[];let scope=new AbortController();const requests=[];
 const session={access:core.signal({token:'actor-A'}),busy:core.signal(false),restoring:core.signal(false),get accessSignal(){return scope.signal;},text:(_method,path,_body,token,_raw,signal)=>{assert.equal(path,'/asset-assignments');const pending=deferred();requests.push({...pending,token,signal});return pending.promise;}};
 bindings=new Map([[Api,{}],[Session,session]]);const settings=new ApplicationSettingsService();bindings.set(ApplicationSettingsService,settings);
 const context=new NativeAssetContext(),owner=new AbortController();context.activate(owner.signal);
 return {context,settings,session,owner,requests,replace(token){const old=scope;scope=new AbortController();session.access.set(token?{token}:null);old.abort();},flush(){effects.forEach(fn=>fn());}};
}
test('actual native asset context applies only safe current resolved URLs and signals readiness',async()=>{
 const f=fixture();assert.equal(f.context.ready(),false);assert.equal(f.requests.length,1);assert.equal(f.requests[0].token,'actor-A');
 f.requests[0].resolve(JSON.stringify({logo:{assetID:1,url:url(1)},loadingProgress:{assetID:2,url:url(2)}}));await settle();
 assert.equal(f.context.ready(),true);assert.equal(f.context.problem(),'');assert.equal(f.settings.assetUrl('logo'),'/'+url(1));assert.equal(f.settings.assetUrl('loadingProgress'),'/'+url(2));assert.equal(f.settings.assetUrl('starterCompanion'),'assets/images/bird-character-cool.png');f.owner.abort();
});
test('settled actor retirement clears private URLs immediately before another reactive turn',async()=>{
 const f=fixture();f.requests[0].resolve(JSON.stringify({logo:{assetID:1,url:url(1)}}));await settle();assert.equal(f.settings.assetUrl('logo'),'/'+url(1));
 f.replace('actor-B');assert.notEqual(f.settings.assetUrl('logo'),'/'+url(1));assert.equal(f.context.ready(),false);f.flush();assert.equal(f.requests.length,2);assert.equal(f.requests[1].token,'actor-B');
 f.requests[1].resolve(JSON.stringify({logo:{assetID:2,url:url(2)}}));await settle();assert.equal(f.settings.assetUrl('logo'),'/'+url(2));f.owner.abort();
});
test('late metadata from a retired actor cannot satisfy or overwrite its replacement',async()=>{
 const f=fixture();f.replace('actor-B');f.flush();assert.equal(f.requests[0].signal.aborted,true);
 f.requests[0].resolve(JSON.stringify({logo:{assetID:1,url:url(1)}}));await settle();assert.equal(f.context.ready(),false);assert.notEqual(f.settings.assetUrl('logo'),'/'+url(1));
 f.requests[1].resolve('[]');await settle();assert.equal(f.context.ready(),true);assert.equal(f.settings.assetUrl('logo'),'assets/images/IQB-Logo-2025.png');f.owner.abort();
});
test('destroying the last owning view aborts a pending request and retires its metadata',async()=>{
 const f=fixture();f.owner.abort();assert.equal(f.requests[0].signal.aborted,true);f.requests[0].resolve(JSON.stringify({logo:{assetID:1,url:url(1)}}));await settle();assert.equal(f.context.ready(),false);assert.notEqual(f.settings.assetUrl('logo'),'/'+url(1));
});
test('two live views share one actor request and one retiring view cannot clear the other',async()=>{
 const f=fixture(),second=new AbortController();f.context.activate(second.signal);assert.equal(f.requests.length,1);f.requests[0].resolve(JSON.stringify({logo:{assetID:1,url:url(1)}}));await settle();f.owner.abort();assert.equal(f.settings.assetUrl('logo'),'/'+url(1));assert.equal(f.context.ready(),true);second.abort();assert.notEqual(f.settings.assetUrl('logo'),'/'+url(1));
});
for(const bad of ['https://external.invalid/private.png','javascript:alert(1)','public/uploaded_assets/../private','public/uploaded_assets/asset_'+('1'.repeat(32))+'.svg'])test('untrusted asset URL is rejected: '+bad,async()=>{
 const f=fixture();f.requests[0].resolve(JSON.stringify({logo:{assetID:1,url:bad}}));await settle();assert.equal(f.context.ready(),true);assert.ok(f.context.problem());assert.equal(f.settings.assetUrl('logo'),'assets/images/IQB-Logo-2025.png');f.owner.abort();
});
test('busy credential transitions retire metadata and fetch only after the actor settles',async()=>{
 const f=fixture();f.session.busy.set(true);f.flush();assert.equal(f.requests[0].signal.aborted,true);assert.equal(f.context.ready(),false);assert.equal(f.requests.length,1);
 f.replace('actor-B');f.flush();assert.equal(f.requests.length,1);f.session.busy.set(false);f.flush();assert.equal(f.requests.length,2);assert.equal(f.requests[1].token,'actor-B');f.requests[1].resolve('[]');await settle();assert.equal(f.context.ready(),true);f.owner.abort();
});
test('anonymous metadata is credential-free and keeps native empty-slot defaults',async()=>{
 const f=fixture();f.replace(null);f.flush();assert.equal(f.requests[1].token,'');f.requests[1].resolve('[]');await settle();assert.equal(f.context.ready(),true);assert.equal(f.settings.assetUrl('codeInputIllustration'),'assets/images/code-input-illustration-kids.png');f.owner.abort();f.requests[0].resolve('[]');await settle();
});
