// Observe Material's actual portal/translation completion. Two frames alone
// can precede its outgoing animation and leave both tab bodies in a capture.
export async function waitForMaterialTabs(page,selector='mat-tab-group'){
 await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
 await page.waitForFunction(selector=>{
  const group=document.querySelector(selector),wrapper=group?.querySelector('.mat-mdc-tab-body-wrapper');
  const active=group?.querySelector('.mat-mdc-tab-body-active');if(!wrapper||!active)return false;
  return Math.abs(wrapper.getBoundingClientRect().x-active.getBoundingClientRect().x)<1/64&&
   [...group.querySelectorAll('mat-tab-body:not(.mat-mdc-tab-body-active)')].every(body=>
    !body.querySelector('.mat-mdc-tab-body-content')?.childElementCount);
 },selector);
 await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
}
