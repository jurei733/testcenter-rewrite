import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {chromium} from 'playwright';
import {waitForFiniteDocumentAnimations} from './finite-animation-ready.mjs';
let browser;
before(async()=>{assert.equal(process.env.UI_SMOKE_HEADFUL,'true');browser=await chromium.launch({headless:false});});
after(async()=>{await browser?.close();});
const withPage=async run=>{
 const page=await browser.newPage();
 try{await page.bringToFront();await page.setContent('<!doctype html><div id="owned" style="width:20px;height:20px;background:red"></div>');await run(page);}
 finally{await page.close();}
};
const start=page=>page.evaluate(()=>{globalThis.ownedAnimation=document.querySelector('#owned').animate([
 {transform:'translateX(0)'},{transform:'translateX(40px)'}],{duration:60000,fill:'forwards'});});
const frames=page=>page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));

test('the previous actual Chromium finished-Promise barrier rejects a legitimate finite animation cancellation',async()=>{
 await withPage(async page=>{
  await start(page);
  const legacy=page.evaluate(()=>{
   globalThis.ownedLegacyCaptured=true;
   return Promise.all(document.getAnimations().filter(animation=>animation.effect?.getComputedTiming().iterations!==Infinity).map(animation=>animation.finished));
  });
  const rejected=assert.rejects(legacy,/AbortError/);
  await page.waitForFunction(()=>globalThis.ownedLegacyCaptured===true);
  await page.evaluate(()=>globalThis.ownedAnimation.cancel());
  await rejected;
  assert.equal(await page.evaluate(()=>globalThis.ownedAnimation.playState),'idle');
  await waitForFiniteDocumentAnimations(page);
 });
});
test('current readiness waits for a real running effect and observes its final native state',async()=>{
 await withPage(async page=>{
  await start(page);let completed=false;
  const ready=waitForFiniteDocumentAnimations(page).then(()=>{completed=true;});
  await frames(page);assert.equal(completed,false);
  await page.evaluate(()=>globalThis.ownedAnimation.finish());await ready;
  assert.equal(await page.evaluate(()=>globalThis.ownedAnimation.playState),'finished');
  assert.equal(await page.locator('#owned').evaluate(element=>getComputedStyle(element).transform),'matrix(1, 0, 0, 1, 40, 0)');
 });
});
test('canceling an obsolete effect does not skip a replacement effect still running on the document',async()=>{
 await withPage(async page=>{
  await start(page);let completed=false;
  const ready=waitForFiniteDocumentAnimations(page).then(()=>{completed=true;});
  await frames(page);assert.equal(completed,false);
  await page.evaluate(()=>{
   globalThis.ownedAnimation.cancel();
   globalThis.ownedAnimation=document.querySelector('#owned').animate([{opacity:0.2},{opacity:1}],{duration:60000,fill:'forwards'});
  });
  await frames(page);assert.equal(completed,false,'Cancellation is not sufficient while the replacement is active.');
  await page.evaluate(()=>globalThis.ownedAnimation.finish());await ready;
  assert.equal(await page.locator('#owned').evaluate(element=>getComputedStyle(element).opacity),'1');
 });
});
test('infinite decoration is retained while a real finite effect still gates readiness',async()=>{
 await withPage(async page=>{
  await page.evaluate(()=>{globalThis.ownedInfinite=document.body.animate([{opacity:0.8},{opacity:1}],{duration:500,iterations:Infinity});});
  await start(page);let completed=false;
  const ready=waitForFiniteDocumentAnimations(page).then(()=>{completed=true;});
  await frames(page);assert.equal(completed,false);
  await page.evaluate(()=>globalThis.ownedAnimation.finish());await ready;
  assert.equal(await page.evaluate(()=>globalThis.ownedInfinite.playState),'running','Readiness must not disable actual browser effects.');
 });
});
test('a paused unfinished finite effect fails at its real deadline without being canceled or ignored',async()=>{
 await withPage(async page=>{
  await start(page);await page.evaluate(()=>globalThis.ownedAnimation.pause());await frames(page);
  await assert.rejects(waitForFiniteDocumentAnimations(page,{timeout:150}),/Timeout/);
  assert.equal(await page.evaluate(()=>globalThis.ownedAnimation.playState),'paused');
 });
});
test('unexpected document animation inspection errors remain fatal',async()=>{
 await withPage(async page=>{
  await page.evaluate(()=>{document.getAnimations=()=>{throw Error('Owned animation inspection failure');};});
  await assert.rejects(waitForFiniteDocumentAnimations(page),/Owned animation inspection failure/);
 });
});
