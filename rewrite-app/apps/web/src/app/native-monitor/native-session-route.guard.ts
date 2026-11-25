import {inject} from '@angular/core';
import {toObservable} from '@angular/core/rxjs-interop';
import {Router,type CanActivateFn} from '@angular/router';
import {filter,map,take,timeout,type Observable} from 'rxjs';
import {legacyBookmarkQueryKey} from '../native-participant/original-participant-bookmark';
import {HeaderService} from './shared/services/header.service';
import {NativeMonitorSessionService} from './native-session.service';

export function afterNativeSessionRestore<T>(session:NativeMonitorSessionService,decide:()=>T):T|Observable<T>{
 return session.restoring()
  ?toObservable(session.restoring).pipe(filter(value=>!value),take(1),timeout(20000),map(decide))
  :decide();
}

export const gateStudyMonitor:CanActivateFn=()=>{
 const session=inject(NativeMonitorSessionService),router=inject(Router);
 return afterNativeSessionRestore(session,()=>{
  const access=session.access();
  return access?.claims.studyMonitor?.length&&!access.flags.includes('codeRequired')
   ?true:router.parseUrl('/native-start/dispatch');
 });
};

export const gateAttachmentManager:CanActivateFn=()=>{
 const session=inject(NativeMonitorSessionService),router=inject(Router);
 return afterNativeSessionRestore(session,()=>{
  const access=session.access();
  return access?.claims.attachmentManager?.length&&!access.flags.includes('codeRequired')
   ?true:router.parseUrl('/native-start/dispatch');
 });
};

export const gateLegacyGroupMonitorBookmark:CanActivateFn=route=>{
 const router=inject(Router);
 if(route.firstChild&&!router.lastSuccessfulNavigation()){
  // Capture the public heading configuration before the restored token is
  // verified. The verified session is still the only source of private labels.
  inject(HeaderService).captureInitialRoute(route.firstChild);
 }
 if(route.queryParamMap.get(legacyBookmarkQueryKey)!=='1')return true;
 const session=inject(NativeMonitorSessionService);
 return afterNativeSessionRestore(session,()=>{
  const access=session.access();
  const claims=access?.claims.testGroupMonitor;
  if(!claims?.length||access?.flags.includes('codeRequired'))return router.parseUrl('/native-start/dispatch');

  const params=route.firstChild?.paramMap;
  const group=params?.get('group-name');
  if(!group||params?.has('profile-id'))return true;
  // A profile-only grant cannot open the unprofiled monitor.
  const profiles=new Set(claims.filter(claim=>claim.id===group)
   .map(claim=>Array.isArray(claim.flags)?'':claim.flags.profile??''));
  const [profile]=profiles;
  return profiles.size===1&&profile
   ?router.createUrlTree(['/group-monitor',group,profile],{queryParams:route.queryParams})
   :true;
 });
};
