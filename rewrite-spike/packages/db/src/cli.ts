import {
  createDatabasePool,
  defaultDatabaseUrl,
  runMigrations
} from "./index.js";

const main = async (): Promise<void> => {
  const pool = createDatabasePool();

  try {
    const result = await runMigrations(pool);
    const appliedLabel = result.appliedVersions.length > 0
      ? result.appliedVersions.join(", ")
      : "none";

    console.log(`rewrite-spike db migrated against ${process.env.DATABASE_URL ?? defaultDatabaseUrl}`);
    console.log(`rewrite-spike db applied migrations: ${appliedLabel}`);
  } finally {
    await pool.end();
  }
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exit(1);
});
