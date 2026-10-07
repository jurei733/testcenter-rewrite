# Testcenter parity checklist

### Non-saving Run-bound re-entry reset (2026-10-07)

Publication `09942c4c` passes its native PostgreSQL job with 219 tests, including
the actual multi-Booklet/execution-mode API cases, but is not globally green.
All fifteen failed UI jobs in its completed push run fail at the shared Simulation reload assertion
(`smoke-ui.mjs:10706`), before reaching their named Review/Monitor checks:
`currentUnitKey` remains active instead of returning to its code gate.
The new automatic Run-bound address reaches the existing read-only entry path,
which preserved every existing Run without invoking the non-saving entry reset.
An immutable production/owned SQLite browser reproduces that exact failure.

Actual entry now reads the authorized selected Run first, then invokes the
existing resume/reset use case only for an unfinished, unlocked non-saving Run
not paused by the monitor. The refresh's server-authorized assignment selects
the reset; stale browser/URL Booklet values do not choose a sibling. Saving
Runs, completed Runs, locks and monitor pauses remain read-only. Current-state
reads, asset preload and ordinary polling themselves still never perform this
reset. No persistence, timer, authorization or simulation assertion is weakened.

Fifteen actual-entry-method regressions cover all three non-saving modes with
Run-bound and legacy links, saving/terminal/monitor states, stale view completion,
missing Runs and denied explicit IDs. Six cases fail before the application fix;
all fifteen pass after it, together with all 330 unit/frontend tests, typecheck
and the unchanged 469.82kB production build. Owned protected SQLite/headful Chrome
passes real login, code unlock, transient answer and normal hard reload for
Demo/Review/Simulation in both interfaces, retaining the exact Run ID while
clearing the transient answer, unlocks and timer. The real A/B saving workflow
also remains green in both interfaces. These six entry paths are now part of
the existing mandatory quick-CI variant browser gate.

The unchanged longer shared browser flow also passes through the failed
Simulation assertion, custom/merged leave confirmation, Original Verona surface
and multi-Unit offline/background-sync outbox removal on owned protected SQLite
and the immutable production build. Its local run explicitly excludes offline
app-shell startup and stops at `participant-original-verona-player`; it is not a
complete UI/Review/Monitor CI or a production deployment. Fresh complete
publication CI, all eight full Original-UI comparisons and broader production
acceptance remain open. Evidence is retained under ignored
`.data/nonsaving-entry-20261007.*`.

### Exact unfinished-Booklet launch and resume (2026-10-07)

The controller now resolves and authorizes the requested assignment before
selecting an existing Run. A different unfinished Booklet or preset variant no
longer causes the session-wide HTTP 409. Both new and existing `resumeSession`
entries use this same resolution; existing Run mutations re-read the selected
Run under its mutation queue. Completed and locked assignments remain denied,
and monitor-paused Runs are returned paused before any non-saving reset.

New Runs include their initial timer in the atomic reservation candidate. Losing
starts never persist a fresh candidate over the winner or log another initial
controller/timer event. Starting another assignment does not implicitly pause,
complete or cancel its sibling; the actual Starter return retains its existing
leave/time/completeness and termination-lock behavior. Completion keeps a session
open for other unfinished assignments, including locked ones, without presenting
a locked-only remainder as resumable. Successful participant launch/resume also
updates the browser address to the selected Run and exact assignment, so a hard
reload cannot return to the previously selected Booklet.

The actual HTTP suites reproduce two 409 failures before the change, then pass
second unfinished launches, preset isolation, exact Unicode answers, twelve
simultaneous starts with one controller/timer log, independent same-named timed
blocks, preserved cancelled timers, unauthorized assignments, monitor pause/lock,
locked-only remainder and completed-assignment denial. All 163 API tests pass
in each of Memory, File and SQLite, together with all 315 unit/frontend tests,
typecheck and the unchanged 469.82kB production build.

The mandatory variant browser gate no longer seeds a second Run in storage. Real
protected SQLite/headful Chrome passes in both interfaces: A answer/guarded
Starter return, B launch/answer, exact A/B resume and hard reload, run-bound URLs,
scoped live acknowledgements, other-Run background saves, monitor pause/resume,
and completing B without closing or replacing A. Traces/screenshots use owned
fixtures only. Evidence is ignored under `.data/multi-booklet-workflow-20261007.*`.

Native PostgreSQL acceptance of this controller change and complete publication
CI remain pending, as do the broader policy/production corpus and all eight full
Original-UI rows. The foundation publication `3030296d` separately passed its
native PostgreSQL job with 219 tests (including its new reservation checks), but
its `ui-ops` job failed the pending-confirmation secret-input assertion at
`smoke-deletion-confirmation.mjs:154`. That failure and the previous outbox timeout
remain independent, unweakened CI issues. This is not a 100% or merge-ready claim.

### Atomic participant-assignment reservation foundation (2026-10-07)

The repository contract now reserves or reuses a Run for the exact participant
session, release and Booklet assignment atomically. It retains existing answer
bytes, status, locks and timers, including completed and monitor-paused Runs;
lifecycle authorization remains the application controller's responsibility.
Memory makes the decision without yielding, File uses its existing single-writer
mutation queue, SQLite uses an immediate transaction, and PostgreSQL locks the
parent session through the same transaction client. Insert-only writes prevent
a conflicting Run ID from overwriting another session or assignment.

Thirty actual Memory/File/SQLite reservation checks pass, including simultaneous
candidates, separate preset variants, durable reopen, invalid-scope rollback,
cross-session ID collisions and four independent SQLite workers. All 315 unit/
frontend checks, typecheck and the full 163-test API integration suite in each
of Memory, File and SQLite pass. Native PostgreSQL reservation checks are wired
into its CI runner; they have not been run locally. File continues to have a
single-writer contract, not a new cross-process locking guarantee.

At foundation publication `3030296d`, `launch` and `resumeSession` still rejected
a different unfinished assignment. The subsequent controller and browser work
above integrates that prerequisite; the foundation itself was not evidence of
a complete multi-Booklet feature. Its native PostgreSQL CI job now passes,
including reservation checks, without proving the subsequent controller change.

The published `03e660ae` full protected SQLite production browser flow also
finished successfully. Its push CI separately caught an outbox-removal timeout
at `smoke-ui.mjs:11508` in `participant-multi-unit-background-sync`, despite the
server already receiving the answers. The root cause is not established, and
the assertion has not been weakened. Neither this local reservation foundation
nor a passing full browser job makes that publication globally CI-green.

### Workspace and Content operator re-entry links (2026-10-07)

The third immutable protected SQLite flow passes the generated-entry and Runtime
session-link assertions, then fails the exact Study Monitor Group Detail link at
`smoke-ui.mjs:24344`. This is a confirmed application omission, not another obsolete
expected URL: Workspace cards know the represented Run but omit its ID from the
Participant link. The same omission exists on Content activation blockers and
release Run cards. Group session cards also prefer the first roster Booklet over
the represented latest Run, which can point at the wrong assignment variant.

All eight Workspace link projections and both Run-specific Content projections
now include the Run actually represented by their card. Complete Run records use
their exact preset assignment; participant Unit rows resolve it from their own
Run ID. Group session cards prefer that latest Run's assignment/Booklet before
the roster fallback. Historical activity links use a Run subject's ID, or an
explicit Run ID in another event's details, never a chronological Run inferred
from the current session. Session-only cards and sessions without a Run retain
their legitimate fallback. No API authorization, answer, status or launch guard
is changed.

Thirteen regressions execute the actual facade getters/helpers, including two
preset variants in one session, historical subject/detail disagreement, missing
Run/session data, fallback links and credential exclusion. Ten fail before the
application change; all thirteen pass afterward. All 165 core, 12 presence and
108 frontend tests, typecheck and the 469.82kB production build pass. The initial
450kB warning remains below the unchanged 470kB hard budget.

An owned protected SQLite/headful Chrome check passes in both interfaces: real
operator/participant login and generated entry, exact Group/Participant/Booklet/
Unit detail links, actual link opening, exact answer restoration after hard
reload, and Content release Run links. Both participants' opaque answers and
running status stay unchanged. The first focused attempt reached successful
monitor re-entry/reload, but did not explicitly load the Content release detail;
that test-only setup omission is retained separately. The corrected attempt uses
the actual `Select + Load` action. Evidence is ignored under
`.data/operator-run-links-20261007.*`.

The complete protected SQLite flow finished successfully against an immutable
copy of this production build, with the offline App-Shell axis explicitly
excluded. Fresh complete remote CI, the Memory/headful ItemBuilder failure, the
multi-Booklet P0 and complete Original-UI acceptance remain separate open gates;
these checks do not prove 100% parity or merge readiness.

### Generated entry and selected-run re-entry acceptance (2026-10-07)

The `a88f166f` publication passes the selected-Run monitor reconnect gate, but
its completed push CI has 21 successful and fourteen failed jobs. All fourteen
fail at the same operator session-card assertion
(`smoke-ui.mjs:21293`), including PostgreSQL UI. That assertion still expects
the obsolete session-only URL, whereas the application now correctly includes
the exact Run ID. The expected operator link now takes its Run ID from the
authenticated filtered session response; every later detail/monitor assertion
keeps the same exact URL, rather than dropping Run selection from production.

An immutable local full-browser run also exposed a race in the generated-entry
popup check: successful login removes the transient input fields. The browser
gate now captures the actual launch request for the exact tenant, workspace,
login, group and Booklet, requires its successful authenticated identity and
Run, and matches those exact IDs against the rendered running test and its
complete re-entry URL. No application behavior, authorization, response bytes,
deadline or monitor guard is changed.

A separate owned protected SQLite/headful browser comparison, in both
interfaces, confirms that the published application already launches a new
login despite preselected fields plus a cached older session/Run. The previous
answer stays byte-exact and the older Run stays running; the hypothesized app
selection fix was therefore discarded, not presented as a demonstrated bug.
Exact preset assignment/resumption, hard reload, live scope acknowledgement,
monitor pause/resume and background-answer isolation also pass in both
interfaces. All 165 core, 12 presence and 95 frontend tests pass. The first
immutable protected SQLite flow then fails an immediate Player geometry read;
its retained failure screenshot already shows the full-height Original layout.
That gate now waits for the same height/top-position invariant, with its
existing 15-second settling deadline, before sampling and asserting it. The
complete SQLite flow was repeated; its later Group Detail failure is tracked
above. The separate immutable Memory/headful
Chrome flow fails the ItemBuilder runtime-download wait at `smoke-ui.mjs:16979`
with a blank Player frame, despite the displayed correct IB participant/Run.
The same failure occurred earlier; it is not explained away by the previously
overlapping build or by successful isolated IB runs. The adapter/browser cause
and full-sequence acceptance remain open. Fresh publication CI and full
Original-UI acceptance remain independent proof.
The second full SQLite run passes the unchanged Player geometry invariant and
reaches the generated popup, then fails a newly added test-only assumption that
`ParticipantSession` exposes scope keys. Its actual contract exposes internal
IDs; the gate now checks those IDs against the authenticated Workspace overview.
That failed attempt is retained and is not application-regression evidence.
A focused protected SQLite/headful check then passes the actual operator
handoff in both interfaces: load the saved roster, generate its links, use the
new login's link, open its real popup, compare the authenticated scope/Run and
refresh the operator session card. Both surfaces expose the same exact
Run-bound re-entry URL and retain the older Run's exact answer and status.
Evidence is retained in ignored `.data/entry-link-scope-20261007.*`.

### Run-bound browser fault boundaries (2026-10-07)

Publication `5e42a17d` finished with 19 successful and 16 failed push-CI jobs
(`37278503078`). All failures occur at two shared harness boundaries: fifteen
jobs time out before the Verona resource because the held LAZY preload matcher
requires the obsolete URL without `testRunId`; the monitor-live job does not abort
the actual selected-Run stream and never observes the requested reconnect.
These failures are not a globally green publication or proven deployment.

The harness now parses query parameters without depending on their order and
requires an owned origin, the participant endpoint and one nonempty Run ID.
Reconnect interception additionally binds the exact session and Run. The held
LAZY request is checked against the actually rendered session/Run before it is
released; the real response must return that same scope. Unit regressions reject
foreign origins/sessions/runs, ordinary state reads, missing/duplicate parameters
and acknowledgement routes. No application algorithm, response, retry deadline,
LAZY loading assertion or authorization guard is changed. The published monitor
test reproduces its CI timeout locally; the corrected real-browser monitor and
shared flow through `participant-verona-loading` pass. The monitor and exact
variant/run-selection browser checks also pass in headless CI mode. All 165 core,
12 presence and 95 frontend tests, typecheck and a 469.82kB production build pass.
The first larger local run subsequently times out waiting for the IB runtime;
that run and another navigation timeout overlap a frontend rebuild. They are
retained as failures, not a clean full-build acceptance or an asserted cause.
The complete flow is being repeated against an immutable frontend; publication
CI and PostgreSQL remain independent gates until they finish.

### Run-bound state, assets, links and live updates

Original `TestController::get` addresses the selected test by its explicit ID;
the Rewrite's current-state endpoint previously ignored a requested Run ID and
returned the run with the latest `updatedAt`. Current-state and SSE now accept
an optional `testRunId`, validate ownership against the authenticated session,
tenant and workspace, and read that exact run. Unknown/foreign IDs return the
same HTTP 404; an explicit empty ID fails rather than falling back. Reading a
completed or monitor-paused run does not resume/reset it. A completed selected
run cannot open a live stream for an unrelated running run.

Participant state and asset-preload requests bind the selected ID. Live clients
reconnect when the selected Run changes, reject another run's frames before
acknowledging them, and ignore late headers from a replaced generation.
Participant/monitor/detail re-entry links now carry the exact Run ID; participant
links also preserve the preset assignment key. The URL, not another tab's
persisted runtime, owns explicit re-entry selection. Historical session-only
links and unselected API readers retain their chronological fallback. No schema,
saved answer, lifecycle guard or participant credential was changed.

The API regression fails before the change with the wrong Run ID; the preceding
frontend fails the new real-link assertion. All 163 API tests pass in each of
memory, File and SQLite, plus 165 core, 12 presence and 91 frontend tests. Real
protected SQLite/browser flows pass in both interfaces with frozen production
and development frontends, including actual generated links, hard reload,
scoped live acknowledgement, monitor pause/resume and independent background
answer saves. Production also passes headlessly. Its mandatory variant smoke
seeds the second open Run through the owned repository: this proves selection
isolation, not the still-blocked second starter launch. The preceding shared
browser flow through completed session re-entry/clear and all 48 production
starter states also pass. Production is 469.82kB under the unchanged 470kB limit.
Evidence is retained in ignored `.data/run-selection-20261005.*`; PostgreSQL and
complete publication CI remain independent proof.

### Exact preset-variant re-entry

Returning a preset Booklet variant to the starter and selecting that same
assignment previously failed with HTTP 409: `resumeSession` compared its
assignment key only with the source Booklet key. It now also recognizes the
existing run's exact `bookletAssignmentKey`, consistently with `launch`.
Resumption preserves the run ID, preset/adaptive states and exact opaque answer
bytes. Other assignments are not aliased onto that run; the broader
multi-Booklet conflict below remains open. No lifecycle, authorization,
monitor-pause, lock, timer or non-saving-mode guards were removed.

The regression failed before the change and passes afterwards. All 163 API
tests pass independently in memory, File and SQLite with the suite's correct
non-demo bootstrap configuration. Real protected SQLite/browser flows pass in
both Rewrite and Original with production and development frontends, and in
headless production CI mode: participant login, draft entry, confirmed return
to starter, exact-assignment resumption and authenticated session-link re-entry
after a hard reload. The workspace-only login URL is not a session re-entry
link. `smoke:ui:participant-variant:built` is mandatory in quick browser CI.
Evidence is retained in ignored `.data/variant-reentry-20261005.*`.
PostgreSQL and publication CI remain separate verification boundaries.

### Source-rendered participant starter verification

The optional Original starter now follows the pinned 19.0 viewport scrolling,
intrinsic 684px intro/card width, typography, margins, Material controls and
completed/Review appearance. Its scroll action advances the actual container
by 300px, including keyboard activation; the account control remains correctly
centered below/at/above the 600px breakpoint and does not inherit Native hover
movement. Source narrow-screen clipping is retained only in the optional
Original interface; Rewrite remains available independently.

All 48 equal-fixture Source comparisons passed in each final production and
development build (three themes, four viewports, fresh/mixed/long/Review states).
The reference is the unmodified `c35cff81` frontend with a bounded API fixture,
not its backend; every Rewrite fixture uses an owned protected API/SQLite.
Text, geometry and measured styles match. Raw pixels are identical in 33/48
production and 29/48 development pairs; remaining differences reach 7,733 pixels
and 67/255 channel units. Full pixel identity and a complete UI row stay open.

The new mandatory quick-CI starter gate passes all 48 configurations in both
builds and tests actual participant login, keyboard scrolling, account hover,
pending duplicate rejection, exact saved answers and participant-authenticated
empty Review CSV export. The existing login regression plus all 165 core,
12 presence and 83 frontend/preflight tests passed. That layout build was 469.61kB
under the unchanged 470kB limit. Evidence is retained in ignored
`.data/original-starter-reference-20261005.*`; publication CI remains independent.
The functional multi-Booklet gap below was found by this verification and is
not covered by the mixed-state rendering seed order.

### Reproduced multi-Booklet starter gap (P0; implemented, CI acceptance pending)

Original `c35cff81` `TestController::put` resolves/creates a test by the exact
person and requested Booklet name; `TestDAO::getTestByPerson` does not reject
it merely because another Booklet remains unfinished. The earlier Rewrite
selected any open session run in both `launch` and `resumeSession` and rejected
a different Booklet with `participant_session_open_run_booklet_conflict`.
An owned authorized SQLite fixture reproduced that HTTP 409 even after the
first run returned to the starter. The same upstream lookup behavior was
reverified at current `a570587f` on 2026-10-07.
The explicit run-bound selection prerequisite above is now implemented and
tested independently of response chronology. Legacy session-only readers still
use an `updatedAt` fallback. The exact controller workflow above now passes
locally without the launch conflict, with atomic reservation, independent
answers/timers and real Starter launches; native PostgreSQL and complete
publication CI acceptance of that controller change remain pending.

The required acceptance covers starting a second assigned Booklet while the first
is safely left/paused, re-entering each exact run with independent answers,
timers and restrictions, correct active-run selection after background saves,
assignment variants, monitor pauses/locks and concurrent same-assignment
launches across all stores. Active leave/time/completeness guards must remain
enforced; unauthorized or completed/locked Booklets must not become launchable.
The layout fixture can render a completed second Booklet plus an unfinished
first by completing the second before starting the first; that rendered
fixture does not prove the blocked workflow above.

### STARS partial-delivery CI boundary

The first durable-presence publication (`a095936b`, push run `37270016809`)
finished with 20 successful and 15 failed jobs. PostgreSQL integration passed
all 179 tests, but browser jobs failed at the same strict partial-delivery
recovery gate. This publication is not globally CI-green.

An owned SQLite/browser reproduction confirmed that all 28 exact STARS answers
were saved: the page-only fault route let the real background worker bypass
the supposed seven-Unit delivery boundary. The test now intercepts both page
and worker network owners at context scope. After the hard reload it separately
asserts that only the permitted seven answers reached the server, retains the
strict 21-entry undelivered queue/content checks, and proves all 28 answers
reach durable storage once the boundary is lifted. No response algorithm,
timeout, expected queue count or private tryout data was changed. The focused
stop point is `participant-original-stars-mid-drain-hard-reload`.

The real shared STARS steps passed headfully on owned SQLite in both frozen
production and development frontends, including foreground/background recovery,
parallel-run isolation, whole-browser process crash and the corrected hard
reload boundary. Development also passed the unchanged 200-entry capacity and
manual-retry assertions. All 83 frontend/preflight tests remain green. Evidence
is retained in ignored `.data/stars-network-boundary-20261005`. The complete
preceding production flow through the official STARS family subsequently
passed on an owned memory repository. Publication `c676e5e5` also passed the
full GitHub browser flow and PostgreSQL UI gate. Its push run `37271624443`
subsequently completed successfully with all 35 jobs green. This is evidence
for that exact publication, not automatic proof for later commits.

### Durable participant connection presence

The Source `c35cff81` broadcaster's two 30-second heartbeat rounds and its
last-connected-token rule are adapted to the shared participant SSE channel.
Registration is pending until an actual received, correctly scoped frame is
acknowledged with the existing participant bearer credential. Only that
acknowledgement renews the 60-second lease; server writes cannot do so. The last
confirmed socket's close or expiry records `CONNECTION=LOST` exactly once;
another confirmed tab prevents false loss. An authenticated current-state read
restores `POLLING`, while reconnection restores `WEBSOCKET`. Unknown,
expired and foreign-run acknowledgements cannot revive a connection, and
duplicate registrations cannot extend or demote a confirmed lease. Finished
runs reject new streams with an explicit conflict rather than HTTP 500.

Presence and the corresponding log commit atomically in every repository.
SQLite uses its writer transaction; PostgreSQL locks the existing parent run,
including the first registration when no presence row exists. Durable leases
survive a new repository/process; file storage remains single-process. Closed,
expired and completed sessions clear leases without resetting log counters.
Transitions do not modify answers, status or timers, and respect modes that do
not save response logs. Source server logs preserve client epoch `0` and exact
`"CONNECTION" : LOST` / `"CONNECTION" : POLLING` export text; server chronology
is retained independently. SQLite migration 58 and PostgreSQL migration 52 are
additive. After publication, the private runtime was refreshed only after an
integrity-checked backup: schema 58 retained the running MaP session and its
exact saved-answer hash; no session or response reset was performed.

Local verification passed 165 core, 12 cross-repository presence and 83
frontend/preflight tests. Full API suites passed 163 tests each with memory,
file and SQLite; the subsequent finished-stream conflict also passed its
focused API gate and a fresh complete memory run. Production/development
headful Chromium passed both interfaces at 1280/390 pixels: real participant
login, received-frame acknowledgement with the same bearer, two-tab isolation,
last-tab close and visible lost monitor state, Original CSV epoch/text, real
polling restoration, same-run reconnection and byte-identical saved answers.
A real open SSE socket without renewed acknowledgements remained live at 55
seconds and expired after 60.193/61.042 seconds. No page errors remained.
An earlier development run timed out during re-entry; its unhandled test-wait
promise was corrected to retain failure diagnostics, and the serial rerun
passed without increasing the deadline or suppressing errors. An earlier
full memory run aborted without a complete error report; subsequent complete
runs passed, but its cause is not asserted. Initial production output remains
469.59kB below the unchanged 470kB hard budget. Logs/screenshots are retained
in ignored `.data/participant-presence-reference-20261005`; old generated
integration/Smoke fixtures were removed to free disk space, not private data.
PostgreSQL's independent-storage-pool race proof and the browser regression
are mandatory CI steps. The first publication passed all 179 PostgreSQL API
and presence tests; the overall browser gate remains blocked by the fault
boundary described above until the corrected publication completes.
This functional connection guarantee does not close any full Original UI row.

### Latest verified Original administrator login rendering

The optional signed-out operator entry now adapts the actual pinned 19.0
AdminLogin: centered 400px raised card, secondary border, outlined name/password
fields, German title/actions, source toolbar/footer and bottom Testtaker link.
It uses the existing authorized operator service, browser proof-of-work,
session persistence and guarded return URL. The Native entry and first-instance
setup remain available through the reversible Rewrite choice or `?ui=rewrite`.
The actual Source field has no rendered password suffix (MatSuffix is not
imported); this renderer follows that actual output, not the intended template.

Credential, scheduled/expired access and rate-limit errors map by semantic
identifiers to Source copy, not by mismatching Rewrite/Source HTTP codes.
Secrets are form-local until the shared sign-in call, cleared on success/error
and destruction, never persisted. Pending Enter/duplicate submits cannot start
a second action. A late failure cannot erase a replacement form's password.
An acknowledged login survives a failed following asset read and continues to
the requested protected route. A failed lazy renderer offers the safe Native
entry, including deployment setup, without sending an authentication request.

All 48 equal-fixture states passed in each final production/development build:
three themes × 1280x720/390x844/599x844/600x844 × empty/filled/Caps Lock/wrong
password. The unmodified `c35cff81` frontend uses a bounded Source API fixture;
Rewrite uses real protected API/SQLite. Text, geometry and visible computed
styles match. The matched `margin:auto` rule and actual form position are
compared; Chromium's inconsistent resolved auto-margin values are retained
as diagnostics, not used as a visual difference. Raw screenshot RGBA is
identical in 41/48 production and 44/48 development pairs; remaining raster
edges differ by at most 1,291 pixels and 24/255 channel units. No full-page
pixel-identity or complete Original UI matrix-row claim follows from this.

Both builds passed twelve real browser login configurations, scheduled and
expired accounts, blank normalized names, pending duplicates, retained sessions
after failed asset reads and the actual failed-renderer fallback. Each solved
24 real browser admin proof-of-work challenges. The protected SQLite flow passed
through workspace deletion; participant-login and deletion-dialog regressions
also passed. All 157 core and 78 frontend/preflight tests passed. Initial output
is 469.31kB under the unchanged 470kB error budget. Scripts, screenshots,
metrics and logs are retained in ignored `.data/original-admin-reference-20261004`.
Publication `fae90ea5` passed all 35 push-CI jobs (run `37226072648`),
including PostgreSQL. This does not prove the later presence changes.

The preceding XML publication `9201af97` is fully CI-green (35/35, push run
`37222355479`), including PostgreSQL UI and participant-detail review. The
account-deletion renderer `1f8cb927` and its fresh Entire checkpoint are
verified on GitHub; its own full CI remains distinct from that XML result.
The private local instance now serves this published renderer with an explicit
legacy intake profile, an integrity-checked database backup and unchanged MaP
response/PPTX hashes. No private answer, session or release was reset.

### Latest verified Original administrator-deletion dialog rendering

The optional Original account-deletion dialog now uses the pinned 19.0
Material structure, 600px width, singular/plural administrator prompt,
seven-character form gate, original action order and inline password alert.
It reuses the shared dialog-local secret and authorized deletion controller;
no second credential store or authorization path is introduced. The Native
Rewrite renderer and its extra workspace-key verification are unchanged.
After an expected error, Original restores submit focus only after Angular
has actually re-enabled its button, with the Source mouse/keyboard origin.
Every inherited button query explicitly reads its actual native ElementRef,
not a Material component instance. Late lazy loads and stale close callbacks
cannot resolve a replacement request. A failed renderer chunk falls back to
the safe Native dialog without deleting or losing the selected accounts.

All 18 equal-fixture states passed in each fresh production/development build:
Primar/Sekundar/Erwachsene, 1280x720/390x844, empty/filled/wrong password.
Text, geometry, visible styles and focus match the actual unmodified `c35cff81`
frontend. Only Source's backend is a bounded fixture rejecting unknown calls;
Rewrite uses real isolated API/SQLite. Five real-browser regression cases
passed per build, including cancellation, wrong-password retry, pending
Escape/backdrop/duplicate guards, failed post-delete reads and lazy-chunk
fallback. The separate protected SQLite flow passed through workspace deletion.
All 157 core plus 70 frontend/preflight tests passed; initial output is
468.25kB under the unchanged 470kB error budget. Evidence is retained locally
in ignored `.data/original-password-reference-20261004`. This is not whole-page
pixel identity, an Original-rendered workspace deletion or a completed
administration matrix row. Fresh full publication CI remains required.

### Latest verified Original participant login rendering

The optional Original login now matches the pinned 19.0 viewport composition:
64/56px toolbar, remaining-height two-column login and 56px footer, including
the Original's narrow-screen overflow instead of Rewrite's mobile stacking.
Welcome typography/text, form spacing, Material button/icon baselines and the
warning card's border-box wrapping match the actual source rendering. Browser
versions in this Original-only warning use the source's three-part semver;
Rewrite's raw browser identity and compatibility policy remain unchanged.
The footer still truthfully labels this application as Rewrite.

All 24 equal-fixture name/password comparisons passed in each fresh production
and development build: Primar/Sekundar/Erwachsene, 1280x720, 390x844, 599x844
and 600x844. The unmodified `c35cff81` frontend uses a bounded synthetic backend
that rejects unknown calls; Rewrite uses real isolated API/SQLite instances.
Visible text, geometry, styles and warning/icon children match. Raw screenshot
RGBA is identical in 17/24 production and 21/24 development pairs; other pairs
retain small edge differences (at most 114 pixels and 12/255 channel units).
These results are not a claim of complete pixel identity.

A new quick-CI regression checks all twelve theme/viewport configurations,
focus, name validity, real 401-to-password transitions, reveal/hide and back,
then creates a real password-authorized session without persisting its secret.
Both builds passed; a separate production run solved fourteen actual browser
proof-of-work challenges. Four presentation regressions protect raw identity,
three-part labels, custom texts and supported/no-browser behavior. All 144 core
and 49 frontend tests passed, as did the full protected production entry gate
through password sign-in and the three-theme real-report acknowledgement gate.
The initial production bundle is 467.99kB under the unchanged 470kB limit.

Evidence is retained locally in ignored `.data/original-login-reference-20261004`.
The Linux CI logo-width assertion was separately corrected to allow one 1/64px
layout unit, with exact logo height retained; code and its fresh Entire checkpoint
are verified on GitHub (`5aa72bf0`). The new login needs its own publication CI.
Error/custom-branding/admin-entry comparisons and every complete UI matrix row
remain open. Private MaP answer hash and the protected PPTX are unchanged.

### Latest verified Original Systemcheck welcome rendering

Actual pinned 19.0 rendering exposed Rewrite leakage into the Original view:
the 980px shell cap, non-white raised cards, inherited text colour, duplicated
disabled-button dimming, different FAB font/baseline and table wrapping. These
are now scoped back to the Original values. The shared optional Original header
also uses the source's 22px/28px centred title and 64px/56px toolbar with an
unconstrained proportional logo; the breakpoint is below 600px, not 720px.
The Rewrite layout, controllers, authorization and private test data stay intact.

Twelve equal-fixture comparisons passed in each fresh production/development
build: Primar/Sekundar/Erwachsene at 1280x720, 390x844, 599x844 and 600x844.
They compare actual visible text, card/table/FAB/title/logo geometry, typography,
colours, spacing, shadow and disabled opacity against the unmodified `c35cff81`
frontend. The opaque bitmap's inherited text font/colour are not visual inputs;
its visible shape and position are compared. Reference API fixtures reject
unknown calls, while each Rewrite instance has its own real API/SQLite database.
Screenshots, metrics, comparison script and logs are retained in ignored
`.data/original-welcome-reference-20261004`.

The dedicated CI browser regression now checks these welcome tokens, both
toolbar breakpoint sides, real report persistence and native asynchronous focus
containment without moving focus itself. Both builds passed all three themes.
The complete protected production Systemcheck and participant-entry gates
passed; the latter still revokes/re-enters into the same session/run. The initial
production bundle is 467.94kB under the unchanged 470kB error budget.
This is one matched welcome fixture, not whole-page pixel identity, Original
backend compatibility, all Systemcheck configurations or complete UI parity.
Every matrix row remains open.

### Latest verified Original Systemcheck acknowledgement

The optional Original report-success dialog now adapts the pinned 19.0
Material confirm template and MessageService behavior: two German actions,
child-safe order in Primar, adult order in Sekundar/Erwachsene and for signed-in
administrators/monitors regardless of theme. Only this already-saved report
acknowledgement selects the lazy presentation; verified destructive dialogs
and Rewrite confirmations retain their existing renderer. Request IDs guard
against an old overlay resolving a newer confirmation. Either close result
uses the existing 500ms return-to-Start controller and preserves the report.

Fresh production and development builds passed. A protected SQLite/headful
production Systemcheck flow passed real submission, adult ordering, keyboard
trapping, cancel-after-save, mobile bounds, return and export of the unchanged
Unit answers. A separate owned-API/SQLite/headful regression passed all three
themes in both builds, including cancel, confirm, Escape, three retained
questionnaire answers and no Angular errors. It is part of the quick CI gate.
The production initial bundle is 467.73kB under the unchanged 470kB error budget.
The published `bc8a7bf1` push CI, including the acknowledgement and subsequent
watchdog steps, completed with 35/35 successful jobs (`37208362997`). The
acknowledgement-only run was superseded, not itself fully green. Newer SQLite
and welcome changes need their own publication CI.

An isolated, unmodified Original frontend at `c35cff81` now also builds with its
own pinned lockfile dependencies (Angular 20.3.29, Material 20.2.14). Actual
rendering exposed and corrected the 30px title, 16px/24px supporting text,
720px maximum width and double-applied disabled-button opacity. The Original
save form now matches the actual 19.0 rendering without a visible password
suffix: the upstream template's unimported suffix is not projected. Rewrite's
separate password reveal remains available.

On 2026-10-04, all twelve equal-fixture dialog comparisons passed: save form
and saved acknowledgement, Primar/Sekundar/Erwachsene, 1280x720 and 390x844.
The comparison asserts visible text, surface and child geometry, typography,
colours, spacing, shape, opacity and button token/child values against the
real pinned frontend; screenshots were retained. Only the Original backend is
a synthetic API fixture, with unknown API calls rejected; Rewrite saves use
the real API and isolated SQLite. This is not Original-backend compatibility
or whole-page pixel identity. Evidence is retained locally in the ignored
`.data/original-dialog-reference-20261004.gFehUo` directory. Corrected production
and development three-theme regressions, typechecking, 140 core/29 frontend
unit tests and the full protected production Systemcheck flow passed again.
All eight Original UI matrix rows, operator layout and the remaining 19.0
functional delta stay open.

### Latest verified live-channel watchdog

Both browser SSE consumers now enforce a 60-second deadline from connect or
the last valid correctly scoped event. This adapts the effective one-minute
silence boundary of 19.0's two 30-second WebSocket heartbeat rounds to the
Rewrite's 15-second SSE heartbeats. Header hangs are bounded too. Expiry aborts
the blocked read, leaves `live`, requests a quiet state refresh and reconnects
after the existing three seconds; manual stop and stale timers stay stopped.
Monitor events now additionally require the exact connected tenant/workspace.
Malformed and foreign-scope traffic cannot refresh data or keep the channel
alive. No credential, response, outbox or durable run state is reset.

Production and development builds passed with the unchanged 467.73kB initial
bundle and 470kB limit. Sixteen new deterministic tests run the production
watchdog and both consumers/parsers with only Angular injection/signal storage
stubbed; the complete unit gates passed 140 core and 45 frontend tests.
Headful Chromium checks with owned API/SQLite and a silent-socket proxy passed
both real 60-second expiries and automatic reconnects in both builds. Normal
authorized current-state reads prove byte-identical saved answers and the same
run, without HTTP 5xx or Angular errors. The complete protected production
participant-entry gate passed too, through Original logout and same-run
re-entry. Browser evidence is retained locally in ignored
`.data/stream-watchdog-reference-20261004.783OA9`. These preceding browser checks
alone did not establish server-side loss; the later independent durable
presence implementation is described above.

### Latest verified bounded SQLite contention handling

A separate concurrent raw-SQLite inspection exposed an immediate `database is
locked` failure with rollback journalling and no busy timeout. The regression
was reproduced deterministically with both external readers and writers on
owned synthetic databases. All SQLite connection entry points now configure
a 5,000ms busy timeout without changing journal mode, schema version (57),
credentials, answers or migration data. Short contention waits for release;
longer contention still fails within the limit instead of waiting indefinitely.

Four storage regressions prove both short-lock successes and both persistent-
lock failures, unchanged records after rejection and a successful later retry.
The complete unit gates passed 144 core and 45 frontend tests; all 161 SQLite
API integration tests and the schema-57 startup smoke passed. A headful
Chromium check held each external lock until after the actual Player save was
released to the API: both real POSTs waited approximately 790ms and returned
200, preserving the answer in the same run without HTTP 5xx or page errors.
Request interception only synchronizes the lock; it does not mock the backend,
alter the payload or change the normal five-second response buffer.

Evidence is retained locally in ignored
`.data/sqlite-contention-reference-20261004`. This closes the reproduced
short-contention finding, not general multi-process scalability: synchronous
SQLite waiting blocks the API event loop, and long locks remain errors.
PostgreSQL deployment and server-side connection-loss parity remain distinct
acceptance requirements.

## Current 19.0 delta to verify

GitHub `master` was reverified on 2026-10-07 at
`a570587f12e10989f80e91a3d559aa5f753ec3f0` (2026-10-06). Its twelve-commit
delta from `c35cff81` adds current acceptance requirements:

- Every participant, password/code and administrator login stays disabled
  throughout challenge solving and session creation, including Enter/duplicate
  submissions. The Original now shares this flow in one protection service.
  Existing Rewrite duplicate/pending tests are relevant, but coverage of all
  current protected entry paths must be proved rather than assumed.
- When proof-of-work is configured for an entry in an insecure browser context,
  its Original UI shows the new German HTTPS/operator notice and disables that
  entry. Secure localhost remains supported. Verify inactive protection is not
  incorrectly blocked, no credential/challenge request is sent by the disabled
  entry and both interfaces retain the same server authorization.
- New Original installations now default to inactive brute-force protection,
  with an explicit HTTPS warning for operators enabling it. Audit deployment
  configuration and documented differences; do not silently weaken an existing
  installation's configured protection.
- Declining to proceed after a failed backup or skipped migration aborts the
  update before apply. Rewrite update/backup/migration tooling needs evidence
  for this same non-destructive boundary; quieter archive output does not prove
  rollback or safe updates.

Other changes are release/lint/instruction cleanup and repair of historical
backend test-data utilities, not additional runtime parity claims. The rendered
comparisons recorded below still use the unmodified `c35cff81` frontend and do
not automatically prove the changed current login states. The current target
and that historical rendering reference are deliberately distinct.

On 2026-10-03, the Original fetch advanced to
`c35cff81383949b4664e0fdffa3ba1154d144d9d` (version 19.0).
GitHub `HEAD`, `master` and tag `19.0.0` were independently reverified on
2026-10-04 at the same revision (not the stale default HEAD of the local clone).
The broad historical
audit below remains useful, but its 94% estimate is **not a verified estimate
against 19.0** and does not include the newly requested identical optional UI.
The following additional acceptance requirements come from the 19.0 changelog
and implementation. Each needs current rewrite evidence before it is closed:

- Required current-password confirmation for self-service password changes
  and for superadmin deletion of administrators/workspaces; resetting another
  administrator's password retains its distinct authorization boundary.
  Administrator and workspace DELETE now require the acting administrator's
  current password in `confirmationPassword`, after active-session and role /
  delegation checks and before any deletion. Workspace deletion always requires
  a platform administrator, even in diagnostic auth-off mode; its exact-key
  confirmation remains required and the audit actor comes from that session.
  The shared dialog keeps wrong-password errors inline, retains the selection
  for correction, traps focus, prevents duplicate submissions while pending,
  and clears its local secret on completion/cancellation/destruction. No secret
  enters shell persistence or audit records. A failed directory read after an
  acknowledged delete preserves the result instead of offering that deletion
  again. Full Memory/file/SQLite suites pass 161 each; 144 core and 60 frontend
  tests pass. Production/development builds remain within existing budgets.
  Desktop/mobile gates exercise both interface preferences with the real API,
  wrong-password retry, no-request cancellation, pending responses and failed
  post-delete reads. The full protected SQLite operator sequence passes through
  workspace and account batch deletion. This closes that functional deletion
  gap, not pixel identity of the Original superadmin dialog or PostgreSQL proof.
- Optional installation-wide refusal of passwordless logins and rejection of
  Testtakers files containing them, with the Original `sys-check-login` exception.
  Implemented through `REQUIRE_LOGIN_PASSWORD` (default false): existing
  passwordless participant sign-in/starter launch and direct/packaged roster
  imports are refused before roster changes or release staging. Monitor
  migration candidates also require source passwords; `sys-check-login`
  candidates remain importable without one. The rewrite's separately created
  operator accounts still require passwords; passwordless system-check-account
  sign-in is not claimed as Original UI/auth parity. Regression gates exercise
  durable policy changes, all six participant modes and both monitor modes,
  CSV/JSON/XML/ZIP input, unchanged existing passwords/candidates, and startup
  rejection of invalid settings or conflicting passwordless demo bootstrap.
- Login codes and `CodeToEnter` are case-insensitive; successful login resets
  failed-attempt counters. Current execution-mode/session reuse capabilities
  must agree with the Original definitions.
  The complete six-mode run-capability/label matrix is now pinned to 19.0 and
  regression-compared. `run-demo` creates a new session/run on credential entry;
  explicit session links still address the existing session. Second codes now
  compare ASCII case-insensitively throughout assignment filtering, starter
  visibility and session reuse, matching `Login::codeExists`/`SessionDAO` at
  `c35cff81`. New sessions retain the authored code spelling; older sessions
  with another spelling remain reusable without rewriting their identity or
  extending their access window. First login names and passwords remain exact.
  Successful fresh and reused sign-ins reset only that tenant/workspace/login's
  failure counter in all four adapters; an active lockout still rejects even
  the correct password. Memory/file/SQLite API gates cover mixed-case codes,
  re-imported spelling, assignment isolation, both entry routes, durable
  restart, independent login counters, and unchanged lockout enforcement.
  Existing `CodeToEnter` comparison already ignores case; its durable unlock
  gate covers uppercase and mixed-case input. PostgreSQL remains CI-gated.
- Default XML XSD validation, supported schema versions and supported
  `https://w3id.org/iqb/spec/<repo>/<version>` references. Unsupported versions
  and historical GitHub schema locations are rejected when applying this
  current contract; the operator file view explains supported versions.
  Implemented as the default `original-19` intake profile, pinned to the
  Original `definitions/compatibility.json` at `c35cff81`: Booklet major 18,
  Unit major 17, Testtakers majors 17–18, SysCheck major 18. All six currently
  published supported schemas are pinned by immutable revision and raw SHA-256
  in a private installation cache, not vendored into Git. Actual libxml2/WASM
  XSD validation enforces required attributes, order, namespaces, booleans,
  identifiers, uniqueness and schema-specific facets. Uploaded schema URLs are
  identifiers only, never network targets or paths; DOCTYPE is rejected and
  native parser errors cannot expose roster passwords or document lines.
  Invalid/missing/unsupported references fail before normalization, staging,
  or roster changes; a supplied projection cannot bypass its source document.
  The same runtime-local policy flows through direct XML/roster imports, ZIP
  member quarantine and immutable workspace dependency assembly. The optional
  `legacy-compatibility` profile explicitly retains historical schema-less,
  alias and IMS fixtures; no global mutable mode or silent fallback is used.
  Existing saved runs/releases are not retroactively rewritten. File intake
  and diagnostics explain the selected profile and published versions.
  Current local evidence: 157 core plus 63 frontend/preflight tests; 163 API
  tests each in Memory/file/SQLite; four real SQLite browser configurations in
  both production and development (both interfaces × desktop/mobile). Strict
  tests cover native acceptance of all six schemas, invalid inputs, unchanged
  roster after rejection, mixed-ZIP quarantine, Booklet/Unit/player/roster
  staging, projection bypass, independent profiles, cache integrity, byte
  limits, non-network validation and offline startup failure. Read-only offline
  preflight passes. It now selects active HTML-referenced bundles instead of
  rejecting retained assets from an older build. Docker provisioning is
  implemented; fresh publication PostgreSQL/Docker CI remains separate proof.
- Ownership and mode checks for participant answers, unit states, command
  reads/acknowledgements and Review CRUD; authenticated file paths remain
  inside their workspace, authenticated downloads use private caching, and
  internal errors do not disclose server details.
  Participant account sign-out must also reproduce `deletePersonToken`: revoke
  its access credential without deleting the session/answers, and re-entry
  must not reactivate the old credential. The existing local `clearSession`
  action does not establish this guarantee. The Original-preview account now
  exposes the separately verified server-backed logout described below.
  Authenticated downloads now send `Cache-Control: private, no-store`:
  scoped CSV exports, Original result ZIPs, source packages, Systemcheck and
  participant Review JSON/CSV (including an empty 204), attachment files/PDFs,
  and participant resources including HEAD, single/multiple byte ranges and
  unsatisfied ranges. This reproduces the upstream `FileResponse` shared-cache
  exclusion and additionally avoids retaining sensitive downloads in the
  browser cache. Public application assets and hashed frontend files keep
  their separate cache policies. Current memory/file/SQLite API regressions
  verify headers alongside exact payload/range behavior; PostgreSQL remains
  a separate CI gate. This closes the download-cache subrequirement, not
  participant credential revocation, ownership or internal-error disclosure.
  The backend credential foundation is implemented separately from session
  records: random 256-bit tokens, durable SHA-256 digests, permanent revocation
  tombstones, run-owner binding and compare-and-revoke against a newer login.
  A legacy opaque session-ID credential is a migration path only until that
  session's first token issuance or revocation; it cannot reactivate afterward.
  Unit and memory/file/SQLite store regressions cover rotation, stale logout,
  cross-participant rejection, restart, unchanged session/run/response records,
  preserved access expiry and workspace-deletion cleanup. The HTTP boundary
  and Original Starter account logout now use this service; local session
  clearing remains a distinct operation.
  The resource-channel foundation now derives a separate HMAC capability
  from the durable credential digest and exact session identity. A sandboxed
  Player can load relative resources without placing the general
  participant bearer token in its URL. The resource capability cannot authorize
  answer/Review/command requests, issue another capability or revoke access;
  credential rotation, revocation and the participant's existing access deadline
  also invalidate resource access. Unit and memory/file/SQLite regressions prove
  this separation, cross-session rejection and validity across store restart.
  HTTP current-state responses now return a resource-only capability path;
  credential validation precedes resource reads, including HEAD/ranges, and
  resource path suffixes are redacted from operational logs, including encoded
  spellings. Public resource preflight remains available without private data.
  The shared browser request adapter now selects credentials from the exact
  participant session/run instead of forwarding an operator bearer to public
  participant routes. Successful participant responses populate a separate,
  bounded owner/credential store; rotation replaces only the token, and a
  confirmed-logout tombstone preserves owners and pending answers while
  disabling local legacy fallback. Participant SSE and worker saves use the
  same credential selection. Worker credentials are delivery metadata only:
  answer bytes, request body, delivery ID and foreground outbox stay unchanged.
  Invalid metadata cannot discard a valid queued answer. Fourteen actual
  frontend/worker-state tests passed, along with a fresh protected SQLite/
  Chromium gate through Original/Rewrite entry, real Verona offline recovery
  and view-closure background delivery; the browser gate rejects operator-token
  forwarding. A headful check also passed Original footer/account keyboard
  behavior and same-run return. Successful HTTP sign-in and credential-based
  launch now issue a fresh participant token. Every known session/run HTTP
  operation requires its exact owner's credential; neither an operator token,
  foreign participant token, stable ID nor resource capability can bypass it.
  DELETE session access returns 205 after compare-and-revoke without deleting
  the session, run or responses. SSE access is rechecked on each poll and
  revocation closes an existing stream. A dedicated real HTTP test proves
  unauthorized reads/writes, preserved execution-mode restrictions, revoked
  resources/streams, stale-logout rejection and exact response restoration after
  re-login. The full API suites passed with memory, file and SQLite (161 per
  store); seventeen frontend/worker/test-actor tests passed. The PostgreSQL
  integration gate and all three Compose PostgreSQL smoke variants passed in
  the HTTP-ownership checkpoint's CI run. That run is not overall green:
  repeated Test Controller setup logins rotate credentials that the browser
  then incorrectly reuses. These fixtures now reauthenticate through the real
  UI without relaxing owner checks. A fresh protected SQLite/
  Chromium gate passed through real Original/Rewrite sign-in and rotation,
  capability-based Verona resource GET/ranges, offline answer recovery and
  view-closure background delivery under enforced HTTP ownership. This is not
  yet the full browser/visual matrix.
  Test actors
  learn credentials from real successful login/state responses only; explicit
  denial headers are never replaced. Synthetic API-created browser fixtures
  bootstrap only their real setup-login credentials into the separate test
  browser's credential store; existing keys and logout tombstones are never
  overwritten. Actual UI login/rotation cases do not use that fixture bootstrap.
  A second browser login rotates the first browser's token, so same-run layout
  tests re-authenticate through the real UI before resuming the first browser.
  Original Starter logout waits for actual HTTP revocation before clearing the
  visible session. Errors stay in the open account menu for retry. The local
  credential tombstone uses compare-and-forget; a renewed key or a different
  active participant is not cleared by a stale completion. Pending foreground
  and worker answer queues remain intact. Twenty-five frontend/worker/test-actor/
  logout-state regressions passed. A headful Chromium/owned-SQLite check passed
  a real Player answer save, temporary logout failure and retry, old-key 401,
  real re-login with the same run and byte-identical saved response restored in
  the Player, desktop focus and mobile keyboard logout without overflow or
  page errors. The production frontend remains 469.00kB under the unchanged
  470kB error budget. A fresh complete protected SQLite/Chromium production
  browser gate passed through Original logout/re-entry, all official Player
  families, repeated Test Controller logins, monitor operations, attachments,
  exact Original exports and isolated group-result deletion. The final process
  exited 0. Publication CI and equal-reference visual comparisons remain
  separate acceptance gates.
  Original Starter sign-out now first opens the pinned 19.0 Material
  confirmation dialog, including its text, companion image and audience-specific
  button order: Primar offers the filled `Hier bleiben` action first; Sekundar
  and Erwachsene offer the outlined `Abmelden` action first. Cancel/Escape
  restores account-button focus without contacting the revocation endpoint.
  Lazy loading or a changed/destroyed session cannot confirm a stale logout.
  A fresh protected SQLite/Chromium entry gate passed cancellation, actual
  revocation and same-run re-entry. Headful checks passed all three actual
  application themes at desktop/mobile widths, native keyboard focus, transient
  logout failure/retry, old-key rejection and byte-identical saved Player
  response restoration. Twenty-five frontend-state tests and backend/shared
  typechecking passed. The production bundle is now 469.72kB under the unchanged
  470kB error budget; identical repeated font declarations were consolidated
  without changing font values, and the dialog is lazy-loaded. These are local
  checks, not matching Original-reference screenshots or a new all-green CI run.
  A separate headful browser check also passed an actual server 401 after a
  second browser login rotated the first browser's key. Both foreground and
  worker stores retained the exact response and delivery identity. Credential
  re-entry restored the same run with a new key; with foreground saves blocked,
  the actual worker delivered the byte-identical response and removed only
  the delivered record. This is local browser evidence, not a new CI result.
  As a prerequisite, the shipped background worker now retains its exact
  pending response and delivery ID on 401/403, request timeout, rate limiting,
  network failure and server failure, so renewed authentication can retry it.
  Other independently deliverable Units still drain. The existing permanent
  rejection behavior and foreground outbox remain unchanged. Four tests run
  the actual worker's drain function with controlled network/storage boundaries;
  the full unit/frontend-state gate passed (138 + 7 tests). A fresh protected
  SQLite/Chromium gate passed real Verona offline outbox, view-closure background
  delivery, controller-error recovery and exact response restoration. This
  does not yet prove the future credential transport or a real browser 401.
  The complete API suite passed with memory, file and SQLite stores (160 tests
  per store), together with 138 unit and three frontend-state tests at the
  credential-table checkpoint. Its PostgreSQL integration and protected UI
  jobs also passed in run 37135454646 for commit 6f78b267. That run nevertheless
  failed its full/operational browser jobs at the workspace refresh checkbox;
  it was not an all-green CI run. The later resource-capability extension has
  its own pending PostgreSQL/CI gate.
- Live-connection registration rejects unknown/duplicate tokens, tokens are
  unpredictable, and silent disconnects become lost within one minute.
  Internal broadcaster endpoints remain inaccessible to public clients.
  Browser-channel silence and server-side participant presence are now bounded
  independently as described above; fresh PostgreSQL/publication verification
  for the presence changes remains separate from the preceding green CI.
- Navigation to the starter/route dispatcher applies active-unit completeness,
  timer and leave-lock checks, including manually entered routes. A player
  reporting no Verona version produces a clear controller error.
- Monitor action enablement and missing state icons, distinct live/polling
  indicators, and Review timing without invented time limits.
- All Original-compatible CSV cells, including headers, are quoted and
  preserve embedded quotes/semicolons/newlines. Verify the changed log content
  contract and corrected Systemcheck labels/`ms` units. Report Accept handling
  supports media-type parameters and ordered alternatives. Review/report
  timestamps support the current UTC offset and fractional-second shapes.
- Physical attachment deletion, explicit test-mode opt-in, backup/restore
  installation matching and PostgreSQL startup/import atomicity. PHP-specific
  `open_basedir`, extension and MySQL migration mechanics are implementation
  details; verify their effective access/data guarantees for this rewrite.

The optional UI has its separate complete acceptance matrix in
[`ORIGINAL-UI-PARITY.md`](./ORIGINAL-UI-PARITY.md). Neither a green historical
pipeline nor a completed login/starter slice proves current full parity.
An additional development-build run exposed `NG0100` in the Participant view
while opening the official ABI Player family. A fresh headful reproduction
identified the synchronous Player `LOADING` log/save notification during
`ngAfterViewInit`/input changes: it changed the parent's already-checked
`canClearSession` binding. Logging and missing-input error notification now run
in the existing cancellable frame callback before iframe loading, outside that
render/verification pass. No Angular guard or global error reporting is disabled.
The new `smoke:ui:verona-development` gate builds into an owned temporary
directory and uses a fresh protected SQLite database. Its headful run passed
both Rewrite and Original layouts, real official ABI text/choice input, durable
save, authored reload, page reload and forward/back Unit changes, with the same
run and byte-identical saved response, no page/console errors and final exit 0.
It is registered as an independent CI matrix job. All 140 unit and 25 frontend
state tests passed; the production frontend remains 469.72kB within its unchanged
470kB error budget. A fresh protected SQLite/Chromium production gate also passed
through all official Player families, resource/response restoration, offline and
background save recovery, Original/Rewrite entry and logout, with final exit 0
at `participant-verona-player-families`. Current publication CI remains separate;
this fixes the rendering regression, not the full Original visual-parity matrix.

Operational verification on 2026-10-03 found repeated full runtime snapshots
in operator release/session lists. These now return typed release metadata and
booklet/unit counts; source/import lists omit inline documents and structures.
Detail routes and exact downloads retain their content. In the same isolated
official BookletConfig workspace, the participant-list payload fell from
31,587,092 to 316,792 bytes; counts, identities, filters and CSV remain intact.
Memory/file/SQLite regressions exercise a 1.5MB source and four sessions, exact
detail/download retention and metadata-only lists. Three frontend-state tests
also gate non-overlapping polling, foreground priority, timer rescheduling,
failure recovery and route selection. A fresh complete SQLite/Chromium UI gate
passed on 2026-10-03, including the late import-repair and attachment workflows.
Current GitHub CI remains an independent acceptance gate.

The Original 19 CSV encoding portion is implemented on 2026-10-03 against
upstream `0435f3bb003d4189d8fcaca66f9ee208c2434c86`: participant Review downloads,
Original result-archive response/log/review CSV, workspace log CSV and
Systemcheck CSV share one semicolon/BOM encoder. Non-null cells and headers are
quoted, embedded quotes are doubled, actual null cells stay empty, and the
archived log string retains its original backslashes. Review category booleans
use the Original CSV `TRUE`/`FALSE` representation while JSON retains booleans.
Tests cover adversarial headers/log values, archive CSV versus JSON log
identity, participant isolation, and official SysCheck report exports. This
closes the encoding subrequirement; timestamp shapes still require the
current-version audit.

Participant Review and Systemcheck reports now also reproduce 19.0's ordered
Accept negotiation: case-insensitive `text/csv` and `application/json` may have
parameters, the first supported alternative wins, and unsupported/wildcard
headers retain the route default (Review CSV, Systemcheck JSON). Explicit
`.csv`/`.json` routes keep their format. Empty Review CSV remains 204; empty
Review JSON is 200 with `[]`, category values remain JSON booleans, and only
the authenticated participant's reviews are included. Systemcheck's generic
route retains operator authorization for every format. The upstream
`ReportFormat.php` test matrix and API regressions passed with memory, file and
SQLite stores. PostgreSQL integration and PostgreSQL UI CI passed at
`b0c4a85ddd0432b31b2bc54df9f47005d3e3ffc9` on 2026-10-03. The fresh protected SQLite/Chromium
Systemcheck gate also passed saving and exporting both checks and the corrected
`RoundTrip in ms` / `Anwendungs-Latenz in ms` labels. Negotiation for standalone
workspace response/log/review reports is not covered by this slice.

The optional Original Systemcheck selection now follows the pinned 19.0 starter:
400px Material card, German empty/single/multiple instructions, explicit start,
authored labels/descriptions and the home action, without Rewrite diagnostic
inputs. Its directory is metadata-only and never returns report keys, Player
HTML, Unit definitions or release snapshots. Identical IDs in different
workspaces remain separate; dedicated logins are restricted to their authorized
workspaces and invalid credentials cannot fall back to anonymous selection.
Headful checks passed public selection, actual scoped check loading, 390px
bounds, failure/retry, the required initial password change, re-login and
sign-out. The full API suites passed with memory, file and SQLite (161 tests
per store), together with 140 unit and 25 frontend-state tests. A fresh
protected SQLite/Chromium production gate passed the new public-selection
checks and both existing report/save/export flows with final exit 0. API
assertions and the repository browser gate retain these cases. Current
publication CI and PostgreSQL remain separate gates.
Protected login and the network/Unit/questionnaire/report layouts
still require Original adaptation and rendered reference comparisons. This is
a selection slice, not completion of the Systemcheck or visual-parity matrix.
The subsequent welcome/navigation slice adapts the two 400px Material cards,
German step labels, environment table, header and FAB previous/next controls.
The exact selected scope/check now survives reload through query parameters;
returning to selection clears the check parameter. The header logo returns home.
Header-only questionnaires retain their step, matching Original 19's question
array rather than its number of input controls. Newly captured environment IDs
and labels now match the current source; stored historical reports remain intact.
Material tooltips now also match the source; the remaining full-page/reference
comparisons are not closed by this slice.
The final headful welcome check and fresh protected SQLite/Chromium production
report gate exited 0; the latter also passed the header-only questionnaire case
and the unchanged report/save/export flows. Twenty-five frontend-state tests
passed. The 469.91kB production initial bundle remains below the unchanged 470kB
error limit. Current publication CI remains separate.
The subsequent Player-style delivery change retains the exact former visual
rules and global specificity but loads them with an actual Verona host. This
reduces the initial shell to 467.76kB while adding real Original Material
navigation tooltips. The isolated development gate passed both layouts at
1280px/390px, exact computed-style comparison against the old initial placement,
no overflow, real ABI input/save, reload and Unit changes, exact saved response,
no page/console errors and final exit 0. A headful welcome check also passed
the visible tooltip. This is local evidence, not new publication/reference
screenshot acceptance.
The fresh protected SQLite/Chromium production Systemcheck gate also exited 0
with the visible Material tooltip/accessibility assertion and both existing
report/save/export flows. The full unit/frontend-state gate passed (140 + 25).

The same CI revision exposed an additional browser-gate race in both full UI
and Ops: attachment setup timed out waiting for the auto-refresh preference to
be saved as false. The checkbox now assigns and persists its emitted model
value in one explicit handler. The attachment gate exercises and verifies both
enabled and disabled states instead of trusting a newly rendered input's
default value. A fresh protected SQLite/Chromium attachment/camera gate passed
with refresh disabled, including lookup, capture, upload, preview and deletion;
the complete post-fix CI still needs its own successful result.
At `5578bb9cfcbad611e81fdc6bde2b763c2d3cbd67`, full UI, Quick, PostgreSQL
integration and PostgreSQL UI passed. Ops failed because `locator.check()`
reported that clicking the refresh checkbox did not change its state. This
differs from the earlier storage-preference timeout. Angular's `ngModel`
initializes its control through a deferred Promise; this checkbox now uses
the native synchronous `checked` binding and an explicit change handler.
Thirty headful Chromium route round trips passed immediate check/uncheck and
storage assertions from both initial preferences without sleeps/forced clicks.
A fresh protected SQLite/Chromium attachment/camera gate also passed lookup,
capture, upload, preview and deletion with refresh disabled. The post-change
Ops CI result remains a separate gate; the overall prior pipeline is not green.

The zoneless Attachment Capture view now explicitly notifies Angular after
camera, QR, target lookup, photo encoding and upload callbacks. The isolated
SQLite/Chromium gate passed on 2026-10-03 with automatic shell refresh disabled,
including an unknown-code error, camera startup, QR-image resolution, target
confirmation, frame preview, upload, preview in the manager and deletion.
This closes that async-rendering defect, not the optional Original visual row.

The Original 19 questionnaire is now a lazy, source-adapted Material surface
over the shared Systemcheck answers and report controller. On 2026-10-04, the
fresh protected SQLite/headful Chromium production gate exited 0 through the
schema-conformant six-type questionnaire fixture, actual mouse/keyboard input,
desktop/mobile layout, step round-trip answer retention, header-only questions
and the existing report save/download/export flows. Visual inspection exposed
and fixed leakage of Rewrite textarea minimum-height and form-label styles;
the browser gate now checks actual four-row autosizing and inherited Material
label typography/color. The production bundle passed at 469.90kB under the
unchanged 470kB limit, and 140 unit plus 25 frontend-state tests passed. Full
Original-reference comparisons, protected-account/network/Unit/report layout
and current CI remain separate acceptance requirements.

The published `66c20ab4` push workflow completed successfully; its separate PR
workflow failed on an open-run Select + Sync timeout and a transient background
outbox observation. The browser gate now filters the resumed run as `running`,
not `paused`, and intentionally retains a real Service Worker save until after
the Participant view has closed. It checks the exact durable response/delivery
ID and participant credential before release, then server delivery, restoration
and queue cleanup. Two fresh headful runs passed that background-save section
but stopped later at independent official Test Controller/IB corpus checks;
neither is a successful full browser run. Failure screenshots are now retained,
and local headful execution is explicit through `UI_SMOKE_HEADFUL=true`.
Current complete CI must prove the monitor-selection assertion and the broader
corpus; these test-harness changes do not close any product-parity matrix row.

The optional Original Systemcheck network stage now uses the pinned source's
810px Material card, automatic start, progress/rating copy, download/upload
canvas charts, live measured averages and `Neustart`. The shared measurement
engine aborts pending latency and package requests on check/account/step/route
change and rejects stale results/errors instead of contaminating a newly
selected check. Completed results survive a step round trip. A protected
SQLite/headful Chromium report gate covers successful and unstable measurements,
actual keyboard restart and actual held latency/download/upload request aborts
in both interfaces, clean new-check state, no page errors, mobile/desktop bounds
and the existing report save/download/export flows. Adapted screenshots are
inspected, not treated as rendered Original-reference acceptance. Source chart
projections/grid/dots are retained without the expensive scan of every four
bytes. Environment parsing is lazy and generation-bound, with explicit zoneless
refresh; current complete CI and all full Original visual-parity rows remain
separate gates.

The final fresh protected SQLite/headful Chromium network/report gate exited
0 on 2026-10-04. All six controlled request cancellations, actual completed
measurements/restarts and report/export flows passed; both final screenshots
were inspected. The unchanged initial-bundle budget passed at 469.52kB, and
140 unit plus 25 frontend-state tests passed. The previous publication's push
and PR workflows had 33/35 successful jobs, with Ops/Quick still running;
that snapshot is not a completed CI success.

The optional Original Systemcheck Unit now adapts the source's task prompt,
divider, full-height frame, bottom-right numbered Material page controls and
German error card. It delegates to the existing sandboxed/source-validated
Verona host and shared answers, never a second Player/controller. Both layouts
send `logPolicy: disabled`. The Material group's change event, rather than only
a DOM click, also forwards Enter/Space/arrow-key selections to the actual Player.
The frame follows a wrapped mobile title so it does not obscure the prompt;
page-label layout rejects clipped mobile numbers. Synthetic two-page browser
coverage checks real page changes, answer restoration after step changes and a
runtime error, single-frame ownership, wrong-window message rejection, hidden
Rewrite diagnostics and keyboard activation. These safety/accessibility
adaptations and inspected Rewrite screenshots do not close the source-rendered
visual-parity requirement; the report and operator surfaces remain open.

A development-mode Systemcheck run exposed a restored-entry busy-state
`NG0100` that production hid. Busy transitions now notify Angular's scheduled
zoneless change detection rather than nesting synchronous checks. Production
and development protected SQLite/headful report gates both passed after the
fix, including the Unit lifecycle and six actual aborted network requests.
Participant-only Review/save/readiness/timer/testlet styles now travel with the
lazy participant route; all 60 selector/declaration sets are unchanged. The
development Participant gate compares actual save/readiness computed styles
with their former global placement at 1280/390px in both interfaces and passes
real load/save/reload/unit-change restoration without Angular errors. The
production initial bundle remains below the unchanged 470kB error limit at
467.64kB; 140 unit and 25 frontend-state tests passed.

The network publication `01249459` push CI completed with 35/35 successful jobs.
Its separate PR run found the root-booklet timer integration test returning
`running` instead of `completed`. That test used a blind client-side 1.1-second
sleep even though operation timestamps are strictly monotonic and can briefly
lead wall time during a fast in-memory suite. It now validates the returned
running timer and finite, bounded `expiresAt`, waits for that authoritative
deadline, and retains every completion/current-unit/expired/active-timer
assertion. No production timer or clock behavior changed. Fresh complete
Memory and isolated SQLite integration runs both passed all 161 tests; newly
pushed full CI remains a separate gate, not a retroactive PR-CI success.

The optional Original Systemcheck report now adapts the pinned 810px Material
card, required-answer warning list, environment/network/questionnaire lists
and send/cancel actions. The shared controller and durable report remain
unchanged. The extra Rewrite application probe is omitted only from this
presentation, and Rewrite operator tools do not intrude into the Original
public report. Fresh isolated, protected SQLite/headful production and
development report gates passed, including keyboard opening, Escape/focus
return without creating a report, required fields, mobile overflow prevention
and cancellation to Start. The initial production bundle remains 467.64kB
under the unchanged 470kB limit. The existing save/confirmation dialogs and
operator surface are not yet Original adaptations, and equal-fixture rendered
upstream comparison remains open.

The `b4483080` push CI's full browser job caught the new two-page restoration
test reading an empty second answer after a step return. The official Simple
Player debounces its state messages for 50ms: filling/blurring a field does
not itself prove that the controller received that answer. The gate now waits
for an actual state notification from the active frame containing both exact
answers before exercising return/restoration; no production Player behavior,
timeout or answer assertion is weakened. A failure screenshot capture also
cannot mask the original test error if storage is full. Current complete push
and PR CI remain unconfirmed; partial passing jobs are not full CI success.

The anonymous Original report form now uses a lazy 500×600 Material dialog
adapted from the pinned save-report template: outlined password/title fields,
suffix visibility toggle and raised save/cancel actions. Its unique overlay
theme stays outside Rewrite dialogs; destruction unsubscribes and closes the
overlay. Shared submission, authorization, confirmation and report data remain
unchanged. Fresh protected SQLite/headful production and development gates
passed minimum lengths, password toggle, focus trapping, Escape/cancel without
a report POST, empty/hidden-password reopening, desktop/mobile geometry and a
real Enter submission (201). Export verifies both exact restored Unit answers
and the Rewrite-only diagnostic remains in the durable payload. The synthetic
report joins the existing scoped deletion check. Initial output stays 467.64kB
under the unchanged budget. Bounding height on short screens and rejecting
whitespace-only values are intentional safety adaptations, not a claim of
pixel-identical upstream acceptance. Original confirmation/operator layout,
equal-fixture rendered references and complete CI remain open.

The `b4483080` PR monitor-browser job also failed its 28-Unit STARS background
check. Its logged active Unit 2 response has exactly the same complete envelope
and raw dataPart strings as the expected answer, but the running Player had
republished it without the test's artificial trailing whitespace marker. The
background gate now permits only that complete outer-JSON canonicalization for
the active Unit; all other Units remain byte-exact, and no field or dataPart
string is projected away. Four new matcher regressions reject changed answers,
raw dataPart spacing, progress, page, type, version and malformed envelopes.
All 29 frontend-state tests passed. A fresh protected SQLite/headful production
gate passed actual foreground recovery, isolated parallel 28-Unit hard reloads
and background recovery through `participant-original-stars-28-unit-background-sync`,
including complete foreground and IndexedDB queue clearance. This is not a
production answer change, crash-recovery gate or completed publication CI.

## Historical broad baseline

This checklist uses IQB Testcenter commit
`284a4ffcd9452d56dddd51939707ac7f646c3da7` (2026-04-20) as its broad baseline
and was last compared on 2026-09-07 with the latest published release
`18.3.0` at `cff08eaad43d0a98b876fa07591ae51af9828dcf` (2026-09-01) and the
current upstream `origin/master` at
`19411870c3b1f8700d62e003c036c677f74116db` (2026-09-07), eleven commits after
that release. It additionally tracks current frontend behavior at
`90ec58845d84d899fb993553d03767c072fdd05c` (2026-08-18) plus the complete
current 18.0 BookletConfig package at
`a5a6d25a72990d667300804c337cc5b500b01d2f` (2026-08-12). It is the working
source for implementation order, not a claim of release parity. Newer
Original packages are pinned at package level; the current STARS system-test
graph is fixed to its introducing commit
`94b04751abfe024eb1d354c29718f90b4740c4c6`, and the current Adaptive,
two-booklet Aspect, BookletConfig, Group-Monitoring, root Sample,
and Session-Management graphs are fixed to upstream commit
`a5a6d25a72990d667300804c337cc5b500b01d2f` (2026-08-12). The current
Test-Controller graph is fixed to upstream commit
`65d28718eb6474cf5158206494096d32cd3393f9` (2026-08-20). The complete
13-file `e2e/src/fixtures` directory from that commit is pinned separately so
the current 18.0/17.4 schema generation is gated without replacing its
historical counterparts. The current Speedtest system-test graph is fixed to
its introducing upstream commit
`6455e265421777124f379090257365b70b21641f`.

The post-release master delta changes no XML schema generation beyond the already
pinned 18.0 corpus. Its product-relevant Review, code-input, execution-mode,
navigation/leave-dialog, invalid-session, Superadmin retry, error-report, and
current Test-Controller/Speedtest behavior is represented below. Test-only,
selector-only, documentation, fixture-refactoring, and CI-artifact changes do
not create separate product requirements. The 18.2 release audit did expose
two operational security requirements that were not explicit before.
Configurable Superadmin password length/pattern enforcement is represented end
to end; optional signed browser-computed proof-of-work now protects admin,
participant-login, and second-code entry independently. The production Compose
boundary now also owns configurable HSTS and one-time secret-file administrator
bootstrap without exposing the credential through source, environment, runtime
diagnostics, or service logs.

The seven commits after the previous `6455e2654` audit point publish the
18.3.0 beta, update dependencies/build configuration, and adapt the Original's
API-test multipart client to `multi-part` v4. They add no product route, schema,
or runtime behavior requirement. Regenerating `definitions/browsers.json` does
change the participant-login compatibility contract: Firefox advances to
140/153–154 and iOS Safari/Safari to 26.5–26.6, while Chrome/Edge remain at
150–151. The rewrite pins and tests that updated list below.

The five commits after the previous `18.3.0-beta` audit point publish 18.3.0,
correct one response-report OpenAPI field from a string to its already-real
array shape, split install/update bootstrap scripts from their release-specific
implementations, quote the existing brute-force scope default correctly, and
make the Original's Compose project name configurable. They introduce no new
product route or runtime policy. The rewrite already returns structured response
collections and its unnamed Compose resources inherit Docker Compose project
isolation; the documented smoke command explicitly exercises
`COMPOSE_PROJECT_NAME`. No capability status or weighted estimate changes.

The seven commits after the previous `401bdab83` audit point move the Booklet
and Testtaker editor schemas into the external documentation build, replace the
old lowercase editor-schema projections with uppercase 18.0 JSON projections,
and strengthen the existing Review-mode code-word E2E flow by requiring its
notification to close on request. The rewrite validates the source XML rather
than those editor-only JSON projections, and its pinned 18.0 Booklet/Testtakers
corpus already covers the represented XML structures. The Participant UI now
retains the visible Review/Demo/Trial code-word notification across successful
gate entry until the participant explicitly closes it; the current Original
text-field Controller case gates that complete lifecycle in Chromium. The
remaining commits only relocate or rebuild documentation. No capability status
or weighted estimate changes.

Status:

- `done`: usable end-to-end in the rewrite and covered by an automated check
- `partial`: a usable vertical slice exists, but important original behavior is missing
- `missing`: no usable product flow yet

Priority:

- `P0`: blocks credible test delivery or migration from the original
- `P1`: required for operational parity in a first production rollout
- `P2`: important follow-up after the first controlled rollout

## Audited completion snapshot

Against the release and master revisions above, the rounded engineering
estimate is **94% functional parity (uncertainty about +/- 3 percentage
points)**. The estimate weights P0/P1/P2 capabilities 5/3/1, treats every
`done` row as complete, and scores each `partial` row from its concrete
remaining behavior rather than from source-line counts. It therefore includes
the newly recorded 18.2 security requirements, including the now-complete
password-policy, proof-of-work, HSTS, and secret-file bootstrap boundaries, and
does not treat test-only upstream churn as missing application behavior. This
is a dated planning estimate, not evidence that every production package or
deployment has passed acceptance.

A fresh upstream fetch on 2026-09-06 confirmed the latest Original at
`401bdab833720a2e18664643bcb5df81fda09f7a`, four commits after the published
18.3.0 release. The updated generated browser list is already represented as a
completed contract; the post-release changes are deployment-script,
configuration, documentation, and Compose-isolation maintenance whose effective
contracts are already met by the rewrite. No new incomplete product capability
changes the weighted estimate. The earlier audit did,
however, turn one previously broad "rare file-graph"
gap into the explicit mixed-ZIP acceptance requirement below. That requirement
is now closed. Its implementation raises the evidence within the already-
partial package-intake, XML-validation, and dependency-graph rows, but does not
add or complete a separately weighted capability and therefore did not by
itself change the then-rounded 93% estimate. Operator-guided resolution of ambiguous loose
workspace dependencies is now closed as well: the import diagnostic exposes
the exact candidate source-package IDs, Angular requires an explicit choice,
and the server validates that choice before continuing the remaining automatic
transitive closure. This likewise strengthens existing partial rows without
changing their weighted status or the rounded estimate. Selected deletion
graphs are now closed for the same bounded workspace-file workflow: the batch
resolves roots before their selected dependencies regardless of request order,
supports multiple dependency levels, and retains a dependency when its selected
root fails confirmation or another guard. This removes the known
earlier-mutation deletion gap but leaves concurrent graph changes and broader
replacement graphs in the partial capability, so the then-current rounded
estimate remained 93%. The explicit non-WHATWG XML decoder allowlist now also covers ten
additional IANA-registered DOS/IBM families (`IBM775`, `IBM855`, `IBM857`,
`IBM860`, `IBM861`, `IBM862`, `IBM863`, `IBM864`, `IBM865`, and `IBM869`) with their
registered XML-name-compatible aliases. This further narrows the rare-encoding
part of the existing partial package-intake row without admitting transport
codecs or changing the rounded estimate.

Strict XML byte-sequence validation now rejects malformed UTF-8, UTF-16,
UTF-32, Shift_JIS, and other supported WHATWG multibyte input before replacement
characters can reach normalization. A mixed-ZIP gate proves that the damaged
Unit and its dependent Booklet/roster are quarantined while a complete sibling
graph still stages across memory, file, and SQLite. This narrows the existing
partial encoding/XML/package rows without changing the rounded estimate.

The ZIP filename boundary now also follows the Original's libzip behavior.
Entries with the language-encoding flag require fatal UTF-8 decoding; one
malformed flagged name rejects the complete package as
`source_document_zip_invalid` rather than silently introducing a replacement
character. Legacy CP437 names and correctly bound Info-ZIP Unicode Path fields
remain accepted. This closes the identified archive-open differential inside
the existing partial package-intake row and does not change the rounded
estimate.

The production STARS recovery gate closes the known browser-outbox
capacity-loss case: once all 200 validated slots are occupied, a 201st
independent Unit is rejected with visible failed-save and retry behavior rather
than evicting an older secured response. The final interruption gap is now also
closed: a complete Chromium browser-process crash after the origin store has
settled, followed by relaunch from the same persistent profile, proves that all
28 pending STARS Unit responses survive and drain without a `pagehide` handoff.
Together with the hard-reload, mid-drain, page-close, Service-Worker, and
capacity gates, this moves P0 resume/interruption from `partial` to `done` and
raises the rounded weighted estimate from 93% to 94%.

New requirements found by the 18.2/current-master audit:

| Capability | Original evidence | Rewrite status | Priority | Rewrite evidence / gap |
| --- | --- | --- | --- | --- |
| Configurable password and proof-of-work policy | 18.2 `Password`, `SessionController`, `/session/challenge`, `/session/person/challenge` | done | P1 | the rewrite applies one deployment-configurable administrator-password minimum and JavaScript regular-expression rule to every password write while preserving sign-in for existing passwords after policy changes. Optional SHA-256 browser proof of work is independently selectable for administrator credentials, all participant logins, and second codes; the global admin and participant scopes also prevent an omitted required password from cheaply filling their failure sinks. Angular uses `altcha-lib` Workers like the Original. Signed short-lived tokens bind a keyed credential digest without exposing the credential, accept only the current or explicitly configured previous key ID, and are atomically consumed in memory/file/SQLite/Postgres. Startup and preflight validate scopes, secret length, distinct rotation keys, work range, and TTL; secret-free runtime configuration drives disabled-mode-compatible clients. Unit/API gates cover credential binding, expiry, replay, controlled rotation, redaction, password-omission resistance, and rate-limit composition, while production SQLite/Chromium proves all three scopes end to end |
| Production TLS and bootstrap secret controls | 18.2 `HSTS_ENABLED`, `ADMIN_INIT_PASSWORD`, `SERVER_KEY` deployment contract | done | P1 | baseline security headers remain universal, while the production deployment overlay enables a fixed one-year `Strict-Transport-Security` policy with explicit environment override for an upstream-owned boundary. A separate one-time bootstrap overlay mounts the initial administrator password as a Docker secret into runtime preflight and the API, validates UTF-8/size/password policy before serving, creates exactly one platform administrator on an empty store, and leaves existing credentials unchanged on restart. Diagnostics expose only effective/configured booleans; the production Compose smoke generates a fresh secret, proves HSTS, sign-in, duplicate-bootstrap rejection, and absence of the value from diagnostics, container environment, and service logs. The bootstrap secret is unmounted after first-deployment verification. Proof-of-work signing secrets retain their documented bounded two-deployment rotation with no source/default/log exposure. Equivalent ingress/secret-manager controls remain acceptable; identical Original environment-variable names are not required |

Closed acceptance requirement from the current Original workspace-import
tests:

| Requirement | Original evidence | Current rewrite behavior | Priority | Acceptance condition |
| --- | --- | --- | --- | --- |
| Dependency-isolated mixed-ZIP import | `WorkspaceTest::test_importUncategorizedFiles_zip_rejectInvalidUnitAndDependantFiles`, `...rejectInvalidBookletAndDependantFiles`, and `...handleSubFolders` | done: ZIP members are validated before graph normalization. Entry errors become explicit quarantine warnings; invalid Units remove dependent Booklets and their Testtakers rosters, while invalid Booklets remove only dependent rosters. Independent resources and Units keep the aggregate accepted without inventing a release, and a complete valid sibling graph still stages normally. Roster extraction receives the accepted-path set, so rejected Testtakers entries cannot mutate participant data. Unsafe paths, case-insensitive archive/typed-ID collisions, manifest-ID collisions, and cross-file roster/resource identities remain package-wide failures | P0 | equivalent fixtures cover the invalid-Unit cascade, invalid-Booklet cascade, and nested invalid plus valid sibling Unit. They assert exact rejected entry/dependency diagnostics, no roster mutation for rejected graphs, and the valid nested release plus accepted roster across memory, file, and SQLite. The complete Original compatibility corpus remains green |

## Current remaining-work queue

The capability matrix below is authoritative for completion status. This queue
contains only work that is still open after the 2026-09-07 upstream audit;
participant execution modes, attachments/QR capture, and instance branding are
no longer listed because their matrix rows are `done`.

| Order | Priority | Remaining capability | Concrete acceptance gap |
| --- | --- | --- | --- |
| 1 | P0 | Production package and dependency corpus | Add further real production packages and cover the remaining rare XML lexical facets, encodings, archive layouts, and ambiguous/cross-file dependency graphs without weakening quarantine or duplicate protection. The IANA-registered Latin-6/Latin-8 aliases, Baltic IBM775 family, international IBM500 EBCDIC family, and strict malformed multibyte rejection are now covered through the durable-store matrix. |
| 2 | P0 | Adaptive and runtime-policy corpus | Exercise broader production coding schemes and nested combinations of adaptive states, timers, completeness locks, code gates, and leave-once navigation across the durable-store and browser gates. The byte-exact current frontend controller fixture closes the nested Root/outer/inner timer, two-stage code, and dimension-specific completeness precedence. A schema-conformant extension of the hash-pinned current `CY_Bklt_Adap-1` production package proves that hidden-route restrictions stay dormant and that its real coding-driven professional route activates code, timer, response completeness, allowed timer leave, and testlet leave-once atomically across memory, file, and SQLite. A dedicated production-built SQLite/Chromium gate now drives the same current Player through the visible Beginner-to-Professional reroute, code entry, timer/leave-lock presentation, completeness denial, successful allowed leave, and disabled locked re-entry. Broader production schemes and packages remain. |
| 3 | P0 | Verona Player-family and API hardening | Add further production Player families and metadata/API edge cases, and broaden compatibility evidence beyond the hash-pinned IB feasibility snapshot. The IB runtime now executes interactively and its Unit state survives participant reloads; visual answer restoration remains unavailable because the upstream feasibility Player never applies supplied Unit state on start. |
| 4 | P1 | Workspace batch edge cases | Add broader replacement graphs outside the now-guarded import/assembly paths. Guided ambiguity diagnostics carry an opaque revision of the exact workspace file population shown to the operator; every selected retry must echo it, and any intervening replacement/upload/delete fails closed as `source_document_workspace_dependency_selection_stale` until the ambiguity is refreshed. The final automatic dependency snapshot and manually reviewed assembly now reserve their source package plus lineage event atomically against the complete source-package/activity revision in memory, file, SQLite, and PostgreSQL. A concurrent upload, replacement, deletion, or second assembly therefore returns a retryable conflict without a partial aggregate; store races prove exactly one package/event pair can win a revision. Source deletion closes its separate request-time race as well: the application hashes every dependency-relevant file state and assembly/replacement edge used for readiness, all stores compare that revision atomically with import/release guards, and PostgreSQL serializes reference mutations on the workspace row. Store tests cover both a newly added root and an in-place root-document change; the existing durable API matrix retains request-order-independent multi-level deletion with failed-root retention. Replacement lineage also distinguishes retained audit history from live successors: deleting a rejected replacement and its failed import cannot leave the valid predecessor falsely superseded. A three-generation rollback proves that deleting a live chain tip reopens only its direct predecessor for another replacement while the original remains superseded by its still-live child across every durable API store. Broader replacement-lineage behavior remains. |
| 5 | P1 | Additional system-check variants | Reconcile more original system-check definitions, report sets, and embedded Player families beyond the currently pinned 18.0 configurations. |
| 6 | P2 | Remaining presentation combinations | Gate uncommon historical package-defined participant text and presentation combinations that are outside the complete current participant/monitor catalogs already implemented. |

The adaptive-plus-restriction gate starts from the hash-pinned current upstream
booklet, retains its Unit, coding scheme, and Verona Player byte-for-byte, and
applies only schema-valid Booklet additions in the test package. It asserts
compiled restrictions,
adaptive visibility before and after coding, absence of hidden-route timer/code
effects, the activated code and timer lifecycle, completeness denial without
side effects, allowed timer cancellation, leave-once re-entry denial, and the
four corresponding Original-compatible test-log families. Its independent
SQLite/Chromium companion proves the same composition through the actual
Participant route and current Verona 6.0.5 Player: the hidden Professional
restrictions remain absent on the Beginner path, real answers trigger the
coding-derived route, the code gate starts the timer, incomplete navigation
stays in place without locking, and a completed response leaves the block while
cancelling its timer and disabling the locked Professional Unit. The upstream
sample Unit is hash-verified before the browser package adds `required` to its
first otherwise-all-optional input; this minimal definition change makes the
real Player expose both sides of the authored response-completeness rule.

## Capability delivery evidence

The following table retains the detailed implementation evidence that led to
the current queue, including capabilities that have since reached `done`.

| Historical order | Priority | Recorded capability | Detailed delivery evidence |
| --- | --- | --- | --- |
| 1 | P0 | Original package dependency corpus expansion | A pinned 14.3/15.1/17.4/17.6/18.0 corpus now gates 115 booklet imports, including the historical and current three-Booklet root Sample packages, the historical 17-case and current 27-case `CY_Bklt_TC-*` controller packages, all four legacy `CY_Bklt_BkltConfig_*` package variants plus all 51 current 18.0 BookletConfig cases, both historical and current two-booklet/five-unit/12-login Session-Management packages, the current official Adaptive package, the current two-booklet Aspect sample, and both the historical and current Group-Monitoring booklet packages with their participant, scoped monitor, and two profiles. The complete current 13-file upstream E2E fixture directory is independently byte-pinned: both valid 18.0 Booklets, the current same-ID collision, the 18.0 roster without SysCheck, eight invalid XML documents, and the standalone resource execute across memory, file, and SQLite while their historical generations remain intact. The current root Sample package pins all three 18.0 Booklets, both 17.4 Units, Verona 6.0.5, both 18.0 SysChecks, and the expanded 18.0 roster; its added `test2` account and participant/monitor ViewSettings plus dependency delivery and both SysCheck report flows run across memory, file, and SQLite. The current 27 Controller booklets, all five current Units, Verona 6.0.5 Player, and the byte-exact current 18.0 36-login `CY_Logins_TestController.xml` roster additionally run as one activated workspace package across memory, file, and SQLite; real Demo, Review, Hot-Return, and Hot-Restart accounts prove mode policy, code/time enforcement, response restoration or clean restart, and monitor visibility, while the historical package remains independently pinned. The legacy four-account BookletConfig package remains independently gated, while the current package activates all 51 Booklets with the current five-Unit source pool, Verona 6.0.5 Player, and byte-exact 51-account roster; isolated real accounts prove one-to-one assignment plus the current fullscreen and browser-navigation semantics across all three stores. The current 18.0 Session-Management package proves password and second-code gates, ordered multi-booklet assignment, access-window normalization, Verona 6.0.5 resolution, and hot-return/hot-restart re-entry with response restoration across all three stores. The current Group-Monitoring package proves that its empty legacy monitor password remains a passwordless migration candidate, requires a new secure operator password during explicit account creation, retains both profiles exactly, and preserves group-isolated reads/commands plus participant-visible pause/resume/go-to/lock/unlock behavior across memory, file, and SQLite. The corpus also covers version-aware Unit and SysCheck XSD facets, DefinitionRef/player/player-resource/VariablesRef cross-validation, both prebuilt and loose multi-file execution of the original `Booklet2.xml` + `Unit2.xml` + coding scheme + Verona 6 dependency set, byte-exact import and execution of the current `CY_Bklt_Adap-1.xml` + current Unit/coding scheme/Verona 6.0.5 graph with its real two-account roster, byte-exact import and execution of the current two-Booklet/four-Unit Aspect graph with its 18.0 roster and real multi-booklet second-code login, the original differently named but byte-identical duplicate-Booklet-ID fixture plus case-insensitive typed Booklet/Unit/SysCheck, semantic Testtakers-roster, IMS manifest resource, and Verona `module-id + major.minor` resource-identity rejection at upload and inside prebuilt ZIPs, a loose five-file Booklet → Unit → definition/player → original `.itcr.zip` resource snapshot through exact and range Participant delivery in memory/file/SQLite, a full loose SysCheck → Unit → coding scheme/player snapshot with browser-side response capture, import plus browser execution of the complete original three-unit Aspect booklet with the 3.2 MB 2.12.3 player and a 16.17 MB media-heavy Voud definition, and separately provenance-pinned official `verona-player-simple` 1.0.1/API-2, 2.1.0/API-3, 4.0.0/API-4, and 5.2.0/API-5 plus historical ABI 3.3.0/API-2.1, current ABI 5.0.0/spec-5/runtime-API-4, historical Speedtest 1.2.0/spec-5/runtime-API-4, current Speedtest 3.3.0/API-5.2, and current Aspect 2.12.6/API-6 packages; remaining work is more production packages, rare file-graph constraints, and further real-player families. |
| 2 | P0 | Testlet adaptivity | Original adaptive state definitions, condition aggregations, persisted `BOOKLET_STATES`, `Show` routing, nested `Testlet` paths, participant-assignment state presets and same-booklet preset variants, server-side IQB coding-scheme derivation, `CodeToEnter` gates, server-authoritative `TimeMax` execution with configured warnings, durable `LockAfterLeaving` rules, and dimension-wise `DenyNavigationOnIncomplete` inheritance now extend the versioned runtime model. Schema-aware imports reject a State without the conditionless fallback required by the original and reject unsupported State/Option/condition attributes or children instead of silently changing the route; `or` remains the original Score-only fallback. Every tracked response variable now exists as the original `UNSET`/`null` value before its first player response, so initial Status/Value conditions and Score fallbacks route correctly before server coding replaces them; a present empty status retains its distinct raw value instead of being coerced back to `UNSET`. Repeated variable IDs across IQB subforms follow the original ID-only, ordered last-write-wins rule before coding. Server-coded `CODING_COMPLETE` is gated through both textual and original status-rank comparisons. `Mean` preserves the Original operand-by-operand division order before six-decimal truncation, including a boundary case where sum-first arithmetic would select a different route. Original-comparable `Value` semantics are now gated for null, booleans, deterministically sorted numeric/string arrays, aggregate `NaN`, aggregate `Infinity`, and shallowly accepted malformed values without empty-string coercion. Adaptive extraction also follows the current Original's case-sensitive IQB-standard type recognition and package-level response range (`min=1`, `max=1`): lowercase Major 1 responses can select a route, while persisted Major 2+ or differently cased Player state remains available for restoration without changing Booklet States. The current official Adaptive package and byte-exact `CY_Logins_Adap.xml` roster run all five upstream scenarios across the store matrix: default Beginner, value-driven Professional, coder-driven Advanced, Review preset with Bonus, and Review override to Advanced without Bonus. The production-built SQLite/Chromium gate additionally combines its real coding-driven route with a schema-valid code gate, timer, response lock, allowed leave, and leave-once lock through the visible Participant UI. Broader production schemes and packages remain. |
| 3 | P0 | Participant execution-mode completion | The six original participant modes now share an exact capability matrix and govern import, sessions, saving, restrictions, open-run/study-monitor visibility, remote commands, participant-authored test/unit/task-page reviews with priority, multi-category metadata, immutable browser/original-unit provenance, and editable adaptive paths in Demo/Review/Trial. The current Original `showCode` flag is enforced as a visibility boundary rather than an unlock shortcut: Demo, Review, and Trial expose the authored code beside an empty, still-locked input, while Hot Return, Hot Restart, and Simulation omit it from the participant contract and DOM; all modes require a successful server-side entry. The current non-enforcing timer boundary is likewise exact: Demo/Review/Trial omit the `confirm` dialog, show the Original test-mode explanation, interrupt `confirm`/`forbidden` timers with stable remaining time while outside the block, and resume only on re-entry; `allowed` still cancels the timer. Non-saving modes keep Verona responses in memory just long enough to satisfy enforced presentation/response locks, navigate, derive the active adaptive path, and complete, while omitting response rows, Player logs, outbox entries, and browser session snapshots. Reopening a non-saving Demo, Review, or Simulation run reuses its run but restores its response-free automatic path and fresh restriction state: current Unit, closed code gates, timers, timed closures, leave locks, and monitor unlocks are reconstructed exactly as at launch; explicit adaptive choices and Review comments remain available. Completion presents a terminal browser projection but persists that same run as open and freshly reset, matching the original starter's reusable `running` test instead of consuming the booklet assignment. The official 36-account Controller roster now independently exercises its four declared modes against the exact assigned original booklets as a complete workspace package. |
| 4 | P0 | Verona resource and delivery hardening | Original nested `.itcr.zip` packages now reach players through `directDownloadUrl`, including browser gates for byte-exact full, HTTP single-range, and bounded `multipart/byteranges` fetches from the originless sandbox; participant resources advertise byte ranges, return exact `206`/`416` responses, expose range headers through CORS, and answer the multi-range preflight required for media seeking. Separately uploaded original `.itcr.zip` packages also resolve transitively from loose Unit dependencies into an audited immutable workspace snapshot, with exact lineage, extraction, current-state projection, and full/range Participant delivery gated across memory, file, and SQLite. The pinned original Verona 6 sample runs its real unit definition in the Angular host, persists raw responses and Player logs, drives adaptive routing, restores state after reload, forwards debounced window-focus state into test-wide `FOCUS` logging, and keeps failed or page-close-pending saves in a durable browser/Service-Worker outbox for automatic reconnect, reload, and closed-view delivery. The separately pinned official `verona-player-simple` 1.0.1 gates a real API-2 handshake, legacy meta-element ready declaration, object-valued `dataParts.all`, top-level `playerState`, `targetRelative` navigation, and `unitCount`-controlled Player navigation. Version 2.1.0 gates a real API-3 handshake, early JSON-LD import, object-valued legacy `dataParts`, Player-originated forward/back navigation, return restoration, and full reload restoration in Chromium/SQLite. Official versions 4.0.0/API-4 and 5.2.0/API-5 independently gate the experimental `$schema`-only and metadata-2.0 formats, string-valued `dataParts`, the same navigation path, return restoration, and reload restoration. The independent official EVA 1.0.0 Player validates canonical historical HTML metadata at import and gates an API-2.1 session despite its published Ready bug: the host corrects a reported module version only when it exactly matches embedded metadata whose API declaration is supported; arbitrary incompatible versions remain rejected. Its JSON-string `allResponses` state survives a production Chromium/SQLite reload. The original IQB Aspect 2.12.3 player independently gates an API-6 handshake across its complete three-unit booklet, a text and radio response with page state, four embedded images from a 16.17 MB definition, host navigation in both directions, and reload restoration. The current official Aspect 2.12.6 release independently combines metadata 2.0/spec 6.0/runtime API 6.0 with the byte-exact current Original sample Unit, persists all three JSON-string `iqb-standard@1.0` data parts, and restores text, radio, and page state after reload. Separately reported player/unit states are merged, foreground navigation cannot starve behind eager autosave, and the Participant UI keeps a typed current-state cache instead of repeatedly parsing production-sized definitions. A scope-limited, installable App-Shell Service Worker restores the cached Participant frontend after a real offline reload without caching APIs or test content, and uses a separate bounded IndexedDB queue plus Background Sync for pending responses. Stable delivery IDs make repeated API submission idempotent for responses, Player logs, and audit activity. Bundled JSON-LD metadata is validated against the early `@id`/`@type`/`apiVersion` draft, the experimental `$schema`-only shape, legacy 1.x/2.x, and strict 3.0/3.1 field structures; the declared API version gates compatibility, while a reference suffix is matched to the module's SemVer major/minor version. Metadata-free legacy players import with an explicit warning because only the runtime handshake can establish their API compatibility. Additional player families remain. |
| 5 | P1 | Workspace file administration | Package-backed files are browsable/downloadable, classified by the five original content types, filterable in API/CSV/Angular, and support guarded aggregate deletion plus immutable replacement. Replacement package and lineage edge are reserved atomically against the exact workspace source-package revision in memory, file, SQLite, and PostgreSQL; concurrent requests cannot create two active successors, an already superseded package fails closed, and only the latest lineage tip can be replaced. Matching the Original workspace table, operators can sort the complete filtered read before its limit by file name, stored size, or upload time in either direction; the choice persists in Angular and the CSV export uses the same deterministic order. The list contract also separates total filtered matches from the returned limit and carries a complete workspace health summary: valid, pending, invalid, and warning-bearing files plus the same status counts for every Original type and the rewrite package type remain visible in Angular even when filters exclude them from the current window. The original unrestricted multi-file picker and upload queue are represented by a bounded 200-file best-effort flow: files are read and sent sequentially as byte-preserving Data URLs, `.voud`/`.vomd` and HTML media types are inferred deterministically, later files continue after an individual duplicate or validation error, and Angular reports live processed/selected progress, the exact current file, a distinct workspace-refresh phase, and every final accepted/rejected item while retaining successful files for reviewed assembly. The picker is disabled during the active batch. A production Chromium/SQLite gate holds the fourth request to prove the intermediate 3/4 state, after first proving that a successful upload can make the immediately following differently cased filename fail as a duplicate without rolling back that mutation or stopping the remaining real `.voud` definition and extension-unknown binary resource; the latter also retains byte-exact download and refreshed workspace projection. The original multi-file delete workflow is likewise represented by a bounded, role-protected Angular selection and API batch report: each exact-name-confirmed aggregate is rechecked independently, safe files and unused derivatives are deleted and audited, while still-used, missing, disallowed, and unexpected outcomes remain separated for retry. Matching the Original's recursive file-relation guard, a loose Unit/resource/Booklet dependency now remains undeletable while an active, non-superseded workspace source references it; readiness and the delete mutation expose the exact referencing source-package ID, and deletion succeeds after the referencing root is removed. Current unique graphs are derived before import, while the latest audited guided snapshot retains the exact chosen relationship through ambiguity and moves the blocker only after a replacement has actually been selected in a new import. The mixed-success delete path is gated in production Chromium/SQLite and the API contract, including dependency deletion, is gated across memory, file, and SQLite. Source detail derives a typed direct/transitive graph across assembly members and imported booklet/system-check/unit/resource relationships. A loose Booklet or SysCheck import resolves a unique transitive workspace chain through Unit, player, definition, variables, coding scheme, and player resources into an audited immutable dependency snapshot. Ambiguous legacy names return structured candidate IDs instead of guessing; Angular offers one action per candidate, the server rejects invalid, duplicate, root, and unused selections, and the chosen package is carried through any later ambiguity until the remaining transitive chain is complete. API and production Chromium/SQLite gates prove the selected immutable snapshot contains the root, the chosen candidate, and all unique downstream dependencies while excluding the rejected alternative. Result administration now has its own group inventory below. |
| 6 | P1 | System check hardening | Current byte-exact 18.0 `SysCheck.xml` definitions import without creating an empty test release. The current byte-exact 18.0 `CY_SysCheck_2.xml` adds the original same-workspace two-check starter: Angular selects both checks independently, runs measured and configured-skipped network paths, reports an unanswered required field without trapping the participant, renders all six question types, executes the resolved Verona item, saves with the check key, and keeps report statistics/deletion isolated by check. Runtime compilation preserves both textual and numeric XML Schema boolean spellings for `skipnetwork` and question `required` after validation. The public cache-disabled server-time contract reproduces the Original clock check against the configured participant IANA timezone; Angular highlights deviations from 60 seconds and timezone mismatches and retains both values in the report, with an explicit warning fallback when time is unavailable. The same environment stage applies the Original 800 × 600 minimum screen-resolution warning and report IDs, and now captures the Original's UAParser-derived CPU, device, browser/version, operating-system/version, navigator, and available plugin fields in label order. Chromium forces a complete mobile identity and proves those values through capture, durable detail, and CSV export. The API path is gated across memory, file, and SQLite. Loose SysCheck, Unit, coding-scheme, and Verona files resolve into audited immutable snapshots; the referenced Unit definition/player are retained with each check and missing packaged Units fail with a stable diagnostic. Imported `sys-check-login` candidates become isolated workspace accounts that support concurrent device sessions and authorize report saving under the login name without exposing the report key. Configuring any such account activates the original instance-wide login mode, hides the anonymous flow, resolves the authenticated workspace scope, and closes the report-key API path. The byte-exact original `SysCheck-Report.json` is pinned and migrates through API and Angular while preserving its source date, filename, file timestamp, section order, scalar values, and original check label; legacy BOM/semicolon CSV plus JSON-with-`fileData` exports are reconciled against it. Operators can select up to 200 report files or an original report directory, receive per-file migration failures, safely resume without duplicating unchanged files, inspect OS/browser/rating distributions, and delete selected check report sets. Additional original configurations and player families remain. |
| 7 | P2 | Attachments and QR capture | Every Original Unit BaseVariable with `type="attachment"` now survives ZIP import with its authored optional format and appears in the role-scoped inventory for every started run, matching the original discovery path. `capture-image` entries additionally provide the complete durable camera workflow: API and Angular support missing/captured status, PNG/JPEG upload, inline preview, deletion, and a copyable handoff code, while other formats stay visibly conserved without unsafe capture controls. The upload route accepts both the rewrite JSON contract and the original capture client's binary-safe `multipart/form-data` field. Operators can download one or all scoped A4 QR pages with the original seven label placeholders. The lazy mobile capture route now scans those codes by live camera or QR image, verifies the target through the existing operator/group scope, captures or selects a photo, previews it, and confirms the protected upload. |
| 8 | P2 | Branding and custom-text presentation | The original instance title, expiring global warning, resettable logo, three audience themes, editable start-page HTML, and independent `Impressum`, `Datenschutz`, and `Barrierefreiheit` HTML, global < Testtakers/Login < active Booklet participant-text precedence, and global < authenticated monitor-login precedence for the complete 58-key `gm_*` contract are now usable. The eight original image slots have a platform-admin registry and global assignments, with Testtakers Group/Login assignments taking precedence for Participant presentation. Angular renders the resolved logo, login/code illustrations and companions, starter/completed cards, loading progress, and confirmation-dialog image; assigned global assets are deletion-protected. Angular also applies all 58 monitor keys, presents sanitized configured HTML on participant entry and three separately routed public information pages, and exposes all three links from every shell. The complete instance-branding surface is API-, store-, and production-browser-gated. |

The latest source-to-corpus inventory confirms that every Booklet, Unit,
Testtakers, SysCheck, Group-Monitor, Session-Management, Aspect, Verona 2–5,
ABI, EVA, DAN, STARS, and IQB coding fixture family available in the local original
repository is represented. An audit of the upstream repository at
`a5a6d25a72990d667300804c337cc5b500b01d2f` additionally pinned the previously
missing Adaptive system-test Booklet, roster, current Unit, coding scheme, and
Verona 6.0.5 Player byte-for-byte. The same audit now also pins the changed
18.0 Aspect roster and Booklet 1 plus the new Booklet 2, fourth Unit, and both
changed/new definitions. It now also pins the current BookletConfig cases 1–4,
all five shared Unit documents, Verona 6.0.5 Player, and the expanded 51-login
roster. The current two-Booklet Session-Management graph and its 12-login roster
are now pinned as 18.0 documents against those same current dependencies. A
follow-up audit at `65d28718eb6474cf5158206494096d32cd3393f9` refreshes the
current Test-Controller package to all 27 Booklets and its exact 36-login roster;
the nine upstream-refactored cases use only `toolbar_show_unit_list`, and they
execute with the current shared Units and Verona 6.0.5 Player. The current
root Sample package now also retains its three
Booklets, two Units, two SysChecks, Verona 6.0.5 Player, and expanded roster
byte-for-byte, including the added `test2` login and nested ViewSettings. Every
current upstream `sampledata` path and every changed member of the audited
Adaptive, Aspect, BookletConfig, Group-Monitoring, root Sample,
Session-Management, and Test-Controller graphs are therefore represented;
further expansion requires additional production packages or newly introduced
upstream samples.

The upstream BookletConfig system-test matrix has since grown to 51 variants.
The rewrite now pins and imports every current 18.0 BookletConfig case 1–51:
fullscreen 1/2, browser navigation 3/4, completeness 5–10, header content 11–14, header visibility 15/16,
termination locking 17/18, global navigation 19–26, page restoration 27/28,
Unit navigation 29–33, Page navigation 34–39, and toolbar, timer, and silent
presentation 40–51. The current 51-Booklet package is additionally activated
with its byte-exact 51-account roster and one-to-one participant assignments
across memory, file, and SQLite. Together with the independently retained
original four-booklet package, the complete locally available legacy/current
BookletConfig matrix is now gated.

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
`booklet_errormessage`, bounded technical detail, and the Original's fixed
`Neu laden` action remain. Recovery performs a full page reload, restores the existing
session and response, and uses a tab-local marker to persist exactly one
`CONTROLLER=ERROR` followed by `CONTROLLER=RUNNING` after the replacement Player
starts successfully. The production-built SQLite/Chromium gate proves the DOM
boundary, disabled entry commands, fixed reload label, de-duplicated error log,
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
recovery, completion, and Starter restoration across that boundary. Matching the
Original long-list Starter, an intersection-driven `Unten geht es weiter`
control appears only while the remaining actions are below the viewport,
scrolls them into view, and then removes itself; the compact-height production
browser gate proves the complete visibility lifecycle.

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

Latest P0 adaptive comparable-value closure: a full import, launch, response,
persisted-state, and current-state gate now reproduces the Original's esoteric
`Value` comparisons for null, booleans, sorted numeric and string arrays, and
aggregate `NaN`/`Infinity` across memory, file, and SQLite. Runtime conversion
also retains an otherwise unsupported object value instead of coercing it to an
empty string, so malformed Player data cannot accidentally activate an authored
`Value equal=""` route.

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
original `introHtml`, `legalNoticeHtml`, `privacyNotice`, and
`accessibilityNotice` contract now adds bounded, public, platform-admin editable
content without copying HTML into the audit trail;
Angular deliberately uses its built-in HTML sanitizer instead of the original
frontend's trust bypass. Participant entry renders the configured introduction,
and every shell links to separate public `Impressum`, `Datenschutz`, and
`Barrierefreiheit` routes with truthful empty states. API coverage proves public
defaults, tenant-admin denial,
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

Latest P0 legacy-encoding closure: declaration-driven XML decoding no longer
stops at Node's browser-oriented WHATWG set. A production `iconv-lite`
fallback now accepts the valid IANA `ISO-8859-16`/Latin-10 and DOS `CP850`
aliases used by older source systems, while an explicit allowlist prevents
iconv transport codecs such as base64, hex, CESU-8, or UTF-7 from becoming XML
declaration encodings. The representative Booklets retain Romanian, German,
Euro, and umlaut labels through the complete import/release projection in
memory, file, and SQLite. Other IANA encodings outside the WHATWG and explicit
fallback sets remain the bounded gap.

Latest P0 international legacy-encoding closure: the explicit non-WHATWG
boundary now also accepts registered DOS `CP437`, Central-European `CP852`,
and Euro-enabled `CP858` names and aliases without broadening access to
`iconv-lite` transport codecs. The same complete Booklet import/release gate
now proves the existing WHATWG Windows-1251, Shift_JIS, GB18030, Big5, and
EUC-KR paths instead of merely assuming runtime decoder availability. German,
Czech, Cyrillic, Japanese, simplified and traditional Chinese, Korean, and
Euro labels survive their source bytes across memory, file, and SQLite.

Latest P0 malformed-encoding closure: supported XML encodings now require valid
source byte sequences rather than accepting decoder replacement characters.
Direct Data URLs reject malformed declared/default UTF-8, UTF-16, UTF-32, and
Shift_JIS with the stable `source_document_xml_encoding_invalid_bytes`
diagnostic; declaration-free XML still honors an explicit Data-URL charset.
The same validation runs before structural parsing inside ZIPs, preventing
cascading diagnostics from corrupted replacement text. A mixed archive proves
that one invalid-byte Unit removes only its dependent Booklet and Testtakers
roster while a complete sibling graph and roster remain importable across
memory, file, and SQLite.

Latest P0 document-wide XML-ID closure: Booklet `Metadata/Id`,
`CustomText/@key`, and `Config/@key` now share the `xs:ID` uniqueness boundary
declared by the Original XSD. Duplicate keys within one section and collisions
across sections fail with `testcenter_xml_booklet_schema_id_duplicate` before
config normalization can silently choose a value. The same boundary covers
Unit `Metadata/Id` versus `Variable/@id` through schema 14.9 and SysCheck
`Metadata/Id` versus `CustomText/@key`; Unit variable IDs become independent
`xs:string` values with schema 14.10. Direct-upload and nested-ZIP paths are
both pinned against the executable Original schema behavior.

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
schema position. Validation follows the declared generation: through 15.1.5,
`TimeMax` remains a positive integer without `leave`; 15.1.6+ adds the explicit
`forbidden`/`confirm` leave policy, and 16.3+ additionally accepts `allowed`
plus a positive fractional duration. Adaptive restriction extensions remain
independently versioned from 15.4.

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

Latest P1 original monitor-log closure: the current Original logging contract's
remaining server/controller events now share the durable TestLog stream. Every
successfully applied `pause`, `resume`, `goto`, `terminate`, or
`terminate lock` monitor command records `command executed` with the Original's
space-joined command spelling; monitor test locks record `locked by monitor`
with the authenticated operator ID. Protected single and bulk command routes
ignore a caller-supplied actor in favor of the verified account, while open-auth
development retains its explicit fallback. The API gate executes pause, lock,
unlock, resume, go-to, and atomic completion, then proves exact event contents,
test-wide scope, and non-spoofable actor identity alongside the already gated
`LOADCOMPLETE`, `CONNECTION`, TestState, UnitState, and Player log families.

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

Latest P0 Verona shared-parameter closure: matching the current Original
unithost and Test Controller service, Verona 6
`playerState.sharedParameters` are normalized and merged by key into durable
test-wide state, logged as `SHARED_PARAMETERS`, and returned to every Player in
both `vopStartCommand.playerConfig` and live
`vopPlayerConfigChangedNotification` updates. Memory, file, and SQLite API
gates prove overwrite/extension semantics; a production SQLite/Chromium gate
publishes values in one sandboxed Unit, consumes them in the next, overwrites
and extends the map, and restores the exact result after reload. SQLite schema
55 and PostgreSQL schema 49 persist the state independently from per-Unit
responses.

Latest P0 player-family closure: the compatibility corpus now also pins the
official MIT-licensed IQB ABI 3.3.0 and 5.0.0 scripted-survey, EVA 1.0.0 scripted-survey,
current Aspect 2.12.6 assessment, DAN 3.0.0 and 3.1.0 visual-assessment,
STARS 0.6.19 and 0.7.2 choice-interaction,
historical Speedtest 1.2.0 and current Speedtest 3.3.0 timed-choice, and Lottie
1.2.2 shared-parameter Players. Both ABI generations retain their release
examples byte-for-byte; ABI 3.3.0 persists JSON-string `allResponses` through
API 2.1, while current ABI 5.0.0 separates metadata spec 5.0 from runtime API 4
and persists an `iqb-standard@1.1` array through JSON-string `allData`; both
the current Aspect release and current Original `testcenter-sample1.voud` are
byte-pinned independently. Aspect declares metadata 2.0/spec 6.0, negotiates
runtime API 6.0, and restores text, radio, and page state while retaining its
three JSON-string `iqb-standard@1.0` data parts. Both DAN releases use the
byte-exact `G231mm.voud` definition from a pinned official
Testbed commit. DAN 3.0.0 negotiates API 2.1 through legacy JSON-LD, while
current DAN 3.1.0 declares metadata 2.0/spec 5.0, negotiates runtime API 4,
retains the release's embedded `3.1.0-beta` module version, and continues to
round-trip the historical `IQBVisualUnitPlayerV2.1.0` JSON-string `all` state;
the historical STARS package uses a byte-exact
radio-button definition from its own release tag, while the current official
0.7.2 release uses its byte-exact BUTTONS option-text definition from the same
tag. Import and production SQLite/Chromium gates negotiate
Verona APIs 2.1, 4, 5.2, and 6, persist text, radio, multiline, and choice answers, and
restore them after reload. The versioned response envelope records each data
part's original string/object value kind, so ABI's and EVA's JSON-string `allResponses`,
DAN's JSON-string `all`, both STARS generations' JSON-string `responses`, and
the Simple Player's object-valued state all round-trip correctly. STARS 0.7.2
additionally gates `stars-unit-definition@5.3` and `iqb-standard@2.0` with the
release and source assets pinned to tag, commit, byte size, and SHA-256. EVA additionally gates canonical
historical HTML metadata validation and the published release's Ready bug: the
host replaces its reported module version 1.0.0 with the embedded supported API
2.1.0 only when the two declarations match exactly, while arbitrary incompatible
versions remain rejected. A separate production
SQLite/Chromium Speedtest gate proves its unusual metadata-2.0/spec-5.0 and
runtime-API-4 combination, imports its official plain-text definition, retains
the selected value and elapsed time in JSON-string `main`
`iqb-standard@1.0` state, follows automatic forward navigation, reports the
Player's final-Unit navigation denial, and restores the answer after host
navigation and reload. The current official Speedtest 3.3.0 release is pinned
byte-for-byte with its tag, commit, release URL, size, and SHA-256, plus a
source-derived executable two-question JSON definition. Import preserves the
official definition-type/version mismatch while the Player negotiates Verona
API 5.2. Its production gate merges JSON-string `question_0`, `question_1`,
`sums`, and `activeQuestionIndex` state without Player-specific rewriting,
resumes on the next question after reload, and follows the Player's automatic
navigation into the next Unit. The separate current Original Speedtest
system-test package at `6455e265421777124f379090257365b70b21641f` pins its
Player, two Units and definitions, seven-entry nested Booklet, and real
password-protected roster byte-for-byte. Import and participant-start gates
execute the complete three-testlet graph across memory, file, and SQLite. A
production Chromium/SQLite gate additionally completes all three 10-minute
blocks and all 21 questions, confirms every timed exit, verifies the three
alias-scoped question and summary states, reaches the final instruction alias,
and restores every intermediate instruction position after reload. The
official Lottie release is byte-pinned while its
minimal executable definition is derived from pinned Player sources. Its
production gate fetches the required nested avatar resource, publishes an
avatar choice, follows automatic navigation, extends the test-wide shared
parameters in a second Unit, and restores the exact values after reload. The
metadata-3.1 compatibility layer is deliberately narrow and warning-bearing:
it accepts this release's legacy `$schema`, lowercase module type,
`notSupportedFeatures`, and singleton dependency object while retaining strict
rejection of unrelated properties or malformed values. A separate production
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

The corpus additionally pins the official `verona-modules-ib` 0.2
ItemBuilder migration feasibility snapshot, its generated Simple definition,
and a deterministic `.itcr.zip` containing DIPF runtime 9.9.0. Participant
resource responses deliberately omit `X-Frame-Options` only on this
session-scoped route, while retaining `nosniff`, `no-referrer`, CORS, and range
support. The two exact runtime files are SHA-256 allowlisted at delivery: the
HTML adapter normalizes only opaque messages from the immediate parent, and the
runtime script uses a wildcard response target only for that same parent.
Stored package bytes stay unchanged, unrelated HTML stays byte exact, and range
requests operate on the adapted representation. A focused Chromium/SQLite gate
now proves visible controls, two real user interactions, `iqb-standard@1.4`
state capture, durable participant state, and runtime reload. This remains a
compatibility characterization rather than a production-release claim: the
upstream repository is explicitly a feasibility study and its Player never
applies supplied Unit state on start, so visual answer restoration cannot be
claimed for this snapshot.

Latest current-Original closure: the byte-exact STARS system-test package is
pinned at its introducing Testcenter commit with Player 0.6.40, Unit,
Voud/Vomd definition, 28-alias Booklet, and four-account roster. Import accepts
the package's current `https://w3id.org/iqb/spec/unit-xml/...` schema URL and
validates the nested 18.0 `ViewSettings` structure. API coverage starts the real
hot-return account against all 28 aliases and preserves its participant theme
and alternative-symbol keypad settings; production SQLite/Chromium coverage
persists `iqb-standard@2.0` responses, follows the Player's continue request
from alias `1` to `2`, and restores the second selected option after reload.
The browser outbox now retains up to 200 validated per-Unit entries instead of
discarding this package above its eighth alias. A dedicated production gate
proves visible-Unit-first foreground delivery for all 28 aliases, mirrors all
28 entries into IndexedDB on page close, replays them idempotently, and clears
both the page and Service-Worker queues. With the save route unavailable, the
same gate now also performs an actual hard reload, retains every inactive Unit
response byte-exactly, restores the visible Player response semantically after
its JSON reserialization, and reinstalls the Service Worker before the
page-close path. The reload now carries two valid participant runs and all 56
alias-scoped responses at once: opening the first session drains only its
visible Unit and remaining aliases while retaining the second run exactly;
opening the second then drains its own visible Unit first and clears the final
queue. A separate mid-drain interruption allows exactly seven responses to
settle, blocks the remaining 21, hard-reloads the active Player, idempotently
clears its semantically equivalent visible-Unit reserialization, and proves
that exactly the 21 unconfirmed responses survive before the final drain. A
capacity-boundary gate fills all 200 browser-outbox slots, rejects a 201st
independent Unit without evicting any previously secured response, exposes the
failed save, and proves an explicit retry reaches the server. The final
interruption gate terminates the complete Chromium browser process after its
origin store has settled, relaunches from the same persistent profile, and
proves that all 28 responses drain without a `pagehide` handoff.
The older STARS 0.6.19 pair and current official STARS 0.7.2 package remain
independent-family gates alongside this Testcenter-pinned graph.

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
the historical outcomes record supplied non-Base response statuses and signed
code/score values, while the current Original integration deliberately removes
those values from the coding input and recalculates the derived response from
tracked Base variables.
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

Latest current P0 coding closure: the coding stack used by the current Original
is now matched at `@iqb/responses` 5.2.2, `@iqbspecs/coding-scheme` 3.4.1, and
`@iqbspecs/response` 2.0.0. A deterministic compatibility artifact pins all 188
official coding documents and executes all 75 input/outcome cases from the
exact responses source commit. It covers the five cases added after 3.6.0 for
circular dependencies, `UNIQUE_VALUES` with intended-incomplete sources, the
fifth matching scenario, valid empty responses, and unknown response IDs, as
well as the changed numeric-null and intended-incomplete coding results. Import
stores the normalized current scheme, expands condition-tracked variables to
their indirect Base dependencies, ignores untracked Player response IDs, and
passes only tracked Base responses to the coder. Player-authored derived or
unknown values therefore remain in the raw restorable envelope but cannot
override server-derived adaptive routes, matching the current Original flow.

Latest P0 Unit-metadata dependency closure: the pinned original Aspect package
now includes the two byte-exact `.vomd` documents referenced by
`Unit/Metadata/Reference`. Automatic loose-file resolution follows those
references alongside Booklet, Unit, Voud, and Player dependencies, producing a
ten-file audited immutable assembly whose downloadable snapshot retains both
metadata documents unchanged. A partial chain with a missing `.vomd` fails
with `source_document_workspace_dependency_incomplete` and names the missing
path. The complete graph and failure path run across memory, file, and SQLite.

Latest P0 merged-leave-confirmation closure: current Original commit
`90ec58845d84` includes the Unit/Test-Controller guard fix introduced at
`6c125a96ec99`. Returning from an active Unit to the Starter now evaluates a
forbidden timer before asking to end the test and folds a confirm-timer or
confirm-leave-lock decision into the single test-return dialog. One approval
authorizes all simultaneously active leave consequences, so neither competing
nor sequential dialogs can appear. The three current Original leave-prompt
defaults from `229036f3bf91` also omit the redundant final question. A
production SQLite/Chromium gate cancels the merged dialog without mutation,
then approves it once and proves that both the timer cancellation and Unit lock
arrive in the same atomic return request and paused run.

Latest P1 invalid-operator-session closure: current Original commit
`8bc420e71df8bb146fd4f0eb6c4fb73255fbcd26` resets stored authentication and
reloads the application after an invalid session error instead of leaving a
dead operator surface behind. The
Rewrite now handles `401 admin_session_invalid` centrally for JSON and download
requests: only a request carrying the persisted operator token can trigger the
reset, and the token, stale session projection, and access notice are removed
from memory and Local Storage before one page reload. The protected
SQLite/Chromium session-batch gate signs a second browser in as a workspace
administrator, revokes that exact live session from the platform-admin browser,
then proves that the affected browser receives the server rejection, reloads to
operator sign-in, and retains neither token nor stale session data.

Latest production-frontend closure: the Angular root shell no longer imports
the Workspace, Content, Runtime, and Ops lifecycle before a feature route is
opened. Shared browser/session state is hydrated immediately, while feature
refresh, monitor streaming, and the Workspace, Content, Runtime, and Ops
services resolve on demand instead of forming one shared eager feature chunk.
The dedicated Start surface is another independent lazy route. Global error
capture and confirmation state remain immediately available, while their
standalone dialog surfaces load only on first use. The optimized production
initial bundle is now 448.35 kB raw and 114.33 kB estimated transfer, down from
the 563.85-kB eager-feature baseline. A tightened 450-kB
warning and 470-kB error budget now turns a material regression back into a
build signal; direct routes, offline Participant startup, Runtime SSE, and
cross-feature navigation remain browser-gated.

## Capability matrix

### Participant access and session lifecycle

| Capability | Original evidence | Rewrite status | Priority | Rewrite evidence / gap |
| --- | --- | --- | --- | --- |
| Direct participant links | `e2e/Session-Management/login-possibilities.cy.ts` | done | P0 | generated `/participant` links and opaque session re-entry links retain explicit tenant/workspace scope. Matching the upstream SM-3/SM-4 flow, the Original `/#/<Login>` shorthand resolves an exact login only when it occurs in one stored workspace roster, rejects zero or cross-workspace matches without guessing, preserves the normal password/code/access/release gates, and opens the signed-in Starter rather than silently selecting one of several Booklets. It also clears stale browser scope, replaces the hash with the canonical Participant URL, and is covered by API plus production SQLite/Chromium smoke |
| Username with optional password | same | done | P0 | saved roster password hashes and participant sign-in. Matching the upstream SM-1/SM-2 flow, a normal login with exactly one available or in-progress Booklet immediately opens that run; a multi-Booklet login and the Original legacy-short-link route retain the Starter selection instead |
| Two-step extra code | `app-root/code-input`, `XMLFileTesttakers.class.php` | done | P1 | original `<Booklet codes="…">` mappings trigger a password-first code challenge; valid codes select their coded assignments plus uncoded assignments, distinct codes reuse only their own durable session, and configured alternatives are not returned to participants. Matching the upstream SM-5/SM-6 flow, a valid code continues directly into the only code-scoped Booklet from either the normal form or the Original `/#/<Login>` shorthand, while ambiguous multi-Booklet assignments retain the Starter; API plus production SQLite/Chromium gates cover missing, invalid, and valid codes |
| Multiple assigned booklets in source order | `starter.component.ts`, `XMLFileTesttakers.class.php` | done | P0 | every `<Login><Booklet>` assignment persists with a stable identity, including differently preset variants of the same source booklet; starter exposes available/in-progress/completed state and one session runs them sequentially |
| Resume after reload/interruption | hot-return E2E flows | done | P0 | running and participant-paused sessions resume and restore unit, Verona unit state, player page state, and response; monitor-paused sessions remain paused across direct Resume, session re-entry, and durable-store restart until a monitor continues them. The official Session-Management SM-7 fixture proves that repeated hot-return sign-in reuses the same session and run with its saved response, while SM-9 proves hot-restart creates a clean session and run. The production Chromium/SQLite Controller gate additionally exercises real `Test_Ctrl-3` and `Test_Ctrl-7` Player answers: Hot Return reuses the session/run and restores the selected answer, whereas Hot Restart creates clean session/run IDs while retaining the prior answer in its original run and filtered response export. A versioned browser outbox preserves unsent responses independently per Unit across transient disconnects and hard reloads, overlays the visible Unit before the Player remounts, then prioritizes that Unit and drains every remaining Unit after online re-entry. Page closure mirrors every pending Unit for the run into the Service-Worker queue instead of only the foreground draft. A production SQLite/Chromium gate proves three-Unit foreground recovery order plus three-Unit IndexedDB handoff and delivery across the complete active path of the official adaptive sample. The full Original STARS gate additionally retains two valid 28-Unit runs and all 56 responses across one hard reload, drains only the opened run, then proves the untouched second run drains visible-Unit-first when its own session opens. It separately reloads while a 28-Unit drain is in progress and proves that seven confirmed responses stay removed while exactly the remaining 21 survive and finish. A complete Chromium browser-process termination followed by relaunch from the same persistent profile proves all 28 queued responses drain without `pagehide`. After one online visit, the installable, versioned Service Worker also serves the cached Participant App-Shell and lazy route across a browser-proven offline reload, with a truthful connectivity notice; API state and test content remain network-authoritative, and a never-visited device still requires an initial connection |
| Valid-from, valid-to, valid-for | time-limited-access E2E | done | P1 | original group attributes and JSON/CSV aliases persist as normalized timestamps; scheduled/expired logins return the original-equivalent 401/410 statuses, `validFor` starts at first session creation without reset after close/release changes, the earlier relative/absolute end wins, runtime calls recheck persisted expiry, all store adapters persist it, and API plus browser tests cover the policy |
| Admin and participant login sink/rate limiting | login-sink E2E, `SessionController`, `CacheService` | done | P1 | admin sign-in now reproduces the original global username sink: five failed credentials block the next attempt for 30 minutes by default, correct credentials cannot bypass it, every blocked attempt is audited, and the counter is atomically durable across memory, file, SQLite, and Postgres. Password-protected participant accounts retain their separate tenant/workspace/login counter shared by sign-in and starter launch; unknown/passwordless participant logins do not increment it. Both paths expose configurable thresholds/windows and stable 429 details plus `Retry-After`; API gates run the admin path across memory, file, and SQLite, while restart tests cover file and SQLite persistence |
| Supported-browser warning | `SystemController::getConfig`, `UserAgentService`, upstream `a7843f05` | done | P2 | the exact generated current 18.3.0 browser list from upstream `236217815` is pinned alongside browser-family parsing, semantic version comparison, acceptance of newer releases, and rejection of outdated/unknown browsers. Chrome/Edge 150–151, Firefox 140/153–154, iOS Safari 26.5–26.6, and Safari 26.5–26.6 form a tested compatibility contract. Matching the Original's higher-version rule, Firefox 140 remains the effective ESR floor while the current regular-release entries advance; Safari 26.4 is now rejected. Angular confines the accessible warning to the unauthenticated Participant login state, removes it from the global shell and signed-in Starter/Player, has no obsolete dismiss control, and resolves the current `login_unsupportedBrowser` default plus global placeholder overrides. A focused production Chromium gate proves the route boundary and exact outdated-Chrome copy |
| Central error report | `ErrorComponent`, `BugReportService` | done | P1 | application and Angular-global errors open an accessible central report surface with error ID, timestamp, build, browser/device, parameter-free URL, stack, and a bounded previous-error buffer. Users can inspect, copy, or download `bug-report.txt`; optional direct GitHub issue delivery is server-configured, rate-limited, timeout-bounded, and exposes neither its token nor raw provider failures to the browser. Shared client/server redaction removes URL credentials/query/fragment, Bearer/JWT values, passwords, cookies, tokens, secrets, and API keys before delivery, while operational request logs retain only paths rather than potentially sensitive query strings. Contract and API integration tests gate sanitization, size bounds, secret/config isolation, query-free logging, and the safe disabled configuration; a production SQLite/Chromium gate triggers the global handler, inspects the redacted report, confirms disabled direct delivery, and downloads the exact filename |
| Layered custom texts | `docs/pages/custom-texts.md` | partial | P2 | original file-level `CustomTexts` are parsed once, attached to every participant and operational login, persisted by every adapter, and returned on sign-in/resume. The exact current 41-key participant catalog from upstream `031b3313` is the versioned compatibility contract, including original defaults and sequential `%s` formatting. The removed `login_unsupportedBrowserBanner` is no longer accepted or rendered; current `login_unsupportedBrowser` carries its replacement default on Participant login. The current Original's four Starter action labels, two login-side texts, and two second-code error texts are applied in Angular. Matching upstream `fa2a1514`/`8bf6c9f8`, a protected block renders the global `booklet_codeToEnterPrompt` and authored `CodeToEnter` text separately and the removed `booklet_codeToEnterWarning` is neither advertised nor rendered. XML plus native JSON maps/value objects/key-text arrays support inherited defaults and participant overrides; Booklet XML/JSON now retains its own direct custom-text map. Angular applies matching text to booklet selection, second-code login, supported-browser warnings, fullscreen, code gates, task lists, Verona unit/block loading and failure guidance, the original page-navigation prompt, five-second timer start/expiry/cancellation notices, timer warnings, leave locks/prompts, navigation denials, pause, resume, and completion states. Leave/timer title and prompt keys now render together in labelled in-app dialogs instead of native browser prompts. The three current 2026-08-18 Original leave-prompt defaults omit their redundant final question because the dialog buttons already express that decision. The effective participant scope follows the original global < Testtakers/Login < active Booklet order; the Booklet layer starts only with the run, while system-check-specific text overrides global text on that surface. Production Chromium gates both separated code texts and current login/error/Starter labels on the real Participant path, plus both leave prompts on their real Verona page controls, check-specific text on SysCheck, and effective participant text on the active run. Matching upstream `a9166f32` and `623da15f`, the obsolete participant console warning and `booklet_console_warning` key are absent. The complete original 58-key `gm_*` catalog and defaults now form a second versioned contract. Imported Testtakers monitor text survives the password-redacted migration candidate, account creation, every store, and sign-in, then overrides global settings for the authenticated monitor. The focused Angular console actively applies all 58 keys to its headline, commands, core columns, summary/group context, profile view/filter presentation and pending/locked indicators, monitor-start and password-verified scheduled/expired labels, batch-selection counts, command tooltips and confirmed unlock feedback, target-timer state and confirmation, scroll/hide controls, and typed broken-booklet errors; sequential `%s`, `%date`, and `$date` substitution and original German defaults are contract-tested. Scheduled and expired operator accounts expose their concrete access boundary and login-scoped copy only after successful password verification, while unknown accounts and wrong passwords keep the generic credential response. Broken legacy runs remain visible and distinguish missing booklet IDs, missing release entries, malformed booklet snapshots, and unavailable releases without taking down healthy monitor rows; unsafe commands are withheld for those runs. The controller-error recovery action uses the current Original's fixed `Neu laden` label, and the non-catalog `booklet_reload` key is absent. Matching upstream `ccacee3a`, the obsolete misspelled locked-unit button key is absent and the code-input action uses the fixed `Weiter` label. Matching upstream `6ee8a53e`, the five ineffective granular loading keys are absent; the Verona host retains accessible queued, indeterminate, and exact 100%-loaded milestones with fixed UI copy, while only current `booklet_loading` remains customizable and the browser smoke gates the real phase order without inventing unavailable byte percentages. |

### Participant player and booklet runtime

| Capability | Original evidence | Rewrite status | Priority | Rewrite evidence / gap |
| --- | --- | --- | --- | --- |
| Independent Player-family gates | official ABI, Aspect, EVA, DAN, STARS, Speedtest, Lottie, and IB repositories plus Verona Player Testbed | partial | P0 | twelve provenance-pinned packages cover historical ABI 3.3.0, current ABI 5.0.0, current Aspect 2.12.6, EVA 1.0.0, historical DAN 3.0.0, current DAN 3.1.0, historical STARS 0.6.19, current official STARS 0.7.2, historical Speedtest 1.2.0, current official Speedtest 3.3.0, Lottie 1.2.2, and the IB 0.2 migration feasibility snapshot, importing and negotiating APIs 2.1, 4, 5.2, and 6. Historical ABI and EVA persist text/radio answers in string-valued `allResponses`; current ABI separates metadata spec 5.0 from runtime API 4 and persists an `iqb-standard@1.1` response array in string-valued `allData`; current Aspect executes the current byte-exact Original sample Unit, preserves three JSON-string `iqb-standard@1.0` data parts, and restores text, radio, and page state; EVA additionally validates historical HTML metadata and narrowly corrects its published module-version-as-API Ready bug; both DAN releases persist positioned multiline-text/multiple-choice answers in string-valued `all`, with 3.0.0 using legacy JSON-LD/API 2.1 and current 3.1.0 declaring metadata spec 5.0, negotiating runtime API 4, retaining the embedded `3.1.0-beta` module version, and preserving the historical `IQBVisualUnitPlayerV2.1.0` state type; STARS persists choices in string-valued `responses`, with 0.6.19 using `iqb-standard@1.1` and 0.7.2 gating `stars-unit-definition@5.3` plus `iqb-standard@2.0`; historical Speedtest persists its choice and elapsed time in string-valued `main`, while current Speedtest merges JSON-string question, summary, and active-index data parts, both using `iqb-standard@1.0`; Lottie publishes, extends, and restores Verona 6 test-wide shared parameters across Units while fetching its required nested avatar resource. Production Chromium/SQLite reloads all eleven released packages without Player-specific state rewriting. The twelfth IB snapshot pins the official feasibility source, generated Simple definition, deterministic `.itcr.zip`, and DIPF runtime 9.9.0. A SHA-256-pinned, immediate-parent-only delivery adapter preserves the package bytes and sandbox while Chromium proves nested resource delivery, visible controls, interaction-derived `iqb-standard@1.4` state capture, durable participant state, and runtime reload. Visual answer restoration remains an explicit upstream feasibility-snapshot limitation because that Player does not apply supplied Unit state. Historical Speedtest gates its mixed metadata-2.0/spec-5.0 declaration and runtime API-4 handshake, plain-text Unit definition, automatic forward request, and final-Unit navigation denial. Current Speedtest gates the official 3.3.0/API-5.2 asset, source-derived JSON definition with the published definition-type/version mismatch, multi-question save, next-question resume after reload, and automatic next-Unit navigation. Lottie gates a byte-pinned release plus a source-derived executable definition, automatic forward navigation, and explicit warning-bearing compatibility for its four metadata-3.1 legacy deviations. Separately, the complete current Original STARS 0.6.40 system-test graph executes its 28-alias Booklet and restores `iqb-standard@2.0` responses after Player-originated navigation. Further production families remain |
| Verona player integration | `test-controller`, `unithost` | partial | P0 | sandboxed `srcdoc` host imports embedded JSON and Testcenter ZIP players/definitions, exposes accessible queued, indeterminate document-loading, and exact 100%-loaded milestones before start, and exchanges ready/start/state/navigation/runtime-error/focus messages. Active load or Player failures now promote to the original-style route error guard: Angular removes the complete Unit surface, applies `booklet_errormessage` plus the fixed `Neu laden` recovery action, blocks every other participant command, and performs a full page recovery. Like the original `unithost`, it now updates navigation targets and other mutable Player config through `vopPlayerConfigChangedNotification` without restarting the iframe; disabled Player navigation receives the standardized presentation/response reasons through `vopNavigationDeniedNotification`. Player-originated `previous`, `next`, `first`, `last`, and `end` requests follow their own host-authorized path, so first/last remain usable when the Booklet deliberately hides its Unit menu and host controls. Angular now derives Player-End readiness from both live Player response completeness and the compiled `never`/`last_unit`/`always` Booklet policy, preventing a complete Player from bypassing an authored `OFF` rule while retaining draft-aware enablement without an iframe restart. Player `validPages` and `currentPage` reports now drive the original-style INDEX, LABEL, LIST, hidden, and read-only host controls, including legacy `page_navibuttons` mapping, and host page changes use `vopPageNavigationCommand`. Independently and partially reported Unit state is merged field-wise and data-part-wise like the original buffers, so a later progress-only notification cannot erase an answer or its legacy value-kind metadata. Retiring iframes retain their original session context long enough to accept final `window:unload` state and runtime-error reports; response/log delivery targets that Unit without changing or failing the new Player. Central active-Player and load failures persist the original test-wide `CONTROLLER=ERROR` state through the durable outbox, de-duplicate repeated notifications from one failed frame, and use a tab-local recovery marker to record `CONTROLLER=RUNNING` after a successful full-page Player restart; late retired-frame failures remain attached only to their original Unit and cannot fail the replacement Player. Player-reported runtime errors are bounded and persisted as original-compatible unit logs through the same durable, idempotent outbox as responses. The pinned original Verona 6 sample executes these transitions browser-side: its initially denied Player-End receives `responsesIncomplete`, a complete response enables `end` in the running Player without a second start, and a synthetic active runtime failure reaches the terminal error boundary before recovering the same run and response. That sample also gates its real unit definition, CORS-readable single- and multi-range resource delivery, raw response autosave from separate data/progress/page notifications, durable Player-log forwarding, 500 ms debounced test-wide `FOCUS` logging, adaptive route transition, background-close recovery, and reload restoration. The official Verona API-3 Player independently proves first/last plus previous/next navigation across two Units while both host navigation surfaces are hidden. The same original resource package is now separately uploaded and transitively resolved with its loose Booklet/Unit/definition/Player chain through immutable import and Participant delivery. A second executable gate loads the byte-exact original IQB Aspect 2.12.3 player and all three original 17.4 Unit/Voud pairs, including the 16.17 MB image definition; it combines separately emitted player/unit state, persists text plus radio `elementCodes` and page state, renders four embedded images, crosses all host units forward and backward, and restores the response after reload. A third executable gate combines the current official Aspect 2.12.6 release with the current byte-exact Original sample Unit/Voud/Vomd graph, persists `elementCodes`, `stateVariableCodes`, and `geometryVariableCodes` as distinct JSON strings, and restores its text, radio, and page state after reload. The original Test Controller `pagingMode=buttons` now survives policy compilation and is proven through the player's visible page control. Additional representative player families remain |
| Player API compatibility validation | workspace file admin and unithost | partial | P0 | runtime ready handshake gates Verona major versions 2–6; ZIP import performs version-aware structural validation for the experimental `$schema`-only format, legacy metadata 1.x/2.x, and strict metadata 3.0/3.1, rejects unsupported metadata/API versions and malformed type, identity, language, SemVer, dependency, maintainer, code, or unknown-property fields with stable diagnostics, and correctly distinguishes `player-id@module-version` from `specVersion`. Official Simple Player fixtures prove API 2.1, 3.0, 4.0, and 5.2 through import and browser execution; current ABI 5.0.0, current DAN 3.1.0, and historical Speedtest prove independently that metadata spec 5.0 and a runtime API-4 handshake remain separate declarations, while current DAN additionally proves that release tag 3.1.0 can carry an embedded `3.1.0-beta` SemVer under the same major/minor reference; current Speedtest 3.3.0 independently negotiates API 5.2; the original Aspect fixture proves that module `2.12.3` can negotiate Verona API `6.0`; and the current official Aspect `2.12.6` release independently declares metadata 2.0/spec 6.0 and negotiates runtime API `6.0`. The official Lottie 1.2.2 fixture proves a narrow metadata-3.1 compatibility path: legacy `$schema`, lowercase `player`, `notSupportedFeatures`, and singleton dependencies are structurally validated and reported together as an explicit import warning; unrelated unknown fields remain invalid. Metadata-free legacy players remain importable with a warning because their references cannot prove API compatibility; the official API-2 fixture proves that warning-to-runtime-handshake path, while additional player families remain |
| Booklet/unit navigation | `test-controller` | partial | P0 | ordered units, authored full and `labelshort` labels, current position, nested original `Testlet` hierarchy, and per-unit testlet paths persist. Imported `BookletConfig` compiles menu/button/player-end rules and server-side forward/backward eligibility. The distinct original 17.6 `unit_navibuttons` modes now survive compilation: `FULL` renders previous/next controls plus the direct short-label Unit strip, `ARROWS_ONLY` keeps only previous/next, `FORWARD_ONLY` renders the direct strip plus Next, and `OFF` hides the surface; modern Unit-label and control keys remain independent. Current 18.0 `navbar_backward_button` and `navbar_forward_button` compile independently as `HIDDEN`, `DYNAMIC`, `UNITS`, or `PAGES`; the separate accessible buttons either change the Verona page, change the Unit, or cross the Unit boundary dynamically at the first/last Player page. Contract and pinned import gates cover all eight official cases 19–26, while production Chromium proves dynamic two-page traversal, hidden rendering, and an official `UNITS` transition to the repeated-Unit alias. Direct jumps obey the same completeness, direction, and leave-lock authorization as other Unit navigation. Production-built Chromium gates prove the Aspect booklet's authored `1`/`2`/`3` strip and direct jump, plus the official BookletConfig package's legacy `LABEL` and `OFF` behavior. Original `browserBehaviour=preventNav` is now a typed runtime policy: an Angular popstate-only deactivate guard cancels browser Back/Forward exits during a running Unit while leaving normal test controls and imperative navigation untouched, and presents accessible guidance unless silent mode is active. Original `Show` rules remove inactive routes from the menu/navigation/completion path, Demo/Review/Trial participants can select a durable state override while retaining the automatic recommendation, and unit/testlet leave locks prevent and visibly mark re-entry. The historical 17-Booklet and current 27-Booklet Test-Controller packages are pinned; the current package imports and activates with its five current Units, Verona 6.0.5 Player, and exact 18.0 36-login roster. Representative official accounts gate navigation, code/time enforcement, session reuse/restart, and monitoring across memory, file, and SQLite. A production-built Angular browser gate repeats the complete historical import and proves block-code normalization, the running testlet timer, nested completion locks, and forward navigation with two original accounts. The official API-3 Player gate additionally proves browser navigation cancellation with an unchanged running Unit. The complete original three-unit Aspect booklet independently gates real-player navigation behavior |
| Response and run-state save | test routes and hot-mode E2E | partial | P0 | versioned Verona unit/player-state envelopes and Player logs persist through coalescing autosave, visible retry, navigation, reload, and Participant-view closure; independently emitted Verona unit/player state is merged before persistence, eager background saves yield to foreground navigation, and the Angular Participant facade caches typed state so large definitions are not repeatedly JSON-parsed during rendering. A monitor pause now tears down the Player and rejects participant resume/navigation; a response already secured before that command may drain without changing the paused status or resuming timers. Original `unit_responses_buffer_time`, `unit_state_buffer_time`, and `test_state_buffer_time` values compile with their 5000/6000/1000-ms defaults; the merged rewrite envelope uses the earliest applicable fixed window while every change is secured immediately in the local outbox. Navigation/completion keep the iframe alive through the Player's debounced `stateChanged` window, force the latest outbox payload to its explicit response Unit, and avoid overwriting that delivery with a stale empty foreground draft. The official TC-3 browser account proves that its authored 20,000,000-ms windows suppress background upload but preserve a just-selected answer and durably flush it on immediate Unit navigation. Failed or page-close-pending saves enter a bounded per-Unit local outbox, survive reload, restore the visible Unit first, and drain all persisted Units immediately after reconnect. Page closure mirrors every run entry into the validated IndexedDB Service-Worker queue for Background Sync instead of leaving non-current Units browser-local. Client delivery IDs and deterministic server log/audit IDs make concurrent foreground/worker redelivery idempotent across all stores; production SQLite/Chromium gates prove three-Unit recovery order, three-record offline worker handoff, complete delivery and queue cleanup across the official adaptive sample's active path, a separate close-before-buffer-expiry response that remains durable after the renewed Player handshake, run-isolated recovery of 56 pending responses across two simultaneous Original STARS runs, exact 21-entry retention after a hard reload interrupts a partially completed 28-Unit drain, and lossless rejection plus visible retry when a 201st independent Unit reaches the 200-entry browser-outbox boundary. Matching the Original's GeoGebra large-state fix (`5a2abef26`) and 2 GiB ingress boundary without exposing every command route to that attack surface, `save-progress` has its own configurable 64 MiB default JSON limit. A 2 MiB Verona/GeoGebra-shaped response persists and restores byte-exactly across memory, file, SQLite, and Postgres while the ordinary 1 MiB command boundary and an explicit oversized-progress `413` remain independently gated |
| Timed blocks and warnings | time-restrictions E2E | partial | P0 | server-authoritative timers start on actual entry in every execution mode, persist across reload/storage where the mode saves state, pause/resume durably, count down live in the Angular player when `unit_show_time_left` enables the clock, emit five-second alerts at compiled `unit_time_left_warnings` thresholds, and always record expiry. Enforcing modes expire into the next eligible unit, close against re-entry, and apply `forbidden`, `confirm`, and `allowed` navigation/completion rules; non-enforcing Demo/Review/Trial modes retain the same observable timer lifecycle without forced navigation or locking. Matching current upstream `90ec5884`, leaving a non-enforced `confirm` or `forbidden` block interrupts its server timer at the exact remaining second, suppresses the dialog in favor of the Original explanatory notice, and resumes the timer only on re-entry; `allowed` retains its cancel behavior. Operators can restore an audited selected remaining time, and monitoring plus CSV exports expose authored target limits, live timer labels, states, remaining time, leave policies, and lifecycle timestamps. Start, pause, resume, interruption, cancellation, expiry, completion, and operator timer changes also emit original-compatible test-wide `TESTLETS_TIMELEFT` snapshots keyed by Testlet ID with remaining time in minutes. Single and bounded-batch monitor jumps restore a closed target timer atomically with the requested remaining time, validate timed targets server-side, retain the previous lifecycle state in audit details, and use the original confirmation/timer copy in Angular. Participant confirm-leave uses an original-titled in-app dialog with a safe `Stay here` default and explicit `Leave anyway` continuation only when time restrictions are enforced. Returning from a saving-mode Unit to the Starter follows the current guard fix: a forbidden timer blocks before the general return question, while a confirm timer is merged with the test-return decision and one approval can apply an accompanying leave lock in the same atomic request. The complete original `CY_Bklt_TC-*` leave-policy matrix is import-gated, and the production Chromium/SQLite gate executes the official TC-6/TC-7/TC-8 accounts: confirm cancellation and continuation, immediate allowed leave, forbidden UI navigation plus direct-API rejection, durable timer cancellation, and closed-block re-entry protection. The same production gate now executes the complete TC-5 account matrix with real `Test_Ctrl-10/11/12/13/14` accounts: the Hot Return timer demonstrably continues while its leave-confirmation dialog remains open, all five start and expire the authored 12-second timer, Hot Return/Hot Restart automatically advance past and close the block, while Demo/Review remain in the timed Unit and permit navigation plus expired-block re-entry. Review additionally proves the current no-dialog interruption notice, stable paused time outside the block, and resumed countdown after re-entry. The byte-exact `frontend/src/app/test-controller/test/test-data.ts` Booklet from current upstream `21796aa` independently proves that one ten-minute Root timer takes precedence over nested five- and three-minute declarations while two nested code gates and the innermost presentation-only completeness override remain active; leaving that inner block restores the Root response-only rule. The complete sequence is gated across memory, file, and SQLite. Production-scale and adaptive-plus-timing fixtures remain |
| Presentation/response completion locks | booklet config E2E | partial | P0 | Verona progress drives visible forward/backward/completion denial and server-side `409` guards with direction-specific reasons; nested original `DenyNavigationOnIncomplete` values now inherit independently per presentation/response dimension and can override global booklet rules. Matching the current Original controller's `markedNo` handling, adjacent host Previous/Next buttons stay active under an enforced completeness lock: clicking presents the effective custom-text denial while retaining the current Unit and sending no navigation mutation. The embedded Player remains locked and direct API manipulation still receives the authoritative direction-specific `409`; code gates keep their separate disabled-plus-entry-control flow. The same request-without-transition behavior now covers an enforced forbidden timer. The official TC-14 browser flow proves that a required response alone retains this active host control, completing the player's `buttons`-paged presentation unlocks both host and player navigation, and navigation then reaches the next original Unit. The production Chromium/SQLite Test-Controller gate now also executes the complete official TC-9/TC-10/TC-11a/TC-11b Testlet-override matrix and TC-15/TC-16/TC-17a/TC-17b global BookletConfig matrix with the real `Test_Ctrl-18/19/20a/20b/24/25/26a/26b` accounts. It distinguishes unrestricted `OFF`, forward-only `ON`, and bidirectional `ALWAYS`, requires both response and presentation completion where authored, preserves repeated-Unit aliases, and proves denied forward/backward manipulation as direction-specific `409` responses. Demo/Review/Trial retain navigation and surface the exact would-block completeness reasons as a transient test-mode advisory, while Hot/Simulation remain enforced; API mode-matrix and production Angular browser gates cover both paths |
| Unlock code and leave-once rules | hot-mode and leave-block E2E | partial | P0 | original `CodeToEnter` gates block initial entry, navigation, and completion in every participant mode until the Angular participant flow records a per-run unlock. The current execution-mode `showCode` boundary reveals the authored value only for Demo, Review, and Trial, without pre-filling or bypassing the gate; saving Hot modes and Simulation expose neither the participant API value nor a DOM copy. Every successful saving-mode participant entry emits the original test-wide `TESTLETS_CLEARED_CODE` snapshot, and replaying an already accepted unlock does not duplicate it; non-saving re-entry closes the gate again. Original `LockAfterLeaving` unit/testlet scopes and optional confirmations persist and block re-entry. Their Unit/Testlet titles and prompts use labelled in-app dialogs; a production browser slice proves imported overrides, cancellation without state change, and explicit confirmation. When returning to the Starter, the leave-lock prompt is folded into the saving-mode test-return dialog; if a confirm timer is also active, its higher-priority prompt is shown once while both consequences are authorized together. The production Chromium/SQLite Test-Controller gate additionally executes official TC-12/TC-13 with their real `Test_Ctrl-21/22` accounts, proving safe confirmation cancellation, confirmed Unit locking, automatic Testlet locking only after its boundary, disabled backward controls, durable lock arrays, and direct-API re-entry rejection. Every participant navigation or completion that activates a lock also emits the original test-wide `UNITS_LOCKED_AFTER_LEAVE` sequence-ID or `TESTLETS_LOCKED_AFTER_LEAVE` testlet-ID snapshot. Supervised go-to clears target locks/codes and whole-run monitor unlock durably clears/bypasses both; monitor re-lock restores authored rules for subsequent actions without recreating already consumed one-time gates or cleared locks |
| Adaptive booklet states | adaptivity E2E | partial | P0 | original XML states select the first matching option and schema-aware import requires at least one conditionless fallback per State, matching the original file constraint instead of treating the final conditional option as an implicit default. The importer also enforces the original State/Option/If/source/aggregation/Is attribute and child surface, including Score-only `or`, rather than ignoring unsupported routing syntax. IQB-standard Verona variables are evaluated through `Value`, `Code`, `Score`, `Status`, `Sum`, `Mean`, `Median`, and nested `Count`; every tracked variable is initialized to the original `UNSET`/`null` response before the first save, including the configured Score fallback, present empty status values retain the Original's distinct nullish semantics instead of being treated as `UNSET`, and repeated IDs across ordered subform data parts follow the original ID-only last-write-wins behavior before coding. Server coding is proven to move those initial and repeated-ID routes plus textual `Status=CODING_COMPLETE` and its original numeric rank through persisted state selection. The Original `Mean` evaluation order is retained exactly: each summand is divided before accumulation and the result is then truncated to six decimal places. Full import/run/save/current-state gates prove the route-changing IEEE-754 boundary, null/boolean/sorted-array comparable values, aggregate `NaN`/`Infinity`, non-coercion of shallowly accepted malformed values, plus the current Original package's case-sensitive `iqb-standard` recognition, min/max boundary, and empty-status equality behavior across memory, file, and SQLite: lowercase Major 1 participates in adaptive selection, whereas Major 2+ and differently cased type names remain persisted for Player restoration but cannot change the route. `Show` routes are enforced server-side and the Angular unit menu is restricted to the active path; ZIP-relative `CodingSchemeRef` dependencies are retained in immutable releases and the current Original's pinned `@iqb/responses` 5.2.2 stack derives tracked codes, scores, and indirect variables from normalized schemes and tracked Base responses before routing. Its complete 188-document/75-case official coding corpus is executable, including all five post-3.6 cases and the changed numeric-null and intended-incomplete results; untracked or Player-supplied derived values remain restorable but cannot override the server coder. The historical byte-exact official 3.6.0 `test/coding/derive` tree remains pinned across 11 `CONCAT_CODE`/`COPY_VALUE`/`MANUAL`/`SOLVER`/`SUM_CODE`/`SUM_SCORE`/`UNIQUE_VALUES` scheme variants and all 23 inputs/outcomes, including versionless wrappers, aliases and same-ID variables, chained/manual/decimal derivation, copied arrays and unset values, derived code/score, every uniqueness processing combination, and exact status/value routing across memory, file, and SQLite. The pinned original `Booklet2.xml`, `Unit2.xml`, `coding-scheme.vocs.json`, and Verona 6 player form a separate executable import-to-routing compatibility gate; the server persists the original-equivalent `BOOKLET_STATES` snapshot at launch and after response saves, emits those complete snapshots as original-compatible test-wide logs with idempotent delivery replay, restores or backfills the durable state across memory/file/SQLite/Postgres stores, and uses it authoritatively for participant and monitor routing; original Testtakers `Booklet state="…"` presets and differently preset variants of one booklet are validated, assigned stable identities, and exposed consistently to starter, player, history, monitor, and CSV; broader production schemes and packages remain |
| Runtime display/fullscreen options | booklet config E2E | done | P1 | compiled policy drives unit menu/buttons, Verona paging/logging/page restore, configured booklet/block/unit headers and unit-title visibility. Current `header_hidden` policy removes the global Participant toolbar while retaining a standalone, actionable application logo, the independent Unit title, and essential runtime/leave controls; old runtime snapshots default safely to a visible header. Original `navbar_unit_label` now renders the active Unit as a position, authored label, or no navigation label while leaving its independently configured controls intact; contract/API gates cover all modes and the production official API-3 Chromium flow verifies the label updates across Player-originated navigation. Original `loading_mode=EAGER` blocks the first Player mount until a participant-scoped request has transferred every Booklet Unit definition and its deduplicated Player HTML; `LAZY` retains the small current-Unit request and immediate start, then deduplicates and retains the remaining Booklet assets in the background. The production API and official API-3 Chromium gates verify the asset sets and visible ready milestone; the LAZY Chromium gate additionally holds the background response until the Player is running. Active timed blocks honor time-left visibility and warning thresholds, while booklet-requested fullscreen prompts and toolbar controls enter/exit the browser API with a visible unsupported/error fallback. Original `silent_mode` suppresses participant denial notices plus timer lifecycle and warning messages without weakening server-authoritative restrictions, and `toolbar_show_reload_button` exposes a browser-tested full-page reload that restores the active session/run. All four original `CY_Bklt_BkltConfig_*` files now run as one activated package with the byte-exact official roster: their assigned accounts verify every authored policy variant, three- versus 120-second timer startup, repeated-unit aliasing, first/last/never Player-End eligibility, ordinary completion, termination locking, and monitor visibility across memory, file, and SQLite. A production-built Angular browser gate imports every current case 5–51 and independently opens all four legacy official accounts plus current cases 11–18 and 27–51 against the package, including a repeated-Unit transition, both completed and monitor-locked termination outcomes, and OFF/ON Player-page restoration after a round trip to the repeated-Unit alias, and all current Unit-label, Unit-control, Page-label, Page-control, Unit-title, Unit-list, fullscreen, reload, time-left, and silent-mode presentation variants, and verifies their actual menu, host-navigation, header, unit-title, fullscreen, time-left, alias, and Verona Player-End presentation. |
| Execution modes | `definitions/test-mode.json` | done | P0 | all six participant modes use a versioned copy of the original capability matrix; Testtakers XML plus JSON/CSV aliases persist the mode through roster, session, run, SQLite/Postgres migrations, runtime state, monitoring, and CSV exports. `alwaysNewSession`, response/Player-log persistence, code/timer/navigation enforcement, menu/time visibility, open-run/study-monitor visibility, remote-command eligibility, editable state options, and participant-authored test/unit/task-page review CRUD with original priorities, multi-category selection, and immutable browser/original-unit provenance are server-authoritative and API/browser-gated. The current `showCode` field is distinct from navigation enforcement: Demo, Review, and Trial show the code but remain locked until it is entered, while Hot Return, Hot Restart, and Simulation never receive it. Timer lifecycle tracking is likewise independent from enforcement, so non-enforcing Demo/Review/Trial modes still expose authored countdown and expiry while retaining unrestricted completeness navigation. Byte-exact SM-7/SM-8/SM-9 roster fixtures independently gate the original hot-return and hot-restart mappings, and the official TC-5 production-browser matrix gates timed Hot Return, Hot Restart, Demo, and Review behavior. The production Chromium/SQLite gate additionally executes the real `Test_Ctrl-1b` and `Test_Ctrl-2a` accounts: Demo 1b exposes its code but still requires explicit entry, its ephemeral Player answers survive forward/back navigation but reset with timers, the current Unit, and the closed code gate on same-run re-entry; Review 2a starts without a gate, while 2b and 2c gate the text-field and symbol-keypad variants. Review comments remain durable and Review Player responses/logs remain absent |

Latest P1 System Check network-profile closure: browser connection hints now
follow the Original standard/Mozilla/WebKit fallback chain, omit absent optional
fields, and emit the exact `bnni-fail` warning when the browser exposes no
profile API. Failed measurement is classified as `unstable`, while the rewrite's
separate measured application latency keeps its own unambiguous report label.
Production Chromium proves the unavailable profile first, repeats measurement
through `mozConnection`, and verifies the four Original IDs and values through
the durable report detail and semicolon CSV export.

Latest P1 System Check unstable-warning closure: the live network result still
highlights `unstable` as the Original does, but its download, upload, and overall
report entries no longer treat instability as the `warning` flag reserved for
an `insufficient` measured result. Production Chromium forces every speed-test
package request to return 503, verifies that split, removes the fault, and then
continues through the normal measured save/export flow.

Latest P1 System Check required-question closure: matching the Original, an
incomplete questionnaire no longer traps the participant. The report renders
the configured `syscheck_questionsRequiredMessage`, lists only unanswered
required prompts, and disables report saving until those answers are corrected
through Back navigation. Production Chromium gates the incomplete report,
correction, and successful save for anonymous-key and dedicated-login flows.

Latest P1 System Check participant-report closure: before report submission,
Angular now renders the complete captured environment, network, and
questionnaire sections under the Original headings instead of exposing only an
aggregate entry count. Entry warnings remain visible in context. Production
Chromium verifies mobile/browser-plugin and browser-network values plus the
completed questionnaire on this pre-save surface, including the dedicated
system-check-login path.

Latest P1 System Check Verona-response closure: participant report submission
now maps every Player data part to the Original `ResponsesForSysCheck` shape
(`id`, `content`, millisecond `ts`, and `responseType`) and leaves the legacy
`unit` section empty instead of inventing loading-time and raw-envelope rows.
Operator detail renders the real response payload. Production Chromium verifies
the `answers`/`iqb-standard@1.3` row and empty Unit section through durable JSON,
and follows the response text through semicolon CSV export.

Latest P1 System Check step-flow closure: the Original combines the welcome
copy and automatic system-data capture in one first step, then orders the
configured network, Verona Unit/Player, questionnaire, and report stages. The
rewrite now uses that same order and removes skipped optional stages from both
navigation and the visible counter. Production Chromium gates the measured
five-step flow, the `skipnetwork` four-step flow, and the protected
system-check-login three-step flow.

Latest P1 System Check report-availability closure: matching the Original
`canSave`/`savekey` step condition, a non-saveable check now finishes on its
last configured technical or questionnaire stage with disabled forward
navigation. It no longer invents a Report tab or local JSON-download substitute.
The production Chromium gate imports a schema-declared no-save check and proves
that terminal two-step path alongside the existing anonymous-key and protected
account report saves.

Latest P1 System Check report-save closure: matching the Original anonymous
flow, `Bericht senden` now opens a dedicated accessible dialog with blank key
and report-title fields, three-character validation, password visibility,
initial focus, Escape cancellation, and trapped keyboard navigation. Dedicated
system-check accounts retain their direct server-forced-login save. Both paths
show the Original `Bericht gespeichert` one-action confirmation and return to
the application start page 500 ms after acknowledgement. Production Chromium
gates invalid and valid anonymous values, focus restoration, both real saves,
the no-cancel success dialog, redirect, and subsequent protected-route guard.

Latest P1 System Check report-action closure: the participant report now keeps
the Original two-action boundary, `Bericht senden` and
`System-Check abbrechen`. Abort returns to the application start without a
save; the rewrite-only local JSON substitute has been removed, while protected
operator exports remain on their authorized read path. Production Chromium
proves the missing local action, performs a real abort, repeats the same
multi-stage check from clean component state, saves it normally, and retains
the anonymous plus dedicated-login save gates.

Latest participant-review export closure: the Participant starter now mirrors
the Original `Reviews downloaden` flow. Its route accepts only the opaque
participant session, rechecks `canReview` server-side, intersects reviews with
that session's exact run ids, and never accepts workspace, login, or group
filters from the browser. No comments produce `204`; persisted comments produce
the Original V2 dynamic-category CSV with semicolon separators, UTF-8 BOM,
`TRUE`/`FALSE` category flags, and the stable `testcenter-reviews.csv` filename.
API mode/isolation gates use two participants in the same group, while the
production Angular/SQLite smoke proves the starter action, empty feedback, and
the downloaded file after a participant edits a review.

Latest Participant Starter-return closure: the active test's header logo and
explicit action now settle pending Verona state before changing surfaces and
retain the signed-in participant session. Saving modes show a safe confirmation,
persist `CONTROLLER=TERMINATED`, pause at the same Unit for the Starter's
`Fortsetzen` equivalent, and do not race a configured termination lock.
Operator-paused runs can leave the Player without bypassing the pause and retain
the Original's `CONTROLLER=TERMINATED_PAUSED` state. The same server transition
rejects an enforcing `forbidden` timer exit, requires the authored timer/leave
confirmations, applies leave-once locks, and returns a locked Starter projection
when `lock_test_on_termination` is enabled. Demo,
Review, and Simulation instead reset the same run to its response-free initial
route while retaining explicit adaptive choices and Review comments. API gates
cover both execution-mode branches, forbidden timer denial, and whole-test
locking across the store matrix; production Angular/SQLite clicks the real logo,
checks cancellation, returns to the in-progress Starter card, and resumes the
same run ID.

Participant end-button correction: the saving-mode `Complete Test` action now
uses that same Starter-return transition instead of the separate, irreversible
complete API. This matches the upstream `lock_test_on_termination` OFF case:
the same run and responses remain available through `Weiter`; ON still applies
the authored lock. Explicit API/operator final completion remains final. The
browser regression checks draft persistence, unchanged run ID, and re-entry;
the Original BookletConfig OFF/ON expectations distinguish resume from locking.
The local MaP Aspect tryout additionally verified end, resume, and reload with
the existing response unchanged. This does not imply full acceptance of its ZIP.

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
package is UTF-8. Bit-11 names are decoded as strict UTF-8; malformed byte
sequences invalidate the complete archive with the stable
`source_document_zip_invalid` diagnostic, matching the Original's libzip-backed
archive-open boundary. Legacy entries without that flag use the required CP437
mapping. Production API gates reject a malformed flagged filename and encode
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

Latest tenant-wide Testtakers identity closure: matching the Original
`WorkspaceDAO::getGlobalIds()` upload boundary, every case-insensitive Group ID
and Login name declared by a valid standalone XML/current JSON roster or a
Testtakers entry in a prebuilt ZIP is reserved across all workspaces of the
same tenant. Upload, retry, and replacement paths fail with stable login- or
group-specific conflicts that identify the existing file and workspace, while
another tenant remains isolated. Rejected and deleted packages do not reserve
identities; a successfully accepted replacement supersedes its prior source,
and immutable generated dependency packages do not double-count their retained
root files. API gates cover cross-workspace XML/JSON/ZIP conflicts,
case-insensitive matching, accepted replacement lineage, active-version
attribution, and tenant isolation.

Latest workspace mutation-identity closure: direct upload, failed-import retry,
and immutable replacement now apply the same case-insensitive file-name,
standalone Booklet/Unit/SysCheck/Testtakers identity, and Verona resource-ID
guards before changing persisted source state. A replacement or retry excludes
only its own prior lineage, so another version of the selected file remains
valid while an unrelated third workspace file cannot be duplicated. Rejected
packages and sources superseded by an accepted replacement do not reserve an
active identity. API gates prove successful replacement lineage plus rejected
file-name and Booklet-ID collisions without partially mutating the retry target
across memory, file, and SQLite.

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

Latest legacy-encoding alias closure: XML declarations now accept every
XML-`EncName`-compatible IANA alias registered for ISO-8859-10/Latin-6 and
ISO-8859-14/Latin-8, including the `iso-ir-*`, short `l*`, language, and `cs*`
spellings. Registered year-qualified names containing a colon remain malformed
XML declarations, matching libxml. All accepted aliases stay pinned to the
same single-byte decoder and pass the complete Original import projection with
Nordic and Celtic labels across memory, file, and SQLite; unrelated iconv
transport codecs remain rejected.

International EBCDIC intake now also accepts the IANA-registered IBM500
family (`IBM500`, `cp500`, `csIBM500`, `EBCDIC-CP-BE`, and
`EBCDIC-CP-CH`). The decoder remains an explicit complete single-byte map,
uses the XML EBCDIC signature only to discover the declaration, and then
re-decodes with IBM500 rather than silently treating its punctuation as
IBM037. Every XML-compatible alias imports an international-label Booklet
through memory, file, and SQLite.

| Capability | Original evidence | Rewrite status | Priority | Rewrite evidence / gap |
| --- | --- | --- | --- | --- |
| JSON/XML/ZIP package intake | `WorkspaceController`, file parsers | partial | P0 | staged immutable releases, retry diagnostics, IMS/Testcenter aliases, referenced ZIP content, manifest-resource-ID resolution for original unit references, ZIP-relative IQB coding-scheme dependencies, nested original `.itcr.zip` extraction/delivery, manifestless original root-ZIP assembly, bundled Testtakers roster import, and a pinned 14.3/15.1/17.4/17.6/18.0 corpus whose real adaptive, Session-Management, SysCheck, and complete three-unit Aspect samples bundle complete dependency sets. The Original's 120-byte basename ceiling is applied to direct upload, failed-import retry, immutable replacement, and the final reviewed-assembly `.zip` name; UTF-8 multibyte boundaries and relative-path prefixes are gated explicitly. ZIP entry names follow the declared flag: malformed bit-11 UTF-8 invalidates the package, while legacy CP437 and valid Info-ZIP Unicode Path names remain compatible. Source-package create/replace/retry routes use a separate bounded 72 MiB JSON-body limit, so the enforced 50 MiB extracted-package ceiling remains reachable for base64 uploads without weakening ordinary API commands. ZIP manifest reads remain capped at 5 MiB, while referenced resources use the intended 20 MiB per-entry ceiling: the original 16.17 MB Aspect definition imports byte-exactly and a declared resource above 20 MiB is rejected with a stable diagnostic. Bounded single-disk ZIP64 EOCD/locator records and per-entry size/offset extra fields are accepted within the same ceilings across memory, file, and SQLite; unsafe integers, inconsistent metadata, and multi-disk locators remain invalid. XSD-declared Units block staging when `DefinitionRef`, player, or player-targeted file dependencies are absent, while relative, manifest-backed, and unambiguous original workspace-style names resolve. Root ZIPs containing recognizable Testcenter XML use the same semantic aliases as loose-file assembly across nested folders without weakening arbitrary-archive or explicit-manifest rejection. Mixed ZIPs quarantine malformed, invalid-byte, or dependency-incomplete members before normalization: invalid Unit → Booklet → Testtakers and invalid Booklet → Testtakers cascades retain independent members and complete sibling graphs, while participant roster mutation is restricted to accepted entry paths. Package-wide path, manifest, and identity conflicts remain fatal. Validated Testtakers entries are imported as one password-safe batch and return explicit participant/update/operational-candidate counts. Angular and API accept a loose multi-file upload; importing a Booklet or SysCheck automatically follows uniquely matching Unit/player/definition/variables/coding/resource references, stores the closure as a CRC-valid immutable ZIP with member lineage, and imports it immediately. Ambiguous references expose exact source-package candidates for an operator-guided Angular choice; the validated choice and all remaining unique dependencies are captured in the same immutable snapshot. Automatic and explicit assemblies commit the package and its lineage event atomically only while the complete workspace source/activity revision remains current; a concurrent mutation fails closed without a partial aggregate. Explicit reviewed assembly remains available for deliberate whole-package composition and preserves or synthesizes compatible resource aliases, including modern `id@version-major.minor` and original `id-version-major.minor` player references, but not `id@specVersion`; production package variants remain |
| Text source encodings | XML file readers | partial | P0 | standalone uploads, loose dependency analysis, automatic assembly, file-type detection, and XML/manifest entries inside stored or deflated ZIPs share BOM-, XML-signature-, XML-declaration-, and Data-URL-charset-aware decoding. Base64 and byte-preserving percent-encoded Data URLs both retain legacy source bytes. UTF-8, UTF-16LE/BE, UTF-32LE/BE, ISO-8859-1, Windows-1252, and XML-signature-detected IBM037, German IBM273, international IBM500, and Euro-enabled IBM1140/1141 EBCDIC aliases are supported without corrupting labels; UTF-32 BOMs are resolved before their shared UTF-16 prefixes. Additional declaration-driven WHATWG legacy encodings use the same byte-preserving path; complete import projections explicitly gate ISO-8859-10, ISO-8859-14, ISO-8859-15, Windows-1251, Shift_JIS, GB18030, Big5, and EUC-KR. The allowlisted iconv fallback covers every XML-`EncName`-compatible registered Latin-6 and Latin-8 alias, ISO-8859-16, DOS CP437/CP775/CP850/CP852/CP858, and the IANA-registered IBM855/857/860/861/862/863/864/865/869 families with their XML-name-compatible registered aliases while rejecting transport codecs. XML-standard `ISO-10646-UCS-2` and `ISO-10646-UCS-4` aliases map to the signature-aware UTF-16/32 decoders. Unknown declarations fail explicitly as `source_document_xml_encoding_unsupported` instead of silently falling back to UTF-8. Authoritative BOM/signature conflicts with `encoding=` fail consistently as `source_document_xml_encoding_mismatch` for standalone Base64 and percent-encoded Data URLs as well as XML entries inside ZIPs, while generic UTF/UCS declarations remain valid for either byte order. Supported multibyte encodings are decoded with fatal validation before structural parsing; malformed declared/default UTF-8, UTF-16, UTF-32, Shift_JIS, and other WHATWG sequences fail as `source_document_xml_encoding_invalid_bytes` rather than becoming replacement characters. Original-corpus API gates cover these diagnostics together with standalone legacy bytes, declaration-free charset transport, BOM-less UTF-32, a big-endian UCS-2 Booklet, a little-endian UCS-4 Booklet, a UCS-4 ZIP manifest, Latin-6/Latin-8 aliases, DOS and IBM037/273/500/1140/1141 Booklets with international labels, the ten additional IBM codepages with Baltic, Cyrillic, Turkish, Portuguese, Icelandic, Hebrew, Canadian French, Arabic-presentation, Nordic, and Greek labels, a German IBM1141 IMS ZIP manifest, an EBCDIC declaration/signature mismatch, and mixed-ZIP invalid-byte isolation across memory, file, and SQLite. Remaining gaps are rarer IANA XML encodings outside the WHATWG and explicit fallback sets |
| Original Testtakers XML | `XMLFileTesttakers.class.php` | partial | P0 | the original sample fixture plus byte-exact `CY_Logins_SM.xml` gate participant-versus-operational login modes, groups, password-free and password-protected entry, valid-from/to/for group windows, ordered multiple-booklet assignments, per-booklet second-code mappings, original comma-separated multi-state presets, and distinct identities for differently preset variants of the same booklet. Operational `monitor-group`, `monitor-study`, and `sys-check-login` entries are no longer silently discarded: mixed imports return password-redacted migration candidates with group, profile, access-window, and per-login `monitorBookletVisibility` context, and operational-only imports succeed as explicit account-migration input with zero participant changes and audited classification. The Angular Runtime view previews both forms, disables participant-link generation for migration-only input, and renders the candidates in a dedicated migration card. The password-redacted candidate inbox is workspace-persistent across memory, file, SQLite, and PostgreSQL, returned with saved-roster reads, replaced by later roster imports, and automatically restored in Angular without copying password-bearing drafts into Local Storage; the production SQLite browser gate clears local candidate state before reload to prove server hydration. Referenced `Profiles/GroupMonitor` definitions resolve into their original column, density, auto-next, filter-enable, and filter settings, including lossless `not` negation for all XML Schema boolean spellings (`true`/`false` and `1`/`0`). XSD-declaring rosters now reject missing or duplicate profile IDs, dangling references, mixed Booklet/Profile assignments, invalid state syntax, duplicate custom-text keys, non-original column/view/filter/visibility enums, impossible/inverted access boundaries, and non-integer or unsafe `validFor` values; signed zero and negative values follow the Original parser/runtime and normalize to unlimited; omitted view and filter type normalize to the original `medium` and `equal` behavior. The structured Angular editor and guarded admin API use the same `full`/`medium`/`small` view contract. Resolved profiles and the original `visible`/`collapsed`/`hidden` Testheft-list setting are stored with the scoped monitor role in every adapter, returned at sign-in, manually editable in Angular, and applied to the monitor list; legacy role JSON defaults safely to `visible`. Profiles remain selectable in Angular and drive supported run filters, visible columns, booklet-state fields, density, and batch-visible selection, including the original `filterLocked` behavior. Booklet, current block, and current unit IDs/labels are projected from immutable releases for the corresponding original filters, columns, and CSV fields. Original file-level `CustomTexts` are copied to every participant login, persisted by every adapter, restored across sign-in/resume, and resolved against the exact current 41-key participant set throughout matching Angular login, Starter, and Player states; a real SQLite Verona gate covers imported copy, current split code-gate text, second-code error copy, Starter labels, placeholder formatting, code normalization, timer, leave-lock, navigation-denial, and controller-error reload rendering. The admin model supports explicit `group_monitor`, `study_monitor`, and workspace-scoped `system_check` accounts without elevating them to workspace administration; group scope is durable across all stores and assignable in Angular. Supported candidates prepare the exact scoped account form, including `validFrom`, `validTo`, `validFor`, and booklet-list presentation, in one action and complete account creation after the operator supplies a new password, so the source secret is never exposed or copied. Every store persists these access fields; sign-in rejects scheduled/expired accounts, starts relative validity on the first successful sign-in, and caps the session at the earlier configured deadline. Protected browser paths carry original monitor and system-check logins through migration and route isolation; system-check bearer sessions support concurrent devices and may save reports under their login name only in the assigned workspace, while admin and monitor APIs reject them. Contract, API, original-corpus, and browser gates verify classification, profile and custom-text persistence/application, mapping, password redaction, access enforcement, and the usable migration handoff |
| XML/XSD validation | file parser classes | partial | P0 | well-formed parsing and an executable original-schema compatibility profile now validate top-level XML and every XML entry in ZIP dependency bundles, rejecting wrong roots/metadata, missing identities/labels/definitions, Booklet/Unit/SysCheck `Metadata/Id` values that violate the Unicode XML `xs:ID` lexical space, document-wide Booklet Metadata/config/custom-text ID collisions, pre-14.10 Unit Metadata/variable ID collisions, SysCheck Metadata/custom-text ID collisions, unsupported login modes, case-insensitive type-local duplicate Booklet/Unit/SysCheck file IDs, duplicate group/login/testlet/unit-runtime/variable/question keys, invalid generation-specific `TimeMax` values/leave policies, completion enums, lock booleans/scopes, missing or incompatible coding-scheme targets, Unit definition/player/player-resource/VariablesRef targets, packaged SysCheck Unit targets, variable types/IDs/attributes/value structures, Testtakers monitor-profile identity/reference/enums and state presets, ordered SysCheck metadata/speed/question/custom-text config, and the Testtakers content model with stable diagnostics. Original XML with an orphaned XSI declaration now matches the source backend's missing-location fallback: it emits a warning and validates against the locally pinned 18.0 compatibility profile instead of bypassing semantic checks, across direct package, roster, and nested-ZIP intake; fully declaration-free legacy/native XML retains the existing permissive path. Booklet `TimeMax/@leave` follows the declared XSD boundary: absent through 15.1.5, restricted to `forbidden`/`confirm` from 15.1.6, and extended with `allowed` from 16.3; the accepted historical value is retained in the runtime snapshot across memory, file, and SQLite. Booklet validation now covers the complete generation-specific root `xs:all` member set and singleton cardinalities plus ordered Metadata, CustomTexts, and BookletConfig structures; direct XML and generated nested ZIP dependencies accept schema-valid root permutations while unknown attributes, invalid or document-wide duplicate `xs:ID` keys, nested elements in simple content, and unsupported root/container children fail before policy or custom-text normalization. Unit validation follows the official 14.3/15.1/17.6 schemas for ordered Metadata and its cardinalities, deprecated `Lastchange` plus current timestamp attributes, versioned Transcript/Reference/page/alias support, 14.3 XML-ID variable keys, exact nested attributes, and text-only schema-declared Definition/reference/dependency fields while preserving the explicitly untyped value payload elements. XSD-profiled rosters reject unsupported or out-of-order direct and nested children, repeated Metadata/Description/CustomTexts/Profiles/GroupMonitor or ViewSettings singletons, empty CustomTexts and Group login lists, assignments placed after ViewSettings, unknown attributes on every supported nested element, element children inside text-only Description/CustomText/Filter/Booklet/Profile fields, and character data in element-only Testtakers containers and monitor-profile definitions instead of silently merging or ignoring them. SysCheck validation applies the same lossless boundary to Metadata and Config ordering/cardinality, known attributes, safely representable integer speed settings, XML-ID custom-text keys, and text-only speed/question/custom-text values. Adaptive Booklet state graphs additionally require one `States` container, schema-compatible non-empty state/option IDs, at least one option per state, unique state and per-state option IDs, and every `Show if/is` edge to resolve to a declared state option instead of silently hiding content. Their recursive `If` trees require one variable or aggregate source followed by `Is`, executable `of`/`from` references, at least two homogeneous `Value`, `Code`, or `Score` inputs for `Sum`/`Median`/`Mean`, at least two conditions for `Count`, numeric fallbacks/bounds where the runtime performs numeric evaluation, and every `from` value to match the exact Booklet Unit runtime key (`alias`, otherwise `id`). Matching the Original backend test and parser, an attribute-free `Is` remains schema-valid and contributes no executable comparison or package-level variable dependency, so its enclosing option normalizes exactly like the source parser rather than failing import or inventing a truth value. Adaptive `Score/@or`, `Is/@greaterThan`, and `Is/@lowerThan` values now also honor the exact XML Schema float spellings `INF`, `-INF`, and `NaN`, while rejecting the non-schema `+INF` spelling. At package scope, every executable resulting `of` edge must resolve to a Base/Derived variable declared inline by the target Unit or in its relative/manifest-backed `VariablesRef`; the same validator covers prebuilt and automatically assembled loose ZIPs. The historical and current pinned E2E fixture generations explicitly gate these branches; the current 13-file set refreshes the declared Booklet, Testtakers, SysCheck, and Unit schema URLs, both valid Booklets, the same-ID collision, the valid alias counterpart, duplicate groups/logins/Testlets/Unit runtime keys, missing Metadata across all four XML document types, and the resource byte path across memory, file, and SQLite. Invalid metadata identifiers and invalid/dangling monitor profiles remain independently gated by the wider historical corpus. VariablesRef paths resolve relative to the Unit or through case-insensitive IMS resource identifiers, while Unit facets are selected from the declared 14.3/15.1/16+ schema generation and XML Schema boolean `1`/`0` values normalize correctly. Versioned schema references newer than the supported 18.0 major/minor boundary fail consistently for direct and packaged Booklet, Unit, SysCheck, and Testtakers XML, while 18.0 and older patch revisions plus historical unversioned references remain accepted; remaining gaps are other rare lexical/attribute facets and less-common file-graph constraints |
| Dependency graph and duplicate protection | `WorkspaceDAO`, files E2E | partial | P1 | package-level deletion readiness exposes active import/release, participant-session/test-run, and loose workspace-source reference blockers before removing a safe package with its unused derivatives. Matching the Original's recursive dependency rule, current unique loose relations are derived even before import; exact guided relations are recovered from the latest immutable assembly audit evidence, remain on the previously selected dependency while a replacement is ambiguous, and move only after a new guided import selects that replacement. A dependency becomes deletable after its referencing root is removed. Unique loose Booklet/SysCheck/Unit/player/definition/variables/coding/resource chains are resolved transitively across workspace files, copied into an automatic immutable aggregate, and audited; the aggregate and audit edge are reserved atomically against the exact workspace revision across all stores, preventing concurrent mutations or duplicate assembly from publishing stale lineage. Normal uploads reject case-insensitive filename collisions, duplicate standalone type-local XML IDs, duplicate semantically identical Testtakers rosters derived from their sorted case-insensitive group/login assignments when `Metadata/Id` is absent, and duplicate Verona-player resource IDs derived from metadata or the legacy filename fallback as module ID plus major/minor version, with a pointer to the explicit immutable replacement workflow. Prebuilt ZIP imports independently enforce the same typed XML, Testtakers-roster, IMS manifest-resource, and Verona-resource identities, reject case-insensitive duplicate archive paths, and reject traversal, absolute, drive-qualified, control-character, overlong, and backslash entry paths before staging. Generated assembly manifests deduplicate case-insensitive aliases for the same selected file. The explicit assembly fallback applies the same safe relative path rule. Automatic loose dependency resolution now gives an explicitly authored normalized path or unique basename precedence over colliding legacy metadata aliases; metadata-free historical HTML players additionally expose their basename without a dotted numeric SemVer suffix, matching the original `IQBVisualUnitPlayerV2.99.2.html` convention without weakening JSON-LD identity checks. Multiple matching legacy versions and true semantic ID collisions fail with a structured diagnostic that names every exact candidate file and source-package ID. Angular requires an explicit candidate action; the API validates prior and new selections, follows the remaining unique transitive graph, records the chosen IDs in the assembly audit, and excludes unchosen alternatives from the immutable snapshot. API and SQLite browser coverage gate this path. Source detail turns both lineage modes plus the latest imported structure into typed graph nodes and directed `assembled_from`, booklet, system-check, unit, player, definition, coding-scheme, and resource edges, including the resolved Systemcheck item; direct/transitive requirements and dependents are calculated, bounded Angular relationship cards link back to related stored files, and the real loose original corpus plus SQLite browser smoke gate both paths. Remaining gaps are rarer cross-file graph and mixed-success batch mutations rather than automatic guessing. |
| Draft validation before activation | workspace admin | done | P1 | import jobs, persisted diagnostics, staged release readiness, roster warnings, activation guard |
| File browser/upload/download/delete | workspace admin files module | partial | P1 | source-package cards expose content-derived original file type, stored byte size, import/release counts, and deletion safety; protected routes serve uploads byte-exactly, preview exact blockers, and require the file name before a store-rechecked aggregate deletion. File type is an exact API/CSV filter, and Angular presents grouped type cards with a persisted type filter. Like the Original workspace sidebar and type panels, a server-derived full-workspace health view now distinguishes valid, pending, invalid, and warning-bearing files overall and per type without undercounting behind the current filter or limit; the list separately reports the complete filtered match count. Selected package detail adds a relationship graph with direct/transitive counts, concrete directed edges, and related-file handoff. Replacement creates and imports a new immutable package while retaining the prior version and auditing lineage. Matching the Original's unfiltered workspace file input, the lazy Angular content route accepts every resource suffix and up to 200 original loose dependencies in one best-effort operation. It reads and uploads them sequentially as byte-preserving Data URLs instead of retaining every large source payload, maps `.voud`/`.vomd` to JSON and HTML files independently of browser MIME guesses, falls back to `application/octet-stream`, reports live processed/selected progress, the exact current file, a distinct refresh phase, every accepted or rejected file, and a refresh failure separately, continues after duplicates and validation errors, and selects successful uploads for reviewed assembly as they arrive. The input remains disabled until the batch and refresh finish. API tests cover classification and every local store, while production SQLite/Chromium holds the final request and proves the intermediate 3/4 progress state after a successful first upload causes the next differently cased filename to collide inside the same operation; the real `.voud` definition and byte-exact binary resource still complete and remain selected for assembly. Browser smoke also covers full health/type counts across a limited filtered window, type views/filtering, dependency rendering, multi-select, exact ZIP download, replacement, readiness, and cascade deletion. Original result data is database-backed rather than a workspace file type and is covered by the separate result-report archive workflow |

Latest Testtakers access-window closure: XML `Group/@validFor` follows the
official signed `xs:integer` lexical space and the Original PHP parser/runtime
split. Explicitly positive values such as `+45` persist as a relative lifetime;
zero and negative values import successfully but normalize to unlimited, while
non-integers and values outside the safely representable runtime range still
fail with a stable diagnostic. Contract and Original-corpus API coverage gate
all three normalization branches.

Latest historical Testtakers schema closure: the validator now follows the
official version boundaries for login roles and identifier types. `monitor-study`
starts at 14.7, `run-simulation` and unrestricted string-valued Login names and
CustomText keys start at 15.1, and `sys-check-login` starts at 15.2; older
declared schemas reject those modes and still require the two former `xs:ID`
values to be lexically valid and document-wide unique, while 15.1 permits the
same string in the two separate key spaces. Positive boundary imports and
negative immediately preceding versions run through the Original-corpus API
gate across memory, file, and SQLite.

Latest Testtakers ViewSettings schema closure: schema 17.6 retains the legacy
`ViewSettings/@monitorBookletVisibility` form, while 18.0 removes that attribute
and accepts only the nested `theme`, `codeInput`, and
`monitorBookletVisibility` elements. The compatibility validator now rejects
the retired attribute under 18.0 instead of silently normalizing it, while a
current nested view-settings import preserves its theme and keypad definition.
The nested `codeInput/length` projection also retains XML Schema's leading-plus
integer spelling (for example `+4`) as the intended safe numeric keypad length
instead of silently falling back to the Rewrite's five-character default;
integers outside JavaScript's exact safe range fail import rather than being
persisted as a corrupt or misleading length.

Latest Testtakers element-content closure: the compatibility validator now
distinguishes the schema's simple-content leaves from element-only complex
containers. Non-whitespace character data in Testtakers, Metadata, CustomTexts,
Profiles, GroupMonitor, monitor-profile definitions, Groups, Logins,
AssetAssignments, ViewSettings, and code-input containers fails with a stable
diagnostic, while text remains valid in the Original's Description, CustomText,
Booklet/Profile reference, Filter, Asset, theme, visibility, type, and length
leaves. Original-corpus API cases pin both the monitor-profile and ViewSettings
boundaries.

Latest remaining XML element-content closure: the same XSD boundary now covers
Booklet, Unit, and SysCheck documents. Character data is rejected in Booklet
root, metadata/config/state/condition/testlet/restriction containers and
attribute-only Booklet Unit entries; in Unit root, Metadata, Dependencies, variable
containers, Variables, Values, and structured Value entries; and in SysCheck
root, Metadata, and Config. Simple-content leaves remain text-capable, as do the
Unit schema's deliberately untyped `label`, `value`, and ValuePositionLabel
payloads. Six Original-corpus negative cases pin root and nested failures across
all three document types without weakening those payload boundaries.

Latest XML enumeration lexical closure: Original enumeration facets derived
from `xs:string` retain exact whitespace instead of applying token-style
normalization. Whitespace-padded Booklet timer-leave, navigation, and leave-lock
values; Unit variable types and dependency targets; SysCheck question types;
and Testtakers login modes, code-input types, and booklet visibility now fail
with their existing stable diagnostics rather than being silently trimmed into
a different valid value. Store-matrix corpus cases pin every affected document
type while numeric and boolean XML Schema types keep their required whitespace
collapse behavior.

Latest adaptive-state element closure: matching Original commit `ca2d3e96a`
and the pinned 17.6 schema, XSD-declared Booklets now reject the retired
`DefaultOption` element. The fallback remains the first ordinary `Option`
without an `If`, which is already required and compiled by the runtime.
Declaration-free legacy XML keeps the existing permissive parser path, so this
tightening applies only where the source explicitly opts into Original schema
validation. An Original-corpus negative case pins the removed element.

Latest historical Booklet-schema closure: adaptive `States`, conditional
`Show`, and `LockAfterLeaving` are accepted from their actual Original 15.4
introduction instead of being incorrectly delayed until 17.x. The independent
16.3 boundary changes `TimeMax/@minutes` from `xs:positiveInteger` to the
positive runtime subset of `xs:double` and adds `leave="allowed"`; 15.4–16.2
retain integer minutes plus `forbidden`/`confirm`. XSD-validated 15.4 and 16.3
positive imports pin compiled states and the fractional allowed-leave timer,
while 15.3 and 16.2 negative cases pin both transition edges.

Latest patch-accurate Booklet-schema closure: Booklet-level `CustomTexts`
starts with schema 13.3, and `TimeMax/@leave` starts at the exact 15.1.6 patch
instead of the whole 15.1 minor line. A 13.3 custom text and a 15.1.6
`leave="forbidden"` timer survive complete import projection, while 13.2.2 and
15.1.5 declarations reject the same elements or attributes across memory,
file, and SQLite.

Latest historical Unit-schema closure: the compatibility profile now follows
the Original's independent 14.x/15.x transitions instead of treating 15.0 and
16.0 as coarse feature boundaries. `Metadata/Transcript` and `Reference` start
at 14.9; arbitrary 1–50 character variable IDs, `Variable/@page`, and
`VariablesRef` start at 14.10; `ValuePositionLabels` starts at 15.1.6;
`Variable/@alias` starts at 15.3; and `json`/`no-value` variable types start at
15.5. Five XSD-declared positive package imports exercise the supported edges,
while the immediately preceding 14.8, 14.9, 15.1.5, 15.2, and 15.4 cases
retain stable version diagnostics.

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
| Group/study overview | group monitor and study monitor modules | done | P1 | group/booklet/unit/participant/run read models, attention queue, expected/not-started roster counts. Authenticated `study_monitor` roles can read and control the full assigned workspace, while `group_monitor` roles can only list, stream, export, and control open runs in assigned groups and open their exact group detail; both are denied general workspace-admin routes, and SSE access is revalidated for scope changes. The Angular shell now derives these access modes from the live session, hides and route-guards workspace/content/admin-management surfaces, skips admin-only participant-detail reads even during `Select + Sync`, and presents a focused scoped command console; a protected browser gate proves route redirection, group isolation, selection, and command readiness with a real `group_monitor` account. The byte-exact original `CY_Logins_GM.xml` plus `CY_Bklt_GM-1.xml` path now proves monitor-candidate migration, profile preservation, assigned-group isolation against a live outside-group run, and an exact scoped command lifecycle across memory, file, and SQLite. Imported monitor profiles, localized view/filter descriptions and selection feedback, original booklet-species projection, profile-driven filter/column/density behavior, adaptivity-aware block choices, and original `autoselectNextBlock` jump preparation are available. Open runs now also project the latest bounded original test-wide state map, advance their server-owned activity timestamp for those updates, derive the complete original monitor super-state priority including the five-minute `idle` fallback, apply `testState`/`state` profile filters to their real values, and visibly surface idle/controller-error/recovery transitions in run, group, and summary views; SQLite/Chromium covers the SSE-driven priority changes without a five-minute wall-clock wait. Their cards additionally expose the current Unit's structured presentation/response progress plus resolved Player page position, label, id and count from the already persisted Verona state, including the same fields in open-run CSV; legacy raw responses remain unprojected instead of receiving fabricated completion. Angular shows these signals as compact always-visible badges and expanded Unit rows. Their Angular cards now reproduce the original neutral paused surface, striped pending/locked and error surfaces, and deterministic Booklet-species hues whenever multiple species are visible; the production Chromium gate covers live Unit progress/page projection, pause projection, and multi-species differentiation. The scoped Runtime view adds a profile-aware summary of visible runs, unique participants, running/paused/idle/locked states, and authorized groups plus actionable group aggregation with booklet, block, timer, and latest-activity context; the real SQLite browser gate proves outside-group exclusion, group-filter handoff, localized presentation, and live pause/resume updates. The study-wide Angular dashboard already renders status distribution, prioritized unit/group/booklet attention, review readiness, explicit not-started participant cards, and matrix/runtime handoffs with browser coverage. The 13 active upstream Group-Monitor command/participant scenarios plus the Study-Monitor start scenario are explicitly traced through protected API and production SQLite/Chromium gates: login/scope, control-all selection, pause, resume, per-run go-to, confirmed terminate/lock, unlock, participant-visible state transitions, study selection, and the study table all execute end to end. The richer attention, matrix, drill-down, review, scale, SSE, and audit surfaces exceed that functional baseline. |
| Participant-by-unit drill-down | study monitor | done | P1 | matrix, filtered drill-downs, response/review handoff, CSV exports, and a 200-row source window kept separate from the operator-selected visible-card limit |
| Near-real-time refresh | broadcaster/group monitor | done | P1 | an authenticated workspace-scoped Server-Sent Events channel publishes versioned initial snapshots, material open-run changes, and heartbeats; the Angular Runtime view exposes connecting/live/reconnecting/polling-fallback/offline state, coalesces push-triggered reads, reconnects automatically, and retains periodic polling only when the channel is unavailable. A separate session-scoped Participant channel now publishes stable current-run revisions and makes monitor pause/resume/go-to/lock/complete transitions visible in an already-open Player without manual refresh; it coalesces state reads, stops with the Participant route, and degrades to quiet three-second refreshes while reconnecting. The Player exposes the channel as an accessible connecting/live/reconnecting/offline status without blocking work, explains automatic recovery and the independent answer-outbox protection, and clears the degraded state after a successful reconnect. Matching the Original controller, semantic channel changes persist as test-wide `CONNECTION=POLLING` or `CONNECTION=WEBSOCKET` logs through that durable outbox and drive the monitor's real super-state without a synthetic operator update. Volatile computed timer countdown seconds and loaded assets are deliberately excluded from stream revisions so they do not create repository/read-model churn. API integration gates both snapshot/change contracts; production-built SQLite/Chromium deliberately fails the first Participant stream request, proves the visible reconnect plus monitor `CONNECTION_POLLING` state, releases the retry, proves automatic live recovery plus `CONNECTION_WEBSOCKET`, then verifies pause, resume, and locked completion while the operator page remains open |
| Pause/resume/complete | monitor routes | done | P1 | The complete original command catalog is mapped semantically: `pause`, `resume`, and `goto` are direct; `terminate` maps to `complete`; and the Group Monitor's `terminate lock`/finish-everything path is an explicit atomic `complete_and_lock` command. It closes running timers and the participant session, records `completedAt`, persists the whole-test lock and both controller log states, and retains previous/next lock state in the command audit. Single- and bounded selected-run batch APIs support it. Matching the original `commandFinishEverything`, the original-labeled Angular finish control now confirms the destructive session-wide action, clears active request/profile/custom/quick filters, and submits a dedicated all-unlocked scope instead of depending on the selected run or the 100-row view. The server derives every target from the authenticated workspace/group scope without a client-supplied ID cap, leaves already locked runs untouched, and returns per-run failures; the official Group-Monitoring package proves that a scoped monitor finishes its assigned run while an outside-group run remains active. Production-built Chromium/SQLite additionally proves the exact request and filter-reset workflow. Original `debug` is deliberately excluded because source inspection shows it only toggles a non-production local debug pane. |
| Go-to block, unlock, lock | monitor routes and E2E | done | P1 | audited go-to sets runs to running, targets an exact unit, bypasses completion navigation guards, clears target code/leave locks, and reopens closed timed blocks with an operator-confirmed replacement duration in the same command; the Angular console keeps this operator-entered target separate from the participant's current unit for single and batch commands, persists it across reloads with backward-compatible hydration, presents target timer state from the read model, and browser-verifies the resulting server transition. Matching the Original's `groupForGoto`, batch go-to and timer changes now treat the selected block key as the shared intent, resolve that block's first currently visible Unit separately for every selected run, group the existing bounded requests by the resulting Unit key, and leave incompatible runs unchanged with an explicit confirmation warning. A production Chromium interception gate proves two same-species runs with different first-Unit aliases receive distinct target payloads. Original whole-test lock/unlock is independent of progress status, blocks participant writes, is visible in starter/monitor/CSV projections, honors `lock_test_on_termination`, and supports continuation after monitor unlock; the separate navigation unlock/re-lock preserves status and controls the durable bypass for code, leave-lock, and completeness guards. The official Group-Monitoring package gates go-to from Startseite to Aufgabe2 plus whole-test lock/unlock against the participant runtime. Selected timed units accept replacement rest time without moving, and every command supports bounded multi-run dispatch with per-run results |
| Profiles, filters, columns, view density | monitor profiles E2E | done | P2 | the byte-exact original `all` and `small` `Profiles/GroupMonitor` definitions persist with the migrated scoped monitor account and drive supported exclusion/inclusion filters, pending/locked visibility, booklet-state fields, columns, density, batch-visible selection, and `autoselectNextBlock`. The Angular profile summary renders the imported pending/locked flags with their original customizable labels, while the open-run collection turns the original `full`/`medium`/`small` setting into one-column, responsive medium, and compact responsive card layouts; `small` additionally suppresses the original detail fields, and a SQLite browser gate proves the imported density reaches the rendered collection. Matching the original monitor menus, operators can temporarily toggle every imported profile filter plus the base pending/locked filters, restore their complete imported baseline atomically, and clear stale batch selection whenever that visible set changes; the effective runtime profile also feeds overview counts, group aggregation, open-run cards, and select-all without mutating the reusable profile. The same controls temporarily toggle group, booklet, block, Unit, and currently available booklet-state columns, switch full/medium/small activity density, and reset the presentation to the active imported profile. The open-run list now also starts with the Original participant-ascending order and can sort ascending or descending by current batch selection, status, every currently displayed core column, activity timestamp, and displayed booklet-state values; selection-ascending matches the Original by placing checked runs first, and stable input order resolves equal values. Protected SQLite/Chromium coverage proves active imported filters, runtime reset, locked-run exclusion, imported display baselines, overrides, reset, selection order, and multi-row sorting. The Original-style case-insensitive quick filter then composes on top of server scope and the effective profile filters before sorting, clears stale batch selection when its visible set changes, and has an explicit one-click reset; Chromium proves no-match, case-insensitive match, and restoration. The original `Alle Tests gleichzeitig steuern` mode is now an explicit transient operator toggle: it is available only for one visible Booklet species, continuously derives the complete command-safe selection from the current authorized/filter-visible run set, includes later live updates automatically, and disables conflicting manual selection controls while active. A production SQLite/Chromium gate proves activation, exact selection, manual-control suppression, and clean return to an empty manual selection. When several species are visible, each eligible run now exposes an Original-equivalent species-cohort action that atomically replaces the batch with all authorized, filter-visible runs of that species; pending, locked, and broken-booklet runs are excluded from every automatic selection path. The same production gate proves a two-run cohort remains isolated from a second visible species. Matching the Original's clickable Testlet strip, every eligible rendered block is now a keyboard-accessible jump-target action: its first activation adds the origin run, the second selects the complete compatible visible species cohort, and the third clears that cohort while retaining the run-specific block target. As in the Original, selected compatible rows render their same-species target with an orange marker and expose the state through `aria-pressed`; clearing the selection removes every marker without losing the prepared target. Pointer hover and keyboard focus now also reproduce the Original's transient cross-row marker for the same block and Booklet species, clear on leave or blur, and never bleed into another species. The production multi-species gate proves the transient pointer/keyboard preview, species isolation, all three click stages, the cohort-wide target presentation, and the target selection before exercising grouped go-to. Per-login `ViewSettings/@monitorBookletVisibility` now follows the original `visible`/`collapsed`/`hidden` contract from XML import through the migration draft, durable role/session data, manual admin editing, and the monitor Testheft-list presentation. Open runs project ordered visible block targets from the effective adaptive route; the scoped console uses them as block choices, prepares the next block only after a successful jump when enabled, and clears the choice after the final block. Booklet Species follows the original top-level-testlet count, appears in cards/CSV/direct queries, and participates in imported profile filters. Request filters persist locally, and the scoped dashboard derives its status and group totals from the same profile-filtered read model. A structured Angular editor now authors, edits, and removes reusable monitor profiles and nested exclusion filters for either a new monitor account or an existing scoped role; original `state` filters use a real Super-State multi-select, persist as bounded arrays through the guarded admin API, and exclude every selected state in the live monitor. Its saved draft library survives reloads, same-scope assignment updates the durable profile set, and SQLite browser gates cover exact saved settings, multi-state filter persistence, plus the two-click automatic-next-block lifecycle. The seven active upstream profile scenarios are explicitly traced: two-profile selection, small/full density, profile-specific columns, imported filter application, and custom-filter creation all have production browser coverage. The sole additional upstream scenario is itself `it.skip` with a TODO and is not treated as a functional parity requirement; Rewrite additionally persists profile authoring, editing, deletion, multi-state exclusion, and automatic-next-block behavior. |
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
| Review create/edit/delete/export | review routes and review E2E | done | P1 | participant-authored test/unit/task-page comments are `canReview`-gated and browser-tested; numeric page plus manual page label, original priorities `0–3`, simultaneous `tech`/`content`/`design` categories, server-captured browser identification, and authored unit IDs persist across memory/file/SQLite/Postgres storage, participant editing, operator cards, category filters, audit activity, and CSV. Alias-backed units retain their original `Unit/@id`, and both provenance values remain immutable when a review target is edited. Review-capable Starters expose the Original `Reviews downloaden` action, return its exact `Keine Kommentare verfügbar.` feedback for an empty participant-isolated export, and otherwise download the BOM/semicolon report as `testcenter-reviews.csv`. Participant deletion uses the same accessible in-player confirmation surface as irreversible leave actions instead of a browser-native dialog |
| Group result deletion | results E2E | done | P1 | typed confirmation, counts, audit activity |
| Test logs export | `ReportType::LOG`, `LogReportOutput.php`, `docs/pages/logging.md` | done | P1 | the current Original TestLog catalog is represented: `LOADCOMPLETE`, `CONNECTION`, test-wide TestState transitions, `command executed`, and `locked by monitor`; UnitLogs retain `PLAYER=LOADING/RUNNING`, page/progress state, runtime failures, and Player-defined entries. Protected monitor actions derive the event actor from the authenticated account rather than caller metadata, and original remote commands retain their space-joined `pause`, `resume`, `goto id …`, `terminate`, and `terminate lock` spelling. Logs persist through the durable response outbox/repository paths across every store, support scoped operator filters and Angular inspection, export the original BOM/semicolon column layout, and are deleted with their group results. API gates prove monitor command/lock contents and actor integrity; the production SQLite/Chromium gate observes both Player lifecycle states after the real handshake, de-duplicates a repeated active-frame controller error, observes successful controller recovery, and queries the later retired-frame runtime failure by Unit. The separate workspace activity CSV remains available as an extended audit export |
| System-check reports | sys-check module/routes | done | P1 | the pinned original definition plus a real Unit/coding/player dependency chain import into one typed immutable configuration; public direct links run environment/network/questionnaire/player stages with per-check custom texts, and the SQLite browser gate starts Verona API 6, records a real item response, and retains it in the saved report. The Original server-time welcome check is reproduced through a cache-disabled typed endpoint: browser clock skew and IANA timezone are compared with the configured participant timezone, warnings start at the Original 60-second threshold or any timezone mismatch, and both entries persist in the environment report. API coverage verifies configured timezone and timestamp bounds; Chromium forces both warnings and verifies their rendered report entries. The same gate forces an Android mobile user agent and browser plugin, verifies the Original CPU/device/browser-version/operating-system/navigator labels and IDs, then follows the values through durable report detail and CSV export. Save-key validation protects durable reports across every store, and scoped operators can list/filter/export them, inspect OS/browser/overall-rating distributions, drill into report values, and delete selected check report sets behind typed workspace confirmation with an audit event. The byte-exact starter `SysCheck-Report.json` now has a first-class admin migration route; Angular accepts up to 200 selected JSON files or a report directory in one best-effort batch, reports individual invalid/missing-check files, and makes reruns idempotent by filename plus a server-derived semantic digest. Migration accepts modern plus deprecated section names, binds each report to its imported check, and retains original filename, file modification time, source date, check label, and values in durable activity-backed storage. CSV export matches the original `Titel`/`SysCheck-Id`/`SysCheck`/`Responses`/`DatumTS`/`Datum`/`FileName` order, BOM/semicolon encoding, boolean conversion, dynamic section order, and no trailing row; JSON export emits the original report array with synthesized `fileData`. API compatibility and a multi-check SQLite browser gate cover migration resume and both downloads. Imported sys-check accounts support concurrent sessions, force the report title to the login name, resolve their assigned workspace, and activate the original instance-wide mode that replaces anonymous key saving in both UI and API. Matching all six active upstream scenarios, Angular resolves that mode before rendering the entry: no configured account exposes the general anonymous System Check action, while any configured account removes it and offers only an explicitly protected account sign-in. Anonymous submission now reproduces the Original save dialog with blank key/title inputs, three-character validation, password reveal, accessible cancellation/focus handling, and no-cancel success confirmation; protected accounts save directly, and both acknowledged successes return to Start after 500 ms. Production SQLite/Chromium gates both states, multiple-check selection, single-check auto-selection, required-question validation, both real saves, success redirects, and route isolation with the server-forced login title |
| Platform/tenant/workspace admins | superadmin module, `user-management.cy.ts`, `workspace-management.cy.ts`, `settings.cy.ts` | done | P1 | scoped users, roles, passwords, status, sessions, audits, tenant/workspace directories, durable study/group monitor assignments with imported view profiles, password-safe operational-login-to-account creation in Angular, and persisted/enforced absolute plus first-login-relative access windows. Original workspace-admin `RW`/`RO` assignments normalize into durable `read_write`/`read_only` modes across file, SQLite, and Postgres storage: legacy assignments default safely to RW, RO may use every scoped read/export/SSE route, and mutations return a stable write-role error. Delegation now follows the target hierarchy: platform admins manage all accounts; tenant admins manage tenant/workspace/monitor/system-check roles only inside their tenant; RW workspace admins manage study/group monitor and system-check accounts only inside their workspace; RO workspace admins cannot delegate. User, role, password, status, session, CSV, and audit reads/mutations share that boundary, mixed higher-scope accounts cannot be captured by a lower admin, and failed role validation no longer leaves orphaned users. Angular limits role choices to the signed-in admin's delegation level. Matching the original workspace-centred Superadmin table, Angular now also projects every visible account against one selected workspace, distinguishes direct RO/RW from inherited tenant/platform write access, summarizes access counts, and applies direct RO/RW changes or confirmed revocation through the existing audited delegation boundary. A protected production SQLite/Chromium gate changes one workspace administrator from RO to RW and back through this matrix while verifying the durable role. Its status batch workflow keeps an exact bounded selection and preview, excludes the signed-in account, confirms the target state, dispatches best-effort per-account updates through the same server authorization boundary, and retains failed selections with concrete error codes. Disabling an account now formally revokes every active target session, leaves expired sessions unchanged, and records the exact revoked count and IDs in the user-update audit event; API coverage and the real SQLite batch-status browser gate prove token rejection plus revoked-directory visibility for two delegated accounts. The same selection can apply one exact role/scope to up to 50 accounts: identical assignments stay idempotent, each target is reauthorized, every created or updated assignment is audited by the existing server use case, successes leave the selection, and concrete failures remain for retry; a SQLite browser gate assigns the same scoped system-check role to two delegated accounts. The original superadmin password step-up now also protects every platform-admin role change: account creation, individual and batch assignment, and revocation require the acting administrator's password at the server boundary, with stable missing/invalid error codes. Matching current upstream `49c0843e`, an invalid confirmation is handled as a recoverable inline field error: the transient password and pending action remain available for immediate retry, editing clears the alert, and the generic technical-error surface stays closed. Success clears both password and error; neither request secrets nor confirmations enter persistent shell state or audit details. API coverage and a protected Chromium/SQLite gate prove rejection, inline retry, success, clearing, and audit redaction. Signed-in administrators can now also reproduce the original self-service password change from every operator shell: Angular requires current password, policy-valid double entry, and keeps all fields transient; the server re-verifies the current hash unless an administrator-set mandatory change is pending, then revokes every active session and retains the existing password-change audit without secrets. The same global navigation keeps sign-out available across admin and monitor shells, terminates the live bearer session at the server, clears its browser state, and returns protected views to operator access instead of leaving stale administration visible. Matching the original header account menu, a global account panel exposes the live username, display name, effective access mode, every role and scope, session expiry, and build identity without requiring diagnostics access. Direct protected links now resolve the live auth mode, retain an internal return URL, avoid protected probes while signed out, and resume after successful authentication; the signed-out Ops route exposes only credentials plus explicit first-deployment bootstrap rather than the administrative and diagnostic consoles. API and protected SQLite/Chromium gates prove rejection, success, sign-out, old-password invalidation, renewed sign-in, and protected-route return. Manual administrator password reset now also reproduces the original double-entry guard: Angular blocks missing or mismatched confirmation, keeps both values out of persistent shell state, clears both after success, and a protected Chromium/SQLite gate proves the old-password rejection plus the existing mandatory next-login change. The selection also supports a bounded password handoff without reusing secrets: Angular generates a distinct 24-character CSPRNG password for each account, submits every reset through the same delegation and audit boundary, removes successes while retaining concrete failures for retry, and keeps successful credentials only in memory until a CSV download clears them. A SQLite browser gate proves uniqueness, old-password rejection, new-password sign-in, exact CSV contents, and post-download cleanup. Session revocation has an independent bounded 50-target selection, exact-ID preview, current-session exclusion, confirmation, per-target reauthorization and audit trail, with successful targets removed and concrete failures retained for retry; API coverage verifies deduplication plus mixed success/self/missing results, and a SQLite browser gate revokes two live delegated sessions. Permanent user deletion now reuses the same 50-account exact selection and per-target delegation boundary, prevents self-delete, requires irreversible-action confirmation, removes every successful account with all sessions and role assignments in one store transaction, retains concrete failures for retry, and records a standalone audit snapshot with the deleted username, display/status/roles, and exact removal counts. API coverage proves authentication, self-protection, session invalidation, repeat-delete behavior, directory cleanup, and audit retention across the durable stores; a real SQLite browser gate deletes two delegated accounts and verifies their directory/session absence plus both retained audits. All Ops account, role, password, session, access-window, custom-text, and monitor-profile confirmations now share a labelled in-app alert dialog with safe initial focus, trapped keyboard navigation, Escape cancellation, focus restoration, and explicit action-specific confirmation. The protected production browser gates exercise the no-request cancel path and the representative single and batch confirmation sequence through account deletion. Original workspace lifecycle parity now covers creation, RW/RO assignment, rename, and platform-admin-only permanent deletion. Deletion requires the exact workspace key, atomically clears every workspace aggregate and scoped role, retains the global audit record, and is gated across memory/file/SQLite plus protected Chromium/SQLite. Matching the original three-tab system administration, platform admins now switch through one responsive, keyboard-visible `Admins` / `Workspaces` / `Settings` navigation shared by Ops and Workspace routes. Admin and Settings panels are mutually exclusive, the selected panel is URL-stable, and production Chromium gates the complete settings-to-workspace-to-admin round-trip. The workspace directory now also reproduces the Original table's `MAX(files.modification_ts)` signal from currently stored source-package upload times, keeps empty workspaces explicit, exports the value, and sorts interactively by name or latest file modification in either direction. The 18 upstream Superadmin E2E scenarios are now explicitly traced: all settings controls plus maintenance-warning set/clear; user action availability, creation, invalid/valid Superadmin step-up, RO/RW enforcement, password mismatch/success, and deletion; and workspace action availability, creation, user-centred RO/RW assignment, rename, and deletion. Rewrite API and production SQLite/Chromium gates cover every path, so the Original Superadmin surface is functionally closed; the additional tenant hierarchy, access windows, batch operations, session administration, CSVs, and audit evidence exceed that baseline. |
| Branding/settings/custom texts | settings module, `e2e/src/e2e/Super-Admin/settings.cy.ts` | done | P2 | imported per-login participant, Booklet, monitor, and system-check texts are durable and applied. The original instance application title, expiring global warning, resettable 20 MiB logo, `Primar`/`Sekundar`/`Erwachsene` themes, bounded start-page HTML plus independently bounded `Impressum`, `Datenschutz`, and `Barrierefreiheit` HTML, and bounded global custom-text overrides are public, platform-admin editable, validated, audited, and durable across every adapter. The eight current Original presentation slots ship with the byte-exact upstream logo, login, code-input, companion, completion, loading, and confirmation images; registered global or per-login assignments override those built-ins, while the `Sekundar` code-input illustration follows the Original theme-specific fallback. Angular applies branding to participant and operator shells, switches real CSS variables immediately, removes the global banner at expiry, presents sanitized configured HTML on participant entry and three separate public information routes, and resolves participant text in the original global < Testtakers/Login < active Booklet order. System-check configuration remains more specific than global text; authenticated monitor login text likewise overrides global settings, with the complete 58-key `gm_*` defaults exposed in the editor and all 58 keys rendered across headline, commands, columns, summaries, profile view/filter text and status flags, scheduled/expired access boundaries, selection counts, tooltips and confirmed unlock feedback, target-timer state/confirmation, scroll/hide controls, and broken-booklet diagnostics. Legacy file/SQLite/Postgres migrations, API/store tests, and production SQLite browser gates cover custom branding, separate public documents, layered participant text, imported monitor-account text, placeholder formatting, access-window copy, sanitizer enforcement, and full reset. |
| Attachments and QR capture | `AttachmentController`, `AttachmentFiles`, attachment-manager frontend | done | P2 | Every Original BaseVariable attachment projects a typed slot per started run, including `image`, `audio`, `ggb-file`, custom, and omitted formats; only `capture-image` exposes the implemented missing/captured camera controls. Authenticated admins and scoped monitors can list the complete inventory, upload validated PNG/JPEG capture images, preview/download them inline, delete them, and use a stable copyable attachment code in Angular; files and audit events are durable across every adapter. Unsupported capture attempts and QR pages fail explicitly instead of silently treating another authored type as a photograph. The same upload endpoint accepts the original `multipart/form-data` `attachment` field and `type=image` request shape in addition to JSON/Base64. The manager downloads one selected or up to 500 role-scoped A4 capture QR pages as PDF, with the original seven configurable label placeholders and generation-time scope enforcement. The lazy mobile capture route scans the ID with a live camera or QR image, supports camera/flash selection and manual fallback, confirms the server-scoped target, crops an A4 frame or accepts a device photo, previews it, and uploads only through the existing write boundary. API tests, a production SQLite browser gate, and rendered-output QA cover the complete flow |
| Durable storage | deployment stack | done | P0 | file, SQLite, Postgres, migrations, doctor/preflight |
| CI and deployability | deployment scripts | done | P0 | the repository-root workflow is the single GitHub-executable authority for static, unit, original-compatibility, memory/file/SQLite/Postgres storage, browser, startup/shutdown, metadata-required runtime preflight, standalone Docker-image, and demo-disabled/demo-enabled Compose gates; the former nested workflow has been removed so documented release checks cannot be silently ignored by GitHub. All seven Angular feature surfaces compile into independent lazy chunks. After the Angular 21 upgrade, the frontend relies on the framework's default zoneless change detection instead of shipping the redundant Zone.js runtime. The root shell hydrates only shared browser/session state and resolves Workspace, Content, Runtime, and Ops services on demand, so no eager shared feature chunk returns. Global error capture and confirmation state remain immediately available, while the standalone dialog surfaces load on first use: the current production build is 448.35 kB raw initial JavaScript/CSS (114.33 kB estimated transfer), down from the 563.85-kB eager-feature baseline. Dedicated Chromium gates cover the public Start route, auth-aware protected-route return, signed-out diagnostic isolation, mobile overflow, async application settings, central error reporting, open-auth direct entry, Participant offline reload/SSE reconnect, Content navigation, and live monitor commands. Production budgets now warn at 450 kB and fail at 470 kB, guarding both root-shell and shared-feature regressions while every complete flow remains lazy-loadable |

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
