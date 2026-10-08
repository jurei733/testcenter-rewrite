import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { localDemoSourcePackage } from "../apps/api/dist/apps/api/src/local-demo-bootstrap.js";

// Own synthetic content, SQLite and protected API. No external response data.
const frontendRoot = resolve(process.env.UI_SMOKE_FRONTEND_ROOT || ".");
await access(join(frontendRoot, "dist/apps/web/browser/index.html"));
const artifacts = process.env.UI_SMOKE_ARTIFACT_DIR || await mkdtemp(join(tmpdir(), "testcenter-original-review-"));
await mkdir(artifacts, { recursive: true });
console.log(`owned_artifacts=${artifacts}`);
const entry = pathToFileURL(resolve("apps/api/dist/apps/api/src/index.js")).href;
const server = spawn(process.execPath, ["--input-type=module", "-e", `
  import { createProductionApiServer } from ${JSON.stringify(entry)};
  const server = await createProductionApiServer();
  server.listen(0, '127.0.0.1', () => process.send({port:server.address().port}));
  process.once('SIGTERM',()=>server.close(()=>process.exit(0)));
`], { cwd: frontendRoot, env: { ...process.env, FIRST_SLICE_STORE: "sqlite",
  FIRST_SLICE_SQLITE_FILE: join(artifacts, "store.sqlite"), FIRST_SLICE_BOOTSTRAP_DEMO: "true",
  FIRST_SLICE_OPERATOR_AUTH_REQUIRED: "true", FIRST_SLICE_PROOF_OF_WORK_SCOPES: "",
  FIRST_SLICE_XML_SCHEMA_PROFILE: "legacy-compatibility", REQUIRE_LOGIN_PASSWORD: "false" },
  stdio: ["ignore", "ignore", "inherit", "ipc"] });
let browser, activePage;
const errors = [], metrics = {};
try {
  const port = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error("Owned review API startup timed out")), 20000);
    server.once("message", ({ port }) => { clearTimeout(timeout); resolve(port); });
    server.once("error", error => { clearTimeout(timeout); reject(error); });
  });
  const base = `http://127.0.0.1:${port}`;
  let token;
  const api = async (path, body, method = body === undefined ? "GET" : "POST") => {
    const response = await fetch(base + path, { method,
      headers: { ...(token ? {authorization:`Bearer ${token}`} : {}),
        ...(body === undefined ? {} : {"content-type":"application/json"}) },
      ...(body === undefined ? {} : {body:JSON.stringify(body)}) });
    assert.ok(response.ok, `${method} ${path}: ${response.status}`);
    return response.status === 204 ? null : response.json();
  };
  assert.equal((await fetch(base + "/api/v1/admin/users")).status, 401);
  token = (await api("/api/v1/admin/auth/sign-in", {username:"demo-admin",password:"demo-admin-password"})).sessionToken;
  const workspace = "/api/v1/tenants/demo-tenant/workspaces/owned-original-review";
  await api("/api/v1/tenants/demo-tenant/workspaces", {workspaceKey:"owned-original-review",displayName:"Owned review"});
  const content = JSON.parse(localDemoSourcePackage.sourceDocument);
  content.bookletEntries = ["owned-review", "owned-other"].map(bookletKey => ({
    ...content.bookletEntries[0], bookletKey, displayLabel:"Review Testheft",
    config: { navbar_unit_label:"HIDDEN", navbar_page_label:"HIDDEN", toolbar_show_unit_list:"FALSE",
      toolbar_show_fullscreen_button:"FALSE", toolbar_show_reload_button:"FALSE" },
    unitEntries: [{...content.bookletEntries[0].unitEntries[0], displayLabel:"Review Aufgabe"}]
  }));
  const source = await api(workspace + "/source-packages", { fileName:"owned-review.json",mediaType:"application/json",sourceDocument:JSON.stringify(content) });
  const imported = await api(workspace + "/import-jobs", {sourcePackageId:source.sourcePackage.sourcePackageId});
  await api(workspace + `/content-releases/${imported.stagedContentRelease.contentReleaseId}/activate`, {activatedByActorId:"owned-review-smoke"});
  await api(workspace + "/participant-roster", {rosterText:["loginKey,groupKey,bookletKey,executionMode",
    "review-synthetic,owned-review,owned-review,run-trial", "review-other,owned-other,owned-other,run-trial"].join("\n")});
  browser = await chromium.launch({headless:process.env.UI_SMOKE_HEADFUL !== "true"});
  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage();
  await otherPage.goto(base + "/app/participant?ui=original&tenantKey=demo-tenant&workspaceKey=owned-original-review");
  await otherPage.getByLabel("Anmeldename", {exact:true}).fill("review-other");
  const otherSignedIn = otherPage.waitForResponse(r=>r.url().endsWith("/participant/auth/sign-in") && r.request().method()==="POST");
  await otherPage.getByRole("button",{name:"Weiter",exact:true}).click();
  const otherIdentity = await (await otherSignedIn).json();
  await otherPage.locator("#originalPlayerToolbar").waitFor();
  const otherRun = (await otherPage.locator("#participantRouteRunId").textContent()).trim();
  const otherReviewsUrl = base + `/api/v1/participant/test-runs/${otherRun}/reviews`;
  const otherHeaders = {authorization:`Bearer ${otherIdentity.sessionToken}`,"content-type":"application/json"};
  const otherCreated = await fetch(otherReviewsUrl, {method:"POST",headers:otherHeaders,
    body:JSON.stringify({unitKey:"unit-intro",comment:"Anderer eigener Run: Ω\n unverändert",priority:3,categories:["design"]})});
  assert.equal(otherCreated.status,201);
  const otherBefore = await (await fetch(otherReviewsUrl,{headers:otherHeaders})).text();
  await otherContext.close();
  for (const theme of ["Primar","Sekundar","Erwachsene"]) {
    await api("/api/v1/admin/application-settings", {themeName:theme}, "PATCH");
    for (const width of [1280,390]) {
      const context = await browser.newContext({viewport:{width,height:width===1280?720:844},locale:"de-DE"});
      const page = await context.newPage(); activePage = page; page.on("pageerror", e=>errors.push(String(e)));
      await page.goto(base + "/app/participant?ui=original&tenantKey=demo-tenant&workspaceKey=owned-original-review");
      await page.getByLabel("Anmeldename", {exact:true}).fill("review-synthetic");
      const identityPromise = page.waitForResponse(r=>r.url().endsWith("/participant/auth/sign-in") && r.request().method()==="POST");
      await page.getByRole("button",{name:"Weiter",exact:true}).click();
      const identity = await (await identityPromise).json();
      assert.match(identity.sessionToken,/^[A-Za-z0-9_-]{43}$/);
      assert.notEqual(identity.sessionToken, token);
      await page.locator("#originalPlayerToolbar").waitFor();
      const runId = (await page.locator("#participantRouteRunId").textContent()).trim();
      await page.evaluate(()=>document.fonts.ready);
      await page.locator('[data-cy="send-comments"]').click();
      const drawer = page.locator('app-original-player-sidebar [role="dialog"]');
      await drawer.waitFor();
      const panel = page.locator("app-original-review-panel");
      await panel.locator('[data-cy="comment-diag-comment"]').waitFor();
      await page.evaluate(()=>document.fonts.ready);
      const capture = async state => {
        const id = `${theme}-${width}-${state}`;
        await page.evaluate(() => document.fonts.ready);
        const drawerRect=await drawer.boundingBox();
        const scrollArea=panel.locator('.scrollable-area').filter({visible:true});
        await scrollArea.waitFor();
        const area=await scrollArea.boundingBox();
        await page.mouse.move(drawerRect.x+30,area.y+5);
        await page.mouse.wheel(-1000,-1000);
        await page.waitForFunction(()=>document.querySelector('app-original-player-sidebar [role="dialog"]').scrollLeft===0 &&
          [...document.querySelectorAll('app-original-review-panel .scrollable-area')].filter(n=>n.getBoundingClientRect().height>0).every(n=>n.scrollTop===0));
        await page.mouse.move(0, 0);
        if (state === "list") assert.equal(await page.locator('[data-cy="comment-list-unit-comments"]').filter({hasText:"Eigener synthetischer Kommentar"}).isVisible(), true);
        if (state === "edit") {
          assert.equal(await panel.locator('[data-cy="comment-diag-comment"]').inputValue(), "Eigener synthetischer Kommentar");
          assert.equal(await panel.locator('[data-cy="comment-diag-title"]').textContent(), "Kommentar bearbeiten");
        }
        await page.screenshot({path:join(artifacts,id+".png")});
        metrics[id] = await panel.evaluate(el=>{
          const rect=n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}};
          const toolbar=el.querySelector("mat-toolbar");return{panel:rect(el),drawer:rect(el.closest('[role="dialog"]')),
            backdropColor:getComputedStyle(document.querySelector('app-original-player-sidebar .backdrop')).backgroundColor,
            toolbar:rect(toolbar),toolbarBackground:getComputedStyle(toolbar).backgroundColor,toolbarColor:getComputedStyle(toolbar).color,
            headings:[...el.querySelectorAll("h3")].map(n=>({text:n.textContent,font:getComputedStyle(n).font,color:getComputedStyle(n).color,margin:getComputedStyle(n).margin,height:n.getBoundingClientRect().height})),
            buttons:[...el.querySelectorAll('.action-buttons button')].map(n=>({text:n.textContent.trim(),rect:rect(n),font:getComputedStyle(n).font,color:getComputedStyle(n).color,background:getComputedStyle(n).backgroundColor,radius:getComputedStyle(n).borderRadius})),
            labels:[...el.querySelectorAll('label')].map(n=>({font:getComputedStyle(n).font,color:getComputedStyle(n).color})),
            controls:[...el.querySelectorAll("mat-form-field,mat-radio-group,.action-buttons,mat-toolbar button")].map(n=>({tag:n.tagName,rect:rect(n)}))};
        });
        assert.equal(metrics[id].panel.width,700);
        assert.equal(metrics[id].drawer.width,Math.min(700,width*.9));
        assert.equal(metrics[id].toolbar.height,width<600?56:64);
        assert.equal(metrics[id].toolbarColor,"rgb(255, 255, 255)");
        for(const label of [metrics[id].labels[0],metrics[id].labels[5],metrics[id].labels[9]])
          assert.equal(label.color,"rgb(64, 72, 76)");
        assert.equal(metrics[id].backdropColor,"color(srgb 0.160784 0.196078 0.207843 / 0.4)");
        assert.equal(metrics[id].toolbarBackground,{Primar:"rgb(25, 97, 117)",Sekundar:"rgb(11, 45, 132)",Erwachsene:"rgb(107, 54, 154)"}[theme]);
      };
      await capture("form");
      assert.notEqual(runId,otherRun);
      assert.equal((await fetch(base+`/api/v1/participant/test-runs/${runId}/reviews`,{headers:{authorization:`Bearer ${identity.sessionToken}`}})).status,200);
      // The existing participant-access boundary deliberately returns 401 for
      // a credential that does not authenticate the requested Run's owner.
      assert.equal((await fetch(otherReviewsUrl,{headers:{authorization:`Bearer ${identity.sessionToken}`}})).status,401);
      assert.equal(await panel.locator('[data-cy="comment-diag-submit"]').isDisabled(),true);
      assert.equal(await panel.locator('[data-cy="comment-diag-currentUnit"] input').isChecked(),true);
      await panel.locator('[data-cy="comment-diag-comment"]').fill("Eigener Entwurf");
      await page.locator('[data-cy="comment-toolbar-show-list"]').click();
      await page.locator('[data-cy="comment-toolbar-back-to"]').click();
      assert.equal(await panel.locator('[data-cy="comment-diag-comment"]').inputValue(),"Eigener Entwurf");
      await page.locator('[data-cy="comment-toolbar-new-comment"]').click();
      assert.equal(await panel.locator('[data-cy="comment-diag-comment"]').inputValue(),"");
      await panel.locator('[data-cy="comment-diag-reviewer"]').fill("Review Person");
      const comment = "Eigener synthetischer Kommentar";
      await panel.locator('[data-cy="comment-diag-comment"]').fill(comment);
      await panel.locator('[data-cy="comment-diag-priority1"] input').check();
      await panel.locator('[data-cy="comment-diag-cat-tech"] input').check();
      assert.equal(await panel.locator('[data-cy="comment-diag-submit"]').isEnabled(),true);
      await capture("filled");
      await panel.locator('[data-cy="comment-diag-close"]').click();
      await drawer.waitFor({state:"detached"});
      await page.locator('[data-cy="send-comments"]').click();
      await panel.locator('[data-cy="comment-diag-comment"]').waitFor();
      assert.equal(await panel.locator('[data-cy="comment-diag-comment"]').inputValue(),comment);
      await page.waitForFunction(()=>!document.querySelector('[data-cy="comment-diag-submit"]').disabled);
      if (theme === "Primar" && width === 1280) {
        const reviewsUrl = base + `/api/v1/participant/test-runs/${runId}/reviews`;
        const failSave = route => route.request().method() === "POST"
          ? route.fulfill({status:500,contentType:"application/json",body:JSON.stringify({error:"Owned review save fault"})})
          : route.continue();
        await page.route(reviewsUrl,failSave);
        const failed = page.waitForResponse(r=>r.url()===reviewsUrl && r.request().method()==="POST");
        await panel.locator('[data-cy="comment-diag-submit"]').click();
        assert.equal((await failed).status(),500);
        await page.waitForFunction(()=>!document.querySelector('[data-cy="comment-diag-submit"]').disabled);
        assert.equal(await drawer.isVisible(),true);
        assert.equal(await panel.locator('[data-cy="comment-diag-comment"]').inputValue(),comment);
        await page.unroute(reviewsUrl,failSave);
      }
      const saved = page.waitForResponse(r=>r.url().endsWith(`/test-runs/${runId}/reviews`) && r.request().method()==="POST");
      await panel.locator('[data-cy="comment-diag-submit"]').click();
      assert.equal((await saved).status(),201);
      const savedReview = (await (await saved).json()).review;
      assert.equal(savedReview.testRunId,runId);
      assert.equal(savedReview.comment,comment);
      assert.equal(savedReview.priority,1);
      assert.deepEqual(savedReview.categories,["tech"]);
      await drawer.waitFor({state:"detached"});
      assert.equal(await page.locator('[data-cy="send-comments"]').evaluate(el=>el===document.activeElement),true);
      await page.locator('[data-cy="send-comments"]').click();
      await page.getByRole("button",{name:"Kommentarübersicht",exact:true}).click();
      const item=page.locator('[data-cy="comment-list-unit-comments"]').filter({hasText:comment});
      await item.waitFor(); await capture("list");
      await item.click();await capture("edit");
      assert.equal(await panel.locator('[data-cy="comment-diag-comment"]').inputValue(),comment);
      assert.equal(await panel.locator('[data-cy="comment-diag-currentBklt"] input').isDisabled(),true);
      await panel.locator('[data-cy="comment-diag-comment"]').fill(comment+" bearbeitet");
      await panel.locator('[data-cy="comment-diag-close"]').click();
      await drawer.waitFor({state:"detached"});
      await page.locator('[data-cy="send-comments"]').click();
      await panel.locator('[data-cy="comment-diag-comment"]').waitFor();
      assert.equal(await panel.locator('[data-cy="comment-diag-comment"]').inputValue(),comment+" bearbeitet");
      await page.waitForFunction(()=>!document.querySelector('[data-cy="comment-diag-submit"]').disabled);
      await page.getByRole("button",{name:"Aktualisieren",exact:true}).click();
      await drawer.waitFor({state:"detached"});
      await page.reload({waitUntil:"domcontentloaded"}); await page.locator("#originalPlayerToolbar").waitFor();
      assert.equal((await page.locator("#participantRouteRunId").textContent()).trim(),runId);
      await page.locator('[data-cy="send-comments"]').click();
      await page.getByRole("button",{name:"Kommentarübersicht",exact:true}).click();
      await page.locator('[data-cy="comment-list-unit-comments"]').filter({hasText:comment+" bearbeitet"}).click();
      await panel.locator('[data-cy="comment-diag-delete"]').click();
      await page.locator("#participantConfirmationStayButton").click();
      assert.equal(await panel.locator('[data-cy="comment-diag-comment"]').inputValue(),comment+" bearbeitet");
      await panel.locator('[data-cy="comment-diag-delete"]').click();
      await page.locator("#participantConfirmationContinueButton").click();
      await page.getByRole("heading",{name:"Kommentarübersicht",exact:true}).waitFor();
      assert.equal(await page.locator('[data-cy="comment-list-unit-comments"]').filter({hasText:comment}).count(),0);
      for (const scope of ["test","task"]) {
        await page.locator('[data-cy="comment-toolbar-new-comment"]').click();
        const text = `Eigener ${scope}-Kommentar: Ω\n  exakt erhalten`;
        if (scope === "test") await panel.locator('[data-cy="comment-diag-currentBklt"] input').check();
        else {
          const taskLabel = panel.getByRole("textbox",{name:"Teilaufgabe",exact:true});
          await taskLabel.click();
          await taskLabel.fill("Eigene Teilaufgabe Ω");
          await page.waitForFunction(()=>document.querySelector('[data-cy="comment-diag-currentPage"] input[type="radio"]').checked);
          assert.equal(await panel.locator('[data-cy="comment-diag-currentPage"] input[type="radio"]').isChecked(),true);
        }
        await panel.locator('[data-cy="comment-diag-comment"]').fill(text);
        await panel.locator('[data-cy="comment-diag-cat-content"] input').check();
        await panel.locator('[data-cy="comment-diag-cat-design"] input').check();
        const created = page.waitForResponse(r=>r.url().endsWith(`/test-runs/${runId}/reviews`) && r.request().method()==="POST");
        await panel.locator('[data-cy="comment-diag-submit"]').click();
        const result = await created;
        assert.equal(result.status(),201);
        const scopedReview = (await result.json()).review;
        assert.equal(scopedReview.testRunId,runId);
        assert.equal(scopedReview.participantSessionId,identity.participantSession.participantSessionId);
        assert.equal(Buffer.from(scopedReview.comment).equals(Buffer.from(text)),true);
        assert.equal(scopedReview.unitKey,scope === "test" ? null : "unit-intro");
        assert.equal(scopedReview.pageLabel,scope === "test" ? null : "Eigene Teilaufgabe Ω");
        assert.equal(scopedReview.priority,0);
        assert.deepEqual([...scopedReview.categories].sort(),["content","design"]);
        await drawer.waitFor({state:"detached"});
        await page.locator('[data-cy="send-comments"]').click();
        await page.locator('[data-cy="comment-toolbar-show-list"]').click();
        const scopedItem = panel.locator(scope === "test" ? '[data-cy="comment-list-booklet-comments"]' : '[data-cy="comment-list-unit-comments"]').filter({hasText:text});
        await scopedItem.click();
        await page.waitForFunction(text=>document.querySelector('[data-cy="comment-diag-comment"]').value===text,text);
        assert.equal(await panel.locator('[data-cy="comment-diag-comment"]').inputValue(),text);
        assert.equal(await panel.locator('[data-cy="comment-diag-currentUnit"] input').isDisabled(),scope === "test");
        await panel.locator('[data-cy="comment-diag-delete"]').click();
        await page.locator("#participantConfirmationContinueButton").click();
        await page.getByRole("heading",{name:"Kommentarübersicht",exact:true}).waitFor();
        assert.equal(await scopedItem.count(),0);
      }
      await page.keyboard.press("Escape"); await drawer.waitFor({state:"detached"});
      await page.locator('[data-cy="send-comments"]').click();
      await page.getByRole("heading",{name:"Kommentarübersicht",exact:true}).waitFor();
      await page.keyboard.press("Escape"); await drawer.waitFor({state:"detached"});
      await page.goto(base+`/participant?participantSessionId=${identity.participantSession.participantSessionId}&testRunId=${runId}&ui=rewrite`);
      await page.locator("#participantRouteReviewComment").waitFor();
      assert.equal(await page.locator("app-original-review-panel").count(),0);
      assert.equal((await page.locator("#participantRouteRunId").textContent()).trim(),runId);
      assert.equal(await (await fetch(otherReviewsUrl,{headers:otherHeaders})).text(),otherBefore);
      await context.close();
    }
  }
  assert.deepEqual(errors,[]);
  if(process.env.ORIGINAL_REVIEW_REFERENCE_METRICS) {
    const reference = JSON.parse(await readFile(process.env.ORIGINAL_REVIEW_REFERENCE_METRICS,"utf8"));
    assert.deepEqual(reference.errors,[]);
    assert.deepEqual(Object.keys(metrics).sort(),Object.keys(reference.metrics).sort());
    for(const [key,actual] of Object.entries(metrics)) {
      const expected = reference.metrics[key];
      for(const field of ["panel","drawer","toolbar","toolbarBackground","toolbarColor","controls","buttons","labels"])
        assert.deepEqual(actual[field],expected[field],`${key}: rendered ${field}`);
      if(key.endsWith("-list")) {
        assert.deepEqual(actual.headings,expected.headings,`${key}: list typography`);
        assert.equal(actual.backdropColor,expected.backdropColor,`${key}: scrim`);
      }
    }
  }
  await writeFile(join(artifacts,"metrics.json"),JSON.stringify({metrics,errors},null,2));
  console.log(JSON.stringify({result:"passed",states:Object.keys(metrics).length,checks:["protected SQLite","native review save/edit/delete/back/new","failed save retry","test/unit/task and exact UTF-8","same Run reload","foreign Session denied and unchanged","Rewrite switch","three themes and two widths"]}));
} catch (error) {
  if(activePage && !activePage.isClosed()) await activePage.screenshot({path:join(artifacts,"failure.png")});
  await writeFile(join(artifacts,"failure.json"),JSON.stringify({error:String(error),metrics,errors},null,2));
  throw error;
} finally {
  await browser?.close();
  if(server.exitCode===null){server.kill("SIGTERM");await new Promise(r=>server.once("exit",r));}
}
