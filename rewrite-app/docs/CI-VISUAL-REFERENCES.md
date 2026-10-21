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

## Paired administration directories

The additional directory family compares 36 complete viewports: three themes,
1280/390 by 844 pixels, Admins/Arbeitsbereiche and initial/selected/dirty-rights
states. It derives read-only Source DTOs from owned protected setup, with separate
Source numeric IDs and actual candidate tenant/UUID identities. The unchanged
Source DAO's global ordering, DTOs, service URLs, component fields, templates and
CSS are pinned by eight complete file hashes and actual excerpts. The Source
producer verifies those files before building; consumers verify the same-run
build manifest and every compiled file before and after capture.

Candidate contexts inherit only an actual protected UI sign-in. Fixture authority
is restricted to the separate Source origin, where non-GET and unknown requests
fail. All phases and tabs use actual new documents, including Source repeats;
changing only Source's hash route is insufficient. Both builds use the same
native window and zero-tolerance full RGBA comparison, with fresh native paint,
exact style/layout restoration and three equal visible frames. Six mandatory
paint/layout/one-pixel controls run in this family as well as settings.

Local qualification passes all 36 pairs and 36 independent Source repeats.
All 108 capture records independently match their retained cleared/visible PNG
hashes, fully white cleared pixels and three steady frames. The actual CI capture
wrapper also runs locally with the remembered Source producer manifest; this
remains local evidence and does not replace a new same-head Linux qualification.
The full matrix grows from 85 to 86 jobs. No prior Source/browser check is removed.

These scenes exclude submitted mutations, dialogs, transient notices, Source's
retained permission rows after clearing selection, backend authorization and
locale-specific database collation. Those require further paired evidence; no
broad full-page parity row is closed by these 36 baseline scenes.

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
