# ADR-002: Choose A TypeScript-First Delivery Stack

## Status

Proposed

## Date

2026-04-21

## Context

The rewrite has already chosen:

- a tenant-aware modular monolith
- XML ingestion with a new canonical internal model
- multi-tenant operation from day one
- full `v1` parity for attachments and sys-check

The remaining question is the concrete stack direction.

The choice should optimize for:

- product delivery speed
- shared contract clarity across frontend and backend
- safe handling of realtime and background jobs
- long-term maintainability
- low operational burden for a medium-sized team

## Evaluation Criteria

The stack should score well on these factors:

1. Strong support for browser-first product work
2. Clear modular-backend architecture
3. Excellent PostgreSQL support
4. Good realtime support
5. Good background-job support
6. Strong testing ecosystem for contract and end-to-end tests
7. Good hiring and onboarding profile
8. Reasonable local developer experience
9. No unnecessary polyglot complexity

## Shortlist

### Option A. TypeScript Frontend And TypeScript Backend

Shape:

- React or Angular web client
- Node-based API and worker runtime
- PostgreSQL
- S3-compatible object storage

Strengths:

- one dominant product language across UI and API
- shared schemas and contract tooling are straightforward
- strong frontend talent pool
- good realtime libraries and good job-processing options

Risks:

- weaker compile-time guarantees than JVM or .NET options
- discipline is needed to keep backend architecture clean

### Option B. TypeScript Frontend And Kotlin Backend

Shape:

- React or Angular web client
- Kotlin or Spring-based API and worker runtime
- PostgreSQL
- S3-compatible object storage

Strengths:

- very strong backend structure and type safety
- strong concurrency and transaction tooling
- excellent long-term maintainability for complex domains

Risks:

- two main implementation languages instead of one
- slower feedback loop for teams with stronger frontend than JVM depth

### Option C. TypeScript Frontend And .NET Backend

Shape:

- React or Angular web client
- ASP.NET Core API and worker runtime
- PostgreSQL
- S3-compatible object storage

Strengths:

- strong backend structure
- strong tooling and good performance
- solid background-job and web platform support

Risks:

- still polyglot
- less likely to align with teams that are already TypeScript-heavy

## Decision

The recommended direction is **TypeScript-first across the product surface**.

That means:

- TypeScript web client
- TypeScript API and worker codebase
- PostgreSQL as the transactional database
- S3-compatible object storage
- a queue or pubsub layer only where actually justified by jobs or realtime fan-out

This is a direction decision, not yet a framework lock.

## Why This Direction

### It reduces rewrite coordination cost

The rewrite already has a lot of domain complexity. One dominant product language lowers cognitive overhead.

### It keeps API and UI contracts close

Participant runtime, monitoring, and admin UX all depend on fast iteration around shared contracts. A TypeScript-first approach helps there.

### It suits the likely staffing model

A medium-sized rewrite team usually benefits from more engineers being able to move across boundaries when needed.

### It still supports disciplined architecture

A weak system shape would be a problem in any language. With a modular monolith, clear packages, schema validation, and strong testing, TypeScript is sufficient for this domain.

## Framework Recommendation Inside This Direction

Recommended starting point:

- React for the new web application
- a Node-based modular backend with strong module boundaries and explicit request schemas
- PostgreSQL
- S3-compatible object storage

Why React is the current recommendation:

- easier composition of distinct participant, monitor, and admin surfaces
- broad ecosystem for modern state and routing patterns
- lower risk of carrying current Angular-era assumptions into the rewrite

Why the backend recommendation stays one level abstract for now:

- the more important decision is modular shape and contract discipline
- framework choice should follow a short proof-of-architecture spike, not habit

## Rejected Direction

### Keep The Legacy Polyglot Split

Rejected.

Why:

- it preserves today’s fragmentation
- it slows down contract evolution
- it keeps too many execution models in play during a parity-heavy rewrite

## Consequences

### Positive

- simpler staffing and onboarding
- shared models and contract tooling become realistic
- easier to move engineers between participant, monitor, and admin work

### Negative

- backend boundaries need active discipline
- the team must resist frontend-style convenience patterns leaking into backend core modules

## Required Follow-Ups

Before accepting this ADR formally:

1. run a short proof-of-architecture spike for the modular backend structure
2. choose the concrete web framework and backend framework inside the TypeScript-first direction
3. define validation, serialization, and migration conventions
4. confirm the direction against actual team skill availability
