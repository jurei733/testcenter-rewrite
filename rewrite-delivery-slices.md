# Testcenter Rewrite Delivery Slices

## Purpose

This document turns the roadmap, module map, and API contract into staffed delivery slices.

It is meant to answer:

- what we build first
- what can run in parallel
- what each slice must prove before the next one is trusted
- where parity risk is concentrated

## Planning Assumptions

- one shared product owner or decision group
- one architecture owner across all slices
- three to five delivery engineers or pods in parallel
- no big-bang release
- tenant-by-tenant migration, not global cutover

## Team Lanes

Use lanes rather than hard team silos. The lane model keeps accountability clear without locking the rewrite into the current org chart.

### Lane A. Platform

Owns:

- tenant model
- auth
- authorization
- audit
- baseline admin shell

### Lane B. Content

Owns:

- source upload
- XML validation
- canonical transformation
- content release inspection

### Lane C. Runtime

Owns:

- participant starter
- test-run lifecycle
- player integration
- monitor command application

### Lane D. Operations

Owns:

- monitor UI and projections
- review and reporting
- attachments
- sys-check
- configuration UX

## Slice Sequence

## Slice 0. Legacy Contract Freeze

Goal:

- define the parity target in executable terms

Must produce:

- golden XML fixture set
- golden export fixture set
- classified Cypress parity inventory
- documented mode semantics
- documented monitor command semantics

Exit gate:

- nobody is still arguing about what `v1 parity` means

Main risk reduced:

- building the wrong replacement faithfully

## Slice 1. Tenant-Aware Walking Skeleton

Goal:

- prove the new platform can carry tenant and workspace boundaries end to end

Lane focus:

- Lane A primary
- Lane D support for admin shell

Must ship:

- tenant and workspace CRUD
- admin sign-in and sign-out
- role assignment foundation
- request context resolution
- audit event plumbing
- health and readiness endpoints

Exit gate:

- an admin can sign in, switch tenant/workspace context, and perform audited workspace actions

## Slice 2. Import Edge And Content Release Core

Goal:

- prove XML can land in the new system and become canonical content

Lane focus:

- Lane B primary
- Lane A support for permissions and storage

Must ship:

- source package upload
- import job lifecycle
- validation messages
- canonical content release persistence
- activation workflow
- dependency graph inspection

Exit gate:

- representative XML fixtures import successfully or fail with useful diagnostics
- a workspace can activate a content release

Main risk reduced:

- content-model mismatch between legacy XML and rewrite domain

## Slice 3. Participant Auth And Starter

Goal:

- prove participants can enter the rewrite safely before full runtime parity exists

Lane focus:

- Lane C primary
- Lane A support for participant auth and rate limiting

Must ship:

- link-based login
- username/password login
- username-only login
- two-step code login
- starter context
- launch or resume decisioning

Exit gate:

- all legacy login variants are supported against imported content
- starter behavior matches the contract for multi-booklet and resume cases

Main risk reduced:

- underestimating the complexity of the real entry flows

## Slice 4. Runtime Vertical Slice

Goal:

- run one real booklet end to end with save and resume

Lane focus:

- Lane C primary
- Lane B support for runtime projections

Must ship:

- test-run creation
- runtime projection for active unit
- response save
- resume
- completion
- append-only runtime event log

Exit gate:

- a participant can start, answer, disconnect, resume, and complete a representative test run

## Slice 5. Runtime Policy Parity

Goal:

- close the gap between basic runtime and real production behavior

Must ship:

- timing policies
- navigation restrictions
- mode handling
- hot-return and hot-restart semantics
- review-mode handling
- adaptive progression
- unlock and controlled transitions

Exit gate:

- parity suite passes for runtime-specific legacy scenarios

Main risk reduced:

- the classic trap where the rewrite works for demos but not for controlled study operations

## Slice 6. Monitor And Command Plane

Goal:

- restore operator trust with real-time visibility and reliable control

Lane focus:

- Lane D primary for operator views
- Lane C primary for command application

Must ship:

- group monitor projection
- study monitor projection
- real-time event delivery
- command dispatch
- command acknowledgement states
- pause, resume, jump, unlock, and terminate flows

Exit gate:

- operator actions are visible, persisted, and acknowledged consistently

Main risk reduced:

- silent desync between UI, runtime, and operator intent

## Slice 7. Review And Export Parity

Goal:

- prove the rewrite can produce operationally usable outputs

Lane focus:

- Lane D primary
- Lane B support for source traceability

Must ship:

- review detail screens
- response export
- log export
- review export
- export job model
- download and retention rules

Exit gate:

- rewrite exports are accepted against the frozen fixture set

Main risk reduced:

- discovering too late that data consumers rely on subtle legacy output details

## Slice 8. Attachments Parity

Goal:

- restore the full attachment workflow without hiding it behind legacy fallbacks

Lane focus:

- Lane D primary
- Lane C support for participant flow integration

Must ship:

- attachment request resolution
- upload slot creation
- QR handoff or generated page flow
- attachment completion and deletion
- operator review and download

Exit gate:

- representative attachment scenarios pass end to end in parity tests

Main risk reduced:

- attachment handling getting pushed aside because it feels peripheral even though it is operationally critical

## Slice 9. SysCheck Parity

Goal:

- restore the full system-check flow as a first-class module

Lane focus:

- Lane D primary
- Lane C support for participant launch surfaces

Must ship:

- sys-check session creation
- questionnaire flow
- metric submission
- result persistence
- sys-check reporting

Exit gate:

- the rewrite can execute and store representative sys-check scenarios end to end

Main risk reduced:

- treating sys-check as a side utility instead of part of the real product contract

## Slice 10. Configuration, Branding, And Hardening

Goal:

- make the rewrite operationally adoptable for real tenants

Lane focus:

- Lane A and Lane D

Must ship:

- tenant branding
- workspace custom texts
- maintenance mode
- legal and theme settings
- audit browsing
- performance hardening
- observability dashboards
- migration tooling

Exit gate:

- pilot tenants can be onboarded without direct engineering intervention for routine configuration

## Slice 11. Pilot Migration And Cutover Readiness

Goal:

- prove migration with a real tenant before broad rollout

Must ship:

- pilot tenant rehearsal
- data migration checklist
- rollback playbook
- support runbook
- cutover scorecard

Exit gate:

- one pilot tenant is accepted on the rewrite with no legacy bridge for core flows

## Cross-Slice Rules

## Contract Freeze Rule

Do not let each lane invent its own nouns. The canonical model and API names should stay stable after Slice 2.

## Golden Fixture Rule

Every parity-heavy slice must be judged against the same frozen fixtures, not ad hoc demos.

## No Hidden Legacy Bridge Rule

If a slice quietly delegates to the legacy app, mark it as incomplete. That may be a useful migration tactic later, but it should not be mislabeled as parity.

## Observability Rule

Every new slice emits:

- audit events
- structured logs
- latency/error metrics

That work is part of the slice, not polish for later.

## Suggested Staffing Shape

For a medium-size rewrite team:

- Platform lane: 1 to 2 engineers
- Content lane: 1 to 2 engineers
- Runtime lane: 2 engineers
- Operations lane: 1 to 2 engineers

If the team is smaller, merge Platform and Content first. Do not merge Runtime and Operations too early, because monitor/control behavior needs an independent operator perspective.

## Recommendation

Use this as the program board:

1. Slice 0 to Slice 2 define the contract and platform
2. Slice 3 to Slice 6 create the operational core
3. Slice 7 to Slice 10 close the parity and adoption gaps
4. Slice 11 proves real migration readiness

The rewrite is only truly credible after Slice 6. Before that point, the new system may be promising, but it is not yet a replacement for a live testing operation.
