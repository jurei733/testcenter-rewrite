import assert from 'node:assert/strict';
import test from 'node:test';
import type {SourcePackage} from '@testcenter-rewrite-app/domain';
import type {FirstSliceRepository} from './index.js';
import {createOriginalTestFiles} from './original-test-files.js';
import type {WorkspaceCatalogInput} from './workspace-file-catalog.js';

const scope = {tenantId:'tenant',workspaceId:'workspace'};
function fixture() {
  let version = 0;
  const sources:SourcePackage[] = [];
  const projections = new Map<string,WorkspaceCatalogInput>();
  const add = (name:string, fileType:WorkspaceCatalogInput['fileType'], sourceText:string, resourceIdentifier:string|null=null) => {
    const sourcePackageId = String(++version);
    const source = {...scope,sourcePackageId,fileName:name,mediaType:'text/plain',sourceDocument:sourceText,status:'uploaded',uploadedAt:'2026-10-28T00:00:00Z'} as SourcePackage;
    sources.push(source);projections.set(sourcePackageId,{sourcePackageId,fileName:name,fileType,status:'uploaded',uploadedAt:source.uploadedAt,
      sourceText,fileSizeBytes:Buffer.byteLength(sourceText),resourceIdentifier});return source;
  };
  add('Resource/player.html','Resource','<html/>','owned-player-1.0');
  const repository = {listSourcePackagesByWorkspace:async(tenantId:string,workspaceId:string)=>sources.filter(source=>source.tenantId===tenantId&&source.workspaceId===workspaceId),
    listWorkspaceActivityEventsByWorkspace:async()=>[]} as unknown as FirstSliceRepository;
  return {add,sources,files:createOriginalTestFiles({repository,project:source=>projections.get(source.sourcePackageId)!,
    decode:source=>({bytes:Buffer.from(source.sourceDocument!)})})};
}
const unit = (definition:string) => `<Unit><Metadata><Id>G8-GEO</Id></Metadata>${definition}</Unit>`;

test('native Unit DefinitionRef returns the exact scoped resource text', async()=>{
  const {add,files}=fixture();
  const definition='\n{"prompt":"Fläche Ω", "items":[{"id":"area"}]}\n';
  add('Resource/geometry.voud','Resource',definition);
  add('Unit/geometry.xml','Unit',unit('<DefinitionRef player="owned-player@1.0.3">geometry.voud</DefinitionRef>'));
  assert.deepEqual(await files.unit(scope,'g8-geo'),{definition,definitionType:'owned-player-1.0'});
  await assert.rejects(()=>files.unit({...scope,workspaceId:'foreign'},'G8-GEO'));
});
test('inline definitions retain text, CDATA and entity decoding',async()=>{
  const {add,files}=fixture();
  add('Unit/geometry.xml','Unit',unit('<Definition player="owned-player@1.0.3">before &amp; <![CDATA[<b>Ω</b>]]> after</Definition>'));
  assert.equal((await files.unit(scope,'G8-GEO')).definition,'before & <b>Ω</b> after');
});
test('missing, rejected and ambiguous DefinitionRef resources fail closed',async()=>{
  for (const kind of ['missing','rejected','ambiguous']) {
    const {add,files}=fixture();
    add('Unit/geometry.xml','Unit',unit('<DefinitionRef player="owned-player@1.0.3">geometry.voud</DefinitionRef>'));
    if(kind!=='missing') {const resource=add('Resource/geometry.voud','Resource','{}');if(kind==='rejected')resource.status='rejected';}
    if(kind==='ambiguous')add('Resource/other/geometry.voud','Resource','{"other":true}');
    await assert.rejects(()=>files.unit(scope,'G8-GEO'));
  }
});
