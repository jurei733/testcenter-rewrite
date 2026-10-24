import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../apps/web/src/app/original-error-timestamp.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {originalErrorTimestamp} = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);

test("runtime report retains pinned Source's fixed en-US medium output and ordinary AM/PM spacing", () => {
  const originalZone = process.env.TZ;
  try {
    process.env.TZ = "Europe/Berlin";
    // Read back from the unmodified Source dialog on an owned, fixed clock.
    assert.equal(originalErrorTimestamp(Date.parse("2026-10-10T12:34:56Z")), "Oct 10, 2026, 2:34:56 PM");
    assert.equal(originalErrorTimestamp(0), "Jan 1, 1970, 1:00:00 AM");
    assert.equal(originalErrorTimestamp(Date.parse("2000-02-29T23:59:59Z")), "Mar 1, 2000, 12:59:59 AM");
    assert.equal(originalErrorTimestamp(Date.parse("2026-03-29T00:59:59Z")), "Mar 29, 2026, 1:59:59 AM");
    assert.equal(originalErrorTimestamp(Date.parse("2026-03-29T01:00:00Z")), "Mar 29, 2026, 3:00:00 AM");
    process.env.TZ = "America/New_York";
    assert.equal(originalErrorTimestamp(Date.parse("2026-10-10T12:34:56Z")), "Oct 10, 2026, 8:34:56 AM");
  } finally {
    if (originalZone === undefined) delete process.env.TZ;
    else process.env.TZ = originalZone;
  }
});
