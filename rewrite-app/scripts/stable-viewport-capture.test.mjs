import assert from 'node:assert/strict';
import {after, before, test} from 'node:test';
import {createServer} from 'node:http';
import {mkdtemp, mkdir, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {chromium} from 'playwright';
import {captureStableViewport} from './stable-viewport-capture.mjs';
import {compareScreenshots} from './exact-rgba-comparison.mjs';

const scratch = await mkdtemp(join(tmpdir(), 'owned-viewport-control-'));
const artifacts = process.env.UI_SMOKE_ARTIFACT_DIR
  ? resolve(process.env.UI_SMOKE_ARTIFACT_DIR, 'capture-controls') : scratch;
const server = createServer((request, response) => {
  response.setHeader('content-type', 'text/html');
  response.end('<!doctype html><style>body{margin:0;background:white}</style>' +
    '<canvas width="80" height="80"></canvas><script>' +
    'document.querySelector("canvas").getContext("2d").fillRect(0,0,80,80);</script>');
});
let browser, base;
before(async () => {
  assert.equal(process.env.UI_SMOKE_HEADFUL, 'true');
  await mkdir(artifacts, {recursive: true});
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  base = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({headless: false});
});
after(async () => {
  await browser?.close();
  await new Promise(done => server.close(done));
});
async function withViewport(run) {
  const context = await browser.newContext({viewport: {width: 390, height: 200}, deviceScaleFactor: 1});
  try {
    const page = await context.newPage(); await page.bringToFront();
    await page.goto(base, {waitUntil: 'load'});
    const measure = () => page.evaluate(() => ({width: innerWidth, height: innerHeight,
      canvas: document.querySelector('canvas').getBoundingClientRect().toJSON()}));
    await run(page, measure);
  } finally { await context.close(); }
}
const paint = (page, color) => page.evaluate(color => {
  const context = document.querySelector('canvas').getContext('2d');
  context.fillStyle = color; context.fillRect(0, 0, 80, 80);
}, color);
const observe = (page, afterImage) => ({
  evaluate: (...args) => page.evaluate(...args),
  screenshot: async options => {
    const bytes = await page.screenshot(options);
    await afterImage(); return bytes;
  }
});

test('a paint change after the first real image settles independently of a reference', async () => {
  await withViewport(async (page, measure) => {
    let count = 0;
    const capture = await captureStableViewport(observe(page, async () => {
      if (++count === 1) await paint(page, 'red');
    }), measure, join(artifacts, 'settled.png'));
    assert.ok(count >= 4, 'The first image and two subsequent red images cannot qualify three equal frames.');
    const hashes = capture.paintDiagnostics.pngFrameSha256;
    assert.notEqual(hashes[0], hashes.at(-1));
    assert.equal(new Set(hashes.slice(-3)).size, 1);
    assert.equal((await compareScreenshots(page, capture.bytes, await page.screenshot({fullPage: false}))).differingPixels, 0);
    assert.ok((await readFile(join(artifacts, 'settled.png.first.png'))).length);
  });
});
test('perpetually changing real pixels cannot qualify a viewport', async () => {
  await withViewport(async (page, measure) => {
    let count = 0;
    const path = join(artifacts, 'never-steady.png');
    await assert.rejects(captureStableViewport(observe(page, async () => {
      await paint(page, ++count % 2 ? 'red' : 'blue');
    }), measure, path), /must stabilize/);
    assert.equal(count, 12);
    const frames = JSON.parse(await readFile(path + '.unstable.json', 'utf8')).pngFrameSha256;
    assert.equal(frames.length, 12);
    assert.ok(new Set(frames).size > 1);
    await assert.rejects(readFile(path), {code: 'ENOENT'});
  });
});
test('capture-side layout changes remain fatal instead of becoming a new baseline', async () => {
  await withViewport(async (page, measure) => {
    await assert.rejects(captureStableViewport(observe(page, () => page.evaluate(() => {
      document.querySelector('canvas').style.width = '90px';
    })), measure, join(artifacts, 'resized.png')), /must preserve the actual viewport/);
  });
});
