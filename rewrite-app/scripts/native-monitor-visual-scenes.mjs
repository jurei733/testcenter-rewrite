import assert from 'node:assert/strict';

export const monitorVisualScenes=Object.freeze(['baseline','selected-row','settings-menu','new-filter-dialog','filter-target-menu','filter-value-options','advanced-filter-dialog']);

export async function prepareMonitorVisualScene(page,scene,screen) {
  assert.ok(monitorVisualScenes.includes(scene),'Unknown native Monitor visual scene');
  if(scene==='baseline')return {scene};
  if(scene==='settings-menu'){
    await page.locator('[data-cy=GM_setting_button]').click();
    await page.getByRole('menu').waitFor();
    return {scene};
  }
  if(['new-filter-dialog','filter-target-menu','filter-value-options','advanced-filter-dialog'].includes(scene)){
    await page.locator('[data-cy=GM_setting_button]').click();await page.getByRole('menu').waitFor();
    await page.locator('[data-cy=GM_filter_button]').hover();
    await page.waitForFunction(()=>[...document.querySelectorAll('[role=menu]')].filter(menu=>getComputedStyle(menu).visibility!=='hidden').length===2);
    await page.locator('[data-cy=GM_add_filter_button]').click();await page.getByRole('dialog').waitFor();
    // A child overlay must measure the completed dialog, not its 80% entry
    // transform. Wait for actual identity/finished animations; never set size.
    await page.waitForFunction(()=>{
      const surface=document.querySelector('.mat-mdc-dialog-container .mdc-dialog__surface');
      if(!surface)return false;const transform=getComputedStyle(surface).transform;
      return (transform==='none'||new DOMMatrixReadOnly(transform).isIdentity)&&document.getAnimations().every(animation=>
        !Number.isFinite(animation.effect?.getTiming().iterations)||animation.playState==='finished');
    },{},{timeout:2000});
    const evidence={scene};
    if(scene==='filter-target-menu'){
      await page.locator('[data-cy=GM_filtersetting_field]').click();await page.getByRole('listbox').waitFor();
      const options=await page.getByRole('option').allTextContents();assert.ok(options.length>0);
      evidence.options=options.map(value=>value.trim());
    }
    if(scene==='filter-value-options'){
      // The pinned Source populates Booklet labels, not the default person list.
      await page.locator('[data-cy=GM_filtersetting_field]').click();await page.getByRole('listbox').waitFor();
      await page.getByRole('option',{name:'Testheft',exact:true}).click();await page.getByRole('listbox').waitFor({state:'hidden'});
      await page.locator('[data-cy=comment-diag-value]').fill('Owned');await page.getByRole('listbox').waitFor();
      assert.equal(await page.getByRole('option').count(),1);
      assert.equal(await page.getByRole('option',{name:'Owned Monitor Booklet',exact:true}).count(),1);
      evidence.options=['Owned Monitor Booklet'];evidence.value=await page.locator('[data-cy=comment-diag-value]').inputValue();
    }
    if(scene==='advanced-filter-dialog'){
      assert.equal(await page.getByRole('dialog').getByRole('switch').count(),1);
      await page.getByRole('dialog').getByRole('switch').click();await page.locator('[data-cy=comment-diag-name]').waitFor();
      assert.equal(await page.getByRole('dialog').getByRole('switch').last().getAttribute('aria-checked'),'true');
      evidence.advancedMode=true;
    }
    return evidence;
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
