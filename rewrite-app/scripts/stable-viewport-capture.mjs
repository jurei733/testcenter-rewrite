import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {repaintNativeViewport} from './native-viewport-repaint.mjs';

/** Fresh native paint for every steady frame; no expected image is available here. */
export async function captureStableViewport(page,measure,path){
  const nativeRepaints=[];
  const capture=await sampleStableViewport(page,measure,path,undefined,async attempt=>{
    // Each screenshot can otherwise reuse a different old fractional-edge
    // raster. Qualify consecutive independently repainted frames, never pick
    // a frame by its resemblance to an expected image.
    const refresh=await repaintNativeViewport(page,measure,path+'.cleared'+(attempt?'.'+attempt:'')+'.png');
    nativeRepaints.push({hiddenFrame:refresh.hiddenFrame,rootStyleRestored:refresh.rootStyleRestored,focusedStyleRestored:refresh.focusedStyleRestored,
      clearedPngSha256:refresh.clearedPngSha256});
  });
  return{...capture,paintDiagnostics:{...capture.paintDiagnostics,nativeRepaint:nativeRepaints[0],nativeRepaints}};
}

/** Sampling only for separately labelled diagnostics after their own preparation. */
export async function sampleStableViewport(page, measure, path, expectedGeometry, prepareFrame) {
  const geometry = expectedGeometry??await measure(), frames = [], sampledFrames=[];
  assert.deepEqual(await measure(),geometry,'Taking an image must preserve the actual viewport and navigation layout.');
  let previous, first, equalFrames = 0;
  for (let attempt = 0; attempt < 12; attempt++) {
    await prepareFrame?.(attempt);
    assert.deepEqual(await measure(),geometry,'Preparing each frame must preserve the actual viewport and navigation layout.');
    await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    const bytes = await page.screenshot({fullPage: false});
    sampledFrames.push(bytes);
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
    writeFile(path + '.unstable.last.png', previous),
    ...sampledFrames.map((bytes,index)=>writeFile(path+'.unstable.frame-'+String(index).padStart(2,'0')+'.png',bytes))
  ]);
  const errors = diagnostics.filter(result=>result.status==='rejected').map(result=>result.reason);
  if (errors.length) failure.cause = new AggregateError(errors, 'Could not retain all unstable viewport diagnostics.');
  throw failure;
}
