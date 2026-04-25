# ADR-001: Adopt A Tenant-Aware Modular Monolith

## Status

Accepted

## Date

2026-04-21

## Context

The legacy system spreads product behavior across multiple technical layers and deployables:

- Angular frontend
- PHP backend
- Nest-based broadcaster
- nginx/lua file-serving logic
- XML as both import contract and practical runtime model

That split did not just create operational complexity. It also made the domain harder to reason about:

- delivery behavior is hard to isolate from transport and hosting details
- imports, runtime, monitoring, and exports are coupled indirectly
- cross-cutting changes require touching several technologies and execution models
- multi-tenancy is not the primary organizing principle

The rewrite goals are:

- support multi-tenant operation from day one
- preserve parity where it matters
- reduce operational surface area
- make imports, runtime, monitoring, sys-check, and attachments first-class modules
- keep XML support without making XML the runtime data model

## Decision

The rewrite will use a **tenant-aware modular monolith** as the default system shape.

This means:

- one primary application codebase for business logic
- one main relational database
- one object storage boundary
- background jobs for asynchronous work
- built-in realtime support for monitor and participant flows
- clear bounded contexts inside the codebase, but not separate microservices by default

Deployable roles may still be separated operationally:

- web or API process
- worker process
- realtime gateway process

But these roles should share:

- one domain model
- one codebase
- one migration history
- one contract vocabulary

## Why This Decision

### It matches the actual product shape

Testcenter is one operational product with tightly related workflows:

- imports feed content releases
- content releases feed runtime
- runtime feeds monitoring, review, exports, attachments, and sys-check

These are domain modules, not independent businesses.

### It reduces accidental complexity

A rewrite is already risky because product parity matters. We should not add extra risk by distributing the rewrite prematurely.

### It improves multi-tenant consistency

Tenant boundaries, auditing, and authorization are easier to keep consistent when they live in one coherent application core.

### It supports later extraction if truly needed

If the rewrite outgrows the modular monolith later, extraction is easier from strong module boundaries than from a service split chosen too early.

## Alternatives Considered

### Rebuild As Separate Services

Rejected for `v1`.

Why:

- too much coordination overhead
- too many failure modes in a parity-sensitive rewrite
- risks recreating today’s fragmentation in new tools

### Preserve The Legacy Service Split In New Languages

Rejected.

Why:

- it optimizes around current technical seams instead of product seams
- it would keep the same mental-model cost with fresher code

### Single Deployable With No Internal Module Boundaries

Rejected.

Why:

- that would create a simpler deployment shape but a messier long-term codebase

## Consequences

### Positive

- lower operational complexity
- one contract vocabulary across modules
- simpler transaction and consistency boundaries
- easier startup for a small rewrite team
- cleaner auditing and authorization story

### Negative

- the codebase will need disciplined modular boundaries or it will sprawl
- noisy internal coupling can still happen if ownership is weak
- performance-sensitive areas such as monitor realtime and export jobs need deliberate isolation inside the monolith

## Guardrails

To make this decision hold up in practice:

1. keep bounded contexts explicit in code and storage
2. keep API, worker, and realtime roles separate at the process level when useful
3. keep async jobs explicit rather than hidden inside request handlers
4. keep audit and tenant context mandatory across all write paths
5. do not let XML parsing leak into runtime or monitor modules

## Follow-Up Decisions

- choose the primary implementation stack within the modular-monolith shape
- define module ownership and package boundaries
- define event schema and job-processing conventions
