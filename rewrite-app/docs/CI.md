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

## Settings renderer and immutable exit baseline

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
