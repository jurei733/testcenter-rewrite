# Testcenter Rewrite Initial Backlog

## Purpose

This document turns `Slice 0` to `Slice 2` into an initial execution backlog.

It is intentionally biased toward the first rewrite phase:

- contract freeze
- tenant-aware skeleton
- import edge and canonical content core

It is not the full program backlog. It is the startup backlog that should get the rewrite onto stable rails.

## Scope Boundary

This backlog covers:

- `Slice 0. Legacy Contract Freeze`
- `Slice 1. Tenant-Aware Walking Skeleton`
- `Slice 2. Import Edge And Content Release Core`

from [rewrite-delivery-slices.md](/Users/julian/Documents/Codex/2026-04-21-https-github-com-iqb-berlin-testcenter/rewrite-delivery-slices.md).

## Working Rules

### Definition Of Ready

A backlog item is ready when:

- tenant and workspace scope is explicit
- the canonical nouns match the model docs
- acceptance criteria are testable
- dependencies are known
- it is clear whether the item is product behavior, infrastructure, or migration support

### Definition Of Done

A backlog item is done when:

- the contract behavior is implemented
- audit and observability requirements are covered
- tenant isolation is verified where relevant
- acceptance checks pass
- open edge cases are either covered or explicitly deferred

## Priority Legend

- `P0`: blocks the rewrite critical path
- `P1`: needed inside the current slice
- `P2`: valuable but can trail the slice if the exit gate is still met

## Epic Overview

### Slice 0

- `S0-E1` Golden Fixtures And Traceability
- `S0-E2` Parity Inventory And Acceptance Mapping
- `S0-E3` Behavior Contract Documentation

### Slice 1

- `S1-E1` Tenant And Workspace Foundations
- `S1-E2` Admin Identity And Authorization Foundation
- `S1-E3` Request Context, Audit, And Operational Baseline
- `S1-E4` Admin Shell Walking Skeleton

### Slice 2

- `S2-E1` Source Package Intake
- `S2-E2` Import Job Lifecycle
- `S2-E3` XML Validation And Canonical Transformation
- `S2-E4` Content Release Registry And Activation
- `S2-E5` Content Inspection And Dependency Graph

## Slice 0. Legacy Contract Freeze

## `S0-E1` Golden Fixtures And Traceability

Priority:

- `P0`

Goal:

- freeze the real product contract into representative artifacts

Stories:

1. Collect representative XML workspaces covering login variants, booklet states, runtime modes, monitor flows, attachments, and sys-check.
2. Create a versioned fixture catalog with human-readable labels and known purpose.
3. Create reference exports for responses, logs, review, and sys-check outputs.
4. Record fixture provenance so each fixture can be traced back to legacy source files and expected behaviors.

Acceptance criteria:

- at least one golden fixture exists for each major capability area in the feature matrix
- every fixture has an owner, purpose statement, and expected behavior summary
- export fixtures are reproducible from the legacy app

Dependencies:

- access to representative legacy content and exports

Main risk:

- freezing too few fixtures and missing edge-case behavior later

## `S0-E2` Parity Inventory And Acceptance Mapping

Priority:

- `P0`

Goal:

- convert legacy behavior into named parity suites

Stories:

1. Classify existing Cypress tests by capability area and rewrite slice.
2. Mark each legacy scenario as `v1 parity`, `v1 improved`, or `post-v1` according to the agreed matrix.
3. Create a parity suite index that maps fixtures, scenarios, and expected outputs.
4. Define the minimum acceptance suites required to exit `Slice 0`, `Slice 1`, and `Slice 2`.

Acceptance criteria:

- parity inventory covers participant, monitoring, review, admin, attachment, and sys-check flows
- every acceptance suite maps back to at least one concrete fixture
- no `v1 parity` behavior remains unclassified

Dependencies:

- `S0-E1`

Main risk:

- test coverage gives a false sense of parity because business scenarios were not mapped precisely

## `S0-E3` Behavior Contract Documentation

Priority:

- `P1`

Goal:

- document legacy semantics that are easy to misread from routes or UI alone

Stories:

1. Document runtime mode semantics, including hot-return, hot-restart, review, and monitor-linked behavior.
2. Document monitor command semantics and acknowledgement expectations.
3. Document starter semantics for multi-booklet, resume, and assignment resolution.
4. Document how booklet state overrides behave in legacy content naming and import logic.

Acceptance criteria:

- each documented behavior has a short narrative, source reference, and expected runtime effect
- mode and monitor semantics are reviewed against both code and existing tests

Dependencies:

- `S0-E1`
- `S0-E2`

Main risk:

- undocumented semantics getting reinvented incorrectly during implementation

## Slice 1. Tenant-Aware Walking Skeleton

## `S1-E1` Tenant And Workspace Foundations

Priority:

- `P0`

Goal:

- establish the multi-tenant boundary as a hard platform rule

Stories:

1. Create core tenant and workspace schema, keys, and status model.
2. Implement platform APIs for tenant lifecycle.
3. Implement tenant APIs for workspace lifecycle.
4. Add tenant and workspace resolution middleware to all scoped requests.
5. Add tenant isolation checks to persistence and query layers.

Acceptance criteria:

- tenants can be created, listed, suspended, and reactivated
- workspaces can be created and updated under a tenant
- cross-tenant access attempts are rejected and audited
- every workspace-scoped record carries tenant and workspace identity

Dependencies:

- `S0-E2`

Main risk:

- tenant isolation getting bolted on later instead of encoded from day one

## `S1-E2` Admin Identity And Authorization Foundation

Priority:

- `P0`

Goal:

- establish trusted operator access before feature growth

Stories:

1. Implement admin user model and password credential storage.
2. Implement platform-admin and tenant-admin role assignments.
3. Implement sign-in, sign-out, current-session, and forced password rotation.
4. Add authorization guards for platform, tenant, and workspace operations.
5. Add brute-force protections and security lock handling for admin auth.

Acceptance criteria:

- admin auth works across platform and tenant scopes
- role assignments are enforced consistently
- password rotation flow can be required and completed
- failed sign-in protection is observable and testable

Dependencies:

- `S1-E1`

Main risk:

- shipping a functional skeleton that operators cannot safely use

## `S1-E3` Request Context, Audit, And Operational Baseline

Priority:

- `P0`

Goal:

- make the rewrite observable and supportable from the first real slice

Stories:

1. Implement request IDs, structured logging, and common error envelope behavior.
2. Implement audit event persistence for admin actions.
3. Implement health and readiness endpoints for web, API, and worker roles.
4. Implement object-storage conventions and secure access primitives.
5. Define metrics for auth, tenant access, import jobs, and error rates.

Acceptance criteria:

- every privileged write emits an audit event
- every API response can be correlated with a request ID
- core deployable roles expose usable health signals
- object-storage access is scoped and non-public by default

Dependencies:

- `S1-E1`
- `S1-E2`

Main risk:

- discovering basic operational blind spots after the system already has real users

## `S1-E4` Admin Shell Walking Skeleton

Priority:

- `P1`

Goal:

- prove the end-to-end admin path before import and runtime work scale up

Stories:

1. Create admin shell with sign-in, tenant selection, workspace selection, and guarded navigation.
2. Implement a basic tenant dashboard.
3. Implement a basic workspace dashboard.
4. Surface audit, health, and session information in the shell where useful.

Acceptance criteria:

- an admin can sign in and reach tenant and workspace views without dead ends
- unauthorized sections are hidden or rejected consistently
- the shell can host future slices without structural rework

Dependencies:

- `S1-E1`
- `S1-E2`
- `S1-E3`

Main risk:

- backend-first work drifting without a usable operator-facing reference path

## Slice 2. Import Edge And Content Release Core

## `S2-E1` Source Package Intake

Priority:

- `P0`

Goal:

- receive and persist source packages safely and traceably

Stories:

1. Implement source package upload API and storage flow.
2. Store raw artifact metadata, manifest hash, and uploader context.
3. Support archive upload and multi-part artifact upload modes if needed for large packages.
4. Implement source package listing and detail inspection in the admin shell.

Acceptance criteria:

- uploaded packages are immutable and traceable
- large or multi-file uploads are handled without ad hoc manual work
- workspace admins can see package status and metadata

Dependencies:

- `S1-E1`
- `S1-E3`
- `S1-E4`

Main risk:

- weak traceability between raw uploaded files and later canonical content

## `S2-E2` Import Job Lifecycle

Priority:

- `P0`

Goal:

- turn source packages into explicit, observable jobs

Stories:

1. Implement import job creation, status tracking, cancellation, and retry-safe behavior.
2. Persist import messages with severity, scope, and source references.
3. Implement worker-side job execution plumbing.
4. Add admin views for job history and current status.

Acceptance criteria:

- import jobs have stable lifecycle states
- import status is visible without reading logs directly
- cancellation behavior is explicit and safe

Dependencies:

- `S2-E1`
- `S1-E3`

Main risk:

- import behavior becoming opaque and impossible to support in production

## `S2-E3` XML Validation And Canonical Transformation

Priority:

- `P0`

Goal:

- prove the legacy XML contract can be interpreted into the new canonical model

Stories:

1. Implement schema-level validation for source artifacts.
2. Implement cross-file validation for units, booklets, resources, login collections, sys-checks, and attachments.
3. Transform valid packages into canonical entities and release-scoped identifiers.
4. Preserve source-key traceability in diagnostics and canonical inspection.
5. Explicitly model `BookletAssignment` and initial state overrides in the transformation layer.

Acceptance criteria:

- representative fixture packages import with useful validation messages
- invalid packages fail with precise, source-referenced diagnostics
- canonical entities are release-scoped and immutable after creation
- booklet assignment semantics survive transformation faithfully

Dependencies:

- `S0-E1`
- `S0-E3`
- `S2-E1`
- `S2-E2`

Main risk:

- flattening legacy semantics and discovering it only during runtime implementation

## `S2-E4` Content Release Registry And Activation

Priority:

- `P0`

Goal:

- establish immutable canonical releases as the new operational content boundary

Stories:

1. Implement content release creation from successful import jobs.
2. Implement release status transitions and activation rules.
3. Enforce one active release per workspace.
4. Implement release metadata, provenance, and activation audit trail.
5. Prevent mutation of activated or completed releases except through explicit lifecycle commands.

Acceptance criteria:

- a workspace can view and activate one imported content release
- release activation is audited and concurrency-safe
- runtime-facing code can resolve the active release without touching raw source packages

Dependencies:

- `S2-E3`

Main risk:

- source-package concerns leaking into runtime and admin behavior

## `S2-E5` Content Inspection And Dependency Graph

Priority:

- `P1`

Goal:

- give operators enough visibility to trust imported content before runtime exists

Stories:

1. Implement inspection endpoints for units, booklets, login collections, sys-checks, and attachments inside a content release.
2. Implement dependency graph generation between key content objects.
3. Surface unresolved or risky dependencies in inspection views.
4. Add links from validation messages into inspection views where possible.

Acceptance criteria:

- admins can inspect the contents of a release without raw DB access
- dependency relationships are visible for representative fixture sets
- validation findings can be traced into the canonical model

Dependencies:

- `S2-E3`
- `S2-E4`

Main risk:

- operators cannot understand what an imported release actually contains

## Cross-Cutting Startup Tasks

These should be planned alongside the slice backlog, not after it.

### `X-E1` Development Platform Bootstrap

Priority:

- `P0`

Scope:

- repo structure
- local environment bootstrap
- migration tooling
- CI baseline
- code quality gates

### `X-E2` Acceptance Harness Bootstrap

Priority:

- `P0`

Scope:

- fixture loading utilities
- contract test helpers
- parity suite naming and tagging
- snapshot or golden-output comparison harness

### `X-E3` Security And Compliance Baseline

Priority:

- `P1`

Scope:

- secret management conventions
- password hashing policy
- object-storage access policy
- audit retention defaults
- tenant data boundary checks

## Recommended Execution Order

1. `S0-E1`
2. `S0-E2`
3. `S0-E3`
4. `X-E1`
5. `S1-E1`
6. `S1-E2`
7. `S1-E3`
8. `S1-E4`
9. `S2-E1`
10. `S2-E2`
11. `S2-E3`
12. `S2-E4`
13. `S2-E5`
14. `X-E2`
15. `X-E3`

## Recommendation

If we want the rewrite to feel real quickly, the first visible milestone should be:

- an admin signs into a tenant-aware shell
- uploads a legacy source package
- starts an import job
- sees validation messages
- activates a canonical content release

That is the first moment where the new system stops being a plan and starts becoming a platform.
