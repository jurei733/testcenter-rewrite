import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {chromium} from 'playwright';
import {waitForStarterScrollReadiness} from './starter-scroll-ready.mjs';
let browser;
before(async()=>{assert.equal(process.env.UI_SMOKE_HEADFUL,'true');browser=await chromium.launch({headless:false});});
after(async()=>{await browser?.close();});
const fixture=async run=>{
 const page=await browser.newPage({viewport:{width:400,height:300}});
 try{await page.bringToFront();await page.setContent('<!doctype html><style>body{margin:0}.sentinel{position:absolute;top:1000px;width:10px;height:1px}</style><div id="owned"><div class="sentinel"></div></div>');await run(page);}
 finally{await page.close();}
};
test('an actual late layout makes the old one-shot predicate stale while current intersection and UI agree',async()=>{
 await fixture(async page=>{
  const previous=await page.locator('.sentinel').evaluate(element=>new Promise(done=>{
   const observer=new IntersectionObserver(([entry])=>{observer.disconnect();done(entry.isIntersecting);});observer.observe(element);
  }));
  assert.equal(previous,false);
  await page.evaluate(()=>{document.querySelector('.sentinel').style.top='20px';});
  await assert.rejects(page.waitForFunction(visible=>!!document.querySelector('#owned .scroll-button')===visible,!previous,{timeout:150}),{name:'TimeoutError'});
  const ready=await waitForStarterScrollReadiness(page,'#owned');
  assert.equal(ready.sentinelIntersecting,true);assert.equal(ready.buttonPresent,false);
  assert.deepEqual(ready.viewport,[400,300]);assert.equal(ready.box.top,20);
 });
});
test('a persistently inconsistent actual scroll button still fails and retains bounded observation evidence',async()=>{
 await fixture(async page=>{
  await page.evaluate(()=>{document.querySelector('.sentinel').style.top='20px';const button=document.createElement('button');button.className='scroll-button';document.querySelector('#owned').append(button);});
  await assert.rejects(waitForStarterScrollReadiness(page,'#owned',{timeout:200}),error=>{
   assert.equal(error.name,'TimeoutError');assert.ok(error.starterScrollEvidence.observation.samples>0);
   assert.equal(error.starterScrollEvidence.observation.last.sentinelIntersecting,true);
   assert.equal(error.starterScrollEvidence.current.buttonPresent,true);
   assert.deepEqual(error.starterScrollEvidence.current.viewport,[400,300]);return true;
  });
  assert.equal(await page.locator('#owned .scroll-button').count(),1);
 });
});
