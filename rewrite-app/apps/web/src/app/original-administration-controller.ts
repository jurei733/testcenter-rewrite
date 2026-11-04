import type {OriginalAdminAccessSet} from '@testcenter-rewrite-app/contracts/original-session';
import type {NativeAdministrationTransport} from './original-administration-http';
import {originalAdministrationId,originalAdministrationPermissionBody,type OriginalAdmin,type OriginalWorkspace,type OriginalPermission} from './original-administration-wire';
export type {OriginalAdmin,OriginalWorkspace} from './original-administration-wire';
// Application settings retain their existing canonical transport.
export type OriginalAdministrationTransport=<T>(method:string,path:string,body:unknown,sessionToken:string)=>Promise<T>;
export type OriginalWorkspaceAccess=''|'RO'|'RW';
export type OriginalPermissionChange={adminUserId:string;workspaceId:string;access:OriginalWorkspaceAccess;selected:boolean;role:string};
export type OriginalPermissionRow=OriginalPermissionChange&{label:string;view:number};
type Owner={epoch:number;token:string};
type MatrixOwner={section:'users'|'workspaces';id:string;view:number};
const permissionKey=(a:string,w:string)=>JSON.stringify([a,w]);
const effective=(role:string):OriginalWorkspaceAccess=>role==='RO'||role==='RW'?role:'';

/** Native identities only. Every continuation owns its session and selected
 * matrix; one complete PATCH owns each permission save. */
export class OriginalAdministrationController {
  admins:OriginalAdmin[]=[];
  workspaces:OriginalWorkspace[]=[];
  selfId='';
  selectedAdminId='';
  selectedWorkspaceId='';
  permissionViewEpoch=0;
  busy=false;
  problem='';
  problemCode='';
  notice='';
  readonly changes=new Map<string,OriginalPermissionChange>();
  private epoch=0;
  private token='';
  private destroyed=false;
  private scope=new AbortController();
  private selection=0;
  private matrix:OriginalPermission[]=[];
  private matrixOwner:MatrixOwner|null=null;
  private retainedPermissions:{section:'users'|'workspaces';rows:OriginalPermissionRow[]}|null=null;
  constructor(private readonly transport:NativeAdministrationTransport,
    private readonly currentSession:()=>{token:string},private readonly changed:()=>void,
    private readonly replaceToken:(previous:string,next:string)=>boolean=()=>false){}
  private owns(o:Owner):boolean {
    return !this.destroyed&&o.epoch===this.epoch&&o.token!==''&&o.token===this.token&&o.token===this.currentSession().token;
  }
  private async request<T>(o:Owner,method:string,path:string,body?:unknown):Promise<T>{
    if(!this.owns(o))throw Error('Original administrator session changed.');
    const reply=await this.transport(method,path,body,o.token,this.scope.signal);
    if(!this.owns(o))throw Error('Original administrator session changed.');
    if(reply.authToken){
      if(path!=='/user/'+this.selfId+'/password'||method!=='PATCH'||!this.replaceToken(o.token,reply.authToken))throw Error('Administrator token ownership changed.');
      this.scope.abort();this.scope=new AbortController();this.token=reply.authToken;o.token=reply.authToken;
    }
    return reply.value as T;
  }
  private async run(action:(o:Owner)=>Promise<void>,success:string):Promise<boolean>{
    const o={epoch:this.epoch,token:this.token};
    if(this.busy||!this.owns(o))return false;
    this.busy=true;this.problem='';this.problemCode='';this.notice='';this.changed();
    try{await action(o);if(!this.owns(o))return false;this.notice=success;return true;}
    catch(error){
      if(this.owns(o)){
        this.problemCode=error&&typeof error==='object'&&'error' in error?String(error.error):'unexpected_error';
        this.problem=this.problemCode==='admin_password_confirmation_invalid'?'Falsches Kennwort.':
          'Die Aktion konnte nicht abgeschlossen werden. Bitte prüfen Sie die Eingaben und versuchen Sie es erneut.';
      }return false;
    }finally{if(this.owns(o)){this.busy=false;this.changed();}}
  }
  async connect(token:string):Promise<boolean>{
    this.scope.abort();this.scope=new AbortController();this.epoch++;this.token=token;this.busy=false;
    this.admins=[];this.workspaces=[];this.selfId='';this.clearSelection(false);
    this.problem='';this.problemCode='';this.notice='';this.changed();
    return this.run(async o=>{
      const [access,users,workspaces]=await Promise.all([
        this.request<OriginalAdminAccessSet>(o,'GET','/session'),
        this.request<OriginalAdmin[]>(o,'GET','/users'),
        this.request<OriginalWorkspace[]>(o,'GET','/workspaces')
      ]);
      if(access.token!==o.token||!Array.isArray(access.claims.superAdmin))throw Error('Invalid native Root session.');
      this.selfId=originalAdministrationId(access.id);this.admins=users;this.workspaces=workspaces;
    },'');
  }
  destroy():void {
    this.destroyed=true;this.scope.abort();this.epoch++;this.token='';this.selfId='';
    this.admins=[];this.workspaces=[];this.busy=false;this.clearSelection(false);
  }
  clearSelection(retainRows=true):void {
    const section=this.selectedAdminId?'users':this.selectedWorkspaceId?'workspaces':null;
    if(!retainRows)this.retainedPermissions=null;
    else if(section)this.retainedPermissions={section,rows:this.permissionRows(section)};
    this.selection++;this.selectedAdminId='';this.selectedWorkspaceId='';this.changes.clear();this.matrix=[];this.matrixOwner=null;
  }
  private subjectCurrent(subject:MatrixOwner):boolean {
    return subject.view===this.selection&&(subject.section==='users'?this.selectedAdminId:this.selectedWorkspaceId)===subject.id;
  }
  private pair(row:OriginalPermission,subject:MatrixOwner):[string,string] {
    return subject.section==='users'?[subject.id,row.id]:[row.id,subject.id];
  }
  permissionRows(section:'users'|'workspaces'):OriginalPermissionRow[]{
    const subject=this.matrixOwner;
    if(subject&&subject.section===section&&this.subjectCurrent(subject))return this.matrix.map(row=>{
      const [adminUserId,workspaceId]=this.pair(row,subject),draft=this.changes.get(permissionKey(adminUserId,workspaceId));
      return {adminUserId,workspaceId,label:row.name,view:subject.view,selected:draft?.selected??row.selected,role:draft?.role??row.role,access:draft?.access??effective(row.role)};
    });
    return !this.selectedAdminId&&!this.selectedWorkspaceId&&this.retainedPermissions?.section===section?[...this.retainedPermissions.rows]:[];
  }
  togglePermissionRow(row:OriginalPermissionRow,control:'RO'|'RW'):void {
    if(this.busy)return;
    if(this.selectedAdminId||this.selectedWorkspaceId){
      if(this.matrixOwner?.view===row.view)this.togglePermission(row.adminUserId,row.workspaceId,control);
    }
    else if(this.retainedPermissions?.rows.includes(row)){
      row.access=control==='RW'?(row.access==='RW'?'RO':'RW'):(row.access?'':'RO');this.changed();
    }
  }
  async selectAdmin(id:string):Promise<boolean>{return this.select('users',id);}
  async selectWorkspace(id:string):Promise<boolean>{return this.select('workspaces',id);}
  private async select(section:'users'|'workspaces',id:string):Promise<boolean>{
    if(this.busy||!(section==='users'?this.admins:this.workspaces).some(row=>row.id===id))return false;
    if((section==='users'?this.selectedAdminId:this.selectedWorkspaceId)===id&&this.matrixOwner?.section===section&&
      this.matrixOwner.id===id&&this.subjectCurrent(this.matrixOwner))return true;
    this.clearSelection(false);if(section==='users')this.selectedAdminId=id;else this.selectedWorkspaceId=id;
    this.permissionViewEpoch++;
    const subject:MatrixOwner={section,id,view:this.selection};
    return this.run(async o=>{
      const rows=await this.request<OriginalPermission[]>(o,'GET',this.matrixPath(subject));
      if(this.subjectCurrent(subject)){this.matrix=rows;this.matrixOwner=subject;}
    },'');
  }
  get selectedAdmin():OriginalAdmin|undefined{return this.admins.find(row=>row.id===this.selectedAdminId);}
  get selectedWorkspace():OriginalWorkspace|undefined{return this.workspaces.find(row=>row.id===this.selectedWorkspaceId);}
  isSuperadmin(admin:OriginalAdmin):boolean{return admin.isSuperadmin;}
  access(adminUserId:string,workspaceId:string):OriginalWorkspaceAccess {
    const subject=this.matrixOwner;if(!subject||!this.subjectCurrent(subject))return '';
    const row=this.matrix.find(row=>{const [a,w]=this.pair(row,subject);return a===adminUserId&&w===workspaceId;});
    return row?this.changes.get(permissionKey(adminUserId,workspaceId))?.access??effective(row.role):'';
  }
  togglePermission(adminUserId:string,workspaceId:string,control:'RO'|'RW'):void {
    const subject=this.matrixOwner;if(this.busy||!subject||!this.subjectCurrent(subject))return;
    const row=this.matrix.find(row=>{const [a,w]=this.pair(row,subject);return a===adminUserId&&w===workspaceId;});if(!row)return;
    const key=permissionKey(adminUserId,workspaceId),draft=this.changes.get(key),previous=draft?.role??row.role;
    const access:OriginalWorkspaceAccess=control==='RW'?(previous==='RW'?'RO':'RW'):(previous==='RO'||previous==='RW'?'':'RO');
    const selected=access!=='';
    if(access===row.role&&selected===row.selected)this.changes.delete(key);
    else this.changes.set(key,{adminUserId,workspaceId,access,role:access,selected});
    this.changed();
  }
  private matrixPath(s:MatrixOwner):string{return s.section==='users'?'/user/'+s.id+'/workspaces':'/workspace/'+s.id+'/users';}
  async savePermissions():Promise<boolean>{
    const subject=this.matrixOwner;
    if(!subject||!this.subjectCurrent(subject)||!this.changes.size||!this.matrix.length)return false;
    const rows=this.matrix.map(row=>{
      const [a,w]=this.pair(row,subject),draft=this.changes.get(permissionKey(a,w));
      return draft?{...row,role:draft.role,selected:draft.selected}:{...row};
    });
    const body={[subject.section==='users'?'ws':'u']:originalAdministrationPermissionBody(rows)};
    return this.run(async o=>{
      if(!this.subjectCurrent(subject))throw Error('Permission subject changed.');
      await this.request(o,'PATCH',this.matrixPath(subject),body);
      if(this.subjectCurrent(subject)){this.matrix=rows;this.changes.clear();}
    },'Zugriffsrechte geändert');
  }
  /** A committed write must not be repeated if the following directory read
   * fails. Keep the acknowledgement and show an owned refresh error instead. */
  private async refresh(o:Owner,kind:'users'|'workspaces'):Promise<void>{
    try{
      if(kind==='users')this.admins=await this.request<OriginalAdmin[]>(o,'GET','/users');
      else this.workspaces=await this.request<OriginalWorkspace[]>(o,'GET','/workspaces');
    }catch(error){
      if(!this.owns(o))throw error;
      this.problem='Die Änderung wurde gespeichert. Die Liste konnte nicht neu geladen werden. Bitte laden Sie die Seite erneut.';
      this.problemCode='original_directory_refresh_failed';
    }
  }
  async createUser(name:string,password:string):Promise<boolean>{
    return this.run(async o=>{await this.request(o,'PUT','/user',{n:name,p:password});this.clearSelection();await this.refresh(o,'users');},'Administrator:in hinzugefügt');
  }
  async resetPassword(id:string,password:string,oldPassword?:string):Promise<boolean>{
    if(!this.admins.some(row=>row.id===id)||!this.selfId)return false;
    return this.run(async o=>{
      const previous=o.token;
      await this.request(o,'PATCH','/user/'+id+'/password',{p:password,...oldPassword===undefined?{}:{oldPassword}});
      if(id===this.selfId&&previous===o.token)throw Error('Missing renewed administrator token.');
    },'Kennwort geändert');
  }
  async changeSuperadmin(id:string,password:string):Promise<boolean>{
    const user=this.admins.find(row=>row.id===id);if(!user||!this.selfId||id===this.selfId)return false;
    const enabled=!user.isSuperadmin;
    return this.run(async o=>{
      await this.request(o,'PATCH','/user/'+id+'/super-admin/'+(enabled?'on':'off'),{p:password});
      this.clearSelection();this.admins=this.admins.map(row=>row.id===id?{...row,isSuperadmin:enabled}:row);await this.refresh(o,'users');
    },'Superadmin-Status geändert');
  }
  async deleteUser(id:string,password:string):Promise<boolean>{
    if(!this.selfId||id===this.selfId||!this.admins.some(row=>row.id===id))return false;
    return this.run(async o=>{
      await this.request(o,'DELETE','/users',{u:[id],p:password});this.clearSelection();
      this.admins=this.admins.filter(row=>row.id!==id);await this.refresh(o,'users');
    },'Administrator:in gelöscht');
  }
  async createWorkspace(name:string):Promise<boolean>{
    return this.run(async o=>{await this.request(o,'PUT','/workspace',{name});this.clearSelection();await this.refresh(o,'workspaces');},'Arbeitsbereich hinzugefügt');
  }
  async renameWorkspace(id:string,name:string):Promise<boolean>{
    if(!this.workspaces.some(row=>row.id===id))return false;
    return this.run(async o=>{await this.request(o,'PATCH','/workspace/'+id,{name});this.clearSelection();await this.refresh(o,'workspaces');},'Arbeitsbereich geändert');
  }
  async deleteWorkspace(id:string,password:string):Promise<boolean>{
    if(!this.workspaces.some(row=>row.id===id))return false;
    return this.run(async o=>{
      await this.request(o,'DELETE','/workspaces',{ws:[id],p:password});this.clearSelection();
      this.workspaces=this.workspaces.filter(row=>row.id!==id);await this.refresh(o,'workspaces');
    },'Arbeitsbereich gelöscht');
  }
}
