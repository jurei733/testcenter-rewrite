# Original browser reference qualification

CI renders the unmodified official Original frontend at the exact Source revision and lockfile in `scripts/fixtures/original-browser-source.json`. The producer packages only its compiled browser files with an app-commit manifest and individual SHA-256 digests. Each capture family verifies every file before and after rendering. The five families run independently and remain required for complete CI acceptance. The first three retain their 18 existing tasks; the administration family retains paired settings, and the directory family adds a twentieth task without replacing any previous Source task.

Quick checks reuse committed, measured Linux reference coordinates instead of waiting for the Source capture jobs. This preserves independent feedback and all existing text, behavior, geometry and close-button pixel comparisons. The profile accepts only Linux x64, Node 22, lockfile Playwright 1.59.1, visible Chromium 147.0.7727.15 and the pinned Source revision. Other renderers cannot silently consume it. Mac retains its original references. The historical behavioral reference revision remains unchanged; the visual profile records its own newer Source provenance separately.

The current Linux profile was derived from all 18 successful captures in the three Source jobs in [run 39440889057](https://github.com/jurei733/testcenter-rewrite/actions/runs/39440889057), including legacy completeness and the system-check welcome view. The compiled Source file hashes are identical to the initial producing run 39428558228. Artifact IDs, archive SHA-256 digests, producing branch head and merge commit are recorded in `original-linux-chromium147-provenance.json`. Download these exact ZIPs to a scratch directory and regenerate with:

```sh
python3 scripts/qualify-original-linux-profile.py --archives /absolute/scratch/directory
```

The generator verifies archive bytes, matching manifests, pinned Source and renderer, and successful captures before projecting measured visual fields onto the existing schemas. It reads the single index directly without extracting archive paths. Runtime overlays reject unknown fields, removed controls and changes to authored text or behavior. Legacy completeness and all twelve system-check welcome theme/viewport combinations are now qualified from actual Source captures. Unknown visual cases explicitly fail rather than borrowing Mac pixels. The system-check gate compares the full measured appearance, including exact logo dimensions; its former cross-platform logo tolerance is no longer needed.

Validation at this change: 1,914 frontend tests, 99 CI policy tests, workflow actionlint, the headed Mac header and variant gates, and the complete JSON-roster browser flow pass. The system-check layout build and acknowledgement gate pass locally. The pinned Source build and all three capture families passed in the producing run. Complete CI remains red; Linux acceptance of the latest changes must run before claiming an improvement in passing CI time. This profile is not full application acceptance, and no speedup percentage is claimed from the historical false-green run.

Quick failures also upload the explicit browser artifact directory, alongside the complete failure log, for seven days. The shared browser flow and variant/exit gates write diagnostics there while keeping their SQLite fixture stores in a separate scratch directory. Persistent event-stream pages establish readiness through document, exact Run and completed resume assertions; they do not wait for global network idleness. Opaque controller frames are rendered before native radio input, preserving checked-state and saved-response assertions.

The Source system-check welcome view retains a 1280px content toolbar on a 1280px Linux desktop; narrow views legitimately reserve a native 15px scrollbar. The rewrite now uses the Source fixed window/header/footer with scrolling inside the routed content instead of a window scrollbar that narrowed the desktop view. Login geometry capture additionally records the original entry/header/footer bounds for diagnosing the remaining Linux login discrepancies without inferring coordinates from rewrite output.

## Paired administration directories and dialogs

The directory family now compares **168 complete viewports and 168 independent
Source repeats**: three themes, 1280/390 by 844 pixels, both tables, initial and
selected rows, dirty rights, re-selecting the same dirty row, and role/name dialogs
with empty, invalid and valid fields. Confirmed changes, retained-row edits and
owner re-selection are included. Delete dialogs add empty, invalid six-character,
valid seven-character and cancelled states for both tables; all previous 120
views remain. Native request observers require cancellation to send no mutable
candidate request, and the owned user/workspace must still exist.
Source authority stays at its separate origin. Controlled DTO fixtures allow only
owned role/name PATCH requests with the exact fake Source token and body; unknown
writes still fail. Source's actual frontend performs each request, reload and
selection reset. Candidate contexts inherit only an actual protected UI sign-in
and submit their changes to the protected API. Before each candidate journey,
owned setup restores the same initial name and platform role. Neither Source
fixture authority nor setup credentials enter candidate browser storage.

Sixteen pinned DAO/service/component/template/CSS files establish directory and
dialog contracts, including name minimum length, empty initial rename state,
optional confirmation content and action-specific role titles. Empty Source CSS
files are still checked by their complete hash; missing excerpts are accepted
only for genuinely empty files. The producer verifies actual Source bytes before
building, and consumers verify the same-run compiled manifest before/after capture.
All tabs/builds/repeats use genuine new documents. Full native RGBA comparison has
zero tolerance, witnessed fresh paint, exact restoration and three equal visible
frames. Both settings and directory families require all six native fault controls.

Published `2dc47c98` passes its earlier **36 pairs and 36 repeats on Linux** in
[run 39608434842](https://github.com/jurei733/testcenter-rewrite/actions/runs/39608434842),
job `119251331451`. Evidence ZIP `12348678771` has SHA256
`dcad5f9185668c9ecf528d866a0eef8a3dfa429088272e09b9287513902ea6d5`.
All 108 physical clear/visible frame proofs independently verify against PNGs;
its actual same-run Source producer is `892fde4ab3351ef4156ef0708fd4fff3f2e9475e`.
That full 86-job run is green. It does not certify the later dialog changes.

The first dialog probe found 43,107 differing pixels in the desktop role dialog
and 25,131 in workspace rename; Source reproduced its own dialogs exactly.
Rewrite now uses Source's set/revoke title and optional-content layout, starts
rename with an empty field, applies its three-character name minimum and restores
the native workspace field width/paragraph. Selecting an already selected row
preserves pending rights, matching Source CDK selection behavior. The expanded
local wrapper passes all **84 pairs/repeats**, with 252 physical frame proofs and
16 Source files. Published `375ea6de` also passes all 84 pairs/repeats on Linux,
job `119275166669` in [run 39615271572](https://github.com/jurei733/testcenter-rewrite/actions/runs/39615271572).
Its directory ZIP `12352322630` has SHA256
`8fbe0fbc53af8149461185944bd5026f86a4843d1bea372a4f93b931517bac14`;
all 252 actual PNG records independently verify white pixels, exact restoration
and stable visible hashes. The same-run Source producer is
`76f7b776b4e26cb9a449f029daf58ffcb6ca5442`. Its full matrix completes all 86 jobs
at 28:35 full, 4:14 Fast feedback and 408.8 runner-minutes.
The later mutation expansion passes its final production wrapper at **120 exact
pairs and 120 exact Source repeats**. All 360 actual clear/visible PNG records
independently verify, with 24 narrowly owned Source fixture writes. This local
run uses the remembered Source producer manifest. Published `405915b5` also
passes the expanded 120 pairs/repeats on Linux in job `119289360211`,
[run 39619514441](https://github.com/jurei733/testcenter-rewrite/actions/runs/39619514441).
ZIP `12353948715` has SHA256
`b86bcc69e95bc7a5a77e56e4ebba99671d9325f929aa9544de41c01b3df91e0c`.
All 360 actual PNG proofs independently verify; its same-run Source producer is
`37679a57eef6775d3943deb0ee90e1948c47604a`. All six headed fault controls pass.
That full matrix remains active and does not qualify the later 168-state change.

The first submitted-mutation probe reproduced Source exactly but found 4,854
pixels different after desktop role acknowledgement and 2,982 after rename.
The candidate emptied Source's retained right-hand rows and left a permanent
success paragraph. The implementation now keeps a session-scoped visual snapshot
without staging rights, restores saved rights on selection and uses Source's
Toast/Material snackbar presentations. Native API assertions check that confirming
the role/name never submits the unrelated dirty permission. Retained-row edits
cannot reveal Save or dispatch writes; session replacement and destruction clear
all retained rows.

The first full 120-state local comparison additionally found exactly 670 mobile
pixels different after user re-selection in each theme. Source reproduced all
120 views exactly. Checkbox geometry showed the reused candidate cell content
24 pixels left of Source after a prior native click. An isolated unchanged-build
probe directly records `cell.scrollLeft=24` in the candidate and `0` in Source.
Selection now creates a new
permission-view generation, matching Source's recreated rows, while ordinary
checkbox edits and clearing selection retain the same view and focus. Native
metadata includes checkbox/host/cell bounds and internal scroll offsets. The
final rebuilt production comparison passes all 120 views/repeats. All three
mobile user re-selections record `scrollLeft=0` in Source, candidate and repeat.
No pixel mask, tolerance, layout override, timer change or scenario retry was used.

The first delete-dialog probe reproduces all 28 Source views exactly. Only the
three mobile workspace-delete dialog states differ in the candidate: 4,963 pixels
for empty/invalid input and 4,783 for valid input. Source asks
`Arbeitsbereich "Beta Umbenennung" löschen?` and labels the action
`Arbeitsbereich(e) löschen`; the candidate had a different sentence and singular
action label. The product now uses the actual Source copy. The expanded gate
checks the pinned seven-character confirmation-password boundary, both valid
cancellations and unchanged owned records without authorizing Source deletion.

The first expanded local run completes 140 exact candidate pairs and 140 exact
Source repeats, then correctly aborts on Source's adult/mobile user re-selection:
all twelve sampled PNG hashes alternate between two values. The failure precedes
the new delete dialog and is not a proved candidate defect. The original packet
has hashes only, so it does not identify the changed pixels. Capture failures now
retain the first/last actual sampled PNGs, their hashes/geometry and document
focus/animation diagnostics, without writing a qualifying baseline. All six
native fault controls pass, including a real alternating canvas that still fails
after exactly twelve samples and whose diagnostic PNG bytes match those hashes.
The same zero-tolerance/three-consecutive-frame requirement remains. The fresh
complete production capture with these diagnostics passes all **168 pairs and
168 Source repeats**, with exactly 24 Source fixture writes and twelve confirmed
candidate UI writes. Every delete cancellation sends no mutable request. All
**504 native capture records** are independently checked against their actual
PNG bytes. This valid run does not establish that the earlier Source instability
is structurally fixed; it remains fatal if it recurs. A fresh Linux head is still
required for this 168-state expansion.

Other submitted actions/dialogs, transient notification pixels, error/pending
states, locale-specific name ordering and Source backend authorization remain
outside this measured scope. These comparisons do not close the broad visual
acceptance rows.

## Same-run settings comparison

The administration family renders the pinned compiled Source and the current
production Rewrite in the same lockfile Chromium, with German locale, Berlin
timezone and identical viewport/DPR. Twenty-four initial/bottom states cover both
settings tabs in all three themes at 1280/390 by 844 px. The visible viewport is
captured without resizing and its geometry must remain unchanged by the image.
A shared self-contained comparator decodes both actual PNGs and checks every
RGBA channel; malformed/different dimensions and even one changed channel fail.
The task stores both PNGs, geometry, hashes and differences for review.

Rewrite's visual contexts inherit only state from an actual protected browser
sign-in against an owned SQLite API. Source's controlled API is read-only and
its fixture authentication does not establish Original backend authorization.
The captured static forms include native wheel navigation to the bottom, empty
image assignments, all slots, notices and theme previews; editor/dialog/error
states and full administration acceptance remain open. This comparison uses the
same-run Source directly; the existing three-archive Linux profile and its 18
historical renderer captures remain unchanged.

## Viewport-preserving entry capture

The later Linux run exposed a capture-side effect: a full-page image of the Source's clipped footer text made Chromium hide native scrollbars. The browser viewport still reported 390px, but its entry expanded from 375px to 390px, so a notice measured after the image was wider than the actual UI. Two extra animation frames did not restore it. A controlled classic-scrollbar Source run reproduces that mutation: the old full-page capture fails the new layout guard, while viewport-only capture preserves the 375px entry and measures the same 180.9609375px notice as the unchanged rewrite on that renderer. These diagnostic font metrics are not relabeled as Linux goldens.

Entry captures now retain the authored viewport, and every login/header capture requires the viewport and entry bounds to remain identical across the screenshot. Source welcome capture waits for the enabled next-step control and a foreground render before taking its viewport image. Linux login references produced with the old beyond-viewport capture must be regenerated from a successful new Source run before they can qualify the current gates.

The administrator form equation also reserves the measured native horizontal scrollbar height. The verified successful `header-admin` task in run 39437083440 records the mobile Source at 703px, compared with 718px on the overlay-scrollbar Mac renderer. Both Source capture and rewrite gate now assert the same exact structural equation; no coordinate tolerance was increased. That run's separate welcome task failed with a screenshot protocol error, so the family is not claimed as a complete passing qualification.

The Systemcheck stylesheet is explicitly instantiated on a fresh Original Systemcheck entry. Its extra Rewrite navigation row is removed from Original mode; the shared browser flow returns through the native home logo and Systemcheck entry, preserving held-network cancellation and clean replacement-check assertions. All 1,914 frontend and 99 pipeline tests pass, as do the complete local Systemcheck flow, three acknowledgement saves, Source login/header captures and administrator login gate. Full Linux and PostgreSQL acceptance remain open.

The repaired Source capture now passes all 18 tasks in run 39440889057. Its verified Linux notice is exactly 180.953125px wide, matching the rewrite failure's actual rendered value; the committed profile is regenerated from that run's three digest-verified archives. This closes the capture calibration issue without changing participant login CSS. Optional administrator/Systemcheck/exit images likewise retain the visible viewport and foreground it before capture, avoiding beyond-viewport capture failures and oversized authenticated workspace images.

The exit gate retains trusted pointer/keyboard events, bounded request/response/failure metadata, current dialog/state, a viewport image and the current-case trace on failure. Successful traces are discarded. Diagnostics are independent so one failed image cannot prevent the trace or replace the original error. A deliberately aborted owned return request proves the packet distinguishes a trusted Continue click and `net::ERR_FAILED`; the original timeout still exits nonzero and all three failure files are produced. The full local exit gate passes all 36 Original cases, six Rewrite variants and missing-bundle recovery, with an additional slowed-CPU diagnostic case passing. The intermittent Linux return failure itself remains unproven as fixed.

## IB restoration witness

The IB gate observes the real parent-to-Player Start message in the exact restored opaque frame, and compares its complete unit state and raw data parts with the actual re-entry API response. It retains trusted-input, foreign-session, covered-target, real Document/Script reload, interface and operator-credential separation checks. Authored variables and raw value types remain exact; interaction scores and progress must survive subsequent runtime notifications. This is a stronger restoration witness than comparing two live database reads after the real Player has legitimately advanced its execution-time scores. Requests started by the previous document cannot supply the re-entry witness, and response bodies are consumed immediately. Both Rewrite and Original browser flows pass locally.

Source capture images and indexes are retained for 30 days for review; shared build binaries remain one-day same-run inputs, and failed Quick diagnostics remain seven days. The qualified profile is checked into Git with producing artifact digests and immutable Source/browser provenance.


## Complete participant entry viewport comparisons

The five capture families retain all twenty previous Source tasks. The entry
family adds `entry-viewports` as the twenty-first task. The new task requires 120 complete
Source/Rewrite viewport pairs and 120 independent Source repeats: Primar,
Sekundar and Erwachsene at 1280×720, 390×844, 599×844 and 600×844, each with fresh
entry, logo keyboard focus, name keyboard focus, password, password-submit hover,
caps-lock warning, password visibility, visibility-control hover, back navigation
and invalid credentials. Non-hover states use an actual neutral pointer position
after layout; separate explicit hover states preserve the hovered control. The unchanged
Source frontend receives explicitly owned UI DTOs. The candidate signs in through
its real protected API. This establishes no Source backend authorization proof.
Every pair compares all RGBA pixels at zero tolerance, and nine actual candidate
paint defects (footer, welcome panel and submit control in each theme) must be
detected and disappear exactly after removing their owned styles. Capture must
preserve actual focus, selection, input length, layout and scroll positions.
Each native form transition also verifies that the previous form was detached,
matching the unchanged Source's separate name/password forms.

Scoped Original participant CSS removes the Rewrite's global one-pixel hover
translation. Actual paired captures found the password submit and visibility
control moving while the Original controls retained their authored position.
The legacy name/password and real proof-of-work browser gates remain required.

Native repaint invalidates the descendant paint before **each** of the three
consecutive qualifying frames. Opacity-only capture reproduced stale fractional
card edges, including two alternating actual edge rasters, despite identical DOM
geometry. The clearing frame temporarily hides descendant paint under a fully
transparent root; the actual focus and hover targets remain explicitly visible under
that transparent root. This preserves native interaction without calling `focus()`
or replaying mouse/input events. All changed style attributes are restored exactly, a complete white
clearing image is required, and authored geometry remains exact. A visibility
change without preserving the actual focused element was rejected because it
dispatched blur. Root filtering was also insufficient to invalidate the stale
card edge. Neither rejected method supplies acceptance evidence.

The native browser controls retain perpetual-paint and layout-change failures,
exact one-pixel detection, independent Source diagnostic contexts and failure
cleanup. Additional controls cover explicitly visible descendants, existing root
styles, real link/input focus, selection, blur and independent hover event history for
every native frame. Entry capture also waits for real transient Material ripples
to disappear and finite effects to finish; it does not suppress them.
The image preparation code never receives an expected image or pixel comparison.
The optional sampling-only diagnostics keep their independent preparation and
cannot replace a failing complete viewport comparison.

This addition strengthens two narrow entry flows. All eight broad visual parity
rows remain open, including starter, second-code variants, custom assets/text,
errors and the other application surfaces. Source and candidate images remain
same-run artifacts; no prior-run image or enlarged pixel tolerance is accepted.


Candidate validation remains separate from complete acceptance. The preceding
published application `b02d3d07329591a356938429045ebeae35f48bf4` passed
[all 89 jobs](https://github.com/jurei733/testcenter-rewrite/actions/runs/40263983164),
with 4,404 unit/frontend tests, 2,646 PostgreSQL tests and all 57 exit scenarios;
its actual job span was 30:30. That result excludes this follow-on capture work.
Local production build, all three existing normal/protected participant-login
entries, 46 Source provenance controls, CI policy and the complete dependency
audit pass. The native capture controls retain the explicit macOS exclusion of
the Ubuntu browser-material diagnostic; that case must run on Linux.

A development attempt reached 113 zero-difference viewport pairs,
110 zero-difference independent Source repeats and all nine paint fault controls,
then correctly failed an unstable macOS Erwachsene/600px password viewport. It is
**not** a passing 120-case matrix. On that failure its saved first and last images
both match Source, while intermediate frame hashes alternate. The bounded failure
packet now retains all twelve actual sampled PNGs, not only their hashes and the
first/last image. No failed matrix is retried automatically or exempted. Every
capture additionally requires an actually foregrounded document and preserves
its focus state. The following complete outcomes apply to the implementation
with that foreground invariant and bounded intermediate-frame diagnostics.


On the exact application tree `e838fe4c3556b81ab6a3ffb8c126a157bc3160d1`
(commit `243101d58849b3908d8ec743d69145e6a45a400f`), both the complete local macOS
matrix and [native Linux qualification 40270079942](https://github.com/jurei733/testcenter-rewrite/actions/runs/40270079942)
pass **120 Source/Rewrite viewport pairs, 120 independent Source repeats and all
nine real paint fault controls** at zero pixel tolerance. The Linux wrapper
`d3fe5a805c9f58ae5617f5f1f023591ddbb43a7b` adds exactly one fixed workflow to that
application; its parent, tree and single-file scope were independently verified.
Its actual single-job span is **14:05**. This is scoped qualification, not a
replacement for the complete acceptance workflow or evidence of a causal
whole-pipeline speedup.

Actual Linux logs retain **282 CI-policy, 46 Source-provenance and all 19 native
browser controls**, with no failures, skips or cancellations. All three existing
normal/protected participant-login entries pass, including **38 real browser
proof-of-work challenges** in the protected participant scope. The full Rewrite
locked-graph audit reports zero vulnerabilities. All eight entry-family tasks
succeed, preserving the seven previous entry tasks; the complete workflow still
retains all twenty previous tasks across its five families.

Artifact **12628232481** has **40,148,442 bytes**, SHA-256
`de1fe0ad47c08c624f996a1e9de97212bb65612677980f1795ab51664efe1c13`.
Its 1,806 members were checked for duplicate or unsafe paths; the complete JSON
matrix, required state keys, all **360 visible PNGs and 1,080 clearing PNG hashes**
were independently verified. Clearing frames are white, actual root/interaction
styles are restored and all declared requests stay within the owned fixtures.
The complete macOS matrix also preserves native document focus, input selection,
hover and scroll geometry. The original implementation's earlier failed
development captures remain diagnostics, not accepted goldens.

Complete acceptance for any subsequently integrated head remains a separate
mandatory run. No broad visual parity row is closed by this entry matrix.
