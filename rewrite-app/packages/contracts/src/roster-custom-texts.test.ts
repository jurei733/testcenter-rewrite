import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { parseOriginalTestcenterOperationalLogins, parseParticipantRosterText } from "./participant-roster.js";

const reference = JSON.parse(readFileSync(resolve(process.cwd(),
  "test-fixtures/original-testcenter/current-roster-custom-text-reference.json"), "utf8")) as {
  originalCommit: string; method: string; oracle: { methodSha256: string };
  cases: Array<{ name: string; xml: string; expected: Record<string, string> }>;
};
assert.equal(reference.originalCommit, "eedae41840cbe90e5547c0211da818bdf620f5aa");
assert.equal(createHash("sha256").update(reference.method).digest("hex"), reference.oracle.methodSha256);
for (const item of reference.cases) {
  test(`participant custom texts match native Original SimpleXML: ${item.name}`, () => {
    const entries = parseParticipantRosterText(item.xml);
    assert.deepEqual(entries.map(entry => entry.loginKey), ["p"]);
    const entry = entries[0];
    assert.ok(entry); assert.deepEqual(entry.customTexts ?? {}, item.expected);
    assert.equal(entry.loginKey, "p"); assert.equal(entry.bookletKey, "B");
  });
  test(`operator custom texts match native Original SimpleXML: ${item.name}`, () => {
    const entries = parseOriginalTestcenterOperationalLogins(item.xml);
    assert.deepEqual(entries.map(entry => entry.loginKey), ["m"]);
    const entry = entries[0];
    assert.ok(entry); assert.deepEqual(entry.customTexts ?? {}, item.expected);
    assert.equal(entry.loginKey, "m");
  });
}
