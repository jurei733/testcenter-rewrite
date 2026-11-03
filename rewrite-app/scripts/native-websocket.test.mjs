import {DatabaseSync} from 'node:sqlite';
import {createNativeWebsocketFixture} from './native-websocket-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {WebSocket} from 'ws';
import {createProductionApiServer} from '../apps/api/dist/apps/api/src/index.js';
const wait=async predicate=>{const end=Date.now()+10000;while(Date.now()<end){const value=predicate();if(value)return value;await new Promise(done=>setTimeout(done,10));}throw Error('Native WebSocket observation deadline');};

test('real native HTTP-issued WebSocket capabilities preserve ownership, int64 packets, revocation and shutdown',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'owned-native-websocket-')),file=join(dir,'owned.sqlite'),sockets=[];
 let server;const originalEnv={...process.env};
 try{
  const {owner,peer,monitor,foreign,id}=await createNativeWebsocketFixture(file);
  Object.assign(process.env,{FIRST_SLICE_STORE:'sqlite',FIRST_SLICE_SQLITE_FILE:file,FIRST_SLICE_BOOTSTRAP_DEMO:'false',FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',FIRST_SLICE_XML_SCHEMA_PROFILE:'original-19',FIRST_SLICE_NATIVE_WEBSOCKET_ENABLED:'true'});
  server=await createProductionApiServer();await new Promise(done=>server.listen(0,'127.0.0.1',done));const base='http://127.0.0.1:'+server.address().port;
  const request=async(method,path,token,body)=>{const response=await fetch(base+path,{method,headers:{...(token?{AuthToken:token}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});return{response,text:await response.text()};};
  const ticket=async(path,token)=>{const {response}=await request('GET',path,token);assert.equal(response.status,200);const value=response.headers.get('SubscribeToken');assert.match(value,/^[A-Za-z0-9_-]{43}$/);assert.notEqual(value,token);return value;};
  const connect=async(value,channel,origin=base)=>{
   const ws=new WebSocket(base.replace('http:','ws:')+'/ws?token='+value,{origin});sockets.push(ws);const frames=[];ws.on('message',data=>frames.push(data.toString()));ws.on('error',()=>{});
   await new Promise((done,reject)=>{const timeout=setTimeout(()=>reject(Error('Owned WS connection deadline')),10000);ws.once('open',()=>{clearTimeout(timeout);done();});ws.once('error',error=>{clearTimeout(timeout);reject(error);});});
   ws.send(JSON.stringify({event:'subscribe:'+channel}));return{ws,frames};
  };
  const denied=async(value,origin=base)=>{
   const ws=new WebSocket(base.replace('http:','ws:')+'/ws?token='+value,{...(origin?{origin}:{})});sockets.push(ws);ws.on('error',()=>{});
   return new Promise((done,reject)=>{const timeout=setTimeout(()=>{ws.terminate();reject(Error('Owned rejection deadline'));},10000);ws.once('unexpected-response',(_req,res)=>{clearTimeout(timeout);res.resume();ws.terminate();done(res.statusCode);});ws.once('open',()=>{clearTimeout(timeout);ws.terminate();reject(Error('Unauthorized native socket opened'));});});
  };
  let commands,changes;
  await t.test('poll issues a distinct one-use capability and real native command frames retain the literal int64 ID',async()=>{
   const capability=await ticket('/test/'+id+'/commands',owner.token);commands=await connect(capability,'commands');await wait(()=>commands.frames.some(w=>w==='{"event":"commands","data":[]}'));
   assert.equal(await denied(capability),403);
   const sent=await request('PUT','/monitor/command',monitor.token,'{"keyword":"pause","arguments":[],"timestamp":1793390000,"testIds":['+id+']}');assert.equal(sent.response.status,201);
   const frame=await wait(()=>commands.frames.find(w=>w.includes('"id":9007199254741993')));assert.match(frame,/"keyword":"pause"/);assert.equal(frame.includes('9007199254741992'),false);
  });
  await t.test('foreign people, groups and wrong token kinds cannot receive a subscription header',async()=>{
   for(const [path,credential]of [['/test/'+id+'/commands',peer.token],['/monitor/group/OWNED.WS/test-sessions',foreign.token],['/monitor/group/OWNED.WS/test-sessions',owner.token]]){
    const value=await request('GET',path,credential);assert.equal(value.response.status,403);assert.equal(value.response.headers.get('SubscribeToken'),null);
   }
  });
  await t.test('an issued ticket cannot be used from a foreign origin or without an Origin',async()=>{
   const capability=await ticket('/test/'+id+'/commands',owner.token);assert.equal(await denied(capability,'http://foreign.invalid'),403);assert.equal(await denied(capability,null),403);
   const owned=await connect(capability,'commands');await wait(()=>owned.frames.length);owned.ws.close();
  });
  await t.test('monitor channel delivers real native snapshots and fresh committed state',async()=>{
   changes=await connect(await ticket('/monitor/group/OWNED.WS/test-sessions',monitor.token),'test-sessions');await wait(()=>changes.frames.some(w=>w.includes('"testId":'+id)));
   const update=await request('PATCH','/test/'+id+'/state',owner.token,[{key:'CURRENT_UNIT_ID',content:'OWNED.WS.UNIT',timeStamp:Date.now()}]);assert.equal(update.response.status,200);
   await wait(()=>changes.frames.some(w=>w.includes('CURRENT_UNIT_ID')&&w.includes('OWNED.WS.UNIT')));
  });
  await t.test('ACK removes only the real pending command, without WebSocket reads writing POLLING state',async()=>{
   const ack=await request('PATCH','/test/'+id+'/command/9007199254741993/executed',owner.token,{});assert.equal(ack.response.status,200);
   await wait(()=>commands.frames.at(-1)==='{"event":"commands","data":[]}');
   const {response,text}=await request('GET','/test/'+id,owner.token);assert.equal(response.status,200);assert.equal(text.includes('POLLING'),false);
  });
  await t.test('wrong channels close without a data frame',async()=>{
   const wrong=await connect(await ticket('/test/'+id+'/commands',owner.token),'test-sessions');await wait(()=>wrong.ws.readyState===WebSocket.CLOSED);assert.deepEqual(wrong.frames,[]);
  });
  await t.test('one closed tab preserves the other connection; the final close appends only the Source zero-clock LOST notification',async()=>{
   const countLosses=()=>{const db=new DatabaseSync(file);try{return Number(db.prepare("SELECT count(*) AS count FROM participant_test_logs WHERE log_key=? AND log_content=?").get('"CONNECTION"','LOST').count);}finally{db.close();}};
   const second=await connect(await ticket('/test/'+id+'/commands',owner.token),'commands');await wait(()=>second.frames.length);
   const before=countLosses();second.ws.close();await wait(()=>second.ws.readyState===WebSocket.CLOSED);await new Promise(done=>setTimeout(done,30));assert.equal(countLosses(),before);
   const state=await request('PATCH','/test/'+id+'/state',owner.token,[{key:'CONNECTION',content:'WEBSOCKET',timeStamp:Date.now()}]);assert.equal(state.response.status,200);
   commands.ws.close();await wait(()=>commands.ws.readyState===WebSocket.CLOSED);await wait(()=>countLosses()===before+1);
   const current=await request('GET','/test/'+id,owner.token);assert.equal(JSON.parse(current.text).laststate.CONNECTION,'WEBSOCKET');
   commands=await connect(await ticket('/test/'+id+'/commands',owner.token),'commands');await wait(()=>commands.frames.length);
  });
  await t.test('revoking the actor closes its already connected command socket',async()=>{
   const count=commands.frames.length;const revoke=await request('DELETE','/session',owner.token);assert.equal(revoke.response.status,205);await wait(()=>commands.ws.readyState===WebSocket.CLOSED);assert.equal(commands.frames.length,count);
   assert.equal(await denied(await ticket('/monitor/group/OWNED.WS/test-sessions',monitor.token),'http://foreign.invalid'),403);
  });
  await t.test('server shutdown terminates live sockets before closing its real SQLite repository',async()=>{
   const closing=await connect(await ticket('/monitor/group/OWNED.WS/test-sessions',monitor.token),'test-sessions');await wait(()=>closing.frames.length);closing.ws.pause();closing.ws.send(JSON.stringify({event:'unsubscribe:test-sessions'}));await new Promise(done=>setTimeout(done,30));
   await new Promise((done,reject)=>{const timeout=setTimeout(()=>reject(Error('Owned shutdown deadline')),10000);server.close(error=>{clearTimeout(timeout);if(error)reject(error);else done();});});server=undefined;
   closing.ws.resume();await wait(()=>changes.ws.readyState===WebSocket.CLOSED&&closing.ws.readyState===WebSocket.CLOSED);
  });
 }finally{
  for(const ws of sockets)ws.terminate();if(server)await new Promise(done=>server.close(done));
  for(const key of Object.keys(process.env))if(!(key in originalEnv))delete process.env[key];Object.assign(process.env,originalEnv);await rm(dir,{recursive:true,force:true});
 }
});
