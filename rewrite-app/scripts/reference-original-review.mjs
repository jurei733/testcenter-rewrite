import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { chromium } from 'playwright';
// Render the unmodified upstream frontend against owned API fixtures only.
// This proves UI states, not upstream backend behavior or authorization.
assert.ok(process.env.ORIGINAL_REVIEW_REFERENCE_ROOT, 'Set ORIGINAL_REVIEW_REFERENCE_ROOT to the built current Original browser assets');
const root = resolve(process.env.ORIGINAL_REVIEW_REFERENCE_ROOT);
const artifacts = resolve(process.env.UI_SMOKE_ARTIFACT_DIR || '.data/original-review-reference');
await mkdir(artifacts, { recursive: true });
const { localDemoSourcePackage } = await import('../apps/api/dist/apps/api/src/local-demo-bootstrap.js');
const demo = JSON.parse(localDemoSourcePackage.sourceDocument);
const player = demo.playerEntries[0].html;
const xml = '<Booklet><Metadata><Id>owned-review</Id><Label>Review Testheft</Label></Metadata><BookletConfig><Config key="toolbar_show_unit_list">FALSE</Config><Config key="toolbar_show_fullscreen_button">FALSE</Config><Config key="toolbar_show_reload_button">FALSE</Config><Config key="navbar_unit_label">HIDDEN</Config><Config key="navbar_page_label">HIDDEN</Config></BookletConfig><Units><Unit id="unit-intro" label="Review Aufgabe"/></Units></Booklet>';
const server = createServer(async (req, res) => { try {
    let path = new URL(req.url, 'http://localhost').pathname;
    let file = resolve(root, '.' + path);
    if (!extname(path))
        file = resolve(root, 'index.html');
    const bytes = await readFile(file);
    res.setHeader('content-type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' })[extname(file)] || 'application/octet-stream');
    res.end(bytes);
}
catch {
    res.statusCode = 404;
    res.end();
} });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const errors = [];
const metrics = {};
try {
    for (const theme of ['Primar', 'Sekundar', 'Erwachsene'])
        for (const width of [1280, 390]) {
            const context = await browser.newContext({ viewport: { width, height: width === 1280 ? 720 : 844 }, locale: 'de-DE' });
            const page = await context.newPage();
            page.on('pageerror', e => errors.push(String(e)));
            const auth = { token: 'owned-reference-participant', displayName: 'Review Person', loginName: 'review-synthetic', groupLabel: 'Review Gruppe', customTexts: {}, flags: [], claims: { test: [{ id: 'owned-review', label: 'Review Testheft', workspaceId: '1', description: '', type: 'test', flags: {} }] }, groupToken: 'owned-reference-group', viewSettings: { theme } };
            let reviews = [];
            await page.route(`${base}/api/**`, async (route) => {
                const req = route.request(), path = new URL(req.url()).pathname;
                let body;
                if (path === '/api/system/config')
                    body = { version: '19.0.0', customTexts: {}, appConfig: { themeName: theme }, veronaPlayerApiVersionMin: 2, veronaPlayerApiVersionMax: 6, iqbStandardResponseTypeMin: 1, iqbStandardResponseTypeMax: 5, xmlSchemaVersions: {}, bruteForceProtection: [], broadcastingServiceUri: '', fileServiceUri: '', passwordMinLength: 0, passwordPattern: '' };
                else if (path === '/api/sys-check-mode')
                    body = false;
                else if (path === '/api/session/login' || path === '/api/session')
                    body = auth;
                else if (path === '/api/test')
                    body = 1;
                else if (path === '/api/test/1')
                    body = { xml, mode: 'run-trial', laststate: {}, resources: { 'UNIT-INTRO': { usesPlayer: ['owned-player.html'] } }, firstStart: false, workspaceId: 1, presetBookletStates: {} };
                else if (path.startsWith('/api/test/1/unit/unit-intro/alias/'))
                    body = { state: {}, dataParts: {}, unitResponseType: 'owned', definition: demo.bookletEntries[0].unitEntries[0].unitDefinition, definitionType: 'application/vnd.testcenter.demo+json' };
                else if (path.includes('/file/'))
                    return route.fulfill({ status: 200, contentType: 'text/html', body: player });
                else if (path === '/api/test/1/unit/unit-intro/review' && req.method() === 'PUT') {
                    const value = req.postDataJSON();
                    assert.equal(value.entry, 'Eigener synthetischer Kommentar');
                    assert.equal(value.reviewer, 'Review Person');
                    assert.equal(value.categories, 'tech');
                    assert.equal(value.priority, 1);
                    reviews = [{...value, id:1, unit_name:'unit-intro', test_id:1, person_id:1,
                        reviewtime:'2026-10-08T00:00:00Z'}];
                    body = {};
                }
                else if (path.endsWith('/reviews'))
                    body = path.includes('/unit/') ? reviews : [];
                else if (req.method() !== 'GET')
                    body = {};
                else if (path.includes('assets') || path.includes('commands'))
                    body = [];
                else if (path === '/api/asset-assignments')
                    body = {};
                else {
                    console.log('UNHANDLED', req.method(), path);
                    body = {};
                }
                await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
            });
            await page.goto(base + '/r/login');
            await page.locator('input').first().fill('review-synthetic');
            await page.getByRole('button', { name: 'Weiter', exact: true }).click();
            await page.locator('[data-cy="send-comments"]').waitFor();
            await page.evaluate(() => document.fonts.ready);
            await page.locator('[data-cy="send-comments"]').click();
            await page.locator('[data-cy="comment-diag-comment"]').waitFor();
            await page.evaluate(() => document.fonts.ready);
            const id = theme + '-' + width;
            const capture = async state => {
                await page.evaluate(()=>document.fonts.ready);
                await page.waitForFunction(()=>{const el=document.querySelector('mat-sidenav');return el && Math.abs(el.getBoundingClientRect().right-innerWidth)<0.01});
                // Compare the same natural scroll endpoint in both renderers.
                // Trusted wheel input, never a DOM scroll setter or forced click.
                const drawerRect=await page.locator('mat-sidenav').boundingBox();
                const scrollArea=page.locator('tc-review-panel .scrollable-area').filter({visible:true});
                await scrollArea.waitFor();
                const area=await scrollArea.boundingBox();
                await page.mouse.move(drawerRect.x+30,area.y+5);
                await page.mouse.wheel(-1000,-1000);
                await page.waitForFunction(()=>document.querySelector('.mat-drawer-inner-container').scrollLeft===0 &&
                    [...document.querySelectorAll('tc-review-panel .scrollable-area')].filter(n=>n.getBoundingClientRect().height>0).every(n=>n.scrollTop===0));
                await page.mouse.move(0,0);
                await page.screenshot({path:`${artifacts}/${id}-${state}.png`});
                metrics[id+'-'+state]=await page.locator('tc-review-panel').evaluate(el=>{
                    const rect=n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}};
                    return {textarea:{height:el.querySelector('textarea').getBoundingClientRect().height,font:getComputedStyle(el.querySelector('textarea')).font,lineHeight:getComputedStyle(el.querySelector('textarea')).lineHeight,inline:el.querySelector('textarea').getAttribute('style')},
                        panel:rect(el),drawer:rect(el.closest('mat-sidenav')),toolbar:rect(el.querySelector('mat-toolbar')),
                        toolbarBackground:getComputedStyle(el.querySelector('mat-toolbar')).backgroundColor,toolbarColor:getComputedStyle(el.querySelector('mat-toolbar')).color,
                        buttons:[...el.querySelectorAll('.action-buttons button')].map(n=>({text:n.textContent.trim(),rect:rect(n),font:getComputedStyle(n).font,color:getComputedStyle(n).color,background:getComputedStyle(n).backgroundColor,radius:getComputedStyle(n).borderRadius})),
                        labels:[...el.querySelectorAll('label')].map(n=>({font:getComputedStyle(n).font,color:getComputedStyle(n).color})),
                        controls:[...el.querySelectorAll('mat-form-field,mat-radio-group,.action-buttons,mat-toolbar button')].map(n=>({tag:n.tagName,rect:rect(n)}))};
                });
            };
            await capture('form');
            await page.locator('[data-cy="comment-diag-reviewer"]').fill('Review Person');
            await page.locator('[data-cy="comment-diag-comment"]').fill('Eigener synthetischer Kommentar');
            await page.locator('[data-cy="comment-diag-priority1"] input').check();
            await page.locator('[data-cy="comment-diag-cat-tech"] input').check();
            assert.equal(await page.locator('[data-cy="comment-diag-submit"]').isEnabled(),true);
            await page.evaluate(()=>document.fonts.ready);
            await capture('filled');
            await page.locator('[data-cy="comment-diag-submit"]').click();
            await page.locator('mat-sidenav').waitFor({state:'hidden'});
            await page.locator('[data-cy="send-comments"]').click();
            await page.locator('mat-sidenav').waitFor();
            await page.locator('.mat-mdc-snack-bar-container').waitFor({state:'hidden'});
            await page.locator('[data-cy="comment-toolbar-show-list"]').click();
            const intendedEntry = page.locator('[data-cy="comment-list-unit-comments"]').filter({ hasText: 'Eigener synthetischer Kommentar' });
            await intendedEntry.waitFor();
            assert.equal(await intendedEntry.isVisible(), true);
            assert.equal(await intendedEntry.textContent(), 'Eigener synthetischer Kommentar');
            await page.evaluate(() => document.fonts.ready);
            await capture('list');
            metrics[id + '-list'].backdropColor = await page.locator('.mat-drawer-backdrop').evaluate(n => getComputedStyle(n).backgroundColor);
            metrics[id + '-list'].unitTitle = await page.locator('[data-cy="unit-title"]').evaluate(n => ({ font: getComputedStyle(n).font, color: getComputedStyle(n).color }));
            metrics[id + '-list'].headings = await page.locator('tc-review-panel h3').evaluateAll(nodes => nodes.map(n => ({ text: n.textContent, font: getComputedStyle(n).font, color: getComputedStyle(n).color, margin: getComputedStyle(n).margin, height: n.getBoundingClientRect().height })));
            await intendedEntry.click();
            assert.equal(await page.locator('[data-cy="comment-diag-comment"]').inputValue(), 'Eigener synthetischer Kommentar');
            assert.equal(await page.locator('[data-cy="comment-diag-title"]').textContent(), 'Kommentar bearbeiten');
            await page.evaluate(() => document.fonts.ready);
            await capture('edit');
            await context.close();
        }
    await writeFile(artifacts + '/metrics.json', JSON.stringify({ metrics, errors }, null, 2));
    console.log('REFERENCE_COMPLETE', Object.keys(metrics).length, errors);
}
finally {
    await browser.close();
    await new Promise(r => server.close(r));
}
