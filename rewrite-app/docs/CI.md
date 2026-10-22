# CI iteration and complete acceptance


## Resolve a cancelled-route cleanup stall (2026-10-22)

The native file-view publication `25425aa3` passes its new required browser row,
the five Source reference families, unit and policy jobs in
[run 39797255399](https://github.com/jurei733/testcenter-rewrite/actions/runs/39797255399).
Its participant-console job `119891749999` fails the existing 60-second phase
watchdog while awaiting `unrouteAll({behavior:'wait'})` after the native terminal
case. This run cannot qualify complete acceptance; other useful jobs continue.

A caught fetch/JSON failure before `fulfill` returned from its callback without
settling Playwright's separate route-handling promise. The terminal handlers now
explicitly abort that route. Only an observed browser cancellation is expected;
unexpected fetch errors and abort failures remain fatal. An already handled
route does not hide the original error. The phase/total watchdogs, durable
answer/clock assertions, command receipts and complete CI prerequisites remain.

The existing browser job now also exercises real Chromium cancellation and an
unexpected injected pre-fulfill error. It verifies both route drain
and error retention under five-second bounds, using its existing browser/API.
An independent negative control removes only the abort: the callback returns,
but real Playwright cleanup still hangs and the control rejects at its deadline.
Restoring the abort passes both cases. This does not add a CI job, dependency
installation, retry, ignored assertion or longer timeout.

The unmodified local browser journey can pass, confirming that one replay alone
cannot diagnose this intermittent cleanup failure. The repaired journey passes
all **44 phase markers**, including its new control. The final replay after a
fresh clean TypeScript core build also passes all 44 markers and shuts down its
owned API. All **186 portable policy controls**, Actionlint and whitespace
checks pass; the two real-Linux controls remain explicit macOS skips. The new
head still requires its own Linux qualification. This is a reliability fix; no
whole-pipeline speedup is inferred from an early failed run or a local replay.


## Full Linux checkpoint at d4e592cf (2026-10-22)

Published `d4e592cf` [run 39790219381](https://github.com/jurei733/testcenter-rewrite/actions/runs/39790219381)
finishes **86/86 jobs successfully**, including complete acceptance, all five
Source families, PostgreSQL, Docker/Compose and deployment checks. Actual Linux
logs pass **188/188 policy controls** and **121 + 322 + 1,270 + 1,992 = 3,705
unit/frontend cases**, with no skips or cancellations. Canonical guided import
review and both previously stalled login rows now complete.

Across actual job timestamps, elapsed full time is **30:51**, Fast feedback
**6:11**, and summed runner consumption **420.43 minutes**. The previous green
`375ea6de` run is **28:35 / 4:14 / 408.8 minutes**; these different publications
are observations rather than a controlled benchmark. Overall acceleration is
still not established. The 39.4% paired label-phase result remains scoped.
Both inspected login jobs report prior HTTP/HTTPS download limits as **null**,
not 128. Their HTTPS package downloads reach about **4,112–6,756 kB/s**, but the
old 113–133 kB/s episode's cause remains unproven. Explicit zero/default settings
are configuration verification, not proof of a fixed configured throttle.

This qualifies the published parent, not the native file-view changes below.
The current-run PNG archives have not been independently downloaded/rehashed in
this checkpoint; the mandatory current Source jobs pass, and the earlier
independently verified pixel evidence remains separately identified.

## Native workspace file gate (2026-10-22)

The broad matrix gains `ui-original-workspace-files`; the historical acceptance
prerequisites and Quick distribution remain. Its owned real API/browser checks
use the production build and Original-19 schemas for all five loose file types,
three themes, both widths and actual RW/RO sessions. They assert real snapshot/
roster outcomes, exact UTF-16/empty downloads, overwritten history, selection,
partial deletion, logout during a held download, and missing lazy-code recovery
through an explicit user Reload. The derived focused shard runs independently.

All **3,719 local unit/frontend cases**, the four strict-XSD journeys, fourteen
native file-browser cases, protected APIs in all four stores, **186 portable CI
policy controls** and Actionlint pass locally. Two actual-Linux controls remain
explicit macOS skips. The 470 kB initial production budget remains: the new
native view's first 480.67 kB build is rejected, shared date formatting is removed
from the entry graph, and the final 468.39 kB build passes. A temporary disposable
bundle-inspection build is not counted as qualification. Full Linux evidence for
these new changes is still pending; do not cancel the useful parent run to
publish an unfinished successor. Native Source file pixel comparison and the
complete four-tab workspace still remain open.

## Canonical candidate regression and slow HTTPS download (2026-10-22)

Published `e77c4fe5` [run 39783730393](https://github.com/jurei733/testcenter-rewrite/actions/runs/39783730393)
ends with **17 successful, four failed and six skipped jobs**. All five Source
reference jobs, strict Linux typechecking, **188/188 policy controls** and the
complete **3,704 unit/frontend cases** pass. This is an early failed run: the
extended matrix is skipped and full acceptance correctly fails.

Proof-of-work exposes a real import regression. The shared resolver drops valid
canonical standalone Unit drafts merely because importing them without a Booklet
runtime marked their import rejected. Guided review then incorrectly loses its
two/three-candidate ambiguity. Current-file-only filtering is now explicitly
limited to Source loose-file operations. Canonical review retains its failed
but valid draft candidates; accepted replacement history remains excluded.
The actual protected API regression sequence checks two candidates, three
candidates, stale selection rejection, exact chosen Unit runtime bytes, and a
separate Source-mode compile excluding those rejected drafts in all four stores.
The unchanged complete `quick/proof-of-work` browser row passes locally after the
fix (103,908 ms), including its original ambiguity assertions.

The Original-login job never reaches application startup: the full dependency
installer exits **124 after 305,030 ms**. HTTPS archive preference is effective,
but index downloads take **60 s for 7,936 kB (133 kB/s)** and packages **3m49s for
25.9 MB (113 kB/s)**. Another completed Original-admin-login installer in this
same run takes **17,986 ms**. This variability neither proves a configured cap
nor a general speedup; selecting HTTPS alone does not establish reliability.

Browser setup now logs only the preexisting numeric HTTP/HTTPS `Dl-Limit`
values (or null when absent), never proxy configuration or URLs. It explicitly
sets and verifies both values to APT's documented default **0 / unlimited**,
while retaining transport inactivity/retry bounds and the complete five-minute
installer deadline. The [APT transport manual](https://manpages.debian.org/trixie/apt/apt-transport-http.1.en.html)
defines this setting in kB/s and explains that a nonzero cap also serializes
server downloads. Provider/network throughput limits are unaffected. No actual
runner cap has yet been observed. Owned shell controls exercise an explicit
128 kB/s fixture, denied writes, ineffective values and proxy-secret exclusion;
the real Linux APT control additionally checks merging and a later download-limit
override. Actual new-head installation speed still requires Linux evidence.

## Prefer the existing HTTPS archive after a measured package stall (2026-10-22)

The `3cb179b8` [run 39779073869](https://github.com/jurei733/testcenter-rewrite/actions/runs/39779073869)
ends with **18 successful, three failed and six skipped jobs**. The full unit
suite, all five Source reference jobs and seven early browser rows succeed.
Original-login never reaches its application test: the complete browser
installer exits **124 after 305,121 ms**, correctly bounded by GNU timeout.
Fast feedback and acceptance reject the failed prerequisite. The larger matrix
is skipped; its unexecuted cases cannot qualify. Elapsed time **12:22** and
**69.1 runner-minutes** therefore describe a failed early run, not a faster
complete 86-job qualification.

The retained log locates the delay in fetching about 25.9 MB of packages from
the Azure archive, including font acquisitions spread across several minutes.
Transport inactivity bounds do not guarantee a short whole installation, and
the new total deadline alone does not fix the mirror behavior. The pinned runner's
[mirror source](https://github.com/actions/runner-images/blob/ubuntu24/20261012.334/images/ubuntu/scripts/build/configure-apt-sources.sh)
already contains the HTTPS Ubuntu archive and security archive behind Azure.
Browser setup now promotes those same existing HTTPS archives to priorities
one/two, retaining Azure as priority three. No archive is added or removed;
source suites, signature verification, TLS verification and the complete
dependency installer remain. APT's
[documented priority order](https://manpages.debian.org/trixie/apt/apt-transport-mirror.1.en.html)
tries the lowest number first rather than merely trusting line order.

The transformation accepts only the known three-archive runner profile and
fails closed on changed hosts, credential-bearing URLs, duplicate/missing
archives, extra options or unrecognized priorities. It prepares a temporary
file before the root installation, then verifies the installed bytes. This
avoids reading through a pipe while tee truncates the same input file. Five
controls qualify transformation/idempotence and malformed profiles; a real
composite-shell control with owned shims preserves preparation status 37,
denied-install status 51 and verification failure, without root/system writes.
All **186 portable policy controls** pass locally; the two actual-Linux controls
remain explicit macOS skips. The previous head already passes both on Linux
(182/182, zero skips). Real mirror selection and overall speed require the next
head's complete Linux run; no test retry or deadline increase is introduced.

## Current Linux failures and qualified corrections (2026-10-22)

The full `b9713c2b` [run 39769124218](https://github.com/jurei733/testcenter-rewrite/actions/runs/39769124218)
finishes with **82 successful jobs, three failures and one cancellation**. The
aggregate correctly rejects the two failed tests and the cancelled prerequisite.
Measured from actual job starts/completions, full time is **48:02**, Fast feedback
**13:01**, and consumed runner time **545.1 minutes**. These results do not prove
an overall pipeline speedup. The earlier local 39.4% improvement applies only to
the 52-case label phase below. Console-loading now passes all 43 loading and five
compatibility cases on Linux, with both owned APIs shut down; this is
non-recurrence, not an established cause/fix of its preceding timeout.

Native routes pass their seven cases before native tabs fail after document
load at a global `networkidle` wait. The old evidence does not identify the
outstanding connection. The driver now waits for DOM content and all five actual
native command bindings. An independent owned browser fixture must reject a
missing binding and accept complete bindings while a real background request
remains pending. This follows Playwright's
[explicit readiness guidance](https://playwright.dev/docs/api/class-page#page-wait-for-load-state).
All existing Run/answer/clock, tab ownership, exact journal replay and ACK checks
remain. The fresh full focused shard passes seven route and twelve tab cases;
the latter includes two additional driver controls. Failure upload is limited to
one bounded public JSON containing fixed check labels, error class and own-origin
request method/path. No error payloads, bodies, headers, queries, foreign URLs,
screenshots or private SQLite scratch directory are uploaded by this new step.
Two privacy/bounds controls include planted credential/query/error secrets.

Original exit fails its final confirmed return after held Resume context: an
absent Unit answer becomes `''`. Cancellation already preserves the exact state.
The retained trace proves that a log-only save has drained before the foreground
fallback unconditionally writes the unchanged empty draft. The fallback now
compares the draft with the effective saved/ephemeral response; actual changes,
including intentional clearing, still save exact bytes. Original's unchanged
`setupUnitDataPartsBuffer` and `closeAllBuffers` implementations at the pinned
source confirm that closing an empty buffer sends no answer update. Four of nine
new actual-method controls fail before the fix; all nine then pass. The native
Resume case now explicitly waits for the real log-only ACK before confirming
return, retaining its exact absent-answer assertion. Fresh production qualification
passes **37 Original exit cases, the missing-bundle fallback and six Rewrite
cases**, with owned API shutdown. All **1,992 frontend cases** and strict local
typechecking pass. These results require fresh Linux qualification.

The cancelled runtime-error-contract job never starts its application test:
browser dependency installation spends about 19.5 minutes in APT mirror fetching
until the existing 20-minute job bound. Browser setup now installs and verifies
APT's 15-second HTTP/HTTPS connection/data-inactivity timeouts and one failed-file
retry before the full Playwright dependency installer. These are
[transport bounds](https://manpages.ubuntu.com/manpages/noble/man1/apt-transport-https.1.html),
not a global step deadline or test retries. The installer additionally runs under
GNU timeout: five minutes, TERM, then at most fifteen seconds until KILL. Its own
nonzero status remains unchanged; timeout is fatal. Repositories, TLS verification and
signature checks remain. A subprocess control executes the actual composite
script with owned non-root shims, verifies all effective settings, propagates
denied writes and ineffective configuration, and excludes a planted proxy secret.
It makes no claim to qualify real Linux package installation. All **180 portable
CI policy controls**, workflow actionlint and whitespace checks pass locally.
Two additional actual-Linux controls are explicitly skipped on macOS and required
on Linux: real APT file merging (including old-file and later-override negative
controls), and the real GNU timeout wrapper preserving status 37 and bounding an
owned stuck installer. They change no system configuration or package state.
No application assertion, scenario or required prerequisite is removed or relaxed.

The first published setup implementation at `ddced4f8` fails its effective-value
check before browser installation. [Run 39777718361](https://github.com/jurei733/testcenter-rewrite/actions/runs/39777718361)
finishes with **six successful, fifteen failed and six skipped jobs**. Thirteen
browser jobs fail in this common setup; Fast feedback and acceptance correctly
reject their prerequisites. The production/Source builds, dependency audit,
Docker runtime and full **3,694 unit/frontend cases** succeed. No browser test
passes through the failed setup and this is not complete qualification.

The actual runner image is `ubuntu-24.04` version `20261012.334.1`. Its pinned
[configure-apt.sh](https://github.com/actions/runner-images/blob/ubuntu24/20261012.334/images/ubuntu/scripts/build/configure-apt.sh)
installs `zz-retries` with 15-second/one-retry bounds. The initial
`80-testcenter-ci-network` file therefore cannot apply the proposed 20-second/
two-retry values. The corrected file sorts after that runner file and retains
the stricter 15-second/one-retry profile. This does not itself establish a new
transport speed gain over that image; the independent whole-installer deadline
bounds a stall that transport settings alone cannot bound. The two real Linux
controls and actual package installation still need the next head's qualification.

At `627b5466`, the real Linux APT merge control passes, including both negative
cases. The GNU-timeout control stops its owned TERM-resistant child in 422 ms,
but its assertion initially expects a numeric shell status only. Bash can exec
its final command, so Node instead reports `status: null, signal: SIGKILL` when
the timeout group is killed. The follow-up accepts exactly that native fatal
signal or numeric 124/137 and still rejects spawn errors, success and all other
statuses/signals. This corrects the control's process-result interpretation;
it does not weaken the real installer bound or qualify that failed matrix.

## Run selected CI checks locally

From `rewrite-app`, `npm run ci:focus -- --list` lists the actual Quick,
extended-qualification and memory/SQLite workflow shards, plus `policy`,
`typecheck` and `unit`. Select one or several, for example:

```sh
npm run ci:focus -- --plan ui-participant-console original-login
npm run ci:focus -- ui-participant-console original-login
npm run ci:focus -- policy typecheck
```

The runner reads `.github/workflows/rewrite-app-ci.yml` on each invocation and
keeps every command in the selected shard, including the second console
compatibility check and the third front-camera attachment check. It performs
one fresh production build before selected build-dependent checks; policy and
no-emit type checking need none. There is no stale-build bypass. A failing build
or test stops the sequence and preserves its status. Per-command elapsed times
are printed for actual local measurements. No arbitrary shell input is accepted;
the runner executes existing npm scripts with separate arguments. Headed Quick
checks use `xvfb-run` on Linux. Install the normal locked dependencies, Chromium
and its host libraries first, as for existing standalone smoke scripts.

This is a focused local check, explicitly marked `completeAcceptance: false`.
It does not replace PostgreSQL, Docker/Compose, unchanged-Original references,
the remaining workflow shards or the full CI acceptance gate. Local platform and
fixture environment still matter. Listing/planning launches no build or test
and does not export inherited environment values. Nine controls cover complete
workflow enumeration, command ordering, one-build reuse, failure propagation,
unknown selections, shell injection, secret-free planning and the exact failure
status from an actual npm-child subprocess. A real focused invocation freshly
builds production and passes all 43 loading and five context-compatibility cases,
with both owned APIs shut down.

The first full control run exposed a native `kill EPERM` during supervised
cleanup; its underlying host cause is not established by a later passing run.
Cleanup now attempts every remaining owned descendant/group even after a denied
signal, records only PID/signal/error-code evidence and still fails. Two added
controls verify denied-signal continuation and rejection of system/malformed
PIDs. All 175 CI policy controls subsequently pass. This does not resolve the
separate Linux console-operation timeout from run `39762727435`.

Diagnostic persistence now keeps one active atomic write and one pending latest
snapshot. Previously, every IPC phase/observation queued another fully serialized
copy behind the previous write; bounded record arrays did not bound that backlog.
A slow-writer control sends 20,000 updates while the first write is held and
requires just the first and latest snapshot, with no 20,000-copy serialization
queue. Write errors still reject their callers; a later cleanup write can retain
final evidence. Neither diagnostic observations nor coalesced writes renew a
phase or total deadline, and no assertion or scenario is removed.

All jobs now request `ubuntu-24.04`, matching the previously qualified baseline,
and the locked Chromium cache key includes that OS version. This prevents an
implicit OS-major change or cross-version browser-cache reuse during GitHub's
[October 19–November 19 migration of `ubuntu-latest` to Ubuntu 26.04](https://github.blog/changelog/2026-09-17-ubuntu-26-generally-available-and-latest-migration/).
The hosted image still receives GitHub's regular 24.04 image updates. Moving to
26.04 requires an explicit pipeline change and fresh qualification. The existing
console timeout is not attributed to an OS change without evidence.

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

## Delete-dialog and cancellation qualification

The directory comparison now retains all previous 120 views and adds four
password/delete states per table/theme/width: **168 pairs plus 168 independent
Source repeats**. Six password characters must leave confirmation disabled;
seven must enable it, matching the pinned Source form. A valid cancellation must
send no candidate write, add no Source write and preserve both owned records.
Request evidence records only methods/paths, without bodies or authorization.

The first focused probe finds three workspace-delete differences while Source
reproduces all 28 views exactly: 4,963 pixels empty/invalid and 4,783 valid. The
product now uses Source's actual question and plural action label. An unused
Angular template variable is also removed; production build and no-emit typecheck
pass. All 1,966 frontend cases, 159 CI policy cases and the full protected native
administration/settings flow pass, including exact question/action copy, the
six/seven-character boundary, valid cancellation, wrong-password retention and
confirmed deletion cascades.

The first full comparison correctly aborts at the old adult/mobile user
re-selection state after 140 exact pairs/repeats: twelve Source image hashes
alternate between two values. Failure diagnostics now retain first/last actual
sampled PNGs, hashes, geometry and focus/animation metadata without promoting a
baseline. All six real headed controls pass, including an alternating canvas
that still fails at exactly twelve samples with matching diagnostic image hashes.
The fresh full production comparison passes **168 pairs / 168 Source repeats**,
with **504 independently checked native records**, 24 Source fixture writes and
exactly twelve confirmed candidate UI writes. No cancellation dispatches a write.
The initial Source instability is not structurally proved fixed and remains
fatal on recurrence. A fresh Linux head is still required for this expansion.

Published `405915b5` already passes its preceding **120 exact pairs/repeats** on
Linux, job `119289360211` in [run 39619514441](https://github.com/jurei733/testcenter-rewrite/actions/runs/39619514441).
Directory ZIP `12353948715` has SHA256
`b86bcc69e95bc7a5a77e56e4ebba99671d9325f929aa9544de41c01b3df91e0c`;
all 360 actual clear/visible PNG proofs independently verify. Its actual Source
producer is `37679a57eef6775d3943deb0ee90e1948c47604a`; six headed paint controls pass.
That run's typecheck job `119288890923` proves all 159 policy cases and all four
actual compiler controls on Linux, then successfully builds development output
at `dist/typecheck-development`. The full matrix has completed with **83 successful
jobs and three failures**: the Original sample in the run-detail prefix, the
missing-bundle Player-exit fallback, and the aggregate that correctly rejects
those failed prerequisites.

The preceding `375ea6de` run is fully green, **86/86**, at **28:35 full / 4:14 Fast
feedback / 408.8 runner-minutes**. Different runner conditions and expanded
coverage prevent attributing these timings solely to workflow ordering.

In the current 405915b5 matrix, run-detail job `119291243308` fails before its
specific review tail, in the shared `participant-original-sample-package` prefix.
The helper reports a matching Player notification, but the subsequent real API
predicate times out with `required-text-field` empty. The original sample's run
has exactly two successful save-progress POSTs (both HTTP 200, at 14:55:29.627Z
and 14:55:35.736Z); final state revision is 3. There is no demonstrated transport
failure or server 5xx. The current log does not retain those request/ACK bodies or
the real sample's native input/Start-command sequence, so it cannot distinguish
Player startup/reset, message correlation, capture and save-order causes.
The existing helper retries up to three times and matches any serialized unit
state containing the text; it does not check message source/session. No new retry,
timeout increase or product workaround has been added. The failure remains fatal
and needs correlated original-sample input/message/save/ACK evidence. This failed
full matrix cannot be treated as green merely because directory/typecheck pass.

Read-only diagnostics now record bounded native input events, actual frame and
document identity, Start/state notifications, narrowly projected save bodies,
delivery-correlated ACKs and response field clocks. Headers, query strings,
configuration, definitions and unrelated payload fields are excluded. Failure
artifacts retain only the sample JSON and iframe PNG for seven days. A real
headed control proves trusted input and current/imposter-frame discrimination
and verifies that eight planted transport/configuration secrets stay excluded.
It runs serially with the six existing headed paint controls to prevent shared
display interference. All seven controls pass; the complete common smoke prefix
also passes locally through sample save/resume and all eight navigation cases.
That successful local observation does not explain the earlier Linux failure.

The other failing Linux job, `119291242708`, passes all 36 Original exit cases,
then times out closing the missing-lazy-bundle fallback after Stay. Its previous
failure reporter still pointed to the preceding case. Each case now owns its
actual page/context, trace and network buffer, including fallback and Rewrite
cases. The click, assertion and deadlines remain unchanged. An isolated fallback
passes locally. The fresh full sequence also passes all 36 Original cases, the
missing-bundle fallback and six Rewrite cases with owned API shutdown. A fresh
Linux head still needs qualification; non-recurrence is not a structural fix.

A subsequent full local exit probe stops earlier at the exact saved-answer check
for `Sekundar-mobile-header-confirm`. The actual fill call requests two final
spaces, while the actual Player/save packet and HTTP 200 ACK contain one. SQLite
preserves exactly the received bytes. Four Player answer notifications precede
that write; the old failure packet retained only their count. New failure data
preserve actual native input types/values and Player values so the next failure
can distinguish input production from host/server capture. Exact whitespace
matching, trusted-input assertions and held-ACK/successor coverage are retained.
The fresh passing sequence records three trusted input events per multiline
fill in 35 cases and five in the deliberate held-ACK successor case, with exact
Player packet correspondence. The old fourth event cannot be attributed without
its missing native input data. Neither failure is claimed fixed through
diagnostic changes or a later pass.

## Console timeout observations without deadline renewal

Published `8e90c48e` run `39762727435` fails console-loading job `119776478694`
after its remote terminal/resume independence case passes. The independent
supervisor correctly records a phase timeout exactly 60 seconds after that
marker and terminates only its owned process tree. Artifact `12420036166` has
SHA256 `ebd6bbe2bf308b03d43c42ed9b48f12c9ae212bbfe05739a5bb230b84fbff633`.
It identifies the last completed case but cannot distinguish its final route
cleanup from the next native Resume, Player readiness or subsequent operation.
The failure remains fatal and its underlying cause is unproven.

The supervisor now records bounded operation observations separately from phase
progress. They never reset either the 60-second phase or eight-minute absolute
deadline. A real child subprocess emits repeated observations while stuck;
it still fails the original phase deadline with ordered diagnostic evidence.
All six supervisor controls and 161 CI policy cases pass. The complete local
production console-loading journey passes all 43 cases with the operation
markers and owned API shutdown. This successful observation is not a structural
fix for the earlier Linux timeout. No scenario retry, assertion removal,
held-route relaxation or deadline increase is introduced.

## Retain a real logo action during Resume context loading

Published `809d9b47` run `39759195568` reveals another common-prefix failure in
job `119762177912`: after resuming the same Starter card, clicking the logo
never opens the expected confirmation. The actual Original document and HTTP
evidence retain the resumed running Unit, with only the preceding
return-to-starter POST. The other controller's repeated 401 polling is expected
after credential rotation; it is not evidence that the actual Original page lost
its authorization.

A real protected SQLite/Chromium probe deterministically holds the resumed
current-state response. The UI already detaches the Starter and shows `running`
from its authorized console Run. Its logo handler accepts focus through that
projection, but the old exit method silently returns because its full Unit state
is still null. Releasing the actual response does not restore the lost click.
The probe fails before the change and passes against the new production build.

The exit method now reads the exact authorized Unit context for that projected
Run before planning confirmation. Session, Run, Unit, status and view-lifecycle
checks reject a replaced context; existing completeness/timer/leave-lock policy
and all later confirmation/action guards remain. Eleven actual-method controls
cover retained intent, stale replacements, invalid/completed projections,
missing context and propagated transport failure. All **1,983 frontend cases**,
strict no-emit typecheck and production build pass.

A permanent additional native exit case holds the real context response,
activates the actual logo, proves no early return write, then releases the
response. Cancel must preserve the exact running Run/responses; a later explicit
confirmation must return that same Run once. It supplements all 36 Original, six
Rewrite and missing-bundle cases. The full production native journey passes all
37 Original cases, six Rewrite cases and missing-bundle recovery, with owned API
shutdown. Fresh Linux qualification remains required. This does not claim to
explain either preceding `405915b5` sample-save or fallback-Stay failure. The
full headed Original entry prefix also passes the actual resumed-logo, Starter,
guarded logout and reentry sequence through `participant-entry-sign-in`,
followed by owned API shutdown.

The same `809d9b47` matrix also fails PostgreSQL UI job `119762177590` in the
existing serial label corpus: a visible/enabled/stable radio control times out
inside native scrolling before input. The prior main-page screenshot does not
show that independent context. It is not a demonstrated database failure or a
consequence of the subsequent, unpublished concurrency change. Case-specific
failure labels now identify the actual isolated journey. This remains fatal.

## Bounded parallel native label journeys

The full green `375ea6de` UI log identifies two long sequential phases: 132
seconds for Original test-controller cases and 127 seconds for current Unit
labels/configuration. The latter contains 32 synthetic independent label
journeys and 20 exact-current Original BookletConfig journeys. The main smoke
now permits at most two of these isolated cases concurrently in headless mode;
visible-browser runs remain serial. Every synthetic tuple has its own roster
login. Current Original cases share the exact Source roster across UI/width
variants, so those four groups remain serial; only different participant
accounts inside one group can overlap.

All existing real sign-in, Player input, persisted answer/types/clocks,
forward/backward navigation, reload restoration, label/metadata, credential
separation and browser-error checks remain. A failed worker stops new dispatch,
awaits its active peer's cleanup and preserves every in-flight failure. Six
controls cover exact-once/maximum-two execution, serial ordering, early failure,
peer cleanup before rejection, aggregate failures and invalid/empty inputs. No
whole scenario is retried or omitted.

One paired local protected SQLite/Chromium probe executes all **52 cases in each
mode**. Serial phases take **73.062 + 49.883 = 122.945 seconds**; bounded phases
use **41.193 + 33.316 = 74.509 seconds**, about **39.4% lower**. Both modes
retain the unchanged current Original fixtures and every actual response
assertion, and the owned API shuts down cleanly. This single
serial-then-parallel pair is sensitive to host/cache conditions and does not
prove full Linux wall time. All **1,983 frontend cases** and **160 CI policy
cases** pass. The complete common run-detail journey also passes locally through
its actual review tail, exact sample save/resume and both label corpora, with
owned API shutdown. A fresh complete Linux head is still required.

The preceding published `809d9b47` directory scope passes on Linux in job
`119759396101` of [run
39759195568](https://github.com/jurei733/testcenter-rewrite/actions/runs/39759195568):
**168 exact pairs / 168 independent Source repeats**. Its artifact `12418125499`
has SHA256 `0a75227edd7ab48ee120642292229bac59d36703957a5d70d34740a28b521b13`;
all **504 actual native image proofs** independently verify. The actual same-run
Source producer is `dc8771cde2c19f0447689669231c4c8463476b8b`. This bounded
reference success does not establish complete matrix acceptance or qualify the
subsequent parallel scheduling change.

The same 52 bounded-parallel native cases also pass against a fresh, owned,
socket-only PostgreSQL database with real protected sign-in and exact saved
response/restoration assertions. Both owned clusters are stopped afterwards.
This is separate from the older Linux serial-radio scroll failure; it does not
waive that failure or establish its cause.

## Non-emitting local type checks and isolated CI development output

`npm run typecheck` now runs the unchanged core project type check plus the real
Angular compiler with `--noEmit` and the app's existing strict TypeScript,
template and dependency-injection settings. It does not replace the production
web files. `npm run typecheck:ci` retains the complete earlier development build,
with identical inputs/options apart from `--output-path dist/typecheck-development`.
The required production build, style/bundle checks, all test groups and aggregate
dependencies remain. The immutable historical coverage baseline is preserved;
its policy accepts only this exact development-output relocation.

Four actual compiler subprocess controls accept a valid component, reject
TypeScript, template and injection errors with nonzero exit, and prove that
existing output survives without new emitted files. All **159 CI policy cases**
pass. The real app passes both commands; a paired local measurement observes
**13.473 seconds** for the no-emit path and **16.986 seconds** for the isolated full
development build. All **184 production files remain byte-identical after each**.
This single local comparison depends on cache/host conditions and does not
establish a Linux CI latency improvement. CI intentionally retains the full
existing build qualification, adding the compiler fault controls.

## Confirmed directory mutation qualification

The next directory comparison retains all 84 previous views and adds confirmed
role/name changes, retained-row edits and owner re-selection: **120 exact pairs
plus 120 independent Source repeats**. Only two narrowly validated Source PATCH
fixtures are writable; candidate actions use the real protected API. Every
candidate journey restores its owned starting name/platform role. An unrelated
dirty workspace permission must remain unsaved after the confirmed action.

A first actual Source probe found 4,854 desktop role and 2,982 rename pixels
changed in the candidate; all Source repeats were exact. The product now retains
the prior visible permission rows without a save owner, clears them on session
replacement/destruction and restores saved rights on re-selection. Temporary
Source Toast/Material notifications replace the permanent success paragraph.
The first complete local comparison isolated three 670-pixel mobile re-selection
differences. Direct geometry proves the reused candidate cell had `scrollLeft=24`
where Source had `0`. A permission-view generation now recreates rows on owner
selection and retains them during checkbox edits/selection clearing. All three
mobile re-selections now measure zero internal scroll in both builds.

Final production validation passes **120 exact pairs / 120 independent repeats**;
all **360 actual native PNG proofs** independently verify. The 24 Source fixture
writes are narrowly checked and their bodies/secrets are excluded from evidence.
All **34 controller, 1,966 frontend and 154 CI policy cases** pass, as do typecheck,
production build, Source byte verification and Actionlint. The complete protected
native administration/settings journey also passes, including retained-row edits,
actual role/name acknowledgements, wrong-password preservation, all 102 text
fields, eight image slots, reset/session gates and logout. Re-selection explicitly
waits for the retained DOM node to detach and the new saved checked state; the
initial immediate assertion correctly exposed that fresh view's asynchronous
rendering. No fixed delay or automatic scenario retry is added. A fresh Linux head
remains required; `375ea6de` qualifies the preceding 84-state dialog change.

At that checkpoint, the old `npm run typecheck` also wrote a development web
build. An accidentally overlapping local capture was explicitly terminated and
excluded. The final production comparison ran only after typecheck and production
build completed. The later no-emit local type check and isolated CI output above
remove that output collision; explicit production builds still precede consumers.

## Current directory/dialog checkpoint

Published `2dc47c98` completes [run 39608434842](https://github.com/jurei733/testcenter-rewrite/actions/runs/39608434842)
with **all 86 jobs successful**, including the directory reference, held-answer
exit, timer and all three Compose modes. Measured job timestamps give **29:13
full acceptance, 4:53 Fast feedback and 418.25 runner-minutes**. The earlier green
85-job baseline was 37:40 / 3:38 / 411.0 runner-minutes: full wall time is 8:27
shorter with broader coverage, while early feedback and compute did not improve.
Shared-runner conditions differ; the complete change cannot be attributed solely
to ordering. The unchanged timer fixture's prior socket reset does not recur;
no transport failure was ignored or retried.

The next UI change extends directory qualification from 36 to 84 views per build
and independent Source repeat. Source-derived fixes restore empty rename fields,
three-character workspace-name validation, native field sizing/paragraphs,
set/revoke confirmation titles and omitted empty content. Re-selecting a dirty
selected row no longer resets rights. Source initial/invalid/valid dialog states
and this repeated-selection behavior all pass locally at zero RGBA differences.
Sixteen complete Source files now pin these additional contracts. No previous
baseline scene or required job is removed; the matrix remains 86 jobs.

This local expansion requires fresh full CI. Existing successful 2dc results do
not prove the new UI head or cover submitted mutations, transient notices or
Source's retained right-table rows after clearing selection. Formal 29 done /
20 partial and all eight broad visual rows remain unchanged.

## Directory family and bounded Compose JSON polling

A fifth Source family adds 36 directory viewports and 36 independent repeats,
retaining the previous 19 Source tasks and every required aggregate. Eight pinned
DAO/service/component/template/CSS files establish the read-only DTO and rendering
contracts. Both directory and settings jobs require the six native capture fault
controls. Full job count is now 86. Local raw directory captures pass all 36 pairs
and repeats, with 108 independently checked native clear/style/steady-frame proofs;
actual Linux qualification remains required. Mutation/dialog/notice/stale-row and
full Original backend authorization scope stays open.

At `3cc27b63`, run `39603287361`, the supervised console job `119235173455`
passes all 43 loading and five compatibility cases on Linux. The previous
one-hour stall does not recur. This does not make the whole run green: Compose
Demo job `119235172733` exits with Node code 13 at its first readiness poll, and
timer job `119235173471` fails in scenario before cleanup with a `route.fetch`
socket hang-up. The failed timer POST does not appear in its retained API log;
no timer packet/receipt was captured. Another Player-exit case times out at its
held-ack browser predicate. None of these errors is ignored or retried here.

The Compose polling loop's wall-clock condition did not bound its individual
HTTP request or body parse. Its new helper keeps a referenced absolute 40-second
deadline through request, response headers and JSON completion; timeout aborts
that request and fails with its phase. It cancels the timer after success and
still retries temporary non-ready responses within the same existing overall
limit. Phase logs contain only path, attempt, phase and status, without headers
or response content. Readiness/config/schema assertions remain unchanged.

Real subprocess controls reproduce Node exit 13 with a handle-free stuck request
or JSON promise, and require the bounded helper to reach normal failure and
finally cleanup. Owned HTTP controls hold actual headers or partial JSON, verify
abort, and return success only after real 503/503/200 readiness. A successful
subprocess must exit without waiting for its old 60-second timer. These prove
local liveness and error propagation; the precise cause of the observed Compose
hang and the complete Docker result still require Linux evidence. Docker is
unavailable in this local environment.

### Held-answer route lifetime

The Player-exit failure at `119235172984` has retained trace ZIP SHA256
`a89090a3b9a11d1c4bc36904e3063a5b8ec61af653918b5378ca93f432a85d92`.
Its held-ACK scenario removes network interception at monotonic time 22,286.719;
the successor save starts at 22,288.751 and never receives a response. The first
ACK has already succeeded. This pinpoints premature fixture retirement during
Chromium's transition to ordinary dispatch; it does not establish a domain save
failure or justify weakening the immutable answer/clock assertions.

The fixture now keeps its route installed until every actual trusted input has
its corresponding Player packet and the real save drainer reports saved after
all acknowledgements. It then retires the route and freezes the exact last
acknowledged bytes. An additional assertion requires both held and successor
packets to traverse the still-installed route and exactly match the actual
acknowledgements. Native input/log correlation, differing-clock control,
byte-for-byte saved-state comparisons, all exit variants and failure propagation
remain unchanged. No replay, timeout increase or product behavior change is used.
Failure snapshots now retain save status and native packet count as well.

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
compiled frontend immutable while browsers run: complete the production build
before starting consumers. Local `typecheck` now emits no frontend and CI's full
development check writes `dist/typecheck-development`; neither replaces this
production input. CI also isolates build directories between jobs and verifies
the immutable shared archive.

The complete Memory HTTP suite also passes 172/172 against the reused schema
cache. Remote Linux/PostgreSQL/Docker qualification and actual improved timing
remain pending until the new published workflow completes.
