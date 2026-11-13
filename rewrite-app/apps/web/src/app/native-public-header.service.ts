import {Injectable,signal} from '@angular/core';

type PublicHeaderTitle=''|'Anmelden'|'Übersicht'|'Systemcheck';

/** Source's public titles survive routed views, but not a new document.
 * Private group, workspace and Booklet titles keep their existing access owners. */
@Injectable({providedIn:'root'})
export class NativePublicHeaderService {
 private readonly value=signal<PublicHeaderTitle>('');
 readonly title=this.value.asReadonly();
 private revision=0;

 setTitle(title:PublicHeaderTitle):()=>void{
  const revision=++this.revision;this.value.set(title);
  // Source's Starter resets its title on destruction. An old Starter must
  // not clear a title already installed by a later routed view.
  return()=>{if(this.revision===revision){this.revision++;this.value.set('');}};
 }
}
