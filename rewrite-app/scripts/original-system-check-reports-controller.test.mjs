import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import {productionApiRoutes,resolveRoutePath} from '@testcenter-rewrite-app/contracts';
const source=ts.createSourceFile('controller.ts',readFileSync(new URL('../apps/web/src/app/original-system-check-reports-controller.ts',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true);
const code=source.statements.filter(node=>!ts.isImportDeclaration(node)).map(node=>node.getText(source)).join('\n'),exports={};
new Function('exports','productionApiRoutes','resolveRoutePath',ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText)(exports,productionApiRoutes,resolveRoutePath);
const Controller=exports.OriginalSystemCheckReportsController;
const held=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const role=(key='a',accessMode='read_write')=>({role:'workspace_admin',tenantId:'tenant-'+key,workspaceId:'workspace-'+key,accessMode});
const scope=(key='a',token='owned-token',roles=[role(key)])=>({token,tenantKey:key,workspaceKey:key,roles});
const overview=(key='a')=>({workspaceOverview:{tenant:{tenantKey:key,tenantId:'tenant-'+key},workspace:{workspaceKey:key,workspaceId:'workspace-'+key,tenantId:'tenant-'+key}}});
const row=(id='CHECK.A')=>({checkId:id,checkLabel:'Owned '+id,reportCount:501,latestReportAt:'2026-10-23T12:00:00Z',
 operatingSystems:[{value:'Linux',count:501}],browsers:[{value:'Chromium',count:501}],
 operatingSystemVersions:[{value:'Linux 6',count:501}],browserVersions:[{value:'Chromium 130',count:501}],overallRatings:[]});
const normal=(call,rows=[row()],key='a')=>call.path.endsWith('/statistics')?{items:rows}:overview(key);
const fixture=(handler=normal,initial=scope())=>{
 let current=initial;const calls=[];
 const controller=new Controller(async(method,path,body,token)=>{const call={method,path,body,token};calls.push(call);return handler(call);},()=>current,()=>{});
 return {controller,calls,setScope:value=>{current=value;}};
};

test('native overview loads complete statistics rather than a report page and does not select automatically',async()=>{
 const f=fixture();await f.controller.connect();assert.equal(f.controller.rows[0].reportCount,501);
 assert.equal(f.controller.rows[0].operatingSystemVersions[0].value,'Linux 6');assert.equal(f.controller.selected.size,0);
 assert.equal(f.controller.allSelected,false);assert.equal(f.controller.busy,false);assert.equal(f.controller.problem,'');
 assert.ok(f.calls.every(call=>call.method==='GET' && call.token==='owned-token'));
 assert.ok(f.calls.every(call=>!call.path.includes('limit=')));assert.equal(f.calls.length,2);
});
test('a read-only reader captures Source confirmation; authoritative 403 preserves rows and selection for export',async()=>{
 const f=fixture(call=>{if(call.method==='DELETE')throw {statusCode:403,message:'Protected read-only denial.'};return normal(call);},scope('a','owned-token',[role('a','read_only')]));
 await f.controller.connect();f.controller.checkAll();const rows=f.controller.rows;
 const confirmation=f.controller.captureDeletion();assert.ok(confirmation);
 assert.equal(await confirmation.confirm(),false);assert.equal(await confirmation.confirm(),false);
 assert.equal(f.calls.filter(call=>call.method==='DELETE').length,1);
 assert.deepEqual(f.calls.find(call=>call.method==='DELETE').body,{checkIds:['CHECK.A'],confirmation:'a'});
 assert.equal(f.controller.rows,rows);assert.equal(f.controller.selected.size,1);assert.equal(f.controller.busy,false);
 assert.equal(f.controller.problem,'Protected read-only denial.');assert.equal(f.controller.notice,'');assert.equal(f.calls.length,3,'A rejected request must not clear/refetch the unchanged table.');
 const result=await f.controller.download(async()=>new Blob(['owned']));assert.equal(await result.blob.text(),'owned');assert.equal(f.controller.selected.size,0);
});
test('cached role metadata cannot replace an authoritative server refusal',async()=>{
 for(const roles of [[role()],[{role:'tenant_admin',tenantId:'tenant-a'}],[{role:'platform_admin'}]]){
  const f=fixture(call=>{if(call.method==='DELETE')throw {statusCode:403,message:'Grant was revoked at the server.'};return normal(call);},scope('a','owned-token',roles));
  await f.controller.connect();f.controller.checkAll();assert.equal(await f.controller.captureDeletion().confirm(),false);
  assert.equal(f.calls.filter(call=>call.method==='DELETE').length,1);assert.equal(f.controller.rows.length,1);
  assert.equal(f.controller.selected.size,1);assert.equal(f.controller.problem,'Grant was revoked at the server.');
 }
});
test('workspace change and replacement login reject late overview/statistics without mixing owners',async()=>{
 for(const replacement of [scope('b'),scope('a','replacement')]){
  const wait=held();let count=0;
  const f=fixture(call=>++count<=2?wait.promise:normal(call,[row('NEW')],replacement.workspaceKey));
  const pending=f.controller.connect();f.setScope(replacement);await f.controller.connect();
  wait.resolve({items:[row('OLD')],...overview()});await pending;
  assert.deepEqual(f.controller.rows.map(row=>row.checkId),['NEW']);assert.equal(f.controller.busy,false);
  assert.equal(f.controller.problem,'');assert.equal(f.controller.selected.size,0);
 }
});
test('a mismatched resolved workspace never exposes report rows or allows a confirmation',async()=>{
 const f=fixture(call=>normal(call,[row('FOREIGN')],'b'));await f.controller.connect();
 assert.deepEqual(f.controller.rows,[]);assert.equal(f.controller.overview,null);assert.equal(f.controller.captureDeletion(),null);assert.ok(f.controller.problem);
});
test('individual/master selection uses current check IDs and an empty selection cannot broaden a download',async()=>{
 const f=fixture(call=>normal(call,[row('A'),row('B')]));await f.controller.connect();
 f.controller.check('FOREIGN',true);assert.equal(f.controller.selected.size,0);
 assert.equal(await f.controller.download(()=>{throw Error('No empty export request permitted.');}),null);
 f.controller.check('A',true);assert.equal(f.controller.allSelected,false);f.controller.checkAll();assert.equal(f.controller.allSelected,true);
 f.controller.checkAll();assert.equal(f.controller.selected.size,0);f.controller.check('B',true);f.controller.check('B',false);
 assert.equal(f.controller.selected.size,0);
});
test('CSV download binds every selected ID with unambiguous repeated query parameters and exact owner token',async()=>{
 const ids=['A & B','unicode Ω/2'];const f=fixture(call=>normal(call,ids.map(row)));await f.controller.connect();f.controller.checkAll();
 const bytes=new Uint8Array([239,187,191,34,195,150,34,13,10]);let seen;
 const result=await f.controller.download(async(path,token)=>{seen={path,token};assert.equal(f.controller.busy,true);f.controller.checkAll();return new Blob([bytes]);});
 assert.deepEqual(new URL('http://owned'+seen.path).searchParams.getAll('checkId'),ids);assert.equal(seen.token,'owned-token');
 assert.equal(new URL('http://owned'+seen.path).searchParams.has('limit'),false);
 assert.deepEqual(new Uint8Array(await result.blob.arrayBuffer()),bytes);assert.equal(result.current(),true);assert.equal(f.controller.selected.size,0);
 f.setScope(scope('b'));assert.equal(result.current(),false,'A returned blob must still be checked before a browser download.');
});
test('a failed download retains its selection for a real retry',async()=>{
 const f=fixture();await f.controller.connect();f.controller.checkAll();
 assert.equal(await f.controller.download(async()=>{throw {message:'Protected download failed.'};}),null);
 assert.equal(f.controller.problem,'Protected download failed.');assert.equal(f.controller.selected.size,1);assert.equal(f.controller.busy,false);
 assert.ok(await f.controller.download(async()=>new Blob(['success'])));assert.equal(f.controller.problem,'');assert.equal(f.controller.selected.size,0);
});
test('logout/destruction/workspace change during held download cannot release private bytes or mutate the new scope',async()=>{
 for(const transition of ['logout','workspace','destroy']){
  const f=fixture();await f.controller.connect();f.controller.checkAll();const wait=held();
  const downloading=f.controller.download(()=>wait.promise);
  if(transition==='destroy')f.controller.destroy();else{f.setScope(transition==='logout'?scope('a',''):scope('b'));if(transition==='logout')await f.controller.connect();}
  wait.resolve(new Blob(['private']));assert.equal(await downloading,null);assert.equal(f.controller.problem,'');
 }
});
test('delete confirmation is immutable and single-use even when selection changes or caller mutates its copy',async()=>{
 let body;const f=fixture(call=>call.method==='DELETE'?(body=call.body,{deletion:{deletedCount:3}}):normal(call,[row('A'),row('B')]));
 await f.controller.connect();f.controller.check('A',true);const deletion=f.controller.captureDeletion();
 deletion.ids.push('FOREIGN');f.controller.check('A',false);f.controller.check('B',true);
 assert.equal(await deletion.confirm(),true);assert.deepEqual(body,{checkIds:['A'],confirmation:'a'});
 assert.equal(await deletion.confirm(),false);assert.equal(f.calls.filter(call=>call.method==='DELETE').length,1);
 assert.equal(f.controller.notice,'3 Berichte erfolgreich gelöscht.');assert.equal(f.controller.selected.size,0);
});
test('old confirmation cannot send a deletion after logout, scope replacement or destruction',async()=>{
 for(const transition of ['logout','workspace','destroy']){
  const f=fixture();await f.controller.connect();f.controller.checkAll();const captured=f.controller.captureDeletion();
  if(transition==='destroy')f.controller.destroy();else f.setScope(transition==='logout'?scope('a',''):scope('b'));
  assert.equal(await captured.confirm(),false);assert.equal(f.calls.filter(call=>call.method==='DELETE').length,0);
 }
});
test('more than 100 selected Checks delete in exact bounded batches and then reload actual statistics',async()=>{
 const ids=Array.from({length:205},(_,i)=>'CHECK.'+i);let deleted=false;
 const f=fixture(call=>{if(call.method==='DELETE'){if(call.body.checkIds.at(-1)===ids.at(-1))deleted=true;return {deletion:{deletedCount:call.body.checkIds.length}};}return normal(call,deleted?[]:ids.map(row));});
 await f.controller.connect();f.controller.checkAll();assert.equal(await f.controller.captureDeletion().confirm(),true);
 const writes=f.calls.filter(call=>call.method==='DELETE');assert.deepEqual(writes.map(call=>call.body.checkIds.length),[100,100,5]);
 assert.deepEqual(writes.flatMap(call=>call.body.checkIds),ids);assert.ok(writes.every(call=>call.body.confirmation==='a' && call.token==='owned-token'));
 assert.deepEqual(f.controller.rows,[]);assert.equal(f.controller.notice,'205 Berichte erfolgreich gelöscht.');
});
test('a later deletion failure stops remaining batches, preserves confirmed successes and refreshes actual server state',async()=>{
 const rows=Array.from({length:205},(_,i)=>row('CHECK.'+i));let writes=0;
 const f=fixture(call=>{if(call.method==='DELETE'){if(++writes===2)throw {message:'Second batch refused.'};return {deletion:{deletedCount:100}};}return normal(call,writes?rows.slice(100):rows);});
 await f.controller.connect();f.controller.checkAll();assert.equal(await f.controller.captureDeletion().confirm(),false);
 assert.equal(writes,2);assert.equal(f.controller.rows.length,105);assert.equal(f.controller.notice,'100 Berichte erfolgreich gelöscht.');
 assert.equal(f.controller.problem,'Second batch refused.');assert.equal(f.controller.busy,false);assert.equal(f.controller.selected.size,0);
});
test('an authoritative permission loss stops later batches, while a late response cannot contaminate another workspace',async()=>{
 for(const transition of ['permission','workspace']){
  const wait=held(),rows=Array.from({length:205},(_,i)=>row('CHECK.'+i));let attempts=0;
  const f=fixture(call=>{
   if(call.method==='DELETE'){if(++attempts===1)return wait.promise;throw {statusCode:403,message:'Protected revoked permission.'};}
   return normal(call,attempts?rows.slice(100):rows);
  });await f.controller.connect();f.controller.checkAll();
  const deleting=f.controller.captureDeletion().confirm();
  f.setScope(transition==='permission'?scope('a','owned-token',[role('a','read_only')]):scope('b'));
  if(transition==='workspace')f.controller.destroy();
  wait.resolve({deletion:{deletedCount:100}});assert.equal(await deleting,false);
  assert.equal(attempts,transition==='permission'?2:1);
  if(transition==='workspace'){assert.equal(f.controller.notice,'');assert.deepEqual(f.controller.rows,[]);}
  else{assert.equal(f.controller.notice,'100 Berichte erfolgreich gelöscht.');assert.equal(f.controller.problem,'Protected revoked permission.');assert.equal(f.controller.rows.length,105);assert.equal(f.controller.selected.size,0);}
 }
});
test('failed refresh after an accepted deletion cannot retain stale counts or a destructive selection',async()=>{
 let deleted=false;
 const f=fixture(call=>{
  if(call.method==='DELETE'){deleted=true;return {deletion:{deletedCount:501}};}
  if(deleted)throw {message:'Protected statistics refresh failed.'};return normal(call);
 });
 await f.controller.connect();f.controller.checkAll();assert.equal(await f.controller.captureDeletion().confirm(),true);
 assert.deepEqual(f.controller.rows,[]);assert.equal(f.controller.selected.size,0);assert.equal(f.controller.captureDeletion(),null);
 assert.equal(f.controller.notice,'501 Berichte erfolgreich gelöscht.');assert.equal(f.controller.problem,'Protected statistics refresh failed.');
 assert.equal(f.controller.busy,false);
});
test('an accepted zero-count batch still refreshes concurrent deletion results after a later refusal',async()=>{
 const rows=Array.from({length:205},(_,i)=>row('CHECK.'+i));let attempts=0;
 const f=fixture(call=>{
  if(call.method==='DELETE'){if(++attempts===1)return {deletion:{deletedCount:0}};throw {statusCode:403,message:'Permission revoked.'};}
  return normal(call,attempts?rows.slice(100):rows);
 });
 await f.controller.connect();f.controller.checkAll();assert.equal(await f.controller.captureDeletion().confirm(),false);
 assert.equal(attempts,2);assert.equal(f.controller.rows.length,105);assert.equal(f.controller.selected.size,0);
 assert.equal(f.controller.notice,'0 Berichte erfolgreich gelöscht.');assert.equal(f.controller.problem,'Permission revoked.');
});
