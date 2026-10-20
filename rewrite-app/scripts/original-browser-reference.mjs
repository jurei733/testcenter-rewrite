import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, writeFile, mkdir, readdir, lstat, realpath } from "node:fs/promises";
import { resolve, join, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

export const originalBrowserSource = JSON.parse(await readFile(new URL("./fixtures/original-browser-source.json", import.meta.url), "utf8"));
const manifestName = "original-reference-manifest.json";
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const originalSettingsCatalogReference = JSON.parse(await readFile(new URL("../test-fixtures/original-testcenter/current-monitor-text-reference.json", import.meta.url), "utf8"));
const originalAssetDeletionReference = JSON.parse(await readFile(new URL("../test-fixtures/original-testcenter/current-asset-deletion-reference.json", import.meta.url), "utf8"));
export async function verifyOriginalAssetDeletionSource(root, reference = originalAssetDeletionReference) {
  assert.equal(reference.originalCommit, originalBrowserSource.commit);
  const paths = ["backend/src/dao/AssetDAO.class.php", "backend/src/controller/AssetController.class.php", "scripts/database/full.sql"];
  assert.deepEqual(reference.files.map(file => file.path), paths);
  const sources = {};
  for (const file of reference.files) {
    const bytes = await readFile(join(root, file.path));
    assert.equal(sha256(bytes), file.sha256, "Asset cascade references must retain the actual pinned Source bytes.");
    sources[file.path] = bytes.toString("utf8");
  }
  assert.ok(sources[paths[0]].includes(reference.deleteSql));
  assert.ok(sources[paths[2]].includes(reference.scopeType));
  assert.equal(reference.tables.length, 2);
  for (const table of reference.tables) assert.ok(sources[paths[2]].includes(table), "Execute actual Source DDL, including the assignment foreign key.");
}
export async function verifyOriginalSettingsSource(root, reference = originalSettingsCatalogReference) {
  assert.equal(reference.originalCommit, originalBrowserSource.commit);
  const catalog = reference.files.find(file => file.path === "definitions/testtaker/custom-texts.json");
  assert.ok(catalog, "The actual Original settings catalog is required.");
  assert.equal(sha256(catalog.source), catalog.sha256);
  assert.equal(sha256(await readFile(join(root,catalog.path))), catalog.sha256,
    "Settings labels, defaults and ordering must come from the pinned Source catalog.");
}
const originalAdministrationReference = JSON.parse(await readFile(new URL("./fixtures/original-administration-permissions.json", import.meta.url), "utf8"));
export async function verifyOriginalAdministrationSource(root, reference = originalAdministrationReference) {
  assert.equal(reference.version, 1); assert.equal(reference.repository, originalBrowserSource.repository);
  assert.equal(reference.commit, originalBrowserSource.commit);
  assert.equal(reference.sources.length, 2); assert.equal(new Set(reference.sources.map(item=>item.path)).size, 2);
  for (const item of reference.sources) {
    assert.match(item.path, /^frontend\/src\/app\/superadmin\/(?:users\/users|workspaces\/workspaces)\.component\.ts$/);
    const bytes = await readFile(join(root,item.path));
    assert.equal(sha256(bytes), item.sha256, "Administration references must retain the actual pinned Source file.");
    assert.ok(bytes.toString("utf8").includes(item.handler), "Never substitute a rewritten permission handler for Source.");
  }
}
const appCommit = () => {
  assert.match(process.env.GITHUB_SHA ?? "", /^[a-f0-9]{40}$/);
  return process.env.GITHUB_SHA;
};
export async function verifyOriginalSource(root) {
  const git = (...args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
  assert.equal(git("rev-parse", "HEAD"), originalBrowserSource.commit, "The Original checkout must be the pinned source revision.");
  assert.equal(git("status", "--porcelain", "--untracked-files=no"), "", "Never calibrate against edited Original sources.");
  const lock = await readFile(join(root, "frontend/package-lock.json"));
  assert.equal(sha256(lock), originalBrowserSource.frontendLockSha256, "Original dependencies must retain their pinned lockfile.");
  assert.equal(Number(process.versions.node.split(".")[0]), 22);
  await verifyOriginalAdministrationSource(root);
  await verifyOriginalSettingsSource(root);
  await verifyOriginalAssetDeletionSource(root);
}
async function filesUnder(root, directory = root) {
  assert.ok((await lstat(directory)).isDirectory(), "Reference paths must be real directories, never links.");
  const files = {};
  for (const name of (await readdir(directory)).sort()) {
    const file = join(directory, name), stat = await lstat(file);
    if (stat.isDirectory()) Object.assign(files, await filesUnder(root, file));
    else {
      assert.ok(stat.isFile(), "Reference artifacts reject links and special files.");
      const key = relative(root, file).split("\\").join("/");
      assert.ok(!isAbsolute(key) && !key.split("/").includes(".."));
      if (key !== manifestName) files[key] = sha256(await readFile(file));
    }
  }
  return files;
}
export async function packOriginalBuild(sourceRoot) {
  await verifyOriginalSource(sourceRoot);
  const root = join(sourceRoot, "frontend/dist/testcenter-frontend/browser");
  const files = await filesUnder(root);
  assert.ok(files["index.html"] && Object.keys(files).some(name => /^main-[\w-]+\.js$/.test(name)));
  const manifest = { version: 1, appCommit: appCommit(), source: originalBrowserSource,
    node: 22, platform: process.platform, architecture: process.arch, files };
  await writeFile(join(root, manifestName), JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}
export async function verifyOriginalBuild(root) {
  const manifest = JSON.parse(await readFile(join(root, manifestName), "utf8"));
  assert.equal(manifest.version, 1); assert.equal(manifest.appCommit, appCommit());
  assert.deepEqual(manifest.source, originalBrowserSource);
  assert.equal(manifest.node, Number(process.versions.node.split(".")[0]));
  assert.equal(manifest.platform, process.platform); assert.equal(manifest.architecture, process.arch);
  assert.deepEqual(await filesUnder(root), manifest.files, "Every compiled Original file must match the same-run producer manifest.");
  return manifest;
}
const task = (name, script, environment = {}, output = "exit.json") => ({ name, script, environment, output });
export const originalReferenceTasks = {
  entry: [
    task("system-check-welcome", "reference-original-system-check-welcome.mjs", {}, "welcome.json"),
    task("login", "reference-original-participant-login-focus.mjs", {}, "focus.json"),
    task("insecure-participant", "reference-original-participant-login-focus.mjs", { ORIGINAL_LOGIN_REFERENCE_INSECURE: "true" }, "focus.json"),
    task("insecure-admin", "reference-original-participant-login-focus.mjs", { ORIGINAL_LOGIN_REFERENCE_INSECURE: "true", ORIGINAL_LOGIN_REFERENCE_ENTRY: "admin" }, "focus.json"),
    task("header-login", "reference-original-participant-login-focus.mjs", { ORIGINAL_LOGIN_REFERENCE_HEADER: "true" }, "focus.json"),
    task("header-admin", "reference-original-participant-login-focus.mjs", { ORIGINAL_LOGIN_REFERENCE_HEADER: "true", ORIGINAL_LOGIN_REFERENCE_ENTRY: "admin" }, "focus.json"),
    task("header-starter", "reference-original-participant-login-focus.mjs", { ORIGINAL_LOGIN_REFERENCE_HEADER: "true", ORIGINAL_LOGIN_REFERENCE_STARTER: "true" }, "focus.json")
  ],
  dialogs: [
    task("exit", "reference-original-player-exit.mjs"),
    task("completeness", "reference-original-player-exit.mjs", { REFERENCE_COMPLETENESS: "true" }),
    task("legacy-completeness", "reference-original-player-exit.mjs", { REFERENCE_COMPLETENESS: "true", REFERENCE_LEGACY_PROGRESS: "true" }),
    task("runtime", "reference-original-runtime-error.mjs"),
    task("runtime-contract", "reference-original-runtime-error.mjs", { ORIGINAL_RUNTIME_CONTRACT: "true" }),
    task("version-missing", "reference-original-player-version-error.mjs", { ORIGINAL_PLAYER_VERSION_ERROR: "missing" }),
    task("version-unsupported", "reference-original-player-version-error.mjs", { ORIGINAL_PLAYER_VERSION_ERROR: "unsupported" })
  ],
  starter: [
    task("starter", "reference-original-starter.mjs", {}, "metrics.json"),
    task("paused", "reference-original-paused-exit.mjs"),
    task("paused-locked", "reference-original-paused-exit.mjs", { ORIGINAL_PAUSED_LOCK_ONLY: "true" }),
    task("advisories", "reference-original-starter-advisories.mjs")
  ]
};
function measurementOnly(value) {
  if (Array.isArray(value)) return value.map(measurementOnly);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !/requests|diagnostic|acknowledgements/i.test(key))
    .map(([key, item]) => [key, measurementOnly(item)]));
}
export function originalCaptureEnvironment(parent, item, root, directory) {
  const environment = { ...parent };
  for (const key of Object.keys(environment)) {
    if (/^(?:ORIGINAL_(?:LOGIN_REFERENCE|PLAYER_|STARTER_REFERENCE|RUNTIME_|PAUSED_)|REFERENCE_|UI_SMOKE_BROWSER_CHANNEL)/.test(key)) delete environment[key];
  }
  return { ...environment, ORIGINAL_LOGIN_REFERENCE_ROOT: root, ORIGINAL_STARTER_REFERENCE_ROOT: root, ORIGINAL_PLAYER_REFERENCE_ROOT: root,
    ORIGINAL_LOGIN_REFERENCE_COMMIT: originalBrowserSource.commit, ORIGINAL_PLAYER_REFERENCE_COMMIT: originalBrowserSource.commit,
    ORIGINAL_REFERENCE_CAPTURE_ONLY: "true", UI_SMOKE_ARTIFACT_DIR: directory, ...item.environment };
}
export async function captureOriginalReference(family) {
  assert.ok(Object.hasOwn(originalReferenceTasks, family), "Unknown Original reference family.");
  assert.equal(process.env.UI_SMOKE_HEADFUL, "true", "Source and rewrite visual qualification must use the same browser mode.");
  const root = await realpath(process.env.ORIGINAL_BROWSER_REFERENCE_ROOT);
  const manifest = await verifyOriginalBuild(root);
  const output = resolve(process.env.ORIGINAL_BROWSER_CAPTURE_DIR || `.ci/original-captures/${family}`);
  await mkdir(output, { recursive: true });
  const driverRoot = fileURLToPath(new URL("./", import.meta.url));
  const captures = [], failures = [];
  for (const item of originalReferenceTasks[family]) {
    const directory = join(output, item.name); await mkdir(directory, { recursive: true });
    const child = spawnSync(process.execPath, [join(driverRoot, item.script)], {
      stdio: "inherit", timeout: 600_000, env: originalCaptureEnvironment(process.env, item, root, directory)
    });
    if (child.status !== 0) failures.push({ task: item.name, status: child.status, error: child.error?.message });
    try {
      const data = JSON.parse(await readFile(join(directory, item.output), "utf8"));
      const capture = { task: item.name, success: child.status === 0, data: measurementOnly(data) };
      captures.push(capture);
      console.log(`SOURCE_REFERENCE_CAPTURE ${JSON.stringify(capture)}`);
    } catch (error) { failures.push({ task: item.name, error: error.message }); }
  }
  await verifyOriginalBuild(root);
  const browserPackage = JSON.parse(await readFile(new URL("../node_modules/playwright/package.json", import.meta.url), "utf8"));
  const { chromium } = await import("playwright");
  const decoder = await chromium.launch({ headless: true });
  try {
    const page = await decoder.newPage();
    for (const capture of captures) {
      capture.closeButtonPixelSha256 = {};
      const directory = join(output, capture.task);
      for (const file of await readdir(directory)) {
        if (!file.endsWith("-close.png")) continue;
        const bytes = await page.evaluate(async png => {
          const image = new Image(); image.src = `data:image/png;base64,${png}`; await image.decode();
          const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height;
          const context = canvas.getContext("2d"); context.drawImage(image, 0, 0);
          return [...context.getImageData(0, 0, canvas.width, canvas.height).data];
        }, (await readFile(join(directory, file))).toString("base64"));
        capture.closeButtonPixelSha256[file.slice(0, -10)] = sha256(Buffer.from(bytes));
      }
      console.log(`SOURCE_REFERENCE_PIXELS ${JSON.stringify({ task: capture.task, hashes: capture.closeButtonPixelSha256 })}`);
    }
    await writeFile(join(output, "index.json"), JSON.stringify({ manifest, family, browserPackage: browserPackage.version,
      browserVersion: decoder.version(), browserMode: "visible", captures, failures }, null, 2) + "\n");
  } finally { await decoder.close(); }
  assert.deepEqual(failures, [], "Original capture must finish every owned scenario without weakening its behavioral assertions.");
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, argument] = process.argv.slice(2);
  if (command === "verify-source") await verifyOriginalSource(resolve(argument));
  else if (command === "pack") await packOriginalBuild(resolve(argument));
  else if (command === "verify-build") await verifyOriginalBuild(resolve(argument));
  else if (command === "capture") await captureOriginalReference(argument);
  else throw new Error("Expected verify-source, pack, verify-build or capture.");
}
