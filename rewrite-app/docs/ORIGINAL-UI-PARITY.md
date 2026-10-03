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
an IntersectionObserver. Equal-fixture comparison, the account panel and the
operator/monitor starter remain open; this is not a closed visual-parity row.
The focused integrated memory/Chrome smoke passed on 2026-10-03 through
`participant-entry-sign-in`, including cancellation of return, confirmed
return to the Original card and resuming the exact same session/run. Additional
local browser checks cover locked/completed cards, retry after a failed resume,
desktop/mobile widths and an actual Review account's empty CSV response (204)
with its authored start-button text. Full CI for the new commit is still a
separate gate. The current production bundle is 467.25kB under the unchanged
470kB error limit; its 450kB warning remains.

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
surface gate. Remaining sidebar contents, account/footer, dialogs and matching
reference screenshots keep the Player visual-parity row open. This is not a
completed visual-identity claim.
An additional headful check passed authored Unit/Booklet header titles,
preservation of a hidden header after cancelling return to the starter, hidden
and explicit global-forward controls, and the Original `markedNo` interaction:
the task arrow remains actionable for a completeness explanation, stays on the
same task when denied, and advances only after the required response and
presentation are complete. All of these cases are also in the repository smoke.

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
