import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { brotliDecompressSync } from "node:zlib";

import {
  parseOriginalTestcenterOperationalLogins,
  parseParticipantRosterText
} from "./index.js";

type PinnedOriginalFixture = {
  fixture: string;
  sourcePath: string;
  sha256: string;
  encoding?: "base64";
};

type OriginalTestcenterCorpus = {
  sourceCommit: string;
  crossFileRosterCollisions: {
    sameWorkspaceLoginFixtures: PinnedOriginalFixture[];
    crossWorkspaceFixture: PinnedOriginalFixture;
    loginName: string;
    groupId: string;
    loginDiagnosticCode: string;
    groupDiagnosticCode: string;
  };
  roster: {
    fixture: string;
    participantLoginKeys: string[];
    excludedOperationalLoginKeys: string[];
  };
  legacyRosters: Array<{
    fixture: string;
    sourcePath: string;
    sha256: string;
    schemaVersion: string;
    participantLoginKeys: string[];
    operationalLoginKeys: string[];
    hasSystemCheckLogin: boolean;
  }>;
  resourcePackages: Array<{
    fixture: string;
    sha256: string;
  }>;
  samplePackages: Array<{
    booklet: PinnedOriginalFixture & {
      bookletKey: string;
      unitKeys: string[];
    };
    units: Array<
      PinnedOriginalFixture & { unitKey: string; playerKey: string }
    >;
    definition: PinnedOriginalFixture;
    codingScheme: PinnedOriginalFixture & { encoding: "base64" };
    player: PinnedOriginalFixture & { playerKey: string };
    resourcePackage: PinnedOriginalFixture & { encoding: "base64" };
  }>;
  systemChecks: Array<{
    fixture: string;
    sourcePath: string;
    sha256?: string;
    checkId: string;
    displayLabel: string;
    unitKey: string;
    questionCount: number;
    questionTypes: string[];
    requiredQuestionIds: string[];
    skipNetwork: boolean;
    canSave: boolean;
  }>;
  systemCheckReports: Array<
    PinnedOriginalFixture & {
      installedFileName: string;
      date: string;
      checkId: string;
      checkLabel: string;
      title: string;
      sectionEntryCounts: Record<
        "environment" | "network" | "questionnaire" | "unit",
        number
      >;
    }
  >;
  bookletConfigPackages: Array<{
    bookletKeys: string[];
    units: Array<[fixture: string, unitKey: string]>;
    player: { fixture: string; playerKey: string };
    roster: {
      fixture: string;
      encoding: "base64";
      sourcePath: string;
      sha256: string;
      groupKey: string;
      participants: Array<[
        loginKey: string,
        executionMode: string,
        bookletKey: string
      ]>;
    };
  }>;
  testControllerPackages: Array<{
    bookletKeys: string[];
    units: Array<[fixture: string, unitKey: string]>;
    player: { fixture: string; playerKey: string };
    roster: {
      fixture: string;
      encoding: "base64";
      sourcePath: string;
      sha256: string;
      groups: Array<{
        groupKey: string;
        participants: Array<[
          loginKey: string,
          executionMode: string,
          bookletKey: string
        ]>;
      }>;
    };
  }>;
  groupMonitoringPackages: Array<{
    booklet: {
      fixture: string;
      sourcePath: string;
      sha256: string;
      bookletKey: string;
      unitKeys: string[];
    };
    units: Array<{
      fixture: string;
      sourcePath: string;
      sha256: string;
      unitKey: string;
    }>;
    player: {
      fixture: string;
      sourcePath: string;
      sha256: string;
      playerKey: string;
    };
    roster: {
      fixture: string;
      sourcePath: string;
      sha256: string;
      participantLoginKeys: string[];
      operationalLoginKeys: string[];
    };
  }>;
  sessionManagementPackages: Array<{
    booklets: Array<{
      fixture: string;
      sourcePath: string;
      sha256: string;
      bookletKey: string;
      unitKeys: string[];
    }>;
    units: Array<{
      fixture: string;
      sourcePath: string;
      sha256: string;
      unitKey: string;
    }>;
    player: {
      fixture: string;
      sourcePath: string;
      sha256: string;
      playerKey: string;
    };
    roster: {
      fixture: string;
      sourcePath: string;
      sha256: string;
      participantLoginKeys: string[];
    };
  }>;
  playerPackages: Array<{
    roster: {
      fixture: string;
      sourcePath: string;
      sha256: string;
      groupKey: string;
      participantLoginKeys: string[];
      operationalLoginKeys: string[];
      customTexts: Record<string, string>;
    };
  }>;
  veronaSimplePlayerPackages: Array<{
    fixture: string;
    encoding: "brotli-base64";
    sourceRepository: string;
    sourceTag: string;
    sourceCommit: string;
    sourcePath: string;
    sourceUrl: string;
    sha256: string;
    license: string;
    playerKey: string;
    playerModuleId: string;
    playerModuleVersion: string;
    playerApiVersion: string;
    metadataFormat: string;
    unitDefinitionType: string;
  }>;
  veronaPlayerFamilyPackages: Array<{
    family: string;
    playerFixture: string;
    playerEncoding: "brotli-base64";
    definitionFixture: string;
    definitionEncoding: "base64";
    sourceRepository: string;
    sourceTag: string;
    sourceCommit: string;
    playerSourcePath: string;
    playerSourceUrl: string;
    playerSha256: string;
    definitionSourceRepository?: string;
    definitionSourceCommit?: string;
    definitionSourcePath: string;
    definitionSourceUrl: string;
    definitionSha256: string;
    license: string;
    playerKey: string;
    playerModuleId: string;
    playerModuleVersion: string;
    playerApiVersion: string;
    metadataApiVersion: string;
    metadataFormat: string;
    unitDefinitionType: string;
    unitStateType: string;
    legacyTestbedPackage?: {
      playerFixture: string;
      playerEncoding: "brotli-base64";
      playerKey: string;
      playerModuleVersion: string;
      playerApiVersion: string;
      playerSourcePath: string;
      playerSourceUrl: string;
      playerSha256: string;
      unitFixture: string;
      unitEncoding: "utf8";
      unitSourcePath: string;
      unitSourceUrl: string;
      unitSha256: string;
    };
  }>;
  codingSchemePackages: Array<{
    family: string;
    schemeFixture: string;
    inputFixture: string;
    outcomeFixture: string;
    sourceRepository: string;
    sourceTag: string;
    sourceCommit: string;
    schemeSourcePath: string;
    inputSourcePath: string;
    outcomeSourcePath: string;
    schemeSha256: string;
    inputSha256: string;
    outcomeSha256: string;
    license: string;
    expectedStates: Record<string, string>;
  }>;
};

const corpusRoot = resolve(
  process.cwd(),
  "test-fixtures/original-testcenter"
);

test("original Testcenter compatibility corpus separates participant and operational logins", () => {
  const corpus = JSON.parse(
    readFileSync(resolve(corpusRoot, "corpus.json"), "utf8")
  ) as OriginalTestcenterCorpus;
  assert.equal(
    corpus.sourceCommit,
    "284a4ffcd9452d56dddd51939707ac7f646c3da7"
  );

  const crossFileRosterFixtures = [
    ...corpus.crossFileRosterCollisions.sameWorkspaceLoginFixtures,
    corpus.crossFileRosterCollisions.crossWorkspaceFixture
  ];
  for (const fixture of crossFileRosterFixtures) {
    const fixtureBuffer = readFileSync(resolve(corpusRoot, fixture.fixture));
    assert.equal(
      createHash("sha256").update(fixtureBuffer).digest("hex"),
      fixture.sha256,
      fixture.sourcePath
    );
  }
  assert.ok(
    corpus.crossFileRosterCollisions.sameWorkspaceLoginFixtures.every(
      fixture =>
        readFileSync(resolve(corpusRoot, fixture.fixture), "utf8").includes(
          `name="${corpus.crossFileRosterCollisions.loginName}"`
        )
    )
  );
  assert.match(
    readFileSync(
      resolve(
        corpusRoot,
        corpus.crossFileRosterCollisions.crossWorkspaceFixture.fixture
      ),
      "utf8"
    ),
    new RegExp(`id="${corpus.crossFileRosterCollisions.groupId}"`)
  );

  const rosterXml = readFileSync(
    resolve(corpusRoot, corpus.roster.fixture),
    "utf8"
  );
  const entries = parseParticipantRosterText(rosterXml);
  assert.deepEqual(
    entries.map(entry => entry.loginKey),
    corpus.roster.participantLoginKeys
  );
  assert.ok(
    corpus.roster.excludedOperationalLoginKeys.every(
      loginKey => !entries.some(entry => entry.loginKey === loginKey)
    )
  );
  const operationalLogins =
    parseOriginalTestcenterOperationalLogins(rosterXml);
  assert.deepEqual(
    operationalLogins.map(login => login.loginKey),
    corpus.roster.excludedOperationalLoginKeys
  );
  assert.equal(
    operationalLogins.find(login => login.loginKey === "test-group-monitor-2")
      ?.profileIds.join(","),
    "all,small"
  );
  const importedSmallProfile = operationalLogins
    .find(login => login.loginKey === "test-group-monitor-2")
    ?.monitorProfiles.find(profile => profile.profileId === "small");
  assert.equal(importedSmallProfile?.label, "Superklein");
  assert.equal(importedSmallProfile?.settings.view, "small");
  assert.equal(importedSmallProfile?.settings.blockColumn, "hide");
  assert.equal(importedSmallProfile?.filtersEnabled.locked, "yes");
  assert.deepEqual(importedSmallProfile?.filters, [
    {
      target: "bookletLabel",
      value: "Reduced Booklet",
      subValue: null,
      label: "Reduced Booklet",
      type: "equal",
      not: false
    }
  ]);
  assert.deepEqual(
    operationalLogins.find(login => login.loginKey === "test-group-monitor-2")
      ?.unresolvedProfileIds,
    []
  );
  assert.equal(
    operationalLogins.find(login => login.loginKey === "expired-study-monitor")
      ?.validTo,
    "1/3/2020 19:30"
  );

  const primaryParticipant = entries.find(entry => entry.loginKey === "test");
  assert.deepEqual(primaryParticipant?.bookletKeys, [
    "BOOKLET.SAMPLE-1",
    "BOOKLET.SAMPLE-3",
    "BOOKLET.SAMPLE-2"
  ]);
  assert.equal(primaryParticipant?.groupKey, "sample_group");
  assert.equal(primaryParticipant?.password, "user123");
  assert.equal(primaryParticipant?.validFrom, "1/3/2020 10:00");

  const trialParticipant = entries.find(entry => entry.loginKey === "test-trial");
  assert.equal(trialParticipant?.validForMinutes, 45);
  const expiredParticipant = entries.find(entry => entry.loginKey === "test-expired");
  assert.equal(expiredParticipant?.validTo, "1/3/2020 19:30");

  for (const resourcePackage of corpus.resourcePackages) {
    const packageBuffer = Buffer.from(
      readFileSync(resolve(corpusRoot, resourcePackage.fixture), "utf8").trim(),
      "base64"
    );
    assert.equal(
      createHash("sha256").update(packageBuffer).digest("hex"),
      resourcePackage.sha256
    );
  }

  assert.deepEqual(
    corpus.systemChecks.map(systemCheck => systemCheck.checkId),
    ["SYSCHECK.SAMPLE", "syscheck-2"]
  );
  for (const systemCheck of corpus.systemChecks) {
    const systemCheckBuffer = readFileSync(
      resolve(corpusRoot, systemCheck.fixture)
    );
    const systemCheckXml = systemCheckBuffer.toString("utf8");
    if (systemCheck.sha256) {
      assert.equal(
        createHash("sha256").update(systemCheckBuffer).digest("hex"),
        systemCheck.sha256,
        systemCheck.sourcePath
      );
    }
    assert.match(systemCheckXml, new RegExp(`<Id>${systemCheck.checkId}</Id>`));
    assert.match(
      systemCheckXml,
      new RegExp(`<Label>${systemCheck.displayLabel}</Label>`)
    );
    assert.match(
      systemCheckXml,
      new RegExp(`<Config\\b[^>]*\\bunit="${systemCheck.unitKey}"`)
    );
    const questionTags = Array.from(systemCheckXml.matchAll(/<Q\b([^>]*)>/g));
    assert.equal(questionTags.length, systemCheck.questionCount);
    assert.deepEqual(
      questionTags.map(match => match[1]?.match(/\btype="([^"]+)"/)?.[1]),
      systemCheck.questionTypes
    );
    assert.deepEqual(
      questionTags.flatMap(match =>
        /\brequired="true"/i.test(match[1] ?? "")
          ? [match[1]?.match(/\bid="([^"]+)"/)?.[1]]
          : []
      ),
      systemCheck.requiredQuestionIds
    );
    assert.equal(
      /skipnetwork="true"/i.test(systemCheckXml),
      systemCheck.skipNetwork
    );
    assert.equal(/\bsavekey="[^"]+"/i.test(systemCheckXml), systemCheck.canSave);
  }

  assert.equal(corpus.systemCheckReports.length, 1);
  for (const pinnedReport of corpus.systemCheckReports) {
    const reportBuffer = readFileSync(resolve(corpusRoot, pinnedReport.fixture));
    assert.equal(
      createHash("sha256").update(reportBuffer).digest("hex"),
      pinnedReport.sha256,
      pinnedReport.sourcePath
    );
    const report = JSON.parse(reportBuffer.toString("utf8")) as Record<
      string,
      unknown
    >;
    assert.equal(report.date, pinnedReport.date);
    assert.equal(report.checkId, pinnedReport.checkId);
    assert.equal(report.checkLabel, pinnedReport.checkLabel);
    assert.equal(report.title, pinnedReport.title);
    for (const [section, expectedCount] of Object.entries(
      pinnedReport.sectionEntryCounts
    )) {
      assert.equal(
        Array.isArray(report[section]) ? report[section].length : -1,
        expectedCount,
        `${pinnedReport.sourcePath}#${section}`
      );
    }
  }

  const reviewParticipant = entries.find(entry => entry.loginKey === "test-review");
  assert.deepEqual(reviewParticipant?.bookletKeys, [
    "BOOKLET.SAMPLE-1",
    "BOOKLET.SAMPLE-2"
  ]);
  assert.deepEqual(reviewParticipant?.bookletStatePresets, {
    "BOOKLET.SAMPLE-2": { bonus: "yes" }
  });
  assert.deepEqual(
    reviewParticipant?.bookletAssignments?.map(assignment => assignment.assignmentKey),
    [
      "BOOKLET.SAMPLE-1",
      "BOOKLET.SAMPLE-2#bonus:yes",
      "BOOKLET.SAMPLE-2#bonus:no"
    ]
  );
});

test("original Testcenter compatibility corpus pins the legacy 15.2 roster without system-check login", () => {
  const corpus = JSON.parse(
    readFileSync(resolve(corpusRoot, "corpus.json"), "utf8")
  ) as OriginalTestcenterCorpus;
  assert.equal(corpus.legacyRosters.length, 1);
  const legacyRoster = corpus.legacyRosters[0]!;
  const rosterBuffer = readFileSync(resolve(corpusRoot, legacyRoster.fixture));
  assert.equal(
    createHash("sha256").update(rosterBuffer).digest("hex"),
    legacyRoster.sha256,
    legacyRoster.sourcePath
  );
  const rosterXml = rosterBuffer.toString("utf8");
  assert.match(
    rosterXml,
    new RegExp(`/${legacyRoster.schemaVersion}/definitions/vo_Testtakers\\.xsd`)
  );

  const participants = parseParticipantRosterText(rosterXml);
  assert.deepEqual(
    participants.map(participant => participant.loginKey),
    legacyRoster.participantLoginKeys
  );
  assert.ok(
    participants.every(
      participant => participant.customTexts?.somestr === "string"
    )
  );
  const operationalLogins = parseOriginalTestcenterOperationalLogins(rosterXml);
  assert.deepEqual(
    operationalLogins.map(login => login.loginKey),
    legacyRoster.operationalLoginKeys
  );
  assert.equal(
    operationalLogins.some(login => login.loginMode === "sys-check-login"),
    legacyRoster.hasSystemCheckLogin
  );
  assert.ok(operationalLogins.every(login => login.profileIds.length === 0));
});

test("original Testcenter compatibility corpus pins the complete 17.6 sample package", () => {
  const corpus = JSON.parse(
    readFileSync(resolve(corpusRoot, "corpus.json"), "utf8")
  ) as OriginalTestcenterCorpus;
  const samplePackage = corpus.samplePackages[0];
  assert.ok(samplePackage);

  for (const pinnedFile of [
    samplePackage.booklet,
    ...samplePackage.units,
    samplePackage.definition,
    samplePackage.codingScheme,
    samplePackage.player,
    samplePackage.resourcePackage
  ]) {
    const fixtureBuffer = readFileSync(resolve(corpusRoot, pinnedFile.fixture));
    const sourceBuffer =
      pinnedFile.encoding === "base64"
        ? Buffer.from(fixtureBuffer.toString("utf8").trim(), "base64")
        : fixtureBuffer;
    assert.equal(
      createHash("sha256").update(sourceBuffer).digest("hex"),
      pinnedFile.sha256,
      pinnedFile.sourcePath
    );
  }

  assert.equal(samplePackage.booklet.bookletKey, "BOOKLET.SAMPLE-1");
  assert.deepEqual(samplePackage.booklet.unitKeys, [
    "UNIT.SAMPLE",
    "UNIT.SAMPLE-2",
    "an_alias"
  ]);
  assert.deepEqual(
    samplePackage.units.map(unit => [unit.unitKey, unit.playerKey]),
    [
      ["UNIT.SAMPLE", "verona-player-simple-6.0"],
      ["UNIT.SAMPLE-2", "verona-player-simple@6.0"]
    ]
  );
});

test("original Testcenter compatibility corpus pins the Aspect player roster", () => {
  const corpus = JSON.parse(
    readFileSync(resolve(corpusRoot, "corpus.json"), "utf8")
  ) as OriginalTestcenterCorpus;
  const roster = corpus.playerPackages[0]?.roster;
  assert.ok(roster);
  const rosterBuffer = readFileSync(resolve(corpusRoot, roster.fixture));
  assert.equal(
    createHash("sha256").update(rosterBuffer).digest("hex"),
    roster.sha256,
    roster.sourcePath
  );

  const participants = parseParticipantRosterText(
    rosterBuffer.toString("utf8")
  );
  assert.deepEqual(
    participants.map(participant => participant.loginKey),
    roster.participantLoginKeys
  );
  for (const participant of participants) {
    assert.equal(participant.groupKey, roster.groupKey);
    assert.equal(participant.bookletKey, "booklet1");
    assert.deepEqual(participant.customTexts, roster.customTexts);
  }
  assert.equal(participants[0]?.password, undefined);
  assert.equal(participants[0]?.executionMode, "run-hot-return");
  assert.equal(participants[1]?.password, "user123");
  assert.equal(participants[1]?.executionMode, "run-hot-return");
  assert.equal(participants[2]?.password, "user123");
  assert.equal(participants[2]?.executionMode, "run-review");

  const operationalLogins =
    parseOriginalTestcenterOperationalLogins(rosterBuffer.toString("utf8"));
  assert.deepEqual(
    operationalLogins.map(login => login.loginKey),
    roster.operationalLoginKeys
  );
  assert.equal(operationalLogins[0]?.loginMode, "monitor-group");
  assert.equal(operationalLogins[0]?.groupKey, roster.groupKey);
  assert.equal(operationalLogins[0]?.passwordRequired, true);
});

test("original Testcenter compatibility corpus pins the official Verona 2 through 5 players", () => {
  const corpus = JSON.parse(
    readFileSync(resolve(corpusRoot, "corpus.json"), "utf8")
  ) as OriginalTestcenterCorpus;
  assert.deepEqual(
    corpus.veronaSimplePlayerPackages.map(player => player.sourceTag),
    ["1.0.1", "2.1.0", "4.0.0", "5.2.0"]
  );

  for (const player of corpus.veronaSimplePlayerPackages) {
    const playerDocument = brotliDecompressSync(
      Buffer.from(
        readFileSync(resolve(corpusRoot, player.fixture), "utf8").trim(),
        "base64"
      )
    );
    assert.equal(
      createHash("sha256").update(playerDocument).digest("hex"),
      player.sha256,
      player.sourceUrl
    );
    const playerHtml = playerDocument.toString("utf8");
    if (player.metadataFormat === "legacy-meta-element") {
      assert.match(
        playerHtml,
        new RegExp(`data-version="${player.playerModuleVersion.replaceAll(".", "\\.")}"`)
      );
      assert.match(
        playerHtml,
        new RegExp(`data-api-version="${player.playerApiVersion.replaceAll(".", "\\.")}"`)
      );
    } else {
      assert.match(
        playerHtml,
        new RegExp(`"version"\\s*:\\s*"${player.playerModuleVersion.replaceAll(".", "\\.")}"`)
      );
      assert.match(
        playerHtml,
        new RegExp(
          `"(?:apiVersion|specVersion)"\\s*:\\s*"${player.playerApiVersion.replaceAll(".", "\\.")}"`
        )
      );
    }
    assert.match(player.sourceCommit, /^[a-f0-9]{40}$/);
    assert.equal(player.license, "MIT");
  }

  const [verona2, verona3, verona4, verona5] = corpus.veronaSimplePlayerPackages;
  assert.equal(verona2?.metadataFormat, "legacy-meta-element");
  assert.equal(verona3?.metadataFormat, "legacy-jsonld");
  assert.equal(verona4?.metadataFormat, "experimental-jsonld");
  assert.equal(verona5?.metadataFormat, "metadata-2.0");
});

test("original Testcenter compatibility corpus pins independent official player families", () => {
  const corpus = JSON.parse(
    readFileSync(resolve(corpusRoot, "corpus.json"), "utf8")
  ) as OriginalTestcenterCorpus;
  assert.equal(corpus.veronaPlayerFamilyPackages.length, 2);
  const playersByFamily = new Map(
    corpus.veronaPlayerFamilyPackages.map(player => [player.family, player])
  );

  for (const player of corpus.veronaPlayerFamilyPackages) {
    const playerDocument = brotliDecompressSync(
      Buffer.from(
        readFileSync(resolve(corpusRoot, player.playerFixture), "utf8").trim(),
        "base64"
      )
    );
    const definitionDocument = Buffer.from(
      readFileSync(resolve(corpusRoot, player.definitionFixture), "utf8").trim(),
      "base64"
    );
    assert.equal(
      createHash("sha256").update(playerDocument).digest("hex"),
      player.playerSha256,
      player.playerSourceUrl
    );
    assert.equal(
      createHash("sha256").update(definitionDocument).digest("hex"),
      player.definitionSha256,
      player.definitionSourceUrl
    );
    assert.match(player.sourceCommit, /^[a-f0-9]{40}$/);
    assert.equal(player.license, "MIT");
  }

  const abi = playersByFamily.get("ABI scripted survey");
  assert.ok(abi);
  assert.equal(abi.sourceTag, "v3.3.0");
  assert.equal(abi.sourceCommit, "1e872a261c6a20b7dfe1f86d8916cfe643acdfb8");
  const abiPlayerHtml = brotliDecompressSync(
    Buffer.from(
      readFileSync(resolve(corpusRoot, abi.playerFixture), "utf8").trim(),
      "base64"
    )
  ).toString("utf8");
  const abiDefinition = Buffer.from(
    readFileSync(resolve(corpusRoot, abi.definitionFixture), "utf8").trim(),
    "base64"
  ).toString("utf8");
  assert.match(abiPlayerHtml, /"@id"\s*:\s*"iqb-player-abi"/);
  assert.match(abiPlayerHtml, /"version"\s*:\s*"3\.3\.0"/);
  assert.match(abiPlayerHtml, /"apiVersion"\s*:\s*"2\.0"/);
  assert.match(abiPlayerHtml, /data-api-version="2\.1\.0"/);
  assert.match(abiPlayerHtml, /data-supported-unit-definition-types="iqb-scripted@1\.0"/);
  assert.match(abiPlayerHtml, /data-supported-unit-state-data-types="iqb-key-value@1\.0\.0"/);
  assert.match(abiDefinition, /input-text::text_var1/);
  assert.match(abiDefinition, /multiple-choice::mc_var1/);

  const dan = playersByFamily.get("DAN visual assessment");
  assert.ok(dan);
  assert.equal(dan.sourceTag, "v3.0.0");
  assert.equal(dan.sourceCommit, "89d21726c70a014c179b95cd846ff31a25821a21");
  assert.equal(dan.definitionSourceCommit, "1343550c864701daf9ca4a1b064351b37a617d89");
  const danPlayerHtml = brotliDecompressSync(
    Buffer.from(
      readFileSync(resolve(corpusRoot, dan.playerFixture), "utf8").trim(),
      "base64"
    )
  ).toString("utf8");
  const danDefinition = Buffer.from(
    readFileSync(resolve(corpusRoot, dan.definitionFixture), "utf8").trim(),
    "base64"
  ).toString("utf8");
  assert.match(danPlayerHtml, /"@id"\s*:\s*"iqb-player-dan"/);
  assert.match(danPlayerHtml, /"version"\s*:\s*"3\.0\.0"/);
  assert.match(danPlayerHtml, /"apiVersion"\s*:\s*"2\.1"/);
  assert.match(danPlayerHtml, /data-api-version="2\.1\.0"/);
  assert.match(danDefinition, /"canvasElement4"/);
  assert.match(danDefinition, /"type":"multilineTextbox"/);
  assert.match(danDefinition, /"type":"multipleChoice"/);
  const legacyTestbedPackage = dan.legacyTestbedPackage;
  assert.ok(legacyTestbedPackage);
  const legacyPlayerDocument = brotliDecompressSync(
    Buffer.from(
      readFileSync(
        resolve(corpusRoot, legacyTestbedPackage.playerFixture),
        "utf8"
      ).trim(),
      "base64"
    )
  );
  const legacyUnitDocument = readFileSync(
    resolve(corpusRoot, legacyTestbedPackage.unitFixture)
  );
  assert.equal(
    createHash("sha256").update(legacyPlayerDocument).digest("hex"),
    legacyTestbedPackage.playerSha256,
    legacyTestbedPackage.playerSourceUrl
  );
  assert.equal(
    createHash("sha256").update(legacyUnitDocument).digest("hex"),
    legacyTestbedPackage.unitSha256,
    legacyTestbedPackage.unitSourceUrl
  );
  assert.doesNotMatch(legacyPlayerDocument.toString("utf8"), /application\/ld\+json/);
  assert.match(
    legacyPlayerDocument.toString("utf8"),
    /data-version="2\.99\.2"[\s\S]*data-api-version="2\.1\.0"/
  );
  assert.match(
    legacyUnitDocument.toString("utf8"),
    /<DefinitionRef player="IQBVisualUnitPlayerV2">G231mm\.voud<\/DefinitionRef>/
  );
});

test("original Testcenter compatibility corpus pins official IQB solver coding fixtures", () => {
  const corpus = JSON.parse(
    readFileSync(resolve(corpusRoot, "corpus.json"), "utf8")
  ) as OriginalTestcenterCorpus;
  assert.equal(corpus.codingSchemePackages.length, 1);
  const solver = corpus.codingSchemePackages[0];
  assert.ok(solver);
  assert.equal(solver.family, "solver-alias-chain");
  assert.equal(
    solver.sourceRepository,
    "https://github.com/iqb-berlin/responses"
  );
  assert.equal(solver.sourceTag, "3.6.0");
  assert.equal(
    solver.sourceCommit,
    "e04e585e6514e5257ac42f48b629628326471f90"
  );
  assert.equal(solver.license, "MIT");
  assert.deepEqual(
    [
      solver.schemeSourcePath,
      solver.inputSourcePath,
      solver.outcomeSourcePath
    ],
    [
      "test/coding/derive/SOLVER/case1/coding-scheme.json",
      "test/coding/derive/SOLVER/case1/01_input.json",
      "test/coding/derive/SOLVER/case1/01_outcome.json"
    ]
  );

  for (const [fixture, expectedHash] of [
    [solver.schemeFixture, solver.schemeSha256],
    [solver.inputFixture, solver.inputSha256],
    [solver.outcomeFixture, solver.outcomeSha256]
  ] as const) {
    assert.equal(
      createHash("sha256")
        .update(readFileSync(resolve(corpusRoot, fixture)))
        .digest("hex"),
      expectedHash
    );
  }

  const scheme = JSON.parse(
    readFileSync(resolve(corpusRoot, solver.schemeFixture), "utf8")
  ) as {
    version?: string;
    variableCodings: Array<{
      id: string;
      alias?: string;
      sourceType: string;
      deriveSources?: string[];
      sourceParameters?: { solverExpression?: string };
    }>;
  };
  assert.equal(scheme.version, undefined);
  assert.deepEqual(
    scheme.variableCodings.slice(0, 3).map(variable => variable.alias),
    ["b1_alias", "b2_alias", "b3_alias"]
  );
  assert.deepEqual(
    scheme.variableCodings.slice(3).map(variable => variable.sourceType),
    ["SOLVER", "SOLVER", "SOLVER", "SOLVER", "SOLVER"]
  );
  assert.deepEqual(scheme.variableCodings[4]?.deriveSources, ["d1", "b2"]);
  assert.match(
    scheme.variableCodings[7]?.sourceParameters?.solverExpression ?? "",
    /irgendein anderer Quatsch/
  );

  const outcome = JSON.parse(
    readFileSync(resolve(corpusRoot, solver.outcomeFixture), "utf8")
  ) as Array<{ id: string; status: string; value: unknown }>;
  assert.deepEqual(
    outcome.slice(3).map(variable => [variable.id, variable.status]),
    [
      ["d1", "NO_CODING"],
      ["d2", "DERIVE_ERROR"],
      ["d3", "DERIVE_ERROR"],
      ["d4", "NO_CODING"],
      ["d5", "DERIVE_ERROR"]
    ]
  );
  assert.equal(outcome[3]?.value, 1124);
  assert.equal(outcome[6]?.value, 111.01801801801801);
});

test("original Testcenter compatibility corpus pins official group monitoring semantics", () => {
  const corpus = JSON.parse(
    readFileSync(resolve(corpusRoot, "corpus.json"), "utf8")
  ) as OriginalTestcenterCorpus;
  const groupMonitoring = corpus.groupMonitoringPackages[0];
  assert.ok(groupMonitoring);

  for (const pinnedFile of [
    groupMonitoring.booklet,
    ...groupMonitoring.units,
    groupMonitoring.player,
    groupMonitoring.roster
  ]) {
    assert.equal(
      createHash("sha256")
        .update(readFileSync(resolve(corpusRoot, pinnedFile.fixture)))
        .digest("hex"),
      pinnedFile.sha256,
      pinnedFile.sourcePath
    );
  }

  const rosterXml = readFileSync(
    resolve(corpusRoot, groupMonitoring.roster.fixture),
    "utf8"
  );
  const participants = parseParticipantRosterText(rosterXml);
  assert.deepEqual(
    participants.map(participant => participant.loginKey),
    groupMonitoring.roster.participantLoginKeys
  );
  assert.equal(participants[0]?.groupKey, "filter-profiles");
  assert.equal(participants[0]?.password, "123");
  assert.equal(participants[0]?.executionMode, "run-hot-return");
  assert.equal(participants[0]?.bookletKey, "Cy-Bklt_GM-1");

  const operationalLogins = parseOriginalTestcenterOperationalLogins(rosterXml);
  assert.deepEqual(
    operationalLogins.map(login => login.loginKey),
    groupMonitoring.roster.operationalLoginKeys
  );
  assert.deepEqual(operationalLogins[0], {
    loginKey: "GM-1",
    loginMode: "monitor-group",
    groupKey: "filter-profiles",
    passwordRequired: true,
    profileIds: ["all", "small"],
    monitorProfiles: [
      {
        profileId: "all",
        label: "Alles zeigen",
        settings: {
          blockColumn: "show",
          unitColumn: "show",
          view: "full",
          groupColumn: "show",
          bookletColumn: "show",
          bookletStatesColumns: "level bonus",
          autoselectNextBlock: "no"
        },
        filters: [],
        filtersEnabled: { pending: "no", locked: "no" }
      },
      {
        profileId: "small",
        label: "Superklein",
        settings: {
          blockColumn: "hide",
          unitColumn: "hide",
          view: "small",
          groupColumn: "hide",
          bookletColumn: "hide",
          bookletStatesColumns: "",
          autoselectNextBlock: "yes"
        },
        filters: [
          {
            target: "bookletLabel",
            value: "Reduced Booklet",
            subValue: null,
            label: "Reduced Booklet",
            type: "equal",
            not: false
          }
        ],
        filtersEnabled: { pending: "yes", locked: "yes" }
      }
    ],
    customTexts: {},
    unresolvedProfileIds: []
  });
});

test("original Testcenter compatibility corpus pins the complete official Test Controller roster", () => {
  const corpus = JSON.parse(
    readFileSync(resolve(corpusRoot, "corpus.json"), "utf8")
  ) as OriginalTestcenterCorpus;
  const testController = corpus.testControllerPackages[0];
  assert.ok(testController);
  assert.deepEqual(
    testController.bookletKeys,
    Array.from({ length: 17 }, (_, index) => `Cy-Bklt_TC-${index + 1}`)
  );
  assert.deepEqual(
    testController.units.map(([, unitKey]) => unitKey),
    Array.from({ length: 5 }, (_, index) => `CY-Unit.Sample-${index + 100}`)
  );
  assert.equal(testController.player.playerKey, "verona-player-simple-6.0");

  const rosterBuffer = Buffer.from(
    readFileSync(resolve(corpusRoot, testController.roster.fixture), "utf8").trim(),
    testController.roster.encoding
  );
  assert.equal(
    createHash("sha256").update(rosterBuffer).digest("hex"),
    testController.roster.sha256,
    testController.roster.sourcePath
  );
  const participants = parseParticipantRosterText(rosterBuffer.toString("utf8"));
  const expectedParticipants = testController.roster.groups.flatMap(group =>
    group.participants.map(([loginKey, executionMode, bookletKey]) => ({
      loginKey,
      executionMode,
      bookletKey,
      groupKey: group.groupKey
    }))
  );
  assert.equal(participants.length, 26);
  assert.deepEqual(
    new Set(participants.map(participant => participant.loginKey)),
    new Set(expectedParticipants.map(participant => participant.loginKey))
  );
  for (const expectation of expectedParticipants) {
    const participant = participants.find(
      candidate => candidate.loginKey === expectation.loginKey
    );
    assert.ok(participant, expectation.loginKey);
    assert.equal(participant.groupKey, expectation.groupKey);
    assert.equal(participant.executionMode, expectation.executionMode);
    assert.equal(participant.bookletKey, expectation.bookletKey);
    assert.equal(participant.password, "123");
  }
  assert.deepEqual(
    Array.from(new Set(participants.map(participant => participant.executionMode))).sort(),
    ["run-demo", "run-hot-restart", "run-hot-return", "run-review"]
  );
});

test("original Testcenter compatibility corpus pins the complete official Booklet Config roster", () => {
  const corpus = JSON.parse(
    readFileSync(resolve(corpusRoot, "corpus.json"), "utf8")
  ) as OriginalTestcenterCorpus;
  const bookletConfig = corpus.bookletConfigPackages[0];
  assert.ok(bookletConfig);
  assert.deepEqual(
    bookletConfig.bookletKeys,
    Array.from(
      { length: 4 },
      (_, index) => `Cy-Bklt_BkltConfig-${index + 1}`
    )
  );
  assert.deepEqual(
    bookletConfig.units.map(([, unitKey]) => unitKey),
    ["CY-Unit.Sample-101", "CY-Unit.Sample-102", "CY-Unit.Sample-104"]
  );
  assert.equal(bookletConfig.player.playerKey, "verona-player-simple-6.0");

  const rosterBuffer = Buffer.from(
    readFileSync(resolve(corpusRoot, bookletConfig.roster.fixture), "utf8").trim(),
    bookletConfig.roster.encoding
  );
  assert.equal(
    createHash("sha256").update(rosterBuffer).digest("hex"),
    bookletConfig.roster.sha256,
    bookletConfig.roster.sourcePath
  );
  const participants = parseParticipantRosterText(rosterBuffer.toString("utf8"));
  assert.equal(participants.length, 4);
  for (const [loginKey, executionMode, bookletKey] of
    bookletConfig.roster.participants) {
    const participant = participants.find(
      candidate => candidate.loginKey === loginKey
    );
    assert.ok(participant, loginKey);
    assert.equal(participant.groupKey, bookletConfig.roster.groupKey);
    assert.equal(participant.executionMode, executionMode);
    assert.equal(participant.bookletKey, bookletKey);
    assert.equal(participant.password, "123");
  }
});

test("original Testcenter compatibility corpus pins official session management semantics", () => {
  const corpus = JSON.parse(
    readFileSync(resolve(corpusRoot, "corpus.json"), "utf8")
  ) as OriginalTestcenterCorpus;
  const sessionManagement = corpus.sessionManagementPackages[0];
  assert.ok(sessionManagement);

  for (const pinnedFile of [
    ...sessionManagement.booklets,
    ...sessionManagement.units,
    sessionManagement.player,
    sessionManagement.roster
  ]) {
    const content = readFileSync(resolve(corpusRoot, pinnedFile.fixture));
    assert.equal(
      createHash("sha256").update(content).digest("hex"),
      pinnedFile.sha256,
      pinnedFile.sourcePath
    );
  }

  const rosterXml = readFileSync(
    resolve(corpusRoot, sessionManagement.roster.fixture),
    "utf8"
  );
  const entries = parseParticipantRosterText(rosterXml);
  assert.deepEqual(
    entries.map(entry => entry.loginKey),
    sessionManagement.roster.participantLoginKeys
  );
  assert.deepEqual(parseOriginalTestcenterOperationalLogins(rosterXml), []);

  const entriesByLoginKey = new Map(entries.map(entry => [entry.loginKey, entry]));
  assert.equal(entriesByLoginKey.get("SM-1")?.password, undefined);
  assert.equal(entriesByLoginKey.get("SM-2")?.password, "101");
  assert.deepEqual(entriesByLoginKey.get("SM-3")?.bookletKeys, [
    "Cy-Bklt_SM-1",
    "Cy-Bklt_SM-2"
  ]);
  assert.deepEqual(
    entriesByLoginKey.get("SM-5")?.bookletAssignments?.[0]?.accessCodes,
    ["as_code01"]
  );
  assert.deepEqual(
    entriesByLoginKey.get("SM-6")?.bookletAssignments?.[0]?.accessCodes,
    ["as_code02"]
  );
  assert.equal(entriesByLoginKey.get("SM-7")?.executionMode, "run-hot-return");
  assert.equal(entriesByLoginKey.get("SM-8")?.executionMode, "run-hot-return");
  assert.equal(entriesByLoginKey.get("SM-9")?.executionMode, "run-hot-restart");
  assert.equal(entriesByLoginKey.get("SM-10")?.validFrom, "1/6/2023 10:00");
  assert.equal(entriesByLoginKey.get("SM-11")?.validTo, "1/6/2023 10:00");
  assert.equal(entriesByLoginKey.get("SM-12")?.validForMinutes, 10);
});
