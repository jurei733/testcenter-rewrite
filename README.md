# Testcenter Rewrite

This repository contains the rewrite planning baseline and the proof-of-architecture spike for a full redesign of `testcenter`.

It is intentionally separate from the legacy upstream repository so the rewrite can evolve with its own commit history, release cadence, and architecture decisions.

## Contents

- `rewrite-*.md`
  Rewrite planning, architecture, delivery, and backlog documents.
- `rewrite-spike/`
  Executable proof-of-architecture workspace for the rewrite backend and service boundaries.
- `rewrite-app/`
  Production implementation workspace for the first real vertical slice.

## Working Model

- planning documents describe the target product and migration shape
- `rewrite-spike/` is the executable validation space
- `rewrite-app/` is the production-oriented implementation space
- generated artifacts and local runtime data are ignored

## Current Focus

The spike currently proves:

- canonical import and content-release flows
- participant runtime and monitoring flows
- system-check, evidence, retention, and notification workflows
- policy inheritance and override models
- dedicated service boundaries for dispatcher, notifications, provider operations, and worker maintenance

The current spike exit boundary is captured in:

- `rewrite-adr-003-policy-boundaries.md`
  Policy consolidation decision for the production baseline, including which policy families stay separate and which notification-policy families collapse into one production-facing outbound-notification surface.
- `rewrite-production-baseline.md`
  Explicit spike handoff document describing what carries forward directly, what remains reference-only, what should be rebuilt in production form, and what the first real implementation slice should be.

## Verification

Use Node.js 22 LTS for the production app workspace. The Docker image and GitHub Actions workflow both run Node 22, and the repository includes `.node-version` and `.nvmrc` for local version managers.

Run inside `rewrite-spike/`:

```bash
npm install
npm run typecheck
npm run build
npm run test:contracts
```
