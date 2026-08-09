# Testcenter Rewrite App

The source-backed implementation priorities and current original-product gaps are
tracked in [`docs/PARITY.md`](./docs/PARITY.md).

This folder is the starting point for the real production implementation.

It is intentionally separate from `rewrite-spike/`:

- `rewrite-spike/` proves architecture and semantics
- `rewrite-app/` is where production-oriented code starts

## Phase 1 Vertical Slice

The first production slice is intentionally narrow:

1. tenant creation
2. workspace creation
3. source-package intake
4. import-job creation
5. content-release activation
6. participant sign-in and starter launch
7. persisted test-run lifecycle read/write seams
8. monitor read visibility and operator control for open runs

Participant Testtakers imports retain the original six execution modes. Their
session-reuse, response persistence, navigation/time restrictions, participant
display, monitor visibility, and remote-command policies are enforced from one
versioned domain matrix across every storage adapter. File-level `CustomTexts`
are attached to every imported participant, survive all storage adapters, and
override matching starter and Player copy. The complete 42-key original
participant catalog, including its historical misspelling and `%s` placeholders,
is versioned as a compatibility contract; current booklet selection, fullscreen,
code-gate, timer, leave-lock, navigation, pause, task-list, resume, and completion
states resolve through it. The Verona host also exposes accessible queued,
indeterminate-loading, and exact 100%-loaded milestones through the original
per-login loading texts; it does not invent byte percentages because the Player
HTML and Unit definition already arrive in the participant current-state payload.

Platform administrators can configure the original-style instance application
title, logo, `Primar`/`Sekundar`/`Erwachsene` audience theme, and a time-bounded
global warning plus global custom-text overrides from the Angular Ops view. The
public settings endpoint applies the branding to participant and operator shells,
shows the warning across all routes, and removes it automatically when its
persisted expiration passes. Participant copy follows the original precedence:
global settings are overridden by the signed-in Testtakers/Login scope and then
by the active Booklet scope. System-check-specific text overrides global copy on
the system-check surface. The complete original 58-key `gm_*` catalog is also a
versioned contract. Imported Testtakers monitor text is preserved on the migrated
operator account and overrides global settings after monitor sign-in; the focused
monitor console applies it to its headline, controls, core columns, and summary
labels, plus localized profile view/filter descriptions, batch-selection counts,
and command tooltips. Thirty-four of the 58 keys now have active monitor UI
surfaces; unresolved keys are limited to timed/booklet error and confirmation
copy plus scroll/hide controls. Logo type, bytes, safe SVG content, the original 20 MiB
ceiling, theme names, custom-text keys, and bounded text payloads are validated;
updates are audited without copying text values into the audit trail and stored
by the memory, JSON-file, SQLite, and Postgres adapters.

The same import classifies original `monitor-group`, `monitor-study`, and
`sys-check-login` entries as explicit operational-login migration candidates.
Responses retain their group, resolved monitor profile definitions, access
window, login-specific custom texts, and only a `passwordRequired` flag—never
the source password. The
migration preview includes original view, column, auto-next, and filter settings
and flags missing profile definitions. Mixed rosters import their participant
rows and show the candidates in a dedicated Runtime card;
operational-only rosters return the
stable `participant_roster_operational_only` error. Administrators can create
non-escalating `group_monitor`, `study_monitor`, and `system_check` accounts with
the resolved monitor profiles attached to their scoped role. Monitor sign-in
restores those profiles, offers the original alternatives for selection, applies
supported original run filters, and uses the selected column/density settings in
the open-run view. Booklet, block, and unit IDs and labels are resolved from the
immutable release snapshot for profile filtering, display, and CSV export. The
profile JSON is persisted by file, SQLite, and PostgreSQL
stores and is never inferred from the redacted source password. Supported candidates can prepare that account form in
one action and complete creation after a newly assigned password is entered;
the source password is deliberately never exposed or copied. Imported
`validFrom`, `validTo`, and `validFor` values are copied into the account draft,
persisted by every store, and enforced at operator sign-in. Relative validity
starts with the first successful sign-in, and the shorter of the configured
account window and normal session lifetime becomes the session expiry. The
protected browser flow carries one original `monitor-group` login through
import, account creation with its 45-minute first-login window, sign-in, route
isolation, and group-scoped monitoring. When either
monitor role signs in,
the Angular shell switches to a focused monitor console: workspace/content and
platform-administration navigation disappear, runtime refreshes use only
monitor-authorized reads, direct client-side navigation to administrative views
returns to Runtime, and the selected scope remains enforced by the API.
Migrated `system_check` accounts sign in directly on the System Check page,
may keep multiple device sessions active, and save reports under the login name
without receiving the configured report key. Their bearer session is accepted
only for the assigned workspace's report-save route; administrative and monitor
reads remain unavailable. As in the original application, configuring any such
account switches the installation from anonymous report-key saving to required
system-check login mode; the API enforces that switch as well as the Angular UI.

## Workspace Shape

```text
rewrite-app/
  apps/
    api/
    web/
  packages/
    application/
    contracts/
    domain/
    file-store/
    memory-store/
    sqlite-store/
```

## Design Rules

- keep production entrypoints small
- preserve domain semantics from the spike before preserving spike file shapes
- prefer explicit ports and use-case boundaries over direct infrastructure coupling
- do not copy spike megafiles into this workspace
- keep infrastructure adapters outside the application package

## Verification

Use Node.js 22 LTS. The checked-in Dockerfile, GitHub Actions workflow, `.node-version`, and `.nvmrc` all target Node 22 so local runs match CI and the production container baseline.

Run inside `rewrite-app/`:

```bash
npm install
npm run typecheck
npm run build
npm run start:api
```

For a durable one-command local app start, run:

```bash
npm run start:local
```

That builds the API and Angular shell, migrates `./.data/local.sqlite`, starts the API with SQLite persistence and protected operator routes, then serves the app at `http://127.0.0.1:4310/app`.
The local start also fills `APP_BUILD_SHA` from Git and `APP_BUILD_TIMESTAMP` from the current UTC time when they are not already set, so `/manifest`, `/metrics`, and the startup banner identify the running build.

`start:local` also enables the local demo bootstrap. On a clean local database it creates:

- platform admin: `demo-admin` / `demo-admin-password`
- tenant/workspace: `demo-tenant` / `demo-workspace`
- active demo content release with a three-unit demo booklet
- participant entry URL: `http://127.0.0.1:4310/participant?tenantKey=demo-tenant&workspaceKey=demo-workspace&loginKey=student-demo&groupKey=group%3Astudent-demo&bookletKey=booklet%3Ademo`

If the local database already has an admin user or active demo release, the bootstrap leaves the existing state in place.

To reset that local demo state and let `start:local` seed it again from a clean SQLite database, run:

```bash
npm run reset:local
```

The reset only removes `./.data/local.sqlite` and SQLite's matching WAL/SHM sidecar files used by `npm run start:local`. For scripted checks, `LOCAL_STATE_SQLITE_FILE` can point the reset helper at a disposable SQLite file instead.

For the local production-like verification path, run:

```bash
npm run ci
```

For a quicker pre-push signal that builds once, reuses built artifacts, includes the SQLite runtime preflight, and stops the browser flow after the content import/activation read model, run:

```bash
npm run ci:fast
```

For CI-shaped local slices that map to the workflow jobs without requiring Docker, run:

```bash
npm run ci:static
npm run ci:storage
npm run ci:browser:quick
npm run ci:browser:review
npm run ci:browser:monitor
npm run ci:browser:ops
npm run ci:deployability
```

The browser groups build once and then reuse built artifacts: `ci:browser:quick` covers content, roster links, participant entry, and activation roster warnings; `ci:browser:review` covers response/review handoff paths; `ci:browser:monitor` covers confirmed monitor batch commands, open-run synchronization, and activation-blocking runtime handoff; `ci:browser:ops` covers destructive operator actions and protected-operator auth.

Use `npm run ci:deployability` for a non-Docker release gate that builds once, runs file-store migrate/doctor/preflight, migrates SQLite, requires build metadata in both runtime preflights, and verifies the built SQLite startup smoke with the same metadata. Use `npm run ci:postgres` when `FIRST_SLICE_POSTGRES_URL` points at a reachable Postgres database. Docker-only release checks remain covered by `npm run smoke:docker:runtime` and `npm run smoke:compose:postgres`.

The full CI command executes:

- typecheck
- build
- focused unit tests for shared contracts helpers
- memory + file + sqlite integration tests
- built-server startup smoke tests against file and SQLite storage
- built runtime preflights against file and SQLite storage
- built-server graceful shutdown/drain smoke tests against file and SQLite storage
- browser-driven Angular UI smokes against SQLite in focused content, participant-entry, activation-roster-warning, review-readiness, open-run, monitor-detail, destructive-action, full, and protected operator modes, plus a Postgres-backed protected UI smoke in the Postgres CI matrix
- a standalone production Docker image runtime smoke that builds the image, migrates SQLite inside the container, starts the API as the non-root runtime user, and verifies `/readyz`, `/manifest`, and `/app`

For explicit storage administration, run:

```bash
npm run db:doctor
npm run db:migrate
FIRST_SLICE_STORE=file FIRST_SLICE_FILE=./.data/first-slice.json npm run db:doctor:file
FIRST_SLICE_STORE=file FIRST_SLICE_FILE=./.data/first-slice.json npm run db:migrate:file
FIRST_SLICE_STORE=sqlite npm run db:doctor:sqlite
FIRST_SLICE_STORE=sqlite npm run db:migrate:sqlite
FIRST_SLICE_POSTGRES_URL=postgresql://rewrite:rewrite@127.0.0.1:5433/rewrite_app npm run db:doctor:postgres
FIRST_SLICE_POSTGRES_URL=postgresql://rewrite:rewrite@127.0.0.1:5433/rewrite_app npm run db:migrate:postgres
```

These commands use the built storage adapters directly and do not require the API process to be running.

Before starting a built runtime, you can run a deployability preflight that verifies compiled API/store artifacts, the Angular browser bundle, the frontend index-to-asset references, optional build metadata, and storage readiness:

```bash
FIRST_SLICE_STORE=file FIRST_SLICE_FILE=./.data/preflight.json npm run db:migrate:file:built
FIRST_SLICE_STORE=file FIRST_SLICE_FILE=./.data/preflight.json npm run preflight:runtime:built
FIRST_SLICE_STORE=sqlite FIRST_SLICE_SQLITE_FILE=./.data/preflight.sqlite npm run db:migrate:sqlite:built
FIRST_SLICE_STORE=sqlite FIRST_SLICE_SQLITE_FILE=./.data/preflight.sqlite npm run preflight:runtime:built
FIRST_SLICE_STORE=postgres FIRST_SLICE_POSTGRES_URL=postgresql://rewrite:rewrite@127.0.0.1:5433/rewrite_app npm run preflight:runtime:built
```

Set `RUNTIME_PREFLIGHT_REQUIRE_BUILD_METADATA=true` in release contexts when `APP_BUILD_SHA` and `APP_BUILD_TIMESTAMP` must be present. The preflight validates the selected `FIRST_SLICE_STORE` and requires a valid Postgres connection string when `FIRST_SLICE_STORE=postgres`. Set `RUNTIME_PREFLIGHT_SKIP_STORAGE_DOCTOR=true` only for image-only checks where the backing store is intentionally unavailable; store selection and Postgres URL validation still run.

Original Testcenter roster timestamps such as `1/6/2023 10:00` are interpreted in `FIRST_SLICE_PARTICIPANT_TIME_ZONE` (default `Europe/Berlin`) and persisted as ISO timestamps. Set the variable to the field-operation timezone before importing participant rosters.

Password-protected participant accounts use the original login-sink threshold by default: after five failed password attempts, the same tenant/workspace/login is blocked for 30 minutes, including attempts with the correct password. The persisted counter is shared by participant sign-in and starter launch across all storage adapters; unknown and passwordless logins do not increase it. Tune the positive integer settings with `FIRST_SLICE_PARTICIPANT_LOGIN_MAX_FAILURES` and `FIRST_SLICE_PARTICIPANT_LOGIN_FAILURE_WINDOW_MS`. Blocked requests return `429 participant_login_rate_limited` and a `Retry-After` header.

The `:built` variants are intended for already-built container/runtime contexts, where `tsc` is not available:

```bash
npm run db:doctor:file:built
npm run db:migrate:file:built
npm run db:doctor:sqlite:built
npm run db:migrate:sqlite:built
FIRST_SLICE_POSTGRES_URL=postgresql://rewrite:rewrite@127.0.0.1:5433/rewrite_app npm run db:doctor:postgres:built
FIRST_SLICE_POSTGRES_URL=postgresql://rewrite:rewrite@127.0.0.1:5433/rewrite_app npm run db:migrate:postgres:built
```

For durable local storage, run the API with:

```bash
FIRST_SLICE_STORE=file FIRST_SLICE_FILE=./.data/first-slice.json npm run start:api
```

For relational local persistence, run:

```bash
FIRST_SLICE_STORE=sqlite FIRST_SLICE_SQLITE_FILE=./.data/first-slice.sqlite npm run start:api
```

For Postgres-backed persistence, run:

```bash
FIRST_SLICE_STORE=postgres FIRST_SLICE_POSTGRES_URL=postgresql://rewrite:rewrite@127.0.0.1:5433/rewrite_app npm run start:api
```

For a production-like operator surface, require an operator bearer session on platform/workspace/content/monitor API routes. Platform admins can access all operator routes, tenant admins can access their tenant, workspace admins can access their workspace, study monitors can use monitor routes for their assigned workspace, and group monitors are restricted to their assigned groups:

```bash
FIRST_SLICE_OPERATOR_AUTH_REQUIRED=true npm run start:api
```

For a local containerized API + Postgres stack, run:

```bash
npm run start:compose:postgres
```

The container image and compose stack default `FIRST_SLICE_OPERATOR_AUTH_REQUIRED=true`, so the operator surface starts in a production-like protected mode. Set `FIRST_SLICE_OPERATOR_AUTH_REQUIRED=false` only for an intentionally open local sandbox.
The npm compose scripts also fill `APP_BUILD_SHA` from Git and `APP_BUILD_TIMESTAMP` from the current UTC time when they are not already set, so the runtime preflight can require release metadata without extra local shell setup.
The Compose Postgres credentials default to `POSTGRES_DB=rewrite_app`, `POSTGRES_USER=rewrite`, and `POSTGRES_PASSWORD=rewrite`; override those `POSTGRES_*` values in `.env` for non-default Compose stacks. Host-run API and test commands still use `FIRST_SLICE_POSTGRES_URL`.

To start the same Postgres-backed stack with the local demo tenant, admin, active release, and participant link pre-seeded, run:

```bash
npm run start:compose:postgres:demo
```

Stop the compose stack with:

```bash
npm run stop:compose:postgres
```

For local smoke runs alongside another app or Postgres instance, override the
host ports and Compose project name:

```bash
COMPOSE_PROJECT_NAME=rewrite-app-smoke-local \
REWRITE_APP_PORT=4311 \
POSTGRES_PORT=55433 \
npm run smoke:compose:postgres
```

To run the same Compose smoke with demo bootstrap enabled, use:

```bash
npm run smoke:compose:postgres:demo
```

That stack now runs in two explicit application roles:

- `rewrite-app-migrate`: one-shot schema migration role
- `rewrite-app-api`: long-running HTTP service role

The API waits for both Postgres health and successful migration completion before it starts.

The workspace also ships a checked-in environment example:

```bash
cp .env.example .env
```

Then adjust the storage variables for your local mode.

The Docker build context excludes local `.env` variants, `.npmrc`, Git metadata, workflow files, data, cache, logs, and build-output files so local secrets or generated state are not sent to the Docker daemon.

`FIRST_SLICE_MAX_JSON_BODY_BYTES` defaults to `1048576` and limits ordinary JSON command payloads before they are accumulated in memory. Source-package create, replacement, and retry commands use the separate `FIRST_SLICE_MAX_SOURCE_PACKAGE_JSON_BODY_BYTES` limit, which defaults to `75497472` so the documented 50 MiB extracted-package ceiling plus base64 overhead remains reachable without weakening every API route. Oversized requests return `413 request_body_too_large`.

`PORT` must be between `1` and `65535`. `SHUTDOWN_DRAIN_DELAY_MS` must be a non-negative integer. `HTTP_HEADERS_TIMEOUT_MS`, `HTTP_REQUEST_TIMEOUT_MS`, and `HTTP_KEEP_ALIVE_TIMEOUT_MS` default to `60000`, `120000`, and `5000`, respectively. They are applied to the Node HTTP server and exposed through `/diagnostics/config`.

`APP_BUILD_SHA` and `APP_BUILD_TIMESTAMP` are optional and surface through the API manifest, metrics, and startup banner for release identification.

When you build the production image, you can also pass them as Docker build args:

```bash
docker build \
  --build-arg APP_BUILD_SHA=$(git rev-parse --short HEAD) \
  --build-arg APP_BUILD_TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ) \
  -f Dockerfile .
```

For the same standalone image runtime smoke used by CI, run:

```bash
APP_BUILD_SHA=$(git rev-parse --short=12 HEAD) \
APP_BUILD_TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ) \
DOCKER_IMAGE_TAG=testcenter-rewrite-app:smoke \
npm run smoke:docker:runtime
```

If you already built the image and only want to rerun the container smoke, use:

```bash
DOCKER_IMAGE_TAG=testcenter-rewrite-app:smoke npm run smoke:docker:runtime:built
```

## Current Live Flow

The first production workspace now serves a small in-memory HTTP baseline with:

- `POST /api/v1/admin/auth/bootstrap`
- `POST /api/v1/admin/auth/sign-in`
- `GET /api/v1/admin/auth/current-session`
- `GET /api/v1/admin/auth/sessions`
- `DELETE /api/v1/admin/auth/sessions/{adminSessionId}`
- `GET /api/v1/admin/auth/sessions.csv`
- `POST /api/v1/admin/auth/sign-out`
- `GET /api/v1/admin/users`
- `POST /api/v1/admin/users`
- `PATCH /api/v1/admin/users/{adminUserId}`
- `DELETE /api/v1/admin/users/{adminUserId}`
- `POST /api/v1/admin/users/{adminUserId}/password`
- `POST /api/v1/admin/users/{adminUserId}/role-assignments`
- `DELETE /api/v1/admin/users/{adminUserId}/role-assignments/{roleAssignmentId}`
- `GET /api/v1/admin/users.csv`
- `GET /api/v1/admin/audit-events`
- `GET /api/v1/admin/audit-events.csv`
- `GET /api/v1/platform/tenants`
- `GET /api/v1/platform/tenants.csv`
- `POST /api/v1/platform/tenants`
- `GET /api/v1/tenants/{tenantKey}/workspaces`
- `GET /api/v1/tenants/{tenantKey}/workspaces.csv`
- `POST /api/v1/tenants/{tenantKey}/workspaces`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/exports/workspace-overview.csv`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/study-monitor/summary`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/study-monitor/participants`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/study-monitor/groups/{groupKey}`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/study-monitor/participants/{loginKey}`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/study-monitor/booklets/{bookletKey}`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/study-monitor/units/{unitKey}`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/study-monitor/runs/{testRunId}`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/exports/study-monitor.csv`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/exports/study-monitor-participants.csv`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/exports/open-runs.csv`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/activity-events`
- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/source-packages`
- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/source-package-assemblies`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/source-packages`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/exports/source-packages.csv`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/source-packages/{sourcePackageId}`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/source-packages/{sourcePackageId}/download`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/source-packages/{sourcePackageId}/deletion-readiness`
- `DELETE /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/source-packages/{sourcePackageId}`
- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/source-packages/{sourcePackageId}/replacements`
- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/source-packages/{sourcePackageId}/retry-import`
- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/import-jobs`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/import-jobs`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/exports/import-jobs.csv`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/import-jobs/{importJobId}`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/participant-sessions`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/participant-sessions/{participantSessionId}`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/exports/participant-sessions.csv`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/participant-roster`
- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/participant-roster`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/exports/participant-roster.csv`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/responses/detailed`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/reviews`
- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/reviews`
- `PATCH /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/reviews/{reviewId}`
- `DELETE /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/reviews/{reviewId}`
- `DELETE /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/results/groups/{groupKey}`
- `DELETE /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/results/groups` (confirmed multi-group deletion)
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/test-logs`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/exports/responses.csv`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/exports/logs.csv`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/exports/activity-events.csv`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/exports/reviews.csv`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/content-releases`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/exports/content-releases.csv`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/content-releases/{contentReleaseId}`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/content-releases/{contentReleaseId}/activation-readiness`
- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/content-releases/{contentReleaseId}/activate`
- `POST /api/v1/participant/auth/sign-in`
- `GET /api/v1/participant/sessions/{participantSessionId}/runtime-state`
- `GET /api/v1/participant/sessions/{participantSessionId}/current-state`
- `POST /api/v1/participant/starter:launch`
- `POST /api/v1/participant/test-runs/{testRunId}/save-progress`
- `GET /api/v1/participant/test-runs/{testRunId}/reviews`
- `POST /api/v1/participant/test-runs/{testRunId}/reviews`
- `PATCH /api/v1/participant/test-runs/{testRunId}/reviews/{reviewId}`
- `DELETE /api/v1/participant/test-runs/{testRunId}/reviews/{reviewId}`
- `POST /api/v1/participant/test-runs/{testRunId}/testlets/{testletKey}/unlock`
- `POST /api/v1/participant/sessions/{participantSessionId}/resume`
- `POST /api/v1/participant/test-runs/{testRunId}/resume`
- `POST /api/v1/participant/test-runs/{testRunId}/complete`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/monitor/open-runs`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/monitor/events` (`text/event-stream`)
- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/monitor/open-runs/commands`
- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/monitor/open-runs/{testRunId}/commands`

The added read side now makes the first slice inspectable:

- admin bootstrap creates the first platform admin, bearer sessions can be checked/listed/revoked/exported as CSV without exposing tokens, targeted session revoke protects against accidentally revoking the active session, and the protected admin directory can create users, reset passwords, assign/revoke platform/tenant/workspace roles, update status, and permanently delete delegated accounts while preventing self-disable, self-delete, or self platform-role revoke lockouts; disabling an account formally revokes every active session, while deletion atomically removes every role and session and retains a complete audit snapshot with exact deletion counts
- protected admin directory reads are filterable by username, status, role, tenant/workspace scope, and limit so platform operators can narrow user-management follow-up without leaving the shell, with a matching CSV export for access reviews
- admin audit events persist a protected platform-admin trail for bootstrap, failed/successful sign-in, sign-out, targeted session revoke, user creation/update/deletion, password reset, and role assignment/revocation, filterable by event type, actor admin id, subject admin id, and limit, with a matching CSV export endpoint
- `FIRST_SLICE_OPERATOR_AUTH_REQUIRED=true` protects platform/workspace/content/monitor routes with scoped admin bearer sessions while leaving participant runtime routes available to participants
- the Angular shell derives the active operator access mode from the authenticated session; monitor-only accounts receive a reduced Monitor plus Access & Diagnostics navigation, a focused open-run command console, scoped SSE/polling refresh, and no workspace/content/admin-management controls. A protected browser gate signs in as an actual group monitor and verifies that unrelated group runs are absent
- participant review routes are bound to an opaque participant run, reject execution modes without `canReview`, and expose only that run's own test-, unit-, and task/page-level comments; Original Testcenter page/page-label metadata, priorities `0–3`, and simultaneous `tech`/`content`/`design` categories survive create, edit, storage, filtering, and reload
- password-protected participant sign-in and starter launch share a durable, workspace-scoped login sink with the original five-failure/30-minute defaults and stable `429` retry responses
- tenant and workspace directory reads let operators discover available scopes before drilling into a specific workspace
- workspace overview returns workspace state plus source-package, import, release, session, and open-run counts, with a one-row CSV export for operator handoff
- study monitor summary returns workspace-wide group, booklet, and unit progress with participant sessions, saved-roster expected/not-started participants for groups and booklets, roster-derived missing unit expectations, prioritized attention items, latest run states, response counts, review counts, and latest activity timestamps
- study monitor group detail drills into one group with participant sessions, saved roster entries, status counts, latest runs, response counts, review counts, and per-run context for operator follow-up
- study monitor booklet detail drills into one booklet with saved roster entries, attached runs, status pressure, unit coverage, response counts, and review counts
- study monitor participant detail drills into one login with saved roster context, sessions, runs, unit answer status, response counts, and review counts
- study monitor participant matrix read model exposes participant-by-unit session/run/answer/review status directly for the operator shell
- study monitor CSV export flattens workspace, group, booklet, unit, and not-started participant rows for operator handoff outside the shell
- study monitor participant matrix CSV export flattens participant-by-unit progress with session/run status, expected/answered flags, response lengths, review counts, and roster display context, and can be narrowed by the same login/group/booklet/unit/status/answer/limit filters used by the operator matrix
- study monitor run-detail CSV export flattens the selected run into unit rows with expected/current/answered state, response length, review count, and response text for per-participant support handoff
- open-run reads and CSV export flatten the current activation-blocking runs with participant, booklet, unit, status, timestamp, and saved-roster context for operator handoff, filterable by login, group, booklet, session, run, unit, status, and limit
- source-package listing and CSV export classify uploaded files by content into the original `Testtakers`, `Booklet`, `SysCheck`, `Unit`, and `Resource` categories plus immutable `Package` bundles, and show exact stored byte size, download availability, import/release dependency counts, deletion safety, latest import attempt, and package structure counts. Source-package detail derives a centered dependency graph from immutable loose-file assembly lineage and imported content: direct and transitive package, booklet, system-check, unit, player, definition, coding-scheme, and resource relationships are returned as typed nodes/edges, and Angular renders them with direct navigation to related stored files. API and Angular can filter by file type as well as status, media type, file name, latest import status, and limit; list responses omit the potentially large source document, while a protected binary route downloads text/JSON/XML or base64 ZIP uploads with safe attachment names and without routing file bytes through a JSON response
- source-package deletion readiness exposes active imports/releases and every participant-session/test-run reference; exact-file-name confirmation deletes only a rechecked safe aggregate and its unused import/release derivatives, while dependency changes fail closed and every successful deletion is audited
- source-package replacement preserves the selected package, creates a new immutable package identity, runs its import immediately, selects the staged result in Angular, and records old/new package lineage in the workspace activity trail; retry is rejected for already accepted packages so successful import lineages cannot be overwritten in place
- source-package detail now shows the full retry/import history and any releases that were produced from that package
- import-job listing and CSV export show completed and failed imports together with persisted diagnostics and source-package context, filterable by status, source package, and limit
- import-job detail now resolves a single import attempt together with its source package and resulting release, if one exists
- content-release listing and CSV export show staged/active/superseded releases together with source package/import context, package structure counts, participant-session counts, and open-run pressure, filterable by status, import job, source package, and limit
- participant-session listing now gives operators a workspace-wide view of signed-in sessions together with each session's latest run and linked content release, filterable by status, group, login, booklet, content release, and limit, with a matching CSV export for operator handoff
- participant-session detail now resolves one session together with its content release, full run history, response counts, review counts, and attached review context
- participant roster import now persists operator-managed login/group/booklet/display-name rows from CSV/TSV/semicolon text with canonical or common alias headers, optional password/`pw` fields, Testtaker/Participant-style XML, original Testcenter `Testtakers`/`Login` XML, JSON roster text, or native JSON request objects/arrays, including nested Group/Booklet parent contexts, every ordered `<Login><Booklet>` assignment, original comma-separated per-booklet `state="key:option, key:option"` adaptive presets, original `<Booklet codes="…">` second-code mappings, and file-level `CustomTexts`; native JSON accepts inherited maps, value objects, and key/text entry arrays with participant-level overrides. Presets are checked against the active release, shown in Angular roster cards, copied durably into new runs, and remain authoritative in participant and monitor routing, while the versioned 42-key participant text catalog reaches starter and active Player controls including Verona loading/failure guidance and five-second timer start/expiry/cancellation notices, `%s` placeholders are substituted safely, imported mixed-case block codes remain usable with the original uppercase dialog behavior, and protected participant passwords are hashed internally with roster CSV exposing only `passwordRequired`
- detailed response inspection returns workspace-wide saved answers with participant, run, unit, and status context, filterable by login, group, booklet, session, run, unit, status, and limit
- result-group administration reproduces the Original Testcenter's operator summary with started booklets, per-run minimum/maximum/average answered-unit counts, latest test activity, and response/review/log totals; one group can seed the detailed inspection scopes, while a separate multi-selection supports select-all, individual CSV exports, a combined Original-compatible ZIP with response/log/review CSV and JSON reports plus manifest, and workspace-key-confirmed aggregate deletion with an audit record. Response, review, and log reads accept repeated `groupKey` parameters without breaking the existing single-group filters; exports are explicitly bounded while interactive lists remain capped at 500 rows
- admin account status management supports a bounded exact multi-selection with current/target-state preview, protects the signed-in account from selection, confirmation-gates the mutation, and reports per-account best-effort successes or stable failures while every update remains independently constrained and audited by the existing platform/tenant/workspace delegation boundary
- permanent admin account deletion reuses the bounded exact selection and server delegation boundary, excludes the signed-in account, requires an irreversible-action confirmation, removes each successful account with all of its sessions and roles, retains failed selections for retry, and preserves audit evidence that no longer depends on the deleted directory record
- review comments let participants and operators attach, edit, list, delete, and export reviewer notes for concrete test runs, units, or labeled tasks/pages, including original priority and multi-category metadata; review reads are filterable by login, group, booklet, session, run, unit, reviewer, category, and limit, while runtime/workspace cards expose task targets, priorities, and every selected category. The runtime shell also derives a review-readiness checklist that joins answered units, missing responses, unit-level reviews, and whole-run reviews for the selected participant run, and its cards can seed matching response/review filters for follow-up inspection
- Original Unit attachment variables with `format="capture-image"` survive packaged XML import and become requested image slots for each started run. The protected Attachment Manager lists missing/captured slots with participant and content context, constrains group monitors to assigned groups, accepts both JSON/Base64 and the original capture client's binary-safe multipart upload, magic-byte-checks PNG/JPEG files up to 10 MiB, previews and deletes durable images, records upload/delete activity, and exposes a stable copyable handoff code. Operators can download one selected or up to 500 role-scoped A4 QR pages with the original configurable label placeholders. A separate mobile `/attachment-capture` route completes the original handoff: an authenticated operator can scan the printed QR code with the rear camera or a saved QR image, switch cameras or flash, use the manual code fallback, verify the server-scoped participant/booklet/unit/variable target, capture an A4-centered camera frame or device photo, preview it, and confirm the upload. The route never turns the QR value into public authority; every lookup and upload reuses the existing role, group, workspace, and read-write checks
- group result deletion removes collected test runs for one group, reports deleted runs/responses/reviews/logs, records a workspace activity event, refreshes the result inventory, and the frontend requires operators to type the target group key before issuing the destructive action
- response CSV export returns persisted unit responses with participant, run, booklet, unit, status, timestamp, and saved-roster display/assignment context, using the same filters as detailed response inspection
- workspace log CSV export returns the persisted activity timeline with event metadata and details JSON
- review CSV export returns persisted comments with participant, run, booklet, unit, page, page label, reviewer, priority, category list, compatibility category text, timestamp, and saved-roster display/assignment context, using the same filters as review reads
- content-release detail now resolves a single release together with its import/source-package lineage, attached sessions/runs, and neighboring activation history within the workspace release line
- content-release activation readiness now previews whether a staged release can be switched in immediately, whether open runs block it, and whether saved roster booklet assignments would warn against the selected release, with concrete guard-result and roster-warning cards that can prepare the affected participant in the runtime shell
- workspace activity events now provide a persisted operator timeline for setup, import, activation, and runtime actions, filterable by event type, subject type, subject id, and limit
- failed source packages can now be retried in place with corrected manifest data, producing a fresh import job on the same package identity
- content-release listing returns staged/active/superseded releases together with their import/source-package lineage, filterable by status, import job, source package, and limit
- participant runtime can now be re-entered through session context, not only through `testRunId`
- participant sign-in now reuses an existing non-closed session for the same login and active content release, preventing duplicate monitor rows when a participant re-enters, and sign-in/launch/runtime responses expose saved-roster display context for participant and operator surfaces
- participant entry links and sign-in requests can now carry an explicit `groupKey`; omitted groups still default to `group:{loginKey}` for backward-compatible links
- participant sign-in and starter launch now accept an optional participant password and reject missing or wrong passwords for roster entries imported with password/`pw`, while passwordless roster entries keep the existing link-based flow
- original `<Booklet codes="alpha beta">` assignments now trigger a password-first second-code challenge in participant sign-in and starter launch; a valid code exposes its matching assignments together with uncoded assignments, different codes create or resume distinct durable sessions, the Angular prompt appears only when required, and configured alternative codes are not returned in participant roster context or persisted in browser storage
- participant roster imports now carry original group-level `validFrom`, `validTo`, and `validFor` access windows through XML, JSON, and header-mapped CSV; scheduled and expired logins are rejected with stable 401/410 errors, relative validity starts with the first saved participant session and cannot be reset by closing a run or changing releases, the earlier relative/absolute deadline wins, persisted runtime access is rechecked, and roster/session cards plus CSV exports expose the non-secret timing policy
- participant sign-in now rejects tenant-less workspace keys that exist in multiple tenants, forcing callers to provide `tenantKey` instead of silently binding to the wrong workspace
- participant launch/resume can now carry an explicit `tenantKey` and `bookletKey`, and `POST /api/v1/participant/starter:launch` can sign in by tenant/workspace/login/group and start the selected booklet in one request
- participant progress saves now validate `currentUnitKey` against the selected booklet's runtime snapshot before storing responses, and status/response-only saves retain the current unit for player clients that do not repeat the unit key on every save
- participant current-state can now deliver imported Verona player HTML and exact inline or referenced unit definitions; the Angular participant route runs supported Verona 2–6 players in a sandboxed frame, exposes accessible queued, indeterminate-loading, and exact 100%-loaded host milestones with original per-login custom texts, exchanges start/state/navigation/runtime-error messages, merges separately reported unit/player state, persists the versioned envelope through coalescing autosave with visible retry, and restores it after session reload. Loading progress stays truthful to the in-browser `srcdoc` lifecycle instead of fabricating byte percentages for Player HTML and Unit definitions already resident in current state. A typed in-memory state avoids repeatedly parsing production-sized definitions, while foreground navigation pauses eager autosave and keeps separate Prev/Next controls independent from the optional unit menu. Browser smoke records the exact loading-phase order and executes the pinned original Verona 6 adaptive sample, the provenance-pinned official `verona-player-simple` 1.0.1/API-2, 2.1.0/API-3, 4.0.0/API-4, and 5.2.0/API-5 releases with their generation-specific state restoration, the independent official ABI 3.3.0 scripted-survey Player/API-2 with text and radio answer restoration, the independent official DAN 3.0.0 visual-assessment Player/API-2.1 with positioned multiline-text and multiple-choice restoration, and the byte-exact original IQB Aspect 2.12.3 player across its complete three-unit 17.4 booklet. Legacy data-part value kinds are retained so object-valued Simple-Player state plus ABI's JSON-string `allResponses` and DAN's JSON-string `all` state round-trip without Player-specific rewriting; the gates also render all four images from the 16.17 MB Aspect Voud definition, navigate forward/backward, and confirm restoration after reload
- original `.itcr.zip` resource packages nested in import bundles are extracted with per-entry and aggregate size limits into immutable releases, served only through participant-session resource URLs, and exposed to Verona players through `playerConfig.directDownloadUrl`; full, single-range, and bounded multi-range responses carry exact lengths, `Accept-Ranges`/`Content-Range`, `multipart/byteranges`, controlled `206`/`416` semantics, and CORS-exposed range headers. Resource preflights explicitly allow `Range`, so an originless sandboxed player can use multi-range media requests. The same pinned original package can be uploaded separately beside a loose Booklet, Unit, definition, and Player: automatic workspace dependency resolution now has a cross-store gate proving immutable five-file lineage, nested extraction, participant current-state delivery, byte-exact retrieval, and range retrieval. The browser smoke gate independently verifies the prebuilt-package path plus single- and multi-range retrieval
- original XML/JSON `BookletConfig` values now compile into a versioned runtime policy exposed by participant current-state; presentation/response completeness is enforced server-side for forward, backward, and completion requests, nested `DenyNavigationOnIncomplete` rules independently inherit or override each dimension, and the Angular/Verona player applies unit-menu/control, player-end, paging, logging, page-restore, header/title, fullscreen-prompt, and fullscreen-button settings with visible denial or browser-fallback guidance. The four official `CY_Bklt_BkltConfig_*` variants now activate together with their three Units, legacy Player, and byte-exact four-account roster; real assigned accounts gate the complete policy matrix, timer startup, alias navigation, Player-End eligibility, ordinary completion, and termination locking across memory, file, and SQLite
- original Booklet XML now retains nested `Testlet` hierarchy and per-unit testlet paths; `CodeToEnter` restrictions block launch, direct jumps, and completion server-side until a participant enters the matching code in the Angular player, while durable per-run unlock state survives reloads and participant responses never expose the configured code
- original `TimeMax` restrictions now start a server-authoritative timer on actual block entry, survive reloads and durable-store restarts, pause and resume with the run, visibly count down live in the Angular player when `unit_show_time_left` is enabled, show five-second alerts at compiled `unit_time_left_warnings` thresholds, expire into the next eligible unit, permanently close elapsed or deliberately left blocks, and enforce the original `forbidden`, `confirm`, and `allowed` leave policies for navigation and participant completion; timer lifecycle activity is auditable, monitor pause/resume/complete commands share the same state model, operators can set a validated replacement rest time for a selected timed unit without moving or resuming its run, and open-run plus run-detail monitoring and CSV exports expose timer labels, states, remaining time, leave policies, and lifecycle timestamps
- original `LockAfterLeaving` restrictions now enforce both `unit` and `testlet` scopes, honor optional participant confirmation, persist locked targets across reloads and durable-store restarts, prevent direct re-entry, skip locked units during sequential navigation, and expose the active rule plus locked units in the Angular player; the audited monitor navigation override clears durable leave locks and suppresses new ones for the run
- a pinned original Testcenter 14.3/15.1/15.2/17.4/17.6 compatibility corpus now imports 28 booklets and the byte-exact legacy 15.2 E2E roster without a system-check login, including the equal-species `Booklet.xml`/`Booklet3.xml` pair, all 17 `CY_Bklt_TC-*` Test-Controller cases, all four `CY_Bklt_BkltConfig_*` variants, both official Session-Management booklets with all five referenced Units and all 12 original logins, and the official Group-Monitoring booklet with its participant, scoped monitor, and two view profiles; it verifies booklet identity, original top-level-testlet species, repeated-unit aliases, unit order, code gates, every `TimeMax` leave mode, global and nested completion rules, unit/testlet leave locks, password-free and password-protected entry, ordered multi-booklet assignments, second codes, access windows, and hot-return versus hot-restart re-entry with response restoration. The Controller corpus also activates all 17 booklets, their five Units, the legacy Verona player, and the byte-exact 26-login `CY_Logins_TestController.xml` roster in one workspace. Official Demo, Review, Hot-Return, and Hot-Restart accounts gate mode policy, code/time enforcement, durable response return versus clean restart, and monitor inclusion across memory, file, and SQLite. The Group-Monitoring package independently gates password-redacted monitor migration, exact profile retention, group isolation, and participant-visible pause/resume/go-to/lock/unlock transitions across memory, file, and SQLite. The importer accepts the original `id-6.0` Verona-player reference as a version-checked legacy alias while retaining identity and version mismatch failures. Its real `Booklet2.xml` + `Unit2.xml` + coding scheme + Verona 6 dependency set gates both prebuilt-ZIP and loose multi-upload intake, immutable dependency retention, and raw-response adaptive routing end-to-end. The historical DAN `G231mm.xml` + `G231mm.voud` + metadata-free `IQBVisualUnitPlayerV2.99.2.html` graph now has the same prebuilt and loose intake gates; dotted version suffixes resolve only as a conservative metadata-free filename fallback, and competing versions remain an explicit ambiguity. Its complete original three-unit Aspect booklet, IQB Aspect 2.12.3 player, and all Unit/Voud pairs add a production-sized import and browser handshake/save/navigation/restore gate, including a 16.17 MB media definition; operational monitor/system-check logins are excluded from participant import
- the pinned original `SysCheck.xml` and byte-exact official `CY_SysCheck_2.xml` import as first-class system-check definitions without producing empty content releases. Multiple checks remain independently selectable in one workspace; the browser gate proves the measured-network and configured-`skipnetwork` paths, required-field feedback, every original questionnaire control, two resolved Verona runs, save-key reports, statistics, and check-isolated cleanup. Separately uploaded SysCheck, Unit, IQB coding-scheme, and Verona files resolve transitively into audited immutable packages; their Unit definition and Player stay attached to each check, and a packaged missing Unit is rejected with a stable diagnostic. `/system-check` is a lazy direct-entry Angular flow for browser/device capture, configured repeated upload/download throughput against original-compatible `/speed-test/random-package` endpoints, application latency and connection hints, original threshold ratings, per-check `syscheck_*` custom texts, JSON download, and report persistence. Scoped operators can list/filter reports, export original-style semicolon CSV columns, inspect per-check operating-system/browser/overall-rating distributions and individual report values, and delete selected report sets only after typing the workspace key; deletion is store-scoped and audited across memory, file, and SQLite
- every Angular feature route (Workspace, Content, Runtime, Participant, System Check, and Ops) is emitted as an independent production chunk. The shared initial shell is 523.90 kB raw instead of 901.74 kB, with tightened 600-kB warning and 750-kB error budgets; direct links and guarded navigation still load each complete flow. Browser smoke executes the booklet-requested fullscreen enter/exit path, verifies the configured header, and crosses the lazy workspace, content, runtime, participant, system-check, and admin surfaces
- the production Angular shell now ships an installable same-origin web manifest and a scope-limited Service Worker. After one successful online visit, `/app/participant` can be opened or reloaded with the network disabled from versioned cached HTML, hashed bundles, lazy Participant chunks, styles, manifest, and icon; an accessible banner makes clear that sign-in and content loading still require connectivity. API routes, Participant current-state, Player definitions, and resources are never cached. Pending Player responses are instead copied into a bounded IndexedDB queue only after a failed save or when the Participant view closes; the Service Worker delivers them through the normal idempotent API immediately or with Background Sync, then the next Participant load reconciles and clears the local draft. Authored response-buffer timings therefore remain intact while closing the app no longer strands the newest response in page-only storage. The server keeps HTML and the Service Worker revalidating while serving content-hashed JavaScript/CSS as immutable, and dedicated Chromium smoke coverage proves both an offline navigation response and closed-view response delivery
- the pinned Original Testcenter 17.6 supported-browser policy now parses the current user agent, accepts explicitly supported and newer versions, and warns for outdated or unknown browser families in a dismissible, accessible global banner. The warning uses the original `%s` browser/version placeholders and switches to imported per-login custom text after participant sign-in; unit tests and an outdated-Chrome browser smoke gate the policy, dismissal, reload, and custom copy
- ZIP imports now perform version-aware structural validation of bundled Verona `application/ld+json` metadata for the early `@id`/`@type`/`apiVersion` draft, the experimental `$schema`-only shape without `metadataVersion`, legacy 1.x/2.x, and strict 3.0/3.1 documents before staging: malformed/non-player documents, unsupported metadata or API versions, invalid core/nested fields, and player-reference/module-version/id mismatches fail with stable diagnostics. Unit references use `player-id@module-version`; `apiVersion` in the early draft and `specVersion` in later generations independently declare Verona API compatibility. Metadata-free legacy players remain importable with a stable warning because their reference cannot prove API compatibility, and the runtime ready handshake remains authoritative. The official `verona-player-simple` releases 1.0.1, 2.1.0, 4.0.0, and 5.2.0 negotiating APIs 2.1.0, 3.0.0, 4.0, and 5.2, the official ABI `3.3.0` scripted-survey Player and DAN `3.0.0` visual-assessment Player negotiating API `2.1.0`, the original Verona 6 fixture, the full original Aspect `2.12.3` module negotiating API `6.0`, all supported metadata generations, and a metadata-free browser player are executable compatibility gates
- schema-aware Booklet imports now validate the complete `Units`/nested-`Testlet` hierarchy and ordered `Restrictions` content before deriving runtime policy. Unknown attributes or children on the hierarchy, Units, Testlets, `CodeToEnter`, `TimeMax`, `Show`, completion rules, and leave locks fail instead of disappearing during normalization; singleton restrictions cannot be repeated or moved after their XSD position. The declared schema generation remains authoritative: 14.x/15.x `TimeMax` accepts only a positive integer and no `leave`, while 17.x accepts positive fractional minutes plus the adaptive restriction extensions introduced there
- original `Units/Restrictions` now survives import as the synthetic root Testlet `[0]`: global completion requirements are inherited by nested blocks, while a root `TimeMax` starts on the first Unit, spans the complete Booklet, takes precedence over inner timers, obeys its authored leave policy, remains adjustable through monitor controls, and completes the run when it expires. The root identity and timer state use the same durable participant and monitor paths as authored Testlets
- XSD-declaring original Booklet, Unit, Testtakers, and SysCheck XML, including XML entries nested in ZIP dependency bundles, is parsed as XML before normalization and checked for required schema structure, matching schema type, required identities and labels, Unicode XML `xs:ID` lexical validity for Booklet/Unit/SysCheck metadata identities, supported login modes, duplicate group/login/testlet/unit/variable/question keys, and safety-critical `TimeMax`, completion, `LockAfterLeaving`, Unit definition/dependency/variable, adaptive state/option/`Show` graph, monitor-profile references/settings/filters, booklet-state presets, group access windows, and SysCheck config facets. Invalid or duplicate adaptive state identities, empty option sets, unresolved state-option visibility edges, malformed recursive `If` sources, aggregates, comparisons, or numeric bounds, `from` references that do not match an executable Booklet Unit alias/ID, and package-level `of` references absent from the target Unit's inline or external variable declarations fail before they can disappear during normalization, select the wrong route, or hide participant content. Booklet definitions additionally enforce the root `xs:all` member set and singleton cardinalities, ordered Metadata fields, XML-ID Config/CustomText keys, exact nested attributes, and text-only Config/CustomText values before runtime policy compilation. Unit definitions apply their declared 14.3/15.1/16+ contract to ordered Metadata fields, deprecated and attribute-based timestamps, versioned Transcript/Reference/page/alias support, legacy XML-ID variable keys, exact Definition/CodingSchemeRef/VariablesRef/dependency/variable-container attributes, and text-only schema-declared reference fields before dependencies or runtime data are derived; deliberately untyped `Value/label`, `Value/value`, and `ValuePositionLabel` payloads remain open as in the XSD. Testtakers definitions reject dangling/duplicate profile IDs, mixed Booklet/Profile login assignments, non-original view/column/filter enums, invalid boolean negation, duplicate custom-text keys, malformed comma-separated state presets, impossible or inverted absolute access boundaries, non-positive/unsafe relative lifetimes, unsupported or out-of-order children, repeated singleton containers, empty CustomTexts/Group login lists, assignments after ViewSettings, unknown attributes throughout the roster tree, and nested elements in XSD text-only fields instead of silently widening, merging, or dropping input. SysCheck definitions likewise enforce Metadata/Config and nested metadata/config order and cardinality, exact nested attribute sets, safe integer speed facets, XML-ID custom-text keys, and text-only speed/question/custom-text content. Because original Testtakers files commonly omit `Metadata/Id`, their sorted case-insensitive group/login assignments form a semantic fallback identity: renamed or reformatted duplicate rosters are rejected both as loose uploads and inside prebuilt ZIPs, while genuinely different rosters remain independent. Package cross-validation also requires each declared `DefinitionRef`, player, and player-targeted file dependency to resolve through its relative path, manifest resource, or unambiguous original workspace-style file name. XML booleans, integers, date-times, child order, value metadata, and missing cross-file targets fail with stable diagnostics instead of silently changing runtime semantics
- Testtakers validation now follows the declared roster generation: monitor profile containers and references require schema 15.3, Booklet state presets plus extended monitor profile/filter fields require 15.4, and per-login `ViewSettings` require 17.6. The byte-exact original 15.2 E2E roster imports and updates idempotently, while cross-generation feature mixing fails with stable diagnostics across memory, file, and SQLite
- study-monitor reads now include workspace summary, group drill-down, booklet drill-down, unit drill-down, and run drill-down with per-unit answer/missing/current/review status plus saved-roster expected/missing unit coverage
- participant current-state now returns saved-roster display context, a lightweight `booklet`/`currentUnit` projection, and available actions, sourced from a small content-release runtime snapshot
- source-package intake can now optionally carry a small structured `contentStructure`, JSON/XML source-document text, or native JSON source-document objects/arrays with booklet/testlet and unit/unitRef entries, which the import step turns into the release runtime snapshot
- source-package intake now rejects blank file names, blank media types, and unsupported source-document value types before an import job is created
- loose source-package intake resolves unique original `Booklet` or `SysCheck` → `Unit` → Verona player, `DefinitionRef`, `VariablesRef`, coding-scheme, and separately uploaded `.itcr.zip` player-resource references across already uploaded workspace files. Starting the root import captures that transitive closure in a new immutable dependency-snapshot ZIP, records exact member lineage, selects the snapshot in Angular, and runs the normal importer; the original resource-package gate proves the resulting participant download in memory, file, and SQLite stores. Ambiguous or incomplete matches stay on the explicit path. Manual assembly remains as the controlled fallback for 2–100 selected files, rejecting missing documents, unsafe relative paths, duplicate selection ids, case-insensitive duplicate archive paths, and per-file/aggregate size overflow while preserving an existing manifest or generating compatible IMS aliases from paths, original XML metadata, and Verona JSON-LD module identity/version metadata
- prebuilt ZIP validation rejects case-insensitive duplicate IMS manifest resource identifiers before references are resolved, preventing a later declaration from silently replacing or ambiguously shadowing an earlier Booklet, Unit, coding-scheme, or asset target. Generated assembly manifests apply the same identity rule while deduplicating aliases that resolve to the same selected file
- source-package intake can now also carry a manifest-like `sourceDocument`; the import step derives booklet/unit structure from JSON or XML/manifest content when no explicit `contentStructure` is given, including native JSON request bodies, extracted manifest text or base64 ZIP manifests from package-style uploads, ZIP manifest resources enriched with referenced unit-file or dependency-file content, ZIP manifests whose referenced booklet XML files contain the actual unit structure, direct XML/JSON unit `Definition` content, Testcenter-style ZIP units with inline `Definition` or ZIP-relative `DefinitionRef` content, XML IMS `xml:base` and JSON IMS `base`/`xml:base` resource/file path resolution, keyed JSON booklet/unit maps, JSON/XML default organization selection, keyed JSON IMS organization/resource/dependency maps, nested testcenter/package/test wrapper objects, JSON/XML IMS resource dependency manifests, and XML resource/dependency alias fields
- manifest-derived runtime structures are normalized during import: keys are trimmed, duplicate booklet/unit entries without aliases are collapsed, aliased Testcenter unit repetitions remain addressable, missing display labels fall back to readable key-derived labels, and common `bookletId`/`unitId`/`identifier`/`ref` fields plus child XML identifiers/titles/content, CDATA text, resource/file/module/task, assessment-test/assessment-section, JSON/XML assessment-item/item-body, and item-ref aliases are accepted
- imports now fail explicitly with persisted job diagnostics when provided `contentStructure` or `sourceDocument` cannot produce a valid runtime structure
- ZIP source-document imports now distinguish persisted diagnostics for unreadable ZIP payloads (`source_document_zip_invalid`), ZIPs without a readable XML manifest (`source_document_zip_manifest_missing`), and manifest candidates that exist but cannot be inflated or read (`source_document_zip_manifest_unreadable`)
- ZIP source-document imports reject unsafe archive member names (including traversal, absolute, drive-qualified, control-character, overlong, and backslash paths) with `source_document_zip_entry_path_invalid` before a release can be staged
- guarded activation now returns explicit blocking details for open runs on the currently active release, so operators and the shell can see why a release switch was rejected
- runtime now supports `running -> paused -> running -> completed` on test-runs
- monitor controls let authorized operators pause, resume, complete, lock or unlock the entire test, globally unlock or re-lock participant navigation, set a timed block's replacement rest time, or force an open run to a selected unit from the operator shell; whole-test locking is persisted independently from pause/running status, blocks participant mutations with an explicit response, remains visible in starter/open-run cards and CSV exports, and honors imported `lock_test_on_termination` by retaining the current unit for a monitor-authorized continuation. The persisted monitor target is separate from the participant's current unit and drives both single-run and batch go-to/time commands, while old browser snapshots hydrate it from the prior shared value. Scoped monitors receive ordered, adaptivity-aware block choices from the open-run read model; after a successful jump, imported `autoselectNextBlock="yes"` profiles prepare the following visible block for the next click and clear the target after the final block, matching the original double-click workflow. Visible runs can be added to an exact-id batch preview and are confirmation-gated before a bounded, deduplicated best-effort dispatch whose response separates successes from per-run failures and leaves failures selected for retry; global navigation unlock durably bypasses code, leave-lock, and completeness guards without changing run status or reopening elapsed timed blocks, navigation re-lock restores authored rules for subsequent actions without reconstructing already consumed one-time gates, replacement time is parked until entry when the block is not current, and supervised go-to targets an exact unit, clears its code/leave locks, and reopens its closed timed block with the configured duration. Open-run cards, direct filters, imported monitor profiles, and CSV exports now expose the original Booklet Species (`species: N`, counting top-level testlets); their card layout applies imported `full`, `medium`, and `small` profile density as one-column, responsive medium, and compact responsive presentations. The Ops view includes a structured monitor-profile editor for layout settings, built-in visibility flags, and nested run filters; it can prepare profiles for a new monitor account or update the durable profile set of an existing scoped role without raw JSON. Every successful command persists a `monitor_run_command_issued` workspace activity event, surfaces filterable history acknowledgements, and keeps the open-run/read-model state in sync. The Runtime view now opens the authenticated workspace monitor event stream, displays its connection and last-event state, refreshes on versioned snapshot/change messages, reconnects automatically, and falls back to polling without treating computed countdown seconds as material changes. Scoped monitor selection stays within monitor-authorized reads and does not request participant-session details
- scoped monitor sessions additionally receive a profile-aware live dashboard over the same authorized open-run read model: visible runs, unique participants, running/paused/locked counts, and group totals update with monitor events. Group cards aggregate participant/run counts, booklet, current block, timer, and latest-activity context and can apply the corresponding open-run group filter without broadening server scope
- adaptive Testcenter booklets now import XML `States`, nested variable/aggregation conditions, and testlet `Show` restrictions; schema-aware import requires the original conditionless fallback option for every State and enforces the State/Option/If/source/aggregation/Is attribute and child surface instead of silently accepting routing syntax outside the XSD. In particular, `or` is accepted only on `Score`, as in the original schema. Original unit resource IDs and ZIP-relative `CodingSchemeRef` files resolve into immutable releases, missing/malformed/newer-major schemes fail with stable import diagnostics, and the original pinned `@iqb/responses@3.6.0` engine derives tracked codes, scores, indirect variables, and the exact IQB status rank server-side from raw IQB-standard Verona responses before selecting the first matching state option; executable gates cover both textual `CODING_COMPLETE` and its numeric status comparison. The server persists the original-equivalent `BOOKLET_STATES` snapshot at launch and after response saves, restores or backfills it from durable storage, and uses it to remove inactive units from participant menus, sequential navigation, code-gate scans, timed-block expiry routing, and completion while rejecting direct hidden-unit jumps; Demo/Review/Trial now expose the original-style adaptive selector, persist its override separately from the automatic recommendation across saves and reloads in every storage backend, and immediately rebuild the participant route; run detail, open-run monitor cards, and CSV exports expose the effective state options to operators
- completed test-runs now leave the monitor queue and persist their completion timestamp
- participant controller and Verona Player events now persist as first-class test-wide or unit-wide logs across memory, file, SQLite, and Postgres stores; Verona window-focus notifications and host focus/visibility changes are debounced into original-compatible test-wide `FOCUS=HAS|HAS_NOT` entries. Scoped operators can filter the JSON read model and export the original semicolon/BOM log-report columns, while the prior workspace activity timeline remains available through its own audit CSV route. Group-result deletion removes associated logs and reports the count

## Frontend Shell

- `GET /` and `GET /app` now serve a production-facing Angular shell from [apps/web/src/app/app.component.ts](/Users/julian/code/testcenter-rewrite/rewrite-app/apps/web/src/app/app.component.ts)
- the frontend is now split into routed views for workspace, content, runtime, and diagnostics via [apps/web/src/app/app.routes.ts](/Users/julian/code/testcenter-rewrite/rewrite-app/apps/web/src/app/app.routes.ts)
- the shell persists non-secret form context locally, exposes guided flows for admin bootstrap/sign-in, admin-session reads, admin user management with selectable role-assignment cards and filtered admin-user/audit reads plus admin-user/audit CSV export, tenant/workspace directory selection and CSV export, workspace bootstrap, workspace overview CSV export, file-backed source-document loading with draft preview for XML/JSON/manifest files, import, filtered source-package/import-job/content-release CSV export, runtime with a non-persisted participant-password field, persisted participant roster import/listing/export with validation warnings and local parse preview, a participant launchpad for roster/link/session handoff, participant route session re-entry and local leave/reset, participant-entry API-error guidance for ambiguous workspace and launch issues, CSV/XML/JSON entry-link preview/download, filtered content reads, filtered participant-session/response/review reads and CSV exports, participant test-log inspection plus original-style CSV export, selected-group Original-compatible result archives containing response/log/review CSV and JSON reports, filtered workspace activity reads plus a separate audit CSV export, study-monitor booklet/unit/run progress, monitor status/group/booklet/unit cards that seed participant-matrix filters, a monitor review queue with focused response/review handoff, direct Runtime handoff from monitor run, run-detail review, and unit-detail run cards plus Runtime preparation from monitor detail roster cards, and study-monitor summary/matrix/run-detail CSV export, surfaces operational summaries plus an activity feed, switches authenticated study/group monitors into a reduced role-aware console that performs only monitor-authorized reads, and now has repo-native browser smoke coverage for the runtime lifecycle, blocked activation guard, failed-import retry flow, protected admin directory, tenant/workspace directory export, workspace overview export, file-backed manifest loading, source-package/import-job/content-release CSV export, CSV/XML/JSON participant roster entry-link generation/export, participant launchpad state, typed group-result archive and deletion flows, study-monitor booklet/unit/run progress/export, admin-session reads, admin-user/audit CSV export, response/review/test-log/activity CSV export, operator timeline/session/content/runtime filters, open-run selection filter sync, group-monitor UI isolation, activation-blocking runtime handoff, run-detail review handoff, and unit-detail review handoff
- participant-matrix retrieval now keeps a 200-row server window independent from the operator's visible-card limit, so totals and hidden-row counts remain correct beyond 25 rows; detailed response cards always expose both session and test-run identity, including when a roster display name is present

## Current Persistence Boundary

- [packages/application/src/index.ts](/Users/julian/code/testcenter-rewrite/rewrite-app/packages/application/src/index.ts) now owns use-case logic and repository ports
- [packages/memory-store/src/index.ts](/Users/julian/code/testcenter-rewrite/rewrite-app/packages/memory-store/src/index.ts) provides the current runnable in-memory adapter
- [packages/file-store/src/index.ts](/Users/julian/code/testcenter-rewrite/rewrite-app/packages/file-store/src/index.ts) provides a durable JSON-file adapter for local development
- [packages/sqlite-store/src/index.ts](/Users/julian/code/testcenter-rewrite/rewrite-app/packages/sqlite-store/src/index.ts) provides the first relational adapter on top of `node:sqlite`, including tracked schema migrations and content-release runtime snapshots
- [packages/postgres-store/src/index.ts](/Users/julian/code/testcenter-rewrite/rewrite-app/packages/postgres-store/src/index.ts) provides a networked Postgres adapter with its own schema migration bootstrap and the same repository contract as the local stores
- the SQLite adapter now also persists raw source-package content used for import-time structure derivation
- memory, file, SQLite, and Postgres stores persist participant roster entries for operator-managed entry-link/run setup
- import-job persistence now also stores `finishedAt` and structured diagnostics for failed imports
- [apps/api/src/index.ts](/Users/julian/code/testcenter-rewrite/rewrite-app/apps/api/src/index.ts) wires `repository -> services -> HTTP`

## Integration Test Matrix

The production slice now has a small store matrix:

```bash
npm run test:integration
```

That runs:

- `memory`
- `file`
- `sqlite`

And there is an optional Postgres-backed run:

```bash
FIRST_SLICE_POSTGRES_URL=postgresql://rewrite:rewrite@127.0.0.1:5433/rewrite_app npm run test:integration:postgres
```

If `FIRST_SLICE_POSTGRES_URL` is not set, the optional Postgres test runner skips cleanly outside CI and fails in CI so a misconfigured Postgres matrix cannot pass silently. When it does run, it validates the Postgres URL scheme and parseability, then logs only a credential-redacted target. CI builds once, then uses the `:built` migration, doctor, integration, and startup scripts against the same compiled artifacts.

There are also built-process startup smoke checks:

```bash
npm run smoke:startup
npm run smoke:startup:file
npm run smoke:startup:sqlite
FIRST_SLICE_POSTGRES_URL=postgresql://rewrite:rewrite@127.0.0.1:5433/rewrite_app npm run smoke:startup:postgres
```

Those boot the built API process, poll `/healthz`, `/readyz`, `/manifest`, `/metrics`, `/metrics/prometheus`, and `/diagnostics/config`, verify `HEAD` compatibility and baseline security headers for health/readiness/shell/participant entrypoints plus frontend assets, confirm the effective operator-auth flag, verify build metadata when `APP_BUILD_SHA`/`APP_BUILD_TIMESTAMP` are set, assert Postgres credentials stay redacted in diagnostics, then stop the process again.

For graceful rollout verification, run:

```bash
npm run smoke:shutdown:file
npm run smoke:shutdown:sqlite
```

That boots the built API process, waits for readiness, sends `SIGTERM`, verifies `/readyz` switches to `503 service_draining`, and then checks that the process exits cleanly.

For browser-level frontend verification, run:

```bash
npm run install:browsers
npm run smoke:ui:content
npm run smoke:ui:json-roster
npm run smoke:ui:participant-entry
npm run smoke:ui:participant-code
npm run smoke:ui:activation-roster-warnings
npm run smoke:ui:review-readiness
npm run smoke:ui:monitor-review
npm run smoke:ui:monitor-detail-review
npm run smoke:ui:participant-detail-review
npm run smoke:ui:monitor-bulk
npm run smoke:ui:delete-group-results
npm run smoke:ui:admin-session-bulk
npm run smoke:ui:admin-password-bulk
npm run smoke:ui:admin-role-bulk
npm run smoke:ui:admin-status-bulk
npm run smoke:ui:admin-delete
npm run smoke:ui
npm run smoke:ui:operator-auth
FIRST_SLICE_POSTGRES_URL=postgresql://rewrite:rewrite@127.0.0.1:5433/rewrite_app npm run smoke:ui:postgres
```

The `smoke:ui:content` variant is a fast browser slice that stops after admin/workspace bootstrap, original loose multi-file upload, automatic transitive workspace-dependency capture, explicit fallback assembly, source-package import, release activation, and the content prompt read model; it also verifies direct unit `Definition` prompt extraction. The `smoke:ui:system-check` variant executes both original system-check definitions, migrates several original-format JSON reports through Angular, verifies resumable duplicate detection across a multi-check batch, and downloads legacy-compatible CSV plus JSON. The `smoke:ui:json-roster` variant continues through CSV/XML/original Testcenter `Login`/JSON roster import, saved roster export, and generated participant entry links. The `smoke:ui:participant-entry` variant continues through participant-route action gating, sign-in, start/resume, session re-entry, direct `Definition` prompt display, completion, and local leave/reset. The `smoke:ui:participant-code` variant stops after verifying the original password-first `<Booklet codes>` challenge, invalid-code guidance, code-scoped session creation, and non-persistence of the code in browser storage. The `smoke:ui:activation-roster-warnings` variant continues to the staged-release roster compatibility warning drill-down before stopping. The `smoke:ui:review-readiness` variant continues through participant start, detailed response filtering, review creation/filtering, and the runtime review-readiness checklist. The `smoke:ui:monitor-review` variant continues through the study-monitor review queue and verifies the focused response/review handoff into Runtime. The `smoke:ui:monitor-detail-review` variant verifies booklet-detail and group-detail response/review handoffs into Runtime. The `smoke:ui:participant-detail-review` variant verifies the participant-matrix drill-down and participant-detail response/review handoff into Runtime. The `smoke:ui:monitor-bulk` variant verifies exact-id selection, confirmation, bulk pause/resume responses, and live run-state reconciliation. The `smoke:ui:delete-group-results` variant verifies result-group selection, the three selected-group CSV downloads, workspace-key-confirmed aggregate deletion, and its post-delete read-model/activity effects. The `smoke:ui:admin-session-bulk` variant verifies exact active-session selection, signed-in-session exclusion, confirmation, server-side delegation/audit enforcement, and revocation of two live delegated bearer sessions. The `smoke:ui:admin-password-bulk` variant generates a distinct 24-character password for each selected account, applies every reset through the existing delegation boundary, verifies old/new sign-in behavior, and validates the one-time CSV handoff plus in-memory cleanup. The `smoke:ui:admin-role-bulk` variant reuses the bounded exact account selection to assign one scoped role to two accounts through independent delegation checks and audit events, retaining only failures for retry. The `smoke:ui:admin-status-bulk` variant disables two delegated accounts through Angular, proves their live bearer tokens are rejected, and confirms that both session IDs are formally visible as revoked. The `smoke:ui:admin-delete` variant permanently deletes two delegated accounts through Angular, verifies their directory and session removal, and requires retained deletion audits with exact role/session counts. The full SQLite variants build the Angular frontend, boot the built API process on SQLite, and drive a real browser through:

- admin bootstrap, current-session, sign-out, sign-in, protected tenant/workspace directory reads, protected admin-user and audit read models plus their filters, admin-user creation, individual and bounded unique-password batch resets, scoped role assignment/revocation, bounded best-effort session revocation, status deactivation with cascading live-session revocation, and confirmed permanent account deletion with retained audit evidence
- workspace bootstrap and workspace overview export
- source-package import/export, protected byte-exact source-file download with file-size/dependency cards, import-job/content-release export, release activation, direct unit `Definition` prompt extraction, and roster-compatibility warning drill-downs for staged releases
- original system-check execution, saved-report statistics/deletion, resumable multi-file legacy JSON migration, and original-compatible CSV/JSON report exports
- participant sign-in, optional participant-password entry, original per-booklet second-code challenge, code-scoped session reuse, session resume, direct `Definition` prompt display, and participant completion
- byte-exact execution of the complete original three-unit IQB Aspect 2.12.3 booklet, including text/radio/page-state persistence, the 16.17 MB four-image Voud, separate Prev/Next controls, forward/backward host navigation, and reload restoration
- CSV/TSV/semicolon roster import with canonical or alias headers, XML/original Testcenter `Login`/JSON participant roster import including password-required metadata, participant-session export, and open-run export through the runtime shell
- response and review CSV export plus review-readiness inspection through the runtime shell
- study-monitor summary, prioritized attention cards, status/group/booklet/unit-card participant-matrix filtering, review queue with focused response/review handoff, group drill-down, booklet drill-down, unit-progress cards, run drill-down, direct monitor-run Runtime handoff, monitor-detail Runtime preparation, study-monitor CSV export, filtered participant-matrix CSV export, selected run-detail CSV export, and open-run CSV export
- workspace activity filtering and workspace log CSV export
- failed import diagnostics on a broken package
- retrying that failed import on the same package identity
- diagnostics and config reads

The named `smoke:ui:verona-player-families` slice stops after executing the official Simple Player generations plus the independent ABI 3.3.0 scripted-survey and DAN 3.0.0 visual-assessment Players, including type-faithful API-2 response restoration after reload.

The DAN corpus additionally imports the official Testbed's historical, metadata-free `IQBVisualUnitPlayerV2.99.2.html`, original `G231mm.xml`, and byte-exact `G231mm.voud` as a real relative `DefinitionRef` graph. It keeps the stable legacy metadata warning and runtime-handshake authority instead of treating the historical definition-format key as an alias for the modern `iqb-player-dan` module id.

The `smoke:ui:operator-auth` variant repeats the browser flow with `FIRST_SLICE_OPERATOR_AUTH_REQUIRED=true`, verifying that the shell can carry the admin bearer session into protected operator routes. The `smoke:ui:postgres` variant migrates the configured Postgres database first, then runs the protected browser flow against the Postgres-backed API.

For the full containerized release path, run:

```bash
APP_BUILD_SHA=$(git rev-parse --short HEAD) npm run smoke:compose:postgres
```

If another local API already uses port `4310`, run the compose smoke on an
alternate host port:

```bash
REWRITE_APP_PORT=4311 APP_BUILD_SHA=$(git rev-parse --short HEAD) npm run smoke:compose:postgres
```

That verifies:

- compose build
- Postgres health
- one-shot migration role
- API readiness
- non-root API container user
- Postgres schema-version propagation through readiness, manifest, and config
- redacted Postgres storage locations in manifest and config
- build metadata propagation into the running API manifest
- production-like operator auth configuration in the composed API service

When `FIRST_SLICE_BOOTSTRAP_DEMO=true` is set, the same compose smoke also verifies the seeded demo state by signing in as `demo-admin`, reading the protected demo workspace overview, exporting the demo participant roster CSV, signing in `student-demo`, and resuming the demo booklet against Postgres.

Set `SMOKE_COMPOSE_UP_TIMEOUT_MS` to tune how long the compose smoke waits for `docker compose up --build` before failing with diagnostics. The default is `180000` ms.

For runtime probes:

- `/healthz` is a liveness check
- `/readyz` is a storage-aware readiness check
- `/metrics` returns JSON runtime metrics including normalized request counts by route, route latency summaries, and process memory
- `/metrics/prometheus` exposes the same runtime counters in Prometheus text format
- `/diagnostics/runtime` returns recent in-process operational events together with build, storage, and memory context
- `/diagnostics/config` returns the effective redacted runtime configuration, including storage mode, port, drain timing, JSON body limit, HTTP timeouts, participant login-protection thresholds, and whether operator auth is required
- `/speed-test/random-package/:size` and `/speed-test/random-package` provide bounded, cache-disabled download and upload packages for configured system-check throughput measurements
- `/manifest` exposes the active storage mode, schema version, routes, use-case surface, and operator/production capability list
- JSON, HTML, text, CSV, asset, and redirect responses include baseline security headers (`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, and `Permissions-Policy`)
- `db:doctor` reports storage reachability plus current vs. target schema version where applicable
- `db:migrate` applies the adapter-managed schema migrations without going through the HTTP server boot path

## CI / Deployability

- [ci.yml](/Users/julian/code/testcenter-rewrite/rewrite-app/.github/workflows/ci.yml) now verifies:
  - Node 22 typecheck and production build
  - focused unit tests for shared contracts and file-store helpers
  - built runtime preflight against file, SQLite, and Postgres stores
  - metadata-required file/SQLite deployability preflight plus built startup smoke
  - memory + file + sqlite integration matrix
  - Postgres migration, doctor, startup smoke, and integration against a service database
  - protected browser-driven Angular UI smoke against a Postgres service database
  - file and SQLite startup/shutdown, grouped quick/review/monitor/ops browser suites, full browser, and local-demo smokes as isolated matrix jobs
  - standalone production Docker image runtime smoke with image-time artifact preflight, in-container SQLite migration, non-root API start, and `/readyz`/`/manifest`/`/app` verification
  - Docker compose release smoke with explicit migrate, preflight, and api roles
- [package.json](/Users/julian/code/testcenter-rewrite/rewrite-app/package.json) exposes local CI-shaped gates: `ci:static` for typecheck/unit/build/preflight, `ci:storage` for memory/file/SQLite integration plus file/SQLite startup/shutdown, `ci:browser:quick` (including the offline App-Shell gate), `ci:browser:review`, `ci:browser:monitor`, and `ci:browser:ops` for grouped built Angular browser smokes, `ci:deployability` for file/SQLite metadata-required built-runtime preflight and startup smoke, and `ci:postgres` for the Postgres-backed migration/doctor/preflight/startup/integration/UI sequence
- [Dockerfile](/Users/julian/code/testcenter-rewrite/rewrite-app/Dockerfile) provides a multi-stage production image build, runtime artifact preflight during image creation, non-root runtime user, and image-level `/readyz` healthcheck that follows the container `PORT`
- [docker-compose.postgres.yml](/Users/julian/code/testcenter-rewrite/rewrite-app/docker-compose.postgres.yml) provides a local Postgres-backed release flow with separate migrate, runtime preflight, and api services, restart policies, and service healthchecks
- [.env.example](/Users/julian/code/testcenter-rewrite/rewrite-app/.env.example) documents the supported runtime environment variables

The original Aspect 17.4 execution gate now imports the byte-exact companion `testtaker1.xml` roster and runs its real passwordless `testuser1` account in the production browser. Contract and API coverage pin the source hash, group, Custom Text, password-free and password-protected Hot-Return accounts, Review account, and password-redacted monitor migration candidate before launching the original player package.

The complete original 17.6 showcase package is also an executable compatibility gate. Its seven byte-exact source files are uploaded separately and resolved into one immutable workspace dependency snapshot: `Booklet.xml`, both Units, the external `SAMPLE_UNITCONTENTS.HTM`, the Verona 6 player, the coding scheme, and the nested `.itcr.zip` resource. The importer accepts the schema-valid schemer-only empty `CodingSchemeRef` without weakening validation of non-empty references, resolves the same resource dependency declared for player and editor once, preserves legacy and modern player aliases plus the repeated Unit alias, and executes the real passwordless `test-no-pw` account with external-definition response restoration and resource delivery in the production browser.

It is still intentionally lightweight:

- persistence can be in-memory, JSON-file-backed, SQLite-backed, or Postgres-backed
- importer behavior is still limited, but can now derive and normalize runtime structure from source-package metadata plus manifest-like JSON/XML documents, content-sniffed manifest text or base64 ZIP manifests from package-style uploads with referenced booklet/unit/dependency XML and Verona player HTML extraction, IMS resource identifiers, Testcenter unit aliases, inline direct or ZIP unit `Definition` content, ZIP-relative `DefinitionRef` content, and IMS `xml:base` or JSON `base`/`xml:base` resource/file path resolution, keyed JSON booklet/unit maps, JSON/XML default organization selection, keyed JSON IMS organization/resource/dependency maps, delimited JSON unit-reference strings, IMS organization/resource dependency manifests with XML resource/dependency aliases, nested package/test wrapper objects, booklet/testlet/assessment-test/assessment-section/unit/resource/file/assessment-item/item-ref aliases, JSON item bodies, child XML text fields, CDATA bodies, flat or header-mapped delimited rosters, nested Testtaker/Participant-style XML rosters, original Testcenter `Testtakers`/`Login` XML rosters with ordered state-preset assignment variants, and JSON participant roster structures supplied as text or native request JSON
- participant launch is still simplified, but now supports one-step starter launch, explicit tenant/workspace scoping with ambiguous workspace-key rejection, group keys, optional roster-password checks, original per-booklet second-code challenges with code-scoped durable sessions, saved-roster display context, ordered multi-booklet assignments—including differently preset variants of the same source booklet—with available/in-progress/completed starter state and sequential runs in one participant session, booklet selection on participant entry links, and booklet-scoped unit validation when saving progress
- monitor reads now include workspace summary, prioritized attention items, group drill-down, participant drill-down, booklet drill-down, unit drill-down, unit-progress coverage, participant-by-unit matrix export, selected run-detail export, saved-roster expected/not-started participants, CSV exports, open-run blockers, and confirmation-gated single/bulk pause/resume/complete/go-to/whole-test-lock/unlock/navigation-unlock/re-lock/time-adjustment controls, but still do not cover every original Testcenter monitor view
