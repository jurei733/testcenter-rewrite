// Material exposes its DOM before its asynchronously scheduled opening starts.
// Wait for that lifecycle as well as the rendered transition, without changing
// animation durations, forcing focus, or replacing a native pointer action.
export async function waitForMaterialDialog(page) {
  const dialog = page.locator("mat-dialog-container.mdc-dialog--open:not(.mdc-dialog--opening)");
  await dialog.waitFor();
  await dialog.evaluate(async element => {
    await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
    await Promise.all(element.getAnimations({subtree:true})
      .filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity)
      .map(animation => animation.finished));
  });
}
