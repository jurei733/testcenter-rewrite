import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import test from 'node:test';
import {Pool} from 'pg';
import {createFirstSliceServices} from '@testcenter-rewrite-app/application';
import {createInMemoryFirstSliceRepository} from '@testcenter-rewrite-app/memory-store';
import {createFileFirstSliceStorage} from '@testcenter-rewrite-app/file-store';
import {createSqliteFirstSliceStorage} from '@testcenter-rewrite-app/sqlite-store';
import {createPostgresFirstSliceStorage} from '@testcenter-rewrite-app/postgres-store';
import {prepareOriginalXmlSchemaValidator} from '../packages/application/dist/packages/application/src/original-xml-schema.js';
const originalXmlSchemaValidator=await prepareOriginalXmlSchemaValidator(resolve(process.env.FIRST_SLICE_XML_SCHEMA_CACHE||'.data/original-xml-schemas'),process.env.FIRST_SLICE_XML_SCHEMA_DOWNLOAD!=='false');
const evidence=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-identities/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',evidence),'utf8'));
const bytes=await readFile(new URL('receipt.json',evidence));
assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.files['receipt.json']);
assert.equal(manifest.sourceCommit,'eedae41840cbe90e5547c0211da818bdf620f5aa');assert.equal(manifest.runId,40041716400);
const receipt=JSON.parse(bytes);assert.equal(receipt.success,true);assert.equal(receipt.testMode,false);assert.equal(receipt.checks.length,47);
const native=receipt.checks.find(row=>row.name.startsWith('Test listing retains its first stored Booklet label'));
assert.equal(native.existing.bookletName,native.newTest.bookletName);
const id=native.existing.bookletName;
const metadata={id:'owned-identity-player',version:'1.2.9',specVersion:'6.0',metadataVersion:'2.0',type:'player',name:[{lang:'de',value:'Owned identity Player'}]};
const schemas={Unit:'unit-xml/17.6',Booklet:'testcenter-booklet-xml/18.0',Testtakers:'testcenter-testtaker-xml/18.0'};
const xml=(type,identity,label,body)=>`<${type} xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/${schemas[type]}"><Metadata>${type==='Testtakers'?'':`<Id>${identity}</Id><Label>${label}</Label>`}</Metadata>${body}</${type}>`;
const booklet=label=>xml('Booklet',id,label,'<Units><Unit id="OWNED.UNIT" label="Owned Unit"/></Units>');
const roster=()=>xml('Testtakers','','',`<Group id="ORACLE.IDENTITY" label="  Identity original Ω  ">${['owned-native-identity','owned-new-booklet-label','owned-padded-label','owned-empty-label'].map(name=>`<Login name="${name}" pw="Owned-identity-secret" mode="run-hot-return"><Booklet>${id}</Booklet></Login>`).join('')}</Group>`);
const json=value=>JSON.parse(JSON.stringify(value));
const kinds=process.env.FIRST_SLICE_STORE==='postgres'?['postgres']:['memory','file','sqlite'];
for(const kind of kinds)test(`${kind}: real native live-file replacement retains first Test label and name, while new Tests capture the current label`,async t=>{
 const directory=await mkdtemp(join(tmpdir(),'owned-native-test-')),file=join(directory,kind==='file'?'state.json':'state.sqlite');
 const schema='owned_test_identity_'+randomUUID().replaceAll('-',''),url=kind==='postgres'?new URL(process.env.FIRST_SLICE_POSTGRES_URL):null;
 url?.searchParams.set('options','-c search_path='+schema);
 let pool,storage,repository,services,created=false,parent,run,newRun;
 const open=async()=>{
  storage=kind==='memory'?storage??{repository:createInMemoryFirstSliceRepository(),shutdown:async()=>{}}:kind==='file'?await createFileFirstSliceStorage(file):kind==='sqlite'?createSqliteFirstSliceStorage(file):await createPostgresFirstSliceStorage(url.toString());
  repository=storage.repository;services=createFirstSliceServices({repository,originalXmlSchemaValidator,xmlSchemaProfile:'original-19',requireLoginPassword:true});
 };
 try{
  if(url){pool=new Pool({connectionString:process.env.FIRST_SLICE_POSTGRES_URL});await pool.query(`CREATE SCHEMA "${schema}"`);created=true;}
  await open();
  const tenant=await services.platform.createTenant({tenantKey:'owned-'+randomUUID(),displayName:'Owned native Test identity'});
  const workspace=await services.platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:'owned',displayName:'Owned native Test identity'});
  const scope={tenantKey:tenant.tenantKey,workspaceKey:workspace.workspaceKey};
  const upload=(fileName,sourceDocument,mediaType='application/xml')=>services.contentIntake.uploadWorkspaceFile({...scope,fileName,sourceDocument,mediaType});
  const login=(loginKey='owned-native-identity')=>services.participantRuntime.signIn({...scope,loginKey,password:'Owned-identity-secret'});
  await t.test('validated Source XML intake captures the first physical Booklet label, ignoring caller metadata',async()=>{
   await upload('player.html','<html><script type="application/ld+json">'+JSON.stringify(metadata)+'</script><main>Owned Player</main></html>','text/html');
   await upload('unit.xml',xml('Unit','OWNED.UNIT','Owned Unit','<Definition player="owned-identity-player@1.2.9"><![CDATA[Owned Unit]]></Definition>'));
   await upload('booklet.xml',booklet(native.existing.bookletLabel));await upload('people.xml',roster());
   parent=await login();assert.equal(parent.originalLoginKey,'owned-native-identity');
   run=await services.participantRuntime.launch({participantSessionId:parent.participantSessionId,bookletKey:id,bookletLabel:'Forged first label'});
   assert.equal(run.originalResultState.bookletName,native.existing.bookletName);assert.equal(run.originalResultState.bookletLabel,native.existing.bookletLabel);
   await services.participantRuntime.saveProgress({testRunId:run.testRunId,unitResponse:'Exact saved Ä/β',status:'running',originalResultState:{bookletLabel:'Forged progress label'}});
   run=await repository.getTestRunById(run.testRunId);assert.equal(run.originalResultState.bookletLabel,native.existing.bookletLabel);assert.equal(run.unitResponses['OWNED.UNIT'],'Exact saved Ä/β');
  });
  await t.test('a live replacement updates available content without rewriting the existing Test or its answers and clocks',async()=>{
   const before=await repository.getTestRunById(run.testRunId);
   await upload('booklet.xml',booklet(native.newTest.bookletLabel));
   const state=await services.participantRuntime.getRuntimeState({participantSessionId:parent.participantSessionId});
   assert.equal(state.booklets[0].displayLabel,native.newTest.bookletLabel);
   assert.deepEqual(await repository.getTestRunById(run.testRunId),before);
   const reentry=await login();assert.equal(reentry.participantSessionId,parent.participantSessionId);
   const resumed=await services.participantRuntime.launch({participantSessionId:parent.participantSessionId,bookletKey:id});
   assert.equal(resumed.testRunId,run.testRunId);assert.equal(resumed.originalResultState.bookletLabel,native.existing.bookletLabel);assert.deepEqual(resumed.unitResponses,before.unitResponses);
  });
  await t.test('a new person and Test capture the actual replacement label independently',async()=>{
   const person=await login('owned-new-booklet-label');assert.notEqual(person.participantSessionId,parent.participantSessionId);
   newRun=await services.participantRuntime.launch({participantSessionId:person.participantSessionId,bookletKey:id});
   assert.notEqual(newRun.testRunId,run.testRunId);assert.equal(newRun.originalResultState.bookletName,native.newTest.bookletName);assert.equal(newRun.originalResultState.bookletLabel,native.newTest.bookletLabel);
   assert.equal((await repository.getTestRunById(run.testRunId)).originalResultState.bookletLabel,native.existing.bookletLabel);
  });
  await t.test('raw physical XML labels retain padding/newlines and empty labels independently of display normalization',async()=>{
   for(const [name,label]of [['owned-padded-label','  Padded Ω\n  '],['owned-empty-label','']]){
    await upload('booklet.xml',booklet(label));const person=await login(name);
    const fresh=await services.participantRuntime.launch({participantSessionId:person.participantSessionId,bookletKey:id});
    assert.equal(fresh.originalResultState.bookletLabel,label);assert.equal(fresh.originalResultState.bookletName,id);
   }
   assert.equal((await repository.getTestRunById(run.testRunId)).originalResultState.bookletLabel,native.existing.bookletLabel);
   assert.equal((await repository.getTestRunById(newRun.testRunId)).originalResultState.bookletLabel,native.newTest.bookletLabel);
  });
  await t.test('an atomic Run projection cannot replace the stored first identity',async()=>{
   const current=await repository.getTestRunById(run.testRunId);
   await repository.mutateParticipantRun({testRunId:current.testRunId,participantSessionId:parent.participantSessionId,tenantId:parent.tenantId,workspaceId:parent.workspaceId,contentReleaseId:parent.contentReleaseId},({testRun})=>({testRun:{...testRun,originalResultState:{...testRun.originalResultState,bookletName:'Forged name',bookletLabel:'Forged label'}},testLogs:[],activityEvents:[]}));
   const stored=await repository.getTestRunById(run.testRunId);assert.equal(stored.originalResultState.bookletName,native.existing.bookletName);assert.equal(stored.originalResultState.bookletLabel,native.existing.bookletLabel);
   assert.deepEqual(stored.unitResponses,current.unitResponses);
  });
  if(kind!=='memory')await t.test('both independent stored identities survive durable reopening',async()=>{
   const before=await repository.listTestRunsByWorkspace(parent.tenantId,parent.workspaceId);await storage.shutdown();await open();
   assert.deepEqual(json(await repository.listTestRunsByWorkspace(parent.tenantId,parent.workspaceId)).sort((a,b)=>a.testRunId.localeCompare(b.testRunId)),json(before).sort((a,b)=>a.testRunId.localeCompare(b.testRunId)));
  });
  await t.test('a malformed persisted identity rejects atomic writes without partial effects and later valid writes recover',async()=>{
   const current=await repository.getTestRunById(run.testRunId);
   await repository.saveTestRun({...current,originalResultState:{...current.originalResultState,bookletName:null}});
   const corrupt=await repository.getTestRunById(run.testRunId);
   await assert.rejects(repository.mutateParticipantRun({testRunId:current.testRunId,participantSessionId:parent.participantSessionId,tenantId:parent.tenantId,workspaceId:parent.workspaceId,contentReleaseId:parent.contentReleaseId},({testRun})=>({testRun:{...testRun,status:'paused'},testLogs:[],activityEvents:[]})),/Invalid persisted Original Test identity/);
   assert.deepEqual(await repository.getTestRunById(run.testRunId),corrupt);
   await repository.saveTestRun(current);assert.equal((await services.participantRuntime.launch({participantSessionId:parent.participantSessionId,bookletKey:id})).testRunId,current.testRunId);
  });
  await t.test('unknown legacy identity stays unknown after later roster/file replacement and reopening',async()=>{
   const current=await repository.getTestRunById(run.testRunId),{bookletName,bookletLabel,...clocks}=current.originalResultState;
   await repository.saveTestRun({...current,originalResultState:clocks});
   await services.participantRuntime.launch({participantSessionId:parent.participantSessionId,bookletKey:id});
   const legacy=await repository.getTestRunById(run.testRunId);assert.equal(legacy.originalResultState.bookletName,undefined);assert.equal(legacy.originalResultState.bookletLabel,undefined);
   assert.equal((await repository.getTestRunById(newRun.testRunId)).originalResultState.bookletLabel,native.newTest.bookletLabel);
  });
 }finally{await storage?.shutdown();if(created)await pool.query(`DROP SCHEMA "${schema}" CASCADE`);await pool?.end();await rm(directory,{recursive:true,force:true});}
});
