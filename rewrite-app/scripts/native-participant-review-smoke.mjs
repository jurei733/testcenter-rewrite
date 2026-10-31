import assert from 'node:assert/strict';
import {join} from 'node:path';
import {writeFile} from 'node:fs/promises';

/** Actual native Trial/Review entry, original components and production API.
 * No intercepted responses, component state assignment or forced clicks. */
export async function runNativeParticipantReviewSmoke({browser,base,password,out,mark,errors}){
 const evidence=[];
 for(const [mode,width]of [['trial',1280],['review',390]]){
  const context=await browser.newContext({viewport:{width,height:width===1280?850:844},locale:'de-DE'}),page=await context.newPage();
  page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(String(error)));
  const prefix='native-review-'+mode+'-'+width;
  const panel=page.locator('tc-review-panel'),comment=panel.locator('[data-cy=comment-diag-comment]');
  const closed=()=>page.waitForFunction(()=>!document.querySelector('mat-sidenav.mat-drawer-opened'));
  const open=async()=>{await page.locator('[data-cy=send-comments]').click();await page.locator('mat-sidenav.mat-drawer-opened').waitFor();await panel.waitFor();};
  const shownList=()=>panel.getByRole('heading',{name:'Kommentarübersicht',exact:true}).waitFor();
  const showList=async()=>{if(!await panel.getByRole('heading',{name:'Kommentarübersicht',exact:true}).isVisible())await panel.locator('[data-cy=comment-toolbar-show-list]').click();await shownList();};
  const listReply=async(path,token)=>{
   const response=await page.request.get(base+path,{headers:{AuthToken:token}});assert.equal(response.status(),200);return response.text();
  };
  try{
   await page.goto(base+'/app/native-start?ui=original');await page.getByRole('textbox',{name:'Anmeldename',exact:true}).fill('native-review-'+mode);await page.locator('[data-cy=login-user]').click();
   await page.getByLabel('Kennwort',{exact:true}).fill(password);
   const signed=page.waitForResponse(response=>['/session','/session/login'].includes(new URL(response.url()).pathname)&&response.request().method()==='PUT'&&response.status()===200);void signed.catch(()=>{});
   await page.locator('[data-cy=login-user]').click();const identity=await(await signed).json();assert.ok(identity.token);
   assert.equal(identity.claims.test.find(claim=>claim.id==='OWNED.BROWSER')?.flags.locked,false,'The isolated Review actor must have an unlocked native assignment');
   if(mode==='trial')assert.equal(await page.locator('[data-cy=review-download]').count(),0);
   await page.locator('[data-cy="booklet-OWNED.BROWSER"]').getByRole('button',{name:'Starten',exact:true}).click();await page.waitForURL(/\/native-test\/[0-9]+(?:\/|$)/);
   await page.frameLocator('iframe').getByRole('textbox',{name:'Owned answer'}).waitFor();
   const test=/\/native-test\/([0-9]+)/.exec(new URL(page.url()).pathname)?.[1];assert.ok(test);const root='/test/'+test,unit=root+'/unit/OWNED.UNIT';
   await open();await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:join(out,'review-'+mode+'-'+width+'-form.png')});mark(prefix+'-real-actor-enters-the-native-review-form');
   await panel.locator('[data-cy=comment-diag-reviewer]').fill('Owned native reviewer');
   await panel.locator('[data-cy=comment-diag-currentPage] input[type=radio]').check();await panel.locator('input[formControlName=targetLabel]').fill('Owned page Ω');
   const first='Native '+mode+' comment Ω';await comment.fill(first);
   const save=page.waitForResponse(response=>new URL(response.url()).pathname===unit+'/review'&&response.request().method()==='PUT');void save.catch(()=>{});
   await panel.locator('[data-cy=comment-diag-submit]').click();const saved=await save;assert.equal(saved.status(),201);assert.equal(saved.request().postDataJSON().pagelabel,'Owned page Ω');await closed();
   const raw=await listReply(unit+'/reviews',identity.token),id=/"id":([0-9]+)/.exec(raw)?.[1];assert.ok(id&&BigInt(id)>9007199254740991n);assert.equal(JSON.parse(raw)[0].pagelabel,'Owned page Ω');
   mark(prefix+'-task-comment-persists-on-the-exact-native-int64-review-id');
   await open();await showList();const item=panel.locator('[data-cy=comment-list-unit-comments]').filter({hasText:first});await item.waitFor();await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:join(out,'review-'+mode+'-'+width+'-populated-list.png')});await item.click();await comment.waitFor();
   const edited=first+' edited';await comment.fill(edited);const patch=page.waitForResponse(response=>new URL(response.url()).pathname===unit+'/review/'+id&&response.request().method()==='PATCH');void patch.catch(()=>{});
   await panel.locator('[data-cy=comment-diag-submit]').click();assert.equal((await patch).status(),200);await closed();
   const updated=await listReply(unit+'/reviews',identity.token);assert.equal(JSON.parse(updated)[0].entry,edited);assert.equal(JSON.parse(updated)[0].originalUnitId,'OWNED.UNIT');
   mark(prefix+'-editor-patches-the-unrounded-id-and-keeps-first-unit-provenance');
   await open();await page.locator('[data-cy=unit-navigation-forward]').click();await page.waitForURL(/\/u\/2(?:\?|$)/);await closed();
   await open();await page.waitForFunction(()=>document.querySelector('tc-review-panel [data-cy=comment-diag-comment]')?.value==='');assert.equal(await comment.inputValue(),'');await showList();assert.equal(await panel.locator('[data-cy=comment-list-unit-comments]').count(),0);
   await panel.locator('[data-cy=comment-toolbar-new-comment]').click();await comment.waitFor();
   mark(prefix+'-trusted-unit-change-retires-the-form-and-keeps-the-second-unit-clean');
   await panel.locator('[data-cy=comment-diag-currentBklt] input[type=radio]').check();const whole='Native '+mode+' booklet Ω';await comment.fill(whole);
   const wholeSaved=page.waitForResponse(response=>new URL(response.url()).pathname===root+'/review'&&response.request().method()==='PUT');void wholeSaved.catch(()=>{});await panel.locator('[data-cy=comment-diag-submit]').click();assert.equal((await wholeSaved).status(),201);await closed();
   const wholeRaw=await listReply(root+'/reviews',identity.token),wholeId=/"id":([0-9]+)/.exec(wholeRaw)?.[1];assert.ok(wholeId&&BigInt(wholeId)>9007199254740991n);
   const json=await page.request.get(base+'/reviews/export',{headers:{AuthToken:identity.token,Accept:'application/json'}});assert.equal(json.status(),200);const exported=await json.json();assert.ok(exported.some(row=>row.entry===edited&&row.unitname==='OWNED.UNIT'));assert.ok(exported.some(row=>row.entry===whole&&row.unitname===''));
   const csv=await page.request.get(base+'/reviews/export',{headers:{AuthToken:identity.token,Accept:'text/csv'}});assert.equal(csv.status(),200);assert.ok((await csv.text()).includes(whole));
   if(mode==='review'){
    await page.goto(base+'/app/native-start?ui=original');const button=page.locator('[data-cy=review-download]');await button.waitFor();
    const download=page.waitForEvent('download');void download.catch(()=>{});await button.click();const result=await download;assert.equal(result.suggestedFilename(),'testcenter-reviews.csv');
    const {readFile}=await import('node:fs/promises');assert.equal(await readFile(await result.path(),'utf8'),await csv.text());
    mark(prefix+'-Source-Starter-download-delivers-the-actual-protected-csv');
    await page.locator('[data-cy="booklet-OWNED.BROWSER"]').getByRole('button',{name:'Weiter',exact:true}).click();await page.waitForURL(url=>url.pathname.endsWith('/native-test/'+test+'/u/1'));await page.frameLocator('iframe').getByRole('textbox',{name:'Owned answer'}).waitFor();
    // Original run-review does not save Test/Unit navigation state. Resume at
    // its first Unit, then select the second Unit with the actual UI.
    await page.locator('[data-cy=unit-navigation-forward]').click();await page.waitForURL(url=>url.pathname.endsWith('/native-test/'+test+'/u/2'));await page.frameLocator('iframe').getByRole('textbox',{name:'Owned answer'}).waitFor();
   }
   await open();await showList();await panel.locator('[data-cy=comment-list-booklet-comments]').filter({hasText:whole}).click();await comment.waitFor();await comment.fill(whole+' edited');
   const wholePatch=page.waitForResponse(response=>new URL(response.url()).pathname===root+'/review/'+wholeId&&response.request().method()==='PATCH');void wholePatch.catch(()=>{});await panel.locator('[data-cy=comment-diag-submit]').click();assert.equal((await wholePatch).status(),200);await closed();
   await open();await showList();await panel.locator('[data-cy=comment-list-booklet-comments]').filter({hasText:whole+' edited'}).click();
   const wholeDelete=page.waitForResponse(response=>new URL(response.url()).pathname===root+'/review/'+wholeId&&response.request().method()==='DELETE');void wholeDelete.catch(()=>{});await panel.locator('[data-cy=comment-diag-delete]').click();assert.equal((await wholeDelete).status(),204);
   await shownList();await page.waitForFunction(()=>document.querySelectorAll('tc-review-panel [data-cy=comment-list-booklet-comments]').length===0);assert.equal(await panel.locator('[data-cy=comment-list-booklet-comments]').count(),0);
   mark(prefix+'-booklet-create-edit-delete-and-protected-json-csv-export-complete');
   await panel.getByRole('button',{name:'Schließen',exact:true}).click();await closed();await page.locator('[data-cy=unit-navigation-backward]').click();await page.waitForURL(/\/u\/1(?:\?|$)/);
   await open();await showList();await panel.locator('[data-cy=comment-list-unit-comments]').filter({hasText:edited}).click();
   const deleted=page.waitForResponse(response=>new URL(response.url()).pathname===unit+'/review/'+id&&response.request().method()==='DELETE');void deleted.catch(()=>{});await panel.locator('[data-cy=comment-diag-delete]').click();assert.equal((await deleted).status(),204);
   await shownList();await page.waitForFunction(()=>document.querySelectorAll('tc-review-panel [data-cy=comment-list-unit-comments]').length===0);assert.equal(await panel.locator('[data-cy=comment-list-unit-comments]').count(),0);assert.equal(await listReply(unit+'/reviews',identity.token),'[]');
   await page.screenshot({path:join(out,'review-'+mode+'-'+width+'.png')});
   mark(prefix+'-delete-removes-only-the-owned-native-unit-comment');
   if(mode==='review'){
    await page.goto(base+'/app/native-start?ui=original');let downloads=0;const onDownload=()=>downloads++;page.on('download',onDownload);
    const empty=page.waitForResponse(response=>new URL(response.url()).pathname==='/reviews/export'&&response.request().method()==='GET');void empty.catch(()=>{});
    await page.locator('[data-cy=review-download]').click();assert.equal((await empty).status(),204);await page.getByText('Keine Kommentare verfügbar.',{exact:true}).waitFor();assert.equal(downloads,0);page.off('download',onDownload);
    mark(prefix+'-empty-Source-Starter-export-shows-feedback-without-a-download');
   }
   evidence.push({mode,width,realTrustedUi:true,unitReviewId:id,bookletReviewId:wholeId,unsafeIdsPreserved:true,actualProtectedJsonAndCsv:true});
  }catch(error){await page.screenshot({path:join(out,'review-'+mode+'-'+width+'-failure.png')}).catch(()=>{});await writeFile(join(out,'review-'+mode+'-'+width+'-failure.json'),JSON.stringify({error:String(error),body:await page.locator('body').innerText().catch(()=> '')},null,2));throw error;}
  finally{await context.close();}
 }
 await writeFile(join(out,'review-evidence.json'),JSON.stringify(evidence,null,2)+'\n');
}
