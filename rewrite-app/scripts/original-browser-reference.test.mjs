import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { verifyOriginalBuild, originalBrowserSource, originalReferenceTasks, originalCaptureEnvironment } from "./original-browser-reference.mjs";
const digest = text => createHash("sha256").update(text).digest("hex");
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "original-build-policy-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const previous = process.env.GITHUB_SHA;
  process.env.GITHUB_SHA = "a".repeat(40);
  t.after(() => { if (previous === undefined) delete process.env.GITHUB_SHA; else process.env.GITHUB_SHA = previous; });
  await writeFile(join(root, "index.html"), "owned original index");
  await mkdir(join(root, "assets"));
  await writeFile(join(root, "assets/font.woff2"), "owned font bytes");
  await writeFile(join(root, "assets/.browserslistrc"), "owned browser targets");
  const manifest = { version: 1, appCommit: process.env.GITHUB_SHA, source: originalBrowserSource,
    node: 22, platform: process.platform, architecture: process.arch,
    files: { "assets/.browserslistrc": digest("owned browser targets"), "assets/font.woff2": digest("owned font bytes"), "index.html": digest("owned original index") } };
  const save = () => writeFile(join(root, "original-reference-manifest.json"), JSON.stringify(manifest));
  await save(); return { root, manifest, save };
}
test("a same-run Original build verifies actual compiled files and nested assets", async t => {
  const f = await fixture(t); assert.deepEqual(await verifyOriginalBuild(f.root), f.manifest);
});
for (const [field, value] of [["version", 2], ["appCommit", "b".repeat(40)], ["node", 24], ["platform", "foreign"], ["architecture", "foreign"]]) {
  test(`a foreign ${field} cannot supply an Original reference`, async t => {
    const f = await fixture(t); f.manifest[field] = value; await f.save();
    await assert.rejects(verifyOriginalBuild(f.root));
  });
}
for (const field of ["repository", "commit", "frontendLockSha256"]) test(`Original ${field} is pinned independently of the consuming branch`, async t => {
  const f = await fixture(t); f.manifest.source = { ...originalBrowserSource, [field]: "foreign" }; await f.save();
  await assert.rejects(verifyOriginalBuild(f.root));
});
for (const change of ["corrupt", "extra", "missing", "symlink", "directory-link"]) test(`Original reference rejects ${change} filesystem content`, async t => {
  const f = await fixture(t);
  if (change === "corrupt") await writeFile(join(f.root, "assets/font.woff2"), "changed bytes");
  if (change === "extra") await writeFile(join(f.root, "extra.html"), "unexpected");
  if (change === "missing") await rm(join(f.root, "index.html"));
  if (change === "symlink") { await rm(join(f.root, "index.html")); await symlink("assets/font.woff2", join(f.root, "index.html")); }
  if (change === "directory-link") await symlink("assets", join(f.root, "linked-assets"));
  await assert.rejects(verifyOriginalBuild(f.root));
});
test("capture tasks cover each renderer family without duplicate tasks or a rewrite driver", async () => {
  assert.deepEqual(Object.keys(originalReferenceTasks), ["entry", "dialogs", "starter"]);
  const tasks = Object.values(originalReferenceTasks).flat();
  assert.equal(tasks.length, 18); assert.equal(new Set(tasks.map(task => task.name)).size, tasks.length);
  for (const task of tasks) {
    assert.match(task.script, /^reference-original-[\w-]+\.mjs$/);
    await readFile(new URL(task.script, import.meta.url));
  }
});
test("the capture family cannot inherit a single-case selector, unrelated scenario or alternate browser", () => {
  const parent = { ORIGINAL_RUNTIME_CONTRACT: "true", ORIGINAL_PAUSED_LOCK_ONLY: "true", ORIGINAL_RUNTIME_COMMAND_OVERLAP: "pending-pause",
    REFERENCE_SINGLE: "true", REFERENCE_COMPLETENESS: "true", ORIGINAL_LOGIN_REFERENCE_INSECURE: "true", ORIGINAL_PLAYER_VERSION_ERROR: "unsupported", UI_SMOKE_BROWSER_CHANNEL: "foreign",
    UI_SMOKE_HEADFUL: "true", CI: "true" };
  const environment = originalCaptureEnvironment(parent, originalReferenceTasks.entry.find(task => task.name === "login"), "/owned/source", "/owned/evidence");
  for (const key of Object.keys(parent).filter(key => !["UI_SMOKE_HEADFUL", "CI"].includes(key))) assert.equal(environment[key], undefined, key);
  assert.equal(environment.CI, "true"); assert.equal(environment.UI_SMOKE_HEADFUL, "true");
  assert.equal(environment.ORIGINAL_LOGIN_REFERENCE_ROOT, "/owned/source");
  assert.equal(environment.ORIGINAL_REFERENCE_CAPTURE_ONLY, "true");
  const selected = originalCaptureEnvironment(parent, originalReferenceTasks.entry.find(task => task.name === "insecure-admin"), "/owned/source", "/owned/evidence");
  assert.equal(selected.ORIGINAL_LOGIN_REFERENCE_INSECURE, "true"); assert.equal(selected.ORIGINAL_LOGIN_REFERENCE_ENTRY, "admin");
});
