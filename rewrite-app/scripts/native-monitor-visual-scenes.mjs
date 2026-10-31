import assert from 'node:assert/strict';

export const monitorVisualScenes=Object.freeze(['baseline','selected-row','settings-menu']);

export async function prepareMonitorVisualScene(page,scene,screen) {
  assert.ok(monitorVisualScenes.includes(scene),'Unknown native Monitor visual scene');
  if(scene==='baseline')return {scene};
  if(scene==='settings-menu'){
    await page.locator('[data-cy=GM_setting_button]').click();
    await page.getByRole('menu').waitFor();
    return {scene};
  }
  await page.getByRole('switch').click();
  await page.waitForFunction(()=>document.querySelector('[role=switch]')?.getAttribute('aria-checked')==='false'&&
    document.querySelectorAll('tc-test-session input[type=checkbox]').length===2&&
    [...document.querySelectorAll('tc-test-session input[type=checkbox]')].every(input=>!input.checked)&&
    document.querySelector('[data-cy=GM_pause_button]')?.disabled);
  if(screen==='mobile'){
    await page.locator('.drawer-button-open').click();
    // The closed class changes before the drawer transition ends. Clicking
    // while it moves can scroll the document before the final row is visible.
    await page.waitForFunction(()=>{
      const drawer=document.querySelector('.mat-drawer'),content=document.querySelector('.mat-drawer-content');
      return !!drawer&&getComputedStyle(drawer).visibility==='hidden'&&!drawer.classList.contains('mat-drawer-opened')&&content?.getBoundingClientRect().x===0;
    });
    await page.waitForFunction(()=>document.getAnimations().every(animation=>
      !Number.isFinite(animation.effect?.getTiming().iterations)||animation.playState==='finished'),{},{timeout:2000});
  }
  await page.evaluate(()=>{
    window.__ownedVisualSelections=[];
    document.addEventListener('change',event=>{
      const input=event.target;
      if(input instanceof HTMLInputElement&&input.type==='checkbox'&&input.closest('tc-test-session'))
        window.__ownedVisualSelections.push({trusted:event.isTrusted,checked:input.checked});
    },true);
  });
  await page.locator('tc-test-session').first().locator('input[type=checkbox]').check();
  await page.waitForFunction(()=>[...document.querySelectorAll('tc-test-session input[type=checkbox]')].filter(input=>input.checked).length===1&&
    !document.querySelector('[data-cy=GM_pause_button]')?.disabled);
  const selection=await page.evaluate(()=>window.__ownedVisualSelections);
  assert.deepEqual(selection,[{trusted:true,checked:true}]);
  return {scene,selection};
}
