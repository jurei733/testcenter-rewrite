import { spawn } from "node:child_process";

const productionBoundary = ["1", "true", "yes", "on"].includes(
  String(process.env.REWRITE_APP_PRODUCTION_BOUNDARY ?? "false")
    .trim()
    .toLowerCase()
);
const bootstrapBoundary = ["1", "true", "yes", "on"].includes(
  String(process.env.REWRITE_APP_BOOTSTRAP_BOUNDARY ?? "false")
    .trim()
    .toLowerCase()
);
const composeArgs = [
  "compose",
  "-f",
  "docker-compose.postgres.yml",
  ...(productionBoundary
    ? ["-f", "docker-compose.production.yml"]
    : []),
  ...(bootstrapBoundary
    ? ["-f", "docker-compose.bootstrap.yml"]
    : [])
];

const run = (command, args, options = {}) =>
  new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      stdio: options.stdio ?? "inherit",
      env: options.env ?? process.env
    });
    let stdout = "";
    if (child.stdout) {
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", chunk => {
        stdout += chunk;
      });
    }
    child.once("error", reject);
    child.once("exit", code => {
      if (code === 0) {
        resolvePromise(stdout.trim());
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? 1}`));
    });
  });

const resolveGitValue = async args => {
  try {
    const value = await run("git", args, { stdio: ["ignore", "pipe", "inherit"] });
    return value || null;
  } catch {
    return null;
  }
};

const buildEnvironment = async () => {
  const commitSha =
    process.env.APP_BUILD_SHA ??
    (await resolveGitValue(["rev-parse", "--short=12", "HEAD"])) ??
    "local-compose";
  const buildTimestamp =
    process.env.APP_BUILD_TIMESTAMP ?? new Date().toISOString();

  return {
    ...process.env,
    APP_BUILD_SHA: commitSha,
    APP_BUILD_TIMESTAMP: buildTimestamp
  };
};

const args = process.argv.slice(2);
if (args.length === 0) {
  args.push("up", "--build");
}

await run("docker", [...composeArgs, ...args], {
  env: await buildEnvironment()
});
