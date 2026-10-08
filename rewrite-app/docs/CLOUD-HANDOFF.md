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

1. Confirm current publication checks and complete browser acceptance. Diagnose
   any reproduced failures from real logs before changing production code.
2. Bring the optional Original Review side pane into line with current upstream
   toolbar, form, list, buttons, edit/back/add states and primary/on-primary
   colors. The current generic 420px Rewrite pane is not visual parity. Compare
   actual rendered current Original pages in all three themes and both widths;
   source or isolated CSS checks alone do not close a full-page acceptance row.
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

The local cloud CLI currently reports `environment_repo_access_failed` for this
repository and shows no configured environment. Cloud execution requires granting
the connected cloud account GitHub access to this repository and publishing an
appropriate environment; a local desktop task is not a substitute for that.

Use fresh owned synthetic SQLite/PostgreSQL fixtures and repository scripts.
The local private tryout database and untracked
`docs/testcenter-thread-migration-process.pptx` remain untouched and unuploaded;
they are not prerequisites or available cloud fixtures. Avoid copying unrelated
local services or claiming they remain available after the laptop is closed.

Record fresh Entire checkpoints for real commits when the cloud runtime supports
its actual session trace. Verify the checkpoint trailer and remote checkpoint
ref. Never fabricate traces or attach an old local session as cloud evidence.
If cloud capture is unsupported, report the limitation without obscuring the
GitHub code history. Keep acceptance evidence and negative results honest;
never commit credentials, private response data or unrelated user artifacts.
