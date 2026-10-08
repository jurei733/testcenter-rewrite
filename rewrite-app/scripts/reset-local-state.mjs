import { access, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = fileURLToPath(new URL("..", import.meta.url));
const localSqliteFile = resolve(
  appRoot,
  process.env.LOCAL_STATE_SQLITE_FILE ?? ".data/local.sqlite"
);
const localSqliteFiles = [
  localSqliteFile,
  `${localSqliteFile}-shm`,
  `${localSqliteFile}-wal`,
  `${localSqliteFile}-journal`
];

const removeIfPresent = async filePath => {
  try {
    await access(filePath);
  } catch {
    return "skipped";
  }

  try {
    await rm(filePath);
    return "removed";
  } catch (error) {
    process.stderr.write(
      `Failed to remove local state file '${filePath}': ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;
    return "failed";
  }
};

const removed = [];
const skipped = [];

for (const filePath of localSqliteFiles) {
  const result = await removeIfPresent(filePath);
  if (result === "removed") {
    removed.push(filePath);
  } else if (result === "skipped") {
    skipped.push(filePath);
  }
}

process.stdout.write(
  JSON.stringify(
    {
      reset: process.exitCode !== 1,
      removed,
      skipped
    },
    null,
    2
  ) + "\n"
);
