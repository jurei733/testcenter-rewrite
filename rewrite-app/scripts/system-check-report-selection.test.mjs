import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {Pool} from 'pg';
import {createFirstSliceServices} from '@testcenter-rewrite-app/application';
import {createInMemoryFirstSliceRepository} from '@testcenter-rewrite-app/memory-store';
import {createFileFirstSliceStorage} from '@testcenter-rewrite-app/file-store';
import {createSqliteFirstSliceStorage} from '@testcenter-rewrite-app/sqlite-store';
import {createPostgresFirstSliceStorage} from '@testcenter-rewrite-app/postgres-store';

const timestamp='2026-10-23T12:00:00.000Z';
const kinds=process.env.FIRST_SLICE_STORE==='postgres'?['postgres']:['memory','file','sqlite'];
for(const kind of kinds)test(kind+': selected Original Systemcheck exports retain every selected report without a list-page truncation',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'owned-syscheck-selection-'));
 const schema='owned_syscheck_selection_'+randomUUID().replaceAll('-','');
 const pg=kind==='postgres'?new URL(process.env.FIRST_SLICE_POSTGRES_URL):null;
 pg?.searchParams.set('options','-c search_path='+schema);
 let root,storage,repository,created=false;
 const open=async()=>{
  storage=kind==='memory'?storage??{repository:createInMemoryFirstSliceRepository(),shutdown:async()=>{}}:
   kind==='file'?await createFileFirstSliceStorage(join(directory,'owned.json')):
   kind==='sqlite'?await createSqliteFirstSliceStorage(join(directory,'owned.sqlite')):await createPostgresFirstSliceStorage(pg.toString());
  repository=storage.repository;
 };
 const services=()=>createFirstSliceServices({repository,now:()=>timestamp});
 try{
  if(pg){root=new Pool({connectionString:process.env.FIRST_SLICE_POSTGRES_URL});await root.query(`CREATE SCHEMA "${schema}"`);created=true;}
  await open();
  const tenant=await services().platform.createTenant({tenantKey:'owned-'+randomUUID(),displayName:'Owned report selection'});
  const workspace=await services().platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:'owned',displayName:'Owned'});
  const foreign=await services().platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:'foreign',displayName:'Foreign'});
  const scope={tenantKey:tenant.tenantKey,workspaceKey:'owned'};
  const reports=[];
  for(let index=0;index<506;index++){
   const checkId=index<501?'CHECK.A':index<504?'CHECK.B':'CHECK.C';
   const own=index!==505,workspaceId=own?workspace.workspaceId:foreign.workspaceId;
   const report={systemCheckReportId:randomUUID(),tenantId:tenant.tenantId,workspaceId,
    sourcePackageId:'owned-source-'+checkId,originalFileName:`report_${index}.json`,
    fileModifiedAt:new Date(Date.parse(timestamp)+index*1000).toISOString(),sourceDate:'23.10.2026 14:00',
    createdAt:new Date(Date.parse(timestamp)+index*1000).toISOString(),checkId:index===505?'CHECK.A':checkId,
    checkLabel:'Owned '+checkId,title:(own?'owned-title-':'foreign-private-title-')+index,
    responses:{text:'exact Ω\n"; value',flag:false,zero:0},
    environment:[{id:'os',type:'environment',label:'Betriebssystem',value:index%2?'Linux':'Windows',warning:false},
     {id:'browser',type:'environment',label:'Browser',value:'Chromium',warning:false},
     {id:'os-version',type:'environment',label:'Betriebssystemversion',value:index%2?'6':'10',warning:false},
     {id:'browser-version',type:'environment',label:'Browserversion',value:'130',warning:false}],
    network:[],unit:[],questionnaire:[{id:'owned',type:'string',label:own&&checkId!=='CHECK.C'?'Selected question Ω':'Private unselected column',
      value:own?'selected answer':'foreign-private-value',warning:false}]};
   if(index===504)report.environment=report.environment.map(entry=>({...entry,
    label:entry.label==='Betriebssystem' || entry.label==='Betriebssystemversion' || entry.label==='Browserversion'?'Other '+entry.label:entry.label}));
   await repository.saveWorkspaceActivityEvent({activityEventId:randomUUID(),tenantId:tenant.tenantId,workspaceId,
    eventType:'system_check_report_saved',actorId:null,subjectType:'system_check_report',subjectId:report.systemCheckReportId,
    occurredAt:report.createdAt,summary:'Owned report fixture',details:{report}});
   if(own)reports.push(report);
  }
  const snapshot=await repository.listWorkspaceActivityEventsByWorkspace(tenant.tenantId,workspace.workspaceId);
  const selected=()=>services().workspaceAdminRead;
  const json=async query=>JSON.parse(await selected().exportSystemCheckReportsJson({...scope,...query}));
  const selectedTitles=reports.filter(row=>row.checkId!=='CHECK.C').reverse().map(row=>row.title);
  let completeSelection;
  await t.test('exports include more than 500 records while the ordinary list retains its default page',async()=>{
   const all=await json({});assert.equal(all.length,505);
   assert.deepEqual(all.map(row=>row.title),reports.toReversed().map(row=>row.title));
   assert.equal((await selected().listSystemCheckReports(scope)).length,100);
   const csv=await selected().exportSystemCheckReportsCsv(scope);
   assert.equal((csv.match(/owned-title-/g)??[]).length,505);
   assert.ok(csv.startsWith('\uFEFF'));assert.ok(!csv.includes('foreign-private'));
  });
  await t.test('multiple selected IDs form one case-insensitive union without duplicate records',async()=>{
   completeSelection=await json({checkIds:[' check.a ','CHECK.B','check.A']});
   assert.equal(completeSelection.length,504);
   assert.deepEqual(completeSelection.map(row=>row.title),selectedTitles);
   assert.ok(completeSelection.every(row=>['CHECK.A','CHECK.B'].includes(row.checkId)));
   assert.deepEqual(await json({checkId:'CHECK.A',checkIds:['CHECK.B']}),completeSelection);
   assert.deepEqual(await json({checkIds:['CHECK.A']}),await json({checkId:'check.a'}));
  });
  await t.test('explicit empty and unknown selections cannot accidentally export every workspace report',async()=>{
   assert.deepEqual(await json({checkIds:[]}),[]);
   assert.deepEqual(await json({checkIds:['MISSING']}),[]);
   assert.deepEqual(await selected().listSystemCheckReports({...scope,checkIds:[]}),[]);
   assert.deepEqual(await selected().getSystemCheckReportStatistics({...scope,checkIds:[]}),[]);
   const empty=await selected().exportSystemCheckReportsCsv({...scope,checkIds:[]});
   assert.ok(!empty.includes('owned-title-'));assert.ok(!empty.includes('Selected question'));
  });
  await t.test('explicit limits apply after the full selection and leave excluded CSV columns out',async()=>{
   assert.deepEqual((await json({checkIds:['CHECK.A','CHECK.B'],limit:2})).map(row=>row.title),selectedTitles.slice(0,2));
   assert.equal((await json({checkIds:['CHECK.A','CHECK.B'],limit:500})).length,500);
   assert.deepEqual((await selected().listSystemCheckReports({...scope,checkIds:['CHECK.A','CHECK.B'],limit:2})).map(row=>row.title),selectedTitles.slice(0,2));
   const stats=await selected().getSystemCheckReportStatistics({...scope,checkIds:['CHECK.A','CHECK.B']});
   assert.deepEqual(stats.map(row=>[row.checkId,row.reportCount]),[['CHECK.A',501],['CHECK.B',3]]);
   const csv=await selected().exportSystemCheckReportsCsv({...scope,checkIds:['CHECK.B','CHECK.A']});
   assert.equal((csv.match(/owned-title-/g)??[]).length,504);
   assert.ok(csv.includes('Selected question Ω'));
   assert.deepEqual(completeSelection[0].responses,reports.find(row=>row.title===completeSelection[0].title).responses);
   for(const value of ['CHECK.C','Private unselected column','foreign-private'])assert.ok(!csv.includes(value),value);
  });
  await t.test('native distributions group exact Source environment labels with versions and preserve canonical name-only fields',async()=>{
   const stats=await selected().getSystemCheckReportStatistics({...scope,checkIds:['CHECK.A']});
   assert.deepEqual(stats[0].operatingSystemVersions,[{value:'Windows 10',count:251},{value:'Linux 6',count:250}]);
   assert.deepEqual(stats[0].browserVersions,[{value:'Chromium 130',count:501}]);
   assert.deepEqual(stats[0].operatingSystems,[{value:'Windows',count:251},{value:'Linux',count:250}]);
   assert.deepEqual(stats[0].browsers,[{value:'Chromium',count:501}]);
   const missing=(await selected().getSystemCheckReportStatistics({...scope,checkIds:['CHECK.C']}))[0];
   assert.deepEqual(missing.operatingSystemVersions,[{value:' ',count:1}]);
   assert.deepEqual(missing.browserVersions,[{value:'Chromium ',count:1}]);
   assert.deepEqual(missing.operatingSystems,[{value:'Windows',count:1}],'Canonical ID matching remains independent from exact Source labels.');
  });
  await t.test('malformed explicit selectors reject instead of silently broadening a protected read',async()=>{
   for(const checkIds of [null,'CHECK.A',[1],[''],[' '],['CHECK.A',{}]])
    await assert.rejects(selected().exportSystemCheckReportsJson({...scope,checkIds}),error=>error.errorCode==='system_check_report_check_ids_invalid');
  });
  await t.test('selection and export leave stored report bytes intact across a persistent reopen',async()=>{
   assert.deepEqual(await repository.listWorkspaceActivityEventsByWorkspace(tenant.tenantId,workspace.workspaceId),snapshot);
   if(kind!=='memory'){await storage.shutdown();storage=null;await open();}
   assert.deepEqual(await json({checkIds:['CHECK.A','CHECK.B']}),completeSelection);
   assert.deepEqual(await repository.listWorkspaceActivityEventsByWorkspace(tenant.tenantId,workspace.workspaceId),snapshot);
  });
 }finally{
  try{await storage?.shutdown();}finally{try{if(created)await root.query(`DROP SCHEMA "${schema}" CASCADE`);}finally{try{await root?.end();}finally{await rm(directory,{recursive:true,force:true});}}}
 }
});

test('protected HTTP exports bind repeated Check selections across CSV, JSON, statistics and read-only scope',async()=>{
 const {spawn}=await import('node:child_process');
 const {resolve}=await import('node:path');
 const {pathToFileURL}=await import('node:url');
 const {raceWithSmokeDeadline}=await import('./smoke-deadline.mjs');
 const module=pathToFileURL(resolve('apps/api/dist/apps/api/src/index.js')).href;
 const child=spawn(process.execPath,['--input-type=module','-e',`
  import{createProductionApiServer}from ${JSON.stringify(module)};
  const server=await createProductionApiServer();server.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));
  process.once('SIGTERM',()=>server.close(()=>process.exit(0)));
 `],{stdio:['ignore','ignore','inherit','ipc'],env:{...process.env,FIRST_SLICE_STORE:'memory',
  FIRST_SLICE_BOOTSTRAP_DEMO:'true',FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',
  FIRST_SLICE_XML_SCHEMA_PROFILE:'legacy-compatibility',FIRST_SLICE_PROOF_OF_WORK_SCOPES:''}});
 const closed=new Promise(done=>child.once('close',done));
 try{
  const port=await raceWithSmokeDeadline(new Promise((done,reject)=>{
   child.once('message',message=>done(message.port));child.once('error',reject);
   child.once('exit',()=>reject(Error('Owned report API exited before startup.')));
  }),20000,()=>{throw Error('Owned report API startup timed out.');});
  const base='http://127.0.0.1:'+port;let token='';
  const request=async(path,{method='GET',body,credential=token,accept='application/json',status=200}={})=>{
   const response=await fetch(base+path,{method,headers:{accept,...(credential?{authorization:'Bearer '+credential}:{}),
    ...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});
   const content=response.headers.get('content-type')??'',value=content.includes('application/json')?await response.json():Buffer.from(await response.arrayBuffer()).toString('utf8');
   assert.equal(response.status,status,method+' '+path+': '+JSON.stringify(value));return value;
  };
  token=(await request('/api/v1/admin/auth/sign-in',{method:'POST',body:{username:'demo-admin',password:'demo-admin-password'}})).sessionToken;
  const workspaceKey='owned-report-http',scope='/api/v1/tenants/demo-tenant/workspaces/'+workspaceKey;
  const workspace=(await request('/api/v1/tenants/demo-tenant/workspaces',{method:'POST',body:{workspaceKey,displayName:'Owned reports'},status:201})).workspace;
  for(const checkId of ['HTTP.A','HTTP.B','HTTP.C']){
   const source=await request(scope+'/source-packages',{method:'POST',status:201,body:{fileName:checkId+'.xml',mediaType:'application/xml',
    sourceDocument:`<SysCheck><Metadata><Id>${checkId}</Id><Label>${checkId}</Label></Metadata><Config savekey="owned-report-key" skipnetwork="true"/></SysCheck>`}});
   const imported=await request(scope+'/import-jobs',{method:'POST',status:201,body:{sourcePackageId:source.sourcePackage.sourcePackageId}});
   assert.equal(imported.importJob.status,'completed',JSON.stringify(imported));
  }
  for(const [checkId,title]of [['HTTP.A','report-a-one'],['HTTP.A','report-a-two'],['HTTP.B','report-b'],['HTTP.C','unselected-report-c']])
   await request(scope+'/system-checks/'+checkId+'/reports',{method:'POST',status:201,credential:'',body:{keyPhrase:'owned-report-key',title,
    environment:[],network:[],unit:[],questionnaire:[{id:'column',type:'string',label:checkId==='HTTP.C'?'Unselected private column':'Selected shared column',value:'exact Ω\n"; answer',warning:false}]}});
  const role={role:'workspace_admin',tenantKey:'demo-tenant',workspaceKey,accessMode:'read_only'};
  await request('/api/v1/admin/users',{method:'POST',status:201,body:{username:'owned-reports-ro',password:'owned-reports-read-secret',roleAssignments:[role]}});
  const ro=(await request('/api/v1/admin/auth/sign-in',{method:'POST',body:{username:'owned-reports-ro',password:'owned-reports-read-secret'}})).sessionToken;
  const before=await request(scope+'/activity-events?limit=500');
  const query='?checkId=http.a&checkId=HTTP.B&checkId=HTTP.A';
  const json=await request(scope+'/exports/system-check-reports.json'+query,{credential:ro});
  assert.deepEqual(json.map(row=>row.title).sort(),['report-a-one','report-a-two','report-b']);
  const csv=await request(scope+'/exports/system-check-reports.csv'+query,{credential:ro,accept:'text/csv'});
  assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('Selected shared column'));
  assert.ok(!csv.includes('Unselected private column'));assert.ok(!csv.includes('unselected-report-c'));
  assert.deepEqual(await request(scope+'/exports/system-check-reports'+query,{credential:ro,accept:'application/json'}),json);
  assert.equal(await request(scope+'/exports/system-check-reports'+query,{credential:ro,accept:'text/csv'}),csv);
  const stats=await request(scope+'/system-check-reports/statistics'+query,{credential:ro});
  assert.deepEqual(stats.items.map(row=>[row.checkId,row.reportCount]),[['HTTP.A',2],['HTTP.B',1]]);
  assert.deepEqual(stats.items[0].operatingSystemVersions,[{value:' ',count:2}]);
  assert.deepEqual(stats.items[0].browserVersions,[{value:' ',count:2}]);
  const limited=await request(scope+'/system-check-reports'+query+'&limit=2',{credential:ro});
  assert.deepEqual(limited.items.map(row=>row.title),json.slice(0,2).map(row=>row.title));
  assert.deepEqual(await request(scope+'/exports/system-check-reports.json?checkId=MISSING',{credential:ro}),[]);
  assert.equal((await request(scope+'/exports/system-check-reports.json?checkId=',{credential:ro})).length,4);
  for(const route of ['/exports/system-check-reports.csv','/exports/system-check-reports.json','/exports/system-check-reports','/system-check-reports','/system-check-reports/statistics'])
   await request(scope+route+'?checkId=&checkId=',{credential:ro,status:400});
  for(const limit of ['0','-1','501','2x'])await request(scope+'/exports/system-check-reports.json'+query+'&limit='+limit,{credential:ro,status:400});
  await request(scope+'/exports/system-check-reports.json'+query,{credential:'',status:401});
  await request(scope+'/system-check-reports',{method:'DELETE',credential:ro,status:403,body:{checkIds:['HTTP.A','HTTP.B'],confirmation:workspaceKey}});
  await request('/api/v1/tenants/demo-tenant/workspaces',{method:'POST',status:201,body:{workspaceKey:'foreign-reports',displayName:'Foreign'}});
  await request('/api/v1/tenants/demo-tenant/workspaces/foreign-reports/exports/system-check-reports.json'+query,{credential:ro,status:403});
  assert.deepEqual(await request(scope+'/activity-events?limit=500'),before);
  assert.deepEqual(await request(scope+'/exports/system-check-reports.json'+query,{credential:ro}),json);
  assert.ok(workspace.workspaceId);
 }finally{
  if(child.exitCode===null&&child.signalCode===null)child.kill('SIGTERM');
  await raceWithSmokeDeadline(closed,10000,()=>{child.kill('SIGKILL');throw Error('Owned report API did not close.');});
 }
});
