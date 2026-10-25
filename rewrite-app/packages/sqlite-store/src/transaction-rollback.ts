import type {DatabaseSync} from 'node:sqlite';

export function rollbackAfterFailure(database: DatabaseSync, error: unknown): never {
  try {
    database.exec("ROLLBACK");
  } catch (rollbackError) {
    // SQLite can already have rolled back the entire transaction after FULL,
    // IOERR or a ROLLBACK conflict. Retain the primary failure for diagnostics
    // and retry instead of replacing it with "no transaction is active".
    if (!(rollbackError instanceof Error &&
      rollbackError.message === "cannot rollback - no transaction is active")) {
      const message = (failure: unknown) => failure instanceof Error ? failure.message : String(failure);
      throw new AggregateError([error, rollbackError],
        `SQLite transaction failed (${message(error)}); rollback failed (${message(rollbackError)}).`,
        { cause: error });
    }
  }
  throw error;
}
