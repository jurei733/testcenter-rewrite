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

if (!connectionString) {
  if (process.env.CI === "true") {
    fail(
      "FIRST_SLICE_POSTGRES_URL is required for Postgres integration tests in CI."
    );
  }
  process.stdout.write(
    "Skipping Postgres integration tests because FIRST_SLICE_POSTGRES_URL is not set.\n"
  );
  process.exit(0);
}

if (!/^postgres(?:ql)?:\/\//.test(connectionString)) {
  fail(
    "FIRST_SLICE_POSTGRES_URL must be a postgres:// or postgresql:// connection string."
  );
}

process.stdout.write(
  `Running Postgres integration tests against ${redactConnectionString(connectionString)}\n`
);

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

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    child.kill(signal);
  });
}

child.on("error", error => {
  process.stderr.write(
    `Could not start Postgres integration test runner: ${error.message}\n`
  );
  process.exit(1);
});

child.on("exit", code => {
  process.exit(code ?? 1);
});
