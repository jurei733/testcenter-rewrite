import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createFirstSliceServices} from '@testcenter-rewrite-app/application';
import {createSqliteFirstSliceStorage} from '@testcenter-rewrite-app/sqlite-store';
import {prepareOriginalXmlSchemaValidator} from '../packages/application/dist/packages/application/src/original-xml-schema.js';
const xml=(type,body)=>`<${type} xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/${type==='Unit'?'unit-xml/17.6':type==='Booklet'?'testcenter-booklet-xml/18.0':'testcenter-testtaker-xml/18.0'}">${body}</${type}>`;
export async function createNativeWebsocketFixture(file){
  const storage=createSqliteFirstSliceStorage(file),validator=await prepareOriginalXmlSchemaValidator(resolve(process.env.FIRST_SLICE_XML_SCHEMA_CACHE||'.data/original-xml-schemas'),false);
  const services=createFirstSliceServices({repository:storage.repository,originalXmlSchemaValidator:validator,xmlSchemaProfile:'original-19'});
  const tenant=await services.platform.createTenant({tenantKey:'owned-ws',displayName:'Owned WS'}),workspace=await services.platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:'owned',displayName:'Owned WS'}),scope={tenantKey:tenant.tenantKey,workspaceKey:workspace.workspaceKey};
  const upload=(fileName,sourceDocument,mediaType='application/xml')=>services.contentIntake.uploadWorkspaceFile({...scope,fileName,sourceDocument,mediaType});
  await upload('player.html',`<!doctype html><html><script type="application/ld+json">{"id":"owned-ws-player","version":"1.2.3","specVersion":"6.0","metadataVersion":"2.0","type":"player","name":[{"lang":"en","value":"Owned WS"}]}</script><body><label>Owned WS answer<input aria-label="Owned WS answer" disabled></label><script>let sessionId;const input=document.querySelector('input');addEventListener('message',event=>{if(event.data?.type==='vopStartCommand'){sessionId=event.data.sessionId;input.value=event.data.unitState?.dataParts?.owned||'';input.disabled=false;document.body.dataset.started='true';}});input.addEventListener('input',()=>parent.postMessage({type:'vopStateChangedNotification',sessionId,unitState:{dataParts:{owned:input.value},presentationProgress:'complete',responseProgress:'some'}},'*'));parent.postMessage({type:'vopReadyNotification',metadata:{specVersion:'6.0'}},'*');</script></body></html>`,'text/html');
  await upload('unit.xml',xml('Unit','<Metadata><Id>OWNED.WS.UNIT</Id><Label>Owned WS</Label></Metadata><Definition player="owned-ws-player@1.2.3">Owned</Definition>'));
  await upload('booklet.xml',xml('Booklet','<Metadata><Id>OWNED.WS.BOOK</Id><Label>Owned WS</Label></Metadata><Units><Unit id="OWNED.WS.UNIT" label="Owned WS"/></Units>'));
  await services.workspaceAdminRead.importParticipantRoster({...scope,rosterText:xml('Testtakers','<Metadata/><Profiles><GroupMonitor><Profile id="full" label="Full" view="full" groupColumn="show"/></GroupMonitor></Profiles><Group id="OWNED.WS" label="Owned WS"><Login name="ws-monitor" mode="monitor-group"><Profile id="full"/></Login><Login name="ws-owner" mode="run-hot-return"><Booklet>OWNED.WS.BOOK</Booklet></Login><Login name="ws-peer" mode="run-hot-return"><Booklet>OWNED.WS.BOOK</Booklet></Login></Group><Group id="FOREIGN.WS" label="Foreign WS"><Login name="ws-foreign" mode="monitor-group"><Profile id="full"/></Login></Group>')}).catch(error=>{error.message+=' '+JSON.stringify(error.details);throw error;});
  const person=async name=>services.originalSession.login({name,password:''});
  const peer=await person('ws-peer');
  const seedId=await services.originalTest.create({token:peer.token,bookletName:'OWNED.WS.BOOK'});await storage.shutdown();
  const control=new DatabaseSync(file);assert.equal(control.prepare('UPDATE original_test_number_counter SET last_number=? WHERE singleton=1').run('9007199254740992').changes,1);assert.equal(control.prepare('UPDATE original_native_command_counter SET last_number=? WHERE singleton=1').run('9007199254741992').changes,1);control.close();
  const reopened=createSqliteFirstSliceStorage(file),fresh=createFirstSliceServices({repository:reopened.repository,originalXmlSchemaValidator:validator,xmlSchemaProfile:'original-19'});
  const owner=await fresh.originalSession.login({name:'ws-owner',password:''});
  const id=await fresh.originalTest.create({token:owner.token,bookletName:'OWNED.WS.BOOK'});assert.equal(id,'9007199254740993');const monitor=await fresh.originalSession.login({name:'ws-monitor',password:''}),foreign=await fresh.originalSession.login({name:'ws-foreign',password:''});await reopened.shutdown();
  return {owner,peer,monitor,foreign,id};
}
