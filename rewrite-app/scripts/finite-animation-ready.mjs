// A finished Promise belongs to one historical Animation. Material can cancel
// that animation while replacing its effect, which legitimately rejects that
// Promise with AbortError. Observe the document's current finite effects instead.
// A still-running or paused finite effect must continue to block readiness.
export async function waitForFiniteDocumentAnimations(page,{timeout=15000}={}){
 await page.waitForFunction(()=>document.getAnimations().every(animation=>
  animation.effect?.getComputedTiming().iterations===Infinity ||
  animation.playState==='finished' || animation.playState==='idle'),undefined,{timeout});
}
