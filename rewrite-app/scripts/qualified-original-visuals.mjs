import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
const read = async name => JSON.parse(await readFile(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));
const qualifiedProvenance = await read("original-linux-chromium147-provenance");
const visualKeys = new Set(["x", "y", "width", "height", "font", "color", "background", "padding", "margin", "border",
  "borderRadius", "boxShadow", "transform", "gap", "radius", "cursor", "boxSizing", "lineHeight", "display", "verticalAlign", "overflow", "position"]);

/** Change only Source-measured visuals; behavioral values retain their original reference. */
export function overlayOriginalVisuals(base, overlay, path = []) {
  if (Array.isArray(overlay)) {
    assert.ok(Array.isArray(base)); assert.equal(overlay.length, base.length, `Lost reference elements at ${path.join("/")}`);
    return base.map((value, index) => overlayOriginalVisuals(value, overlay[index], [...path, String(index)]));
  }
  if (overlay && typeof overlay === "object") {
    assert.ok(base && typeof base === "object" && !Array.isArray(base));
    const result = structuredClone(base);
    for (const [key, value] of Object.entries(overlay)) {
      assert.ok(Object.hasOwn(base, key), `Unknown reference field ${[...path, key].join("/")}`);
      result[key] = overlayOriginalVisuals(base[key], value, [...path, key]);
    }
    return result;
  }
  const visualSize = ["logoSize", "iconSize"].includes(path.at(-2)) && typeof base === "number" && typeof overlay === "number";
  if (!visualKeys.has(path.at(-1)) && !visualSize && !path.includes("closeButtonPixelSha256")) {
    assert.deepEqual(overlay, base, `A visual profile cannot rewrite behavior at ${path.join("/")}`);
  }
  return overlay;
}
export function validateOriginalVisualProfile(profile, source, environment) {
  assert.equal(profile.version, 1); assert.deepEqual(profile.source, source);
  for (const [key, value] of Object.entries(environment)) assert.equal(profile[key], value, `Unqualified Original ${key}`);
  assert.deepEqual(profile.provenance, qualifiedProvenance);
  for (const family of ["entry", "dialogs", "starter"]) {
    assert.ok(Number.isSafeInteger(profile.provenance.archives[family].id));
    assert.match(profile.provenance.archives[family].sha256, /^[a-f0-9]{64}$/);
  }
}
export async function loadOriginalVisualReference(name) {
  assert.match(name, /^original-[a-z-]+$/);
  const base = await read(name);
  const headful = ["1", "true", "yes", "on"].includes(String(process.env.UI_SMOKE_HEADFUL || "").toLowerCase()) || process.env.CI !== "true";
  const macReviewToasts = name === "original-starter-review-toasts" && process.platform === "darwin" &&
    process.arch === "arm64" && !headful && !process.env.UI_SMOKE_BROWSER_CHANNEL;
  if (process.platform !== "linux" && !macReviewToasts) return base;
  const profile = await read("original-linux-chromium147");
  const source = await read("original-browser-source");
  const browserPackage = JSON.parse(await readFile(new URL("../node_modules/playwright/package.json", import.meta.url), "utf8"));
  const environment = { platform: process.platform, architecture: process.arch,
    nodeMajor: Number(process.versions.node.split(".")[0]), browserPackage: browserPackage.version, browserMode: headful ? "visible" : "headless" };
  assert.ok(!process.env.UI_SMOKE_BROWSER_CHANNEL, "The qualified reference uses the lockfile's Chromium, not an alternate browser channel.");
  assert.ok(Object.hasOwn(profile.fixtures, name), `No qualified Original visual fixture ${name}`);
  let qualification = profile;
  if (macReviewToasts) {
    qualification = await read("original-macos-arm64-starter-review-toasts");
    assert.equal(qualification.version, 1);
    assert.deepEqual(qualification.source, source);
    assert.deepEqual(profile.source, source);
    for (const [key, value] of Object.entries(environment)) assert.equal(qualification[key], value, `Unqualified Original ${key}`);
  } else {
    validateOriginalVisualProfile(profile, source, environment);
  }
  const reference = overlayOriginalVisuals(base, profile.fixtures[name]);
  if (macReviewToasts) {
    // Independent captures of all 18 macOS states matched these shared values.
    const statesHash = createHash("sha256").update(JSON.stringify(reference.states)).digest("hex");
    assert.equal(statesHash, qualification.referenceStatesSha256);
  }
  reference.visualProfile = { source: qualification.source, platform: qualification.platform, browserVersion: qualification.browserVersion,
    browserMode: qualification.browserMode, provenance: qualification.provenance };
  reference.unqualifiedVisualCases = profile.unqualifiedCases.filter(key => key.startsWith(`${name}/`)).map(key => key.slice(name.length + 1));
  console.log(`original_visual_reference=${name}/${qualification.platform}/${qualification.browserVersion}/${qualification.source.commit}`);
  return reference;
}
export function assertOriginalVisualBrowser(browser, reference) {
  if (reference.visualProfile) assert.equal(browser.version(), reference.visualProfile.browserVersion, "The measured Source and rewrite must use the exact same Chromium version.");
}
export function assertOriginalVisualCase(reference, key) {
  assert.ok(!reference.unqualifiedVisualCases?.includes(key), `The Original visual case ${key} still needs platform qualification.`);
}
