import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {chromium} from 'playwright';
import {waitForFiniteDocumentAnimations} from './finite-animation-ready.mjs';
import {waitForMaterialDialog} from './material-dialog-ready.mjs';
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

const materialOpeningClassesAfterLatePaint=async()=>{
 // Execute the installed Material scheduler and cleanup methods. Its real timer
 // can complete while an animation frame is delayed; no product DOM is changed.
 await import('@angular/compiler');
 const {MatDialogContainer}=await import('@angular/material/dialog');
 const prototype=MatDialogContainer.prototype,classes=new Set(),events=[];
 let paint,opened;
 const finished=new Promise(resolve=>opened=resolve),dialog=Object.create(prototype);
 Object.assign(dialog,{_animationsEnabled:true,_enterAnimationDuration:1,_animationTimer:null,
  _hostElement:{style:{setProperty(){}},classList:{add:(...names)=>names.forEach(name=>classes.add(name)),remove:(...names)=>names.forEach(name=>classes.delete(name))}},
  _animationStateChanged:{emit:event=>events.push(event.state)},_requestAnimationFrame:callback=>{paint=callback;},
  _finishDialogOpen:()=>{prototype._clearAnimationClasses.call(dialog);events.push('opened');opened();}});
 prototype._startOpenAnimation.call(dialog);await finished;
 assert.equal(classes.size,0);paint();
 assert.deepEqual(events,['opening','opened']);
 assert.deepEqual([...classes],['mdc-dialog--opening','mdc-dialog--open']);
 return [...classes].join(' ');
};
const dialogFixture=async(page,classes)=>{
 await page.setContent(`<!doctype html><style>mat-dialog-container{display:block;width:200px;height:100px;background:white}</style><button id="outside">Outside</button><mat-dialog-container class="${classes}"><button id="inside">Close</button></mat-dialog-container>`);
 await page.evaluate(()=>{
  globalThis.dialogClicks=[];
  document.querySelector('#inside').addEventListener('click',event=>globalThis.dialogClicks.push({trusted:event.isTrusted}));
 });
};
test('an actual late Material paint leaves opening set, but readiness observes natural animation completion, focus and trusted input',async()=>{
 const classes=await materialOpeningClassesAfterLatePaint();
 await withPage(async page=>{
  page.setDefaultTimeout(1500);await dialogFixture(page,classes);
  await page.locator('#inside').click();
  await page.evaluate(()=>{
   globalThis.dialogEffect=document.querySelector('mat-dialog-container').animate([{opacity:0.2},{opacity:1}],{duration:250,fill:'forwards'});
  });
  await waitForMaterialDialog(page);
  assert.equal(await page.evaluate(()=>globalThis.dialogEffect.playState),'finished');
  assert.equal(await page.evaluate(()=>globalThis.dialogEffect.effect.getTiming().duration),250);
  assert.equal(await page.locator('mat-dialog-container').getAttribute('class'),classes,'Readiness does not edit Material classes.');
  assert.equal(await page.locator('#inside').evaluate(element=>element===document.activeElement),true);
  assert.deepEqual(await page.evaluate(()=>globalThis.dialogClicks),[{trusted:true}]);
 });
});
test('a dialog without its open state or visible layout remains unready at the inherited deadline',async()=>{
 await withPage(async page=>{
  page.setDefaultTimeout(150);await dialogFixture(page,'mdc-dialog--opening');await page.locator('#inside').click();
  await assert.rejects(waitForMaterialDialog(page),{name:'TimeoutError'});
  await page.evaluate(()=>{const dialog=document.querySelector('mat-dialog-container');dialog.classList.add('mdc-dialog--open');dialog.style.visibility='hidden';});
  await assert.rejects(waitForMaterialDialog(page),{name:'TimeoutError'});
 });
});
test('readiness does not force focus into an otherwise open dialog',async()=>{
 await withPage(async page=>{
  page.setDefaultTimeout(150);await dialogFixture(page,'mdc-dialog--open');await page.locator('#outside').click();
  await assert.rejects(waitForMaterialDialog(page),{name:'TimeoutError'});
  assert.equal(await page.locator('#outside').evaluate(element=>element===document.activeElement),true);
 });
});
test('a paused finite dialog effect still fails without being finished or canceled',async()=>{
 await withPage(async page=>{
  page.setDefaultTimeout(150);await dialogFixture(page,'mdc-dialog--open');await page.locator('#inside').click();
  await page.evaluate(()=>{globalThis.dialogEffect=document.querySelector('mat-dialog-container').animate([{opacity:0.2},{opacity:1}],{duration:60000});globalThis.dialogEffect.pause();});
  await assert.rejects(waitForMaterialDialog(page),{name:'TimeoutError'});
  assert.equal(await page.evaluate(()=>globalThis.dialogEffect.playState),'paused');
 });
});
test('replacement dialog effects are observed after a legitimate cancellation',async()=>{
 await withPage(async page=>{
  page.setDefaultTimeout(1500);await dialogFixture(page,'mdc-dialog--open');await page.locator('#inside').click();
  await page.evaluate(()=>{globalThis.dialogEffect=document.querySelector('mat-dialog-container').animate([{opacity:0.2},{opacity:1}],{duration:60000});});
  let completed=false;const ready=waitForMaterialDialog(page).then(()=>{completed=true;});
  await frames(page);assert.equal(completed,false);
  await page.evaluate(()=>{globalThis.dialogEffect.cancel();globalThis.dialogEffect=document.querySelector('mat-dialog-container').animate([{opacity:0.4},{opacity:1}],{duration:250,fill:'forwards'});});
  await ready;assert.equal(await page.evaluate(()=>globalThis.dialogEffect.playState),'finished');
 });
});
