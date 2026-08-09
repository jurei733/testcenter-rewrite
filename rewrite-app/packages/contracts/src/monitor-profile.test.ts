import assert from "node:assert/strict";
import test from "node:test";

import type {
  MonitorViewProfile,
  OpenMonitorRun
} from "@testcenter-rewrite-app/domain";

import { filterOpenMonitorRunsByProfile } from "./index.js";

const createOpenRun = (
  loginKey: string,
  status: OpenMonitorRun["status"],
  bookletStates: Record<string, string> = {}
): OpenMonitorRun => ({
  testRunId: `run:${loginKey}`,
  participantSessionId: `session:${loginKey}`,
  loginKey,
  groupKey: "group:allowed",
  executionMode: "run-hot-return",
  participantRosterEntry: null,
  bookletKey: "booklet:starter",
  bookletSpecies: "species: 2",
  bookletError: null,
  bookletAssignmentKey: "booklet:starter",
  bookletStates,
  status,
  currentUnitKey: "unit:one",
  activeTestletTimer: null,
  updatedAt: "2026-08-01T00:00:00.000Z"
});

const baseProfile: MonitorViewProfile = {
  profileId: "small",
  label: "Small",
  settings: {
    blockColumn: "hide",
    unitColumn: "hide",
    view: "small",
    groupColumn: "show",
    bookletColumn: "hide",
    bookletStatesColumns: "level",
    autoselectNextBlock: "no"
  },
  filters: [],
  filtersEnabled: { pending: "no", locked: "no" }
};

test("monitor profiles apply original exclusion and inverted inclusion filters", () => {
  const student = createOpenRun("student-ui", "running", { level: "advanced" });
  const other = createOpenRun("other-ui", "running", { level: "basic" });
  const profile: MonitorViewProfile = {
    ...baseProfile,
    filters: [
      {
        target: "personLabel",
        value: "student",
        subValue: null,
        label: "Students only",
        type: "substring",
        not: true
      },
      {
        target: "bookletStates",
        value: "level",
        subValue: "advanced",
        label: "Advanced only",
        type: "equal",
        not: true
      }
    ]
  };

  assert.deepEqual(
    filterOpenMonitorRunsByProfile([student, other], profile).map(
      run => run.loginKey
    ),
    ["student-ui"]
  );
});

test("monitor profiles hide pending runs and filter projected block labels", () => {
  const created = createOpenRun("created-ui", "created");
  const running = createOpenRun("running-ui", "running");
  running.currentBlockKey = "block:intro";
  running.currentBlockLabel = "Introduction";
  const other = createOpenRun("other-ui", "running");
  other.currentBlockKey = "block:tasks";
  other.currentBlockLabel = "Tasks";
  const profile: MonitorViewProfile = {
    ...baseProfile,
    filters: [
      {
        target: "blockLabel",
        value: "Introduction",
        subValue: null,
        label: "Hide introduction",
        type: "equal",
        not: false
      }
    ],
    filtersEnabled: { pending: "yes", locked: "no" }
  };

  assert.deepEqual(
    filterOpenMonitorRunsByProfile([created, running, other], profile).map(
      run => run.loginKey
    ),
    ["other-ui"]
  );
  assert.equal(
    filterOpenMonitorRunsByProfile([created, running], null).length,
    2
  );
});

test("monitor profiles honor the original locked-run filter independently", () => {
  const locked = createOpenRun("locked-ui", "paused");
  locked.locked = true;
  const running = createOpenRun("running-ui", "running");
  const profile: MonitorViewProfile = {
    ...baseProfile,
    filtersEnabled: { pending: "no", locked: "yes" }
  };

  assert.deepEqual(
    filterOpenMonitorRunsByProfile([locked, running], profile).map(
      run => run.loginKey
    ),
    ["running-ui"]
  );
});

test("monitor profiles filter runs by original booklet species", () => {
  const matching = createOpenRun("matching-ui", "running");
  const other = createOpenRun("other-ui", "running");
  other.bookletSpecies = "species: 3";
  const profile: MonitorViewProfile = {
    ...baseProfile,
    filters: [
      {
        target: "bookletSpecies",
        value: "species: 2",
        subValue: null,
        label: "Same booklet structure",
        type: "equal",
        not: true
      }
    ]
  };

  assert.deepEqual(
    filterOpenMonitorRunsByProfile([matching, other], profile).map(
      run => run.loginKey
    ),
    ["matching-ui"]
  );
});
