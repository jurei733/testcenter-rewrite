import { spawn } from "node:child_process";

const connectionString = process.env.FIRST_SLICE_POSTGRES_URL;

if (!connectionString) {
  process.stdout.write(
    "Skipping Postgres integration tests because FIRST_SLICE_POSTGRES_URL is not set.\n"
  );
  process.exit(0);
}

const child = spawn(
  process.execPath,
  ["--test", "apps/api/dist/apps/api/src/integration.test.js"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      FIRST_SLICE_STORE: "postgres",
      FIRST_SLICE_POSTGRES_URL: connectionString
    }
  }
);

child.on("exit", code => {
  process.exit(code ?? 1);
});
