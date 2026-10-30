import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {NativeBroadcaster} from '../apps/api/dist/apps/api/src/native-broadcaster.js';
async function setup(t,pending=async()=>'[]'){
 const reports=[],services={originalSession:{read:async()=>({token:'owned-credential'})},originalCommand:{requireOwner:async()=>{},pending,connectionLost:async()=>{}},originalMonitor:{requireMonitor:async()=>{},sessions:async()=>'[]'}};
 const hub=new NativeBroadcaster(services,operation=>operation(),stage=>reports.push(stage)),server=createServer((_q,r)=>r.end());hub.attach(server);await new Promise(done=>server.listen(0,'127.0.0.1',done));const base='http://127.0.0.1:'+server.address().port,sockets=[];
 t.after(async()=>{hub.close();for(const ws of sockets)ws.terminate();await new Promise(done=>server.close(done));});
 const connect=token=>{const ws=new WebSocket(base.replace('http:','ws:')+'/ws?token='+token,{origin:base});ws.on('error',()=>{});sockets.push(ws);return ws;};
 const issue=()=>hub.issue({channel:'commands',testNumber:'9007199254740993'},'owned-credential');
 const reject=async token=>{const ws=connect(token);return new Promise((done,reject)=>{const timeout=setTimeout(()=>reject(Error('Owned rejection deadline')),5000);ws.once('unexpected-response',(_request,response)=>{clearTimeout(timeout);response.resume();ws.terminate();done(response.statusCode);});ws.once('open',()=>{clearTimeout(timeout);reject(Error('Expired ticket opened'));});});};
 return{hub,server,issue,connect,reject,reports};
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
