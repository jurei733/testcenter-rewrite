import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const filePath = resolve(
  process.env.FILE_INTEGRATION_STATE_FILE ?? "./.data/integration-file.json"
);

await mkdir(dirname(filePath), { recursive: true });
await rm(filePath, { force: true });

process.stdout.write(`Running file-store integration tests against ${filePath}\n`);

const child = spawn(
  process.execPath,
  ["--test", "apps/api/dist/apps/api/src/integration.test.js"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      FIRST_SLICE_STORE: "file",
      FIRST_SLICE_FILE: filePath
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
    `Could not start file-store integration test runner: ${error.message}\n`
  );
  process.exit(1);
});

child.on("exit", code => {
  process.exit(code ?? 1);
});
