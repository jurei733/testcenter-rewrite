import assert from "node:assert/strict";
import test from "node:test";

import {
  BUG_REPORT_MAX_REPORT_LENGTH,
  buildBugReportText,
  redactBugReportText
} from "./bug-report.js";

test("bug reports redact credentials, tokens, cookies, and URL parameters", () => {
  const report = redactBugReportText([
    "https://user:pass@example.test/path?token=query-secret#private",
    "Authorization: Bearer bearer-secret",
    "password=plain-secret",
    '"apiKey": "json-secret"',
    "cookie: session=private; second=also-private",
    "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature123"
  ].join("\n"));

  assert.match(report, /https:\/\/example\.test\/path/);
  assert.doesNotMatch(report, /user:pass|query-secret|session=private|also-private|bearer-secret|plain-secret|json-secret|signature123/);
  assert.match(report, /Authorization: \[REDACTED\]/);
  assert.match(report, /password=\[REDACTED\]/);
  assert.match(report, /"apiKey": \[REDACTED\]/);
});

test("bug report builder includes diagnostic context and applies the size limit", () => {
  const report = buildBugReportText({
    errorId: "error-123",
    label: "RuntimeError",
    message: "Could not load unit",
    timestamp: "2026-08-13T10:00:00.000Z",
    url: "https://example.test/app?login=secret",
    userAgent: "Example Browser",
    buildRef: "abc123",
    details: `token=${"x".repeat(BUG_REPORT_MAX_REPORT_LENGTH)}`,
    previousErrors: ["Earlier error"]
  });

  assert.match(report, /Error ID: error-123/);
  assert.match(report, /Build: abc123/);
  assert.match(report, /URL: https:\/\/example\.test\/app/);
  assert.doesNotMatch(report, /login=secret/);
  assert.ok(report.length <= BUG_REPORT_MAX_REPORT_LENGTH);
});
