import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {WebSocket} from 'ws';
import {FirstSliceError} from '@testcenter-rewrite-app/application';
import {NativeBroadcaster} from '../apps/api/dist/apps/api/src/native-broadcaster.js';

test('unchanged populated Original HTTP and WebSocket witness proves silent global cleanup while retaining the control workspace',async()=>{
 const root=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-populated-workspace-deletion-http/',import.meta.url),hash=b=>createHash('sha256').update(b).digest('hex');
 const bytes=await readFile(new URL('observations.json',root)),data=JSON.parse(bytes),manifestBytes=await readFile(new URL('manifest.json',root)),manifest=JSON.parse(manifestBytes),proof=JSON.parse(await readFile(new URL('independent-verification.json',root)));
 assert.equal(hash(bytes),proof.observationSha256);assert.equal(hash(manifestBytes),proof.manifestSha256);assert.equal(hash(await readFile(new URL('verify.mjs',root))),proof.verifierSha256);
 for(const[name,digest]of Object.entries(manifest.files))assert.equal(hash(await readFile(new URL(name,root))),digest,name);
 assert.equal(data.verified,true);assert.equal(data.sourceCommit,'eedae41840cbe90e5547c0211da818bdf620f5aa');assert.equal(data.actualHttpExchanges,97);assert.equal(data.rows.length,97);
 assert.equal(data.sqlSeedsOrDaoStubs,false);assert.equal(data.ownedHTTPWorkspacesOnly,true);assert.equal(data.baselineRestored,true);assert.deepEqual(data.runtimeBefore,data.runtimeAfter);
 assert.equal(data.runtimeBefore.sourceRuntime.sourceFiles,137);assert.equal(data.runtimeBefore.broadcaster.sourceFiles,38);assert.equal(Object.keys(data.runtimeBefore.broadcaster.sourceHashes).length,38);
 for(const row of data.rows)assert.equal(hash(row.rawText),row.redactedBodySha256,row.label);
 const s=data.snapshots;assert.deepEqual(s.controlBefore,s.controlAfter);assert.deepEqual(s.targetAfter.files,{exists:false,files:{}});
 for(const[name,count]of Object.entries(s.targetAfter.sql))assert.equal(count,name==='login_session_groups'?1:0,name);
 assert.equal(proof.rewriteMustRemoveOwnedGroupRows,true,'The unsafe Source orphan does not relax Rewrite aggregate cleanup.');
 assert.equal(s.peersAfter.length,4);
 for(const p of s.peersAfter){assert.equal(p.closed,true);assert.equal(p.closeCode,1005);assert.equal(p.closeReason,'');if(p.label.endsWith('-commands'))assert.ok(p.messages.some(m=>m.event==='commands'&&m.data.some(c=>c.keyword==='pause')));}
 assert.equal(s.cacheBefore['/clients'].length,4);assert.equal(s.cacheBefore['/testees'].length,2);assert.equal(s.cacheBefore['/monitors'].length,2);assert.ok(s.cacheBefore['/test-sessions'].length>=2);
 assert.deepEqual(s.cacheAfter,{'/clients':[],'/testees':[],'/monitors':[],'/test-sessions':[]});assert.equal(s.freshSubscriptionAccepted,true);
});
async function setup(t,pending=async()=>'[]'){
 const reports=[],services={originalSession:{read:async()=>({token:'owned-credential'})},originalCommand:{requireOwner:async()=>{},pending,connectionLost:async()=>{}},originalMonitor:{requireMonitor:async()=>{},sessions:pending}};
 const hub=new NativeBroadcaster(services,operation=>operation(),stage=>reports.push(stage)),server=createServer((_q,r)=>r.end());hub.attach(server);await new Promise(done=>server.listen(0,'127.0.0.1',done));const base='http://127.0.0.1:'+server.address().port,sockets=[];
 t.after(async()=>{hub.close();for(const ws of sockets)ws.terminate();await new Promise(done=>server.close(done));});
 const connect=token=>{const ws=new WebSocket(base.replace('http:','ws:')+'/ws?token='+token,{origin:base});ws.on('error',()=>{});sockets.push(ws);return ws;};
 const issue=(channel='commands')=>hub.issue(channel==='commands'?{channel,testNumber:'9007199254740993'}:{channel,groupKey:'OWNED'},'owned-credential');
 const reject=async token=>{const ws=connect(token);return new Promise((done,reject)=>{const timeout=setTimeout(()=>reject(Error('Owned rejection deadline')),5000);ws.once('unexpected-response',(_request,response)=>{clearTimeout(timeout);response.resume();ws.terminate();done(response.statusCode);});ws.once('open',()=>{clearTimeout(timeout);reject(Error('Expired ticket opened'));});});};
 return{hub,server,issue,connect,reject,reports,services};
}
test('unused native tickets expire instead of establishing an old private subscription',async t=>{
 const f=await setup(t),token=await f.issue(),nativeNow=Date.now;
 try{Date.now=()=>nativeNow()+31000;assert.equal(await f.reject(token),403);}finally{Date.now=nativeNow;}
});
test('repeated polls retain only a bounded set of unused tickets while the latest ticket can subscribe',async t=>{
 const f=await setup(t),tickets=[];for(let i=0;i<5;i++)tickets.push(await f.issue());assert.equal(await f.reject(tickets[0]),403);
 const ws=f.connect(tickets.at(-1));await once(ws,'open');const frame=once(ws,'message');ws.send('{"event":"subscribe:commands"}');assert.equal(String((await frame)[0]),'{"event":"commands","data":[]}');
});
test('a stalled authorized reader loses its socket at the real configured deadline and cannot send a late private frame',async t=>{
 let resolve,start;const started=new Promise(done=>start=done),held=new Promise(done=>resolve=done);const f=await setup(t,async()=>{start();return held;}),ws=f.connect(await f.issue()),frames=[];ws.on('message',data=>frames.push(String(data)));await once(ws,'open');
 t.mock.timers.enable({apis:['setTimeout']});ws.send('{"event":"subscribe:commands"}');await started;const closed=once(ws,'close');t.mock.timers.tick(20000);t.mock.timers.reset();await closed;assert.deepEqual(f.reports,['read']);resolve('[{"id":9007199254740993}]');await new Promise(done=>setImmediate(done));assert.deepEqual(frames,[]);
});

for(const channel of ['commands','test-sessions'])test(channel+': revocation while a private read is held cannot leak its late payload',async t=>{
 let resolve,start;const started=new Promise(done=>start=done),held=new Promise(done=>resolve=done);const f=await setup(t,async()=>{start();return held;}),ws=f.connect(await f.issue(channel)),frames=[];ws.on('message',data=>frames.push(String(data)));await once(ws,'open');ws.send(JSON.stringify({event:'subscribe:'+channel}));await started;
 f.services.originalSession.read=async()=>{throw new FirstSliceError(403,'owned_credential_retired','Owned actor retired during its read');};
 const closed=once(ws,'close');resolve('[{"private":"retired-actor-only","id":9007199254740993}]');await closed;
 assert.deepEqual(frames,[],'A successful earlier authorization cannot grant a late private delivery after revocation');
});

test('Source global clean silently closes both channels, invalidates pending tickets and keeps fresh subscriptions usable',{timeout:10000},async t=>{
 const f=await setup(t);let losses=0;f.services.originalCommand.connectionLost=async()=>{losses++;};
 const sockets=[];
 for(const channel of ['commands','test-sessions']){
  const ws=f.connect(await f.issue(channel));await once(ws,'open');const frame=once(ws,'message');ws.send(JSON.stringify({event:'subscribe:'+channel}));await frame;sockets.push(ws);
 }
 const unused=await f.issue(),closed=sockets.map(ws=>once(ws,'close'));
 f.hub.clean();f.hub.clean();
 for(const result of await Promise.all(closed)){assert.equal(result[0],1005);assert.equal(String(result[1]),'');}
 await new Promise(done=>setImmediate(done));assert.equal(losses,0);assert.deepEqual(f.reports,[]);
 assert.equal(await f.reject(unused),403);
 const fresh=f.connect(await f.issue());await once(fresh,'open');const frame=once(fresh,'message');fresh.send('{"event":"subscribe:commands"}');assert.equal(String((await frame)[0]),'{"event":"commands","data":[]}');
});

test('global clean invalidates a ticket whose authorization started before reset',{timeout:10000},async t=>{
 const f=await setup(t),entered=Promise.withResolvers(),release=Promise.withResolvers(),read=f.services.originalSession.read;
 f.services.originalSession.read=async()=>{entered.resolve();await release.promise;return read();};
 const pending=f.issue();await entered.promise;f.hub.clean();release.resolve();assert.equal(await pending,undefined);
 f.services.originalSession.read=read;assert.match(await f.issue(),/^[A-Za-z0-9_-]{43}$/);
});

test('global clean rejects a held upgrade instead of resurrecting a peer after reset',{timeout:10000},async t=>{
 const f=await setup(t),ticket=await f.issue(),entered=Promise.withResolvers(),release=Promise.withResolvers(),authorize=f.services.originalCommand.requireOwner;
 f.services.originalCommand.requireOwner=async()=>{entered.resolve();await release.promise;};
 const ws=f.connect(ticket),closed=new Promise(done=>ws.once('close',done));await entered.promise;f.hub.clean();await closed;
 release.resolve();await new Promise(done=>setImmediate(done));assert.equal(ws.readyState,WebSocket.CLOSED);
 f.services.originalCommand.requireOwner=authorize;const fresh=f.connect(await f.issue());await once(fresh,'open');
});

for(const channel of ['commands','test-sessions'])test(channel+': global clean suppresses an in-flight private frame and does not report connection loss',{timeout:10000},async t=>{
 const entered=Promise.withResolvers(),release=Promise.withResolvers();let losses=0;
 const f=await setup(t,async()=>{entered.resolve();return release.promise;});f.services.originalCommand.connectionLost=async()=>{losses++;};
 const ws=f.connect(await f.issue(channel)),frames=[];ws.on('message',b=>frames.push(String(b)));await once(ws,'open');
 ws.send(JSON.stringify({event:'subscribe:'+channel}));await entered.promise;const closed=once(ws,'close');f.hub.clean();await closed;
 release.resolve('[{"private":"held-before-global-clean","id":9007199254740993}]');await new Promise(done=>setImmediate(done));
 assert.deepEqual(frames,[]);assert.equal(losses,0);assert.deepEqual(f.reports,[]);
});

test('global clean cancels an earlier queued connection-lost cleanup before it can mutate a retained scope',{timeout:10000},async t=>{
 const f=await setup(t),entered=Promise.withResolvers(),release=Promise.withResolvers(),finished=Promise.withResolvers();let losses=0;
 f.services.originalCommand.connectionLost=async({stillDisconnected})=>{entered.resolve();await release.promise;if(stillDisconnected())losses++;finished.resolve();};
 const ws=f.connect(await f.issue());await once(ws,'open');ws.close();await entered.promise;f.hub.clean();release.resolve();await finished.promise;
 assert.equal(losses,0);
});
