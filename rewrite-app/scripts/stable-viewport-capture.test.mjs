import assert from 'node:assert/strict';
import {after, before, test} from 'node:test';
import {createServer} from 'node:http';
import {mkdtemp, mkdir, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {chromium} from 'playwright';
import {createHash} from 'node:crypto';
import {captureStableViewport} from './stable-viewport-capture.mjs';
import {repaintNativeViewport as legacyRepaintNativeViewport} from './fixtures/native-viewport-repaint-before-scrollbar-witness.mjs';
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
  evaluateHandle: (...args) => page.evaluateHandle(...args),
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
    for(let index=0;index<frames.length;index++) {
      const frame=await readFile(path+'.unstable.frame-'+String(index).padStart(2,'0')+'.png');
      assert.equal(createHash('sha256').update(frame).digest('hex'),frames[index]);
    }
    assert.equal((await compareScreenshots(page,first,last)).differingPixels,80*80);
    assert.deepEqual(packet.geometry,await measure());
    await assert.rejects(readFile(path), {code: 'ENOENT'});
  });
});
test('native paint invalidation clears explicitly visible descendants and restores authored root styles',async()=>{
  await withViewport(async(page,measure)=>{
    await page.evaluate(()=>{
      document.documentElement.setAttribute('style','visibility:visible!important;opacity:.9;--owned-root:retained');
      document.querySelector('canvas').style.visibility='visible';
    });
    const html=await page.content(),geometry=await measure(),before=await page.screenshot({fullPage:false});
    const result=await captureStableViewport(page,measure,join(artifacts,'explicitly-visible-descendant.png'));
    assert.equal(result.paintDiagnostics.nativeRepaint.hiddenFrame.nonWhitePixels,0,
      'An explicitly visible descendant cannot escape the native clearing frame.');
    assert.equal(result.paintDiagnostics.nativeRepaint.rootStyleRestored,true);
    assert.equal(await page.content(),html);assert.deepEqual(await measure(),geometry);
    assert.equal((await compareScreenshots(page,before,result.bytes)).differingPixels,0);
  });
});
test('every native clearing frame preserves real focus, selection and independent hover event history',async()=>{
  await withViewport(async(page,measure)=>{
    await page.evaluate(()=>{
      document.body.insertAdjacentHTML('beforeend','<a id="owned-link" href="#owned">Owned link</a><input id="owned-input" value="Owned selection"><button id="owned-hover"><span style="pointer-events:none">Owned hover</span></button>');
      window.ownedBlurCount=0;window.ownedPointerChanges=0;
      for(const element of document.querySelectorAll('a,input'))element.addEventListener('blur',()=>window.ownedBlurCount++);
      for(const type of ['mouseenter','mouseleave','mouseover','mouseout'])document.querySelector('#owned-hover').addEventListener(type,()=>window.ownedPointerChanges++);
    });
    await page.locator('#owned-hover').hover();
    const state=()=>page.evaluate(()=>({active:document.activeElement.id,blurCount:window.ownedBlurCount,
      hovered:document.querySelector('#owned-hover').matches(':hover'),pointerChanges:window.ownedPointerChanges,
      selection:[document.querySelector('input').selectionStart,document.querySelector('input').selectionEnd]}));
    for(const selector of ['#owned-link','#owned-input']) {
      await page.locator(selector).focus();
      if(selector==='#owned-input')await page.locator(selector).evaluate(input=>input.setSelectionRange(2,6));
      const before=await state();
      const capture=await captureStableViewport(page,async()=>({...await measure(),state:await state()}),
        join(artifacts,'focus-'+selector.slice(1)+'.png'));
      assert.deepEqual(await state(),before);
      assert.equal(capture.paintDiagnostics.nativeRepaints.length,capture.paintDiagnostics.pngFrameSha256.length);
      assert.ok(capture.paintDiagnostics.nativeRepaints.every(frame=>frame.hiddenFrame.nonWhitePixels===0&&frame.rootStyleRestored&&frame.focusedStyleRestored));
    }
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
  await page.evaluate(()=>{
   document.body.insertAdjacentHTML('beforeend','<input id="owned-failure-focus" style="visibility:visible;--owned-target:retained" value="Owned selection">');
   const input=document.querySelector('input');input.focus();input.setSelectionRange(2,6);
   window.ownedBlurCount=0;input.addEventListener('blur',()=>window.ownedBlurCount++);
  });
  const before=await page.content();
  const failing={evaluate:(...args)=>page.evaluate(...args),evaluateHandle:(...args)=>page.evaluateHandle(...args),screenshot:async()=>{throw Error('Owned diagnostic capture failure');}};
  await assert.rejects(captureSurfaceBackgroundDiagnostic(failing,measure,'body','transparent',join(artifacts,'failed-background')),/Owned diagnostic capture failure/);
  assert.equal(await page.content(),before);
  await assert.rejects(captureViewportRepaintDiagnostic(failing,measure,join(artifacts,'failed-repaint')),/Owned diagnostic capture failure/);
  assert.equal(await page.content(),before);
  await assert.rejects(captureStableViewport(failing,measure,join(artifacts,'failed-baseline.png')),/Owned diagnostic capture failure/);
  assert.equal(await page.content(),before);
  assert.deepEqual(await page.evaluate(()=>({active:document.activeElement.id,blurCount:window.ownedBlurCount,
   selection:[document.querySelector('input').selectionStart,document.querySelector('input').selectionEnd]})),
   {active:'owned-failure-focus',blurCount:0,selection:[2,6]});
 });
});

test('a layout change during the cleared frame cannot become the restored baseline',async()=>{
 await withViewport(async(page,measure)=>{
  const style=await page.evaluate(()=>document.documentElement.getAttribute('style'));
  let changed=false;
  const changing={evaluate:(...args)=>page.evaluate(...args),evaluateHandle:(...args)=>page.evaluateHandle(...args),screenshot:async options=>{
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


test('native Linux root scrollbars are cleared without hiding or resizing the restored viewport',
 {skip:process.platform==='linux'?false:'The native Linux scrollbar is part of the full viewport witness.'},async()=>{
  await withViewport(async(page,measure)=>{
    await page.addStyleTag({content:'html{position:fixed;width:100%;overflow-y:scroll}'});
    await page.evaluate(()=>document.documentElement.setAttribute('style','--owned-root-sentinel:1'));
    const scrollbar=await page.evaluate(()=>innerWidth-document.documentElement.clientWidth);
    assert.ok(scrollbar>0,'This countercase must contain a real native root scrollbar.');
    const geometry=await measure(),before=await page.screenshot({fullPage:false});
    await assert.rejects(legacyRepaintNativeViewport(page,measure,join(artifacts,'legacy-root-scrollbar.png')),
      /Native repaint must witness a fully cleared viewport/);
    const capture=await captureStableViewport(page,measure,join(artifacts,'root-scrollbar.png'));
    assert.equal(capture.paintDiagnostics.nativeRepaint.hiddenFrame.nonWhitePixels,0);
    assert.equal((await compareScreenshots(page,before,capture.bytes)).differingPixels,0);
    assert.deepEqual(await measure(),geometry);
    assert.equal(await page.evaluate(()=>innerWidth-document.documentElement.clientWidth),scrollbar);
    assert.equal(await page.evaluate(()=>document.documentElement.getAttribute('style')),'--owned-root-sentinel:1');
  });
 });
