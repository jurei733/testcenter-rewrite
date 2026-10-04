# Optional Original UI

## Acceptance baseline

Requested on 2026-09-12: keep the existing rewrite interface available and add
an optional interface identical to the Original Testcenter. This is a separate
acceptance axis from functional parity; the historical 94% estimate in
PARITY.md does not measure it.

Reference: `iqb-berlin/testcenter` commit
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
failure still requires investigation, so full current PR CI is not green.

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
