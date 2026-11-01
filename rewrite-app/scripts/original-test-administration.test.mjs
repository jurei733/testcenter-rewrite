import './source-native-test-administration-evidence.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {Pool} from 'pg';
import {createFirstSliceServices,projectOriginalTestAdministration,formatOriginalTestAdministrationJson} from '@testcenter-rewrite-app/application';
import {createInMemoryFirstSliceRepository} from '@testcenter-rewrite-app/memory-store';
import {createFileFirstSliceStorage} from '@testcenter-rewrite-app/file-store';
import {createSqliteFirstSliceStorage} from '@testcenter-rewrite-app/sqlite-store';
import {createPostgresFirstSliceStorage} from '@testcenter-rewrite-app/postgres-store';
import {prepareOriginalXmlSchemaValidator} from '../packages/application/dist/packages/application/src/original-xml-schema.js';
import {createProductionApiServer} from '../apps/api/dist/apps/api/src/index.js';
const evidence=JSON.parse(await readFile(new URL('../test-fixtures/original-testcenter/source-workspace-results/native-test-administration-http/observations.json',import.meta.url),'utf8'));
const sourceRow=label=>evidence.rows.find(r=>r.label===label),flatten=value=>Object.values(value).flat();
const error=e=>e.statusCode===409&&e.errorCode==='original_test_administration_history_unknown';
const privateState='OWNED_PRIVATE_NATIVE_TEST_STATE';
function inventory(){
 const input={tenantId:'tenant',workspaceId:'workspace',people:[],bindings:[],groups:[],runs:[],numbers:[]},people=new Map(),bindings=new Set();let id=0;
 for(const [name,rows]of Object.entries(sourceRow('exact-group-and-numeric-test-order').value)){
  input.groups.push({tenantId:input.tenantId,workspaceId:input.workspaceId,groupKey:name,groupLabel:rows[0].groupLabel});
  for(const row of rows){
   const key=JSON.stringify([row.loginName,row.nameSuffix]);if(!people.has(key)){const person={tenantId:input.tenantId,workspaceId:input.workspaceId,contentReleaseId:'release',participantSessionId:'person-'+people.size,originalLoginKey:row.loginName,originalNameSuffix:row.nameSuffix,participantCode:row.code,groupKey:name};people.set(key,person);input.people.push(person);}
   if(!bindings.has(row.loginName)){bindings.add(row.loginName);input.bindings.push({tenantId:input.tenantId,workspaceId:input.workspaceId,loginKey:row.loginName,groupKey:name,groupSnapshotKey:name});}
   const person=people.get(key),number=String(name==='OWNED.ADM.ALPHA'?15:++id),run={tenantId:input.tenantId,workspaceId:input.workspaceId,contentReleaseId:'release',participantSessionId:person.participantSessionId,testRunId:'run-'+number,hasTestState:true,bookletName:row.bookletName,bookletLabel:row.bookletLabel};
   input.runs.push(run);input.numbers.push({tenantId:input.tenantId,workspaceId:input.workspaceId,contentReleaseId:'release',participantSessionId:person.participantSessionId,testRunId:run.testRunId,testNumber:number});
  }
 }return input;
}
test('native administration projection reproduces the actual grouped Source116 JSON bytes',()=>{
 const input=inventory();input.runs.reverse();input.numbers.reverse();
 assert.equal(formatOriginalTestAdministrationJson(projectOriginalTestAdministration(input)),sourceRow('exact-group-and-numeric-test-order').rawText);
 assert.equal(formatOriginalTestAdministrationJson(projectOriginalTestAdministration({...input,runs:[]})),'[]');
 for(const p of input.people)p.groupKey=p.groupKey.toLowerCase();for(const b of input.bindings)b.groupKey=b.groupKey.toLowerCase();
 assert.equal(formatOriginalTestAdministrationJson(projectOriginalTestAdministration(input)),sourceRow('exact-group-and-numeric-test-order').rawText);
});
test('native administration preserves decimal IDs above safe integers and PHP numeric or prototype-looking groups',()=>{
 const input=inventory();input.runs=input.runs.filter(r=>r.bookletName==='OWNED.ADM.A').slice(0,3);input.numbers=input.numbers.filter(n=>input.runs.some(r=>r.testRunId===n.testRunId));
 input.groups[0].groupKey='__proto__';input.groups[1].groupKey='constructor';
 for(const b of input.bindings){const name=b.groupKey==='OWNED.ADM.ALPHA'?'__proto__':'constructor';b.groupKey=name;b.groupSnapshotKey=name;}
 for(const p of input.people)p.groupKey=p.groupKey==='OWNED.ADM.ALPHA'?'__proto__':'constructor';
 const targets=input.numbers.filter(n=>n.testNumber!=='15');targets[0].testNumber='9007199254740993';targets[1].testNumber='9007199254740992';
 const result=projectOriginalTestAdministration(input),expected=[...input.runs].filter(r=>r.testRunId!== 'run-15').sort((a,b)=>BigInt(input.numbers.find(n=>n.testRunId===a.testRunId).testNumber)<BigInt(input.numbers.find(n=>n.testRunId===b.testRunId).testNumber)?-1:1);
 assert.deepEqual(result.find(r=>r.name==='constructor').sessions.map(r=>r.loginName),expected.map(r=>input.people.find(p=>p.participantSessionId===r.participantSessionId).originalLoginKey));
 const wire=formatOriginalTestAdministrationJson(result);assert.ok(Object.hasOwn(JSON.parse(wire),'__proto__'));assert.ok(Object.hasOwn(JSON.parse(wire),'constructor'));
 assert.equal(formatOriginalTestAdministrationJson([{name:'0',sessions:[]}]),'[[]]');
 assert.equal(formatOriginalTestAdministrationJson([{name:'10',sessions:[]},{name:'2',sessions:[]}]),'{"10":[],"2":[]}');
});
test('unobserved native state suffix label ownership or Test number refuses instead of inventing history',()=>{
 for(const alter of [
  d=>delete d.runs[0].hasTestState,d=>delete d.people[0].originalNameSuffix,d=>delete d.people[0].participantCode,
  d=>delete d.runs[0].bookletLabel,d=>d.people[0].contentReleaseId='alien',d=>d.bindings[0].groupSnapshotKey='unknown',
  d=>d.numbers[0].testNumber='9223372036854775808',d=>d.numbers[0].testNumber='1.5',d=>d.numbers[0].participantSessionId='alien',
  d=>d.numbers.push({...d.numbers[0]}),d=>d.numbers[1].testNumber=d.numbers[0].testNumber,
  d=>{d.runs.push({...d.runs[0],testRunId:'duplicate'});d.numbers.push({...d.numbers[0],testRunId:'duplicate',testNumber:'99'});}
 ]){const d=inventory();alter(d);assert.throws(()=>projectOriginalTestAdministration(d),error);}
});
test('canonical extensions and foreign metadata cannot manufacture native Test rows',()=>{
 const input=inventory(),before=projectOriginalTestAdministration(input);input.people.push({...input.people[0],participantSessionId:'canonical',originalLoginKey:undefined});
 input.runs.push({...input.runs[0],participantSessionId:'canonical',testRunId:'canonical',hasTestState:undefined},{...input.runs[0],workspaceId:'foreign',testRunId:'alien'});
 input.people.push({...input.people[0],workspaceId:'foreign'});input.bindings.push({...input.bindings[0],workspaceId:'foreign'});input.groups.push({...input.groups[0],workspaceId:'foreign',groupLabel:'Alien label'});
 input.numbers.push({...input.numbers[0],workspaceId:'foreign',testRunId:'alien'});assert.deepEqual(projectOriginalTestAdministration(input),before);
});
const validator=await prepareOriginalXmlSchemaValidator(resolve(process.env.FIRST_SLICE_XML_SCHEMA_CACHE||'.data/original-xml-schemas'),process.env.FIRST_SLICE_XML_SCHEMA_DOWNLOAD!=='false');
const kinds=['memory','file','sqlite'];if(process.env.FIRST_SLICE_STORE==='postgres'){assert.ok(process.env.FIRST_SLICE_POSTGRES_URL);kinds.push('postgres');}
const xml=(type,text)=>'<'+type+' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/'+({Unit:'unit-xml/17.6',Booklet:'testcenter-booklet-xml/18.0',Testtakers:'testcenter-testtaker-xml/18.0'}[type])+'">'+text+'</'+type+'>';
const booklet=(id,label)=>xml('Booklet','<Metadata><Id>'+id+'</Id><Label>'+label+'</Label></Metadata><Units><Unit id="OWNED.ADM.UNIT" label="Owned administration Unit"/></Units>');
for(const kind of kinds)test(kind+': native Test read has a durable private consistent snapshot and real protected transport',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'owned-test-admin-')),file=join(directory,kind==='file'?'state.json':'state.sqlite'),schema='owned_test_admin_'+randomUUID().replaceAll('-','');
 const url=kind==='postgres'?new URL(process.env.FIRST_SLICE_POSTGRES_URL):null;url?.searchParams.set('options','-c search_path='+schema);url?.searchParams.set('application_name',schema);
 let storage,repository,services,admin,created=false,scope,ids,person,a,b,clock=1793530200000;
 const open=async()=>{storage=kind==='memory'?storage??{repository:createInMemoryFirstSliceRepository(),shutdown:async()=>{}}:kind==='file'?await createFileFirstSliceStorage(file):kind==='sqlite'?createSqliteFirstSliceStorage(file):await createPostgresFirstSliceStorage(url.toString());repository=storage.repository;services=createFirstSliceServices({repository,originalXmlSchemaValidator:validator,xmlSchemaProfile:'original-19'});};
 const close=async()=>{const own=storage;if(kind!=='memory')storage=undefined;await own?.shutdown();};
 try{
  if(url){admin=new Pool({connectionString:process.env.FIRST_SLICE_POSTGRES_URL});await admin.query('CREATE SCHEMA "'+schema+'"');created=true;}
  await open();const tenant=await services.platform.createTenant({tenantKey:'owned-'+randomUUID(),displayName:'Owned Test administration'}),workspace=await services.platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:'owned',displayName:'Owned Test administration'});
  scope={tenantKey:tenant.tenantKey,workspaceKey:workspace.workspaceKey};ids={tenantId:tenant.tenantId,workspaceId:workspace.workspaceId};
  const upload=(fileName,sourceDocument,mediaType='application/xml')=>services.contentIntake.uploadWorkspaceFile({...scope,fileName,sourceDocument,mediaType});
  await upload('player.html','<html><script type="application/ld+json">'+JSON.stringify({id:'owned-admin-player',version:'1.0.0',specVersion:'6.0',metadataVersion:'2.0',type:'player',name:[{lang:'de',value:'Owned Player'}]})+'</script></html>','text/html');
  await upload('unit.xml',xml('Unit','<Metadata><Id>OWNED.ADM.UNIT</Id><Label>Owned administration Unit</Label></Metadata><Definition player="owned-admin-player@1.0.0">Owned definition</Definition>'));
  await upload('a.xml',booklet('OWNED.ADM.A','First captured Booklet A Ω'));await upload('b.xml',booklet('OWNED.ADM.B','Retained Booklet B Ä'));
  const loginXml=(name,mode='run-hot-return',coded=false)=>'<Login name="'+name+'" mode="'+mode+'"><Booklet'+(coded?' codes="AbC"':'')+'>OWNED.ADM.A</Booklet><Booklet'+(coded?' codes="AbC"':'')+'>OWNED.ADM.B</Booklet></Login>';
  const peers=Array.from({length:10},(_,i)=>'owned-adm-r53-peer-'+i);
  const roster=(group='OWNED.ADM.ZULU')=>xml('Testtakers','<Metadata/><Group id="'+group+'" label="Frozen administration group Ω">'+loginXml('owned-adm-r53-code','run-hot-return',true)+loginXml('owned-adm-r53-restart','run-hot-restart',true)+peers.map(n=>loginXml(n)).join('')+'</Group><Group id="OWNED.ADM.ALPHA" label="Earlier alphabetical group">'+loginXml('owned-adm-r53-alpha')+'</Group>');
  await services.workspaceAdminRead.importParticipantRoster({...scope,rosterText:roster()});
  const auth=async(name,code='')=>{const credential=await services.originalAuthentication.login({name,password:''});return credential.kind==='person'?credential:services.originalAuthentication.person({loginToken:credential.token,code});};
  const read=async()=>formatOriginalTestAdministrationJson(await services.originalTestAdministration.list(scope));
  const patch=(token,testNumber,content=privateState)=>services.originalTest.patchState({token,testNumber,patch:[{key:'OWNED.STORED',content,timeStamp:++clock}]});
  await t.test('actual native Test creation and writes reproduce Source unopened/empty/captured-label semantics',async()=>{
   assert.equal(await read(),sourceRow('empty-tests').rawText);person=await auth('owned-adm-r53-code','aBc');
   a=await services.originalTest.create({token:person.token,bookletName:'OWNED.ADM.A'});b=await services.originalTest.create({token:person.token,bookletName:'OWNED.ADM.B'});
   assert.equal(await read(),sourceRow('created-unopened-tests').rawText);await patch(person.token,a);
   assert.equal(await read(),sourceRow('stateful-unopened-list').rawText);
   await services.originalTest.read({token:person.token,testNumber:b});assert.equal(await read(),sourceRow('opened-empty-b-still-excluded').rawText);
   await services.originalUnit.patchState({token:person.token,testNumber:b,unitName:'OWNED.ADM.UNIT',body:{newState:[{key:'OWNED',content:'unit alone',timeStamp:++clock}]}});
   assert.equal(await read(),sourceRow('unit-only-b-still-excluded').rawText);await patch(person.token,b);
   assert.equal(await read(),sourceRow('two-owner-tests').rawText);
   await upload('a.xml',booklet('OWNED.ADM.A','Changed current Booklet A β'));assert.equal(await read(),sourceRow('captured-test-label-after-file-edit').rawText);
   person=await auth('owned-adm-r53-code','abc');assert.equal(await read(),sourceRow('first-stored-code-after-case-reentry').rawText);
  });
  await t.test('real native number allocation orders15 Tests and preserves generated people separately',async()=>{
   for(const name of peers){const p=await auth(name),id=await services.originalTest.create({token:p.token,bookletName:'OWNED.ADM.A'});await patch(p.token,id);}
   for(let i=0;i<2;i++){const p=await auth('owned-adm-r53-restart','AbC'),id=await services.originalTest.create({token:p.token,bookletName:'OWNED.ADM.A'});await patch(p.token,id);}
   const p=await auth('owned-adm-r53-alpha'),id=await services.originalTest.create({token:p.token,bookletName:'OWNED.ADM.A'});await patch(p.token,id);
   const actual=JSON.parse(await read()),expected=structuredClone(sourceRow('exact-group-and-numeric-test-order').value),generated=actual['OWNED.ADM.ZULU'].filter(r=>r.loginName==='owned-adm-r53-restart');assert.equal(generated.length,2);assert.notEqual(generated[0].nameSuffix,generated[1].nameSuffix);
   generated.forEach((r,i)=>{assert.match(r.nameSuffix,/^AbC\/[a-z0-9_-]{8}$/);expected['OWNED.ADM.ZULU'].filter(r=>r.loginName==='owned-adm-r53-restart')[i].nameSuffix=r.nameSuffix;});
   assert.deepEqual(actual,expected);
  });
  await t.test('one metadata snapshot excludes private values and survives store reopen',async()=>{
   if(kind==='file'){await close();await open();}
   const before=await read(),forbidden=new Proxy(repository,{get(target,key){if(['listTestRunsByWorkspace','listParticipantSessionsByWorkspace','listOriginalLoginBindingsByWorkspace','listOriginalParticipantGroupsByWorkspace'].includes(key))return()=>assert.fail('Independent collection reads cannot constitute one Test snapshot');const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});
   const parser=JSON.parse;
   if(kind==='sqlite'||kind==='postgres')JSON.parse=(...args)=>{if(typeof args[0]==='string'&&args[0].includes(privateState))throw Error('Owned private Test decoder fence');return parser(...args);};
   try{
    if(kind==='sqlite'||kind==='postgres'){const runs=await repository.listOriginalPersonTestIdentities(person.participantSession);await assert.rejects(repository.getTestRunById(runs[0].testRunId),/Owned private Test decoder fence/);}
    const rows=await createFirstSliceServices({repository:forbidden}).originalTestAdministration.list(scope);assert.equal(formatOriginalTestAdministrationJson(rows),before);
   }finally{JSON.parse=parser;}
   const snapshot=await repository.getOriginalTestAdministrationInventory(ids.tenantId,ids.workspaceId);assert.ok(!JSON.stringify(snapshot).includes(privateState));assert.ok(snapshot.runs.every(r=>!('unitResponses'in r)&&!('originalTestState'in r)&&!('testletTimers'in r)));
   await close();await open();assert.equal(await read(),before);
  });
  if(kind==='sqlite'||kind==='postgres')await t.test('real protected HTTP returns Source-shaped JSON only to an authorized scoped reader',async()=>{
   const administration=createFirstSliceServices({repository}),password='Owned-test-admin-reader-secret',initial=await administration.adminAuth.bootstrapAdminUser({username:'owned-admin',password}),foreign=await services.platform.createWorkspace({tenantKey:scope.tenantKey,workspaceKey:'foreign',displayName:'Owned foreign'}),tokens={};
   for(const [name,workspaceId]of [['reader',ids.workspaceId],['foreign',foreign.workspaceId]]){const id=randomUUID();await repository.saveAdminUser({...initial.adminUser,adminUserId:id,username:name});await repository.saveAdminRoleAssignment({roleAssignmentId:randomUUID(),adminUserId:id,role:'workspace_admin',accessMode:'read_only',tenantId:ids.tenantId,workspaceId,groupKey:null,monitorProfiles:[],monitorBookletVisibility:'visible',createdAt:new Date().toISOString()});tokens[name]=(await administration.adminAuth.signIn({username:name,password})).adminSession.token;}
   const environment={FIRST_SLICE_STORE:kind,FIRST_SLICE_SQLITE_FILE:file,FIRST_SLICE_BOOTSTRAP_DEMO:'false',FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',FIRST_SLICE_XML_SCHEMA_PROFILE:'original-19',FIRST_SLICE_PROOF_OF_WORK_SCOPES:'',...(url?{FIRST_SLICE_POSTGRES_URL:url.toString()}:{})},previous=new Map(Object.keys(environment).map(k=>[k,process.env[k]]));let server;
   try{
    try{Object.assign(process.env,environment);server=await createProductionApiServer();}finally{for(const[k,v]of previous){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
    await new Promise(done=>server.listen(0,'127.0.0.1',done));const base='http://127.0.0.1:'+server.address().port,path='/api/v1/tenants/'+scope.tenantKey+'/workspaces/'+scope.workspaceKey+'/results/original-tests';
    for(const[token,status]of [[undefined,401],['invalid-owned-token',401],[tokens.foreign,403],[tokens.reader,200]]){const r=await fetch(base+path,{headers:token?{authorization:'Bearer '+token}:{},signal:AbortSignal.timeout(15000)});assert.equal(r.status,status);if(status===200){assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(await r.text(),await read());}}
   }finally{if(server)await new Promise((done,reject)=>server.close(e=>e&&e.code!=='ERR_SERVER_NOT_RUNNING'?reject(e):done()));}
  });
  await t.test('completed snapshot remains fixed while actual Login move overtakes its projection',async()=>{
   const before=await read();let release,entered;const gate=new Promise(r=>release=r),entry=new Promise(r=>entered=r),delayed=new Proxy(repository,{get(target,key){if(key==='getOriginalTestAdministrationInventory')return async(...args)=>{const v=await target[key](...args);entered();await gate;return v;};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});
   const pending=createFirstSliceServices({repository:delayed}).originalTestAdministration.list(scope);
   try{await entry;await services.workspaceAdminRead.importParticipantRoster({...scope,rosterText:roster('OWNED.ADM.MOVED')});await services.originalAuthentication.login({name:'owned-adm-r53-code',password:''});}finally{release();}
   assert.equal(formatOriginalTestAdministrationJson(await pending),before);const current=JSON.parse(await read());assert.ok(current['OWNED.ADM.MOVED']);assert.equal(current['OWNED.ADM.MOVED'].length,2);
  });
 }finally{await close();if(created){assert.equal(Number((await admin.query('SELECT count(*) AS count FROM pg_stat_activity WHERE application_name=$1',[schema])).rows[0].count),0);await admin.query('DROP SCHEMA "'+schema+'" CASCADE');}await admin?.end();await rm(directory,{recursive:true,force:true});}
});

