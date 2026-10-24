import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { constants } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const appRoot = fileURLToPath(new URL('../', import.meta.url));
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
// These service/store suites consume only TypeScript core output. Unknown or
// mixed selections retain the complete production build by default.
const coreOnlyScripts = new Set(['test:unit:built', 'test:participant-auth:built',
  'test:original-results:built', 'test:system-check-reports:built']);

// Read the actual workflow on every invocation. No second scenario inventory or
// arbitrary shell command can silently diverge from the complete CI gates.
export function focusChecks(workflow, scripts) {
  const checks = [];
  for (const [job, prefix] of [['quick', 'quick'], ['quick-extended', 'qualification'],
    ['verify-memory-sqlite', 'verify']]) {
    for (const item of workflow.jobs[job].strategy.matrix.include) {
      checks.push({ id: `${prefix}/${item.check}`, check: item.check, build: true,
        headed: workflow.jobs[job].env?.UI_SMOKE_HEADFUL === 'true',
        browser: job !== 'verify-memory-sqlite' || item.playwright === true,
        steps: parseFocusCommand(item.command, scripts) });
    }
  }
  for (const [id, script, build] of [['policy', 'test:ci-policy', false],
    ['typecheck', 'typecheck', false], ['unit', 'test:unit:built', true],
    ['participant-auth', 'test:participant-auth:built', true],
    ['original-results', 'test:original-results:built', true],
    ['system-check-reports', 'test:system-check-reports:built', true]]) {
    checks.push({ id, check: id, build, headed: false, browser: false,
      steps: parseFocusCommand(`npm run ${script}`, scripts) });
  }
  if (new Set(checks.map(check => check.id)).size !== checks.length) throw Error('Duplicate focused CI check');
  return checks;
}

export function parseFocusCommand(command, scripts) {
  return command.split(/\s*&&\s*/).map(part => {
    const match = /^(?:(UI_SMOKE_ATTACHMENT_CAMERA_FACING)=(front|rear) )?npm run ([\w:-]+)$/.exec(part.trim());
    if (!match || !Object.hasOwn(scripts, match[3])) throw Error(`Unsupported focused CI command: ${part}`);
    return { script: match[3], env: match[1] ? { [match[1]]: match[2] } : {} };
  });
}

export function planFocus(args, checks) {
  const options = args.filter(arg => arg.startsWith('--'));
  if (options.some(arg => !['--plan', '--list'].includes(arg)) || new Set(options).size !== options.length) {
    throw Error('Expected ci:focus -- [--plan] CHECK [CHECK ...], or --list');
  }
  const names = args.filter(arg => !arg.startsWith('--'));
  if (options.includes('--list')) {
    if (names.length || options.length !== 1) throw Error('--list cannot be combined with selected checks');
    return { list: checks };
  }
  if (!names.length) throw Error('Select at least one CI check. Use npm run ci:focus -- --list');
  const selected = names.map(name => {
    const exact = checks.find(check => check.id === name);
    if (exact) return exact;
    const matches = checks.filter(check => check.check === name);
    if (matches.length !== 1) throw Error(`Unknown or ambiguous CI check: ${name}. Use --list`);
    return matches[0];
  }).filter((check, index, all) => all.findIndex(item => item.id === check.id) === index);
  const builtChecks = selected.filter(check => check.build);
  const buildScript = !builtChecks.length ? null : builtChecks.every(check =>
    !check.browser && check.steps.length > 0 && check.steps.every(step => coreOnlyScripts.has(step.script)))
    ? 'build:core' : 'build';
  return { dryRun: options.includes('--plan'), completeAcceptance: false,
    build: buildScript !== null, buildScript, checks: selected };
}

export function executeFocus(plan, run) {
  if (plan.build) {
    const status = run({ script: plan.buildScript ?? 'build', env: {} }, { headed: false, browser: false });
    if (status !== 0) return status;
  }
  for (const check of plan.checks) {
    for (const step of check.steps) {
      const status = run(step, check);
      if (status !== 0) return status;
    }
  }
  return 0;
}

function runNpm(step, check) {
  console.log(`focused_ci=${check.id ?? 'production-build'} script=${step.script}`);
  const started = performance.now();
  const env = { ...process.env, CI: 'true', ...step.env };
  // Match the workflow's headed Quick gates. Keep verification-shard defaults
  // unless the caller explicitly requests a visible browser, as CI does.
  if (check.headed) env.UI_SMOKE_HEADFUL = 'true';
  const npmArgs = process.env.npm_execpath ? [process.env.npm_execpath, 'run', step.script] : ['run', step.script];
  const npm = process.env.npm_execpath ? process.execPath : 'npm';
  const headedLinux = check.browser && env.UI_SMOKE_HEADFUL === 'true' && process.platform === 'linux';
  const result = spawnSync(headedLinux ? 'xvfb-run' : npm,
    headedLinux ? ['--auto-servernum', npm, ...npmArgs] : npmArgs,
    { cwd: appRoot, env, stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  const status = result.status ?? (128 + (constants.signals[result.signal] ?? 1));
  console.log(JSON.stringify({ focusedCi: check.id ?? 'production-build', script: step.script,
    elapsedMs: Math.round(performance.now() - started), status }));
  return status;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const workflow = parse(readFileSync(new URL('../../.github/workflows/rewrite-app-ci.yml', import.meta.url), 'utf8'));
    const scripts = readJson(new URL('../package.json', import.meta.url)).scripts;
    const plan = planFocus(process.argv.slice(2), focusChecks(workflow, scripts));
    if (plan.list) {
      for (const check of plan.list) console.log(`${check.id}\t${check.steps.map(step => step.script).join(' && ')}`);
    } else {
      console.log(JSON.stringify(plan, null, 2));
      if (!plan.dryRun) process.exitCode = executeFocus(plan, runNpm);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
