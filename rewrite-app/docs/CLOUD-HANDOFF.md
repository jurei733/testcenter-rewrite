# Cloud continuation: Testcenter Rewrite

## Objective and publication boundaries

Continue toward evidenced complete functional parity with the current Original
Testcenter and an optional identical Original interface. Preserve the existing
Rewrite interface. Read the repository README, `rewrite-app/README.md`,
`docs/PARITY.md`, `docs/ORIGINAL-UI-PARITY.md`, applicable instructions, status
and the last 15 commits before changing code. Paths below are relative to
`rewrite-app` unless stated otherwise.

GitHub `jurei733/testcenter-rewrite` remains the source of truth. Start from the
published `testcenter-rewrite-parity` branch and use existing PR #1. Commit and
push bounded verified steps; do not merge, force-push or rewrite published
history. Preserve the existing main branch, including its Entire metadata.
Do not use assistant-specific branch prefixes or names in publication prose.

Current Original target was independently verified on 2026-10-08 as
`iqb-berlin/testcenter` commit `14c98284590195631750bb2352cb398ca669fe7d`.
Refresh that target before comparing requirements. Fetch/read upstream without
modifying unrelated working-tree changes. Distinguish local checks, published
CI, merged work, deployed work and production acceptance.

## Current camera step

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

Current reference blocker: unmodified Source `14c98284` camera startup fails
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
   now has eight additional regressions (505 core/frontend checks total).
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
