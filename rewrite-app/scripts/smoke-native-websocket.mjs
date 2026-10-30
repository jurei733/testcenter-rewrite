import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,readdir,mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {createNativeWebsocketFixture} from './native-websocket-fixture.mjs';
import {stopNativeSmokeServer} from './native-monitor-smoke-io.mjs';
import {runSupervisedSmoke,isSupervisedSmokeChild,reportSmokePhase} from './supervised-smoke.mjs';
export async function runNativeWebsocketSmoke(out){
 await mkdir(out,{recursive:true});const app=fileURLToPath(new URL('..',import.meta.url)),file=join(await mkdtemp(join(tmpdir(),'owned-native-ws-store-')),'owned.sqlite');
 const paths=async root=>{let files=[];for(const entry of await readdir(join(app,root),{withFileTypes:true})){const next=root+'/'+entry.name;files.push(...(entry.isDirectory()?await paths(next):[next]));}return files;};
 const sources=[...await paths('apps/web/src'),'scripts/smoke-native-websocket.mjs','scripts/native-websocket-server.mjs','scripts/native-websocket-fixture.mjs','apps/api/src/native-broadcaster.ts','apps/api/src/index.ts','apps/api/dist/apps/api/src/native-broadcaster.js','apps/api/dist/apps/api/src/index.js','package-lock.json'];
 const hashSources=async()=>Object.fromEntries(await Promise.all(sources.map(async p=>[p,createHash('sha256').update(await readFile(join(app,p))).digest('hex')]))),sourceHashes=await hashSources();
 const checks=[],errors=[],wire=[],frames=[],events=[];let server,browser,page,monitor;
 const mark=name=>{checks.push(name);console.log('native_websocket_ui='+name+':passed');reportSmokePhase(name);};
 try{
  reportSmokePhase('prepare-owned-native-ws-fixture');const fixture=await createNativeWebsocketFixture(file);
  server=spawn(process.execPath,[join(app,'scripts/native-websocket-server.mjs')],{cwd:app,stdio:['ignore','ignore','inherit','ipc'],env:{...process.env,FIRST_SLICE_STORE:'sqlite',FIRST_SLICE_SQLITE_FILE:file,FIRST_SLICE_BOOTSTRAP_DEMO:'false',FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',FIRST_SLICE_XML_SCHEMA_PROFILE:'original-19',FIRST_SLICE_NATIVE_WEBSOCKET_ENABLED:'true',FIRST_SLICE_PROOF_OF_WORK_SCOPES:'',REQUIRE_LOGIN_PASSWORD:'false'}});
  server.on('message',m=>events.push(m));const port=await new Promise((done,reject)=>{const timer=setTimeout(()=>reject(Error('Owned WS startup deadline')),20000);server.once('message',m=>{clearTimeout(timer);done(m.port);});server.once('exit',()=>{clearTimeout(timer);reject(Error('Owned WS server exited'));});});const base='http://127.0.0.1:'+port;
  const control=(phase,blocked,drop=false)=>new Promise((done,reject)=>{const timer=setTimeout(()=>{server.removeListener('message',receive);reject(Error('Owned WS control deadline'));},20000),receive=m=>{if(m.nativeWsControlReady===phase){clearTimeout(timer);server.removeListener('message',receive);done(m);}};server.on('message',receive);server.send({nativeWsControl:{phase,blocked,drop}});});
  browser=await chromium.launch({headless:process.env.CI==='true'&&!['true','1'].includes(String(process.env.UI_SMOKE_HEADFUL)),...(process.env.UI_SMOKE_BROWSER_CHANNEL?{channel:process.env.UI_SMOKE_BROWSER_CHANNEL}:{})});
  const open=async(role,token,purpose,path)=>{
   const p=await browser.newPage({viewport:{width:1280,height:850}});p.setDefaultTimeout(20000);
   await p.addInitScript(({token,purpose})=>{if(window!==top)return;localStorage.setItem('testcenter-native-monitor-session',token);localStorage.setItem('testcenter-native-monitor-session-purpose',purpose);},{token,purpose});
   p.on('pageerror',error=>errors.push({role,error:String(error)}));p.on('request',r=>{const path=new URL(r.url()).pathname;if(/^\/test\/[^/]+\/commands$/.test(path)||/test-sessions$/.test(path))wire.push({role,path,method:r.method()});});
   p.on('websocket',ws=>{assert.equal(new URL(ws.url()).pathname,'/ws');assert.equal(ws.url().includes(token),false);ws.on('framesent',event=>frames.push({role,direction:'sent',wire:String(event.payload)}));ws.on('framereceived',event=>frames.push({role,direction:'received',wire:String(event.payload)}));});
   await p.goto(base+path);return p;
  };
  page=await open('participant',fixture.owner.token,'participant','/app/native-start?ui=original');const card=page.locator('[data-cy="booklet-OWNED.WS.BOOK"]');await card.waitFor();await card.getByRole('button',{name:'Starten',exact:true}).click();await page.waitForURL(new RegExp('/native-test/'+fixture.id+'(?:/|$)'));
  const input=page.frameLocator('iframe').getByRole('textbox',{name:'Owned WS answer',exact:true});await input.waitFor();await page.frameLocator('iframe').locator('body[data-started=true]').waitFor();
  monitor=await open('monitor',fixture.monitor.token,'monitor','/app/group-monitor/OWNED.WS/full?ui=original');const row=monitor.locator('tc-test-session[data-test-id="'+fixture.id+'"]');await row.waitFor();
  const until=async predicate=>{const end=Date.now()+20000;while(Date.now()<end){if(predicate())return;await new Promise(done=>setTimeout(done,10));}throw Error('Owned WS frame deadline');};
  await until(()=>['participant','monitor'].every(role=>frames.some(f=>f.role===role&&f.direction==='sent'&&f.wire.includes('subscribe:'))&&frames.some(f=>f.role===role&&f.direction==='received')));mark('actual-native-participant-and-monitor-negotiate-separate-source-websocket-channels');
  const saved=page.waitForResponse(r=>new URL(r.url()).pathname==='/test/'+fixture.id+'/unit/OWNED.WS.UNIT/response'&&r.request().method()==='PUT'&&r.status()===201);void saved.catch(()=>{});await input.fill('Owned durable WS Ω');await saved;
  const polls=wire.length;await new Promise(done=>setTimeout(done,5500));assert.equal(wire.length,polls);assert.equal(await input.inputValue(),'Owned durable WS Ω');mark('healthy-native-websockets-carry-state-without-repeated-browser-http-polls');
  const all=monitor.locator('[data-cy=GM_control_all_tests]').getByRole('switch');await all.waitFor();if(await all.getAttribute('aria-checked')==='true')await all.click();
  await row.getByRole('checkbox').check();
  const pause=page.waitForResponse(r=>/\/command\/9007199254741993\/executed$/.test(new URL(r.url()).pathname)&&r.status()===200);void pause.catch(()=>{});await monitor.locator('[data-cy=GM_pause_button]').click();await pause;await input.waitFor({state:'hidden'});await monitor.waitForFunction(id=>document.querySelector('tc-test-session[data-test-id="'+id+'"]')?.classList.contains('paused'),fixture.id);assert.ok(frames.some(f=>f.role==='participant'&&f.direction==='received'&&f.wire.includes('"id":9007199254741993')));mark('real-monitor-pause-delivers-int64-command-over-websocket-and-applies-only-after-native-ack');
  const resume=page.waitForResponse(r=>/\/command\/9007199254741994\/executed$/.test(new URL(r.url()).pathname)&&r.status()===200);void resume.catch(()=>{});await monitor.locator('[data-cy=GM_forward_button]').click();await resume;await input.waitFor();assert.equal(await input.inputValue(),'Owned durable WS Ω');mark('real-websocket-resume-restores-the-durable-answer-in-a-fresh-opaque-player');
  await page.evaluate(()=>{window.__wsOwnedFrame=document.querySelector('iframe');});const before=wire.length;const dropped=await control('blocked',true,true);assert.ok(dropped.dropped>=2);
  await until(()=>wire.length>before&&events.some(e=>e.nativeWsPoll?.phase==='blocked'));assert.equal(await page.evaluate(()=>document.querySelector('iframe')===window.__wsOwnedFrame&&window.__wsOwnedFrame.isConnected),true);assert.equal(await input.inputValue(),'Owned durable WS Ω');mark('real-socket-outage-falls-back-to-authenticated-http-with-the-same-live-player');
  const receivedBefore=frames.filter(f=>f.direction==='received').length;await control('recovered',false);await until(()=>frames.filter(f=>f.direction==='received').length>=receivedBefore+2);assert.equal(await input.inputValue(),'Owned durable WS Ω');mark('authenticated-polls-negotiate-fresh-websocket-leases-after-the-outage');
  const revoked=await fetch(base+'/session',{method:'DELETE',headers:{AuthToken:fixture.owner.token},signal:AbortSignal.timeout(20000)});assert.equal(revoked.status,205);await page.getByRole('button',{name:'Anmelden',exact:true}).waitFor();assert.equal(await page.locator('iframe').count(),0);assert.equal(await page.evaluate(()=>window.__wsOwnedFrame.isConnected),false);mark('actual-actor-revocation-retires-the-socket-and-private-player');
  assert.deepEqual(errors,[]);assert.deepEqual(await hashSources(),sourceHashes);await writeFile(join(out,'result.json'),JSON.stringify({success:true,browser:browser.version(),checks,errors,wire,frames,events,sourceHashes,scope:'Owned real SQLite/native API, copied Source UI, actual browser WebSockets, real outage and revocation; not whole Original parity'},null,2));
 }catch(error){if(monitor){await monitor.screenshot({path:join(out,'monitor-failure.png')}).catch(()=>{});await writeFile(join(out,'monitor-failure.html'),await monitor.content().catch(()=>''));}await page?.screenshot({path:join(out,'failure.png')}).catch(()=>{});await writeFile(join(out,'failure.json'),JSON.stringify({error:String(error),checks,errors,wire,frames,events},null,2));throw error;}
 finally{await browser?.close();if(server)await stopNativeSmokeServer(server);}
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const out=process.env.UI_SMOKE_ARTIFACT_DIR?resolve(process.env.UI_SMOKE_ARTIFACT_DIR):await mkdtemp(join(tmpdir(),'owned-native-ws-ui-'));
 if(!isSupervisedSmokeChild(import.meta.url))process.exitCode=await runSupervisedSmoke({entry:fileURLToPath(import.meta.url),artifactDirectory:join(out,'supervision'),env:{...process.env,UI_SMOKE_ARTIFACT_DIR:out},phaseTimeoutMs:60000,totalTimeoutMs:480000});
 else await runNativeWebsocketSmoke(out);
}
