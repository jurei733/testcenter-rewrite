import type {OriginalGroupResult} from '@testcenter-rewrite-app/contracts/original-group-results';
import type {OriginalAdminTestSession} from '@testcenter-rewrite-app/contracts/original-test-administration';
import type {OriginalWorkspaceResultsTransport} from './original-workspace-results-http';
import {originalAdministrationId} from './original-administration-wire';

export type OriginalResultsView='results'|'tests';
export type OriginalResultsScope={token:string;tenantKey:string;workspaceKey:string;view:OriginalResultsView};
export type OriginalResultRow=OriginalGroupResult&{checked:boolean};
export type OriginalTestRow=OriginalAdminTestSession&{checked:boolean};
type Owner=OriginalResultsScope&{epoch:number;abort:AbortController};
const object=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const problem=(e:unknown)=>e instanceof Error?e.message:'Die Ergebnisverwaltung konnte nicht geladen werden.';

/** One view owns its token, canonical scope, native identity and selection.
 * A retained dialog or reply cannot act after any of them changes. */
export class OriginalWorkspaceResultsController {
 rows:OriginalResultRow[]=[];
 groups:Array<{name:string;rows:OriginalTestRow[]}>=[];
 busy=false;loaded=false;problem='';notice='';role:''|'RO'|'RW'='';
 private nativeId='';private epoch=0;private owner:Owner|null=null;private destroyed=false;private selection=0;
 private testSort={active:'name',direction:'asc'};
 constructor(private readonly transport:OriginalWorkspaceResultsTransport,private readonly current:()=>OriginalResultsScope,
  private readonly changed:()=>void){}
 private owns(o:Owner):boolean {
  const s=this.current();return !this.destroyed&&this.owner===o&&o.epoch===this.epoch&&!o.abort.signal.aborted&&!!o.token&&
   s.token===o.token&&s.tenantKey===o.tenantKey&&s.workspaceKey===o.workspaceKey&&s.view===o.view;
 }
 private async request(o:Owner,method:'GET'|'DELETE',path:string,body?:unknown,csv=false):Promise<unknown>{
  if(!this.owns(o))throw Error('Die Anmeldung oder der Arbeitsbereich hat sich geändert.');
  const value=await this.transport(method,path,body,o.token,o.abort.signal,csv);
  if(!this.owns(o))throw Error('Die Anmeldung oder der Arbeitsbereich hat sich geändert.');return value;
 }
 private clear():void{this.rows=[];this.groups=[];this.selection++;this.loaded=false;}
 async connect():Promise<void>{
  this.owner?.abort.abort();const s=this.current();
  if(this.owner?.view!==s.view)this.testSort={active:'name',direction:'asc'};
  const o={...s,epoch:++this.epoch,abort:new AbortController()};this.owner=o;
  this.clear();this.nativeId='';this.role='';this.problem='';this.notice='';
  this.busy=!!s.token&&!!s.tenantKey&&!!s.workspaceKey;this.changed();if(!this.busy)return;
  try{
   const context=await this.request(o,'GET','/api/v1/tenants/'+encodeURIComponent(o.tenantKey)+'/workspaces/'+encodeURIComponent(o.workspaceKey)+'/original-administration');
   if(!object(context)||typeof context['workspaceId']!=='string'||context['role']!=='RO'&&context['role']!=='RW')throw Error('Ungültiger Arbeitsbereich.');
   this.nativeId=originalAdministrationId(context['workspaceId']);this.role=context['role'];await this.load(o);
  }catch(e){if(this.owns(o)){this.nativeId='';this.role='';this.problem=problem(e);}}
  finally{if(this.owns(o)){this.busy=false;this.changed();}}
 }
 private async load(o:Owner):Promise<void>{
  const data=await this.request(o,'GET','/workspace/'+this.nativeId+(o.view==='results'?'/results':'/responses/detailed'));
  if(o.view==='results'){
   const names=new Set<string>();
   if(!Array.isArray(data))throw Error('Ungültige Ergebnisgruppen.');
   this.rows=data.map(row=>{
    if(!object(row)||typeof row['groupName']!=='string'||typeof row['groupLabel']!=='string'||names.has(row['groupName'])||
     !['bookletsStarted','numUnitsMin','numUnitsMax','numUnitsTotal','numUnitsAvg','lastChange'].every(k=>typeof row[k]==='number'&&Number.isFinite(row[k])&&row[k]>=0))throw Error('Ungültige Ergebnisgruppe.');
    names.add(row['groupName']);return {...row,checked:false} as OriginalResultRow;
   });
  }else{
   // PHP emits [] for empty results and a JSON array for contiguous numeric
   // group keys. Entries also handle __proto__ without using object assignment.
   if(!object(data)&&!Array.isArray(data))throw Error('Ungültige Test-Sessions.');
   this.groups=Object.entries(data).map(([name,rows])=>{
    if(!Array.isArray(rows))throw Error('Ungültige Test-Gruppe.');
    return {name,rows:rows.map(row=>{
     if(!object(row)||!['loginName','groupName','groupLabel','code','nameSuffix','bookletName','bookletLabel'].every(k=>typeof row[k]==='string')||row['groupName']!==name)throw Error('Ungültige Test-Session.');
     return {...row,checked:false} as OriginalTestRow;
    })};
   }).filter(group=>group.rows.length);
  }
  this.orderTests();this.selection++;this.loaded=true;
 }
 setTestSort(active:string,direction:string):void{
  if(!this.owner||!this.owns(this.owner)||this.owner.view!=='tests'||this.busy)return;
  this.testSort={active,direction};this.orderTests();this.changed();
 }
 private orderTests():void{
  const key=this.testSort.active==='login'?'loginName':this.testSort.active==='code'?'code':this.testSort.active==='booklet'?'bookletName':null;
  if(!key)return;const direction=this.testSort.direction==='asc'?1:-1;
  for(const group of this.groups)group.rows.sort((a,b)=>a[key].localeCompare(b[key])*direction);
 }
 get canWrite():boolean{return !!this.owner&&this.owns(this.owner)&&this.loaded&&this.role==='RW';}
 get selectedGroups():OriginalResultRow[]{return this.rows.filter(row=>row.checked);}
 get selectedTests():OriginalTestRow[]{return this.groups.flatMap(group=>group.rows.filter(row=>row.checked));}
 get selectedCount():number{return this.owner?.view==='results'?this.selectedGroups.length:this.selectedTests.length;}
 check(row:OriginalResultRow|OriginalTestRow,checked:boolean):void{
  if(this.busy||!this.owner||!this.owns(this.owner)||![...this.rows,...this.groups.flatMap(g=>g.rows)].includes(row))return;
  row.checked=checked;this.selection++;this.changed();
 }
 checkAll(checked:boolean,groupName?:string):void{
  if(this.busy||!this.owner||!this.owns(this.owner))return;
  const rows=groupName===undefined?this.rows:this.groups.find(g=>g.name===groupName)?.rows??[];
  rows.forEach(row=>row.checked=checked);this.selection++;this.changed();
 }
 all(groupName?:string):boolean{
  const rows=groupName===undefined?this.rows:this.groups.find(g=>g.name===groupName)?.rows??[];
  return rows.length>0&&rows.every(row=>row.checked);
 }
 some(groupName?:string):boolean{
  const rows=groupName===undefined?this.rows:this.groups.find(g=>g.name===groupName)?.rows??[];return rows.some(row=>row.checked);
 }
 async download(type:'response'|'log'|'review',enhanced=false):Promise<{blob:Blob;current:()=>boolean}|null>{
  const o=this.owner,groups=this.selectedGroups.map(row=>row.groupName);
  if(!o||!this.owns(o)||this.busy||o.view!=='results'||!groups.length)return null;
  // Source clears the submitted group selection immediately. A later reply
  // must not clear a new selection made while this CSV is downloading.
  this.rows.forEach(row=>row.checked=false);this.selection++;this.problem='';this.changed();
  try{
   const params=new URLSearchParams({dataIds:groups.join(','),useNewVersion:String(enhanced)});
   const blob=await this.request(o,'GET','/workspace/'+this.nativeId+'/report/'+type+'?'+params,undefined,true);
   if(!(blob instanceof Blob))throw Error('Ungültige Berichtsdatei.');
   return {blob,current:()=>this.owns(o)};
  }catch(e){if(this.owns(o))this.problem=problem(e);return null;}
  finally{if(this.owns(o))this.changed();}
 }
 captureDeletion():{count:number;groups:string[];current:()=>boolean;confirm:()=>Promise<boolean>}|null{
  const o=this.owner;if(!o||!this.canWrite||this.busy||!this.selectedCount)return null;
  const revision=this.selection,groups=this.selectedGroups.map(row=>row.groupName),tests=this.selectedTests.map(row=>({
   loginName:row.loginName,code:row.code,nameSuffix:row.nameSuffix,bookletName:row.bookletName}));
  let consumed=false;const current=()=>this.owns(o)&&this.selection===revision&&!consumed;
  return {count:o.view==='results'?groups.length:tests.length,groups,current,confirm:async()=>{
   if(!current()||this.busy||!this.canWrite)return false;
   consumed=true;this.busy=true;this.problem='';this.notice='';this.changed();
   try{
    await this.request(o,'DELETE','/workspace/'+this.nativeId+'/responses'+(o.view==='tests'?'/detailed':''),o.view==='results'?{groups}:{personSessions:tests});
    this.clear();this.notice=o.view==='results'?'Löschen erfolgreich.':`${tests.length} Test-Session(s) erfolgreich gelöscht`;
    try{await this.load(o);}catch(e){if(this.owns(o))this.problem='Die Daten wurden gelöscht. Die Liste konnte nicht neu geladen werden.';}
    return this.owns(o);
   }catch(e){if(this.owns(o))this.problem=problem(e);return false;}
   finally{if(this.owns(o)){this.busy=false;this.changed();}}
  }};
 }
 destroy():void{this.destroyed=true;this.owner?.abort.abort();this.epoch++;this.clear();this.role='';this.nativeId='';this.busy=false;}
}
