# Lockfile security audit

The required dependency gate audits the complete locked graph before acceptance.
It includes development and optional dependencies and still fails at severity
`high`. Build and runtime jobs retain clean `npm ci` and verify manifest/lockfile
consistency independently.

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
