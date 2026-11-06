import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {workspaceZip} from './workspace-zip-fixture.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');

/** Every assessment file, including the roster, first enters this workspace
 * through the real administration FileReader and protected upload route. */
export async function runNativeWorkspaceZipSmoke({browser, base, out, fixture, mark}) {
  const path = `/api/v1/tenants/${fixture.scope.tenantKey}/workspaces/${fixture.scope.workspaceKey}/files`;
  const contexts = [], errors = [], wire = [];
  let page;
  const open = async credentials => {
    const context = await browser.newContext({viewport:{width:1280,height:900},locale:'de-DE',timezoneId:'Europe/Berlin'});
    contexts.push(context); const page = await context.newPage(); page.setDefaultTimeout(25_000);
    page.on('pageerror', error => errors.push(String(error)));
    let authorization;
    context.on('request', request => {
      if (new URL(request.url()).pathname === path && request.method() === 'GET') authorization = request.headers().authorization;
    });
    await page.goto(base+'/app/ops?ui=original');
    await page.locator('#adminUsername').fill(credentials.username); await page.locator('#adminPassword').fill(credentials.password);
    await page.locator('#adminSignInButton').click(); await page.locator('#adminSignOutButton').waitFor();
    await page.goto(base+'/app/workspace?ui=original');
    await page.locator('#tenantKey').fill(fixture.scope.tenantKey); await page.locator('#tenantKey').dispatchEvent('change');
    await page.locator('#workspaceKey').fill(fixture.scope.workspaceKey); await page.locator('#workspaceKey').dispatchEvent('change');
    await page.locator('[data-view-nav=content]').click(); await page.locator('#originalWorkspaceFiles[aria-busy=false]').waitFor();
    assert.match(authorization||'', /^Bearer /);
    const catalog = async () => {
      const response = await context.request.get(base+path,{headers:{authorization}});
      assert.equal(response.status(),200); return response.json();
    };
    return {context,page,catalog,authorization};
  };
  const upload = async (page,name,bytes,status) => {
    const started=Date.now();
    const pending = page.waitForResponse(reply => new URL(reply.url()).pathname===path && reply.request().method()==='POST',{timeout:90_000});
    await page.locator('[data-cy=upload-file-select]').setInputFiles({name,mimeType:'application/zip',buffer:bytes});
    const reply = await pending;
    // Large POSTs may evict even a small inspector response. Angular still
    // consumes it normally; observe the UI and protected byte-exact downloads.
    const body = bytes.length>10*1024*1024 ? null : await reply.json();
    assert.equal(reply.status(),status,JSON.stringify(body));
    const raw = reply.request().postData(), packet = JSON.parse(raw);
    assert.equal(packet.fileName,name); assert.equal(packet.sourceDocument,'data:application/zip;base64,'+bytes.toString('base64'));
    wire.push({name,status,elapsedMs:Date.now()-started,archiveBytes:bytes.length,archiveSha256:hash(bytes),wireBytes:Buffer.byteLength(raw)});
    await page.locator('#originalWorkspaceFiles[aria-busy=false]').waitFor(); await page.locator('[data-cy=close-upload-report]').waitFor();
    return body;
  };
  try {
    const writer = await open(fixture.resourceUpload.writer); page = writer.page;
    assert.equal((await writer.catalog()).totalCount,0,'No assessment file was seeded in the root ZIP workspace');
    const result = await upload(page,'native-assessment.zip',fixture.rootArchive.bytes,201);
    assert.equal(result,null);
    assert.match(await page.locator('[data-cy=upload-report]').innerText(),/6 Dateien importiert, 0 abgewiesen/);
    assert.equal(await page.locator('[data-cy=archive-upload-report] h3').count(),6);
    assert.equal(await page.locator('[data-cy=upload-report] .subheading-2.error').count(),0);
    await page.locator('[data-cy=close-upload-report]').click();
    const published = await writer.catalog(); assert.equal(published.totalCount,6);
    assert.ok(published.items.every(file=>file.fileType!=='Package'));
    const downloads = [];
    for (const entry of fixture.rootArchive.entries) {
      const file = published.items.find(file=>file.fileName.endsWith('/'+entry[0].split('/').at(-1))); assert.ok(file);
      const row = page.locator('mat-row').filter({has:page.getByText(entry[0].split('/').at(-1),{exact:true})});
      const pending = page.waitForEvent('download'); await row.locator('button').click(); const download = await pending;
      const output = join(out,'root-zip-'+download.suggestedFilename()); await download.saveAs(output);
      const bytes = await readFile(output); assert.equal(hash(bytes),hash(entry[1]));
      downloads.push({fileName:file.fileName,bytes:bytes.length,sha256:hash(bytes)});
    }
    mark('whole-ZIP-FileReader-upload-materializes-all-six-assessment-files-and-downloads-exact-bytes');
    const opaque = workspaceZip([['inside.txt','opaque nested ZIP']]);
    const partialBytes = workspaceZip([['notes.txt','independent retained'],['bad.xml','<Unit/>'],['plain.zip',opaque],
      ['geometry.xml',fixture.rootArchive.entries.find(([name])=>name.endsWith('/geometry.xml'))[1].toString().replace('NATIVE.GEOMETRY','OTHER.GEOMETRY')]]);
    const partial = await upload(page,'partial.zip',partialBytes,207);
    assert.equal(partial.archiveReport.importedCount,2); assert.equal(partial.archiveReport.rejectedCount,2);
    assert.equal(await page.locator('[data-cy=archive-upload-report] h3').count(),4);
    assert.equal(await page.locator('[data-cy=upload-report] .subheading-2.error').count(),1);
    assert.equal(await page.locator('[data-cy=archive-upload-report] .alert-error').count(),2);
    await page.mouse.move(1180,80);await page.getByRole('tooltip').waitFor({state:'hidden'});
    await page.locator('[data-cy=upload-report]').scrollIntoViewIfNeeded();
    await page.screenshot({path:join(out,'native-root-zip-partial-report.png'),fullPage:true});
    await page.locator('[data-cy=close-upload-report]').click(); const current = await writer.catalog();
    assert.equal(current.totalCount,8); assert.ok(!current.items.some(file=>file.fileName.endsWith('/bad.xml')));
    for (const file of published.items) assert.deepEqual(current.items.find(row=>row.sourcePackageId===file.sourcePackageId),file);
    assert.equal(current.items.find(file=>file.fileName==='Resource/plain.zip').fileType,'Resource');
    mark('partial-ZIP-207-reports-errors-retains-valid-siblings-and-preserves-the-original-Unit');
    const broken = workspaceZip([['first.txt','must not publish'],['late.txt','bad',{checksum:0}]]);
    const invalid = await upload(page,'corrupt.zip',broken,400); assert.equal(invalid.error,'workspace_archive_invalid');
    await page.locator('[data-cy=close-upload-report]').click(); assert.deepEqual(await writer.catalog(),current);
    mark('late-corrupt-ZIP-member-rejects-the-complete-container-before-any-write');
    const reader = await open(fixture.resourceUpload.reader); page = reader.page;
    assert.equal(await page.locator('[data-cy=upload-files]').isDisabled(),true);
    assert.equal(await page.locator('[data-cy=upload-file-select]').isDisabled(),true);
    const body={fileName:'forbidden.zip',mediaType:'application/zip',sourceDocument:'data:application/zip;base64,'+workspaceZip([['forbidden.txt','private']]).toString('base64')};
    const forbidden = await reader.context.request.post(base+path,{headers:{authorization:reader.authorization},data:body}); assert.equal(forbidden.status(),403);
    const anonymous = await reader.context.request.post(base+path,{data:body}); assert.equal(anonymous.status(),401);
    const foreign = await writer.context.request.post(base+path.replace(fixture.scope.workspaceKey,fixture.rootArchive.foreignWorkspaceKey),{headers:{authorization:writer.authorization},data:body}); assert.equal(foreign.status(),403);
    assert.deepEqual(await writer.catalog(),current); assert.deepEqual(errors,[]);
    mark('root-ZIP-upload-denies-readonly-anonymous-and-foreign-workspace-writers');
    await writeFile(join(out,'native-root-zip-browser-upload.json'),JSON.stringify({success:true,actualFileReader:true,actualProtectedHttp:true,
      noAssessmentFilesSeeded:true,noVisibleRootContainer:true,largeResponseObservedThroughActualUI:true,allFiles:downloads,partial:partial.archiveReport,invalidStatus:400,
      readOnlyStatus:403,anonymousStatus:401,foreignWorkspaceStatus:403,originalPublicationPreserved:true,wire,errors},null,2));
  } catch(error) {
    await page?.screenshot({path:join(out,'native-root-zip-failure.png'),fullPage:true}).catch(()=>{});
    await writeFile(join(out,'native-root-zip-failure.json'),JSON.stringify({error:String(error),wire,errors,body:await page?.locator('body').innerText().catch(()=>'')},null,2)); throw error;
  } finally {for (const context of contexts) await context.close();}
}
