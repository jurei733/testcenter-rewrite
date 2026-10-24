# Lockfile security audit

The required dependency gate audits the complete locked graph before acceptance.
It includes development and optional dependencies and still fails at severity
`high`. Build and runtime jobs retain clean `npm ci` and verify manifest/lockfile
consistency independently.

## Targeted undici and URI-parser patches (2026-10-24)

The complete dependency job in
[run 40045340388, job 120725650220](https://github.com/jurei733/testcenter-rewrite/actions/runs/40045340388/job/120725650220)
correctly rejects new registry findings with the unchanged complete high-severity
threshold. The committed graph has one high and two moderate package findings:
undici, its Angular-build metavulnerability and fast-uri. The earlier 89/89 green
run records the advisory state at its own time and does not exempt later scans.

Only three lock records change: **undici 7.29.1 → 7.30.1**, nested node-gyp
**undici 6.29.0 → 6.29.1**, and **fast-uri 3.1.8 → 3.1.9**, including registry
integrities. Node-gyp and AJV accept their compatible patch releases normally.
Current Angular 21 build releases pin the older undici version exactly, so a
scoped `@angular/build` override selects 7.30.1 while retaining the existing
Angular 21 build/framework packages. The automatic audit suggestion to force an
Angular 22 major upgrade is unnecessary. Remove the scoped override when the
upstream Angular 21 builder selects a patched undici itself.

Primary advisories identify
[undici excessive-content-encoding process termination](https://github.com/advisories/GHSA-xjj6-f33q-929c),
[unbounded EventSource state](https://github.com/advisories/GHSA-4qv8-2p9j-2685),
[Subresource Integrity algorithm normalization](https://github.com/advisories/GHSA-f72v-6w45-q472), and
[fast-uri encoded-scheme confusion](https://github.com/advisories/GHSA-w74x-v6f9-j3xg).
The URI patch also clears the three additional path/host/suffix advisories recorded
in [the complete audit receipt](../scripts/fixtures/dependency-audit-20261024-undici.json).
These installed paths are development/build dependencies; the required audit
continues to include them and optional dependencies.

Independent owned temporary workspaces contain only each manifest and exact lock,
no `node_modules`, and run with `NODE_ENV=production`. Explicit dev/optional scans
still reject the old graph (exit 1, three findings) and accept the patched graph
(exit 0, zero findings). Observed scan times are 0.732 and 0.691 seconds on this
machine. The receipt binds both exact lock/manifest digests. A clean `npm ci`
succeeds and `npm ls undici fast-uri --all` shows both patched undici generations
and fast-uri, with no invalid dependencies. The audit command, thresholds and
workflow permissions are unchanged; new lock digests invalidate old build and
browser artifacts through the existing protocol.

Fresh qualification passes **3,981 unit/frontend checks**, core/web typechecking,
production build and the complete headed SQLite participant-entry/reentry smoke.
The initial entry remains **468.39 kB** under the unchanged 470 kB limit. Owned
browser/server teardown completes. The complete main workflow remains a separate
qualification, not inferred from these local checks.

[Isolated Linux run 40045840545](https://github.com/jurei733/testcenter-rewrite/actions/runs/40045840545),
job **120727246868**, passes the exact unchanged dependency job copied from the
main workflow, with the patched manifest/lock and Node **22.23.3** / npm **10.9.9**.
It reports **zero vulnerabilities**, without installation or npm cache restoration.
The probe's exact commit/tree and limited scope are retained in the receipt. This
qualifies the audit patch, not the ongoing failed predecessor or full application
acceptance. All useful predecessor jobs finish before PR publication; all five Original
browser-reference jobs succeed, while the old audit and its two dependent
aggregate gates correctly fail. The patched head then completes
[full run 40046280241](https://github.com/jurei733/testcenter-rewrite/actions/runs/40046280241)
with **89/89 successful Linux jobs** and no skips/cancellations/failures. Actual
main audit job **120728630579** reports zero findings. Unit/frontend job
**120728959231** verifies 3,981 checks and full PostgreSQL job **120729505709**
verifies 2,121. The actual merge tree is exactly the published security tree.
This is complete hosted qualification at that registry state, not a permanent
absence-of-vulnerabilities guarantee.


## Audit without installation

The audit job uses the existing SHA-pinned Node setup with package-manager cache
restoration disabled, then runs:

```sh
npm audit --package-lock-only --include=dev --include=optional --audit-level=high
```

It needs no application build, browser packages or `node_modules`. It performs no
install/update lifecycle scripts or lockfile mutation. The operation reads the
committed graph, including dev dependencies even under `NODE_ENV=production`.
The [npm 10 audit documentation](https://docs.npmjs.com/cli/v10/commands/npm-audit/)
describes lockfile-only operation and inclusion options. Existing read-only token
permissions, disabled checkout credentials, complete acceptance dependencies,
clean installation in required build jobs and the high threshold are preserved.

On hosted predecessor job
[120664953225](https://github.com/jurei733/testcenter-rewrite/actions/runs/40026815045/job/120664953225),
the removed `npm ci` takes **8.48 seconds**, after approximately **2.9 seconds** of
npm cache lookup/download/extraction. The new owned lockfile-only controls take
**0.62 seconds** with the vulnerable lock and **0.52 seconds** with the patched
lock. This compares different environments and isolates work eliminated; it is
not a measured total hosted-job speedup. The isolated hosted qualification below executes the actual revised job.


[Isolated Linux run 40027715625](https://github.com/jurei733/testcenter-rewrite/actions/runs/40027715625)
now passes the exact revised dependency job copied from the main workflow. Its
actual Node/npm versions are **22.23.3 / 10.9.9**. The audit reports **zero
vulnerabilities** in approximately **0.91 seconds**; the entire observed job takes
**nine seconds**, compared with **21 seconds** for the failing predecessor job.
These are individual hosted observations, including distinct runner allocation
and dependency findings, not a guaranteed percentage reduction for future jobs.
No npm cache or application installation occurs. This qualifies the revised audit
job only; the full new-head pipeline still has to pass independently.

## Targeted security patch, 2026-10-23

The predecessor audit correctly rejects two high findings (Zod and its CLI
metavulnerability) and reports one moderate ip-address finding. Angular CLI
**21.2.28** directly selects fixed **Zod 4.6.6**; the compatible transitive
ip-address update selects **10.7.4**. No force update or new transitive override
is needed. Angular framework/build packages retain their existing versions.
The lock also updates the CLI's matching schematics/core dependencies and its
compatible color helper.

The [Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) identifies
excessive memory consumption when validating oversized constrained collections.
The [ip-address advisory](https://github.com/advisories/GHSA-rxp7-6hxx-x8q5)
identifies excessive synchronous work on long malformed IPv6 zone identifiers.
The installed dependency paths are through development tooling; their presence
is still covered by the required audit.

A clean install followed by a fresh audit reports **zero known vulnerabilities**
at qualification time. An independent owned temporary-workspace control copies
only manifests and each exact lock, has no `node_modules`, and sets
`NODE_ENV=production`. The old lock still exits **1**, including both high
findings; the patched lock exits **0**. Both scans include development and
optional dependencies. Recorded versions, lock SHA256s and measured results are
in [the qualification receipt](../scripts/fixtures/dependency-audit-20261023.json).
This records the live registry's findings at that time, not a permanent guarantee.

The new lock invalidates the existing CI caches/artifacts through their ordinary
lock digest. Browser and build artifacts must be produced again in the same run;
no old-lock artifact or runner-image fallback is introduced.

## Newly reported body-parser finding, 2026-10-24

The next complete [run 40036035411](https://github.com/jurei733/testcenter-rewrite/actions/runs/40036035411)
correctly rejects a newly reported high finding in development tooling's
`body-parser 2.3.0`. The [upstream advisory](https://github.com/advisories/GHSA-27r3-jxmh-p828)
identifies a process crash after trailing bytes in a compressed request and fixes
the 2.x line in **2.4.0**. The dependency path is Angular CLI → MCP SDK → Express
5.2.1 → body-parser. The locked API server does not use this middleware, but the
complete audit intentionally still includes development tools.

A targeted, compatible lock update selects **body-parser 2.4.0**, its required
**iconv-lite 0.7.3** and **qs 6.16.1**. Only these three package records change;
Express's existing `^2.2.1` range admits the fix. There is no forced update, new
override, package.json change or lowered severity threshold.

The [new qualification receipt](../scripts/fixtures/dependency-audit-body-parser-20261024.json)
records independent old/new lock audits in owned temporary directories, under
`NODE_ENV=production`, with explicit dev/optional inclusion and no installation.
The exact old lock fails with one high finding; the updated lock reports zero.
Neither control creates `node_modules` or changes its lock. A subsequent clean
application install also reports zero. These are live findings at capture time;
the previous zero-vulnerability receipt remains accurate for its earlier scan.

With the updated lock, clean-install qualification passes **3,932 unit/frontend
checks**, CI typechecking, fresh production build and **264 CI-policy checks**
(one explicit GNU-timeout-only macOS skip). The initial entry remains **468.39 kB**
under the unchanged 470 kB error budget. Full hosted acceptance must still qualify
the newly produced artifacts and the complete updated-lock matrix independently.
