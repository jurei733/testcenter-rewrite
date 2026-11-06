import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

/** Real FileReader, protected production HTTP, native file UI and downloads.
 * The fixture has never installed this resource through a service or DB seed. */
export async function runNativeResourceUploadSmoke({browser,base,out,fixture,mark}) {
  const path=`/api/v1/tenants/${fixture.scope.tenantKey}/workspaces/${fixture.scope.workspaceKey}/files`;
  const contexts=[],errors=[],wire=[];
  const open=async credentials=>{
    const context=await browser.newContext({viewport:{width:1280,height:900},locale:'de-DE',timezoneId:'Europe/Berlin'});
    contexts.push(context);const page=await context.newPage();page.setDefaultTimeout(25_000);
    page.on('pageerror',error=>errors.push(String(error)));
    let authorization;
    context.on('request',request=>{
      if(new URL(request.url()).pathname===path&&request.method()==='GET')authorization=request.headers().authorization;
    });
    await page.goto(base+'/app/ops?ui=original');
    await page.locator('#adminUsername').fill(credentials.username);await page.locator('#adminPassword').fill(credentials.password);
    await page.locator('#adminSignInButton').click();await page.locator('#adminSignOutButton').waitFor();
    await page.goto(base+'/app/workspace?ui=original');
    await page.locator('#tenantKey').fill(fixture.scope.tenantKey);await page.locator('#tenantKey').dispatchEvent('change');
    await page.locator('#workspaceKey').fill(fixture.scope.workspaceKey);await page.locator('#workspaceKey').dispatchEvent('change');
    await page.locator('[data-view-nav=content]').click();await page.locator('#originalWorkspaceFiles[aria-busy=false]').waitFor();
    assert.match(authorization||'',/^Bearer /);
    const catalog=async()=>{
      const reply=await context.request.get(base+path,{headers:{authorization}});assert.equal(reply.status(),200);return reply.json();
    };
    return{context,page,catalog,authorization};
  };
  const upload=async(page,name,bytes,status)=>{
    const result=page.waitForResponse(reply=>new URL(reply.url()).pathname===path&&reply.request().method()==='POST');
    await page.locator('[data-cy=upload-file-select]').setInputFiles({name,mimeType:'application/zip',buffer:bytes});
    const reply=await result;
    // The successful response echoes >44MB of source data. Chromium may evict
    // its inspector copy while Angular still consumes it normally. Observe
    // status + actual UI completion, then independently download stored bytes.
    const body=reply.status()>=400?await reply.json():null;
    assert.equal(reply.status(),status,body?.error||'Native resource upload status');
    const raw=reply.request().postData(),packet=JSON.parse(raw);assert.equal(packet.fileName,name);
    wire.push({method:'POST',path,status:reply.status(),name,wireBytes:Buffer.byteLength(raw),payloadSha256:hash(raw),sourceDocumentSha256:hash(packet.sourceDocument)});
    await page.locator('#originalWorkspaceFiles[aria-busy=false]').waitFor();await page.locator('[data-cy=close-upload-report]').waitFor();
    return{body,packet};
  };
  const download=async(page,suffix)=>{
    const row=page.locator('mat-row').filter({has:page.getByText('GeoGebra.itcr.zip',{exact:true})});await row.waitFor();
    const pending=page.waitForEvent('download');await row.locator('button').click();const file=await pending;
    assert.equal(file.suggestedFilename(),'GeoGebra.itcr.zip');const path=join(out,'native-resource-'+suffix+'.itcr.zip');
    await file.saveAs(path);const bytes=await readFile(path);assert.equal(bytes.length,fixture.manifest.runtime.bytes);assert.equal(hash(bytes),fixture.manifest.runtime.sha256);
    return{bytes:bytes.length,sha256:hash(bytes)};
  };
  let page;
  try {
    const writer=await open(fixture.resourceUpload.writer);page=writer.page;
    const before=await writer.catalog();assert.ok(!before.items.some(file=>/GeoGebra\.itcr\.zip$/.test(file.fileName)));
    assert.equal(await page.locator('[data-cy=upload-files]').isDisabled(),false);
    const bytes=fixture.resourceUpload.bytes;assert.equal(hash(bytes),fixture.manifest.runtime.sha256);
    const uploaded=await upload(page,'GeoGebra.itcr.zip',bytes,201);
    assert.equal(uploaded.packet.sourceDocument,'data:application/zip;base64,'+bytes.toString('base64'));
    assert.equal(await page.locator('[data-cy=upload-report] .subheading-2.error').count(),0);
    await page.locator('[data-cy=close-upload-report]').click();const published=await writer.catalog();
    const resource=published.items.find(file=>file.fileName==='Resource/GeoGebra.itcr.zip');assert.ok(resource);assert.equal(resource.fileType,'Resource');assert.equal(resource.fileSizeBytes,bytes.length);
    assert.equal(published.totalCount,before.totalCount+1);const identity=file=>[file.sourcePackageId,file.fileName,file.fileType,file.fileSizeBytes,file.uploadedAt];
    assert.deepEqual(published.items.filter(file=>file.sourcePackageId!==resource.sourcePackageId).map(identity),before.items.map(identity));
    mark('native-RW-administrator-uploads-real-33MB-GeoGebra-package-through-FileReader-and-protected-HTTP');
    const writerDownload=await download(page,'writer');
    mark('native-administration-download-preserves-exact-upstream-resource-archive-bytes');
    await page.mouse.move(1180,80);await page.getByRole('tooltip').waitFor({state:'hidden'});
    await page.screenshot({path:join(out,'native-resource-uploaded.png'),fullPage:true});
    const invalid=await upload(page,'broken.itcr.zip',Buffer.from('PK\x03\x04broken'),400);
    assert.equal(invalid.body.error,'workspace_resource_package_invalid');assert.equal(await page.locator('[data-cy=upload-report] .subheading-2.error').count(),1);
    await page.locator('[data-cy=close-upload-report]').click();assert.deepEqual(await writer.catalog(),published);
    mark('native-resource-package-invalid-browser-upload-fails-without-changing-the-current-publication');
    const reader=await open(fixture.resourceUpload.reader);page=reader.page;
    assert.equal(await page.locator('[data-cy=upload-files]').isDisabled(),true);assert.equal(await page.locator('[data-cy=upload-file-select]').isDisabled(),true);
    const readerDownload=await download(page,'reader');
    const forged=await reader.context.request.post(base+path,{headers:{authorization:reader.authorization},data:{fileName:'forbidden.bin',mediaType:'application/octet-stream',sourceDocument:'forbidden'}});
    assert.equal(forged.status(),403);const anonymous=await reader.context.request.post(base+path,{data:{fileName:'anonymous.bin',mediaType:'application/octet-stream',sourceDocument:'forbidden'}});assert.equal(anonymous.status(),401);
    assert.deepEqual(await writer.catalog(),published);assert.deepEqual(errors,[]);
    mark('native-read-only-resource-administration-keeps-download-and-denies-upload-in-UI-and-HTTP');
    await page.mouse.move(1180,80);await page.getByRole('tooltip').waitFor({state:'hidden'});
    await page.screenshot({path:join(out,'native-resource-read-only.png'),fullPage:true});
    await writeFile(join(out,'native-resource-browser-upload.json'),JSON.stringify({success:true,sourcePackageId:resource.sourcePackageId,sourceFileName:resource.fileName,resourceBytes:bytes.length,runtimeSha256:fixture.manifest.runtime.sha256,
      preparedThroughService:false,actualFileReader:true,actualProtectedHttp:true,operatorScopes:['read_write','read_only'],writerDownload,readerDownload,invalidUploadStatus:400,readerForgedUploadStatus:403,anonymousUploadStatus:401,
      existingFileIdentitiesAndSizesPreserved:true,invalidPublicationUnchanged:true,wire,errors},null,2));
  }catch(error){
    await page?.screenshot({path:join(out,'native-resource-upload-failure.png'),fullPage:true}).catch(()=>{});
    await writeFile(join(out,'native-resource-upload-failure.json'),JSON.stringify({error:String(error),errors,wire,body:await page?.locator('body').innerText().catch(()=>'')},null,2));throw error;
  }finally{for(const context of contexts)await context.close();}
}
