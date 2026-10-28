import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildArtifact, buildRoots, validateArchivePaths, validateManifest } from "./ci-build-artifact.mjs";

const commit = "a".repeat(40);
const expected = { commit, lockSha256: "b".repeat(64), nodeMajor: "22", platform: "linux", arch: "x64" };
for (const field of Object.keys(expected)) test(`a different ${field} cannot reuse a CI build`, () => {
  assert.throws(() => validateManifest({ version: 1, archiveSha256: "c".repeat(64), ...expected, [field]: "other" }, expected), new RegExp(field));
});
for (const path of ["../outside", "/tmp/outside", "dist/../../outside", "dist\\outside", "node_modules/file", ".data/participants", "packages/domain/src/file"]) {
  test(`CI archive rejects the undeclared or escaping path ${path}`, () => assert.throws(() => validateArchivePaths([path])));
}
test("CI archive accepts only declared build/schema roots and descendants", () => validateArchivePaths(buildRoots.flatMap(root => [root, root + "/nested/file.js"])));
const fixture = async action => {
  const directory = await mkdtemp(join(tmpdir(), "owned-ci-build-")), root = join(directory, "checkout"), archive = join(directory, "artifact");
  try {
    for (const path of buildRoots) await mkdir(join(root, path), { recursive: true });
    await writeFile(join(root, "package-lock.json"), '{"lockfileVersion":3}');
    await writeFile(join(root, "dist", "owned.js"), "export const owned = true;");
    await buildArtifact("pack", root, archive, commit);
    await action({ root, archive });
  } finally { await rm(directory, { recursive: true, force: true }); }
};
test("an actual archive roundtrip restores the exact compiled bytes", () => fixture(async ({ root, archive }) => {
  await rm(join(root, "dist"), { recursive: true });
  await buildArtifact("restore", root, archive, commit);
  assert.equal(await readFile(join(root, "dist", "owned.js"), "utf8"), "export const owned = true;");
}));
test("a stale commit cannot restore otherwise valid compiled bytes", () => fixture(async ({ root, archive }) => {
  await assert.rejects(buildArtifact("restore", root, archive, "d".repeat(40)), /commit mismatch/);
}));
test("a changed lockfile cannot restore compiled bytes", () => fixture(async ({ root, archive }) => {
  await writeFile(join(root, "package-lock.json"), '{"lockfileVersion":2}');
  await assert.rejects(buildArtifact("restore", root, archive, commit), /lockSha256 mismatch/);
}));
test("a corrupted archive fails before extraction", () => fixture(async ({ root, archive }) => {
  await writeFile(join(archive, "build.tar.gz"), "damaged bytes");
  await assert.rejects(buildArtifact("restore", root, archive, commit), /digest mismatch/);
}));
test("a checkout symlink cannot redirect build extraction outside the checkout", () => fixture(async ({ root, archive }) => {
  await rm(join(root, "dist"), { recursive: true });
  await symlink(archive, join(root, "dist"));
  await assert.rejects(buildArtifact("restore", root, archive, commit), /Unsafe CI build destination/);
}));
test("a build containing a symlink cannot be restored", () => fixture(async ({ root, archive }) => {
  await symlink("../package-lock.json", join(root, "dist", "outside"));
  await buildArtifact("pack", root, archive, commit);
  await assert.rejects(buildArtifact("restore", root, archive, commit), /link or special file/);
}));
