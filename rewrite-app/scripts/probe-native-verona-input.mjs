import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {setTimeout as delay} from 'node:timers/promises';
const app=resolve('.');
const require=createRequire(app+'/package.json'),{chromium}=require('playwright');
const {createParticipantHttpTestActor}=await import('file://'+app+'/scripts/participant-http-test-actor.mjs');
const {drainSmokeResponse}=await import('file://'+app+'/scripts/drain-smoke-response.mjs');
const {raceWithSmokeDeadline}=await import('file://'+app+'/scripts/smoke-deadline.mjs');
const scratch=await mkdtemp(join(tmpdir(),'owned-shared-repro-'));console.log('owned_scratch='+scratch);
const artifacts=process.env.UI_SMOKE_ARTIFACT_DIR||scratch;await mkdir(artifacts,{recursive:true});
const actor=createParticipantHttpTestActor(),participantHttpActor=actor,fetch=actor.fetch;
let smokeAdminSessionToken='';
const module='file://'+app+'/apps/api/dist/apps/api/src/index.js';
const server=spawn(process.execPath,['--input-type=module','-e',`import{createProductionApiServer}from ${JSON.stringify(module)};
const server=await createProductionApiServer();server.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));
process.once('SIGTERM',()=>server.close(()=>process.exit(0)));`],{cwd:app,stdio:['ignore','ignore','inherit','ipc'],env:{...process.env,
FIRST_SLICE_STORE:'sqlite',FIRST_SLICE_SQLITE_FILE:join(scratch,'owned.sqlite'),FIRST_SLICE_BOOTSTRAP_DEMO:'true',
FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',FIRST_SLICE_PROOF_OF_WORK_SCOPES:'',FIRST_SLICE_XML_SCHEMA_PROFILE:'legacy-compatibility'}});
const closed=new Promise(done=>server.once('close',done));let browser,page;

const crc32Table = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc & 1) !== 0 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

const crc32 = content => {
  let crc = 0xffffffff;
  for (const byte of content) {
    crc = crc32Table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const createStoredZipBuffer = entries => {
  const localFileHeaders = [];
  const centralDirectoryHeaders = [];
  let offset = 0;

  for (const entry of entries) {
    const fileName = Buffer.from(entry.fileName, "utf8");
    const content = Buffer.from(entry.content, "utf8");
    const checksum = crc32(content);
    const localHeader = Buffer.alloc(30 + fileName.length);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt32LE(0, 10);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(content.length, 18);
    localHeader.writeUInt32LE(content.length, 22);
    localHeader.writeUInt16LE(fileName.length, 26);
    fileName.copy(localHeader, 30);
    localFileHeaders.push(localHeader, content);

    const centralDirectoryHeader = Buffer.alloc(46 + fileName.length);
    centralDirectoryHeader.writeUInt32LE(0x02014b50, 0);
    centralDirectoryHeader.writeUInt16LE(20, 4);
    centralDirectoryHeader.writeUInt16LE(20, 6);
    centralDirectoryHeader.writeUInt16LE(0x0800, 8);
    centralDirectoryHeader.writeUInt16LE(0, 10);
    centralDirectoryHeader.writeUInt32LE(0, 12);
    centralDirectoryHeader.writeUInt32LE(checksum, 16);
    centralDirectoryHeader.writeUInt32LE(content.length, 20);
    centralDirectoryHeader.writeUInt32LE(content.length, 24);
    centralDirectoryHeader.writeUInt16LE(fileName.length, 28);
    centralDirectoryHeader.writeUInt32LE(offset, 42);
    fileName.copy(centralDirectoryHeader, 46);
    centralDirectoryHeaders.push(centralDirectoryHeader);

    offset += localHeader.length + content.length;
  }

  const centralDirectoryOffset = offset;
  const centralDirectory = Buffer.concat(centralDirectoryHeaders);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(entries.length, 8);
  endOfCentralDirectory.writeUInt16LE(entries.length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(centralDirectoryOffset, 16);

  return Buffer.concat([
    ...localFileHeaders,
    centralDirectory,
    endOfCentralDirectory
  ]);
};


const createSmokeFetchInit = url =>
  url && participantHttpActor.isParticipant(url)
    ? { headers: participantHttpActor.headers(url) }
    : smokeAdminSessionToken
    ? {
        headers: {
          authorization: `Bearer ${smokeAdminSessionToken}`
        }
      }
    : undefined;

const sendSmokeJson = async (url, { method = "POST", body } = {}) => {
  const response = await fetch(url, {
    method,
    headers: {
      "content-type": "application/json",
      ...(participantHttpActor.isParticipant(url)
        ? participantHttpActor.headers(url, body)
        : smokeAdminSessionToken
        ? { authorization: `Bearer ${smokeAdminSessionToken}` }
        : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(
      `Unexpected status ${response.status} for ${method} ${url}: ${await response.text()}`
    );
  }

  return response;
};

const sendSmokeJsonAndDrain = async (url, options) => {
  const response = await sendSmokeJson(url, options);
  try {
    await drainSmokeResponse(response);
  } catch (cause) {
    throw new Error(`Smoke fixture ${options?.method ?? "POST"} ${new URL(url).pathname} body drain failed`, { cause });
  }
};


const pollJsonWithPredicate = async (
  url,
  predicate,
  timeoutMs = 20_000,
  pollIntervalMs = 250
) => {
  const deadline = Date.now() + timeoutMs;
  let lastPayload = null;

  while (Date.now() < deadline) {
    const response = await fetch(url, createSmokeFetchInit(url));
    if (response.ok) {
      const payload = await response.json();
      lastPayload = payload;
      if (predicate(payload)) {
        return payload;
      }
    }
    await delay(pollIntervalMs);
  }

  const serializedPayload = JSON.stringify(lastPayload);
  const payloadPreview =
    serializedPayload.length <= 4_000
      ? serializedPayload
      : `${serializedPayload.slice(0, 4_000)}... (${serializedPayload.length} characters total)`;
  throw new Error(
    `Timed out waiting for predicate on ${url}. Last payload: ${payloadPreview}`
  );
};



try{
 const port=await raceWithSmokeDeadline(new Promise((done,reject)=>{server.once('message',message=>done(message.port));server.once('error',reject);server.once('exit',()=>reject(Error('API exited.')));}),20000,()=>{throw Error('API startup timed out.');});
 const baseUrl='http://127.0.0.1:'+port;
 smokeAdminSessionToken=(await(await sendSmokeJson(baseUrl+'/api/v1/admin/auth/sign-in',{body:{username:'demo-admin',password:'demo-admin-password'}})).json()).sessionToken;
 browser=await chromium.launch({headless:false});const context=actor.observeContext(await browser.newContext());
 page=await context.newPage();page.on('framedetached',frame=>console.log('frame_detached='+frame.url()));
 page.on('frameattached',frame=>console.log('frame_attached='+frame.url()));
 for(let trial=0;trial<10;trial++){
  const tenantKey='owned-shared-'+Date.now()+'-'+trial,workspaceKey=tenantKey;
  console.log('trial='+trial);
  const sharedParameterTenantKey = `${tenantKey}-verona-shared-parameters`;
  const sharedParameterWorkspaceKey =
    `${workspaceKey}-verona-shared-parameters`;
  const sharedParameterBookletKey = "shared-parameters-booklet";
  const sharedParameterFirstUnitKey = "shared-parameters-first";
  const sharedParameterSecondUnitKey = "shared-parameters-second";
  const sharedParameterPlayerKey = "shared-parameters-player@6.0";
  const sharedParameterLoginKey = "student-shared-parameters";
  const sharedParameterPlayerHtml = `<!doctype html>
    <html>
      <body>
        <p id="sharedParameterDefinition"></p>
        <pre id="sharedParameterConfig"></pre>
        <button id="sharedParameterPublish" type="button">Publish shared parameters</button>
        <button id="sharedParameterNext" type="button">Next unit</button>
        <script>
          let activeSessionId = "";
          let activeDefinition = "";
          const renderConfig = playerConfig => {
            document.querySelector("#sharedParameterConfig").textContent =
              JSON.stringify(playerConfig?.sharedParameters ?? []);
          };
          addEventListener("message", event => {
            const message = event.data;
            if (message?.type === "vopStartCommand") {
              activeSessionId = message.sessionId;
              activeDefinition = message.unitDefinition;
              document.querySelector("#sharedParameterDefinition").textContent =
                activeDefinition;
              renderConfig(message.playerConfig);
            }
            if (
              message?.type === "vopPlayerConfigChangedNotification" &&
              message.sessionId === activeSessionId
            ) {
              renderConfig(message.playerConfig);
            }
          });
          window.ownedSharedParameterClicks = [];
          window.ownedSharedParameterInputs=[];
          for(const type of ['pointerdown','pointerup','click'])document.addEventListener(type,event=>{
            window.ownedSharedParameterInputs.push({type,trusted:event.isTrusted,target:event.target.id,definition:activeDefinition,x:event.clientX,y:event.clientY,time:performance.now()});
          },true);
          document.querySelector("#sharedParameterPublish").addEventListener("click", event => {
            window.ownedSharedParameterClicks.push({trusted:event.isTrusted,definition:activeDefinition});
            const firstUnit = activeDefinition === "publish-blue";
            parent.postMessage({
              type: "vopStateChangedNotification",
              sessionId: activeSessionId,
              playerState: {
                sharedParameters: firstUnit
                  ? [
                      { key: "avatar", value: "blue" },
                      { key: "language", value: "de" }
                    ]
                  : [
                      { key: "avatar", value: "red" },
                      { key: "tool", value: "calculator" }
                    ]
              }
            }, "*");
          });
          document.querySelector("#sharedParameterNext").addEventListener("click", () => {
            parent.postMessage({
              type: "vopUnitNavigationRequestedNotification",
              sessionId: activeSessionId,
              target: "next"
            }, "*");
          });
          parent.postMessage({
            type: "vopReadyNotification",
            apiVersion: "6.0"
          }, "*");
        <\/script>
      </body>
    </html>`;
  const sharedParameterZip = createStoredZipBuffer([
    {
      fileName: "export/imsmanifest.xml",
      content: `
        <manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1">
          <resources>
            <resource identifier="${sharedParameterBookletKey}" href="booklets/Booklet.xml" />
            <resource identifier="${sharedParameterFirstUnitKey}" href="units/First.xml" />
            <resource identifier="${sharedParameterSecondUnitKey}" href="units/Second.xml" />
            <resource identifier="${sharedParameterPlayerKey}" href="players/shared-parameters.html" />
          </resources>
        </manifest>
      `
    },
    {
      fileName: "export/booklets/Booklet.xml",
      content: `
        <Booklet>
          <Metadata>
            <Id>${sharedParameterBookletKey}</Id>
            <Label>Shared Parameters</Label>
          </Metadata>
          <BookletConfig>
            <Config key="unit_navibuttons">FULL</Config>
          </BookletConfig>
          <Units>
            <Unit id="${sharedParameterFirstUnitKey}" label="Publisher" />
            <Unit id="${sharedParameterSecondUnitKey}" label="Consumer" />
          </Units>
        </Booklet>
      `
    },
    {
      fileName: "export/units/First.xml",
      content: `
        <Unit>
          <Metadata><Id>${sharedParameterFirstUnitKey}</Id><Label>Publisher</Label></Metadata>
          <Definition player="${sharedParameterPlayerKey}"><![CDATA[publish-blue]]></Definition>
        </Unit>
      `
    },
    {
      fileName: "export/units/Second.xml",
      content: `
        <Unit>
          <Metadata><Id>${sharedParameterSecondUnitKey}</Id><Label>Consumer</Label></Metadata>
          <Definition player="${sharedParameterPlayerKey}"><![CDATA[publish-red]]></Definition>
        </Unit>
      `
    },
    {
      fileName: "export/players/shared-parameters.html",
      content: sharedParameterPlayerHtml
    }
  ]);
  await sendSmokeJsonAndDrain(`${baseUrl}/api/v1/platform/tenants`, {
    body: {
      tenantKey: sharedParameterTenantKey,
      displayName: "Shared Parameters"
    }
  });
  await sendSmokeJsonAndDrain(
    `${baseUrl}/api/v1/tenants/${sharedParameterTenantKey}/workspaces`,
    {
      body: {
        workspaceKey: sharedParameterWorkspaceKey,
        displayName: "Shared Parameters"
      }
    }
  );
  const sharedParameterWorkspaceApiUrl =
    `${baseUrl}/api/v1/tenants/${sharedParameterTenantKey}` +
    `/workspaces/${sharedParameterWorkspaceKey}`;
  const sharedParameterSourceResponse = await sendSmokeJson(
    `${sharedParameterWorkspaceApiUrl}/source-packages`,
    {
      body: {
        fileName: "shared-parameters-browser-smoke.zip",
        mediaType: "application/zip",
        sourceDocument:
          `data:application/zip;base64,${sharedParameterZip.toString("base64")}`
      }
    }
  );
  const sharedParameterSourcePayload =
    await sharedParameterSourceResponse.json();
  assert.equal(sharedParameterSourceResponse.status, 201);
  const sharedParameterImportResponse = await sendSmokeJson(
    `${sharedParameterWorkspaceApiUrl}/import-jobs`,
    {
      body: {
        sourcePackageId:
          sharedParameterSourcePayload.sourcePackage.sourcePackageId
      }
    }
  );
  const sharedParameterImportPayload =
    await sharedParameterImportResponse.json();
  assert.equal(
    sharedParameterImportPayload.importJob.status,
    "completed",
    JSON.stringify(sharedParameterImportPayload.importJob.diagnostics)
  );
  const sharedParameterReleaseId =
    sharedParameterImportPayload.stagedContentRelease?.contentReleaseId;
  assert.ok(sharedParameterReleaseId);
  await sendSmokeJsonAndDrain(
    `${sharedParameterWorkspaceApiUrl}/content-releases/${sharedParameterReleaseId}/activate`,
    { body: {} }
  );
  await sendSmokeJsonAndDrain(`${sharedParameterWorkspaceApiUrl}/participant-roster`, {
    body: {
      rosterText: [
        {
          loginKey: sharedParameterLoginKey,
          groupKey: "group:shared-parameters",
          bookletKey: sharedParameterBookletKey,
          displayName: "Shared Parameters Participant",
          executionMode: "run-hot-return"
        }
      ]
    }
  });
  await page.goto(
    `${baseUrl}/participant?${new URLSearchParams({
      tenantKey: sharedParameterTenantKey,
      workspaceKey: sharedParameterWorkspaceKey,
      loginKey: sharedParameterLoginKey,
      bookletKey: sharedParameterBookletKey
    }).toString()}`,
    { waitUntil: "domcontentloaded" }
  );
  await page
    .locator("#participantVeronaPlayerVersion")
    .filter({ hasText: "API 6.0" })
    .waitFor({ timeout: 30_000 });
  let sharedParameterFrame = page.frameLocator("#participantVeronaPlayerFrame");
  await sharedParameterFrame
    .locator("#sharedParameterDefinition")
    .filter({ hasText: "publish-blue" })
    .waitFor({ timeout: 30_000 });
  const sharedParameterSessionId = await page
    .locator("#participantRouteSessionId")
    .inputValue();
  assert.ok(sharedParameterSessionId);
  const publishOwnedSharedParameters = async definition => {
    // Start can render inside the frame before Angular removes the parent's
    // loading/inert surface. Input must wait for that actual interaction gate.
    await page.locator("app-verona-player-host .verona-player-content:not([inert])").waitFor();
    await page.bringToFront();
    await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
    const button=sharedParameterFrame.locator("#sharedParameterPublish");
    console.log('before_native_click='+JSON.stringify(await button.evaluate(element=>({definition:element.ownerDocument.querySelector('#sharedParameterDefinition').textContent,events:element.ownerDocument.defaultView.ownedSharedParameterInputs,rect:element.getBoundingClientRect().toJSON()}))));
    await button.click();
    console.log('after_native_click='+JSON.stringify(await button.evaluate(element=>({definition:element.ownerDocument.querySelector('#sharedParameterDefinition').textContent,events:element.ownerDocument.defaultView.ownedSharedParameterInputs,rect:element.getBoundingClientRect().toJSON()}))));
    const witness=await button.evaluate(element=>element.ownerDocument.defaultView.ownedSharedParameterClicks);
    assert.equal(witness.filter(event=>event.definition===definition).length,1,"Publish must receive exactly one actual native click in the current Player.");
    assert.deepEqual(witness.at(-1),{trusted:true,definition});
    console.log(`shared_parameter_native_input=${definition}:trusted-once`);
  };
  await publishOwnedSharedParameters("publish-blue");
  await sharedParameterFrame
    .locator("#sharedParameterConfig")
    .filter({ hasText: '"avatar","value":"blue"' })
    .waitFor({ timeout: 30_000 });
  const persistedSharedParameterState = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${sharedParameterSessionId}/current-state`,
    payload =>
      JSON.stringify(payload?.currentRunState?.testRun?.sharedParameters) ===
      JSON.stringify([
        { key: "avatar", value: "blue" },
        { key: "language", value: "de" }
      ]),
    30_000
  );
  await sharedParameterFrame.locator("#sharedParameterNext").click();
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: sharedParameterSecondUnitKey })
    .waitFor({ timeout: 30_000 });
  sharedParameterFrame = page.frameLocator("#participantVeronaPlayerFrame");
  // The route label can advance while the previous iframe still exposes the
  // same inherited language. Wait for the actual second Verona definition
  // before publishing, so the click cannot run the first unit's handler again.
  await sharedParameterFrame.locator("#sharedParameterDefinition")
    .filter({ hasText: "publish-red" }).waitFor({ timeout: 30_000 });
  await sharedParameterFrame
    .locator("#sharedParameterConfig")
    .filter({ hasText: '"language","value":"de"' })
    .waitFor({ timeout: 30_000 });
  await publishOwnedSharedParameters("publish-red");
  await sharedParameterFrame
    .locator("#sharedParameterConfig")
    .filter({ hasText: '"tool","value":"calculator"' })
    .waitFor({ timeout: 30_000 });
  const expectedSharedParameters = [
    { key: "avatar", value: "red" },
    { key: "language", value: "de" },
    { key: "tool", value: "calculator" }
  ];
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${sharedParameterSessionId}/current-state`,
    payload =>
      JSON.stringify(payload?.currentRunState?.testRun?.sharedParameters) ===
      JSON.stringify(expectedSharedParameters),
    30_000
  );
  const sharedParameterTestRunId =
    persistedSharedParameterState.currentRunState?.testRun?.testRunId;
  assert.ok(sharedParameterTestRunId);
  await pollJsonWithPredicate(
    `${sharedParameterWorkspaceApiUrl}/test-logs?testRunId=${encodeURIComponent(
      sharedParameterTestRunId
    )}&logKey=SHARED_PARAMETERS&limit=20`,
    payload =>
      Array.isArray(payload?.items) &&
      payload.items.some(
        item =>
          item.testLog?.unitKey === null &&
          item.testLog?.logKey === "SHARED_PARAMETERS" &&
          item.testLog?.logContent === JSON.stringify(expectedSharedParameters)
      ),
    30_000
  );
  await participantHttpActor.goto(page,
    `${baseUrl}/participant?participantSessionId=${encodeURIComponent(
      sharedParameterSessionId
    )}`,
    { waitUntil: "domcontentloaded" }
  );
  await page
    .locator("#participantVeronaPlayerVersion")
    .filter({ hasText: "API 6.0" })
    .waitFor({ timeout: 30_000 });
  sharedParameterFrame = page.frameLocator("#participantVeronaPlayerFrame");
  await sharedParameterFrame
    .locator("#sharedParameterConfig")
    .filter({ hasText: '"tool","value":"calculator"' })
    .waitFor({ timeout: 30_000 });
  assert.equal(
    await sharedParameterFrame.locator("#sharedParameterConfig").textContent(),
    JSON.stringify(expectedSharedParameters)
  );



  console.log('shared_parameter_trial_passed='+trial);
 }
}catch(error){if(page)await page.screenshot({path:artifacts+'/failure.png',fullPage:true});throw error;}
finally{await browser?.close();if(server.exitCode===null&&server.signalCode===null)server.kill('SIGTERM');await raceWithSmokeDeadline(closed,10000,()=>{server.kill('SIGKILL');throw Error('API shutdown timed out.');});console.log('owned_shared_repro_api_stopped=true');}
