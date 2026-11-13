import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

// Fixed archive from the last version 57 commit, before migration 58.
// Build the historical schema itself. Reversing selected changes from the
// current schema can leave newer columns and tables in an invalid fixture.
const bytes = readFileSync(new URL("../../../../../../test-fixtures/sqlite/historical-migrations-v57.json", import.meta.url));
assert.equal(createHash("sha256").update(bytes).digest("hex"), "f7692ba1a740811086d91829974aa0a14d18722117165df29e144b18e20124f6");
const fixture: { sourceCommit: string; maximumVersion: number; migrations: { version: number; name: string; sql: string }[] } = JSON.parse(bytes.toString("utf8"));
assert.equal(fixture.sourceCommit, "fae90ea5b12161aa0da9267144faf21ee344e5c8");
assert.equal(fixture.maximumVersion, 57);
assert.deepEqual(fixture.migrations.map(row => row.version), Array.from({ length: 57 }, (_, index) => index + 1));

export function createHistoricalSqliteDatabase(path: string, version: 36 | 39 | 57): DatabaseSync {
  const database = new DatabaseSync(path);
  try {
    for (const migration of fixture.migrations.filter(row => row.version <= version)) {
      database.exec("BEGIN");
      database.exec(migration.sql);
      database.prepare("INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)")
        .run(migration.version, migration.name, "2026-08-03T00:00:00.000Z");
      database.exec("COMMIT");
    }
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}
