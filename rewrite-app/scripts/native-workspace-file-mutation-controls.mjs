import assert from 'node:assert/strict';
import {createServer, request} from 'node:http';
import {randomUUID} from 'node:crypto';
import {
  createFirstSliceServices,
  originalWorkspaceFileMutationLifetimeMs
} from '@testcenter-rewrite-app/application';
import {handleOriginalWorkspaceHttp} from '../apps/api/dist/apps/api/src/original-workspace-http.js';

const multipartType = 'multipart/form-data; boundary=owned-mutation-control';
function multipart(fileName) {
  return '--owned-mutation-control\r\nContent-Disposition: form-data; name="fileforvo[]"; filename="' +
    fileName + '"\r\nContent-Type: text/plain\r\n\r\nOwned mutation control\r\n--owned-mutation-control--\r\n';
}

async function startServer(services, reading = () => {}, handlingError = () => {}) {
  const server = createServer((req,res) => {
    const read = async () => {
      reading();
      const chunks = [];
      for await(const chunk of req)chunks.push(chunk);
      return Buffer.concat(chunks);
    };
    void handleOriginalWorkspaceHttp({
      request:req, pathname:new URL(req.url,'http://owned.invalid').pathname, services,
      readBody:async decode=>decode(await read()), readUpload:read,
      propagateError:()=>false,
      header:(key,value)=>res.setHeader(key,value),
      raw:(code,text,type)=>{res.writeHead(code,{'Content-Type':type});res.end(text);}
    }).catch(error=>{
      handlingError(error);
      if(!res.destroyed){res.writeHead(500);res.end();}
    });
  });
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  return {
    port:server.address().port,
    close:async()=>{server.closeAllConnections();await new Promise(done=>server.close(done));}
  };
}

function openHeldRequest(port, path, method, type, token, body) {
  const result=Promise.withResolvers();
  const req=request({hostname:'127.0.0.1',port,path,method,headers:{
    AuthToken:token,'Content-Type':type,'Content-Length':Buffer.byteLength(body)
  }},res=>{
    const chunks=[];
    res.on('data',chunk=>chunks.push(chunk));
    res.on('end',()=>result.resolve({status:res.statusCode,text:Buffer.concat(chunks).toString()}));
  });
  req.on('error',error=>result.resolve({error}));
  req.write(body.slice(0,1));
  return {req,result:result.promise,finish:()=>req.end(body.slice(1))};
}

export async function verifyNativeWorkspaceFileMutation(t,{repository,independentRepository,services,scope,role,token,workspaceNumber,sourcePackage}) {
  const locator={token,workspacePathSegment:workspaceNumber};
  const writable=await services.originalWorkspaceAdministration.authorizeWrite(locator);
  const bodyPath='/workspace/'+workspaceNumber;
  const other=await services.platform.createWorkspace({tenantKey:scope.tenantKey,workspaceKey:'other-file-lock',displayName:'Other file lock'});
  await repository.saveAdminRoleAssignment({...role,roleAssignmentId:randomUUID(),workspaceId:other.workspaceId});
  const otherNumber=await repository.getOrCreateOriginalWorkspaceNumber({tenantId:other.tenantId,workspaceId:other.workspaceId});
  const otherPath='/workspace/'+otherNumber;
  const uploadName='held-own-document.txt';
  const deletionPath='Resource/'+uploadName;
  const unavailable='Workspace blocked by another upload or deletion action.';
  const independent=createFirstSliceServices({repository:independentRepository??repository});
  const method={upload:'POST',delete:'DELETE'};
  for(const operation of ['upload','delete'])await t.test('shared native file mutation rejects competing requests during '+operation,{timeout:20000},async()=>{
    const entered=Promise.withResolvers();
    let unexpected;
    const current=await startServer(services,entered.resolve,error=>{unexpected=error;});
    const competitor=await startServer(independent);
    const heldPath=bodyPath+(operation==='upload'?'/file':'/files');
    const heldBody=operation==='upload'?multipart(uploadName):JSON.stringify({f:[deletionPath]});
    const type=operation==='upload'?multipartType:'application/json';
    const hold=openHeldRequest(current.port,heldPath,method[operation],type,token,heldBody);
    const send=(path,method='GET',type='application/json',body)=>{
      return fetch('http://127.0.0.1:'+competitor.port+path,{
        method,headers:{AuthToken:token,'Content-Type':type},body,signal:AbortSignal.timeout(4000)
      });
    };
    try {
      await Promise.race([entered.promise,hold.result.then(()=>assert.fail('Request ended before the held body was read.'))]);
      const competingUpload=await send(bodyPath+'/file','POST',multipartType,multipart('competing.txt'));
      // Different textual workspace locators must refer to the same numeric workspace.
      const competingDelete=await send(bodyPath+'e0/files','DELETE','application/json',
        JSON.stringify({f:[sourcePackage.fileName]}));
      for(const receipt of [competingUpload,competingDelete]){
        assert.equal(receipt.status,409);
        assert.equal(await receipt.text(),unavailable);
      }
      const listed=await send(bodyPath+'/files');
      assert.equal(listed.status,200);
      const files=Object.values(await listed.json()).flat().map(file=>file.name);
      assert.equal(files.includes(uploadName),operation==='delete');
      const independentMutation=await send(otherPath+'/file','POST',multipartType,multipart('independent-'+operation+'.txt'));
      assert.equal(independentMutation.status,201,await independentMutation.text());
      hold.finish();
      const receipt=await hold.result;
      assert.ifError(unexpected);
      assert.equal(receipt.status,operation==='upload'?201:207,receipt.text);
      const released=await send(bodyPath+'/files','DELETE','application/json',JSON.stringify({f:[]}));
      assert.equal(released.status,207);
    } finally {
      hold.req.destroy();
      await Promise.all([current.close(),competitor.close()]);
    }
  });

  await t.test('an abandoned native upload releases the workspace for a later deletion',{timeout:20000},async()=>{
    const entered=Promise.withResolvers(),aborted=Promise.withResolvers();
    const current=await startServer(services,entered.resolve,aborted.resolve);
    const hold=openHeldRequest(current.port,bodyPath+'/file','POST',multipartType,token,multipart('abandoned.txt'));
    try {
      await Promise.race([entered.promise,hold.result.then(()=>assert.fail('Upload ended before the held body was read.'))]);
      hold.req.destroy();
      await aborted.promise;
      const lease=await independent.originalWorkspaceAdministration.acquireFileMutation({...writable,token});
      await lease.release();
      const catalog=await services.workspaceAdminRead.getWorkspaceFileCatalog(scope);
      assert.ok(!catalog.items.some(file=>file.fileName.endsWith('/abandoned.txt')));
    } finally {
      hold.req.destroy();
      await current.close();
    }
  });

  await t.test('expired file mutation is fenced at all three writers and cannot clear a successor',async()=>{
    let clock=Date.now();
    const runtime=createFirstSliceServices({repository,now:()=>new Date(clock).toISOString()});
    const initial=await runtime.originalWorkspaceAdministration.acquireFileMutation({...writable,token});
    const stale={...await runtime.originalWorkspaceAdministration.authorizeWrite(locator)};
    stale.authority={...stale.authority,fileMutationId:initial.id};
    clock+=originalWorkspaceFileMutationLifetimeMs-1;
    await assert.rejects(runtime.originalWorkspaceAdministration.acquireFileMutation({...writable,token}),error=>error.statusCode===409);
    clock++;
    const successor=await runtime.originalWorkspaceAdministration.acquireFileMutation({...writable,token});
    const blocked=error=>error.errorCode==='original_workspace_file_mutation_blocked';
    try {
      await initial.release();
      await assert.rejects(runtime.originalWorkspaceAdministration.acquireFileMutation({...writable,token}),blocked);
      for(const fileName of ['stale-new.txt',sourcePackage.fileName.split('/').at(-1)]){
        await assert.rejects(runtime.contentIntake.uploadOriginalWorkspaceFiles({...stale,
          files:[{fileName,bytes:Buffer.from('Stale mutation cannot commit')}] }),blocked);
      }
      await assert.rejects(runtime.contentIntake.deleteSourcePackage({...stale,sourcePackageId:sourcePackage.sourcePackageId,
        confirmation:sourcePackage.fileName}),blocked);
      assert.deepEqual(await repository.getSourcePackageById(sourcePackage.sourcePackageId),sourcePackage);
    } finally {
      await successor.release();
    }
    const available=await runtime.originalWorkspaceAdministration.acquireFileMutation({...writable,token});
    await available.release();
  });
}
