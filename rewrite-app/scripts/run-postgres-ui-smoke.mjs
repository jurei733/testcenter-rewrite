import { spawn } from "node:child_process";

const connectionString = process.env.FIRST_SLICE_POSTGRES_URL;

const fail = message => {
  process.stderr.write(`${message}\n`);
  process.exit(1);
};

const redactConnectionString = input => {
  try {
    const url = new URL(input);
    if (url.username) {
      url.username = "REDACTED";
    }
    if (url.password) {
      url.password = "REDACTED";
    }
    return url.toString();
  } catch {
    return input.replace(/\/\/([^:@/]+)(?::[^@/]+)?@/, "//REDACTED:REDACTED@");
  }
};

const run = (label, args, env) =>
  new Promise((resolvePromise, reject) => {
    process.stdout.write(`${label}\n`);
    const child = spawn(process.execPath, args, {
      stdio: "inherit",
      env
    });

    for (const signal of ["SIGINT", "SIGTERM"]) {
      process.once(signal, () => {
        child.kill(signal);
      });
    }

    child.once("error", error => {
      reject(new Error(`${label} failed to start: ${error.message}`));
    });

    child.once("exit", code => {
      if (code === 0) {
        resolvePromise(undefined);
        return;
      }
      reject(new Error(`${label} exited with code ${code ?? 1}`));
    });
  });

if (!connectionString) {
  if (process.env.CI === "true") {
    fail("FIRST_SLICE_POSTGRES_URL is required for Postgres UI smoke in CI.");
  }
  process.stdout.write(
    "Skipping Postgres UI smoke because FIRST_SLICE_POSTGRES_URL is not set.\n"
  );
  process.exit(0);
}

if (!/^postgres(?:ql)?:\/\//.test(connectionString)) {
  fail(
    "FIRST_SLICE_POSTGRES_URL must be a postgres:// or postgresql:// connection string."
  );
}

const smokeEnv = {
  ...process.env,
  FIRST_SLICE_STORE: "postgres",
  FIRST_SLICE_POSTGRES_URL: connectionString,
  FIRST_SLICE_OPERATOR_AUTH_REQUIRED:
    process.env.FIRST_SLICE_OPERATOR_AUTH_REQUIRED ?? "true"
};

process.stdout.write(
  `Running Postgres UI smoke against ${redactConnectionString(connectionString)}\n`
);

try {
  await run("Migrating Postgres schema for UI smoke", [
    "./scripts/storage-admin.mjs",
    "migrate"
  ], smokeEnv);
  await run("Running protected Postgres UI smoke", [
    "./scripts/smoke-ui.mjs"
  ], smokeEnv);
} catch (error) {
  fail(error.message);
}
