# Testcenter Rewrite App

This folder is the starting point for the real production implementation.

It is intentionally separate from `rewrite-spike/`:

- `rewrite-spike/` proves architecture and semantics
- `rewrite-app/` is where production-oriented code starts

## Phase 1 Vertical Slice

The first production slice is intentionally narrow:

1. tenant creation
2. workspace creation
3. source-package intake
4. import-job creation
5. content-release activation
6. participant sign-in and starter launch
7. persisted test-run lifecycle read/write seams
8. monitor read visibility for open runs

## Workspace Shape

```text
rewrite-app/
  apps/
    api/
    web/
  packages/
    application/
    contracts/
    domain/
```

## Design Rules

- keep production entrypoints small
- preserve domain semantics from the spike before preserving spike file shapes
- prefer explicit ports and use-case boundaries over direct infrastructure coupling
- do not copy spike megafiles into this workspace

## Verification

Run inside `rewrite-app/`:

```bash
npm install
npm run typecheck
npm run build
```
