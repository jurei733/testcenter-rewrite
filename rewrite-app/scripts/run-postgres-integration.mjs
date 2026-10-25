import { spawn } from "node:child_process";
import { withPostgresTestScope } from "./postgres-test-scope.mjs";

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

try {
  new URL(connectionString);
} catch (error) {
  fail(`FIRST_SLICE_POSTGRES_URL is not a valid URL: ${error.message}`);
}

process.stdout.write(
  `Running Postgres integration tests against ${redactConnectionString(connectionString)}\n`
);

// A hosted service is fresh per job; local iteration must have the same empty
// starting state without clearing the configured database or existing schemas.
process.exitCode = await withPostgresTestScope(connectionString, scopedConnectionString => new Promise((resolve, reject) => {
  const child = spawn(
  process.execPath,
  ["--test", "--test-concurrency=1", "scripts/original-workspace-report-wire.test.mjs", "scripts/postgres-test-scope.test.mjs", "apps/api/dist/apps/api/src/integration.test.js", "scripts/workspace-file-catalog-api.test.mjs", "scripts/workspace-file-publication.test.mjs", "scripts/workspace-file-live-runtime.test.mjs", "scripts/content-release-activation.test.mjs", "scripts/application-settings-mutation.test.mjs", "scripts/application-asset-cascade.test.mjs", "scripts/application-asset-cascade-api.test.mjs", "scripts/participant-presence.test.mjs", "scripts/participant-assignment-runs.test.mjs", "scripts/participant-controller-activation.test.mjs", "scripts/participant-run-creation.test.mjs", "scripts/participant-run-creation-api.test.mjs", "scripts/participant-debug-runtime.test.mjs", "scripts/participant-controller-timer-resume.test.mjs", "scripts/participant-native-command.test.mjs", "scripts/participant-command-completion.test.mjs", "scripts/original-result-archive.test.mjs", "scripts/original-group-results.test.mjs", "scripts/original-group-deletion.test.mjs", "scripts/original-result-state.test.mjs", "scripts/original-participant-group.test.mjs", "scripts/original-login-binding.test.mjs", "scripts/original-test-identity.test.mjs", "scripts/original-person-identity.test.mjs", "scripts/original-login-protocol.test.mjs", "scripts/original-session.test.mjs", "scripts/original-person-content-migration.test.mjs", "scripts/system-check-report-selection.test.mjs", "scripts/xml-source-characters.test.mjs", "scripts/participant-run-mutation.test.mjs", "scripts/participant-progress-delivery.test.mjs", "scripts/participant-progress-api.test.mjs", "scripts/group-result-deletion-presence.test.mjs", "scripts/participant-starter-completeness.test.mjs", "scripts/participant-run-commands.test.mjs", "scripts/participant-command-application.test.mjs", "scripts/participant-command-api.test.mjs"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      FIRST_SLICE_STORE: "postgres",
      FIRST_SLICE_POSTGRES_URL: scopedConnectionString
    }
  }
);

  const forward = signal => child.kill(signal);
  const handlers = new Map(["SIGINT", "SIGTERM"].map(signal => [signal, () => forward(signal)]));
  for (const [signal, handler] of handlers) process.once(signal, handler);
  const cleanup = () => { for (const [signal, handler] of handlers) process.removeListener(signal, handler); };
  child.once("error", error => { cleanup(); reject(error); });
  child.once("close", code => { cleanup(); resolve(code ?? 1); });
}));
