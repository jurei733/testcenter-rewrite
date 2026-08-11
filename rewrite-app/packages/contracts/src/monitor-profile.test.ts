import assert from "node:assert/strict";
import test from "node:test";

import type {
  MonitorViewProfile,
  OpenMonitorRun
} from "@testcenter-rewrite-app/domain";

import {
  filterOpenMonitorRunsByProfile,
  resolveOpenMonitorRunSuperState
} from "./index.js";

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
  testState: {},
  status,
  currentUnitKey: "unit:one",
  currentUnitState: null,
  unitPath: [],
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

test("monitor profiles filter the projected original test-state map", () => {
  const error = createOpenRun("error-ui", "running");
  error.testState = { CONTROLLER: "ERROR", CONNECTION: "LOST" };
  const running = createOpenRun("running-ui", "running");
  running.testState = { CONTROLLER: "RUNNING" };
  const profile: MonitorViewProfile = {
    ...baseProfile,
    filters: [
      {
        target: "testState",
        value: "CONTROLLER",
        subValue: "ERROR",
        label: "Hide controller errors",
        type: "equal",
        not: false
      }
    ]
  };

  assert.deepEqual(
    filterOpenMonitorRunsByProfile([error, running], profile).map(
      run => run.loginKey
    ),
    ["running-ui"]
  );
});

test("monitor profiles use the original derived super-state", () => {
  const error = createOpenRun("error-ui", "running");
  error.testState = { CONTROLLER: "ERROR" };
  const running = createOpenRun("running-ui", "running");
  running.testState = { CONTROLLER: "RUNNING" };
  const profile: MonitorViewProfile = {
    ...baseProfile,
    filters: [
      {
        target: "state",
        value: "error",
        subValue: null,
        label: "Hide inactive state",
        type: "equal",
        not: false
      }
    ]
  };

  assert.deepEqual(
    filterOpenMonitorRunsByProfile([error, running], profile).map(
      run => run.loginKey
    ),
    ["running-ui"]
  );
});

test("monitor super-state derives the original five-minute idle fallback", () => {
  const polling = createOpenRun("polling-ui", "running");
  polling.testState = { CONTROLLER: "RUNNING", CONNECTION: "POLLING" };
  const exactlyFiveMinutes = Date.parse("2026-08-01T00:05:00.000Z");

  assert.equal(
    resolveOpenMonitorRunSuperState(polling, exactlyFiveMinutes),
    "connection_polling"
  );
  assert.equal(
    resolveOpenMonitorRunSuperState(polling, exactlyFiveMinutes + 1),
    "idle"
  );

  polling.testState.CONTROLLER = "ERROR";
  assert.equal(
    resolveOpenMonitorRunSuperState(polling, exactlyFiveMinutes + 1),
    "error",
    "Higher-priority controller failures must remain visible for idle runs."
  );
});

test("monitor profiles can filter the original idle super-state", () => {
  const idle = createOpenRun("idle-ui", "running");
  idle.testState = { CONTROLLER: "RUNNING", CONNECTION: "POLLING" };
  const active = createOpenRun("active-ui", "running");
  active.updatedAt = "2026-08-01T00:00:00.001Z";
  active.testState = { CONTROLLER: "RUNNING", CONNECTION: "POLLING" };
  const profile: MonitorViewProfile = {
    ...baseProfile,
    filters: [
      {
        target: "state",
        value: "idle",
        subValue: null,
        label: "Hide idle runs",
        type: "equal",
        not: false
      }
    ]
  };

  assert.deepEqual(
    filterOpenMonitorRunsByProfile(
      [idle, active],
      profile,
      Date.parse("2026-08-01T00:05:00.001Z")
    ).map(run => run.loginKey),
    ["active-ui"]
  );
});

test("monitor profiles exclude every selected original super-state", () => {
  const error = createOpenRun("error-ui", "running");
  error.testState = { CONTROLLER: "ERROR" };
  const idle = createOpenRun("idle-ui", "running");
  idle.testState = { CONTROLLER: "RUNNING", CONNECTION: "POLLING" };
  const active = createOpenRun("active-ui", "running");
  active.updatedAt = "2026-08-01T00:00:00.001Z";
  active.testState = { CONTROLLER: "RUNNING", CONNECTION: "POLLING" };
  const profile: MonitorViewProfile = {
    ...baseProfile,
    filters: [
      {
        target: "state",
        value: ["error", "idle"],
        subValue: null,
        label: "Hide attention states",
        type: "equal",
        not: false
      }
    ]
  };

  assert.deepEqual(
    filterOpenMonitorRunsByProfile(
      [error, idle, active],
      profile,
      Date.parse("2026-08-01T00:05:00.001Z")
    ).map(run => run.loginKey),
    ["active-ui"]
  );
});
