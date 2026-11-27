import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
function load(name,bindings={}){
 const source=ts.createSourceFile(name,readFileSync(new URL('../apps/web/src/app/'+name,import.meta.url),'utf8'),ts.ScriptTarget.Latest,true);
 const text=source.statements.filter(s=>!ts.isImportDeclaration(s)).map(s=>s.getText(source)).join('\n'),exports={};
 new Function('exports',...Object.keys(bindings),ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports,...Object.values(bindings));return exports;
}
const {originalAdministrationId}=load('original-administration-wire.ts');
const {readOriginalGroupResultRows}=load('original-group-result-rows.ts');
const {OriginalWorkspaceResultsController:Controller}=load('original-workspace-results-controller.ts',{originalAdministrationId,readOriginalGroupResultRows});
const {createOriginalWorkspaceResultsTransport}=load('original-workspace-results-http.ts');
const source=JSON.parse(readFileSync(new URL('../test-fixtures/original-testcenter/source-workspace-results/native-test-administration-http/observations.json',import.meta.url)));
const sessions=source.rows.find(row=>row.label==='exact-group-and-numeric-test-order').value;
const row=(name='A')=>({groupName:name,groupLabel:'Gruppe '+name,bookletsStarted:3,numUnitsMin:0,numUnitsMax:2,numUnitsTotal:3,numUnitsAvg:1,lastChange:1793520000});
test('group result snapshots reject an unrenderable date',()=>{
 const valid=row();assert.deepEqual(readOriginalGroupResultRows([valid]),[valid]);
 assert.throws(()=>readOriginalGroupResultRows([{...valid,lastChange:1e20}]),/Ungültige Ergebnisgruppe/);
});
const held=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
function fixture(handler,view='results',role='RW'){
 let scope={token:'owned-session',tenantKey:'tenant/a',workspaceKey:'same Ω',view};const calls=[];
 const c=new Controller(async(method,path,body,token,signal,csv)=>{
  const call={method,path,body,token,signal,csv};calls.push(call);
  if(path.endsWith('/original-administration'))return {workspaceId:'9007199254740993',role};
  return handler?handler(call):view==='results'?[row(),row('B')]:sessions;
 },()=>scope,()=>{});
 return {c,calls,setScope:value=>scope={...scope,...value}};
}
test('canonical scope bridge preserves exact native int64 and never maps labels or UUIDs',async()=>{
 const f=fixture();await f.c.connect();assert.equal(f.calls[0].path,'/api/v1/tenants/tenant%2Fa/workspaces/same%20%CE%A9/original-administration');
 assert.equal(f.calls[1].path,'/workspace/9007199254740993/results');assert.equal(f.c.rows.length,2);assert.equal(f.c.selectedCount,0);
 assert.equal(f.c.rows[0].lastChange,1793520000);assert.equal(f.c.canWrite,true);
});
test('actual Source116 grouped tests preserve all four deletion identity fields and order',async()=>{
 const f=fixture(undefined,'tests');await f.c.connect();assert.deepEqual(f.c.groups.map(g=>g.name),Object.keys(sessions));
 for(const g of f.c.groups)assert.deepEqual(g.rows.map(({checked,...r})=>r),sessions[g.name]);
 const g=f.c.groups[0];f.c.checkAll(true,g.name);assert.equal(f.c.all(g.name),true);assert.equal(f.c.some(f.c.groups[1].name),false);
 const expected=g.rows.map(({loginName,code,nameSuffix,bookletName})=>({loginName,code,nameSuffix,bookletName}));
 const deletion=f.c.captureDeletion();assert.equal(deletion.count,expected.length);assert.equal(await deletion.confirm(),'deleted');
 const request=f.calls.find(c=>c.method==='DELETE');assert.equal(request.path,'/workspace/9007199254740993/responses/detailed');assert.deepEqual(request.body,{personSessions:expected});
 assert.equal(await deletion.confirm(),'stale','One dialog cannot issue the acknowledged deletion twice.');
});
for(const [type,enhanced]of [['response',false],['log',false],['review',false],['review',true]])test(type+' '+enhanced+' keeps exact selected native CSV bytes',async()=>{
 const bytes=Buffer.from('\ufeffA;B\r\n"Ω";"x;\ny"\r\n');
 const f=fixture(call=>call.csv?new Blob([bytes]):[row(),row('B')]);await f.c.connect();f.c.check(f.c.rows[1],true);
 const result=await f.c.download(type,enhanced);assert.ok(result.current());assert.deepEqual(Buffer.from(await result.blob.arrayBuffer()),bytes);
 const call=f.calls.at(-1),url=new URL(call.path,'http://owned');assert.equal(url.searchParams.get('dataIds'),'B');assert.equal(url.searchParams.get('useNewVersion'),String(enhanced));
 assert.equal(f.c.selectedCount,0);assert.equal(f.c.busy,false);
});
for(const change of ['token','workspaceKey','tenantKey','view','destroy'])test('held report cannot escape after '+change,async()=>{
 const gate=held(),f=fixture(call=>call.csv?gate.promise:[row()]);await f.c.connect();f.c.check(f.c.rows[0],true);
 const work=f.c.download('response');if(change==='destroy')f.c.destroy();else f.setScope({[change]:'other'});
 gate.resolve(new Blob(['private']));assert.equal(await work,null);
});
for(const change of ['token','workspaceKey','tenantKey','view','selection','destroy'])test('captured destructive selection is inert after '+change,async()=>{
 const f=fixture();await f.c.connect();f.c.check(f.c.rows[0],true);const action=f.c.captureDeletion();
 if(change==='destroy')f.c.destroy();else if(change==='selection')f.c.check(f.c.rows[1],true);else f.setScope({[change]:'other'});
 assert.equal(action.current(),false);assert.equal(await action.confirm(),'stale');assert.equal(f.calls.some(c=>c.method==='DELETE'),false);
});
test('late previous scope list cannot replace a new native view',async()=>{
 const gate=held();let first=true;const f=fixture(call=>{if(first){first=false;return gate.promise;}return [row('new')];});
 const old=f.c.connect();await new Promise(done=>setImmediate(done));f.setScope({workspaceKey:'next'});await f.c.connect();gate.resolve([row('old')]);await old;
 assert.deepEqual(f.c.rows.map(r=>r.groupName),['new']);assert.equal(f.calls[1].signal.aborted,true);
});
test('read-only permits selected CSV but never captures a deletion; empty selection never widens',async()=>{
 const f=fixture(undefined,'results','RO');await f.c.connect();assert.equal(f.c.captureDeletion(),null);assert.equal(await f.c.download('log'),null);
 f.c.checkAll(true);assert.equal(f.c.canWrite,false);assert.equal(f.c.captureDeletion(),null);
 assert.equal(f.calls.some(c=>c.method==='DELETE'||c.csv),false);
});
test('a failed refresh after acknowledged deletion preserves success and cannot repeat the write',async()=>{
 let deleted=false;const f=fixture(call=>{if(call.method==='DELETE'){deleted=true;return;}if(deleted)throw Error('owned list offline');return [row()];});
 await f.c.connect();f.c.checkAll(true);const action=f.c.captureDeletion();assert.equal(await action.confirm(),'deleted');
 assert.equal(f.c.notice,'Löschen erfolgreich.');assert.match(f.c.problem,/wurden gelöscht/);assert.equal(f.c.selectedCount,0);assert.equal(f.c.canWrite,false);
 assert.equal(await action.confirm(),'stale');assert.equal(f.calls.filter(c=>c.method==='DELETE').length,1);
});
test('failed deletion retains the selected rows for a fresh reviewed retry',async()=>{
 const f=fixture(call=>{if(call.method==='DELETE')throw Error('owned denied');return [row()];});await f.c.connect();f.c.checkAll(true);
 assert.equal(await f.c.captureDeletion().confirm(),'failed');assert.equal(f.c.selectedCount,1);assert.equal(f.c.problem,'owned denied');assert.ok(f.c.captureDeletion());
});
test('a refused Test deletion keeps selection and leaves the list error clear',async()=>{
 const f=fixture(call=>{if(call.method==='DELETE')throw Error('owned denial');return sessions;},'tests');
 await f.c.connect();
 f.c.check(f.c.groups[0].rows[0],true);
 const action=f.c.captureDeletion();
 assert.equal(await action.confirm(),'failed');
 assert.equal(f.c.problem,'');
 assert.equal(f.c.selectedCount,1);
 assert.equal(await action.confirm(),'stale');
 assert.ok(f.c.captureDeletion());
});
test('a late Test deletion failure cannot announce itself in a newly opened view',async()=>{
 const pending=held();
 const f=fixture(call=>call.method==='DELETE'?pending.promise:sessions,'tests');
 await f.c.connect();
 f.c.check(f.c.groups[0].rows[0],true);
 const former=f.c.captureDeletion().confirm();
 f.setScope({workspaceKey:'another'});
 await f.c.connect();
 pending.reject(Error('owned retired request'));
 assert.equal(await former,'stale');
 assert.equal(f.c.problem,'');
 assert.equal(f.c.selectedCount,0);
});
for(const reloadFails of [false,true])test('Test deletion keeps the disabled panels mounted until refresh '+(reloadFails?'fails':'completes'),async()=>{
 const pending=held(),refreshStarted=held();let acknowledged=false;
 const f=fixture(call=>{
  if(call.method==='DELETE'){acknowledged=true;return;}
  if(!acknowledged)return sessions;
  refreshStarted.resolve();return pending.promise;
 },'tests');
 await f.c.connect();
 f.c.check(f.c.groups[0].rows[0],true);
 const group=f.c.groups[0];
 const result=f.c.captureDeletion().confirm();
 await refreshStarted.promise;
 assert.equal(f.c.busy,true);
 assert.equal(f.c.groups[0],group);
 assert.equal(f.c.loaded,true);
 assert.equal(f.c.captureDeletion(),null);
 if(reloadFails)pending.reject(Error('owned refresh failure'));
 else pending.resolve([]);
 assert.equal(await result,'deleted');
 assert.deepEqual(f.c.groups,[]);
 assert.equal(f.c.selectedCount,0);
 assert.equal(f.c.loaded,!reloadFails);
 assert.equal(f.c.notice,'1 Test-Session(s) erfolgreich gelöscht');
 assert.equal(f.c.problem,reloadFails?'Die Daten wurden gelöscht. Die Liste konnte nicht neu geladen werden.':'');
});
test('prototype-looking and contiguous numeric PHP group keys remain data',async()=>{
 const example=Object.values(sessions)[0][0];
 for(const data of [JSON.parse('{"__proto__":[],"constructor":[]}'),[[{...example,groupName:'0'}]]]){
  if(Object.hasOwn(data,'__proto__'))data.__proto__.push({...example,groupName:'__proto__'});
  const f=fixture(()=>data,'tests');await f.c.connect();assert.equal(f.c.problem,'');assert.equal(f.c.groups.length,1);
  f.c.checkAll(true,f.c.groups[0].name);assert.equal(f.c.selectedCount,1);
 }
});
for(const context of [{workspaceId:9007199254740992,role:'RW'},{workspaceId:'9223372036854775808',role:'RW'},{workspaceId:'1',role:'OTHER'}])test('invalid native context fails closed '+JSON.stringify(context),async()=>{
 let calls=0;const c=new Controller(async()=>{calls++;return context;},()=>({token:'owned',tenantKey:'t',workspaceKey:'w',view:'results'}),()=>{});
 await c.connect();assert.equal(calls,1);assert.equal(c.canWrite,false);assert.ok(c.problem);
});
test('native transport uses owned AuthToken, no-store, omitted credentials, CSV bytes and abort signal',async()=>{
 let captured;const bytes=Buffer.from([0xef,0xbb,0xbf,0x41,0x3b,0x0a]);
 const transport=createOriginalWorkspaceResultsTransport(async(path,init)=>{captured={path,init};return new Response(bytes,{headers:{'content-type':'text/csv'}});});
 const abort=new AbortController(),blob=await transport('GET','/workspace/9007199254740993/report/log?dataIds=A',undefined,'owned',abort.signal,true);
 assert.deepEqual(Buffer.from(await blob.arrayBuffer()),bytes);assert.equal(captured.init.headers.AuthToken,'owned');assert.equal(captured.init.headers.Accept,'text/csv');
 assert.equal(captured.init.credentials,'omit');assert.equal(captured.init.cache,'no-store');assert.equal(captured.init.redirect,'error');
 await assert.rejects(transport('DELETE','/workspace/1/results',{},'owned',abort.signal));abort.abort();await assert.rejects(transport('GET','/workspace/1/results',undefined,'owned',abort.signal));
});
test('Source immediate CSV selection clearing preserves a new selection across an older reply',async()=>{
 const gate=held(),f=fixture(call=>call.csv?gate.promise:[row(),row('B')]);await f.c.connect();f.c.check(f.c.rows[0],true);
 const work=f.c.download('response');assert.equal(f.c.selectedCount,0);assert.equal(f.c.busy,false);
 f.c.check(f.c.rows[1],true);assert.deepEqual(f.c.selectedGroups.map(r=>r.groupName),['B']);
 gate.resolve(new Blob(['owned A']));assert.ok((await work).current());assert.deepEqual(f.c.selectedGroups.map(r=>r.groupName),['B']);
});
test('native Results reports and deletion keep the order of group selection',async()=>{
 const f=fixture(call=>call.csv?new Blob(['owned data']):[row(),row('B'),row('C')]);
 await f.c.connect();
 const [alpha,beta,gamma]=f.c.rows;
 f.c.check(beta,true);
 f.c.checkAll(true);
 assert.deepEqual(f.c.selectedGroups,[beta,alpha,gamma]);
 f.c.check(beta,false);
 f.c.check(beta,true);
 assert.deepEqual(f.c.captureDeletion().groups,['A','C','B']);
 assert.ok(await f.c.download('review',true));
 const query=new URL(f.calls.at(-1).path,'http://owned').searchParams;
 assert.equal(query.get('dataIds'),'A,C,B');
 assert.equal(query.get('useNewVersion'),'true');
 assert.ok(f.c.rows.every(row=>!row.checked));
 assert.deepEqual(f.c.selectedGroups,[]);
});
test('one Original Test sort applies to every group and survives deletion refresh and workspace changes',async()=>{
 const f=fixture(call=>call.path.endsWith('/results')?[row()]:sessions,'tests');await f.c.connect();
 const expected=Object.entries(sessions).map(([name,rows])=>({name,rows:[...rows].sort((a,b)=>b.loginName.localeCompare(a.loginName))}));
 f.c.setTestSort('login','desc');assert.deepEqual(f.c.groups.map(g=>({name:g.name,rows:g.rows.map(({checked,...r})=>r)})),expected);
 const group=f.c.groups[0];f.c.check(group.rows[0],true);const selected=group.rows[0];
 f.c.setTestSort('booklet','asc');assert.equal(f.c.selectedTests[0],selected,'Sorting retains the exact selected row.');
 f.c.setTestSort('login','desc');assert.equal(await f.c.captureDeletion().confirm(),'deleted');
 assert.deepEqual(f.c.groups.map(g=>({name:g.name,rows:g.rows.map(({checked,...r})=>r)})),expected,'Source reapplies the last sort after deletion refresh.');
 f.setScope({workspaceKey:'new'});await f.c.connect();assert.deepEqual(f.c.groups.map(g=>g.rows.map(r=>r.loginName)),expected.map(g=>g.rows.map(r=>r.loginName)));
 f.setScope({view:'results'});await f.c.connect();f.setScope({view:'tests'});await f.c.connect();
 assert.deepEqual(f.c.groups.map(g=>g.rows.map(({checked,...r})=>r)),Object.values(sessions),'Leaving and reopening the Tests tab starts with native order.');
});
