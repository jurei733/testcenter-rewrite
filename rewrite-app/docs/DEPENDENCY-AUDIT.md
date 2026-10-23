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
not a measured total hosted-job speedup. The next hosted run must qualify the
actual revised job.

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
