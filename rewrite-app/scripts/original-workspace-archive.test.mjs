import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {workspaceZip} from './workspace-zip-fixture.mjs';
import {createFirstSliceServices} from '@testcenter-rewrite-app/application';
import {createInMemoryFirstSliceRepository} from '@testcenter-rewrite-app/memory-store';
import {createFileFirstSliceStorage} from '@testcenter-rewrite-app/file-store';
import {createSqliteFirstSliceStorage} from '@testcenter-rewrite-app/sqlite-store';
import {createPostgresFirstSliceStorage} from '@testcenter-rewrite-app/postgres-store';
import {prepareOriginalXmlSchemaValidator} from '../packages/application/dist/packages/application/src/original-xml-schema.js';

const root=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-workspace-zip-http/',import.meta.url);
const source=JSON.parse(await readFile(new URL('observations.json',root))),inputs=JSON.parse(await readFile(new URL('inputs.json',root)));
const hash=value=>createHash('sha256').update(value).digest('hex');
const extra=JSON.parse(await readFile(new URL('extra/observations.json',root))),extraInputs=JSON.parse(await readFile(new URL('extra/inputs.json',root)));
const bytes=async(label,additional=false)=>{const input=(additional?extraInputs:inputs).find(row=>row.label===label);assert.ok(input);const value=Buffer.from(await readFile(new URL((additional?'extra/':'')+label+'.zip.base64',root),'utf8'),'base64');assert.equal(hash(value),input.archiveSha256);return value;};
const validator=await prepareOriginalXmlSchemaValidator(resolve(process.env.FIRST_SLICE_XML_SCHEMA_CACHE||'.data/original-xml-schemas'),false);

test('actual Source root ZIP witness verifies137unchanged runtime files and41production HTTP observations',async()=>{
  assert.equal(source.verified,true);assert.equal(source.sourceCommit,'eedae41840cbe90e5547c0211da818bdf620f5aa');
  assert.equal(source.sourceFilesVerifiedBeforeAndAfter,137);assert.equal(Object.keys(source.sourceHashes).length,137);assert.equal(source.vendor.installedPackages,19);
  assert.equal(source.configuration.xmlSchemaValidation,true);assert.equal(source.configuration.allowTestMode,false);assert.equal(source.sqlSeedsOrDaoStubs,false);assert.equal(source.mutationsOverActualHttp,true);assert.equal(source.rows.length,41);
  const manifest=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));
  for(const [name,sha]of Object.entries(manifest.files))assert.equal(hash(await readFile(new URL(name,root))),sha,name);
  assert.equal(source.rows.find(row=>row.label==='all-shuffled').status,201);assert.equal(source.rows.find(row=>row.label==='mixed').status,207);assert.equal(source.rows.find(row=>row.label==='read-only-denied').status,403);
});

const kinds=process.env.FIRST_SLICE_STORE==='postgres'?['postgres']:['memory','file','sqlite'];
for(const kind of kinds)test(kind+': ordinary native ZIPs materialize physical files, quarantine invalid members and retain native state',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'owned-workspace-zip-')),schema='owned_zip_'+randomUUID().replaceAll('-','');
  const url=kind==='postgres'?new URL(process.env.FIRST_SLICE_POSTGRES_URL):null;url?.searchParams.set('options','-c search_path='+schema);
  let storage,repository,services,control;
  const open=async()=>{
    storage=kind==='memory'?storage??{repository:createInMemoryFirstSliceRepository(),shutdown:async()=>{}}:kind==='file'?await createFileFirstSliceStorage(join(directory,'owned.json')):kind==='sqlite'?createSqliteFirstSliceStorage(join(directory,'owned.sqlite')):await createPostgresFirstSliceStorage(url.toString());
    repository=storage.repository;services=createFirstSliceServices({repository,originalXmlSchemaValidator:validator,xmlSchemaProfile:'original-19'});
  };
  const reopen=async()=>{if(kind!=='memory'){await storage.shutdown();storage=undefined;}await open();};
  try{
    if(url){control=new Pool({connectionString:process.env.FIRST_SLICE_POSTGRES_URL});await control.query('CREATE SCHEMA "'+schema+'"');}await open();
    const tenant=await services.platform.createTenant({tenantKey:'zip-'+randomUUID(),displayName:'Owned ZIP'});
    const prepare=async key=>{const workspace=await services.platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:key,displayName:key});return{scope:{tenantKey:tenant.tenantKey,workspaceKey:key},workspace};};
    const put=async(owner,label)=>services.contentIntake.uploadWorkspaceFile({...owner.scope,fileName:label+'.zip',mediaType:'application/zip',sourceDocument:'data:application/zip;base64,'+(await bytes(label)).toString('base64')});
    const catalog=owner=>services.workspaceAdminRead.getWorkspaceFileCatalog(owner.scope);
    const own=await prepare('all');let actor,native,request,saved;
    await t.test('shuffled nested Source members install individually without retaining a visible ZIP container',async()=>{
      const result=await put(own,'all-shuffled');assert.equal(result.sourcePackage,null);assert.equal(result.archiveReport.importedCount,5,JSON.stringify(result.archiveReport));assert.equal(result.archiveReport.rejectedCount,0);
      const current=await catalog(own);assert.ok(current.items.every(file=>Date.parse(file.uploadedAt)===312768000000),'Source ZIP modification times remain visible');assert.equal(current.totalCount,5);assert.ok(!current.items.some(file=>file.fileType==='Package'));
      const actual=current.items.map(file=>file.fileName).sort();assert.deepEqual(actual,['Booklet/book.xml','Resource/raw.bin','Resource/source-r85-player.html','Testtakers/people.xml','Unit/unit.xml']);
      const events=await repository.listWorkspaceActivityEventsByWorkspace(tenant.tenantId,own.workspace.workspaceId);
      assert.equal(events.filter(event=>event.eventType==='source_package_created'&&event.details.archiveFileName==='all-shuffled.zip').length,5);
      actor=await services.originalAuthentication.login({name:'source-r85-all',password:''});
      const testNumber=await services.originalTest.create({token:actor.token,bookletName:'R85.BOOK'});native=await services.originalTest.read({token:actor.token,testNumber});
      request={token:actor.token,testNumber,unitName:'R85.UNIT',alias:'1',nativeUnitProtocol:'1'};
      assert.equal((await services.originalUnit.read(request)).definition,'Source root definition Ω');
      await services.originalUnit.patchState({...request,unitName:'1',body:{originalUnitId:'R85.UNIT',newState:[]}});
      await services.originalUnit.putResponse({...request,unitName:'1',body:{originalUnitId:'R85.UNIT',timeStamp:33,responseType:'owned',dataParts:{answer:'Private root ZIP answer Ω'}}});saved=await services.originalUnit.read(request);
      assert.equal(saved.dataParts.find(([key])=>key==='answer')[1],'Private root ZIP answer Ω');
    });
    await t.test('invalid XML is quarantined while independent files and complete sibling graphs remain',async()=>{
      const owner=await prepare('mixed'),result=await put(owner,'mixed');assert.equal(result.archiveReport.rejectedCount,1,JSON.stringify(result.archiveReport));assert.equal(result.archiveReport.importedCount,4);
      assert.equal(result.archiveReport.entries.find(row=>row.entryName==='bad.xml').status,'rejected');const files=await catalog(owner);assert.equal(files.totalCount,4);assert.ok(!files.items.some(file=>file.fileName.endsWith('/bad.xml')));
    });
    await t.test('ordinary nested ZIP stays a resource while nested ITCR installs scoped members',async()=>{
      const result=await put(own,'nested');assert.equal(result.archiveReport.rejectedCount,0,JSON.stringify(result.archiveReport));
      const resource=path=>services.originalTest.resource({groupToken:actor.groupToken,workspaceNumber:native.workspaceId,path});
      const archived=inputs.find(row=>row.label==='nested').entries;
      assert.deepEqual(Buffer.from((await resource('Resource/plain.zip')).bytes),Buffer.from(archived.find(entry=>entry.name==='plain.zip').base64,'base64'));
      assert.equal(Buffer.from((await resource('Resource/pkg/inside.txt')).bytes).toString(),'nested payload');
      assert.ok((await catalog(own)).items.find(file=>file.fileName==='Resource/plain.zip'&&file.fileType==='Resource'));
      await assert.rejects(resource('Resource/inside.txt'),error=>error.statusCode===404);
    });
    await t.test('wrong-ID overwrite rejects only that member and same-ID replacement preserves the real private answer',async()=>{
      const failed=await put(own,'overwrite-wrong-id');assert.equal(failed.archiveReport.rejectedCount,1);assert.equal(failed.archiveReport.importedCount,1);
      assert.equal((await services.originalUnit.read(request)).definition,'Source root definition Ω');assert.deepEqual((await services.originalUnit.read(request)).dataParts,saved.dataParts);
      const changed=await put(own,'overwrite-same-id');assert.equal(changed.archiveReport.replacedCount,1);assert.equal(changed.archiveReport.rejectedCount,0);
      assert.equal((await services.originalUnit.read(request)).definition,'new text');assert.deepEqual((await services.originalUnit.read(request)).dataParts,saved.dataParts);
    });
    await t.test('Source empty/directory, missing-dependency cascade, UTF16 and UTF8 filename limits match',async()=>{
      assert.equal(extra.verified,true);assert.equal(extra.sourceFilesVerifiedBeforeAndAfter,137);
      const owner=await prepare('extra');
      const putExtra=async label=>services.contentIntake.uploadWorkspaceFile({...owner.scope,fileName:label+'.zip',mediaType:'application/zip',sourceDocument:'data:application/zip;base64,'+(await bytes(label,true)).toString('base64')});
      const empty=await putExtra('empty');assert.equal(empty.archiveReport.entries.length,0);assert.equal((await catalog(owner)).totalCount,0);
      const directories=await putExtra('directories');assert.equal(directories.archiveReport.importedCount,1);assert.equal((await catalog(owner)).items[0].fileName,'Resource/n.txt');
      const cascade=await putExtra('cascade');assert.equal(cascade.archiveReport.importedCount,1);assert.equal(cascade.archiveReport.rejectedCount,3,JSON.stringify(cascade.archiveReport));
      assert.deepEqual(cascade.archiveReport.entries.filter(row=>row.status==='rejected').map(row=>row.fileName).sort(),['book.xml','people.xml','unit.xml']);
      assert.ok(!(await catalog(owner)).items.some(row=>['Unit','Booklet','Testtakers'].includes(row.fileType)));
      const utf16=await putExtra('utf16');assert.equal(utf16.archiveReport.rejectedCount,0,JSON.stringify(utf16.archiveReport));
      const physical=await repository.getSourcePackageById(utf16.archiveReport.entries.find(row=>row.fileName==='utf16.xml').sourcePackageId);
      const original=extraInputs.find(row=>row.label==='utf16').entries.find(row=>row.name==='utf16.xml');
      assert.equal(hash(Buffer.from(physical.sourceDocument.split(',')[1],'base64')),original.sha256,'UTF16 physical bytes stay exact');
      const long=await putExtra('long-basename');assert.equal(long.archiveReport.rejectedCount,1);assert.equal(long.archiveReport.importedCount,1);
      assert.equal(long.archiveReport.entries.find(row=>row.status==='rejected').errorCode,'source_package_file_name_too_long');
      assert.ok((await catalog(owner)).items.some(row=>row.fileName==='Resource/short.txt'));
    });
    await t.test('actual Source per-member upload reports retain errors, warnings and information at the native validation phase',async()=>{
      const reportRoot=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-workspace-zip-reports-http/',import.meta.url);
      const oracle=JSON.parse(await readFile(new URL('observations.json',reportRoot))),manifest=JSON.parse(await readFile(new URL('manifest.json',reportRoot)));
      assert.equal(oracle.verified,true);assert.equal(oracle.sourceFilesVerifiedBeforeAndAfter,137);assert.equal(oracle.vendor.installedPackages,19);
      for(const [path,expected]of Object.entries(manifest.files))assert.equal(hash(await readFile(new URL(path,reportRoot))),expected,path);
      const owners={full:await prepare('reports-full'),metadata:await prepare('reports-metadata'),errors:await prepare('reports-errors'),duplicates:await prepare('reports-duplicates'),deprecated:await prepare('reports-deprecated')};
      for(const [label,key]of [['complete-warnings','full'],['replace-unit','full'],['replace-player','full'],['metadata-forms','metadata'],['missing-dependencies','errors'],['duplicate-ids','duplicates'],['deprecated-unit','deprecated']]){
        const archive=Buffer.from(await readFile(new URL(label+'.zip.base64',reportRoot),'utf8'),'base64');
        const result=await services.contentIntake.uploadWorkspaceFile({...owners[key].scope,fileName:label+'.zip',mediaType:'application/zip',sourceDocument:'data:application/zip;base64,'+archive.toString('base64')});
        const expected=oracle.rows.find(row=>row.label===label);
        assert.equal(result.archiveReport.rejectedCount>0,expected.status===207,label);
        const actual=Object.fromEntries(result.archiveReport.entries.map(row=>[label+'.zip_Extract/'+row.entryName,row.validationReport??{}]));
        const wanted=Object.fromEntries(Object.entries(expected.value).map(([path,report])=>[path,Array.isArray(report)?{}:report]));
        assert.deepEqual(actual,wanted,label);
      }
    });
    await t.test('member provenance, active files and saved native state survive reopening',async()=>{
      const before=await catalog(own);await reopen();assert.deepEqual(await catalog(own),before);assert.deepEqual((await services.originalUnit.read(request)).dataParts,saved.dataParts);
      const events=await repository.listWorkspaceActivityEventsByWorkspace(tenant.tenantId,own.workspace.workspaceId);assert.ok(events.some(event=>event.details.archiveFileName==='overwrite-same-id.zip'&&event.details.archiveEntryName==='unit.xml'&&event.details.replacementMode==='workspace_file'));
    });
  }finally{await storage?.shutdown();if(control){await control.query('DROP SCHEMA "'+schema+'" CASCADE');await control.end();}await rm(directory,{recursive:true,force:true});}
});


test('complete ZIP preflight rejects late corruption, unsafe paths and budgets before any member or event is persisted',async t=>{
  const repository=createInMemoryFirstSliceRepository(),services=createFirstSliceServices({repository,originalXmlSchemaValidator:validator,xmlSchemaProfile:'original-19'});
  const tenant=await services.platform.createTenant({tenantKey:'zip-preflight',displayName:'Owned preflight'});
  const workspace=await services.platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:'owned',displayName:'Owned'});
  const scope={tenantKey:tenant.tenantKey,workspaceKey:workspace.workspaceKey};
  const put=bytes=>services.contentIntake.uploadWorkspaceFile({...scope,fileName:'bounded.zip',mediaType:'application/zip',sourceDocument:'data:application/zip;base64,'+bytes.toString('base64')});
  const initialEvents=await repository.listWorkspaceActivityEventsByWorkspace(tenant.tenantId,workspace.workspaceId);
  const valid=['first.txt','must never publish'];
  const cases=[
    ['late CRC mismatch',[valid,['late.txt','damaged',{checksum:0}]],400],
    ...['../escape','/absolute','C:/absolute','a\\backslash','a/../escape','https:remote','a/\u0000control'].map(name=>[name,[valid,[name,'unsafe']],400]),
    ['case-fold duplicate',[valid,['a/file.txt','one'],['A/FILE.txt','two']],400],
    ['parent file collision',[valid,['a','file'],['a/inside.txt','child']],400],
    ['invalid UTF8',[valid,['unused','bad',{nameBytes:Buffer.from([0xff]),flags:0x800}]],400],
    ['encrypted member',[valid,['locked','encrypted',{flags:0x801}]],400],
    ['member expanded limit',[valid,['large','',{uncompressedSize:20*1024*1024+1}]],413],
    ['aggregate expanded limit',Array.from({length:3},(_,i)=>['part'+i,'',{uncompressedSize:18*1024*1024}]),413],
    ['entry count',Array.from({length:10001},(_,i)=>['e'+i,'']),400]
  ];
  for(const [label,entries,status]of cases)await t.test(label,async()=>{
    await assert.rejects(put(workspaceZip(entries,{deflate:true})),error=>{assert.equal(error.statusCode,status);return true;});
    assert.deepEqual(await repository.listSourcePackagesByWorkspace(tenant.tenantId,workspace.workspaceId),[]);
    assert.deepEqual(await repository.listWorkspaceActivityEventsByWorkspace(tenant.tenantId,workspace.workspaceId),initialEvents);
  });
  const zip64=await put(workspaceZip([['nested/Ω.txt','ZIP64 resource Ω']],{zip64:true,deflate:true}));
  assert.equal(zip64.archiveReport.importedCount,1);assert.equal(zip64.archiveReport.entries[0].entryName,'nested/Ω.txt');
  const physical=await repository.getSourcePackageById(zip64.archiveReport.entries[0].sourcePackageId);
  assert.equal(Buffer.from(physical.sourceDocument.split(',')[1],'base64').toString(),'ZIP64 resource Ω');
});

test('a mid-archive optimistic concurrency conflict remains an HTTP conflict and preserves already accepted siblings',async()=>{
  const repository=createInMemoryFirstSliceRepository(),services=createFirstSliceServices({repository,originalXmlSchemaValidator:validator,xmlSchemaProfile:'original-19'});
  const tenant=await services.platform.createTenant({tenantKey:'zip-concurrency',displayName:'Owned concurrency'});
  const workspace=await services.platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:'owned',displayName:'Owned'});
  const reserve=repository.reserveWorkspaceFileUpload.bind(repository);let calls=0;
  repository.reserveWorkspaceFileUpload=async input=>++calls===2?false:reserve(input);
  await assert.rejects(services.contentIntake.uploadWorkspaceFile({tenantKey:tenant.tenantKey,workspaceKey:workspace.workspaceKey,
    fileName:'conflict.zip',mediaType:'application/zip',sourceDocument:'data:application/zip;base64,'+workspaceZip([['first.txt','accepted'],['second.txt','conflict'],['third.txt','unattempted']]).toString('base64')}),
    error=>error.statusCode===409&&error.errorCode==='workspace_file_upload_conflict');
  assert.equal(calls,2);assert.deepEqual((await services.workspaceAdminRead.getWorkspaceFileCatalog({tenantKey:tenant.tenantKey,workspaceKey:workspace.workspaceKey})).items.map(row=>row.fileName),['Resource/first.txt']);
});


test('Source libzip DOS/UT/NTFS timestamp witnesses retain the exact native catalog modification time',async()=>{
 const timestamps=JSON.parse(await readFile(new URL('zip-timestamps.json',root)));
 const repository=createInMemoryFirstSliceRepository(),services=createFirstSliceServices({repository,xmlSchemaProfile:'legacy-compatibility'});
 const tenant=await services.platform.createTenant({tenantKey:'zip-times',displayName:'Owned times'});
 const workspace=await services.platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:'owned',displayName:'Owned'});
 const scope={tenantKey:tenant.tenantKey,workspaceKey:workspace.workspaceKey};
 for(const row of timestamps.rows){
  const result=await services.contentIntake.uploadWorkspaceFile({...scope,fileName:row.label+'.zip',mediaType:'application/zip',sourceDocument:'data:application/zip;base64,'+row.zipBase64});
  assert.equal(result.archiveReport.rejectedCount,0,row.label);
  const catalog=await services.workspaceAdminRead.getWorkspaceFileCatalog(scope);assert.equal(catalog.totalCount,1);
  assert.equal(Date.parse(catalog.items[0].uploadedAt),row.mtime*1000,row.label);
  const physical=await repository.getSourcePackageById(catalog.items[0].sourcePackageId);assert.ok(Date.parse(physical.uploadedAt)>row.mtime*1000,'Intake audit time stays independent');
 }
});
