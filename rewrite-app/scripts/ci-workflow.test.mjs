import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { parse } from "yaml";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const workflow = parse(read("../../.github/workflows/rewrite-app-ci.yml"));
const action = parse(read("../../.github/actions/rewrite-runtime/action.yml"));
const scripts = JSON.parse(read("../package.json")).scripts;
const baseline = JSON.parse(read("./fixtures/ci-coverage-baseline.json"));
const actionVersions = JSON.parse(read("./fixtures/ci-action-versions.json"));
test("focused asset iteration retains mandatory unit and real PostgreSQL qualification", () => {
  const suites = ["scripts/application-asset-cascade.test.mjs", "scripts/application-asset-cascade-api.test.mjs"];
  const postgres = read("./run-postgres-integration.mjs");
  for (const suite of suites) {
    assert.ok(scripts["test:unit:built"].split(/\s+/).includes(suite));
    assert.ok(postgres.includes(JSON.stringify(suite)));
    assert.ok(scripts["test:application-assets:built"].split(/\s+/).includes(suite));
  }
  assert.equal(scripts["test:application-assets"], "npm run build:core && npm run test:application-assets:built");
  assert.ok(scripts["test:application-assets:built"].includes("scripts/original-settings-controller.test.mjs"));
});
function expand(command, trail = []) {
  return command.replace(/npm run ([\w:-]+)/g, (_, key) => {
    assert.ok(Object.hasOwn(scripts, key), `Missing npm script ${key}`);
    assert.ok(!trail.includes(key), `Recursive script ${key}`);
    return ["build", "build:core"].includes(key) ? "" : expand(scripts[key], [...trail, key]);
  });
}
const matrix = workflow.jobs["verify-memory-sqlite"].strategy.matrix.include;
const commands = Object.values(workflow.jobs).flatMap(job => [
  ...(job.strategy?.matrix?.include ?? []).map(item => item.command).filter(command => typeof command === "string"),
  ...(job.steps ?? []).map(step => step.run).filter(run => typeof run === "string" && run.includes("npm run"))
]);
const leaves = commands.flatMap(command => expand(command.replace(/ 2>&1 \| tee[^\n]+/g, ""))
  .split("&&").map(value => value.trim().replace(/\s+/g, " ")).filter(Boolean));
const environmentPreludes = baseline.additional.flatMap(item => item.leaves).filter(leaf => leaf.endsWith("\\"));
test("Quick logs retain an upstream test failure instead of reporting tee success", () => {
  const step = workflow.jobs.quick.steps.find(step => step.run?.includes("| tee"));
  assert.equal(step.shell, "bash", "GitHub's implicit bash -e shell does not enable pipefail");
  // GitHub's explicit bash shell is bash --noprofile --norc -e -o pipefail.
  // Reproduce a failing test piped through the exact logging command without
  // invoking the full browser suite or depending on its eventual runtime.
  const command = step.run.replace("${{ matrix.command }}", "(echo owned-failure; exit 37)")
    .replace("xvfb-run --auto-servernum ", "")
    .replace('"$RUNNER_TEMP/rewrite-ui-quick.log"', "/dev/null");
  const result = spawnSync("bash", ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", command], { encoding: "utf8" });
  assert.equal(result.status, 37); assert.match(result.stdout, /owned-failure/);
  const implicit = spawnSync("bash", ["-e", "-c", command], { encoding: "utf8" });
  assert.equal(implicit.status, 0, "The old implicit shell must reproduce the false green");
  const legacy = 'bash --noprofile --norc -e -o pipefail -c "exit 37" 2>&1 | tee /dev/null';
  assert.equal(spawnSync("bash", ["-e", "-c", legacy]).status, 0,
    "An inner pipefail bash cannot fix the historical outer logger pipeline");
  assert.equal(spawnSync("bash", ["-e", "-o", "pipefail", "-c", legacy]).status, 37);
});
test("all 28 browser scenarios run once across fast and extended shards, with complete acceptance requiring both", () => {
  const quick = workflow.jobs.quick;
  const extended = workflow.jobs["quick-extended"];
  const shards = [...quick.strategy.matrix.include, ...extended.strategy.matrix.include];
  assert.equal(quick.strategy["fail-fast"], false);
  assert.equal(extended.strategy["fail-fast"], false);
  assert.equal(extended.strategy["max-parallel"], 4, "Long prefix journeys must leave capacity for Postgres and the broad matrix");
  assert.deepEqual([...new Set(shards.map(item => item.group))], ["entry", "system-check", "participant", "content"]);
  assert.equal(shards.length, 28);
  assert.equal(new Set(shards.map(item => item.check)).size, shards.length);
  const split = command => expand(command).split("&&").map(value => value.trim()).filter(Boolean);
  const complete = split("npm run ci:browser:quick:built");
  const distributed = shards.flatMap(item => split(item.command));
  assert.deepEqual([...distributed].sort(), [...complete].sort());
  assert.equal(new Set(distributed).size, distributed.length, "Quick scenarios must not be duplicated across shards");
  for (const group of ["entry", "system-check", "participant", "content"]) {
    assert.deepEqual(shards.filter(item => item.group === group).flatMap(item => split(item.command)).sort(),
      split(`npm run ci:browser:quick:${group}:built`).sort());
  }
  for (const tier of [quick, extended]) {
    const execution = tier.steps.find(step => step.run?.includes("| tee"));
    assert.equal(execution.run, 'xvfb-run --auto-servernum ${{ matrix.command }} 2>&1 | tee "$RUNNER_TEMP/rewrite-ui-quick.log"');
    assert.equal(execution.shell, "bash");
    assert.equal(tier.env.UI_SMOKE_HEADFUL, "true", "Source visual measurements use a visible Chromium renderer");
    const log = tier.steps.find(step => step.name === "Retain failed Quick browser log");
    assert.equal(log.if, "failure()"); assert.match(log.with.name, /matrix\.check/);
    const browserArtifacts = execution.env.UI_SMOKE_ARTIFACT_DIR;
    assert.equal(browserArtifacts, "${{ runner.temp }}/rewrite-ui-artifacts");
    assert.ok(log.with.path.includes(browserArtifacts + "/"));
    assert.ok(log.with.path.includes("rewrite-ui-quick.log"));
  }
  assert.ok(workflow.jobs["fast-feedback"].needs.includes("quick"));
  assert.ok(workflow.jobs.acceptance.needs.includes("quick"));
  assert.ok(workflow.jobs.acceptance.needs.includes("quick-extended"));
});
test("the early browser set is bounded and retains real authentication, isolation, Start restoration and Systemcheck", () => {
  assert.deepEqual(workflow.jobs.quick.strategy.matrix.include.map(item=>item.check).sort(),
    ["bug-report","original-login","original-login-protected","original-admin-login","proof-of-work","system-check","participant-variant","ib-player"].sort());
  assert.equal(workflow.jobs["quick-extended"].strategy.matrix.include.length,20);
  assert.deepEqual(workflow.jobs["quick-extended"].needs,["build","fast-feedback"]);
  assert.ok(!workflow.jobs["fast-feedback"].needs.includes("quick-extended"));
});
test("a green early checkpoint cannot certify missing, cancelled or failed extended qualification", () => {
  const gate = workflow.jobs.acceptance;
  const results = Object.fromEntries(gate.needs.map(name=>[name,{result:"success"}]));
  const execute = values => spawnSync("bash",["-e","-o","pipefail","-c",gate.steps[0].run],{
    encoding:"utf8",env:{...process.env,RESULTS:JSON.stringify(values)}
  });
  assert.equal(execute(results).status,0);
  for (const result of ["skipped","cancelled","failure"]) {
    const outcome=execute({...results,"quick-extended":{result}});
    assert.equal(outcome.status,1); assert.match(outcome.stderr,new RegExp(`quick-extended: ${result}`));
  }
});
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
test("Linux source reference uses an unchanged commit-pinned Original and same-run verified artifact", () => {
  const source = JSON.parse(read("./fixtures/original-browser-source.json"));
  const producer = workflow.jobs["original-reference-build"];
  const checkout = producer.steps.find(step => step.with?.repository);
  assert.equal(checkout.with.repository, source.repository); assert.equal(checkout.with.ref, source.commit);
  assert.ok(producer.steps.some(step => step.run?.includes("verify-source")));
  assert.ok(producer.steps.some(step => step.run?.includes(" pack ")));
  const upload = producer.steps.find(step => step.uses?.startsWith("actions/upload-artifact@"));
  assert.equal(upload.with["include-hidden-files"], true, "The official compiled assets include .browserslistrc; its digest must survive upload.");
  const consumer = workflow.jobs["original-browser-reference"];
  assert.deepEqual(consumer.needs, ["build", "original-reference-build"]);
  assert.deepEqual(consumer.strategy.matrix.family, ["entry", "dialogs", "starter"]);
  const download = consumer.steps.find(step => step.uses?.startsWith("actions/download-artifact@"));
  assert.equal(download.with.name, "original-reference-${{ github.sha }}");
  assert.equal(download.with["digest-mismatch"], "error");
  assert.equal(download.with["run-id"], undefined); assert.equal(download.with["github-token"], undefined);
  assert.equal(consumer.env.UI_SMOKE_HEADFUL, "true");
  const evidence = consumer.steps.find(step => step.uses?.startsWith("actions/upload-artifact@"));
  assert.equal(evidence.with["retention-days"], 30, "Source images and raw measurements must survive the review window.");
  assert.ok(consumer.steps.some(step => step.run?.startsWith("xvfb-run --auto-servernum node scripts/original-browser-reference.mjs capture")));
});
test("test jobs use the same-run build and cannot compile a replacement production frontend", () => {
  assert.equal(workflow.jobs.build.steps.filter(step => step.run === "npm run build").length, 1);
  for (const id of ["unit", "quick", "quick-extended", "verify-memory-sqlite", "verify-postgres", "verify-postgres-ui", "deployability", "docker-compose-release-smoke"]) {
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
