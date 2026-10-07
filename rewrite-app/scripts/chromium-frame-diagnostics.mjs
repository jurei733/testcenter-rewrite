// Read-only diagnostics for cross-process frames that the automation's frame
// inventory may not contain. Never substitute these observations for UI tests.
export const redactBrowserDiagnostic = value => String(value)
  .replace(/\/\.access\/[^/?\s"\\]+/gu, "/.access/[redacted]")
  .replace(/([?&](?:password|token|sessionToken|accessToken|authorization)=)[^&#\s"\\]*/giu, "$1[redacted]")
  .replace(/Bearer\s+[A-Za-z0-9_-]+/giu, "Bearer [redacted]");

const inspectDocument = `JSON.stringify({
  url: location.href, origin: globalThis.origin, title: document.title,
  ready: document.readyState, visibility: document.visibilityState,
  runtimeAdapter: !!document.querySelector('script[data-testcenter-compatibility="dipf-opaque-parent-origin"]'),
  controls: Array.from(document.querySelectorAll('input,button,iframe')).map(element => ({
    tag: element.tagName, type: element.getAttribute('type'),
    rect: element.getBoundingClientRect().toJSON(),
    display: getComputedStyle(element).display,
    visibility: getComputedStyle(element).visibility
  }))
})`;

export async function captureChromiumFrameDiagnostics(context, page, emit, timeoutMs = 3_000) {
  for (const frame of page.frames()) {
    let session;
    let timer;
    let expired = false;
    try {
      const inspect = async () => {
        session = await context.newCDPSession(frame);
        if (expired) { await session.detach(); return; }
        const contexts = [];
        session.on("Runtime.executionContextCreated", event => contexts.push(event.context));
        const tree = await session.send("Page.getFrameTree");
        if (expired) return;
        emit(redactBrowserDiagnostic(`ib_native_frame_tree=${JSON.stringify(tree)}`));
        await session.send("Runtime.enable");
        if (expired) return;
        for (const execution of contexts.filter(candidate => candidate.auxData?.isDefault)) {
          const result = await session.send("Runtime.evaluate", {
            contextId: execution.id, returnByValue: true, expression: inspectDocument
          });
          if (expired) return;
          emit(redactBrowserDiagnostic(`ib_native_document=${JSON.stringify({
            frameId: execution.auxData.frameId, ...result
          })}`));
        }
      };
      await Promise.race([
        inspect(),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            expired = true;
            reject(new Error("Native frame diagnostics timed out."));
          }, timeoutMs);
        })
      ]);
    } catch (error) {
      emit(redactBrowserDiagnostic(`ib_native_diagnostics_unavailable=${String(error)}`));
    } finally {
      clearTimeout(timer);
      await session?.detach().catch(() => undefined);
    }
  }
}
