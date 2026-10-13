import assert from "node:assert/strict";
import test from "node:test";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ContentRelease, SourcePackage, Tenant } from "@testcenter-rewrite-app/domain";
import { checkFileFirstSliceReadiness, createFileFirstSliceRepository, migrateFileFirstSliceStorage } from "./index.js";

const tenant: Tenant = { tenantId: "owned-tenant", tenantKey: "owned-tenant", displayName: "Committed", status: "active", createdAt: "2026-10-14T00:00:00.000Z" };
const source: SourcePackage = { sourcePackageId: "owned-source", tenantId: tenant.tenantId, workspaceId: "owned-workspace", fileName: "committed.zip", mediaType: "application/zip", contentStructure: null, sourceDocument: "Owned original payload", status: "uploaded", uploadedAt: tenant.createdAt };
const release: ContentRelease = { contentReleaseId: "owned-release", tenantId: tenant.tenantId, workspaceId: source.workspaceId, importJobId: "owned-import", releaseLabel: "Committed release", runtimeSnapshot: { bookletEntries: [], playerEntries: [] }, status: "staged", createdAt: tenant.createdAt, activatedAt: null };
const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "file-write-failures-")), file = join(root, "owned.json");
  const repository = createFileFirstSliceRepository(file);
  const cleanup = async () => {
    await chmod(root, 0o700);
    for (const directory of [file + ".objects", join(file + ".objects", "source-packages"), join(file + ".objects", "content-releases")]) {
      await chmod(directory, 0o700).catch(error => { if (error.code !== "ENOENT") throw error; });
    }
    await rm(root, { force: true, recursive: true });
  };
  return { root, file, repository, cleanup };
};
const selectedSourcePath = async (file: string) => {
  const document = JSON.parse(await readFile(file, "utf8"));
  const hash = document.externalizedCollections.sourcePackageHashes?.[source.sourcePackageId];
  return join(file + ".objects", "source-packages", encodeURIComponent(source.sourcePackageId) + (hash ? "." + hash : "") + ".json");
};

test("File readiness rejects a readable but non-writable manifest directory and recovers", async () => {
  const f = await fixture();
  try {
    await f.repository.saveTenant(tenant);
    await chmod(f.root, 0o500);
    await assert.rejects(checkFileFirstSliceReadiness(f.file), { code: "EACCES" });
    await chmod(f.root, 0o700);
    await checkFileFirstSliceReadiness(f.file);
  } finally { await f.cleanup(); }
});

test("File readiness checks the independently writable package directory", async () => {
  const f = await fixture(), directory = join(f.file + ".objects", "source-packages");
  try {
    await f.repository.saveSourcePackage(source);
    await chmod(directory, 0o500);
    await assert.rejects(checkFileFirstSliceReadiness(f.file), { code: "EACCES" });
    await chmod(directory, 0o700);
    await checkFileFirstSliceReadiness(f.file);
  } finally { await f.cleanup(); }
});

test("File readiness writes and renames probes without changing committed bytes or retaining probe files", async () => {
  const f = await fixture();
  try {
    await f.repository.saveSourcePackage(source);
    const sidecar = await selectedSourcePath(f.file), before = await readFile(f.file), bytes = await readFile(sidecar);
    const directories = [f.root, f.file + ".objects", join(f.file + ".objects", "source-packages")];
    const entries = await Promise.all(directories.map(path => readdir(path)));
    for (let i = 0; i < 10; i++) await checkFileFirstSliceReadiness(f.file);
    assert.deepEqual(await readFile(f.file), before);
    assert.deepEqual(await readFile(sidecar), bytes);
    assert.deepEqual(await Promise.all(directories.map(path => readdir(path))), entries);
  } finally { await f.cleanup(); }
});

test("a failed generic File mutation is absent from live reads and later independent commits", async () => {
  const f = await fixture();
  try {
    await f.repository.saveTenant(tenant);
    const before = await readFile(f.file);
    await chmod(f.root, 0o500);
    await assert.rejects(f.repository.saveTenant({ ...tenant, displayName: "Rejected" }), { code: "EACCES" });
    assert.deepEqual(await readFile(f.file), before);
    assert.deepEqual(await f.repository.getTenantByKey(tenant.tenantKey), tenant);
    await chmod(f.root, 0o700);
    await f.repository.saveTenant({ ...tenant, tenantId: "owned-other", tenantKey: "owned-other" });
    assert.deepEqual(await createFileFirstSliceRepository(f.file).getTenantByKey(tenant.tenantKey), tenant);
  } finally { await f.cleanup(); }
});

test("a rejected File package replacement preserves selected sidecar bytes, live state and reopened state", async () => {
  const f = await fixture();
  try {
    await f.repository.saveSourcePackage(source);
    const sidecar = await selectedSourcePath(f.file), before = await readFile(f.file), bytes = await readFile(sidecar);
    const oldEntries = await readdir(join(f.file + ".objects", "source-packages"));
    await chmod(f.root, 0o500);
    await assert.rejects(f.repository.saveSourcePackage({ ...source, fileName: "rejected.zip" }), { code: "EACCES" });
    assert.deepEqual(await readFile(f.file), before);
    assert.deepEqual(await readFile(sidecar), bytes);
    assert.deepEqual(await f.repository.getSourcePackageById(source.sourcePackageId), source);
    assert.deepEqual(await createFileFirstSliceRepository(f.file).getSourcePackageById(source.sourcePackageId), source);
    assert.deepEqual(await readdir(join(f.file + ".objects", "source-packages")), oldEntries);
    await chmod(f.root, 0o700);
    await f.repository.saveTenant(tenant);
    assert.deepEqual(await createFileFirstSliceRepository(f.file).getSourcePackageById(source.sourcePackageId), source);
  } finally { await f.cleanup(); }
});

test("missing committed File sidecars reject reopen instead of creating an empty repository", async () => {
  const f = await fixture();
  try {
    await f.repository.saveSourcePackage(source);
    const before = await readFile(f.file);
    await rm(await selectedSourcePath(f.file));
    await assert.rejects(createFileFirstSliceRepository(f.file).listTenants(), { code: "ENOENT" });
    assert.deepEqual(await readFile(f.file), before);
  } finally { await f.cleanup(); }
});

test("a changed committed File sidecar cannot silently replace its content", async () => {
  const f = await fixture();
  try {
    await f.repository.saveSourcePackage(source);
    await writeFile(await selectedSourcePath(f.file), JSON.stringify({ ...source, fileName: "uncommitted.zip" }));
    await assert.rejects(createFileFirstSliceRepository(f.file).getSourcePackageById(source.sourcePackageId), /hash mismatch/);
  } finally { await f.cleanup(); }
});

test("legacy version-one File migration fails without changing its manifest or sidecar and succeeds after recovery", async () => {
  const f = await fixture(), directory = join(f.file + ".objects", "source-packages"), legacy = join(directory, "owned-source.json");
  try {
    await mkdir(directory, { recursive: true });
    await writeFile(legacy, JSON.stringify(source));
    await writeFile(f.file, JSON.stringify({ sourcePackages: {}, contentReleases: {}, externalizedCollections: { version: 1, sourcePackageIds: [source.sourcePackageId], contentReleaseIds: [] } }));
    const before = await readFile(f.file), bytes = await readFile(legacy);
    assert.deepEqual(await createFileFirstSliceRepository(f.file).getSourcePackageById(source.sourcePackageId), source);
    await chmod(f.root, 0o500);
    await assert.rejects(migrateFileFirstSliceStorage(f.file), { code: "EACCES" });
    assert.deepEqual(await readFile(f.file), before);
    assert.deepEqual(await readFile(legacy), bytes);
    assert.deepEqual(await readdir(directory), ["owned-source.json"]);
    await chmod(f.root, 0o700);
    assert.equal((await migrateFileFirstSliceStorage(f.file)).migrated, true);
    assert.equal(JSON.parse(await readFile(f.file, "utf8")).externalizedCollections.version, 2);
    assert.equal((await migrateFileFirstSliceStorage(f.file)).migrated, false);
    assert.deepEqual(await createFileFirstSliceRepository(f.file).getSourcePackageById(source.sourcePackageId), source);
  } finally { await f.cleanup(); }
});

test("a failed version-one package replacement preserves the legacy sidecar and can be retried", async () => {
  const f = await fixture(), directory = join(f.file + ".objects", "source-packages"), legacy = join(directory, "owned-source.json");
  try {
    await mkdir(directory, { recursive: true });
    await writeFile(legacy, JSON.stringify(source));
    await writeFile(f.file, JSON.stringify({ externalizedCollections: { version: 1, sourcePackageIds: [source.sourcePackageId], contentReleaseIds: [] } }));
    const repository = createFileFirstSliceRepository(f.file), before = await readFile(f.file), bytes = await readFile(legacy);
    await chmod(f.root, 0o500);
    await assert.rejects(repository.saveSourcePackage({ ...source, fileName: "rejected.zip" }), { code: "EACCES" });
    assert.deepEqual(await readFile(f.file), before);
    assert.deepEqual(await readFile(legacy), bytes);
    assert.deepEqual(await repository.getSourcePackageById(source.sourcePackageId), source);
    await chmod(f.root, 0o700);
    const accepted = { ...source, fileName: "accepted.zip" };
    await repository.saveSourcePackage(accepted);
    assert.deepEqual(await createFileFirstSliceRepository(f.file).getSourcePackageById(source.sourcePackageId), accepted);
    assert.deepEqual(await readFile(legacy), bytes);
  } finally { await f.cleanup(); }
});

test("a rejected release replacement preserves the previous committed release after reopen", async () => {
  const f = await fixture();
  try {
    await f.repository.saveContentRelease(release);
    const before = await readFile(f.file), entries = await readdir(join(f.file + ".objects", "content-releases"));
    await chmod(f.root, 0o500);
    await assert.rejects(f.repository.saveContentRelease({ ...release, releaseLabel: "Rejected" }), { code: "EACCES" });
    assert.deepEqual(await readFile(f.file), before);
    assert.deepEqual(await f.repository.getContentReleaseById(release.contentReleaseId), release);
    assert.deepEqual(await createFileFirstSliceRepository(f.file).getContentReleaseById(release.contentReleaseId), release);
    assert.deepEqual(await readdir(join(f.file + ".objects", "content-releases")), entries);
    await chmod(f.root, 0o700);
    await f.repository.saveTenant(tenant);
    assert.deepEqual(await createFileFirstSliceRepository(f.file).getContentReleaseById(release.contentReleaseId), release);
  } finally { await f.cleanup(); }
});

test("successful File replacement selects new bytes while retaining the former immutable version", async () => {
  const f = await fixture();
  try {
    await f.repository.saveSourcePackage(source);
    const oldPath = await selectedSourcePath(f.file), oldBytes = await readFile(oldPath), oldStat = await stat(oldPath);
    const changed = { ...source, fileName: "new-version.zip" };
    await f.repository.saveSourcePackage(changed);
    assert.notEqual(await selectedSourcePath(f.file), oldPath);
    assert.deepEqual(await readFile(oldPath), oldBytes);
    assert.equal((await stat(oldPath)).mtimeMs, oldStat.mtimeMs);
    assert.deepEqual(await createFileFirstSliceRepository(f.file).getSourcePackageById(source.sourcePackageId), changed);
  } finally { await f.cleanup(); }
});
