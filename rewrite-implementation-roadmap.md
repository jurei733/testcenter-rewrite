# Testcenter Rewrite Implementation Roadmap

## Purpose

This document converts the target architecture into an execution plan.

It focuses on:

- workstreams
- milestone sequencing
- dependencies
- parity gates
- test strategy
- cutover readiness

It assumes the decisions and architecture from:

- [rewrite-feature-matrix.md](/Users/julian/Documents/Codex/2026-04-21-https-github-com-iqb-berlin-testcenter/rewrite-feature-matrix.md)
- [rewrite-target-architecture.md](/Users/julian/Documents/Codex/2026-04-21-https-github-com-iqb-berlin-testcenter/rewrite-target-architecture.md)

## Delivery Strategy

The rewrite should not be executed as one giant “replace everything” phase.

It should use:

- one shared target architecture
- one prioritized backlog
- a thin end-to-end walking skeleton early
- vertical milestones with explicit parity gates
- tenant-by-tenant migration readiness instead of a global big bang

## Recommended Workstreams

### Workstream A. Platform Foundation

Scope:

- tenant model
- auth foundation
- role model
- workspace model
- audit foundation
- storage conventions
- operational environment

Delivers:

- tenant-aware application shell
- admin authentication
- platform admin and tenant admin primitives
- DB and object storage conventions

### Workstream B. Canonical Import And Content Registry

Scope:

- source upload
- XML validation
- semantic cross-validation
- canonical transformation
- content release model
- dependency graph

Delivers:

- import pipeline
- validation reports
- canonical content graph
- immutable content releases

### Workstream C. Participant Runtime

Scope:

- login flows
- starter logic
- test launch
- player integration
- save/resume
- mode engine
- restrictions and adaptivity

Delivers:

- participant app parity
- runtime APIs
- session persistence

### Workstream D. Monitoring And Control

Scope:

- realtime event model
- group monitor
- study monitor
- command dispatch
- command acknowledgements
- websocket and fallback transport

Delivers:

- operator console parity
- monitor projections
- command safety rails

### Workstream E. Reporting, Review, SysCheck, And Attachments

Scope:

- response/log/review/sys-check exports
- review flows
- detailed inspection
- system check
- attachment workflows
- QR and generated page flows

Delivers:

- export parity
- review parity
- sys-check parity
- attachment parity

### Workstream F. Configuration And Admin UX

Scope:

- branding
- custom texts
- maintenance banners
- legal notice
- themes
- workspace administration UX
- tenant settings UX

Delivers:

- admin console parity
- settings governance
- improved configuration UX

## Parallelization Strategy

### Critical Path

The critical path is:

1. platform foundation
2. canonical import
3. participant runtime
4. monitoring
5. exports and parity validation
6. migration hardening

### Parallel Work That Can Start Early

- admin UX shell can start once auth and tenant/workspace primitives exist
- sys-check and attachments domain modeling can start as soon as canonical content design is stable
- audit and observability work should begin with the platform foundation, not near the end
- export parity fixtures can be prepared before the rewrite implementations exist

## Milestone Plan

## Milestone 0. Legacy Contract Freeze

Goal:

- define what “done” means before building

Scope:

- freeze representative XML fixtures
- freeze representative export outputs
- classify Cypress flows into parity suites
- document monitor command semantics
- document mode semantics

Exit Criteria:

- golden fixture set exists
- feature matrix is accepted
- parity test inventory exists

## Milestone 1. Platform Skeleton

Goal:

- prove tenant-aware app skeleton end to end

Scope:

- tenant table and workspace table
- user and role model
- admin authentication
- audit event base schema
- object storage conventions
- health endpoints

Exit Criteria:

- tenant-aware admin login works
- a tenant can own workspaces
- all core resources carry tenant context
- audit events are emitted for admin actions

## Milestone 2. Import Pipeline And Content Release Model

Goal:

- prove XML can become canonical content

Scope:

- source package upload
- schema validation
- cross-file validation
- canonical content graph
- content release activation
- dependency graph display

Exit Criteria:

- sample workspace imports successfully
- invalid imports produce useful validation reports
- canonical release can be activated in a workspace
- dependency graph matches legacy semantics for core fixtures

## Milestone 3. Walking Skeleton Runtime

Goal:

- prove a participant can log in and launch a simple booklet from canonical content

Scope:

- participant login flows
- starter routing
- single booklet launch
- unit load
- response save
- state save
- resume

Exit Criteria:

- direct link login works
- username/password and two-step login work
- one fixture booklet runs end to end
- saved state survives reload

## Milestone 4. Runtime Parity

Goal:

- cover the difficult delivery semantics

Scope:

- mode engine
- hot-return and hot-restart semantics
- time restrictions
- unlock codes
- response/presentation restrictions
- leave/lock behavior
- adaptivity
- booklet config parity

Exit Criteria:

- parity suite passes for core runtime scenarios
- legacy and rewrite exports match for selected fixtures
- no known blocker remains in runtime semantics

## Milestone 5. Monitoring And Control

Goal:

- restore operator confidence

Scope:

- realtime event stream
- group monitor
- study monitor
- monitor profiles
- filters
- pause/resume/goto/terminate/unlock commands
- command audit trail

Exit Criteria:

- monitor views match legacy behavior on parity fixtures
- commands affect the right sessions
- command acknowledgements are persisted and visible
- websocket degradation still keeps monitor usable

## Milestone 6. Reporting And Review

Goal:

- restore data operations

Scope:

- response export
- log export
- review export
- detailed inspection
- deletion workflows
- review authoring/edit/delete

Exit Criteria:

- export golden files match agreed semantics
- deletion workflows are safe and audited
- review flows complete end to end

## Milestone 7. SysCheck And Attachments

Goal:

- complete the last high-risk parity areas

Scope:

- system-check starter and execution flow
- questionnaire and network checks
- report submission
- sys-check admin summaries
- attachment slots
- QR page generation
- capture-image workflow
- attachment file operations

Exit Criteria:

- sys-check parity suite passes
- attachment parity suite passes
- generated attachment pages work operationally
- no legacy bridge is required for pilot tenants

## Milestone 8. Admin Configuration And Hardening

Goal:

- finish operator-facing administration and harden multi-tenancy

Scope:

- branding
- custom texts
- maintenance banners
- legal notice
- theme support
- workspace admin UX improvements
- tenant admin UX
- security review
- tenant isolation review

Exit Criteria:

- admin parity suite passes
- tenant isolation tests pass
- settings changes are audited and previewable

## Milestone 9. Pilot Migration

Goal:

- migrate one or more pilot tenants safely

Scope:

- dual-run validation
- selective tenant import
- operator UAT
- rollback playbook
- cutover observability

Exit Criteria:

- at least one pilot tenant runs successfully on rewrite
- rollback has been tested
- operational dashboards are sufficient for support

## Parity Gates

Each milestone that claims parity should pass four gates:

### Gate 1. Behavior

- acceptance scenarios pass for the targeted domain

### Gate 2. Data

- exports or persisted states match agreed semantics

### Gate 3. Audit

- key actions produce traceable audit events

### Gate 4. Isolation

- tenant and role boundaries are enforced

## Risk-Based Test Strategy

## 1. Fixture-Based Import Tests

Purpose:

- protect XML compatibility and canonical transformation

Test Assets:

- valid sample workspaces
- intentionally broken XML fixtures
- duplicate ID/name fixtures
- adaptive booklet fixtures
- sys-check fixtures
- attachment-request fixtures

Assertions:

- validation output
- canonical graph correctness
- dependency graph correctness

## 2. Runtime Acceptance Tests

Purpose:

- protect participant-critical behavior

Priority scenarios:

- all login variants
- hot-return resume
- hot-restart new session behavior
- adaptive path changes
- time restriction enforcement
- response/presentation completion locks
- unlock code flow

Source:

- existing Cypress scenarios should be translated, not reinvented

## 3. Monitor Event And Command Tests

Purpose:

- protect realtime semantics

Assertions:

- event ordering
- projection updates
- command targeting
- acknowledgement flow
- degraded transport fallback

## 4. Export Golden Tests

Purpose:

- protect operational trust

Artifacts:

- responses CSV
- logs CSV
- reviews CSV
- sys-check exports

Assertions:

- row semantics
- column semantics
- quoting and encoding rules where needed

## 5. Tenant Isolation Tests

Purpose:

- protect the new multi-tenant architecture

Assertions:

- cross-tenant access is denied
- storage paths remain tenant-scoped
- exports cannot mix tenant data
- monitor views cannot cross tenant boundaries

## 6. Security Tests

Purpose:

- protect admin and participant flows

Focus:

- password reset flow
- rate limiting / brute-force protection
- claim enforcement
- session invalidation
- admin action auditing

## 7. Operational Tests

Purpose:

- prove the system is operable, not just correct

Focus:

- import jobs under load
- export jobs under load
- websocket fanout behavior
- degraded cache or queue behavior
- object storage outage handling

## Recommended Proof Before Pilot Tenants

Before any pilot migration, the rewrite should demonstrate:

- successful import of representative workspaces
- participant runtime parity on high-risk scenarios
- command parity for group monitor
- export parity for all core report types
- sys-check parity
- attachment parity
- tenant isolation test pass
- rollback plan tested once

## Team Shape Recommendation

Recommended execution model:

- one architecture owner across all workstreams
- one product owner or equivalent decision-maker for parity calls
- domain leads for:
  - import/content
  - runtime
  - monitoring
  - data operations
  - tenant/admin platform

Avoid splitting by old technology boundaries. Split by product domain.

## Suggested Backlog Format

Every backlog item should carry:

- domain
- milestone
- parity type: `parity`, `improvement`, or `new`
- tenant impact
- migration risk
- acceptance evidence

Example:

- `Runtime / M4 / parity / high tenant impact / high migration risk / covered by acceptance suite RT-12`

## What To Design Next

The next useful planning artifact is the canonical domain model itself:

- aggregate list
- entity boundaries
- key identifiers
- versioning rules
- event model
- storage mapping
