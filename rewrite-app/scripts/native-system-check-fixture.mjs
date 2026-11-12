import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
const fixture=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-syscheck-http/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',fixture)));
for(const [name,digest]of Object.entries(manifest.files)){
 assert.match(name,/^[a-z0-9.-]+$/);assert.equal(createHash('sha256').update(await readFile(new URL(name,fixture))).digest('hex'),digest);
}
export const sourceSystemCheck=JSON.parse(await readFile(new URL('observations.json',fixture)));
export const sourceReply=label=>{const row=sourceSystemCheck.rows.find(row=>row.label===label);assert.ok(row,label);return row;};
const wireFixture=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-syscheck-wire-http/',import.meta.url);
const wireManifest=JSON.parse(await readFile(new URL('manifest.json',wireFixture)));
for(const [name,digest]of Object.entries(wireManifest.files)){
 assert.match(name,/^[a-z0-9.-]+$/);assert.equal(createHash('sha256').update(await readFile(new URL(name,wireFixture))).digest('hex'),digest);
}
export const sourceSystemCheckWire=JSON.parse(await readFile(new URL('observations.json',wireFixture)));
assert.equal(sourceSystemCheckWire.rows.length,77);assert.equal(sourceSystemCheckWire.actualSourceBackend,true);assert.equal(sourceSystemCheckWire.sqlSeedsOrDaoStubs,false);
assert.equal(sourceSystemCheckWire.sourceCommit,'eedae41840cbe90e5547c0211da818bdf620f5aa');assert.equal(Object.keys(sourceSystemCheckWire.sourceHashes).length,137);
assert.deepEqual(sourceSystemCheckWire.configuration,{xmlSchemaValidation:true,allowTestMode:false,bruteForceProtection:'login person'});
export const sourceWireReply=label=>{const row=sourceSystemCheckWire.rows.find(row=>row.label===label);assert.ok(row,label);return row;};
const schema={Testtakers:'testcenter-testtaker-xml/18.0',SysCheck:'testcenter-syscheck-xml/18.0',Unit:'unit-xml/17.6',Booklet:'testcenter-booklet-xml/18.0'};
export const systemCheckXml=(name,body)=>'<'+name+' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/'+schema[name]+'">'+body+'</'+name+'>';
export const nativeCheckXml=systemCheckXml('SysCheck','<Metadata><Id>R98.CHECK</Id><Label>Owned Theme Check</Label></Metadata><Config skipnetwork="true"><Q id="owned" type="string" prompt="Owned"/></Config>');
export const nativeUnitCheckXml=systemCheckXml('SysCheck','<Metadata><Id>R99.UNITCHECK</Id><Label>Owned Unit Check</Label><Description>Owned description</Description></Metadata><Config unit="R98.UNIT" savekey="owned-key" skipnetwork="false"><CustomText key="syscheck_intro">Owned intro</CustomText><Q id="yes" type="check" prompt="Owned check" required="true"/><Q id="radio" type="radio" prompt="Owned radio">A#B</Q></Config>');
export const nativeSpeedCheckXml=systemCheckXml('SysCheck','<Metadata><Id>R100.SPEEDCHECK</Id><Label>Owned Speed Check</Label></Metadata><Config savekey="0" skipnetwork="1"><UploadSpeed min="9007199254740993" good="9007199254740994" maxErrorsPerSequence="2">100, 200,300</UploadSpeed><DownloadSpeed min="1"/><CustomText key="syscheck_intro">  Owned spaced intro  </CustomText><CustomText key="future">Owned second text</CustomText><Q id="radio" type="radio" prompt="Owned lexical boolean" required="1"> A # B # </Q></Config>');
export const systemCheckRoster=(mode='sys-check-login')=>systemCheckXml('Testtakers','<Metadata/><Group id="R98.GROUP" label="Owned Theme Group"><Login name="r98-syscheck" pw="owned-r98-theme-password" mode="'+mode+'"><ViewSettings><theme>Sekundar</theme></ViewSettings></Login><Login name="r98-monitor" pw="owned-r98-theme-password" mode="monitor-group"/></Group>');
export async function setupNativeSystemCheck(services,repository){
 const tenant=await services.platform.createTenant({tenantKey:'owned-'+randomUUID(),displayName:'Owned native Systemcheck'});
 const workspace=await services.platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:'owned',displayName:'Owned native Systemcheck'});
 const scope={tenantKey:tenant.tenantKey,workspaceKey:workspace.workspaceKey},ids={tenantId:tenant.tenantId,workspaceId:workspace.workspaceId};
 const upload=(fileName,sourceDocument,mediaType='application/xml')=>services.contentIntake.uploadWorkspaceFile({...scope,fileName,sourceDocument,mediaType});
 await upload('owned-theme-player-1.0.html',sourceReply('unit-with-player').value.player,'text/html');
 await upload('unit.xml',systemCheckXml('Unit','<Metadata><Id>R98.UNIT</Id><Label>Owned</Label></Metadata><Definition player="owned-theme-player-1.0">Owned</Definition>'));
 await upload('syscheck.xml',nativeCheckXml);await upload('syscheck-unit.xml',nativeUnitCheckXml);
 await services.workspaceAdminRead.importParticipantRoster({...scope,rosterText:systemCheckRoster()});
 const workspaceNumber=await repository.getOrCreateOriginalWorkspaceNumber(ids);
 const login=()=>services.originalSession.login({name:'r98-syscheck',password:'owned-r98-theme-password'});
 const actor=await login(),monitor=await services.originalSession.login({name:'r98-monitor',password:'owned-r98-theme-password'});
 return{scope,ids,workspaceNumber,actor,monitor,login,upload,roster:(mode='sys-check-login')=>services.workspaceAdminRead.importParticipantRoster({...scope,rosterText:systemCheckRoster(mode)})};
}
