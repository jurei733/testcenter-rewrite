import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

// Source geometry: IQB Testcenter c35cff81 starter/test-card and styles.css.
// Own the API/SQLite. Never consume or reset the interactive participant DB.
const frontendRoot = resolve(process.env.UI_SMOKE_FRONTEND_ROOT || ".");
await access(join(frontendRoot, "dist/apps/web/browser/index.html"));
const artifacts = await mkdtemp(join(tmpdir(), "testcenter-original-participant-starter-"));
process.stdout.write(`owned_artifacts=${artifacts}\n`);
const apiModule = pathToFileURL(resolve("apps/api/dist/apps/api/src/index.js")).href;
const server = spawn(process.execPath, ["--input-type=module", "-e", `
  import { createProductionApiServer } from ${JSON.stringify(apiModule)};
  const server = await createProductionApiServer();
  server.listen(0, "127.0.0.1", () => process.send({ port: server.address().port }));
  process.once("SIGTERM", () => server.close(() => process.exit(0)));
`], {
  cwd: frontendRoot,
  env: { ...process.env, PORT: "4310", FIRST_SLICE_STORE: "sqlite",
    FIRST_SLICE_SQLITE_FILE: join(artifacts, "store.sqlite"), FIRST_SLICE_BOOTSTRAP_DEMO: "true",
    FIRST_SLICE_OPERATOR_AUTH_REQUIRED: "true", FIRST_SLICE_PROOF_OF_WORK_SCOPES: "",
    FIRST_SLICE_XML_SCHEMA_PROFILE: "legacy-compatibility", REQUIRE_LOGIN_PASSWORD: "false" },
  stdio: ["ignore", "ignore", "inherit", "ipc"]
});
let browser;
const errors = [];
const metrics = {};
const closeEnough = (actual, expected, name) =>
  assert.ok(Math.abs(actual - expected) <= 1 / 32, `${name}: ${actual} != ${expected}`);
const labels = ["Alpha Booklet", "Beta Booklet", "Gamma Booklet"];
const actionTexts = {
  booklet_starterStartTestButtonLabel: "Los geht’s",
  booklet_starterContinueTestButtonLabel: "Jetzt fortsetzen",
  booklet_starterLockedTestButtonLabel: "Teil abgeschlossen"
};
try {
  const port = await new Promise((done, reject) => {
    const timer = setTimeout(() => reject(new Error("Owned API startup timed out.")), 20_000);
    server.once("message", message => { clearTimeout(timer); done(message.port); });
    server.once("error", error => { clearTimeout(timer); reject(error); });
    server.once("exit", () => { clearTimeout(timer); reject(new Error("Owned API exited before ready.")); });
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  let token;
  const api = async (path, body, method = body === undefined ? "GET" : "POST") => {
    const response = await fetch(`${baseUrl}${path}`, { method,
      headers: { ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(token ? { authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    assert.ok(response.ok, `${method} ${path}: ${response.status}`);
    return response.status === 204 ? null : response.json();
  };
  token = (await api("/api/v1/admin/auth/sign-in", {
    username: "demo-admin", password: "demo-admin-password"
  })).sessionToken;
  const operatorToken = token;
  const fixtures = {};
  for (const state of ["fresh", "mixed", "long", "review"]) {
    const workspaceKey = `original-starter-${state}`;
    const names = state === "long" ? [
      "Eine längere Bezeichnung mit mehreren Worten, die die verfügbare Breite der Original-Karte überschreitet und vollständig umbricht.",
      `UntrennbaresTestheft${"a".repeat(140)}`, labels[2]
    ] : labels;
    await api("/api/v1/tenants/demo-tenant/workspaces", { workspaceKey, displayName: `Starter ${state}` });
    const workspace = `/api/v1/tenants/demo-tenant/workspaces/${workspaceKey}`;
    const source = await api(`${workspace}/source-packages`, {
      fileName: "starter.json", mediaType: "application/json",
      contentStructure: { bookletEntries: names.map((displayLabel, index) => ({
        bookletKey: `reference-${index}`, displayLabel,
        unitEntries: [{ unitKey: `reference-unit-${index}`, displayLabel: `Unit ${index}` }]
      })) }
    });
    const imported = await api(`${workspace}/import-jobs`, { sourcePackageId: source.sourcePackage.sourcePackageId });
    await api(`${workspace}/content-releases/${imported.stagedContentRelease.contentReleaseId}/activate`, {
      activatedByActorId: "owned-starter-smoke"
    });
    const texts = state === "mixed" ? actionTexts : {};
    await api(`${workspace}/participant-roster`, {
      rosterText: `<Testtakers><CustomTexts>${Object.entries(texts).map(([key, value]) =>
        `<CustomText key="${key}">${value}</CustomText>`).join("")}</CustomTexts>` +
        `<Group id="reference" label="Reference"><Login mode="${state === "review" ? "run-review" : "run-hot-return"}" name="starter-smoke">` +
        names.map((_, index) => `<Booklet>reference-${index}</Booklet>`).join("") +
        "</Login></Group></Testtakers>"
    });
    if (state === "mixed") {
      const identity = await api("/api/v1/participant/auth/sign-in", {
        tenantKey: "demo-tenant", workspaceKey, loginKey: "starter-smoke"
      });
      token = identity.sessionToken;
      const sessionPath = `/api/v1/participant/sessions/${identity.participantSession.participantSessionId}`;
      // Seed completed first: this checks the renderer, not the still-open
      // multi-Booklet switching requirement recorded separately in PARITY.md.
      const second = await api(`${sessionPath}/resume`, { bookletKey: "reference-1" });
      await api(`/api/v1/participant/test-runs/${second.testRun.testRunId}/save-progress`, {
        currentUnitKey: "reference-unit-1", unitResponse: "Owned completed starter answer", status: "running"
      });
      await api(`/api/v1/participant/test-runs/${second.testRun.testRunId}/complete`, {});
      const first = await api(`${sessionPath}/resume`, { bookletKey: "reference-0" });
      await api(`/api/v1/participant/test-runs/${first.testRun.testRunId}/save-progress`, {
        currentUnitKey: "reference-unit-0", unitResponse: "Owned exact continuing starter answer", status: "running"
      });
      await api(`/api/v1/participant/test-runs/${first.testRun.testRunId}/return-to-starter`, {});
      fixtures[state] = { workspaceKey, names, sessionPath, firstRun: first.testRun.testRunId };
      token = operatorToken;
    } else fixtures[state] = { workspaceKey, names };
  }
  const headful = ["1", "true", "yes", "on"].includes(String(process.env.UI_SMOKE_HEADFUL || "").toLowerCase());
  browser = await chromium.launch({ headless: process.env.CI === "true" && !headful });
  for (const theme of ["Primar", "Sekundar", "Erwachsene"]) {
    await api("/api/v1/admin/application-settings", { themeName: theme }, "PATCH");
    for (const [state, fixture] of Object.entries(fixtures)) {
      for (const [screen, width, height] of [
        ["desktop", 1280, 720], ["mobile", 390, 844], ["toolbar-small", 599, 844], ["toolbar-large", 600, 844]
      ]) {
        const context = await browser.newContext({ viewport: { width, height }, locale: "de-DE" });
        const page = await context.newPage();
        page.on("pageerror", error => errors.push(String(error)));
        await page.goto(`${baseUrl}/app/participant?ui=original&tenantKey=demo-tenant&workspaceKey=${fixture.workspaceKey}`, { waitUntil: "networkidle" });
        await page.getByLabel("Anmeldename", { exact: true }).fill("starter-smoke");
        const signedIn = page.waitForResponse(response =>
          new URL(response.url()).pathname === "/api/v1/participant/auth/sign-in" && response.request().method() === "POST");
        await page.getByRole("button", { name: "Weiter", exact: true }).click();
        const identityResponse = await signedIn;
        assert.equal(identityResponse.status(), 200);
        const identity = await identityResponse.json();
        assert.notEqual(identity.sessionToken, operatorToken);
        const root = page.locator("#originalParticipantStarter");
        await root.locator("mat-card").first().waitFor();
        await page.locator("#originalParticipantAccountButton").waitFor();
        await page.evaluate(() => document.fonts.ready);
        const id = `${theme}-${state}-${screen}`;
        const geometry = await root.evaluate(element => {
          const rect = node => {
            const box = node.getBoundingClientRect();
            return { x: box.x, y: box.y, width: box.width, height: box.height };
          };
          const intro = element.querySelector(".intro");
          const cards = [...element.querySelectorAll("mat-card")];
          const stage = element.closest(".participant-stage");
          const review = element.querySelector("#originalDownloadReviews");
          const scroll = element.querySelector(".scroll-button");
          return {
            root: rect(element), intro: rect(intro), introGap: getComputedStyle(intro).gap,
            companion: rect(intro.querySelector(".companion-image")),
            introParagraphs: [...intro.querySelectorAll("p")].map(paragraph => ({
              ...rect(paragraph), lineHeight: getComputedStyle(paragraph).lineHeight,
              margins: [getComputedStyle(paragraph).marginTop, getComputedStyle(paragraph).marginBottom]
            })),
            cardContainer: rect(element.querySelector(".cards")),
            cardGap: getComputedStyle(element.querySelector(".cards")).gap,
            cards: cards.map(card => {
              const style = getComputedStyle(card);
              const button = card.querySelector("button");
              const icon = card.querySelector(".mat-icon");
              return { ...rect(card), key: card.dataset.bookletKey, status: card.dataset.bookletStatus,
                paragraph: rect(card.querySelector("mat-card-header p")),
                paragraphLineHeight: getComputedStyle(card.querySelector("p")).lineHeight,
                actions: rect(card.querySelector("mat-card-actions")),
                label: button.innerText.trim(), disabled: button.disabled,
                buttonOpacity: getComputedStyle(button).opacity,
                icon: rect(icon), iconOverflow: getComputedStyle(icon).overflow,
                border: style.borderTopWidth, borderStyle: style.borderTopStyle,
                borderColor: style.borderTopColor, radius: style.borderRadius,
                primary: getComputedStyle(document.documentElement).getPropertyValue("--mat-sys-primary").trim(),
                padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft], gap: style.gap };
            }),
            stage: { ...rect(stage), overflowY: getComputedStyle(stage).overflowY,
              clientWidth: stage.clientWidth, scrollTop: stage.scrollTop,
              maxScroll: stage.scrollHeight - stage.clientHeight },
            page: { ...rect(document.querySelector(".page")), overflow: getComputedStyle(document.querySelector(".page")).overflow },
            sentinelHeight: element.querySelector(".sentinel").getBoundingClientRect().height,
            toolbarHeight: document.querySelector("#participantApplicationHeader").getBoundingClientRect().height,
            account: rect(document.querySelector("#originalParticipantAccountButton")),
            accountStyle: {
              display: getComputedStyle(document.querySelector("#originalParticipantAccountButton")).display,
              weight: getComputedStyle(document.querySelector("#originalParticipantAccountButton")).fontWeight,
              size: getComputedStyle(document.querySelector("#originalParticipantAccountButton")).fontSize,
              svgSizing: getComputedStyle(document.querySelector("#originalParticipantAccountButton svg")).boxSizing
            },
            review: review && { ...rect(review), border: getComputedStyle(review).borderTopWidth,
              borderStyle: getComputedStyle(review).borderTopStyle },
            scroll: scroll && { ...rect(scroll), font: getComputedStyle(scroll).fontFamily,
              icon: rect(scroll.querySelector(".mat-icon")) }
          };
        });
        metrics[id] = geometry;
        await writeFile(join(artifacts, "metrics.json"), JSON.stringify(metrics, null, 2));
        assert.equal(geometry.toolbarHeight, width < 600 ? 56 : 64);
        assert.deepEqual(geometry.account, { x: 24, y: (geometry.toolbarHeight - 40) / 2, width: 40, height: 40 });
        assert.deepEqual(geometry.accountStyle, { display: "block", weight: "400", size: "24px", svgSizing: "content-box" });
        assert.equal(geometry.page.height, height);
        assert.equal(geometry.page.overflow, "hidden");
        assert.equal(geometry.stage.overflowY, "auto");
        assert.equal(geometry.cardContainer.width, 684);
        // Linux may reserve a non-overlay scrollbar; center in the actual
        // Source scrolling content box, not the operating system's viewport.
        closeEnough(geometry.root.width, geometry.stage.clientWidth, "Source scrolling content width");
        closeEnough(geometry.cardContainer.x, geometry.root.x + (geometry.root.width - 684) / 2, "Source intrinsic-width centering");
        assert.equal(geometry.intro.width, 684);
        assert.equal(geometry.introGap, "24px");
        assert.equal(geometry.cardGap, "24px");
        assert.deepEqual([geometry.companion.width, geometry.companion.height], [94, 94]);
        closeEnough(geometry.intro.height, Math.max(94,
          geometry.introParagraphs.reduce((sum, paragraph) => sum + paragraph.height + 32, 0)), "Source flex-column intro");
        for (const paragraph of geometry.introParagraphs) {
          assert.equal(paragraph.lineHeight, "normal");
          assert.deepEqual(paragraph.margins, ["16px", "16px"]);
        }
        assert.equal(geometry.cards.length, 3);
        for (const [index, card] of geometry.cards.entries()) {
          assert.equal(card.key, `reference-${index}`);
          assert.equal(card.width, 684);
          assert.equal(card.border, "1px");
          assert.equal(card.borderStyle, "solid");
          assert.equal(card.radius, "4px");
          assert.deepEqual(card.padding, ["16px", "24px", "16px", "24px"]);
          assert.equal(card.gap, "24px");
          assert.equal(card.paragraphLineHeight, "normal");
          assert.equal(card.actions.height, 56);
          closeEnough(card.height, card.paragraph.height + 32 + 56 + 32 + 2, "Source card height");
          assert.equal(card.icon.width, 18);
          assert.ok(card.icon.height >= 18 && card.icon.height < 27);
          assert.equal(card.iconOverflow, "hidden");
          assert.equal(card.buttonOpacity, "1");
          if (index) closeEnough(card.y - geometry.cards[index - 1].y - geometry.cards[index - 1].height, 24, "Source card gap");
        }
        assert.equal(geometry.sentinelHeight, 1);
        if (state === "mixed") {
          assert.deepEqual(geometry.cards.map(card => [card.status, card.label, card.disabled]), [
            ["in_progress", actionTexts.booklet_starterContinueTestButtonLabel, false],
            ["completed", actionTexts.booklet_starterLockedTestButtonLabel, true],
            ["available", actionTexts.booklet_starterStartTestButtonLabel, false]
          ]);
        } else {
          assert.deepEqual(geometry.cards.map(card => [card.status, card.label, card.disabled]),
            labels.map(() => ["available", "Starten", false]));
        }
        assert.equal(Boolean(geometry.review), state === "review");
        if (geometry.review) {
          assert.equal(geometry.review.border, "1px");
          assert.equal(geometry.review.borderStyle, "solid");
          assert.equal(geometry.review.height, 40);
        }
        await page.screenshot({ path: join(artifacts, `${id}.png`), animations: "disabled" });
        if (geometry.stage.maxScroll > 1) {
          const scroll = root.getByRole("button", { name: "Unten geht es weiter", exact: true });
          await scroll.waitFor();
          assert.equal(await scroll.getAttribute("aria-controls"), "originalStarterBottomSentinel");
          await scroll.focus();
          await page.evaluate(() => {
            const stage = document.querySelector("#originalParticipantStarter").closest(".participant-stage");
            const original = stage.scrollBy.bind(stage);
            stage.starterScrollCalls = [];
            stage.scrollBy = options => { stage.starterScrollCalls.push(options); original(options); };
          });
          await page.keyboard.press("Enter");
          await page.waitForFunction(() => {
            const stage = document.querySelector("#originalParticipantStarter").closest(".participant-stage");
            // Source removes the scroll button once the sentinel is visible;
            // that shrinks the intrinsic content and can reduce maxScroll.
            const expected = Math.min(300, stage.scrollHeight - stage.clientHeight);
            return stage.scrollTop > 0 && Math.abs(stage.scrollTop - expected) <= 1;
          });
          assert.deepEqual(await page.evaluate(() => document.querySelector("#originalParticipantStarter")
            .closest(".participant-stage").starterScrollCalls), [{ top: 300, behavior: "smooth" }]);
        }
        if (theme === "Primar" && screen === "desktop" && state === "mixed") {
          await page.locator("#originalParticipantAccountButton").hover();
          closeEnough((await page.locator("#originalParticipantAccountButton").boundingBox()).y, geometry.account.y, "Source account hover must not lift");
          const path = `/api/v1/participant/sessions/${identity.participantSession.participantSessionId}/resume`;
          let requested = 0;
          let release;
          const gate = new Promise(done => { release = done; });
          let observeRequest;
          const requestSeen = new Promise(done => { observeRequest = done; });
          await context.route(`**${path}`, async route => {
            requested++;
            observeRequest();
            await gate;
            await route.continue();
          });
          const resume = root.getByRole("button", { name: actionTexts.booklet_starterContinueTestButtonLabel, exact: true });
          await resume.click();
          await root.getByRole("button", { name: "Bitte warten …", exact: true }).waitFor();
          await Promise.race([requestSeen, delay(10_000).then(() => { throw new Error("Starter resume did not reach the owned boundary."); })]);
          assert.deepEqual(await root.locator("mat-card button").evaluateAll(buttons => buttons.map(button => button.disabled)), [true, true, true]);
          await page.keyboard.press("Enter");
          assert.equal(requested, 1, "A pending starter submit must not issue a duplicate request.");
          const resumed = page.waitForResponse(response => new URL(response.url()).pathname === path);
          release();
          const response = await resumed;
          assert.equal(response.status(), 200);
          assert.equal(requested, 1);
          const payload = await response.json();
          assert.equal(payload.testRun.testRunId, fixture.firstRun);
          assert.deepEqual(payload.testRun.unitResponses, {
            "reference-unit-0": "Owned exact continuing starter answer"
          });
          await root.waitFor({ state: "detached" });
          await context.unroute(`**${path}`);
        }
        if (theme === "Primar" && screen === "desktop" && state === "review") {
          const path = `/api/v1/participant/sessions/${identity.participantSession.participantSessionId}/exports/reviews.csv`;
          const downloaded = page.waitForResponse(response => new URL(response.url()).pathname === path);
          await root.getByRole("button", { name: "Reviews downloaden", exact: true }).click();
          const response = await downloaded;
          assert.equal(response.status(), 204);
          assert.equal((await response.request().allHeaders()).authorization, `Bearer ${identity.sessionToken}`);
          await root.getByRole("status").filter({ hasText: "Keine Kommentare verfügbar." }).waitFor();
          // This exercises shared export authorization, not the still-open
          // Source snackbar/feedback rendering acceptance.
        }
        assert.equal(await page.evaluate(() => Object.keys(localStorage).some(key =>
          localStorage.getItem(key)?.includes("demo-admin-password"))), false);
        await context.close();
        process.stdout.write(`original_starter=${id}:passed\n`);
      }
    }
  }
  await writeFile(join(artifacts, "metrics.json"), JSON.stringify(metrics, null, 2));
  assert.deepEqual(errors, []);
  process.stdout.write("Original starter: 48 geometry/state fixtures, exact saved answer, pending guard, authorized empty review export.\n");
} finally {
  await browser?.close().catch(() => undefined);
  if (server.exitCode === null) {
    const stopped = new Promise(done => server.once("exit", done));
    server.kill("SIGTERM");
    await Promise.race([stopped, delay(5_000)]);
    if (server.exitCode === null) { server.kill("SIGKILL"); await stopped; }
  }
  process.stdout.write("owned_api=shutdown\n");
}
