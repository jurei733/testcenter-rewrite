# Testcenter Rewrite Spike Workspace

This folder is the starting point for the rewrite proof-of-architecture.

It is intentionally isolated from the legacy implementation so we can validate:

- tenant-aware module boundaries
- canonical content-first APIs
- a TypeScript-first modular monolith shape
- clean separation between domain, contracts, persistence, UI, and application entrypoints

## Planned Shape

```text
rewrite-spike/
  apps/
    api/
    dispatcher/
    notifications/
    provider-operations/
    web/
    worker/
  packages/
    contracts/
    db/
    domain/
    evidence-storage/
    outbound-messaging/
    test-fixtures/
    test-harness/
    ui/
```

## What Exists Now

The first scaffold includes:

- workspace-level `npm` and TypeScript configuration
- package boundaries aligned to the rewrite plan
- a shared `outbound-messaging` package for provider-specific channel selection, retry/max-attempt policy interpretation, spike delivery adapters, and provider receipt semantics
- Docker-backed PostgreSQL with tracked DB migrations
- a runnable `api` entrypoint that uses `contracts`, `domain`, and `db`
- a runnable long-lived `worker` entrypoint that polls for import jobs, materializes canonical content releases, and performs runtime maintenance sweeps for timed test runs and evidence lifecycle maintenance
- a runnable long-lived `provider-operations` entrypoint that refreshes notification provider-profile operational state with active credential and target probes, including per-profile probe-policy skips, evaluates policy-driven rollout automation, and records provider-operations audit events only when operational outcomes or automated rollout decisions change
- a runnable long-lived `dispatcher` entrypoint that consumes an explicit Postgres-backed dispatch queue, reacts to enqueue notifications, and expires stale unresolved commands
- seeded tenant and workspace data for smoke testing
- write endpoints for tenant creation, workspace creation, source-package upload, import-job creation, content-release activation, participant sign-in, starter launch, participant test-run save/progression/navigation, and monitor pause/resume/unlock commands
- workspace monitor read routes for open test runs and workspace audit events
- operator-facing detail routes for staged import diagnostics and canonical content-release inspection
- operator-facing monitor projections that summarize canonical group, login, assignment, and booklet routing for a content release
- operator-facing system-check projections that summarize canonical system-check definitions, affected groups, and login coverage for a content release
- workspace-facing system-check readiness projections that turn participant sessions into blocked, warning, or ready follow-up queues
- persisted participant system-check submissions with richer per-check payloads, captured evidence objects backed by a shared pluggable blob-storage package, S3-compatible in the contract flow with legacy inline fallback support, grant-backed evidence retrieval, retention expiry metadata, operator-applied retention holds with default-assignee automation, acknowledgement, SLA workflow state, worker-driven SLA breach escalation, a workspace hold-queue read model, a dedicated workspace breach-queue read model, a dead-letter queue for delivery-failed outbound notifications, a persisted workspace breach-notification outbox with notification-service-driven delivery orchestration over the shared outbound-messaging webhook/email spike adapters, provider receipt metadata, policy-driven channel selection, delivery retry state, manual redrive with optional target correction, and acknowledgement flow, evidence retention-history projection, worker-driven payload purge, workspace review decisions, workspace-scoped launch approvals, policy-driven default approval expiry with optional explicit timestamps, automatic approval invalidation on readiness changes, explicit approval revocation, launch gating through stored approval records, review-state filtering, and audit events
- content-release summaries and detail views that compare each release against the next older workspace release before activation
- field-level release diff reasons that explain which booklet, login-collection, and assignment fields changed, including before/after values
- activation-focused impact rollups that summarize risk level, affected logins/groups/booklets, and operator highlights before a release is switched live
- activation guardrails that compare a target release against the currently active release and synchronized open sessions, returning `ready`, `warning`, or `blocked` states before activation
- tenant-level activation-policy defaults with live workspace inheritance plus workspace override records that preserve per-field request and timestamp provenance for guardrail behavior
- tenant-level operational-policy defaults with live workspace inheritance plus workspace override records that preserve per-field request and timestamp provenance for monitor-command expiry, lease timing, and worker timed-run maintenance grace
- tenant-level launch-approval-policy defaults with live workspace inheritance plus workspace override records that preserve per-field request and timestamp provenance for warning-level approval expiry
- tenant-level notification-policy defaults with live workspace inheritance plus workspace override records that preserve per-field request and timestamp provenance for breach-notification channel selection, retry delay, and max delivery attempts
- a tenant-managed notification provider-profile registry plus partial workspace override records with live inheritance, explicit per-profile tombstones, per-profile provenance, enable/disable state, rollout-state metadata (`active`, `paused`, `canary`) with per-profile `rolloutPercentage` and fallback-profile routing, credential-reference validation plus spike reachability checks, per-profile `targetProbeMode`, masked credential-reference metadata on read, computed provider health/readiness including `target_unreachable`, provider-operations-service-refreshed operational state (`lastCheckedAt`, actor provenance, rollout status, probe status, probe target, probe latency, last check error), provider-profile incident state for auto-rollback suppression, a persisted workspace provider-incident queue with acknowledgement and resolution lifecycle, tenant/workspace notification-provider-promotion policy with live inheritance and partial overrides for evaluation windows, burn-in thresholds, automation flags, and suppression windows, workspace rollout metrics, promote workflow support with policy-driven guardrails plus optional force-promotion, and provider-operations auto-promote / auto-rollback decisions for workspace override profiles with suppression-aware recovery, so `profile:*` escalation targets can resolve into outbound delivery channel and target metadata without embedding provider config inside notification-policy overrides or leaking raw secret references back out through the API
- tenant-level evidence-retention-policy defaults with live workspace inheritance plus workspace override records that preserve per-field request and timestamp provenance for separate workspace-review and operator-investigation evidence retention windows
- tenant-level evidence-retention-class-policy defaults with live workspace inheritance plus workspace override records that preserve request provenance for default-capture and per-class rule overrides across data-driven retention classes, a tenant-defined hold-reason catalog with display labels, workflow hints, severity, escalation targets, UI grouping, acknowledgement requirements, default assignee targets, and SLA timers, TTL-field mappings, and hold transitions, plus a workspace-facing effective class-registry projection used by hold promotion and inspection flows
- tenant and workspace policy-history projections that normalize policy changes from audit events into operator-facing activation, operational, launch-approval, notification, notification-provider-profile, evidence-retention, and evidence-retention-class policy timelines
- canonical system-check definitions flowing from imported content into content-release inspection, participant-facing session reads, captured evidence storage behind a retrieval-grant boundary with swappable backends, persisted participant submission records, workspace review decisions, workspace evidence-hold workflows with automatic assignment, acknowledgement, SLA visibility, worker-driven escalation, a hold-queue projection, notification-service-driven breach-notification delivery with provider adapters and receipts supplied by the shared outbound-messaging package plus notification-policy-driven retry semantics, workspace launch-approval issuance, approval lifecycle management including policy-driven expiry, and participant launch gating through stored warning-level approval records
- a registry-based importer path that already handles multiple canonical fixture families
- import diagnostics that expose importer selection, source-manifest summary, source-model summary, and canonical summary artifacts
- import diagnostics that also expose source-to-canonical reference mappings plus a first-class failure object with failed stage, failure message, structured validation issues, mapping keys, and failure event metadata
- importer-backed failure fixtures that now exercise source-model and canonical-validation failures, not just missing-importer failures
- persisted monitor command records with explicit ack states (`pending_delivery`, `delivered`, `applied`, `rejected`, `expired`)
- explicit monitor-command queue records that decouple command state from delivery state
- queued monitor command delivery where API writes intent and the dispatcher applies or rejects commands asynchronously
- runtime policy controls on persisted test runs, including locked navigation, monitor-driven unlock, time limits, and pause-aware timers
- worker-side maintenance sweeps that persist timed-out test runs using effective workspace operational policy
- dispatcher-side command expiry for stale unresolved monitor commands
- Postgres queue wakeups so the dispatcher reacts to new monitor commands without hot polling for deliveries
- request IDs and persisted audit events for the core mutation paths, including worker-side import success/failure and dispatcher-side monitor command delivery outcomes
- multiple fixture families with starter and multi-booklet monitor metadata, plus an executable contract test harness

## Immediate Next Tasks

1. decide whether runtime maintenance belongs in this worker or in a dedicated scheduler/maintenance service
2. decide whether the Postgres-backed queue remains sufficient for v1 or whether this boundary should move to external queue infrastructure
3. decide whether evidence-retention-class policy should support per-class validation rules beyond transition targets, hold-reason catalogs, and TTL bindings
4. deepen the provider rollout model with promotion approvals, time-bucketed rollout metrics, and automated rollout decisions beyond the current policy-driven fixed-window guardrails

## Current Smoke-Tested Routes

- `GET /api/v1/platform/health`
- `GET /api/v1/platform/tenants`
- `POST /api/v1/platform/tenants`
- `GET /api/v1/platform/tenants/{tenantKey}/activation-policy`
- `PATCH /api/v1/platform/tenants/{tenantKey}/activation-policy`
- `GET /api/v1/platform/tenants/{tenantKey}/operational-policy`
- `PATCH /api/v1/platform/tenants/{tenantKey}/operational-policy`
- `GET /api/v1/platform/tenants/{tenantKey}/launch-approval-policy`
- `PATCH /api/v1/platform/tenants/{tenantKey}/launch-approval-policy`
- `GET /api/v1/platform/tenants/{tenantKey}/notification-policy`
- `PATCH /api/v1/platform/tenants/{tenantKey}/notification-policy`
- `GET /api/v1/platform/tenants/{tenantKey}/notification-provider-profiles`
- `PATCH /api/v1/platform/tenants/{tenantKey}/notification-provider-profiles`
- `GET /api/v1/platform/tenants/{tenantKey}/evidence-retention-policy`
- `PATCH /api/v1/platform/tenants/{tenantKey}/evidence-retention-policy`
- `GET /api/v1/platform/tenants/{tenantKey}/evidence-retention-class-policy`
- `PATCH /api/v1/platform/tenants/{tenantKey}/evidence-retention-class-policy`
- `GET /api/v1/platform/tenants/{tenantKey}/policy-history`
- `GET /api/v1/tenants/{tenantKey}/workspaces`
- `POST /api/v1/tenants/{tenantKey}/workspaces`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/activation-policy`
- `PATCH /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/activation-policy`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/operational-policy`
- `PATCH /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/operational-policy`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/launch-approval-policy`
- `PATCH /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/launch-approval-policy`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/notification-policy`
- `PATCH /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/notification-policy`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/notification-provider-profiles`
- `PATCH /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/notification-provider-profiles`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/notification-provider-profile-incidents`
- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/notification-provider-profile-incidents/{incidentId}:acknowledge`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/evidence-retention-policy`
- `PATCH /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/evidence-retention-policy`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/evidence-retention-class-policy`
- `PATCH /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/evidence-retention-class-policy`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/evidence-retention-classes`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/policy-history`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/system-check-results`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/system-check-evidence-breach-queue`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/system-check-evidence-breach-dead-letter-queue`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/system-check-evidence-breach-notifications`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/system-check-evidence-hold-queue`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/system-check-evidence/{evidenceKey}`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/system-check-evidence/{evidenceKey}/retention-history`
- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/system-check-evidence/{evidenceKey}:hold`
- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/system-check-evidence/{evidenceKey}:assign-hold`
- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/system-check-evidence/{evidenceKey}:acknowledge-hold`
- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/system-check-evidence-breach-notifications/{notificationId}:acknowledge`
- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/system-check-evidence-breach-notifications/{notificationId}:redrive`
- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/system-check-evidence/{evidenceKey}:release-hold`
- `GET /api/v1/system-check-evidence-access/{accessToken}`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/system-check-readiness`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/system-check-launch-approvals`
- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/system-check-launch-approvals`
- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/system-check-launch-approvals/{launchApprovalId}:revoke`
- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/system-check-results/{systemCheckSubmissionId}:review`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/audit-events`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/monitor/commands`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/monitor/test-runs`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/source-packages`
- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/source-packages`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/import-jobs`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/import-jobs/{importJobId}`
- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/import-jobs`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/content-releases`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/content-releases/{contentReleaseId}`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/content-releases/{contentReleaseId}/monitor-projection`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/content-releases/{contentReleaseId}/system-check-projection`
- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/content-releases/{contentReleaseId}:activate`
- `POST /api/v1/participant/auth/sign-in`
- `GET /api/v1/participant/starter`
- `GET /api/v1/participant/system-check`
- `POST /api/v1/participant/system-check-evidence`
- `POST /api/v1/participant/system-check:submit`
- `POST /api/v1/participant/starter:launch`
- `GET /api/v1/participant/test-runs/{testRunId}`
- `POST /api/v1/participant/test-runs/{testRunId}:save`
- `POST /api/v1/participant/test-runs/{testRunId}:request-next-unit`
- `POST /api/v1/participant/test-runs/{testRunId}:request-unit-navigation`
- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/monitor/test-runs/{testRunId}:pause`
- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/monitor/test-runs/{testRunId}:resume`
- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/monitor/test-runs/{testRunId}:unlock`

## Local Run Sequence

1. `npm install`
2. `npm run db:up`
3. `npm run db:migrate`
4. `npm run start:api`
5. `npm run start:dispatcher`
6. `npm run start:notifications`
7. `npm run start:provider-operations`
8. `npm run start:worker`
9. optional: `npm run start:dispatcher:once` for a deterministic single monitor-command dispatch sweep during debugging
10. optional: `npm run start:notifications:once` for a deterministic single breach-notification delivery sweep during debugging
11. optional: `npm run start:provider-operations:once` for a deterministic single provider-profile operational refresh sweep during debugging
12. optional: `npm run start:worker:once` for a deterministic single worker sweep during debugging

## Automated Checks

- `npm run test:contracts` rebuilds the workspace, provisions a fresh local Postgres and MinIO stack, applies migrations, starts the API, runs the queue-driven dispatcher, dedicated notification service, dedicated provider-operations service, and looping worker, and verifies the end-to-end participant, multi-family import, queued-monitor-command, request-id, audit-event, importer-artifact diagnostics, source-to-canonical reference mappings, first-class import failure diagnostics with structured validation issues, content-release diff summaries with field-level change reasons, activation-focused impact rollups, tenant activation-policy defaults, tenant operational-policy defaults, tenant launch-approval-policy defaults, tenant notification-provider-promotion-policy defaults, tenant notification-policy defaults, tenant-managed notification provider profiles, provider-operations-service-refreshed provider-profile operational state with active credential and target probes, profile-level target-probe skip policy, canary rollout fallback routing, workspace rollout metrics with policy-driven evaluation windows, provider-profile promote workflow with configurable burn-in guardrails plus optional force-promotion, provider-operations auto-promote and auto-rollback decisions for workspace override profiles, persisted workspace provider-profile incident queues with acknowledgement and resolution lifecycle, tenant evidence-retention-policy defaults, tenant evidence-retention-class-policy defaults, live workspace inheritance, explicit workspace activation-policy override records with request provenance, explicit workspace operational-policy override records with request provenance, explicit workspace launch-approval-policy override records with request provenance, explicit workspace notification-provider-promotion-policy override records with request provenance, explicit workspace notification-policy override records with request provenance, explicit workspace notification provider-profile override records with request provenance, explicit workspace evidence-retention-policy override records with request provenance, explicit workspace evidence-retention-class-policy override records with request provenance, tenant and workspace policy-history projections across all eight policy families, operator and participant system-check projections, participant system-check evidence capture through the shared evidence-storage package into an S3-compatible backend, workspace evidence inspection with short-lived access grants, class-based evidence retention with workspace-review and operator-investigation windows, workspace evidence-retention class projection, workspace retention holds with automatic assignment, acknowledgement, worker-driven SLA escalation into the workspace hold queue, a dedicated breach-queue projection for pending, breached, acknowledged, and escalated escalation workflows, a dead-letter queue for delivery-failed outbound notifications, a persisted breach-notification outbox with notification-policy-driven webhook/email adapters implemented through the shared outbound-messaging package plus tenant-managed and workspace-overridable provider profiles, provider receipts, retry scheduling, delivery failure state, manual redrive with target correction, and acknowledgement flow, escalation state, and retention-history visibility, worker-driven retention purge with metadata preserved and grantless workspace review, legacy inline evidence compatibility through the same grant route, participant system-check submission persistence with richer per-check payloads, workspace system-check review decisions and filtering, workspace system-check readiness follow-up queues, workspace launch-approval issuance, policy-driven expiry, invalidation, revocation, and listing, participant launch gating from system-check readiness through stored warning-level launch approvals, activation guardrails, monitor projections, source-model failure, canonical-validation failure, content-release-detail, dispatcher-expiry, provider-operations refresh, worker-maintenance, cross-workspace maintenance grace behavior, failed-import, and missing-active-release flow.

## Notes

- This scaffold is not the rewrite itself.
- The goal is to make architectural pressure visible quickly.
- If the package boundaries feel awkward during the first vertical slice, we should change them early.
- API, dispatcher, notification service, and worker startup now assume the database has already been migrated.
- system-check evidence storage now lives in `packages/evidence-storage`, so API and worker share the same filesystem, inline, and S3-compatible blob lifecycle behavior.
- `npm run start:dispatcher` now uses Postgres queue notifications for monitor-command delivery wakeups and a timed maintenance cadence for expiry, while `--once` keeps a deterministic single-cycle mode for tests and debugging.
- `npm run start:notifications` owns breach-notification delivery orchestration, retry scheduling, and dead-letter transitions behind the same workspace outbox, while the shared `packages/outbound-messaging` package owns provider-specific channel selection, spike adapter behavior, and provider receipt semantics; `--once` keeps a deterministic single-cycle mode for tests and debugging.
- `npm run start:provider-operations` owns notification provider-profile operational-state refresh with active credential and target probes, respects per-profile target-probe skip policy, persists probe-specific readiness details (`probeStatus`, `probeTarget`, `probeLatencyMs`), evaluates workspace-effective notification-provider-promotion policy for auto-promote and auto-rollback actions on workspace override profiles, opens persisted provider incidents plus suppression-aware profile incident state on auto-rollback, resolves queued incidents on later promotion, and records audit events only when a provider profile's operational outcome or rollout automation state changes; `--once` keeps a deterministic single-cycle mode for tests and debugging.
- `npm run start:worker` still runs as a polling loop, while `--once` keeps a deterministic single-cycle mode for tests and debugging; timed-run persistence now honors effective workspace operational policy rather than only process-wide defaults, and evidence payload purge plus evidence-hold SLA escalation now honor effective workspace policy while skipping evidence under an active retention hold where appropriate.
- Monitor pause/resume/unlock requests now enqueue commands first; the dispatcher owns delivery, application, rejection, and expiry transitions.
- `npm run build` and `npm run typecheck` now compile the explicit project list directly because the root `tsc -b` reference graph hit an intermittent TypeScript stack-overflow path in this environment.
- `npm run test:contracts` runs the contract harness directly from TypeScript source with `node --experimental-strip-types` because the same TypeScript stack-overflow path still affects the large harness file even after narrowing the regular project build graph.
