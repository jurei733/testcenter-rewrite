# Rewrite Production Baseline

## Status

Accepted as the spike exit baseline.

## Purpose

This document marks the handoff from proof-of-architecture work to real product implementation.

It answers four questions:

1. what the spike already proved well enough to carry forward
2. what should be reused only as a structural or semantic reference
3. what must be rebuilt in production form instead of being copied directly
4. what the first real implementation slice should be

The goal is to stop open-ended spike growth and create a clean starting point for the real rewrite.

## Baseline Decision

The proof-of-architecture spike is now considered structurally sufficient.

From this point:

- the spike remains a reference and validation workspace
- new work should prefer production implementation over new spike capability growth
- spike changes should be limited to:
  - bug fixes
  - contract clarifications
  - refactors that directly improve production extraction
  - small targeted validations when a production decision is still genuinely unclear

## Carry Forward Directly

These areas are strong enough to carry forward with only normal production hardening and packaging work:

- canonical content-release model and import-job lifecycle semantics
- tenant/workspace policy inheritance and override model
- participant session, starter, launch, and persisted test-run semantics
- monitor command queue and dispatcher-style command lifecycle
- system-check submission, evidence, retention-hold, and launch-approval semantics
- notification-provider profile registry, rollout, incident, and governance-case domain model
- audit-event-first operator history and policy-history projection approach
- modular service split between:
  - `api`
  - `worker`
  - `dispatcher`
  - `notifications`
  - `provider-operations`
- package boundaries around:
  - `contracts`
  - `domain`
  - `db`
  - `outbound-messaging`
  - `evidence-storage`

These are not “copy blindly” assets, but they are valid production starting boundaries.

## Reuse As Reference

These spike assets should guide implementation, but should not be treated as production code by default:

- route shapes in `rewrite-spike/apps/api`
- the exact Postgres persistence structure in `rewrite-spike/packages/db`
- worker polling loops and timing defaults
- spike delivery adapters like `webhook_spike` and `email_spike`
- fixture-driven importer paths
- large end-to-end operator read models that were optimized for proving behavior quickly

They are valuable because they encode semantics, not because they are already polished enough.

## Rebuild For Production

These should be deliberately rebuilt or tightened before calling the rewrite production-ready:

- real XML ingestion and canonical transformation pipeline
- authentication, authorization, and user identity model
- production-grade secret handling and provider credential integration
- observability, metrics, structured logging, and operational dashboards
- deployment packaging, CI/CD, and environment management
- frontend shells for workspace admin, monitor, and operator workflows
- reporting, exports, and legacy parity verification tooling
- performance envelopes, concurrency controls, and failure-recovery hardening

## Production Policy Shape

The production baseline adopts the policy boundary decision from [rewrite-adr-003-policy-boundaries.md](/Users/julian/code/testcenter-rewrite/rewrite-adr-003-policy-boundaries.md).

That means:

- keep separate:
  - `activation-policy`
  - `operational-policy`
  - `launch-approval-policy`
  - `notification-provider-promotion-policy`
  - `notification-provider-profiles`
  - `governance-case-policy`
  - `evidence-retention-policy`
  - `evidence-retention-class-policy`
- consolidate:
  - `notification-policy`
  - `governance-notification-policy`
  - `recovery-governance-notification-policy`
- into one production-facing:
  - `outbound-notification-policy`

This consolidation should happen at production extraction time, not by further growing the spike.

## First Production Slice

The first real implementation slice should be one vertical product path:

1. tenant/workspace setup
2. real content import
3. content activation
4. participant sign-in and launch
5. persisted test-run lifecycle
6. monitor read visibility

That slice should produce:

- a production backend skeleton
- real authentication boundaries
- one usable admin UI shell
- one usable monitor UI shell
- one end-to-end acceptance path that is not spike-only

## Extraction Guidance

When moving from spike to production code:

- preserve domain names before preserving file shapes
- prefer small production entrypoints over copying spike megafiles
- keep the existing package and service boundaries unless a production constraint disproves them
- migrate tests in this order:
  - contract-critical semantics
  - operator workflows
  - importer parity
  - UI acceptance

## Stop Rule

We should treat the proof-of-architecture as complete enough and stop adding broad new spike capabilities unless:

1. the production implementation is blocked by an unresolved architecture question, and
2. a small spike change is the cheapest way to answer it

If those conditions are not true, new work belongs in the production implementation, not in the spike.
