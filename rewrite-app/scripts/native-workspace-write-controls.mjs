import {verifyNativeWorkspaceWritePostgres} from './native-workspace-write-postgres-controls.mjs';
import {verifyNativeWorkspaceFileMutation} from './native-workspace-file-mutation-controls.mjs';
import assert from 'node:assert/strict';
import {createServer,request} from 'node:http';
import {createFirstSliceServices} from '@testcenter-rewrite-app/application';
import {handleOriginalWorkspaceHttp} from '../apps/api/dist/apps/api/src/original-workspace-http.js';

/** Real native HTTP handler, services and durable stores. Only the body/writer
 * scheduling is held; no permission result or deletion effect is mocked. */
export async function verifyNativeWorkspaceWrite(t,{repository,services,scope,ids,auth,loginName,role,workspaceNumber,connectionString,openConcurrentStorage}){
 const user=await repository.getAdminUserById(role.adminUserId),tenant=await repository.getTenantByKey(scope.tenantKey),workspace=await repository.getWorkspaceByScope(scope.tenantKey,scope.workspaceKey);
 const groupKey='OWNED.REVOCATION.GROUP',person=await auth(loginName),testNumber=await services.originalTest.create({token:person.token,bookletName:'OWNED.ADM.B'});
 const originalRun=await repository.findOriginalTestNumber({...ids,participantSessionId:person.participantSession.participantSessionId,testNumber});
 assert.ok(originalRun);
 await repository.getOrCreateOriginalParticipantGroup({...ids,groupKey,groupLabel:'Owned revocation control',createdAt:new Date().toISOString()});
 const fileName='owned-delete-control.txt';
 const newFileName='owned-upload-control.txt';
 const {sourcePackage}=await services.contentIntake.uploadWorkspaceFile({...scope,fileName,mediaType:'text/plain',sourceDocument:'Owned deletion control'});
 const filePath='Resource/'+fileName;
 const restore=async()=>{await repository.saveAdminUser(user);await repository.saveAdminRoleAssignment(role);await repository.saveTenant(tenant);await repository.saveWorkspace({...scope,workspace});};
 const preserved=async()=>{
  assert.ok(await repository.getTestRunById(originalRun.testRunId),'An unauthorized request must retain its actual selected Test.');
  assert.ok((await repository.listOriginalParticipantGroupsByWorkspace(ids.tenantId,ids.workspaceId)).some(g=>g.groupKey===groupKey),'An unauthorized request must retain its actual selected group.');
  assert.deepEqual(await repository.getSourcePackageById(sourcePackage.sourcePackageId),sourcePackage);
  const files=await repository.listSourcePackagesByWorkspace(ids.tenantId,ids.workspaceId);
  assert.deepEqual(files.filter(file=>[filePath,'Resource/'+newFileName].includes(file.fileName)),[sourcePackage]);
  const events=await repository.listWorkspaceActivityEventsByWorkspace(ids.tenantId,ids.workspaceId);
  assert.ok(!events.some(event=>event.eventType==='source_package_deleted'&&event.subjectId===sourcePackage.sourcePackageId));
 };
 const cases=[
  ['logout',403,async token=>services.adminAuth.signOut({sessionToken:token})],
  ['removed RW grant',404,async()=>repository.deleteAdminRoleAssignment(role.roleAssignmentId)],
  ['downgraded RO grant',403,async()=>repository.saveAdminRoleAssignment({...role,accessMode:'read_only'})],
  ['disabled account',403,async()=>repository.saveAdminUser({...user,status:'disabled'})],
  ['required password change',403,async()=>repository.saveAdminUser({...user,passwordChangeRequired:true})],
  ['expired account window',403,async()=>repository.saveAdminUser({...user,validTo:new Date(Date.now()-1).toISOString()})],
  ['expired session',403,async token=>{const s=await repository.getAdminSessionByToken(token);await repository.saveAdminSession({...s,expiresAt:new Date(Date.now()-1).toISOString()});}],
  ['suspended Tenant',404,async()=>repository.saveTenant({...tenant,status:'suspended'})],
  ['archived Workspace',404,async()=>repository.saveWorkspace({...scope,workspace:{...workspace,status:'archived'}})]
 ];
 const repositories={groups:'deleteOriginalGroupResults',tests:'deleteOriginalSelectedTests',files:'deleteSourcePackageAggregate',
  upload:'reserveWorkspaceFileUpload',replacement:'reserveSourcePackageReplacement'};
 const selections={groups:{groups:[groupKey]},tests:{personSessions:[{loginName,bookletName:'OWNED.ADM.B'}]},files:{f:[filePath]}};
 const basePath='/workspace/'+workspaceNumber;
 const paths={groups:basePath+'/responses',tests:basePath+'/responses/detailed',files:basePath+'/files',
  upload:basePath+'/file',replacement:basePath+'/file'};
 const multipartName={upload:newFileName,replacement:fileName};
 for(const boundary of ['body','durable-writer'])for(const kind of Object.keys(paths))for(const[label,status,invalidate]of cases){
  const method=multipartName[kind]?'POST':'DELETE';
  await t.test(`native ${kind} ${method} rejects ${label} after ${boundary} wait`,{timeout:20000},async()=>{
   await restore();const token=(await services.adminAuth.signIn({username:user.username,password:'Owned-test-admin-reader-secret'})).adminSession.token;
   const entered=Promise.withResolvers(),release=Promise.withResolvers();let failure;
   const delayed=new Proxy(repository,{get(target,key){
    if(boundary==='durable-writer'&&key===repositories[kind])return async(...args)=>{entered.resolve();await release.promise;return target[key](...args);};
    const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;
   }});
   const runtime=boundary==='durable-writer'?createFirstSliceServices({repository:delayed}):services;
   const bytes=async req=>{if(boundary==='body')entered.resolve();const chunks=[];for await(const chunk of req)chunks.push(chunk);return Buffer.concat(chunks);};
   const server=createServer((req,res)=>void handleOriginalWorkspaceHttp({request:req,pathname:new URL(req.url,'http://owned.invalid').pathname,services:runtime,
    readBody:async decode=>decode(await bytes(req)),readUpload:()=>bytes(req),
    propagateError:()=>false,header:(key,value)=>res.setHeader(key,value),raw:(code,text,type)=>{res.writeHead(code,{'Content-Type':type});res.end(text);}
   }).catch(error=>{failure=error;res.writeHead(500);res.end();}));
   await new Promise(done=>server.listen(0,'127.0.0.1',done));let req;
   try{
    const type=method==='POST'?'multipart/form-data; boundary=owned-test-body':'application/json';
    const payload=method==='POST'?'--owned-test-body\r\nContent-Disposition: form-data; name="fileforvo[]"; filename="'+multipartName[kind]+'"\r\nContent-Type: text/plain\r\n\r\nUnauthorized replacement\r\n--owned-test-body--\r\n':JSON.stringify(selections[kind]);
    const response=Promise.withResolvers();
    req=request({hostname:'127.0.0.1',port:server.address().port,path:paths[kind],method,headers:{AuthToken:token,'Content-Type':type,'Content-Length':Buffer.byteLength(payload)}},res=>{const chunks=[];res.on('data',b=>chunks.push(b));res.on('end',()=>response.resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString()}));});
    req.on('error',response.reject);
    if(boundary==='body')req.write(payload.slice(0,1));else req.end(payload);
    await Promise.race([entered.promise,response.promise.then(r=>{throw Error('Request did not reach held boundary: '+r.status);})]);
    await invalidate(token);release.resolve();if(boundary==='body')req.end(payload.slice(1));
    const actual=await response.promise;assert.ifError(failure);assert.equal(actual.status,status);assert.equal(actual.headers['cache-control'],'private, no-store');assert.ok(actual.headers['error-id']);assert.equal(actual.headers['test-mode'],'NO');assert.ok(!actual.body.includes(token));
    await restore();await preserved();
   }finally{release.resolve();req?.destroy();server.closeAllConnections();await new Promise(done=>server.close(done));await restore();}
  });
 }
 if(connectionString){
  await verifyNativeWorkspaceWritePostgres(t,{repository,services,ids,role,workspaceNumber,groupKey,sourcePackage,connectionString});
  await repository.getOrCreateOriginalParticipantGroup({...ids,groupKey,groupLabel:'Owned revocation control',createdAt:new Date().toISOString()});
 }
 await restore();
 const fileToken=(await services.adminAuth.signIn({username:user.username,password:'Owned-test-admin-reader-secret'})).adminSession.token;
 const concurrent=await openConcurrentStorage?.();
 try{
  await verifyNativeWorkspaceFileMutation(t,{repository,independentRepository:concurrent?.repository,services,scope,role,token:fileToken,workspaceNumber,sourcePackage});
 }finally{await concurrent?.shutdown();}
 await t.test('a still-authorized native transaction deletes the actual selected Test and group only',async()=>{
  await restore();const token=(await services.adminAuth.signIn({username:user.username,password:'Owned-test-admin-reader-secret'})).adminSession.token;
  await services.originalWorkspaceAdministration.delete({token,workspacePathSegment:workspaceNumber,kind:'tests',body:{personSessions:[{loginName,bookletName:'OWNED.ADM.B'}]}});
  assert.equal(await repository.getTestRunById(originalRun.testRunId),null);
  await services.originalWorkspaceAdministration.delete({token,workspacePathSegment:workspaceNumber,kind:'groups',body:{groups:[groupKey]}});
  assert.ok(!(await repository.listOriginalParticipantGroupsByWorkspace(ids.tenantId,ids.workspaceId)).some(g=>g.groupKey===groupKey));
 });
}
