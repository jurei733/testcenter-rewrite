import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, readdir, rename, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createWorkspaceSourcePackageReferenceRevision } from "@testcenter-rewrite-app/application";
import type { SourcePackage } from "@testcenter-rewrite-app/domain";
import { compactFileFirstSliceStorage, createFileFirstSliceRepository, createFileFirstSliceStorage, migrateFileFirstSliceStorage } from "./index.js";
import { fileStoreTemporaryIdentity, registerFileStoreAccess } from "./access.js";

const source: SourcePackage = { sourcePackageId: "owned-maintenance", tenantId: "owned", workspaceId: "owned", fileName: "first.zip", mediaType: "application/zip", contentStructure: null, sourceDocument: "Owned payload", status: "uploaded", uploadedAt: "2026-10-14T00:00:00.000Z" };
const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "file-maintenance-")), file = join(root, "owned.json");
  const repository = createFileFirstSliceRepository(file);
  await repository.saveSourcePackage(source);
  await repository.saveSourcePackage({ ...source, fileName: "second.zip" });
  return { root, file, repository, cleanup: () => rm(root, { recursive: true, force: true }) };
};

test("File compaction previews exact reclaimable versions without changing selected data", async () => {
  const f = await fixture();
  try {
    const before = await readFile(f.file), directory = join(f.file + ".objects", "source-packages"), entries = await readdir(directory);
    const result = await compactFileFirstSliceStorage(f.file);
    assert.equal(result.applied, false); assert.equal(result.candidateFiles, 1); assert.equal(result.removedFiles, 0);
    assert.ok(result.candidateBytes > 0); assert.deepEqual(await readdir(directory), entries); assert.deepEqual(await readFile(f.file), before);
  } finally { await f.cleanup(); }
});

test("File compaction removes old versions while preserving manifest bytes and the current reopened value", async () => {
  const f = await fixture();
  try {
    const before = await readFile(f.file);
    const result = await compactFileFirstSliceStorage(f.file, { apply: true });
    assert.equal(result.removedFiles, 1); assert.equal(result.reclaimedBytes, result.candidateBytes);
    assert.deepEqual(await readFile(f.file), before);
    assert.equal((await createFileFirstSliceRepository(f.file).getSourcePackageById(source.sourcePackageId))?.fileName, "second.zip");
    assert.equal((await compactFileFirstSliceStorage(f.file, { apply: true })).removedFiles, 0);
  } finally { await f.cleanup(); }
});

test("File compaction refuses a live API writer until storage shutdown releases its registration", async () => {
  const f = await fixture(); let storage;
  try {
    storage = await createFileFirstSliceStorage(f.file);
    await assert.rejects(compactFileFirstSliceStorage(f.file, { apply: true }), { code: "FILE_STORE_BUSY" });
    await assert.rejects(createFileFirstSliceStorage(f.file), { code: "FILE_STORE_BUSY" });
    await storage.shutdown(); await storage.shutdown();
    assert.equal((await compactFileFirstSliceStorage(f.file, { apply: true })).removedFiles, 1);
    await assert.rejects(storage.repository.saveSourcePackage(source), { code: "FILE_STORE_CLOSED" });
  } finally { await storage?.shutdown(); await f.cleanup(); }
});

for (const kind of ["reader", "maintenance"] as const) {
  test(`File compaction refuses another live ${kind} registration`, async () => {
    const f = await fixture(); let registration;
    try {
      registration = await registerFileStoreAccess(f.file, kind);
      await assert.rejects(compactFileFirstSliceStorage(f.file, { apply: true }), { code: "FILE_STORE_BUSY" });
      await registration.release();
      assert.equal((await compactFileFirstSliceStorage(f.file, { apply: true })).removedFiles, 1);
    } finally { await registration?.release(); await f.cleanup(); }
  });
}

test("File maintenance prevents new access and later permits the writer without changing its data", async () => {
  const f = await fixture(); let maintenance;
  try {
    maintenance = await registerFileStoreAccess(f.file, "maintenance");
    await assert.rejects(createFileFirstSliceStorage(f.file), { code: "FILE_STORE_BUSY" });
    await assert.rejects(createFileFirstSliceRepository(f.file).listTenants(), { code: "FILE_STORE_BUSY" });
    await maintenance.release();
    const storage = await createFileFirstSliceStorage(f.file);
    try { assert.equal((await storage.repository.getSourcePackageById(source.sourcePackageId))?.fileName, "second.zip"); }
    finally { await storage.shutdown(); }
  } finally { await maintenance?.release(); await f.cleanup(); }
});

test("File compaction leaves unrelated and malformed object files untouched", async () => {
  const f = await fixture(), directory = join(f.file + ".objects", "source-packages");
  try {
    const unrelated = join(directory, "unrelated.json"), broken = join(directory, "broken." + "a".repeat(64) + ".json");
    await writeFile(unrelated, "Owned unrelated file"); await writeFile(broken, "{broken");
    const result = await compactFileFirstSliceStorage(f.file, { apply: true });
    assert.equal(result.removedFiles, 1); assert.equal(result.ignoredPaths.length, 2);
    assert.equal(await readFile(unrelated, "utf8"), "Owned unrelated file"); assert.equal(await readFile(broken, "utf8"), "{broken");
  } finally { await f.cleanup(); }
});

test("File compaction preserves unknown process markers and refuses an uncertain namespace", async () => {
  const f = await fixture(), directory = f.file + ".actors", unknown = join(directory, "operator-note.txt");
  try {
    await writeFile(unknown, "Do not remove");
    await assert.rejects(compactFileFirstSliceStorage(f.file, { apply: true }), { code: "FILE_STORE_BUSY" });
    assert.equal(await readFile(unknown, "utf8"), "Do not remove"); await rm(unknown);
    const foreign = join(directory, `writer.${"f".repeat(64)}.${process.pid}.${randomUUID()}.lease`);
    await writeFile(foreign, "");
    await assert.rejects(compactFileFirstSliceStorage(f.file, { apply: true }), { code: "FILE_STORE_BUSY" });
    await stat(foreign);
  } finally { await f.cleanup(); }
});

test("File compaction requires an explicit upgrade of the version-two manifest", async () => {
  const f = await fixture();
  try {
    const document = JSON.parse(await readFile(f.file, "utf8")); document.externalizedCollections.version = 2;
    await writeFile(f.file, JSON.stringify(document));
    await assert.rejects(compactFileFirstSliceStorage(f.file, { apply: true }), /version-three/);
    assert.equal((await migrateFileFirstSliceStorage(f.file)).migrated, true);
    assert.equal((await compactFileFirstSliceStorage(f.file, { apply: true })).removedFiles, 1);
  } finally { await f.cleanup(); }
});

test("failed File storage initialization releases its writer identity before retry", async () => {
  const f = await fixture();
  try {
    const document = JSON.parse(await readFile(f.file, "utf8"));
    const path = join(f.file + ".objects", "source-packages", source.sourcePackageId + "." + document.externalizedCollections.sourcePackageHashes[source.sourcePackageId] + ".json");
    const bytes = await readFile(path); await rm(path);
    await assert.rejects(createFileFirstSliceStorage(f.file), { code: "ENOENT" });
    assert.deepEqual(await readdir(f.file + ".actors"), []);
    await writeFile(path, bytes);
    const storage = await createFileFirstSliceStorage(f.file);
    await storage.shutdown(); assert.deepEqual(await readdir(f.file + ".actors"), []);
  } finally { await f.cleanup(); }
});

test("File compaction never follows a collection directory symlink to remove another directory's data", async () => {
  const f = await fixture(), directory = join(f.file + ".objects", "source-packages"), target = join(f.root, "owned-other-directory");
  try {
    await rename(directory, target); await symlink(target, directory, "dir");
    const files = await readdir(target), bytes = await Promise.all(files.map(name => readFile(join(target, name))));
    const result = await compactFileFirstSliceStorage(f.file, { apply: true });
    assert.equal(result.removedFiles, 0); assert.ok(result.ignoredPaths.includes(directory));
    assert.deepEqual(await readdir(target), files);
    assert.deepEqual(await Promise.all(files.map(name => readFile(join(target, name)))), bytes);
  } finally { await f.cleanup(); }
});

test("File compaction accepts only literal true as authorization to apply", async () => {
  const f = await fixture();
  try {
    const result = await compactFileFirstSliceStorage(f.file, { apply: "false" as unknown as boolean });
    assert.equal(result.applied, false); assert.equal(result.removedFiles, 0); assert.equal(result.candidateFiles, 1);
  } finally { await f.cleanup(); }
});

test("File compaction preserves temporaries of a live process and a different store in the same directory", async () => {
  const f = await fixture();
  try {
    const identity = await fileStoreTemporaryIdentity(f.file), other = await fileStoreTemporaryIdentity(join(f.root, "other.json"));
    const dead = spawnSync(process.execPath, ["-e", "process.exit(0)"]); assert.equal(dead.status, 0);
    const active = join(f.root, `.pending.${identity.store}.${identity.namespace}.${process.pid}.${randomUUID()}.tmp`);
    const unrelated = join(f.root, `.pending.${other.store}.${other.namespace}.${dead.pid}.${randomUUID()}.tmp`);
    await writeFile(active, "Owned active temporary"); await writeFile(unrelated, "Owned other store temporary");
    assert.equal((await compactFileFirstSliceStorage(f.file, { apply: true })).removedFiles, 1);
    assert.equal(await readFile(active, "utf8"), "Owned active temporary");
    assert.equal(await readFile(unrelated, "utf8"), "Owned other store temporary");
  } finally { await f.cleanup(); }
});

test("guarded File deletion retains sidecars while a reader is active and prunes them after it closes", async () => {
  const f = await fixture(), directory = join(f.file + ".objects", "source-packages"); let reader;
  try {
    reader = await registerFileStoreAccess(f.file, "reader");
    const current = await f.repository.getSourcePackageById(source.sourcePackageId); assert.ok(current);
    assert.equal(await f.repository.deleteSourcePackageAggregate({ tenantId: source.tenantId, workspaceId: source.workspaceId,
      sourcePackageId: source.sourcePackageId, expectedImportJobIds: [], expectedContentReleaseIds: [],
      expectedWorkspaceSourcePackageReferenceRevision: createWorkspaceSourcePackageReferenceRevision({ sourcePackages: [current], activityEvents: [] }) }), true);
    assert.equal((await readdir(directory)).length, 2);
    await reader.release();
    await f.repository.saveTenant({ tenantId: "owned", tenantKey: "owned", displayName: "Owned", status: "active", createdAt: source.uploadedAt });
    assert.deepEqual(await readdir(directory), []);
  } finally { await reader?.release(); await f.cleanup(); }
});

test("concurrent File writer/maintenance enrollment cannot grant both accesses", async () => {
  const f = await fixture();
  try {
    for (let i = 0; i < 50; i++) {
      const outcomes = await Promise.allSettled([registerFileStoreAccess(f.file, "writer"), registerFileStoreAccess(f.file, "maintenance")]);
      try {
        assert.ok(outcomes.some(outcome => outcome.status === "rejected"), "A writer and maintenance must never both hold access.");
        for (const outcome of outcomes) if (outcome.status === "rejected") assert.equal(outcome.reason.code, "FILE_STORE_BUSY");
      } finally {
        for (const outcome of outcomes) if (outcome.status === "fulfilled") await outcome.value.release();
      }
    }
    assert.deepEqual(await readdir(f.file + ".actors"), []);
  } finally { await f.cleanup(); }
});
