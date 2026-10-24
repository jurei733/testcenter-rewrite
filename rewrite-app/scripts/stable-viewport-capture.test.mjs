import assert from 'node:assert/strict';
import {after, before, test} from 'node:test';
import {createServer} from 'node:http';
import {mkdtemp, mkdir, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {chromium} from 'playwright';
import {createHash} from 'node:crypto';
import {captureStableViewport} from './stable-viewport-capture.mjs';
import {compareScreenshots} from './exact-rgba-comparison.mjs';
import {captureViewportRepaintDiagnostic,captureSurfaceBackgroundDiagnostic} from './viewport-repaint-diagnostic.mjs';

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
    const visible=await page.evaluate(()=>getComputedStyle(document.documentElement).opacity!=="0");
    const bytes = await page.screenshot(options);
    if(visible)await afterImage(); return bytes;
  }
});

test('a paint change after the first real image settles independently of a reference', async () => {
  await withViewport(async (page, measure) => {
    let count = 0;
    const capture = await captureStableViewport(observe(page, async () => {
      if (++count === 1) await paint(page, 'red');
    }), measure, join(artifacts, 'settled.png'));
    assert.ok(count >= 4, 'The first visible image and two subsequent red images cannot qualify three equal frames.');
    assert.equal(capture.paintDiagnostics.nativeRepaint.hiddenFrame.nonWhitePixels,0);
    assert.equal(capture.paintDiagnostics.nativeRepaint.rootStyleRestored,true);
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
    const packet = JSON.parse(await readFile(path + '.unstable.json', 'utf8'));
    const frames = packet.pngFrameSha256;
    assert.equal(frames.length, 12);
    assert.ok(new Set(frames).size > 1);
    const first=await readFile(path+'.unstable.first.png'),last=await readFile(path+'.unstable.last.png');
    assert.equal(createHash('sha256').update(first).digest('hex'),frames[0]);
    assert.equal(createHash('sha256').update(last).digest('hex'),frames.at(-1));
    assert.equal((await compareScreenshots(page,first,last)).differingPixels,80*80);
    assert.deepEqual(packet.geometry,await measure());
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

test('an isolated full-viewport repaint restores native content and cannot waive one changed pixel',async()=>{
 await withViewport(async(page,measure)=>{
  const before=await page.screenshot({fullPage:false});
  const html=await page.content(),geometry=await measure();
  const restored=await captureViewportRepaintDiagnostic(page,measure,join(artifacts,'repaint-restored'));
  assert.equal(restored.hiddenFrame.nonWhitePixels,0);assert.equal(restored.rootStyleRestored,true);
  assert.equal((await compareScreenshots(page,before,restored.bytes)).differingPixels,0);
  assert.equal(await page.content(),html);assert.deepEqual(await measure(),geometry);
  await page.evaluate(()=>{const c=document.querySelector('canvas').getContext('2d');c.fillStyle='red';c.fillRect(12,15,1,1);});
  const backgrounds=await captureSurfaceBackgroundDiagnostic(page,measure,'body','transparent',join(artifacts,'background-changed'));
  assert.equal((await compareScreenshots(page,before,backgrounds.changed.bytes)).differingPixels,1);
  assert.equal((await compareScreenshots(page,before,backgrounds.restored.bytes)).differingPixels,1);
  const changed=await captureViewportRepaintDiagnostic(page,measure,join(artifacts,'repaint-changed'));
  const baseline=await captureStableViewport(page,measure,join(artifacts,'fresh-baseline-changed.png'));
  assert.equal((await compareScreenshots(page,before,baseline.bytes)).differingPixels,1);
  const comparison=await compareScreenshots(page,before,changed.bytes);assert.equal(comparison.differingPixels,1);
  assert.deepEqual(comparison.bounds,{left:12,top:15,right:13,bottom:16});
 });
});

test('failed diagnostic captures restore the original surface attribute before propagating the error',async()=>{
 await withViewport(async(page,measure)=>{
  const before=await page.content();
  const failing={evaluate:(...args)=>page.evaluate(...args),screenshot:async()=>{throw Error('Owned diagnostic capture failure');}};
  await assert.rejects(captureSurfaceBackgroundDiagnostic(failing,measure,'body','transparent',join(artifacts,'failed-background')),/Owned diagnostic capture failure/);
  assert.equal(await page.content(),before);
  await assert.rejects(captureViewportRepaintDiagnostic(failing,measure,join(artifacts,'failed-repaint')),/Owned diagnostic capture failure/);
  assert.equal(await page.content(),before);
  await assert.rejects(captureStableViewport(failing,measure,join(artifacts,'failed-baseline.png')),/Owned diagnostic capture failure/);
  assert.equal(await page.content(),before);
 });
});

test('a layout change during the cleared frame cannot become the restored baseline',async()=>{
 await withViewport(async(page,measure)=>{
  const style=await page.evaluate(()=>document.documentElement.getAttribute('style'));
  let changed=false;
  const changing={evaluate:(...args)=>page.evaluate(...args),screenshot:async options=>{
    const bytes=await page.screenshot(options);
    if(!changed&&await page.evaluate(()=>getComputedStyle(document.documentElement).opacity==='0')){
      changed=true;await page.evaluate(()=>document.querySelector('canvas').style.width='90px');
    }
    return bytes;
  }};
  const path=join(artifacts,'cleared-layout-change.png');
  await assert.rejects(captureStableViewport(changing,measure,path),/Native repaint must preserve the actual viewport/);
  assert.equal(changed,true);assert.equal(await page.evaluate(()=>document.documentElement.getAttribute('style')),style);
  await assert.rejects(readFile(path),{code:'ENOENT'});
 });
});
