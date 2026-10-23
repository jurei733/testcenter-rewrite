import assert from 'node:assert/strict';
import {randomUUID, createHash} from 'node:crypto';
import {mkdtemp, rm, readFile, writeFile, rename, mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {prepareOriginalXmlSchemaValidator} from '../packages/application/dist/packages/application/src/original-xml-schema.js';
const originalXmlSchemaValidator=await prepareOriginalXmlSchemaValidator(resolve(process.env.FIRST_SLICE_XML_SCHEMA_CACHE || '.data/original-xml-schemas'),process.env.FIRST_SLICE_XML_SCHEMA_DOWNLOAD !== 'false');
import test from 'node:test';
import {Pool} from 'pg';
import {DatabaseSync} from 'node:sqlite';
import {createFirstSliceServices} from '@testcenter-rewrite-app/application';
import {compileBookletRuntimePolicy} from '@testcenter-rewrite-app/contracts';
import {parseParticipantRosterText,parseOriginalTestcenterOperationalLogins} from '@testcenter-rewrite-app/contracts/participant-roster';
import {createInMemoryFirstSliceRepository} from '@testcenter-rewrite-app/memory-store';
import {createFileFirstSliceStorage} from '@testcenter-rewrite-app/file-store';
import {createSqliteFirstSliceStorage} from '@testcenter-rewrite-app/sqlite-store';
import {createPostgresFirstSliceStorage} from '@testcenter-rewrite-app/postgres-store';

const groupLabelCases=JSON.parse(await readFile(new URL('./fixtures/original-group-label-cases.json',import.meta.url),'utf8'));
const labelRoster=row=>`<Testtakers xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/testcenter-testtaker-xml/18.0"><Metadata/><Group id="LABEL.${row.id}" label="${row.attribute}"><Login name="label-${row.id.toLowerCase()}" pw="Owned-label-secret" mode="run-hot-return"><Booklet>owned</Booklet></Login><Login name="monitor-${row.id.toLowerCase()}" pw="Owned-monitor-secret" mode="monitor-group"/></Group></Testtakers>`;
for(const row of groupLabelCases)test(`Original XML ${row.id}: participant and operational group labels retain exact attribute values`,()=>{
 const xml=labelRoster(row),participants=parseParticipantRosterText(xml),monitors=parseOriginalTestcenterOperationalLogins(xml);
 assert.equal(participants.length,1);assert.equal(monitors.length,1);
 assert.equal(participants[0].groupKey,'LABEL.'+row.id);assert.equal(participants[0].groupLabel,row.expected);
 assert.equal(monitors[0].groupKey,'LABEL.'+row.id);assert.equal(monitors[0].groupLabel,row.expected);
});

test('actual unchanged production Source binds all eight exact XML vectors, empty-label failure/recovery and monitor-first evidence',async()=>{
 const root=new URL('../test-fixtures/original-testcenter/source-workspace-results/group-labels/',import.meta.url);
 const manifest=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));
 assert.equal(manifest.sourceCommit,'eedae41840cbe90e5547c0211da818bdf620f5aa');
 assert.equal(manifest.probeCommit,'64a0e1e3fb6e8617342512b54a762558ab53cab3');assert.equal(manifest.runId,40038272672);
 assert.equal(manifest.conclusion,'success');assert.equal(manifest.checks,41);assert.equal(Object.keys(manifest.files).length,11);
 for(const [name,sha]of Object.entries(manifest.files)){
  assert.match(name,/^[a-z0-9][a-z0-9.-]*$/);assert.equal(createHash('sha256').update(await readFile(new URL(name,root))).digest('hex'),sha,name);
 }
 const receipt=JSON.parse(await readFile(new URL('receipt.json',root),'utf8'));
 assert.equal(receipt.success,true);assert.equal(receipt.testMode,false);assert.equal(receipt.checks.length,41);
 for(const row of groupLabelCases){
  const name=row.id==='EMPTY'?'native empty XML group label fails login before password validation and captures no snapshot':'native XML group label preserves '+row.id.toLowerCase();
  const native=receipt.checks.find(check=>check.name===name);assert.ok(native,row.id);assert.equal(native.rawAttribute,row.attribute);
  if(row.id==='EMPTY'){
   assert.equal(native.validPasswordStatus,500);assert.equal(native.wrongPasswordStatus,500);assert.equal(native.recoveredLabel,'  Recovered empty Ω  ');
  }else{
   assert.equal(parseParticipantRosterText(labelRoster(row))[0].groupLabel,native.groupLabel,row.id+' actual Source label');
   assert.equal(parseOriginalTestcenterOperationalLogins(labelRoster(row))[0].groupLabel,native.groupLabel,row.id+' actual Source monitor label');
  }
 }
 const monitor=receipt.checks.find(check=>check.name==='native monitor credential login captures the group before any participant person exists');
 assert.equal(monitor.groupLabel,'  Monitor first Ω  ');assert.equal(monitor.reimportedLabel,'After monitor import');
});

test('actual unchanged Source qualifies frozen pre-code labels, group collation and whole-group snapshot recreation',async()=>{
 const root=new URL('../test-fixtures/original-testcenter/source-workspace-results/group-snapshots/',import.meta.url);
 const manifest=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));
 assert.equal(manifest.sourceCommit,'eedae41840cbe90e5547c0211da818bdf620f5aa');
 assert.equal(manifest.probeCommit,'a1f0677d9b37524e70118d5afd7e453b87365240');assert.equal(manifest.checks,32);
 for(const [name,sha]of Object.entries(manifest.files)){
  assert.match(name,/^[a-z0-9][a-z0-9.-]*$/);assert.equal(createHash('sha256').update(await readFile(new URL(name,root))).digest('hex'),sha,name);
 }
 const receipt=JSON.parse(await readFile(new URL('receipt.json',root),'utf8'));
 assert.equal(receipt.success,true);assert.equal(receipt.testMode,false);assert.equal(receipt.checks.length,32);
 const frozen=receipt.checks.find(row=>row.name.startsWith('credential login freezes group label'));
 assert.equal(frozen.codeRequired,true);assert.equal(frozen.groupLabel,'Before code');assert.equal(frozen.reimportedLabel,'After roster import');
 const collated=receipt.checks.find(row=>row.name.startsWith('production german2_ci merges case'));
 assert.deepEqual(collated.groups.map(row=>[row.groupName,row.groupLabel,row.bookletsStarted]).sort(),[['ORACLE.COLL.Cafe','Accent distinct',1],['ORACLE.COLL.Café','Case first',3]]);
 const recreated=receipt.checks.find(row=>row.name.startsWith('whole-group result deletion removes the snapshot'));
 assert.equal(recreated.groupLabel,'After roster import');assert.equal(recreated.groupName,frozen.groupName);
});

const stamp=n=>new Date(Date.parse('2026-10-23T10:00:00.000Z')+n*60000).toISOString();
const kinds=['memory','file','sqlite'];
if(process.env.FIRST_SLICE_STORE==='postgres'){assert.ok(process.env.FIRST_SLICE_POSTGRES_URL);kinds.push('postgres');}
for(const kind of kinds)test(`${kind}: Original group snapshot belongs to credential login, independently of rosters and person codes`,async t=>{
 const directory=await mkdtemp(join(tmpdir(),'owned-original-group-')),file=join(directory,kind==='file'?'state.json':'state.sqlite');
 const schema='owned_group_'+randomUUID().replaceAll('-',''),url=kind==='postgres'?new URL(process.env.FIRST_SLICE_POSTGRES_URL):null;
 url?.searchParams.set('options','-c search_path='+schema);
 let storage,repository,root,created=false,clock=0;
 const open=async()=>{
  storage=kind==='memory'?storage??{repository:createInMemoryFirstSliceRepository(),shutdown:async()=>{}}
   :kind==='file'?await createFileFirstSliceStorage(file)
   :kind==='sqlite'?await createSqliteFirstSliceStorage(file):await createPostgresFirstSliceStorage(url.toString());
  repository=storage.repository;
 };
 const service=()=>createFirstSliceServices({repository,now:()=>stamp(clock),requireLoginPassword:true,originalXmlSchemaValidator});
 try{
  if(url){root=new Pool({connectionString:process.env.FIRST_SLICE_POSTGRES_URL});await root.query(`CREATE SCHEMA "${schema}"`);created=true;}
  await open();
  const tenant=await service().platform.createTenant({tenantKey:'owned-'+randomUUID(),displayName:'Owned groups'});
  const seedWorkspace=async workspaceKey=>{
   const workspace=await service().platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey,displayName:'Owned groups'}),contentReleaseId=randomUUID();
   const scope={tenantId:tenant.tenantId,workspaceId:workspace.workspaceId};
   await repository.saveContentRelease({...scope,contentReleaseId,importJobId:contentReleaseId,releaseLabel:'Owned',status:'active',createdAt:stamp(0),activatedAt:stamp(0),
    runtimeSnapshot:{bookletEntries:[{bookletKey:'owned',displayLabel:'Owned booklet',policy:compileBookletRuntimePolicy({}),testletEntries:[],unitEntries:[]}]}});
   return {...scope,tenantKey:tenant.tenantKey,workspaceKey};
  };
  const workspace=await seedWorkspace('owned'),foreign=await seedWorkspace('foreign');
  const list=(scope=workspace)=>repository.listOriginalParticipantGroupsByWorkspace(scope.tenantId,scope.workspaceId);
  const importRoster=(label,extra=[])=>service().workspaceAdminRead.importParticipantRoster({tenantKey:tenant.tenantKey,workspaceKey:'owned',rosterText:JSON.stringify([
   {loginKey:'coded',password:'Owned-coded-secret',groupKey:'Original.Group',groupLabel:label,booklets:[{id:'owned',codes:'AbC'}]},
   {loginKey:'simple',password:'Owned-simple-secret',groupKey:'Simple.Group',groupLabel:'Simple initial',booklets:[{id:'owned'}]},
   {loginKey:'future',password:'Owned-future-secret',groupKey:'Future.Group',validFrom:stamp(60),booklets:[{id:'owned'}]},
   {loginKey:'expired',password:'Owned-expired-secret',groupKey:'Expired.Group',validTo:stamp(-60),booklets:[{id:'owned'}]},...extra])});
  const signIn=(loginKey='coded',extra={})=>service().participantRuntime.signIn({tenantKey:tenant.tenantKey,workspaceKey:'owned',loginKey,password:'Owned-'+loginKey+'-secret',...extra});
  await importRoster('First authored label');
  await t.test('import and invalid credentials or absolute access windows create no group',async()=>{
   assert.deepEqual(await list(),[]);
   for(const [loginKey,extra,code] of [['coded',{password:'wrong'},'participant_password_invalid'],['absent',{},'participant_login_invalid'],['future',{},'participant_access_not_started'],['expired',{},'participant_access_expired']]){
    await assert.rejects(signIn(loginKey,extra),error=>error.errorCode===code);assert.deepEqual(await list(),[]);
   }
  });
  let first;
  await t.test('validated password creates the group before missing or incorrect person code, with server-owned label and time',async()=>{
   clock=1;
   await assert.rejects(signIn('coded',{groupLabel:'forged',createdAt:stamp(900),lastModifiedAt:stamp(900)}),error=>error.errorCode==='participant_code_required');
   first={tenantId:workspace.tenantId,workspaceId:workspace.workspaceId,groupKey:'Original.Group',groupLabel:'First authored label',createdAt:stamp(1),lastModifiedAt:stamp(1)};
   assert.deepEqual(await list(),[first]);
   assert.deepEqual(await repository.listParticipantSessionsByWorkspace(workspace.tenantId,workspace.workspaceId),[]);
   clock=2;
   await assert.rejects(signIn('coded',{participantCode:'wrong'}),error=>error.errorCode==='participant_code_invalid');
   assert.deepEqual(await list(),[first]);
  });
  await t.test('later roster labels and repeated successful code logins preserve the first snapshot',async()=>{
   clock=3;await importRoster('Later imported label');
   assert.deepEqual(await list(),[first]);
   const session=await signIn('coded',{participantCode:'abc'});
   assert.equal(session.groupKey,'Original.Group');assert.equal(session.participantCode,'AbC');
   clock=4;assert.equal((await signIn('coded',{participantCode:'ABC'})).participantSessionId,session.participantSessionId);
   assert.deepEqual(await list(),[first]);
   assert.equal((await repository.listParticipantRosterEntriesByWorkspace(workspace.tenantId,workspace.workspaceId)).find(row=>row.loginKey==='coded').groupLabel,'Later imported label');
  });
  await t.test('no-code login also creates a snapshot; caller mutation cannot rewrite any stored label',async()=>{
   clock=5;await signIn('simple');
   const before=await list(),altered=await list();altered[0].groupLabel='mutated';
   assert.deepEqual(await list(),before);
   const existing=await repository.getOrCreateOriginalParticipantGroup({...first,groupLabel:'Replacement',createdAt:stamp(99)});existing.groupLabel='mutated again';
   assert.deepEqual(await list(),before);
  });
  await t.test('native XML labels survive import, storage, credential snapshots and durable reopen, including native empty-label failure',async()=>{
   clock=5;const expected=new Map(groupLabelCases.map(row=>[row.id,row.expected]));
   for(const row of groupLabelCases){
    await service().workspaceAdminRead.importParticipantRoster({tenantKey:tenant.tenantKey,workspaceKey:'owned',rosterText:labelRoster(row)});
    const roster=(await repository.listParticipantRosterEntriesByWorkspace(workspace.tenantId,workspace.workspaceId)).find(entry=>entry.loginKey==='label-'+row.id.toLowerCase());
    assert.equal(roster.groupLabel,row.expected,row.id+' roster');
    if(row.id==='EMPTY'){
     if(kind!=='memory'){await storage.shutdown();await open();}
     assert.equal((await repository.listParticipantRosterEntriesByWorkspace(workspace.tenantId,workspace.workspaceId)).find(entry=>entry.loginKey==='label-empty').groupLabel,'');
     for(const password of ['Owned-label-secret','wrong'])await assert.rejects(signIn('label-empty',{password}),error=>error.statusCode===500&&error.errorCode==='original_group_label_invalid');
     assert.ok(!(await list()).some(group=>group.groupKey==='LABEL.EMPTY'));
     expected.set(row.id,'  Recovered empty Ω  ');
     await service().workspaceAdminRead.importParticipantRoster({tenantKey:tenant.tenantKey,workspaceKey:'owned',rosterText:labelRoster({...row,attribute:expected.get(row.id)})});
    }
    await signIn('label-'+row.id.toLowerCase(),{password:'Owned-label-secret'});
    assert.equal((await list()).find(group=>group.groupKey==='LABEL.'+row.id).groupLabel,expected.get(row.id),row.id+' snapshot');
   }
   if(kind!=='memory'){await storage.shutdown();await open();}
   for(const row of groupLabelCases){
    const roster=(await repository.listParticipantRosterEntriesByWorkspace(workspace.tenantId,workspace.workspaceId)).find(entry=>entry.loginKey==='label-'+row.id.toLowerCase());
    assert.equal(roster.groupLabel,expected.get(row.id),row.id+' reopened roster');
    assert.equal((await list()).find(group=>group.groupKey==='LABEL.'+row.id).groupLabel,expected.get(row.id),row.id+' reopened snapshot');
   }
  });
  await t.test('case-equivalent concurrent names choose one first snapshot; accents and workspaces remain distinct',async()=>{
   const input={tenantId:workspace.tenantId,workspaceId:workspace.workspaceId,groupKey:'Parallél',groupLabel:'First parallel label',createdAt:stamp(6)};
   const results=await Promise.all(Array.from({length:12},(_,i)=>repository.getOrCreateOriginalParticipantGroup({...input,groupKey:i%2?'PARALLÉL':'Parallél',groupLabel:'Label '+i,createdAt:stamp(i+6)})));
   assert.ok(results.every(value=>JSON.stringify(value)===JSON.stringify(results[0])));
   assert.equal((await list()).filter(row=>/^parallél$/i.test(row.groupKey)).length,1);
   const accent=await repository.getOrCreateOriginalParticipantGroup({...input,groupKey:'Parallel'});assert.equal(accent.groupKey,'Parallel');
   const composed=await repository.getOrCreateOriginalParticipantGroup({...input,groupKey:'Paralle\u0301l',groupLabel:'Must retain existing'});assert.deepEqual(composed,results[0]);
   const isolated=await repository.getOrCreateOriginalParticipantGroup({...input,workspaceId:foreign.workspaceId,groupLabel:'Private foreign'});
   assert.deepEqual(await list(foreign),[isolated]);assert.ok(!(await list()).some(row=>row.groupLabel==='Private foreign'));
   assert.equal(await repository.getOrCreateOriginalParticipantGroup({...input,tenantId:'foreign-tenant'}),null);
  });
  await t.test('durable reopen preserves snapshots; historical sessions and current rosters never invent unknown history',async()=>{
   const before=await list();
   if(kind!=='memory'){await storage.shutdown();await open();}
   assert.deepEqual((await list()).sort((a,b)=>a.groupKey.localeCompare(b.groupKey)),before.sort((a,b)=>a.groupKey.localeCompare(b.groupKey)));
   const legacy=await seedWorkspace('legacy');
   await repository.saveParticipantSession({...legacy,contentReleaseId:'historical',participantSessionId:randomUUID(),loginKey:'old',groupKey:'Old.Group',status:'signed_in',createdAt:stamp(-90)});
   assert.deepEqual(await list(legacy),[]);
  });
  await t.test('invalid server metadata cannot partially create a group',async()=>{
   const before=await list();
   for(const change of [{createdAt:'invalid'},{groupKey:''},{groupLabel:null},{groupLabel:''}])await assert.rejects(repository.getOrCreateOriginalParticipantGroup({...first,groupKey:'invalid',...change}),TypeError);
   assert.deepEqual(await list(),before);
  });
  if(['sqlite','postgres'].includes(kind))await t.test('failed SQL insert rolls back the group and permits a complete later retry',async()=>{
   const control=kind==='sqlite'?new DatabaseSync(file):new Pool({connectionString:url.toString()}),before=await list();
   const execute=sql=>kind==='sqlite'?control.exec(sql):control.query(sql);
   try{
    await execute(kind==='sqlite'?"CREATE TRIGGER owned_group_fail BEFORE INSERT ON original_participant_groups WHEN NEW.group_key='Failed.SQL' BEGIN SELECT RAISE(ABORT,'owned group failure'); END;"
     :"CREATE FUNCTION owned_group_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.group_key='Failed.SQL' THEN RAISE EXCEPTION 'owned group failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER owned_group_fail BEFORE INSERT ON original_participant_groups FOR EACH ROW EXECUTE FUNCTION owned_group_fail();");
    await assert.rejects(repository.getOrCreateOriginalParticipantGroup({...first,groupKey:'Failed.SQL'}),/owned group failure/);assert.deepEqual(await list(),before);
    await execute(kind==='sqlite'?'DROP TRIGGER owned_group_fail':'DROP TRIGGER owned_group_fail ON original_participant_groups; DROP FUNCTION owned_group_fail()');
    const retry=await repository.getOrCreateOriginalParticipantGroup({...first,groupKey:'Failed.SQL',createdAt:stamp(8)});
    assert.equal(retry.createdAt,stamp(8));assert.equal(retry.lastModifiedAt,stamp(8));
   }finally{if(kind==='sqlite')control.close();else await control.end();}
  });
  if(kind==='file')await t.test('failed durable creation leaves both cached and persisted snapshots unchanged',async()=>{
   const before=await list(),backup=file+'.backup';await rename(file,backup);await mkdir(file);
   try{await assert.rejects(repository.getOrCreateOriginalParticipantGroup({...first,groupKey:'failed',groupLabel:'Must not persist'}));assert.deepEqual(await list(),before);}
   finally{await rm(file,{recursive:true,force:true});await rename(backup,file);}
   await storage.shutdown();await open();assert.deepEqual(await list(),before);
   // Older manifests lack this collection and must stay unknown, not reconstructed.
   await storage.shutdown();const document=JSON.parse(await readFile(file,'utf8'));delete document.originalParticipantGroups;await writeFile(file,JSON.stringify(document));await open();assert.deepEqual(await list(),[]);
   await repository.getOrCreateOriginalParticipantGroup(first);
  });
  await t.test('workspace cascade removes only its snapshots and missing-workspace logins cannot recreate orphans',async()=>{
   const foreignBefore=await list(foreign);
   const result=await repository.deleteWorkspaceAggregate({...workspace,auditEvent:{adminAuditEventId:randomUUID(),eventType:'workspace_deleted',actorAdminUserId:null,subjectAdminUserId:null,occurredAt:stamp(9),summary:'Owned deletion',details:{}}});
   assert.equal(result.deletedWorkspaceCount,1);assert.deepEqual(await list(),[]);assert.deepEqual(await list(foreign),foreignBefore);
   assert.equal(await repository.getOrCreateOriginalParticipantGroup(first),null);assert.deepEqual(await list(),[]);
  });
 }finally{
  await storage?.shutdown();if(created)await root.query(`DROP SCHEMA "${schema}" CASCADE`);await root?.end();await rm(directory,{recursive:true,force:true});
 }
});
