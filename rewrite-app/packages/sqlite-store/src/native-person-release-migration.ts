import type {DatabaseSync} from 'node:sqlite';

/** Run inside the migration transaction, with this connection's FK checks
 * temporarily disabled and legacy rename behavior enabled. This follows the
 * documented new-table/copy/drop/rename sequence, never renaming the old parent.
 * https://www.sqlite.org/lang_altertable.html#otheralter
 * Only person metadata is copied; Test payloads and credential rows stay put. */
export function migrateNativePersonContentRelease(database: DatabaseSync): void {
  const table = database.prepare("SELECT sql FROM sqlite_schema WHERE type='table' AND name='participant_sessions'").get();
  if (typeof table?.sql !== 'string') throw new Error('Participant session schema is missing.');
  const nativeCheck = 'CHECK (content_release_id IS NOT NULL OR (original_login_key IS NOT NULL AND length(original_login_key) > 0))';
  let sql = table.sql.replace(/\bcontent_release_id\s+TEXT\s+NOT\s+NULL\b/i, 'content_release_id TEXT');
  if (!sql.includes(nativeCheck)) {
    if (!/\boriginal_login_key\s+TEXT\b/i.test(sql)) throw new Error('Native person identity column is missing.');
    sql = sql.replace(/\boriginal_login_key\s+TEXT\b/i, 'original_login_key TEXT ' + nativeCheck);
  }
  const head = /^CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(?:"participant_sessions"|participant_sessions)(?=\s*\()/i;
  if (!head.test(sql)) throw new Error('Unsupported participant session schema.');
  sql = sql.replace(head, 'CREATE TABLE "__rewrite_native_person_release"');
  const objects = database.prepare("SELECT sql FROM sqlite_schema WHERE tbl_name='participant_sessions' AND type IN ('index','trigger') AND sql IS NOT NULL ORDER BY type,name").all();
  const count = () => Number(database.prepare('SELECT COUNT(*) AS count FROM participant_sessions').get()?.count);
  const before = count();
  database.exec(sql);
  database.exec('INSERT INTO __rewrite_native_person_release SELECT * FROM participant_sessions');
  database.exec('DROP TABLE participant_sessions');
  database.exec('ALTER TABLE __rewrite_native_person_release RENAME TO participant_sessions');
  for (const object of objects) {
    if (typeof object.sql !== 'string') throw new Error('Participant schema object is invalid.');
    database.exec(object.sql);
  }
  if (count() !== before) throw new Error('Native person schema migration lost parent metadata.');
}
