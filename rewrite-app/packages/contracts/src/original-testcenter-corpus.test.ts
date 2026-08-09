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
    additionalCases?: Array<{
      caseId: string;
      inputFixture: string;
      outcomeFixture: string;
      inputSourcePath: string;
      outcomeSourcePath: string;
      inputSha256: string;
      outcomeSha256: string;
      expectedStates: Record<string, string>;
    }>;
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

test("original Testcenter compatibility corpus pins official IQB coding fixtures", () => {
  const corpus = JSON.parse(
    readFileSync(resolve(corpusRoot, "corpus.json"), "utf8")
  ) as OriginalTestcenterCorpus;
  assert.equal(corpus.codingSchemePackages.length, 34);
  for (const codingPackage of corpus.codingSchemePackages) {
    assert.equal(
      codingPackage.sourceRepository,
      "https://github.com/iqb-berlin/responses"
    );
    assert.equal(codingPackage.sourceTag, "3.6.0");
    assert.equal(
      codingPackage.sourceCommit,
      "e04e585e6514e5257ac42f48b629628326471f90"
    );
    assert.equal(codingPackage.license, "MIT");
    for (const [fixture, expectedHash] of [
      [codingPackage.schemeFixture, codingPackage.schemeSha256],
      [codingPackage.inputFixture, codingPackage.inputSha256],
      [codingPackage.outcomeFixture, codingPackage.outcomeSha256],
      ...(codingPackage.additionalCases ?? []).flatMap(additionalCase => [
        [additionalCase.inputFixture, additionalCase.inputSha256] as const,
        [additionalCase.outcomeFixture, additionalCase.outcomeSha256] as const
      ])
    ] as const) {
      assert.equal(
        createHash("sha256")
          .update(readFileSync(resolve(corpusRoot, fixture)))
          .digest("hex"),
        expectedHash
      );
    }
  }
  const officialCodingInputSourcePaths = corpus.codingSchemePackages.flatMap(
    codingPackage => [
      codingPackage.inputSourcePath,
      ...(codingPackage.additionalCases ?? []).map(
        additionalCase => additionalCase.inputSourcePath
      )
    ]
  );
  assert.equal(officialCodingInputSourcePaths.length, 70);
  assert.equal(new Set(officialCodingInputSourcePaths).size, 70);

  const solver = corpus.codingSchemePackages.find(
    codingPackage => codingPackage.family === "solver-alias-chain"
  );
  assert.ok(solver);
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

  const uniqueValues = corpus.codingSchemePackages.find(
    codingPackage => codingPackage.family === "unique-values-processing"
  );
  assert.ok(uniqueValues);
  assert.deepEqual(
    [
      uniqueValues.schemeSourcePath,
      uniqueValues.inputSourcePath,
      uniqueValues.outcomeSourcePath
    ],
    [
      "test/coding/derive/UNIQUE_VALUES/coding-scheme.json",
      "test/coding/derive/UNIQUE_VALUES/03_input.json",
      "test/coding/derive/UNIQUE_VALUES/03_outcome.json"
    ]
  );
  const uniqueScheme = JSON.parse(
    readFileSync(resolve(corpusRoot, uniqueValues.schemeFixture), "utf8")
  ) as {
    version?: string;
    variableCodings: Array<{
      id: string;
      sourceType: string;
      sourceParameters?: { processing?: string[] };
    }>;
  };
  assert.equal(uniqueScheme.version, undefined);
  assert.deepEqual(
    uniqueScheme.variableCodings.slice(3).map(variable => variable.sourceType),
    [
      "UNIQUE_VALUES",
      "UNIQUE_VALUES",
      "UNIQUE_VALUES",
      "UNIQUE_VALUES",
      "UNIQUE_VALUES",
      "UNIQUE_VALUES",
      "UNIQUE_VALUES"
    ]
  );
  assert.deepEqual(
    uniqueScheme.variableCodings[9]?.sourceParameters?.processing,
    ["TO_LOWER_CASE", "REMOVE_DISPENSABLE_SPACES"]
  );
  const uniqueOutcome = JSON.parse(
    readFileSync(resolve(corpusRoot, uniqueValues.outcomeFixture), "utf8")
  ) as Array<{
    id: string;
    status: string;
    value: unknown;
    code?: number;
    score?: number;
  }>;
  assert.deepEqual(
    uniqueOutcome.slice(3).map(variable => [
      variable.id,
      variable.value,
      variable.status,
      variable.code ?? null,
      variable.score ?? null
    ]),
    [
      ["d1", null, "DERIVE_ERROR", null, null],
      ["d2", true, "NO_CODING", null, null],
      ["d3", true, "CODING_COMPLETE", 1, 7],
      ["d4", false, "NO_CODING", null, null],
      ["d5", true, "NO_CODING", null, null],
      ["d6", false, "NO_CODING", null, null],
      ["d7", true, "NO_CODING", null, null]
    ]
  );

  const remainingDerivedFamilies = [
    {
      family: "concat-code-chain",
      sourceDirectory: "CONCAT_CODE",
      inputCase: "01",
      sourceTypes: [
        "CONCAT_CODE",
        "CONCAT_CODE",
        "CONCAT_CODE",
        "CONCAT_CODE",
        "CONCAT_CODE"
      ],
      derivedOffset: 4,
      expectedOutcome: [
        ["d1", null, "DERIVE_ERROR", null, null],
        ["d2", "1_1", "NO_CODING", null, null],
        ["d3", "1_2_1", "CODING_COMPLETE", 1, 7],
        ["d4", "1_1_2", "NO_CODING", null, null],
        ["d5", "0_1", "NO_CODING", null, null]
      ]
    },
    {
      family: "copy-value-unset",
      sourceDirectory: "COPY_VALUE",
      inputCase: "03",
      sourceTypes: ["COPY_VALUE", "SUM_SCORE", "COPY_VALUE"],
      derivedOffset: 3,
      expectedOutcome: [
        ["d1", null, "DERIVE_ERROR", null, null],
        ["d2", 3, "NO_CODING", null, null],
        ["d3", null, "UNSET", null, null]
      ]
    },
    {
      family: "sum-code-derived-coding",
      sourceDirectory: "SUM_CODE",
      inputCase: "02",
      sourceTypes: ["SUM_CODE"],
      derivedOffset: 3,
      expectedOutcome: [
        ["d1", 2, "CODING_COMPLETE", 2, 0]
      ]
    },
    {
      family: "sum-score-partial",
      sourceDirectory: "SUM_SCORE",
      inputCase: "02",
      sourceTypes: ["SUM_SCORE", "SUM_SCORE"],
      derivedOffset: 3,
      expectedOutcome: [
        ["d1", null, "INVALID", null, null],
        ["d2", 3, "NO_CODING", null, null]
      ]
    }
  ] as const;
  for (const expectedFamily of remainingDerivedFamilies) {
    const codingPackage = corpus.codingSchemePackages.find(
      candidate => candidate.family === expectedFamily.family
    );
    assert.ok(codingPackage);
    assert.deepEqual(
      [
        codingPackage.schemeSourcePath,
        codingPackage.inputSourcePath,
        codingPackage.outcomeSourcePath
      ],
      [
        `test/coding/derive/${expectedFamily.sourceDirectory}/coding-scheme.json`,
        `test/coding/derive/${expectedFamily.sourceDirectory}/${expectedFamily.inputCase}_input.json`,
        `test/coding/derive/${expectedFamily.sourceDirectory}/${expectedFamily.inputCase}_outcome.json`
      ]
    );
    const derivedScheme = JSON.parse(
      readFileSync(resolve(corpusRoot, codingPackage.schemeFixture), "utf8")
    ) as {
      version?: string;
      variableCodings: Array<{ id: string; sourceType: string }>;
    };
    assert.equal(derivedScheme.version, undefined);
    assert.deepEqual(
      derivedScheme.variableCodings
        .slice(expectedFamily.derivedOffset)
        .map(variable => variable.sourceType),
      expectedFamily.sourceTypes
    );
    const derivedOutcome = JSON.parse(
      readFileSync(resolve(corpusRoot, codingPackage.outcomeFixture), "utf8")
    ) as Array<{
      id: string;
      status: string;
      value: unknown;
      code?: number;
      score?: number;
    }>;
    assert.deepEqual(
      derivedOutcome.slice(expectedFamily.derivedOffset).map(variable => [
        variable.id,
        variable.value,
        variable.status,
        variable.code ?? null,
        variable.score ?? null
      ]),
      expectedFamily.expectedOutcome
    );
  }

  const derivedInputSourcePaths = corpus.codingSchemePackages
    .filter(codingPackage =>
      codingPackage.schemeSourcePath.startsWith("test/coding/derive/")
    )
    .flatMap(codingPackage => [
      codingPackage.inputSourcePath,
      ...(codingPackage.additionalCases ?? []).map(
        additionalCase => additionalCase.inputSourcePath
      )
    ])
    .sort();
  assert.deepEqual(derivedInputSourcePaths, [
    "test/coding/derive/CONCAT_CODE/01_input.json",
    "test/coding/derive/COPY_VALUE/01_input.json",
    "test/coding/derive/COPY_VALUE/02_input.json",
    "test/coding/derive/COPY_VALUE/03_input.json",
    "test/coding/derive/MANUAL/case1/01_input.json",
    "test/coding/derive/MANUAL/case2/01_input.json",
    "test/coding/derive/SOLVER/case1/01_input.json",
    "test/coding/derive/SOLVER/case1/02_input.json",
    "test/coding/derive/SOLVER/case1/03_input.json",
    "test/coding/derive/SOLVER/case2/01_input.json",
    "test/coding/derive/SOLVER/case3/01_input.json",
    "test/coding/derive/SOLVER/case4-same-id-alias/01_input.json",
    "test/coding/derive/SOLVER/case4-same-id-alias/02_input.json",
    "test/coding/derive/SOLVER/case4-same-id-alias/03_input.json",
    "test/coding/derive/SUM_CODE/01_input.json",
    "test/coding/derive/SUM_CODE/02_input.json",
    "test/coding/derive/SUM_SCORE/01_input.json",
    "test/coding/derive/SUM_SCORE/02_input.json",
    "test/coding/derive/SUM_SCORE/03_input.json",
    "test/coding/derive/UNIQUE_VALUES/01_input.json",
    "test/coding/derive/UNIQUE_VALUES/02_input.json",
    "test/coding/derive/UNIQUE_VALUES/03_input.json",
    "test/coding/derive/UNIQUE_VALUES/04_input.json"
  ]);

  for (const [family, expectedSourceTypes] of [
    ["manual-derive-case1", ["BASE", "BASE", "MANUAL"]],
    ["manual-derive-case2", ["BASE", "BASE", "MANUAL"]],
    ["solver-case2", ["BASE", "BASE", "SOLVER"]],
    ["solver-case3", ["BASE", "BASE", "BASE", "SOLVER"]],
    [
      "solver-same-id-alias",
      ["BASE", "BASE", "BASE", "SOLVER", "SOLVER", "SOLVER", "SOLVER", "SOLVER"]
    ]
  ] as const) {
    const codingPackage = corpus.codingSchemePackages.find(
      candidate => candidate.family === family
    );
    assert.ok(codingPackage);
    const derivedScheme = JSON.parse(
      readFileSync(resolve(corpusRoot, codingPackage.schemeFixture), "utf8")
    ) as { variableCodings: Array<{ sourceType: string }> };
    assert.deepEqual(
      derivedScheme.variableCodings.map(variable => variable.sourceType),
      expectedSourceTypes
    );
  }

  const rootCodingFamilies = [
    ["base-aliases", "alias"],
    ["subform-responses", "subforms"]
  ] as const;
  for (const [family, sourceDirectory] of rootCodingFamilies) {
    const codingPackage = corpus.codingSchemePackages.find(
      candidate => candidate.family === family
    );
    assert.ok(codingPackage);
    assert.deepEqual(
      [
        codingPackage.schemeSourcePath,
        codingPackage.inputSourcePath,
        codingPackage.outcomeSourcePath
      ],
      [
        `test/coding/${sourceDirectory}/coding-scheme.json`,
        `test/coding/${sourceDirectory}/01_input.json`,
        `test/coding/${sourceDirectory}/01_outcome.json`
      ]
    );
  }
  const subformPackage = corpus.codingSchemePackages.find(
    candidate => candidate.family === "subform-responses"
  );
  assert.ok(subformPackage);
  const subformOutcome = JSON.parse(
    readFileSync(resolve(corpusRoot, subformPackage.outcomeFixture), "utf8")
  ) as Array<{
    id: string;
    subform?: string;
    status: string;
    code?: number;
    score?: number;
  }>;
  assert.deepEqual(
    subformOutcome.map(response => [
      response.id,
      response.subform ?? null,
      response.status,
      response.code ?? null,
      response.score ?? null
    ]),
    [
      ["value", "0", "CODING_COMPLETE", null, null],
      ["time", "0", "CODING_COMPLETE", 0, 0],
      ["total_correct", null, "NO_CODING", null, null],
      ["total_wrong", null, "NO_CODING", null, null],
      ["a1", "0", "CODING_COMPLETE", 1, 1],
      ["value", "1", "CODING_COMPLETE", null, null],
      ["time", "1", "CODING_COMPLETE", 0, 0],
      ["a1", "1", "CODING_COMPLETE", 1, 1],
      ["value", "2", "CODING_COMPLETE", null, null],
      ["time", "2", "CODING_COMPLETE", 0, 0],
      ["a1", "2", "CODING_COMPLETE", 1, 1]
    ]
  );

  const arrayLength = corpus.codingSchemePackages.find(
    codingPackage => codingPackage.family === "array-length-rulesets"
  );
  assert.ok(arrayLength);
  assert.deepEqual(
    [
      arrayLength.schemeSourcePath,
      arrayLength.inputSourcePath,
      arrayLength.outcomeSourcePath,
      arrayLength.additionalCases?.[0]?.inputSourcePath,
      arrayLength.additionalCases?.[0]?.outcomeSourcePath
    ],
    [
      "test/coding/array-length-check/coding-scheme.json",
      "test/coding/array-length-check/01_input.json",
      "test/coding/array-length-check/01_outcome.json",
      "test/coding/array-length-check/02_input.json",
      "test/coding/array-length-check/02_outcome.json"
    ]
  );
  const arrayLengthScheme = JSON.parse(
    readFileSync(resolve(corpusRoot, arrayLength.schemeFixture), "utf8")
  ) as {
    version?: string;
    variableCodings: Array<{
      id: string;
      sourceType: string;
      deriveSources?: string[];
      codes: Array<{
        id: number;
        ruleSetOperatorAnd?: boolean;
        ruleSets: Array<{ valueArrayPos?: string }>;
      }>;
    }>;
  };
  assert.equal(arrayLengthScheme.version, "3.0");
  assert.deepEqual(
    arrayLengthScheme.variableCodings.map(variable => variable.sourceType),
    ["BASE", "BASE", "BASE", "SUM_SCORE"]
  );
  assert.equal(
    arrayLengthScheme.variableCodings[1]?.codes[0]?.ruleSetOperatorAnd,
    true
  );
  assert.equal(
    arrayLengthScheme.variableCodings[1]?.codes[0]?.ruleSets[1]?.valueArrayPos,
    "ANY_OPEN"
  );
  assert.equal(
    arrayLengthScheme.variableCodings[2]?.codes[0]?.ruleSets[1]?.valueArrayPos,
    "LENGTH"
  );
  assert.deepEqual(arrayLengthScheme.variableCodings[3]?.deriveSources, [
    "b1",
    "b2",
    "b3"
  ]);
  const arrayLengthOutcomes = [
    arrayLength.outcomeFixture,
    arrayLength.additionalCases?.[0]?.outcomeFixture
  ].map(fixture =>
    JSON.parse(readFileSync(resolve(corpusRoot, fixture!), "utf8"))
  ) as Array<
    Array<{
      id: string;
      status: string;
      value: unknown;
      code?: number;
      score?: number;
    }>
  >;
  assert.deepEqual(
    arrayLengthOutcomes.map(outcome =>
      outcome.map(variable => [
        variable.id,
        variable.value,
        variable.status,
        variable.code ?? null,
        variable.score ?? null
      ])
    ),
    [
      [
        ["b1", ["01_4"], "CODING_COMPLETE", 1, 1],
        ["b2", ["01_2", "01_1"], "CODING_COMPLETE", 1, 1],
        ["b3", ["01_3"], "CODING_COMPLETE", 1, 1],
        ["d1", 3, "CODING_COMPLETE", 1, 1]
      ],
      [
        ["b1", ["01_4"], "CODING_COMPLETE", 1, 1],
        ["b2", ["01_2"], "CODING_COMPLETE", 0, 0],
        ["b3", ["01_3", "01_1"], "CODING_COMPLETE", 0, 0],
        ["d1", 1, "CODING_COMPLETE", 0, 0]
      ]
    ]
  );

  const arrays = corpus.codingSchemePackages.find(
    codingPackage => codingPackage.family === "array-selection-modes"
  );
  assert.ok(arrays);
  assert.deepEqual(
    [
      arrays.schemeSourcePath,
      arrays.inputSourcePath,
      arrays.outcomeSourcePath,
      ...(arrays.additionalCases ?? []).flatMap(additionalCase => [
        additionalCase.inputSourcePath,
        additionalCase.outcomeSourcePath
      ])
    ],
    [
      "test/coding/arrays/coding-scheme.json",
      "test/coding/arrays/01_input.json",
      "test/coding/arrays/01_outcome.json",
      "test/coding/arrays/02_input.json",
      "test/coding/arrays/02_outcome.json",
      "test/coding/arrays/03_input.json",
      "test/coding/arrays/03_outcome.json",
      "test/coding/arrays/04_input.json",
      "test/coding/arrays/04_outcome.json"
    ]
  );
  const arraysScheme = JSON.parse(
    readFileSync(resolve(corpusRoot, arrays.schemeFixture), "utf8")
  ) as {
    version?: string;
    variableCodings: Array<{
      id: string;
      sourceType: string;
      processing?: string[];
      codes: Array<{
        id: number;
        ruleSets: Array<{ valueArrayPos?: string | number }>;
      }>;
    }>;
  };
  assert.equal(arraysScheme.version, undefined);
  assert.deepEqual(
    arraysScheme.variableCodings.map(variable => variable.sourceType),
    ["BASE", "BASE", "BASE", "BASE"]
  );
  assert.deepEqual(arraysScheme.variableCodings[0]?.processing, ["SORT_ARRAY"]);
  assert.equal(
    arraysScheme.variableCodings[0]?.codes[0]?.ruleSets[0]?.valueArrayPos,
    1
  );
  assert.equal(
    arraysScheme.variableCodings[2]?.codes[0]?.ruleSets[0]?.valueArrayPos,
    "SUM"
  );
  assert.deepEqual(
    arraysScheme.variableCodings[3]?.codes.map(
      code => code.ruleSets[0]?.valueArrayPos
    ),
    ["ANY_OTHER", "ANY"]
  );
  const arraysOutcomes = [
    arrays.outcomeFixture,
    ...(arrays.additionalCases ?? []).map(
      additionalCase => additionalCase.outcomeFixture
    )
  ].map(fixture =>
    JSON.parse(readFileSync(resolve(corpusRoot, fixture), "utf8"))
  ) as Array<
    Array<{
      id: string;
      status: string;
      value: unknown;
      code?: number;
      score?: number;
    }>
  >;
  assert.deepEqual(
    arraysOutcomes.map(outcome =>
      outcome.map(variable => [
        variable.id,
        variable.value,
        variable.status,
        variable.code ?? null,
        variable.score ?? null
      ])
    ),
    [
      [
        ["b1", ["3", "9", "1", "2"], "CODING_COMPLETE", 1, 1],
        ["b2", ["3", "2", "10", "22"], "CODING_COMPLETE", 1, 1],
        ["b3", ["3", "2", "5", ""], "CODING_COMPLETE", 1, 7],
        ["b4", null, "UNSET", null, null]
      ],
      [
        ["b4", ["10", "9"], "CODING_COMPLETE", 1, 2],
        ["b1", null, "UNSET", null, null],
        ["b2", null, "UNSET", null, null],
        ["b3", null, "UNSET", null, null]
      ],
      [
        ["b4", ["20", "9"], "CODING_INCOMPLETE", null, null],
        ["b1", null, "UNSET", null, null],
        ["b2", null, "UNSET", null, null],
        ["b3", null, "UNSET", null, null]
      ],
      [
        ["b4", ["20"], "CODING_COMPLETE", 2, 2],
        ["b1", null, "UNSET", null, null],
        ["b2", null, "UNSET", null, null],
        ["b3", null, "UNSET", null, null]
      ]
    ]
  );

  const fragmenting = corpus.codingSchemePackages.find(
    codingPackage => codingPackage.family === "regex-fragmenting"
  );
  assert.ok(fragmenting);
  assert.deepEqual(
    [
      fragmenting.schemeSourcePath,
      fragmenting.inputSourcePath,
      fragmenting.outcomeSourcePath
    ],
    [
      "test/coding/fragmenting/coding-scheme.json",
      "test/coding/fragmenting/01_input.json",
      "test/coding/fragmenting/01_outcome.json"
    ]
  );
  const fragmentingScheme = JSON.parse(
    readFileSync(resolve(corpusRoot, fragmenting.schemeFixture), "utf8")
  ) as {
    version?: string;
    variableCodings: Array<{
      id: string;
      sourceType: string;
      processing?: string[];
      fragmenting?: string;
      codes: Array<{
        ruleSets: Array<{
          rules: Array<{
            fragment?: number;
            method: string;
            parameters: string[];
          }>;
        }>;
      }>;
    }>;
  };
  assert.equal(fragmentingScheme.version, undefined);
  assert.deepEqual(
    fragmentingScheme.variableCodings.map(variable => [
      variable.sourceType,
      variable.fragmenting,
      variable.processing ?? []
    ]),
    [
      ["BASE", "(\\d+)\\s*(\\w+)", []],
      ["BASE", "(\\d+)\\s*(\\w+)", []],
      ["BASE", "(\\d+)\\s*(\\w+)", ["IGNORE_CASE"]]
    ]
  );
  assert.deepEqual(
    fragmentingScheme.variableCodings.map(
      variable => variable.codes[0]?.ruleSets[0]?.rules[0]?.fragment
    ),
    [0, 1, 1]
  );
  assert.deepEqual(
    fragmentingScheme.variableCodings.map(
      variable => variable.codes[0]?.ruleSets[0]?.rules[0]?.parameters[0]
    ),
    ["2", "kg", "KG"]
  );
  const fragmentingOutcome = JSON.parse(
    readFileSync(resolve(corpusRoot, fragmenting.outcomeFixture), "utf8")
  ) as Array<{
    id: string;
    status: string;
    value: unknown;
    code?: number;
    score?: number;
  }>;
  assert.deepEqual(
    fragmentingOutcome.map(variable => [
      variable.id,
      variable.value,
      variable.status,
      variable.code ?? null,
      variable.score ?? null
    ]),
    [
      ["b1", "2 kg", "CODING_COMPLETE", 1, 1],
      ["b2", "2 kg", "CODING_COMPLETE", 1, 1],
      ["b3", "2 kg", "CODING_COMPLETE", 1, 7]
    ]
  );

  const ruleFamilies = [
    ["rule-matching-processing", "matching", 4],
    ["rule-numeric-range", "numeric-range", 3],
    ["rule-numeric-full-range", "numeric-full-range", 3],
    ["rule-boolean-values", "boolean", 1],
    ["rule-null-values", "null", 1],
    ["rule-empty-values", "empty", 1],
    ["rule-zero-values", "zero", 1],
    ["rule-empty-array", "empty-array", 1],
    ["rule-injected-variables", "injected-vars", 4],
    [
      "rule-intended-incomplete-statuses",
      "intended-incomplete/case2",
      11
    ],
    ["rule-base-no-value", "base-no-value", 1],
    [
      "rule-base-derived-recoding",
      "base-var-derived-var-same-id",
      1
    ],
    [
      "rule-intended-incomplete-coding",
      "intended-incomplete/case1",
      1
    ],
    ["rule-numeric-match", "numeric-match", 1],
    ["rule-rules-and-joined", "rules-and-joined", 1],
    ["rule-ruleset-else", "ruleset-true", 1],
    ["rule-rulesets-and-joined", "rulesets-and-joined", 1],
    [
      "rule-rulesets-boolean-and-joined",
      "rulesets-boolean-and-joined",
      1
    ]
  ] as const;
  type RuleScheme = {
    version?: string;
    variableCodings: Array<{
      id: string;
      alias?: string;
      sourceType: string;
      codeModel?: string;
      processing?: string[];
      sourceParameters?: { processing?: string[] };
      codes: Array<{
        ruleSets: Array<{
          rules: Array<{ method: string }>;
        }>;
      }>;
    }>;
  };
  type RuleOutcome = Array<{
    id: string;
    value: unknown;
    status: string;
    code?: number;
    score?: number;
  }>;
  const loadedRuleFamilies = ruleFamilies.map(
    ([family, sourceDirectory, caseCount]) => {
      const codingPackage = corpus.codingSchemePackages.find(
        candidate => candidate.family === family
      );
      assert.ok(codingPackage);
      assert.equal(
        codingPackage.schemeSourcePath,
        `test/coding/rules/${sourceDirectory}/coding-scheme.json`
      );
      assert.equal(1 + (codingPackage.additionalCases?.length ?? 0), caseCount);
      const cases = [
        {
          caseId: "01",
          inputFixture: codingPackage.inputFixture,
          outcomeFixture: codingPackage.outcomeFixture
        },
        ...(codingPackage.additionalCases ?? [])
      ];
      assert.deepEqual(
        cases.map(testCase => testCase.caseId),
        Array.from({ length: caseCount }, (_, index) =>
          String(index + 1).padStart(2, "0")
        )
      );
      return {
        family,
        scheme: JSON.parse(
          readFileSync(resolve(corpusRoot, codingPackage.schemeFixture), "utf8")
        ) as RuleScheme,
        outcomes: cases.map(testCase =>
          JSON.parse(
            readFileSync(
              resolve(corpusRoot, testCase.outcomeFixture),
              "utf8"
            )
          ) as RuleOutcome
        )
      };
    }
  );
  const ruleMethods = new Set(
    loadedRuleFamilies.flatMap(({ scheme }) =>
      scheme.variableCodings.flatMap(variable =>
        variable.codes.flatMap(code =>
          code.ruleSets.flatMap(ruleSet =>
            ruleSet.rules.map(rule => rule.method)
          )
        )
      )
    )
  );
  assert.deepEqual([...ruleMethods].sort(), [
    "ELSE",
    "IS_EMPTY",
    "IS_FALSE",
    "IS_NULL",
    "IS_TRUE",
    "MATCH",
    "MATCH_REGEX",
    "NUMERIC_FULL_RANGE",
    "NUMERIC_LESS_THAN",
    "NUMERIC_MATCH",
    "NUMERIC_MAX",
    "NUMERIC_MIN",
    "NUMERIC_MORE_THAN",
    "NUMERIC_RANGE"
  ]);
  const processing = new Set(
    loadedRuleFamilies.flatMap(({ scheme }) =>
      scheme.variableCodings.flatMap(variable => [
        ...(variable.processing ?? []),
        ...(variable.sourceParameters?.processing ?? [])
      ])
    )
  );
  assert.ok(processing.has("IGNORE_ALL_SPACES"));
  assert.ok(processing.has("IGNORE_CASE"));
  assert.ok(processing.has("TAKE_DISPLAYED_AS_VALUE_CHANGED"));
  assert.ok(processing.has("TAKE_EMPTY_AS_VALID"));
  assert.ok(processing.has("REPLAY_REQUIRED"));
  assert.ok(processing.has("NO_CODING"));

  const outcomeTuples = Object.fromEntries(
    loadedRuleFamilies.map(({ family, outcomes }) => [
      family,
      outcomes.map(outcome =>
        outcome.map(variable => [
          variable.id,
          variable.value,
          variable.status,
          variable.code ?? null,
          variable.score ?? null
        ])
      )
    ])
  );
  assert.deepEqual(outcomeTuples["rule-numeric-range"]?.[0], [
    ["b1", "111", "CODING_INCOMPLETE", null, null],
    ["b2", 555, "CODING_COMPLETE", 2, 5],
    ["b3", 60, "CODING_COMPLETE", 2, 2]
  ]);
  assert.deepEqual(outcomeTuples["rule-numeric-full-range"]?.[0], [
    ["b1", "111", "CODING_COMPLETE", 1, 1],
    ["b2", 555, "CODING_COMPLETE", 2, 5],
    ["b3", 60, "CODING_COMPLETE", 2, 2]
  ]);
  assert.deepEqual(
    outcomeTuples["rule-matching-processing"]?.map(outcome =>
      outcome.map(variable => variable.slice(2))
    ),
    [
      [
        ["CODING_COMPLETE", 1, 1],
        ["CODING_COMPLETE", 1, 100],
        ["CODING_COMPLETE", 1, 7]
      ],
      [
        ["CODING_COMPLETE", 1, 1],
        ["CODING_COMPLETE", 1, 100],
        ["CODING_COMPLETE", 1, 7]
      ],
      [
        ["CODING_COMPLETE", 2, 2],
        ["CODING_COMPLETE", 1, 100],
        ["CODING_COMPLETE", 2, 2]
      ],
      [
        ["CODING_COMPLETE", 2, 2],
        ["CODING_COMPLETE", 0, 0],
        ["CODING_COMPLETE", 2, 2]
      ]
    ]
  );
  assert.deepEqual(outcomeTuples["rule-boolean-values"]?.[0], [
    ["b1", true, "CODING_COMPLETE", 1, 1],
    ["b2", "true", "CODING_COMPLETE", 2, 5],
    ["b3", 1, "CODING_COMPLETE", 2, 2]
  ]);
  assert.deepEqual(
    [
      outcomeTuples["rule-null-values"]?.[0],
      outcomeTuples["rule-empty-values"]?.[0],
      outcomeTuples["rule-zero-values"]?.[0],
      outcomeTuples["rule-empty-array"]?.[0]
    ],
    [
      [
        ["b1", null, "CODING_INCOMPLETE", null, null],
        ["b2", null, "CODING_COMPLETE", 1, 100],
        ["b3", null, "CODING_INCOMPLETE", null, null]
      ],
      [
        ["b1", "", "INVALID", null, null],
        ["b2", "", "CODING_COMPLETE", 1, 100],
        ["b3", "", "INVALID", null, null]
      ],
      [
        ["b1", 0, "CODING_COMPLETE", 1, 1],
        ["b2", 9, "CODING_COMPLETE", 1, 1],
        ["d1", 2, "CODING_COMPLETE", 1, 1]
      ],
      [["b1", [], "CODING_COMPLETE", 34, 0]]
    ]
  );
  const injectedFamily = loadedRuleFamilies.find(
    family => family.family === "rule-injected-variables"
  );
  assert.ok(injectedFamily);
  assert.deepEqual(
    injectedFamily.scheme.variableCodings.map(variable => [
      variable.alias ?? variable.id,
      variable.sourceType,
      variable.codeModel
    ]),
    [
      ["b1", "BASE", "MANUAL_ONLY"],
      ["b2", "BASE", "MANUAL_ONLY"],
      ["b3", "BASE", "MANUAL_ONLY"],
      ["d1", "", "MANUAL_ONLY"]
    ]
  );
  assert.deepEqual(
    outcomeTuples["rule-injected-variables"]?.map(outcome => outcome[3]),
    [
      ["d1", "", "CODING_COMPLETE", 0, 0],
      ["d1", "", "DISPLAYED", -97, -99],
      ["d1", "", "INVALID", -98, 0],
      ["d1", "", "CODING_ERROR", -97, 0]
    ]
  );
  assert.deepEqual(
    outcomeTuples["rule-intended-incomplete-statuses"]?.map(outcome =>
      outcome.map(variable => variable[2])
    ),
    [
      ["INTENDED_INCOMPLETE", "CODING_INCOMPLETE", "DERIVE_PENDING"],
      ["INTENDED_INCOMPLETE", "DERIVE_PENDING", "DERIVE_PENDING"],
      ["INTENDED_INCOMPLETE", "UNSET", "UNSET"],
      ["INTENDED_INCOMPLETE", "NOT_REACHED", "INVALID"],
      ["INTENDED_INCOMPLETE", "DISPLAYED", "INVALID"],
      ["INTENDED_INCOMPLETE", "PARTLY_DISPLAYED", "INVALID"],
      ["INTENDED_INCOMPLETE", "DERIVE_ERROR", "DERIVE_ERROR"],
      ["INTENDED_INCOMPLETE", "NO_CODING", "DERIVE_ERROR"],
      ["INTENDED_INCOMPLETE", "INVALID", "INVALID"],
      ["INTENDED_INCOMPLETE", "CODING_ERROR", "CODING_ERROR"],
      ["INTENDED_INCOMPLETE", "INTENDED_INCOMPLETE", "CODING_COMPLETE"]
    ]
  );
  assert.deepEqual(
    outcomeTuples["rule-intended-incomplete-statuses"]?.[10]?.[2],
    ["d1", 0, "CODING_COMPLETE", 0, 0]
  );
  assert.deepEqual(outcomeTuples["rule-base-no-value"]?.[0], [
    ["text-field_1", "5", "CODING_COMPLETE", 0, 0]
  ]);
  assert.deepEqual(
    outcomeTuples["rule-base-derived-recoding"]?.[0]?.[3],
    ["d1", 4, "CODING_COMPLETE", 1, 1]
  );
  assert.deepEqual(
    outcomeTuples["rule-intended-incomplete-coding"]?.[0]?.map(
      variable => variable.slice(2)
    ),
    [
      ["INVALID", 0, 0],
      ["CODING_COMPLETE", 0, 0],
      ["INTENDED_INCOMPLETE", 0, 0]
    ]
  );
  assert.deepEqual(outcomeTuples["rule-numeric-match"]?.[0]?.[4], [
    "d1",
    3,
    "CODING_COMPLETE",
    0,
    0
  ]);
  assert.deepEqual(
    [
      outcomeTuples["rule-rules-and-joined"]?.[0]?.map(
        variable => variable.slice(2)
      ),
      outcomeTuples["rule-rulesets-and-joined"]?.[0]?.[0]?.slice(2),
      outcomeTuples["rule-rulesets-boolean-and-joined"]?.[0]?.[0]?.slice(2)
    ],
    [
      [
        ["CODING_COMPLETE", 1, 1],
        ["CODING_COMPLETE", 0, 0]
      ],
      ["CODING_COMPLETE", 1, 1],
      ["CODING_COMPLETE", 0, 0]
    ]
  );
  assert.deepEqual(outcomeTuples["rule-ruleset-else"]?.[0]?.[0], [
    "05",
    "05_3",
    "CODING_COMPLETE",
    1,
    331
  ]);
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
