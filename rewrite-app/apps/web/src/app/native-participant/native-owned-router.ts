import {Router,type NavigationBehaviorOptions,type NavigationExtras,type UrlTree} from '@angular/router';
import {filter,takeUntil,fromEvent,defer,EMPTY} from 'rxjs';
import type {NativeRunContext} from './native-run-context';

/** Source navigation has the same Router API, but an expired run cannot drive it. */
export function nativeOwnedRouter(router:Router,context:()=>NativeRunContext):Router {
 const lifetime=new AbortController(),signal=AbortSignal.any([context().signal,lifetime.signal]);
 const current=()=>!signal.aborted&&context().current;
 const normalize=(commands:readonly unknown[])=>['/r/starter','/starter','/'].includes(String(commands[0]))?['/native-start']:commands;
 const allowed=(tree:UrlTree)=>{
  const parts=tree.root.children['primary']?.segments.map(segment=>segment.path)??[];
  return current()&&((parts[0]==='native-test'&&parts[1]===context().testId)||parts.length===1&&parts[0]==='native-start');
 };
 return new Proxy(router,{
  get(target,key){
   // Angular tracks ngOnDestroy on factory-provided objects. Retiring this
   // adapter must never dispose its borrowed application Router.
   if(key==='ngOnDestroy'||key==='dispose')return()=>lifetime.abort();
   if(key==='navigate')return(commands:readonly unknown[],extras?:NavigationExtras)=>{
    if(!current())return Promise.resolve(false);
    const normalized=normalize(commands),tree=target.createUrlTree(normalized,extras);
    return allowed(tree)?target.navigate(normalized,extras):Promise.resolve(false);
   };
   if(key==='navigateByUrl')return(url:string|UrlTree,extras?:NavigationBehaviorOptions)=>{
    if(!current())return Promise.resolve(false);
    const tree=typeof url==='string'?target.parseUrl(url):url;
    return allowed(tree)?target.navigateByUrl(tree,extras):Promise.resolve(false);
   };
   if(key==='events')return defer(()=>current()?target.events.pipe(takeUntil(fromEvent(signal,'abort')),filter(current)):EMPTY);
   if(key==='getCurrentNavigation'||key==='currentNavigation')return()=>current()?target.currentNavigation():null;
   const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
  }
 });
}
