# Testcenter parity checklist

This checklist uses IQB Testcenter commit
`284a4ffcd9452d56dddd51939707ac7f646c3da7` (2026-04-20) as its broad baseline
and additionally tracks the current 18.0 BookletConfig fixtures at
`8e01885f76bf5b69a7e29aa9434346602b77c093` (2026-08-11). It is the working
source for implementation order, not a claim of release parity. Newer
Original packages are pinned at package level; the current STARS system-test
graph is fixed to its introducing commit
`94b04751abfe024eb1d354c29718f90b4740c4c6`.

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
| 1 | P0 | Original package dependency corpus expansion | A pinned 14.3/15.1/17.4/17.6/18.0 corpus now gates 75 booklet imports, including the original equal-species `Booklet.xml`/`Booklet3.xml` pair, all 17 official `CY_Bklt_TC-*` controller cases, all four legacy `CY_Bklt_BkltConfig_*` package variants plus the current 18.0 completeness cases 5–10, header-content cases 11–14, header-visibility cases 15/16, termination-lock cases 17/18, eight navigation-button variants 19–26, page-return cases 27/28, Unit-navigation cases 29–33, Page-navigation cases 34–39, and toolbar/timer/silent cases 40–51, the complete official two-booklet/five-unit/12-login Session-Management package, and the official Group-Monitoring booklet with its participant, scoped monitor, and two profiles. The 17 Controller booklets, all five referenced Units, the legacy Verona player, and the byte-exact 26-login `CY_Logins_TestController.xml` roster additionally run as one activated workspace package across memory, file, and SQLite; real Demo, Review, Hot-Return, and Hot-Restart accounts prove mode policy, code/time enforcement, response restoration or clean restart, and monitor visibility. The four Booklet-Config variants likewise run together with their three Units, legacy Player, and byte-exact four-account roster; their real accounts prove the complete compiled policy variants, timed-block startup, repeated-unit alias resolution, Player-End eligibility, normal completion, and termination locking across all three stores. The Session-Management package proves password and second-code gates, ordered multi-booklet assignment, access-window normalization, legacy `id-6.0` Verona-player resolution, and hot-return/hot-restart re-entry with response restoration. The Group-Monitoring package proves password-redacted role migration, exact profile persistence, group-isolated reads/commands, and participant-visible pause/resume/go-to/lock/unlock behavior across memory, file, and SQLite. The corpus also covers version-aware Unit and SysCheck XSD facets, DefinitionRef/player/player-resource/VariablesRef cross-validation, both prebuilt and loose multi-file execution of the original `Booklet2.xml` + `Unit2.xml` + coding scheme + Verona 6 dependency set, the original differently named but byte-identical duplicate-Booklet-ID fixture plus case-insensitive typed Booklet/Unit/SysCheck, semantic Testtakers-roster, IMS manifest resource, and Verona `module-id + major.minor` resource-identity rejection at upload and inside prebuilt ZIPs, a loose five-file Booklet → Unit → definition/player → original `.itcr.zip` resource snapshot through exact and range Participant delivery in memory/file/SQLite, a full loose SysCheck → Unit → coding scheme/player snapshot with browser-side response capture, import plus browser execution of the complete original three-unit Aspect booklet with the 3.2 MB 2.12.3 player and a 16.17 MB media-heavy Voud definition, and separately provenance-pinned official `verona-player-simple` 1.0.1/API-2, 2.1.0/API-3, 4.0.0/API-4, and 5.2.0/API-5 packages; remaining work is more production packages, rare file-graph constraints, and further real-player families. |
| 2 | P0 | Testlet adaptivity | Original adaptive state definitions, condition aggregations, persisted `BOOKLET_STATES`, `Show` routing, nested `Testlet` paths, participant-assignment state presets and same-booklet preset variants, server-side IQB coding-scheme derivation, `CodeToEnter` gates, server-authoritative `TimeMax` execution with configured warnings, durable `LockAfterLeaving` rules, and dimension-wise `DenyNavigationOnIncomplete` inheritance now extend the versioned runtime model. Schema-aware imports reject a State without the conditionless fallback required by the original and reject unsupported State/Option/condition attributes or children instead of silently changing the route; `or` remains the original Score-only fallback. Every tracked response variable now exists as the original `UNSET`/`null` value before its first player response, so initial Status/Value conditions and Score fallbacks route correctly before server coding replaces them. Repeated variable IDs across IQB subforms follow the original ID-only, ordered last-write-wins rule before coding. Server-coded `CODING_COMPLETE` is gated through both textual and original status-rank comparisons. The pinned original adaptive sample runs end-to-end, while broader production schemes and further exotic value edges remain. |
| 3 | P0 | Participant execution-mode completion | The six original participant modes now share an exact capability matrix and govern import, sessions, saving, restrictions, open-run/study-monitor visibility, remote commands, participant-authored test/unit/task-page reviews with priority, multi-category metadata, immutable browser/original-unit provenance, and editable adaptive paths in Demo/Review/Trial. Non-saving modes keep Verona responses in memory just long enough to satisfy enforced presentation/response locks, navigate, derive the active adaptive path, and complete, while omitting response rows, Player logs, outbox entries, and browser session snapshots. Reopening a non-saving Demo, Review, or Simulation run reuses its run but restores its response-free automatic path and fresh restriction state: current Unit, code grants, timers, timed closures, leave locks, and monitor unlocks are reconstructed exactly as at launch; explicit adaptive choices and Review comments remain available. Completion presents a terminal browser projection but persists that same run as open and freshly reset, matching the original starter's reusable `running` test instead of consuming the booklet assignment. The official 26-account Controller roster now independently exercises its four declared modes against the exact assigned original booklets as a complete workspace package. |
| 4 | P0 | Verona resource and delivery hardening | Original nested `.itcr.zip` packages now reach players through `directDownloadUrl`, including browser gates for byte-exact full, HTTP single-range, and bounded `multipart/byteranges` fetches from the originless sandbox; participant resources advertise byte ranges, return exact `206`/`416` responses, expose range headers through CORS, and answer the multi-range preflight required for media seeking. Separately uploaded original `.itcr.zip` packages also resolve transitively from loose Unit dependencies into an audited immutable workspace snapshot, with exact lineage, extraction, current-state projection, and full/range Participant delivery gated across memory, file, and SQLite. The pinned original Verona 6 sample runs its real unit definition in the Angular host, persists raw responses and Player logs, drives adaptive routing, restores state after reload, forwards debounced window-focus state into test-wide `FOCUS` logging, and keeps failed or page-close-pending saves in a durable browser/Service-Worker outbox for automatic reconnect, reload, and closed-view delivery. The separately pinned official `verona-player-simple` 1.0.1 gates a real API-2 handshake, legacy meta-element ready declaration, object-valued `dataParts.all`, top-level `playerState`, `targetRelative` navigation, and `unitCount`-controlled Player navigation. Version 2.1.0 gates a real API-3 handshake, early JSON-LD import, object-valued legacy `dataParts`, Player-originated forward/back navigation, return restoration, and full reload restoration in Chromium/SQLite. Official versions 4.0.0/API-4 and 5.2.0/API-5 independently gate the experimental `$schema`-only and metadata-2.0 formats, string-valued `dataParts`, the same navigation path, return restoration, and reload restoration. The original IQB Aspect 2.12.3 player independently gates an API-6 handshake across its complete three-unit booklet, a text and radio response with page state, four embedded images from a 16.17 MB definition, host navigation in both directions, and reload restoration. Separately reported player/unit states are merged, foreground navigation cannot starve behind eager autosave, and the Participant UI keeps a typed current-state cache instead of repeatedly parsing production-sized definitions. A scope-limited, installable App-Shell Service Worker restores the cached Participant frontend after a real offline reload without caching APIs or test content, and uses a separate bounded IndexedDB queue plus Background Sync for pending responses. Stable delivery IDs make repeated API submission idempotent for responses, Player logs, and audit activity. Bundled JSON-LD metadata is validated against the early `@id`/`@type`/`apiVersion` draft, the experimental `$schema`-only shape, legacy 1.x/2.x, and strict 3.0/3.1 field structures; the declared API version gates compatibility, while a reference suffix is matched to the module's SemVer major/minor version. Metadata-free legacy players import with an explicit warning because only the runtime handshake can establish their API compatibility. Additional player families remain. |
| 5 | P1 | Workspace file administration | Package-backed files are browsable/downloadable, classified by the five original content types, filterable in API/CSV/Angular, and support guarded aggregate deletion plus immutable replacement. Matching the Original workspace table, operators can sort the complete filtered read before its limit by file name, stored size, or upload time in either direction; the choice persists in Angular and the CSV export uses the same deterministic order. The list contract also separates total filtered matches from the returned limit and carries a complete workspace health summary: valid, pending, invalid, and warning-bearing files plus the same status counts for every Original type and the rewrite package type remain visible in Angular even when filters exclude them from the current window. The original unrestricted multi-file picker and upload queue are represented by a bounded 200-file best-effort flow: files are read and sent sequentially as byte-preserving Data URLs, `.voud`/`.vomd` and HTML media types are inferred deterministically, later files continue after an individual duplicate or validation error, and Angular reports live processed/selected progress, the exact current file, a distinct workspace-refresh phase, and every final accepted/rejected item while retaining successful files for reviewed assembly. The picker is disabled during the active batch. A production Chromium/SQLite gate holds the third request to prove the intermediate 2/3 state, then proves a duplicate rejection followed by a real `.voud` definition and an extension-unknown binary resource, including byte-exact download and refreshed workspace projection. The original multi-file delete workflow is likewise represented by a bounded, role-protected Angular selection and API batch report: each exact-name-confirmed aggregate is rechecked independently, safe files and unused derivatives are deleted and audited, while still-used, missing, disallowed, and unexpected outcomes remain separated for retry. The mixed-success delete path is gated in production Chromium/SQLite and the API contract is gated across memory, file, and SQLite. Source detail derives a typed direct/transitive graph across assembly members and imported booklet/system-check/unit/resource relationships. A loose Booklet or SysCheck import resolves a unique transitive workspace chain through Unit, player, definition, variables, coding scheme, and player resources into an audited immutable dependency snapshot; ambiguous legacy names deliberately retain the explicit assembly path. Result administration now has its own group inventory below. |
| 6 | P1 | System check hardening | Original `SysCheck.xml` definitions import without creating an empty test release. The byte-exact official `CY_SysCheck_2.xml` now adds the original same-workspace two-check starter: Angular selects both checks independently, runs measured and configured-skipped network paths, reports an unanswered required field without trapping the participant, renders all six question types, executes the resolved Verona item, saves with the check key, and keeps report statistics/deletion isolated by check. Runtime compilation preserves both textual and numeric XML Schema boolean spellings for `skipnetwork` and question `required` after validation. The API path is gated across memory, file, and SQLite. Loose SysCheck, Unit, coding-scheme, and Verona files resolve into audited immutable snapshots; the referenced Unit definition/player are retained with each check and missing packaged Units fail with a stable diagnostic. Imported `sys-check-login` candidates become isolated workspace accounts that support concurrent device sessions and authorize report saving under the login name without exposing the report key. Configuring any such account activates the original instance-wide login mode, hides the anonymous flow, resolves the authenticated workspace scope, and closes the report-key API path. The byte-exact original `SysCheck-Report.json` is pinned and migrates through API and Angular while preserving its source date, filename, file timestamp, section order, scalar values, and original check label; legacy BOM/semicolon CSV plus JSON-with-`fileData` exports are reconciled against it. Operators can select up to 200 report files or an original report directory, receive per-file migration failures, safely resume without duplicating unchanged files, inspect OS/browser/rating distributions, and delete selected check report sets. Additional original configurations and player families remain. |
| 7 | P2 | Attachments and QR capture | Every Original Unit BaseVariable with `type="attachment"` now survives ZIP import with its authored optional format and appears in the role-scoped inventory for every started run, matching the original discovery path. `capture-image` entries additionally provide the complete durable camera workflow: API and Angular support missing/captured status, PNG/JPEG upload, inline preview, deletion, and a copyable handoff code, while other formats stay visibly conserved without unsafe capture controls. The upload route accepts both the rewrite JSON contract and the original capture client's binary-safe `multipart/form-data` field. Operators can download one or all scoped A4 QR pages with the original seven label placeholders. The lazy mobile capture route now scans those codes by live camera or QR image, verifies the target through the existing operator/group scope, captures or selects a photo, previews it, and confirms the protected upload. |
| 8 | P2 | Branding and custom-text presentation | The original instance title, expiring global warning, resettable logo, three audience themes, editable start-page and legal-notice HTML, global < Testtakers/Login < active Booklet participant-text precedence, and global < authenticated monitor-login precedence for the complete 58-key `gm_*` contract are now usable. The eight original image slots have a platform-admin registry and global assignments, with Testtakers Group/Login assignments taking precedence for Participant presentation. Angular renders the resolved logo, login/code illustrations and companions, starter/completed cards, loading progress, and confirmation-dialog image; assigned global assets are deletion-protected. Angular also applies all 58 monitor keys, presents sanitized configured HTML on participant entry and a public legal route, and exposes the legal route from every shell. The complete instance-branding surface is API-, store-, and production-browser-gated. |

The latest source-to-corpus inventory confirms that every Booklet, Unit,
Testtakers, SysCheck, Group-Monitor, Session-Management, Aspect, Verona 2–5,
ABI, DAN, STARS, and IQB coding fixture family available in the local original
repository is represented. Further corpus expansion therefore requires
additional production packages rather than uncopied local samples.

The upstream BookletConfig system-test matrix has since grown to 51 variants.
The rewrite now pins and imports every current 18.0 BookletConfig case 5–51:
completeness 5–10, header content 11–14, header visibility 15/16,
termination locking 17/18, global navigation 19–26, page restoration 27/28,
Unit navigation 29–33, Page navigation 34–39, and toolbar, timer, and silent
presentation 40–51. Together with the original four-booklet package, the
complete locally available legacy/current BookletConfig matrix is now gated.

Latest local-first presentation closure: a clean `npm run start:local` no longer
seeds a text-response-only placeholder assessment. Its three-Unit demo package
now contains a self-contained, metadata-valid Verona API 6 Player and distinct
Unit definitions. The production Angular host performs the real sandboxed
handshake, persists Player state through its normal autosave path, navigates
between Player-backed Units, and restores the response after both return
navigation and a full browser reload. The local browser smoke proves that path
without depending on test fixtures, external downloads, or network access.

Latest local-demo restart-safety closure: bootstrap now inspects the persisted
workspace roster before seeding `student-demo`. Once that login exists, an
ordinary File- or SQLite-backed application restart does not rewrite its mode,
group, display data, or import timestamp, does not clear other participant
entries or the operational-login migration inbox, and does not append a
misleading roster-import audit event. A real stop/start integration gate proves
all of those invariants in both durable adapters.

Latest production-entry closure: `/app` now resolves to a dedicated lazy Start
surface instead of rendering the complete Workspace administration before an
operator signs in. The signed-out navigation advertises only Start,
Participant, System Check, and Operator Sign-In; protected administration is
kept out of the public landing path. The initial zoneless diagnostics/config
refresh now explicitly renders its result, so the local-demo status arrives
without relying on an unrelated feature update. A production Chromium/SQLite
gate proves that the root makes no unauthorized request, stays within a 390-px
viewport, remains below a bounded presentation height, and still reaches the
complete demo Participant and administrator flows. Shared grid children also
use a zero minimum width, removing the 27-px mobile overflow observed in the
previous operator layout.

Latest protected-entry closure: when operator authentication is enabled, direct
Workspace, Content, Runtime, and attachment links now resolve the public runtime
configuration before loading their lazy feature and route signed-out users to a
focused operator form with the original destination retained as an internal
return URL. The signed-out Ops route no longer renders admin directories,
operational metrics, raw diagnostics, or an editable bearer-token field; first
deployment bootstrap remains available in an explicit disclosure. Successful
administrator or monitor authentication resumes the requested route and lets
the existing role guards narrow it further. Open-auth development deployments
still admit direct feature links. A production Chromium/SQLite gate proves the
protected redirect and return without any 401 response, while the regular UI
gate proves open-auth direct entry, bootstrap, sign-in, and post-auth diagnostic
availability.
The focused shell also suppresses the global live-context, result-preview, and
runtime-status columns before authentication. Its 390-px production rendering
has no horizontal overflow and falls from the former 5,946-px technical stack
to a bounded 1,795-px local-demo page; ordinary deployments omit the demo card.

Latest P0 Participant pause-boundary closure: participant-authored pauses and
monitor-authored pauses now persist as distinct run states across memory, file,
SQLite, and PostgreSQL. A monitor pause removes the Verona iframe and every
fallback response/navigation control from the live Angular route, exposes only
the configured pause message and supervisor-waiting guidance, and cannot be
released by either Participant Resume or session re-entry. A Player save already
secured in the local/Service-Worker outbox may still arrive after the monitor
command, but the server keeps the run and its testlet timers paused, refuses any
piggybacked Unit navigation, and stores only the buffered response/log payload.
Participant-authored pauses retain an explicit Continue action. API coverage
pins the `test_run_monitor_paused` boundary and pause-preserving stale delivery;
SQLite coverage pins restart persistence, and the production-built live-monitor
Chromium gate proves pause presentation, Player teardown, absent Participant
Resume, monitor-only continuation, and Player restoration.

Latest P0 Participant completion-boundary closure: the original Test Controller
guards the Unit host once a run reaches `TERMINATED`; the rewrite now applies the
same terminal presentation to `completed`. The active Angular route replaces the
entire Unit surface with a dedicated completion state that retains only session,
run, saved-progress, and completion context. Verona and fallback players,
response fields, adaptive routing, Review, timers, Unit menus, navigation, save,
resume, and completion controls are no longer present in the DOM. This boundary
also survives direct session re-entry. Production-built Chromium/SQLite gates
prove both participant-authored completion with final-draft autosave and the
monitor's atomic `complete_and_lock` path, including Player teardown and absence
of every participant mutation control.

Latest P0 Participant controller-error boundary closure: the original Test
Controller guards the Unit host while its controller state is `ERROR`. Active
Verona load and runtime failures now promote the Rewrite from a Player-local
warning to the same route-level boundary. Angular removes the iframe, fallback
response controls, adaptive routing, Review, timer, Unit menus, navigation,
connection state, and every session mutation command; only the layered
`booklet_errormessage`, bounded technical detail, and original `booklet_reload`
action remain. Recovery performs a full page reload, restores the existing
session and response, and uses a tab-local marker to persist exactly one
`CONTROLLER=ERROR` followed by `CONTROLLER=RUNNING` after the replacement Player
starts successfully. The production-built SQLite/Chromium gate proves the DOM
boundary, disabled entry commands, custom reload label, de-duplicated error log,
response preservation, and successful Player restoration.

Latest P0 Participant route-separation closure: the original Starter and Test
Controller are separate routes, so a running or paused test never exposes
editable tenant, workspace, login, password, group, Booklet, Session, or Unit
fields beside the Player. The Rewrite now applies the same presentation
boundary: once a run opens, the complete entry card leaves the DOM and the
Current Test surface becomes the sole participant workspace. A compact runtime
toolbar retains only session re-entry/copy, local leave, configured reload, and
fullscreen actions; the controller-error guard removes those session actions as
well. Completion restores the Starter so the participant can select another
assigned Booklet or leave. Production-built Chromium coverage proves direct
start, hot-return re-entry, pause/continue, full-page reload, controller error,
recovery, completion, and Starter restoration across that boundary.

Latest P0 non-saving-mode re-entry closure: the original Demo and Review E2E
flows discard Unit and Test state when the participant returns to the starter,
so opening the same test again begins at its start page even though the same run
is reused. The Participant resume service now resets every non-saving run to
the first Unit visible under its current adaptive path instead of restoring the
last visited Unit. Responses and logs remain absent as before; explicit adaptive
choices and separately stored Review comments survive the reset. The execution-
mode integration gate proves Demo path selection plus reset and Review comment
retention, while saving modes retain their existing hot-return behavior.
Simulation now evaluates the current Verona response transactionally for
navigation and completion without persisting that response. Its production
Angular gate proves that completeness locks can be satisfied and the run can be
completed while the server response/log stores, browser outbox, and Local
Storage remain empty. Transient automatic adaptive routing is available within
the run and is recomputed from the response-free state on re-entry; explicit
Demo/Review overrides remain durable. The same re-entry now also discards every
unsaved restriction state that the original keeps only in its Test-state buffer:
accepted Testlet codes, active/closed timers, unit/Testlet leave locks, and
temporary navigation/whole-test unlocks. Simulation therefore presents its
code gate again and starts a fresh timer while retaining the same open run ID.
Completing Demo, Review, or Simulation likewise leaves that run reusable: the
active browser receives its completion confirmation, while the durable state is
already reset for the next starter entry. API gates cover memory, file, and
SQLite persistence; the production Angular/Chromium gate completes a Simulation,
proves the empty reset state, and starts the same run ID again at its code gate.

Latest P0 operational-only Testtakers closure: original rosters that contain
only `monitor-group`, `monitor-study`, or `sys-check-login` entries are now
accepted as explicit account-migration input instead of failing because they
have no participant rows. The API returns zero participant inserts/updates,
preserves the password-redacted migration candidates and resolved profile,
custom-text, group, and access-window context, and records the migration-only
classification in workspace activity. Angular previews the candidate count and
password boundary before import, keeps participant-link generation disabled,
and exposes the existing account-preparation handoff after import. Memory API
coverage and a production-built SQLite/Chromium gate prove the complete path;
file and SQLite API adapters share the same contract gate. The redacted
candidates now persist as a workspace read model across memory, file, SQLite,
and PostgreSQL. The saved-roster API returns that inbox, a later roster import
replaces it, and Angular hydrates it during runtime refresh. The browser gate
clears the local candidate snapshot before reloading and proves that the
workspace inbox returns from SQLite while the raw roster and source password
remain absent from Local Storage.

Latest P0 current Testtakers JSON closure: native objects and serialized JSON
that follow the current 18.0 schema now map canonical `groups[].logins[]`,
`Login.name`, ordered `booklets[]`, whitespace-separated second codes,
execution modes, access windows, custom texts, view settings, and inherited
Group < Login asset assignments into the same durable Participant model as XML.
The same source is split into password-redacted `monitor-group`,
`monitor-study`, and `sys-check-login` migration candidates, including resolved
Group-Monitor profiles, filter negation, booklet-list visibility, access
context, and unresolved profile references. Contract coverage gates participant
and operational parsing plus asset precedence. The memory API gate imports a
mixed native JSON roster, persists both read models, reads them back unchanged,
and proves that neither source password appears in either response.

Latest P0 current Testtakers JSON package closure: canonical JSON roster files
now participate in the same immutable workspace import graph as Testtakers XML.
Loose JSON roots contribute their ordered Booklet references to automatic
dependency assembly, receive the same case-insensitive roster identity guard,
and import participant assignments, state presets, and second codes from the
assembled archive. Manifestless Original-style workspace ZIPs discover mixed
XML and JSON rosters in arbitrary folders, persist participant and operational
logins together, retain the source filenames in import/audit read models, and
keep every participant, monitor, and system-check password out of responses.
JSON roster Booklet references pass the same package-wide existence check as
XML and reject a missing ID with `source_document_testtakers_booklet_missing`.
Memory API gates cover both the loose JSON → Booklet → Unit graph and a mixed
XML/JSON workspace ZIP through activation, authentication, and repeated import.

Latest P0 Testtakers JSON validation closure: unambiguous current-schema roster
documents are structurally and semantically inspected before dependency
discovery or roster parsing. Standalone packages and JSON entries anywhere in
a ZIP now reject an invalid root, missing metadata, unknown schema properties,
empty or duplicate groups/logins, missing group/login IDs and labels,
unsupported login modes,
syntactically invalid, impossible, or reversed access windows, malformed or
conflicting Booklet/Profile assignments, unknown monitor-profile references,
invalid XML-compatible Booklet state presets, duplicate/unknown asset slots,
empty asset filenames, invalid ViewSettings/code-input values, and malformed
Group-Monitor profiles or filters. The stable
`source_document_testtakers_json_invalid` diagnostic carries an exact JSON path;
direct roster intake returns `participant_roster_json_invalid` for the same
failures. The supported Booklet `state` compatibility extension remains
explicit and a valid multi-state preset is proven from parser through durable
roster projection, while generic runtime JSON and the older nested participant
JSON format stay separate from current Testtakers detection. Memory and SQLite
API gates prove that rejected documents create neither a content release,
participant or operational-login rows, nor a roster-import activity event.

Latest P0 Testtakers-schema closure: the byte-exact original
`Testtakers_withoutSyscheck.xml` E2E roster extends the pinned corpus with the
15.2 generation, nine participant accounts, four monitor accounts, no profiles,
and no system-check login. The importer now follows the declared roster XSD:
monitor profile containers/references require 15.3, Booklet state presets and
extended profile/filter fields require 15.4, and per-login `ViewSettings`
require 17.6. A 15.4-compatible modern roster remains accepted, while four
cross-generation mixtures fail with stable diagnostics. Corpus/API gates prove
byte identity, participant/operational separation, custom-text retention,
idempotent legacy updates, and the version boundaries across memory, file, and
SQLite.

Latest P0 Testtakers 18.0 asset-assignment intake closure: group- and
login-level `<AssetAssignments>` now pass generation-aware schema validation,
including child/attribute/cardinality/order checks and unique non-empty slots.
The roster parser applies the original Group < Login precedence and preserves
the resulting filename map for participant and password-redacted operational
logins. File, SQLite, and PostgreSQL adapters retain participant assignments;
API and restart tests cover import and persistence. Schemas before 18.0 reject
the new container explicitly. A platform-admin registry now uploads or replaces
PNG/JPEG/WebP assets by original filename with the Original's 2 MiB limit,
persists them in every store, exposes bounded public image delivery, and blocks
roster imports that reference missing filenames. Platform admins can now assign
global defaults for all eight original slots in Angular; participant-specific
assignments override those defaults at runtime. Entry, second-code, starter,
loading, completed, and confirmation states render the resolved assets, and an
assigned global asset cannot be deleted until its slots are cleared. API,
store, and production-built SQLite/Chromium gates cover the complete registry,
assignment, delivery, and presentation path.

Latest P0 adaptive initial-state closure: the server now mirrors the original
Testloader by registering every variable referenced anywhere in a state
expression as `{status: "UNSET", value: null}` before any Unit response exists.
This makes launch-time `Status=UNSET`, `Value=null`, and Score `or` conditions
executable instead of treating their variables as absent. The existing
import-to-coding gate now proves all three initial branches and their transition
to coded status, value, and score branches after the first IQB-standard save.

Latest P0 adaptive subform closure: the same coding gate now sends two ordered
IQB data parts whose subforms contain repeated variable IDs and deliberately
contradictory answers. Matching the original ID-indexed Testloader, the later
subform value replaces the earlier one before coding, indirect-variable
derivation, and persisted Booklet-State routing. The raw response envelope still
retains both data parts for exact Player restoration.

Latest P2 application-settings closure: the original instance-level application
title, resettable logo, `Primar`/`Sekundar`/`Erwachsene` audience theme, and
time-bounded global warning now form a complete vertical slice. A public
endpoint feeds the Angular document title, participant/operator branding,
theme variables, and accessible warning banner; the banner removes itself at
its persisted expiry. Only a signed-in platform admin can edit these values in
the Ops view. Custom PNG/JPEG/GIF/WebP/SVG logos retain the original 20 MiB
ceiling; base64 bytes and media signatures are checked, and active SVG content
is rejected. Updates are normalized and audited without copying image data into
the audit trail, and remain durable in memory, JSON-file, SQLite, and Postgres.
Legacy file/SQLite state receives explicit default-branding migration. The
original `introHtml` and `legalNoticeHtml` contract now adds bounded, public,
platform-admin editable content without copying HTML into the audit trail;
Angular deliberately uses its built-in HTML sanitizer instead of the original
frontend's trust bypass. Participant entry renders the configured introduction,
and every shell links to a public legal/privacy/accessibility route with a
truthful empty state. API coverage proves public defaults, tenant-admin denial,
invalid expiration/theme/logo/content-size rejection, persistence, audit
evidence, and reset behavior; a production SQLite/Chromium gate proves upload
preview, sanitized public HTML, live theme CSS, expired-warning removal, and
full default reset.

Latest P2 attachment-manager slice: every Original Unit XML
`BaseVariables/Variable[@type="attachment"]` declaration now survives ZIP
hydration into immutable release snapshots with its authored optional format.
Every started test run exposes the complete requested inventory with group,
participant, booklet, Unit, variable, and type context. Platform/tenant/workspace
admins and study monitors can inspect the complete workspace; group monitors
are constrained to assigned groups, and every mutation additionally respects
read-only access. `capture-image` PNG/JPEG uploads are base64-, size-, and magic-byte validated,
stored in all four adapters, downloadable inline, deletable, and recorded in
workspace activity. Other schema-valid formats remain visible but have no
misleading upload, page, or camera action. The Angular Runtime view adds a
responsive inventory, upload, preview, delete, and copyable attachment-code handoff. Import/API/store
coverage plus a real SQLite/Chromium gate exercise the vertical slice, and the
original multipart wire contract is accepted by the same protected upload
endpoint.

Latest P0 attachment-import compatibility closure: Unit validation now matches
the original XSD instead of rejecting every `attachment` Variable outside the
implemented capture path. Schema-valid BaseVariables and DerivedVariables with
`image`, `audio`, `ggb-file`, custom lowercase-hyphen formats, or no optional
format import successfully and remain visible in the runtime inventory; a
DerivedVariable is accepted but correctly excluded from the original
BaseVariable discovery path. Only `format="capture-image"` enables image upload,
QR-page, and camera actions, enforced independently by API and Angular. ZIP/API
coverage proves lossless inventory hydration and the supported-operation boundary.

Latest P2 attachment QR-page closure: the protected API and Angular Attachment
Manager can generate either the selected attachment page or a role-scoped PDF
for the complete visible inventory. Each attachment receives its own A4 page
with a large QR code containing the stable attachment ID, a human-readable code,
group/login context, and the original `%GROUP%`, `%TESTTAKER%`, `%BOOKLET%`,
`%UNIT%`, `%VAR%`, `%LOGIN%`, and `%CODE%` label placeholders. Group-monitor
scope is enforced again at generation time; empty inventories, labels longer
than 500 characters, and batches above 500 pages fail with stable diagnostics.
API tests validate page counts, substitutions, scope isolation, filenames, and
cache controls. A production Angular/SQLite browser gate exercises both download
paths, and rendered two-page A4 output has been visually checked for QR clarity,
wrapping, special-character handling, and clipping.

Latest P2 attachment-capture closure: the separate lazy mobile route mirrors the
original camera workflow without weakening its authorization boundary. It can
scan the printed attachment ID through a live rear camera or saved QR image,
switch cameras and flash, accept a manual code fallback, and resolve the target
through the existing role-, workspace-, and group-scoped API. The operator sees
participant, booklet, Unit, and variable context before an A4-centered camera
frame or device photo is previewed and uploaded. Read-only sessions cannot
confirm an upload, and the server independently rechecks write scope. The
production permissions policy allows camera access only to the same-origin app;
microphone and geolocation remain disabled. The
production SQLite/Chromium gate decodes an actual generated QR PNG, resolves the
target, previews and uploads the image, reloads it in the manager, then deletes
it through the same durable audited path.

Latest P0 schema-version boundary closure: versioned Original Testcenter schema
references are accepted through the locally pinned 17.6 contract, including
newer patch revisions within that major/minor line. Direct XML uploads and XML
dependencies inside ZIP packages now fail closed with the stable
`testcenter_xml_schema_version_unsupported` diagnostic when they declare a
newer major or minor schema whose semantics the rewrite does not yet implement.
This applies consistently to Booklet, Unit, SysCheck, and Testtakers documents;
historical and unversioned local schema references keep their existing
compatibility path.

Latest P0 stripped-schema fallback closure: Original Booklet, Unit, SysCheck,
and Testtakers XML that still declares the XML Schema Instance namespace but
omits `xsi:noNamespaceSchemaLocation` no longer bypasses the executable
compatibility profile. Matching the original backend's fallback, the rewrite
records an explicit warning and validates the document as the locally pinned
17.6 schema generation. Valid packages with an orphaned XSI declaration remain
importable, while unsupported roots, attributes, children, cardinalities, and
lexical facets fail through the same stable diagnostics as schema-declaring
XML. Fully declaration-free legacy/native XML retains the rewrite's established
permissive compatibility path. Direct upload, roster, and nested-ZIP intake are
all regression-gated.

Latest P0 Booklet-dependency closure: every `Units/Unit/@id` in an
XSD-declaring Booklet, or in a Booklet with the orphaned-XSI compatibility
profile, must now resolve to a packaged Unit before staging. Loose workspace
imports follow the Unit IDs into the audited immutable dependency snapshot;
prebuilt ZIPs apply the same check and retain the established explicit
file-path/basename reference compatibility. Missing Units fail with the stable
`source_document_booklet_unit_missing` diagnostic and name the Booklet, Unit,
and source file. Fully declaration-free Booklet runtime shells remain the
explicit permissive migration boundary. Automatic assemblies additionally
decode textual Data-URI members with their declared charset and write canonical
UTF-8 ZIP entries, so ISO-8859-1, UTF-16, and UTF-32 Booklets keep their labels
while acquiring the required Unit package. The complete Original compatibility
suite now gates 37 corpus behaviors with this boundary enabled.

Latest P0 Booklet-ID closure: Booklet `CustomText/@key` and `Config/@key`
now share the document-wide `xs:ID` uniqueness boundary declared by the
Original XSD. Duplicate keys within one section and collisions across the two
sections fail with `testcenter_xml_booklet_schema_id_duplicate` before config
normalization can silently choose a value. The direct-upload and nested-ZIP
paths are both pinned against the executable Original schema behavior.

Latest P0 date-time lexical closure: Unit `lastChange` attributes and the
deprecated `Metadata/Lastchange` element now follow the extended-year rules of
XML Schema `xs:dateTime`. Years longer than four digits are accepted without
numeric precision loss, including exact Gregorian leap-year validation, while
forbidden leading-zero forms such as `02026-…` fail with the existing stable
`testcenter_xml_unit_last_change_invalid` diagnostic.

Latest P0 display-label XSD closure: the compatibility profile now
distinguishes a missing required label element or attribute from an authored
empty `xs:string` value. Matching the Original Booklet, Unit, SysCheck, and
Testtakers schemas, empty `Metadata/Label`, Booklet `Unit/@label`, and
Testtakers `Group/@label` values import without weakening identity,
cardinality, or structural checks. Runtime normalization preserves the authored
empty Booklet and Unit labels instead of silently replacing them with generated
text. The storage-parameterized Original corpus gate exercises all four XML
document types.

Latest P0 Booklet-schema closure: the importer now validates the complete
`Units`/nested-`Testlet` tree and the ordered `Restrictions` surface before
normalization. Unknown container, Unit, Testlet, `CodeToEnter`, `TimeMax`,
`Show`, completion, or leave-lock attributes/children fail with stable
diagnostics; singleton restrictions cannot be repeated or placed after their
schema position. Validation follows the declared generation: 14.x/15.0
`TimeMax` remains a positive integer without `leave`, 15.1+ adds the explicit
`forbidden`/`confirm` leave policy, and 17.x additionally accepts `allowed`, a
positive fractional duration, and the adaptive restriction extensions
introduced by that schema.

Latest P0 Booklet root-content correction: the importer now mirrors the
Original 14.3 and 17.6 XSDs' `xs:all` compositor for direct Booklet children.
`Metadata`, `CustomTexts`, `BookletConfig`, `States`, and `Units` therefore keep
their generation-specific membership and singleton checks without acquiring a
non-schema ordering constraint. A deliberately reordered 14.3 Booklet runs
through loose dependency assembly and nested ZIP validation before staging,
while the ordered inner Metadata, config, restriction, and adaptive structures
remain strict.

Latest P0 XML Schema regex closure: the manual compatibility validator now
matches XML Schema's Unicode-aware `\d` character class instead of JavaScript's
ASCII-only escape. Unicode decimal digits therefore survive schema-valid
Booklet State/Option IDs, Unit variable formats, `Show` references, and
Testtakers state presets and access-window timestamps as one executable import,
activation, and roster flow. Timestamp digits are canonically persisted while
retaining the existing timezone and calendar validation; their separator now
also follows XML Schema's Unicode `\W` categories rather than JavaScript's
ASCII word class.
The same gate uses the Original backend's semicolon-separated multi-state
syntax, while comma-separated migrated inputs remain compatible; the
surrounding lowercase-letter/hyphen constraints remain unchanged.
Unit `Variable/@id` length facets now likewise count Unicode code points like
XML Schema instead of UTF-16 code units; the executable boundary accepts 50
astral characters and rejects 51.

Latest P0 adaptive-condition XSD closure: the 17.6 Booklet schema requires
`of` and `from` only for `Score`; `Value`, `Code`, and `Status` deliberately
permit either or both references to be absent. Those schema-valid sources now
import and remain present in the runtime snapshot with the Original parser's
empty-string/default-`0` representation, so they evaluate as unresolved rather
than disappearing and accidentally turning their Option into a fallback.
Missing `Score` references remain a stable validation error. The executable
compatibility matrix covers missing `of`, missing `from`, and a fully empty
source across `Value`, plus reference-free `Code`/`Status` and both required
`Score` attributes. Present-but-empty `Score` strings remain valid and are
preserved, matching `xs:string` and the Original parser.

Latest P0 adaptive-aggregate XSD closure: `Sum`, `Median`, and `Mean` now accept
only the homogeneous `Value`, `Code`, or `Score` source families declared by
the Original schema. A homogeneous `Status` aggregate no longer slips through
the broader standalone-source validator; it fails with the stable
`testcenter_xml_state_condition_aggregation_invalid` diagnostic in both direct
XML and nested IMS-ZIP intake.

Latest P0 root-restriction closure: the original `Units` element is now
retained as the synthetic root Testlet `[0]` at runtime. Its global
`DenyNavigationOnIncomplete` values form the inherited completion baseline,
and its `TimeMax` starts with the first Unit, remains active across nested
Testlets, takes precedence over their timers exactly like the original parent
timer, blocks premature completion according to `leave`, persists through the
existing timer model, and completes the whole Booklet on expiry. Participant,
monitor, and timer-adjustment paths share the same root timer identity.

Latest P0 Verona message-boundary closure: the Participant host now rejects
malformed state, page-state, navigation, and runtime-error notifications before
they reach typed Player handling. Mixed Player log arrays keep valid bounded
entries while discarding null or malformed records, so a broken optional log
cannot suppress the accompanying response state. Contract tests cover invalid
message shapes and the 200-record log bound; the production Chromium/SQLite
gate sends malformed notifications from the active sandboxed Player, observes
no host exception, persists the valid record from a mixed log, and then
continues through valid state and page navigation.
The Player sandbox now also permits the user-activated Clipboard, Blob-download,
and popup paths present in the byte-exact IQB Aspect Player. Popups remain
sandboxed, while same-origin access, top navigation, and sandbox escape stay
disabled; production Chromium executes all three capabilities and asserts that
the stronger isolation tokens remain absent.

Latest P0 Player page-state closure: every Verona `playerState` report now
produces the original host-side `CURRENT_PAGE_NR`, `CURRENT_PAGE_ID`, and
`PAGE_COUNT` Unit logs alongside the durable response envelope. These records
use the Player's authored page ID, the host-resolved zero-based page index, and
the current valid-page count, and travel through the same bounded idempotent
save outbox as Player logs and responses. The production Chromium/SQLite gate
drives both host page buttons and proves the `page-1`/`page-2`, `0`/`1`, and
`2` records through the operator test-log API. Every Verona `unitState` report
also restores the original `PRESENTATION_PROGRESS` and `RESPONSE_PROGRESS`
records, including empty values for omitted progress fields and final reports
from a retiring Player frame. Once the complete Booklet asset set has loaded,
the Participant host also emits the original test-wide `LOADCOMPLETE` record
with browser, operating-system, device, screen-size, and elapsed-load fields;
repeated current-state refreshes do not duplicate it within one frontend load.
The same idempotent test-wide delivery records `CONNECTION=POLLING`, the
original protocol's closest state for the Participant host's HTTP/SSE transport,
and completes the original Test Controller test-state key catalog. The
server-side session-resume path also mirrors the original controller state
subscription: every paused-to-running transition persists
`CONTROLLER=RUNNING`, including untimed runs where no timer entry changes.
Memory, file, and SQLite integration gates distinguish that resume entry from
the initial launch and preceding `PAUSED` state.

Latest P0 Verona navigation closure: the Participant host now mirrors the
original `vopUnitNavigationRequestedNotification` split. `target` resolves as
a case-sensitive absolute Unit ID, while `targetRelative` resolves the
`previous`/`next`/`first`/`last`/`end` commands. Published Simple Player 2–5
releases that sent those five command tokens through `target` remain executable:
the host treats such a token as relative only when it is not the exact ID of a
Unit in the active Booklet. The API-2 `#next`/`#previous` spelling in
`targetRelative` is normalized at the same boundary. Absolute Player
requests can open visible unlocked Units even when the host's Unit-menu control
is not the source of the request, but they still pass the same direction,
completion, adaptive-route, testlet-code, timer, and leave-lock guards before
the server changes the current Unit. Invalid, locked, or locally denied targets
receive the Verona navigation-denied notification instead of being treated as a
lower-cased relative command. Contract coverage pins command precedence and
case preservation; the production Chromium/SQLite gate drives the original
three-Unit Aspect booklet from Unit 1 to Unit 2 through an absolute Player
notification and verifies the server-authoritative current Unit.

Latest P0 Verona session-identity closure: the Participant host now sends the
exact active Booklet Unit key (the original Unit alias) as both
`vopStartCommand.sessionId` and `playerConfig.unitId`, matching the original
unithost contract. Later configuration, page, and navigation-denial messages
retain that same session identity. The production Chromium gate asserts the
identity directly inside the embedded Player.

Latest P0 adaptive Verona-config closure: changes to the visible adaptive
Booklet route now update `playerConfig.unitCount` in the already-running Player
instead of leaving its start-time count stale. The production Chromium gate
drives the original adaptive Booklet from two to three visible Units through
its Bonus state, keeps the current Player frame mounted, and observes the
updated count in `vopPlayerConfigChangedNotification`.

Latest P0 player-family closure: the compatibility corpus now also pins the
official MIT-licensed IQB ABI 3.3.0 scripted-survey, DAN 3.0.0 visual-assessment,
and STARS 0.6.19 choice-interaction Players. ABI retains its release example
byte-for-byte; DAN uses the byte-exact `G231mm.voud` definition from a pinned
official Testbed commit; STARS uses a byte-exact radio-button definition from
its own release tag. Import and production SQLite/Chromium gates negotiate
Verona APIs 2.1 and 6, persist text, radio, multiline, and choice answers, and
restore them after reload. The versioned response envelope records each data
part's original string/object value kind, so ABI's JSON-string `allResponses`,
DAN's JSON-string `all`, STARS' JSON-string `responses`, and the Simple Player's
object-valued state all round-trip correctly. A separate production
SQLite/Chromium gate imports and executes the Testbed's metadata-free
`IQBVisualUnitPlayerV2.99.2.html`, original `G231mm.xml`, and relative
`G231mm.voud` reference without inventing a modern module alias. Its real API
2.1 handshake, JSON-string `all` response, and multiline/choice restoration
after a new Participant navigation make the stable metadata warning's
runtime-handshake fallback executable rather than inferred. The same four-file
graph also resolves from separate workspace uploads: a conservative
dotted-SemVer filename fallback binds the historical player key, while multiple
matching versions fail as ambiguous instead of being guessed. Further
representative families remain P0 corpus work.

Latest current-Original closure: the byte-exact STARS system-test package is
pinned at its introducing Testcenter commit with Player 0.6.40, Unit,
Voud/Vomd definition, 28-alias Booklet, and four-account roster. Import accepts
the package's current `https://w3id.org/iqb/spec/unit-xml/...` schema URL and
validates the nested 18.0 `ViewSettings` structure. API coverage starts the real
hot-return account against all 28 aliases and preserves its participant theme
and alternative-symbol keypad settings; production SQLite/Chromium coverage
persists `iqb-standard@2.0` responses, follows the Player's continue request
from alias `1` to `2`, and restores the second selected option after reload.
The older STARS 0.6.19 pair remains an independent-family gate.

Latest P0 coding-scheme closure: the corpus now pins the complete official
`@iqb/responses` 3.6.0 `test/coding/derive` tree byte-for-byte at its release
commit: 11 scheme variants and all 23 input/outcome cases for `CONCAT_CODE`,
`COPY_VALUE`, both `MANUAL` cases, all four `SOLVER` variants, `SUM_CODE`,
`SUM_SCORE`, and `UNIQUE_VALUES`. The combined compatibility package retains
every deliberately versionless legacy scheme, feeds every official raw
response through server-side coding, and selects one case-specific Participant
route from exact status/code/score/value conditions. It covers base aliases,
same-ID/no-alias solvers, chained and decimal solver values, manual status
propagation, boolean uniqueness and every processing variant, sorted and
chained code concatenation, copied arrays and unset values, code/score sums,
explicit numeric zeroes, partial inputs, `UNSET`, `NO_CODING`, `INVALID`, and
`DERIVE_ERROR`. All 23 raw Player envelopes remain unchanged while the
calculated Booklet state and exclusive visible route persist across memory,
file, and SQLite.

Latest P0 array-coding closure: the same release corpus now pins the versioned
3.0 `array-length-check` scheme and both official input/outcome cases
byte-for-byte. One imported Unit executes AND-connected rule sets, `ANY_OPEN`
and `LENGTH` array selectors, automatic residual code/score `0`, and derived
`SUM_SCORE` recoding. Independent Participant runs prove the full-credit and
residual routes, including original-compatible sorted-array equality, eight
persisted Booklet states, raw response retention, and mutually exclusive
visible Units across memory, file, and SQLite.

The closure now also includes the release's complete deliberately versionless
`arrays` family: its scheme and all four official input/outcome pairs are
byte-exact. Four independent Participant runs execute `SORT_ARRAY`, a numeric
array position, `SUM`, `ANY_OTHER`, and `ANY`, retain each authored raw array,
and distinguish `UNSET`, `CODING_COMPLETE`, and the intentionally ambiguous
`CODING_INCOMPLETE` result. Five persisted Booklet states select exactly one
aggregate, any-other, incomplete, or any route across memory, file, and SQLite.

Latest P0 fragment-coding closure: the same release corpus now pins the
deliberately versionless `fragmenting` scheme, input, and expected outcome
byte-for-byte. A real imported Unit applies `(\d+)\s*(\w+)`, selects capture
groups zero and one, combines the second fragment with `IGNORE_CASE`, and
reproduces all three official code/score pairs. Eight persisted Booklet states,
the unchanged `2 kg` raw Player response, and the exclusive matched route are
gated across memory, file, and SQLite.

Latest P0 rule-tree closure: the complete official `@iqb/responses` 3.6.0
`test/coding/rules` tree now contributes all 18 schemes and 38 byte-exact
input/outcome cases for matching, numeric ranges, booleans, nulls, empty
strings, numeric zero, empty arrays, Player-injected variables,
intended-incomplete status propagation, omitted-value Base variables, and
AND-connected rule/ruleset arrays. A single imported 18-booklet package executes `MATCH`, `MATCH_REGEX`,
`NUMERIC_MATCH`, `NUMERIC_RANGE`, `NUMERIC_FULL_RANGE`, all four numeric
one-sided comparisons, `IS_TRUE`, `IS_FALSE`, `IS_NULL`, `IS_EMPTY`, and
`ELSE`, plus
the original whitespace/case/displayed/empty preprocessing. The Participant
gate distinguishes open from closed boundary behavior, residual zero coding,
`INVALID`, `CODING_INCOMPLETE`, empty-array code 34, and derived `SUM_SCORE`;
it also preserves actually supplied non-Base responses instead of replacing
their manual/external `CODING_COMPLETE`, `DISPLAYED`, `INVALID`, or
`CODING_ERROR` status and signed code/score values with an initialized `UNSET`.
The official 11-case propagation matrix additionally combines
`INTENDED_INCOMPLETE` with every relevant second source status and proves the
exact derived `DERIVE_PENDING`, `UNSET`, `INVALID`, `DERIVE_ERROR`,
`CODING_ERROR`, or coded-complete-zero outcome. `BASE_NO_VALUE` is declared
but deliberately absent from coded output; the remaining cases prove array
position joins, ruleset-level AND, intended-incomplete code types, and
recalculation of a supplied derived response. All 38 official raw inputs
retain their envelopes and select exactly one
persisted route across memory, file, and SQLite.

Latest P0 root-coding closure: the remaining official `alias` and `subforms`
schemes, inputs, and outcomes are now byte-exact corpus fixtures. This closes
the complete `@iqb/responses` 3.6.0 `test/coding` tree at 34 scheme variants
and 70 input/outcome cases. The combined import/Participant gate addresses a
Base variable through its external alias and proves that repeated IDs from
three ordered subforms reach the IQB coder with every `subform` marker intact;
the authored `BASE_NO_VALUE` response is omitted from coding input as required.
After coding, adaptive Testcenter conditions intentionally retain their
original ID-only last-write view, while the full raw multi-subform Player
envelope remains byte-for-byte restorable. Alias and final subform
status/value/code/score routes persist across memory, file, and SQLite.

Latest P0 Unit-metadata dependency closure: the pinned original Aspect package
now includes the two byte-exact `.vomd` documents referenced by
`Unit/Metadata/Reference`. Automatic loose-file resolution follows those
references alongside Booklet, Unit, Voud, and Player dependencies, producing a
ten-file audited immutable assembly whose downloadable snapshot retains both
metadata documents unchanged. A partial chain with a missing `.vomd` fails
with `source_document_workspace_dependency_incomplete` and names the missing
path. The complete graph and failure path run across memory, file, and SQLite.

Latest production-frontend closure: the Angular root shell no longer imports
the Workspace, Content, Runtime, and Ops lifecycle before a feature route is
opened. Shared browser/session state is hydrated immediately, while feature
refresh, monitor streaming, and the Workspace, Content, Runtime, and Ops
services resolve on demand instead of forming one shared eager feature chunk.
The dedicated Start surface is another independent lazy route. The optimized
production initial bundle is now 433.48 kB raw and 109.80 kB estimated transfer,
down from the 563.85-kB eager-feature baseline. A tightened 450-kB
warning and 470-kB error budget now turns a material regression back into a
build signal; direct routes, offline Participant startup, Runtime SSE, and
cross-feature navigation remain browser-gated.

## Capability matrix

### Participant access and session lifecycle

| Capability | Original evidence | Rewrite status | Priority | Rewrite evidence / gap |
| --- | --- | --- | --- | --- |
| Direct participant links | `e2e/Session-Management/login-possibilities.cy.ts` | done | P0 | `/participant` links, session re-entry links, and browser smoke coverage |
| Username with optional password | same | done | P0 | saved roster password hashes and participant sign-in |
| Two-step extra code | `app-root/code-input`, `XMLFileTesttakers.class.php` | done | P1 | original `<Booklet codes="…">` mappings trigger a password-first code challenge; valid codes select their coded assignments plus uncoded assignments, distinct codes reuse only their own durable session, configured alternatives are not returned to participants, and API plus Angular browser tests cover missing, invalid, and valid codes |
| Multiple assigned booklets in source order | `starter.component.ts`, `XMLFileTesttakers.class.php` | done | P0 | every `<Login><Booklet>` assignment persists with a stable identity, including differently preset variants of the same source booklet; starter exposes available/in-progress/completed state and one session runs them sequentially |
| Resume after reload/interruption | hot-return E2E flows | partial | P0 | running and participant-paused sessions resume and restore unit, Verona unit state, player page state, and response; monitor-paused sessions remain paused across direct Resume, session re-entry, and durable-store restart until a monitor continues them. The official Session-Management SM-7 fixture proves that repeated hot-return sign-in reuses the same session and run with its saved response, while SM-9 proves hot-restart creates a clean session and run. The production Chromium/SQLite Controller gate additionally exercises real `Test_Ctrl-3` and `Test_Ctrl-7` Player answers: Hot Return reuses the session/run and restores the selected answer, whereas Hot Restart creates clean session/run IDs while retaining the prior answer in its original run and filtered response export. A versioned browser outbox preserves unsent responses independently per Unit across transient disconnects and hard reloads, overlays the visible Unit before the Player remounts, then prioritizes that Unit and drains every remaining Unit after online re-entry. Page closure mirrors every pending Unit for the run into the Service-Worker queue instead of only the foreground draft. A production SQLite/Chromium gate proves two-Unit foreground recovery order plus two-Unit IndexedDB handoff and delivery. After one online visit, the installable, versioned Service Worker also serves the cached Participant App-Shell and lazy route across a browser-proven offline reload, with a truthful connectivity notice; API state and test content remain network-authoritative, and a never-visited device still requires an initial connection |
| Valid-from, valid-to, valid-for | time-limited-access E2E | done | P1 | original group attributes and JSON/CSV aliases persist as normalized timestamps; scheduled/expired logins return the original-equivalent 401/410 statuses, `validFor` starts at first session creation without reset after close/release changes, the earlier relative/absolute end wins, runtime calls recheck persisted expiry, all store adapters persist it, and API plus browser tests cover the policy |
| Admin and participant login sink/rate limiting | login-sink E2E, `SessionController`, `CacheService` | done | P1 | admin sign-in now reproduces the original global username sink: five failed credentials block the next attempt for 30 minutes by default, correct credentials cannot bypass it, every blocked attempt is audited, and the counter is atomically durable across memory, file, SQLite, and Postgres. Password-protected participant accounts retain their separate tenant/workspace/login counter shared by sign-in and starter launch; unknown/passwordless participant logins do not increment it. Both paths expose configurable thresholds/windows and stable 429 details plus `Retry-After`; API gates run the admin path across memory, file, and SQLite, while restart tests cover file and SQLite persistence |
| Supported-browser warning | `SystemController::getConfig`, `UserAgentService` | done | P2 | the pinned Original 17.6 browser list, browser-family parsing, semantic version comparison, acceptance of newer releases, and rejection of outdated/unknown browsers form a tested compatibility contract; Angular shows a global accessible warning, applies the original participant custom-text placeholder replacements, allows dismissal until reload, and browser-smoke gates the default plus imported per-login copy with an outdated Chrome user agent |
| Layered custom texts | `docs/pages/custom-texts.md` | partial | P2 | original file-level `CustomTexts` are parsed once, attached to every participant and operational login, persisted by every adapter, and returned on sign-in/resume. The complete 43-key participant catalog is a versioned contract, including the historical `booketlet_*` typo, original defaults, `booklet_reload`, and sequential `%s` formatting. XML plus native JSON maps/value objects/key-text arrays support inherited defaults and participant overrides; Booklet XML/JSON now retains its own direct custom-text map. Angular applies matching text to booklet selection, second-code login, supported-browser warnings, fullscreen, code gates, task lists, Verona unit/block loading and failure/reload guidance, five-second timer start/expiry/cancellation notices, timer warnings, leave locks/prompts, navigation denials, pause, resume, and completion states. Leave/timer title and prompt keys now render together in labelled in-app dialogs instead of native browser prompts. The effective participant scope follows the original global < Testtakers/Login < active Booklet order; the Booklet layer starts only with the run, while system-check-specific text overrides global text on that surface. The complete original 58-key `gm_*` catalog and defaults now form a second versioned contract. Imported Testtakers monitor text survives the password-redacted migration candidate, account creation, every store, and sign-in, then overrides global settings for the authenticated monitor. The focused Angular console actively applies all 58 keys to its headline, commands, core columns, summary/group context, profile view/filter presentation and pending/locked indicators, monitor-start and password-verified scheduled/expired labels, batch-selection counts, command tooltips and confirmed unlock feedback, target-timer state and confirmation, scroll/hide controls, and typed broken-booklet errors; sequential `%s`, `%date`, and `$date` substitution and original German defaults are contract-tested. Scheduled and expired operator accounts expose their concrete access boundary and login-scoped copy only after successful password verification, while unknown accounts and wrong passwords keep the generic credential response. Broken legacy runs remain visible and distinguish missing booklet IDs, missing release entries, malformed booklet snapshots, and unavailable releases without taking down healthy monitor rows; unsafe commands are withheld for those runs. The Verona host maps `booklet_unitLoadingPending`, `booklet_unitLoadingUnknownProgress`, and `booklet_unitLoading` to accessible queued, indeterminate, and exact 100%-loaded milestones and browser-smoke gates their real order without inventing unavailable byte percentages. |

### Participant player and booklet runtime

| Capability | Original evidence | Rewrite status | Priority | Rewrite evidence / gap |
| --- | --- | --- | --- | --- |
| Independent Player-family gates | official ABI, DAN, and STARS repositories plus Verona Player Testbed | partial | P0 | provenance-pinned ABI 3.3.0, DAN 3.0.0, and STARS 0.6.19 releases import with official executable definitions and negotiate APIs 2.1 and 6. ABI persists text/radio answers in string-valued `allResponses`; DAN persists positioned multiline-text/multiple-choice answers in string-valued `all`; STARS persists a choice in string-valued `responses` using `iqb-standard@1.1`. Production Chromium/SQLite reloads all three without Player-specific state rewriting, proving data-part value-kind preservation across distinct implementations and metadata generations. Separately, the complete current Original STARS 0.6.40 system-test graph executes its 28-alias Booklet and restores `iqb-standard@2.0` responses after Player-originated navigation. Further production families remain |
| Verona player integration | `test-controller`, `unithost` | partial | P0 | sandboxed `srcdoc` host imports embedded JSON and Testcenter ZIP players/definitions, exposes accessible queued, indeterminate document-loading, and exact 100%-loaded milestones before start, and exchanges ready/start/state/navigation/runtime-error/focus messages. Active load or Player failures now promote to the original-style route error guard: Angular removes the complete Unit surface, applies `booklet_errormessage` plus `booklet_reload`, blocks every other participant command, and performs a full page recovery. Like the original `unithost`, it now updates navigation targets and other mutable Player config through `vopPlayerConfigChangedNotification` without restarting the iframe; disabled Player navigation receives the standardized presentation/response reasons through `vopNavigationDeniedNotification`. Player-originated `previous`, `next`, `first`, `last`, and `end` requests follow their own host-authorized path, so first/last remain usable when the Booklet deliberately hides its Unit menu and host controls. Angular now derives Player-End readiness from both live Player response completeness and the compiled `never`/`last_unit`/`always` Booklet policy, preventing a complete Player from bypassing an authored `OFF` rule while retaining draft-aware enablement without an iframe restart. Player `validPages` and `currentPage` reports now drive the original-style INDEX, LABEL, LIST, hidden, and read-only host controls, including legacy `page_navibuttons` mapping, and host page changes use `vopPageNavigationCommand`. Independently and partially reported Unit state is merged field-wise and data-part-wise like the original buffers, so a later progress-only notification cannot erase an answer or its legacy value-kind metadata. Retiring iframes retain their original session context long enough to accept final `window:unload` state and runtime-error reports; response/log delivery targets that Unit without changing or failing the new Player. Central active-Player and load failures persist the original test-wide `CONTROLLER=ERROR` state through the durable outbox, de-duplicate repeated notifications from one failed frame, and use a tab-local recovery marker to record `CONTROLLER=RUNNING` after a successful full-page Player restart; late retired-frame failures remain attached only to their original Unit and cannot fail the replacement Player. Player-reported runtime errors are bounded and persisted as original-compatible unit logs through the same durable, idempotent outbox as responses. The pinned original Verona 6 sample executes these transitions browser-side: its initially denied Player-End receives `responsesIncomplete`, a complete response enables `end` in the running Player without a second start, and a synthetic active runtime failure reaches the terminal error boundary before recovering the same run and response. That sample also gates its real unit definition, CORS-readable single- and multi-range resource delivery, raw response autosave from separate data/progress/page notifications, durable Player-log forwarding, 500 ms debounced test-wide `FOCUS` logging, adaptive route transition, background-close recovery, and reload restoration. The official Verona API-3 Player independently proves first/last plus previous/next navigation across two Units while both host navigation surfaces are hidden. The same original resource package is now separately uploaded and transitively resolved with its loose Booklet/Unit/definition/Player chain through immutable import and Participant delivery. A second executable gate loads the byte-exact original IQB Aspect 2.12.3 player and all three original 17.4 Unit/Voud pairs, including the 16.17 MB image definition; it combines separately emitted player/unit state, persists text plus radio `elementCodes` and page state, renders four embedded images, crosses all host units forward and backward, and restores the response after reload. The original Test Controller `pagingMode=buttons` now survives policy compilation and is proven through the player's visible page control. Additional representative player families remain |
| Player API compatibility validation | workspace file admin and unithost | partial | P0 | runtime ready handshake gates Verona major versions 2–6; ZIP import performs version-aware structural validation for the experimental `$schema`-only format, legacy metadata 1.x/2.x, and strict metadata 3.0/3.1, rejects unsupported metadata/API versions and malformed type, identity, language, SemVer, dependency, maintainer, code, or unknown-property fields with stable diagnostics, and correctly distinguishes `player-id@module-version` from `specVersion`. Official Simple Player fixtures now prove API 2.1, 3.0, 4.0, and 5.2 through import and browser execution, while the original Aspect fixture proves that module `2.12.3` can negotiate Verona API `6.0`. Metadata-free legacy players remain importable with a warning because their references cannot prove API compatibility; the official API-2 fixture proves that warning-to-runtime-handshake path, while additional player families remain |
| Booklet/unit navigation | `test-controller` | partial | P0 | ordered units, authored full and `labelshort` labels, current position, nested original `Testlet` hierarchy, and per-unit testlet paths persist. Imported `BookletConfig` compiles menu/button/player-end rules and server-side forward/backward eligibility. The distinct original 17.6 `unit_navibuttons` modes now survive compilation: `FULL` renders previous/next controls plus the direct short-label Unit strip, `ARROWS_ONLY` keeps only previous/next, `FORWARD_ONLY` renders the direct strip plus Next, and `OFF` hides the surface; modern Unit-label and control keys remain independent. Current 18.0 `navbar_backward_button` and `navbar_forward_button` compile independently as `HIDDEN`, `DYNAMIC`, `UNITS`, or `PAGES`; the separate accessible buttons either change the Verona page, change the Unit, or cross the Unit boundary dynamically at the first/last Player page. Contract and pinned import gates cover all eight official cases 19–26, while production Chromium proves dynamic two-page traversal, hidden rendering, and an official `UNITS` transition to the repeated-Unit alias. Direct jumps obey the same completeness, direction, and leave-lock authorization as other Unit navigation. Production-built Chromium gates prove the Aspect booklet's authored `1`/`2`/`3` strip and direct jump, plus the official BookletConfig package's legacy `LABEL` and `OFF` behavior. Original `browserBehaviour=preventNav` is now a typed runtime policy: an Angular popstate-only deactivate guard cancels browser Back/Forward exits during a running Unit while leaving normal test controls and imperative navigation untouched, and presents accessible guidance unless silent mode is active. Original `Show` rules remove inactive routes from the menu/navigation/completion path, Demo/Review/Trial participants can select a durable state override while retaining the automatic recommendation, and unit/testlet leave locks prevent and visibly mark re-entry. All 17 original Test-Controller system booklets now import and activate together with their five Units, legacy Player, and exact 26-login roster; representative official accounts gate navigation, code/time enforcement, session reuse/restart, and monitoring across memory, file, and SQLite. A production-built Angular browser gate repeats the complete official import and proves block-code normalization, the running testlet timer, nested completion locks, and forward navigation with two original accounts. The official API-3 Player gate additionally proves browser navigation cancellation with an unchanged running Unit. The complete original three-unit Aspect booklet independently gates real-player navigation behavior |
| Response and run-state save | test routes and hot-mode E2E | partial | P0 | versioned Verona unit/player-state envelopes and Player logs persist through coalescing autosave, visible retry, navigation, reload, and Participant-view closure; independently emitted Verona unit/player state is merged before persistence, eager background saves yield to foreground navigation, and the Angular Participant facade caches typed state so large definitions are not repeatedly JSON-parsed during rendering. A monitor pause now tears down the Player and rejects participant resume/navigation; a response already secured before that command may drain without changing the paused status or resuming timers. Original `unit_responses_buffer_time`, `unit_state_buffer_time`, and `test_state_buffer_time` values compile with their 5000/6000/1000-ms defaults; the merged rewrite envelope uses the earliest applicable fixed window while every change is secured immediately in the local outbox. Navigation/completion keep the iframe alive through the Player's debounced `stateChanged` window, force the latest outbox payload to its explicit response Unit, and avoid overwriting that delivery with a stale empty foreground draft. The official TC-3 browser account proves that its authored 20,000,000-ms windows suppress background upload but preserve a just-selected answer and durably flush it on immediate Unit navigation. Failed or page-close-pending saves enter a bounded per-Unit local outbox, survive reload, restore the visible Unit first, and drain all persisted Units immediately after reconnect. Page closure mirrors every run entry into the validated IndexedDB Service-Worker queue for Background Sync instead of leaving non-current Units browser-local. Client delivery IDs and deterministic server log/audit IDs make concurrent foreground/worker redelivery idempotent across all stores; production SQLite/Chromium gates prove two-Unit recovery order, two-record offline worker handoff, complete delivery and queue cleanup, and a separate close-before-buffer-expiry response that remains durable after the renewed Player handshake |
| Timed blocks and warnings | time-restrictions E2E | partial | P0 | server-authoritative timers start on actual entry in every execution mode, persist across reload/storage where the mode saves state, pause/resume durably, count down live in the Angular player when `unit_show_time_left` enables the clock, emit five-second alerts at compiled `unit_time_left_warnings` thresholds, and always record expiry. Enforcing modes expire into the next eligible unit, close against re-entry, and apply `forbidden`, `confirm`, and `allowed` navigation/completion rules; non-enforcing Demo/Review/Trial modes retain the same observable timer lifecycle without forced navigation or locking. Operators can restore an audited selected remaining time, and monitoring plus CSV exports expose authored target limits, live timer labels, states, remaining time, leave policies, and lifecycle timestamps. Start, pause, resume, cancellation, expiry, completion, and operator timer changes also emit original-compatible test-wide `TESTLETS_TIMELEFT` snapshots keyed by Testlet ID with remaining time in minutes. Single and bounded-batch monitor jumps restore a closed target timer atomically with the requested remaining time, validate timed targets server-side, retain the previous lifecycle state in audit details, and use the original confirmation/timer copy in Angular. Participant confirm-leave uses an original-titled in-app dialog with a safe `Stay here` default and explicit `Leave anyway` continuation. The complete original `CY_Bklt_TC-*` leave-policy matrix is import-gated, and the production Chromium/SQLite gate executes the official TC-6/TC-7/TC-8 accounts: confirm cancellation and continuation, immediate allowed leave, forbidden UI navigation plus direct-API rejection, durable timer cancellation, and closed-block re-entry protection. The same production gate now executes the complete TC-5 account matrix with real `Test_Ctrl-10/11/12/13/14` accounts: the Hot Return timer demonstrably continues while its leave-confirmation dialog remains open, all five start and expire the authored 12-second timer, Hot Return/Hot Restart automatically advance past and close the block, while Demo/Review remain in the timed Unit and permit navigation plus expired-block re-entry. Production-scale and additional nested timing fixtures remain |
| Presentation/response completion locks | booklet config E2E | partial | P0 | Verona progress drives visible forward/backward/completion denial and server-side `409` guards with direction-specific reasons; nested original `DenyNavigationOnIncomplete` values now inherit independently per presentation/response dimension and can override global booklet rules. The official TC-14 browser flow proves that a required response alone remains locked, completing the player's `buttons`-paged presentation unlocks both host and player controls, and navigation then reaches the next original Unit. The production Chromium/SQLite Test-Controller gate now also executes the complete official TC-9/TC-10/TC-11 Testlet-override matrix and TC-15/TC-16/TC-17 global BookletConfig matrix with the real `Test_Ctrl-18/19/20/24/25/26` accounts. It distinguishes unrestricted `OFF`, forward-only `ON`, and bidirectional `ALWAYS`, requires both response and presentation completion where authored, preserves repeated-Unit aliases, and proves denied forward/backward manipulation as direction-specific `409` responses. Demo/Review/Trial retain navigation and surface the exact would-block completeness reasons as a transient test-mode advisory, while Hot/Simulation remain enforced; API mode-matrix and production Angular browser gates cover both paths |
| Unlock code and leave-once rules | hot-mode and leave-block E2E | partial | P0 | original `CodeToEnter` gates block initial entry, navigation, and completion until the Angular participant flow records a durable per-run unlock without exposing the code; every successful participant entry emits the original test-wide `TESTLETS_CLEARED_CODE` snapshot, and replaying an already accepted unlock does not duplicate it. Original `LockAfterLeaving` unit/testlet scopes and optional confirmations persist and block re-entry. Their Unit/Testlet titles and prompts use labelled in-app dialogs; a production browser slice proves imported overrides, cancellation without state change, and explicit confirmation. The production Chromium/SQLite Test-Controller gate additionally executes official TC-12/TC-13 with their real `Test_Ctrl-21/22` accounts, proving safe confirmation cancellation, confirmed Unit locking, automatic Testlet locking only after its boundary, disabled backward controls, durable lock arrays, and direct-API re-entry rejection. Every participant navigation or completion that activates a lock also emits the original test-wide `UNITS_LOCKED_AFTER_LEAVE` sequence-ID or `TESTLETS_LOCKED_AFTER_LEAVE` testlet-ID snapshot. Supervised go-to clears target locks/codes and whole-run monitor unlock durably clears/bypasses both; monitor re-lock restores authored rules for subsequent actions without recreating already consumed one-time gates or cleared locks |
| Adaptive booklet states | adaptivity E2E | partial | P0 | original XML states select the first matching option and schema-aware import requires at least one conditionless fallback per State, matching the original file constraint instead of treating the final conditional option as an implicit default. The importer also enforces the original State/Option/If/source/aggregation/Is attribute and child surface, including Score-only `or`, rather than ignoring unsupported routing syntax. IQB-standard Verona variables are evaluated through `Value`, `Code`, `Score`, `Status`, `Sum`, `Mean`, `Median`, and nested `Count`; every tracked variable is initialized to the original `UNSET`/`null` response before the first save, including the configured Score fallback, and repeated IDs across ordered subform data parts follow the original ID-only last-write-wins behavior before coding. Server coding is proven to move those initial and repeated-ID routes plus textual `Status=CODING_COMPLETE` and its original numeric rank through persisted state selection. `Show` routes are enforced server-side and the Angular unit menu is restricted to the active path; ZIP-relative `CodingSchemeRef` dependencies are retained in immutable releases and the original pinned `@iqb/responses` implementation derives tracked codes, scores, and indirect variables from raw player responses before routing. The complete byte-exact official 3.6.0 `test/coding/derive` tree now gates 11 `CONCAT_CODE`/`COPY_VALUE`/`MANUAL`/`SOLVER`/`SUM_CODE`/`SUM_SCORE`/`UNIQUE_VALUES` scheme variants and all 23 inputs/outcomes, including versionless wrappers, aliases and same-ID variables, chained/manual/decimal derivation, copied arrays and unset values, derived code/score, every uniqueness processing combination, and exact status/value routing across memory, file, and SQLite. The pinned original `Booklet2.xml`, `Unit2.xml`, `coding-scheme.vocs.json`, and Verona 6 player form a separate executable import-to-routing compatibility gate; the server persists the original-equivalent `BOOKLET_STATES` snapshot at launch and after response saves, emits those complete snapshots as original-compatible test-wide logs with idempotent delivery replay, restores or backfills the durable state across memory/file/SQLite/Postgres stores, and uses it authoritatively for participant and monitor routing; original Testtakers `Booklet state="…"` presets and differently preset variants of one booklet are validated, assigned stable identities, and exposed consistently to starter, player, history, monitor, and CSV; broader production packages and further exotic value edges remain |
| Runtime display/fullscreen options | booklet config E2E | done | P1 | compiled policy drives unit menu/buttons, Verona paging/logging/page restore, configured booklet/block/unit headers and unit-title visibility. Current `header_hidden` policy removes the global Participant toolbar while retaining a standalone, actionable application logo, the independent Unit title, and essential runtime/leave controls; old runtime snapshots default safely to a visible header. Original `navbar_unit_label` now renders the active Unit as a position, authored label, or no navigation label while leaving its independently configured controls intact; contract/API gates cover all modes and the production official API-3 Chromium flow verifies the label updates across Player-originated navigation. Original `loading_mode=EAGER` blocks the first Player mount until a participant-scoped request has transferred every Booklet Unit definition and its deduplicated Player HTML; `LAZY` retains the small current-Unit request and immediate start, then deduplicates and retains the remaining Booklet assets in the background. The production API and official API-3 Chromium gates verify the asset sets and visible ready milestone; the LAZY Chromium gate additionally holds the background response until the Player is running. Active timed blocks honor time-left visibility and warning thresholds, while booklet-requested fullscreen prompts and toolbar controls enter/exit the browser API with a visible unsupported/error fallback. Original `silent_mode` suppresses participant denial notices plus timer lifecycle and warning messages without weakening server-authoritative restrictions, and `toolbar_show_reload_button` exposes a browser-tested full-page reload that restores the active session/run. All four original `CY_Bklt_BkltConfig_*` files now run as one activated package with the byte-exact official roster: their assigned accounts verify every authored policy variant, three- versus 120-second timer startup, repeated-unit aliasing, first/last/never Player-End eligibility, ordinary completion, termination locking, and monitor visibility across memory, file, and SQLite. A production-built Angular browser gate imports every current case 5–51 and independently opens all four legacy official accounts plus current cases 11–18 and 27–51 against the package, including a repeated-Unit transition, both completed and monitor-locked termination outcomes, and OFF/ON Player-page restoration after a round trip to the repeated-Unit alias, and all current Unit-label, Unit-control, Page-label, Page-control, Unit-title, Unit-list, fullscreen, reload, time-left, and silent-mode presentation variants, and verifies their actual menu, host-navigation, header, unit-title, fullscreen, time-left, alias, and Verona Player-End presentation. |
| Execution modes | `definitions/test-mode.json` | done | P0 | all six participant modes use a versioned copy of the original capability matrix; Testtakers XML plus JSON/CSV aliases persist the mode through roster, session, run, SQLite/Postgres migrations, runtime state, monitoring, and CSV exports. `alwaysNewSession`, response/Player-log persistence, code/timer/navigation enforcement, menu/time visibility, open-run/study-monitor visibility, remote-command eligibility, editable state options, and participant-authored test/unit/task-page review CRUD with original priorities, multi-category selection, and immutable browser/original-unit provenance are server-authoritative and API/browser-gated. Timer lifecycle tracking is independent from enforcement, so non-enforcing Demo/Review/Trial modes still expose authored countdown and expiry while retaining unrestricted navigation. Byte-exact SM-7/SM-8/SM-9 roster fixtures independently gate the original hot-return and hot-restart mappings, and the official TC-5 production-browser matrix gates timed Hot Return, Hot Restart, Demo, and Review behavior. The production Chromium/SQLite gate additionally executes the real `Test_Ctrl-1` and `Test_Ctrl-2` accounts: ephemeral Player answers survive forward/back navigation but reset with timers and the current Unit on same-run re-entry, while Review comments remain durable and Review Player responses/logs remain absent |

### Import and content administration

Import validation now rejects unsupported attributes on all four original XML root types and non-empty namespaces on their roots and schema-owned descendants, matching the schemas' missing `targetNamespace`, while allowing namespace declarations and `noNamespaceSchemaLocation` by namespace identity rather than by the conventional `xsi` prefix. Schema references mirror the original backend's case-sensitive historical `v?o?_?Type.xsd` filename surface, so current `vo_Booklet.xsd` files and legacy forms such as `Booklet.xsd`, `v_Unit.xsd`, `o_SysCheck.xsd`, and `_Testtakers.xsd` remain importable without confusing differently cased types. The Unit schema's deliberately untyped `label`, `value`, and `ValuePositionLabel` payloads retain arbitrary embedded XML. Direct XML uploads and XML entries inside ZIP bundles share this boundary.

The same validator accepts the canonical 18.0 W3ID schema identifiers now
emitted by the Original for Booklet, Unit, Testtakers, and SysCheck documents,
while retaining the historical `definitions/*.xsd` form and rejecting W3ID
identifiers for the wrong document type or versions newer than 18.0.

Latest P0 IMS-path closure: XML manifest resource lookup now composes inherited
`xml:base` values across the complete `manifest` → `resources` → `resource` →
`file` hierarchy before resolving `href`. A nested ZIP integration gate places
the manifest below the archive root, distributes the path across the manifest,
resources container, and individual resources, and requires the resolved Unit
title and body to reach the staged runtime snapshot instead of accepting only a
synthetic organization entry. Local URI references additionally decode valid
percent-encoded UTF-8 path characters and discard query or fragment suffixes
before ZIP lookup, while malformed escapes remain literal. The same gate uses a
Unicode filename with encoded spaces plus an entry fragment and requires its
decoded canonical Unit key in the release.

Latest P0 Unit-URI closure: the same local-URI canonicalization now governs
Testcenter Unit cross-references inside packaged ZIPs and the automatic loose
workspace dependency graph, covering definition, variables, coding-scheme,
Player, dependency-resource, and SysCheck Unit paths through their shared
resolvers. The manifestless Original-style workspace gate now imports a
percent-encoded external `DefinitionRef` with a fragment and requires its HTML
in the activated Unit snapshot. The loose Booklet → Unit → definition → Player
→ original resource-package gate independently resolves an encoded definition
filename into the immutable automatic assembly and keeps Participant delivery
intact.

Latest P0 ZIP-integrity closure: every extracted archive entry must use an
unencrypted supported compression method, expand to its central-directory size,
and match its CRC-32 before it can participate in manifest, XML, or
nested-resource processing. Entries without the data-descriptor flag must also
carry identical CRC and size fields in their local and central-directory
headers, closing parser-differential ambiguity. Standard streaming ZIPs with
bit 3 set remain compatible: zero local placeholders plus a signed data
descriptor are accepted while the payload is still bounded and verified using
the authoritative central-directory values. Production API gates independently
cover corrupt payload metadata, all three local-header mismatches, and a
deflated manifest/Booklet/Unit package whose entries use data descriptors;
invalid XML entries fail staging with the stable
`source_document_zip_xml_unreadable` diagnostic instead of entering the
dependency graph as apparently valid content.

ZIP entry-name decoding now follows the archive flag instead of assuming every
package is UTF-8. Bit-11 names remain UTF-8; legacy entries without that flag
use the required CP437 mapping. A production API gate encodes
`units/Größe.xml` as raw CP437, references the Unicode path from the manifest,
and requires the resolved Unit XML to reach the staged runtime snapshot. The
Info-ZIP Unicode Path extra field (`0x7075`) is also honored when its version,
UTF-8 payload, and CRC-32 binding to the raw header name are valid; an invalid
binding falls back to CP437 instead of redirecting dependency resolution. A
second gate resolves the non-CP437 path `units/測定.xml` through that field and
retains its Unit content in the staged release.

EOCD discovery now accepts only a candidate whose declared ZIP-comment length
reaches the physical archive end, so an embedded `PK\x05\x06` sequence inside a
valid comment cannot shadow the real directory record. Imports also require a
single-disk entry count and an exact Central Directory extent; entry headers
and an optional Central Directory digital-signature record must stay inside
that extent. API gates accept a commented package containing the false
signature and reject both multi-disk metadata and a forged directory size with
`source_document_zip_invalid`.

Bounded Single-Disk-ZIP64 exports are now accepted without weakening those
limits. The parser validates the ZIP64 EOCD record and locator, resolves only
safe-integer entry counts, directory extents, per-entry sizes, and local-header
offsets from `0x0001` extra fields, then applies the existing 5/20/50 MiB
manifest/resource/aggregate ceilings, compression, CRC, and path checks.
Memory, file, and SQLite API gates import a deflated Booklet/Unit package with
ZIP64 sentinel fields; an inconsistent multi-disk locator remains a stable
`source_document_zip_invalid` failure.

Original root-level ZIP uploads no longer require an IMS manifest. Matching the
original workspace importer, an archive containing a Testcenter Booklet or
SysCheck root receives the same semantic resource-alias view used for reviewed
loose-file assembly. This resolves its Unit and resource dependencies across
arbitrary nested folders by metadata ID, exact path, basename, modern Verona
module/version aliases, and historical player stems while retaining the normal
ZIP path, schema, duplicate, compression, size, and checksum gates. A
production API gate assembles a manifestless Booklet, Unit, external
definition, Verona player, and the byte-exact original `.itcr.zip` sample into
one runtime snapshot. Validated Testtakers roots in the same archive are now
imported as one roster batch: participant passwords are hashed, operational
login candidates remain password-redacted, repeated imports update rather than
duplicate participants, and the API plus Angular activity feedback report the
source files and import counts. Multiple Testtakers files share one candidate
replacement operation, so later files cannot erase candidates from earlier
files. The same password-redacted summary is joined back into Import Job Detail
from its durable activity record, so it remains inspectable after a reload
without adding secret-bearing fields to the import entity. Arbitrary XML
archives still fail with
`source_document_zip_manifest_missing`, and an
explicitly named but unreadable manifest remains a hard integrity failure.

Nested `.itcr.zip` resource packages now apply the same safe relative-path
contract as the outer upload before resource projection. Traversal segments,
absolute and drive-qualified paths, backslashes, control characters, and
overlong names fail with `source_document_resource_path_invalid`; valid sibling
resources remain bounded and CRC-checked.

Latest SysCheck XSD closure: runtime snapshots preserve the signed values
allowed by the original `xs:integer` speed attributes instead of silently
clamping negative thresholds and retry limits to zero. Browser-side speed-test
package sizes retain their independent safety bounds.

Latest SysCheck questionnaire closure: header questions now follow the original
presentation precedence and render authored text content when present, falling
back to `prompt` only for an empty header body. The imported value is gated from
XML through the Angular questionnaire in SQLite/Chromium.

Latest Testtakers file-graph closure: matching the original
`XMLFileTesttakers::crossValidate`, every participant `<Booklet>` assignment is
now a case-insensitive dependency on the corresponding Booklet metadata ID.
Loose roster imports resolve those Booklets and their transitive Unit resources
into one immutable package before importing participants; missing Booklets stop
both loose and prebuilt-ZIP imports with
`source_document_testtakers_booklet_missing`, before any roster mutation.
Structurally invalid current JSON rosters stop earlier with
`source_document_testtakers_json_invalid` (or
`participant_roster_json_invalid` on direct intake), likewise before any
workspace roster mutation.

Latest current-schema intake closure: Unit declarations using either the legacy
`testcenter-unit-xml` or current `unit-xml` W3ID path select the same pinned
generation-aware compatibility profile. Current 18.0 Testtakers
`ViewSettings` validate `theme`, structured `codeInput` type/length, and
`monitorBookletVisibility` children, while the 17.6 visibility attribute stays
compatible. Unknown children, repeated singleton settings, invalid keypad
types, and undersized lengths fail before roster migration. Participant settings
now persist through file, SQLite, and PostgreSQL stores: Angular applies and
clears the per-login theme override and renders Original-style numeric, symbol,
or alternative-symbol keypads at both the second-login-code and `CodeToEnter`
block gates, auto-submitting at the configured length.

Current 18.0 intake also validates Group/Login `AssetAssignments`, rejects the
container in earlier generations, inherits group filenames into each login,
and lets a login replace individual slots. The effective filename map survives
all persistent roster adapters. The protected global registry, public image
delivery, global slot defaults, Participant override precedence, and all eight
Angular presentation targets are now implemented. Registry replacement keeps
stable identities, and deletion refuses assets still assigned globally or by
persisted participant and operational roster entries across workspaces.

| Capability | Original evidence | Rewrite status | Priority | Rewrite evidence / gap |
| --- | --- | --- | --- | --- |
| JSON/XML/ZIP package intake | `WorkspaceController`, file parsers | partial | P0 | staged immutable releases, retry diagnostics, IMS/Testcenter aliases, referenced ZIP content, manifest-resource-ID resolution for original unit references, ZIP-relative IQB coding-scheme dependencies, nested original `.itcr.zip` extraction/delivery, manifestless original root-ZIP assembly, bundled Testtakers roster import, and a pinned 14.3/15.1/17.4/17.6/18.0 corpus whose real adaptive, Session-Management, SysCheck, and complete three-unit Aspect samples bundle complete dependency sets. Source-package create/replace/retry routes use a separate bounded 72 MiB JSON-body limit, so the enforced 50 MiB extracted-package ceiling remains reachable for base64 uploads without weakening ordinary API commands. ZIP manifest reads remain capped at 5 MiB, while referenced resources use the intended 20 MiB per-entry ceiling: the original 16.17 MB Aspect definition imports byte-exactly and a declared resource above 20 MiB is rejected with a stable diagnostic. Bounded single-disk ZIP64 EOCD/locator records and per-entry size/offset extra fields are accepted within the same ceilings across memory, file, and SQLite; unsafe integers, inconsistent metadata, and multi-disk locators remain invalid. XSD-declared Units block staging when `DefinitionRef`, player, or player-targeted file dependencies are absent, while relative, manifest-backed, and unambiguous original workspace-style names resolve. Root ZIPs containing recognizable Testcenter XML use the same semantic aliases as loose-file assembly across nested folders without weakening arbitrary-archive or explicit-manifest rejection; validated Testtakers entries are imported as one password-safe batch and return explicit participant/update/operational-candidate counts. Angular and API accept a loose multi-file upload; importing a Booklet or SysCheck automatically follows uniquely matching Unit/player/definition/variables/coding/resource references, stores the closure as a CRC-valid immutable ZIP with member lineage, and imports it immediately. Explicit reviewed assembly remains for ambiguous names and preserves or synthesizes compatible resource aliases, including modern `id@version-major.minor` and original `id-version-major.minor` player references, but not `id@specVersion`; production package variants remain |
| Text source encodings | XML file readers | partial | P0 | standalone uploads, loose dependency analysis, automatic assembly, file-type detection, and XML/manifest entries inside stored or deflated ZIPs share BOM-, XML-signature-, XML-declaration-, and Data-URL-charset-aware decoding. Base64 and byte-preserving percent-encoded Data URLs both retain legacy source bytes. UTF-8, UTF-16LE/BE, UTF-32LE/BE, ISO-8859-1, and Windows-1252 aliases are supported without corrupting labels; UTF-32 BOMs are resolved before their shared UTF-16 prefixes. Additional declaration-driven WHATWG legacy encodings supported by the runtime, including ISO-8859-15, use the same byte-preserving path; XML-standard `ISO-10646-UCS-2` and `ISO-10646-UCS-4` aliases map to the signature-aware UTF-16/32 decoders. Unknown declarations fail explicitly as `source_document_xml_encoding_unsupported` instead of silently falling back to UTF-8. Authoritative BOM/signature conflicts with `encoding=` fail consistently as `source_document_xml_encoding_mismatch` for standalone Base64 and percent-encoded Data URLs as well as XML entries inside ZIPs, while generic UTF/UCS declarations remain valid for either byte order. Original-corpus API gates cover these diagnostics together with standalone legacy bytes, declaration-free charset transport, BOM-less UTF-32, a big-endian UCS-2 Booklet, a little-endian UCS-4 Booklet, and a UCS-4 ZIP manifest. Remaining gaps are other IANA XML encodings outside the runtime decoder set |
| Original Testtakers XML | `XMLFileTesttakers.class.php` | partial | P0 | the original sample fixture plus byte-exact `CY_Logins_SM.xml` gate participant-versus-operational login modes, groups, password-free and password-protected entry, valid-from/to/for group windows, ordered multiple-booklet assignments, per-booklet second-code mappings, original comma-separated multi-state presets, and distinct identities for differently preset variants of the same booklet. Operational `monitor-group`, `monitor-study`, and `sys-check-login` entries are no longer silently discarded: mixed imports return password-redacted migration candidates with group, profile, access-window, and per-login `monitorBookletVisibility` context, and operational-only imports succeed as explicit account-migration input with zero participant changes and audited classification. The Angular Runtime view previews both forms, disables participant-link generation for migration-only input, and renders the candidates in a dedicated migration card. The password-redacted candidate inbox is workspace-persistent across memory, file, SQLite, and PostgreSQL, returned with saved-roster reads, replaced by later roster imports, and automatically restored in Angular without copying password-bearing drafts into Local Storage; the production SQLite browser gate clears local candidate state before reload to prove server hydration. Referenced `Profiles/GroupMonitor` definitions resolve into their original column, density, auto-next, filter-enable, and filter settings, including lossless `not` negation for all XML Schema boolean spellings (`true`/`false` and `1`/`0`). XSD-declaring rosters now reject missing or duplicate profile IDs, dangling references, mixed Booklet/Profile assignments, invalid state syntax, duplicate custom-text keys, non-original column/view/filter/visibility enums, impossible/inverted access boundaries, and non-positive or unsafe `validFor` lifetimes; omitted view and filter type normalize to the original `medium` and `equal` behavior. The structured Angular editor and guarded admin API use the same `full`/`medium`/`small` view contract. Resolved profiles and the original `visible`/`collapsed`/`hidden` Testheft-list setting are stored with the scoped monitor role in every adapter, returned at sign-in, manually editable in Angular, and applied to the monitor list; legacy role JSON defaults safely to `visible`. Profiles remain selectable in Angular and drive supported run filters, visible columns, booklet-state fields, density, and batch-visible selection, including the original `filterLocked` behavior. Booklet, current block, and current unit IDs/labels are projected from immutable releases for the corresponding original filters, columns, and CSV fields. Original file-level `CustomTexts` are copied to every participant login, persisted in every adapter, restored across sign-in/resume, and resolved against the versioned 43-key participant catalog throughout matching Angular starter and Player states; a real SQLite Verona gate covers imported copy, placeholder formatting, code normalization, timer, leave-lock, navigation-denial, and controller-error reload rendering. The admin model supports explicit `group_monitor`, `study_monitor`, and workspace-scoped `system_check` accounts without elevating them to workspace administration; group scope is durable across all stores and assignable in Angular. Supported candidates prepare the exact scoped account form, including `validFrom`, `validTo`, `validFor`, and booklet-list presentation, in one action and complete account creation after the operator supplies a new password, so the source secret is never exposed or copied. Every store persists these access fields; sign-in rejects scheduled/expired accounts, starts relative validity on the first successful sign-in, and caps the session at the earlier configured deadline. Protected browser paths carry original monitor and system-check logins through migration and route isolation; system-check bearer sessions support concurrent devices and may save reports under their login name only in the assigned workspace, while admin and monitor APIs reject them. Contract, API, original-corpus, and browser gates verify classification, profile and custom-text persistence/application, mapping, password redaction, access enforcement, and the usable migration handoff |
| XML/XSD validation | file parser classes | partial | P0 | well-formed parsing and an executable original-schema compatibility profile now validate top-level XML and every XML entry in ZIP dependency bundles, rejecting wrong roots/metadata, missing identities/labels/definitions, Booklet/Unit/SysCheck `Metadata/Id` values that violate the Unicode XML `xs:ID` lexical space, unsupported login modes, case-insensitive type-local duplicate Booklet/Unit/SysCheck file IDs, duplicate group/login/testlet/unit-runtime/variable/question keys, invalid generation-specific `TimeMax` values/leave policies, completion enums, lock booleans/scopes, missing or incompatible coding-scheme targets, Unit definition/player/player-resource/VariablesRef targets, packaged SysCheck Unit targets, variable types/IDs/attributes/value structures, Testtakers monitor-profile identity/reference/enums and state presets, ordered SysCheck metadata/speed/question/custom-text config, and the Testtakers content model with stable diagnostics. Original XML with an orphaned XSI declaration now matches the source backend's missing-location fallback: it emits a warning and validates against the locally pinned 18.0 compatibility profile instead of bypassing semantic checks, across direct package, roster, and nested-ZIP intake; fully declaration-free legacy/native XML retains the existing permissive path. Booklet `TimeMax/@leave` follows the declared XSD boundary: absent in 14.x/15.0, restricted to `forbidden`/`confirm` in 15.1+, and extended with `allowed` in 17.x; the accepted historical value is retained in the runtime snapshot across memory, file, and SQLite. Booklet validation now covers the complete generation-specific root `xs:all` member set and singleton cardinalities plus ordered Metadata, CustomTexts, and BookletConfig structures; direct XML and generated nested ZIP dependencies accept schema-valid root permutations while unknown attributes, invalid or document-wide duplicate `xs:ID` keys, nested elements in simple content, and unsupported root/container children fail before policy or custom-text normalization. Unit validation follows the official 14.3/15.1/17.6 schemas for ordered Metadata and its cardinalities, deprecated `Lastchange` plus current timestamp attributes, versioned Transcript/Reference/page/alias support, 14.3 XML-ID variable keys, exact nested attributes, and text-only schema-declared Definition/reference/dependency fields while preserving the explicitly untyped value payload elements. XSD-profiled rosters reject unsupported or out-of-order direct and nested children, repeated Metadata/Description/CustomTexts/Profiles/GroupMonitor or ViewSettings singletons, empty CustomTexts and Group login lists, assignments placed after ViewSettings, unknown attributes on every supported nested element, and element children inside text-only Description/CustomText/Filter/Booklet/Profile fields instead of silently merging or ignoring them. SysCheck validation applies the same lossless boundary to Metadata and Config ordering/cardinality, known attributes, safely representable integer speed settings, XML-ID custom-text keys, and text-only speed/question/custom-text values. Adaptive Booklet state graphs additionally require one `States` container, schema-compatible non-empty state/option IDs, at least one option per state, unique state and per-state option IDs, and every `Show if/is` edge to resolve to a declared state option instead of silently hiding content. Their recursive `If` trees require one variable or aggregate source followed by `Is`, executable `of`/`from` references, at least two homogeneous `Value`, `Code`, or `Score` inputs for `Sum`/`Median`/`Mean`, at least two conditions for `Count`, numeric fallbacks/bounds where the runtime performs numeric evaluation, and every `from` value to match the exact Booklet Unit runtime key (`alias`, otherwise `id`). Matching the Original backend test and parser, an attribute-free `Is` remains schema-valid and contributes no executable comparison or package-level variable dependency, so its enclosing option normalizes exactly like the source parser rather than failing import or inventing a truth value. Adaptive `Score/@or`, `Is/@greaterThan`, and `Is/@lowerThan` values now also honor the exact XML Schema float spellings `INF`, `-INF`, and `NaN`, while rejecting the non-schema `+INF` spelling. At package scope, every executable resulting `of` edge must resolve to a Base/Derived variable declared inline by the target Unit or in its relative/manifest-backed `VariablesRef`; the same validator covers prebuilt and automatically assembled loose ZIPs. The pinned original E2E fixtures explicitly gate these branches alongside malformed Booklet/Unit/SysCheck/Testtakers roots, invalid metadata identifiers in all three identity-bearing document types, differently named duplicate Booklet IDs, duplicate groups/logins/Testlets/Unit runtime keys, invalid/dangling monitor profiles and the valid repeated-Unit-ID-with-alias counterpart. VariablesRef paths resolve relative to the Unit or through case-insensitive IMS resource identifiers, while Unit facets are selected from the declared 14.3/15.1/16+ schema generation and XML Schema boolean `1`/`0` values normalize correctly. Versioned schema references newer than the supported 18.0 major/minor boundary fail consistently for direct and packaged Booklet, Unit, SysCheck, and Testtakers XML, while 18.0 and older patch revisions plus historical unversioned references remain accepted; remaining gaps are other rare lexical/attribute facets and less-common file-graph constraints |
| Dependency graph and duplicate protection | `WorkspaceDAO`, files E2E | partial | P1 | package-level deletion readiness exposes active import/release and participant-session/test-run blockers, then atomically rechecks dependencies before removing a safe package with its unused derivatives. Unique loose Booklet/SysCheck/Unit/player/definition/variables/coding/resource chains are resolved transitively across workspace files, copied into an automatic immutable aggregate, and audited; normal uploads reject case-insensitive filename collisions, duplicate standalone type-local XML IDs, duplicate semantically identical Testtakers rosters derived from their sorted case-insensitive group/login assignments when `Metadata/Id` is absent, and duplicate Verona-player resource IDs derived from metadata or the legacy filename fallback as module ID plus major/minor version, with a pointer to the explicit immutable replacement workflow. Prebuilt ZIP imports independently enforce the same typed XML, Testtakers-roster, IMS manifest-resource, and Verona-resource identities, reject case-insensitive duplicate archive paths, and reject traversal, absolute, drive-qualified, control-character, overlong, and backslash entry paths before staging. Generated assembly manifests deduplicate case-insensitive aliases for the same selected file. The explicit assembly fallback applies the same safe relative path rule. Automatic loose dependency resolution now gives an explicitly authored normalized path or unique basename precedence over colliding legacy metadata aliases; metadata-free historical HTML players additionally expose their basename without a dotted numeric SemVer suffix, matching the original `IQBVisualUnitPlayerV2.99.2.html` convention without weakening JSON-LD identity checks. Multiple matching legacy versions and true semantic ID collisions fail with a reviewed-assembly diagnostic that names every exact candidate file and source-package ID; API coverage gates each branch. Source detail turns both lineage modes plus the latest imported structure into typed graph nodes and directed `assembled_from`, booklet, system-check, unit, player, definition, coding-scheme, and resource edges, including the resolved Systemcheck item; direct/transitive requirements and dependents are calculated, bounded Angular relationship cards link back to related stored files, and the real loose original corpus plus SQLite browser smoke gate both paths. Remaining ambiguity requires explicit operator selection rather than guessing. |
| Draft validation before activation | workspace admin | done | P1 | import jobs, persisted diagnostics, staged release readiness, roster warnings, activation guard |
| File browser/upload/download/delete | workspace admin files module | partial | P1 | source-package cards expose content-derived original file type, stored byte size, import/release counts, and deletion safety; protected routes serve uploads byte-exactly, preview exact blockers, and require the file name before a store-rechecked aggregate deletion. File type is an exact API/CSV filter, and Angular presents grouped type cards with a persisted type filter. Like the Original workspace sidebar and type panels, a server-derived full-workspace health view now distinguishes valid, pending, invalid, and warning-bearing files overall and per type without undercounting behind the current filter or limit; the list separately reports the complete filtered match count. Selected package detail adds a relationship graph with direct/transitive counts, concrete directed edges, and related-file handoff. Replacement creates and imports a new immutable package while retaining the prior version and auditing lineage. Matching the Original's unfiltered workspace file input, the lazy Angular content route accepts every resource suffix and up to 200 original loose dependencies in one best-effort operation. It reads and uploads them sequentially as byte-preserving Data URLs instead of retaining every large source payload, maps `.voud`/`.vomd` to JSON and HTML files independently of browser MIME guesses, falls back to `application/octet-stream`, reports live processed/selected progress, the exact current file, a distinct refresh phase, every accepted or rejected file, and a refresh failure separately, continues after duplicates and validation errors, and selects successful uploads for reviewed assembly as they arrive. The input remains disabled until the batch and refresh finish. API tests cover classification and every local store, while production SQLite/Chromium holds the final request and proves the intermediate 2/3 progress state before completing a duplicate plus a real `.voud` definition and byte-exact binary resource in the same selection; browser smoke also covers full health/type counts across a limited filtered window, type views/filtering, dependency rendering, multi-select, exact ZIP download, replacement, readiness, and cascade deletion. Original result data is database-backed rather than a workspace file type and is covered by the separate result-report archive workflow |

The pinned import corpus now also reconstructs the original backend's
cross-file Testtakers fixtures. ZIP validation rejects case-insensitive reuse of
a login name or group ID across distinct Testtakers entries with separate stable
diagnostics, even when the complete roster digests differ. The check applies to
one immutable package graph, so historical loose uploads and replacement
versions are not misclassified as concurrently active roster files.

### Monitoring and control

The scoped Angular Group Monitor now reproduces the Original's session-local
custom filter editor in addition to imported profile filters. Operators can
author up to 50 profile-local exclusion predicates across the original
participant, group, mode, Booklet, block, Unit, super-state, detailed test-state,
and Booklet-state targets; `equal`, `substring`, `regex`, sub-value, and inverted
matching use the same shared filter engine as imported Testtakers profiles.
Filters start active and can be toggled, edited, or removed without mutating the
stored account profile; every visibility change clears the exact batch selection.
A production-built SQLite/Chromium gate proves create, immediate exclusion,
disable, edit/reactivate, and delete against a real scoped open run.

Latest P1 monitor presentation closure: a separate adaptive-visible Unit path
retains root Units, top-level Block grouping, authored labels, current position,
and answered markers without coupling presentation to Go-to targets. The reusable
Angular record card renders a labeled full strip and collapses small density to
the current `position/count`, matching the Original's three-stage presentation
intent. The official Group-Monitoring fixture pins the complete five-Unit path;
production SQLite/Chromium pins the server-authoritative current marker.

The operator's Participant Player Preview now also exposes the persisted pause
source. A monitor-authored pause is no longer an unexplained `none` action set:
the preview states that Participant Resume is intentionally unavailable and
directs the operator to Monitor Resume, while participant-authored pauses retain
their Participant Resume action. The focused production SQLite/Chromium gate
pins `running -> monitor-paused -> running` across both the operator preview and
the live Participant route.

| Capability | Original evidence | Rewrite status | Priority | Rewrite evidence / gap |
| --- | --- | --- | --- | --- |
| Group/study overview | group monitor and study monitor modules | partial | P1 | group/booklet/unit/participant/run read models, attention queue, expected/not-started roster counts. Authenticated `study_monitor` roles can read and control the full assigned workspace, while `group_monitor` roles can only list, stream, export, and control open runs in assigned groups and open their exact group detail; both are denied general workspace-admin routes, and SSE access is revalidated for scope changes. The Angular shell now derives these access modes from the live session, hides and route-guards workspace/content/admin-management surfaces, skips admin-only participant-detail reads even during `Select + Sync`, and presents a focused scoped command console; a protected browser gate proves route redirection, group isolation, selection, and command readiness with a real `group_monitor` account. The byte-exact original `CY_Logins_GM.xml` plus `CY_Bklt_GM-1.xml` path now proves monitor-candidate migration, profile preservation, assigned-group isolation against a live outside-group run, and an exact scoped command lifecycle across memory, file, and SQLite. Imported monitor profiles, localized view/filter descriptions and selection feedback, original booklet-species projection, profile-driven filter/column/density behavior, adaptivity-aware block choices, and original `autoselectNextBlock` jump preparation are available. Open runs now also project the latest bounded original test-wide state map, advance their server-owned activity timestamp for those updates, derive the complete original monitor super-state priority including the five-minute `idle` fallback, apply `testState`/`state` profile filters to their real values, and visibly surface idle/controller-error/recovery transitions in run, group, and summary views; SQLite/Chromium covers the SSE-driven priority changes without a five-minute wall-clock wait. Their cards additionally expose the current Unit's structured presentation/response progress plus resolved Player page position, label, id and count from the already persisted Verona state, including the same fields in open-run CSV; legacy raw responses remain unprojected instead of receiving fabricated completion. Angular shows these signals as compact always-visible badges and expanded Unit rows. Their Angular cards now reproduce the original neutral paused surface, striped pending/locked and error surfaces, and deterministic Booklet-species hues whenever multiple species are visible; the production Chromium gate covers live Unit progress/page projection, pause projection, and multi-species differentiation. The scoped Runtime view adds a profile-aware summary of visible runs, unique participants, running/paused/idle/locked states, and authorized groups plus actionable group aggregation with booklet, block, timer, and latest-activity context; the real SQLite browser gate proves outside-group exclusion, group-filter handoff, localized presentation, and live pause/resume updates. The study-wide Angular dashboard already renders status distribution, prioritized unit/group/booklet attention, review readiness, explicit not-started participant cards, and matrix/runtime handoffs with browser coverage. Remaining work is exact original module presentation, additional scale validation, and less-common dashboard controls rather than a missing not-started/attention flow |
| Participant-by-unit drill-down | study monitor | done | P1 | matrix, filtered drill-downs, response/review handoff, CSV exports, and a 200-row source window kept separate from the operator-selected visible-card limit |
| Near-real-time refresh | broadcaster/group monitor | done | P1 | an authenticated workspace-scoped Server-Sent Events channel publishes versioned initial snapshots, material open-run changes, and heartbeats; the Angular Runtime view exposes connecting/live/reconnecting/polling-fallback/offline state, coalesces push-triggered reads, reconnects automatically, and retains periodic polling only when the channel is unavailable. A separate session-scoped Participant channel now publishes stable current-run revisions and makes monitor pause/resume/go-to/lock/complete transitions visible in an already-open Player without manual refresh; it coalesces state reads, stops with the Participant route, and degrades to quiet three-second refreshes while reconnecting. The Player exposes the channel as an accessible connecting/live/reconnecting/offline status without blocking work, explains automatic recovery and the independent answer-outbox protection, and clears the degraded state after a successful reconnect. Matching the Original controller, semantic channel changes persist as test-wide `CONNECTION=POLLING` or `CONNECTION=WEBSOCKET` logs through that durable outbox and drive the monitor's real super-state without a synthetic operator update. Volatile computed timer countdown seconds and loaded assets are deliberately excluded from stream revisions so they do not create repository/read-model churn. API integration gates both snapshot/change contracts; production-built SQLite/Chromium deliberately fails the first Participant stream request, proves the visible reconnect plus monitor `CONNECTION_POLLING` state, releases the retry, proves automatic live recovery plus `CONNECTION_WEBSOCKET`, then verifies pause, resume, and locked completion while the operator page remains open |
| Pause/resume/complete | monitor routes | done | P1 | The complete original command catalog is mapped semantically: `pause`, `resume`, and `goto` are direct; `terminate` maps to `complete`; and the Group Monitor's `terminate lock`/finish-everything path is an explicit atomic `complete_and_lock` command. It closes running timers and the participant session, records `completedAt`, persists the whole-test lock and both controller log states, and retains previous/next lock state in the command audit. Single- and bounded selected-run batch APIs support it. Matching the original `commandFinishEverything`, the original-labeled Angular finish control now confirms the destructive session-wide action, clears active request/profile/custom/quick filters, and submits a dedicated all-unlocked scope instead of depending on the selected run or the 100-row view. The server derives every target from the authenticated workspace/group scope without a client-supplied ID cap, leaves already locked runs untouched, and returns per-run failures; the official Group-Monitoring package proves that a scoped monitor finishes its assigned run while an outside-group run remains active. Production-built Chromium/SQLite additionally proves the exact request and filter-reset workflow. Original `debug` is deliberately excluded because source inspection shows it only toggles a non-production local debug pane. |
| Go-to block, unlock, lock | monitor routes and E2E | done | P1 | audited go-to sets runs to running, targets an exact unit, bypasses completion navigation guards, clears target code/leave locks, and reopens closed timed blocks with an operator-confirmed replacement duration in the same command; the Angular console keeps this operator-entered target separate from the participant's current unit for single and batch commands, persists it across reloads with backward-compatible hydration, presents target timer state from the read model, and browser-verifies the resulting server transition. Matching the Original's `groupForGoto`, batch go-to and timer changes now treat the selected block key as the shared intent, resolve that block's first currently visible Unit separately for every selected run, group the existing bounded requests by the resulting Unit key, and leave incompatible runs unchanged with an explicit confirmation warning. A production Chromium interception gate proves two same-species runs with different first-Unit aliases receive distinct target payloads. Original whole-test lock/unlock is independent of progress status, blocks participant writes, is visible in starter/monitor/CSV projections, honors `lock_test_on_termination`, and supports continuation after monitor unlock; the separate navigation unlock/re-lock preserves status and controls the durable bypass for code, leave-lock, and completeness guards. The official Group-Monitoring package gates go-to from Startseite to Aufgabe2 plus whole-test lock/unlock against the participant runtime. Selected timed units accept replacement rest time without moving, and every command supports bounded multi-run dispatch with per-run results |
| Profiles, filters, columns, view density | monitor profiles E2E | partial | P2 | the byte-exact original `all` and `small` `Profiles/GroupMonitor` definitions persist with the migrated scoped monitor account and drive supported exclusion/inclusion filters, pending/locked visibility, booklet-state fields, columns, density, batch-visible selection, and `autoselectNextBlock`. The Angular profile summary renders the imported pending/locked flags with their original customizable labels, while the open-run collection turns the original `full`/`medium`/`small` setting into one-column, responsive medium, and compact responsive card layouts; `small` additionally suppresses the original detail fields, and a SQLite browser gate proves the imported density reaches the rendered collection. Matching the original monitor menus, operators can temporarily toggle every imported profile filter plus the base pending/locked filters, restore their complete imported baseline atomically, and clear stale batch selection whenever that visible set changes; the effective runtime profile also feeds overview counts, group aggregation, open-run cards, and select-all without mutating the reusable profile. The same controls temporarily toggle group, booklet, block, Unit, and currently available booklet-state columns, switch full/medium/small activity density, and reset the presentation to the active imported profile. The open-run list now also starts with the Original participant-ascending order and can sort ascending or descending by current batch selection, status, every currently displayed core column, activity timestamp, and displayed booklet-state values; selection-ascending matches the Original by placing checked runs first, and stable input order resolves equal values. Protected SQLite/Chromium coverage proves active imported filters, runtime reset, locked-run exclusion, imported display baselines, overrides, reset, selection order, and multi-row sorting. The Original-style case-insensitive quick filter then composes on top of server scope and the effective profile filters before sorting, clears stale batch selection when its visible set changes, and has an explicit one-click reset; Chromium proves no-match, case-insensitive match, and restoration. The original `Alle Tests gleichzeitig steuern` mode is now an explicit transient operator toggle: it is available only for one visible Booklet species, continuously derives the complete command-safe selection from the current authorized/filter-visible run set, includes later live updates automatically, and disables conflicting manual selection controls while active. A production SQLite/Chromium gate proves activation, exact selection, manual-control suppression, and clean return to an empty manual selection. When several species are visible, each eligible run now exposes an Original-equivalent species-cohort action that atomically replaces the batch with all authorized, filter-visible runs of that species; pending, locked, and broken-booklet runs are excluded from every automatic selection path. The same production gate proves a two-run cohort remains isolated from a second visible species. Matching the Original's clickable Testlet strip, every eligible rendered block is now a keyboard-accessible jump-target action: its first activation adds the origin run, the second selects the complete compatible visible species cohort, and the third clears that cohort while retaining the run-specific block target. As in the Original, selected compatible rows render their same-species target with an orange marker and expose the state through `aria-pressed`; clearing the selection removes every marker without losing the prepared target. Pointer hover and keyboard focus now also reproduce the Original's transient cross-row marker for the same block and Booklet species, clear on leave or blur, and never bleed into another species. The production multi-species gate proves the transient pointer/keyboard preview, species isolation, all three click stages, the cohort-wide target presentation, and the target selection before exercising grouped go-to. Per-login `ViewSettings/@monitorBookletVisibility` now follows the original `visible`/`collapsed`/`hidden` contract from XML import through the migration draft, durable role/session data, manual admin editing, and the monitor Testheft-list presentation. Open runs project ordered visible block targets from the effective adaptive route; the scoped console uses them as block choices, prepares the next block only after a successful jump when enabled, and clears the choice after the final block. Booklet Species follows the original top-level-testlet count, appears in cards/CSV/direct queries, and participates in imported profile filters. Request filters persist locally, and the scoped dashboard derives its status and group totals from the same profile-filtered read model. A structured Angular editor now authors, edits, and removes reusable monitor profiles and nested exclusion filters for either a new monitor account or an existing scoped role; original `state` filters use a real Super-State multi-select, persist as bounded arrays through the guarded admin API, and exclude every selected state in the live monitor. Its saved draft library survives reloads, same-scope assignment updates the durable profile set, and SQLite browser gates cover exact saved settings, multi-state filter persistence, plus the two-click automatic-next-block lifecycle. Remaining gaps are rarer original monitor presentation details rather than inert imported settings |
| Command audit trail and bulk safety | monitor behavior | done | P1 | exact selected run ids are previewed in a labelled in-app confirmation before dispatch; operators can select all, clear, or reproduce the Original monitor's inversion of the currently visible, command-safe run set, while profile and quick-filter changes clear stale selection. Single timed go-to, bulk commands, and finish-all retain their original/customized warning copy without browser-native dialogs. The bounded bulk API deduplicates ids, returns per-run successes/failures, retains failed selections for retry, and preserves an actor/time/details activity event for every successful command |

### Results, review, admin, and operations

Current superadmin workspace parity includes protected Angular/API rename and
permanent-delete workflows. Rename trims and bounds the display name, rejects
case-insensitive duplicates inside one tenant, preserves the stable workspace
key/ID and all dependent data, refreshes directory/overview/activity read
models, and records the acting admin plus old/new names. Delete is restricted
to platform admins, requires the exact workspace key, and atomically removes
the workspace plus scoped roles, content/import/release state, participants,
results, reports, attachments, and activity while retaining a global audit
event and exact aggregate counts. The contract runs against memory, file, and
SQLite integration stores; a production-built protected SQLite browser gate
also proves reload-safe platform access, confirmed deletion, directory cleanup,
audit retention, and return to the original workspace.

The Original Superadmin's symmetric permission presentation is now reproduced
in both directions. Angular can project all visible administrators for one
workspace or every visible workspace in one tenant for a selected
administrator. Both matrices distinguish direct RO/RW assignments from
inherited tenant/platform write access and route grant, mode change, and
confirmed revocation through the same delegated, audited role boundary. A
production SQLite/Chromium gate exercises RO to RW to RO, revoke, and fresh RO
grant from the administrator-centred direction in addition to the existing
workspace-centred gate.

| Capability | Original evidence | Rewrite status | Priority | Rewrite evidence / gap |
| --- | --- | --- | --- | --- |
| Response inspection/export | workspace results | done | P1 | detailed filters, explicit session/test-run identity on response cards, run drill-down, CSV |
| Result group administration | workspace results table | done | P1 | an authenticated API and Angular card view reproduce the original group rows with started-booklet count, minimum/maximum/average distinct answered units per run, and latest test activity; response/review/log counts extend the original view. Operators can use one group as the detailed inspection scope or select multiple/all visible groups for individual CSV exports, a combined Original-compatible archive, or workspace-key-confirmed aggregate deletion. Repeated `groupKey` filters preserve the existing single-group API while providing the original selection semantics; selected exports use a separate bounded 50,000-row window instead of the 500-row inspection limit, and both single and aggregate deletion remain audited. |
| Original result report archive | `WorkspaceController::getReport`, `ResponseReportOutput.php`, `LogReportOutput.php`, `ReviewReportOutput.php` | done | P1 | the selected-group API and Angular action download one ZIP containing response, log, and enhanced-review reports in both compact JSON and UTF-8-BOM/semicolon CSV plus a versioned manifest. Response projection restores Verona `dataParts` entries and separates remaining unit state as `laststate`, preserves raw legacy responses as `all`, and resolves authored unit IDs from the run's immutable content release. Logs retain original fields and chronological order; reviews restore dynamic `category_*` values, priority, page/browser/reviewer metadata, entries, and release-resolved unit/booklet labels. Existing modern CSV endpoints remain stable. Missing selection, 100-group, and 50,000-row-per-report bounds fail explicitly; API/auth and real SQLite browser gates inspect the archive members and schemas before the selected results are deleted. |
| Review create/edit/delete/export | review routes and review E2E | done | P1 | participant-authored test/unit/task-page comments are `canReview`-gated and browser-tested; numeric page plus manual page label, original priorities `0–3`, simultaneous `tech`/`content`/`design` categories, server-captured browser identification, and authored unit IDs persist across memory/file/SQLite/Postgres storage, participant editing, operator cards, category filters, audit activity, and CSV. Alias-backed units retain their original `Unit/@id`, and both provenance values remain immutable when a review target is edited. Participant deletion uses the same accessible in-player confirmation surface as irreversible leave actions instead of a browser-native dialog |
| Group result deletion | results E2E | done | P1 | typed confirmation, counts, audit activity |
| Test logs export | `ReportType::LOG`, `LogReportOutput.php` | done | P1 | original-compatible `PLAYER=LOADING/RUNNING` lifecycle entries, test-wide `CONTROLLER=ERROR/RUNNING` failure and recovery transitions, runtime failures, and unit-scoped Verona logs persist through the durable response outbox across every store, support scoped operator filters and Angular inspection, export the original BOM/semicolon column layout, and are deleted with their group results. The production SQLite/Chromium gate observes both lifecycle states after the real Player handshake, de-duplicates a repeated active-frame controller error, observes successful controller recovery, and queries the later retired-frame runtime failure by Unit; the separate workspace activity CSV remains available as an audit export |
| System-check reports | sys-check module/routes | partial | P1 | the pinned original definition plus a real Unit/coding/player dependency chain import into one typed immutable configuration; public direct links run environment/network/questionnaire/player stages with per-check custom texts, and the SQLite browser gate starts Verona API 6, records a real item response, and retains it in the saved report. Save-key validation protects durable reports across every store, and scoped operators can list/filter/export them, inspect OS/browser/overall-rating distributions, drill into report values, and delete selected check report sets behind typed workspace confirmation with an audit event. The byte-exact starter `SysCheck-Report.json` now has a first-class admin migration route; Angular accepts up to 200 selected JSON files or a report directory in one best-effort batch, reports individual invalid/missing-check files, and makes reruns idempotent by filename plus a server-derived semantic digest. Migration accepts modern plus deprecated section names, binds each report to its imported check, and retains original filename, file modification time, source date, check label, and values in durable activity-backed storage. CSV export matches the original `Titel`/`SysCheck-Id`/`SysCheck`/`Responses`/`DatumTS`/`Datum`/`FileName` order, BOM/semicolon encoding, boolean conversion, dynamic section order, and no trailing row; JSON export emits the original report array with synthesized `fileData`. API compatibility and a multi-check SQLite browser gate cover migration resume and both downloads. Imported sys-check accounts support concurrent sessions, force the report title to the login name, resolve their assigned workspace, and activate the original instance-wide mode that replaces anonymous key saving in both UI and API |
| Platform/tenant/workspace admins | superadmin module, `user-management.cy.ts`, `workspace-management.cy.ts`, `settings.cy.ts` | done | P1 | scoped users, roles, passwords, status, sessions, audits, tenant/workspace directories, durable study/group monitor assignments with imported view profiles, password-safe operational-login-to-account creation in Angular, and persisted/enforced absolute plus first-login-relative access windows. Original workspace-admin `RW`/`RO` assignments normalize into durable `read_write`/`read_only` modes across file, SQLite, and Postgres storage: legacy assignments default safely to RW, RO may use every scoped read/export/SSE route, and mutations return a stable write-role error. Delegation now follows the target hierarchy: platform admins manage all accounts; tenant admins manage tenant/workspace/monitor/system-check roles only inside their tenant; RW workspace admins manage study/group monitor and system-check accounts only inside their workspace; RO workspace admins cannot delegate. User, role, password, status, session, CSV, and audit reads/mutations share that boundary, mixed higher-scope accounts cannot be captured by a lower admin, and failed role validation no longer leaves orphaned users. Angular limits role choices to the signed-in admin's delegation level. Matching the original workspace-centred Superadmin table, Angular now also projects every visible account against one selected workspace, distinguishes direct RO/RW from inherited tenant/platform write access, summarizes access counts, and applies direct RO/RW changes or confirmed revocation through the existing audited delegation boundary. A protected production SQLite/Chromium gate changes one workspace administrator from RO to RW and back through this matrix while verifying the durable role. Its status batch workflow keeps an exact bounded selection and preview, excludes the signed-in account, confirms the target state, dispatches best-effort per-account updates through the same server authorization boundary, and retains failed selections with concrete error codes. Disabling an account now formally revokes every active target session, leaves expired sessions unchanged, and records the exact revoked count and IDs in the user-update audit event; API coverage and the real SQLite batch-status browser gate prove token rejection plus revoked-directory visibility for two delegated accounts. The same selection can apply one exact role/scope to up to 50 accounts: identical assignments stay idempotent, each target is reauthorized, every created or updated assignment is audited by the existing server use case, successes leave the selection, and concrete failures remain for retry; a SQLite browser gate assigns the same scoped system-check role to two delegated accounts. The original superadmin password step-up now also protects every platform-admin role change: account creation, individual and batch assignment, and revocation require the acting administrator's password at the server boundary, with stable missing/invalid error codes. Angular keeps the confirmation only in transient memory, clears it after successful sensitive actions, and neither request secrets nor confirmations enter persistent shell state or audit details; API coverage and a protected Chromium/SQLite gate prove rejection, success, clearing, and audit redaction. Signed-in administrators can now also reproduce the original self-service password change from every operator shell: Angular requires current password, policy-valid double entry, and keeps all fields transient; the server re-verifies the current hash unless an administrator-set mandatory change is pending, then revokes every active session and retains the existing password-change audit without secrets. The same global navigation keeps sign-out available across admin and monitor shells, terminates the live bearer session at the server, clears its browser state, and returns protected views to operator access instead of leaving stale administration visible. Matching the original header account menu, a global account panel exposes the live username, display name, effective access mode, every role and scope, session expiry, and build identity without requiring diagnostics access. Direct protected links now resolve the live auth mode, retain an internal return URL, avoid protected probes while signed out, and resume after successful authentication; the signed-out Ops route exposes only credentials plus explicit first-deployment bootstrap rather than the administrative and diagnostic consoles. API and protected SQLite/Chromium gates prove rejection, success, sign-out, old-password invalidation, renewed sign-in, and protected-route return. Manual administrator password reset now also reproduces the original double-entry guard: Angular blocks missing or mismatched confirmation, keeps both values out of persistent shell state, clears both after success, and a protected Chromium/SQLite gate proves the old-password rejection plus the existing mandatory next-login change. The selection also supports a bounded password handoff without reusing secrets: Angular generates a distinct 24-character CSPRNG password for each account, submits every reset through the same delegation and audit boundary, removes successes while retaining concrete failures for retry, and keeps successful credentials only in memory until a CSV download clears them. A SQLite browser gate proves uniqueness, old-password rejection, new-password sign-in, exact CSV contents, and post-download cleanup. Session revocation has an independent bounded 50-target selection, exact-ID preview, current-session exclusion, confirmation, per-target reauthorization and audit trail, with successful targets removed and concrete failures retained for retry; API coverage verifies deduplication plus mixed success/self/missing results, and a SQLite browser gate revokes two live delegated sessions. Permanent user deletion now reuses the same 50-account exact selection and per-target delegation boundary, prevents self-delete, requires irreversible-action confirmation, removes every successful account with all sessions and role assignments in one store transaction, retains concrete failures for retry, and records a standalone audit snapshot with the deleted username, display/status/roles, and exact removal counts. API coverage proves authentication, self-protection, session invalidation, repeat-delete behavior, directory cleanup, and audit retention across the durable stores; a real SQLite browser gate deletes two delegated accounts and verifies their directory/session absence plus both retained audits. All Ops account, role, password, session, access-window, custom-text, and monitor-profile confirmations now share a labelled in-app alert dialog with safe initial focus, trapped keyboard navigation, Escape cancellation, focus restoration, and explicit action-specific confirmation. The protected production browser gates exercise the no-request cancel path and the representative single and batch confirmation sequence through account deletion. Original workspace lifecycle parity now covers creation, RW/RO assignment, rename, and platform-admin-only permanent deletion. Deletion requires the exact workspace key, atomically clears every workspace aggregate and scoped role, retains the global audit record, and is gated across memory/file/SQLite plus protected Chromium/SQLite. Matching the original three-tab system administration, platform admins now switch through one responsive, keyboard-visible `Admins` / `Workspaces` / `Settings` navigation shared by Ops and Workspace routes. Admin and Settings panels are mutually exclusive, the selected panel is URL-stable, and production Chromium gates the complete settings-to-workspace-to-admin round-trip. The workspace directory now also reproduces the Original table's `MAX(files.modification_ts)` signal from currently stored source-package upload times, keeps empty workspaces explicit, exports the value, and sorts interactively by name or latest file modification in either direction. The 18 upstream Superadmin E2E scenarios are now explicitly traced: all settings controls plus maintenance-warning set/clear; user action availability, creation, invalid/valid Superadmin step-up, RO/RW enforcement, password mismatch/success, and deletion; and workspace action availability, creation, user-centred RO/RW assignment, rename, and deletion. Rewrite API and production SQLite/Chromium gates cover every path, so the Original Superadmin surface is functionally closed; the additional tenant hierarchy, access windows, batch operations, session administration, CSVs, and audit evidence exceed that baseline. |
| Branding/settings/custom texts | settings module, `e2e/src/e2e/Super-Admin/settings.cy.ts` | done | P2 | imported per-login participant, Booklet, monitor, and system-check texts are durable and applied. The original instance application title, expiring global warning, resettable 20 MiB logo, `Primar`/`Sekundar`/`Erwachsene` themes, bounded start-page/legal-notice HTML, and bounded global custom-text overrides are public, platform-admin editable, validated, audited, and durable across every adapter. The eight current Original presentation slots ship with the byte-exact upstream logo, login, code-input, companion, completion, loading, and confirmation images; registered global or per-login assignments override those built-ins, while the `Sekundar` code-input illustration follows the Original theme-specific fallback. Angular applies branding to participant and operator shells, switches real CSS variables immediately, removes the global banner at expiry, presents sanitized configured HTML on participant entry and a public legal/privacy/accessibility route, and resolves participant text in the original global < Testtakers/Login < active Booklet order. System-check configuration remains more specific than global text; authenticated monitor login text likewise overrides global settings, with the complete 58-key `gm_*` defaults exposed in the editor and all 58 keys rendered across headline, commands, columns, summaries, profile view/filter text and status flags, scheduled/expired access boundaries, selection counts, tooltips and confirmed unlock feedback, target-timer state/confirmation, scroll/hide controls, and broken-booklet diagnostics. Legacy file/SQLite/Postgres migrations, API/store tests, and production SQLite browser gates cover custom branding, layered participant text, imported monitor-account text, placeholder formatting, access-window copy, sanitizer enforcement, and full reset. |
| Attachments and QR capture | `AttachmentController`, `AttachmentFiles`, attachment-manager frontend | done | P2 | Every Original BaseVariable attachment projects a typed slot per started run, including `image`, `audio`, `ggb-file`, custom, and omitted formats; only `capture-image` exposes the implemented missing/captured camera controls. Authenticated admins and scoped monitors can list the complete inventory, upload validated PNG/JPEG capture images, preview/download them inline, delete them, and use a stable copyable attachment code in Angular; files and audit events are durable across every adapter. Unsupported capture attempts and QR pages fail explicitly instead of silently treating another authored type as a photograph. The same upload endpoint accepts the original `multipart/form-data` `attachment` field and `type=image` request shape in addition to JSON/Base64. The manager downloads one selected or up to 500 role-scoped A4 capture QR pages as PDF, with the original seven configurable label placeholders and generation-time scope enforcement. The lazy mobile capture route scans the ID with a live camera or QR image, supports camera/flash selection and manual fallback, confirms the server-scoped target, crops an A4 frame or accepts a device photo, previews it, and uploads only through the existing write boundary. API tests, a production SQLite browser gate, and rendered-output QA cover the complete flow |
| Durable storage | deployment stack | done | P0 | file, SQLite, Postgres, migrations, doctor/preflight |
| CI and deployability | deployment scripts | done | P0 | the repository-root workflow is the single GitHub-executable authority for static, unit, original-compatibility, memory/file/SQLite/Postgres storage, browser, startup/shutdown, metadata-required runtime preflight, standalone Docker-image, and demo-disabled/demo-enabled Compose gates; the former nested workflow has been removed so documented release checks cannot be silently ignored by GitHub. All seven Angular feature surfaces compile into independent lazy chunks. After the Angular 21 upgrade, the frontend relies on the framework's default zoneless change detection instead of shipping the redundant Zone.js runtime. The root shell hydrates only shared browser/session state and resolves Workspace, Content, Runtime, and Ops services on demand, so no eager shared feature chunk returns: the current production build is 433.49 kB raw initial JavaScript/CSS (109.78 kB estimated transfer), down from the 563.85-kB eager-feature baseline. Dedicated Chromium gates cover the public Start route, auth-aware protected-route return, signed-out diagnostic isolation, mobile overflow, async application settings, open-auth direct entry, Participant offline reload/SSE reconnect, Content navigation, and live monitor commands. Production budgets now warn at 450 kB and fail at 470 kB, guarding both root-shell and shared-feature regressions while every complete flow remains lazy-loadable |

Angular no longer delegates destructive workspace, content, result, review,
monitor, system-check, or administrator decisions to browser-native
`confirm`/`prompt` UI. A shared labelled alert dialog supplies Escape handling,
focus containment/restoration, safe initial focus, action-specific copy, and an
embedded exact-value gate for workspace keys, group keys, and file names.
Participant review deletion reuses the Player's accessible confirmation layer.
Production Chromium coverage proves wrong-text rejection, cancellation without
an API request, focus restoration, exact-text acceptance, and representative
ordinary confirmation paths.

The platform/tenant/workspace-admin slice now also reproduces the original
next-login password handoff. Admin-created tenant/workspace accounts and
passwords reset by another administrator carry a durable change requirement
across file, SQLite, and PostgreSQL storage. Their temporary session may only
inspect itself, sign out, or set a compliant replacement password; every other
admin/business route returns a stable `403 admin_password_change_required`.
The non-dismissible Angular handoff clears the flag through the self-service
route, revokes every active account session, records a dedicated audit event,
and signs the browser out. The scoped Admin Users directory exposes each
pending handoff as both a badge and an explicit status row. API and protected
Chromium/SQLite gates cover the complete flow.

The Angular administrator directory now also exposes the existing scoped
display-name update contract. Selecting an account hydrates its stable user ID
and current display name into a dedicated transient editor; the confirmed
mutation preserves username, status, roles, and sessions, refreshes the
directory, and records the previous and next values in the admin audit trail.
A protected production Chromium/SQLite gate proves the complete handoff.

Administrative access windows now have the same post-creation lifecycle as
the other account attributes. A scoped administrator can hydrate, validate,
replace, or explicitly clear absolute start/end boundaries and the relative
first-sign-in duration from the Angular directory. The server preserves omitted
fields, audits every previous/next boundary, revokes active sessions when the
new window is already unavailable, and shortens sessions that extend past a new
effective end without extending sessions when a boundary is relaxed. API and
protected production Chromium/SQLite gates prove invalid-order rejection,
scheduled-login denial, active-session invalidation, and boundary clearing.

Login-specific administrator and monitor custom texts now have the same
post-creation lifecycle. A scoped administrator can hydrate the current map
from the directory, validate it against the server's key, entry, and byte
limits, and replace or clear it atomically from a transient JSON editor. The
update preserves every unrelated account attribute and active session; its
audit event retains only previous/next counts and changed keys, never the
authored values. API and protected production Chromium/SQLite gates prove
invalid-key rejection, normalization, refreshed sign-in copy, and audit
redaction.

The protected administrator directory and its CSV export can now isolate
accounts by their current server-evaluated access state (`available`,
`scheduled`, or `expired`) and by pending/completed password handoff. These
filters compose with username, enabled status, role, scope, and limit, use one
consistent server timestamp per directory read, reject ambiguous query values,
and persist across Angular reloads. API coverage pins all three access classes
and both handoff states; a protected production Chromium/SQLite gate proves the
combined scheduled-plus-pending review workflow.

All administrator password mutation paths now enforce the shared 8–60
character policy. The 60-character ceiling preserves the original
Testcenter's protection against excessively expensive password hashing while
retaining the rewrite's stronger eight-character minimum; API boundary tests
prove that 60 characters are accepted and 61 are rejected, and the Angular
create, reset, and required-change controls expose the same bounds.

Latest file-store deployability closure: the local durable adapter no longer
rewrites all production-sized original package data for every participant,
monitor, audit, or session mutation. Its small atomic core file now commits an
authoritative manifest while each source package and content release occupies
an independently replaced sidecar. Existing monolithic JSON state migrates on
the next write or through `db:migrate:file`; readiness rejects a missing
manifest member, guarded deletion removes stale sidecars, and backups are
documented as the core file plus its `.objects` directory. The complete
119-test File integration matrix that previously exceeded twelve minutes and
5.1 GB peak memory now passes in 54 seconds with an approximately 2.2 MB core
file, including all production-sized original Aspect and Verona resources.

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

Latest participant-group parity closure: Original `Testtakers` group labels are
no longer collapsed into technical IDs. XML `Group/@label`, current and native
JSON label fields, and delimited `groupLabel` aliases flow through roster and
password-redacted operational-login imports, file/SQLite/Postgres persistence,
Participant identity, study/group monitoring, result groups, attention items,
and roster/session/matrix/run CSV exports. Stable group keys remain unchanged
for authorization, filtering, URLs, commands, and destructive confirmation.
Contract corpus tests, API integration, SQLite restart coverage, and the local
demo Chromium gate pin the distinction.

The original Aspect 17.4 package gate now includes its byte-exact companion `testtaker1.xml`: contract and API tests pin its SHA-256, three participant modes, password policy, Custom Text propagation, and password-redacted monitor candidate. The production browser smoke imports that roster and executes the real passwordless `testuser1` account through all three Aspect Units instead of using a synthetic participant.

The original 17.6 showcase is now pinned as one complete seven-file package rather than as separate partial fixtures. Cross-store API coverage uploads the real Booklet, both Units, external HTML definition, Verona 6 player, coding scheme, and nested resource ZIP as loose files; it then proves automatic immutable dependency assembly, both player-reference spellings, deduplication of the repeated player/editor resource dependency, the repeated Unit alias, the original roster, and Participant resource delivery. The importer treats a schema-valid empty `CodingSchemeRef` with `schemer` as a schemer selection instead of a missing packaged scheme, while non-empty references retain strict resolution and version checks. The production Angular smoke executes the external-definition Unit with the original player and passwordless `test-no-pw` account, persists a real form response, fetches the nested resource, and restores the response after reload.
