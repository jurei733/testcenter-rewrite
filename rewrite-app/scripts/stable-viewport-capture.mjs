import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {repaintNativeViewport} from './native-viewport-repaint.mjs';

/** Fresh native paint and steady frames; no expected image is available here. */
export async function captureStableViewport(page,measure,path){
  const refresh=await repaintNativeViewport(page,measure,path+'.cleared.png');
  const capture=await sampleStableViewport(page,measure,path,refresh.geometry);
  return{...capture,paintDiagnostics:{...capture.paintDiagnostics,nativeRepaint:{
    hiddenFrame:refresh.hiddenFrame,rootStyleRestored:refresh.rootStyleRestored,clearedPngSha256:refresh.clearedPngSha256}}};
}

/** Sampling only for separately labelled diagnostics after their own preparation. */
export async function sampleStableViewport(page, measure, path, expectedGeometry) {
  const geometry = expectedGeometry??await measure(), frames = [];
  assert.deepEqual(await measure(),geometry,'Taking an image must preserve the actual viewport and navigation layout.');
  let previous, first, equalFrames = 0;
  for (let attempt = 0; attempt < 12; attempt++) {
    await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    const bytes = await page.screenshot({fullPage: false});
    first ??= bytes;
    assert.deepEqual(await measure(), geometry,
      'Taking an image must preserve the actual viewport and navigation layout.');
    frames.push(createHash('sha256').update(bytes).digest('hex'));
    equalFrames = previous?.equals(bytes) ? equalFrames + 1 : 0;
    if (equalFrames === 2) {
      await writeFile(path, bytes);
      if (!first.equals(bytes)) await writeFile(path + '.first.png', first);
      return {geometry, bytes, paintDiagnostics: {pngFrameSha256: frames}};
    }
    previous = bytes;
  }
  const failure = Error('Viewport pixels must stabilize in three consecutive complete captures.');
  // Preserve actual sampled pixels only as diagnostics, never as a baseline.
  // Writing evidence must not replace the original stability failure.
  const diagnostics = await Promise.allSettled([
    writeFile(path + '.unstable.json', JSON.stringify({geometry, pngFrameSha256:frames}, null, 2)),
    writeFile(path + '.unstable.first.png', first),
    writeFile(path + '.unstable.last.png', previous)
  ]);
  const errors = diagnostics.filter(result=>result.status==='rejected').map(result=>result.reason);
  if (errors.length) failure.cause = new AggregateError(errors, 'Could not retain all unstable viewport diagnostics.');
  throw failure;
}
