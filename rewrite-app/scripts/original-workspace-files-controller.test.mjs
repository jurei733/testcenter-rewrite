import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import {productionApiRoutes,resolveRoutePath} from '@testcenter-rewrite-app/contracts';
const source=ts.createSourceFile('controller.ts',readFileSync(new URL('../apps/web/src/app/original-workspace-files-controller.ts',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true);
const code=source.statements.filter(node=>!ts.isImportDeclaration(node)).map(node=>node.getText(source)).join('\n'),exports={};
new Function('exports','productionApiRoutes','resolveRoutePath',ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText)(exports,productionApiRoutes,resolveRoutePath);
const Controller=exports.OriginalWorkspaceFilesController;
const pending=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const file=(id='UNIT',name='Unit/owned.xml',type='Unit',dependencies=[])=>({sourcePackageId:id,fileName:name,fileType:type,
 status:'accepted',uploadedAt:'2026-10-22T13:00:00Z',fileSizeBytes:12,totalSizeBytes:12,
 metadata:{identifier:id,label:id,description:'',participantCount:null,veronaVersion:null,moduleVersion:null},dependencies,unresolvedReferences:[]});
const overview=(key='a')=>({workspaceOverview:{tenant:{tenantId:'tenant-'+key,tenantKey:key},workspace:{tenantId:'tenant-'+key,workspaceId:'workspace-'+key,workspaceKey:key,displayName:'Owned '+key}}});
const role=(key='a',accessMode='read_write')=>({role:'workspace_admin',tenantId:'tenant-'+key,workspaceId:'workspace-'+key,accessMode});
const scope=(key='a',token='owned-token',roles=[role(key)])=>({tenantKey:key,workspaceKey:key,token,roles});
const emptyReport=()=>({requestedCount:0,deleted:[],didNotExist:[],notAllowed:[],wasUsed:[],errors:[]});
const fixture=(handler,initial=scope())=>{
 let current=initial;const calls=[],changes=[];
 const controller=new Controller(async(method,path,body,token)=>{const call={method,path,body,token};calls.push(call);return handler(call);},()=>current,()=>changes.push(true));
 return {controller,calls,changes,setScope:value=>{current=value;}};
};
const normal=(call,rows=[file()])=>call.path.endsWith('/files')?{items:rows,totalCount:rows.length,dependencySizesCalculated:true}:overview();
test('resolved workspace UUIDs determine write access; readonly, foreign grants and monitors cannot upload or delete',async()=>{
 for(const roles of [[role('a','read_only')],[role('b')],[{role:'study_monitor'}],[]]){
  const f=fixture(call=>normal(call),scope('a','owned-token',roles));await f.controller.connect();
  assert.equal(f.controller.canWrite,false);f.controller.checkAll('Unit',true);assert.equal(f.controller.selected.length,1);
  assert.equal(f.controller.captureDeletion(),null);
  await f.controller.upload([{name:'private.xml',type:'application/xml',read:()=>{throw Error('Readonly must not even read private bytes.');}}]);
  assert.equal(f.calls.filter(call=>call.method==='POST').length,0);
 }
});
for(const roles of [[role()],[{role:'tenant_admin',tenantId:'tenant-a'}],[{role:'platform_admin'}]])test('verified role permits file writes: '+roles[0].role,async()=>{
 const f=fixture(call=>normal(call),scope('a','owned-token',roles));await f.controller.connect();assert.equal(f.controller.canWrite,true);
});
test('late catalog/overview responses cannot populate another workspace or another login',async()=>{
 for(const replacement of [scope('b'),scope('a','replacement-token')]){
  const held=pending();let count=0;
  const f=fixture(call=>++count<=2?held.promise:call.path.endsWith('/files')?{items:[file('NEW')]}:overview(replacement.workspaceKey));
  const old=f.controller.connect();f.setScope(replacement);await f.controller.connect();
  held.resolve({items:[file('PRIVATE-OLD')],...overview()});await old;
  assert.deepEqual(f.controller.files.map(file=>file.sourcePackageId),['NEW']);assert.equal(f.controller.problem,'');assert.equal(f.controller.busy,false);
 }
});
test('a response for mismatched tenant/workspace keys fails before exposing its rows or enabling writes',async()=>{
 const f=fixture(call=>call.path.endsWith('/files')?{items:[file('FOREIGN')]}:overview('b'));await f.controller.connect();
 assert.deepEqual(f.controller.files,[]);assert.equal(f.controller.overview,null);assert.equal(f.controller.canWrite,false);assert.ok(f.controller.problem);
});
test('logout during a held file read prevents that upload, all following reads and late owner state changes',async()=>{
 const f=fixture(call=>normal(call));await f.controller.connect();const held=pending();let reads=0;
 const uploading=f.controller.upload([{name:'private.xml',type:'application/xml',read:()=>{reads++;return held.promise;}},
  {name:'next.xml',type:'application/xml',read:()=>{reads++;return Promise.resolve('next');}}]);
 f.setScope(scope('a',''));await f.controller.connect();held.resolve('PRIVATE-BYTES');await uploading;
 assert.equal(reads,1);assert.equal(f.calls.filter(call=>call.method==='POST').length,0);assert.deepEqual(f.controller.uploads,[]);
 assert.equal(f.controller.busy,false);assert.equal(f.controller.problem,'');assert.deepEqual(f.controller.files,[]);
});
test('permission loss during reading prevents writing the already captured bytes',async()=>{
 const f=fixture(call=>normal(call));await f.controller.connect();const held=pending();
 const uploading=f.controller.upload([{name:'private.xml',type:'application/xml',read:()=>held.promise}]);
 f.setScope(scope('a','owned-token',[role('a','read_only')]));held.resolve('PRIVATE-BYTES');await uploading;
 assert.equal(f.calls.filter(call=>call.method==='POST').length,0);assert.equal(f.controller.busy,false);
 assert.equal(f.controller.uploads[0].status,'error');assert.match(f.controller.uploads[0].message,/Berechtigung/);
});
test('upload preserves exact bytes/name, reports each failure, continues and refreshes only its owned scope',async()=>{
 const bytes='data:application/xml;base64,//48AFUAbgBpAHQALwA+AA==';let posts=0;
 const f=fixture(call=>{
  if(call.method==='POST'){
   if(++posts===1)throw Error('Invalid owned XML.');
   assert.deepEqual(call.body,{fileName:'  authored.xml',mediaType:'application/xml',sourceDocument:bytes});
   return {sourcePackage:file(),replacedSourcePackageId:'previous',importJob:null,stagedContentRelease:null};
  }
  return normal(call);
 });await f.controller.connect();await f.controller.upload([
  {name:'bad.xml',type:'application/xml',read:async()=>'<invalid'},
  {name:'  authored.xml',type:'application/xml',read:async()=>bytes}]);
 assert.deepEqual(f.controller.uploads.map(row=>row.status),['error','completed']);assert.equal(f.controller.uploads[1].message,'Datei aktualisiert.');
 assert.equal(posts,2);assert.equal(f.calls.length,6);assert.equal(f.controller.problem,'');
 assert.ok(f.calls.every(call=>call.token==='owned-token'));f.controller.clearUploads();assert.deepEqual(f.controller.uploads,[]);
});
test('failed real import is an upload error rather than a success report',async()=>{
 const f=fixture(call=>call.method==='POST'?{importJob:{status:'failed'},replacedSourcePackageId:null}:normal(call));
 await f.controller.connect();await f.controller.upload([{name:'bad.xml',type:'application/xml',read:async()=>'<bad/>'}]);
 assert.equal(f.controller.uploads[0].status,'error');assert.equal(f.controller.uploads[0].message,'Import fehlgeschlagen.');
});
test('selection, reverse dependency highlighting and sort retain source-package identities despite identical basenames',async()=>{
 const rows=[file('UNIT','Unit/shared.xml'),file('BOOK','Booklet/shared.xml','Booklet',[{sourcePackageId:'UNIT',fileName:'Unit/shared.xml',relationship:'containsUnit'}]),
  file('UNRELATED','Booklet/unrelated.xml','Booklet',[{sourcePackageId:'OTHER',fileName:'Unit/shared.xml',relationship:'containsUnit'}])];
 const f=fixture(call=>normal(call,rows));await f.controller.connect();const unit=f.controller.files.find(file=>file.sourcePackageId==='UNIT');
 assert.equal(unit.name,'shared.xml');f.controller.selectRow(unit);assert.deepEqual(f.controller.dependencyRowIds,['BOOK']);
 f.controller.checkAll('Booklet',true);assert.deepEqual(f.controller.selected.map(file=>file.sourcePackageId).sort(),['BOOK','UNRELATED']);
 f.controller.setSort('name','desc');assert.deepEqual(f.controller.selected.map(file=>file.sourcePackageId).sort(),['BOOK','UNRELATED']);
 f.controller.check({...unit},true);assert.equal(unit.isChecked,false,'A retained foreign row must not select a current file.');
 f.controller.selectRow(unit);assert.deepEqual(f.controller.dependencyRowIds,[]);
});
test('confirmation captures exact original IDs/filenames, retains partial outcomes and is single-use',async()=>{
 const rows=[file(),file('RESOURCE','Resource/raw.txt','Resource')];let posted;
 const report={...emptyReport(),requestedCount:1,wasUsed:[{sourcePackageId:'UNIT',fileName:'Unit/owned.xml'}]};
 const f=fixture(call=>{if(call.method==='POST'){posted=call.body;return {report};}return normal(call,rows);});
 await f.controller.connect();f.controller.checkAll('Unit',true);const captured=f.controller.captureDeletion();
 f.controller.checkAll('Unit',false);f.controller.checkAll('Resource',true);
 assert.equal(await captured.confirm(),true);assert.deepEqual(posted,{items:[{sourcePackageId:'UNIT',confirmation:'Unit/owned.xml'}]});
 assert.equal(await captured.confirm(),false);assert.equal(f.calls.filter(call=>call.method==='POST').length,1);
 assert.deepEqual(f.controller.deletionReport,report);assert.match(f.controller.notice,/werden von anderen verwendet/);
});
test('old confirmation and download ownership are invalid after workspace change, logout or destruction',async()=>{
 for(const transition of ['scope','logout','destroy']){
  const f=fixture(call=>normal(call));await f.controller.connect();f.controller.checkAll('Unit',true);
  const deletion=f.controller.captureDeletion(),download=f.controller.captureDownload(f.controller.files[0]);assert.ok(download.current());
  if(transition==='destroy')f.controller.destroy();else{f.setScope(transition==='scope'?scope('b'):scope('a',''));await f.controller.connect();}
  assert.equal(download.current(),false);assert.equal(await deletion.confirm(),false);assert.equal(f.calls.filter(call=>call.method==='POST').length,0);
  assert.deepEqual(f.controller.uploads,[]);assert.deepEqual(f.controller.selected,[]);
 }
});

test('actual structured API diagnostics reach the upload report as text',async()=>{
 const f=fixture(call=>{if(call.method==='POST')throw {error:'workspace_file_validation_failed',message:'XML rejected.',details:{diagnostics:[
  {severity:'warning',message:'warning'}, {severity:'error',message:'Original Testcenter SysCheck requires an XSD reference.'}]}};
  return normal(call);});
 await f.controller.connect();await f.controller.upload([{name:'bad.xml',type:'application/xml',read:async()=>'<SysCheck/>'}]);
 assert.equal(f.controller.uploads[0].status,'error');assert.equal(f.controller.uploads[0].message,'Original Testcenter SysCheck requires an XSD reference.');
});
