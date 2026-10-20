# CI iteration and complete acceptance

The reference successful run is
[`39187723764`](https://github.com/jurei733/testcenter-rewrite/actions/runs/39187723764)
at `d39d8d46`, measured from its 38 actual jobs: **42.9 minutes** from first job
start to final completion and **302.2 runner-minutes**. The Ops chain alone took
2,336 seconds; PostgreSQL UI took 1,177 seconds. These are observed baseline
times, not measurements of the new workflow.

The first optimized workflow at `3e93fcee`, run `39418240190`, reaches a green
**Fast feedback in 251 seconds (4 minutes 11 seconds)** from its first job start.
Its full qualification fails at the changed attachment-type presentation
expectation described in `ATTACHMENT-LIFECYCLE.md`; it cannot establish a
successful complete runtime or release acceptance.

## Fast feedback

`Fast feedback` requires the production build, development typecheck, CI policy,
dependency audit, complete unit/frontend/terminal-overlap tests and every Quick
browser gate. It runs before the long matrix can occupy runner slots. A failure
here prevents expensive dependent jobs, and `CI acceptance` still fails.
For successful commits, the complete matrix, PostgreSQL, deployability and three
Compose modes run after this checkpoint. The Docker image gate also builds from
source independently. `Fast feedback` alone is not release acceptance.

One production build supplies all host test jobs. The archive is only 3.3 MiB in
the local checkpoint. Built-script aliases retain each original test command
and environment. A source-pinned baseline command inventory checks that no prior
qualification was lost. The eight serial Ops gates are independent jobs; every
existing scenario, both camera facings, native routes/tabs, controller references,
full browser flow, database adapter and deployment mode remains required.

Expect roughly **3–6 minutes** for the fast checkpoint and **20–25 minutes** for
complete qualification on comparable available runners. These are estimates
from the previous job timings and new dependencies; confirm actual hosted
timings after a complete successful new run. Queues and cold downloads add time.
Total compute is also reduced by removing repeated host builds and duplicate
feature-branch push/PR runs. More parallel jobs do not imply more test coverage.

## Artifact and credential boundaries

- Third-party Actions use immutable commit SHAs. Checkouts do not persist the
  GitHub credential. The workflow has only `contents: read`, no repository
  secrets, no privileged `pull_request_target` or `workflow_run` execution.
  The follow-up pins official checkout 7.0.1, setup-node 7.1.0, cache 6.1.0,
  download-artifact 8.0.2 and upload-artifact 7.0.2. Their inspected metadata
  declares Node 24 and retains every input used here. The observed hosted runner
  2.337.0 meets their minimum runner requirements; application jobs stay on
  Node 22. `ci-action-versions.json` records exact commits, release/source URLs,
  metadata hashes and accepted inputs. Artifact digest mismatch is explicitly
  fatal in the download action, before the application-level manifest check.
- Dependency installation uses the lockfile. The separate audit includes
  development dependencies and fails on high/critical findings. npm package
  caching retains the normal package-integrity checks, not installed modules.
- Chromium caching uses the exact OS, architecture and lockfile hash; system
  libraries are still installed. No browser binary is taken from a build artifact.
- Production artifacts are immutable, named by the exact tested SHA and downloaded
  from the **same workflow run**. There is no arbitrary run-ID/token override.
  Before extraction, the manifest checks commit, lockfile hash, Node major, OS,
  architecture and archive digest. Only the declared compiled/schema roots can
  be restored; links, special files, path escapes and symlink destinations fail.
- Archives contain no database, participant state, environment file, credential
  or installed modules. Generated schema bytes remain an ephemeral installation
  cache, not republished source. Build artifacts expire after one day. Existing
  bounded failure logs retain their seven-day policy.

Push runs cover `main`; pull requests cover every update, and merge queues plus
manual runs are supported. Composite-action changes trigger the workflow too.
Superseded runs are cancelled. No runtime tests are selected away by a broad
file-name heuristic. Full acceptance rejects every failed, skipped or cancelled
qualification group. Repositories requiring a single protected-branch check
should require **CI acceptance**, not the fast checkpoint. This change does not
alter repository branch-protection settings.

## Local verification

Use Node 22. Run `npm run test:ci-policy`, `npm audit --audit-level=high` and
Actionlint against the root workflow. Policy tests parse the actual workflow
and composite action, reconcile all prior commands and validate artifact
failures, including real corruption, stale source/lockfile and symlink cases.
The command inventory allows additional explicit test files while still
requiring every previous file; removing files or changing runner flags remains
a failure. This avoids blocking ordinary test additions during iteration.

To reproduce artifact reuse in a fresh checkout, first build with
`FIRST_SLICE_XML_SCHEMA_CACHE=.ci/xml-schemas`, then run
`GITHUB_SHA=<full-sha> node scripts/ci-build-artifact.mjs pack`. After `npm ci`
in a second checkout at that SHA and lockfile, set `CI_ARTIFACT_DIR` to that
archive directory and run the same command with `restore`. Run only `:built`
aliases against the restored outputs. The local checkpoint passed this fresh
consumer flow and all 16 authenticated attachment-text browser cases without
building that consumer's application.

The complete Memory HTTP suite also passes 172/172 against the reused schema
cache. Remote Linux/PostgreSQL/Docker qualification and actual improved timing
remain pending until the new published workflow completes.
