import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';

/** Observe a steady native viewport, independently of any expected image. */
export async function captureStableViewport(page, measure, path) {
  const geometry = await measure(), frames = [];
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
  await writeFile(path + '.unstable.json', JSON.stringify({pngFrameSha256: frames}, null, 2));
  throw Error('Viewport pixels must stabilize in three consecutive complete captures.');
}
