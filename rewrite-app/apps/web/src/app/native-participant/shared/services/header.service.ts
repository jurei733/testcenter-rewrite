import {Injectable,inject,signal} from '@angular/core';
import {NativeHttpClient} from '../../native-http-client';
const empty=()=>({title:'',hidden:false,account:true});
@Injectable()
export class HeaderService {
 private readonly scope=inject(NativeHttpClient).accessSignal;
 private readonly state=signal(empty());
 private readonly retire=()=>this.state.set(empty());
 constructor(){this.scope.addEventListener('abort',this.retire,{once:true});}
 get title(){return this.scope.aborted?'':this.state().title;}
 set title(value:string|undefined){if(!this.scope.aborted)this.state.update(s=>({...s,title:value??''}));}
 get isHeaderHidden(){return !this.scope.aborted&&this.state().hidden;}
 set isHeaderHidden(value:boolean){if(!this.scope.aborted)this.state.update(s=>({...s,hidden:value}));}
 get showAccountPanel(){return !this.scope.aborted&&this.state().account;}
 set showAccountPanel(value:boolean){if(!this.scope.aborted)this.state.update(s=>({...s,account:value}));}
 ngOnDestroy(){this.scope.removeEventListener('abort',this.retire);this.retire();}
}
