import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';

export async function verifyNativeFinishBusy({page,base,wire,directory}) {
  await page.locator('mat-dialog-container').waitFor({state:'detached'});
  const currentUrl=page.url(),before=wire.length,pattern='**/monitor/group/*/test-sessions';
  let release,held=0;const gate=new Promise(resolve=>release=resolve);
  const handler=async route=>{
    const response=await route.fetch();assert.equal(response.status(),200);held++;
    await gate;try{await route.fulfill({response});}catch{}
  };
  const evidence=async()=>({heldSnapshotResponses:held,shieldVisible:await page.locator('#shield').isVisible(),dialogCount:await page.locator('mat-dialog-container').count(),writes:wire.slice(before).filter(row=>row.path.endsWith('/tests/lock')||(row.method==='PUT'&&row.path==='/monitor/command')).length});
  await page.route(pattern,handler);
  try{
    await page.locator('[data-cy=GM_end_button]').click();
    await page.locator('[data-cy=dialog-confirm]').click();
    await page.locator('mat-dialog-container').waitFor({state:'detached'});
    const deadline=Date.now()+15000;
    while(!held&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,25));
    assert.ok(held,'The confirmed finish did not request its real fresh snapshot');
    // All snapshots remain held: a poll response cannot make this render pass.
    await page.locator('#shield').waitFor({state:'visible',timeout:1500});
    await page.screenshot({path:join(directory,'finish-busy.png')});
    const trial=await page.locator('[data-cy=GM_end_button]').click({trial:true,timeout:300}).then(()=>false,error=>error.name==='TimeoutError');
    assert.equal(trial,true,'The finish shield must block pointer interaction');
    await page.locator('[data-cy=GM_end_button]').focus();await page.keyboard.press('Enter');
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.equal(await page.locator('mat-dialog-container').count(),0,'Keyboard input must not open a second finish');
    await page.locator('[data-cy=GM_pause_button]').focus();await page.keyboard.press('Space');
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.equal((await evidence()).writes,0,'Controls must not dispatch while finish is held');
    await writeFile(join(directory,'finish-busy.json'),JSON.stringify(await evidence(),null,2));
  }catch(error){
    await writeFile(join(directory,'finish-busy-failure.json'),JSON.stringify(await evidence(),null,2));
    await page.screenshot({path:join(directory,'finish-busy-failure.png')}).catch(()=>{});
    throw error;
  }finally{
    // Retire the old view before releasing its read; it must not lock anything.
    await page.goto(base+'/app/group-monitor?ui=original',{waitUntil:'domcontentloaded'});
    release();await page.unroute(pattern,handler);
    await page.goto(currentUrl,{waitUntil:'networkidle'});
    await page.locator('tc-test-session').first().waitFor();
  }
  assert.equal(wire.slice(before).some(row=>row.path.endsWith('/tests/lock')||(row.method==='PUT'&&row.path==='/monitor/command')),false,'A retired held finish must not dispatch after release');
}
