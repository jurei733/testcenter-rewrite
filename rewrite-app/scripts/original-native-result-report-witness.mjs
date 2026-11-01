import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {decodeOriginalTestLogJson} from '../packages/application/dist/packages/application/src/original-test-log-json.js';

const root=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-result-report-http/',import.meta.url);
const load=async name=>readFile(new URL(name,root));
const observed=JSON.parse(await load('observations.json'));
const byLabel=new Map(observed.rows.map(row=>[row.label,row]));
export async function verifyNativeResultReportWitness(){
 const manifest=JSON.parse(await load('manifest.json')),proof=JSON.parse(await load('independent-verification.json'));
 assert.equal(manifest.sourceCommit,'eedae41840cbe90e5547c0211da818bdf620f5aa');assert.equal(manifest.httpExchanges,57);assert.equal(observed.rows.length,57);
 for(const[name,digest]of Object.entries(manifest.files))assert.equal(createHash('sha256').update(await load(name)).digest('hex'),digest,name);
 assert.equal(proof.sourceFilesReverified,137);assert.equal(proof.lockedProductionComposerPackagesReverified,19);assert.equal(proof.exactImage,manifest.backendImage);assert.equal(proof.allowTestMode,false);assert.equal(proof.xmlSchemaValidation,true);assert.equal(observed.sourceCodeAndVendorUnmodified,true);assert.equal(observed.sqlSeedsOrDaoStubs,false);
 for(const family of ['response','log'])for(const format of ['json','csv']){
  const row=byLabel.get('operator-'+family+'-'+format);assert.equal(row.status,200);assert.equal(createHash('sha256').update(row.rawText).digest('hex'),row.bodySha256);
  if(format==='csv'){assert.match(row.contentType,/^text\/csv/);assert.ok(row.rawText.startsWith('\uFEFF'));}
 }
 assert.match(byLabel.get('operator-log-json').rawText,/"timestamp":9007199254740993/);
}

/** Replay actual public participant operations, then reopen the real store.
 * No DAO-shaped row seeding or normalization of Source response bytes. */
export async function assertNativeResultReportWitness({services,tenantKey,setNow,reopen,witness='observations.json',workspaceKey='source-wire'}){
 const current=JSON.parse(await load(witness)),byLabel=new Map(current.rows.map(row=>[row.label,row])),identity=byLabel.get('operator-response-json').value[0];
 const workspace=await services().platform.createWorkspace({tenantKey,workspaceKey,displayName:'Source wire witness'});
 const scope={tenantKey,workspaceKey:workspace.workspaceKey};
 const xml=(type,body)=>'<'+type+' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/'+(type==='Unit'?'unit-xml/17.6':type==='Booklet'?'testcenter-booklet-xml/18.0':'testcenter-testtaker-xml/18.0')+'">'+body+'</'+type+'>';
 const metadata={id:'owned-protected-player',version:'1.0.0',specVersion:'6.0',metadataVersion:'2.0',type:'player',name:[{lang:'de',value:'Owned protected Player'}],description:[{lang:'de',value:'Owned fixture'}]};
 for(const[fileName,sourceDocument,mediaType]of [
  ['owned-protected-player-1.0.html','<html><script type="application/ld+json">'+JSON.stringify(metadata)+'</script><main>Owned protected Player</main></html>','text/html'],
  ['owned-protected-unit.xml',xml('Unit','<Metadata><Id>OWNED.UNIT</Id><Label>Owned protected Unit</Label></Metadata><Definition player="owned-protected-player@1.0.0">Owned protected definition</Definition>'),'application/xml'],
  ['owned-protected-booklet.xml',xml('Booklet','<Metadata><Id>OWNED.PROTECTED</Id><Label>Owned protected Booklet</Label></Metadata><Units><Unit id="OWNED.UNIT" label="Owned protected Unit"/></Units>'),'application/xml']
 ])await services().contentIntake.uploadWorkspaceFile({...scope,fileName,sourceDocument,mediaType});
 await services().workspaceAdminRead.importParticipantRoster({...scope,rosterText:xml('Testtakers','<Metadata/><Group id="'+identity.groupname+'" label="Owned protected group"><Login name="'+identity.loginname+'" mode="run-trial"><Booklet>OWNED.PROTECTED</Booklet></Login></Group>')});
 const actor=await services().originalAuthentication.login({name:identity.loginname,password:''});assert.equal(actor.kind,'person');
 const testNumber=await services().originalTest.create({token:actor.token,bookletName:'OWNED.PROTECTED'}),unit={token:actor.token,testNumber,unitName:'OWNED.UNIT'};
 for(const[kind,unitName]of [['unit','OWNED.UNIT'],['booklet',null]]){
  const instant=byLabel.get(kind+'-list').value[0].reviewtime.replace(' ','T').replace(/\+00$/,'Z');setNow(instant);
  await services().originalReview.create({...unit,unitName,body:JSON.parse(byLabel.get(kind+'-create').requestBodyText)});
 }
 await services().originalUnit.patchState({...unit,body:JSON.parse(byLabel.get('wire-unit-state').requestBodyText)});
 await services().originalUnit.putResponse({...unit,body:JSON.parse(byLabel.get('wire-unit-response').requestBodyText)});
 await services().originalUnit.putLog({...unit,body:JSON.parse(byLabel.get('wire-unit-log').requestBodyText)});
 await services().originalTest.putLog({token:actor.token,testNumber,body:decodeOriginalTestLogJson(byLabel.get('wire-test-log').requestBodyText)});
 await reopen();
 const archive=await services().workspaceAdminRead.exportOriginalResultArchive({...scope,groupKeys:[identity.groupname]}),files=new Map();let offset=0;
 while(archive.body.readUInt32LE(offset)===0x04034b50){const len=archive.body.readUInt32LE(offset+18),n=archive.body.readUInt16LE(offset+26),start=offset+30+n+archive.body.readUInt16LE(offset+28);files.set(archive.body.subarray(offset+30,offset+30+n).toString(),archive.body.subarray(start,start+len).toString());offset=start+len;}
 for(const[family,file]of [['response','responses'],['log','logs']])for(const format of ['json','csv'])assert.equal(files.get(file+'.'+format),byLabel.get('operator-'+family+'-'+format).rawText,family+' '+format+' must retain actual Source bytes after durable reopen');
 return scope;
}
