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
  assert.equal(defaults.timing.showTimeLeft, false);
  assert.equal(defaults.display.reloadButton, false);
  assert.equal(defaults.display.silentMode, false);
  assert.deepEqual(defaults.player.pageNavigation, {
    labelMode: "index",
    controlsHidden: false
  });
  assert.deepEqual(defaults.timing.warningMinutes, [5, 1]);
  assert.deepEqual(defaults.persistence, {
    unitResponsesBufferMs: 5_000,
    unitStateBufferMs: 6_000,
    testStateBufferMs: 1_000
  });
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
    navbar_page_label: "LABEL",
    navbar_page_controls_hidden: "TRUE",
    lock_test_on_termination: "ON",
    toolbar_show_reload_button: "TRUE",
    silent_mode: "TRUE",
    unit_show_time_left: "ON",
    unit_time_left_warnings: "10, 5; 1",
    unit_responses_buffer_time: "2500",
    unit_state_buffer_time: "3000.9",
    test_state_buffer_time: "0"
  });
  assert.equal(policy.navigation.requirePresentationComplete, "forward");
  assert.equal(policy.navigation.requireResponseComplete, "always");
  assert.equal(policy.navigation.unitMenuEnabled, true);
  assert.equal(policy.navigation.unitControls, "forward_only");
  assert.equal(policy.navigation.playerEnd, "last_unit");
  assert.equal(policy.player.pagingMode, "concat-scroll-snap");
  assert.equal(
    compileBookletRuntimePolicy({ pagingMode: "buttons" }).player.pagingMode,
    "buttons"
  );
  assert.equal(policy.player.logPolicy, "debug");
  assert.equal(policy.player.restoreCurrentPageOnReturn, true);
  assert.deepEqual(policy.player.pageNavigation, {
    labelMode: "label",
    controlsHidden: true
  });
  assert.equal(policy.completion.lockOnTermination, true);
  assert.equal(policy.display.reloadButton, true);
  assert.equal(policy.display.silentMode, true);
  assert.equal(policy.timing.showTimeLeft, true);
  assert.deepEqual(policy.timing.warningMinutes, [10, 5, 1]);
  assert.deepEqual(policy.persistence, {
    unitResponsesBufferMs: 2_500,
    unitStateBufferMs: 3_000,
    testStateBufferMs: 0
  });
  assert.deepEqual(
    compileBookletRuntimePolicy({ unit_time_left_warnings: "" }).timing
      .warningMinutes,
    []
  );
  assert.deepEqual(
    compileBookletRuntimePolicy({
      unit_responses_buffer_time: "invalid",
      unit_state_buffer_time: "-1",
      test_state_buffer_time: ""
    }).persistence,
    defaults.persistence
  );
  assert.deepEqual(
    compileBookletRuntimePolicy({ page_navibuttons: "OFF" }).player
      .pageNavigation,
    { labelMode: "hidden", controlsHidden: false }
  );
  assert.deepEqual(
    compileBookletRuntimePolicy({ page_navibuttons: "FULL" }).player
      .pageNavigation,
    { labelMode: "list", controlsHidden: false }
  );
  assert.deepEqual(
    compileBookletRuntimePolicy({ page_navibuttons: "SEPARATE_BOTTOM" }).player
      .pageNavigation,
    { labelMode: "index", controlsHidden: false }
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
