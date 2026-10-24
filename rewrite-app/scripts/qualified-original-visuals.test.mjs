import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { overlayOriginalVisuals, validateOriginalVisualProfile, assertOriginalVisualBrowser, assertOriginalVisualCase } from "./qualified-original-visuals.mjs";
const read = async name => JSON.parse(await readFile(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));
const profile = await read("original-linux-chromium147"), source = await read("original-browser-source");
const environment = { platform: "linux", architecture: "x64", nodeMajor: 22, browserPackage: "1.59.1", browserMode: "visible" };
test("the verified Source capture qualifies the Linux renderer without relabeling its behavioral reference", async () => {
  validateOriginalVisualProfile(profile, source, environment);
  for (const [name, overlay] of Object.entries(profile.fixtures)) {
    const base = await read(name), qualified = overlayOriginalVisuals(base, overlay);
    assert.equal(qualified.referenceRevision, base.referenceRevision);
    if (base.cases) assert.deepEqual(Object.keys(qualified.cases), Object.keys(base.cases));
  }
  assert.deepEqual(profile.unqualifiedCases, []);
  assert.equal(profile.fixtures["original-system-check-welcome"].measurements["Primar-mobile"].width, 375);
  assert.ok(profile.fixtures["original-exit-completeness"].information["Primar-desktop-legacy"]);
  assert.equal(profile.fixtures["original-header-logo"].measurements["Primar-desktop"].width, 94.859375);
  assert.equal(profile.fixtures["original-login-notices"].measurements["Primar-mobile"].invalidCredentials.host.width, 180.953125,
    "The authored native scrollbar must survive Source capture.");
  assert.equal(profile.fixtures["original-login-notices"].measurements["Primar-desktop"].httpsParticipant.host.width, 719.078125);
  assert.equal(profile.fixtures["original-exit-completeness"].closeButtonPixelSha256["Primar-desktop-presentation"], "dd27c7238d2e37357752aab815449302d466e918fa6e798178ac7cad70cd44cf");
});
for (const field of ["repository", "commit", "frontendLockSha256"]) test(`a foreign Source ${field} cannot qualify coordinates`, () => {
  assert.throws(() => validateOriginalVisualProfile({ ...profile, source: { ...source, [field]: "foreign" } }, source, environment));
});
for (const field of Object.keys(environment)) test(`a different ${field} cannot silently reuse the Linux visual reference`, () => {
  assert.throws(() => validateOriginalVisualProfile(profile, source, { ...environment, [field]: "foreign" }));
});
test("the launched browser version must match the actual Source capture", () => {
  const reference = { visualProfile: { browserVersion: profile.browserVersion } };
  assertOriginalVisualBrowser({ version: () => profile.browserVersion }, reference);
  assert.throws(() => assertOriginalVisualBrowser({ version: () => "foreign" }, reference));
});
test("visual overlays cannot remove controls, invent properties or rewrite behavior", () => {
  const base = { title: "Authored title", role: "dialog", boxes: [{ text: "Confirm", box: { width: 30, font: "16px" } }] };
  assert.throws(() => overlayOriginalVisuals(base, { title: "Different" }));
  assert.throws(() => overlayOriginalVisuals(base, { role: "different" }));
  assert.throws(() => overlayOriginalVisuals(base, { boxes: [] }));
  assert.throws(() => overlayOriginalVisuals(base, { invented: 2 }));
  assert.throws(() => overlayOriginalVisuals(base, { boxes: [{ text: "Different" }] }));
  const result = overlayOriginalVisuals(base, { boxes: [{ box: { width: 31 } }] });
  assert.equal(result.boxes[0].text, "Confirm"); assert.equal(result.boxes[0].box.width, 31);
});
test("an uncaptured visual case fails rather than falling back to Mac pixels", () => {
  const reference = { unqualifiedVisualCases: ["Primar-desktop-legacy"] };
  assert.throws(() => assertOriginalVisualCase(reference, "Primar-desktop-legacy"));
  assertOriginalVisualCase(reference, "Primar-desktop-presentation");
});
