import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { brotliDecompressSync } from "node:zlib";
import { join } from "node:path";
import { reloadParticipantUnitLabelPlayer } from "./participant-unit-label-smoke.mjs";
import { matchesVeronaSavedResponse } from "./verona-save-response-match.mjs";
import { runBoundedSmokeCases } from "./bounded-smoke-cases.mjs";

const fixtureRoot = new URL("../test-fixtures/original-testcenter/", import.meta.url);
const loadFixture = async item => {
  let bytes = await readFile(new URL(item.fixture, fixtureRoot));
  if (item.encoding?.includes("base64")) bytes = Buffer.from(bytes.toString("utf8").trim(), "base64");
  if (item.encoding === "brotli-base64") bytes = brotliDecompressSync(bytes);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), item.sha256, item.fixture);
  return bytes;
};

// Execute the exact current Original graph, keeping its defaults, repeated Unit
// alias, real password roster and Player bytes. Synthetic label combinations
// remain a separate gate in participant-unit-label-smoke.mjs.
export async function runCurrentOriginalBookletConfigSmoke({ browser, baseUrl,
  tenantKey, workspaceKey, sendJson, createZip, operatorToken = "", artifactDirectory, report = console.log, caseConcurrency = 1 }) {
  const corpus = JSON.parse(await readFile(new URL("corpus.json", fixtureRoot), "utf8"));
  const source = corpus.currentOriginalBookletConfigPackage;
  assert.equal(source.sourceCommit, "eedae41840cbe90e5547c0211da818bdf620f5aa");
  assert.equal(source.bookletKeys.length, 56);
  const byKey = new Map([...corpus.booklets, ...corpus.systemBooklets,
    ...source.currentBookletOverrides].map(item => [item.bookletKey, item]));
  const entries = [];
  for (const [index, key] of source.bookletKeys.entries()) {
    entries.push({ fileName: `booklets/CY_Bklt_BkltConfig_${index + 1}.xml`, content: await loadFixture(byKey.get(key)) });
  }
  for (const [index, [fixture, , sha256]] of source.units.entries()) {
    entries.push({ fileName: `units/CY_Unit${index + 100}.xml`, content: await loadFixture({ fixture, sha256, encoding: "base64" }) });
  }
  entries.push({ fileName: "players/verona-player-simple-6.0.html", content: await loadFixture(source.player) });
  const roster = await loadFixture(source.roster);
  await sendJson(`${baseUrl}/api/v1/platform/tenants`, { body: { tenantKey, displayName: "Owned current Original Booklet Config" } });
  await sendJson(`${baseUrl}/api/v1/tenants/${tenantKey}/workspaces`, { body: { workspaceKey, displayName: "Owned current Original Booklet Config" } });
  const workspaceUrl = `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}`;
  const uploaded = await (await sendJson(`${workspaceUrl}/source-packages`, { body: {
    fileName: "current-original-booklet-config.zip", mediaType: "application/zip",
    sourceDocument: `data:application/zip;base64,${createZip(entries).toString("base64")}`
  } })).json();
  const imported = await (await sendJson(`${workspaceUrl}/import-jobs`, { body: { sourcePackageId: uploaded.sourcePackage.sourcePackageId } })).json();
  assert.equal(imported.importJob.status, "completed", JSON.stringify(imported.importJob.diagnostics));
  assert.deepEqual(imported.importJob.diagnostics, []);
  assert.ok(imported.stagedContentRelease?.contentReleaseId);
  const releaseId = imported.stagedContentRelease.contentReleaseId;
  const release = await (await sendJson(`${workspaceUrl}/content-releases/${releaseId}`, { method: "GET" })).json();
  assert.equal(release.contentReleaseDetail.contentRelease.runtimeSnapshot.bookletEntries.length, 56);
  await sendJson(`${workspaceUrl}/content-releases/${releaseId}/activate`, { body: {} });
  const rosterResult = await (await sendJson(`${workspaceUrl}/participant-roster`, { body: { rosterText: roster.toString("utf8") } })).json();
  assert.equal(rosterResult.items.length, 56);
  assert.deepEqual(rosterResult.operationalLoginCandidates, []);

  const cases = [
    { number: 52, header: "booklet", toolbar: "short", nav: "index", shorts: ["A1", "A2"] },
    { number: 53, header: "booklet", toolbar: "short", nav: "index", shorts: [undefined, "A2"] },
    { number: 54, header: "booklet", toolbar: "full", nav: "short", shorts: ["A1", "A2"] },
    { number: 55, header: "short", toolbar: "full", nav: "index", shorts: ["A1", "A2"] },
    { number: 56, header: "short", toolbar: "full", nav: "index", shorts: [undefined, "A2"] }
  ];
  let passed = 0;
  // UI/width groups reuse the exact Source roster, so groups remain serial.
  // Within a group each case uses a different real participant account.
  for (const ui of ["rewrite", "original"]) for (const width of [1280, 390]) await runBoundedSmokeCases(cases,caseConcurrency,async item=>{
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    try {
      const page = await context.newPage(), errors = [];
      let operatorLeaks = 0;
      page.on("pageerror", error => errors.push(String(error)));
      page.on("request", request => {
        if (operatorToken && request.url().includes("/api/v1/participant/") && request.headers().authorization === `Bearer ${operatorToken}`) operatorLeaks++;
      });
      await page.goto(`${baseUrl}/app/participant?${new URLSearchParams({ ui, tenantKey, workspaceKey })}`, { waitUntil: "domcontentloaded" });
      const loginKey = `${source.roster.loginPrefix}${item.number}`;
      if (ui === "original") {
        await page.getByLabel("Anmeldename", { exact: true }).fill(loginKey);
        await page.getByRole("button", { name: "Weiter", exact: true }).click();
        await page.getByLabel("Kennwort", { exact: true }).fill(source.roster.password);
      } else {
        await page.locator("#participantLoginKey").fill(loginKey);
        await page.locator("#participantPassword").fill(source.roster.password);
      }
      const signingIn = page.waitForResponse(response => new URL(response.url()).pathname === "/api/v1/participant/auth/sign-in" && response.request().method() === "POST");
      const resuming = page.waitForResponse(response => /\/sessions\/[^/]+\/resume$/.test(new URL(response.url()).pathname));
      if (ui === "original") await page.getByRole("button", { name: "Anmelden", exact: true }).click();
      else await page.locator("#participantRouteSignInButton").click();
      const signedIn = await signingIn;
      assert.equal(signedIn.status(), 200);
      const identity = await signedIn.json();
      assert.notEqual(identity.sessionToken, operatorToken);
      assert.equal(identity.participantSession.executionMode, "run-hot-restart");
      const resumed = await resuming;
      assert.equal(resumed.status(), 200);
      const runId = (await resumed.json()).testRun.testRunId;
      const readState = async () => {
        const response = await globalThis.fetch(`${baseUrl}/api/v1/participant/sessions/${identity.participantSession.participantSessionId}/current-state?testRunId=${encodeURIComponent(runId)}`, {
          headers: { authorization: `Bearer ${identity.sessionToken}` }
        });
        assert.equal(response.status, 200);
        return (await response.json()).currentRunState;
      };
      const owner = page.locator("#participantVeronaPlayerFrame");
      const waitForPlayer = () => page.locator("#participantVeronaPlayerVersion").filter({ hasText: "API 6.0" }).waitFor({ state: ui === "original" ? "attached" : "visible" });
      const assertLabels = async position => {
        const full = `Aufgabe${position}`, short = item.shorts[position - 1] || full;
        const chosen = mode => mode === "short" ? short : mode === "booklet" ? `Bklt-config-${item.number}` : full;
        await page.waitForFunction(expected => document.querySelector("#participantVeronaPlayerFrame")?.getAttribute("title") === expected, full);
        for (const [selector, text] of [
          [ui === "original" ? "#participantApplicationHeader h1" : "#participantRouteScreenHeader", chosen(item.header)],
          [ui === "original" ? '#originalPlayerToolbar [data-cy="unit-title"]' : "#participantRouteUnit", chosen(item.toolbar)],
          [ui === "original" ? "#originalUnitNavigation-label" : "#participantRouteUnitNavigationLabel", item.nav === "index" ? ui === "original" ? `Aufgabe ${position}/2` : `Unit ${position} / 2` : chosen(item.nav)]
        ]) {
          await page.waitForFunction(({ selector, text }) => document.querySelector(selector)?.textContent?.trim().replace(/\s+/g, " ") === text, { selector, text });
          assert.equal((await page.locator(selector).textContent()).trim().replace(/\s+/g, " "), text);
        }
        assert.equal(await owner.getAttribute("title"), full, "Authored short labels cannot replace full Player metadata.");
      };
      await waitForPlayer();
      await assertLabels(1);
      const initial = await readState();
      assert.deepEqual(initial.bookletUnits.map(unit => unit.shortLabel), item.shorts);
      assert.deepEqual(initial.bookletUnits.map(unit => unit.unitKey), ["CY-Unit.Sample-101", "cpy"]);
      await owner.scrollIntoViewIfNeeded();
      await owner.screenshot();
      const input = page.frameLocator("#participantVeronaPlayerFrame").locator('[data-cy="TestController-radio1-Aufg1"]');
      await input.check();
      let saved;
      const deadline = Date.now() + 15_000;
      while (Date.now() < deadline) {
        const raw = (await readState()).testRun.unitResponses["CY-Unit.Sample-101"];
        if (raw && JSON.parse(raw).unitState?.dataParts?.answers?.includes("VALUE_CHANGED")) { saved = raw; break; }
        await delay(100);
      }
      assert.ok(saved, "Native Original Player input must be saved with unchanged buffer defaults.");
      await page.locator(ui === "original" ? "#originalUnitNavigation-forward" : "#participantRouteNextUnitButton").click();
      await assertLabels(2);
      await page.locator(ui === "original" ? "#originalUnitNavigation-backward" : "#participantRoutePreviousUnitButton").click();
      await assertLabels(1);
      assert.ok(matchesVeronaSavedResponse((await readState()).testRun.unitResponses["CY-Unit.Sample-101"], saved, true));
      await reloadParticipantUnitLabelPlayer(page, waitForPlayer);
      await assertLabels(1);
      const restored = await readState();
      assert.equal(restored.testRun.testRunId, runId);
      assert.equal(new URL(page.url()).searchParams.get("testRunId"), runId);
      assert.ok(matchesVeronaSavedResponse(restored.testRun.unitResponses["CY-Unit.Sample-101"], saved, true));
      const restoredInput = page.frameLocator("#participantVeronaPlayerFrame").locator('[data-cy="TestController-radio1-Aufg1"]');
      assert.equal(await restoredInput.isChecked(), true);
      if (artifactDirectory) {
        // Bring the restored Player into the viewport and allow its frame to
        // paint before recording both the native control and the whole page.
        await page.bringToFront();
        await owner.scrollIntoViewIfNeeded();
        await restoredInput.evaluate(element => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
        await owner.screenshot({ path: join(artifactDirectory, `current-original-${item.number}-${ui}-${width}-player.png`) });
        await page.screenshot({ path: join(artifactDirectory, `current-original-${item.number}-${ui}-${width}.png`), fullPage: true });
      }
      assert.equal(operatorLeaks, 0);
      assert.deepEqual(errors, []);
      report(`current_original_booklet_config=${ui}/${width}/${item.number}:passed`);
      passed++;
    } catch(error) {
      report(`current_original_booklet_config=${ui}/${width}/${item.number}:failed`);
      throw error;
    } finally {
      await context.close();
    }
  });
  assert.equal(passed, 20);
  report(`current_original_booklet_config_cases_passed=${passed}`);
}
