# Testcenter parity checklist

This checklist compares the rewrite with IQB Testcenter commit
`284a4ffcd9452d56dddd51939707ac7f646c3da7` (2026-04-20). It is the working
source for implementation order, not a claim of release parity.

Status:

- `done`: usable end-to-end in the rewrite and covered by an automated check
- `partial`: a usable vertical slice exists, but important original behavior is missing
- `missing`: no usable product flow yet

Priority:

- `P0`: blocks credible test delivery or migration from the original
- `P1`: required for operational parity in a first production rollout
- `P2`: important follow-up after the first controlled rollout

## Priority queue

| Order | Priority | Next capability | Why it is next |
| --- | --- | --- | --- |
| 1 | P0 | Original package dependency corpus expansion | A pinned 14.3/15.1/17.4/17.6 corpus now gates successful imports and XSD-backed rejection behavior; complete XSD facets, original multi-file/ZIP dependency bundles, production packages, and more real players must still be added. |
| 2 | P0 | Testlet locks and adaptivity | Original nested `Testlet` paths, participant `CodeToEnter` gates, and server-authoritative `TimeMax` execution now extend the versioned runtime model; warning thresholds, leave-once locks outside timed blocks, monitor unlock/lock/time overrides, incomplete-testlet overrides, and adaptive states remain. |
| 3 | P0 | Verona resource and delivery hardening | Original nested `.itcr.zip` packages now reach players through `directDownloadUrl`, including a browser gate for byte-exact fetches from the originless sandbox; loose cross-package workspace resources, rich logs/focus events, broader player fixtures, streaming/range requests, and offline delivery still need parity work. |
| 4 | P1 | Monitor go-to/unlock/lock commands | Pause, resume, and complete exist; supervised navigation controls do not. |
| 5 | P1 | Participant access windows and login protection | Valid-from/to/for and participant brute-force protection are still absent. |
| 6 | P1 | Workspace file administration | Operators still need file browsing, download, dependency-aware deletion, and replacement workflows. |
| 7 | P1 | System check | The original device/network/questionnaire/player verification flow is absent. |
| 8 | P1 | Log and system-check exports | Response, review, monitor, roster, directory, and activity exports exist; original report coverage is incomplete. |
| 9 | P2 | Attachments and QR capture | Operationally valuable but separable from the first controlled digital-only rollout. |
| 10 | P2 | Branding, custom texts, maintenance banner, themes | Needed for broad tenant rollout after core test integrity is proven. |

## Capability matrix

### Participant access and session lifecycle

| Capability | Original evidence | Rewrite status | Priority | Rewrite evidence / gap |
| --- | --- | --- | --- | --- |
| Direct participant links | `e2e/Session-Management/login-possibilities.cy.ts` | done | P0 | `/participant` links, session re-entry links, and browser smoke coverage |
| Username with optional password | same | done | P0 | saved roster password hashes and participant sign-in |
| Two-step extra code | `app-root/code-input` | missing | P1 | no code challenge model |
| Multiple assigned booklets in source order | `starter.component.ts`, `XMLFileTesttakers.class.php` | done | P0 | all `<Login><Booklet>` values persist; starter exposes available/in-progress/completed state; one session can run them sequentially |
| Resume after reload/interruption | hot-return E2E flows | partial | P0 | running/paused sessions resume and restore unit, Verona unit state, player page state, and response; durable offline recovery is not implemented |
| Valid-from, valid-to, valid-for | time-limited-access E2E | missing | P1 | no access-window fields or policy |
| Participant login sink/rate limiting | login-sink E2E | missing | P1 | admin auth is protected, participant auth is not rate limited |
| Supported-browser warning | `SystemController::getConfig` | missing | P2 | no browser compatibility policy |
| Per-login custom texts | `docs/pages/custom-texts.md` | missing | P2 | no participant text override model |

### Participant player and booklet runtime

| Capability | Original evidence | Rewrite status | Priority | Rewrite evidence / gap |
| --- | --- | --- | --- | --- |
| Verona player integration | `test-controller`, `unithost` | partial | P0 | sandboxed `srcdoc` host imports embedded JSON and Testcenter ZIP players/definitions, exchanges ready/start/state/navigation/runtime-error messages, and visibly fails or reloads; external resources, rich logs/focus handling, and a representative player corpus remain |
| Player API compatibility validation | workspace file admin and unithost | partial | P0 | runtime ready handshake gates Verona major versions 2–6; static import metadata/schema validation is still missing |
| Booklet/unit navigation | `test-controller` | partial | P0 | ordered units, current position, nested original `Testlet` hierarchy, and per-unit testlet paths persist; imported `BookletConfig` compiles menu/button/player-end rules and server-side forward/backward eligibility, while conditional visibility and leave locks remain |
| Response and run-state save | test routes and hot-mode E2E | partial | P0 | versioned Verona unit/player-state envelope persists through coalescing autosave, visible retry, navigation, and reload; durable offline background delivery remains |
| Timed blocks and warnings | time-restrictions E2E | partial | P0 | server-authoritative timers start on actual entry, persist across reload/storage, pause/resume durably, count down in the Angular player, expire into the next eligible unit, close against re-entry, and enforce `forbidden`, `confirm`, and `allowed` navigation/completion rules; original warning thresholds, monitor time adjustment, and detailed monitor timer visibility remain |
| Presentation/response completion locks | booklet config E2E | partial | P0 | Verona progress drives visible forward/completion denial and server-side `409` guards with direction-specific reasons; testlet overrides and confirm-mode behavior remain |
| Unlock code and leave-once rules | hot-mode and leave-block E2E | partial | P0 | original `CodeToEnter` gates block initial entry, navigation, and completion until the Angular participant flow records a durable per-run unlock without exposing the code; leave-once locks and monitor unlock/lock remain |
| Adaptive booklet states | adaptivity E2E | missing | P0 | no adaptive state compiler |
| Runtime display/fullscreen options | booklet config E2E | partial | P1 | compiled policy drives unit menu/buttons plus Verona paging/logging/page restore, and active timed blocks show time left; header, fullscreen, warning presentation, and silent-mode behavior remain incomplete |
| Execution modes | `definitions/test-mode.json` | partial | P0 | run/review behavior exists as separate use cases, not as the original mode capability matrix |

### Import and content administration

| Capability | Original evidence | Rewrite status | Priority | Rewrite evidence / gap |
| --- | --- | --- | --- | --- |
| JSON/XML/ZIP package intake | `WorkspaceController`, file parsers | partial | P0 | staged immutable releases, retry diagnostics, IMS/Testcenter aliases, referenced ZIP content, nested original `.itcr.zip` extraction/delivery, and a pinned 14.3/15.1/17.4/17.6 corpus; loose multi-upload dependency assembly remains |
| Original Testtakers XML | `XMLFileTesttakers.class.php` | partial | P0 | original sample fixture gates participant-versus-operational login modes, groups, passwords, and ordered multiple-booklet assignments; codes, access windows, profiles, custom texts, and operator-account migration remain |
| XML/XSD validation | file parser classes | partial | P0 | well-formed parsing and an executable original-schema compatibility profile now validate top-level XML and every XML entry in ZIP dependency bundles, rejecting wrong roots/metadata, missing identities/definitions, unsupported login modes, and duplicate group/login/testlet/unit runtime keys with stable diagnostics; complete XSD facets and cross-file constraints remain |
| Dependency graph and duplicate protection | `WorkspaceDAO`, files E2E | partial | P1 | import resolves many references, but no operator-visible complete dependency graph or dependency-aware delete |
| Draft validation before activation | workspace admin | done | P1 | import jobs, persisted diagnostics, staged release readiness, roster warnings, activation guard |
| File browser/upload/download/delete | workspace admin files module | partial | P1 | package intake/export exists; original typed file management does not |

### Monitoring and control

| Capability | Original evidence | Rewrite status | Priority | Rewrite evidence / gap |
| --- | --- | --- | --- | --- |
| Group/study overview | group monitor and study monitor modules | partial | P1 | group/booklet/unit/participant/run read models, attention queue, expected/not-started roster counts |
| Participant-by-unit drill-down | study monitor | done | P1 | matrix, filtered drill-downs, response/review handoff, CSV exports |
| Near-real-time refresh | broadcaster/group monitor | partial | P1 | frontend polling/refresh; no push channel or explicit connection state |
| Pause/resume/complete | monitor routes | done | P1 | command API, activity trail, UI controls, open-run smoke coverage |
| Go-to block, unlock, lock | monitor routes and E2E | missing | P1 | command vocabulary is limited to pause/resume/complete |
| Profiles, filters, columns, view density | monitor profiles E2E | partial | P2 | rich filters exist; saved profiles and configurable columns do not |
| Command audit trail and bulk safety | monitor behavior | partial | P1 | actor/time/details are persisted; no multi-run preview/confirmation workflow |

### Results, review, admin, and operations

| Capability | Original evidence | Rewrite status | Priority | Rewrite evidence / gap |
| --- | --- | --- | --- | --- |
| Response inspection/export | workspace results | done | P1 | detailed filters, run drill-down, CSV |
| Review create/edit/delete/export | review routes and review E2E | done | P1 | unit/run reviews, filters, readiness, CSV |
| Group result deletion | results E2E | done | P1 | typed confirmation, counts, audit activity |
| Test logs export | `ReportType::LOG` | missing | P1 | operational activity CSV is not a participant test-log parity export |
| System-check reports | sys-check module/routes | missing | P1 | no system-check domain |
| Platform/tenant/workspace admins | superadmin module | partial | P1 | scoped users, roles, passwords, status, sessions, audits, tenant/workspace directories; original RO/RW semantics need a migration map |
| Branding/settings/custom texts | settings module | missing | P2 | no tenant branding/settings surface |
| Attachments and QR capture | attachment manager | missing | P2 | no attachment domain |
| Durable storage | deployment stack | done | P0 | file, SQLite, Postgres, migrations, doctor/preflight |
| CI and deployability | deployment scripts | done | P0 | static, unit, storage, browser, startup/shutdown, Docker and Compose gates |

## Exit criteria for “presentable with high parity”

The application may be presented as high-parity only when:

1. representative original Testcenter packages pass an automated import corpus;
2. real Verona players can load, exchange state/responses, resume, and fail visibly;
3. booklet timing, navigation, completion, and adaptive policies have executable compatibility tests;
4. group operators can perform the original supervised control commands with an audit trail;
5. participant access windows and login protection are production-ready;
6. response, review, log, and system-check exports are reconciled against original fixtures;
7. the Postgres and container release gates remain green.

Update this document in the same change that materially changes a capability status.
