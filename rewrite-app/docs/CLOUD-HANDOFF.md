# Cloud continuation: Testcenter Rewrite

## Objective and publication boundaries

Continue toward evidenced complete functional parity with the current Original
Testcenter and an optional identical Original interface. Preserve the existing
Rewrite interface. Read the repository README, `rewrite-app/README.md`,
`docs/PARITY.md`, `docs/ORIGINAL-UI-PARITY.md`, applicable instructions, status
and the last 15 commits before changing code. Paths below are relative to
`rewrite-app` unless stated otherwise.

GitHub `jurei733/testcenter-rewrite` remains the source of truth. On 2026-10-08
the owner explicitly authorized integrating every then-open PR and remaining
branch into main. PR #1 was ordinarily merged as
`2b22dbfe3d4fa54c52c6343d7b4997fe4282eb93`, preserving both parents and all
published commits. The complete inventory had only remote main and
`testcenter-rewrite-parity`; the local `work` branch was already contained.
No branch was deleted or history rewritten. Continue development on the existing
parity branch, now fast-forwarded to that merge, and open a follow-up PR.
The owner's latest integration instruction also covers the remaining open PR
and parity branch. PR #2 is currently the only open PR; main and the parity
branch are the only remote branches. Complete the new tree's required checks
before a normal merge, verify the expected head, and recheck the live inventory.
Never force-push or rewrite published history. Do not use assistant-specific
branch prefixes or names in publication prose.

Current Original target was independently verified on 2026-10-09 as
`iqb-berlin/testcenter` commit `ee2ab9ab64bd91209ef8534bbe6005838024e46d`.
Refresh that target before comparing requirements. Fetch/read upstream without
modifying unrelated working-tree changes. Distinguish local checks, published
CI, merged work, deployed work and production acceptance.

## Historical camera step at restoration

The latest camera-device correction has 497 passing core/frontend checks,
passing typecheck and production build, and passing owned immutable-production
headful Chrome image and live-camera attachment sequences. The initial bundle
is 469.98 kB, below the unchanged 470-kB error limit. Selection comes from the
actual video track, never enumeration order. Eight regressions cover missing
identity, enumeration failures and stale selection/resume metadata.

At urgent handoff, independent Chromium image/live repetitions and the complete
unmodified browser sequence on this new tree were interrupted after an owned
server reported `ENOSPC` on the nearly full laptop. They are not passing results
and require fresh validation, not inference from the previous publication.
The preceding `3ad20a7a` publication has all 72 GitHub checks green. A full owned
Chrome/SQLite repetition of that baseline passed with only passive native-input
observation. An earlier retained Demo-radio native click failure is intermittent
and its cause is unresolved. Do not claim that a successful repetition fixed it.

Re-run normal tests and current publication CI first. Keep real native inputs,
checked-state assertions, authorization, exact selected Run and byte-exact saved
response checks. No forced clicks, synthetic inputs, vendor SDK patches,
security bypasses or relaxed timeouts/assertions as substitutes for a fix.

## Prioritized remaining work

Current reference blocker: unmodified Source `ee2ab9ab` camera startup fails
in all three themes at 1280/390px, including re-entry after native reload.
Twelve negative observations show the same `nativeElement` lifecycle error,
zero video/stream and zero metadata/unknown API requests. The checked-in
`scripts/diagnose-original-camera-reference.mjs` reproduces the failure and
exits 2; it is not a passing camera gate. A working unmodified current Source
reference is required to complete normal capture/crop comparison. Do not patch
Source/vendor files or expose hidden controls to claim that comparison passes.
The Rewrite's owned image/live tests continue to pass independently. See the
exact reproduction and narrower earlier fixture failures in `PARITY.md`.

1. Confirm current publication checks and complete browser acceptance. Diagnose
   any reproduced failures from real logs before changing production code.
2. Validate the new optional Original Review side pane and complete remaining
   visual differences. Its Source toolbar/form/lists/actions, 700px geometry
   and primary/on-primary colors have 24 actual rendered comparisons across
   all three themes and both widths, plus protected native SQLite flows.
   The generic Rewrite pane remains available. The restored draft/list state
   has eight additional restoration/lifecycle regressions. Current aggregate
   checks and publication status are recorded below.
   Raw screenshots still differ; no full-page acceptance row is closed.
3. Close the eight open rows in `docs/ORIGINAL-UI-PARITY.md`, retaining both
   interfaces, authored texts, keyboard access, mobile behavior and same data.
4. Complete current Original printed-page/QR-region/camera-facing framing and
   the other partial capabilities explicitly recorded in `docs/PARITY.md`.
5. Verify production-like deployment, recovery, permissions and full acceptance
   before claiming 100%. Historical percentage estimates are not completion
   proof. Report exact completed and open requirements instead.

The physical visibility gate `smoke:ui:attachments-visibility:built` remains
unproven: independent local headful native probes also failed to establish
`document.hidden=true` when an owned OS window was minimized. The precise driver
or OS cause is unknown. Do not weaken/drop the gate or label a headless cloud
run physical-camera/window acceptance. Unit lifecycle tests are not that proof.

## Data, evidence and agent traces

### Latest selected-Run deletion correction (2026-10-09)

`4ba6bc37908e7fab485ccfe4c1cbffb347be601a` is committed and pushed on the
existing parity branch, with PR #2 updated for its final implementation.
Push workflow `37913363611` and PR workflow `37913369219` both have an actual
`local-demo` failure: jobs `113763554445` and `113763573499` time out at the
unchanged 15-second `Group Results Deleted` assertion after successful DELETE.
Full actual logs are retained outside the checkout as
`ci-4ba6-local-demo-113763554445.log` and
`ci-4ba6-local-demo-pr-113763573499.log`. The unchanged own SQLite reproduction
also fails in `goal-4ba6-local-demo.log`; this is a product regression, not an
invalid helper or a passing repetition. Main has not been changed by PR #2.

The new exact selected-Run read correctly rejects the deleted Run with 404,
but the deletion action had left that obsolete selection in place. Single and
bulk deletion now clear its Run ID, current Unit and draft only when confirmed
deleted Run/affected Session IDs and the original Workspace/Session/Run context
all match. Other selections retain their byte-exact answers. Session, Booklet
and group context remain available. The normal unknown/foreign-Run 404 boundary
and explicit older-Run reads remain unchanged; no fallback to another Run or
relaxed error classification is added.

The actual-code regression fails before the fix in
`goal-deleted-selection-before.log`. All 32 runtime checks pass afterwards,
including eleven deletion/retention/bulk cases. Typecheck, production build,
582 regular checks and 61 compatibility checks pass under the unchanged
470-kB limit (469.98 kB actual initial bundle). The complete unchanged owned
`local-demo` gate passes in `goal-deleted-selection-local-demo.log` with its
original assertion and timeout. Fresh full protected PostgreSQL and SQLite
browser suites both pass on separate owned databases and the same fixed assets,
through Attachments, exact 47/47 deletion logs and complete CLI shutdown. Their
logs are `goal-deleted-selection-full-pg.log` and
`goal-deleted-selection-full-sqlite.log`; all four scoped monitor probes in
each suite return HTTP 200 on their first trusted native activation. These
are new corrected-tree Cloud results, distinct from the previous publication.
No follow-up push may cancel the still-running `4ba6bc37` workflows. Verify
fresh corrected-head CI independently before normal integration into main.

An independent read-only Review capture probe also passed 24 protected states
on `4ba6bc37`. Before/after screenshot measurements show zero document/header
scroll and normal title/logo rectangles. Direct decoding of all 24 actual PNGs
against the settled `source-label-review-reference/` captures finds identical
header content pixels; differences occupy only its last two shadow rows. This
probe does not reproduce the earlier sporadic raster clipping. Retain those
earlier observations separately; neither geometry nor a displayed thumbnail
proves a paint defect. Actual evidence is `goal-review-header-probe.log`,
`goal-review-header-probe/` and `goal-review-header-pixels.json`. Full-page
differences and all eight acceptance rows remain open. No image, CSS, Source,
vendor or browser patch was made for this read-only comparison.

### Latest runtime lifetime validation (2026-10-09)

The owned pass-through whole-flow PostgreSQL run
`goal-starter-routes-fixed.log` failed at
`study-monitor-booklet-detail-prepare-runtime`: a late old-Session response
overwrote the newly prepared group. Its separate SQLite counterpart passed
Attachments, exact 47/47 deletion logs and shutdown in
`goal-starter-routes-fixed-sqlite.log`. Both used the pre-correction tree;
neither is relabelled as proof of the new production runtime changes.

Twenty-one actual runtime-host/read/presentation regressions fail before and
pass after the new context guard, captured paths and explicit selected-Run
query/presentation. They cover changed workspace, authorization, Session, Run
and form context, late missing-state failures and an older Run with distinct
byte-exact synthetic answers. The guard compares context in memory without
logging or persisting credentials or answers. Actual retained logs are
`goal-runtime-context-before-corrected.log` and `goal-runtime-context-after.log`.
An initial test-loader extraction error executed no valid behavioral proof
and remains separately retained as `goal-runtime-context-before.log`.

A native owned HTTP disconnect executes the production shutdown closure and
reproduces repository shutdown before its asynchronous handler finishes in
`goal-aborted-handler-before.log`. The API now drains tracked HTTP handlers
before closing storage. All three regressions pass in
`goal-aborted-handler-after.log`, including rejection and newly registered work
during draining. CLI shutdown deadlines and security boundaries are unchanged.
Independent SSE/background lifetimes are not claimed as separately proven.

The combined tree passes typecheck, production build, 571 regular checks and
61 compatibility checks. The 469.98-kB initial bundle remains under the
unchanged 470-kB limit. Actual logs use the `goal-runtime-lifetime-` prefix.
Fresh complete protected PostgreSQL and SQLite suites both pass using the same
fixed assets and separate owned databases, through Attachments, exact 47/47
deletion logs and clean CLI shutdown. Both pass the previously failing runtime
preparation; all four scoped monitor probes observe HTTP 200 on their first
trusted native activation without recorded browser errors. Memory, File and
SQLite API integration each pass all 164 checks without skips. The 120 native error-list/
restore cycles completed with 240 successful HTTP-200 actions, API exit 0 and
no recurrence of the earlier pool-after-end error. Logs are
`goal-runtime-lifetime-final-pg.log`,
`goal-runtime-lifetime-final-sqlite.log`, `goal-runtime-lifetime-native-120.log`.
Do not rebuild or clean assets while any of these fixtures still uses them.
No new commit, push, CI result, full Original-UI row or production acceptance
is inferred from these local/Cloud checks.

A fresh supplemental Starter invocation omitted the documented CI headless
profile and attempted a headed browser without an X server. It failed before
any page rendering; `goal-runtime-lifetime-starter.log` retains the actual
`Missing X server or $DISPLAY` diagnostic. This invocation error is not an
application regression or physical-browser evidence. With `CI=true`, the
completed gate passes all 48 geometry/state cases and 18 exact current Source
toast comparisons in `goal-runtime-lifetime-starter-corrected.log`. The same
fixed-asset protected Review gate passes all 24 states, native CRUD/back/retry,
same-Run reload, exact UTF-8 and foreign-Session denial in
`goal-runtime-lifetime-review.log`. These are Headless Cloud checks; all eight
complete Original-UI rows and real hardware/production acceptance remain open.

### Latest deletion-fixture validation (2026-10-09)

`07fcbf6f` is published on the existing parity branch with follow-up PR #2.
Its Push PostgreSQL job `113705893956` failed `45 !== 44` despite snapshots
being taken after preparation. Full actual evidence is retained as
`/workspace/work/testcenter-continuation/ci-07fcb-postgres-ui-113705893956.log`.
All four scope probes observe trusted native activation and HTTP 200. A later
monitor read completes between snapshot and deletion; the extra row's body is
not in the log. Do not claim its exact key is established from this CI record.

Seventeen new/existing targeted service checks pass across all four stores.
They separately prove that expiry after completed preparation adds exactly one
`TESTLETS_TIMELEFT` entry and invalidates that exact snapshot; pausing the owned
Run keeps all snapshot data unchanged across a later read beyond the deadline.
The existing active-Run deletion case is retained. The browser fixture issues
its hold through the visible native authorized Pause action after timing/monitor
acceptance, leaving the foreign retained group untouched. No production timer,
monitor schedule, assertion or timeout is changed.

The first new-helper whole run returned HTTP 200 from Pause, then failed at an
incorrect `response.testRun` lookup. The contract is `response.command.testRun`;
the same exact Session/Run/status assertions now read that wrapper. Its retained
negative log is `goal-starter-held-postgres-browser.log`, not a passing result.
The corrected complete run on a new empty owned PostgreSQL database failed
earlier at `group-monitor-booklet-error-copy-restore`, before reaching the hold.
Its retained log is `goal-starter-held-postgres-browser-corrected.log`; two
trusted native clicks reached an enabled button, but no matching request was
observed. This reproduces the earlier main failure and is not a passing result.
A focused owned PostgreSQL fixture passed twelve native error-list/restore
cycles after real creation, required password change and sign-in of a fresh
monitor. Its log is `goal-monitor-restore-diagnostic-fresh-run.log`; these
cycles do not establish the whole-flow failure's cause. A further full run
with passive browser-error reporting uses its own empty `goal_starter_restore_probe`
database and unchanged fixed assets; its log is `goal-starter-restore-probe.log`.
It passed through Attachments, the native authorized hold, exact 47/47 deletion
logs and shutdown, with the original interception removal still present.

Extended native probes reproduced an unanswered read at interception removal
after 25 and 29 cycles (`goal-monitor-restore-diagnostic-120.log` and
`goal-monitor-restore-diagnostic-route-lifecycle.log`). The public
`unrouteAll({ behavior: "wait" })` alternative also failed after 29 cycles in
`goal-monitor-restore-diagnostic-unroute-wait.log`. Tracking records the next
read between removal entry and return, after mock fulfillment. Later refreshes
wait behind it. The fixture now retains its owned interception and forwards
all post-presentation requests unchanged to the protected API until browser
teardown. This variant passed 120 native cycles in
`goal-monitor-restore-diagnostic-passthrough.log`. The earlier CI logs do not
contain callback-lifetime detail, so do not claim that their exact internal race
was observed. Assertions, native inputs and deadlines remain unchanged.

The pre-correction 120-cycle probe's API teardown also logged an aborted read
failing with `Cannot use a pool after calling end on the pool`; exit code 0
does not make that clean-shutdown evidence. The separate handler/storage
correction is recorded above, alongside the subsequent whole-flow PostgreSQL
context failure and passing SQLite run.
The unrelated first unit wrapper used
an absent `npm test` alias and executed no tests. The actual documented
`test:unit:built` and `test:compatibility:built` commands subsequently passed;
that invocation error is neither a product regression nor acceptance evidence.

Earlier dated evidence below remains valid for its exact tree. New changes
require their own publication CI; do not erase failed attempts with a repetition.

### Current continuation and integration evidence (2026-10-09)

The merged main head is `2b22dbfe`. Its tree
`ec23c8c480d34d04eb56096161a8845341ef48c4` equals the verified `d6f5c570`
parity tree exactly. The preceding PR/Push workflows each passed all 37 jobs.
Main workflow `37862248931` initially passed 36 jobs and failed PostgreSQL
browser job `113600470480` at
`group-monitor-booklet-error-copy-restore did not request the scoped monitor runs.`
This is a different observation from the earlier 45/44 deletion snapshot.
The complete actual failing log is retained outside the checkout as
`/workspace/work/testcenter-continuation/ci-main-2b22-postgres-ui-113600470480.log`.
No screenshot artifact was published by that failed job.

A complete `git archive` of exact `2b22dbfe` was independently compiled and
passed the unchanged protected PostgreSQL browser suite, including Attachments,
44/44 result-deletion logs and clean shutdown. The run used its own database,
compiler and fixed assets under `goal-main-2b22-tree`; its passing log is
`/workspace/work/testcenter-continuation/goal-main-2b22-postgres-browser-corrected.log`.
An initial invocation incorrectly pointed the frontend-root option at the
browser directory and failed before application startup; that retained attempt
is invalid acceptance evidence, not a product regression. Nothing was reset or
copied back into the implementation checkout.

One targeted retry of the failed main job completed successfully as
`113697307205` on 2026-10-09. Workflow `37862248931`, attempt 2, is now
completed/success with all 37 jobs. Neither that retry nor the passing local
baseline proves the intermittent first failure's cause or a fix. The next
browser harness adds passive native-click and request-readiness diagnostics to
the existing monitor scope helper. It retains the same native activation, two
attempts, 30-second response deadline, status assertion and exact failure.
Diagnostics contain owned scope values, never credentials or answer bodies.

Upstream `ee2ab9ab` adds one e2e fallback case and its sample setup; it changes
no application frontend source. The frontend Git tree is unchanged at
`64032f00186dc287c9de3ffd63cc235fe1c9a5da`. An eighth owned XML case covers
an initially selected Unit without a short label when only `UNIT_LABEL_SHORT`
is configured. The real facade retains the full header/toolbar label, default
index navigation and exact saved state. Fresh typecheck, production build,
526 normal checks and 61 compatibility checks pass. The bundle remains
469.98 kB under the unchanged 470-kB limit. All 32 native label cases in both
interfaces at 1280/390px pass in the complete new protected PostgreSQL browser
run, through Attachments, exact 44/44 deletion snapshots and clean shutdown.
All four instrumented monitor phases observed trusted native activation and
HTTP 200 on the first attempt; the restore phase retained the intended owned
workspace and `all` profile. Its actual log is
`/workspace/work/testcenter-continuation/goal-ee2-postgres-browser.log`.
This passing instrumented run does not explain the earlier intermittent failure.

Fresh current Source Review references and the protected owned SQLite Rewrite
comparison also pass all 24 form/filled/list/edit states across the three themes
and 1280/390px. Each list/edit capture first verifies the intended exact comment.
The same labels/comment, completed fonts and settled drawers are required.
Toolbar, form, list, buttons, primary/on-primary colors and header geometry match;
native add/edit/save/delete/back, failed-save retry, exact UTF-8 persistence and
foreign Session rejection remain checked. Actual screenshots under
`goal-source-ee2-review` and `goal-ee2-review` still show raster differences,
including header clipping despite equal measured rectangles. These component
checks do not establish full pixel identity or close a complete Original-UI row.
New work is locally/Cloud verified at this checkpoint; publication and fresh CI
for its forthcoming commit must be checked separately.

The clean current Source checkout was independently rebuilt. Its unmodified
camera diagnostic reproduces the same twelve initial/re-entry failures in all
three themes and both widths: `nativeElement` is unavailable, no video stream
starts, and no attachment metadata or unknown API request occurs. The diagnostic
exits 2, writes actual negative evidence under `goal-source-ee2-camera`, and is
not a passing capture gate. All eight full-page Original-UI rows, physical
camera/OS visibility, deployment and production acceptance remain open.

The private published environment and GitHub access remain available. This new
turn initially restored restricted sockets; the already authorized regular
product network grant was requested and granted for this turn only, with no
additional filesystem rights. Owned IPv4 listen/connect and child-process pipes
then passed. A fresh protected owned SQLite API passed readiness/configuration,
unauthenticated workspace rejection (401) and clean shutdown. VM package-manager
rules and exactly the three previously approved browser-download domains remain
unchanged; a runtime grant does not persist permissions into future turns.

Real Entire Cloud trace capture remains unavailable. The CLI/runtime is absent;
no new checkpoint or fabricated trailer is created. The historic remote
`refs/entire/checkpoints/60/01M4D17VRMWJ3E43Z32G5RBA60` remains
`fbd52e6fc67a5b9285bc1a5de1c488bf512fec38`. An old local trace is not a Cloud
trace. Private tryout data and the local migration PPTX are neither inspected,
changed nor uploaded in this continuation.

The dated sections below retain earlier evidence and failures. Their pending CI
or publication statements describe those earlier checkpoints, not current main.

### Historical integration gate (2026-10-08)

Seven further commits are published through `e9885ae5`, not merely local.
Its complete isolated Git archive passed typecheck, production build, all 522
core/frontend and 61 compatibility checks, and the full unchanged protected
SQLite browser suite, including Attachments, result deletion and clean shutdown.
Its Push workflow `37848841718` subsequently completed successfully with all
37 jobs verified, including the full PostgreSQL browser gate. The separate PR
failure below remains a real negative observation, not erased by that pass.
The current read-only public GitHub resource tool also supports workflow-run
GETs and `jobs?per_page=100`, so both complete 37-job listings can be checked;
the older first-page-only limitation below is historical. No VM domain or
filesystem permission was expanded.

PR workflow `37848848880` has a retained failing PostgreSQL browser job
`113556452054`: `assertGroupDeletionMatchesSnapshot` compares 45 removed logs
with a pre-preparation inventory of 44. The complete actual log is retained
outside the checkout. It shows monitor reads finishing after the snapshot;
it does not include the extra log row's body. A deterministic service regression
on Memory, File, SQLite and PostgreSQL proves that a real monitor read can start
a timed block and append `TESTLETS_TIMELEFT`, making that earlier snapshot stale
without a participant answer write. The corrected smoke captures both groups
after native preparation/exports and the existing not-busy condition. Every
exact deletion count, Run ID, retained answer/review/log comparison and separate
removal check remains mandatory; no timeout or assertion is relaxed.

The correction has passing typecheck/build, 525 normal checks, 61 compatibility
checks, nine targeted snapshot checks including PostgreSQL, and twelve existing
presence/deletion boundary checks across all four stores. Its full protected
PostgreSQL browser run also passed on separate fixed assets and a new owned
database, through Attachments, native result deletion and clean shutdown. That
run's initial and deletion snapshots both contained 44 logs: it is a passing
corrected whole flow, not a replay that proves the CI's extra log was a timer
log. The deterministic regressions prove the stale-snapshot class separately.
Fresh publication CI is still pending for the correction.
The initial bundle remains 469.98 kB under the unchanged 470 kB error limit.
The Source camera blocker and all eight complete Original-UI rows remain open.
Entire runtime capture remains unavailable; do not invent a checkpoint trailer
for the correction or the later merge, or reuse an old local session trace.

The private Cloud environment is published and repository access is verified.
Restoration started on `testcenter-rewrite-parity` at `5b3b44a2`; activation
of `/workspace/.setup-tools/activate.sh` provides Node 22.23.3 and the prepared
Playwright Chromium. The GitHub connector and Git push dry-run work. The former
`environment_repo_access_failed` report is historical, not a current blocker.

This Cloud turn received the regular product network permission, without added
filesystem rights. It is a per-turn grant, not a persisted full-access setting.
The enforced VM domain policy still permits package managers and exactly
`cdn.playwright.dev`, `playwright.download.prss.microsoft.com`, and
`storage.googleapis.com`. Future turns must verify their effective runtime
permissions separately. The initial restricted shell reported
`PermissionError: [Errno 1] Operation not permitted` for IPv4 socket creation;
the authorized profile subsequently passed IPv4, owned loopback listen/connect,
child-process pipes, and protected owned SQLite startup/preflight/shutdown.

Fresh Cloud checks passed the normal 497 core/frontend and 61 compatibility
tests. The protected owned SQLite browser sequence used native text input and
proved the same Session/Run and byte-exact response after API restart. The full
unmodified browser suite also passed from a complete `git archive` of exact
`5b3b44a2c411e80e8842f833b45d80480cbcfcb3`, with its own compiler, assets,
SQLite file, port and artifact paths. This is baseline evidence; new Review
changes need their own acceptance. The earlier mutable-build race is invalid
evidence. An additional assets-only baseline attempt failed at result-group
deletion's log count (`45 !== 44`); its retained negative log is separate from
the passing complete-tree attempt and does not establish a resolved race.
The final Review build subsequently passed the complete protected SQLite browser
suite on its own fixed assets, plus a fresh synthetic live-camera attachment
gate. The new pane's save-on-reopen defect was fixed and a new immediate Edit
read was changed to await the same exact NgModel value, preserving its assertion
and default timeout. The retained negative logs are not passing results.
The Review implementation was committed and pushed as `bdbc5b47` on the existing
parity branch. Its publication CI is still in progress and is separate from the
passing Cloud gates. A subsequent fixed-assets native comparison passes all 24
Review states, including every form-label font/color against the current rendered
Original; the initial production bundle remains 469.98 kB under the 470 kB gate.
Further completed publications `38f28cb9` and `8bc69303` correct label/theme and
action-button presentation. A fresh native deletion-focus gate then reproduced
the absent generic close-button fallback in the Original Review pane. The fix
targets its visible close action; the complete protected 24-state comparison,
six theme/viewport focus/Tab cases, typecheck/build and normal 505 tests pass
on separate fixed assets. Their predecessor workflow attempts were cancelled by
subsequent pushes; the final Review head's fresh acceptance is recorded below.
Do not infer publication status from Cloud passes or the old 72-check baseline.
The published Review head `a89d64c7` subsequently passed the full unchanged
protected SQLite browser suite from a complete isolated Git archive of
`a89d64c7dddea7147d1e73fcca376c025f60736b`, including attachments and clean
shutdown. Its separate compiler, assets, database and port were used throughout.
An initial attempt incorrectly enabled demo bootstrap and failed 409/401 during
the suite's own admin bootstrap; that retained negative attempt is not a pass.
The corrected invocation used a new empty owned database and no demo bootstrap.
PR workflow `37753348696` is freshly completed/success. All 30 visible jobs in
Push workflow `37753342686` have completed successfully. The first-page connector
exposes only 30 of its 37 jobs and has no Push-run summary or pagination method;
the remaining seven and aggregate Push result are still unverified. Do not infer
complete Push acceptance from this partial job listing.
New work remains unpublished until this head's required CI boundary is complete.

The next local commit `b835bc78` adds the optional Source-sized printed QR region
through existing protected single/batch PDF routes while retaining Rewrite's
default layout. Its complete isolated Git-archive production build, normal 507
tests, 61 compatibility checks and full protected SQLite browser suite pass.
The full run includes both interface projections through native download
buttons, attachment upload/preview/delete, result deletion and clean shutdown.
Owned actual PDF images also pass image and generated-video decoding through
the production scanner/unchanged worker. Independent unmodified Source PHP 8.3
and pinned TCPDF 6.10.0 rendering now verifies actual QR bounds for default and
long labels. Rendering runs in a container without network access, with a
read-only root/source/dependencies and only its owned evidence output writable;
dependency retrieval used the existing enforced package-manager preset. No VM
domain, filesystem policy, VPN or TLS rule changed. Source camera-page startup
still fails with its recorded `nativeElement` error; complete PDF typography,
Original UI rows and physical visibility remain open. See `PARITY.md` for scope
and retained negative helper attempts. This local commit has not been pushed;
do not label it CI-green or deployed.

A further local PDF step matches the actual Source's regular Helvetica 12,
black label text and creator, and omits additional Rewrite captions/footer in
Original mode. Four default Rewrite content-stream comparisons against the
isolated `b835bc78` renderer are byte-identical. Fresh typecheck/build (469.98 kB),
508 normal tests, scoped Attachment API checks on Memory/File/SQLite, protected
native SQLite Attachment UI downloads/capture and owned PDF image/live-camera
decoding pass. Regular network permission was granted for this continuation
turn, with the same enforced VM domain rules and filesystem scope. Label
placement/wrapping/substitutions, PDF bookmarks and full identity remain open.
This is an additional local commit, not pushed CI or production acceptance.

The subsequent local PDF step adopts the Source label baseline, cell width,
unkerned text measurement and wrapping, including authored spaces/empty lines,
empty labels and 50-line page overflow with QR on the final page. Nine independently
measured actual TCPDF cases are preserved as owned regression fixtures. The former
below-QR assertion was a temporary adaptation, contradicted by actual Source
output; exact text/position/page/QR assertions now replace it. Short and long
Source PDFs still decode; short and long Rewrite/Original PDFs pass native image
and generated-video decoding, Stop and worker release. Four default Rewrite
content streams remain unchanged. Typecheck/build (469.98 kB), 517 normal tests,
61 compatibility checks and the existing scoped API sequence on all three local
stores pass, including fresh compiled empty/multiline single/batch API cases
with exact titles/page counts and retained private/no-store responses.
The full unchanged protected SQLite browser suite passes on fixed production
assets, including four native PDF downloads, attachment upload/preview/delete,
result deletion and clean SIGTERM shutdown. Fresh actual Source and protected
Review runs pass all 24 three-theme/1280/390px states, including exact UTF-8,
Run/Session isolation, retry and deletion-focus/Tab gates. This turn's
regular network permission was freshly granted and socket/loopback/child-pipe
probes passed; VM domains and filesystem rights remain unchanged. Real Entire
Cloud capture/CLI/export support is still unavailable; no checkpoint is invented.
The preceding head's full Push-CI verification is still required before publishing.
Complete Original-UI, physical visibility, deployment and production acceptance
remain separate open gates.

The next local PDF step adds actual Source-style bookmark navigation, with one
ordered bold blue title per authorized attachment and an internal XYZ target on
its first page, including overflow pages. Four decoded real Source references
are retained independently from the implementation. Fresh typecheck/build
(469.98 kB), 522 normal tests, 61 compatibility checks, scoped Attachment API
checks on Memory/File/SQLite and the protected native SQLite Attachment slice
pass. The slice retains all four downloads, actual saved bytes, upload/preview/
delete, five worker closures and clean shutdown. Twelve actual page-content
comparisons against the exact `2c7d0516` source tree are byte-identical in both
layouts; Rewrite's default viewer mode is retained. The preceding full-browser
and 24-state Review proofs belong to the label step, not a new complete run of
this bookmark step. Retained negative type/import helper logs and their exact
corrections are described in `PARITY.md`. No authorization/TLS/input/gate policy
was relaxed. Source label substitutions, QR drawing and extended cases remain
open, alongside all full UI, physical and production gates. These local commits
remain unpublished under the current Push-CI boundary; Entire Cloud trace
capture remains unsupported and no new checkpoint is fabricated.

Latest local development commits are `2c7d0516` (Source label placement/wrapping)
and `d6304a59` (Source bookmarks). Working tree is preserved; the remote parity
head remains `a89d64c7`. Fresh PR aggregate status is successful and all 30
exposed Push jobs succeed, while the seven missing jobs/Push aggregate remain
unverified. The final camera diagnostic records twelve Source failures on
strict owned fixtures; none is a normal capture pass. The minimum missing
reference is a functioning unmodified current Original camera page, not an
extra browser-download domain, socket grant or general repository-access fix.

Use fresh owned synthetic SQLite/PostgreSQL fixtures and repository scripts.
The local private tryout database and untracked
`docs/testcenter-thread-migration-process.pptx` remain untouched and unuploaded;
the user independently rechecked their unchanged hashes. They are not
prerequisites or available cloud fixtures. Avoid copying unrelated
local services or claiming they remain available after the laptop is closed.

Record fresh Entire checkpoints for real commits when the cloud runtime supports
its actual session trace. Verify the checkpoint trailer and remote checkpoint
ref. Never fabricate traces or attach an old local session as cloud evidence.
If cloud capture is unsupported, report the limitation without obscuring the
GitHub code history. Keep acceptance evidence and negative results honest;
never commit credentials, private response data or unrelated user artifacts.

Actual Entire Cloud capture is currently unavailable: the runtime has no runnable
Entire CLI, active trace-capture hooks or exposed Cloud session-trace exporter.
Repository hook configuration is present but does not establish active capture. Existing
settings and historical checkpoint refs do not constitute a new trace. New
commits therefore must not receive invented checkpoint trailers or reuse old
local sessions; GitHub code history remains authoritative. Physical camera and
OS-window visibility acceptance, deployment and production acceptance remain
separate from these headless Cloud checks.
The historical `5b3b44a2` trailer was verified against remote
`refs/entire/checkpoints/60/01M4D17VRMWJ3E43Z32G5RBA60`
(`fbd52e6fc67a5b9285bc1a5de1c488bf512fec38`). It is baseline metadata,
not a Cloud trace for the new Review work.
