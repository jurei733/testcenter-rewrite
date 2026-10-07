# Optional Original UI

## Acceptance baseline

Requested on 2026-09-12: keep the existing rewrite interface available and add
an optional interface identical to the Original Testcenter. This is a separate
acceptance axis from functional parity; the historical 94% estimate in
PARITY.md does not measure it.

Current upstream target, reverified on 2026-10-07:
`a570587f12e10989f80e91a3d559aa5f753ec3f0`. Its new protected-login busy states
and insecure-context HTTPS notice require fresh rendering/interaction evidence.
See `PARITY.md` for the source-backed delta and separate deployment boundaries.

Historical rendered reference: `iqb-berlin/testcenter` commit
`c35cff81383949b4664e0fdffa3ba1154d144d9d` (19.0), fetched on 2026-10-03.
Compare source files from that revision, not the older local checkout.

## Required behavior

- Explicit, reversible interface selection. The existing rewrite interface
  remains the default until the Original interface passes acceptance.
- Both interfaces use the same authorized application services and persisted
  data. Switching must not reset answers, create a test run, change permissions,
  or bypass a participant navigation restriction.
- Preserve the independent Primar, Sekundar and Erwachsene presentation themes,
  authored texts, branding and participant-specific configuration.
- Do not equate a color/font override with an identical interface. Reproduce
  page structure, spacing, typography, controls, dialogs and interaction states.
- Keep rewrite-only tenant and diagnostic tools accessible without inserting
  them into the Original participant workflow.

## Acceptance matrix

Both interfaces now bind the selected Run ID through state, asset preload,
live updates and actual generated re-entry links. Exact preset assignment,
Unicode answers and Run ID survive hard reload; another run's later background
saves cannot steal selection or bypass the selected run's monitor pause.
Production/development protected SQLite browsers and headless production pass.
The second open run in this focused fixture is repository-seeded, not started
through the still-blocked P0 workflow. These shared functional safeguards do not
close any full rendered-UI acceptance row or pixel-identity claim.

The 2026-10-07 operator handoff check also passes in both interface modes on
owned protected SQLite/headful Chrome: a generated entry starts the requested
login and its exact authenticated Run, and the refreshed operator card exposes
the same Run-bound re-entry URL. The older participant's response and Run status
remain unchanged. Shared browser gates now check that durable identity instead
of racing login inputs removed after success, and retain the same full-height
Player invariant after layout settling. This closes no full UI row. The separate
immutable Memory/headful Chrome ItemBuilder blank-frame failure remains open;
see `PARITY.md` for the retained evidence and publication boundaries.

The shared backend now permits exact preset-assignment resumption after returning
to the starter, rather than rejecting its variant key against the source Booklet
key. Both interfaces passed real participant login, Unicode draft preservation,
confirmed starter return, same-run resumption and session-link/hard-reload
restoration with owned protected SQLite in production/development; production
also passed headlessly. The mandatory quick-CI variant smoke retains exact
run/answer assertions. This does not close the other-unfinished-Booklet P0 gap,
the full starter row or any pixel-identity claim.

Latest participant-starter comparison (2026-10-05): the optional renderer now
matches the pinned 19.0 intrinsic 684px card/intro width, 24px gaps, 94px companion,
normal paragraph typography, flex-column margins, Material icon baselines,
completed-button opacity and bordered Review action. The scrolling content is
viewport-bounded below the Source toolbar, including the authenticated account
control at both sides of the 600px breakpoint. The native scroll button sends
the actual Source's smooth 300px increment rather than jumping to the bottom.
The Source's narrow-screen clipping is retained in this optional interface;
the responsive Rewrite interface remains independently available.

All 48 equal-fixture states passed in each final production/development build:
three themes × four viewports × fresh, mixed/completed with custom action labels,
long/wrapped/unbreakable labels and Review-enabled starters. The reference uses
the unmodified `c35cff81` frontend with a bounded API fixture; Rewrite uses real
protected API/SQLite. Text, geometry and measured visible styles match,
including the account control and disabled opacity. Raw RGBA is identical in
33/48 production and 29/48 development pairs. Remaining pairs retain differences
up to 7,733 pixels and 67/255 channel units; complete pixel identity is not
established. Scripts, metrics, screenshots and logs are retained in ignored
`.data/original-starter-reference-20261005.*`.

The new mandatory quick-CI browser regression passes all 48 states in both builds
and exercises real login, keyboard scrolling, non-lifting account hover, a
blocked duplicate pending start, exact saved-answer resumption and participant
bearer authorization for the actual HTTP 204 Review export. The separate login
regression and all 165 core, 12 presence and 83 frontend/preflight tests passed.
Initial production output for that layout step was 469.61kB below the unchanged 470kB hard limit.
Fresh publication CI remains separate proof. This narrow comparison does not
close the complete starter/shell row: empty/error/custom-branding states,
Source snackbar feedback and other claims remain open. A functional P0 gap was
also reproduced: another unfinished Booklet blocks an otherwise available
selection. Explicit run-bound reads now avoid answer-update chronology, while
historical session-only links retain that fallback. The
mixed rendering fixture completes one Booklet before starting the other; it
does not prove that blocked workflow. See PARITY.md's explicit acceptance.

Latest administrator-login comparison (2026-10-04): the optional signed-out
operator entry now uses the pinned 19.0 400px Material card, bordered centered
form, German labels/actions, shared Source header/footer and Testtaker link.
It calls the same authorized operator login, proof-of-work, persistence and
return-route logic as Rewrite; there is no second credential store. Native
setup remains accessible through the interface selection or `?ui=rewrite`.
Structured error identifiers preserve Source copy despite different HTTP
codes. Passwords are cleared after results and on destruction. Duplicate
pending Enter is rejected, late failures cannot clear a replacement secret,
post-login asset failures do not erase accepted authorization, and a failed
lazy renderer exposes the safe Native entry without attempting authentication.

All 48 equal-fixture states passed in each final production/development build
across three themes, desktop/mobile and both sides of the 600px breakpoint,
with empty/filled/Caps Lock/wrong-password forms. Source is the unmodified
`c35cff81` frontend with a bounded API fixture; Rewrite uses real protected
API/SQLite. Text, geometry and visible styles match. Both matched CSS rules
specify `margin:auto`; inconsistent Chromium resolved margin values remain
in the recorded diagnostics while actual form positions are compared exactly.
Raw RGBA is identical in 41/48 production and 44/48 development screenshots;
other pairs retain raster-edge differences up to 1,291 pixels and 24/255
channel units. This is not complete pixel identity, Source-backend proof or
a closed shell/login/administration row. Evidence is retained in ignored
`.data/original-admin-reference-20261004`.

Each build also passed twelve real login configurations with 24 browser-solved
admin security challenges, actual scheduled/expired access rejection, normalized
blank-name errors, retained authorization after a failed asset read and the
actual failed-component chunk fallback. Full protected SQLite passed through
workspace deletion; participant login and deletion dialog regressions stayed
green. All 157 core plus 78 frontend/preflight tests passed; initial output is
469.31kB below the unchanged 470kB limit. Publication `fae90ea5` subsequently
passed all 35 push-CI jobs (run `37226072648`), including PostgreSQL UI and
participant-detail review. The later durable participant-presence publication
`a095936b` finished with 20 successful and 15 failed push jobs: the browser
failures share the STARS partial-delivery fault boundary, which failed to block
actual worker-owned network sends. An owned reproduction confirmed all exact
answers were durably saved; the regression now intercepts both network owners
and additionally checks the actual server-side seven-Unit boundary. Fresh
publication verification remains required. Neither result closes a full
Original UI row.

Latest administration-dialog comparison (2026-10-04): the optional Original
account-deletion confirmation now adapts the pinned 19.0 Material template,
600px dialog, German singular/plural prompt, seven-character form gate,
submit-before-cancel order and inline `Falsches Kennwort.` alert. The secret,
authorization callback, pending duplicate guard and stale-request checks still
belong to the shared controller. Wrong-password focus waits for the actually
re-enabled Material button and preserves its mouse/keyboard origin. Native
Rewrite confirmations and the workspace's additional exact-key guard remain
unchanged; the workspace dialog is still not Original-rendered.

All 18 equal-fixture dialog states passed in each fresh production/development
build (three themes × desktop/mobile × empty/filled/wrong password). Text,
geometry, visible computed styles and focus match the unmodified `c35cff81`
frontend. Source uses a bounded fixture backend rejecting unknown calls;
Rewrite uses its real API and isolated SQLite. Screenshots, metrics, script
and logs are retained in ignored `.data/original-password-reference-20261004`.
This is a narrow renderer comparison, not full-page pixel identity or a closed
administration row. Both builds also passed four real protected deletion
configurations and a failed-network-renderer fallback gate: cancellation sends
no DELETE, wrong passwords preserve accounts, pending Escape/backdrop/duplicate
submits cannot dismiss an action, failed directory refreshes do not repeat
acknowledged deletions, and the safe Native fallback preserves the selection.
The separate full protected SQLite flow passed through `workspace-delete`.
All 157 core and 70 frontend/preflight tests passed. Initial production output
is 468.25kB, below the unchanged 470kB error budget. Fresh publication CI is
still separate proof; no complete Original UI matrix row is closed by this step.

The shared file-intake view now explains its strict Original 19 XSD policy or
explicit legacy compatibility setting. Real API/SQLite browser gates pass valid
and invalid imports in both interface preferences at desktop/mobile widths,
in production/development. This is shared import behavior, not an Original
administrator-page rendering comparison; the administration row stays open.

The `0da8fbfe` publication's PostgreSQL UI job has now passed the full protected
flow, including saved-dialog focus and workspace-access revocation. Its overall
CI is not green: a separate participant-detail job hit a forced click while an
entry-link record was replaced. Normal actionability-checked clicks replace
those two forced entry-link clicks; the protected SQLite full flow passes
through the real participant popup and `participant-launch-status-session-link`.
Fresh complete publication CI remains required.

The Original 19.0 deletion password requirement is now enforced in shared
administrator/workspace services and the UI. Both interface preferences use the
same safe confirmation flow; desktop/mobile production/development tests cover
wrong-password retry, focus, no-request cancellation, pending duplicate guards,
and directory-read failure after a real acknowledged deletion. The password is
dialog-local, never persisted. Its readable opaque surface is regression-tested.
This paragraph records the preceding shared functional step. The narrow
Original account-deletion renderer comparison is now described above; the
complete administrator/workspace pages remain part of the open row below.

The previous login publication's PostgreSQL UI job raced the Material saved-report
dialog autofocus immediately after its animation. The full smoke now waits for
the required in-dialog focus state itself before testing Tab/Shift+Tab; no focus
assertion or timeout is removed. The protected SQLite full operator gate passes
this save/focus sequence and continues through workspace/account deletion.
Fresh complete PostgreSQL and publication CI proof remain separate requirements.

Latest login comparison: both name and password fixtures now match the actual
19.0 rendering in all three themes at 1280x720, 390x844, 599x844 and 600x844,
in each fresh production/development build (24 states each). Source viewport
height/footer sizing, two-column mobile overflow, heading margins, Material
icon baseline, label styling and bordered browser-warning card replace the
earlier approximations. The Original warning formats three-part semver only;
the shared support policy and Rewrite's raw browser version are unchanged.
The actual Rewrite build identity remains truthful in the footer.

The bounded Source backend fixture rejects unknown calls; each Rewrite instance
uses real API/SQLite. Text, geometry and computed styles match. Raw screenshots
are fully RGBA-identical in 17/24 production and 21/24 development pairs; the
others retain small edge differences, at most 114 pixels and 12 channel units.
This is not completed pixel identity, all configurations, Source-backend proof
or a closed shell/login row. Error/custom-branding/admin-login states and the
other complete surfaces remain open. Evidence, scripts and logs are retained in
ignored `.data/original-login-reference-20261004`.

The new twelve-configuration quick-CI regression also exercises actual 401
responses, password fallback, focus, reveal/back and a real password-authorized
session without storing its password. Production/development gates passed;
another production run solved fourteen real browser proof-of-work challenges.
The protected entry gate through password sign-in and the three-theme real
Systemcheck-save gate passed. All 144 core/49 frontend tests passed. Initial
production output is 467.99kB, below the unchanged 470kB error budget. The
portable Linux logo assertion is separately published with a fresh checkpoint
(`5aa72bf0`); latest login publication CI remains a separate requirement.

Latest welcome comparison: the unmodified 19.0 frontend exposed the inherited
980px cap, card/text colours, disabled-FAB dimming, icon baseline and table
wrapping. These Original-only styles now match the rendered source. Its shared
header has the 22px/28px centred title, proportional logo and actual 64px/56px
toolbar breakpoint below 600px. Native Rewrite layout remains separate.
Twelve equal-fixture comparisons passed in each production/development build,
across three themes at 1280x720, 390x844, 599x844 and 600x844. Visible text,
geometry and visible computed styles match, with screenshots retained locally
in ignored `.data/original-welcome-reference-20261004`. The Original frontend
uses a bounded synthetic backend; every Rewrite comparison uses its own real
API/SQLite. The CI regression checks both breakpoint sides and real report
persistence; the full protected Systemcheck and participant-entry gates passed.
This does not close the Systemcheck row, other fixtures or full-page pixel
identity. Initial production output is 467.94kB under the unchanged 470kB limit.

Latest acknowledgement step: the Original Systemcheck success notice now uses
the pinned 19.0 Material confirm template, two actions and audience-dependent
ordering, including the adult override for live administrator/monitor access.
Its lazy overlay is request-ID guarded and does not replace Rewrite or
destructive verification dialogs. Fresh headful production and development
three-theme tests passed real persistence, focus containment, desktop/390px
bounds, cancel/confirm/Escape and the return to Start. The complete protected
production Systemcheck regression also passed adult ordering and confirms
that cancelling the notice cannot remove the already-saved report or answers.
Initial output is 467.73kB with the unchanged 470kB error budget.

The `bc8a7bf1` push CI completed successfully (35/35), including the
acknowledgement and watchdog steps; its acknowledgement-only predecessor was
superseded. Newer changes still require their own CI. An isolated, unmodified build of
Original `c35cff81` with its own locked Angular 20.3.29/Material 20.2.14 is now
available for source-rendered comparisons; a successful build alone does not
close any visual-parity row.

The first actual comparison corrected dialog typography (30px heading,
16px/24px content), 720px maximum width and duplicate disabled-button dimming.
The save form follows the actual 19.0 field without a visible password suffix;
the upstream unimported suffix does not render. Rewrite retains its reveal.
All twelve dialog-state comparisons passed on 2026-10-04 at 1280x720/390x844
in all three themes: visible text, geometry and computed styles/tokens,
including button children. The reference runs the unmodified Original frontend
with a bounded synthetic backend fixture, not the Original backend. Rewrite
uses its real API/SQLite and retains the submitted answers. Locally retained
screenshots and comparison metrics are in the ignored
`.data/original-dialog-reference-20261004.gFehUo` directory. Corrected builds,
three-theme production/development regressions and the full protected
production Systemcheck gate passed again. These narrow dialog comparisons do
not establish whole-page pixel identity or close the Systemcheck matrix row.

Implementation in progress: the home page now offers a browser-local interface
choice. `?ui=original` and `?ui=rewrite` also select it for a direct entry. The
choice survives navigation/reload and leaves unrelated URL parameters intact.
The Original option is explicitly labelled a development preview. The initial
participant header adaptation is not a completed visual-parity claim; login,
page composition, typography, controls and all matrix comparisons remain open.

The Original participant login now has the name-first passwordless probe,
password fallback, password visibility control, back navigation and credential
error reset. It uses the existing participant sign-in, proof-of-work and
assigned-booklet/session logic, not a second authentication implementation.
Local Chromium checks exercised real passwordless and password-protected
demo-workspace accounts; mocked errors cover the view transitions without
consuming real login attempts. The main smoke also checks that Original and
Rewrite sign-in restore the same session/run. The complete local SQLite/Chromium
smoke passed on 2026-10-03; publication and current CI remain separate gates.
Nunito Sans files are copied from the pinned Original
and shipped with their OFL; adapted Original layout code retains its MIT notice.
Material 20.2.14 (the Original lockfile version) now provides the login fields
and primary/tonal buttons under a component-scoped theme. Focus follows name,
password, back and retry transitions, with a Caps Lock hint. Local Chromium
checks cover focus and the real passwordless path. Full screenshot comparisons,
remaining icon/control details and the other surfaces remain open.

The participant starter now adapts the Original's numbered Material cards,
684px card/intro layout, companion assets, Starten/Fortsetzen/locked actions and
bottom Review download action. Available and in-progress assignments open
through the existing authenticated resume service; locked/completed assignments
cannot launch. The Original starter replaces the Rewrite diagnostic cards only
when a signed-in participant has no active run. Player/terminal/error states
continue through the existing controller. Long-list scrolling is observed with
an IntersectionObserver. Equal-fixture comparison and the operator/monitor
starter remain open; this is not a closed visual-parity row.
The focused integrated memory/Chrome smoke passed on 2026-10-03 through
`participant-entry-sign-in`, including cancellation of return, confirmed
return to the Original card and resuming the exact same session/run. Additional
local browser checks cover locked/completed cards, retry after a failed resume,
desktop/mobile widths and an actual Review account's empty CSV response (204)
with its authored start-button text. Full CI for the new commit is still a
separate gate. The current production bundle is 468.47kB under the unchanged
470kB error limit; its 450kB warning remains. The subsequent lazy participant
credential adapter brings the current bundle to 468.94kB without raising
either budget; Original theme-size warnings remain unchanged.

All rows are currently open. Close a row only with matching reference states
and browser evidence at equal viewport, theme, text and fixture settings.

The optional player now adds the Original's grouped task/page navigation above
the existing Verona frame. Adapted Material controls, SVGs, labels, readonly
and hidden modes, page lists and separate global buttons reuse the same
controller events and server-authoritative permissions; no second iframe or
session implementation is introduced. A headful Chromium/isolated-SQLite check
on 2026-10-03 passed nine official Bklt_Config variants within 29–39, real forward/back
task and page changes, the same-run return to Rewrite, narrow-width grouping,
and no page errors. The Original player now has a full-height frame without
Rewrite diagnostic cards, an authored-title/timer Material toolbar and modal
task/comment side panels. The panels reuse the existing state and persistence;
opening and closing them does not replace the iframe. Headful Chromium checks
cover keyboard trapping and return, draft retention, actual comment save/delete,
nested confirmation focus, mobile bounds, authored menu permissions, actual
reload of the same run and return to Rewrite. The integrated smoke has the same
surface gate. Remaining sidebar contents, dialogs and matching
reference screenshots keep the Player visual-parity row open. This is not a
completed visual-identity claim.
The Original login footer now has the source's Material-link order and German
labels, and is absent from the Starter and active Player as in 19.0. Its version
label describes the actual Rewrite build, not a fictitious Original release.
The Starter account menu shows the authorized login, authored group label,
booklet access and build identity. A headful Chromium/isolated-SQLite check
passed both surfaces, viewport-height login composition, opaque themed CDK
overlays, mobile menu bounds, Escape/close focus restoration and same-run
return to Rewrite. A fresh protected SQLite/Chromium entry gate also passed
the footer/account assertions and the same-session/run Starter resume. The
sign-out control now reproduces the verified access lifecycle of Original
`deletePersonToken`: revoke access without deleting responses, issue a fresh
credential on re-entry, and keep the old credential invalid. Local
`clearSession` is not equivalent to that operation. Logout waits for server
confirmation; a failed attempt keeps the account menu and error notice open
for retry. It preserves pending answer queues and does not erase a concurrently
renewed key or another participant's visible session. A headful Chromium/
owned-SQLite check passed an actual Player answer save, temporary failure,
successful retry, old-key rejection, real UI re-login into the same run and
byte-identical answer restoration, desktop focus and mobile keyboard logout.
Twenty-five frontend/worker/test-actor/logout-state tests passed. The current
production bundle is 469.00kB, below the unchanged 470kB error threshold.
The fresh complete protected SQLite/Chromium production browser gate also
passed through this logout/re-entry path, official Player and Test Controller
flows, monitors, attachments and Original exports, with final exit 0. Current
publication CI and matching-reference screenshots remain separate gates;
this verifies the server-backed logout path, not the complete visual-parity
row. The pinned Original's confirmation dialog and audience-specific button
order are now adapted too. Its source text and companion image precede actual
revocation; Primar places the filled `Hier bleiben` button first, whereas
Sekundar and Erwachsene place the outlined `Abmelden` button first. Cancel and
Escape preserve access and return focus to the account button. A session change
or component destruction prevents a stale confirmation. A fresh protected
SQLite/Chromium entry gate passed the cancel/revoke/re-entry sequence. Separate
headful checks passed all three actual application themes at 1280px and 390px,
native keyboard focus, real logout failure/retry and byte-identical saved Player
response restoration. Twenty-five frontend-state tests and backend/shared
typechecking passed. The production initial bundle is 469.72kB within the
unchanged 470kB error limit: the dialog is lazy-loaded and repeated identical
font declarations were consolidated without changing font values. Current
screenshots show the adapted Rewrite surface, not an equal-fixture comparison
against a rendered Original; the matrix rows remain open.
The official ABI development-rendering regression is also fixed: Player loading
notifications no longer synchronously change the parent save/leave state inside
Angular's view/input lifecycle. The new isolated `smoke:ui:verona-development`
gate passed both layouts with actual ABI input/save, authored reload, page
reload and Unit changes, the same run and exact saved response, no page/console
errors and final exit 0. This adds a dedicated CI check without disabling
Angular verification or replacing another runtime's frontend/database. It is
functional browser evidence, not matching-reference screenshot acceptance.
The Systemcheck selection now adapts the pinned 19.0 400px Material card,
German instructions, explicit start even for a single check, authored labels
and descriptions, and the home action. Rewrite tenant/workspace diagnosis inputs
are absent from this selection. A metadata-only directory returns no report key,
Unit definition, Player or release payload; identical check IDs in different
workspaces remain separate choices. Dedicated system-check sessions see only
their authorized scopes; invalid credentials do not fall back to public access.
Headful checks passed empty/single/multiple selection, actual scoped selection,
390px layout bounds, one error notice and real retry, required password change,
re-login and sign-out. The corresponding selection cases are in the repository
browser gate. The protected login card and the remaining check steps still use
the Rewrite layout. Header details and equal-fixture rendered Original comparisons
remain open; this does not close the Systemcheck matrix row.
The selected check now has the pinned Original welcome's two 400px Material
cards, German step labels and instructions, source environment table, and real
Material FAB previous/next navigation using the existing controller guards.
The header says `Systemcheck`; its logo returns home rather than sending an
unhandled participant-only event. Selection adds an exact tenant/workspace/check
permalink; reloading restores that check, and returning to the directory clears
it. A questionnaire containing only authored headers also retains its step,
matching the source instead of counting only input controls. New environment
reports now use the current Original labels/IDs (`Browserversion`,
`Betriebssystem`, `Betriebssystemversion`, `Bildschirmauflösung`, `Browsersprache`,
`Fenstergröße`); existing reports are not rewritten. Navigation now also has
the source's Material tooltips and accessible control names. Network, Unit,
report composition, the protected-account card, remaining header
details and equal-reference screenshot acceptance are still open.
The final headful welcome check and fresh protected SQLite/Chromium report gate
both exited 0, including reload, cleared selection, header-only questions and
the home action. Twenty-five frontend-state tests passed. The production initial
bundle is 469.91kB below the unchanged 470kB error limit. Screenshots were
inspected for actual table readability and 390px bounds; they are not Original
reference screenshots. Publication CI is an independent gate.
Player-only visual rules are now delivered when a Verona host is created,
instead of on every initial shell entry. Their selector/declaration bytes and
global specificity remain unchanged. The isolated development browser gate
passed actual computed-style comparisons against the previous initial placement
in both layouts at 1280px and 390px, no overflow, and actual ABI answer/save,
authored reload, page reload and Unit changes with exact response retention and
no page/console errors. The headful welcome gate passed the real visible
Material tooltip. The production initial bundle is now 467.76kB, under the
unchanged 470kB error limit; this is not rendered Original-reference acceptance.
The 2026-10-04 questionnaire adaptation uses the pinned Original's centered
810px Material card, authored introduction/header text, outlined string/select/
multiline fields, four-row textarea autosizing, separate checkbox prompt and
vertical radio group. It writes only the existing controller's answers; step
round trips preserve all five input types. Required questions retain the shared
report warnings rather than gaining native validation or invented label
asterisks. The lazy view explicitly excludes Rewrite textarea minimum-height
and form-label styles: browser assertions verify actual text-row height and
Material label typography/color, not just presence of a Material class.
A fresh protected SQLite/headful Chromium production gate exited 0 through
all six question types, native option/checkbox/radio interaction, keyboard radio
navigation, answer retention, header-only questions, 390px/1280px bounds and the
existing report save/download/export paths. Both actual screenshots were
inspected. The production initial bundle is 469.90kB under the unchanged 470kB
error limit; 140 unit tests and 25 frontend-state tests passed. These are adapted
Rewrite screenshots, not equal-fixture rendered Original comparisons. Current
publication CI and the complete visual-parity row remain open.
The Original network step now adapts the source's centered 810px Material card,
automatic start, German progress/rating copy, side-by-side logarithmic canvas
plots, live sequence averages and keyboard-operable `Neustart`. It uses only the
shared configured byte measurements and report entries. Returning to a completed
network step retains its results instead of starting another measurement.
The shared controller cancels its pending latency/download/upload fetches when
the check changes, the account signs out, the step leaves or the route destroys
the view. An old measurement cannot install its results/errors or release the
busy state of a newer check; request timeouts and abort listeners are cleaned up.
The protected SQLite/headful Chromium report gate exercises real successful
measurements, failed packages followed by a real restart, all three request-stage
cancellations in both interfaces, same-step retention, native keyboard restart,
actual 1280px/390px bounds and the existing report/export flows. Its controlled
held requests verify actual browser aborts and no page errors. Screenshots are
inspected as adapted Rewrite evidence, not matching rendered Original reference
images. The chart preserves the source's canvas/projections/grid/dot output but
iterates only labelled x ticks, avoiding millions of empty four-byte iterations
for a large package. UAParser now loads on environment capture rather than the
initial shell; capture generations suppress stale results and refresh the
zoneless view. Current complete CI, the Unit/report/protected-entry surfaces and
the full Systemcheck reference comparison remain separate acceptance gates.
The final fresh protected SQLite/headful Chromium production report gate exited
0 on 2026-10-04, including all six held-request cancellation cases and the
source's in-progress package-size copy. Both final screenshots were inspected.
The production initial bundle passed at 469.52kB under the unchanged 470kB error
limit; 140 unit and 25 frontend-state tests passed. The previous publication's
push and PR workflows each had 33/35 successful jobs with Ops/Quick still
running at this checkpoint, not a confirmed complete CI result.
An additional headful check passed authored Unit/Booklet header titles,
preservation of a hidden header after cancelling return to the starter, hidden
and explicit global-forward controls, and the Original `markedNo` interaction:
the task arrow remains actionable for a completeness explanation, stays on the
same task when denied, and advances only after the required response and
presentation are complete. All of these cases are also in the repository smoke.

The Unit stage now adapts the pinned task title/divider, full-height frame and
bottom-right numbered Material controls using the existing guarded Verona
host. It sends the Original's disabled log policy in both interfaces and keeps
the same saved answer envelope. Protected SQLite/headful production and
development gates exercise two actual pages, both answers, leaving/returning,
keyboard controls, wrong-source messages and runtime-error restoration. The
development entry no longer raises a busy-state `NG0100`. Participant-only
status/Review/timer styles are unchanged but lazy; real save/readiness computed
styles match their former global placement at desktop/mobile widths in both
interfaces. Initial production output is 467.64kB with unchanged budgets.
Inspected screenshots are of the adaptation, not the rendered upstream.
Mobile title/label clipping prevention and Material keyboard-change handling
are deliberate safety/accessibility adaptations. Equal-fixture upstream
comparison, the report/operator layout and all eight complete rows remain open.
The `01249459` push CI is complete (35/35); its separate PR timer-integration
failure used a blind wall-clock sleep rather than the service's returned timer
expiry. The test now validates and waits for that bounded authoritative deadline
without changing production timer behavior or weakening terminal-state checks.
Fresh complete Memory and isolated SQLite integration suites each passed
161/161; full CI for the newly published steps is still pending.

The report stage now adapts the source's 810px raised Material card, required
question warnings, three bulleted lists and send/cancel actions. The shared
answers, measurement results, save controller and stored report payload are
unchanged; only the additional Rewrite application probe is excluded from the
Original list. Public Original reports no longer include Rewrite operator
tools or an extra English check-selector action. Fresh protected SQLite/headful
production and development report gates passed keyboard opening/cancellation,
no accidental report POST, focus return, warning/valid states, cancellation to
Start and 390px layout. Desktop/mobile adaptation screenshots were inspected.
The anonymous save and confirmation dialogs, operator layout and rendered
upstream reference comparison remain open. The production budget is unchanged
at 467.64kB. CI caught the Unit test leaving before the Simple Player's debounced
answer notification; it now awaits the active frame's exact two-answer state
before testing restoration, without weakening the saved-answer assertions.
Current complete push/PR CI is not yet confirmed.

The anonymous report form now adapts the source's actual Material dialog,
500px width/600px height, outlined key/title fields, suffix password toggle and
raised save/cancel buttons. The Original overlay theme is scoped to this unique
panel class and does not alter Rewrite dialogs. The lazy launcher returns only
form values to the existing save controller and closes on destruction, with
no independent authorization or report engine. Minimum lengths, blank fields,
show/hide state, keyboard focus trapping, Escape/cancel focus return, cleared
reopening and desktop/mobile bounds pass protected SQLite/headful production
and development gates. A real Enter submission returns 201, retains both exact
Unit answers and the display-hidden diagnostic in the shared payload, appears
in the report export and is removed by the existing synthetic-data deletion
flow. The initial bundle is still 467.64kB. Viewport-height bounding and
whitespace-only rejection are deliberate safety adaptations; confirmation,
operator layout and the rendered upstream comparison remain open.

The later STARS background-test CI failure was an active Player removing only
the test's artificial trailing outer-JSON whitespace, not losing a raw answer.
The background matcher now compares the entire canonical envelope only for
the active Unit; inactive Units stay byte-exact and raw dataPart strings remain
exact. Four negative/positive matcher tests and all 29 frontend-state tests
passed. A fresh protected SQLite/headful production run passed the foreground,
parallel hard-reload and 28-Unit background sequence, with both queues empty.
Production answer behavior is unchanged and full current CI stays unconfirmed.

| Surface | Required comparisons |
| --- | --- |
| Shell and login | Header/logo/footer, welcome panel, name/password steps, errors, admin entry |
| Participant starter | Booklet selection, start/resume/locked/completed states, review download |
| Participant player | Toolbar, unit navigation, code entry, timer, pause, leave confirmation, loading/errors |
| Workspace | Directory, files, import diagnostics, selection and batch actions |
| Results and monitor | Groups, run controls, response/review exports, attachments |
| System check | Selection, questions, network test, report submission and report administration |
| System administration | Admins, workspaces, settings, authentication and destructive-action dialogs |
| Cross-cutting | Keyboard/focus, narrow viewport, long texts, all three themes, switching persistence |

## Current upstream functional delta

The new baseline includes changes since the previous audit. Before updating
functional completion, examine sensitive-route reauthentication, login-code
case handling, API error/409 responses, report Accept-header handling and
loading transitions. CI-only changes do not create product requirements.
The 2026-10-03 fetch also includes the 19.0 XML, authentication, ownership,
CSV and live-connection changes itemized in PARITY.md. Login and starter source
layouts did not change between the previous UI reference and this revision.

## Source reuse

The Original repository is MIT licensed (IQB). Retain the relevant copyright
and license notices when copying layouts, styles or assets. Account for fonts
and other assets' own license notices separately.
