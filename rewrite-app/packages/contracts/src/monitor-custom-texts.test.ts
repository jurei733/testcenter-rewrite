import assert from "node:assert/strict";
import test from "node:test";

import {
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
