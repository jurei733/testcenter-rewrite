import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rename, rm, mkdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { checkSqliteFirstSliceReadiness, createSqliteFirstSliceStorage } from "./index.js";

const tenant = { tenantId: "owned", tenantKey: "owned", displayName: "Before probe",
  status: "active" as const, createdAt: "2026-10-13T00:00:00.000Z" };
const fixture = async () => {
  const directory = await mkdtemp(join(tmpdir(), "sqlite-readiness-"));
  return { directory, file: join(directory, "owned.sqlite") };
};

test("SQLite readiness does not create a missing storage file or its directory", async () => {
  const { directory } = await fixture(), nested = join(directory, "absent"), file = join(nested, "owned.sqlite");
  try {
    await assert.rejects(checkSqliteFirstSliceReadiness(file), /storage file is missing/);
    await assert.rejects(stat(nested), { code: "ENOENT" });
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("SQLite readiness rejects an existing empty database without migrating it", async () => {
  const { directory, file } = await fixture();
  const empty = new DatabaseSync(file); empty.close();
  try {
    const before = await readFile(file);
    await assert.rejects(checkSqliteFirstSliceReadiness(file), /schema is not current/);
    assert.deepEqual(await readFile(file), before);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("SQLite readiness rolls back its real writes without changing schema, data or database bytes", async () => {
  const { directory, file } = await fixture(), storage = createSqliteFirstSliceStorage(file);
  try {
    await storage.repository.saveTenant(tenant); const before = await readFile(file);
    for (let i = 0; i < 20; i++) await storage.readinessCheck();
    await checkSqliteFirstSliceReadiness(file);
    assert.deepEqual(await readFile(file), before);
    assert.deepEqual(await storage.repository.getTenantByKey(tenant.tenantKey), tenant);
    const inspector = new DatabaseSync(file, { readOnly: true });
    try { assert.equal(inspector.prepare("SELECT name FROM sqlite_master WHERE name = '__testcenter_readiness_probe'").get(), undefined); }
    finally { inspector.close(); }
  } finally { await storage.shutdown(); await rm(directory, { recursive: true, force: true }); }
});

test("SQLite readiness checks the live writer rather than a separate writable connection", async t => {
  const { directory, file } = await fixture(); let live!: DatabaseSync;
  const original = DatabaseSync.prototype.exec;
  const hook = t.mock.method(DatabaseSync.prototype, "exec", function(this: DatabaseSync, sql: string) {
    live = this; return original.call(this, sql);
  });
  const storage = createSqliteFirstSliceStorage(file); hook.mock.restore();
  try {
    await storage.repository.saveTenant(tenant); live.exec("PRAGMA query_only = ON");
    assert.deepEqual(await storage.repository.getTenantByKey(tenant.tenantKey), tenant);
    await assert.rejects(storage.readinessCheck(), /readonly database/);
    await checkSqliteFirstSliceReadiness(file); // This other connection cannot prove the live writer is usable.
    live.exec("PRAGMA query_only = OFF"); await storage.readinessCheck();
    await storage.repository.saveTenant({ ...tenant, displayName: "Recovered" });
    assert.equal((await storage.repository.getTenantByKey(tenant.tenantKey))?.displayName, "Recovered");
  } finally { await storage.shutdown(); await rm(directory, { recursive: true, force: true }); }
});

test("SQLite readiness rejects a replaced database path while preserving both databases", async () => {
  const { directory, file } = await fixture(), previous = file + ".previous", storage = createSqliteFirstSliceStorage(file);
  let replacement: ReturnType<typeof createSqliteFirstSliceStorage> | undefined;
  try {
    await storage.repository.saveTenant(tenant); await rename(file, previous);
    replacement = createSqliteFirstSliceStorage(file);
    await replacement.repository.saveTenant({ ...tenant, displayName: "Replacement" });
    await checkSqliteFirstSliceReadiness(file);
    await assert.rejects(storage.readinessCheck(), /readonly database/);
    assert.deepEqual(await storage.repository.getTenantByKey(tenant.tenantKey), tenant);
    assert.equal((await replacement.repository.getTenantByKey(tenant.tenantKey))?.displayName, "Replacement");
  } finally { await storage.shutdown(); await replacement?.shutdown(); await rm(directory, { recursive: true, force: true }); }
});

test("SQLite readiness fails on an inaccessible journal and recovers without losing data", async () => {
  const { directory, file } = await fixture(), storage = createSqliteFirstSliceStorage(file);
  try {
    await storage.repository.saveTenant(tenant); const before = await readFile(file);
    await mkdir(file + "-journal");
    await assert.rejects(storage.readinessCheck(), /disk I\/O error|unable to open database file/);
    await rm(file + "-journal", { recursive: true });
    await storage.readinessCheck();
    assert.deepEqual(await readFile(file), before);
    assert.deepEqual(await storage.repository.getTenantByKey(tenant.tenantKey), tenant);
  } finally { await rm(file + "-journal", { recursive: true, force: true }); await storage.shutdown(); await rm(directory, { recursive: true, force: true }); }
});

test("SQLite storage shutdown closes its writer once and leaves durable data reopenable", async t => {
  const { directory, file } = await fixture(), storage = createSqliteFirstSliceStorage(file);
  const original = DatabaseSync.prototype.close; let closes = 0;
  const hook = t.mock.method(DatabaseSync.prototype, "close", function(this: DatabaseSync) { closes++; return original.call(this); });
  try {
    await storage.repository.saveTenant(tenant); await storage.shutdown(); await storage.shutdown();
    assert.equal(closes, 1); hook.mock.restore();
    await assert.rejects(storage.readinessCheck(), /not open/);
    await assert.rejects(storage.repository.getTenantByKey(tenant.tenantKey), /not open/);
    const reopened = createSqliteFirstSliceStorage(file);
    try { assert.deepEqual(await reopened.repository.getTenantByKey(tenant.tenantKey), tenant); await reopened.readinessCheck(); }
    finally { await reopened.shutdown(); }
  } finally { hook.mock.restore(); await storage.shutdown(); await rm(directory, { recursive: true, force: true }); }
});

test("a failed SQLite storage migration closes the rejected connection and preserves existing data", async t => {
  const { directory, file } = await fixture(), control = new DatabaseSync(file);
  control.exec(`CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL);
    CREATE TRIGGER own_startup_migration_failure BEFORE INSERT ON schema_migrations
      BEGIN SELECT RAISE(ABORT, 'owned startup migration failure'); END;
    CREATE TABLE owned_marker (marker TEXT); INSERT INTO owned_marker VALUES ('Exact preexisting data')`); control.close();
  const original = DatabaseSync.prototype.close; let closes = 0;
  const hook = t.mock.method(DatabaseSync.prototype, "close", function(this: DatabaseSync) { closes++; return original.call(this); });
  try {
    assert.throws(() => createSqliteFirstSliceStorage(file), /owned startup migration failure/);
    assert.equal(closes, 1); hook.mock.restore();
    const inspector = new DatabaseSync(file, { readOnly: true });
    try { assert.equal(inspector.prepare("SELECT marker FROM owned_marker").get()?.marker, "Exact preexisting data"); }
    finally { inspector.close(); }
  } finally { hook.mock.restore(); await rm(directory, { recursive: true, force: true }); }
});
