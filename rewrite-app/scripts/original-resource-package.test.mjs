import assert from 'node:assert/strict';
import test from 'node:test';
import {crc32,deflateRawSync} from 'node:zlib';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {Pool} from 'pg';
import {createFirstSliceServices} from '@testcenter-rewrite-app/application';
import {createInMemoryFirstSliceRepository} from '@testcenter-rewrite-app/memory-store';
import {createFileFirstSliceStorage} from '@testcenter-rewrite-app/file-store';
import {createSqliteFirstSliceStorage} from '@testcenter-rewrite-app/sqlite-store';
import {createPostgresFirstSliceStorage} from '@testcenter-rewrite-app/postgres-store';
import {prepareOriginalXmlSchemaValidator} from '../packages/application/dist/packages/application/src/original-xml-schema.js';
const validator=await prepareOriginalXmlSchemaValidator(resolve(process.env.FIRST_SLICE_XML_SCHEMA_CACHE||'.data/original-xml-schemas'),process.env.FIRST_SLICE_XML_SCHEMA_DOWNLOAD!=='false');
const schemas={Unit:'unit-xml/17.6',Booklet:'testcenter-booklet-xml/18.0',Testtakers:'testcenter-testtaker-xml/18.0'};
const xml=(type,body)=>`<${type} xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/${schemas[type]}">${body}</${type}>`;

function zip(files,deflate=false) {
  const local=[],central=[];
  let offset=0;
  for(const [path,content] of files) {
    const name=Buffer.from(path),data=Buffer.from(content),sum=crc32(data),compressed=deflate?deflateRawSync(data):data;
    const head=Buffer.alloc(30),directory=Buffer.alloc(46);
    head.writeUInt32LE(0x04034b50);head.writeUInt16LE(20,4);head.writeUInt16LE(0x0800,6);
    head.writeUInt16LE(deflate?8:0,8);head.writeUInt32LE(sum,14);head.writeUInt32LE(compressed.length,18);head.writeUInt32LE(data.length,22);head.writeUInt16LE(name.length,26);
    directory.writeUInt32LE(0x02014b50);directory.writeUInt16LE(20,4);directory.writeUInt16LE(20,6);directory.writeUInt16LE(0x0800,8);
    directory.writeUInt16LE(deflate?8:0,10);directory.writeUInt32LE(sum,16);directory.writeUInt32LE(compressed.length,20);directory.writeUInt32LE(data.length,24);directory.writeUInt16LE(name.length,28);directory.writeUInt32LE(offset,42);
    local.push(head,name,compressed);central.push(directory,name);offset+=head.length+name.length+compressed.length;
  }
  const table=Buffer.concat(central),end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(table.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,table,end]);
}

test('loose Source ITCR resource archives upload without being treated as a Testcenter ZIP container',async()=>{
  const repository=createInMemoryFirstSliceRepository();
  const services=createFirstSliceServices({repository,xmlSchemaProfile:'legacy-compatibility'});
  const tenant=await services.platform.createTenant({tenantKey:'owned-resource-package',displayName:'Owned package'});
  const workspace=await services.platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:'owned',displayName:'Owned'});
  const bytes=zip([['GeoGebra/deployggb.js','/* exact resource Ω */'],['GeoGebra/pixel.bin',Buffer.from([0,255,128,13])]]);
  const result=await services.contentIntake.uploadWorkspaceFile({tenantKey:tenant.tenantKey,workspaceKey:workspace.workspaceKey,
    fileName:'GeoGebra.itcr.zip',mediaType:'application/zip',sourceDocument:'data:application/zip;base64,'+bytes.toString('base64')});
  assert.equal(result.sourcePackage.fileName,'Resource/GeoGebra.itcr.zip');
  assert.equal(result.sourcePackage.status,'accepted');
  assert.equal(result.importJob,null);
  assert.equal(result.stagedContentRelease,null);
});

test('resource archive budgets reject oversized expanded members, aggregate data and entry counts without publishing',async()=>{
  const repository=createInMemoryFirstSliceRepository(),services=createFirstSliceServices({repository,xmlSchemaProfile:'legacy-compatibility'});
  const tenant=await services.platform.createTenant({tenantKey:'owned-package-bounds',displayName:'Owned'});
  const workspace=await services.platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:'owned',displayName:'Owned'});
  const scope={tenantKey:tenant.tenantKey,workspaceKey:workspace.workspaceKey};
  const put=bytes=>services.contentIntake.uploadWorkspaceFile({...scope,fileName:'bounds.itcr.zip',mediaType:'application/zip',sourceDocument:'data:application/zip;base64,'+bytes.toString('base64')});
  const large=Buffer.alloc(20*1024*1024+1);
  await assert.rejects(put(zip([['large.bin',large]],true)),denied(413,'workspace_resource_package_too_large'));
  const block=large.subarray(0,20*1024*1024);
  await assert.rejects(put(zip(Array.from({length:13},(_,i)=>['block'+i,block]),true)),denied(413,'workspace_resource_package_too_large'));
  await assert.rejects(put(zip(Array.from({length:10_001},(_,i)=>['entry'+i,'']))),denied(400,'workspace_resource_package_invalid'));
  assert.deepEqual(await repository.listSourcePackagesByWorkspace(tenant.tenantId,workspace.workspaceId),[]);
  assert.equal((await repository.listWorkspaceActivityEventsByWorkspace(tenant.tenantId,workspace.workspaceId)).filter(row=>row.eventType==='source_package_created').length,0);
});

const denied=(status,code)=>error=>{
  assert.equal(error.statusCode,status);if(code)assert.equal(error.errorCode,code);return true;
};
const kinds=process.env.FIRST_SLICE_STORE==='postgres'?['postgres']:['memory','file','sqlite'];
for(const kind of kinds)test(kind+': installed resource archives preserve scope, bytes, replacement history and native answers',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'owned-resource-package-'));
  const schema='owned_resource_'+randomUUID().replaceAll('-','');
  const url=kind==='postgres'?new URL(process.env.FIRST_SLICE_POSTGRES_URL):null;
  url?.searchParams.set('options','-c search_path='+schema);
  let control,storage,repository,services;
  const open=async()=>{
    storage=kind==='memory'?storage??{repository:createInMemoryFirstSliceRepository(),shutdown:async()=>{}}
      :kind==='file'?await createFileFirstSliceStorage(join(directory,'owned.json'))
      :kind==='sqlite'?createSqliteFirstSliceStorage(join(directory,'owned.sqlite'))
      :await createPostgresFirstSliceStorage(url.toString());
    repository=storage.repository;services=createFirstSliceServices({repository,originalXmlSchemaValidator:validator,xmlSchemaProfile:'original-19'});
  };
  const reopen=async()=>{if(kind!=='memory'){await storage.shutdown();storage=undefined;}await open();};
  try {
    if(url){control=new Pool({connectionString:process.env.FIRST_SLICE_POSTGRES_URL});await control.query('CREATE SCHEMA "'+schema+'"');}
    await open();
    const tenant=await services.platform.createTenant({tenantKey:'resource-'+randomUUID(),displayName:'Owned resource'});
    const prepare=async key=>{
      const workspace=await services.platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:key,displayName:key});
      const scope={tenantKey:tenant.tenantKey,workspaceKey:workspace.workspaceKey};
      const upload=(fileName,sourceDocument,mediaType='application/xml')=>services.contentIntake.uploadWorkspaceFile({...scope,fileName,sourceDocument,mediaType});
      await upload('player.html','<html><script type="application/ld+json">'+JSON.stringify({$schema:'https://raw.githubusercontent.com/verona-interfaces/metadata/master/verona-module-metadata.json',id:'owned-resource-player',version:'1.0.0',metadataVersion:'2.0',specVersion:'6.0',type:'player',name:[{lang:'en',value:'Owned'}]})+'</script></html>','text/html');
      await upload('unit.xml',xml('Unit','<Metadata><Id>RESOURCE.UNIT</Id><Label>Owned Unit</Label></Metadata><Definition player="owned-resource-player@1.0.0">Owned definition</Definition>'));
      await upload('booklet.xml',xml('Booklet','<Metadata><Id>RESOURCE.BOOKLET</Id><Label>Owned Booklet</Label></Metadata><Units><Unit id="RESOURCE.UNIT" label="Owned Unit"/></Units>'));
      const name='owned-resource-'+randomUUID(),password='Owned resource package control';
      await services.workspaceAdminRead.importParticipantRoster({...scope,rosterText:xml('Testtakers','<Metadata/><Group id="Resource.Group" label="Owned resources"><Login name="'+name+'" pw="'+password+'" mode="run-hot-return"><Booklet codes="Owned">RESOURCE.BOOKLET</Booklet></Login></Group>')});
      const login=await services.originalAuthentication.login({name,password});
      const person=await services.originalAuthentication.person({loginToken:login.token,code:'Owned'});
      const testNumber=await services.originalTest.create({token:person.token,bookletName:'RESOURCE.BOOKLET'});
      const native=await services.originalTest.read({token:person.token,testNumber});
      const request={token:person.token,testNumber,unitName:'RESOURCE.UNIT'};
      await services.originalUnit.patchState({...request,body:{originalUnitId:'RESOURCE.UNIT',newState:[]}});
      await services.originalUnit.putResponse({...request,body:{originalUnitId:'RESOURCE.UNIT',timeStamp:11,responseType:'owned',dataParts:{answer:'Private '+key+' Ω'}}});
      const answer=await services.originalUnit.read({...request,nativeUnitProtocol:'1'});
      const resource=path=>services.originalTest.resource({groupToken:person.groupToken,workspaceNumber:native.workspaceId,path});
      return{scope,workspace,person,request,answer,resource,upload,native};
    };
    const own=await prepare('own'),foreign=await prepare('foreign');
    const first=zip([['GeoGebra/deployggb.js','/* first Ω */'],['GeoGebra/pixel.bin',Buffer.from([0,255,128,13])],['removed.txt','old member']]);
    const replacement=zip([['GeoGebra/deployggb.js','/* replacement Ω */']]);
    const put=(owner,bytes,name='GeoGebra.itcr.zip')=>owner.upload(name,'data:application/zip;base64,'+bytes.toString('base64'),'application/zip');
    let installed;
    await t.test('native group capability reads exact member bytes and content types without crossing workspaces',async()=>{
      installed=(await put(own,first)).sourcePackage;await put(foreign,zip([['GeoGebra/deployggb.js','private foreign script']]));
      const script=await own.resource('Resource/GeoGebra/GeoGebra/deployggb.js');
      assert.equal(script.contentType,'text/javascript');assert.equal(Buffer.from(script.bytes).toString(),'/* first Ω */');
      const binary=await own.resource('Resource/GeoGebra/GeoGebra/pixel.bin');assert.equal(binary.contentType,'application/octet-stream');assert.deepEqual(Buffer.from(binary.bytes),Buffer.from([0,255,128,13]));
      assert.deepEqual(Buffer.from((await own.resource('Resource/GeoGebra.itcr.zip')).bytes),first);
      script.bytes[0]=0;assert.equal(Buffer.from((await own.resource('Resource/GeoGebra/GeoGebra/deployggb.js')).bytes).toString(),'/* first Ω */');
      assert.equal(Buffer.from((await foreign.resource('Resource/GeoGebra/GeoGebra/deployggb.js')).bytes).toString(),'private foreign script');
      await assert.rejects(services.originalTest.resource({groupToken:own.person.groupToken,workspaceNumber:foreign.native.workspaceId,path:'Resource/GeoGebra/GeoGebra/deployggb.js'}),denied(403));
      await assert.rejects(own.resource('Resource/GeoGebra/../player.html'),denied(404));
      await assert.rejects(own.resource('Unit/unit.xml'),denied(403));
    });
    await t.test('every invalid member is rejected before publishing or replacing any archive',async()=>{
      const count=async()=>[(await repository.listSourcePackagesByWorkspace(tenant.tenantId,own.workspace.workspaceId)).length,
        (await repository.listWorkspaceActivityEventsByWorkspace(tenant.tenantId,own.workspace.workspaceId)).length];
      const before=await count();
      const corrupt=zip([['ok.js','valid first'],['bad.js','bad later payload']]);corrupt[corrupt.indexOf(Buffer.from('bad later payload'))]^=1;
      for(const bytes of [zip([['../outside.js','bad']]),zip([['/absolute.js','bad']]),zip([['windows\\outside.js','bad']]),
        zip([['same.js','a'],['same.js','b']]),zip([['same.js','a'],['SAME.js','b']]),zip([['directory','a'],['directory/child.js','b']]),corrupt]) {
        await assert.rejects(put(own,bytes),denied(400,'workspace_resource_package_invalid'));assert.deepEqual(await count(),before);
        assert.equal(Buffer.from((await own.resource('Resource/GeoGebra/GeoGebra/deployggb.js')).bytes).toString(),'/* first Ω */');
      }
      const ordinary=await put(own,first,'regular.zip');assert.equal(ordinary.sourcePackage,null);assert.equal(ordinary.archiveReport.importedCount,3);assert.equal(ordinary.archiveReport.rejectedCount,0);
      await assert.rejects(put(own,first,'.itcr.zip'),denied(400,'workspace_resource_package_invalid'));
    });
    await t.test('replacement makes only the current archive visible and keeps old source bytes immutable',async()=>{
      const next=await put(own,replacement);assert.equal(next.replacedSourcePackageId,installed.sourcePackageId);installed=next.sourcePackage;
      assert.equal(Buffer.from((await own.resource('Resource/GeoGebra/GeoGebra/deployggb.js')).bytes).toString(),'/* replacement Ω */');
      await assert.rejects(own.resource('Resource/GeoGebra/removed.txt'),denied(404));
      const previous=await repository.getSourcePackageById(next.replacedSourcePackageId);assert.equal(previous.sourceDocument,'data:application/zip;base64,'+first.toString('base64'));
      assert.equal(Buffer.from((await foreign.resource('Resource/GeoGebra/GeoGebra/deployggb.js')).bytes).toString(),'private foreign script');
    });
    await t.test('stored package prefix follows the Source case-sensitive suffix rule',async()=>{
      await put(own,zip([['member.txt','upper suffix']]),'Upper.ITCR.ZIP');
      assert.equal(Buffer.from((await own.resource('Resource/Upper.ITCR.ZIP/member.txt')).bytes).toString(),'upper suffix');
      await assert.rejects(own.resource('Resource/Upper/member.txt'),denied(404));
    });
    await t.test('reopening retains native archive access and every existing private Unit response',async()=>{
      await reopen();
      assert.equal(Buffer.from((await own.resource('Resource/GeoGebra/GeoGebra/deployggb.js')).bytes).toString(),'/* replacement Ω */');
      for(const owner of [own,foreign])assert.deepEqual(await services.originalUnit.read({...owner.request,nativeUnitProtocol:'1'}),owner.answer);
    });
    await t.test('deleting the current resource archive cannot resurrect a replaced package',async()=>{
      await services.contentIntake.deleteSourcePackage({...own.scope,sourcePackageId:installed.sourcePackageId,confirmation:installed.fileName});
      await assert.rejects(own.resource('Resource/GeoGebra/GeoGebra/deployggb.js'),denied(404));
      await reopen();await assert.rejects(own.resource('Resource/GeoGebra/removed.txt'),denied(404));
      for(const owner of [own,foreign])assert.deepEqual(await services.originalUnit.read({...owner.request,nativeUnitProtocol:'1'}),owner.answer);
    });
  } finally {
    await storage?.shutdown();
    if(control){await control.query('DROP SCHEMA IF EXISTS "'+schema+'" CASCADE');await control.end();}
    await rm(directory,{recursive:true,force:true});
  }
});
