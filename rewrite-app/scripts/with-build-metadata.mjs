import { spawn } from "node:child_process";

const [, , command, ...args] = process.argv;

const runGit = gitArgs =>
  new Promise(resolve => {
    const child = spawn("git", gitArgs, {
      stdio: ["ignore", "pipe", "ignore"]
    });
    const chunks = [];
    child.stdout.on("data", chunk => chunks.push(chunk));
    child.once("error", () => resolve(null));
    child.once("close", code => {
      if (code !== 0) {
        resolve(null);
        return;
      }
      const output = Buffer.concat(chunks).toString("utf8").trim();
      resolve(output.length > 0 ? output : null);
    });
  });

if (!command) {
  console.error("Usage: node ./scripts/with-build-metadata.mjs <command> [...args]");
  process.exitCode = 1;
} else {
  const commitSha =
    process.env.APP_BUILD_SHA ?? (await runGit(["rev-parse", "--short=12", "HEAD"])) ?? "local";
  const buildTimestamp =
    process.env.APP_BUILD_TIMESTAMP ?? new Date().toISOString();

  const child = spawn(command, args, {
    stdio: "inherit",
    env: {
      ...process.env,
      APP_BUILD_SHA: commitSha,
      APP_BUILD_TIMESTAMP: buildTimestamp
    }
  });

  child.once("error", error => {
    console.error(error.message);
    process.exitCode = 1;
  });
  child.once("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exitCode = code ?? 1;
  });
}
