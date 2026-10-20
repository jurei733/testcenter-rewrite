import assert from "node:assert/strict";
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
  if (process.platform !== "linux") return base;
  const profile = await read("original-linux-chromium147");
  const browserPackage = JSON.parse(await readFile(new URL("../node_modules/playwright/package.json", import.meta.url), "utf8"));
  const headful = ["1", "true", "yes", "on"].includes(String(process.env.UI_SMOKE_HEADFUL || "").toLowerCase()) || process.env.CI !== "true";
  validateOriginalVisualProfile(profile, await read("original-browser-source"), { platform: process.platform, architecture: process.arch,
    nodeMajor: Number(process.versions.node.split(".")[0]), browserPackage: browserPackage.version, browserMode: headful ? "visible" : "headless" });
  assert.ok(!process.env.UI_SMOKE_BROWSER_CHANNEL, "The qualified reference uses the lockfile's Chromium, not an alternate browser channel.");
  assert.ok(Object.hasOwn(profile.fixtures, name), `No qualified Original visual fixture ${name}`);
  const reference = overlayOriginalVisuals(base, profile.fixtures[name]);
  reference.visualProfile = { source: profile.source, platform: profile.platform, browserVersion: profile.browserVersion,
    browserMode: profile.browserMode, provenance: profile.provenance };
  reference.unqualifiedVisualCases = profile.unqualifiedCases.filter(key => key.startsWith(`${name}/`)).map(key => key.slice(name.length + 1));
  console.log(`original_visual_reference=${name}/${profile.platform}/${profile.browserVersion}/${profile.source.commit}`);
  return reference;
}
export function assertOriginalVisualBrowser(browser, reference) {
  if (reference.visualProfile) assert.equal(browser.version(), reference.visualProfile.browserVersion, "The measured Source and rewrite must use the exact same Chromium version.");
}
export function assertOriginalVisualCase(reference, key) {
  assert.ok(!reference.unqualifiedVisualCases?.includes(key), `The Original visual case ${key} still needs platform qualification.`);
}
