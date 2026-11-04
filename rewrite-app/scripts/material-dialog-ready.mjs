// Material's opening timer can finish before its deferred animation frame,
// leaving `mdc-dialog--opening` on an already opened dialog. Observe the current
// painted, focused dialog and its actual effects instead of that private class.
// One inherited Playwright deadline covers the entire readiness observation.
export async function waitForMaterialDialog(page) {
  await page.waitForFunction(state => {
    const dialogs = document.querySelectorAll("mat-dialog-container.mdc-dialog--open");
    if (dialogs.length !== 1) return false;
    const element = dialogs[0];
    // Playwright polls this synchronous predicate on animation frames. Retain
    // observation state only in its argument, without modifying the page DOM.
    if (state.element !== element) {
      state.element = element; state.frames = 0; return false;
    }
    if (++state.frames < 2) return false;
    if (!element.isConnected || !element.classList.contains("mdc-dialog--open")) return false;
    const style = getComputedStyle(element), box = element.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && style.visibility === "visible" &&
      Number(style.opacity) > 0 && element.contains(document.activeElement) &&
      element.getAnimations({subtree:true}).every(animation =>
        animation.effect?.getComputedTiming().iterations === Infinity ||
        animation.playState === "finished" || animation.playState === "idle");
  }, {element:null,frames:0});
}
