import assert from "node:assert/strict";
import test from "node:test";

import {
  bookletNavigationDeniedReasons,
  compileBookletRuntimePolicy,
  readBookletConfigValues
} from "./booklet-policy.js";

test("booklet policy compiler maps original Testcenter config and defaults", () => {
  const defaults = compileBookletRuntimePolicy({});
  assert.equal(defaults.navigation.requirePresentationComplete, "off");
  assert.equal(defaults.navigation.playerEnd, "always");
  assert.equal(defaults.navigation.unitControls, "both");
  assert.deepEqual(defaults.timing.warningMinutes, [5, 1]);
  assert.equal(
    compileBookletRuntimePolicy({ show_end_button_in_player: "OFF" }).navigation
      .playerEnd,
    "always"
  );

  const policy = compileBookletRuntimePolicy({
    force_presentation_complete: "ON",
    force_response_complete: "ALWAYS",
    unit_menu: "FULL",
    unit_navibuttons: "FORWARD_ONLY",
    allow_player_to_terminate_test: "LAST_UNIT",
    pagingMode: "concat-scroll-snap",
    logPolicy: "debug",
    restore_current_page_on_return: "ON",
    lock_test_on_termination: "ON",
    unit_time_left_warnings: "10, 5; 1"
  });
  assert.equal(policy.navigation.requirePresentationComplete, "forward");
  assert.equal(policy.navigation.requireResponseComplete, "always");
  assert.equal(policy.navigation.unitMenuEnabled, true);
  assert.equal(policy.navigation.unitControls, "forward_only");
  assert.equal(policy.navigation.playerEnd, "last_unit");
  assert.equal(policy.player.pagingMode, "concat-scroll-snap");
  assert.equal(policy.player.logPolicy, "debug");
  assert.equal(policy.player.restoreCurrentPageOnReturn, true);
  assert.equal(policy.completion.lockOnTermination, true);
  assert.deepEqual(policy.timing.warningMinutes, [10, 5, 1]);
  assert.deepEqual(
    compileBookletRuntimePolicy({ unit_time_left_warnings: "" }).timing
      .warningMinutes,
    []
  );
});

test("booklet config arrays and completeness rules are normalized", () => {
  const config = readBookletConfigValues([
    { key: "force_presentation_complete", value: "ALWAYS" },
    { key: "force_response_complete", text: "ON" }
  ]);
  const policy = compileBookletRuntimePolicy(config);

  assert.deepEqual(
    bookletNavigationDeniedReasons({
      policy,
      direction: "backward",
      presentationProgress: "some",
      responseProgress: "none"
    }),
    ["presentation_incomplete"]
  );
  assert.deepEqual(
    bookletNavigationDeniedReasons({
      policy,
      direction: "forward",
      presentationProgress: "complete",
      responseProgress: "none"
    }),
    ["response_incomplete"]
  );
  assert.deepEqual(
    bookletNavigationDeniedReasons({
      policy,
      direction: "forward",
      presentationProgress: "complete-and-valid",
      responseProgress: "complete"
    }),
    []
  );
});
