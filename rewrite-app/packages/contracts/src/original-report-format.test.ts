import assert from "node:assert/strict";
import { test } from "node:test";
import { selectOriginalReportFormat } from "./original-report-format.js";

test("Original 19 report format matches the upstream Accept-header matrix", () => {
  const cases = [
    ["text/csv", "csv"], ["text/csv;charset=utf-8", "csv"],
    [" TEXT/CSV ", "csv"], ["application/xml, text/csv", "csv"],
    ["application/json", "json"], ["application/json, text/csv", "json"],
    ["*/*", "json"], ["text/html,application/xhtml+xml,*/*;q=0.8", "json"],
    ["", "json"]
  ] as const;
  for (const [header, expected] of cases) {
    assert.equal(selectOriginalReportFormat(header, "json"), expected, header);
  }
  assert.equal(selectOriginalReportFormat("*/*", "csv"), "csv");
  assert.equal(selectOriginalReportFormat(undefined, "csv"), "csv");
  assert.equal(selectOriginalReportFormat("application/xml, APPLICATION/JSON; charset=UTF-8, text/csv", "csv"), "json");
  assert.equal(selectOriginalReportFormat("text/csv; q=0, application/json; q=1", "json"), "csv",
    "Original deliberately picks the first supported entry, not a quality-sorted alternative.");
});
