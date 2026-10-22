import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Pool} from 'pg';
import test from 'node:test';
import {raceWithSmokeDeadline} from './smoke-deadline.mjs';
import {createFirstSliceServices} from '@testcenter-rewrite-app/application';
import {createInMemoryFirstSliceRepository} from '@testcenter-rewrite-app/memory-store';

test('workspace file preflight and reservation both reject an intervening source edit', async t => {
  for (const phase of ['before-snapshot', 'before-reservation']) await t.test(phase, async () => {
    const base = createInMemoryFirstSliceRepository(), stamp = '2026-10-22T12:00:00.000Z';
    const tenant = {tenantId:'owned-tenant',tenantKey:'owned',displayName:'Owned',status:'active',createdAt:stamp};
    const workspace = {workspaceId:'owned-workspace',tenantId:tenant.tenantId,workspaceKey:'owned',displayName:'Owned',status:'active',createdAt:stamp};
    await base.saveTenant(tenant); await base.saveWorkspace({tenantKey:'owned',workspaceKey:'owned',workspace});
    const source = {sourcePackageId:'owned-source',tenantId:tenant.tenantId,workspaceId:workspace.workspaceId,
      fileName:'owned.xml',mediaType:'application/xml',contentStructure:null,status:'uploaded',uploadedAt:stamp,
      sourceDocument:'<Booklet><Metadata><Id>OLD</Id></Metadata><Units><Unit id="U"/></Units></Booklet>'};
    const changed = {...source,sourceDocument:source.sourceDocument.replace('OLD','CONCURRENT')};
    await base.saveSourcePackage(source);
    let changedOnce = false, reservations = 0;
    const change = async () => {if (!changedOnce) {changedOnce=true; await base.saveSourcePackage(changed);}};
    const repository = {...base,
      listSourcePackagesByWorkspace:async(...args)=>{
        if (phase==='before-snapshot') await change();
        return base.listSourcePackagesByWorkspace(...args);
      },
      reserveSourcePackageReplacement:async input=>{
        reservations++; if (phase==='before-reservation') await change();
        return base.reserveSourcePackageReplacement(input);
      }
    };
    const services = createFirstSliceServices({repository,xmlSchemaProfile:'legacy-compatibility'});
    await assert.rejects(services.contentIntake.replaceWorkspaceFile({tenantKey:'owned',workspaceKey:'owned',
      sourcePackageId:source.sourcePackageId,mediaType:'application/xml',sourceDocument:source.sourceDocument}),
      error=>error.errorCode==='source_package_replacement_conflict');
    assert.equal(changedOnce,true);
    assert.equal(reservations,phase==='before-snapshot'?0:1);
    assert.deepEqual(await base.listSourcePackagesByWorkspace(tenant.tenantId,workspace.workspaceId),[changed]);
    assert.deepEqual(await base.listWorkspaceActivityEventsByWorkspace(tenant.tenantId,workspace.workspaceId),[]);
    assert.deepEqual(await base.listImportJobsByWorkspace(tenant.tenantId,workspace.workspaceId),[]);
    assert.deepEqual(await base.listContentReleasesByWorkspace(tenant.tenantId,workspace.workspaceId),[]);
  });
});

test('a first-upload reservation rejects a changed workspace without orphan files or audit entries',async()=>{
  const base=createInMemoryFirstSliceRepository(),stamp='2026-10-22T12:00:00.000Z';
  const tenant={tenantId:'upload-tenant',tenantKey:'owned',displayName:'Owned',status:'active',createdAt:stamp};
  const workspace={workspaceId:'upload-workspace',tenantId:tenant.tenantId,workspaceKey:'owned',displayName:'Owned',status:'active',createdAt:stamp};
  await base.saveTenant(tenant);await base.saveWorkspace({tenantKey:'owned',workspaceKey:'owned',workspace});
  const concurrent={sourcePackageId:'other-source',tenantId:tenant.tenantId,workspaceId:workspace.workspaceId,
    fileName:'Resource/other.txt',mediaType:'text/plain',sourceDocument:'other',contentStructure:null,status:'accepted',uploadedAt:stamp};
  let reservations=0;
  const repository={...base,reserveWorkspaceFileUpload:async input=>{
    reservations++;await base.saveSourcePackage(concurrent);return base.reserveWorkspaceFileUpload(input);
  }};
  const services=createFirstSliceServices({repository,xmlSchemaProfile:'legacy-compatibility'});
  await assert.rejects(services.contentIntake.uploadWorkspaceFile({tenantKey:'owned',workspaceKey:'owned',
    fileName:'new.txt',mediaType:'text/plain',sourceDocument:'new'}),error=>error.errorCode==='workspace_file_upload_conflict');
  assert.equal(reservations,1);
  assert.deepEqual(await base.listSourcePackagesByWorkspace(tenant.tenantId,workspace.workspaceId),[concurrent]);
  assert.deepEqual(await base.listWorkspaceActivityEventsByWorkspace(tenant.tenantId,workspace.workspaceId),[]);
  assert.deepEqual(await base.listImportJobsByWorkspace(tenant.tenantId,workspace.workspaceId),[]);
  assert.deepEqual(await base.listContentReleasesByWorkspace(tenant.tenantId,workspace.workspaceId),[]);
});

const kinds=['memory','file','sqlite',...(process.env.FIRST_SLICE_STORE==='postgres'?['postgres']:[])];
for(const kind of kinds)test(kind+': complete protected file catalog preserves bytes, metadata, read-only scope and immutable history',async()=>{
  const folder=await mkdtemp(join(tmpdir(),'owned-file-catalog-'));
  const schema='owned_catalog_'+randomUUID().replaceAll('-','');
  let pool,server;
  const pg=kind==='postgres'?new URL(process.env.FIRST_SLICE_POSTGRES_URL):null;
  pg?.searchParams.set('options','-c search_path='+schema);
  try{
    if(pg){pool=new Pool({connectionString:process.env.FIRST_SLICE_POSTGRES_URL});await pool.query('CREATE SCHEMA "'+schema+'"');}
    const module=pathToFileURL(resolve('apps/api/dist/apps/api/src/index.js')).href;
    server=spawn(process.execPath,['--input-type=module','-e',`import{createProductionApiServer}from ${JSON.stringify(module)};
      const server=await createProductionApiServer();server.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));
      process.once('SIGTERM',()=>server.close(()=>process.exit(0)));`],{
      stdio:['ignore','ignore','inherit','ipc'],env:{...process.env,FIRST_SLICE_STORE:kind,
        FIRST_SLICE_FILE:join(folder,'owned.json'),FIRST_SLICE_SQLITE_FILE:join(folder,'owned.sqlite'),
        ...(pg?{FIRST_SLICE_POSTGRES_URL:pg.toString()}:{}),FIRST_SLICE_BOOTSTRAP_DEMO:'true',
        FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',FIRST_SLICE_PROOF_OF_WORK_SCOPES:'',FIRST_SLICE_XML_SCHEMA_PROFILE:'legacy-compatibility'}});
    const port=await raceWithSmokeDeadline(new Promise((done,reject)=>{
      server.once('message',message=>done(message.port));server.once('error',reject);
      server.once('exit',()=>reject(Error('Owned file catalog API exited during startup.')));
    }),20000,()=>{throw Error('Owned file catalog API startup timed out.');});
    const base='http://127.0.0.1:'+port;let token;
    const api=async(path,body,method=body===undefined?'GET':'POST',status=200,credential=token)=>{
      const response=await fetch(base+path,{method,headers:{...(credential?{authorization:'Bearer '+credential}:{}),
        ...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
      const value=await response.json();assert.equal(response.status,status,method+' '+path+': '+JSON.stringify(value));return value;
    };
    token=(await api('/api/v1/admin/auth/sign-in',{username:'demo-admin',password:'demo-admin-password'})).sessionToken;
    await api('/api/v1/tenants/demo-tenant/workspaces',{workspaceKey:'owned-files',displayName:'Owned files'},'POST',201);
    const scope='/api/v1/tenants/demo-tenant/workspaces/owned-files';
    const xml=(type,id,body='',metadata='')=>`<${type}><Metadata><Id>${id}</Id>${metadata}</Metadata>${body}</${type}>`;
    const unit=Buffer.concat([Buffer.from([255,254]),Buffer.from('<?xml version="1.0" encoding="UTF-16"?>'+
      xml('Unit','UNIT','<Definition player="catalog-player@1.2.9"><![CDATA[private-unit-body]]></Definition>',
        '<Label>  Aufgabe Ω  </Label><Description><![CDATA[  Authored <b>description</b>  ]]></Description>'),'utf16le')]);
    const player='<html><script type="application/ld+json">'+JSON.stringify({
      $schema:'https://raw.githubusercontent.com/verona-interfaces/metadata/master/verona-module-metadata.json',
      id:'catalog-player',version:'1.2.9',specVersion:'6.0',metadataVersion:'2.0',type:'player',
      name:[{lang:'en',value:'English Player'},{lang:'de',value:'Eigener Player'}],description:[{lang:'de',value:'Beschreibung'}]
    })+'</script><script>private-player-body</script></html>';
    const fixtures=[
      ['people.xml',xml('Testtakers','PEOPLE','<Group id="group"><Login name="private-user" pw="private-password"><Booklet>BOOKLET#level:private-state</Booklet></Login></Group>')],
      ['booklet.xml',xml('Booklet','BOOKLET','<Units><Unit id="UNIT"/></Units>')],
      ['unit.xml','data:application/xml;base64,'+unit.toString('base64')],
      ['check.xml',xml('SysCheck','CHECK','<Config unit="UNIT"/>')],
      ['custom-player.html',player],['image.bin','data:application/octet-stream;base64,AP/+AA==']
    ];
    const created=[];
    for(const [fileName,sourceDocument]of fixtures)created.push((await api(scope+'/source-packages',{
      fileName,mediaType:fileName.endsWith('.html')?'text/html':fileName.endsWith('.bin')?'application/octet-stream':'application/xml',sourceDocument
    },'POST',201)).sourcePackage);
    await api(scope+'/files',undefined,'GET',401,null);
    const before=await api(scope+'/source-packages?limit=500');
    const activity=await api(scope+'/activity-events?limit=500');
    const catalog=await api(scope+'/files');assert.equal(catalog.totalCount,6);
    assert.equal(catalog.dependencySizesCalculated,true);
    const find=name=>catalog.items.find(item=>item.fileName===name);
    assert.equal(find('unit.xml').fileSizeBytes,unit.length);assert.equal(find('unit.xml').totalSizeBytes,unit.length);
    assert.equal(find('unit.xml').metadata.label,'  Aufgabe Ω  ');
    assert.equal(find('unit.xml').metadata.description,'  Authored <b>description</b>  ');
    assert.equal(find('booklet.xml').totalSizeBytes,Buffer.byteLength(fixtures[1][1])+unit.length+Buffer.byteLength(player));
    assert.equal(find('people.xml').metadata.participantCount,1);
    assert.equal(find('custom-player.html').metadata.identifier,'CATALOG-PLAYER-1.2');
    assert.equal(find('custom-player.html').metadata.label,'Eigener Player');
    assert.equal(find('image.bin').fileSizeBytes,4);
    const raw=JSON.stringify(catalog);
    for(const secret of ['private-user','private-password','private-state','private-unit-body','private-player-body',
      'sourceDocument','sourceText','contentStructure','data:application'])assert.ok(!raw.includes(secret),secret);
    assert.deepEqual(await api(scope+'/source-packages?limit=500'),before);
    assert.deepEqual(await api(scope+'/activity-events?limit=500'),activity);
    const download=await fetch(base+scope+'/source-packages/'+created[2].sourcePackageId+'/download',{
      headers:{authorization:'Bearer '+token}});
    assert.equal(download.status,200);assert.deepEqual(Buffer.from(await download.arrayBuffer()),unit);
    const user=async(name,role,accessMode)=>{
      await api('/api/v1/admin/users',{username:name,password:'Owned-file-password-9!',roleAssignments:[{
        role,tenantKey:'demo-tenant',workspaceKey:'owned-files',...(accessMode?{accessMode}:{})
      }]},'POST',201);
      let session=(await api('/api/v1/admin/auth/sign-in',{username:name,password:'Owned-file-password-9!'})).sessionToken;
      await api('/api/v1/admin/auth/password',{password:'Changed-file-password-9!'},'POST',200,session);
      return(await api('/api/v1/admin/auth/sign-in',{username:name,password:'Changed-file-password-9!'})).sessionToken;
    };
    const readOnly=await user('owned-catalog-reader','workspace_admin','read_only');
    assert.deepEqual(await api(scope+'/files',undefined,'GET',200,readOnly),catalog);
    await api('/api/v1/tenants/demo-tenant/workspaces/demo-workspace/files',undefined,'GET',403,readOnly);
    const monitor=await user('owned-catalog-monitor','study_monitor');
    await api(scope+'/files',undefined,'GET',403,monitor);
    const replacement=await api(scope+'/source-packages/'+created[1].sourcePackageId+'/replacements',{
      fileName:'booklet.xml',mediaType:'application/xml',
      sourceDocument:xml('Booklet','BOOKLET','<Units><Unit id="UNIT"/></Units>','<Label>Geändert Ω</Label>')
    },'POST',201);
    assert.equal(replacement.importJob.status,'completed',JSON.stringify(replacement.importJob.diagnostics));
    assert.equal(replacement.stagedContentRelease?.runtimeSnapshot?.playerEntries?.find(
      entry=>entry.playerKey==='catalog-player@1.2.9')?.html,player,
      'A completed import must actually bind the requested Player HTML into the immutable runtime.');
    const current=await api(scope+'/files');
    assert.equal(current.totalCount,6,'Generated dependency assemblies and replaced revisions are not current loose files');
    assert.ok(!current.items.some(item=>item.sourcePackageId===created[1].sourcePackageId));
    assert.equal(current.items.find(item=>item.fileName==='booklet.xml').metadata.label,'Geändert Ω');
    const oldDownload=await fetch(base+scope+'/source-packages/'+created[1].sourcePackageId+'/download',{
      headers:{authorization:'Bearer '+token}});
    assert.equal(oldDownload.status,200);assert.equal(await oldDownload.text(),fixtures[1][1]);
    // The dedicated loose-file preflight retains the stored filename and
    // Source identity. The canonical replacement API above remains available.
    const replaceFile=id=>scope+'/files/'+id+'/replacements';
    let latest=replacement.replacementSourcePackage;
    const validDocument=xml('Booklet','booklet','<Units><Unit id="UNIT"/></Units>','<Label>Geschützt Ω</Label>');
    const replacementBytes=Buffer.concat([Buffer.from([255,254]),Buffer.from('<?xml version="1.0" encoding="UTF-16"?>'+validDocument,'utf16le')]);
    const validBody={mediaType:'application/xml',sourceDocument:'data:application/xml;base64,'+replacementBytes.toString('base64')};
    const snapshot=async()=>({files:await api(scope+'/files'),sources:await api(scope+'/source-packages?limit=500'),
      activity:await api(scope+'/activity-events?limit=500'),imports:await api(scope+'/import-jobs?limit=500'),
      releases:await api(scope+'/content-releases?limit=500')});
    const retained=await snapshot();
    await api(scope+'/files',{fileName:'readonly.txt',mediaType:'text/plain',sourceDocument:'x'},'POST',403,readOnly);
    await api(replaceFile(latest.sourcePackageId),validBody,'POST',401,null);
    await api(replaceFile(latest.sourcePackageId),validBody,'POST',403,readOnly);
    await api(replaceFile(latest.sourcePackageId),validBody,'POST',403,monitor);
    await api('/api/v1/tenants/demo-tenant/workspaces/demo-workspace/files/'+latest.sourcePackageId+'/replacements',validBody,'POST',404);
    for(const sourceDocument of [xml('Booklet','OTHER','<Units><Unit id="UNIT"/></Units>'),
      xml('Unit','BOOKLET','<Definition player="catalog-player@1.2.9"/>')]) {
      await api(replaceFile(latest.sourcePackageId),{...validBody,sourceDocument},'POST',409);
    }
    for(const body of [null,[],{...validBody,fileName:'renamed.xml'},
      {...validBody,contentStructure:{bookletEntries:[]}}, {...validBody,sourceDocument:null}, {...validBody,mediaType:7}]) {
      await api(replaceFile(latest.sourcePackageId),body,'POST',400);
    }
    const malformed=await api(replaceFile(latest.sourcePackageId),{...validBody,sourceDocument:'<Booklet><Metadata>'},'POST',400);
    assert.equal(malformed.error,'workspace_file_validation_failed');
    const entity=await api(replaceFile(latest.sourcePackageId),{...validBody,sourceDocument:
      '<!DOCTYPE Booklet [<!ENTITY private SYSTEM "file:///OWNED_PRIVATE_PATH">]><Booklet><Metadata><Id>BOOKLET</Id></Metadata></Booklet>'},'POST',400);
    assert.equal(entity.error,'workspace_file_validation_failed');
    const changedModule=player.replace('"catalog-player"','"Catalog-player"');
    const moduleProblem=await api(replaceFile(created[4].sourcePackageId),{mediaType:'text/html',sourceDocument:changedModule},'POST',409);
    assert.equal(moduleProblem.error,'workspace_file_module_id_mismatch');
    const invalidBytes=await api(replaceFile(created[5].sourcePackageId),{mediaType:'application/octet-stream',sourceDocument:'data:application/octet-stream;base64,%%%'},'POST',400);
    assert.equal(invalidBytes.error,'workspace_file_document_invalid');
    assert.deepEqual(await snapshot(),retained,'Rejected preflight must not reserve files, lineage, jobs or releases.');
    const protectedReplacement=await api(replaceFile(latest.sourcePackageId),validBody,'POST',201);
    assert.equal(protectedReplacement.importJob.status,'completed',JSON.stringify(protectedReplacement.importJob.diagnostics));
    assert.equal(protectedReplacement.replacementSourcePackage.fileName,'booklet.xml');
    const replacedDownload=await fetch(base+scope+'/source-packages/'+protectedReplacement.replacementSourcePackage.sourcePackageId+'/download',{headers:{authorization:'Bearer '+token}});
    assert.equal(replacedDownload.status,200);assert.deepEqual(Buffer.from(await replacedDownload.arrayBuffer()),replacementBytes);
    assert.equal(protectedReplacement.stagedContentRelease.runtimeSnapshot.playerEntries.find(
      item=>item.playerKey==='catalog-player@1.2.9')?.html,player);
    assert.equal((await api(scope+'/files')).items.find(item=>item.fileName==='booklet.xml').metadata.label,'Geschützt Ω');
    const superseded=await snapshot();
    await api(replaceFile(latest.sourcePackageId),validBody,'POST',409);
    assert.deepEqual(await snapshot(),superseded,'An obsolete file ID must not create a second replacement branch.');
    const historical=await fetch(base+scope+'/source-packages/'+latest.sourcePackageId+'/download',{headers:{authorization:'Bearer '+token}});
    assert.equal(historical.status,200);assert.equal(await historical.text(),replacement.replacementSourcePackage.sourceDocument);
    const importsBeforeIndependent=await api(scope+'/import-jobs?limit=500');
    const releasesBeforeIndependent=await api(scope+'/content-releases?limit=500');
    const emptyResource=await api(replaceFile(created[5].sourcePackageId),{mediaType:'application/octet-stream',sourceDocument:'data:application/octet-stream;base64,'},'POST',201);
    assert.equal(emptyResource.replacementSourcePackage.status,'accepted');assert.equal(emptyResource.importJob,null);
    const emptyDownload=await fetch(base+scope+'/source-packages/'+emptyResource.replacementSourcePackage.sourcePackageId+'/download',{headers:{authorization:'Bearer '+token}});
    assert.equal(emptyDownload.status,200);assert.equal((await emptyDownload.arrayBuffer()).byteLength,0);
    const changedPlayer=player.replace('"1.2.9"','"1.2.10"');
    const independentPlayer=await api(replaceFile(created[4].sourcePackageId),{mediaType:'text/html',sourceDocument:changedPlayer},'POST',201);
    assert.equal(independentPlayer.replacementSourcePackage.status,'accepted');
    assert.equal(independentPlayer.importJob,null);assert.equal(independentPlayer.stagedContentRelease,null);
    const changedUnit=Buffer.from(unit.toString('utf16le').replace('private-unit-body','private-unit-body-replaced'),'utf16le');
    const independentUnit=await api(replaceFile(created[2].sourcePackageId),{
      mediaType:'application/xml',sourceDocument:'data:application/xml;base64,'+changedUnit.toString('base64')
    },'POST',201);
    assert.equal(independentUnit.replacementSourcePackage.status,'accepted');
    assert.equal(independentUnit.importJob,null);assert.equal(independentUnit.stagedContentRelease,null);
    assert.deepEqual(await api(scope+'/import-jobs?limit=500'),importsBeforeIndependent,'Independent valid files must not manufacture a failed Booklet import.');
    assert.deepEqual(await api(scope+'/content-releases?limit=500'),releasesBeforeIndependent,'Immutable prior releases must not be rewritten by a loose-file replacement.');
    for(const [source,bytes]of[[independentPlayer.replacementSourcePackage,Buffer.from(changedPlayer)],
      [independentUnit.replacementSourcePackage,changedUnit]]){
      const response=await fetch(base+scope+'/source-packages/'+source.sourcePackageId+'/download',{headers:{authorization:'Bearer '+token}});
      assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
    }
    const beforeMissingDependency=await snapshot();
    const missingUnit=changedUnit.toString('utf16le').replace('catalog-player@1.2.9','catalog-player@9.8.7');
    const missingDependency=await api(replaceFile(independentUnit.replacementSourcePackage.sourcePackageId),{
      mediaType:'application/xml',sourceDocument:'data:application/xml;base64,'+Buffer.from(missingUnit,'utf16le').toString('base64')
    },'POST',409);
    assert.equal(missingDependency.error,'workspace_file_dependencies_unresolved');
    assert.deepEqual(await snapshot(),beforeMissingDependency);
    const recompiled=await api(replaceFile(protectedReplacement.replacementSourcePackage.sourcePackageId),validBody,'POST',201);
    assert.equal(recompiled.importJob.status,'completed',JSON.stringify(recompiled.importJob.diagnostics));
    assert.equal(recompiled.stagedContentRelease.runtimeSnapshot.playerEntries.find(item=>item.playerKey==='catalog-player@1.2.9')?.html,changedPlayer,
      'A subsequent Booklet snapshot must bind the actual new independently accepted Player.');
    assert.ok(JSON.stringify(recompiled.stagedContentRelease.runtimeSnapshot).includes('private-unit-body-replaced'),
      'A subsequent Booklet snapshot must hydrate the actual new independently accepted Unit.');
    // The canonical console still offers valid loose drafts whose Booklet
    // import failed. Source-file compilation uses only current accepted files.
    await api('/api/v1/tenants/demo-tenant/workspaces',{workspaceKey:'owned-candidate-review',displayName:'Candidate review'},'POST',201);
    const reviewScope='/api/v1/tenants/demo-tenant/workspaces/owned-candidate-review';
    const reviewCreate=async(fileName,mediaType,sourceDocument)=>(await api(reviewScope+'/source-packages',{
      fileName,mediaType,sourceDocument
    },'POST',201)).sourcePackage;
    const reviewBook=await reviewCreate('Booklet.xml','application/xml',fixtures[1][1]);
    const reviewUnit=await reviewCreate('Unit.xml','application/xml',fixtures[2][1]);
    await reviewCreate('Player.html','text/html',player);
    const copyBody='data:application/xml;base64,'+Buffer.from(unit.toString('utf16le').replace('private-unit-body','CANONICAL_CHOSEN'),'utf16le').toString('base64');
    const newestBody='data:application/xml;base64,'+Buffer.from(unit.toString('utf16le').replace('private-unit-body','CANONICAL_NEWEST'),'utf16le').toString('base64');
    const copied=await api(reviewScope+'/source-packages/'+reviewUnit.sourcePackageId+'/replacements',{
      fileName:'Unit-copy.xml',mediaType:'application/xml',sourceDocument:copyBody
    },'POST',201);
    assert.equal(copied.importJob.status,'failed','A canonical standalone Unit has no Booklet runtime; its valid source remains reviewable.');
    const firstReview=await api(reviewScope+'/import-jobs',{sourcePackageId:reviewBook.sourcePackageId},'POST',201);
    const firstChoice=firstReview.importJob.diagnostics.find(item=>item.code==='source_document_workspace_dependency_ambiguous');
    assert.ok(firstChoice,JSON.stringify(firstReview.importJob));
    assert.deepEqual(firstChoice.details.candidateSourcePackages.map(item=>item.sourcePackageId).sort(),
      [reviewUnit.sourcePackageId,copied.replacementSourcePackage.sourcePackageId].sort());
    const newest=await api(reviewScope+'/source-packages/'+copied.replacementSourcePackage.sourcePackageId+'/replacements',{
      fileName:'Unit-newest.xml',mediaType:'application/xml',sourceDocument:newestBody
    },'POST',201);
    assert.equal(newest.importJob.status,'failed');
    const stale=await api(reviewScope+'/import-jobs',{sourcePackageId:reviewBook.sourcePackageId,
      dependencySourcePackageIds:[copied.replacementSourcePackage.sourcePackageId],
      dependencySelectionRevision:firstChoice.details.dependencySelectionRevision
    },'POST',201);
    assert.ok(stale.importJob.diagnostics.some(item=>item.code==='source_document_workspace_dependency_selection_stale'));
    const refreshed=await api(reviewScope+'/import-jobs',{sourcePackageId:reviewBook.sourcePackageId},'POST',201);
    const refreshedChoice=refreshed.importJob.diagnostics.find(item=>item.code==='source_document_workspace_dependency_ambiguous');
    assert.equal(refreshedChoice.details.candidateSourcePackages.length,3);
    const guided=await api(reviewScope+'/import-jobs',{sourcePackageId:reviewBook.sourcePackageId,
      dependencySourcePackageIds:[copied.replacementSourcePackage.sourcePackageId],
      dependencySelectionRevision:refreshedChoice.details.dependencySelectionRevision
    },'POST',201);
    assert.equal(guided.importJob.status,'completed',JSON.stringify(guided.importJob.diagnostics));
    assert.ok(JSON.stringify(guided.stagedContentRelease.runtimeSnapshot).includes('CANONICAL_CHOSEN'));
    assert.ok(!JSON.stringify(guided.stagedContentRelease.runtimeSnapshot).includes('CANONICAL_NEWEST'));
    const sourceMode=await api(reviewScope+'/files/'+reviewBook.sourcePackageId+'/replacements',{
      mediaType:'application/xml',sourceDocument:fixtures[1][1]
    },'POST',201);
    assert.equal(sourceMode.importJob.status,'completed',JSON.stringify(sourceMode.importJob.diagnostics));
    assert.ok(JSON.stringify(sourceMode.stagedContentRelease.runtimeSnapshot).includes('private-unit-body'));
    assert.ok(!JSON.stringify(sourceMode.stagedContentRelease.runtimeSnapshot).includes('CANONICAL_CHOSEN'));
    assert.ok(!JSON.stringify(sourceMode.stagedContentRelease.runtimeSnapshot).includes('CANONICAL_NEWEST'));
    for(const [key,reference,fileName,expected]of[
      ['owned-patch-version','catalog-player@1.2.8','custom-player.html','completed'],
      ['owned-wrong-version','catalog-player@1.3.0','catalog-player-1.3.html','failed']
    ]){
      await api('/api/v1/tenants/demo-tenant/workspaces',{workspaceKey:key,displayName:key},'POST',201);
      const otherScope='/api/v1/tenants/demo-tenant/workspaces/'+key;
      const changedUnit=Buffer.from(unit.toString('utf16le').replace('catalog-player@1.2.9',reference),'utf16le');
      let rootId;
      for(const [name,mediaType,sourceDocument]of[
        ['booklet.xml','application/xml',fixtures[1][1]],
        ['unit.xml','application/xml','data:application/xml;base64,'+changedUnit.toString('base64')],
        [fileName,'text/html',player]
      ]){
        const source=await api(otherScope+'/source-packages',{fileName:name,mediaType,sourceDocument},'POST',201);
        if(name==='booklet.xml')rootId=source.sourcePackage.sourcePackageId;
      }
      const imported=await api(otherScope+'/import-jobs',{sourcePackageId:rootId},'POST',201);
      assert.equal(imported.importJob.status,expected,JSON.stringify(imported.importJob.diagnostics));
      if(expected==='completed')assert.equal(imported.stagedContentRelease?.runtimeSnapshot?.playerEntries?.find(
        entry=>entry.playerKey===reference)?.html,player);
      if(expected==='failed')assert.ok(imported.importJob.diagnostics.some(item=>item.code==='source_document_player_version_mismatch'),
        'A matching filename cannot bypass the real Player metadata version check.');
    }
    // Source first upload: typed folders, actual bytes and immutable runtime.
    await api('/api/v1/tenants/demo-tenant/workspaces',{workspaceKey:'owned-upload',displayName:'First upload'},'POST',201);
    const uploadScope='/api/v1/tenants/demo-tenant/workspaces/owned-upload';
    const upload=(fileName,mediaType,sourceDocument,status=201,credential=token)=>
      api(uploadScope+'/files',{fileName,mediaType,sourceDocument},'POST',status,credential);
    const uploadSnapshot=async()=>({files:await api(uploadScope+'/files'),sources:await api(uploadScope+'/source-packages?limit=500'),
      activity:await api(uploadScope+'/activity-events?limit=500'),imports:await api(uploadScope+'/import-jobs?limit=500'),
      releases:await api(uploadScope+'/content-releases?limit=500')});
    const emptyUpload=await uploadSnapshot();
    await upload('shared.xml','application/xml',fixtures[2][1],401,null);
    await upload('shared.xml','application/xml',fixtures[2][1],403,readOnly);
    await upload('shared.xml','application/xml',fixtures[2][1],403,monitor);
    await upload('shared.xml','application/xml',fixtures[2][1],409);
    for(const name of ['../bad.txt','nested/bad.txt','nested\\bad.txt','bad\u0000.txt','bad\n.txt','..','', 'ä'.repeat(61)])
      await upload(name,'text/plain','x',400);
    for(const body of [null,[],{fileName:'x.txt',mediaType:7,sourceDocument:'x'},
      {fileName:'x.txt',mediaType:'text/plain',sourceDocument:{}},
      {fileName:'x.txt',mediaType:'text/plain',sourceDocument:'x',contentStructure:{}},
      {fileName:'x.txt',mediaType:'text/plain'}]) await api(uploadScope+'/files',body,'POST',400);
    for(const sourceDocument of ['<unknown/>','<Unit>','<!DOCTYPE Unit><Unit/>','data:application/xml;base64,%%%'])
      await upload('bad.xml','application/xml',sourceDocument,400);
    await upload('members.zip','application/zip','data:application/zip;base64,UEsDBA==',400);
    assert.deepEqual(await uploadSnapshot(),emptyUpload,'Rejected uploads leave no files, jobs, releases or activity.');
    const uploadedPlayer=await upload('custom-player.html','text/html',player);
    assert.equal(uploadedPlayer.sourcePackage.fileName,'Resource/custom-player.html');
    assert.equal(uploadedPlayer.sourcePackage.status,'accepted');assert.equal(uploadedPlayer.importJob,null);
    const uploadedUnit=await upload('shared.xml','application/zip',fixtures[2][1]);
    assert.equal(uploadedUnit.sourcePackage.fileName,'Unit/shared.xml','XML root overrides an untrusted ZIP MIME hint.');
    assert.equal(uploadedUnit.sourcePackage.status,'accepted');assert.equal(uploadedUnit.importJob,null);
    const uploadedBook=await upload('shared.xml','application/xml',fixtures[1][1]);
    assert.equal(uploadedBook.sourcePackage.fileName,'Booklet/shared.xml');
    assert.equal(uploadedBook.importJob.status,'completed',JSON.stringify(uploadedBook.importJob.diagnostics));
    assert.equal(uploadedBook.stagedContentRelease.status,'staged');
    assert.equal(uploadedBook.stagedContentRelease.runtimeSnapshot.playerEntries.find(value=>value.playerKey==='catalog-player@1.2.9')?.html,player);
    assert.ok(JSON.stringify(uploadedBook.stagedContentRelease.runtimeSnapshot).includes('private-unit-body'));
    const uploadedCheck=await upload('check.xml','application/xml',fixtures[3][1]);
    assert.equal(uploadedCheck.importJob.status,'completed',JSON.stringify(uploadedCheck.importJob.diagnostics));
    const uploadedPeople=await upload('people.xml','application/xml',xml('Testtakers','UPLOAD-PEOPLE',
      '<Group id="upload-group"><Login name="upload-user" pw="upload-password"><Booklet>BOOKLET</Booklet></Login></Group>'));
    assert.equal(uploadedPeople.importJob.status,'completed',JSON.stringify(uploadedPeople.importJob.diagnostics));
    assert.ok(uploadedPeople.participantRosterImport);
    const beforeDuplicate=await uploadSnapshot();
    await upload('different.xml','application/xml',fixtures[2][1],409);
    await upload('shared.xml','application/xml',xml('Unit','DIFFERENT','<Definition player="catalog-player@1.2.9">changed-id</Definition>'),409);
    assert.deepEqual(await uploadSnapshot(),beforeDuplicate);
    const uploadedEmpty=await upload('empty.bin','application/octet-stream','');
    const authoredName='  '+'ä'.repeat(56)+'.txt  ';
    assert.equal(Buffer.byteLength(authoredName),120);
    const uploadedSpaces=await upload(authoredName,'text/plain','  \n  ');
    assert.equal(uploadedSpaces.sourcePackage.fileName,'Resource/'+authoredName);
    const overwritten=await upload('shared.xml','application/xml','data:application/xml;base64,'+changedUnit.toString('base64'));
    assert.equal(overwritten.replacedSourcePackageId,uploadedUnit.sourcePackage.sourcePackageId);
    assert.equal(overwritten.sourcePackage.fileName,'Unit/shared.xml');assert.equal(overwritten.importJob,null);
    const reuploadedBook=await upload('shared.xml','application/zip',fixtures[1][1]);
    assert.equal(reuploadedBook.replacedSourcePackageId,uploadedBook.sourcePackage.sourcePackageId);
    assert.equal(reuploadedBook.importJob.status,'completed',JSON.stringify(reuploadedBook.importJob.diagnostics));
    assert.ok(JSON.stringify(reuploadedBook.stagedContentRelease.runtimeSnapshot).includes('private-unit-body-replaced'));
    for(const [source,bytes,name]of[[uploadedUnit.sourcePackage,unit,'shared.xml'],
      [overwritten.sourcePackage,changedUnit,'shared.xml'],[uploadedEmpty.sourcePackage,Buffer.alloc(0),'empty.bin'],
      [uploadedSpaces.sourcePackage,Buffer.from('  \n  '),authoredName]]) {
      const route=uploadScope+'/files/'+source.sourcePackageId+'/download';
      await api(route,undefined,'GET',401,null);
      const response=await fetch(base+route,{headers:{authorization:'Bearer '+token}});
      assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
      const disposition=response.headers.get('content-disposition');
      assert.ok(disposition.includes(encodeURIComponent(name)) || disposition.includes('"'+name+'"'),disposition);
      assert.ok(!disposition.includes('Unit/'));
      await api(scope+'/files/'+source.sourcePackageId+'/download',undefined,'GET',404);
    }
    const uploadCatalog=await api(uploadScope+'/files');
    assert.equal(uploadCatalog.totalCount,7);assert.ok(!uploadCatalog.items.some(value=>value.sourcePackageId===uploadedUnit.sourcePackage.sourcePackageId));
    const raceBefore=await uploadSnapshot();
    const raceDocument=xml('Unit','ATOMIC-RACE','<Definition player="catalog-player@1.2.9">atomic-race</Definition>');
    const raceResults=await Promise.all(Array.from({length:8},(_,i)=>fetch(base+uploadScope+'/files',{
      method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},
      body:JSON.stringify({fileName:'race-'+i+'.xml',mediaType:'application/xml',sourceDocument:raceDocument})
    }).then(async response=>({status:response.status,body:await response.json()}))));
    assert.equal(raceResults.filter(value=>value.status===201).length,1,JSON.stringify(raceResults));
    assert.ok(raceResults.every(value=>[201,409].includes(value.status)),JSON.stringify(raceResults));
    const raced=await uploadSnapshot();assert.equal(raced.files.totalCount,8);
    const winner=raceResults.find(value=>value.status===201).body.sourcePackage;
    assert.equal(raced.activity.items.length,raceBefore.activity.items.length+1);
    assert.equal(raced.activity.items.filter(({activityEvent:value})=>value.eventType==='source_package_created' && value.subjectId===winner.sourcePackageId).length,1);
    assert.deepEqual(raced.imports,raceBefore.imports);assert.deepEqual(raced.releases,raceBefore.releases);
    assert.ok(!JSON.stringify(raced.files).includes('upload-password'));

    if(kind==='memory'){
      for(let i=0;i<1001;i++)await api(scope+'/source-packages',{
        fileName:'owned-resource-'+i+'.txt',mediaType:'text/plain',sourceDocument:'x'
      },'POST',201);
      const bounded=await api(scope+'/source-packages?limit=500');assert.equal(bounded.items.length,500);
      const complete=await api(scope+'/files');assert.equal(complete.totalCount,1007);assert.equal(complete.items.length,1007);
      assert.equal(complete.dependencySizesCalculated,false);assert.ok(complete.items.every(item=>item.totalSizeBytes===null));
    }
  }finally{
    if(server&&server.exitCode===null&&server.signalCode===null){
      const closed=new Promise(done=>server.once('close',done));server.kill('SIGTERM');
      await raceWithSmokeDeadline(closed,10000,()=>{server.kill('SIGKILL');throw Error('Owned file catalog shutdown timed out.');});
    }
    if(pool){await pool.query('DROP SCHEMA "'+schema+'" CASCADE');await pool.end();}
    await rm(folder,{recursive:true,force:true});
  }
});
