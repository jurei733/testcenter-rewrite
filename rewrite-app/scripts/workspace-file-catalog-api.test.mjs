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
