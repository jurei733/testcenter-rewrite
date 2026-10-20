import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "yaml";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const workflow = parse(read("../../.github/workflows/rewrite-app-ci.yml"));
const action = parse(read("../../.github/actions/rewrite-runtime/action.yml"));
const scripts = JSON.parse(read("../package.json")).scripts;
const baseline = JSON.parse(read("./fixtures/ci-coverage-baseline.json"));
const actionVersions = JSON.parse(read("./fixtures/ci-action-versions.json"));
function expand(command, trail = []) {
  return command.replace(/npm run ([\w:-]+)/g, (_, key) => {
    assert.ok(Object.hasOwn(scripts, key), `Missing npm script ${key}`);
    assert.ok(!trail.includes(key), `Recursive script ${key}`);
    return ["build", "build:core"].includes(key) ? "" : expand(scripts[key], [...trail, key]);
  });
}
const matrix = workflow.jobs["verify-memory-sqlite"].strategy.matrix.include;
const commands = [...matrix.map(item => item.command), ...Object.values(workflow.jobs).flatMap(job =>
  (job.steps ?? []).map(step => step.run).filter(run => typeof run === "string" && run.includes("npm run")))];
const leaves = commands.flatMap(command => expand(command.replace(/ 2>&1 \| tee[^\n]+/g, ""))
  .split("&&").map(value => value.trim().replace(/\s+/g, " ")).filter(Boolean));
const environmentPreludes = baseline.additional.flatMap(item => item.leaves).filter(leaf => leaf.endsWith("\\"));
function extendsExplicitTestFiles(previous, current) {
  const files = command => {
    if (!command.startsWith("node --test ")) return null;
    const paths = command.slice("node --test ".length).split(" ");
    return paths.length && paths.every(path => /^[\w./*-]+\.test\.(?:mjs|cjs|js)$/.test(path)) ? paths : null;
  };
  const before = files(previous), after = files(current);
  return Boolean(before && after && before.every(path => after.includes(path)));
}
for (const item of [...baseline.commands, ...baseline.additional]) test(`the complete prior ${item.check} qualification is retained`, () => {
  for (const leaf of item.leaves) {
    // Removing the first build leaves an environment-only prelude in the old
    // expansion. It still wraps the complete new npm child, so check the exact
    // prelude separately instead of mistaking it for an executable test.
    const retainedPrelude = leaf.endsWith("\\") && commands.some(command => command.replace(/\s+/g, " ").includes(leaf));
    const attachedPrelude = leaves.some(value => value.endsWith(leaf) &&
      environmentPreludes.includes(value.slice(0, -leaf.length).trim()));
    const expandedFiles = leaves.some(value => extendsExplicitTestFiles(leaf, value));
    assert.ok(leaves.includes(leaf) || retainedPrelude || attachedPrelude || expandedFiles, `Lost qualification: ${leaf}`);
  }
});
test("coverage may add explicit tests but cannot remove files or change test-runner flags", () => {
  const original = "node --test scripts/old.test.mjs scripts/other.test.mjs";
  assert.equal(extendsExplicitTestFiles(original, original + " scripts/new.test.mjs"), true);
  for (const changed of ["node --test scripts/old.test.mjs", original + " --test-skip-pattern=old",
    original.replace("--test", "--test --test-name-pattern=new"), original + " || true", "echo " + original]) {
    assert.equal(extendsExplicitTestFiles(original, changed), false);
  }
});
test("third-party actions are immutable and checkout never leaves a write credential", () => {
  const steps = [...Object.values(workflow.jobs).flatMap(job => job.steps ?? []), ...action.runs.steps];
  for (const step of steps.filter(step => step.uses && !step.uses.startsWith("./"))) {
    assert.match(step.uses, /^[\w.-]+\/[\w.-]+@[a-f0-9]{40}$/);
    const [repository, sha] = step.uses.split("@");
    const reference = actionVersions[repository.replace(/^actions\//, "")];
    assert.ok(reference, `Unreviewed action ${repository}`);
    assert.equal(sha, reference.sha); assert.equal(reference.runtime, "node24");
    for (const input of Object.keys(step.with ?? {})) assert.ok(reference.inputs.includes(input), `Unsupported ${repository} input ${input}`);
    if (step.uses.startsWith("actions/checkout@")) assert.equal(step.with["persist-credentials"], false);
  }
  assert.deepEqual(workflow.permissions, { contents: "read" });
  assert.equal(workflow.on.pull_request_target, undefined);
  assert.equal(workflow.on.workflow_run, undefined);
});
test("PR code runs once per update while main, merge queue and manual runs remain supported", () => {
  assert.deepEqual(workflow.on.push.branches, ["main"]);
  for (const key of ["pull_request", "merge_group", "workflow_dispatch"]) assert.ok(Object.hasOwn(workflow.on, key));
  for (const event of ["push", "pull_request"]) assert.ok(workflow.on[event].paths.includes(".github/actions/**"));
  assert.equal(workflow.concurrency["cancel-in-progress"], true);
});
test("test jobs use the same-run build and cannot compile a replacement production frontend", () => {
  assert.equal(workflow.jobs.build.steps.filter(step => step.run === "npm run build").length, 1);
  for (const id of ["unit", "quick", "verify-memory-sqlite", "verify-postgres", "verify-postgres-ui", "deployability", "docker-compose-release-smoke"]) {
    const job = workflow.jobs[id];
    if (["unit", "quick"].includes(id)) assert.equal(job.needs, "build");
    else assert.deepEqual(job.needs, ["build", "fast-feedback"]);
    const setup = job.steps.find(step => step.uses === "./.github/actions/rewrite-runtime");
    assert.equal(setup.with.prebuilt, "true");
  }
  for (const item of matrix) assert.ok(!/npm run (?:build|typecheck)(?:\s|$)/.test(item.command));
  const download = action.runs.steps.find(step => step.uses?.startsWith("actions/download-artifact@"));
  assert.equal(download.with.name, "rewrite-build-${{ github.sha }}");
  assert.equal(download.with["run-id"], undefined);
  assert.equal(download.with["github-token"], undefined);
  assert.equal(download.with["digest-mismatch"], "error");
  assert.ok(action.runs.steps.some(step => step.run === "node scripts/ci-build-artifact.mjs restore"));
});
test("fast feedback is independent of the long matrix and full acceptance rejects skipped/failed groups", () => {
  assert.deepEqual(workflow.jobs["fast-feedback"].needs, ["build", "typecheck", "dependencies", "unit", "quick"]);
  const gate = workflow.jobs.acceptance;
  assert.equal(gate.if, "always()");
  for (const id of Object.keys(workflow.jobs).filter(id => !["acceptance", "fast-feedback"].includes(id))) assert.ok(gate.needs.includes(id), id);
  assert.match(gate.steps[0].run, /result\.result !== "success"/);
});
test("Ops qualification is split into independent browser jobs without dropping its authenticated full flow", () => {
  for (const name of ["original-xml-schema", "deletion-confirmation", "delete-group-results", "admin-workspace-access", "admin-delete", "workspace-rename", "workspace-delete"]) {
    assert.equal(matrix.find(item => item.check === "ui-" + name)?.command, `npm run smoke:ui:${name}:built`);
  }
  assert.equal(matrix.find(item => item.check === "ui-ops").command, "npm run smoke:ui:operator-auth:built");
});
