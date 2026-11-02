import {verifyOriginalWorkspaceReports,verifyOriginalWorkspaceReportHttp} from './original-workspace-reports-checks.mjs';
import './source-native-workspace-administration-evidence.mjs';
import {actualSourceFieldExtraction,actualSourceWorkspaceCasts,nativeWorkspaceSource,nativeWorkspaceSourceRow} from './source-native-workspace-administration-evidence.mjs';
import './source-native-test-administration-evidence.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {readFile,mkdtemp,rm,rename,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {Pool,Client} from 'pg';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {createFirstSliceServices,projectOriginalTestAdministration,formatOriginalTestAdministrationJson,prepareOriginalTestSelection,selectOriginalTestDeletion,parseOriginalWorkspaceNumber,originalExplicitWorkspaceAccess,prepareOriginalNativeTestSelection,readOriginalWorkspaceAdministrationCollection,decodeOriginalTestLogJson} from '@testcenter-rewrite-app/application';
import {createInMemoryFirstSliceRepository} from '@testcenter-rewrite-app/memory-store';
import {createFileFirstSliceStorage} from '@testcenter-rewrite-app/file-store';
import {createSqliteFirstSliceStorage} from '@testcenter-rewrite-app/sqlite-store';
import {createPostgresFirstSliceStorage} from '@testcenter-rewrite-app/postgres-store';
import {prepareOriginalXmlSchemaValidator} from '../packages/application/dist/packages/application/src/original-xml-schema.js';
import {createProductionApiServer} from '../apps/api/dist/apps/api/src/index.js';
const evidence=JSON.parse(await readFile(new URL('../test-fixtures/original-testcenter/source-workspace-results/native-test-administration-http/observations.json',import.meta.url),'utf8'));
const sourceRow=label=>evidence.rows.find(r=>r.label===label),flatten=value=>Object.values(value).flat();
function storedZipEntry(body,name){
 let offset=0;while(body.readUInt32LE(offset)===0x04034b50){assert.equal(body.readUInt16LE(offset+8),0);const size=body.readUInt32LE(offset+18),length=body.readUInt16LE(offset+26),extra=body.readUInt16LE(offset+28),start=offset+30+length+extra,key=body.subarray(offset+30,offset+30+length).toString();if(key===name)return body.subarray(start,start+size).toString();offset=start+size;}assert.fail('Missing owned ZIP entry '+name);
}
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
test('selected native Test tuples preserve empty/default values and exact binary Login identity without PUT normalization',()=>{
 const d=inventory(),row=d.people[0],run=d.runs.find(r=>r.participantSessionId===row.participantSessionId);
 const select=personSessions=>selectOriginalTestDeletion({...d,personSessions:prepareOriginalTestSelection(personSessions)},d);
 const tuple={loginName:row.originalLoginKey,code:row.participantCode,nameSuffix:row.originalNameSuffix,bookletName:run.bookletName};
 run.hasTestState=false;
 assert.deepEqual(select([tuple,tuple]).testRunIds,[run.testRunId]);
 assert.deepEqual(select([{...tuple,loginName:tuple.loginName.toUpperCase()}]).testRunIds,[]);
 assert.deepEqual(select([{...tuple,bookletName:' '+tuple.bookletName}]).testRunIds,[]);
 assert.deepEqual(select([{...tuple,code:tuple.code.toUpperCase(),nameSuffix:tuple.nameSuffix.toUpperCase(),bookletName:tuple.bookletName.toLowerCase()}]).testRunIds,[run.testRunId]);
 assert.deepEqual(prepareOriginalTestSelection([{loginName:'',bookletName:'',code:null,nameSuffix:null}]),[{loginName:'',bookletName:'',code:'',nameSuffix:''}]);
 for(const body of [undefined,null,[],{},[null],[{}],[{loginName:null,bookletName:'A'}],[{loginName:'A'}]])assert.throws(()=>prepareOriginalTestSelection(body),e=>e.statusCode===400);
 const body=[tuple],owned=prepareOriginalTestSelection(body);body[0].bookletName='elsewhere';assert.equal(owned[0].bookletName,run.bookletName);
});
test('native workspace path parsing matches all actual pinned PHP cast observations',()=>{
 for(const[raw,value]of actualSourceWorkspaceCasts)assert.equal(parseOriginalWorkspaceNumber(raw),BigInt(value)>0n?value:null,raw);
});
test('native workspace grant mapping cannot inherit platform/tenant/monitor scope or foreign ownership',()=>{
 const scope={tenantId:'t',workspaceId:'w',tenantKey:'t-key',workspaceKey:'w-key'},user='owned',role={adminUserId:user,role:'workspace_admin',tenantId:'t',workspaceId:'w',accessMode:'read_only'};
 assert.equal(originalExplicitWorkspaceAccess([role],user,scope),'RO');assert.equal(originalExplicitWorkspaceAccess([{...role,accessMode:'read_write'}],user,scope),'RW');
 for(const change of [{role:'platform_admin'},{role:'tenant_admin'},{role:'group_monitor'},{tenantId:'alien'},{workspaceId:'alien'},{adminUserId:'alien'}])assert.equal(originalExplicitWorkspaceAccess([{...role,...change}],user,scope),null);
 const state={tenants:new Map([['t',{tenantId:'t',tenantKey:'t-key',status:'active'}]]),workspacesByScope:new Map([['w',{tenantId:'t',workspaceId:'w',workspaceKey:'w-key',status:'active'}]]),originalWorkspaceNumbers:new Map([['w',{tenantId:'t',workspaceId:'w',workspaceNumber:'9007199254740993'}]])};
 assert.deepEqual(readOriginalWorkspaceAdministrationCollection(state,'9007199254740993'),scope);assert.equal(readOriginalWorkspaceAdministrationCollection(state,'1'),null);state.tenants.get('t').status='suspended';assert.equal(readOriginalWorkspaceAdministrationCollection(state,'9007199254740993'),null);
});
test('native selected tuple extraction follows actual Source197 PHP fields and preserves unsafe integer tokens',()=>{
 const native=value=>prepareOriginalNativeTestSelection(decodeOriginalTestLogJson(JSON.stringify(value)));
 for(const row of nativeWorkspaceSource.rows.filter(r=>r.label.startsWith('selection-coercion-'))){
  if(row.status>=400)assert.throws(()=>native(row.requestBody),e=>e.statusCode===row.status,row.label);else assert.ok(native(row.requestBody).length);
 }
 for(let i=0;i<actualSourceFieldExtraction.inputs.length;i++){const expected=actualSourceFieldExtraction.observations[i];assert.throws(()=>native(actualSourceFieldExtraction.inputs[i]),e=>e.statusCode===expected.status&&e.message===expected.message);}
 const value=prepareOriginalNativeTestSelection(decodeOriginalTestLogJson('{"personSessions":[{"loginName":9007199254740993,"bookletName":"A","code":1.0,"nameSuffix":false}]}'))[0];assert.deepEqual(value,{loginName:'9007199254740993',bookletName:'A',code:'1',nameSuffix:''});
});
const validator=await prepareOriginalXmlSchemaValidator(resolve(process.env.FIRST_SLICE_XML_SCHEMA_CACHE||'.data/original-xml-schemas'),process.env.FIRST_SLICE_XML_SCHEMA_DOWNLOAD!=='false');
const kinds=['memory','file','sqlite'];if(process.env.FIRST_SLICE_STORE==='postgres'){assert.ok(process.env.FIRST_SLICE_POSTGRES_URL);kinds.push('postgres');}
const xml=(type,text)=>'<'+type+' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/'+({Unit:'unit-xml/17.6',Booklet:'testcenter-booklet-xml/18.0',Testtakers:'testcenter-testtaker-xml/18.0'}[type])+'">'+text+'</'+type+'>';
const booklet=(id,label)=>xml('Booklet','<Metadata><Id>'+id+'</Id><Label>'+label+'</Label></Metadata><Units><Unit id="OWNED.ADM.UNIT" label="Owned administration Unit"/></Units>');
for(const kind of kinds)test(kind+': native Test read has a durable private consistent snapshot and real protected transport',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'owned-test-admin-')),file=join(directory,kind==='file'?'state.json':'state.sqlite'),schema='owned_test_admin_'+randomUUID().replaceAll('-','');
 const url=kind==='postgres'?new URL(process.env.FIRST_SLICE_POSTGRES_URL):null;url?.searchParams.set('options','-c search_path='+schema);url?.searchParams.set('application_name',schema);
 let storage,repository,services,admin,created=false,scope,ids,person,a,b,clock=1793530200000,nativeBoot,nativeForeign,nativeWorkspaceNumber,nativeTokens={},nativeRoles={},reportsProof;
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
  await t.test('native numeric scope uses current explicit grants, password policy and durable reverse lookup on every store',async()=>{
   const password='Owned-test-admin-reader-secret';nativeBoot=await services.adminAuth.bootstrapAdminUser({username:'owned-admin',password});
   nativeTokens.root=(await services.adminAuth.signIn({username:'owned-admin',password})).adminSession.token;
   nativeForeign=await services.platform.createWorkspace({tenantKey:scope.tenantKey,workspaceKey:'foreign',displayName:'Owned foreign'});
   nativeWorkspaceNumber=await repository.getOrCreateOriginalWorkspaceNumber(ids);
   assert.deepEqual(await repository.findOriginalWorkspaceAdministrationScope(nativeWorkspaceNumber),{...scope,...ids});
   assert.equal(await repository.findOriginalWorkspaceAdministrationScope('9223372036854775807'),null);
   for(const[name,role,workspaceId,accessMode,needsChange]of [['reader','workspace_admin',ids.workspaceId,'read_only',false],['writer','workspace_admin',ids.workspaceId,'read_write',false],['foreign','workspace_admin',nativeForeign.workspaceId,'read_only',false],['tenant-only','tenant_admin',null,'read_write',false],['needs-change','workspace_admin',ids.workspaceId,'read_only',true],['revoked','workspace_admin',ids.workspaceId,'read_only',false],['expired','workspace_admin',ids.workspaceId,'read_only',false],['signed-out','workspace_admin',ids.workspaceId,'read_only',false],['disabled','workspace_admin',ids.workspaceId,'read_only',false]]){
    const id=randomUUID();await repository.saveAdminUser({...nativeBoot.adminUser,adminUserId:id,username:name,passwordChangeRequired:needsChange});
    const assignment={roleAssignmentId:randomUUID(),adminUserId:id,role,accessMode,tenantId:ids.tenantId,workspaceId,groupKey:null,monitorProfiles:[],monitorBookletVisibility:'visible',createdAt:new Date().toISOString()};await repository.saveAdminRoleAssignment(assignment);nativeRoles[name]=assignment;nativeTokens[name]=(await services.adminAuth.signIn({username:name,password})).adminSession.token;
   }
   const resolve=(token,write=false,raw=nativeWorkspaceNumber)=>services.originalWorkspaceAdministration.resolve({token,write,workspacePathSegment:encodeURIComponent(raw)});
   for(const name of ['root','foreign','tenant-only'])await assert.rejects(resolve(nativeTokens[name]),e=>e.statusCode===404,name);
   for(const token of ['owned-invalid-token',person.token])await assert.rejects(resolve(token),e=>e.statusCode===403&&!e.message.includes(token));
   await assert.rejects(resolve(nativeTokens['needs-change']),e=>e.errorCode==='admin_password_change_required');
   assert.deepEqual(await resolve(nativeTokens.reader),{...scope,...ids});assert.deepEqual(await resolve(nativeTokens.writer,true),{...scope,...ids});
   await assert.rejects(resolve(nativeTokens.reader,true),e=>e.statusCode===403&&e.errorCode==='original_workspace_read_only');
   for(const raw of [nativeWorkspaceNumber.padStart(2,'0'),' +'+nativeWorkspaceNumber,nativeWorkspaceNumber+'abc',nativeWorkspaceNumber+'.9',nativeWorkspaceNumber+'e0'])assert.deepEqual(await resolve(nativeTokens.reader,false,raw),{...scope,...ids});
   for(const raw of ['0','-1','text','2147483648','9223372036854775808'])await assert.rejects(resolve(nativeTokens.reader,false,raw),e=>e.statusCode===404,raw);
   const expired=await repository.getAdminSessionByToken(nativeTokens.expired);await repository.saveAdminSession({...expired,expiresAt:new Date(Date.now()-1000).toISOString()});
   await services.adminAuth.signOut({sessionToken:nativeTokens['signed-out']});
   const disabled=await repository.getAdminUserById(nativeRoles.disabled.adminUserId);await repository.saveAdminUser({...disabled,status:'disabled'});
   for(const name of ['expired','signed-out','disabled'])await assert.rejects(resolve(nativeTokens[name]),e=>e.statusCode===403,name);
   await repository.saveTenant({...tenant,status:'suspended'});await assert.rejects(resolve(nativeTokens.reader),e=>e.statusCode===404);await repository.saveTenant(tenant);
   await repository.deleteAdminRoleAssignment(nativeRoles.revoked.roleAssignmentId);await assert.rejects(resolve(nativeTokens.revoked),e=>e.statusCode===404);
   await close();await open();assert.deepEqual(await resolve(nativeTokens.reader),{...scope,...ids});
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
  reportsProof=await verifyOriginalWorkspaceReports(t,{services,repository,scope,ids,xml,booklet,nativeRoles,nativeTokens,kind,file,connectionString:url?.toString()});
  if(kind==='sqlite'||kind==='postgres')await t.test('real protected HTTP returns Source-shaped JSON only to an authorized scoped reader',async http=>{
   const tokens=nativeTokens;
   const environment={FIRST_SLICE_STORE:kind,FIRST_SLICE_SQLITE_FILE:file,FIRST_SLICE_BOOTSTRAP_DEMO:'false',FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',FIRST_SLICE_XML_SCHEMA_PROFILE:'original-19',FIRST_SLICE_PROOF_OF_WORK_SCOPES:'',...(url?{FIRST_SLICE_POSTGRES_URL:url.toString()}:{})},previous=new Map(Object.keys(environment).map(k=>[k,process.env[k]]));let server;
   try{
    try{Object.assign(process.env,environment);server=await createProductionApiServer();}finally{for(const[k,v]of previous){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
    await new Promise(done=>server.listen(0,'127.0.0.1',done));const base='http://127.0.0.1:'+server.address().port,path='/api/v1/tenants/'+scope.tenantKey+'/workspaces/'+scope.workspaceKey+'/results/original-tests';
    for(const[token,status]of [[undefined,401],['invalid-owned-token',401],[tokens.foreign,403],[tokens.reader,200]]){const r=await fetch(base+path,{headers:token?{authorization:'Bearer '+token}:{},signal:AbortSignal.timeout(15000)});assert.equal(r.status,status);if(status===200){assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(await r.text(),await read());}}
    await verifyOriginalWorkspaceReportHttp(http,{base,proof:reportsProof,tokens});
    const native='/workspace/'+nativeWorkspaceNumber+'/responses/detailed';
    const nativeRequest=async(token,method='GET',value,segment=nativeWorkspaceNumber,suffix='responses/detailed')=>{
     const r=await fetch(base+'/workspace/'+encodeURIComponent(segment)+'/'+suffix,{method,headers:{...(token===undefined?{}:{AuthToken:token}),...(value===undefined?{}:{'content-type':'application/json'})},...(value===undefined?{}:{body:JSON.stringify(value)}),signal:AbortSignal.timeout(15000)});return {response:r,text:await r.text()};
    };
    for(const[token,status]of [[undefined,401],['',401],['invalid-owned-token',403],[person.token,403],[tokens.root,404],[tokens.foreign,404],[tokens['tenant-only'],404],[tokens['needs-change'],403],[tokens.revoked,404],[tokens.expired,403],[tokens['signed-out'],403],[tokens.disabled,403],[tokens.reader,200],[tokens.writer,200]]){
     const {response:r,text}=await nativeRequest(token);assert.equal(r.status,status,'native capability boundary '+status);assert.equal(r.headers.get('cache-control'),'private, no-store');if(status===200)assert.equal(text,await read());else{assert.ok(r.headers.get('error-id'));assert.equal(r.headers.get('test-mode'),'NO');}
    }
    const bearerOnly=await fetch(base+native,{headers:{authorization:'Bearer '+tokens.reader},signal:AbortSignal.timeout(15000)});assert.equal(bearerOnly.status,401);
    for(const raw of [nativeWorkspaceNumber.padStart(2,'0'),' +'+nativeWorkspaceNumber,nativeWorkspaceNumber+'abc',nativeWorkspaceNumber+'.9',nativeWorkspaceNumber+'e0']){const r=await nativeRequest(tokens.reader,'GET',undefined,raw);assert.equal(r.response.status,200);assert.equal(r.text,await read());}
    const stats=await nativeRequest(tokens.reader,'GET',undefined,nativeWorkspaceNumber,'results');assert.equal(stats.response.status,200);assert.deepEqual(JSON.parse(stats.text),await services.originalGroupResults.list(scope));
    const nativeBefore=await read();
    for(const[token,status]of [[tokens.root,404],[tokens.foreign,404],[tokens.reader,403],[tokens.writer,200]]){
     const r=await nativeRequest(token,'DELETE',{personSessions:[{loginName:'unknown-owned',bookletName:'OWNED.ADM.A'}]});assert.equal(r.response.status,status);if(status===200){assert.equal(r.text,'');assert.equal(r.response.headers.get('content-type'),'text/html; charset=UTF-8');}
    }
    for(const row of nativeWorkspaceSource.rows.filter(r=>r.label.startsWith('selection-coercion-'))){const r=await nativeRequest(tokens.writer,'DELETE',row.requestBody);assert.equal(r.response.status,row.status,row.label);}
    assert.equal(await read(),nativeBefore);
    const nativePerson=await auth(peers.at(-2)),nativeNumber=await services.originalTest.create({token:nativePerson.token,bookletName:'OWNED.ADM.B'});
    const selected=await nativeRequest(tokens.writer,'DELETE',{personSessions:[{loginName:peers.at(-2),bookletName:'OWNED.ADM.B',code:null,nameSuffix:null}]});assert.equal(selected.response.status,200);assert.equal(selected.text,'');
    await assert.rejects(services.originalTest.read({token:nativePerson.token,testNumber:nativeNumber}),e=>e.statusCode===403);assert.equal((await services.originalAuthentication.read({token:nativePerson.token})).participantSession.participantSessionId,nativePerson.participantSession.participantSessionId);
    assert.equal(await read(),nativeBefore);
    const emptyGroup='OWNED.NATIVE.EMPTY';await repository.getOrCreateOriginalParticipantGroup({...ids,groupKey:emptyGroup,groupLabel:'Owned native empty snapshot',createdAt:new Date().toISOString()});
    assert.ok((await repository.listOriginalParticipantGroupsByWorkspace(ids.tenantId,ids.workspaceId)).some(g=>g.groupKey===emptyGroup));
    const deniedGroup=await nativeRequest(tokens.reader,'DELETE',{groups:[emptyGroup]},nativeWorkspaceNumber,'responses');assert.equal(deniedGroup.response.status,403);
    const deletedGroup=await nativeRequest(tokens.writer,'DELETE',{groups:[emptyGroup.toLowerCase()]},nativeWorkspaceNumber,'responses');assert.equal(deletedGroup.response.status,200);assert.equal(deletedGroup.text,'');
    assert.ok(!(await repository.listOriginalParticipantGroupsByWorkspace(ids.tenantId,ids.workspaceId)).some(g=>g.groupKey===emptyGroup));assert.equal(await read(),nativeBefore);
    const before=await read(),deletionBody={personSessions:[{loginName:'unknown-owned',bookletName:'OWNED.ADM.A'}]};
    for(const[token,status]of [[undefined,401],['invalid-owned-token',401],[person.token,401],[tokens.foreign,403],[tokens.reader,403],[tokens.writer,200]]){
     const r=await fetch(base+path,{method:'DELETE',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(deletionBody),signal:AbortSignal.timeout(15000)});assert.equal(r.status,status,token===person.token?'participant cannot administer Tests':String(status));if(status===200){assert.equal(await r.text(),'');assert.equal(r.headers.get('cache-control'),'private, no-store');}
    }
    const ephemeral=await auth(peers.at(-1)),ephemeralNumber=await services.originalTest.create({token:ephemeral.token,bookletName:'OWNED.ADM.B'});
    const matched=await fetch(base+path,{method:'DELETE',headers:{authorization:'Bearer '+tokens.writer,'content-type':'application/json'},body:JSON.stringify({personSessions:[{loginName:peers.at(-1),bookletName:'OWNED.ADM.B'}]}),signal:AbortSignal.timeout(15000)});assert.equal(matched.status,200);assert.equal(await matched.text(),'');
    await assert.rejects(services.originalTest.read({token:ephemeral.token,testNumber:ephemeralNumber}),e=>e.statusCode===403);
    assert.equal(await read(),before);
    for(const personSessions of [[],[{bookletName:'OWNED.ADM.A'}],[{loginName:'owned-adm-r53-code'}]]){
     const r=await fetch(base+path,{method:'DELETE',headers:{authorization:'Bearer '+tokens.writer,'content-type':'application/json'},body:JSON.stringify({personSessions}),signal:AbortSignal.timeout(15000)});assert.equal(r.status,400);
    }
   }finally{if(server)await new Promise((done,reject)=>server.close(e=>e&&e.code!=='ERR_SERVER_NOT_RUNNING'?reject(e):done()));}
  });
  let retainedResponseWire;const attachmentByRun=new Map();
  const selection={loginName:'owned-adm-r53-code',code:'ABC',nameSuffix:'ABC',bookletName:'owned.adm.a'};
  const removeA=()=>services.originalTestAdministration.delete({...scope,personSessions:[selection]});
  const snapshot=async()=>({
   runs:await repository.listTestRunsByWorkspace(ids.tenantId,ids.workspaceId),groups:await repository.listOriginalParticipantGroupsByWorkspace(ids.tenantId,ids.workspaceId),
   people:await repository.listParticipantSessionsByWorkspace(ids.tenantId,ids.workspaceId),bindings:await repository.listOriginalLoginBindingsByWorkspace(ids.tenantId,ids.workspaceId),
   units:await repository.listOriginalUnitsByWorkspace(ids.tenantId,ids.workspaceId),reviews:await repository.listWorkspaceReviewsByWorkspace(ids.tenantId,ids.workspaceId),
   logs:await repository.listParticipantTestLogsByWorkspace(ids.tenantId,ids.workspaceId),events:await repository.listWorkspaceActivityEventsByWorkspace(ids.tenantId,ids.workspaceId),
   files:await repository.listAttachmentFilesByWorkspace(ids.tenantId,ids.workspaceId),credential:await repository.getParticipantAccessCredential(person.participantSession.participantSessionId),
   roster:await repository.listParticipantRosterEntriesByWorkspace(ids.tenantId,ids.workspaceId)
  });
  await t.test('unknown, empty-string, binary Login and untrimmed Booklet selections leave every byte and group clock intact',async()=>{
   const before=await snapshot();
   for(const row of [{...selection,code:'wrong'},{...selection,loginName:selection.loginName.toUpperCase()},{...selection,bookletName:' '+selection.bookletName},{loginName:'',bookletName:''}])await services.originalTestAdministration.delete({...scope,personSessions:[row]});
   assert.deepEqual(await snapshot(),before);
  });
  await t.test('caller-owned tuple changes during workspace resolution cannot change the authorized selection',async()=>{
   const before=await snapshot(),tuple={...selection,code:'unknown-owned'},personSessions=[tuple];let entered,release;const entry=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
   const delayed=new Proxy(repository,{get(target,key){if(key==='getWorkspaceByScope')return async(...args)=>{const value=await target[key](...args);entered();await gate;return value;};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});
   const pending=createFirstSliceServices({repository:delayed}).originalTestAdministration.delete({...scope,personSessions});
   try{await entry;tuple.code=selection.code;personSessions.push(selection);}finally{release();}
   await pending;assert.deepEqual(await snapshot(),before);
  });
  await t.test('seed real selected and retained Unit answers, descendant artifacts and a durable delivery receipt',async()=>{
   for(const[number,key]of [[b,'retained'],[a,'selected']]){
    await services.originalUnit.patchState({token:person.token,testNumber:number,unitName:'OWNED.ADM.UNIT',body:{originalUnitId:'OWNED.ORIGINAL.'+(number===a?'A':'B'),newState:[{key:'PRESENTATION_PROGRESS',content:'some',timeStamp:++clock}]}});
    await services.originalUnit.putResponse({token:person.token,testNumber:number,unitName:'OWNED.ADM.UNIT',body:{timeStamp:++clock,dataParts:{owned:JSON.stringify({[key]:'Owned '+(number===a?'A':'B')+' answer Ω'})},responseType:'owned'}});
    if(number===b)retainedResponseWire=storedZipEntry((await services.workspaceAdminRead.exportOriginalResultArchive({...scope,groupKeys:['OWNED.ADM.ZULU']})).body,'responses.json');
    const n=await repository.findOriginalTestNumber({testNumber:number,...ids,participantSessionId:person.participantSession.participantSessionId}),run=await repository.getTestRunById(n.testRunId),stamp=new Date().toISOString(),deliveryId=randomUUID();
    if(number===a)await services.workspaceReview.createReview({...scope,participantSessionId:run.participantSessionId,testRunId:run.testRunId,unitKey:'OWNED.ADM.UNIT',reviewerId:'Owned',category:'owned',comment:'Owned selected-Test comment'});
    assert.ok(await repository.appendParticipantRunCommand({...run,commandId:randomUUID(),commandType:'pause',actorId:null,targetUnitKey:null,remainingSeconds:null,issuedAt:stamp}));
    await repository.mutateParticipantRun({...run,deliveryId},()=>({testRun:{...run,status:'running'},originalTestState:run.originalTestState,testLogs:[],activityEvents:[],progressDelivery:{...ids,participantSessionId:run.participantSessionId,testRunId:run.testRunId,contentReleaseId:run.contentReleaseId,deliveryId,payloadSha256:'0'.repeat(64),acceptedAt:stamp}}));
    assert.equal((await repository.updateParticipantPresence({testRunId:run.testRunId,participantSessionId:run.participantSessionId,action:'poll',timestamp:Date.now()})).accepted,true);
    const attachmentFileId=randomUUID();attachmentByRun.set(run.testRunId,attachmentFileId);
    await repository.saveAttachmentFile({...ids,attachmentFileId,attachmentId:'att-'+Buffer.from(JSON.stringify([run.testRunId,'OWNED.ADM.UNIT','owned'])).toString('base64url'),fileName:'owned.png',mediaType:'image/png',dataBase64:Buffer.from(privateState).toString('base64'),createdAt:stamp});
   }
  });
  await t.test('an unrelated group Review remains outside the selected Test and retained raw response export',async()=>{
   const alpha=(await repository.listParticipantSessionsByWorkspace(ids.tenantId,ids.workspaceId)).find(p=>p.originalLoginKey==='owned-adm-r53-alpha'),run=(await repository.listTestRunsByParticipantSessionId(alpha.participantSessionId))[0];
   await services.workspaceReview.createReview({...scope,participantSessionId:alpha.participantSessionId,testRunId:run.testRunId,unitKey:'OWNED.ADM.UNIT',reviewerId:'Owned',category:'owned',comment:'Retained independent group Review'});
  });
  if(kind!=='memory')await t.test('failure after selected descendants are removed rolls back clocks, answers and capabilities through reopen',async()=>{
   const before=await snapshot();let control;
   if(kind==='file'){await rename(file,file+'.owned-backup');await mkdir(file);}
   else if(kind==='sqlite'){control=new DatabaseSync(file);control.exec("CREATE TRIGGER owned_selected_test_failure BEFORE UPDATE ON original_participant_groups BEGIN SELECT RAISE(ABORT,'owned final clock failure'); END");}
   else{control=new Pool({connectionString:url.toString()});await control.query("CREATE FUNCTION owned_selected_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned final clock failure'; END; $$; CREATE TRIGGER owned_selected_test_failure BEFORE UPDATE ON original_participant_groups FOR EACH ROW EXECUTE FUNCTION owned_selected_test_failure()");}
   try{await assert.rejects(removeA(),kind==='file'?/directory|EISDIR|ENOTEMPTY/:/owned final clock failure/);}
   finally{
    if(kind==='file'){await rm(file,{recursive:true});await rename(file+'.owned-backup',file);}
    else if(kind==='sqlite'){control.exec('DROP TRIGGER owned_selected_test_failure');control.close();}
    else{await control.query('DROP TRIGGER owned_selected_test_failure ON original_participant_groups; DROP FUNCTION owned_selected_test_failure()');await control.end();}
   }
   assert.deepEqual(await snapshot(),before);await close();await open();assert.deepEqual(await snapshot(),before);
  });
  await t.test('exact selected deletion keeps every other Test, raw B answers, current person/capabilities and assignments',async()=>{
   const before=await snapshot(),mapping=await repository.findOriginalTestNumber({testNumber:a,...ids,participantSessionId:person.participantSession.participantSessionId}),runId=mapping.testRunId,keptId=(await repository.findOriginalTestNumber({testNumber:b,...ids,participantSessionId:person.participantSession.participantSessionId})).testRunId;
   const parser=JSON.parse;if(kind==='sqlite'||kind==='postgres')JSON.parse=(...args)=>{if(typeof args[0]==='string'&&args[0].includes(privateState))throw Error('Owned selected-Test private decoder fence');return parser(...args);};
   try{if(kind==='sqlite'||kind==='postgres')await assert.rejects(repository.getTestRunById(runId),/Owned selected-Test private decoder fence/);await services.originalTestAdministration.delete({...scope,personSessions:[selection,selection]});}finally{JSON.parse=parser;}
   const after=await snapshot();
   assert.deepEqual(after.runs,before.runs.filter(r=>r.testRunId!==runId));assert.equal(await repository.getTestRunById(runId),null);
   for(const key of ['people','bindings','credential','roster'])assert.deepEqual(after[key],before[key],key);
   for(const key of ['units','reviews','logs'])assert.deepEqual(after[key],before[key].filter(r=>r.testRunId!==runId),key);
   assert.deepEqual(after.units.find(r=>r.testRunId===keptId),before.units.find(r=>r.testRunId===keptId));
   assert.equal(storedZipEntry((await services.workspaceAdminRead.exportOriginalResultArchive({...scope,groupKeys:['OWNED.ADM.ZULU']})).body,'responses.json'),retainedResponseWire);
   assert.deepEqual(after.files,before.files.filter(f=>f.attachmentFileId!==attachmentByRun.get(runId)));
   const removedReviews=new Set(before.reviews.filter(r=>r.testRunId===runId).map(r=>r.reviewId));
   assert.deepEqual(after.events,before.events.filter(e=>!(e.subjectType==='test_run'&&e.subjectId===runId||e.details.testRunId===runId||removedReviews.has(e.details.reviewId))));
   await assert.rejects(repository.listOriginalReviews({...mapping,unitName:null}),e=>e.statusCode===409);
   for(const row of before.groups){const updated=after.groups.find(g=>g.groupKey===row.groupKey);if(row.groupKey==='OWNED.ADM.ZULU'){assert.deepEqual({...updated,lastModifiedAt:row.lastModifiedAt},row);assert.ok(Date.parse(updated.lastModifiedAt)>=Date.parse(row.lastModifiedAt));}else assert.deepEqual(updated,row);}
   assert.equal((await services.originalAuthentication.read({token:person.token})).participantSession.participantSessionId,person.participantSession.participantSessionId);
   await assert.rejects(services.originalTest.read({token:person.token,testNumber:a}),e=>e.statusCode===403);assert.ok(await services.originalTest.read({token:person.token,testNumber:b}));
   assert.equal(await repository.findOriginalTestNumber({testNumber:a,...ids,participantSessionId:person.participantSession.participantSessionId}),null);
   assert.deepEqual(await repository.listPendingParticipantRunCommands({testRunId:runId,...ids,participantSessionId:person.participantSession.participantSessionId}),[]);
   if(kind==='file'){
    const doc=JSON.parse(await readFile(file,'utf8'));for(const key of ['participantRunCommands','participantProgressDeliveries','participantPresence','originalNativeReviews'])assert.ok(Object.values(doc[key]).every(row=>row.testRunId!==runId),key);
   }else if(kind==='sqlite'||kind==='postgres'){
    const control=kind==='sqlite'?new DatabaseSync(file):new Pool({connectionString:url.toString()});
    try{for(const table of ['participant_run_commands','participant_progress_deliveries','participant_connection_presence','original_native_reviews','original_native_units','original_test_numbers']){
     const count=kind==='sqlite'?control.prepare('SELECT count(*) AS count FROM '+table+' WHERE test_run_id=?').get(runId).count:(await control.query('SELECT count(*) AS count FROM '+table+' WHERE test_run_id=$1',[runId])).rows[0].count;assert.equal(Number(count),0,table);
    }}finally{if(kind==='sqlite')control.close();else await control.end();}
   }
   await close();await open();assert.equal(await repository.getTestRunById(runId),null);assert.deepEqual((await snapshot()).units.find(r=>r.testRunId===keptId),before.units.find(r=>r.testRunId===keptId));
   const fresh=await services.originalTest.create({token:person.token,bookletName:'OWNED.ADM.A'});assert.notEqual(fresh,a);a=fresh;await patch(person.token,a);
   assert.equal(flatten(JSON.parse(await read())).find(r=>r.loginName===selection.loginName&&r.bookletName==='OWNED.ADM.A').bookletLabel,'Changed current Booklet A β');
  });
  await t.test('empty and unopened Tests can be selected even when absent from the administration list',async()=>{
   const p=await auth(peers[0]),old=await services.originalTest.create({token:p.token,bookletName:'OWNED.ADM.B'});
   assert.ok(!flatten(JSON.parse(await read())).some(r=>r.loginName===peers[0]&&r.bookletName==='OWNED.ADM.B'));
   await services.originalTestAdministration.delete({...scope,personSessions:[{loginName:peers[0],bookletName:'OWNED.ADM.B',code:null,nameSuffix:null}]});
   await assert.rejects(services.originalTest.read({token:p.token,testNumber:old}),e=>e.statusCode===403);
   assert.equal((await services.originalAuthentication.read({token:p.token})).participantSession.participantSessionId,p.participantSession.participantSessionId);
  });
  await t.test('real in-flight Test and Unit state, answer and log requests cannot restore a selected Test',async()=>{
   for(const operation of ['test-state','unit-state','unit-response','test-log']){
    a=await services.originalTest.create({token:person.token,bookletName:'OWNED.ADM.A'});await patch(person.token,a);
    const mapping=await repository.findOriginalTestNumber({testNumber:a,...ids,participantSessionId:person.participantSession.participantSessionId});
    const method=operation==='test-state'?'mutateParticipantRun':operation==='test-log'?'appendOriginalTestLogs':'mutateOriginalUnit';
    let release,entered;const gate=new Promise(r=>release=r),entry=new Promise(r=>entered=r);
    const delayed=new Proxy(repository,{get(target,key){if(key===method)return async(...args)=>{entered();await gate;return target[key](...args);};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});
    const runtime=createFirstSliceServices({repository:delayed,originalXmlSchemaValidator:validator,xmlSchemaProfile:'original-19'}),request={token:person.token,testNumber:a,unitName:'OWNED.ADM.UNIT'};
    const pending=(operation==='test-state'?runtime.originalTest.patchState({...request,patch:[{key:'LATE',content:privateState,timeStamp:++clock}]})
     :operation==='test-log'?runtime.originalTest.putLog({...request,body:[{key:'LATE',content:privateState,timeStamp:++clock}]})
     :operation==='unit-state'?runtime.originalUnit.patchState({...request,body:{newState:[{key:'LATE',content:privateState,timeStamp:++clock}]}})
     :runtime.originalUnit.putResponse({...request,body:{timeStamp:++clock,dataParts:{owned:privateState}}})).then(value=>({value}),error=>({error}));
    try{await Promise.race([entry,pending.then(r=>{throw r.error??Error('Request missed its real durable writer');})]);await removeA();}finally{release();}
    const result=await pending;assert.ok(result.error,operation);assert.ok([403,409,410].includes(result.error.statusCode),operation);
    assert.equal(await repository.getTestRunById(mapping.testRunId),null);assert.ok(!(await repository.listOriginalUnitsByWorkspace(ids.tenantId,ids.workspaceId)).some(r=>r.testRunId===mapping.testRunId));assert.ok(!(await repository.listParticipantTestLogsByWorkspace(ids.tenantId,ids.workspaceId)).some(r=>r.testRunId===mapping.testRunId));
   }
   a=await services.originalTest.create({token:person.token,bookletName:'OWNED.ADM.A'});await patch(person.token,a);
  });
  if(kind==='postgres')await t.test('independent native Unit writer actually waits on selected deletion and cannot recreate its removed parent',{timeout:30000},async race=>{
   const old=a,mapping=await repository.findOriginalTestNumber({testNumber:a,...ids,participantSessionId:person.participantSession.participantSessionId}),other=await createPostgresFirstSliceStorage(url.toString()),observer=new Pool({connectionString:url.toString()});
   let allowNativeWrite,reachedNativeWrite;const nativeGate=new Promise(r=>allowNativeWrite=r),nativeEntry=new Promise(r=>reachedNativeWrite=r);
   const pausedRepository=new Proxy(other.repository,{get(target,key){if(key==='mutateOriginalUnit')return async(...args)=>{reachedNativeWrite();await nativeGate;return target[key](...args);};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}}),runtime=createFirstSliceServices({repository:pausedRepository});
   let release,entered,writerEntered,deletionPid,writerPid,paused=false;const gate=new Promise(r=>release=r),entry=new Promise(r=>entered=r),writerEntry=new Promise(r=>writerEntered=r),query=Client.prototype.query;
   const hook=race.mock.method(Client.prototype,'query',function(...args){
    const text=typeof args[0]==='string'?args[0]:args[0]?.text??'';
    if(!paused&&text.startsWith('UPDATE original_participant_groups SET last_modified_at')){paused=true;deletionPid=this.processID;entered();return gate.then(()=>query.apply(this,args));}
    if(paused&&this.processID!==deletionPid&&!writerPid&&/FOR (?:KEY SHARE|NO KEY UPDATE|UPDATE)/.test(text)){writerPid=this.processID;writerEntered();}
    return query.apply(this,args);
   });
   const writing=runtime.originalUnit.patchState({token:person.token,testNumber:old,unitName:'OWNED.ADM.UNIT',body:{newState:[{key:'RACE',content:privateState,timeStamp:++clock}]}}).then(value=>({value}),error=>({error}));let deletion;
   try{
    await Promise.race([nativeEntry,writing.then(r=>{throw r.error??Error('Native request did not reach durable Unit writer');})]);
    deletion=removeA().then(value=>({value}),error=>({error}));
    await Promise.race([entry,deletion.then(r=>{throw r.error??Error('Deletion did not reach final clock write');})]);allowNativeWrite();
    await Promise.race([writerEntry,writing.then(r=>{throw r.error??Error('Writer did not reach actual lock');})]);
    let locked=false;const deadline=Date.now()+5000;while(Date.now()<deadline){if((await observer.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[writerPid])).rows[0]?.wait_event_type==='Lock'){locked=true;break;}await delay(10);}assert.equal(locked,true);
    release();assert.equal((await deletion).error,undefined);const result=await writing;assert.ok(result.error&&result.error.statusCode===409);
    assert.equal(await repository.getTestRunById(mapping.testRunId),null);assert.equal((await services.originalAuthentication.read({token:person.token})).participantSession.participantSessionId,person.participantSession.participantSessionId);
   }finally{release();allowNativeWrite();await Promise.allSettled([...(deletion?[deletion]:[]),writing]);hook.mock.restore();await other.shutdown();await observer.end();}
   a=await services.originalTest.create({token:person.token,bookletName:'OWNED.ADM.A'});await patch(person.token,a);
  });
  await t.test('completed snapshot remains fixed while actual Login move overtakes its projection',async()=>{
   const before=await read();let release,entered;const gate=new Promise(r=>release=r),entry=new Promise(r=>entered=r),delayed=new Proxy(repository,{get(target,key){if(key==='getOriginalTestAdministrationInventory')return async(...args)=>{const v=await target[key](...args);entered();await gate;return v;};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});
   const pending=createFirstSliceServices({repository:delayed}).originalTestAdministration.list(scope);
   try{await entry;await services.workspaceAdminRead.importParticipantRoster({...scope,rosterText:roster('OWNED.ADM.MOVED')});await services.originalAuthentication.login({name:'owned-adm-r53-code',password:''});}finally{release();}
   assert.equal(formatOriginalTestAdministrationJson(await pending),before);const current=JSON.parse(await read());assert.ok(current['OWNED.ADM.MOVED']);assert.equal(current['OWNED.ADM.MOVED'].length,2);
  });
 }finally{await close();if(created){assert.equal(Number((await admin.query('SELECT count(*) AS count FROM pg_stat_activity WHERE application_name=$1',[schema])).rows[0].count),0);await admin.query('DROP SCHEMA "'+schema+'" CASCADE');}await admin?.end();await rm(directory,{recursive:true,force:true});}
});

