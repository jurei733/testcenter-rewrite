import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  parseOriginalTestcenterOperationalLogins,
  parseParticipantRosterText
} from "./index.js";

type OriginalTestcenterCorpus = {
  sourceCommit: string;
  roster: {
    fixture: string;
    participantLoginKeys: string[];
    excludedOperationalLoginKeys: string[];
  };
  resourcePackages: Array<{
    fixture: string;
    sha256: string;
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
