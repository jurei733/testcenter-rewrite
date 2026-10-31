import {createProductionApiServer} from '../apps/api/dist/apps/api/src/index.js';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {mkdtemp,rm,readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {Pool} from 'pg';
import {createFirstSliceServices,OriginalReviewInteger} from '@testcenter-rewrite-app/application';
import {createInMemoryFirstSliceRepository} from '@testcenter-rewrite-app/memory-store';
import {createFileFirstSliceStorage} from '@testcenter-rewrite-app/file-store';
import {createSqliteFirstSliceStorage} from '@testcenter-rewrite-app/sqlite-store';
import {createPostgresFirstSliceStorage} from '@testcenter-rewrite-app/postgres-store';
import {prepareOriginalXmlSchemaValidator} from '../packages/application/dist/packages/application/src/original-xml-schema.js';

const validator=await prepareOriginalXmlSchemaValidator(resolve(process.env.FIRST_SLICE_XML_SCHEMA_CACHE||'.data/original-xml-schemas'),false);
const xml=(type,body)=>`<${type} xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/${type==='Unit'?'unit-xml/17.6':type==='Booklet'?'testcenter-booklet-xml/18.0':'testcenter-testtaker-xml/18.0'}">${body}</${type}>`;
const modes=['run-trial','run-review','run-demo','run-hot-return','run-hot-restart','run-simulation'];
const kinds=['memory','file','sqlite'];if(process.env.FIRST_SLICE_STORE==='postgres'){assert.ok(process.env.FIRST_SLICE_POSTGRES_URL);kinds.push('postgres');}
const body={entry:'Exact native Ω\n  second line',categories:'tech design',priority:2,reviewer:'Reviewer Ä',page:3,pagelabel:'Teilaufgabe β',userAgent:'Owned native agent',originalUnitId:'FIRST.ORIGINAL'};
test('actual Original operator Review fixture retains49 HTTP exchanges and authenticated JSON/CSV provenance',async()=>{
 const root=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-review-report-http/',import.meta.url),load=async name=>readFile(new URL(name,root));
 const manifest=JSON.parse(await load('manifest.json'));assert.equal(manifest.sourceCommit,'eedae41840cbe90e5547c0211da818bdf620f5aa');assert.equal(manifest.httpExchanges,49);
 for(const[name,digest]of Object.entries(manifest.files))assert.equal(createHash('sha256').update(await load(name)).digest('hex'),digest,name);
 const observed=JSON.parse(await load('observations.json')),proof=JSON.parse(await load('independent-verification.json'));assert.equal(observed.verified,true);assert.equal(observed.rows.length,49);assert.equal(observed.sourceCodeAndVendorUnmodified,true);assert.equal(observed.actualPostgresAndRedis,true);assert.equal(observed.sqlSeedsOrDaoStubs,false);assert.equal(observed.configuration.testMode,false);assert.equal(proof.allowTestMode,false);assert.equal(proof.xmlSchemaValidation,true);assert.equal(proof.sourceFilesReverified,137);assert.equal(proof.lockedProductionComposerPackagesReverified,19);assert.equal(proof.exactImage,manifest.backendImage);
 const rows=new Map(observed.rows.map(row=>[row.label,row]));for(const label of ['review-export-json','operator-review-json','operator-review-csv']){const row=rows.get(label);assert.equal(row.status,200);assert.equal(createHash('sha256').update(row.rawText).digest('hex'),row.bodySha256);}
 assert.equal(rows.get('review-export-json').rawText,rows.get('operator-review-json').rawText);assert.deepEqual(rows.get('operator-review-json').value.map(row=>row.unitname),['OWNED.UNIT','']);assert.match(rows.get('operator-review-csv').contentType,/^text\/csv/);assert.ok(rows.get('operator-review-csv').rawText.startsWith('\uFEFF'));assert.ok((await load('capture.mjs')).toString().includes('Accept:accept'));
});
for(const kind of kinds)test(`${kind}: native Review is scoped, durable and atomic`,async t=>{
 const directory=await mkdtemp(join(tmpdir(),'owned-native-review-')),file=join(directory,kind==='file'?'state.json':'state.sqlite');
 const schema='owned_native_review_'+randomUUID().replaceAll('-',''),url=kind==='postgres'?new URL(process.env.FIRST_SLICE_POSTGRES_URL):null;
 url?.searchParams.set('options','-c search_path='+schema);url?.searchParams.set('application_name',schema);
 let admin,storage,repository,services,at='2026-10-31T18:53:23.000Z';
 const open=async()=>{storage=kind==='memory'?storage??{repository:createInMemoryFirstSliceRepository(),shutdown:async()=>{}}:kind==='file'?await createFileFirstSliceStorage(file):kind==='sqlite'?createSqliteFirstSliceStorage(file):await createPostgresFirstSliceStorage(url.toString());
  repository=storage.repository;services=createFirstSliceServices({repository,originalXmlSchemaValidator:validator,xmlSchemaProfile:'original-19',now:()=>at});};
 const close=async()=>{if(kind!=='memory'){await storage?.shutdown();storage=undefined;}};
 const reopen=async()=>{await close();await open();};
 try{
  if(url){admin=new Pool({connectionString:process.env.FIRST_SLICE_POSTGRES_URL});await admin.query(`CREATE SCHEMA "${schema}"`);}
  await open();const tenant=await services.platform.createTenant({tenantKey:'owned-'+randomUUID(),displayName:'Owned native Review'}),workspace=await services.platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:'owned',displayName:'Owned native Review'});
  const scope={tenantKey:tenant.tenantKey,workspaceKey:workspace.workspaceKey};
  const upload=(fileName,sourceDocument,mediaType='application/xml')=>services.contentIntake.uploadWorkspaceFile({...scope,fileName,sourceDocument,mediaType});
  await upload('player.html','<html><script type="application/ld+json">'+JSON.stringify({id:'owned-review-player',version:'1.2.3',specVersion:'6.0',metadataVersion:'2.0',type:'player',name:[{lang:'en',value:'Owned Player'}]})+'</script><main>Owned</main></html>','text/html');
  await upload('unit.xml',xml('Unit','<Metadata><Id>OWNED.UNIT</Id><Label>Owned Unit</Label></Metadata><Definition player="owned-review-player@1.2.3">Owned definition</Definition>'));
  await upload('booklet.xml',xml('Booklet','<Metadata><Id>OWNED.REVIEW</Id><Label>  Booklet Ω  </Label></Metadata><Units><Unit id="OWNED.UNIT" label="  Unit β  "/></Units>'));
  await services.workspaceAdminRead.importParticipantRoster({...scope,rosterText:xml('Testtakers','<Metadata/><Group id="OWNED.GROUP" label="Owned group">'+modes.map(mode=>`<Login name="owned-${mode}" mode="${mode}"><Booklet>OWNED.REVIEW</Booklet></Login>`).join('')+'<Login name="owned-peer" mode="run-trial"><Booklet>OWNED.REVIEW</Booklet></Login></Group>')});
  const owner=await services.originalAuthentication.login({name:'owned-run-trial',password:''}),peer=await services.originalAuthentication.login({name:'owned-peer',password:''});
  assert.equal(owner.kind,'person');assert.equal(peer.kind,'person');
  const testNumber=await services.originalTest.create({token:owner.token,bookletName:'OWNED.REVIEW'}),peerNumber=await services.originalTest.create({token:peer.token,bookletName:'OWNED.REVIEW'});
  const request={token:owner.token,testNumber,unitName:'OWNED.UNIT'},booklet={...request,unitName:null};
  const storeScope=await services.originalReview.authorize({...request,write:false});let reviewId;
  if(kind==='sqlite'||kind==='postgres')await t.test('late migration receipt failure rolls back both new tables and preserves native people',async()=>{
   const before=await repository.getParticipantSessionById(owner.participantSession.participantSessionId);await close();
   const control=kind==='sqlite'?new DatabaseSync(file):new Pool({connectionString:url.toString()});
   const exec=sql=>kind==='sqlite'?Promise.resolve(control.exec(sql)):control.query(sql);
   const rows=sql=>kind==='sqlite'?Promise.resolve(control.prepare(sql).all()):control.query(sql).then(r=>r.rows);
   const version=Number((await rows("SELECT version FROM schema_migrations WHERE name='original_native_reviews'"))[0].version);
   try{
    await exec('DROP TABLE original_native_reviews; DROP TABLE original_native_review_counters; DELETE FROM schema_migrations WHERE version='+version);
    await exec(kind==='sqlite'?`CREATE TRIGGER owned_review_migration_failure BEFORE INSERT ON schema_migrations WHEN NEW.version=${version} BEGIN SELECT RAISE(ABORT,'owned Review migration failure'); END`:
     `CREATE FUNCTION owned_review_migration_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned Review migration failure'; END $$; CREATE TRIGGER owned_review_migration_failure BEFORE INSERT ON schema_migrations FOR EACH ROW WHEN (NEW.version=${version}) EXECUTE FUNCTION owned_review_migration_failure()`);
    await assert.rejects(()=>open(),/owned Review migration failure/);
    assert.equal(Number((await rows('SELECT MAX(version) AS version FROM schema_migrations'))[0].version),version-1);
    const existing=await rows(kind==='sqlite'?"SELECT name FROM sqlite_master WHERE type='table' AND name IN ('original_native_reviews','original_native_review_counters')":"SELECT tablename AS name FROM pg_tables WHERE schemaname=current_schema() AND tablename IN ('original_native_reviews','original_native_review_counters')");assert.deepEqual(existing,[]);
   }finally{
    await exec(kind==='sqlite'?'DROP TRIGGER owned_review_migration_failure':'DROP TRIGGER owned_review_migration_failure ON schema_migrations; DROP FUNCTION owned_review_migration_failure()');
    if(kind==='sqlite')control.close();else await control.end();
   }
   await open();assert.deepEqual(await repository.getParticipantSessionById(before.participantSessionId),before);
  });
  await t.test('first Unit and Booklet reviews have separate numeric spaces and exact native fields',async()=>{
   assert.equal(await services.originalReview.list(request),'[]');assert.equal(await services.originalReview.list(booklet),'[]');
   await services.originalReview.create({...request,body});await services.originalReview.create({...booklet,body});
   const unit=JSON.parse(await services.originalReview.list(request))[0],test=JSON.parse(await services.originalReview.list(booklet))[0];
   assert.equal(unit.id,1);assert.equal(test.id,1);assert.equal(unit.entry,body.entry);assert.equal(unit.categories,'tech design');assert.equal(unit.page,3);assert.equal(test.page,undefined);
   assert.equal(unit.originalUnitId,body.originalUnitId);assert.equal((await repository.getOriginalUnit({...storeScope,unitName:'OWNED.UNIT'})).originalUnitId,body.originalUnitId);
   reviewId=(await repository.listOriginalReviews(storeScope))[0].reviewId;
  });
  await t.test('updates preserve original Unit/page/browser provenance and bump only their own Review time',async()=>{
   at='2026-10-31T18:53:24.058Z';await services.originalReview.update({...request,reviewNumber:'1',body:{entry:'Edited Ω',categories:'content tech',priority:1,reviewer:null,pagelabel:'New label',page:99,userAgent:'forged',originalUnitId:'forged'}});
   const row=JSON.parse(await services.originalReview.list(request))[0];assert.equal(row.entry,'Edited Ω');assert.equal(row.page,3);assert.equal(row.userAgent,body.userAgent);assert.equal(row.originalUnitId,body.originalUnitId);assert.equal(row.reviewer,null);assert.ok(Date.parse(row.reviewtime)>=Date.parse(at));
   assert.equal(JSON.parse(await services.originalReview.list(booklet))[0].entry,body.entry);
  });
  await t.test('known fields and IDs survive an actual durable reopen',async()=>{
   const before=await services.originalReview.list(request);await reopen();assert.equal(await services.originalReview.list(request),before);
  });
  await t.test('native participant export uses current physical labels, raw categories and stored timestamps',async()=>{
   const json=await services.originalReview.export({token:owner.token,format:'json'}),csv=await services.originalReview.export({token:owner.token,format:'csv'});
   assert.equal(json.status,200);const rows=JSON.parse(json.body);assert.equal(rows.length,2);assert.equal(rows[0].bookletlabel,'  Booklet Ω  ');assert.equal(rows[0].unitlabel,'  Unit β  ');assert.equal(rows[0].groupname,'OWNED.GROUP');assert.equal(rows[0].category_content,true);assert.equal(rows[0].reviewtime,'2026-10-31 19:53:24');assert.equal(rows[0].page,3);assert.equal(rows[0].reviewer,null);
   assert.equal(csv.status,200);assert.ok(csv.body.includes('"Edited Ω"'));assert.ok(!csv.body.includes('[object Object]'));
   const empty=await services.originalReview.export({token:peer.token,format:'json'});assert.deepEqual(empty,{status:200,body:'[]'});
  });
  await t.test('native operator Review reports preserve Source Unit-before-Booklet collection order instead of UI edit sorting',async()=>{
   at='2026-10-31T18:53:25.000Z';await services.originalReview.update({...booklet,reviewNumber:'1',body:{...body,entry:'Updated later Booklet Ω'}});
   const native=await services.originalReview.export({token:owner.token,format:'json'});assert.deepEqual(JSON.parse(native.body).map(row=>row.unitname),['OWNED.UNIT','']);
   const csv=await services.originalReview.export({token:owner.token,format:'csv'}),archive=await services.workspaceAdminRead.exportOriginalResultArchive({...scope,groupKeys:['OWNED.GROUP']});
   const files=new Map();let offset=0;while(archive.body.readUInt32LE(offset)===0x04034b50){const len=archive.body.readUInt32LE(offset+18),n=archive.body.readUInt16LE(offset+26),start=offset+30+n+archive.body.readUInt16LE(offset+28);files.set(archive.body.subarray(offset+30,offset+30+n).toString(),archive.body.subarray(start,start+len).toString());offset=start+len;}
   assert.equal(files.get('reviews.json'),native.body,'Operator native row sequence must agree with Source grouping, irrespective of a later Booklet edit');assert.equal(files.get('reviews.csv'),csv.body);
  });
  await t.test('foreign people and wrong modes cannot read or mutate private Review data',async()=>{
   const before=await services.originalReview.list(request);
   await assert.rejects(()=>services.originalReview.list({...request,token:peer.token}),error=>error.statusCode===403);
   await assert.rejects(()=>services.originalReview.update({...request,token:peer.token,reviewNumber:'1',body}),error=>error.statusCode===403);
   await assert.rejects(()=>services.originalReview.delete({...request,token:peer.token,reviewNumber:'1'}),error=>error.statusCode===403);
   for(const mode of modes){const actor=mode==='run-trial'?owner:await services.originalAuthentication.login({name:'owned-'+mode,password:''});const ownTest=await services.originalTest.create({token:actor.token,bookletName:'OWNED.REVIEW'});
    if(mode==='run-trial'||mode==='run-review'){await services.originalReview.create({token:actor.token,testNumber:ownTest,unitName:null,body});}
    else await assert.rejects(()=>services.originalReview.create({token:actor.token,testNumber:ownTest,unitName:null,body}),error=>error.statusCode===403);
   }
   assert.equal(await services.originalReview.list(request),before);
  });
  await t.test('bad fields and missing numbers change no Review, Unit or identity',async()=>{
   const before=await services.originalReview.list(request);
   for(const malformed of [{},{entry:null,categories:''},{...body,categories:[]},{...body,page:9007199254740992},{...body,userAgent:'a'.repeat(513)}])await assert.rejects(()=>services.originalReview.create({...request,unitName:'UNSEEN',body:malformed}),error=>error.statusCode===400);
   await assert.rejects(()=>services.originalReview.delete({...request,reviewNumber:'99999'}),error=>error.statusCode===404);
   assert.equal(await services.originalReview.list(request),before);assert.equal(await repository.getOriginalUnit({...storeScope,unitName:'UNSEEN'}),null);
  });
  await t.test('canonical edits and deletion update the same native Review without changing its provenance',async()=>{
   const row=await repository.getWorkspaceReviewById(reviewId);await repository.saveWorkspaceReview({...row,comment:'Changed through canonical boundary',updatedAt:at});
   assert.equal(JSON.parse(await services.originalReview.list(request))[0].entry,'Changed through canonical boundary');
   await assert.rejects(()=>repository.saveWorkspaceReview({...row,userAgent:'forged'}),error=>error.statusCode===409);
   await repository.deleteWorkspaceReview(reviewId);assert.equal(await services.originalReview.list(request),'[]');assert.ok(await repository.getOriginalUnit({...storeScope,unitName:'OWNED.UNIT'}));
  });
  if(kind==='file')await t.test('a real File publication failure leaves no new Unit, Review, counter or cached write',async()=>{
   const before=await services.originalReview.list(request),backup=file+'.owned-backup';
   await rename(file,backup);await mkdir(file);
   try{await assert.rejects(()=>services.originalReview.create({...request,unitName:'ROLLBACK',body}));assert.equal(await services.originalReview.list(request),before);assert.equal(await repository.getOriginalUnit({...storeScope,unitName:'ROLLBACK'}),null);}
   finally{await rm(file,{recursive:true});await rename(backup,file);}
   await reopen();assert.equal(await services.originalReview.list({...request,unitName:'ROLLBACK'}),'[]');assert.equal(await repository.getOriginalUnit({...storeScope,unitName:'ROLLBACK'}),null);
  });
  if(kind==='sqlite'||kind==='postgres')await t.test('a real final native INSERT failure rolls back Unit, projection and counter',async()=>{
   const db=kind==='sqlite'?new DatabaseSync(file):new Pool({connectionString:url.toString()});
   try{
    if(kind==='sqlite')db.exec("CREATE TRIGGER owned_review_fail BEFORE INSERT ON original_native_reviews BEGIN SELECT RAISE(ABORT,'owned late review failure'); END;");
    else await db.query("CREATE FUNCTION owned_review_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned late review failure'; END $$; CREATE TRIGGER owned_review_fail BEFORE INSERT ON original_native_reviews FOR EACH ROW EXECUTE FUNCTION owned_review_fail()");
    await assert.rejects(()=>services.originalReview.create({...request,unitName:'ROLLBACK',body}),/owned late review failure/);
   }finally{if(kind==='sqlite'){db.exec('DROP TRIGGER owned_review_fail');db.close();}else{await db.query('DROP TRIGGER owned_review_fail ON original_native_reviews; DROP FUNCTION owned_review_fail()');await db.end();}}
   await reopen();assert.equal(await services.originalReview.list({...request,unitName:'ROLLBACK'}),'[]');assert.equal(await repository.getOriginalUnit({...storeScope,unitName:'ROLLBACK'}),null);
   const rows=await repository.listWorkspaceReviewsByWorkspace(storeScope.tenantId,storeScope.workspaceId);assert.equal(rows.some(row=>row.unitKey==='ROLLBACK'),false);
  });
  await t.test('concurrent native creates allocate unique monotonic numbers and do not cross people',async()=>{
   const otherStorage=kind==='postgres'?await createPostgresFirstSliceStorage(url.toString()):null;
   try{
    const otherServices=otherStorage?createFirstSliceServices({repository:otherStorage.repository,originalXmlSchemaValidator:validator,xmlSchemaProfile:'original-19',now:()=>at}):services;
    await Promise.all(Array.from({length:6},(_,index)=>(index%2?otherServices:services).originalReview.create({...request,body:{...body,entry:'Concurrent '+index}})));
   }finally{await otherStorage?.shutdown();}
   const rows=JSON.parse(await services.originalReview.list(request));assert.equal(new Set(rows.map(row=>row.id)).size,rows.length);assert.equal(rows.length,6);assert.equal(Math.min(...rows.map(row=>row.id)),2,'A failed final write must not consume the Review number');
   await services.originalReview.create({token:peer.token,testNumber:peerNumber,unitName:'OWNED.UNIT',body:{...body,entry:'Private peer'}});
   const peerRows=JSON.parse(await services.originalReview.list({token:peer.token,testNumber:peerNumber,unitName:'OWNED.UNIT'}));assert.equal(peerRows.length,1);assert.equal(peerRows[0].entry,'Private peer');
  });
  if(kind==='sqlite'||kind==='postgres')await t.test('the protected HTTP boundary preserves raw int64 pages and IDs, all eight verbs and payload/auth gates',async()=>{
   const env={FIRST_SLICE_STORE:kind,FIRST_SLICE_SQLITE_FILE:file,FIRST_SLICE_BOOTSTRAP_DEMO:'false',FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',FIRST_SLICE_XML_SCHEMA_PROFILE:'original-19',FIRST_SLICE_PROOF_OF_WORK_SCOPES:'',FIRST_SLICE_MAX_JSON_BODY_BYTES:'4096',...(url?{FIRST_SLICE_POSTGRES_URL:url.toString()}:{})};
   const prior=new Map(Object.keys(env).map(key=>[key,process.env[key]]));let server;
   try{
    try{Object.assign(process.env,env);server=await createProductionApiServer();}finally{for(const [key,value]of prior){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
    await new Promise(done=>server.listen(0,'127.0.0.1',done));const base='http://127.0.0.1:'+server.address().port;
    const call=async(method,path,value,status,token=owner.token,accept='application/json')=>{
     const response=await fetch(base+path,{method,headers:{Accept:accept,...(token?{AuthToken:token}:{}),...(value===undefined?{}:{'Content-Type':'application/json'})},...(value===undefined?{}:{body:typeof value==='string'?value:JSON.stringify(value)}),signal:AbortSignal.timeout(15000)});
     const text=await response.text();assert.equal(response.status,status,method+' '+path+': '+text.slice(0,300));assert.equal(response.headers.get('cache-control'),'private, no-store');return{text,headers:response.headers};
    };
    const unitPath='/test/'+testNumber+'/unit/HTTP.REVIEW',testPath='/test/'+testNumber;
    await call('PUT',unitPath+'/review','{',401,null);await call('PUT',unitPath+'/review','{',403,peer.token);
    const denied=await services.originalAuthentication.login({name:'owned-run-hot-return',password:''});const deniedTest=await services.originalTest.create({token:denied.token,bookletName:'OWNED.REVIEW'});
    await call('PUT','/test/'+deniedTest+'/review','{',403,denied.token);
    await call('POST',unitPath+'/review',body,405);const missing=await call('PUT',unitPath+'/review',{},400);assert.equal(missing.text,'Required body-parameter is missing: `entry`');
    const malformed=await call('PUT',unitPath+'/review','{',500);assert.equal(malformed.text,'Internal error.');assert.match(malformed.headers.get('content-type'),/^text\/html/);assert.ok(malformed.headers.get('error-id'));
    await call('PUT',unitPath+'/review',{...body,entry:'x'.repeat(5000)},413);
    assert.equal((await call('GET',unitPath+'/reviews',undefined,200)).text,'[]');
    // Test fixture controls the real persistent counter. Public wire tokens
    // stay numeric; the client must preserve their exact decimal spelling.
    const control=kind==='sqlite'?new DatabaseSync(file):new Pool({connectionString:url.toString()});
    try{if(kind==='sqlite')control.prepare("UPDATE original_native_review_counters SET last_number=? WHERE kind='unit'").run('9007199254740992');else await control.query("UPDATE original_native_review_counters SET last_number=$1 WHERE kind='unit'",['9007199254740992']);}
    finally{if(kind==='sqlite')control.close();else await control.end();}
    const raw='{"entry":"HTTP exact Ω","categories":"tech","priority":2,"page":-9223372036854775808,"pagelabel":"Page β","userAgent":"Owned HTTP","originalUnitId":"HTTP.FIRST"}';
    await call('PUT',unitPath+'/review',raw,201);const listed=await call('GET',unitPath+'/reviews',undefined,200);
    assert.ok(listed.text.includes('"id":9007199254740993'));assert.ok(listed.text.includes('"page":-9223372036854775808'));
    const id='9007199254740993';await call('PATCH',unitPath+'/review/'+id,{entry:'HTTP edit Ω',categories:'content',priority:1,reviewer:null,pagelabel:'Edited label'},200);
    const updated=await call('GET',unitPath+'/reviews',undefined,200);assert.ok(updated.text.includes('"page":-9223372036854775808'));assert.ok(updated.text.includes('"userAgent":"Owned HTTP"'));
    await call('PUT',unitPath+'/review',{...body,page:'3'},400);await call('PUT',unitPath+'/review',{...body,page:{value:'3'}},400);
    const json=await call('GET','/reviews/export',undefined,200);assert.ok(json.text.includes('"page":-9223372036854775808'));
    const csv=await call('GET','/reviews/export',undefined,200,owner.token,'text/csv');assert.ok(csv.text.includes('-9223372036854775808'));assert.ok(!csv.text.includes('[object Object]'));
    // This is the actual protected operator ZIP boundary, not a repository or
    // authentication stub. Native participant credentials cannot authorize it.
    const archivePath='/api/v1/tenants/'+encodeURIComponent(scope.tenantKey)+'/workspaces/'+encodeURIComponent(scope.workspaceKey)+'/exports/original-results.zip?groupKey=OWNED.GROUP';
    assert.equal((await fetch(base+archivePath)).status,401);assert.equal((await fetch(base+archivePath,{headers:{AuthToken:owner.token}})).status,401);
    const adminPassword='Owned archive operator password';const boot=await fetch(base+'/api/v1/admin/auth/bootstrap',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'owned-archive-root',password:adminPassword})});assert.equal(boot.status,201);
    const signed=await fetch(base+'/api/v1/admin/auth/sign-in',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'owned-archive-root',password:adminPassword})});assert.equal(signed.status,200);const operator=await signed.json();assert.ok(operator.sessionToken);
    const zipped=await fetch(base+archivePath,{headers:{Authorization:'Bearer '+operator.sessionToken}});assert.equal(zipped.status,200);assert.equal(zipped.headers.get('cache-control'),'private, no-store');assert.match(zipped.headers.get('content-type'),/^application\/zip/);
    const zip=Buffer.from(await zipped.arrayBuffer());let zipOffset=0;const zipEntries=new Map();while(zip.readUInt32LE(zipOffset)===0x04034b50){const len=zip.readUInt32LE(zipOffset+18),names=zip.readUInt16LE(zipOffset+26),start=zipOffset+30+names+zip.readUInt16LE(zipOffset+28);zipEntries.set(zip.subarray(zipOffset+30,zipOffset+30+names).toString(),zip.subarray(start,start+len).toString());zipOffset=start+len;}
    assert.ok(zipEntries.get('reviews.json').includes('"page":-9223372036854775808'));assert.ok(zipEntries.get('reviews.csv').includes('"-9223372036854775808"'));assert.ok(!zipEntries.get('reviews.csv').includes('[object Object]'));
    await call('DELETE',unitPath+'/review/'+id,undefined,204);await call('DELETE',unitPath+'/review/'+id,undefined,404);assert.equal((await call('GET',unitPath+'/reviews',undefined,200)).text,'[]');
    const before=JSON.parse((await call('GET',testPath+'/reviews',undefined,200)).text);
    await call('PUT',testPath+'/review',body,201);const after=JSON.parse((await call('GET',testPath+'/reviews',undefined,200)).text);assert.equal(after.length,before.length+1);
    const existing=new Set(before.map(row=>row.id)),testId=after.find(row=>!existing.has(row.id)).id;
    await call('PATCH',testPath+'/review/'+testId,{entry:'HTTP booklet edit',categories:'design'},200);await call('DELETE',testPath+'/review/'+testId,undefined,204);
   }finally{if(server){server.closeAllConnections?.();await new Promise(done=>server.close(done));}}
  });
  await t.test('operator Original ZIP preserves raw native Review fields, edited clock and PHP category identities',async()=>{
   const peerRequest={token:peer.token,testNumber:peerNumber,unitName:'OWNED.UNIT'};
   at='2026-10-31T18:54:25.000Z';
   await services.originalReview.create({...peerRequest,body:{...body,entry:'Archive raw Ω',reviewer:null,categories:'1 01 0 tech  tech ',page:new OriginalReviewInteger('9007199254740993')}});
   const nativeRows=await repository.listOriginalReviews(await services.originalReview.authorize({...peerRequest,write:false}));
   const added=nativeRows.find(row=>row.entry==='Archive raw Ω');assert.ok(added);
   at='2026-10-31T18:55:26.058Z';await services.originalReview.update({...peerRequest,reviewNumber:added.reviewNumber,body:{entry:'Archive raw edited Ω',reviewer:null,categories:'1 01 0 tech  tech ',priority:2,pagelabel:'Edited page Ω'}});
   await reopen(); // Read raw integer/null/category metadata from the durable store.
   const native=await services.originalReview.export({token:peer.token,format:'json'});assert.equal(native.status,200);assert.ok(native.body.includes('"page":9007199254740993'));
   const archive=await services.workspaceAdminRead.exportOriginalResultArchive({...scope,groupKeys:['OWNED.GROUP']});
   const entries=new Map();let offset=0;while(archive.body.readUInt32LE(offset)===0x04034b50){const length=archive.body.readUInt32LE(offset+18),nameLength=archive.body.readUInt16LE(offset+26),start=offset+30+nameLength+archive.body.readUInt16LE(offset+28);entries.set(archive.body.subarray(offset+30,offset+30+nameLength).toString('utf8'),archive.body.subarray(start,start+length).toString('utf8'));offset=start+length;}
   const raw=entries.get('reviews.json');assert.ok(raw.includes('"page":9007199254740993'),'The operator JSON must retain the literal numeric page, without a rounded or null projection');
   const parse=text=>JSON.parse(text,(key,value,context)=>key==='page'&&typeof value==='number'&&!Number.isSafeInteger(value)?{rawNumericToken:context.source}:value);
   const expected=parse(native.body).find(row=>row.entry==='Archive raw edited Ω'),actual=parse(raw).find(row=>row.entry==='Archive raw edited Ω');assert.ok(expected&&actual);
   assert.equal(expected.reviewtime,'2026-10-31 19:55:26');assert.equal(expected.reviewer,null);assert.equal(expected.priority,2);assert.equal(expected.category_1,true);assert.equal(Object.hasOwn(expected,'category_01'),false);
   for(const [key,value]of Object.entries(expected))assert.deepEqual(actual[key],value,key);
   assert.equal(Object.hasOwn(actual,'category_01'),false);
   const csv=entries.get('reviews.csv');assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('"9007199254740993"'));assert.ok(!csv.includes('[object Object]'));
   const empty=await services.workspaceAdminRead.exportOriginalResultArchive({...scope,groupKeys:[]});let i=0;while(empty.body.readUInt32LE(i)===0x04034b50){const n=empty.body.readUInt16LE(i+26),start=i+30+n+empty.body.readUInt16LE(i+28),len=empty.body.readUInt32LE(i+18),name=empty.body.subarray(i+30,i+30+n).toString();if(name==='reviews.json')assert.equal(empty.body.subarray(start,start+len).toString(),'[]');i=start+len;}
  });
  await t.test('selected unknown native Review history fails closed while empty and unrelated group exports remain available',async()=>{
   const known=(await repository.listWorkspaceReviewsByWorkspace(storeScope.tenantId,storeScope.workspaceId)).find(row=>row.participantSessionId===peer.participantSession.participantSessionId);assert.ok(known);
   const legacy={...known,reviewId:randomUUID(),comment:'Owned legacy canonical Review'};await repository.saveWorkspaceReview(legacy);
   assert.equal((await repository.getWorkspaceReviewById(legacy.reviewId)).comment,legacy.comment);
   await assert.rejects(()=>services.workspaceAdminRead.exportOriginalResultArchive({...scope,groupKeys:['OWNED.GROUP']}),error=>error.statusCode===409);
   assert.ok((await services.workspaceAdminRead.exportOriginalResultArchive({...scope,groupKeys:[]})).body.length>0);
   assert.ok((await services.workspaceAdminRead.exportOriginalResultArchive({...scope,groupKeys:['OWNED.UNKNOWN']})).body.length>0);
   await repository.deleteWorkspaceReview(legacy.reviewId);
  });
 }finally{await storage?.shutdown();if(admin){await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);await admin.end();}await rm(directory,{recursive:true,force:true});}
});
