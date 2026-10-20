import assert from 'node:assert/strict';
import test from 'node:test';
import {compareExactRgba} from './exact-rgba-comparison.mjs';
const fixture = () => ({width: 2, height: 2, data: Buffer.from([
  0, 0, 0, 255, 20, 30, 40, 255,
  0, 0, 0, 255, 20, 30, 40, 255
])});
test('exact whole-viewport comparison accepts identical decoded pixels', async () => {
  const result = await compareExactRgba({source: fixture(), candidate: fixture()});
  assert.equal(result.differingPixels, 0); assert.equal(result.bounds, null);
  assert.equal(result.sourcePixelSha256, result.rewritePixelSha256);
});
test('a changed pixel fails even when its RGB difference is only one', async () => {
  const candidate = fixture(); candidate.data[4]++;
  const result = await compareExactRgba({source: fixture(), candidate});
  assert.equal(result.differingPixels, 1); assert.deepEqual(result.bounds, {left: 1, top: 0, right: 2, bottom: 1});
  assert.notEqual(result.sourcePixelSha256, result.rewritePixelSha256);
});
test('alpha and multiple changed channels count every affected pixel once', async () => {
  const candidate = fixture(); candidate.data[3]--; candidate.data[12]++; candidate.data[13]++;
  const result = await compareExactRgba({source: fixture(), candidate});
  assert.equal(result.differingPixels, 2); assert.deepEqual(result.bounds, {left: 0, top: 0, right: 2, bottom: 2});
});
test('empty, truncated and differently sized viewports cannot report an identical page', async () => {
  for (const candidate of [{width: 0, height: 0, data: []}, {...fixture(), data: []}, {...fixture(), width: 1, height: 4}]) {
    await assert.rejects(compareExactRgba({source: fixture(), candidate}));
  }
});
