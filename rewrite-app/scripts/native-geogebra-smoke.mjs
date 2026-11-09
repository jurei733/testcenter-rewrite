import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {join,basename,dirname} from 'node:path';
import {brotliDecompressSync,inflateRawSync} from 'node:zlib';
import {runNativeResourceUploadSmoke} from './native-resource-upload-smoke.mjs';
import {runNativeWorkspaceZipSmoke} from './native-workspace-zip-smoke.mjs';
import {workspaceZip} from './workspace-zip-fixture.mjs';
import {runNativeWorkerRestartSmoke} from './native-worker-restart-smoke.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const xml=(type,body)=>`<${type} xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/${type==='Unit'?'unit-xml/17.6':type==='Booklet'?'testcenter-booklet-xml/18.0':'testcenter-testtaker-xml/18.0'}">${body}</${type}>`;

// Independent test oracle for the construction actually emitted by GeoGebra.
// Only the known geogebra.xml member is inflated, with a small output budget.
function emittedPoint(parts) {
  const candidates=[];
  const visit=value=>{
    if(typeof value==='string'){
      if(value.startsWith('UEsDB'))candidates.push(Buffer.from(value,'base64'));
      else {try{visit(JSON.parse(value));}catch{}}
    }else if(Array.isArray(value))value.forEach(visit);
    else if(value&&typeof value==='object')Object.values(value).forEach(visit);
  };
  visit(parts);
  for(const bytes of candidates){
    let end=-1;
    for(let offset=bytes.length-22;offset>=Math.max(0,bytes.length-65557);offset--)
      if(bytes.readUInt32LE(offset)===0x06054b50){end=offset;break;}
    if(end<0)continue;
    let offset=bytes.readUInt32LE(end+16);
    for(let index=0;index<bytes.readUInt16LE(end+10);index++){
      assert.equal(bytes.readUInt32LE(offset),0x02014b50);
      const nameLength=bytes.readUInt16LE(offset+28),extra=bytes.readUInt16LE(offset+30),comment=bytes.readUInt16LE(offset+32);
      const name=bytes.subarray(offset+46,offset+46+nameLength).toString();
      if(name==='geogebra.xml'){
        const local=bytes.readUInt32LE(offset+42),size=bytes.readUInt32LE(offset+20),method=bytes.readUInt16LE(offset+10);
        const start=local+30+bytes.readUInt16LE(local+26)+bytes.readUInt16LE(local+28),compressed=bytes.subarray(start,start+size);
        const text=(method===0?compressed:inflateRawSync(compressed,{maxOutputLength:1024*1024})).toString();
        const point=/<element\b[^>]*\blabel="B"[^>]*>([\s\S]*?)<\/element>/.exec(text);
        const coordinates=point&&/<coords\b[^>]*\/>/.exec(point[1]);
        if(coordinates)return coordinates[0];
      }
      offset+=46+nameLength+extra+comment;
    }
  }
}

async function cachedAsset(app,asset,environment) {
  const path=process.env[environment]||join(app,'.data/native-geogebra',basename(asset.sourceUrl));
  let bytes;
  try {bytes=await readFile(path);} catch(error) {
    if(error.code!=='ENOENT'||process.env.NATIVE_GEOGEBRA_DOWNLOAD==='false')throw error;
    const response=await fetch(asset.sourceUrl,{signal:AbortSignal.timeout(30_000)});
    assert.equal(response.status,200,'Pinned GeoGebra runtime download');
    bytes=Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.length,asset.bytes);assert.equal(hash(bytes),asset.sha256);
    await mkdir(dirname(path),{recursive:true});
    const temporary=path+'.'+randomUUID()+'.tmp';await writeFile(temporary,bytes);await rename(temporary,path);
  }
  assert.equal(bytes.length,asset.bytes);assert.equal(hash(bytes),asset.sha256);
  if(asset.gitBlob)assert.equal(createHash('sha1').update(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])).digest('hex'),asset.gitBlob);
  return bytes;
}

export async function prepareNativeGeoGebraFixture({services,tenantKey,app,password}) {
  const root=join(app,'test-fixtures/original-testcenter');
  const manifest=JSON.parse(await readFile(join(root,'native-geogebra/manifest.json'),'utf8'));
  const corpus=JSON.parse(await readFile(join(root,'corpus.json'),'utf8'));
  const source=corpus.veronaPlayerFamilyPackages.find(row=>row.family==='Aspect current-release assessment');
  assert.equal(source.sourceCommit,manifest.sourceCommit);
  const player=brotliDecompressSync(Buffer.from(await readFile(join(root,source.playerFixture),'utf8'),'base64'));
  const scaffold=Buffer.from(await readFile(join(root,source.definitionFixture),'utf8'),'base64');
  const ggbText=await readFile(join(root,'native-geogebra/geogebra.base64'),'utf8');
  assert.equal(hash(player),manifest.player.playerSha256);assert.equal(hash(scaffold),source.definitionSha256);
  assert.equal(hash(ggbText),manifest.definition.sha256);assert.equal(hash(Buffer.from(ggbText,'base64')),manifest.definition.decodedGgbSha256);
  const definition=JSON.parse(scaffold),page=definition.pages[0],section=page.sections[0];
  const title=structuredClone(section.elements.find(row=>row.type==='text'));
  title.text='<p>Native GeoGebra recovery</p>';
  const element=structuredClone(section.elements.find(row=>row.type==='text-field'));
  Object.assign(element,{type:'geometry',id:'owned_geometry',alias:'owned_geometry',
    appDefinition:ggbText.trim(),trackedVariables:[{id:'A',value:''},{id:'B',value:''}],trackedExpectedVariables:[],
    showResetIcon:true,enableUndoRedo:true,showToolbar:false,enableShiftDragZoom:false,
    showZoomButtons:false,showFullscreenButton:false,customToolbar:'',fileName:'official-example.ggb',
    dimensions:{width:1100,height:450},position:{...element.position,gridRow:2}});
  page.maxWidth=1160;
  section.elements=[title,element];page.sections=[section];definition.pages=[page];
  const document=JSON.stringify(definition),runtime=await cachedAsset(app,manifest.runtime,'NATIVE_GEOGEBRA_RUNTIME_FILE');
  const large=await cachedAsset(app,manifest.largeGeometry,'NATIVE_GEOGEBRA_LARGE_GGB_FILE');
  const largeDefinition=structuredClone(definition),largeElement=largeDefinition.pages[0].sections[0].elements.find(row=>row.type==='geometry');
  largeElement.appDefinition=large.toString('base64');largeElement.fileName='milchstrasze.ggb';largeElement.dimensions.height=650;
  const largeDocument=JSON.stringify(largeDefinition);
  const workspace=await services.platform.createWorkspace({tenantKey,workspaceKey:'native-geogebra',displayName:'Owned native GeoGebra'});
  const scope={tenantKey,workspaceKey:workspace.workspaceKey};
  const upload=(fileName,sourceDocument,mediaType='application/xml')=>services.contentIntake.uploadWorkspaceFile({...scope,fileName,sourceDocument,mediaType});
  await upload('iqb-player-aspect-2.12.6.html',player.toString('utf8'),'text/html');
  // Leave the archive absent until the real administration browser uploads it.
  await upload('geometry.xml',xml('Unit','<Metadata><Id>NATIVE.GEOMETRY</Id><Label>Native GeoGebra</Label></Metadata><Definition player="iqb-player-aspect@2.12"><![CDATA['+document+']]></Definition>'));
  await upload('geometry-large.xml',xml('Unit','<Metadata><Id>NATIVE.GEOMETRY.LARGE</Id><Label>Native GeoGebra large</Label></Metadata><Definition player="iqb-player-aspect@2.12"><![CDATA['+largeDocument+']]></Definition>'));
  await upload('geometry-booklet.xml',xml('Booklet','<Metadata><Id>NATIVE.GEOGEBRA</Id><Label>Native GeoGebra recovery</Label></Metadata><Units><Unit id="NATIVE.GEOMETRY" alias="1" label="Geometry one"/><Unit id="NATIVE.GEOMETRY.LARGE" alias="2" label="Geometry two"/></Units>'));
  await services.workspaceAdminRead.importParticipantRoster({...scope,rosterText:xml('Testtakers','<Metadata/><Group id="Owned.Geometry" label="Owned geometry"><Login name="native-geogebra" pw="'+password+'" mode="run-hot-return"><Booklet>NATIVE.GEOGEBRA</Booklet></Login></Group>')});
  const archiveWorkspace=await services.platform.createWorkspace({tenantKey,workspaceKey:'native-root-zip',displayName:'Owned whole ZIP'});
  const foreignWorkspace=await services.platform.createWorkspace({tenantKey,workspaceKey:'native-root-zip-foreign',displayName:'Owned foreign ZIP boundary'});
  const archiveScope={tenantKey,workspaceKey:archiveWorkspace.workspaceKey};
  const archiveEntries=[
    ['people/root-people.xml',xml('Testtakers','<Metadata/><Group id="Owned.RootZip" label="Owned whole ZIP"><Login name="native-root-zip" pw="'+password+'" mode="run-hot-return"><Booklet>NATIVE.GEOGEBRA</Booklet></Login></Group>')],
    ['books/geometry-booklet.xml',xml('Booklet','<Metadata><Id>NATIVE.GEOGEBRA</Id><Label>Native GeoGebra recovery</Label></Metadata><Units><Unit id="NATIVE.GEOMETRY" alias="1" label="Geometry one"/><Unit id="NATIVE.GEOMETRY.LARGE" alias="2" label="Geometry two"/></Units>')],
    ['units/geometry.xml',xml('Unit','<Metadata><Id>NATIVE.GEOMETRY</Id><Label>Native GeoGebra</Label></Metadata><Definition player="iqb-player-aspect@2.12"><![CDATA['+document+']]></Definition>')],
    ['units/geometry-large.xml',xml('Unit','<Metadata><Id>NATIVE.GEOMETRY.LARGE</Id><Label>Native GeoGebra large</Label></Metadata><Definition player="iqb-player-aspect@2.12"><![CDATA['+largeDocument+']]></Definition>')],
    ['players/iqb-player-aspect-2.12.6.html',player],['assets/GeoGebra.itcr.zip',runtime]
  ].map(([name,value])=>[name,Buffer.from(value)]);
  const bootstrap={username:'native-geometry-root',password:'Owned geometry bootstrap password-1!'};
  await services.adminAuth.bootstrapAdminUser(bootstrap);
  const rootSession=(await services.adminAuth.signIn(bootstrap)).adminSession.token;
  const operators={};
  for(const [key,accessMode]of [['writer','read_write'],['reader','read_only']]){
    const initial={username:'native-geometry-'+key,password:'Owned geometry '+key+' initial password-1!'};
    await services.adminDirectory.createAdminUser({...initial,sessionToken:rootSession,roleAssignments:[{role:'workspace_admin',...scope,accessMode},{role:'workspace_admin',...archiveScope,accessMode}]});
    const session=(await services.adminAuth.signIn(initial)).adminSession.token;
    const password='Owned geometry '+key+' changed password-2!';
    await services.adminAuth.changeOwnPassword({sessionToken:session,password});operators[key]={username:initial.username,password};
  }
  return {scope,manifest,definitionSha256:hash(document),largeDefinitionSha256:hash(largeDocument),login:'native-geogebra',password,
    resourceUpload:{bytes:runtime,...operators},
    rootZipFixture:{scope:archiveScope,manifest,definitionSha256:hash(document),largeDefinitionSha256:hash(largeDocument),login:'native-root-zip',password,
      resourceUpload:{...operators},rootArchive:{bytes:workspaceZip(archiveEntries),entries:archiveEntries,foreignWorkspaceKey:foreignWorkspace.workspaceKey}},
    fixturePaths:['test-fixtures/original-testcenter/native-geogebra/manifest.json','test-fixtures/original-testcenter/native-geogebra/geogebra.base64',
      'test-fixtures/original-testcenter/native-geogebra/web3d.nocache.js.base64',
      'test-fixtures/original-testcenter/'+source.playerFixture,'test-fixtures/original-testcenter/'+source.definitionFixture]};
}

export async function runNativeGeoGebraSmoke({browser,base,out,fixture,mark,configure,responseReceipts,release,serverMessages,workerRestart=false}) {
  const context=await browser.newContext({viewport:{width:1280,height:900}}),errors=[],resources=[],writes=[];
  let page=await context.newPage();
  const resourceUrls=new Map();
  context.on('response',response=>{
    const request=response.request(),url=new URL(response.url());
    if(url.pathname.startsWith('/file/')){
      const path=url.pathname.replace(/^\/file\/[^/]+/,'/file/[resource-capability]');
      resources.push({path,status:response.status(),adapter:response.headers()['x-testcenter-resource-adapter'],vary:response.headers().vary});
      resourceUrls.set(path,response.url());
    }
    if(request.method()==='PUT'&&url.pathname.endsWith('/response')&&response.status()===201)
      writes.push({path:url.pathname,deliveryId:request.headers()['x-native-delivery-id'],body:request.postDataJSON(),actorHash:hash(request.headers().authtoken||''),worker:!!request.serviceWorker(),zeroActorPagesAtReply:context.pages().length===0});
  });
  page.setDefaultTimeout(25_000);page.on('pageerror',error=>errors.push(String(error)));
  const wait=async(predicate,label)=>{const end=Date.now()+25_000;while(Date.now()<end){const value=await predicate();if(value)return value;await new Promise(resolve=>setTimeout(resolve,25));}throw Error('Native GeoGebra deadline: '+label);};
  const snapshot=element=>element.evaluate(()=>{
    const api=window.owned_geometry,documentXml=new DOMParser().parseFromString(api.getXML('B'),'application/xml');
    const point=documentXml.querySelector('element[label="B"] > coords');
    return{objects:api.getAllObjectNames(),x:api.getXcoord('B'),y:api.getYcoord('B'),display:api.getValueString('B'),
      pointCoordinates:point?.outerHTML,xml:api.getXML(),view:api.getViewProperties(1),
      canvases:[...document.querySelectorAll('canvas')].map(canvas=>{const b=canvas.getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height,css:canvas.className};})};
  });
  const ready=async()=>{
    const element=page.frameLocator('iframe').locator('#owned_geometry');await element.waitFor();
    await wait(()=>element.evaluate(()=>typeof window.owned_geometry?.getXcoord==='function'&&window.owned_geometry.getAllObjectNames().includes('B')),'actual GeoGebra initialization');
    // The official large construction saves its Graphics settings panel open.
    // Close it through the real accessible control so point B is visible.
    const close=page.frameLocator('iframe').locator('button.closeBtn[aria-label="Schließen"]');
    if(await close.isVisible())await close.click();
    await element.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    return element;
  };
  const drag=async(element,before)=>{
    // This is a real foreground pointer interaction; background rAF throttling
    // must not turn its rendered drag steps into seconds-long idle waits.
    await page.bringToFront();assert.equal(await page.evaluate(()=>document.visibilityState),'visible');
    const view=JSON.parse(before.view),canvas=before.canvases.find(row=>row.width>200&&row.height>200),frame=await page.locator('iframe').boundingBox();
    assert.ok(canvas&&frame);const relativeX=(before.x-view.xMin)/view.invXscale;
    const relativeY=view.height-(before.y-view.yMin)/view.invYscale;
    assert.ok(relativeX>0&&relativeX<canvas.width&&relativeY>0&&relativeY<canvas.height,'Point B is inside the actual canvas: '+JSON.stringify({view,canvas,relativeX,relativeY}));
    const x=frame.x+canvas.x+relativeX,y=frame.y+canvas.y+relativeY;
    assert.ok(x>frame.x&&x<frame.x+frame.width&&y>frame.y&&y<frame.y+frame.height,'Point B is visible before the trusted drag');
    await page.mouse.move(x,y);await page.mouse.down();
    // GeoGebra schedules selection/drag work on animation frames. Give each
    // trusted pointer step a rendered frame in both supported browser builds.
    const rendered=()=>element.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await rendered();
    for(let step=1;step<=8;step++){await page.mouse.move(x-40*step/8,y+20*step/8);await rendered();}
    await page.mouse.up();await rendered();
    return wait(async()=>{const value=await snapshot(element);return value.x!==before.x||value.y!==before.y?value:false;},'trusted drag changes the real GeoGebra point');
  };
  let testId;
  try {
    await configure('native-geogebra-administration',0);
    if(fixture.rootArchive)await runNativeWorkspaceZipSmoke({browser,base,out,fixture,mark});
    else await runNativeResourceUploadSmoke({browser,base,out,fixture,mark});
    await configure('native-geogebra',0);
    await page.goto(base+'/app/native-start?ui=original');
    await page.getByRole('textbox',{name:'Anmeldename',exact:true}).fill(fixture.login);await page.locator('[data-cy=login-user]').click();
    await page.getByLabel('Kennwort',{exact:true}).fill(fixture.password);await page.locator('[data-cy=login-user]').click();
    await page.locator('[data-cy="booklet-NATIVE.GEOGEBRA"]').getByRole('button').click();
    await page.waitForURL(/\/native-test\/[1-9][0-9]*\/u\/1(?:\?|$)/);
    testId=/\/native-test\/([1-9][0-9]*)/.exec(new URL(page.url()).pathname)[1];
    const element=await ready(),geometry=await snapshot(element);
    assert.ok(geometry.objects.includes('A'));assert.equal(typeof geometry.pointCoordinates,'string');assert.deepEqual(errors,[]);
    const isolation=await element.evaluate(()=>{
      const result={origin:window.origin};
      for(const [key,read] of [['ancestor',()=>window.parent.document],['cookie',()=>document.cookie],['storage',()=>localStorage.length]]){
        try{read();result[key]='accessible';}catch(error){result[key]=error.name;}
      }
      return result;
    });
    assert.deepEqual(isolation,{origin:'null',ancestor:'SecurityError',cookie:'SecurityError',storage:'SecurityError'});
    assert.ok(!(await page.locator('iframe').getAttribute('sandbox')).includes('allow-same-origin'));
    assert.equal(new Set(resources.filter(row=>row.adapter==='geogebra-gwt-opaque-v1').map(row=>row.path)).size,2);
    for(const [path,url] of resourceUrls){
      const expected=path.endsWith('/web3d.nocache.js')?fixture.manifest.runtime.bootstrap:path.endsWith('/89EAAC7096ECFDF6F8E851E8D8B0340A.cache.js')?fixture.manifest.runtime.gwtCache:null;
      if(expected){const reply=await context.request.get(url);assert.equal(reply.status(),200);assert.equal(hash(await reply.body()),expected.sha256);assert.match(reply.headers().vary,/Sec-Fetch-Dest/i);assert.equal(reply.headers()['x-testcenter-resource-adapter'],undefined);}
    }
    await page.screenshot({path:join(out,'native-geogebra-initialized.png')});
    mark('native-official-Aspect-executes-real-GeoGebra-through-an-installed-ITCR-resource-package');
    await writeFile(join(out,'native-geogebra-initialized.json'),JSON.stringify({success:true,testId,geometry,isolation,resources,errors,manifest:fixture.manifest,definitionSha256:fixture.definitionSha256},null,2));
    await configure('native-geogebra-edit',0);
    await drag(element,geometry);
    const responsePath=`/test/${testId}/unit/1/response`;
    await wait(()=>responseReceipts.some(row=>row.phase==='native-geogebra-edit'&&row.path===responsePath&&row.status===201),'actual GeoGebra response autosave');
    const edited=await snapshot(element),packet=writes.filter(row=>row.path===responsePath).at(-1);
    assert.ok(packet);assert.equal(packet.body.responseType,fixture.manifest.player.unitStateType);
    assert.ok(Object.keys(packet.body.dataParts).length);assert.ok(Object.values(packet.body.dataParts).every(value=>typeof value==='string'));
    const token=await page.evaluate(()=>localStorage.getItem('testcenter-native-monitor-session'));
    const reply=await context.request.get(base+`/test/${testId}/unit/NATIVE.GEOMETRY/alias/1`,{headers:{AuthToken:token,'X-Native-Unit-Protocol':'1'}});
    assert.equal(reply.status(),200);const saved=await reply.json();assert.deepEqual(saved.dataParts,packet.body.dataParts);
    assert.equal(emittedPoint(packet.body.dataParts),edited.pointCoordinates);
    mark('native-real-GeoGebra-pointer-edit-saves-exact-string-data-parts-through-production-API');
    await page.reload();const restored=await snapshot(await ready());
    assert.equal(restored.pointCoordinates,edited.pointCoordinates);assert.equal(restored.display,edited.display);assert.deepEqual(errors,[]);
    mark('native-real-GeoGebra-reloads-the-saved-construction-without-relaxing-opaque-isolation');
    await page.screenshot({path:join(out,'native-geogebra-restored.png')});
    await writeFile(join(out,'native-geogebra-recovered.json'),JSON.stringify({success:true,testId,isolation,resources,actualPointerEdit:true,initialPoint:geometry.pointCoordinates,editedPoint:edited.pointCoordinates,restoredPoint:restored.pointCoordinates,
      responseType:packet.body.responseType,deliveryId:packet.deliveryId,partHashes:Object.fromEntries(Object.entries(packet.body.dataParts).map(([key,value])=>[key,hash(value)])),errors,manifest:fixture.manifest,definitionSha256:fixture.definitionSha256},null,2));

    await configure('native-geogebra-large',0);
    await page.locator('[data-cy=unit-navigation-forward]').click();await page.waitForURL(new RegExp('/native-test/'+testId+'/u/2(?:\\?|$)'));
    const largeElement=await ready(),largeBefore=await snapshot(largeElement);
    await writeFile(join(out,'native-geogebra-large-before.json'),JSON.stringify({geometry:largeBefore,controls:await largeElement.evaluate(()=>[...document.querySelectorAll('[title],[aria-label],[role=button]')].map(node=>({tag:node.tagName,css:node.className,title:node.title,label:node.getAttribute('aria-label'),text:node.textContent?.slice(0,100)})))},null,2));
    assert.notEqual(largeBefore.pointCoordinates,edited.pointCoordinates,'The second Unit must load the official large construction');
    await drag(largeElement,largeBefore);
    const largePath=`/test/${testId}/unit/2/response`;
    await wait(()=>responseReceipts.some(row=>row.phase==='native-geogebra-large'&&row.path===largePath&&row.status===201),'large actual GeoGebra autosave');
    const largeEdited=await snapshot(largeElement),largePacket=writes.filter(row=>row.path===largePath).at(-1);
    assert.ok(largePacket);assert.equal(emittedPoint(largePacket.body.dataParts),largeEdited.pointCoordinates);
    const largeBytes=Buffer.byteLength(JSON.stringify(largePacket.body));assert.ok(largeBytes>1024*1024,'Actual GeoGebra data must exceed the ordinary one-MiB ingress budget');
    const unitUrl=base+`/test/${testId}/unit/NATIVE.GEOMETRY.LARGE/alias/2`;
    const readUnit=async()=>{const reply=await context.request.get(unitUrl,{headers:{AuthToken:token,'X-Native-Unit-Protocol':'1'}});assert.equal(reply.status(),200);return reply.json();};
    const largeSaved=await readUnit();assert.deepEqual(largeSaved.dataParts,largePacket.body.dataParts);
    await page.reload();const largeRestoredElement=await ready(),largeRestored=await snapshot(largeRestoredElement);
    assert.equal(largeRestored.pointCoordinates,largeEdited.pointCoordinates);
    mark('native-real-large-GeoGebra-image-construction-saves-and-reloads-beyond-the-ordinary-request-budget');

    await configure('native-geogebra-large-pending',0,'stars-offline',undefined,{testIds:[testId]});
    const gestureAt=Date.now(),pendingPoint=await drag(largeRestoredElement,largeRestored);
    const pending=await wait(async()=>{
      const documents=await page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('testcenter-native-unit-journal:v1:')).map(key=>({key,...JSON.parse(localStorage.getItem(key))})));
      for(const document of documents)for(const entry of document.entries){
        if(document.testId===testId&&entry.kind==='response'&&entry.unitAlias==='2'&&emittedPoint(JSON.parse(entry.payload).dataParts)===pendingPoint.pointCoordinates)return{key:document.key,actor:document.actor,entry};
      }
    },'the exact real large construction is captured in its production local journal');
    const pendingBytes=Buffer.byteLength(pending.entry.payload);assert.ok(pendingBytes>1024*1024);
    await wait(()=>page.evaluate(async({key,id,payload})=>{
      const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('testcenter-native-save-v1',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
      try{return await new Promise((resolve,reject)=>{const request=db.transaction('documents').objectStore('documents').getAll();request.onsuccess=()=>resolve(request.result.some(row=>row.bucket===key&&row.document.entries.some(entry=>entry.id===id&&entry.payload===payload)));request.onerror=()=>reject(request.error);});}finally{db.close();}
    },{key:pending.key,id:pending.entry.id,payload:pending.entry.payload}),'production IndexedDB mirror of the actual large draft');
    const captureElapsedMs=Date.now()-gestureAt;assert.ok(captureElapsedMs<5000,'Close the durable draft before the Source response window expires');
    mark('native-real-large-GeoGebra-draft-enters-production-IndexedDB-before-the-five-second-response-window');
    await configure('native-geogebra-large-closed',0,'stars-closure',undefined,{testIds:[testId],closureIds:[pending.entry.id]});
    const worker=context.serviceWorkers()[0];assert.ok(worker);
    page.on('dialog',dialog=>dialog.accept());const closed=page.waitForEvent('close');await page.close({runBeforeUnload:true});await closed;
    assert.equal(context.pages().length,0);
    const closedElapsedMs=Date.now()-gestureAt;assert.ok(closedElapsedMs<5000,'The actor page actually closes before the Source response window');
    await wait(()=>serverMessages.some(message=>message.nativeHeld==='native-geogebra-large-closed:'+testId),'actual worker reaches the held large response');
    // A staged draft may coalesce another real Player notification, including
    // beforeunload. The sealed revision is the immutable delivery contract.
    // Read it while the actual worker request is held, before any acknowledgement.
    const sealed=await worker.evaluate(async({key,id})=>{
      const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('testcenter-native-save-v1',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
      try{return await new Promise((resolve,reject)=>{const request=db.transaction('documents').objectStore('documents').get(key);request.onsuccess=()=>{const row=request.result;resolve(row?{sealed:row.sealed,revision:row.revision,entry:row.document.entries.find(entry=>entry.id===id)}:null);};request.onerror=()=>reject(request.error);});}finally{db.close();}
    },{key:pending.key,id:pending.entry.id});
    assert.equal(sealed?.sealed,true);assert.ok(sealed.entry);assert.equal(sealed.entry.id,pending.entry.id);
    assert.equal(emittedPoint(JSON.parse(sealed.entry.payload).dataParts),pendingPoint.pointCoordinates);
    await writeFile(join(out,'native-geogebra-large-sealed.json'),JSON.stringify({deliveryId:pending.entry.id,zeroActorPages:context.pages().length===0,closedElapsedMs,captureElapsedMs,
      draftPayloadSha256:hash(pending.entry.payload),sealedPayloadSha256:hash(sealed.entry.payload),revision:sealed.revision,stagedDraftCoalescedBeforeSeal:pending.entry.payload!==sealed.entry.payload},null,2));
    assert.equal(writes.filter(row=>row.deliveryId===pending.entry.id).length,0);
    if(workerRestart)await runNativeWorkerRestartSmoke({browser,context,worker,configure,release,testId,entry:sealed.entry,revision:sealed.revision,out,wait,serverMessages,responseReceipts,writes,mark});
    else {
      assert.equal(await release('native-geogebra-large-closed:'+testId),true);
      await wait(()=>writes.some(row=>row.deliveryId===pending.entry.id),'worker receives the real large response acknowledgement');
    }
    const delivered=writes.filter(row=>row.deliveryId===pending.entry.id);assert.equal(delivered.length,1);
    assert.equal(delivered[0].worker,true);assert.equal(delivered[0].zeroActorPagesAtReply,true);
    assert.ok(JSON.stringify(delivered[0].body)===sealed.entry.payload,'Actual worker must deliver the exact sealed journal bytes');
    assert.equal(delivered[0].actorHash,pending.actor);assert.equal(pending.actor,hash(token));
    const deliveredRead=await readUnit();
    await writeFile(join(out,'native-geogebra-large-worker-comparison.json'),JSON.stringify({largeBytes,pendingBytes,captureElapsedMs,deliveryId:pending.entry.id,actorHash:pending.actor,worker:delivered[0].worker,zeroActorPagesAtReply:delivered[0].zeroActorPagesAtReply,packetClock:delivered[0].body.timeStamp,nativeClocks:deliveredRead.nativeClocks,packetPoint:emittedPoint(delivered[0].body.dataParts),storedPoint:emittedPoint(deliveredRead.dataParts),parts:Object.fromEntries(Object.entries(delivered[0].body.dataParts).map(([key,value])=>[key,{packet:hash(value),stored:hash(deliveredRead.dataParts[key]||'')}]))},null,2));
    assert.deepEqual(deliveredRead.dataParts,{...largeSaved.dataParts,...delivered[0].body.dataParts});
    for(const key of Object.keys(largeSaved.dataParts))if(!(key in delivered[0].body.dataParts))assert.equal(deliveredRead.nativeClocks.partClocks[key],largeSaved.nativeClocks.partClocks[key]);
    const smallUnchanged=await context.request.get(base+`/test/${testId}/unit/NATIVE.GEOMETRY/alias/1`,{headers:{AuthToken:token,'X-Native-Unit-Protocol':'1'}});assert.equal(smallUnchanged.status(),200);assert.deepEqual((await smallUnchanged.json()).dataParts,saved.dataParts);
    const queue=await wait(async()=>{
      const value=await worker.evaluate(async()=>{
        const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('testcenter-native-save-v1',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
        try{const rows=await new Promise((resolve,reject)=>{const request=db.transaction('documents').objectStore('documents').getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});return{clients:clients.length,pending:rows.filter(row=>row.pending).length,entries:rows.reduce((sum,row)=>sum+row.document.entries.length,0)};}finally{db.close();}
      });return value.pending===0&&value.entries===0?value:false;
    },'large worker receipts complete without any actor page');assert.equal(queue.clients,0);
    mark('native-real-large-GeoGebra-worker-delivers-frozen-bytes-with-zero-actor-pages-and-no-manual-wake');
    page=await context.newPage();page.setDefaultTimeout(25_000);page.on('pageerror',error=>errors.push(String(error)));
    await page.goto(base+'/app/native-start?ui=original');await page.locator('[data-cy="booklet-NATIVE.GEOGEBRA"]').getByRole('button').click();
    await page.waitForURL(new RegExp('/native-test/'+testId+'/u/2(?:\\?|$)'));const afterWorker=await snapshot(await ready());
    assert.equal(afterWorker.pointCoordinates,pendingPoint.pointCoordinates);
    await wait(()=>page.evaluate(async()=>{
      const local=Object.keys(localStorage).filter(key=>key.startsWith('testcenter-native-unit-journal:v1:')).flatMap(key=>JSON.parse(localStorage.getItem(key)).entries);
      const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('testcenter-native-save-v1',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
      try{return await new Promise((resolve,reject)=>{const request=db.transaction('documents').objectStore('documents').getAll();request.onsuccess=()=>resolve(local.length===0&&request.result.every(row=>!row.pending&&row.document.entries.length===0));request.onerror=()=>reject(request.error);});}finally{db.close();}
    }),'reopened Source reconciles its local and IndexedDB journals');
    assert.equal(writes.filter(row=>row.deliveryId===pending.entry.id).length,1);assert.deepEqual(errors,[]);
    mark('native-Source-Starter-reconciles-the-real-large-GeoGebra-worker-receipt-and-restores-its-edited-point');
    await page.screenshot({path:join(out,'native-geogebra-large-worker-restored.png')});
    await writeFile(join(out,'native-geogebra-large-recovered.json'),JSON.stringify({success:true,testId,actualPointerEdit:true,largeBytes,pendingBytes,captureElapsedMs,
      editedPoint:largeEdited.pointCoordinates,reloadedPoint:largeRestored.pointCoordinates,pendingPoint:pendingPoint.pointCoordinates,restoredAfterWorker:afterWorker.pointCoordinates,
      deliveryId:pending.entry.id,actorHash:pending.actor,payloadSha256:hash(sealed.entry.payload),draftPayloadSha256:hash(pending.entry.payload),closedElapsedMs,stagedDraftCoalescedBeforeSeal:pending.entry.payload!==sealed.entry.payload,unchangedPartsAndClocksPreserved:true,foreignUnitUnchanged:true,reopenedQueuesEmpty:true,worker:true,zeroActorPagesAtReply:true,manualWorkerWake:false,queue,
      partHashes:Object.fromEntries(Object.entries(delivered[0].body.dataParts).map(([key,value])=>[key,hash(value)])),largeSource:fixture.manifest.largeGeometry,
      largeDefinitionSha256:fixture.largeDefinitionSha256,errors},null,2));
  } catch(error) {
    await page.screenshot({path:join(out,'native-geogebra-failure.png')}).catch(()=>{});
    await writeFile(join(out,'native-geogebra-failure.json'),JSON.stringify({error:String(error),testId,errors,resources,body:await page.locator('body').innerText().catch(()=>''),frames:page.frames().map(frame=>({url:frame.url()})),responses:responseReceipts.filter(row=>row.phase.startsWith('native-geogebra'))},null,2));throw error;
  } finally {await context.close();}
}
