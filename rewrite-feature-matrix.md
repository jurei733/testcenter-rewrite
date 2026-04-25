# Testcenter Rewrite Feature Matrix

## Purpose

This document turns the current IQB-Testcenter product surface into a rewrite backlog.

Target labels:

- `v1 parity`: Must exist in the first rewrite release because it is core behavior today.
- `v1 improved`: Must exist in the first rewrite release, but should be redesigned rather than copied literally.
- `post-v1`: Keep on the roadmap, but it can land after the first stable rewrite release.

## Product Boundaries

The rewrite should treat the current system as a product with these core domains:

1. Authentication and session lifecycle
2. Test delivery runtime
3. Monitoring and operational control
4. Content import and validation
5. Data collection and exports
6. Workspace and instance administration
7. System check and attachment workflows

The rewrite should **not** assume the current technical split of Angular + PHP + Nest + nginx/lua is the correct future shape.

## Rewrite Principles

- Keep XML and Verona compatibility at the import/runtime edge, not as the internal architecture.
- Create a new canonical content format and domain model internally, while continuing to support XML ingestion as a first-class adapter.
- Replace mode-specific hidden behavior with explicit domain rules and policy objects.
- Use one canonical domain model for `workspace`, `login`, `booklet`, `test run`, `session`, `command`, `attachment`, `sys-check`, and `report`.
- Preserve operator trust by keeping exports, auditability, and control flows first-class.
- Prefer a modular monolith for the first rewrite unless a hard scaling or deployment constraint proves otherwise.
- Design for multi-tenant deployment from day one, with tenant-aware isolation, configuration, storage, and operations.

## Capability Matrix

### 1. Participant Access And Session Lifecycle

| Capability | Evidence | Target | Notes |
| --- | --- | --- | --- |
| Login by direct link | `e2e/Session-Management/login-possibilities.cy.ts` | `v1 parity` | Existing one-click access must remain. |
| Login by username/password | `e2e/Session-Management/login-possibilities.cy.ts` | `v1 parity` | Core access path for many studies. |
| Login by username only | `e2e/Session-Management/login-possibilities.cy.ts` | `v1 parity` | Required for low-friction survey flows. |
| Two-step login with extra code | `e2e/Session-Management/login-possibilities.cy.ts` | `v1 parity` | Important for supervised sessions. |
| Auto-start when exactly one booklet is available | `frontend/src/app/app-route-guards.ts` | `v1 improved` | Keep behavior, but make routing/session logic simpler and explicit. |
| Auto-start when exactly one system check is available | `frontend/src/app/app-route-guards.ts` | `v1 improved` | Same as above. |
| Multiple booklets per participant login | `starter.component.ts`, user manual | `v1 parity` | Must support sequential work under one identity. |
| Resume running test from starter | `starter.component.ts` | `v1 parity` | Continue vs start is part of current UX contract. |
| Valid-from / valid-to / valid-for access windows | `e2e/Session-Management/time-limited-access.cy.ts` | `v1 parity` | Important for scheduled field operations. |
| Separate admin and participant sessions | `e2e/Session-Management/login-sink.cy.ts` | `v1 parity` | Current system treats them independently. |
| Brute-force/login sink protection | `e2e/Session-Management/login-sink.cy.ts` | `v1 improved` | Preserve protection, redesign as explicit security policy with observability. |
| Supported browser detection and warning | `SystemController::getConfig`, user-agent service | `v1 parity` | Operators need clear compatibility messaging. |
| Custom per-login text overrides | `docs/pages/custom-texts.md`, `XMLFileTesttakers.class.php` | `v1 parity` | Preserve study-specific language customization. |

### 2. Execution Modes

| Capability | Evidence | Target | Notes |
| --- | --- | --- | --- |
| `RUN-DEMO` | `definitions/test-mode.json` | `v1 parity` | Keep as no-save preview mode. |
| `RUN-HOT-RETURN` | `definitions/test-mode.json`, e2e hot-return | `v1 parity` | Core production mode with saved progress and resume. |
| `RUN-HOT-RESTART` | `definitions/test-mode.json`, e2e hot-restart | `v1 parity` | Core production mode with new session semantics. |
| `RUN-REVIEW` | `definitions/test-mode.json`, review e2e | `v1 parity` | Needed for review/comment workflows without saved responses. |
| `RUN-TRIAL` | `definitions/test-mode.json` | `v1 parity` | Keep as save-plus-review evaluation mode. |
| `RUN-SIMULATION` | `definitions/test-mode.json` | `v1 parity` | Keep as no-save mode with production restrictions. |
| `MONITOR-GROUP` | `definitions/test-mode.json` | `v1 parity` | Core operator workflow. |
| `MONITOR-STUDY` | `definitions/test-mode.json` | `v1 parity` | Needed for study-wide progress view. |
| `SYS-CHECK-LOGIN` | `definitions/test-mode.json`, sys-check e2e | `v1 parity` | Preserves controlled access to system checks. |
| Mode capability matrix as data, not scattered conditionals | `definitions/test-mode.json`, FE/BE TODOs | `v1 improved` | The rewrite should centralize mode rules in one domain policy layer. |

### 3. Test Delivery Runtime

| Capability | Evidence | Target | Notes |
| --- | --- | --- | --- |
| Verona player integration | README, `test-loader.service.ts`, unithost | `v1 parity` | This is a hard compatibility boundary. |
| Verona Player API version validation | `workspace-admin/files.component.ts`, `unithost.component.ts` | `v1 parity` | Must reject incompatible content clearly. |
| Booklet loading and unit navigation | `TestController`, runtime e2e | `v1 parity` | Core delivery behavior. |
| Autosave of responses | backend test routes, hot-mode e2e | `v1 parity` | Must not regress. |
| Autosave of unit/test state | `putUnitState`, `patchState`, runtime code | `v1 parity` | Required for resume and monitoring. |
| Resume after browser reload/interruption | hot-return flows, state routes | `v1 parity` | Essential field reliability behavior. |
| Last-page restore on return | `restore_current_page_on_return.cy.ts` | `v1 parity` | Existing configurable behavior. |
| Timed blocks and warnings | `time-restrictions.cy.ts`, booklet config docs | `v1 parity` | Preserve exact operator expectations. |
| Unlock code gated progression | hot-mode e2e, booklet docs | `v1 parity` | Important supervised workflow. |
| Navigation restrictions on incomplete presentation | `presentation-complete.cy.ts`, docs | `v1 parity` | Needed for media-heavy items. |
| Navigation restrictions on incomplete response | `response-complete.cy.ts`, docs | `v1 parity` | Needed for mandatory completion studies. |
| Leave-once / lock-after-leaving rules | `leave-block-restriction.cy.ts` | `v1 parity` | Preserve test integrity semantics. |
| Adaptive booklet progression | `adaptivity.cy.ts` | `v1 parity` | Distinguishing product capability. |
| Manual state override in review/demo contexts | `definitions/test-mode.json`, adaptivity e2e | `v1 parity` | Required for evaluation and QA. |
| Page navigation display options | `page-navibutton.cy.ts` | `v1 parity` | Preserve configurable runtime UX. |
| Unit navigation display options | `unit-navibutton.cy.ts` | `v1 parity` | Preserve configurable runtime UX. |
| Unit menu visibility | `unit-menu.cy.ts` | `v1 parity` | Preserve configurable runtime UX. |
| Unit title visibility | `unit-title.cy.ts` | `v1 parity` | Preserve configurable runtime UX. |
| Screen header modes | `unit-screenheader.cy.ts` | `v1 parity` | Preserve configurable runtime UX. |
| Fullscreen prompt and button behavior | `ask-for-fullscreen.cy.ts`, `show-fullscreen-button.cy.ts` | `v1 parity` | Relevant for controlled assessment settings. |
| Player-initiated test termination policy | `allow_player_to_terminate_test.cy.ts` | `v1 parity` | Preserve content-driven runtime behavior. |
| Lock test on termination | `lock_test_on_termination.cy.ts` | `v1 parity` | Preserve high-stakes operational semantics. |
| UI suppression mode for hot runs | booklet config docs | `v1 parity` | Needed for cleaner proctored delivery setups. |
| Faster, more observable error handling in runtime | many TODOs, current scattered error behavior | `v1 improved` | Preserve reliability while simplifying failure modes for users and operators. |
| Better offline/reconnect strategy for transient network issues | current autosave and websocket fallback patterns | `v1 improved` | Keep robustness, improve clarity and recovery UX. |

### 4. Group Monitoring And Control

| Capability | Evidence | Target | Notes |
| --- | --- | --- | --- |
| Real-time session visibility by group | `GroupMonitorComponent`, broadcaster | `v1 parity` | One of the product's strongest capabilities. |
| Group monitor profiles | `profiles-and-filter.cy.ts`, `/monitor/profile/{id}` | `v1 parity` | Needed for different operator views. |
| Group monitor filters | `profiles-and-filter.cy.ts` | `v1 parity` | Essential for large cohorts. |
| View modes: small/medium/full | custom texts, profiles e2e | `v1 parity` | Preserve operator ergonomics. |
| Column configuration | profiles e2e | `v1 parity` | Preserve operator ergonomics. |
| Highlight booklet species / mixed cohorts | `group-monitor.component.ts` | `v1 improved` | Keep concept, present more clearly. |
| Pause command | monitor e2e | `v1 parity` | Must remain. |
| Resume command | monitor e2e | `v1 parity` | Must remain. |
| Go-to block / remote navigation command | monitor e2e | `v1 parity` | Must remain. |
| Terminate command | monitor e2e | `v1 parity` | Must remain. |
| Unlock command | monitor e2e | `v1 parity` | Must remain. |
| Monitor connection status | `GroupMonitorComponent`, websocket service | `v1 improved` | Keep status, improve reconnect transparency and fallbacks. |
| Better command audit trail | current command response messaging only | `v1 improved` | Add who/when/what happened to increase operator trust. |
| Bulk command safety rails | current confirmation patterns | `v1 improved` | Keep commands but add clearer previews and impact summaries. |

### 5. Study Monitoring

| Capability | Evidence | Target | Notes |
| --- | --- | --- | --- |
| Workspace-level study monitor | `study-monitor` module, `/workspace/{id}/studyresults` | `v1 parity` | Preserve study-wide progress visibility. |
| Aggregated group progress metrics | `ResultData` interface, backend results endpoint | `v1 parity` | Preserve operational reporting value. |
| More actionable study overview UX | current implementation is narrow | `v1 improved` | Good place to improve dashboards in v1. |

### 6. Workspace Content Administration

| Capability | Evidence | Target | Notes |
| --- | --- | --- | --- |
| Workspace file browser by type | `files.component.ts`, workspace admin routes | `v1 parity` | Core admin workflow. |
| Upload units | workspace files e2e | `v1 parity` | Core content pipeline. |
| Upload booklets | workspace files e2e | `v1 parity` | Core content pipeline. |
| Upload testtaker XML | workspace files and session-management e2e | `v1 parity` | Core content pipeline. |
| Upload resource files | workspace files e2e | `v1 parity` | Core content pipeline. |
| Upload system-check definitions | workspace files e2e | `v1 parity` | Core content pipeline. |
| Download files | workspace files e2e | `v1 parity` | Admins depend on this. |
| Delete files with dependency protection | `files.component.ts`, e2e | `v1 parity` | Must not allow destructive invalid states. |
| Dependency calculation between files | `getFilesWithDependencies`, `WorkspaceDAO` | `v1 parity` | Preserve content integrity. |
| XML/XSD validation and reporting | file parsing classes, file reports | `v1 parity` | Preserve import safety. |
| Duplicate detection for IDs and names | e2e fixtures and upload tests | `v1 parity` | Preserve import safety. |
| Workspace statistics from imported files | `Workspace.class.php`, file info | `v1 parity` | Useful for operators. |
| Clearer import diagnostics and dependency graph | current reports are useful but technical | `v1 improved` | High-value UX improvement in first release. |
| Draft validation before commit | not strong in current flow | `v1 improved` | Replace brittle upload-retry loops with staged import checks. |

### 7. Data Collection And Exports

| Capability | Evidence | Target | Notes |
| --- | --- | --- | --- |
| Response export CSV | results UI, `ReportType::RESPONSE` | `v1 parity` | Hard requirement. |
| Log export CSV | results UI, `ReportType::LOG` | `v1 parity` | Hard requirement. |
| Review export CSV | review endpoints, results UI | `v1 parity` | Hard requirement for review workflows. |
| System-check export/report access | `ReportType::SYSTEM_CHECK` | `v1 parity` | Hard requirement. |
| Group-level deletion of collected results | results e2e | `v1 parity` | Needed for test cycles and cleanup. |
| Detailed test response inspection | backend `/responses/detailed` | `v1 parity` | Preserve analyst/admin troubleshooting path. |
| Better export job handling for large datasets | current direct download approach | `v1 improved` | Move toward async job model if needed. |
| Richer audit export metadata | current CSV-first model | `post-v1` | Useful, but not required for first cut. |

### 8. Review Workflow

| Capability | Evidence | Target | Notes |
| --- | --- | --- | --- |
| Review mode with comments | `review.cy.ts`, test review routes | `v1 parity` | Must remain. |
| Unit-level reviews | backend review routes | `v1 parity` | Preserve current model. |
| Test-level reviews | backend review routes | `v1 parity` | Preserve current model. |
| Edit/delete reviews | backend review routes | `v1 parity` | Preserve current model. |
| Download review export from starter/workspace | starter and results UI | `v1 parity` | Preserve current workflow. |
| Better review UX and categorization | current forms and exports are functional but dated | `v1 improved` | Good v1 improvement area. |

### 9. Attachments

| Capability | Evidence | Target | Notes |
| --- | --- | --- | --- |
| Detect requested attachments from Unit XML | `XMLFileUnit.class.php` | `v1 parity` | This is part of content semantics. |
| Attachment manager access for allowed groups | routes + access set | `v1 parity` | Preserve role-based access. |
| Attachment overview list | attachment manager module | `v1 parity` | Preserve operator workflow. |
| Upload attachment files | attachment routes and FE service | `v1 parity` | Preserve operator workflow. |
| Delete attachment files | attachment routes and FE service | `v1 parity` | Preserve operator workflow. |
| Download attachment files | attachment routes and FE service | `v1 parity` | Preserve operator workflow. |
| Generate single attachment page PDF | attachment routes | `v1 parity` | Preserve physical workflow integration. |
| Generate batch attachment pages PDF | attachment routes | `v1 parity` | Preserve physical workflow integration. |
| QR-based capture-image workflow | capture-image component, attachment template | `v1 parity` | Distinctive and likely operationally important. |
| Better attachment labeling/template UX | current `%VAR%` style templates | `v1 improved` | Preserve capability, modernize configuration and preview. |
| Additional attachment types beyond capture-image | current code only knows one type | `post-v1` | Nice extensibility goal after parity. |

### 10. System Check

| Capability | Evidence | Target | Notes |
| --- | --- | --- | --- |
| Global system-check entry when no dedicated login is required | sys-check e2e | `v1 parity` | Preserve current access model. |
| Dedicated system-check login mode | sys-check e2e | `v1 parity` | Preserve current access model. |
| Multiple system-check definitions with starter selection | sys-check e2e | `v1 parity` | Preserve current workflow. |
| Single system-check direct start | sys-check routing and e2e | `v1 parity` | Preserve current workflow. |
| Welcome page | sys-check routing | `v1 parity` | Preserve flow structure. |
| Network check | sys-check module | `v1 parity` | Preserve flow structure. |
| Questionnaire step with required fields | sys-check e2e | `v1 parity` | Preserve flow structure. |
| Embedded unit/player check | sys-check module | `v1 parity` | Preserve device/content compatibility verification. |
| Report submission with password and report id | sys-check e2e | `v1 parity` | Preserve controlled reporting flow. |
| Workspace-level sys-check report overview | backend workspace routes | `v1 parity` | Preserve admin insight. |
| Better sys-check analytics and operator summaries | current reporting is functional but basic | `v1 improved` | Strong candidate for rewrite uplift. |

### 11. Super Admin And Instance Configuration

| Capability | Evidence | Target | Notes |
| --- | --- | --- | --- |
| Super-admin login and route separation | app routing and guards | `v1 parity` | Must remain. |
| User management | `user-management.cy.ts`, backend user routes | `v1 parity` | Must remain. |
| Workspace management | `workspace-management.cy.ts`, backend workspace routes | `v1 parity` | Must remain. |
| Assign RO/RW workspace access | workspace-management e2e | `v1 parity` | Must remain. |
| Promote/demote super-admin | user routes | `v1 parity` | Must remain. |
| Password reset/change flows | e2e + user routes | `v1 parity` | Must remain. |
| Force workspace admin to change reset password on next login | `starter.component.ts` | `v1 parity` | Preserve security behavior. |
| Live custom text editing | settings UI, `/system/config/custom-texts` | `v1 parity` | Important operator capability. |
| Maintenance/global warning banner | settings e2e, `AppConfig` | `v1 parity` | Important operator capability. |
| App title, intro, legal notice, logo | settings UI | `v1 parity` | Important operator capability. |
| Theme selection | settings UI | `v1 improved` | Keep theming, but redesign around a coherent design system. |
| GitHub bug report target/auth | settings UI, bug-report service | `post-v1` | Useful, but not core to delivery or ops. |
| Better settings governance and preview | current settings are powerful but fragile | `v1 improved` | Add preview, validation, and change history. |

### 12. Platform And Integration Requirements

| Capability | Evidence | Target | Notes |
| --- | --- | --- | --- |
| Workspace concept as isolation boundary | backend/domain and admin UI | `v1 parity` | Fundamental product boundary. |
| Tenant as first-class boundary above workspaces | planning decision 2026-04-21 | `v1 improved` | The rewrite should support multiple institutional tenants from day one. |
| Role and claim based access model | `AccessSet.class.php`, FE guards | `v1 parity` | Preserve semantics even if implementation changes. |
| Tenant-scoped configuration, branding, and administration | planning decision 2026-04-21 | `v1 improved` | Super-admin concepts likely split into tenant-admin and platform-admin scopes. |
| Tenant-isolated storage for content, uploads, exports, and attachments | planning decision 2026-04-21 | `v1 improved` | Avoid cross-tenant leakage by design. |
| Realtime delivery for monitor updates and commands | broadcaster service | `v1 improved` | Keep realtime behavior, but collapse architecture if possible. |
| File delivery with protected access and caching | file-server + backend file routes | `v1 improved` | Preserve secure content delivery, simplify architecture. |
| Exportable API surface for core admin/test flows | `docs/api/*.spec.yml` | `v1 parity` | Keep stable integration surface where relied upon. |
| Dockerized deployment | compose files | `v1 parity` | Important for adoption and migration. |
| Non-Docker/local development path | docs | `post-v1` | Valuable, but lower priority than production readiness. |
| Health/status endpoint for services | `/system/status`, `/version` | `v1 parity` | Needed for operations. |
| Cache clearing / operational maintenance actions | `/clear-cache`, flush broadcaster | `v1 improved` | Preserve operations, redesign into a safer admin toolbox. |
| Stronger observability, audit logs, and admin event history | current system has partial coverage | `v1 improved` | Important trust upgrade for rewrite. |

## Proposed V1 Scope Summary

### Must ship in rewrite v1

- All participant login paths
- All current execution modes
- Full test runtime parity for restrictions, saving, resume, and adaptivity
- Group monitor with realtime control commands
- Study monitor
- Workspace admin with content upload, validation, dependency checks, download, and deletion
- Response/log/review/sys-check exports
- Review workflow
- Full system-check workflow with no legacy fallback
- Full attachments workflow including capture-image and generated attachment pages, with no legacy fallback
- Super-admin workspace/user/configuration features
- Secure deployment, health checks, and operational basics

### Explicit v1 improvements

- Centralized mode/rule engine
- Canonical internal content format with XML ingestion support
- Simpler session and routing model
- Better runtime error and reconnect UX
- Better monitor auditability and safety rails
- Better import diagnostics and staged validation
- Better system-check summaries
- Better settings governance and preview
- Simpler internal architecture for realtime and file delivery
- Tenant-aware architecture for configuration, storage, security, and operations
- Stronger observability

### Safe to defer after v1

- Additional attachment types
- Richer audit export formats
- GitHub-native bug report integration
- Non-Docker/local install polish

## Confirmed Decisions

These decisions were confirmed on 2026-04-21.

1. Commit to full `v1 parity` for both attachments and system check.
2. Create a new canonical internal import/content format while continuing to support XML ingestion.
3. Design the rewrite for multi-tenant deployment from day one.

## Architectural Implications

### 1. No legacy bridge for attachments or system check

- The rewrite v1 must include the full operational loop for these features, not just read-only compatibility.
- Migration and acceptance testing must cover QR/capture-image workflows, attachment page generation, sys-check execution, sys-check report submission, and admin reporting.
- These areas belong in the core rewrite, not in a later edge-service or embedded legacy shell.

### 2. Canonical import format with XML support

- XML becomes an ingestion format, not the internal shape of the system.
- The import pipeline should look like:
  1. ingest source package
  2. validate source format and schema rules
  3. transform into canonical content model
  4. persist canonical model and derived runtime projections
  5. render/export compatibility artifacts where needed
- This lets the rewrite support stricter validation, better diagnostics, and future non-XML authoring or migration tools without changing runtime internals.

### 3. Multi-tenant design from day one

- Authentication and authorization must carry tenant context explicitly.
- Storage keys, caches, exports, uploads, and attachment assets must be tenant-scoped.
- Configuration such as branding, custom texts, warning banners, and legal notice should be tenant-level by default, with optional workspace overrides where needed.
- Monitoring, logs, metrics, and audit history must be queryable per tenant.
- Platform roles should likely separate into:
  - platform admin
  - tenant admin
  - workspace admin
  - participant/monitor roles
- Even if early rollout uses only a few tenants, the data model and operational model should not assume one institution per deployment.

## Recommended Build Sequence

1. Core domain and import pipeline
   - Tenants, workspaces, users, claims, logins, booklets, tests, sessions, reports
   - XML import/validation plus canonical content transformation layer
2. Participant access and starter flow
   - All login types, starter decisions, session semantics
3. Runtime shell and persistence
   - Test launch, player integration, autosave, resume, restrictions, adaptivity
4. Monitoring
   - Realtime session feed, filters, profiles, commands
5. Workspace admin and exports
   - File management, reports, deletions, detailed inspection
6. System check and attachments
   - Distinct flows with full v1 parity and physical/field operation support
7. Super-admin and instance settings
   - Platform admin, tenant admin, branding, texts, warnings, themes
8. Migration hardening
   - Dual-run validation, export comparison, cutover tooling

## Migration Acceptance Criteria

- Existing sample workspaces can be imported without semantic loss.
- Existing Cypress scenarios can be mapped one-to-one into rewrite acceptance tests.
- Response, log, review, and sys-check exports match legacy semantics for shared fixtures.
- Group-monitor commands behave identically on supported modes.
- Operators can complete the full study lifecycle without falling back to the legacy app.

## Next Planning Outputs

1. Target architecture with bounded contexts, service/module boundaries, and tenant model
2. Canonical content model outline and XML-to-canonical transformation strategy
3. Phased migration plan with cutover checkpoints and parallel-run validation
