// Preserve the failing child page before its owned context is closed. Only
// control geometry/state is recorded; never input values or request headers.
export async function captureSmokeCaseFailure(error, page, scope) {
  if (!error || typeof error !== 'object' || !Object.isExtensible(error) || error.ownedSmokeCase) return;
  const evidence = {scope, url: page?.url(), message: String(error.message ?? error).split('\nCall log:')[0]};
  let screenshot;
  if (page && !page.isClosed()) {
    try {
      evidence.dom = await page.locator('html').evaluate(() => ({
        path: location.pathname, mode: document.documentElement.dataset.interfaceMode,
        readyState: document.readyState, visibility: document.visibilityState,
        viewport: [innerWidth, innerHeight], activeElement: document.activeElement?.id,
        controls: ['participantLoginKey', 'participantPassword', 'participantRouteSignInButton'].map(id => {
          const element = document.getElementById(id);
          if (!element) return {id, present: false};
          const box = element.getBoundingClientRect(), style = getComputedStyle(element);
          const hiddenAncestors = [];
          for (let parent = element; parent; parent = parent.parentElement) {
            const css = getComputedStyle(parent);
            if (parent.hidden || parent.inert || css.display === 'none' || css.visibility === 'hidden') {
              hiddenAncestors.push({tag: parent.tagName, id: parent.id, hidden: parent.hidden,
                inert: parent.inert, display: css.display, visibility: css.visibility});
            }
          }
          return {id, present: true, disabled: element.matches(':disabled'), readOnly: element.readOnly,
            classes: element.className, display: style.display, visibility: style.visibility,
            rect: {x: box.x, y: box.y, width: box.width, height: box.height}, hiddenAncestors};
        })
      }), undefined, {timeout: 2_000});
    } catch (captureError) {evidence.domUnavailable = String(captureError).split('\nCall log:')[0];}
    try {screenshot = await page.screenshot({fullPage: false, timeout: 5_000});}
    catch (captureError) {evidence.screenshotUnavailable = String(captureError).split('\nCall log:')[0];}
  }
  // Non-enumerable binary evidence must not explode an exception's log output.
  Object.defineProperty(error, 'ownedSmokeCase', {value: {evidence, screenshot}});
}

export function smokeCaseFailures(error) {
  if (error instanceof AggregateError) return error.errors.flatMap(smokeCaseFailures);
  return error?.ownedSmokeCase ? [error.ownedSmokeCase] : [];
}
