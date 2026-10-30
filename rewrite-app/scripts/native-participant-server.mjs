import {createServer,request} from 'node:http';
import {createProductionApiServer} from '../apps/api/dist/apps/api/src/index.js';

// Only the real API consumes its IncomingMessage. The owned proxy records the
// actual bytes and can defer an older retry while a newer response is committed.
const backend=await createProductionApiServer();
await new Promise(resolve=>backend.listen(0,'127.0.0.1',resolve));
let remaining=0,phase='normal',target='response',firstBody;
const held=new Map();
const proxy=createServer((incoming,outgoing)=>{
 const path=new URL(incoming.url,'http://localhost').pathname;
 const responseWrite=incoming.method==='PUT'&&/^\/test\/[^/]+\/unit\/[^/]+\/response$/.test(path);
 const testRead=incoming.method==='GET'&&/^\/test\/[^/]+$/.test(path);
 const sessionRead=incoming.method==='GET'&&path==='/session';
 const commandAck=incoming.method==='PATCH'&&/^\/test\/[^/]+\/command\/[^/]+\/executed$/.test(path);
 const resourceRead=incoming.method==='GET'&&/^\/file\//.test(path);
 const record={phase,time:Date.now(),method:incoming.method,path:resourceRead?path.replace(/^(\/file\/)[^/]+/,'$1[resource-capability]'):path,hasNativeToken:!!incoming.headers.authtoken};
 if(resourceRead)outgoing.once('finish',()=>process.send?.({nativeResource:{...record,origin:incoming.headers.origin,status:outgoing.statusCode}}));
 if(responseWrite||testRead)outgoing.once('finish',()=>process.send?.({nativeResponse:{...record,status:outgoing.statusCode}}));
 if(sessionRead)outgoing.once('finish',()=>process.send?.({nativeSession:{...record,status:outgoing.statusCode}}));
 if(commandAck)outgoing.once('finish',()=>process.send?.({nativeCommand:{...record,status:outgoing.statusCode}}));
 const forward=body=>{
  if(outgoing.destroyed||incoming.aborted)return;
  const port=backend.address().port,headers={...incoming.headers,host:'127.0.0.1:'+port,connection:'close'};
  if(body!==undefined){delete headers['transfer-encoding'];headers['content-length']=body.length;}
  const forwarded=request({hostname:'127.0.0.1',port,path:incoming.url,method:incoming.method,headers},response=>{
   outgoing.writeHead(response.statusCode,response.headers);response.pipe(outgoing);
  });
  forwarded.on('error',()=>{if(!outgoing.headersSent)outgoing.writeHead(502);outgoing.end('Owned API proxy failed');});
  incoming.once('aborted',()=>forwarded.destroy());outgoing.once('close',()=>forwarded.destroy());
  if(body===undefined)incoming.pipe(forwarded);else forwarded.end(body);
 };
 const fail=()=>outgoing.writeHead(503,{'Content-Type':'text/plain','error-id':'OWNED-RESPONSE-FAILURE','test-mode':'integration'}).end('Owned temporary response failure');
 if(responseWrite||commandAck){
  const chunks=[];let bytes=0;
  incoming.on('data',chunk=>{bytes+=chunk.length;if(bytes>1024*1024){outgoing.writeHead(413).end();incoming.destroy();}else chunks.push(chunk);});
  incoming.once('end',()=>{
   const body=Buffer.concat(chunks);record.body=body.toString('utf8');
   if(commandAck&&target==='command-ack'){
    if(remaining>0){remaining--;fail();return;}
    const value={outgoing,forward:()=>forward(body)};held.set(record.phase,value);
    outgoing.once('close',()=>{if(held.get(record.phase)===value){held.delete(record.phase);process.send?.({nativeHeldCancelled:record.phase});}});
    process.send?.({nativeHeld:record.phase});return;
   }
   if(responseWrite&&target==='overlap'){
    firstBody??=record.body;
    if(record.body===firstBody){
     if(remaining>0){remaining--;fail();return;}
     const value={outgoing,forward:()=>forward(body)};held.set(record.phase,value);
     outgoing.once('close',()=>{if(held.get(record.phase)===value){held.delete(record.phase);process.send?.({nativeHeldCancelled:record.phase});}});
     process.send?.({nativeHeld:record.phase});return;
    }
   }else if(responseWrite&&target==='response'&&remaining>0){remaining--;fail();return;}
   forward(body);
  });return;
 }
 if(testRead&&target==='test-read'&&remaining>0){remaining--;incoming.once('end',fail);incoming.resume();return;}
 if(sessionRead&&target==='session-read'&&remaining>0){remaining--;incoming.once('end',fail);incoming.resume();return;}
 forward();
});
process.on('message',message=>{
 if(message?.nativeFault){phase=message.nativeFault.phase;remaining=message.nativeFault.failures;target=message.nativeFault.target??'response';firstBody=undefined;process.send?.({faultReady:phase});}
 if(message?.nativeRelease){const value=held.get(message.nativeRelease);held.delete(message.nativeRelease);value?.forward();process.send?.({nativeReleased:message.nativeRelease,released:!!value});}
});
proxy.listen(0,'127.0.0.1',()=>process.send?.({port:proxy.address().port}));
process.once('SIGTERM',()=>proxy.close(()=>backend.close(()=>process.exit(0))));
