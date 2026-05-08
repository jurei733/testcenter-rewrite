# ADR 003: Policy Boundaries Before Production Baseline

## Status

Accepted

## Context

The proof-of-architecture spike intentionally split policy behavior into many families so we could verify:

- tenant defaults versus workspace overrides
- per-family audit and history projections
- independent service behavior for runtime, governance, notifications, and retention

That gave us useful evidence, but it also produced a policy surface that is broader than we want to carry unchanged into the production rewrite.

At this point the spike has proven the following separate policy families:

- activation-policy
- operational-policy
- launch-approval-policy
- notification-provider-promotion-policy
- notification-policy
- governance-notification-policy
- recovery-governance-notification-policy
- governance-case-policy
- notification-provider-profiles
- evidence-retention-policy
- evidence-retention-class-policy

If we keep splitting policy families further before the production baseline, we increase migration, UI, and operator-training complexity without reducing enough architectural risk.

## Decision

For the production baseline, we will freeze policy-family growth and consolidate only where the spike has already proven the boundary is safe to collapse.

### Families that stay separate

These stay as distinct policy families in the production baseline:

- `activation-policy`
- `operational-policy`
- `launch-approval-policy`
- `notification-provider-promotion-policy`
- `notification-provider-profiles`
- `governance-case-policy`
- `evidence-retention-policy`
- `evidence-retention-class-policy`

They remain separate because they govern different operator responsibilities, different service loops, or different persistence and audit semantics.

### Families that consolidate

These spike-only families will be consolidated into one production family:

- `notification-policy`
- `governance-notification-policy`
- `recovery-governance-notification-policy`

They become one production-facing family:

- `outbound-notification-policy`

That consolidated family will still support distinct delivery scopes, but they will be modeled as typed channels inside one policy surface:

- `breach`
- `governance_incident`
- `governance_recovery`

The provider registry remains separate from that policy family.

## Consequences

### Positive

- Fewer production policy surfaces to document and maintain
- Simpler workspace admin UX
- Lower migration complexity from spike contract to production baseline
- Clearer rule: no more policy-family creation unless an existing family is provably the wrong boundary

### Negative

- The spike API surface is now intentionally a little broader than the production target
- We will need a consolidation step when we cut the production baseline
- Some spike tests prove distinctions that will later move behind one production policy envelope

## Guardrail

Before production baseline work starts, we do **not** add new policy families unless:

1. the new behavior cannot fit an existing family without breaking ownership or audit semantics, and
2. the benefit is larger than the cost of another operator-facing configuration surface

If those conditions are not met, we extend an existing family instead.

## Follow-up

The next implementation steps are:

1. finish the last spike-only governance and operator-read-model proofs
2. refactor oversized spike files into production-usable module boundaries
3. cut the production baseline with the consolidated policy model above
