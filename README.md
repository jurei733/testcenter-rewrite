# Testcenter Rewrite

This repository contains the rewrite planning baseline and the proof-of-architecture spike for a full redesign of `testcenter`.

It is intentionally separate from the legacy upstream repository so the rewrite can evolve with its own commit history, release cadence, and architecture decisions.

## Contents

- `rewrite-*.md`
  Rewrite planning, architecture, delivery, and backlog documents.
- `rewrite-spike/`
  Executable proof-of-architecture workspace for the rewrite backend and service boundaries.

## Working Model

- planning documents describe the target product and migration shape
- `rewrite-spike/` is the executable validation space
- generated artifacts and local runtime data are ignored

## Current Focus

The spike currently proves:

- canonical import and content-release flows
- participant runtime and monitoring flows
- system-check, evidence, retention, and notification workflows
- policy inheritance and override models
- dedicated service boundaries for dispatcher, notifications, provider operations, and worker maintenance

## Verification

Run inside `rewrite-spike/`:

```bash
npm install
npm run typecheck
npm run build
npm run test:contracts
```
