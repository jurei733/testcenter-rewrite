# Original browser reference qualification

CI renders the unmodified official Original frontend at the exact Source revision and lockfile in `scripts/fixtures/original-browser-source.json`. The producer packages only its compiled browser files with an app-commit manifest and individual SHA-256 digests. Each capture family verifies every file before and after rendering. The three families run independently and remain required for complete CI acceptance.

Quick checks reuse committed, measured Linux reference coordinates instead of waiting for the Source capture jobs. This preserves independent feedback and all existing text, behavior, geometry and close-button pixel comparisons. The profile accepts only Linux x64, Node 22, lockfile Playwright 1.59.1, visible Chromium 147.0.7727.15 and the pinned Source revision. Other renderers cannot silently consume it. Mac retains its original references. The historical behavioral reference revision remains unchanged; the visual profile records its own newer Source provenance separately.

The initial Linux profile was derived from the three successful Source jobs in [run 39428558228](https://github.com/jurei733/testcenter-rewrite/actions/runs/39428558228). Artifact IDs, archive SHA-256 digests, producing branch head and merge commit are recorded in `original-linux-chromium147-provenance.json`. Download these exact ZIPs to a scratch directory and regenerate with:

```sh
python3 scripts/qualify-original-linux-profile.py --archives /absolute/scratch/directory
```

The generator verifies archive bytes, matching manifests, pinned Source and renderer, and successful captures before projecting measured visual fields onto the existing schemas. It reads the single index directly without extracting archive paths. Runtime overlays reject unknown fields, removed controls and changes to authored text or behavior. The uncaptured legacy completeness case explicitly fails qualification rather than borrowing Mac pixels. The added legacy and system-check welcome capture tasks will supply the missing Linux evidence.

Validation at this change: 1,914 frontend tests, 99 CI policy tests, workflow actionlint, and the headed Mac header gate pass. The pinned Source build and all three capture families passed in the producing run. Complete CI remains red; this profile is not full application acceptance, and no speedup percentage is claimed from the historical false-green run.

Quick failures also upload the explicit browser artifact directory, alongside the complete failure log, for seven days. The shared browser flow and variant/exit gates write diagnostics there while keeping their SQLite fixture stores in a separate scratch directory. Persistent event-stream pages establish readiness through document, exact Run and completed resume assertions; they do not wait for global network idleness. Opaque controller frames are rendered before native radio input, preserving checked-state and saved-response assertions.
