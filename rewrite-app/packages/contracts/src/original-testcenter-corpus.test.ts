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
    checkId: string;
    questionCount: number;
    skipNetwork: boolean;
    canSave: boolean;
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

  const systemCheck = corpus.systemChecks[0];
  const systemCheckXml = readFileSync(
    resolve(corpusRoot, systemCheck.fixture),
    "utf8"
  );
  assert.match(systemCheckXml, new RegExp(`<Id>${systemCheck.checkId}</Id>`));
  assert.equal(
    Array.from(systemCheckXml.matchAll(/<Q\b/g)).length,
    systemCheck.questionCount
  );
  assert.equal(/skipnetwork="true"/i.test(systemCheckXml), systemCheck.skipNetwork);
  assert.equal(/\bsavekey="[^"]+"/i.test(systemCheckXml), systemCheck.canSave);

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
