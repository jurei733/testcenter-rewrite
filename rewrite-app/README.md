# Testcenter Rewrite App

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
8. monitor read visibility for open runs

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
- participant entry URL: `http://127.0.0.1:4310/participant?tenantKey=demo-tenant&workspaceKey=demo-workspace&loginKey=student-demo&groupKey=group:student-demo&bookletKey=booklet:demo`

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

That executes:

- typecheck
- build
- focused unit tests for shared contracts helpers
- memory + sqlite integration tests
- a built-server startup smoke test against SQLite
- a built-server graceful shutdown/drain smoke test against SQLite
- browser-driven Angular UI smokes against SQLite in open and protected operator modes

For explicit storage administration, run:

```bash
npm run db:doctor
npm run db:migrate
FIRST_SLICE_STORE=sqlite npm run db:doctor:sqlite
FIRST_SLICE_STORE=sqlite npm run db:migrate:sqlite
FIRST_SLICE_POSTGRES_URL=postgresql://rewrite:rewrite@127.0.0.1:5433/rewrite_app npm run db:doctor:postgres
FIRST_SLICE_POSTGRES_URL=postgresql://rewrite:rewrite@127.0.0.1:5433/rewrite_app npm run db:migrate:postgres
```

These commands use the built storage adapters directly and do not require the API process to be running.

The `:built` variants are intended for already-built container/runtime contexts, where `tsc` is not available:

```bash
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

For a production-like operator surface, require an admin bearer session on platform/workspace/content/monitor API routes. Platform admins can access all operator routes, tenant admins can access their tenant, and workspace admins can access their workspace:

```bash
FIRST_SLICE_OPERATOR_AUTH_REQUIRED=true npm run start:api
```

For a local containerized API + Postgres stack, run:

```bash
npm run start:compose:postgres
```

The container image and compose stack default `FIRST_SLICE_OPERATOR_AUTH_REQUIRED=true`, so the operator surface starts in a production-like protected mode. Set `FIRST_SLICE_OPERATOR_AUTH_REQUIRED=false` only for an intentionally open local sandbox.

To start the same Postgres-backed stack with the local demo tenant, admin, active release, and participant link pre-seeded, run:

```bash
npm run start:compose:postgres:demo
```

Stop the compose stack with:

```bash
npm run stop:compose:postgres
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

The Docker build context excludes local `.env`, `.env.local`, data, cache, and build-output files so local secrets or generated state are not sent to the Docker daemon.

`FIRST_SLICE_MAX_JSON_BODY_BYTES` defaults to `1048576` and limits JSON command payloads before they are accumulated in memory. Oversized requests return `413 request_body_too_large`.

`PORT` must be between `1` and `65535`. `SHUTDOWN_DRAIN_DELAY_MS` must be a non-negative integer. `HTTP_HEADERS_TIMEOUT_MS`, `HTTP_REQUEST_TIMEOUT_MS`, and `HTTP_KEEP_ALIVE_TIMEOUT_MS` default to `60000`, `120000`, and `5000`, respectively. They are applied to the Node HTTP server and exposed through `/diagnostics/config`.

`APP_BUILD_SHA` and `APP_BUILD_TIMESTAMP` are optional and surface through the API manifest, metrics, and startup banner for release identification.

When you build the production image, you can also pass them as Docker build args:

```bash
docker build \
  --build-arg APP_BUILD_SHA=$(git rev-parse --short HEAD) \
  --build-arg APP_BUILD_TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ) \
  -f Dockerfile .
```

## Current Live Flow

The first production workspace now serves a small in-memory HTTP baseline with:

- `POST /api/v1/admin/auth/bootstrap`
- `POST /api/v1/admin/auth/sign-in`
- `GET /api/v1/admin/auth/current-session`
- `POST /api/v1/admin/auth/sign-out`
- `GET /api/v1/admin/users`
- `POST /api/v1/admin/users`
- `PATCH /api/v1/admin/users/{adminUserId}`
- `POST /api/v1/admin/users/{adminUserId}/password`
- `POST /api/v1/admin/users/{adminUserId}/role-assignments`
- `DELETE /api/v1/admin/users/{adminUserId}/role-assignments/{roleAssignmentId}`
- `GET /api/v1/admin/audit-events`
- `GET /api/v1/platform/tenants`
- `POST /api/v1/platform/tenants`
- `GET /api/v1/tenants/{tenantKey}/workspaces`
- `POST /api/v1/tenants/{tenantKey}/workspaces`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/study-monitor/summary`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/study-monitor/groups/{groupKey}`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/study-monitor/booklets/{bookletKey}`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/study-monitor/units/{unitKey}`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/exports/study-monitor.csv`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/activity-events`
- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/source-packages`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/source-packages`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/source-packages/{sourcePackageId}`
- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/source-packages/{sourcePackageId}/retry-import`
- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/import-jobs`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/import-jobs`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/import-jobs/{importJobId}`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/participant-sessions`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/participant-sessions/{participantSessionId}`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/participant-roster`
- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/participant-roster`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/exports/participant-roster.csv`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/responses/detailed`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/reviews`
- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/reviews`
- `PATCH /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/reviews/{reviewId}`
- `DELETE /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/reviews/{reviewId}`
- `DELETE /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/results/groups/{groupKey}`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/exports/responses.csv`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/exports/logs.csv`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/exports/reviews.csv`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/content-releases`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/content-releases/{contentReleaseId}`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/content-releases/{contentReleaseId}/activation-readiness`
- `POST /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/content-releases/{contentReleaseId}/activate`
- `POST /api/v1/participant/auth/sign-in`
- `GET /api/v1/participant/sessions/{participantSessionId}/runtime-state`
- `GET /api/v1/participant/sessions/{participantSessionId}/current-state`
- `POST /api/v1/participant/starter:launch`
- `POST /api/v1/participant/test-runs/{testRunId}/save-progress`
- `POST /api/v1/participant/sessions/{participantSessionId}/resume`
- `POST /api/v1/participant/test-runs/{testRunId}/resume`
- `POST /api/v1/participant/test-runs/{testRunId}/complete`
- `GET /api/v1/tenants/{tenantKey}/workspaces/{workspaceKey}/monitor/open-runs`

The added read side now makes the first slice inspectable:

- admin bootstrap creates the first platform admin, bearer sessions can be checked/revoked, and the protected admin directory can create users, reset passwords, assign/revoke platform/tenant/workspace roles, update status, and prevent self-disable or self platform-role revoke lockouts
- protected admin directory reads are filterable by username, status, role, tenant/workspace scope, and limit so platform operators can narrow user-management follow-up without leaving the shell
- admin audit events persist a protected platform-admin trail for bootstrap, failed/successful sign-in, sign-out, user management, password reset, and role assignment/revocation, filterable by event type, actor admin id, subject admin id, and limit
- `FIRST_SLICE_OPERATOR_AUTH_REQUIRED=true` protects platform/workspace/content/monitor routes with scoped admin bearer sessions while leaving participant runtime routes available to participants
- tenant and workspace directory reads let operators discover available scopes before drilling into a specific workspace
- workspace overview returns workspace state plus source-package, import, release, session, and open-run counts
- study monitor summary returns workspace-wide group, booklet, and unit progress with participant sessions, saved-roster expected/not-started participants for groups and booklets, roster-derived missing unit expectations, latest run states, response counts, review counts, and latest activity timestamps
- study monitor group detail drills into one group with participant sessions, saved roster entries, status counts, latest runs, response counts, review counts, and per-run context for operator follow-up
- study monitor booklet detail drills into one booklet with saved roster entries, attached runs, status pressure, unit coverage, response counts, and review counts
- study monitor CSV export flattens workspace, group, booklet, unit, and not-started participant rows for operator handoff outside the shell
- source-package listing shows uploaded packages together with their latest import attempt, filterable by status, media type, file name, latest import status, and limit
- source-package detail now shows the full retry/import history and any releases that were produced from that package
- import-job listing shows completed and failed imports together with persisted diagnostics and source-package context, filterable by status, source package, and limit
- import-job detail now resolves a single import attempt together with its source package and resulting release, if one exists
- participant-session listing now gives operators a workspace-wide view of signed-in sessions together with each session's latest run and linked content release, filterable by status, group, login, content release, and limit
- participant-session detail now resolves one session together with its content release, full run history, response counts, review counts, and attached review context
- participant roster import now persists operator-managed login/group/booklet/display-name rows from CSV/TSV/semicolon text or Testtaker/Participant-style XML, uses the same roster formats for direct participant-entry-link generation, upserts repeated logins within a workspace, records roster import activity, returns validation warnings when assigned booklets cannot be checked against the active release or are missing from it, and exports saved roster rows as CSV
- detailed response inspection returns workspace-wide saved answers with participant, run, unit, and status context, filterable by login, group, session, run, unit, status, and limit
- review comments let operators attach, edit, list, delete, and export reviewer notes for concrete test runs or units, with review reads filterable by login, group, session, run, unit, reviewer, category, and limit
- group result deletion removes collected test runs for one group, reports deleted runs/responses, and records a workspace activity event
- response CSV export returns persisted unit responses with participant, run, booklet, unit, status, timestamp, and saved-roster display/assignment context, using the same filters as detailed response inspection
- workspace log CSV export returns the persisted activity timeline with event metadata and details JSON
- review CSV export returns persisted operator comments with participant, run, booklet, unit, reviewer, category, timestamp, and saved-roster display/assignment context, using the same filters as review reads
- content-release detail now resolves a single release together with its import/source-package lineage, attached sessions/runs, and neighboring activation history within the workspace release line
- content-release activation readiness now previews whether a staged release can be switched in immediately, whether open runs block it, and whether saved roster booklet assignments would warn against the selected release
- workspace activity events now provide a persisted operator timeline for setup, import, activation, and runtime actions, filterable by event type, subject type, subject id, and limit
- failed source packages can now be retried in place with corrected manifest data, producing a fresh import job on the same package identity
- content-release listing returns staged/active/superseded releases together with their import/source-package lineage, filterable by status, import job, source package, and limit
- participant runtime can now be re-entered through session context, not only through `testRunId`
- participant sign-in now reuses an existing non-closed session for the same login and active content release, preventing duplicate monitor rows when a participant re-enters
- participant entry links and sign-in requests can now carry an explicit `groupKey`; omitted groups still default to `group:{loginKey}` for backward-compatible links
- participant launch/resume can now carry an explicit `tenantKey` and `bookletKey` so entry links and operator flows can start a specific booklet from the intended tenant/workspace active release
- participant progress saves now validate `currentUnitKey` against the selected booklet's runtime snapshot before storing responses, and status/response-only saves retain the current unit for player clients that do not repeat the unit key on every save
- study-monitor reads now include workspace summary, group drill-down, booklet drill-down, and unit drill-down with per-run answer/missing/review status plus saved-roster expected/missing unit coverage
- participant current-state now returns a lightweight `booklet`/`currentUnit` projection plus available actions, sourced from a small content-release runtime snapshot
- source-package intake can now optionally carry a small structured `contentStructure` or JSON/XML source document with booklet/testlet and unit/unitRef entries, which the import step turns into the release runtime snapshot
- source-package intake now rejects blank file names, blank media types, and non-string source documents before an import job is created
- source-package intake can now also carry a manifest-like `sourceDocument`; the import step derives booklet/unit structure from JSON or XML/manifest content when no explicit `contentStructure` is given, including nested testcenter/package/test wrapper objects and JSON/XML IMS resource dependency manifests
- manifest-derived runtime structures are normalized during import: keys are trimmed, duplicate booklet/unit entries are collapsed, missing display labels fall back to readable key-derived labels, and common `bookletId`/`unitId`/`identifier`/`ref` fields plus resource/file/module/task, assessment-test/assessment-section, and item-ref aliases are accepted
- imports now fail explicitly with persisted job diagnostics when provided `contentStructure` or `sourceDocument` cannot produce a valid runtime structure
- guarded activation now returns explicit blocking details for open runs on the currently active release, so operators and the shell can see why a release switch was rejected
- runtime now supports `running -> paused -> running -> completed` on test-runs
- completed test-runs now leave the monitor queue and persist their completion timestamp

## Frontend Shell

- `GET /` and `GET /app` now serve a production-facing Angular shell from [apps/web/src/app/app.component.ts](/Users/julian/code/testcenter-rewrite/rewrite-app/apps/web/src/app/app.component.ts)
- the frontend is now split into routed views for workspace, content, runtime, and diagnostics via [apps/web/src/app/app.routes.ts](/Users/julian/code/testcenter-rewrite/rewrite-app/apps/web/src/app/app.routes.ts)
- the shell persists form context locally, exposes guided flows for admin bootstrap/sign-in, admin user management with selectable role-assignment cards and filtered admin-user/audit reads, tenant/workspace directory selection, workspace bootstrap, file-backed source-document loading with draft preview for XML/JSON/manifest files, import, runtime, persisted participant roster import/listing/export with validation warnings and CSV/XML entry-link preview/download, filtered content reads, filtered participant-session/response/review reads and CSV exports, filtered workspace activity reads plus log CSV export, study-monitor booklet/unit progress, and study-monitor CSV export, surfaces operational summaries plus an activity feed, and now has repo-native browser smoke coverage for the runtime lifecycle, blocked activation guard, failed-import retry flow, protected admin directory, file-backed manifest loading, participant roster entry-link generation/export, study-monitor booklet/unit progress/export, response/review/log CSV export, and operator timeline/session/content/runtime filters

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
- `sqlite`

And there is an optional Postgres-backed run:

```bash
FIRST_SLICE_POSTGRES_URL=postgresql://rewrite:rewrite@127.0.0.1:5433/rewrite_app npm run test:integration:postgres
```

If `FIRST_SLICE_POSTGRES_URL` is not set, the optional Postgres test runner skips cleanly outside CI and fails in CI so a misconfigured Postgres matrix cannot pass silently. When it does run, it validates the Postgres URL shape and logs only a credential-redacted target. CI builds once, then uses the `:built` migration, doctor, integration, and startup scripts against the same compiled artifacts.

There are also built-process startup smoke checks:

```bash
npm run smoke:startup
npm run smoke:startup:sqlite
FIRST_SLICE_POSTGRES_URL=postgresql://rewrite:rewrite@127.0.0.1:5433/rewrite_app npm run smoke:startup:postgres
```

Those boot the built API process, poll `/healthz`, `/readyz`, `/manifest`, `/metrics`, `/metrics/prometheus`, and `/diagnostics/config`, verify `HEAD` compatibility for health/readiness/shell/participant entrypoints, confirm the effective operator-auth flag, verify build metadata when `APP_BUILD_SHA`/`APP_BUILD_TIMESTAMP` are set, assert Postgres credentials stay redacted in diagnostics, then stop the process again.

For graceful rollout verification, run:

```bash
npm run smoke:shutdown:sqlite
```

That boots the built API process, waits for readiness, sends `SIGTERM`, verifies `/readyz` switches to `503 service_draining`, and then checks that the process exits cleanly.

For browser-level frontend verification, run:

```bash
npm run install:browsers
npm run smoke:ui
npm run smoke:ui:operator-auth
```

That builds the Angular frontend, boots the built API process on SQLite, and drives a real browser through:

- admin bootstrap, current-session, sign-out, sign-in, protected tenant/workspace directory reads, protected admin-user and audit read models plus their filters, admin-user creation, password reset, scoped role assignment/revocation, and status deactivation
- workspace bootstrap
- source-package import and release activation
- participant sign-in and session resume
- participant roster export through the runtime shell
- response and review CSV export through the runtime shell
- study-monitor summary, group drill-down, booklet drill-down, unit-progress cards, and study-monitor CSV export
- workspace activity filtering and workspace log CSV export
- failed import diagnostics on a broken package
- retrying that failed import on the same package identity
- diagnostics and config reads

The `smoke:ui:operator-auth` variant repeats the browser flow with `FIRST_SLICE_OPERATOR_AUTH_REQUIRED=true`, verifying that the shell can carry the admin bearer session into protected operator routes.

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
- `/diagnostics/config` returns the effective redacted runtime configuration, including storage mode, port, drain timing, JSON body limit, HTTP timeouts, and whether operator auth is required
- `/manifest` exposes the active storage mode, schema version, routes, use-case surface, and operator/production capability list
- `db:doctor` reports storage reachability plus current vs. target schema version where applicable
- `db:migrate` applies the adapter-managed schema migrations without going through the HTTP server boot path

## CI / Deployability

- [.github/workflows/ci.yml](/Users/julian/code/testcenter-rewrite/rewrite-app/.github/workflows/ci.yml) now verifies:
  - Node 22 typecheck and production build
  - focused unit tests for shared contracts helpers
  - memory + sqlite integration matrix
  - Postgres migration, doctor, startup smoke, and integration against a service database
  - SQLite startup, shutdown, browser, protected-operator, and local-demo smokes
  - Docker compose release smoke with explicit migrate + api roles
- [Dockerfile](/Users/julian/code/testcenter-rewrite/rewrite-app/Dockerfile) provides a multi-stage production image build, non-root runtime user, and image-level `/readyz` healthcheck that follows the container `PORT`
- [docker-compose.postgres.yml](/Users/julian/code/testcenter-rewrite/rewrite-app/docker-compose.postgres.yml) provides a local Postgres-backed release flow with separate migrate and api services, restart policies, and service healthchecks
- [.env.example](/Users/julian/code/testcenter-rewrite/rewrite-app/.env.example) documents the supported runtime environment variables

It is still intentionally lightweight:

- persistence can be in-memory, JSON-file-backed, SQLite-backed, or Postgres-backed
- importer behavior is still limited, but can now derive and normalize runtime structure from source-package metadata plus manifest-like JSON/XML documents, IMS organization/resource dependency manifests, nested package/test wrapper objects, booklet/testlet/assessment-test/assessment-section/unit/resource/file/item-ref aliases, and Testtaker/Participant-style XML rosters
- participant launch is still simplified, but now supports explicit tenant/workspace scoping, group keys, booklet selection on participant entry links, and booklet-scoped unit validation when saving progress
- monitor reads now include workspace summary, group drill-down, booklet drill-down, unit drill-down, unit-progress coverage, saved-roster expected/not-started participants, CSV export, and open-run blockers, but still do not cover every original Testcenter monitor view
