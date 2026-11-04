import assert from 'node:assert/strict';

const nextFrames=page=>page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
function watchWrites(page){
 const writes=[],record=request=>{if(['PUT','PATCH','DELETE'].includes(request.method())&&/^\/(?:user|workspace)(?:\/|$)/.test(new URL(request.url()).pathname))writes.push(request);};
 page.on('request',record);return{writes,stop:()=>page.off('request',record)};
}

export async function checkNativeNameInputBoundary(page,kind){
 const input=page.locator('#originalAdministrationName'),save=page.locator('#originalAdministrationEditorSave');
 const previous=await input.inputValue(),watch=watchWrites(page);
 try{
  await input.fill('😀'.repeat(51));await page.locator('mat-dialog-container h1').click();
  await page.getByText('Maximallänge für den Namen ist 50 Zeichen.',{exact:true}).waitFor();
  await page.locator('#originalAdministrationEditorSave:disabled').waitFor();await input.press('Enter');await nextFrames(page);
  assert.equal(watch.writes.length,0,'An invalid native name cannot dispatch a protected write.');
  await input.fill('😀'.repeat(50));await page.locator('#originalAdministrationEditorSave:enabled').waitFor();
  assert.equal(await input.inputValue(),'😀'.repeat(50),'Valid astral characters must not be cut at a UTF-16 length.');
  if(kind!=='create-user'){await input.fill('😀'.repeat(50)+' '.repeat(10));await page.locator('#originalAdministrationEditorSave:enabled').waitFor();}
 }finally{await input.fill(previous);watch.stop();}
 console.log('original_administration='+kind+'-native-unicode-name-boundary-no-rejected-write:passed');
}

export async function checkNativePasswordInputBoundary(page,kind){
 const input=page.locator('#originalAdministrationPassword'),confirmation=page.locator('#originalAdministrationPasswordConfirmation');
 const save=page.locator('#originalAdministrationEditorSave'),previous=await input.inputValue(),hasConfirmation=await confirmation.count();
 const previousConfirmation=hasConfirmation?await confirmation.inputValue():null,watch=watchWrites(page);
 try{
  await input.fill('ä'.repeat(31));if(hasConfirmation)await confirmation.fill('ä'.repeat(31));
  await page.locator('mat-dialog-container h1').click();
  await page.getByText('Das Kennwort darf höchstens 60 UTF-8-Bytes enthalten.',{exact:true}).waitFor();
  await page.locator('#originalAdministrationEditorSave:disabled').waitFor();await input.press('Enter');await nextFrames(page);
  assert.equal(watch.writes.length,0,'An overlong native password cannot dispatch a protected write.');
  await input.fill('ä'.repeat(30));if(hasConfirmation)await confirmation.fill('ä'.repeat(30));
  await page.locator('#originalAdministrationEditorSave:enabled').waitFor();
 }finally{await input.fill(previous);if(hasConfirmation)await confirmation.fill(previousConfirmation);watch.stop();}
 console.log('original_administration='+kind+'-native-password-byte-boundary-no-rejected-write:passed');
}

export async function selectAfterNativeMatrixFailure(page,selector,path){
 const pattern=url=>url.pathname===path;let reads=0;
 await page.route(pattern,async route=>{
  if(route.request().method()==='GET'&&++reads===1)await route.fulfill({status:503,contentType:'text/plain',body:'Owned transient matrix read failure.'});
  else await route.continue();
 });
 try{
  await page.locator(selector).click();await page.locator('#originalAdministrationError').waitFor();
  await page.locator('#originalSystemAdministration[aria-busy="false"]').waitFor();
  assert.equal(await page.locator('.directory-permissions mat-row').count(),0);
  await page.locator(selector).click();await page.locator('.directory-permissions mat-row').first().waitFor();
  await page.locator('#originalSystemAdministration[aria-busy="false"]').waitFor();
  assert.equal(reads,2);assert.equal(await page.locator('#originalAdministrationError').count(),0);
 }finally{await page.unroute(pattern);}
 console.log('original_administration='+path+'-same-selection-retries-real-matrix-read:passed');
}
