import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, relative, extname, join } from 'node:path';
import { chromium } from 'playwright';

// Read-only current Source frontend. Every API value is an owned UI fixture;
// this does not establish Source backend behavior or authentication.
assert.ok(process.env.ORIGINAL_STARTER_REFERENCE_ROOT);
assert.ok(process.env.UI_SMOKE_ARTIFACT_DIR);
const root = resolve(process.env.ORIGINAL_STARTER_REFERENCE_ROOT);
const artifacts = resolve(process.env.UI_SMOKE_ARTIFACT_DIR);
await mkdir(artifacts, {recursive: true});
const labels = ['Alpha Booklet', 'Beta Booklet', 'Gamma Booklet'];
const longLabels = [
  'Eine längere Bezeichnung mit mehreren Worten, die die verfügbare Breite der Original-Karte überschreitet und vollständig umbricht.',
  `UntrennbaresTestheft${'a'.repeat(140)}`, labels[2]
];
const actionTexts = {
  booklet_starterStartTestButtonLabel: 'Los geht’s',
  booklet_starterContinueTestButtonLabel: 'Jetzt fortsetzen',
  booklet_starterLockedTestButtonLabel: 'Teil abgeschlossen'
};
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    const file = resolve(root, extname(path) ? '.' + path : 'index.html');
    if (relative(root, file).startsWith('..')) { res.writeHead(404).end(); return; }
    const bytes = await readFile(file);
    res.setHeader('content-type', ({'.html':'text/html', '.js':'text/javascript',
      '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png',
      '.woff2':'font/woff2'})[extname(file)] || 'application/octet-stream');
    res.end(bytes);
  } catch { res.writeHead(404).end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
let browser, activePage;
const metrics = {}, toastMetrics = {}, errors = [], unknown = [];
try {
  browser = await chromium.launch();
  for (const theme of ['Primar', 'Sekundar', 'Erwachsene']) {
    for (const state of ['fresh', 'mixed', 'long', 'review']) {
      for (const [screen, width, height] of [['desktop',1280,720],['mobile',390,844]]) {
        const context = await browser.newContext({viewport:{width,height},locale:'de-DE'});
        const page = await context.newPage(); activePage = page;
        page.on('pageerror', error => errors.push(String(error)));
        const names = state === 'long' ? longLabels : labels;
        const auth = { token:'owned-source-starter', displayName:'Starter Person',
          loginName:'starter-smoke', groupLabel:'Reference', flags:[],
          customTexts:state === 'mixed' ? actionTexts : {},
          viewSettings:{theme}, claims:{test:names.map((label,index) => ({
            id:`reference-${index}`, label, workspaceId:'1', description:'', type:'test',
            flags:state === 'mixed' ? {running:index===0,locked:index===1} : {}
          })), ...(state === 'review' ? {review:[]} : {})} };
        await page.route(`${base}/api/**`, async route => {
          const req = route.request(), path = new URL(req.url()).pathname;
          let body;
          if (path === '/api/system/config') body = {version:'19.0.0',customTexts:{},
            appConfig:{themeName:theme},veronaPlayerApiVersionMin:2,veronaPlayerApiVersionMax:6,
            iqbStandardResponseTypeMin:1,iqbStandardResponseTypeMax:5,xmlSchemaVersions:{},
            bruteForceProtection:[],broadcastingServiceUri:'',fileServiceUri:'',
            passwordMinLength:0,passwordPattern:''};
          else if (path === '/api/sys-check-mode') body = false;
          else if (path === '/api/session/login' || path === '/api/session') body = auth;
          else if (path === '/api/asset-assignments') body = {};
          else if (path === '/api/assets') body = [];
          else if (path === '/api/reviews/export' && req.method() === 'GET') {
            assert.equal(req.headers().accept, 'text/csv');
            return route.fulfill({status:204,body:''});
          }
          else { unknown.push({state,theme,width,path,method:req.method()});
            return route.fulfill({status:404,contentType:'application/json',body:'{}'}); }
          await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
        });
        await page.goto(base + '/r/login');
        await page.locator('input').first().fill('starter-smoke');
        await page.getByRole('button',{name:'Weiter',exact:true}).click();
        const starter = page.locator('tc-starter');
        await starter.locator('mat-card').nth(2).waitFor();
        assert.deepEqual(await starter.locator('mat-card-header p').allTextContents(), names);
        assert.deepEqual(await starter.locator('mat-card button').allTextContents().then(
          texts => texts.map(value => value.trim())), state === 'mixed'
          ? ['Jetzt fortsetzen','Teil abgeschlossen','Los geht’s'] : ['Starten','Starten','Starten']);
        assert.deepEqual(await starter.locator('mat-card button').evaluateAll(
          buttons => buttons.map(button => button.disabled)), state === 'mixed' ? [false,true,false] : [false,false,false]);
        assert.equal(await starter.locator('[data-cy="review-download"]').count(), state === 'review' ? 1 : 0);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForFunction(() => [...document.querySelectorAll('img')]
          .every(img => img.complete && img.naturalWidth > 0));
        await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
        const id = `${theme}-${state}-${screen}`;
        metrics[id] = await starter.evaluate(element => {
          const rect = node => { const r=node.getBoundingClientRect();
            return {x:r.x,y:r.y,width:r.width,height:r.height}; };
          const intro = element.querySelector('.intro');
          return {root:rect(element),intro:rect(intro),introGap:getComputedStyle(intro).gap,
            companion:rect(intro.querySelector('.companion-image')),
            introParagraphs:[...intro.querySelectorAll('p')].map(p=>({
              ...rect(p),lineHeight:getComputedStyle(p).lineHeight,
              margins:[getComputedStyle(p).marginTop,getComputedStyle(p).marginBottom]})),
            cardContainer:rect(element.querySelector('.cards')),
            cardGap:getComputedStyle(element.querySelector('.cards')).gap,
            cards:[...element.querySelectorAll('mat-card')].map(card=>{
              const button=card.querySelector('button'),style=getComputedStyle(card);
              return {...rect(card),paragraph:rect(card.querySelector('mat-card-header p')),
                paragraphLineHeight:getComputedStyle(card.querySelector('p')).lineHeight,
                actions:rect(card.querySelector('mat-card-actions')),label:button.innerText.trim(),
                disabled:button.disabled,buttonOpacity:getComputedStyle(button).opacity,
                icon:rect(card.querySelector('.mat-icon')),iconOverflow:getComputedStyle(card.querySelector('.mat-icon')).overflow,
                border:style.borderTopWidth,borderStyle:style.borderTopStyle,
                borderColor:style.borderTopColor,radius:style.borderRadius,
                padding:[style.paddingTop,style.paddingRight,style.paddingBottom,style.paddingLeft],gap:style.gap};
            })};
        });
        await page.screenshot({path:join(artifacts,id+'.png')});
        if (state === 'review') {
          const download = starter.locator('[data-cy="review-download"]');
          const toast = page.locator('[data-cy="toast-container"] .toast');
          const captureToast = async phase => {
            await page.evaluate(() => document.fonts.ready);
            toastMetrics[`${id}-${phase}`] = await page.locator('[data-cy="toast-container"]').evaluate(stack => {
              const rect = node => {const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};
              const style = node => {const s=getComputedStyle(node);return {font:s.font,color:s.color,
                background:s.backgroundColor,padding:s.padding,gap:s.gap,border:s.border,radius:s.borderRadius,
                cursor:s.cursor,transform:s.transform,boxSizing:s.boxSizing}};
              return {box:rect(stack),style:style(stack),items:[...stack.querySelectorAll('.toast')].map(item => ({
                box:rect(item),style:style(item),text:{value:item.querySelector('.toast-text').textContent.trim(),
                  box:rect(item.querySelector('.toast-text')),style:style(item.querySelector('.toast-text'))},
                action:{value:item.querySelector('button').textContent.trim(),box:rect(item.querySelector('button')),
                  style:style(item.querySelector('button'))}}))};
            });
            await page.screenshot({path:join(artifacts,`${id}-toast-${phase}.png`)});
          };
          await download.click();
          await toast.filter({hasText:'Keine Kommentare verfügbar.'}).waitFor();
          assert.equal(await toast.count(),1);
          await captureToast('single');
          assert.equal(await download.evaluate(button=>button===document.activeElement),true);
          await page.keyboard.press('Enter');
          await toast.nth(1).waitFor();
          await captureToast('stacked');
          await page.locator('[data-cy="toast-action-0"]').click();
          await page.waitForFunction(()=>document.querySelectorAll('[data-cy="toast-container"] .toast').length===1);
          await captureToast('dismissed-first');
          await toast.waitFor({state:'detached'});
        }
        await writeFile(join(artifacts,'metrics.json'),JSON.stringify({metrics,toastMetrics,errors,unknown},null,2));
        await context.close(); console.log(`source_starter=${id}:rendered`);
      }
    }
  }
  assert.deepEqual(errors,[]); assert.deepEqual(unknown,[]);
  console.log(JSON.stringify({result:'rendered',states:Object.keys(metrics).length,
    scope:'Unmodified current Source frontend with owned claims; not backend, persistence or full pixel identity'}));
} catch (error) {
  if (activePage && !activePage.isClosed()) await activePage.screenshot({path:join(artifacts,'failure.png')});
  await writeFile(join(artifacts,'failure.json'),JSON.stringify({error:String(error),metrics,errors,unknown},null,2));
  throw error;
} finally { await browser?.close(); await new Promise(done=>server.close(done)); }
