# Testcenter Rewrite API Contract

## Purpose

This document turns the module map into a concrete API contract draft.

It defines:

- API surface areas
- tenancy and auth rules
- synchronous vs asynchronous boundaries
- command and event semantics
- response conventions
- the minimum stable contract needed before implementation

It is still technology-agnostic. It does not choose a framework, but it does choose the shape of the external contract.

## Design Principles

### 1. Tenant Awareness Is Explicit

- every admin-facing request resolves a tenant context
- every workspace-facing request resolves both tenant and workspace context
- platform-admin APIs stay separate from tenant-scoped APIs

Recommended path convention:

- platform scope: `/api/v1/platform/...`
- tenant scope: `/api/v1/tenants/{tenantKey}/...`
- workspace scope: `/api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/...`

### 2. XML Is An Ingestion Contract Only

- XML and related artifacts are uploaded and validated at the import edge
- runtime and monitor APIs speak only canonical rewrite concepts
- activation always happens against a `contentRelease`, never against raw XML files

### 3. Split Query APIs From Command APIs When Behavior Matters

- use normal CRUD-shaped endpoints for stable resources
- use explicit command endpoints for behavior-heavy transitions
- prefer `POST ...:commandName` when an operation is not a plain create/update/delete

Examples:

- `POST /test-runs/{testRunId}:pause`
- `POST /content-releases/{contentReleaseId}:activate`
- `POST /monitor-sessions/{monitorSessionId}:jump`

### 4. Async Work Uses Jobs

Imports, exports, projection rebuilds, and generated asset creation should use explicit jobs.

Job rules:

- create job with `POST`
- poll with `GET`
- cancel when safe with `DELETE` or `POST ...:cancel`
- expose machine-readable status and human-readable messages

### 5. Realtime Is First-Class

- monitors should not depend on polling as the main path
- participant and monitor clients can subscribe to scoped channels
- every realtime event must be replayable from persisted state

### 6. Errors Are Structured

Use a common error envelope:

```json
{
  "error": {
    "code": "content_release_not_active",
    "message": "The requested content release is not active in this workspace.",
    "details": {
      "workspaceKey": "demo-workspace",
      "contentReleaseId": "01H..."
    },
    "requestId": "01H..."
  }
}
```

### 7. Concurrency Is Explicit

- mutable admin resources use optimistic concurrency with `etag` or `version`
- long-lived participant state changes use append-only events plus current-state projections
- monitor commands return acknowledgement state, not just `200 OK`

## Common Contract Rules

## Authentication

### Admin APIs

- session cookie for browser clients
- optional bearer token for automation/integration clients
- roles resolved at platform, tenant, or workspace scope

### Participant APIs

- short-lived participant session token after successful login
- token bound to one `testRun` or starter context
- no admin session can call participant-only endpoints by accident

## Standard Headers

- `X-Request-Id`
- `Idempotency-Key` for create/command endpoints that may be retried
- `If-Match` for mutable resource updates

## Standard Envelope Choices

Recommended:

- lists return `items`, `page`, `pageSize`, `total`
- single resources return the resource directly
- commands return `status`, `acceptedAt`, and `resultRef` when asynchronous

## Primary API Surfaces

## 1. Platform And Tenant Administration

### Platform Admin

- `POST /api/v1/platform/tenants`
  - create tenant
- `GET /api/v1/platform/tenants`
  - list tenants with status and counts
- `GET /api/v1/platform/tenants/{tenantKey}`
  - tenant detail
- `PATCH /api/v1/platform/tenants/{tenantKey}`
  - rename, suspend, reactivate, update limits
- `POST /api/v1/platform/tenants/{tenantKey}:suspend`
- `POST /api/v1/platform/tenants/{tenantKey}:reactivate`

### Tenant Admin

- `POST /api/v1/tenants/{tenantKey}/workspaces`
- `GET /api/v1/tenants/{tenantKey}/workspaces`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}`
- `PATCH /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}`
- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}:archive`
- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}:restore`

## 2. Identity And Access

### Admin Auth

- `POST /api/v1/admin/auth/sign-in`
- `POST /api/v1/admin/auth/sign-out`
- `GET /api/v1/admin/auth/current-session`
- `POST /api/v1/admin/auth/rotate-password`
- `POST /api/v1/admin/users`
- `GET /api/v1/admin/users`
- `GET /api/v1/admin/users/{adminUserId}`
- `PATCH /api/v1/admin/users/{adminUserId}`
- `POST /api/v1/admin/users/{adminUserId}:reset-password`
- `POST /api/v1/admin/users/{adminUserId}/role-assignments`
- `DELETE /api/v1/admin/users/{adminUserId}/role-assignments/{roleAssignmentId}`

### Participant Login

- `POST /api/v1/participant/auth/sign-in`
  - supports link, name/password, name-only, and first-step code flows
- `POST /api/v1/participant/auth/continue`
  - second-step code flow
- `GET /api/v1/participant/auth/starter`
  - returns starter context for the authenticated participant
- `POST /api/v1/participant/auth/sign-out`

Recommended participant sign-in response:

```json
{
  "loginFlow": {
    "state": "authenticated",
    "participantSessionToken": "opaque-token",
    "starterContextId": "01H..."
  }
}
```

Possible `state` values:

- `authenticated`
- `requires_code_step`
- `locked`
- `failed`

## 3. Source Ingestion And Content Registry

### Source Packages

- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/source-packages`
  - upload source archive or manifest-backed multipart upload
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/source-packages`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/source-packages/{sourcePackageId}`

### Import Jobs

- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/import-jobs`
  - body references `sourcePackageId`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/import-jobs`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/import-jobs/{importJobId}`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/import-jobs/{importJobId}/messages`
- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/import-jobs/{importJobId}:cancel`

### Content Releases

- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/content-releases`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/content-releases/{contentReleaseId}`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/content-releases/{contentReleaseId}/dependency-graph`
- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/content-releases/{contentReleaseId}:activate`
- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/content-releases/{contentReleaseId}:deactivate`

### Canonical Content Inspection

- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/content-releases/{contentReleaseId}/units`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/content-releases/{contentReleaseId}/booklets`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/content-releases/{contentReleaseId}/login-collections`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/content-releases/{contentReleaseId}/syschecks`

## 4. Participant Starter And Delivery Runtime

### Starter Context

- `GET /api/v1/participant/starter`
  - available assignments, resume state, messages, and launch choices
- `POST /api/v1/participant/starter:launch`
  - create or resume a `testRun`

Recommended launch request:

```json
{
  "bookletAssignmentId": "01H...",
  "resumeBehavior": "resume_or_create"
}
```

### Test Run Lifecycle

- `GET /api/v1/participant/test-runs/{testRunId}`
  - resolved run policy, current state, timers, current unit
- `POST /api/v1/participant/test-runs/{testRunId}:save`
- `POST /api/v1/participant/test-runs/{testRunId}:resume`
- `POST /api/v1/participant/test-runs/{testRunId}:pause`
  - only used where policy allows
- `POST /api/v1/participant/test-runs/{testRunId}:terminate`
- `POST /api/v1/participant/test-runs/{testRunId}:request-next-unit`
- `POST /api/v1/participant/test-runs/{testRunId}:request-unit-navigation`

### Responses And State

- `PUT /api/v1/participant/test-runs/{testRunId}/units/{unitAttemptId}/response`
  - idempotent full response envelope replacement
- `PATCH /api/v1/participant/test-runs/{testRunId}/units/{unitAttemptId}/state`
  - focus, presentation, client-side technical state
- `POST /api/v1/participant/test-runs/{testRunId}/heartbeat`

### Runtime Projection

- `GET /api/v1/participant/test-runs/{testRunId}/projection`
  - compiled player-facing payload for the active unit

Important rule:

- the player never assembles booklet logic from raw XML
- the API returns a compiled unit projection plus runtime policy snapshot

## 5. Monitoring And Control

### Group Monitor Views

- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/monitor/group-sessions`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/monitor/group-sessions/{groupSessionId}`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/monitor/profiles`
- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/monitor/profiles`
- `PATCH /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/monitor/profiles/{profileId}`

### Study Monitor Views

- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/monitor/study-sessions`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/monitor/study-sessions/{studySessionId}`

### Commands

- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/monitor/test-runs/{testRunId}:pause`
- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/monitor/test-runs/{testRunId}:resume`
- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/monitor/test-runs/{testRunId}:jump`
- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/monitor/test-runs/{testRunId}:unlock`
- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/monitor/test-runs/{testRunId}:terminate`

Recommended command response:

```json
{
  "commandId": "01H...",
  "status": "accepted",
  "acknowledgementState": "pending_delivery"
}
```

### Monitor Command Status

- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/monitor/commands/{commandId}`

Ack states:

- `pending_delivery`
- `delivered`
- `applied`
- `rejected`
- `expired`

## 6. Review And Reporting

### Review

- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/review/test-runs`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/review/test-runs/{testRunId}`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/review/test-runs/{testRunId}/responses`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/review/test-runs/{testRunId}/events`

### Export Jobs

- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/report-jobs`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/report-jobs`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/report-jobs/{reportJobId}`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/report-jobs/{reportJobId}/download`

Recommended export request body:

```json
{
  "reportType": "responses_export",
  "scope": {
    "groupKeys": ["group-a", "group-b"]
  },
  "format": "zip"
}
```

Supported `reportType` values in `v1`:

- `responses_export`
- `logs_export`
- `review_export`
- `syscheck_export`

## 7. Attachments

### Definitions And Admin Views

- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/attachments/requests`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/attachments/requests/{attachmentRequestId}`

### Participant Attachment Flow

- `GET /api/v1/participant/test-runs/{testRunId}/attachments`
- `POST /api/v1/participant/test-runs/{testRunId}/attachments`
  - create upload slot or QR handoff session
- `POST /api/v1/participant/test-runs/{testRunId}/attachments/{attachmentId}:complete`
- `DELETE /api/v1/participant/test-runs/{testRunId}/attachments/{attachmentId}`

### Monitor/Admin Attachment Review

- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/attachments/submissions`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/attachments/submissions/{attachmentId}`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/attachments/submissions/{attachmentId}/download`
- `DELETE /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/attachments/submissions/{attachmentId}`

Important rule:

- attachment metadata lives in the DB
- file bytes live in object storage
- generated QR pages and temporary handoff sessions are modelled as explicit resources, not hidden implementation tricks

## 8. System Check

### SysCheck Definitions

- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/syschecks`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/syschecks/{syscheckId}`

### Participant SysCheck Flow

- `POST /api/v1/participant/syscheck-sessions`
  - create session from login or direct launch context
- `GET /api/v1/participant/syscheck-sessions/{syscheckSessionId}`
- `POST /api/v1/participant/syscheck-sessions/{syscheckSessionId}:submit-answer`
- `POST /api/v1/participant/syscheck-sessions/{syscheckSessionId}:submit-metric`
- `POST /api/v1/participant/syscheck-sessions/{syscheckSessionId}:complete`

### SysCheck Results

- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/syscheck-runs`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/syscheck-runs/{syscheckRunId}`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/syscheck-runs/{syscheckRunId}/report`

## 9. Configuration And Branding

### Tenant Configuration

- `GET /api/v1/tenants/{tenantKey}/settings`
- `PATCH /api/v1/tenants/{tenantKey}/settings`
- `GET /api/v1/tenants/{tenantKey}/branding`
- `PATCH /api/v1/tenants/{tenantKey}/branding`

### Workspace Configuration

- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/settings`
- `PATCH /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/settings`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/custom-texts`
- `PATCH /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/custom-texts`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/themes`
- `PATCH /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/themes`

### Operational Flags

- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}:enable-maintenance`
- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}:disable-maintenance`

## 10. Audit And Observability

These are mostly internal/admin APIs, but the contract should still be explicit.

- `GET /api/v1/platform/audit-events`
- `GET /api/v1/tenants/{tenantKey}/audit-events`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/audit-events`
- `GET /api/v1/platform/health`
- `GET /api/v1/platform/readiness`

## Realtime Contract

## Transport

Recommended:

- WebSocket as the primary transport
- server-sent events or polling as a fallback for constrained environments

## Channel Scope

- tenant-level admin channels
- workspace-level monitor channels
- participant test-run channels

Recommended channel naming:

- `tenant:{tenantKey}`
- `workspace:{tenantKey}:{workspaceKey}`
- `test-run:{testRunId}`

## Event Types

### Participant Events

- `participant.session.created`
- `participant.test-run.created`
- `participant.test-run.state-changed`
- `participant.unit.response-saved`
- `participant.test-run.completed`

### Monitor Events

- `monitor.session-view.updated`
- `monitor.command.accepted`
- `monitor.command.applied`
- `monitor.command.rejected`

### Admin Events

- `import.job.updated`
- `content-release.activated`
- `report.job.completed`
- `attachment.submission.received`
- `syscheck.run.completed`

Recommended event envelope:

```json
{
  "eventId": "01H...",
  "eventType": "monitor.command.applied",
  "occurredAt": "2026-04-21T10:15:00Z",
  "scope": {
    "tenantKey": "iqb",
    "workspaceKey": "spring-study"
  },
  "payload": {
    "commandId": "01H...",
    "testRunId": "01H..."
  }
}
```

## Compatibility Rules

- legacy XML keys must remain traceable in import diagnostics and canonical inspection
- the rewrite may introduce new IDs, but not at the cost of losing source-level debuggability
- export formats that external users depend on should stay byte-compatible where practical and schema-compatible where byte parity is unrealistic
- participant-facing launch links should preserve stable semantics even if the rewrite stores them differently internally

## Open Contract Decisions

These still need a deliberate choice before implementation begins:

1. Whether admin auth uses only cookie sessions or also supports scoped API tokens in `v1`
2. Whether participant response saves are full-envelope replacement only, or also support append-style delta writes
3. Whether monitor command acks are backed by the same event stream as runtime changes, or by a separate command-status table plus projection
4. Whether report downloads are direct object-store signed URLs or streamed through the API gateway

## Recommendation

Freeze this contract before:

- frontend shell implementation
- backend route scaffolding
- authorization middleware
- event schema design
- Cypress parity-port work

If we keep changing names and boundaries after implementation starts, the rewrite will look organized on paper but drift in code.
