import assert from "node:assert/strict";
import test from "node:test";

import {
  bookletNavigationDeniedReasons,
  compileBookletRuntimePolicy,
  isBookletPlayerEndAllowed,
  readBookletConfigValues
} from "./booklet-policy.js";

test("player-end policy is evaluated consistently for current unit position", () => {
  assert.equal(isBookletPlayerEndAllowed("never", false), false);
  assert.equal(isBookletPlayerEndAllowed("never", true), false);
  assert.equal(isBookletPlayerEndAllowed("last_unit", false), false);
  assert.equal(isBookletPlayerEndAllowed("last_unit", true), true);
  assert.equal(isBookletPlayerEndAllowed("always", false), true);
  assert.equal(isBookletPlayerEndAllowed("always", true), true);
});

test("booklet policy compiler maps original Testcenter config and defaults", () => {
  const defaults = compileBookletRuntimePolicy({});
  assert.equal(defaults.navigation.requirePresentationComplete, "off");
  assert.equal(defaults.navigation.playerEnd, "always");
  assert.equal(defaults.navigation.browserNavigation, "standard");
  assert.equal(defaults.navigation.unitControls, "both");
  assert.equal(defaults.navigation.unitLabel, "index");
  assert.equal(defaults.navigation.unitListEnabled, false);
  assert.equal(defaults.navigation.backwardButton, "hidden");
  assert.equal(defaults.navigation.forwardButton, "hidden");
  assert.equal(defaults.player.loadingMode, "lazy");
  assert.equal(defaults.timing.showTimeLeft, false);
  assert.equal(defaults.display.headerHidden, false);
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
    loading_mode: "EAGER",
    force_presentation_complete: "ON",
    force_response_complete: "ALWAYS",
    browserBehaviour: "preventNav",
    navbar_unit_label: "LABEL",
    navbar_backward_button: "DYNAMIC",
    navbar_forward_button: "PAGES",
    unit_menu: "FULL",
    unit_navibuttons: "FORWARD_ONLY",
    allow_player_to_terminate_test: "LAST_UNIT",
    pagingMode: "concat-scroll-snap",
    logPolicy: "debug",
    restore_current_page_on_return: "ON",
    navbar_page_label: "LABEL",
    navbar_page_controls_hidden: "TRUE",
    lock_test_on_termination: "ON",
    header_hidden: "TRUE",
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
  assert.equal(policy.navigation.browserNavigation, "prevent");
  assert.equal(policy.navigation.unitMenuEnabled, true);
  assert.equal(policy.navigation.unitControls, "forward_only");
  assert.equal(policy.navigation.unitLabel, "label");
  assert.equal(policy.navigation.unitListEnabled, false);
  assert.equal(policy.navigation.backwardButton, "dynamic");
  assert.equal(policy.navigation.forwardButton, "pages");
  assert.equal(policy.navigation.playerEnd, "last_unit");
  assert.equal(policy.player.loadingMode, "eager");
  assert.equal(
    compileBookletRuntimePolicy({ navbar_unit_label: "HIDDEN" }).navigation
      .unitLabel,
    "hidden"
  );
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
  assert.equal(policy.display.headerHidden, true);
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
  assert.equal(
    compileBookletRuntimePolicy({ header_hidden: "FALSE" }).display.headerHidden,
    false
  );

  const legacyUnitNavigation = {
    OFF: ["hidden", "hidden", false],
    ARROWS_ONLY: ["both", "hidden", false],
    FORWARD_ONLY: ["forward_only", "hidden", true],
    FULL: ["both", "hidden", true],
    INDEX: ["both", "index", false],
    LABEL: ["both", "label", false]
  } as const;
  for (const [value, [controls, label, listEnabled]] of Object.entries(
    legacyUnitNavigation
  )) {
    const legacyPolicy = compileBookletRuntimePolicy({
      unit_navibuttons: value
    });
    assert.equal(legacyPolicy.navigation.unitControls, controls);
    assert.equal(legacyPolicy.navigation.unitLabel, label);
    assert.equal(legacyPolicy.navigation.unitListEnabled, listEnabled);
  }
  const transitionalPolicy = compileBookletRuntimePolicy({
    unit_navibuttons: "FULL",
    navbar_unit_label: "LABEL",
    navbar_unit_controls_hidden: "TRUE"
  });
  assert.equal(transitionalPolicy.navigation.unitControls, "hidden");
  assert.equal(transitionalPolicy.navigation.unitLabel, "label");
  assert.equal(transitionalPolicy.navigation.unitListEnabled, false);

  for (const [sourceValue, expectedMode] of [
    ["HIDDEN", "hidden"],
    ["DYNAMIC", "dynamic"],
    ["UNITS", "units"],
    ["PAGES", "pages"],
    ["unsupported", "hidden"]
  ] as const) {
    const globalNavigationPolicy = compileBookletRuntimePolicy({
      navbar_backward_button: sourceValue,
      navbar_forward_button: sourceValue.toLowerCase()
    });
    assert.equal(globalNavigationPolicy.navigation.backwardButton, expectedMode);
    assert.equal(globalNavigationPolicy.navigation.forwardButton, expectedMode);
  }
});

test("current Original defaults and independent short Unit label settings are compiled", () => {
  const defaults = compileBookletRuntimePolicy({});
  assert.equal(defaults.display.headerContent, "booklet");
  assert.equal(defaults.display.toolbarUnitLabel, "label");
  assert.equal(defaults.display.unitTitle, true);

  const short = compileBookletRuntimePolicy({
    header_content: "UNIT_LABEL_SHORT",
    navbar_unit_label: "LABEL_SHORT",
    toolbar_unit_label: "LABEL_SHORT"
  });
  assert.equal(short.display.headerContent, "unit_short");
  assert.equal(short.navigation.unitLabel, "label_short");
  assert.equal(short.display.toolbarUnitLabel, "label_short");
  assert.equal(short.display.unitTitle, true);

  const independent = compileBookletRuntimePolicy({
    header_content: "UNIT_LABEL", navbar_unit_label: "LABEL_SHORT", toolbar_unit_label: "HIDDEN"
  });
  assert.equal(independent.display.headerContent, "unit");
  assert.equal(independent.navigation.unitLabel, "label_short");
  assert.equal(independent.display.toolbarUnitLabel, "hidden");
  assert.equal(independent.display.unitTitle, false);
});

test("modern toolbar labels win over both legacy title keys without changing source values", () => {
  for (const [value, expected] of [["LABEL", "label"], ["LABEL_SHORT", "label_short"], ["HIDDEN", "hidden"]] as const) {
    for (const legacy of ["TRUE", "FALSE", "ON", "OFF"]) {
      const source = { toolbar_unit_label: value, toolbar_show_unit_title: legacy, unit_title: legacy };
      const policy = compileBookletRuntimePolicy(source);
      assert.equal(policy.display.toolbarUnitLabel, expected);
      assert.equal(policy.display.unitTitle, expected !== "hidden");
      assert.deepEqual(policy.sourceConfig, source);
    }
  }
});

test("toolbar title migration preserves configured-key precedence, TRUE/FALSE and ON/OFF", () => {
  for (const [config, expected] of [
    [{ unit_title: "OFF" }, "hidden"], [{ unit_title: "ON" }, "label"],
    [{ toolbar_show_unit_title: "FALSE" }, "hidden"], [{ toolbar_show_unit_title: "TRUE" }, "label"],
    [{ toolbar_show_unit_title: "OFF" }, "hidden"], [{ toolbar_show_unit_title: "ON" }, "label"],
    [{ toolbar_show_unit_title: "TRUE", unit_title: "OFF" }, "label"],
    [{ toolbar_show_unit_title: "FALSE", unit_title: "ON" }, "hidden"],
    [{ toolbar_unit_label: "", toolbar_show_unit_title: "FALSE" }, "label"],
    [{ toolbar_show_unit_title: "", unit_title: "OFF" }, "label"]
  ] as const) {
    const policy = compileBookletRuntimePolicy(config);
    assert.equal(policy.display.toolbarUnitLabel, expected, JSON.stringify(config));
    assert.equal(policy.display.unitTitle, expected !== "hidden", JSON.stringify(config));
  }
});

test("short Unit label config arrays and legacy header aliases stay compatible", () => {
  const policy = compileBookletRuntimePolicy([
    { key: "header_content", text: "UNIT_LABEL_SHORT" },
    { key: "navbar_unit_label", value: "LABEL_SHORT" },
    { key: "toolbar_unit_label", value: "LABEL_SHORT" }
  ]);
  assert.equal(policy.display.headerContent, "unit_short");
  assert.equal(policy.navigation.unitLabel, "label_short");
  assert.equal(policy.display.toolbarUnitLabel, "label_short");
  for (const [value, expected] of [
    ["OFF", "none"], ["EMPTY", "none"], ["WITH_UNIT_TITLE", "unit"],
    ["WITH_BOOKLET_TITLE", "booklet"], ["WITH_BLOCK_TITLE", "block"]
  ] as const) assert.equal(compileBookletRuntimePolicy({ unit_screenheader: value }).display.headerContent, expected);
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
