import assert from "node:assert/strict";
import test from "node:test";
import { selectFrontendEntryBundles } from "./frontend-bundle-references.mjs";

test("Preflight selects the active index bundles, independent of retained directory assets", () => {
  assert.deepEqual(selectFrontendEntryBundles([
    "main-CURRENT.js", "styles-CURRENT.css", "chunk-LAZY.js", "app-icon.svg"
  ]), { mainBundle: "main-CURRENT.js", stylesheetBundle: "styles-CURRENT.css" });
});
test("Preflight tolerates duplicate links to the same active bundles", () => {
  assert.deepEqual(selectFrontendEntryBundles([
    "main-CURRENT.js", "main-CURRENT.js", "styles-CURRENT.css"
  ]), { mainBundle: "main-CURRENT.js", stylesheetBundle: "styles-CURRENT.css" });
});
test("Preflight rejects missing or ambiguous active index bundles", () => {
  for (const references of [[], ["styles-CURRENT.css"], ["main-CURRENT.js"],
    ["main-CURRENT.js", "main-OTHER.js", "styles-CURRENT.css"],
    ["main-CURRENT.js", "styles-CURRENT.css", "styles-OTHER.css"]]) {
    assert.throws(() => selectFrontendEntryBundles(references), /exactly one/u);
  }
});
