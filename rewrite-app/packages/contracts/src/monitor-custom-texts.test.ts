import assert from "node:assert/strict";
import test from "node:test";

import {
  formatMonitorDateCustomText,
  formatMonitorCustomText,
  mergeMonitorCustomTextScopes,
  originalMonitorCustomTextKeys,
  resolveMonitorCustomText
} from "./monitor-custom-texts.js";

test("monitor custom-text scopes follow original global-login precedence", () => {
  const effective = mergeMonitorCustomTextScopes(
    { gm_headline: "Global monitor", gm_control_pause: "Global pause" },
    { gm_control_pause: "Login pause" }
  );

  assert.equal(effective.gm_headline, "Global monitor");
  assert.equal(effective.gm_control_pause, "Login pause");
  assert.equal(resolveMonitorCustomText(effective, "gm_control_pause"), "Login pause");
});

test("monitor custom-text catalog retains the original settings keys", () => {
  assert.equal(originalMonitorCustomTextKeys.length, 58);
  assert.ok(originalMonitorCustomTextKeys.includes("gm_headline"));
  assert.ok(originalMonitorCustomTextKeys.includes("gm_control_finish_everything"));
  assert.ok(originalMonitorCustomTextKeys.includes("gm_selection_text_scheduled"));
});

test("monitor selection text substitutes original placeholders in order", () => {
  assert.equal(
    formatMonitorCustomText(
      { gm_selection_info: "%s%s run%s across %s booklet%s" },
      "gm_selection_info",
      ["All ", 2, "s", 1, ""]
    ),
    "All 2 runs across 1 booklet"
  );
  assert.equal(
    formatMonitorCustomText({}, "gm_timeleft_tooltip", [3, 10]),
    "Verbleibende Zeit: 3 von 10 Minute(n)"
  );
});

test("monitor access-window text substitutes documented date placeholders", () => {
  assert.equal(
    formatMonitorDateCustomText(
      { gm_selection_text_scheduled: "Available from $date" },
      "gm_selection_text_scheduled",
      "1 January 2999"
    ),
    "Available from 1 January 2999"
  );
  assert.equal(
    formatMonitorDateCustomText(
      {},
      "gm_selection_text_expired",
      "1 January 2000"
    ),
    "Gruppe abgelaufen seit 1 January 2000."
  );
});
