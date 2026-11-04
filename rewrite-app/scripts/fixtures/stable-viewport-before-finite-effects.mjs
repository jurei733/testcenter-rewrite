import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';

// Exact sampler before the post-repaint finite-effect barrier.
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
