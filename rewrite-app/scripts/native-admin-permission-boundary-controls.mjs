import assert from 'node:assert/strict';
import {createServer,request} from 'node:http';
import {createFirstSliceServices} from '@testcenter-rewrite-app/application';
import {handleOriginalAdminHttp} from '../apps/api/dist/apps/api/src/original-admin-http.js';

/** The real native HTTP handler, service and store execute throughout. Only
 * request-body completion or entry into the durable writer is scheduled. */
export async function verifyNativePermissionBoundaries(t,f){
 const rootUser=structuredClone(await f.repository.getAdminUserByUsername('super'));
 const rootRole=structuredClone((await f.repository.listAdminRoleAssignmentsByUserId(rootUser.adminUserId)).find(r=>r.role==='platform_admin'));
 const rootSession=structuredClone(await f.repository.getAdminSessionByToken(f.root.token));
 const initialClock=f.clock.value;
 const backup=await f.services.originalAdminSession.login({name:f.b.username,password:f.password});
 const restore=async()=>{
  f.clock.value=initialClock;
  await f.repository.saveAdminUser(structuredClone(rootUser));await f.repository.saveAdminRoleAssignment(structuredClone(rootRole));await f.repository.saveAdminSession(structuredClone(rootSession));
  // Each expiry scenario needs a fresh service clock: the production service
  // intentionally keeps timestamps monotonic even if its injected clock falls.
  await f.reopen();
 };
 const cases=[
  ['logout',async token=>f.services.adminAuth.signOut({sessionToken:token})],
  ['canonical Root revocation',async()=>f.services.adminDirectory.revokeAdminRole({sessionToken:backup.token,adminUserId:rootUser.adminUserId,roleAssignmentId:rootRole.roleAssignmentId,confirmationPassword:f.password})],
  ['disabled account',async()=>f.repository.saveAdminUser({...rootUser,status:'disabled'})],
  ['expired account window',async()=>f.repository.saveAdminUser({...rootUser,validTo:new Date(initialClock-1).toISOString()})],
  ['future account window',async()=>f.repository.saveAdminUser({...rootUser,validFrom:new Date(initialClock+60000).toISOString()})],
  ['expired session',async token=>{const session=await f.repository.getAdminSessionByToken(token);await f.repository.saveAdminSession({...session,expiresAt:new Date(initialClock-1).toISOString()});}],
  ['clock crossing session expiry',async token=>{const session=await f.repository.getAdminSessionByToken(token);f.clock.value=Date.parse(session.expiresAt)+1;}]
 ];
 for(const boundary of ['body','durable-writer'])for(const endpoint of ['workspace','user'])for(const[label,invalidate]of cases){
  await t.test(`native ${endpoint} permission PATCH rejects ${label} after ${boundary} wait`,{timeout:20000},async()=>{
   await restore();await f.setUsers({u:[{id:2,role:'RO'}]});
   const token=(await f.services.originalAdminSession.login({name:rootUser.username,password:f.password})).token;
   const entered=Promise.withResolvers(),release=Promise.withResolvers();let failure;
   const delayed=new Proxy(f.repository,{get(target,key){
    if(boundary==='durable-writer'&&key==='mutateOriginalAdminSession')return async(selector,...args)=>{
     if(selector.rightsWrite){entered.resolve();await release.promise;}
     return target[key](selector,...args);
    };
    const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;
   }});
   const services=boundary==='durable-writer'?createFirstSliceServices({repository:delayed,now:f.now}):f.services;
   const server=createServer((req,res)=>void handleOriginalAdminHttp({request:req,pathname:new URL(req.url,'http://owned.invalid').pathname,services,
    readBody:async decode=>{if(boundary==='body')entered.resolve();const chunks=[];for await(const chunk of req)chunks.push(chunk);return decode(Buffer.concat(chunks));},
    header:(name,value)=>res.setHeader(name,value),raw:(status,text,type)=>{res.writeHead(status,{'Content-Type':type});res.end(text);},
    propagateError:()=>false,reportError:()=>{}
   }).catch(error=>{failure=error;res.writeHead(500);res.end();}));
   await new Promise(done=>server.listen(0,'127.0.0.1',done));let req;
   try{
    const path=endpoint==='workspace'?'/workspace/1/users':'/user/2/workspaces';
    const payload=JSON.stringify(endpoint==='workspace'?{u:[{id:2,role:'RW'}]}:{ws:[{id:1,role:'RW'}]});
    const response=Promise.withResolvers();
    req=request({hostname:'127.0.0.1',port:server.address().port,path,method:'PATCH',headers:{AuthToken:token,'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload)},signal:AbortSignal.timeout(15000)},res=>{
     const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>response.resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString()}));
    });req.on('error',response.reject);
    if(boundary==='body')req.write(payload.slice(0,1));else req.end(payload);
    await Promise.race([entered.promise,response.promise.then(r=>{throw Error('Permission request missed held boundary: '+r.status);})]);
    await invalidate(token);
    const roles=await f.allRoles(),audits=await f.repository.listAdminAuditEvents();
    release.resolve();if(boundary==='body')req.end(payload.slice(1));
    const actual=await response.promise;assert.ifError(failure);assert.equal(actual.status,403);
    assert.equal(actual.headers['cache-control'],'private, no-store');assert.equal(actual.headers['test-mode'],'NO');assert.ok(actual.headers['error-id']);assert.equal(actual.body.includes(token),false);
    assert.deepEqual(await f.allRoles(),roles);assert.deepEqual(await f.repository.listAdminAuditEvents(),audits);
   }finally{release.resolve();req?.destroy();server.closeAllConnections();await new Promise(done=>server.close(done));await restore();}
  });
 }
}
