# Testcenter Rewrite Proof-Of-Architecture Spike

## Purpose

This spike is the bridge between planning and real implementation.

Its job is not to build the rewrite. Its job is to validate that the proposed direction can actually carry the hardest early requirements without hidden structural pain.

It is specifically meant to validate [rewrite-adr-002-stack-direction.md](/Users/julian/Documents/Codex/2026-04-21-https-github-com-iqb-berlin-testcenter/rewrite-adr-002-stack-direction.md).

## Timebox

Recommended timebox:

- 7 to 10 working days

If the spike needs longer, that is already a signal that the proposed stack or package boundaries may be too vague.

## Questions The Spike Must Answer

1. Can we keep tenant and workspace scope explicit end to end without awkward framework workarounds?
2. Can a TypeScript modular monolith keep domain modules clean instead of collapsing into route handlers and service glue?
3. Can we ingest one representative legacy fixture and produce a canonical `contentRelease` cleanly?
4. Can participant starter and runtime-facing APIs consume canonical content without touching raw XML?
5. Can realtime monitor events and command acknowledgements fit naturally into the same application model?
6. Can the testing approach support contract tests, fixture-based tests, and UI end-to-end tests without duplication chaos?

## Non-Goals

- full runtime parity
- full XML coverage
- polished UI
- production-ready security hardening
- final infrastructure automation

The spike should answer architecture questions, not accidentally become the rewrite.

## Recommended Scope

## 1. Repo And Package Skeleton

Create a monorepo or workspace layout that proves module boundaries.

Recommended shape to validate:

- `apps/web`
- `apps/api`
- `apps/worker`
- `packages/domain`
- `packages/contracts`
- `packages/db`
- `packages/ui`
- `packages/test-fixtures`
- `packages/test-harness`

Minimum expectation:

- the domain package contains canonical business nouns and policies
- the contracts package contains API DTOs, schema definitions, and event envelopes
- the API and worker packages depend on domain and contracts, not the other way around

## 2. Tenant And Auth Skeleton

Implement enough to prove the boundary model:

- platform admin sign-in
- tenant and workspace CRUD
- role-guarded workspace access
- request context resolution
- audit event emission for writes

This does not need full IAM parity. It only needs to prove the architecture can represent scope cleanly.

## 3. One Import Vertical Slice

Use one representative golden fixture.

Implement:

- source package upload
- import job creation
- validation message persistence
- transformation into canonical content
- content release creation
- release activation

Canonicalization must explicitly include:

- at least one `BookletDefinition`
- at least one `LoginCollection`
- at least one `BookletAssignment`
- preserved source-key traceability

## 4. One Participant Starter Vertical Slice

Implement:

- participant login against imported fixture data
- starter context response
- launch endpoint that resolves a `bookletAssignment`

The spike does not need the full player runtime. It only needs to prove that starter and launch behavior can be driven from canonical data.

## 5. One Realtime Monitor Slice

Implement:

- one monitor subscription channel
- one command endpoint such as pause or unlock
- one acknowledgement path from command accepted to command applied

The point is to prove that:

- realtime and persistence can share one coherent model
- command state is explicit

## 6. Test Harness Bootstrap

Implement:

- fixture loader
- contract tests for tenant and import APIs
- one end-to-end path covering admin upload to release activation
- one end-to-end path covering participant login to starter launch

## Deliverables

The spike should end with these artifacts:

1. runnable repo skeleton
2. one imported golden fixture persisted as a canonical release
3. API endpoints for tenant/workspace, import job, release activation, participant starter, and one monitor command
4. minimal UI shell proving admin and participant entry paths
5. test harness with at least a few stable fixture-based tests
6. short spike findings note listing what worked, what felt wrong, and what should change before full implementation

## Success Criteria

The spike succeeds if:

- tenant and workspace scope are present in storage, API, and UI paths without duplicated ad hoc logic
- canonical content can be created and activated without leaking XML parsing into runtime paths
- participant starter can resolve from canonical content and `BookletAssignment`
- command acknowledgements can be modeled as persisted state plus realtime updates
- package boundaries still look clean after the vertical slice is built
- the team feels the stack accelerates rather than complicates the domain

## Failure Signals

The spike should be treated as a warning if:

- tenant scope is awkward to thread through handlers and persistence
- the domain package becomes a thin wrapper around framework services
- import transformation logic is inseparable from HTTP or worker plumbing
- the contracts package becomes tightly coupled to database or framework types
- command acknowledgement state requires special-case hacks
- the repo structure encourages circular dependencies

## Recommended Spike Sequence

1. establish repo skeleton and package conventions
2. implement DB schema bootstrap and tenant or workspace basics
3. implement admin auth and request context
4. implement source package upload and import jobs
5. implement canonical transformation for one fixture
6. implement release activation and inspection
7. implement participant starter
8. implement one monitor command and event flow
9. add contract and end-to-end tests
10. write spike findings and go or no-go recommendation

## Recommended Repo Shape

This is the repo layout the spike should try to prove.

```text
apps/
  web/
  api/
  worker/
packages/
  domain/
    platform/
    iam/
    ingestion/
    content/
    runtime/
    monitor/
    attachments/
    syscheck/
    reporting/
  contracts/
    api/
    events/
    schemas/
  db/
    migrations/
    repositories/
    projections/
  ui/
    admin/
    participant/
    monitor/
  test-fixtures/
  test-harness/
```

Guardrails for this shape:

- `domain` must not import from framework-specific web or worker code
- `contracts` must stay serializable and transport-oriented
- `db` adapts persistence to the domain instead of becoming the business layer
- `ui` should consume contracts, not hidden server internals

## Decision At Spike End

At the end of the spike, make one explicit decision:

- `accept stack direction`
- `accept with boundary changes`
- `reject and switch direction`

The worst outcome would be to run the spike, see warning signs, and still drift into full implementation without acknowledging them.
