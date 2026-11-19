import assert from 'node:assert/strict';

export async function checkOriginalAccountKeyboardFocus(page, trigger) {
  const menu = page.locator('.original-native-account-menu');
  await page.keyboard.press('Tab');
  await trigger.focus();
  await trigger.press('Enter');
  await menu.waitFor();
  const focusLayer = await trigger.evaluate(element => {
    const layer = element.querySelector('.mat-mdc-button-persistent-ripple');
    return {
      focused: element.matches(':focus-visible'),
      buttonRadius: getComputedStyle(element).borderRadius,
      rippleRadius: getComputedStyle(layer).borderRadius,
      opacity: getComputedStyle(layer, '::before').opacity
    };
  });
  assert.deepEqual(focusLayer, {focused: true, buttonRadius: '12px', rippleRadius: '12px', opacity: '0.12'});
  await menu.getByRole('button', {name: 'Nutzerinformationen schließen'}).press('Enter');
  await menu.waitFor({state: 'detached'});
  assert.equal(await trigger.evaluate(element => document.activeElement === element), true);
}
