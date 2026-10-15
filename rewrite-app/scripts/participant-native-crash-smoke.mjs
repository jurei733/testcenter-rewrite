import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import { parseVeronaUnitResponse } from "@testcenter-rewrite-app/contracts";

// Effectful terminal commands are not answer outbox records. Without a proven
// document handoff, reentry reads the server and requires a new command.
export async function verifyParticipantNativeCrashRecovery({ base, workspaceKey, api, repository,
  artifacts, track, mark, observations }) {
  const prefix = "testcenter-rewrite:participant-native-command:v1:";
  const ownerKey = "testcenter-rewrite:participant-native-owner:v1";
  const markerKey = "testcenter-rewrite:owned-native-crash-probe";
  const answers = run => ({ responses: run.unitResponses, clocks: run.unitResponseFieldTimestamps });
  const journal = page => page.evaluate(prefix => Object.fromEntries(Object.keys(localStorage)
    .filter(key => key.startsWith(prefix)).map(key => [key, localStorage.getItem(key)])), prefix);
  const methods = page => page.waitForFunction(() => ["debug", "pause", "resume", "terminate", "goto"]
    .every(key => typeof window.tc?.[key] === "function"));
  const player = page => page.frameLocator("iframe").locator("#demoPlayerAnswer");
  const command = (page, keyword, args = []) => page.evaluate(({ keyword, args }) => window.tc[keyword](args), { keyword, args });
  const poll = async (predicate, message, timeoutMs = 20_000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) { if (await predicate()) return; await delay(50); }
    throw Error(message);
  };
  const launch = (profile, extension) => chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: process.env.CI === "true" && process.env.UI_SMOKE_HEADFUL !== "true",
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
    // Use ordinary Chromium session behavior for the restore probe.
    ignoreDefaultArgs: ["--disable-extensions", "--enable-automation"],
    viewport: { width: 1280, height: 720 }, locale: "de-DE"
  });

  for (const kind of ["queued", "committed"]) {
    const profile = await mkdtemp(join(artifacts, `owned-${kind}-profile-`));
    const extension = join(profile, "owned-session-restore-extension"); await mkdir(extension);
    await writeFile(join(extension, "manifest.json"), JSON.stringify({ manifest_version: 3,
      name: "Owned browser session recovery probe", version: "1.0", permissions: ["sessions"],
      background: { service_worker: "background.js" } }));
    await writeFile(join(extension, "background.js"), "chrome.runtime.onInstalled.addListener(() => {});\nchrome.sessions.onChanged.addListener(() => {});\n");
    let initial, recovered, activePage, crashed = false, releaseReceipt, journalEnumerationChanged = false,domStorageProbe;
    const requests = [], replies = [], completionRequests = [];
    const receiptGate = new Promise(done => { releaseReceipt = done; });
    const observe = (page, phase) => {
      track(page, `crash-${kind}-${phase}`);
      page.on("request", request => {
        if (new URL(request.url()).pathname.endsWith("/native-commands")) requests.push({ phase, request: request.postDataJSON() });
        if (new URL(request.url()).pathname.endsWith("/command-completions")) completionRequests.push({ phase, request: request.postDataJSON() });
      });
    };
    try {
      initial = await launch(profile, extension);
      const page = initial.pages()[0] ?? await initial.newPage(); activePage = page; observe(page, "before");
      await page.goto(`${base}/app/participant?ui=original&tenantKey=demo-tenant&workspaceKey=${workspaceKey}`, { waitUntil: "networkidle" });
      await page.locator("#originalLoginName").fill(`native-crash-${kind}`);
      const signedIn = page.waitForResponse(response => new URL(response.url()).pathname.endsWith("/auth/sign-in") && response.request().method() === "POST");
      await page.getByRole("button", { name: "Weiter", exact: true }).click();
      const identity = await (await signedIn).json();
      const path = `/api/v1/participant/sessions/${identity.participantSession.participantSessionId}/current-state`;
      const read = async runId => (await api(path + (runId ? `?testRunId=${encodeURIComponent(runId)}` : ""), undefined, identity.sessionToken)).currentRunState.testRun;
      await page.locator('#originalParticipantStarter mat-card[data-booklet-key="first"] button').click();
      await player(page).waitFor(); await methods(page);
      const run = await read();let answer = `Trusted ${kind} crash answer Ω`;
      await player(page).fill(answer);
      await poll(async () => parseVeronaUnitResponse((await read(run.testRunId)).unitResponses["first-1"])?.unitState.dataParts.answer === answer, "Trusted pre-crash answer was not saved");
      let saved = answers(await read(run.testRunId));const entryUrl = page.url();
      assert.ok(saved.responses["first-1"]);
      assert.ok(saved.clocks?.["first-1"], "The trusted pre-crash response has no captured field clocks");
      assert.equal(run.currentUnitKey, "first-1");
      assert.notEqual(run.locked, true);

      if (kind === "queued") {
        await initial.route("**/native-commands", route => route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"owned_temporarily_unavailable"}' }));
        await command(page, "terminate", ["lock"]);
        await poll(async () => Object.values(await journal(page)).some(raw => JSON.parse(raw).prepared), "The first offline native packet was not prepared");
        // Goto and Resume do not wait for saved buffers in the Original.
        // Keep the prepared terminal packet, reopen the local controller, then
        // capture a new answer in another Terminate's own saved-event barrier.
        await command(page, "resume");
        await poll(async () => Object.values(await journal(page)).some(raw => { const entry = JSON.parse(raw); return entry.keyword === "resume" && entry.prepared; }), "The offline Resume was not prepared independently");
        let answerCommitted=false;
        await initial.route("**/save-progress",async route=>{
          const response=await route.fetch();assert.equal(response.status(),200);answerCommitted=true;
          await receiptGate;await route.fulfill({response}).catch(()=>{});
        });
        answer += " | drain gate";await player(page).fill(answer);
        await poll(()=>Promise.resolve(answerCommitted),"The trusted preparation receipt was not committed and held");
        saved=answers(await read(run.testRunId));
        assert.equal(parseVeronaUnitResponse(saved.responses['first-1'])?.unitState.dataParts.answer,answer);
        await command(page, "terminate", ["lock"]);
        await poll(async () => Object.values(await journal(page)).some(raw => { const entry = JSON.parse(raw); return entry.keyword === "terminate" && !entry.prepared; }), "The second terminal intent did not retain its own answer barrier");
      } else {
        await initial.route("**/native-commands", async route => {
          const response = await route.fetch(), body = await response.json(); replies.push(body);
          await receiptGate;
          await route.fulfill({ response }).catch(() => {});
        });
        await command(page, "pause");
      }
      await poll(async () => Object.values(await journal(page)).some(raw => JSON.parse(raw).prepared), "Pre-crash native command was not prepared");
      if (kind === "committed") await poll(() => Promise.resolve(replies.some(body => body.application?.applied)), "The held receipt did not commit on the server");
      const oldJournal = await journal(page), entries = Object.values(oldJournal).map(raw => JSON.parse(raw));
      assert.equal(entries.length, kind === "queued" ? 3 : 1);
      assert.ok(entries.some(entry => entry.prepared));
      if (kind === "queued") {
        assert.ok(entries.some(entry => entry.keyword === "terminate" && entry.prepared));
        assert.deepEqual(entries.filter(entry => !entry.prepared).map(entry => entry.keyword), ["terminate"]);
      }
      const oldOwner = await page.evaluate(key => sessionStorage.getItem(key), ownerKey);
      assert.ok(entries.every(entry => entry.owner === oldOwner && entry.scope.testRunId === run.testRunId));
      assert.ok(!JSON.stringify(oldJournal).includes(identity.sessionToken), "The native journal contains a credential");
      const before = await read(run.testRunId);
      assert.equal(before.status, kind === "queued" ? "running" : "paused");
      assert.deepEqual(answers(before), saved);
      await page.evaluate(markerKey => {
        localStorage.setItem(markerKey, "armed-without-pagehide");
        sessionStorage.setItem(markerKey, "original-tab-session");
        addEventListener("pagehide", () => localStorage.setItem(markerKey, "pagehide-fired"), { once: true });
      }, markerKey);
      // Use the existing browser-outbox gate's DOM-storage settlement window,
      // then crash the entire owned browser process without closing its page.
      await delay(6_000);
      // Browser preferences have a separate delayed disk commit. A fresh
      // profile must really record its open/crashed session before the kill;
      // otherwise Chrome treats the next launch as a clean first startup.
      await poll(async () => {
        try { return JSON.parse(await readFile(join(profile, "Default", "Preferences"), "utf8")).profile?.exit_type === "Crashed"; }
        catch { return false; }
      }, "Chromium did not persist its open session before the crash");
      // Chromium rate-limits later localStorage commits to 60 per hour.
      // Observe the later marker on disk instead of assuming a six-second
      // delay flushes a batch created after the profile's first commit.
      await poll(async()=>{
        const directory=join(profile,'Default','Local Storage','leveldb');
        domStorageProbe={directory,files:[],liveMarkerRetained:await page.evaluate(key=>localStorage.getItem(key)==='armed-without-pagehide',markerKey)};
        assert.equal(domStorageProbe.liveMarkerRetained,true,'The live participant document lost its marker before the crash');
        try{for(const name of await readdir(directory)){
          if(!/\.(?:log|ldb|sst)$/.test(name))continue;
          const bytes=await readFile(join(directory,name));
          domStorageProbe.files.push({name,bytes:bytes.length,applicationPrefixSeen:bytes.includes(Buffer.from('testcenter-rewrite')),
            ownerKeySeen:bytes.includes(Buffer.from(ownerKey)),markerKeySeen:bytes.includes(Buffer.from(markerKey))});
          if(bytes.includes(Buffer.from('armed-without-pagehide'))||bytes.includes(Buffer.from('armed-without-pagehide','utf16le')))return true;
        }}catch{}
        return false;
      },'The crash marker did not reach the owned DOM-storage files',90_000);
      const browser = initial.browser(); assert.ok(browser);
      const disconnected = new Promise((done, reject) => {
        const timer = setTimeout(() => reject(Error("Owned browser did not crash")), 15_000);
        browser.once("disconnected", () => { clearTimeout(timer); done(); });
      });
      const cdp = await browser.newBrowserCDPSession();
      void cdp.send("Browser.crash").catch(() => {});
      await disconnected; crashed = true; releaseReceipt();

      recovered = await launch(profile, extension);
      recovered.on("page", page => track(page, `crash-${kind}-after`));
      recovered.on("request", request => {
        if (new URL(request.url()).pathname.endsWith("/native-commands")) requests.push({ phase: "after", request: request.postDataJSON() });
      });
      // Chrome deliberately avoids automatic restore loops after a crash.
      // Invoke its real session restore API, without injecting any app storage.
      const worker = recovered.serviceWorkers().find(worker => worker.url().startsWith("chrome-extension://")) ??
        await recovered.waitForEvent("serviceworker", worker => worker.url().startsWith("chrome-extension://"));
      await poll(async () => (await worker.evaluate(() => chrome.sessions.getRecentlyClosed())).length > 0,
        "Chromium did not load its previous session for restoration");
      await worker.evaluate(() => chrome.sessions.restore());
      await poll(() => Promise.resolve(recovered.pages().some(page => page.url().startsWith(base))), "Chromium did not restore the crashed participant tab");
      const reopened = recovered.pages().find(page => page.url().startsWith(base));
      assert.ok(reopened, "Chromium did not restore the crashed participant tab");
      activePage = reopened;
      // Let the restored document itself boot. Another goto here could cancel
      // an unsafe automatic replay before this gate had observed its effect.
      await reopened.waitForLoadState("networkidle"); await methods(reopened);
      assert.equal(new URL(reopened.url()).pathname, new URL(entryUrl).pathname);
      const restoredSessionMarker = await reopened.evaluate(key => sessionStorage.getItem(key), markerKey);
      assert.ok(restoredSessionMarker === null || restoredSessionMarker === "original-tab-session");
      assert.equal(await reopened.evaluate(key => localStorage.getItem(key), markerKey), "armed-without-pagehide");
      assert.notEqual(await reopened.evaluate(key => sessionStorage.getItem(key), ownerKey), oldOwner);
      // Cover a retry interval and an actual online wake-up on the reentered route.
      await reopened.evaluate(() => dispatchEvent(new Event("online"))); await delay(1_200);
      assert.deepEqual(requests.filter(request => request.phase === "after"), [], "An unproven pre-crash intent was replayed");
      assert.deepEqual(await journal(reopened), oldJournal, "Reentry modified another document's journal");
      const resumed = await read(run.testRunId);
      assert.equal(resumed.status, before.status); assert.equal(resumed.currentUnitKey, before.currentUnitKey);
      assert.equal(resumed.locked, before.locked); assert.deepEqual(answers(resumed), saved);
      assert.equal(new URL(reopened.url()).searchParams.get("testRunId"), run.testRunId);
      const oldContents = entries.map(entry => [entry.request.keyword, ...entry.request.arguments].join(' '));
      const persisted = await repository.listParticipantTestLogsByWorkspace(run.tenantId, run.workspaceId);
      const oldLogs = persisted.filter(log => log.testRunId === run.testRunId && log.logKey === "command executed" && oldContents.includes(log.logContent));
      const legacyCommitted = kind === "committed" && entries[0].request.commandCompletion !== 'browser-v1';
      assert.equal(oldLogs.length, legacyCommitted ? 1 : 0);
      assert.deepEqual(completionRequests.filter(item => item.request.command?.kind === 'native' && entries.some(entry => item.request.command.request.deliveryId === entry.id)), [],
        'An unfulfilled pre-crash handler fabricated a completion');
      if (kind === 'committed') assert.equal(persisted.filter(log => entries.some(entry => log.participantTestLogId.startsWith(`delivery:${run.testRunId}:console:${entry.id}:`)) &&
        log.logKey === 'CONTROLLER' && log.logContent === 'PAUSED').length, 1, 'The accepted pre-crash state effect was not retained');
      mark(`browser-process-crash-${kind}-reads-server-without-replaying-old-intents`);

      for (const keyword of kind === "queued" ? ["pause", "resume"] : ["resume"]) {
        await command(reopened, keyword);
        await poll(async () => (await read(run.testRunId)).status === (keyword === "pause" ? "paused" : "running"), "A fresh post-crash command did not apply");
        await poll(async () => {
          const current = await journal(reopened);
          const identical = Object.keys(current).length === Object.keys(oldJournal).length &&
            Object.entries(oldJournal).every(([key, bytes]) => current[key] === bytes);
          if (identical && JSON.stringify(current) !== JSON.stringify(oldJournal)) journalEnumerationChanged = true;
          return identical;
        }, "The fresh command did not settle independently of the old journal");
      }
      await player(reopened).waitFor();
      await poll(async () => await player(reopened).inputValue() === answer, "The restored Player did not receive its trusted saved answer");
      const fresh = requests.filter(request => request.phase === "after");
      assert.deepEqual(fresh.map(item => item.request.keyword), kind === "queued" ? ["pause", "resume"] : ["resume"]);
      assert.ok(fresh.every(item => entries.every(entry => entry.id !== item.request.deliveryId)));
      assert.deepEqual(answers(await read(run.testRunId)), saved);
      assert.deepEqual(await repository.listPendingParticipantRunCommands(run), []);
      await reopened.screenshot({ path: join(artifacts, `native-crash-${kind}-reentry.png`), fullPage: true });
      observations.push({ kind: `browser-process-crash-${kind}`, testRunId: run.testRunId, oldOwner,
        newOwner: await reopened.evaluate(key => sessionStorage.getItem(key), ownerKey), pagehideFired: false, browserTabRestored: true,
        originalTabSessionStorageRetained: restoredSessionMarker === "original-tab-session",
        restoreMethod: "chrome.sessions.restore",
        browserOpenSessionPersistedBeforeCrash: true,
        domStorageCrashMarkerObservedOnDiskBeforeCrash: true,
        journalEnumerationChanged,
        oldJournalEntries: entries.length, oldCommandExecutionLogs: oldLogs.length, oldJournalPreserved: true, freshRequests: fresh });
      mark(`browser-process-crash-${kind}-fresh-commands-retain-trusted-answers-and-clocks`);
    } catch (error) {
      await activePage?.screenshot({ path: join(artifacts, `native-crash-${kind}-failure.png`), fullPage: true }).catch(() => {});
      await writeFile(join(artifacts, `native-crash-${kind}-failure.json`), JSON.stringify({ error: String(error), stack: error.stack, requests,
        journal: await journal(activePage).catch(() => null),domStorageProbe }, null, 2));
      throw error;
    } finally {
      releaseReceipt(); await recovered?.close().catch(() => {});
      if (!crashed) await initial?.close().catch(() => {});
      // A browser profile contains participant credentials; keep observations,
      // never the profile itself, in the durable proof.
      await rm(profile, { recursive: true, force: true });
    }
  }
}
