import assert from 'node:assert/strict';
import {waitForMaterialDialog} from './material-dialog-ready.mjs';
import {raceWithSmokeDeadline} from './smoke-deadline.mjs';

// Source has single-account actions. Rewrite batch deletion remains covered
// independently in the owning gate; Original exercises its actual visible UI.
export async function runOriginalAdminDeletionSmoke({page,users,api,password,wrongPassword,screen,deletions}){
 const root=page.locator('#originalSystemAdministration[aria-busy="false"]');await root.waitFor();
 const trigger=page.locator('[data-cy="delete-user"]'),secret=page.locator('#globalConfirmationPasswordInput');
 const submit=page.locator('#globalConfirmationConfirmButton'),backdrop=page.locator('#globalConfirmationBackdrop');
 await page.locator('[data-admin-id="'+users[0].adminUser.adminUserId+'"]').click();
 const open=async()=>{await trigger.click();await waitForMaterialDialog(page);await page.waitForFunction(()=>document.activeElement?.id==='globalConfirmationPasswordInput');};
 await open();assert.equal(await secret.getAttribute('type'),'password');assert.equal(await submit.isDisabled(),true);
 assert.equal(await page.locator('.original-password-confirmation-dialog .mat-mdc-dialog-surface').evaluate(element=>getComputedStyle(element).backgroundColor),'rgb(255, 255, 255)');
 await page.getByRole('heading',{name:'Löschen von Administrator:innen',exact:true}).waitFor();
 await secret.fill('123456');assert.equal(await submit.isDisabled(),true);await secret.fill(password);assert.equal(await submit.isEnabled(),true);
 await secret.focus();await page.keyboard.press('Shift+Tab');await page.waitForFunction(()=>document.activeElement?.id==='globalConfirmationCancelButton');
 await page.keyboard.press('Tab');await page.waitForFunction(()=>document.activeElement?.id==='globalConfirmationPasswordInput');
 await secret.fill(wrongPassword);await page.keyboard.press('Escape');await backdrop.waitFor({state:'detached'});
 await page.waitForFunction(()=>document.activeElement?.getAttribute('data-cy')==='delete-user');assert.equal(deletions.length,0);
 await open();assert.equal(await secret.inputValue(),'');await secret.fill(password);
 await page.locator('.cdk-overlay-backdrop').click({position:{x:1,y:1}});await backdrop.waitFor({state:'detached'});
 await page.waitForFunction(()=>document.activeElement?.getAttribute('data-cy')==='delete-user');assert.equal(deletions.length,0);
 await open();assert.equal(await secret.inputValue(),'');await secret.fill(wrongPassword);await submit.click();
 await page.locator('#globalConfirmationPasswordError').filter({hasText:'Falsches Kennwort.'}).waitFor();
 await page.waitForFunction(()=>document.activeElement?.id==='globalConfirmationConfirmButton');
 assert.equal(deletions.length,1);assert.equal(deletions[0].status(),403);
 assert.ok((await api('/api/v1/admin/users?limit=100')).items.some(item=>item.adminUser.adminUserId===users[0].adminUser.adminUserId));
 await secret.fill(password);await page.locator('#globalConfirmationPasswordError').waitFor({state:'detached'});
 let release,started;const pending=new Promise(done=>release=done),held=new Promise(done=>started=done);const pattern='**/api/v1/admin/users/*';
 if(screen==='desktop')await page.route(pattern,async route=>{
  if(route.request().method()==='DELETE'){const response=await route.fetch();started();await pending;await route.fulfill({response});}else await route.continue();
 });
 await submit.click();
 if(screen==='desktop'){
  await raceWithSmokeDeadline(held,10000,()=>{throw Error('Native Original DELETE was not observed.');});
  try{
   await page.waitForFunction(()=>document.querySelector('#globalConfirmationPasswordInput')?.readOnly===true&&document.querySelector('#globalConfirmationConfirmButton')?.disabled===true&&document.querySelector('#globalConfirmationCancelButton')?.disabled===true);
   await secret.focus();await page.keyboard.press('Enter');await page.keyboard.press('Escape');await page.locator('.cdk-overlay-backdrop').click({position:{x:1,y:1}});
   assert.equal(await backdrop.count(),1,'Pending Original deletion cannot close or submit twice.');
  }finally{release();}
 }
 await backdrop.waitFor({state:'detached'});await root.waitFor();if(screen==='desktop')await page.unroute(pattern);
 assert.equal(deletions.length,2);assert.equal(deletions.at(-1).status(),200);
 assert.equal((await api('/api/v1/admin/users?limit=100')).items.some(item=>item.adminUser.adminUserId===users[0].adminUser.adminUserId),false);
 if(screen==='mobile'){
  // Source updates the acknowledged cache without a refresh. A later failed
  // reload must not reopen or replay that completed destructive operation.
  let faults=0;const pattern='**/api/v1/admin/users**';
  await page.route(pattern,async route=>{if(route.request().method()==='GET'){faults++;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'owned_directory_read_failure',message:'Owned refresh fault'})});}else await route.continue();});
  await page.reload({waitUntil:'domcontentloaded'});await page.locator('#originalAdministrationError').waitFor();
  assert.ok(faults>0);assert.equal(await backdrop.count(),0);assert.equal(deletions.length,2);
  await page.unroute(pattern);await page.reload({waitUntil:'domcontentloaded'});await root.waitFor();
 }
 await page.locator('[data-admin-id="'+users[1].adminUser.adminUserId+'"]').click();await open();await secret.fill(password);await submit.click();await backdrop.waitFor({state:'detached'});await root.waitFor();
 assert.equal(deletions.length,3);assert.equal(deletions.at(-1).status(),200);
 const remaining=(await api('/api/v1/admin/users?limit=100')).items;
 assert.ok(users.every(user=>!remaining.some(item=>item.adminUser.adminUserId===user.adminUser.adminUserId)));
 await page.locator('#originalAdministrationHeader .logo a').click();await page.locator('#deleteWorkspaceButton').waitFor();
 console.log('deletion_confirmation=original-'+screen+'-native-single-actions-pending-cancel-retry-and-cache:passed');
}
