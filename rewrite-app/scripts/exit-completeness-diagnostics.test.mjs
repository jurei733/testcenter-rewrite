import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import test from 'node:test';
import {chromium} from 'playwright';
import {createExitCompletenessDiagnostics} from './exit-completeness-diagnostics.mjs';

for(const replace of [false,true])test(`owned completeness observer ${replace?'distinguishes replacement during a native pointer action':'retains a real native click'} and keeps private values out of JSON receipts`,async()=>{
  const directory=await mkdtemp(join(tmpdir(),'owned-completeness-diagnostic-'));
  const browser=await chromium.launch({headless:process.env.UI_SMOKE_HEADFUL!=='true'});
  try {
    const page=await browser.newPage();
    const trace=createExitCompletenessDiagnostics({page,key:'owned-case',artifactRoot:directory});await trace.install();
    const html=`<!doctype html><button id="participantApplicationLogoButton">Owned logo</button><input value="OWNED_PRIVATE_INPUT_SENTINEL"><script>
      localStorage.setItem('owned-private','OWNED_PRIVATE_STORAGE_SENTINEL');
      window.ownedClicks=0;document.querySelector('button').onclick=()=>{window.ownedClicks++;document.body.insertAdjacentHTML('beforeend','<mat-dialog-container class="mdc-dialog--open"><button id="participantConfirmationContinueButton">Continue</button></mat-dialog-container>');};
      ${replace?"document.querySelector('button').addEventListener('pointerdown',event=>{const replacement=event.currentTarget.cloneNode(true);event.currentTarget.replaceWith(replacement);});":''}
      </script>`;
    await page.route('https://owned.invalid/**',route=>route.fulfill({contentType:'text/html',body:html}));
    trace.mark('navigation');await page.goto('https://owned.invalid/?token=OWNED_PRIVATE_QUERY_SENTINEL');
    trace.mark('complete-logo');await page.locator('#participantApplicationLogoButton').click();
    assert.equal(await page.evaluate(()=>window.ownedClicks),replace?0:1);
    trace.mark('complete-dialog');
    await trace.capture(Object.assign(Error('OWNED_PRIVATE_ERROR_SENTINEL'),{name:'TimeoutError'}));
    const root=join(directory,'exit-completeness'),bytes=await readFile(join(root,'owned-case.json'),'utf8'),snapshot=JSON.parse(bytes);
    assert.equal(snapshot.phase,'complete-dialog');assert.equal(snapshot.error,'TimeoutError');
    assert.ok(snapshot.document.events.some(row=>row.type==='pointerdown'&&row.target==='logo'&&row.trusted));
    const clicks=snapshot.document.events.filter(row=>row.type==='click'&&row.target==='logo');
    assert.equal(clicks.length,replace?0:1);
    assert.equal(snapshot.document.dialogs.length,replace?0:1);
    assert.equal(snapshot.document.logo.connected,true);
    for(const value of ['OWNED_PRIVATE_INPUT_SENTINEL','OWNED_PRIVATE_STORAGE_SENTINEL','OWNED_PRIVATE_QUERY_SENTINEL','OWNED_PRIVATE_ERROR_SENTINEL'])assert.equal(bytes.includes(value),false);
    assert.deepEqual((await readdir(root)).sort(),['owned-case.json','owned-case.png']);
    assert.deepEqual((await readFile(join(root,'owned-case.png'))).subarray(0,8),Buffer.from([137,80,78,71,13,10,26,10]));
  } finally {await browser.close();await rm(directory,{recursive:true,force:true});}
});
