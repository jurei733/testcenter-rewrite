import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { brotliDecompressSync } from "node:zlib";

import { CodingSchemeFactory } from "@iqb/responses";
import { CodingScheme } from "@iqbspecs/coding-scheme";
import type { Response as IqbResponse } from "@iqbspecs/response/response.interface.js";

import {
  parseOriginalTestcenterOperationalLogins,
  parseParticipantRosterText
} from "./participant-roster.js";

type PinnedOriginalFixture = {
  fixture: string;
  sourcePath: string;
  sha256: string;
  encoding?: "base64" | "brotli-base64";
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
  currentE2eFixtures: {
    sourceRepository: string;
    sourceCommit: string;
    sourceDirectory: string;
    resource: PinnedOriginalFixture & {
      encoding: "base64";
      content: string;
    };
    validBooklets: Array<
      PinnedOriginalFixture & {
        encoding: "base64";
        bookletKey: string;
        unitKeys: string[];
      }
    >;
    bookletIdentityCollision: PinnedOriginalFixture & {
      encoding: "base64";
      collidesWithFixture: string;
      bookletKey: string;
      diagnosticCode: string;
    };
    roster: PinnedOriginalFixture & {
      encoding: "base64";
      schemaVersion: string;
      participantLoginKeys: string[];
      operationalLoginKeys: string[];
      hasSystemCheckLogin: boolean;
    };
    invalidXml: Array<
      PinnedOriginalFixture & {
        encoding: "base64";
        kind: "source-package" | "participant-roster";
        diagnosticCode: string;
      }
    >;
  };
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
  currentOriginalSamplePackage: {
    sourceRepository: string;
    sourceCommit: string;
    sourceDirectory: string;
    booklet: PinnedOriginalFixture & {
      encoding: "base64";
      bookletKey: string;
      unitKeys: string[];
    };
    additionalBooklets: Array<
      [fixture: string, bookletKey: string, sha256: string]
    >;
    units: Array<
      PinnedOriginalFixture & {
        encoding: "base64";
        unitKey: string;
        playerKey: string;
      }
    >;
    definition: PinnedOriginalFixture;
    codingScheme: PinnedOriginalFixture & { encoding: "base64" };
    player: PinnedOriginalFixture & {
      encoding: "brotli-base64";
      playerKey: string;
    };
    resourcePackage: PinnedOriginalFixture & { encoding: "base64" };
    roster: PinnedOriginalFixture & {
      encoding: "base64";
      participantLoginKeys: string[];
      operationalLoginKeys: string[];
    };
    systemChecks: Array<
      [fixture: string, checkId: string, sha256: string]
    >;
  };
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
  currentOriginalBookletConfigPackage: {
    sourceRepository: string;
    sourceCommit: string;
    sourceDirectory: string;
    bookletKeys: string[];
    currentBookletOverrides: Array<
      PinnedOriginalFixture & {
        encoding: "base64";
        bookletKey: string;
      }
    >;
    units: Array<[fixture: string, unitKey: string, sha256: string]>;
    player: PinnedOriginalFixture & {
      encoding: "brotli-base64";
      playerKey: string;
    };
    roster: PinnedOriginalFixture & {
      encoding: "base64";
      groupKey: string;
      participantCount: number;
      loginPrefix: string;
      password: string;
      executionMode: string;
    };
  };
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
  currentOriginalTestControllerPackage: {
    sourceRepository: string;
    sourceCommit: string;
    sourceDirectory: string;
    booklets: Array<[fixture: string, bookletKey: string, sha256: string]>;
    units: Array<[fixture: string, unitKey: string]>;
    player: {
      fixture: string;
      encoding: "brotli-base64";
      playerKey: string;
    };
    roster: PinnedOriginalFixture & {
      encoding: "base64";
      participantCount: number;
      groups: Array<{
        groupKey: string;
        participants: Array<[
          loginKey: string,
          executionMode: string,
          bookletKey: string
        ]>;
      }>;
    };
  };
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
  currentOriginalGroupMonitoringPackage: {
    sourceRepository: string;
    sourceCommit: string;
    sourceDirectory: string;
    booklet: PinnedOriginalFixture & {
      encoding: "base64";
      bookletKey: string;
      unitKeys: string[];
    };
    units: Array<
      PinnedOriginalFixture & {
        encoding: "base64";
        unitKey: string;
      }
    >;
    player: PinnedOriginalFixture & {
      encoding: "brotli-base64";
      playerKey: string;
    };
    roster: PinnedOriginalFixture & {
      encoding: "base64";
      participantLoginKeys: string[];
      operationalLoginKeys: string[];
      monitorPasswordRequired: boolean;
    };
  };
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
  currentOriginalSessionManagementPackage: {
    sourceRepository: string;
    sourceCommit: string;
    sourceDirectory: string;
    booklets: Array<
      PinnedOriginalFixture & {
        encoding: "base64";
        bookletKey: string;
        unitKeys: string[];
      }
    >;
    units: Array<
      PinnedOriginalFixture & {
        encoding: "base64";
        unitKey: string;
      }
    >;
    player: PinnedOriginalFixture & {
      encoding: "brotli-base64";
      playerKey: string;
    };
    roster: PinnedOriginalFixture & {
      encoding: "base64";
      participantLoginKeys: string[];
    };
  };
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
    units: Array<{
      unitKey: string;
      unitFixture: string;
      metadataReferenceFixture?: string;
      metadataReferenceEncoding?: "base64";
      metadataReferenceSha256?: string;
      sourcePaths: {
        unit: string;
        metadataReference?: string;
      };
    }>;
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
    definitionEncoding: "base64" | "utf8";
    sourceRepository: string;
    sourceTag: string;
    sourceCommit: string;
    playerSourceRepository?: string;
    playerSourceCommit?: string;
    playerSourcePath: string;
    playerSourceUrl: string;
    playerByteSize?: number;
    playerSha256: string;
    definitionSourceRepository?: string;
    definitionSourceCommit?: string;
    definitionSourcePath: string;
    definitionSourceUrl: string;
    definitionExtraction?: string;
    definitionSha256: string;
    license: string;
    playerKey: string;
    playerModuleId: string;
    playerModuleVersion: string;
    playerApiVersion: string;
    metadataApiVersion: string;
    metadataFormat: string;
    unitDefinitionType?: string;
    unitStateType?: string;
    metadataCompatibilityWarnings?: string[];
    requiredResourceId?: string;
    resourceFixture?: string;
    resourceEncoding?: "base64";
    resourceSha256?: string;
    resourceBuild?: string;
    runtimeSourceRepository?: string;
    runtimeSourceCommit?: string;
    runtimeVersion?: string;
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
  currentOriginalAdaptivePackage: {
    sourceRepository: string;
    sourceCommit: string;
    sourceDirectory: string;
    booklet: PinnedOriginalFixture & {
      bookletKey: string;
      unitKeys: string[];
      defaultStates: Record<string, string>;
      professionalStates: Record<string, string>;
      professionalVisibleUnitKeys: string[];
      advancedStates: Record<string, string>;
      advancedVisibleUnitKeys: string[];
      bonusReviewStates: Record<string, string>;
      bonusReviewVisibleUnitKeys: string[];
    };
    unit: PinnedOriginalFixture & { unitKey: string };
    codingScheme: PinnedOriginalFixture & {
      encoding: "base64";
      version: string;
    };
    player: PinnedOriginalFixture & {
      encoding: "brotli-base64";
      playerKey: string;
      playerModuleId: string;
      playerModuleVersion: string;
      playerApiVersion: string;
    };
    roster: PinnedOriginalFixture & {
      groupKey: string;
      participants: Array<[loginKey: string, executionMode: string]>;
      assignments: Record<string, string[]>;
    };
    routingResponses: {
      professional: Array<{ id: string; status: string; value: unknown }>;
      advanced: Array<{ id: string; status: string; value: unknown }>;
    };
  };
  currentOriginalAspectPackage: {
    sourceRepository: string;
    sourceCommit: string;
    sourceDirectory: string;
    booklets: Array<
      PinnedOriginalFixture & {
        encoding: "base64";
        bookletKey: string;
        unitKeys: string[];
      }
    >;
    units: Array<
      PinnedOriginalFixture & {
        encoding: "base64";
        unitKey: string;
        definitionFixture: string;
        definitionEncoding: "utf8" | "base64" | "brotli-base64";
        definitionSourcePath: string;
        definitionSha256: string;
        metadataReferenceFixture?: string;
      }
    >;
    player: PinnedOriginalFixture & {
      encoding: "brotli-base64";
      playerKey: string;
    };
    roster: PinnedOriginalFixture & {
      encoding: "base64";
      groupKey: string;
      participantLoginKeys: string[];
      operationalLoginKeys: string[];
      assignments: Record<string, string[]>;
      accessCodes: Record<string, string[]>;
    };
  };
  currentOriginalStarsPackage: {
    family: string;
    sourceRepository: string;
    sourceCommit: string;
    sourceDirectory: string;
    player: PinnedOriginalFixture & {
      encoding: "brotli-base64";
      playerKey: string;
      playerModuleId: string;
      playerModuleVersion: string;
      playerApiVersion: string;
      metadataVersion: string;
      unitStateType: string;
    };
    unit: PinnedOriginalFixture & { unitKey: string };
    definition: PinnedOriginalFixture & {
      encoding: "base64";
      definitionType: string;
    };
    metadata: PinnedOriginalFixture & { encoding: "base64" };
    booklet: PinnedOriginalFixture & {
      bookletKey: string;
      unitKey: string;
      unitCount: number;
      aliases: string[];
    };
    roster: PinnedOriginalFixture & {
      groupKey: string;
      participantLogins: Array<[loginKey: string, executionMode: string]>;
    };
  };
  currentOriginalSpeedPackage: {
    family: string;
    sourceRepository: string;
    sourceCommit: string;
    sourceDirectory: string;
    player: PinnedOriginalFixture & {
      encoding: "brotli-base64";
      playerKey: string;
      playerModuleId: string;
      playerModuleVersion: string;
      playerApiVersion: string;
      metadataVersion: string;
      unitStateType: string;
    };
    units: Array<
      PinnedOriginalFixture & {
        encoding?: "base64";
        unitKey: string;
        definitionFixture: string;
        definitionEncoding: "base64" | "brotli-base64";
        definitionSourcePath: string;
        definitionSha256: string;
      }
    >;
    booklet: PinnedOriginalFixture & {
      bookletKey: string;
      unitKeys: string[];
      originalUnitIds: string[];
      testletIds: string[];
      timedUnitKeys: string[];
      timeMaxMinutes: number;
      timeMaxLeave: "confirm";
    };
    roster: PinnedOriginalFixture & {
      groupKey: string;
      participantLogins: Array<[loginKey: string, executionMode: string]>;
    };
  };
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

test("original Testcenter compatibility corpus pins the current 18.0 E2E fixtures", () => {
  const corpus = JSON.parse(
    readFileSync(resolve(corpusRoot, "corpus.json"), "utf8")
  ) as OriginalTestcenterCorpus;
  const current = corpus.currentE2eFixtures;
  assert.equal(
    current.sourceRepository,
    "https://github.com/iqb-berlin/testcenter"
  );
  assert.equal(
    current.sourceCommit,
    "a5a6d25a72990d667300804c337cc5b500b01d2f"
  );
  assert.equal(current.sourceDirectory, "e2e/src/fixtures");

  const fixtures = [
    current.resource,
    ...current.validBooklets,
    current.bookletIdentityCollision,
    current.roster,
    ...current.invalidXml
  ];
  assert.equal(fixtures.length, 13);
  assert.equal(new Set(fixtures.map(fixture => fixture.sourcePath)).size, 13);
  const readFixture = (fixture: PinnedOriginalFixture): Buffer =>
    Buffer.from(
      readFileSync(resolve(corpusRoot, fixture.fixture), "utf8"),
      "base64"
    );
  for (const fixture of fixtures) {
    assert.equal(fixture.encoding, "base64", fixture.sourcePath);
    assert.ok(
      fixture.sourcePath.startsWith(`${current.sourceDirectory}/`),
      fixture.sourcePath
    );
    assert.equal(
      createHash("sha256").update(readFixture(fixture)).digest("hex"),
      fixture.sha256,
      fixture.sourcePath
    );
  }

  assert.equal(readFixture(current.resource).toString("utf8"), current.resource.content);
  for (const booklet of current.validBooklets) {
    const bookletXml = readFixture(booklet).toString("utf8");
    assert.match(bookletXml, /testcenter-booklet-xml\/18\.0/);
    assert.match(bookletXml, new RegExp(`<Id>${booklet.bookletKey.replaceAll(".", "\\.")}<\\/Id>`));
    assert.match(bookletXml, /<Config key="page_navibuttons">FULL<\/Config>/);
  }
  const primaryBooklet = current.validBooklets.find(
    booklet => booklet.fixture === current.bookletIdentityCollision.collidesWithFixture
  );
  assert.ok(primaryBooklet);
  const primaryBookletXml = readFixture(primaryBooklet).toString("utf8");
  const duplicateBookletXml = readFixture(
    current.bookletIdentityCollision
  ).toString("utf8");
  assert.notEqual(primaryBookletXml, duplicateBookletXml);
  assert.match(
    primaryBookletXml,
    new RegExp(`<Id>${current.bookletIdentityCollision.bookletKey.replaceAll(".", "\\.")}<\\/Id>`)
  );
  assert.match(
    duplicateBookletXml,
    new RegExp(`<Id>${current.bookletIdentityCollision.bookletKey.replaceAll(".", "\\.")}<\\/Id>`)
  );

  const rosterXml = readFixture(current.roster).toString("utf8");
  assert.match(
    rosterXml,
    new RegExp(`testcenter-testtaker-xml/${current.roster.schemaVersion}`)
  );
  assert.deepEqual(
    parseParticipantRosterText(rosterXml).map(participant => participant.loginKey),
    current.roster.participantLoginKeys
  );
  const operationalLogins = parseOriginalTestcenterOperationalLogins(rosterXml);
  assert.deepEqual(
    operationalLogins.map(login => login.loginKey),
    current.roster.operationalLoginKeys
  );
  assert.equal(
    operationalLogins.some(login => login.loginMode === "sys-check-login"),
    current.roster.hasSystemCheckLogin
  );
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

test("original Testcenter compatibility corpus pins the current root sample package", () => {
  const corpus = JSON.parse(
    readFileSync(resolve(corpusRoot, "corpus.json"), "utf8")
  ) as OriginalTestcenterCorpus;
  const current = corpus.currentOriginalSamplePackage;
  assert.equal(
    current.sourceCommit,
    "a5a6d25a72990d667300804c337cc5b500b01d2f"
  );
  assert.equal(current.sourceDirectory, "sampledata");

  const decodeFixture = (fixture: PinnedOriginalFixture): Buffer => {
    const stored = readFileSync(resolve(corpusRoot, fixture.fixture));
    if (fixture.encoding === "base64") {
      return Buffer.from(stored.toString("utf8").trim(), "base64");
    }
    if (fixture.encoding === "brotli-base64") {
      return brotliDecompressSync(
        Buffer.from(stored.toString("utf8").trim(), "base64")
      );
    }
    return stored;
  };
  for (const fixture of [
    current.booklet,
    ...current.units,
    current.definition,
    current.codingScheme,
    current.player,
    current.resourcePackage,
    current.roster
  ]) {
    assert.equal(
      createHash("sha256").update(decodeFixture(fixture)).digest("hex"),
      fixture.sha256,
      fixture.sourcePath
    );
  }
  assert.match(
    decodeFixture(current.booklet).toString("utf8"),
    /testcenter-booklet-xml\/18\.0/
  );
  assert.deepEqual(
    current.booklet.unitKeys,
    ["UNIT.SAMPLE", "UNIT.SAMPLE-2", "an_alias"]
  );
  for (const [fixture, bookletKey, sha256] of current.additionalBooklets) {
    const document = Buffer.from(
      readFileSync(resolve(corpusRoot, fixture), "utf8").trim(),
      "base64"
    );
    assert.equal(createHash("sha256").update(document).digest("hex"), sha256);
    assert.match(document.toString("utf8"), /testcenter-booklet-xml\/18\.0/);
    assert.match(document.toString("utf8"), new RegExp(`<Id>${bookletKey}<\\/Id>`));
  }
  for (const unit of current.units) {
    assert.match(decodeFixture(unit).toString("utf8"), /unit-xml\/17\.4/);
  }
  assert.equal(current.player.playerKey, "verona-player-simple-6.0");

  const rosterXml = decodeFixture(current.roster).toString("utf8");
  assert.match(rosterXml, /testcenter-testtaker-xml\/18\.0/);
  const participants = parseParticipantRosterText(rosterXml);
  assert.deepEqual(
    participants.map(participant => participant.loginKey),
    current.roster.participantLoginKeys
  );
  assert.deepEqual(
    participants.find(participant => participant.loginKey === "test")
      ?.viewSettings,
    {
      theme: "Primar",
      codeInput: { type: "text-field", length: 3 }
    }
  );
  assert.deepEqual(
    participants.find(participant => participant.loginKey === "test2")
      ?.viewSettings,
    { theme: "Sekundar", codeInput: { type: "keypad-numbers", length: 3 } }
  );
  const operationalLogins = parseOriginalTestcenterOperationalLogins(rosterXml);
  assert.deepEqual(
    operationalLogins.map(login => login.loginKey),
    current.roster.operationalLoginKeys
  );
  assert.equal(
    operationalLogins.find(login => login.loginKey === "test-group-monitor-2")
      ?.monitorBookletVisibility,
    "hidden"
  );
  for (const [fixture, checkId, sha256] of current.systemChecks) {
    const document = Buffer.from(
      readFileSync(resolve(corpusRoot, fixture), "utf8").trim(),
      "base64"
    );
    assert.equal(createHash("sha256").update(document).digest("hex"), sha256);
    assert.match(document.toString("utf8"), /testcenter-syscheck-xml\/18\.0/);
    assert.match(document.toString("utf8"), new RegExp(`<Id>${checkId}<\\/Id>`));
  }
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

  const aspectPackage = corpus.playerPackages[0];
  assert.ok(aspectPackage);
  const metadataUnits = aspectPackage.units.filter(
    unit => unit.metadataReferenceFixture
  );
  assert.deepEqual(
    metadataUnits.map(unit => [
      unit.unitKey,
      unit.sourcePaths.metadataReference
    ]),
    [
      [
        "testcenter-sample1",
        "sampledata/aspect/testcenter-sample1.vomd"
      ],
      [
        "testcenter-sample3",
        "sampledata/aspect/testcenter-sample3.vomd"
      ]
    ]
  );
  for (const unit of metadataUnits) {
    assert.equal(unit.metadataReferenceEncoding, "base64");
    assert.ok(unit.metadataReferenceFixture);
    assert.ok(unit.metadataReferenceSha256);
    const metadataDocument = Buffer.from(
      readFileSync(
        resolve(corpusRoot, unit.metadataReferenceFixture),
        "utf8"
      ).trim(),
      "base64"
    );
    assert.equal(
      createHash("sha256").update(metadataDocument).digest("hex"),
      unit.metadataReferenceSha256,
      unit.sourcePaths.metadataReference
    );
    assert.deepEqual(JSON.parse(metadataDocument.toString("utf8")), {
      profiles: [],
      items: []
    });
    assert.match(
      readFileSync(resolve(corpusRoot, unit.unitFixture), "utf8"),
      new RegExp(`<Reference>${unit.unitKey}\\.vomd<\\/Reference>`)
    );
  }
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
  assert.equal(corpus.veronaPlayerFamilyPackages.length, 12);
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
    const encodedDefinition = readFileSync(
      resolve(corpusRoot, player.definitionFixture),
      "utf8"
    );
    const definitionDocument =
      player.definitionEncoding === "base64"
        ? Buffer.from(encodedDefinition.trim(), "base64")
        : Buffer.from(encodedDefinition, "utf8");
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
    if (player.resourceFixture) {
      assert.equal(player.resourceEncoding, "base64");
      const resourceDocument = Buffer.from(
        readFileSync(resolve(corpusRoot, player.resourceFixture), "utf8").trim(),
        "base64"
      );
      assert.equal(
        createHash("sha256").update(resourceDocument).digest("hex"),
        player.resourceSha256,
        player.resourceFixture
      );
    }
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

  const currentAbi = playersByFamily.get(
    "ABI current-release scripted survey"
  );
  assert.ok(currentAbi);
  assert.equal(currentAbi.sourceTag, "5.0.0");
  assert.equal(
    currentAbi.sourceCommit,
    "05bcb7ffc4fc99245f74f3089465220ae6285bfe"
  );
  assert.equal(currentAbi.definitionSourceCommit, currentAbi.sourceCommit);
  assert.equal(currentAbi.playerModuleVersion, "5.0.0");
  assert.equal(currentAbi.playerApiVersion, "4");
  assert.equal(currentAbi.metadataApiVersion, "5.0");
  assert.equal(currentAbi.unitDefinitionType, "iqb-scripted@1.0");
  assert.equal(currentAbi.unitStateType, "iqb-standard@1.1");
  const currentAbiPlayerHtml = brotliDecompressSync(
    Buffer.from(
      readFileSync(
        resolve(corpusRoot, currentAbi.playerFixture),
        "utf8"
      ).trim(),
      "base64"
    )
  ).toString("utf8");
  const currentAbiDefinition = readFileSync(
    resolve(corpusRoot, currentAbi.definitionFixture),
    "utf8"
  );
  assert.match(currentAbiPlayerHtml, /"id"\s*:\s*"iqb-player-abi"/);
  assert.match(currentAbiPlayerHtml, /"version"\s*:\s*"5\.0\.0"/);
  assert.match(currentAbiPlayerHtml, /"specVersion"\s*:\s*"5\.0"/);
  assert.match(currentAbiPlayerHtml, /"metadataVersion"\s*:\s*"2\.0"/);
  assert.match(currentAbiPlayerHtml, /apiVersion:\s*["']4["']/);
  assert.match(currentAbiPlayerHtml, /iqb-standard@1\.1/);
  assert.match(
    currentAbiPlayerHtml,
    /dataParts\[[^\]]+\.id\]\s*=\s*JSON\.stringify\([^)]*\.variables\)/
  );
  assert.match(currentAbiDefinition, /^iqb-scripted::1\.0/m);
  assert.match(currentAbiDefinition, /input-text::text_var1/);
  assert.match(currentAbiDefinition, /multiple-choice::mc_var1/);
  assert.match(currentAbiDefinition, /repeat-start::examineecount/);

  const currentAspect = playersByFamily.get(
    "Aspect current-release assessment"
  );
  assert.ok(currentAspect);
  assert.equal(
    currentAspect.sourceTag,
    "editor/2.12.6+player/2.12.6"
  );
  assert.equal(
    currentAspect.sourceCommit,
    "b281f3353ee12b3d70d48cdca4a441d569f6763b"
  );
  assert.equal(
    currentAspect.definitionSourceCommit,
    "a5a6d25a72990d667300804c337cc5b500b01d2f"
  );
  assert.equal(currentAspect.playerModuleVersion, "2.12.6");
  assert.equal(currentAspect.playerByteSize, 3_605_455);
  assert.equal(currentAspect.playerApiVersion, "6.0");
  assert.equal(currentAspect.metadataApiVersion, "6.0");
  assert.equal(currentAspect.unitDefinitionType, "aspect-unit-definition");
  assert.equal(currentAspect.unitStateType, "iqb-standard@1.0");
  const currentAspectPlayerHtml = brotliDecompressSync(
    Buffer.from(
      readFileSync(
        resolve(corpusRoot, currentAspect.playerFixture),
        "utf8"
      ).trim(),
      "base64"
    )
  ).toString("utf8");
  const currentAspectDefinition = Buffer.from(
    readFileSync(
      resolve(corpusRoot, currentAspect.definitionFixture),
      "utf8"
    ).trim(),
    "base64"
  ).toString("utf8");
  assert.match(currentAspectPlayerHtml, /"id"\s*:\s*"iqb-player-aspect"/);
  assert.match(currentAspectPlayerHtml, /"version"\s*:\s*"2\.12\.6"/);
  assert.match(currentAspectPlayerHtml, /"specVersion"\s*:\s*"6\.0"/);
  assert.match(currentAspectPlayerHtml, /"metadataVersion"\s*:\s*"2\.0"/);
  assert.match(currentAspectPlayerHtml, /unitStateDataType:"iqb-standard@1\.0"/);
  assert.match(
    currentAspectPlayerHtml,
    /elementCodes:JSON\.stringify\(this\.unitStateService\.getResponses\(\)\)/
  );
  assert.match(currentAspectDefinition, /"type":"aspect-unit-definition"/);
  assert.match(currentAspectDefinition, /"type":"text-field"/);
  assert.match(currentAspectDefinition, /"type":"radio"/);

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
  const currentDan = playersByFamily.get(
    "DAN current-release visual assessment"
  );
  assert.ok(currentDan);
  assert.equal(currentDan.sourceTag, "3.1.0");
  assert.equal(
    currentDan.sourceCommit,
    "d2d2f4eb668f264d13b84d733cb152cc8a647445"
  );
  assert.equal(currentDan.definitionSourceCommit, dan.definitionSourceCommit);
  assert.equal(currentDan.playerModuleVersion, "3.1.0-beta");
  assert.equal(currentDan.playerApiVersion, "4");
  assert.equal(currentDan.metadataApiVersion, "5.0");
  assert.equal(currentDan.metadataFormat, "metadata-2.0");
  assert.equal(currentDan.unitDefinitionType, "IQBVisualUnitPlayerV2.1.0");
  assert.equal(currentDan.unitStateType, "IQBVisualUnitPlayerV2.1.0");
  assert.equal(currentDan.definitionFixture, dan.definitionFixture);
  const currentDanPlayerHtml = brotliDecompressSync(
    Buffer.from(
      readFileSync(
        resolve(corpusRoot, currentDan.playerFixture),
        "utf8"
      ).trim(),
      "base64"
    )
  ).toString("utf8");
  assert.match(currentDanPlayerHtml, /"id"\s*:\s*"iqb-player-dan"/);
  assert.match(currentDanPlayerHtml, /"version"\s*:\s*"3\.1\.0-beta"/);
  assert.match(currentDanPlayerHtml, /"specVersion"\s*:\s*"5\.0"/);
  assert.match(currentDanPlayerHtml, /"metadataVersion"\s*:\s*"2\.0"/);
  assert.match(currentDanPlayerHtml, /apiVersion:\s*["']4["']/);
  assert.match(
    currentDanPlayerHtml,
    /unitDataType\s*=\s*["']IQBVisualUnitPlayerV2\.1\.0["']/
  );
  assert.match(
    currentDanPlayerHtml,
    /allResponses\[["']all["']\]\s*=\s*JSON\.stringify\(unitStatus\)/
  );
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

  const stars = playersByFamily.get("STARS choice interaction");
  assert.ok(stars);
  assert.equal(stars.sourceTag, "0.6.19");
  assert.equal(stars.sourceCommit, "fdc2eb01016ec65bf1e5250eb44c0acfb54c690d");
  assert.equal(
    stars.playerSourceRepository,
    "https://github.com/iqb-berlin/verona-player-testbed"
  );
  assert.equal(
    stars.playerSourceCommit,
    "1343550c864701daf9ca4a1b064351b37a617d89"
  );
  assert.equal(stars.definitionSourceCommit, stars.sourceCommit);
  const starsPlayerHtml = brotliDecompressSync(
    Buffer.from(
      readFileSync(resolve(corpusRoot, stars.playerFixture), "utf8").trim(),
      "base64"
    )
  ).toString("utf8");
  const starsDefinition = JSON.parse(
    Buffer.from(
      readFileSync(resolve(corpusRoot, stars.definitionFixture), "utf8").trim(),
      "base64"
    ).toString("utf8")
  ) as {
    id: string;
    version: string;
    interactionType: string;
    interactionParameters: {
      variableId: string;
      multiSelect: boolean;
      options: { buttons: Array<{ text: string }> };
    };
  };
  assert.match(starsPlayerHtml, /"id"\s*:\s*"iqb-player-stars"/);
  assert.match(starsPlayerHtml, /"version"\s*:\s*"0\.6\.19"/);
  assert.match(starsPlayerHtml, /"specVersion"\s*:\s*"6\.0"/);
  assert.match(starsPlayerHtml, /"metadataVersion"\s*:\s*"2\.0"/);
  assert.equal(starsDefinition.id, "stars-unit-definition");
  assert.equal(starsDefinition.version, "0.17");
  assert.equal(starsDefinition.interactionType, "BUTTONS");
  assert.equal(starsDefinition.interactionParameters.variableId, "BUTTONS");
  assert.equal(starsDefinition.interactionParameters.multiSelect, false);
  assert.deepEqual(
    starsDefinition.interactionParameters.options.buttons.map(button => button.text),
    ["A", "B", "C", "D"]
  );

  const currentStars = playersByFamily.get(
    "STARS current-release choice interaction"
  );
  assert.ok(currentStars);
  assert.equal(currentStars.sourceTag, "0.7.2");
  assert.equal(
    currentStars.sourceCommit,
    "c156efd37536a8e2b182cc9ab470cdb8eaa222f8"
  );
  assert.equal(currentStars.definitionSourceCommit, currentStars.sourceCommit);
  const currentStarsPlayerHtml = brotliDecompressSync(
    Buffer.from(
      readFileSync(
        resolve(corpusRoot, currentStars.playerFixture),
        "utf8"
      ).trim(),
      "base64"
    )
  ).toString("utf8");
  const currentStarsDefinition = JSON.parse(
    Buffer.from(
      readFileSync(
        resolve(corpusRoot, currentStars.definitionFixture),
        "utf8"
      ).trim(),
      "base64"
    ).toString("utf8")
  ) as {
    id: string;
    version: string;
    interactionType: string;
    continueButtonShow: string;
    interactionParameters: {
      variableId: string;
      multiSelect: boolean;
      options: { buttons: Array<{ text: string }> };
    };
  };
  assert.match(currentStarsPlayerHtml, /"id"\s*:\s*"iqb-player-stars"/);
  assert.match(currentStarsPlayerHtml, /"version"\s*:\s*"0\.7\.2"/);
  assert.match(currentStarsPlayerHtml, /"specVersion"\s*:\s*"6\.0"/);
  assert.match(currentStarsPlayerHtml, /"metadataVersion"\s*:\s*"2\.0"/);
  assert.match(currentStarsPlayerHtml, /iqb-standard@2\.0/);
  assert.equal(currentStarsDefinition.id, "stars-unit-definition");
  assert.equal(currentStarsDefinition.version, "5.3");
  assert.equal(currentStarsDefinition.interactionType, "BUTTONS");
  assert.equal(currentStarsDefinition.continueButtonShow, "ON_ANY_RESPONSE");
  assert.equal(currentStarsDefinition.interactionParameters.variableId, "BUTTONS");
  assert.equal(currentStarsDefinition.interactionParameters.multiSelect, false);
  assert.deepEqual(
    currentStarsDefinition.interactionParameters.options.buttons.map(
      button => button.text
    ),
    ["A", "B", "C", "D"]
  );

  const eva = playersByFamily.get("EVA scripted survey");
  assert.ok(eva);
  assert.equal(eva.sourceTag, "v1.0.0");
  assert.equal(
    eva.sourceCommit,
    "a704af05e31eff3c45c603cbe664897ba5c372e4"
  );
  assert.equal(eva.metadataFormat, "legacy-html-meta");
  assert.equal(eva.definitionExtraction, "minimal executable survey derived from the pinned official iqb-scripted 1.0 element examples");
  const evaPlayerHtml = brotliDecompressSync(
    Buffer.from(
      readFileSync(resolve(corpusRoot, eva.playerFixture), "utf8").trim(),
      "base64"
    )
  ).toString("utf8");
  const evaDefinition = readFileSync(
    resolve(corpusRoot, eva.definitionFixture),
    "utf8"
  );
  assert.match(evaPlayerHtml, /content="verona-player-eva"/);
  assert.match(evaPlayerHtml, /data-version="1\.0\.0"/);
  assert.match(evaPlayerHtml, /data-api-version="2\.1\.0"/);
  assert.match(evaPlayerHtml, /apiVersion:this\.playerMetadata\.get\("version"\)/);
  assert.match(evaDefinition, /^iqb-scripted::1\.0/m);
  assert.match(evaDefinition, /input-text::comment::1::Kommentar/);
  assert.match(evaDefinition, /input-number::score::1::Bewertung::::0::10/);

  const speedtest = playersByFamily.get("Speedtest timed choice");
  assert.ok(speedtest);
  assert.equal(speedtest.sourceTag, "1.2.0");
  assert.equal(
    speedtest.sourceCommit,
    "fce0e23229ab1ca62630f1f6ec15a13fa878b95d"
  );
  assert.equal(
    speedtest.definitionExtraction,
    "unitDefinition literal from the official load-unit test"
  );
  assert.equal(speedtest.unitDefinitionType, undefined);
  const speedtestPlayerHtml = brotliDecompressSync(
    Buffer.from(
      readFileSync(resolve(corpusRoot, speedtest.playerFixture), "utf8").trim(),
      "base64"
    )
  ).toString("utf8");
  const speedtestDefinition = Buffer.from(
    readFileSync(resolve(corpusRoot, speedtest.definitionFixture), "utf8").trim(),
    "base64"
  ).toString("utf8");
  assert.match(speedtestPlayerHtml, /"id"\s*:\s*"verona-player-speedtest"/);
  assert.match(speedtestPlayerHtml, /"version"\s*:\s*"1\.2\.0"/);
  assert.match(speedtestPlayerHtml, /"specVersion"\s*:\s*"5\.0"/);
  assert.match(speedtestPlayerHtml, /"metadataVersion"\s*:\s*"2\.0"/);
  assert.match(speedtestPlayerHtml, /apiVersion:\s*"4"/);
  assert.match(speedtestPlayerHtml, /unitStateDataType:\s*'iqb-standard@1\.0'/);
  assert.equal(speedtestDefinition, "Dies ist ein Beispielsatz!");

  const currentSpeedtest = playersByFamily.get(
    "Speedtest current-release timed choice"
  );
  assert.ok(currentSpeedtest);
  assert.equal(currentSpeedtest.sourceTag, "3.3.0");
  assert.equal(
    currentSpeedtest.sourceCommit,
    "89d15006f3daa68bb5f26355b6f298cd12b8a993"
  );
  assert.equal(
    currentSpeedtest.definitionSourceCommit,
    currentSpeedtest.sourceCommit
  );
  assert.equal(
    currentSpeedtest.definitionExtraction,
    "minimal executable two-question definition derived from the pinned official UnitService defaults, package definition version, and CSV parser expectations"
  );
  assert.equal(
    currentSpeedtest.unitDefinitionType,
    "speedtest-unit-definition@1.0.0"
  );
  const currentSpeedtestPlayerHtml = brotliDecompressSync(
    Buffer.from(
      readFileSync(
        resolve(corpusRoot, currentSpeedtest.playerFixture),
        "utf8"
      ).trim(),
      "base64"
    )
  ).toString("utf8");
  const currentSpeedtestDefinition = JSON.parse(
    readFileSync(
      resolve(corpusRoot, currentSpeedtest.definitionFixture),
      "utf8"
    )
  ) as {
    type: string;
    version: string;
    layout: string;
    questionType: string;
    answerType: string;
    questions: Array<{
      text: string;
      answers: Array<{ text: string }>;
      correctAnswer: number;
    }>;
  };
  assert.match(
    currentSpeedtestPlayerHtml,
    /"id"\s*:\s*"iqb-player-speedtest"/
  );
  assert.match(currentSpeedtestPlayerHtml, /"version"\s*:\s*"3\.3\.0"/);
  assert.match(currentSpeedtestPlayerHtml, /"specVersion"\s*:\s*"5\.2"/);
  assert.match(
    currentSpeedtestPlayerHtml,
    /"metadataVersion"\s*:\s*"2\.0"/
  );
  assert.match(currentSpeedtestPlayerHtml, /iqb-standard@1\.0/);
  assert.equal(currentSpeedtestDefinition.type, "speedtest-unit-defintion");
  assert.equal(currentSpeedtestDefinition.version, "2.1.0");
  assert.equal(currentSpeedtestDefinition.layout, "column");
  assert.equal(currentSpeedtestDefinition.questionType, "text");
  assert.equal(currentSpeedtestDefinition.answerType, "text");
  assert.deepEqual(
    currentSpeedtestDefinition.questions.map(question => ({
      text: question.text,
      answers: question.answers.map(answer => answer.text),
      correctAnswer: question.correctAnswer
    })),
    [
      {
        text: "Frage 1",
        answers: ["richtig", "falsch"],
        correctAnswer: 1
      },
      {
        text: "Frage 2",
        answers: ["antwort 1", "antwort2"],
        correctAnswer: 2
      }
    ]
  );

  const lottie = playersByFamily.get("Lottie shared-parameter interaction");
  assert.ok(lottie);
  assert.equal(lottie.sourceTag, "1.2.2");
  assert.equal(
    lottie.sourceCommit,
    "764be685e15f66893ab986428cf62699c26f121e"
  );
  assert.equal(lottie.definitionSourceCommit, lottie.sourceCommit);
  assert.equal(lottie.requiredResourceId, "avatar.itcr.zip");
  assert.deepEqual(lottie.metadataCompatibilityWarnings, [
    "retains the legacy '$schema' instance property",
    "uses the legacy lowercase 'player' module type",
    "retains the legacy 'notSupportedFeatures' property",
    "uses a singleton dependency object instead of an array"
  ]);
  const lottiePlayerHtml = brotliDecompressSync(
    Buffer.from(
      readFileSync(resolve(corpusRoot, lottie.playerFixture), "utf8").trim(),
      "base64"
    )
  ).toString("utf8");
  const lottieDefinition = JSON.parse(
    readFileSync(resolve(corpusRoot, lottie.definitionFixture), "utf8")
  ) as {
    scenes: Array<{
      interactionType: string;
      interactionParameters: {
        sharedId: string;
        options: Array<{ value: string }>;
      };
    }>;
  };
  assert.match(lottiePlayerHtml, /"id"\s*:\s*"iqb-player-lottie"/);
  assert.match(lottiePlayerHtml, /"version"\s*:\s*"1\.2\.2"/);
  assert.match(lottiePlayerHtml, /"specVersion"\s*:\s*"6\.0"/);
  assert.match(lottiePlayerHtml, /"metadataVersion"\s*:\s*"3\.1"/);
  assert.match(lottiePlayerHtml, /"dependencies"\s*:\s*\{/);
  assert.match(lottiePlayerHtml, /vopStateChangedNotification/);
  assert.match(lottiePlayerHtml, /sharedParameters/);
  assert.equal(lottieDefinition.scenes[0]?.interactionType, "BUTTONS");
  assert.equal(
    lottieDefinition.scenes[0]?.interactionParameters.sharedId,
    "avatar"
  );
  assert.deepEqual(
    lottieDefinition.scenes[0]?.interactionParameters.options.map(
      option => option.value
    ),
    ["blue", "green"]
  );

  const ib = playersByFamily.get("IB ItemBuilder migration study");
  assert.ok(ib);
  assert.equal(ib.sourceTag, "unreleased-master-snapshot");
  assert.equal(
    ib.sourceCommit,
    "285e155db7637edfca75191c00c722afe736f510"
  );
  assert.equal(ib.definitionSourceCommit, ib.sourceCommit);
  assert.equal(ib.playerModuleVersion, "0.2.0");
  assert.equal(ib.playerApiVersion, "6.0");
  assert.equal(ib.metadataApiVersion, "6.0");
  assert.equal(ib.unitDefinitionType, undefined);
  assert.equal(ib.unitStateType, "iqb-standard@1.4");
  assert.equal(ib.requiredResourceId, "IB_SAMPLE_2025.itcr.zip");
  assert.equal(
    ib.runtimeSourceCommit,
    "3b6cd474a76f82087e632ad8de14f6818ad754ca"
  );
  assert.equal(ib.runtimeVersion, "9.9.0");
  assert.equal(
    ib.resourceBuild,
    "deterministic ZIP of the package-builder output with normalized file timestamps and package id IB_SAMPLE_2025"
  );
  assert.deepEqual(ib.metadataCompatibilityWarnings, [
    "the official repository labels this snapshot as a feasibility study rather than a production release",
    "the upstream package builder references a 0.2.0 filename while publishing the player as 0.2",
    "the pinned legacy runtime requires a hash-pinned immediate-parent origin adapter inside the sandbox; interactive state capture is covered, but the feasibility Player does not restore supplied Unit state"
  ]);
  const ibPlayerHtml = brotliDecompressSync(
    Buffer.from(
      readFileSync(resolve(corpusRoot, ib.playerFixture), "utf8").trim(),
      "base64"
    )
  ).toString("utf8");
  const ibDefinition = JSON.parse(
    readFileSync(resolve(corpusRoot, ib.definitionFixture), "utf8")
  ) as {
    runtimeVersion: string;
    item: string;
    task: string;
    scope: string;
    package: string;
    folder: string;
  };
  assert.match(ibPlayerHtml, /"id"\s*:\s*"verona-player-ib"/);
  assert.match(ibPlayerHtml, /"version"\s*:\s*"0\.2\.0"/);
  assert.match(ibPlayerHtml, /"specVersion"\s*:\s*"6\.0"/);
  assert.match(ibPlayerHtml, /"metadataVersion"\s*:\s*"2\.0"/);
  assert.match(ibPlayerHtml, /unitStateDataType\s*=\s*'iqb-standard@1\.4'/);
  assert.match(ibPlayerHtml, /playerConfig\.directDownloadUrl/);
  assert.match(ibPlayerHtml, /getTasksStateReturn/);
  assert.deepEqual(ibDefinition, {
    task: "FirstTask",
    page: "FirstPage",
    scope: "A",
    runtimeVersion: "9.9.0",
    item: "Simple",
    package: "IB_SAMPLE_2025",
    folder: "Simple"
  });
});

test("original Testcenter compatibility corpus pins the current adaptive system-test graph", () => {
  const corpus = JSON.parse(
    readFileSync(resolve(corpusRoot, "corpus.json"), "utf8")
  ) as OriginalTestcenterCorpus;
  const adaptive = corpus.currentOriginalAdaptivePackage;
  assert.equal(
    adaptive.sourceCommit,
    "a5a6d25a72990d667300804c337cc5b500b01d2f"
  );
  assert.equal(adaptive.sourceDirectory, "sampledata/system-test/adaptive");

  const bookletDocument = readFileSync(
    resolve(corpusRoot, adaptive.booklet.fixture)
  );
  const unitDocument = readFileSync(resolve(corpusRoot, adaptive.unit.fixture));
  const codingSchemeDocument = Buffer.from(
    readFileSync(resolve(corpusRoot, adaptive.codingScheme.fixture), "utf8").trim(),
    "base64"
  );
  const playerDocument = brotliDecompressSync(
    Buffer.from(
      readFileSync(resolve(corpusRoot, adaptive.player.fixture), "utf8").trim(),
      "base64"
    )
  );
  const rosterDocument = readFileSync(resolve(corpusRoot, adaptive.roster.fixture));
  for (const [document, fixture] of [
    [bookletDocument, adaptive.booklet],
    [unitDocument, adaptive.unit],
    [codingSchemeDocument, adaptive.codingScheme],
    [playerDocument, adaptive.player],
    [rosterDocument, adaptive.roster]
  ] as const) {
    assert.equal(
      createHash("sha256").update(document).digest("hex"),
      fixture.sha256,
      fixture.sourcePath
    );
  }
  assert.ok(adaptive.booklet.sourcePath.startsWith(`${adaptive.sourceDirectory}/`));
  assert.ok(adaptive.roster.sourcePath.startsWith(`${adaptive.sourceDirectory}/`));

  const bookletXml = bookletDocument.toString("utf8");
  assert.match(bookletXml, /testcenter-booklet-xml\/18\.0/);
  assert.match(bookletXml, /<Id>CY-Bklt_Adap-1<\/Id>/);
  assert.match(bookletXml, /<Config key="toolbar_show_unit_list">TRUE<\/Config>/);
  assert.deepEqual(adaptive.booklet.defaultStates, {
    level: "beginner",
    bonus: "no"
  });
  assert.deepEqual(adaptive.booklet.professionalStates, {
    level: "professional",
    bonus: "no"
  });
  assert.deepEqual(adaptive.booklet.professionalVisibleUnitKeys, [
    "decision-unit",
    "professional-unit"
  ]);
  assert.deepEqual(adaptive.booklet.advancedStates, {
    level: "advanced",
    bonus: "no"
  });
  assert.deepEqual(adaptive.booklet.advancedVisibleUnitKeys, [
    "decision-unit",
    "advanced-unit"
  ]);
  assert.deepEqual(adaptive.booklet.bonusReviewStates, {
    level: "beginner",
    bonus: "yes"
  });
  assert.deepEqual(adaptive.booklet.bonusReviewVisibleUnitKeys, [
    "decision-unit",
    "beginner-unit",
    "bonus-unit"
  ]);
  assert.deepEqual(
    Array.from(bookletXml.matchAll(/<Unit\b[^>]*\balias="([^"]+)"/g), match => match[1]),
    adaptive.booklet.unitKeys
  );

  const unitXml = unitDocument.toString("utf8");
  assert.match(unitXml, /<Id>UNIT\.SAMPLE-2<\/Id>/);
  assert.match(unitXml, /player="verona-player-simple@6\.0"/);
  assert.match(unitXml, /schemeType="iqb@3\.0"/);
  const codingScheme = JSON.parse(codingSchemeDocument.toString("utf8")) as {
    version: string;
    variableCodings: unknown[];
  };
  assert.equal(codingScheme.version, adaptive.codingScheme.version);
  assert.equal(codingScheme.variableCodings.length, 7);

  const playerHtml = playerDocument.toString("utf8");
  assert.match(playerHtml, /"id"\s*:\s*"verona-player-simple"/);
  assert.match(playerHtml, /"version"\s*:\s*"6\.0\.5"/);
  assert.match(playerHtml, /"specVersion"\s*:\s*"6\.0"/);

  const roster = parseParticipantRosterText(rosterDocument.toString("utf8"));
  assert.deepEqual(
    roster.map(entry => [entry.loginKey, entry.executionMode]),
    adaptive.roster.participants
  );
  assert.ok(roster.every(entry => entry.groupKey === adaptive.roster.groupKey));
  assert.ok(roster.every(entry => entry.password === "123"));
  for (const entry of roster) {
    assert.deepEqual(
      entry.bookletAssignments?.map(assignment => assignment.assignmentKey),
      adaptive.roster.assignments[entry.loginKey]
    );
  }
  assert.deepEqual(roster[1]?.bookletAssignments?.map(assignment => assignment.statePreset), [
    { bonus: "yes" },
    { bonus: "no" }
  ]);
});

test("original Testcenter compatibility corpus pins the current Aspect sample graph", () => {
  const corpus = JSON.parse(
    readFileSync(resolve(corpusRoot, "corpus.json"), "utf8")
  ) as OriginalTestcenterCorpus;
  const aspect = corpus.currentOriginalAspectPackage;
  assert.equal(
    aspect.sourceCommit,
    "a5a6d25a72990d667300804c337cc5b500b01d2f"
  );
  assert.equal(aspect.sourceDirectory, "sampledata/aspect");

  const readEncodedFixture = (
    fixture: string,
    encoding: "utf8" | "base64" | "brotli-base64"
  ): Buffer => {
    const document = readFileSync(resolve(corpusRoot, fixture));
    if (encoding === "utf8") return document;
    const decoded = Buffer.from(document.toString("utf8").trim(), "base64");
    return encoding === "brotli-base64"
      ? brotliDecompressSync(decoded)
      : decoded;
  };
  for (const booklet of aspect.booklets) {
    const document = readEncodedFixture(booklet.fixture, booklet.encoding);
    assert.equal(
      createHash("sha256").update(document).digest("hex"),
      booklet.sha256,
      booklet.sourcePath
    );
    const xml = document.toString("utf8");
    assert.match(xml, new RegExp(`<Id>${booklet.bookletKey}</Id>`));
    assert.deepEqual(
      Array.from(xml.matchAll(/<Unit\b[^>]*\bid="([^"]+)"/g), match => match[1]),
      booklet.unitKeys
    );
  }
  const firstBooklet = readEncodedFixture(
    aspect.booklets[0]!.fixture,
    aspect.booklets[0]!.encoding
  ).toString("utf8");
  assert.match(firstBooklet, /testcenter-booklet-xml\/18\.0/);
  assert.match(firstBooklet, /<CodeToEnter code="sample">/);
  assert.match(firstBooklet, /<TimeMax minutes="1"\s*\/>/);

  for (const unit of aspect.units) {
    const unitDocument = readEncodedFixture(unit.fixture, unit.encoding);
    assert.equal(
      createHash("sha256").update(unitDocument).digest("hex"),
      unit.sha256,
      unit.sourcePath
    );
    assert.match(unitDocument.toString("utf8"), new RegExp(`<Id>${unit.unitKey}</Id>`));
    const definitionDocument = readEncodedFixture(
      unit.definitionFixture,
      unit.definitionEncoding
    );
    assert.equal(
      createHash("sha256").update(definitionDocument).digest("hex"),
      unit.definitionSha256,
      unit.definitionSourcePath
    );
  }
  const playerDocument = readEncodedFixture(
    aspect.player.fixture,
    aspect.player.encoding
  );
  assert.equal(
    createHash("sha256").update(playerDocument).digest("hex"),
    aspect.player.sha256,
    aspect.player.sourcePath
  );

  const rosterDocument = readEncodedFixture(
    aspect.roster.fixture,
    aspect.roster.encoding
  );
  assert.equal(
    createHash("sha256").update(rosterDocument).digest("hex"),
    aspect.roster.sha256,
    aspect.roster.sourcePath
  );
  const rosterXml = rosterDocument.toString("utf8");
  const participants = parseParticipantRosterText(rosterXml);
  assert.deepEqual(
    participants.map(entry => entry.loginKey),
    aspect.roster.participantLoginKeys
  );
  for (const entry of participants) {
    assert.equal(entry.groupKey, aspect.roster.groupKey);
    assert.deepEqual(
      entry.bookletAssignments?.map(assignment => assignment.bookletKey),
      aspect.roster.assignments[entry.loginKey]
    );
    const expectedCodes = aspect.roster.accessCodes[entry.loginKey];
    if (expectedCodes) {
      assert.ok(
        entry.bookletAssignments?.every(assignment =>
          expectedCodes.every(code => assignment.accessCodes?.includes(code))
        )
      );
    }
  }
  assert.deepEqual(participants.find(entry => entry.loginKey === "testuser2")?.viewSettings, {
    theme: "Sekundar",
    codeInput: { type: "keypad-symbols-alt", length: 3 }
  });
  assert.deepEqual(participants.find(entry => entry.loginKey === "testuser3")?.viewSettings, {
    theme: "Sekundar",
    codeInput: { type: "keypad-symbols", length: 5 }
  });
  assert.deepEqual(
    parseOriginalTestcenterOperationalLogins(rosterXml).map(entry => entry.loginKey),
    aspect.roster.operationalLoginKeys
  );
});

test("original Testcenter compatibility corpus pins the current STARS system-test graph", () => {
  const corpus = JSON.parse(
    readFileSync(resolve(corpusRoot, "corpus.json"), "utf8")
  ) as OriginalTestcenterCorpus;
  const stars = corpus.currentOriginalStarsPackage;
  assert.equal(
    stars.sourceCommit,
    "94b04751abfe024eb1d354c29718f90b4740c4c6"
  );

  const playerDocument = brotliDecompressSync(
    Buffer.from(
      readFileSync(resolve(corpusRoot, stars.player.fixture), "utf8").trim(),
      "base64"
    )
  );
  const definitionDocument = Buffer.from(
    readFileSync(resolve(corpusRoot, stars.definition.fixture), "utf8").trim(),
    "base64"
  );
  const metadataDocument = Buffer.from(
    readFileSync(resolve(corpusRoot, stars.metadata.fixture), "utf8").trim(),
    "base64"
  );
  const unitDocument = readFileSync(resolve(corpusRoot, stars.unit.fixture));
  const bookletDocument = readFileSync(resolve(corpusRoot, stars.booklet.fixture));
  const rosterDocument = readFileSync(resolve(corpusRoot, stars.roster.fixture));
  for (const [document, fixture] of [
    [playerDocument, stars.player],
    [definitionDocument, stars.definition],
    [metadataDocument, stars.metadata],
    [unitDocument, stars.unit],
    [bookletDocument, stars.booklet],
    [rosterDocument, stars.roster]
  ] as const) {
    assert.equal(
      createHash("sha256").update(document).digest("hex"),
      fixture.sha256,
      fixture.sourcePath
    );
    assert.ok(fixture.sourcePath.startsWith(`${stars.sourceDirectory}/`));
  }

  const playerHtml = playerDocument.toString("utf8");
  assert.match(playerHtml, /"id"\s*:\s*"iqb-player-stars"/);
  assert.match(playerHtml, /"version"\s*:\s*"0\.6\.40"/);
  assert.match(playerHtml, /"specVersion"\s*:\s*"6\.0"/);
  assert.match(playerHtml, /"metadataVersion"\s*:\s*"2\.0"/);
  assert.equal(stars.player.unitStateType, "iqb-standard@2.0");

  const definition = JSON.parse(definitionDocument.toString("utf8")) as {
    id: string;
    version: string;
    continueButtonShow: string;
    interactionType: string;
    interactionParameters: {
      variableId: string;
      multiSelect: boolean;
      options: { buttons: Array<{ text: string }> };
    };
  };
  assert.equal(definition.id, "stars-unit-definition");
  assert.equal(definition.version, "0.7");
  assert.equal(definition.continueButtonShow, "ON_ANY_RESPONSE");
  assert.equal(definition.interactionType, "BUTTONS");
  assert.equal(definition.interactionParameters.variableId, "interact");
  assert.equal(definition.interactionParameters.multiSelect, false);
  assert.deepEqual(
    definition.interactionParameters.options.buttons.map(button => button.text),
    ["M", "A", "F", "I"]
  );
  assert.deepEqual(JSON.parse(metadataDocument.toString("utf8")), {
    profiles: [],
    items: []
  });

  const unitXml = unitDocument.toString("utf8");
  assert.match(unitXml, /<Id>CY-StarsUnit-001<\/Id>/);
  assert.match(unitXml, /<Reference>CY-StarsUnit-001\.vomd<\/Reference>/);
  assert.match(
    unitXml,
    /<DefinitionRef player="iqb-player-stars@0\.6"[^>]*>CY-StarsUnit-001\.voud<\/DefinitionRef>/
  );

  const bookletXml = bookletDocument.toString("utf8");
  assert.match(bookletXml, /<Id>Cy-Bklt_Stars-1<\/Id>/);
  const unitReferences = Array.from(
    bookletXml.matchAll(/<Unit\b[^>]*\bid="([^"]+)"[^>]*\balias="([^"]+)"[^>]*\/>/g)
  );
  assert.equal(unitReferences.length, stars.booklet.unitCount);
  assert.deepEqual(
    unitReferences.map(reference => reference[1]),
    Array(stars.booklet.unitCount).fill(stars.booklet.unitKey)
  );
  assert.deepEqual(
    unitReferences.map(reference => reference[2]),
    stars.booklet.aliases
  );

  const participants = parseParticipantRosterText(rosterDocument.toString("utf8"));
  assert.deepEqual(
    participants.map(participant => [
      participant.loginKey,
      participant.executionMode
    ]),
    stars.roster.participantLogins
  );
  assert.ok(
    participants.every(
      participant =>
        participant.groupKey === stars.roster.groupKey &&
        participant.bookletKey === stars.booklet.bookletKey &&
        participant.password === "123"
    )
  );
  for (const participant of participants) {
    assert.deepEqual(participant.viewSettings, {
      theme: "Primar",
      codeInput: { type: "keypad-symbols-alt", length: 3 }
    });
  }
});

test("original Testcenter compatibility corpus pins the current Speedtest system-test graph", () => {
  const corpus = JSON.parse(
    readFileSync(resolve(corpusRoot, "corpus.json"), "utf8")
  ) as OriginalTestcenterCorpus;
  const speed = corpus.currentOriginalSpeedPackage;
  assert.equal(
    speed.sourceCommit,
    "6455e265421777124f379090257365b70b21641f"
  );

  const readPinnedFixture = (
    fixture: Pick<PinnedOriginalFixture, "fixture" | "encoding">
  ): Buffer => {
    const document = readFileSync(resolve(corpusRoot, fixture.fixture));
    if (fixture.encoding === "base64") {
      return Buffer.from(document.toString("utf8").trim(), "base64");
    }
    if (fixture.encoding === "brotli-base64") {
      return brotliDecompressSync(
        Buffer.from(document.toString("utf8").trim(), "base64")
      );
    }
    return document;
  };
  const playerDocument = readPinnedFixture(speed.player);
  const unitDocuments = speed.units.map(unit => readPinnedFixture(unit));
  const definitionDocuments = speed.units.map(unit =>
    readPinnedFixture({
      fixture: unit.definitionFixture,
      encoding: unit.definitionEncoding
    })
  );
  const bookletDocument = readPinnedFixture(speed.booklet);
  const rosterDocument = readPinnedFixture(speed.roster);
  for (const [document, fixture] of [
    [playerDocument, speed.player],
    ...unitDocuments.map((document, index) => [document, speed.units[index]] as const),
    [bookletDocument, speed.booklet],
    [rosterDocument, speed.roster]
  ] as const) {
    assert.equal(
      createHash("sha256").update(document).digest("hex"),
      fixture.sha256,
      fixture.sourcePath
    );
    assert.ok(fixture.sourcePath.startsWith(`${speed.sourceDirectory}/`));
  }
  for (const [definitionDocument, unit] of definitionDocuments.map(
    (document, index) => [document, speed.units[index]] as const
  )) {
    assert.equal(
      createHash("sha256").update(definitionDocument).digest("hex"),
      unit.definitionSha256,
      unit.definitionSourcePath
    );
    assert.ok(unit.definitionSourcePath.startsWith(`${speed.sourceDirectory}/`));
  }

  const playerHtml = playerDocument.toString("utf8");
  assert.match(playerHtml, /"id"\s*:\s*"iqb-player-speedtest"/);
  assert.match(playerHtml, /"version"\s*:\s*"9\.9\.99-cypress"/);
  assert.match(playerHtml, /"specVersion"\s*:\s*"5\.2"/);
  assert.match(playerHtml, /"metadataVersion"\s*:\s*"2\.0"/);
  assert.match(playerHtml, /iqb-standard@1\.0/);

  for (const [unitDocument, unit] of unitDocuments.map(
    (document, index) => [document, speed.units[index]] as const
  )) {
    const unitXml = unitDocument.toString("utf8");
    assert.match(unitXml, new RegExp(`<Id>${unit.unitKey}<\\/Id>`));
    assert.match(
      unitXml,
      /<DefinitionRef player="iqb-player-speedtest@9\.9"[^>]*>CY-SpeedUnit-00[12]\.voud<\/DefinitionRef>/
    );
  }
  const imageDefinition = JSON.parse(definitionDocuments[0].toString("utf8")) as {
    type: string;
    version: string;
    questionType: string;
    answerType: string;
    questions: Array<{ text: string; src?: string; correctAnswer: number }>;
  };
  assert.equal(imageDefinition.type, "speedtest-unit-defintion");
  assert.equal(imageDefinition.version, "2.1.0");
  assert.equal(imageDefinition.questionType, "image");
  assert.equal(imageDefinition.answerType, "number");
  assert.deepEqual(
    imageDefinition.questions.map(question => question.text),
    ["Frage 1", "Frage 2", "Frage 3", "Frage 4", "Frage 5", "Frage 6", "Frage 7"]
  );
  assert.ok(
    imageDefinition.questions.every(question => question.src?.startsWith("data:image/png;base64,"))
  );
  const instructionDefinition = JSON.parse(
    definitionDocuments[1].toString("utf8")
  ) as {
    questionType: string;
    answerType: string;
    questions: Array<{ text: string; answers: Array<{ text: string }> }>;
  };
  assert.equal(instructionDefinition.questionType, "text");
  assert.equal(instructionDefinition.answerType, "text");
  assert.equal(instructionDefinition.questions[0]?.text, "Instruktionen");
  assert.deepEqual(
    instructionDefinition.questions[0]?.answers.map(answer => answer.text),
    ["Verstanden", "Nicht verstanden"]
  );

  const bookletXml = bookletDocument.toString("utf8");
  assert.match(bookletXml, /<Id>Cy-Bklt_Speed-1<\/Id>/);
  assert.deepEqual(
    Array.from(bookletXml.matchAll(/<Testlet id="([^"]+)"/g), match => match[1]),
    speed.booklet.testletIds
  );
  assert.equal(
    Array.from(bookletXml.matchAll(/<TimeMax minutes="10"/g)).length,
    speed.booklet.testletIds.length
  );
  const unitReferences = Array.from(
    bookletXml.matchAll(/<Unit id="([^"]+)" label="([^"]+)" labelshort="([^"]+)"(?: alias="([^"]+)")? \/>/g)
  );
  assert.equal(unitReferences.length, speed.booklet.unitKeys.length);
  assert.deepEqual(unitReferences.map(reference => reference[1]), speed.booklet.originalUnitIds);
  assert.deepEqual(
    unitReferences.map(reference => reference[4] || reference[1]),
    speed.booklet.unitKeys
  );

  const participants = parseParticipantRosterText(rosterDocument.toString("utf8"));
  assert.deepEqual(
    participants.map(participant => [participant.loginKey, participant.executionMode]),
    speed.roster.participantLogins
  );
  assert.deepEqual(
    participants.map(participant => ({
      groupKey: participant.groupKey,
      bookletKey: participant.bookletKey,
      password: participant.password
    })),
    [{
      groupKey: speed.roster.groupKey,
      bookletKey: speed.booklet.bookletKey,
      password: "123"
    }]
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

test("original Testcenter compatibility corpus executes current IQB response coding", () => {
  type CodingCorpus = {
    format: string;
    version: number;
    sourceRepository: string;
    sourceTag: string;
    sourceCommit: string;
    license: string;
    caseCount: number;
    fileCount: number;
    archiveEncoding: string;
    archiveSha256: string;
    files: Array<{ path: string; sizeBytes: number; sha256: string }>;
    archiveBase64: string;
  };
  const corpus = JSON.parse(
    readFileSync(
      resolve(corpusRoot, "responses-5.2.2-corpus.json"),
      "utf8"
    )
  ) as CodingCorpus;
  assert.deepEqual(
    {
      format: corpus.format,
      version: corpus.version,
      sourceRepository: corpus.sourceRepository,
      sourceTag: corpus.sourceTag,
      sourceCommit: corpus.sourceCommit,
      license: corpus.license,
      caseCount: corpus.caseCount,
      fileCount: corpus.fileCount,
      archiveEncoding: corpus.archiveEncoding
    },
    {
      format: "iqb-responses-coding-corpus",
      version: 1,
      sourceRepository: "https://github.com/iqb-berlin/responses",
      sourceTag: "5.2.2",
      sourceCommit: "11057f5213ea9a2def998da33d9a2692b63db2e5",
      license: "CC0-1.0",
      caseCount: 75,
      fileCount: 188,
      archiveEncoding: "brotli-base64"
    }
  );
  const archive = brotliDecompressSync(
    Buffer.from(corpus.archiveBase64, "base64")
  );
  assert.equal(
    createHash("sha256").update(archive).digest("hex"),
    corpus.archiveSha256
  );
  const decoded = JSON.parse(archive.toString("utf8")) as {
    files: Array<{ path: string; contentBase64: string }>;
  };
  assert.equal(decoded.files.length, corpus.fileCount);
  const documents = new Map(
    decoded.files.map(file => [
      file.path,
      Buffer.from(file.contentBase64, "base64")
    ])
  );
  assert.deepEqual(
    [...documents.keys()].sort(),
    corpus.files.map(file => file.path).sort()
  );
  for (const file of corpus.files) {
    const content = documents.get(file.path);
    assert.ok(content, file.path);
    assert.equal(content.length, file.sizeBytes, file.path);
    assert.equal(
      createHash("sha256").update(content).digest("hex"),
      file.sha256,
      file.path
    );
  }
  const inputPaths = [...documents.keys()]
    .filter(path => path.endsWith("_input.json"))
    .sort();
  assert.equal(inputPaths.length, corpus.caseCount);
  for (const inputPath of inputPaths) {
    const directory = inputPath.slice(0, inputPath.lastIndexOf("/"));
    const schemeDocument = documents.get(`${directory}/coding-scheme.json`);
    const inputDocument = documents.get(inputPath);
    const outcomeDocument = documents.get(
      inputPath.replace(/_input\.json$/, "_outcome.json")
    );
    assert.ok(schemeDocument, inputPath);
    assert.ok(inputDocument, inputPath);
    assert.ok(outcomeDocument, inputPath);
    const variableCodings = new CodingScheme(
      JSON.parse(schemeDocument.toString("utf8"))
    ).variableCodings;
    const actual = JSON.parse(
      JSON.stringify(
        CodingSchemeFactory.code(
          JSON.parse(inputDocument.toString("utf8")) as IqbResponse[],
          variableCodings
        )
      )
    );
    assert.deepEqual(
      actual,
      JSON.parse(outcomeDocument.toString("utf8")),
      inputPath
    );
  }
  for (const currentOnlyCase of [
    "test/coding/circular-dependency/01_input.json",
    "test/coding/derive/UNIQUE_VALUES_INTENDED_INCOMPLETE/01_input.json",
    "test/coding/rules/matching/05_input.json",
    "test/coding/take-empty-as-valid/01_input.json",
    "test/coding/unknown-response-id/01_input.json"
  ]) {
    assert.ok(documents.has(currentOnlyCase), currentOnlyCase);
  }
});

test("original Testcenter compatibility corpus pins current passwordless group monitoring semantics", () => {
  const corpus = JSON.parse(
    readFileSync(resolve(corpusRoot, "corpus.json"), "utf8")
  ) as OriginalTestcenterCorpus;
  const groupMonitoring = corpus.currentOriginalGroupMonitoringPackage;
  assert.equal(
    groupMonitoring.sourceCommit,
    "a5a6d25a72990d667300804c337cc5b500b01d2f"
  );
  assert.equal(groupMonitoring.sourceDirectory, "sampledata/system-test/groupmon");

  const bookletDocument = Buffer.from(
    readFileSync(resolve(corpusRoot, groupMonitoring.booklet.fixture), "utf8").trim(),
    groupMonitoring.booklet.encoding
  );
  assert.equal(
    createHash("sha256").update(bookletDocument).digest("hex"),
    groupMonitoring.booklet.sha256,
    groupMonitoring.booklet.sourcePath
  );
  assert.match(bookletDocument.toString("utf8"), /testcenter-booklet-xml\/18\.0/);
  assert.match(bookletDocument.toString("utf8"), /<Id>Cy-Bklt_GM-1<\/Id>/);

  for (const unit of groupMonitoring.units) {
    const unitDocument = Buffer.from(
      readFileSync(resolve(corpusRoot, unit.fixture), "utf8").trim(),
      unit.encoding
    );
    assert.equal(
      createHash("sha256").update(unitDocument).digest("hex"),
      unit.sha256,
      unit.sourcePath
    );
    assert.match(unitDocument.toString("utf8"), /unit-xml\/17\.4/);
    assert.match(
      unitDocument.toString("utf8"),
      new RegExp(`<Id>${unit.unitKey.replaceAll(".", "\\.")}<\\/Id>`)
    );
  }

  const playerDocument = brotliDecompressSync(
    Buffer.from(
      readFileSync(resolve(corpusRoot, groupMonitoring.player.fixture), "utf8").trim(),
      "base64"
    )
  );
  assert.equal(
    createHash("sha256").update(playerDocument).digest("hex"),
    groupMonitoring.player.sha256,
    groupMonitoring.player.sourcePath
  );
  assert.match(playerDocument.toString("utf8"), /"version"\s*:\s*"6\.0\.5"/);

  const rosterDocument = Buffer.from(
    readFileSync(resolve(corpusRoot, groupMonitoring.roster.fixture), "utf8").trim(),
    groupMonitoring.roster.encoding
  );
  assert.equal(
    createHash("sha256").update(rosterDocument).digest("hex"),
    groupMonitoring.roster.sha256,
    groupMonitoring.roster.sourcePath
  );
  assert.match(rosterDocument.toString("utf8"), /testcenter-testtaker-xml\/18\.0/);
  const participants = parseParticipantRosterText(rosterDocument.toString("utf8"));
  assert.deepEqual(
    participants.map(participant => participant.loginKey),
    groupMonitoring.roster.participantLoginKeys
  );
  assert.equal(participants[0]?.password, "123");
  assert.equal(participants[0]?.bookletKey, groupMonitoring.booklet.bookletKey);

  const operationalLogins = parseOriginalTestcenterOperationalLogins(
    rosterDocument.toString("utf8")
  );
  assert.deepEqual(
    operationalLogins.map(login => login.loginKey),
    groupMonitoring.roster.operationalLoginKeys
  );
  assert.equal(
    operationalLogins[0]?.passwordRequired,
    groupMonitoring.roster.monitorPasswordRequired
  );
  assert.deepEqual(operationalLogins[0]?.profileIds, ["all", "small"]);
  assert.deepEqual(
    operationalLogins[0]?.monitorProfiles.map(profile => profile.profileId),
    ["all", "small"]
  );
  assert.deepEqual(operationalLogins[0]?.unresolvedProfileIds, []);
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
    groupLabel: "Filter-Profiles",
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
    monitorBookletVisibility: "visible",
    customTexts: {},
    unresolvedProfileIds: []
  });
});

test("original Testcenter compatibility corpus pins the current 18.0 Test Controller package", () => {
  const corpus = JSON.parse(
    readFileSync(resolve(corpusRoot, "corpus.json"), "utf8")
  ) as OriginalTestcenterCorpus;
  const current = corpus.currentOriginalTestControllerPackage;
  assert.equal(
    current.sourceCommit,
    "65d28718eb6474cf5158206494096d32cd3393f9"
  );
  assert.equal(current.sourceDirectory, "sampledata/system-test/test-controller");
  assert.deepEqual(
    current.booklets.map(([, bookletKey]) => bookletKey),
    [
      "1a", "1b", "1c", "1d", "1e", "1f",
      "2a", "2b", "2c", "2d",
      "3", "4", "5", "6", "7", "8", "9", "10",
      "11a", "11b", "12", "13", "14", "15", "16", "17a", "17b"
    ].map(suffix => `Cy-Bklt_TC-${suffix}`)
  );
  const currentUnitListBookletKeys = new Set([
    "Cy-Bklt_TC-5",
    "Cy-Bklt_TC-9",
    "Cy-Bklt_TC-10",
    "Cy-Bklt_TC-11a",
    "Cy-Bklt_TC-11b",
    "Cy-Bklt_TC-15",
    "Cy-Bklt_TC-16",
    "Cy-Bklt_TC-17a",
    "Cy-Bklt_TC-17b"
  ]);
  for (const [fixture, bookletKey, sha256] of current.booklets) {
    const document = Buffer.from(
      readFileSync(resolve(corpusRoot, fixture), "utf8").trim(),
      "base64"
    );
    assert.equal(createHash("sha256").update(document).digest("hex"), sha256);
    assert.match(document.toString("utf8"), /testcenter-booklet-xml\/18\.0/);
    assert.match(document.toString("utf8"), new RegExp(`<Id>${bookletKey}<\\/Id>`));
    if (currentUnitListBookletKeys.has(bookletKey)) {
      assert.match(
        document.toString("utf8"),
        /<Config key="toolbar_show_unit_list">TRUE<\/Config>/
      );
      assert.doesNotMatch(document.toString("utf8"), /key="unit_menu"/);
    }
  }
  assert.deepEqual(
    current.units.map(([, unitKey]) => unitKey),
    Array.from({ length: 5 }, (_, index) => `CY-Unit.Sample-${index + 100}`)
  );
  assert.equal(current.player.playerKey, "verona-player-simple-6.0");

  const rosterBuffer = Buffer.from(
    readFileSync(resolve(corpusRoot, current.roster.fixture), "utf8").trim(),
    current.roster.encoding
  );
  assert.equal(
    createHash("sha256").update(rosterBuffer).digest("hex"),
    current.roster.sha256,
    current.roster.sourcePath
  );
  assert.match(rosterBuffer.toString("utf8"), /testcenter-testtaker-xml\/18\.0/);
  const participants = parseParticipantRosterText(rosterBuffer.toString("utf8"));
  const expectedParticipants = current.roster.groups.flatMap(group =>
    group.participants.map(([loginKey, executionMode, bookletKey]) => ({
      loginKey,
      executionMode,
      bookletKey,
      groupKey: group.groupKey
    }))
  );
  assert.equal(participants.length, current.roster.participantCount);
  assert.deepEqual(parseOriginalTestcenterOperationalLogins(rosterBuffer.toString("utf8")), []);
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
    participants.find(participant => participant.loginKey === "Test_Ctrl-2b")
      ?.viewSettings?.codeInput,
    { type: "text-field", length: 4 }
  );
  assert.deepEqual(
    participants.find(participant => participant.loginKey === "Test_Ctrl-2c")
      ?.viewSettings?.codeInput,
    { type: "keypad-symbols", length: 4 }
  );
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

test("original Testcenter compatibility corpus pins the current 51-account Booklet Config package", () => {
  type BookletFixture = PinnedOriginalFixture & { bookletKey: string };
  const corpus = JSON.parse(
    readFileSync(resolve(corpusRoot, "corpus.json"), "utf8")
  ) as OriginalTestcenterCorpus & {
    booklets: BookletFixture[];
    systemBooklets: BookletFixture[];
  };
  const bookletConfig = corpus.currentOriginalBookletConfigPackage;
  assert.equal(
    bookletConfig.sourceCommit,
    "a5a6d25a72990d667300804c337cc5b500b01d2f"
  );
  assert.equal(
    bookletConfig.sourceDirectory,
    "sampledata/system-test/booklet-config"
  );
  assert.deepEqual(
    bookletConfig.bookletKeys,
    Array.from(
      { length: 51 },
      (_, index) => `Cy-Bklt_BkltConfig-${index + 1}`
    )
  );

  const currentBooklets = new Map<string, Buffer>();
  for (const booklet of bookletConfig.currentBookletOverrides) {
    const document = Buffer.from(
      readFileSync(resolve(corpusRoot, booklet.fixture), "utf8").trim(),
      booklet.encoding
    );
    assert.equal(
      createHash("sha256").update(document).digest("hex"),
      booklet.sha256,
      booklet.sourcePath
    );
    currentBooklets.set(booklet.bookletKey, document);
  }
  const unchangedBooklets = [...corpus.booklets, ...corpus.systemBooklets]
    .filter(booklet => bookletConfig.bookletKeys.slice(4).includes(booklet.bookletKey));
  assert.equal(unchangedBooklets.length, 47);
  for (const booklet of unchangedBooklets) {
    const document = readFileSync(resolve(corpusRoot, booklet.fixture));
    assert.equal(
      createHash("sha256").update(document).digest("hex"),
      booklet.sha256,
      booklet.sourcePath
    );
    currentBooklets.set(booklet.bookletKey, document);
  }
  assert.deepEqual(
    Array.from(currentBooklets.keys()).sort((left, right) =>
      Number(left.split("-").at(-1)) - Number(right.split("-").at(-1))
    ),
    bookletConfig.bookletKeys
  );

  const firstFour = bookletConfig.currentBookletOverrides.map(booklet =>
    currentBooklets.get(booklet.bookletKey)?.toString("utf8")
  );
  assert.match(firstFour[0] ?? "", /<Config key="ask_for_fullscreen">OFF<\/Config>/);
  assert.doesNotMatch(firstFour[0] ?? "", /TimeMax/);
  assert.match(firstFour[1] ?? "", /<Config key="ask_for_fullscreen">ON<\/Config>/);
  assert.match(firstFour[2] ?? "", /<Config key="browserBehaviour">standard<\/Config>/);
  assert.match(firstFour[3] ?? "", /<Config key="browserBehaviour">preventNav<\/Config>/);
  for (const [index, document] of firstFour.entries()) {
    assert.match(document ?? "", /testcenter-booklet-xml\/18\.0/);
    assert.match(
      document ?? "",
      new RegExp(`<Id>Cy-Bklt_BkltConfig-${index + 1}<\\/Id>`)
    );
  }

  for (const [fixture, unitKey, sha256] of bookletConfig.units) {
    const unitDocument = Buffer.from(
      readFileSync(resolve(corpusRoot, fixture), "utf8").trim(),
      "base64"
    );
    assert.equal(createHash("sha256").update(unitDocument).digest("hex"), sha256);
    assert.match(unitDocument.toString("utf8"), /unit-xml\/17\.4/);
    assert.match(
      unitDocument.toString("utf8"),
      new RegExp(`<Id>${unitKey.replaceAll(".", "\\.")}<\\/Id>`)
    );
  }

  const playerDocument = brotliDecompressSync(
    Buffer.from(
      readFileSync(resolve(corpusRoot, bookletConfig.player.fixture), "utf8").trim(),
      "base64"
    )
  );
  assert.equal(
    createHash("sha256").update(playerDocument).digest("hex"),
    bookletConfig.player.sha256,
    bookletConfig.player.sourcePath
  );
  assert.match(playerDocument.toString("utf8"), /"version"\s*:\s*"6\.0\.5"/);

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
  assert.equal(participants.length, bookletConfig.roster.participantCount);
  assert.deepEqual(parseOriginalTestcenterOperationalLogins(rosterBuffer.toString("utf8")), []);
  for (const [index, participant] of participants.entries()) {
    const suffix = index + 1;
    assert.equal(participant.loginKey, `${bookletConfig.roster.loginPrefix}${suffix}`);
    assert.equal(participant.groupKey, bookletConfig.roster.groupKey);
    assert.equal(participant.password, bookletConfig.roster.password);
    assert.equal(participant.executionMode, bookletConfig.roster.executionMode);
    assert.equal(participant.bookletKey, `Cy-Bklt_BkltConfig-${suffix}`);
  }
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

test("original Testcenter compatibility corpus pins current 18.0 session management semantics", () => {
  const corpus = JSON.parse(
    readFileSync(resolve(corpusRoot, "corpus.json"), "utf8")
  ) as OriginalTestcenterCorpus;
  const sessionManagement = corpus.currentOriginalSessionManagementPackage;
  assert.equal(
    sessionManagement.sourceCommit,
    "a5a6d25a72990d667300804c337cc5b500b01d2f"
  );
  assert.equal(
    sessionManagement.sourceDirectory,
    "sampledata/system-test/session-management"
  );

  for (const booklet of sessionManagement.booklets) {
    const document = Buffer.from(
      readFileSync(resolve(corpusRoot, booklet.fixture), "utf8").trim(),
      booklet.encoding
    );
    assert.equal(
      createHash("sha256").update(document).digest("hex"),
      booklet.sha256,
      booklet.sourcePath
    );
    assert.match(document.toString("utf8"), /testcenter-booklet-xml\/18\.0/);
    assert.match(
      document.toString("utf8"),
      new RegExp(`<Id>${booklet.bookletKey}<\\/Id>`)
    );
  }
  assert.deepEqual(
    sessionManagement.booklets.map(booklet => [booklet.bookletKey, booklet.unitKeys]),
    [
      [
        "Cy-Bklt_SM-1",
        Array.from({ length: 5 }, (_, index) => `CY-Unit.Sample-${index + 100}`)
      ],
      ["Cy-Bklt_SM-2", ["CY-Unit.Sample-101", "CY-Unit.Sample-102"]]
    ]
  );

  for (const unit of sessionManagement.units) {
    const document = Buffer.from(
      readFileSync(resolve(corpusRoot, unit.fixture), "utf8").trim(),
      unit.encoding
    );
    assert.equal(
      createHash("sha256").update(document).digest("hex"),
      unit.sha256,
      unit.sourcePath
    );
    assert.match(document.toString("utf8"), /unit-xml\/17\.4/);
  }
  const playerDocument = brotliDecompressSync(
    Buffer.from(
      readFileSync(resolve(corpusRoot, sessionManagement.player.fixture), "utf8").trim(),
      "base64"
    )
  );
  assert.equal(
    createHash("sha256").update(playerDocument).digest("hex"),
    sessionManagement.player.sha256,
    sessionManagement.player.sourcePath
  );
  assert.match(playerDocument.toString("utf8"), /"version"\s*:\s*"6\.0\.5"/);

  const rosterDocument = Buffer.from(
    readFileSync(resolve(corpusRoot, sessionManagement.roster.fixture), "utf8").trim(),
    sessionManagement.roster.encoding
  );
  assert.equal(
    createHash("sha256").update(rosterDocument).digest("hex"),
    sessionManagement.roster.sha256,
    sessionManagement.roster.sourcePath
  );
  assert.match(rosterDocument.toString("utf8"), /testcenter-testtaker-xml\/18\.0/);
  const entries = parseParticipantRosterText(rosterDocument.toString("utf8"));
  assert.deepEqual(
    entries.map(entry => entry.loginKey),
    sessionManagement.roster.participantLoginKeys
  );
  assert.deepEqual(parseOriginalTestcenterOperationalLogins(rosterDocument.toString("utf8")), []);
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
  assert.equal(entriesByLoginKey.get("SM-7")?.executionMode, "run-hot-return");
  assert.equal(entriesByLoginKey.get("SM-9")?.executionMode, "run-hot-restart");
  assert.equal(entriesByLoginKey.get("SM-10")?.validFrom, "1/6/2023 10:00");
  assert.equal(entriesByLoginKey.get("SM-11")?.validTo, "1/6/2023 10:00");
  assert.equal(entriesByLoginKey.get("SM-12")?.validForMinutes, 10);
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
