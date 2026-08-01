import assert from "node:assert/strict";
import test from "node:test";

import { resolveOperatorAccessMode } from "./index.js";

test("operator access mode prefers any administrative assignment", () => {
  assert.equal(
    resolveOperatorAccessMode([
      { role: "group_monitor" },
      { role: "workspace_admin" }
    ]),
    "admin"
  );
});

test("operator access mode distinguishes study and group monitors", () => {
  assert.equal(
    resolveOperatorAccessMode([
      { role: "group_monitor" },
      { role: "study_monitor" }
    ]),
    "study_monitor"
  );
  assert.equal(
    resolveOperatorAccessMode([{ role: "group_monitor" }]),
    "group_monitor"
  );
  assert.equal(resolveOperatorAccessMode([]), "unassigned");
});
