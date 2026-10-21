# CI iteration and complete acceptance

The historical workflow-reported green run is
[`39187723764`](https://github.com/jurei733/testcenter-rewrite/actions/runs/39187723764)
at `d39d8d46`, measured from its 38 actual jobs: **42.9 minutes** from first job
start to final completion and **302.2 runner-minutes**. The Ops chain alone took
2,336 seconds; PostgreSQL UI took 1,177 seconds. These are observed baseline
times, not measurements of the new workflow. Its Quick log at job
`117853584730` also contains the masked HTTP login failure described below.
The 38 green job conclusions therefore do not establish complete acceptance.

The apparent green fast checkpoints at `3e93fcee` (251 seconds) and `7373b68a`
(269 seconds) are **invalid qualification measurements**. Inspection of the
actual Quick log found a failed Original HTTP login hidden by `tee`: GitHub's
implicit `bash -e` shell returned the logger's success. The follow-up explicitly
uses `shell: bash`, enabling `-e -o pipefail`. A subprocess regression reproduces
the old false green and requires the exact failing upstream status, 37, to
survive logging. The older workflow's explicit pipefail *inner* bash was also
insufficient because the *outer* `tee` pipeline still used implicit `bash -e`.
Neither earlier run establishes full release acceptance.

## Bounded loading qualification and observed queue timing

[Run 39567637347](https://github.com/jurei733/testcenter-rewrite/actions/runs/39567637347)
at `92433154` confirms the four longest extended checks actually start together
immediately after Fast feedback. The 20-check extended queue finishes in
**24:11**, compared with **33:51** in the preceding green run: an observed 9:40
reduction. Shared-runner conditions differ, so this is not isolated proof that
ordering alone caused the entire improvement. Fast feedback is 4:21 in this run.

The complete run is **not green**: 83 jobs succeed, loading/compatibility job
`119115511589` is cancelled after its 60-minute deadline and final acceptance
correctly fails. Its only scenario output is the artifact directory; it never
reports the first loading case. No retained failure images are available because
the old upload condition excludes cancellation. The 83 successful jobs finish
by 32:12 from the first start; that is not a complete-acceptance time.

The loading leaf now runs under an independent Node supervisor. Main-flow phase
messages record startup, content, browser launch, initial LOADING/Resume/held-view
steps, completed cases and final cleanup. A phase without progress fails after
60 seconds; an absolute eight-minute bound remains even if phase messages keep
arriving. The child exit status remains authoritative: normal failure status
37 is preserved, and any watchdog expiry returns failure. No retry or successful
fallback is introduced and no existing behavioral assertion is removed.

Before timeout termination, the parent atomically writes `supervision.json`
containing only owned entry/phase/process metadata. It snapshots descendants of
its own child, including detached Chromium-style children, sends TERM, and uses
PID plus process start time for forceful escalation. Independent-process tests
prove a blocked child event loop cannot stop evidence, phase and total limits
are fatal, detached children are stopped and an unrelated sentinel survives.
Environment, request bodies, credentials and scratch SQLite stores are excluded.
The existing narrowly scoped seven-day JSON/PNG upload also runs on cancellation.

The unmodified loading suite and the supervised loading suite both pass locally;
the supervised suite retains all cases and exits normally in 106 seconds.
This establishes the watchdog's local behavior, not the cause or resolution of
the intermittent Linux stall. A new Linux run must provide that evidence.

### Later Original-entry failure and directory selection alignment

[Run 39597348420](https://github.com/jurei733/testcenter-rewrite/actions/runs/39597348420)
at `e353d2be` ends with 17 successful jobs, three failures and six skipped groups.
All four Source reference families pass. The early proof-of-work browser fails
at the Original sign-in branch's first logo-return confirmation, which prevents
Fast feedback and therefore the later matrix from qualifying. The supervised
loading leaf never runs in this attempt; its real Linux behavior remains unproven.
The retained ZIP SHA256 is
`cf3cf5ebcbc5f3074731fff21b0c08cf40b3f2aaeec328d040e9e41659e1b13c`.
Its only screenshot is the older main browser page, whose access was rotated by
the second actual login. Those 401 responses do not establish why the separate
Original page failed to show its dialog. The full proof-of-work command passes
locally, including all admin/participant/second-code challenges and the same
Original entry/return/logout/reentry branch. No product workaround or readiness
assumption is justified by this intermittent observation.

The branch now retains an additional failure screenshot and bounded DOM/HTTP
status evidence from the **actual Original page before its context closes**,
with a main-flow phase label. It rethrows the original failure; no retries,
authentication injection, skipped assertions or alternate successful path are
introduced. Headers, response bodies and browser credential storage are excluded.
Public API snapshots can be cached; live-job observations now use a fresh query
and a no-cache request header before treating a stale queued response as a wait.

The pinned administration fixture also captures the actual mutation and directory
reload methods from both Source files. Same-run Source verification requires
those excerpts and the unchanged full-file SHA256. Source clears its selection
after acknowledged workspace rename and Superadmin-status changes; Rewrite now
also clears selection and pending permission drafts at those successful write
boundaries. Rejection preserves them, and an old-session acknowledgement cannot
clear a replacement session's selection. Name order and real tenant/UUID targets
remain intact. Native tests prove wrong-password recovery, disabled actions after
success, re-selection and unchanged durable rights for the discarded drafts.

Current local validation passes 29 administration-controller cases, 1,961 frontend
cases, 140 CI policy cases, complete typecheck, production build and the full native
administration/settings flow. The Source checkout remains unchanged. This is not
whole-directory visual parity: Source can retain its prior right-table rows after
clearing selection, while Rewrite's table currently derives from its selected
owner. That transient display, directory/dialog/notice pixels and broader backend
authorization still need their own paired references. No broad parity row closes.

## Measured long-journey scheduling

[Run 39562001420](https://github.com/jurei733/testcenter-rewrite/actions/runs/39562001420)
at `8935ff5e` finishes **all 85 jobs successfully**, including final acceptance.
Actual job timestamps measure **3:38 to Fast feedback, 37:40 to full completion,
and 411.0 runner-minutes**. This establishes the split-console workflow's green
baseline; it is slower overall than the earlier 33:40 / 399.3 runner-minute run
at `36113122`, with five additional jobs and stronger capture/exit coverage.

The longest extended scenarios started near the end: activation/roster warnings
846 seconds, JSON roster 716, exit completeness 616, and Verona Player 428.
The 20 extended rows now start in descending measured-duration order. The eight
early scenarios, all leaf commands, four-slot limit, separate native browser
runners and complete acceptance dependencies remain unchanged. Recorded per-job
seconds and the old ordering live in `scripts/fixtures/ci-browser-timings.json`.

A four-slot queue simulation over those same measured durations falls from
1,638 to 1,311 seconds, **5:27 (20%) of that isolated queue**. This is a scheduling
estimate, not measured CI acceleration: GitHub's shared runner availability,
setup and unrelated jobs can change the actual dispatch order and critical path.
A completed run of the new head is required to measure its real effect. No extra
runner concurrency or reduced scope is used to obtain the estimate.

## Independent console qualification jobs

The former `ui-participant-console` job serialized eight independent browser
commands. They now run in five isolated jobs: Source/runtime timer, Debug,
console loading/context compatibility, command completion, and native route/tabs.
The timer reference still precedes its runtime check. Each job restores the same
verified production build and runs at most two commands; no browsers compete for
native focus within the same runner. A policy test reconciles all eight prior
leaf commands exactly once across these shards. All remain required through the
existing matrix aggregate and final acceptance; no check is replaced by Fast
feedback. The 28 fast/extended scenarios and their four-slot extended limit stay
unchanged. This increases the full matrix from 81 to 85 jobs and adds setup cost;
the completed 85-job baseline and its timing are recorded above.

Timer failure evidence moves to its actual timer job. The isolated Debug job
retains only its JSON/PNG evidence for seven days, with SQLite scratch stores
outside the uploaded directory. The console loading upload stays scoped to its
own job. Failure isolation also allows the other checks to execute after an
earlier console check fails, instead of losing the remaining serial coverage.

## Settings renderer and immutable exit baseline

### Fresh native paint before every settings comparison

The Linux diagnostic at `94a7bb25`, job `119087970080`, preserves the failing
baseline while proving that the restored Primar/1280 General-bottom rendering
is exact across Source, Rewrite and an independent Source document. All three
complete RGBA hashes are
`be48eb5d24ed75c1573ee6c92599c803913e99fcc5686dbafe6feeac4f765bcd`.
The Source baseline itself changes two pixels after its witnessed full redraw;
Rewrite changes six. The background A/B/A test is not reversible and does not
justify changing product CSS. The artifact ZIP digest is
`878f9e63dd0dd6f304af26f5cc5f5972451dd3983e9320b43c3686b5c5fa48d0`.
This proves the fresh rendering for that view, not the remaining 23 views.

The same reference-independent native repaint now precedes every settings
baseline in both builds and the Source-repeat series. It records the original
geometry and exact root style attribute, witnesses a fully cleared opaque white
viewport, restores the root attribute, verifies unchanged geometry, and then
requires three equal complete visible PNGs. Each cleared frame and its SHA256
are retained separately. The hidden frame is never returned as a baseline.
Neither the repaint nor steady-frame sampling receives an expected image;
the final comparison still checks every RGBA channel with zero tolerance.
Diagnostic A/B/A sampling remains separately labelled and cannot replace a
baseline verdict. Original source files and the production application are
unchanged.

All 24 local Source/Rewrite comparisons and all 24 independent Source repeats
pass. All 72 capture records prove the fully cleared native frame, restored
root attribute and three steady visible frames, with hashes checked against
the retained PNGs. Six mandatory headed controls retain paint-change and
never-steady rejection, restore styles after failure, reject geometry changes
even during the hidden frame, and preserve a genuinely changed pixel as an
exact one-pixel difference after the actual baseline capture method. Fresh
Linux run `39562001420` also passes all 24 views and 24 repeats, all six
controls and all 72 capture proofs (artifact `12328985234`, SHA256
`3fd0715c08e9a42c88bc5ba93b191d6bc5845a49d2ed429bf98e182cacbc6c9f`).
No broad full-page parity row is closed by this bounded settings result.

### Observe all native Player inputs before freezing exit state

The actual `97a534a0` Linux exit failure in job `119076685007` compares a
first acknowledged packet with field clocks ending in 541 against a later
stored packet ending in 545. Its retained trace has two successful POSTs and
three distinct Player-log entries, with the same authored answer. This alone
cannot distinguish multiple native input events from duplicate processing.

The exit gate now observes actual trusted input events inside the owned Player
and its corresponding parent-window state notifications. Their ordered values
must match exactly. Unique accepted Player log IDs and their original
notification timestamps must match that notification stream, so choosing the
last acknowledgement cannot conceal duplicated message processing. After all
observed inputs have been handled and the real drainer is saved, the complete
stored response must equal the last actual acknowledged packet, including every
field clock. All later immutable cancellation/forbidden-exit assertions remain.

A mandatory native control holds the first successful answer ACK, performs real
End/Space/Backspace input to restore the exact same authored bytes, then releases
the ACK. It requires a separate later acknowledgement with newer field clocks.
The complete local exit gate passes all 36 Original presentations, six Rewrite
presentations and the fallback flows. Its ordinary fills actually emit three
trusted input events and three corresponding Player notifications, usually
coalesced into one save acknowledgement. The held case observes five inputs,
five notifications and two acknowledgements with different field clocks.
Linux validation of the new observers is
still required; the original trace does not yet prove which input path produced
its three notifications. The strengthened gate must expose that distinction.

### Isolated retained-paint diagnostics

Raw Linux images from `7b6090b7` distinguish an overhanging glyph from a
possibly retained pixel: `(39,440)` is white in the current General-bottom
view, but a failing Rewrite capture keeps the exact yellow LCD pixel present
at that coordinate beside the earlier warning label. Source's Images capture
sometimes retains the same pixel even though the label has moved. This is
stronger evidence than calling every differing pixel a current heading edge;
it suggests retained paint but does not yet prove the renderer's cause.

After each Primar/1280 General-bottom baseline, a separate diagnostic records
complete visible-heading/ancestor computed styles and font faces. It tests the
actual Source root background color with an A/B/A restoration, then witnesses a
fully cleared native viewport and a restored rendering. Original baseline PNGs
and their zero-tolerance verdicts have already been recorded and are never
replaced. A separate decoder compares the diagnostic Source, Rewrite and
independent Source-repeat images only after all baseline documents are closed.
These comparisons do not qualify acceptance. Root/surface style attributes and
layout must be restored, including when capture fails. Native scrollbar fade
may change during these diagnostics and remains visible in their own pixels.

Five mandatory headed-browser controls now include successful restoration,
restoration after a failed diagnostic, and a genuinely changed canvas pixel
that remains a one-pixel mismatch after both diagnostic procedures. No expected
Source image is passed to either procedure; no threshold, mask, renderer flag
or baseline-preparation change is introduced. Actual Linux diagnostic evidence
is still required before changing the capture method or production CSS.

### Atomic settings edits alongside the pipeline gates

Original settings saves now use a dedicated protected partial-update contract.
The general and assignment editors send their own fields; the text editor sends
only its changed keys, as Source's actual `changedData` handler does. They no
longer issue a preceding whole-settings GET for each save. The legacy endpoint
retains its required-title/full-text-map contract and omitted-warning clearing.
Both contracts compute their result against the latest state inside the store's
write boundary and commit the matching audit in that same boundary. SQLite uses
BEGIN IMMEDIATE, PostgreSQL shares the catalog/assignment advisory lock, and
File commits one isolated manifest; no settings edit can resurrect an asset
removed by the corresponding catalog writer.

The new mandatory unit/PostgreSQL regression covers a held editor overtaken by
another edit, combined-map limits, missing assets, exact File failure recovery,
late SQL audit rollback and two actually blocked independent PostgreSQL writers.
Protected HTTP checks cover concurrent key edits, missing authentication and a
delegated administrator's denial. A hash-verified fixture retains the actual
pinned Source controller, DAO, editor and DDL excerpts; the PostgreSQL oracle
executes Source's real meta SQL to verify preservation of omitted keys. It does
not claim to run the complete Source backend or its authorization stack.

The full local unit checkpoint passes 3,642 tests, the focused four-store/HTTP
checkpoint 24, and the four-store settings/Source SQL checkpoint 21. CI policy
passes 130 checks, including Source provenance substitutions and mandatory new
regression coverage. Typecheck, production web build and the protected native
administration/settings browser flow pass. The latter still exercises all 102
texts, eight image slots, legacy guards, cascade, roles and password/session
flows. The complete Memory, File and SQLite HTTP suites each pass 172 checks.
Same-commit remote qualification remains required.

Parent `7b6090b7` in
[run 39553564797](https://github.com/jurei733/testcenter-rewrite/actions/runs/39553564797)
still fails administration's strict renderer gate after matching the native
settings host and box model. The Source repeat differs by two pixels in one
view; Source/Rewrite differs by one to four pixels. Saved Linux images show
LCD-colored ink extending one pixel left of two headings in Source but absent
in Rewrite, with identical measured text/layout/styles and all neighboring
pixels equal. This narrows the observation but does not establish its cause.
No tolerance, mask, renderer flags or diagnostic waiver are introduced, and no
broad parity row is closed.

### Native settings structure and acknowledged participant observations

Run [39549352597](https://github.com/jurei733/testcenter-rewrite/actions/runs/39549352597)
at `ebc64f27` finishes with **79 successful / two failed jobs**: the strict
administration reference and its dependent final acceptance. Its Source repeat
matches 23 of 24 views; the remaining Primar 1280-pixel-wide initial images
view differs by one pixel.
Source/Rewrite still differs by one to four pixels. These separate failures do
not establish a shared cause and neither can be waived by the other.

The next settings change follows the actual Source DOM and cascade: the
settings component is an inline host directly containing its tab group, and
the Rewrite's universal border-box reset no longer applies inside the Original
administration root. Material's own explicit box-sizing rules still apply.
The protected production administration flow and all 24 local Source/Rewrite
comparisons plus all 24 independent Source repeats pass. Linux qualification
remains required, and no full-page parity row is closed by this result.

Participant gates now take their immutable debug-error baseline after the
actual second Player's LOADCOMPLETE and error-save acknowledgements. They
still compare the complete Run and parent, including revisions, answers and
clocks. The delayed-terminal scenario holds the first successful owned
`signed_in` runtime snapshot, allowing a legitimate preceding `launched` read
to finish unchanged. A real authenticated browser GET explicitly exercises
that leading read; four helper tests reject foreign participants, failed
responses and unexpected lifecycle states and verify that the held snapshot
remains independent of a newer active response. The browser uses its currently
accepted credential after takeover rather than the initial rotated token.
The complete local console gate passes 43 checks and the debug gate 16.

Both gates now honor the CI artifact directory while keeping their owned
SQLite stores in a separate scratch directory. A failed console job retains
only its JSON/PNG evidence for seven days; debug evidence uses the existing
qualification upload. Shutdown cancels its unused deadline timer instead of
keeping Node alive for five seconds after a clean API exit. The final local
frontend-state suite passes 1,953 checks, the CI policy suite 123, Actionlint
and the production frontend build pass. These results do not replace the
same-commit Linux, PostgreSQL and Docker acceptance matrix.

### Steady native viewport capture

The administration task also repeats every Source view in a third, independent
document after the actual Source/Rewrite series. All original comparisons and
images remain unchanged. Source-to-Source comparisons run only after the full
repeat series and are recorded separately; non-reproducible reference images
fail rather than qualifying a Rewrite result. No repeated image replaces the
original reference. Local validation passes all 24 Rewrite comparisons and all
24 Source repeats, with 18 independently witnessed phase documents. Linux
repeatability is still unproven and is the purpose of this diagnostic. The
81-job matrix, 19 Source tasks and zero-tolerance comparator were unchanged at
that checkpoint.

A local temporal control proves that the unchanged Source's first mobile date
field image can differ by eight pixels from its next five images, with identical
layout measurements and no UI input or DOM mutation. This is not evidence that
all prior Linux edge pixels have the same cause. Capture now measures first,
waits for rendering frames, and requires three consecutive identical complete
PNG byte streams. Every image must retain the original geometry; twelve
unsuccessful attempts fail. The helper receives no reference or Rewrite image,
so it cannot choose a frame to match the other build. Initial changed images
and frame hashes are retained; the final Source/Rewrite comparison still checks
every RGBA pixel with zero tolerance.

Both builds now use the same native page/viewport at each theme/width. Actual
protected Rewrite UI login supplies only its own origin's storage. Source's
fixture key is installed only at its separate origin, and its absence is
asserted at the Rewrite origin. This reduces visual-context creation from
twelve to six without removing any view. Source's body/window overflow owner
and text-container box models are restored in the scoped administration view.

The full local wrapper passes all 24 pairs, with 48 records proving three equal
frames. The real protected administration/settings flow also passes. Three
actual headed-browser controls cover a paint change after the first image,
continuously changing pixels and capture-side layout mutation; these controls
are mandatory before the administration Source family, with their artifacts
retained alongside it. All 122 CI policy checks and Actionlint pass. The other
Source tasks, 81-job matrix and full-acceptance requirements were unchanged at
that checkpoint.
Fresh Linux qualification is required; no broad parity row is closed.

The complete 81-job response for parent `6d87316a` records **78 successful /
three failed jobs**, including final acceptance. Besides administration,
the dialogs family fails its missing-version task: the immediate reload check
observes `#/t/1` instead of the restored `#/t/1/u/1`. Actual Source defers
`window.location.href = '/'` by 100 ms, so the old document's already-complete
network-idle state and still-visible dialog cannot prove reload completion.
The reference now requires a different `performance.timeOrigin`, the exact
original unit URL, and the recreated owned iframe before measuring the new
dialog. Existing URL/title/iframe/error assertions stay intact. Raw reload
diagnostics retain the two origins without changing the historical renderer
profile. Job-list inspection must request all pages (here `per_page=100`);
the connector's first-page job list alone does not prove complete acceptance.
All twelve local missing/unsupported Source cases pass, each with a different
document origin, the exact restored route and one recreated iframe. A separate
two-state corruption control after stable capture keeps the initial image exact,
changes one bottom-image RGBA pixel, and still exits 1 even though its diagnostic
image is exact. Neither the stability barrier nor diagnostics can waive a
changed baseline pixel.

Run [39503613658](https://github.com/jurei733/testcenter-rewrite/actions/runs/39503613658)
at `6f7b0239` completes with **79 successful / two failed jobs**. The corrected
Player-exit gate passes on Linux. The new administration reference fails its
strict pixel comparison, which correctly also fails final acceptance: all 24
views finish, but several Linux captures differ by one to four pixels at the
outer ink edge of headings. Local captures remain exact. The follow-up restores
Source's content-box model for the scoped h2/h4 headings; it is not yet proven
to resolve the Linux difference. Per-image diagnostics now retain the actual
heading text, layout/text rectangles and font/box styles, without increasing
the reference tolerance or including these verbose diagnostics in capture logs.

Follow-up `b5430c6d` in run `39542338492` still fails the administration family
with the same one-to-four-pixel pattern; the heading box model is therefore not
a demonstrated explanation. Its actual Linux geometry and text ranges match,
with inherited `color-scheme: light` versus `normal` and Source heading text
whitespace remaining different. The next change matches those Source values.
If the baseline still differs, a separately labelled diagnostic temporarily
copies Source heading-parent box models into the owned Rewrite page, captures
the result, and restores the original inline styles/layout. Its pixels and
verdict never replace the actual baseline comparison or qualify acceptance.
An isolated local corruption control changes exactly one captured RGBA pixel:
the baseline fails with one pixel while its separate diagnostic has zero, and
the command still exits 1 after restoring the page. The unchanged local family
passes all 24 pairs with equal hashes; all 15 heading text/style records match.

Run `39543317146` at `6d87316a` still fails administration, so matching the
heading whitespace/color scheme also does not establish a Linux fix. Its
separate parent-box diagnostic exactly matches the desktop initial Source,
while one Theming edge pixel remains at the bottom on desktop/mobile. The
follow-up restores Source's content-box only for the Material text-label and
content spans. An exploratory wider tab-container reset was not retained. Eight
local pixels at the date-field corners also appeared with the narrow change;
comparison with the earlier exact captures shows Source changing in one run
and Rewrite in the other. This does not establish a product-style regression.
A focused eight-view capture with actual date-field geometry/styles recorded
is exact, and the date input/container measurements match apart from the outer
flex row's box-sizing. The fixture now retains these measurements rather than
inferring a layout or timing cause from the pixels alone. Parent diagnostics now
record up to five ancestors, run only after the General bottom baseline, and
precede the mandatory fresh Images document. This keeps diagnostic repaints
from changing later baseline pixels in the same document.

The administration Source family adds 24 exact viewport comparisons in one
lockfile Chromium: both settings tabs, initial/bottom views, three themes and
desktop/mobile. It retains the existing 18 Source tasks and runs independently
of Fast feedback, using both verified same-run builds. Complete acceptance now
also requires this fourth reference family. Pixel/alpha/dimension failures stay
fatal; raw PNGs, geometry and hashes are retained for the same review window.

Parent `2878bcfc` finishes run `39496695102` with 78 successful jobs and a failed
Player-exit gate/final acceptance. The actual difference is one millisecond in
otherwise identical captured field clocks. Its old baseline only checked that
the answer was visible in SQLite, which can precede browser acknowledgement.
The fixture now waits for its real answer-save HTTP 200 and completed client
drainer before copying the exact answer/clock bytes. A held upstream ACK proves
the store/client ordering gap and then releases the actual response. All 36
Original exits, six Rewrite variants and missing-bundle recovery pass locally;
the original exact answer/clock, cancellation and timer assertions remain.
This closes that observation gap; current Linux qualification is still required.

## Build dependency audit

Run `39495831501` correctly fails the unchanged high-severity audit gate after
new advisory records identify Angular CLI's transitive MCP SDK 1.31.0 and
Angular Build's Vite 7.3.6. The root overrides pin only SDK 1.32.0 and Vite
7.3.7, with matching registry integrity in the lockfile; Angular versions,
the Original reference lock and the audit threshold stay unchanged. Remove
these overrides when the pinned Angular release carries compatible fixed
dependencies itself. A clean `npm ci` and fresh `npm audit` report zero known
vulnerabilities with the repaired lock. Both development/production builds,
all 3,624 unit/frontend checks and 117 CI policy checks pass. An actual Vite
dev server with a separate owned protected API carries a real browser sign-in
to the Original settings form; the complete production administration/settings
browser gate also passes with the patched install.

The primary advisories identify SDK 1.32.0 as the fix for
[cross-session experimental tasks](https://github.com/advisories/GHSA-22jm-h49p-29qw)
and [cross-origin HTTP/OAuth redirects](https://github.com/advisories/GHSA-6prh-2h8m-c8cw).
[Vite 7.3.7 fixes the inherited Windows editor argument issue](https://github.com/advisories/GHSA-698v-4r3x-3vcv).
These are development-tool dependencies; the Angular CLI MCP transport in this
locked release is stdio. The fix retains the gate rather than excluding the
packages or accepting a framework-major upgrade from `npm audit fix --force`.
Successful historical audits remain observations at their recorded time.

## Fast feedback

For a settings renderer iteration, compile the current Rewrite once with
`npm run build`. With the unchanged pinned Source checkout already compiled,
the following runs only the paired administration family. It retains all 24
pixel comparisons, Source manifest checks and actual protected Rewrite login;
it does not run the other families, databases or complete acceptance. Use the
actual absolute Source browser directory and a fresh evidence directory:

```sh
export GITHUB_SHA="$(git rev-parse HEAD)"
node scripts/original-browser-reference.mjs pack /absolute/path/to/unchanged-original
UI_SMOKE_HEADFUL=true \
ORIGINAL_BROWSER_REFERENCE_ROOT=/absolute/path/to/unchanged-original/frontend/dist/testcenter-frontend/browser \
ORIGINAL_BROWSER_CAPTURE_DIR=/absolute/path/to/new/administration-evidence \
node scripts/original-browser-reference.mjs capture administration
```

The wrapper manages the child commit and fixture environment. On headless Linux,
prefix the final command with `xvfb-run --auto-servernum`. It logs a short task
status and evidence path; complete measurements remain in `index.json` and the
per-image JSON/PNG artifacts, including heading diagnostics. This focused local
route supplements the unchanged mandatory CI matrix.

For local asset/settings iterations, `npm run test:application-assets` builds
only the TypeScript core and runs catalog/assignment rollback, real protected
HTTP and controller tests, without compiling Angular or starting a browser.
After an existing core build, use `npm run test:application-assets:built`.
Set `FIRST_SLICE_STORE=postgres` and an owned `FIRST_SLICE_POSTGRES_URL` to also
exercise the actual Source SQL foreign-key cascade, queued cross-connection
stale writes and PostgreSQL rollback. The same store/HTTP regressions remain
mandatory in `test:unit:built` and the full PostgreSQL integration runner.
The Source build verifier also checks their captured PHP/DDL provenance.
These focused commands supplement complete CI acceptance; they do not replace it.

`Fast feedback` requires the production build, development typecheck, CI policy,
dependency audit, complete unit/frontend/terminal-overlap tests and eight short
browser gates: bug reporting, real Original login, protected login, administrator
login, proof of work, Systemcheck, participant isolation/variants and real IB
restoration. These run before the long browser journeys can occupy runner slots.
A failure prevents expensive dependent jobs and still fails `CI acceptance`.

All 27 existing browser scenarios remain independently required. Original
administration adds an independent real-API gate, bringing the set to 28. The
20 extended scenarios run in `quick-extended` after fast feedback, with four concurrent slots, alongside
PostgreSQL, the broad matrix, deployability and the three Compose modes. Long
prefix journeys therefore do not block the first meaningful checkpoint or
serialize the start of the PostgreSQL flow. The cap leaves runner capacity for
the other qualification groups. Policy reconciles both tiers with the complete
local Quick command and all four local groups, requires every scenario exactly
once and requires both tiers for full acceptance. The Docker image gate builds
from source independently. `Fast feedback` alone is not release acceptance.

One production build supplies all host test jobs. The archive is only 3.3 MiB in
the local checkpoint. Built-script aliases retain each original test command
and environment. A source-pinned baseline command inventory checks that no prior
qualification was lost. The eight prior Ops gates are independent jobs; the new Original administration
flow also runs in the extended entry group. Every
existing scenario, both camera facings, native routes/tabs, controller references,
full browser flow, database adapter and deployment mode remains required.

Run [`39490598043`](https://github.com/jurei733/testcenter-rewrite/actions/runs/39490598043)
at `36113122` completes **all 80 jobs successfully**, including complete acceptance,
Source references, PostgreSQL, all browser tiers and Docker/Compose. From the
workflow start at 20:16:43 UTC, `Fast feedback` completes in **4:25** and final
workflow success in **33:40**. The actual jobs consume **399.3 runner-minutes**.
This is a qualified baseline for that commit, before the new atomic asset slice;
it does not establish production or complete-page visual acceptance.

The earlier **3–6 minute** fast estimate remains provisional. Actual run
`39446720581` demonstrates why putting every prefix journey in the first tier
was insufficient: even its successful runtime-error job took 400 seconds,
before considering queued jobs and the later PostgreSQL flow. The eight short
gates and cancelled idle timers address that critical path. The **20–25 minute**
complete estimate was not achieved by the qualified 33:40 run above. Queues and
cold downloads add time. Reusing host builds and suppressing duplicate feature
push/PR runs avoid redundant work, but do not establish a total compute saving:
399.3 runner-minutes exceeds the historical 302.2-minute, 38-job apparent-green
baseline, with wider coverage and corrected failure propagation. More parallel
jobs do not imply more test coverage.

Run `39446720581` qualifies the corrected Linux login, protected login, header,
Starter, Systemcheck, saved-report, attachment, variant and real IB restoration
gates. It is still a failed run, so it is not a complete timing baseline. Its
player-exit trace records Playwright completing a click while Material still
has `mdc-dialog--opening`; no trusted pointer event reaches the confirmation
button and no return request exists. The fixture now awaits Material's actual
opening lifecycle and rendered finite transitions before its native click.
The same barrier protects the reopened completeness dialog. It does not force
clicks, change animation durations, synthesize events or retry mutations.

Two other readiness conditions retain the exact restoration assertions. Runtime
error recovery waits for a new document `performance.timeOrigin` and the owned
Player's enabled answer input, which is enabled only after its real Verona
Start packet restores answer and progress. Shared-parameter navigation waits
for the second Player's actual `publish-red` definition: inherited `language=de`
alone can still be visible in the preceding iframe. Administrator captures
foreground the page before interaction, await the destination component after
navigation and wait for two rendering frames; capture errors remain fatal and
save viewport/component diagnostics in the uploaded failure artifacts. These
are fixture synchronization changes, not weaker application assertions.

Smoke deadlines now clear their losing timers on both success and rejection.
Previously a successful owned API shutdown still kept each child process alive
for ten seconds, repeated across runtime-error variants; header/exit cleanup
also retained five-second timers. `smoke-deadline.test.mjs` runs real subprocesses
to demonstrate that the old pattern remains alive and the replacement exits,
and verifies unchanged failure identity, timeout failure and cleanup escalation.
The shutdown limits and forced termination of stalled servers are retained.
This removes harness idle time; complete hosted speedup remains unmeasured.

## Artifact and credential boundaries

- Third-party Actions use immutable commit SHAs. Checkouts do not persist the
  GitHub credential. The workflow has only `contents: read`, no repository
  secrets, no privileged `pull_request_target` or `workflow_run` execution.
  The follow-up pins official checkout 7.0.1, setup-node 7.1.0, cache 6.1.0,
  download-artifact 8.0.2 and upload-artifact 7.0.2. Their inspected metadata
  declares Node 24 and retains every input used here. The observed hosted runner
  2.337.0 meets their minimum runner requirements; application jobs stay on
  Node 22. `ci-action-versions.json` records exact commits, release/source URLs,
  metadata hashes and accepted inputs. Artifact digest mismatch is explicitly
  fatal in the download action, before the application-level manifest check.
- Dependency installation uses the lockfile. The separate audit includes
  development dependencies and fails on high/critical findings. npm package
  caching retains the normal package-integrity checks, not installed modules.
- Chromium caching uses the exact OS, architecture and lockfile hash; system
  libraries are still installed. No browser binary is taken from a build artifact.
- Production artifacts are immutable, named by the exact tested SHA and downloaded
  from the **same workflow run**. There is no arbitrary run-ID/token override.
  Before extraction, the manifest checks commit, lockfile hash, Node major, OS,
  architecture and archive digest. Only the declared compiled/schema roots can
  be restored; links, special files, path escapes and symlink destinations fail.
- Archives contain no database, participant state, environment file, credential
  or installed modules. Generated schema bytes remain an ephemeral installation
  cache, not republished source. Build artifacts expire after one day. Existing
  bounded failure logs retain their seven-day policy.

Push runs cover `main`; pull requests cover every update, and merge queues plus
manual runs are supported. Composite-action changes trigger the workflow too.
Superseded runs are cancelled. No runtime tests are selected away by a broad
file-name heuristic. Full acceptance rejects every failed, skipped or cancelled
qualification group. Repositories requiring a single protected-branch check
should require **CI acceptance**, not the fast checkpoint. This change does not
alter repository branch-protection settings.

## Browser qualification that preserves failures

Quick runs visible Chromium in Xvfb, matching the mode used to collect the
pinned Source visual measurements. Playwright's system dependency installation
already installs Xvfb. `UI_SMOKE_HEADFUL=true` is respected by every Original
Quick geometry fixture, including exit completeness. The wrapper and logger
remain in the explicit pipefail shell; failed shard logs have distinct artifact
names and are retained for seven days.

The same unmodified Source build at `eedae41840cbe90e5547c0211da818bdf620f5aa`
reproduces both exit-dialog renderings with the installed Chromium: visible
height 139 at y=290.5, headless height 140 at y=290. A headless rewrite matched
the headless Source, while the stored reference describes visible Source.
The fix aligns browser modes and retains exact geometry/text/style assertions;
it does not introduce pixel tolerances or remove a comparison.

The newly visible HTTP initialization failure was an unconditional
`crypto.randomUUID()` in native controller identity creation. HTTP browsers
support `getRandomValues` but may omit `randomUUID`. Native owner and command
delivery IDs now use CSPRNG-generated RFC 4122 v4 bytes in that case. Existing
native UUID generation, durable retries, document ownership and HTTPS-only
proof-of-work policy are retained. Three new actual-source tests fail before
the fix; all four added identity cases pass afterward, including denied
session storage and native UUID preference. The real HTTP login smoke reports
any global initialization error before attempting credentials.

The Source-aligned local follow-up passes all 36 Original player-exit cases,
all six Rewrite exit variants and missing-chunk recovery. The Systemcheck gate
also passes again after its incoming Player observer is installed before the
owned check document loads; installing that observer late could miss the real
start packet. Its `logPolicy === "disabled"` assertion is retained.

Complete acceptance is still open: the newly observable exit-completeness
pixel check differs from its Source SHA in one case (10 RGBA channels, maximum
intensity difference 1). A fresh visible Source capture reproduces the stored
Source hash, so the assertion remains failing pending diagnosis. The earlier
PostgreSQL full-browser run also times out returning from a resumed Starter
card; this is not a successful release result. The workflow must expose these
failures and skip dependent long qualification rather than conceal them.

## Original reference on the qualification platform

The first truthful 27-scenario Linux run exposes more than the two initially
observed failures. Several exact Mac measurements differ from Linux's native
scrollbars, font metrics and rasterization. Changing the rewrite to match Mac
coordinates on Linux would not prove correspondence with the Original there.

`Pinned Original browser build` checks out the official
`iqb-berlin/testcenter` revision
`eedae41840cbe90e5547c0211da818bdf620f5aa`, verifies a clean tracked tree and
the exact frontend lock hash, and uses that frontend's normal production build.
Only its documented ignored environment file is generated from its own template.
It builds once. A same-run artifact supplies entry, dialog and Starter capture
jobs under the same Linux/Chromium/Xvfb mode as the rewrite. Its manifest binds
the consuming commit, Original revision, Node major, OS, architecture and every
compiled file; extra/missing/changed files and links are rejected before use.

The Source drivers retain their click, keyboard, request, unknown-route and
state assertions. Their explicit capture mode records the pinned Original's
actual geometry instead of comparing it to an unrelated Mac measurement.
This mode is restricted to the Source capture driver and never bypasses a
rewrite assertion. Single-case selectors, scenario flags and alternate browser
channels are cleared between captures. JSON and screenshots identify the
Source revision, browser version and renderer; close-button RGBA hashes are
decoded separately from the actual Source PNGs. Finite screenshot animations
are completed before geometry is sampled, so an entering tooltip cannot become
a new baseline. These are UI fixture references,
not proof of Original backend authentication.

The rewrite gates continue to require their existing comparisons while these
platform-specific references are qualified. The source jobs are also required
by complete acceptance. Collecting evidence does not itself close any full-page
Original UI acceptance row.

The first hosted capture at `629eea05`, run `39428558228`, passes the pinned
build and all three families (16 Source tasks). Its Linux tooltip width is
94.859375; its HTTPS notice is 719.078125 wide and 46 high. Those are exactly
the values rejected by the old Mac references in the rewrite jobs. The three
downloaded capture archives match their GitHub artifact SHA-256 digests.
This proves the calibration issue; consuming qualified Linux values remains
separate work, and the rewrite comparisons are still required.

The variant browser gate also contained a deterministic fixture race: a visible
resumed answer did not prove that the command's completion write had finished.
The final competing background save now follows the exact accepted command ID's
real completion response, retaining the earlier overlapping writes. The legacy
latest-by-updatedAt assertion and selected-Run/answer assertions remain strict.
Original uses its visible logo to return, the browser's reload for its raw-text
extension, and its visible paused panel; the hidden Rewrite toolbar/status is
not treated as an Original user control. The complete gate passes both renderer
modes locally, in both interfaces and all three non-saving entry modes, with
actual SQLite/authenticated requests and trace artifacts.

## Local verification

Use Node 22. Run `npm run test:ci-policy`, `npm audit --audit-level=high` and
Actionlint against the root workflow. Policy tests parse the actual workflow
and composite action, reconcile all prior commands and validate artifact
failures, including real corruption, stale source/lockfile and symlink cases.
The command inventory allows additional explicit test files while still
requiring every previous file; removing files or changing runner flags remains
a failure. This avoids blocking ordinary test additions during iteration.

To reproduce artifact reuse in a fresh checkout, first build with
`FIRST_SLICE_XML_SCHEMA_CACHE=.ci/xml-schemas`, then run
`GITHUB_SHA=<full-sha> node scripts/ci-build-artifact.mjs pack`. After `npm ci`
in a second checkout at that SHA and lockfile, set `CI_ARTIFACT_DIR` to that
archive directory and run the same command with `restore`. Run only `:built`
aliases against the restored outputs. The local checkpoint passed this fresh
consumer flow and all 16 authenticated attachment-text browser cases without
building that consumer's application.

For a focused local browser iteration, build once, then run
`npm run ci:browser:quick:entry:built` (or `system-check`, `participant`,
`content`). Use `CI=true UI_SMOKE_HEADFUL=true` for the Source visual mode on
a desktop; on Linux wrap the command in `xvfb-run --auto-servernum`. Keep the
compiled frontend immutable while browsers run: development typecheck builds
also write `dist/apps/web`, so complete typecheck and the production build
before starting these consumers. CI already isolates those build directories
between jobs and verifies the immutable shared archive.

The complete Memory HTTP suite also passes 172/172 against the reused schema
cache. Remote Linux/PostgreSQL/Docker qualification and actual improved timing
remain pending until the new published workflow completes.
