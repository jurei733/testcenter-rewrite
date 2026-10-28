import assert from "node:assert/strict";
import { runtimeErrorPlayer } from "./runtime-error-fixture.mjs";

// The same owned frame emits an invalid ready notification to both unmodified
// controllers. The HTML contains no legacy module-version fallback metadata.
export function playerVersionErrorPlayer(html, variant, readyDelayMs = 0) {
  assert.ok(["missing", "unsupported"].includes(variant));
  assert.ok(Number.isInteger(readyDelayMs) && readyDelayMs >= 0 && readyDelayMs < 8_000);
  html = runtimeErrorPlayer(html);
  const before = 'metadata: { specVersion: "6.0" }';
  assert.equal(html.split(before).length, 2);
  html = html.replace(before, variant === "missing"
    ? "metadata: {}"
    : 'metadata: { specVersion: "9.0" }');
  const delayAnchor = '}, "*"), 0);';
  assert.equal(html.split(delayAnchor).length, 2);
  return html.replace(delayAnchor, `}, "*"), ${readyDelayMs});`);
}
