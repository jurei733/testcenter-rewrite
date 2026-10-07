import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

// Shared by the complete repository browser gate and focused owned-fixture
// acceptance. No vendor markup, sandbox or synthetic Player input is changed.
export async function runParticipantUnitLabelSmoke({ browser, baseUrl, tenantKey,
  workspaceKey, sendJson, createZip, unitDocument, playerDocument, operatorToken = "",
  report = console.log }) {
  const { cases } = JSON.parse(await readFile(new URL(
    "../test-fixtures/original-testcenter/current-unit-label-cases.json", import.meta.url
  ), "utf8"));
  const fullA = "Volle Aufgabe ä/β";
  const fullB = "Zweite volle Aufgabe ä/β";
  const shortA = "Kurz ä/β";
  const escapeXml = value => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
  await sendJson(`${baseUrl}/api/v1/platform/tenants`, {
    body: { tenantKey, displayName: "Owned current Unit label acceptance" }
  });
  await sendJson(`${baseUrl}/api/v1/tenants/${tenantKey}/workspaces`, {
    body: { workspaceKey, displayName: "Owned current Unit label acceptance" }
  });
  const workspaceUrl = `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}`;
  const booklets = cases.map(item => ({ fileName: `booklets/${item.key}.xml`, content:
    '<?xml version="1.0"?><Booklet xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/testcenter-booklet-xml/18.0">' +
    `<Metadata><Id>labels-${item.key}</Id><Label>Label booklet ${item.key}</Label></Metadata><BookletConfig>` +
    Object.entries({ pagingMode: "buttons", navbar_forward_button: "UNITS", navbar_backward_button: "UNITS",
      unit_responses_buffer_time: "0", ...item.config }).map(([key, value]) =>
      `<Config key="${key}">${escapeXml(value)}</Config>`).join("") +
    '</BookletConfig><Units><Testlet id="owned-block" label="Owned block">' +
    `<Unit id="CY-Unit.Sample-101" alias="a" label="${fullA}" labelshort="${shortA}"/>` +
    `<Unit id="CY-Unit.Sample-101" alias="b" label="${fullB}"/></Testlet></Units></Booklet>` }));
  const archive = createZip([...booklets, { fileName: "units/CY_Unit101.xml", content: unitDocument },
    { fileName: "players/verona-player-simple-6.0.html", content: playerDocument }]);
  const uploaded = await (await sendJson(`${workspaceUrl}/source-packages`, { body: {
    fileName: "current-unit-labels.zip", mediaType: "application/zip",
    sourceDocument: `data:application/zip;base64,${archive.toString("base64")}`
  } })).json();
  const imported = await (await sendJson(`${workspaceUrl}/import-jobs`, { body: {
    sourcePackageId: uploaded.sourcePackage.sourcePackageId
  } })).json();
  assert.equal(imported.importJob.status, "completed", JSON.stringify(imported.importJob.diagnostics));
  assert.ok(imported.stagedContentRelease?.contentReleaseId);
  await sendJson(`${workspaceUrl}/content-releases/${imported.stagedContentRelease.contentReleaseId}/activate`, { body: {} });
  const interfaces = ["rewrite", "original"];
  const widths = [1280, 390];
  await sendJson(`${workspaceUrl}/participant-roster`, { body: { rosterText:
    interfaces.flatMap(ui => widths.flatMap(width => cases.map(item => ({
      loginKey: `labels-${item.key}-${ui}-${width}`, groupKey: "owned-labels",
      bookletKey: `labels-${item.key}`, mode: "run-hot-return"
    }))))
  } });
  let passed = 0;
  for (const ui of interfaces) for (const width of widths) for (const item of cases) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    try {
      const page = await context.newPage();
      const errors = [];
      let operatorLeaks = 0;
      page.on("pageerror", error => errors.push(String(error)));
      page.on("request", request => {
        if (operatorToken && request.url().includes("/api/v1/participant/") &&
            request.headers().authorization === `Bearer ${operatorToken}`) operatorLeaks++;
      });
      await page.goto(`${baseUrl}/app/participant?${new URLSearchParams({ ui, tenantKey, workspaceKey })}`, {
        waitUntil: "networkidle"
      });
      const loginKey = `labels-${item.key}-${ui}-${width}`;
      if (ui === "original") await page.getByLabel("Anmeldename", { exact: true }).fill(loginKey);
      else await page.locator("#participantLoginKey").fill(loginKey);
      const signingIn = page.waitForResponse(response => new URL(response.url()).pathname === "/api/v1/participant/auth/sign-in");
      // A single assigned Booklet enters automatically through real UI login.
      const resuming = page.waitForResponse(response => /\/sessions\/[^/]+\/resume$/.test(new URL(response.url()).pathname));
      if (ui === "original") await page.getByRole("button", { name: "Weiter", exact: true }).click();
      else await page.locator("#participantRouteSignInButton").click();
      const signedIn = await signingIn;
      assert.equal(signedIn.status(), 200);
      const identity = await signedIn.json();
      assert.notEqual(identity.sessionToken, operatorToken);
      const resumed = await resuming;
      assert.equal(resumed.status(), 200);
      const runId = (await resumed.json()).testRun.testRunId;
      const readState = async () => {
        const response = await globalThis.fetch(`${baseUrl}/api/v1/participant/sessions/${identity.participantSession.participantSessionId}/current-state?testRunId=${runId}`, {
          headers: { authorization: `Bearer ${identity.sessionToken}` }
        });
        assert.equal(response.status, 200);
        return (await response.json()).currentRunState;
      };
      const playerOwner = page.locator("#participantVeronaPlayerFrame");
      const waitForPlayer = () => page.locator("#participantVeronaPlayerVersion").filter({ hasText: "API 6.0" })
        .waitFor({ state: ui === "original" ? "attached" : "visible" });
      const assertLabels = async (full, short, position) => {
        await page.waitForFunction(expected => document.querySelector("#participantVeronaPlayerFrame")?.getAttribute("title") === expected, full);
        const chosen = mode => mode === "short" ? short || full : mode === "booklet" ? `Label booklet ${item.key}` : full;
        const assertText = async (selector, expected) => {
          await page.waitForFunction(({ selector, expected }) =>
            document.querySelector(selector)?.textContent?.trim().replace(/\s+/g, " ") === expected,
          { selector, expected });
          assert.equal((await page.locator(selector).textContent()).trim().replace(/\s+/g, " "), expected);
        };
        await assertText(ui === "original" ? "#participantApplicationHeader h1" : "#participantRouteScreenHeader", chosen(item.header));
        const toolbarSelector = ui === "original" ? '#originalPlayerToolbar [data-cy="unit-title"]' : "#participantRouteUnit";
        if (item.toolbar === "hidden") assert.equal(await page.locator(toolbarSelector).count(), 0);
        else await assertText(toolbarSelector, chosen(item.toolbar));
        const navigationSelector = ui === "original" ? "#originalUnitNavigation-label" : "#participantRouteUnitNavigationLabel";
        if (item.nav === "hidden") assert.equal(await page.locator(navigationSelector).count(), 0);
        else await assertText(navigationSelector, item.nav === "index"
          ? ui === "original" ? `Aufgabe ${position}/2` : `Unit ${position} / 2` : chosen(item.nav));
        assert.equal(await playerOwner.getAttribute("title"), full, "Short labels must not replace Verona metadata.");
      };
      await waitForPlayer();
      await assertLabels(fullA, shortA, 1);
      const initial = await readState();
      assert.equal(initial.bookletUnits[0].shortLabel, shortA);
      assert.equal(initial.bookletUnits[1].shortLabel, undefined);
      await playerOwner.scrollIntoViewIfNeeded();
      await playerOwner.screenshot();
      await page.frameLocator("#participantVeronaPlayerFrame").locator('[data-cy="TestController-radio1-Aufg1"]').check();
      let saved;
      const deadline = Date.now() + 15_000;
      while (Date.now() < deadline) {
        const raw = (await readState()).testRun.unitResponses.a;
        if (raw && JSON.parse(raw).unitState?.dataParts?.answers?.includes("VALUE_CHANGED")) { saved = raw; break; }
        await delay(100);
      }
      assert.ok(saved, "Native Player input must be durably saved.");
      await page.locator(ui === "original" ? "#participantVeronaGlobalForwardButton" : "#participantRouteNextUnitButton").click();
      await assertLabels(fullB, undefined, 2);
      await page.locator(ui === "original" ? "#participantVeronaGlobalBackwardButton" : "#participantRoutePreviousUnitButton").click();
      await assertLabels(fullA, shortA, 1);
      assert.equal((await readState()).testRun.unitResponses.a, saved);
      await page.reload({ waitUntil: "networkidle" });
      await waitForPlayer();
      await assertLabels(fullA, shortA, 1);
      const restored = await readState();
      assert.equal(restored.testRun.testRunId, runId);
      assert.equal(restored.testRun.unitResponses.a, saved);
      assert.equal(await page.frameLocator("#participantVeronaPlayerFrame").locator('[data-cy="TestController-radio1-Aufg1"]').isChecked(), true);
      assert.equal(operatorLeaks, 0);
      assert.deepEqual(errors, []);
      report(`unit_labels=${ui}/${width}/${item.key}:passed`);
      passed++;
    } finally {
      await context.close();
    }
  }
  assert.equal(passed, cases.length * interfaces.length * widths.length);
  report(`unit_labels_cases_passed=${passed}`);
}
