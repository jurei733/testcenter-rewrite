# Optional Original UI

### Exact terminal early returns and pending commands (2026-10-13)

Application checkpoint `32b73d7b490d` captures the pinned Original's exact
TERMINATED guard at invocation. A later Terminate while an earlier effective
Terminate waits for answer buffers logs once and returns without another buffer
wait, lock, navigation, controller-entry change or Run state effect. Its receipt
does not advance the Run dispatch highwater or finish the earlier pending phase,
so the first effective command still applies. Two calls in the same JavaScript
turn both pass the guard; TERMINATED_PAUSED also passes it and becomes TERMINATED.
The decision is not inferred from the state observed after deactivation.

Native packets preserve that decision across lost replies, retries and journal
restoration. Accepted remote terminal commands persist it with their executed
command JSON; retries with a different decision fail closed. Store invariants
allow only command-log/receipt effects for a no-op. Existing authorization,
immutable scope, access windows, completed-Run rejection and execution-mode log
filtering remain active. A retained older ERROR dialog is presentation after
successful termination; a newer trusted ERROR still interrupts the pending phase.
Pure-log no-ops can bypass a held legacy packet, while state effects preserve
legacy FIFO and prepared packets keep their original bytes. The guard decision
is reported by the authenticated controller; the server does not independently
observe the local controller phase.

All nineteen actual-Source oracle cases and 2,141 unit/frontend tests pass fresh
without skips or cancellations. Fresh PostgreSQL validation passes 1,335 tests;
the Memory/File/SQLite HTTP matrix passes 498. Typecheck and the production build
pass at 469.99 kB under the unchanged 470 kB hard limit, retaining existing warnings.
Twenty-nine command/loading groups pass headed and headless; fourteen Debug,
five route, ten copied-tab/crash, five context, eighteen ERROR and five actual
older-API groups also pass, for 115 positive groups. The preceding immutable
frontend `87be5c23dda1` fails the no-op gate after fourteen groups. Its backend
image fails 26 of 109 current contract/application tests as a negative control.
The first headed trial held an incorrect remote ACK URL; the final fixture holds
the exact acknowledgement route and passes the native lost-reply and remote
held-ACK scenarios. Every final browser run shuts down its owned API.

The fresh image from 900 verified tracked files passes Standard, Demo and
production PostgreSQL profiles, SQLite runtime and 438 API/transaction tests as
node in a read-only container. Its 169 frontend files match the tested frontend
and aligned host output. No schema version changes. The existing backend-first
rollout remains required; the five actual older-API groups prove their bounded
sequential compatibility, not full no-op mixed-version concurrency. All 24 prior
containers, immutable image IDs, states and mount fields, 85 volumes, 315 image
aliases and protected files remain intact. Ten checkpoint image aliases are added;
four other new aliases are retained separately. Owned containers, volumes and
the clean source archive are removed.

Full Original parity and production readiness remain unproven. Timer interruption,
buffer/completion-log timing and terminal lock/navigation completion after later
commands remain open. Initial loading/controller replacement, global/cross-document
ordering, complete legacy mixed-version concurrency, worker/post-unload behavior,
full visual/property/real-package acceptance, measured performance, remote CI,
release, deployment and production acceptance are still required. This checkpoint
is local and unpushed.

### Terminal controller phases before answer buffers (2026-10-13)

Application checkpoint `87be5c23dda1` enters TERMINATED or TERMINATED_PAUSED
after the awaited forced-deactivation continuation and before answer-buffer
preparation. Native Terminate starts in that microtask, not synchronously and
not after answer preparation. A same-turn Pause can therefore precede the
terminal continuation; a command arriving later during the buffer wait gets a
newer dispatch position and controller phase. Remote terminal handlers enter
their phase before the lazy execution import, and memoize their first scoped
observation and dispatch across retries.

The phase does not forge the committed Run, answer clocks, controller entry or
navigation. It suspends new remote reception while already accepted handlers
finish. A later Pause, Resume or trusted Player ERROR survives an old terminal
receipt. Prepared native packets remain exact across retries/restoration;
restored modern or legacy packets do not replay a local phase. Scope replacement
before the native terminal continuation removes that intent before delivery.

The fifteen-case actual-source oracle includes the real forced guard and held
buffers. Four new browser groups prove early native/remote termination, later
Pause/Resume during a genuinely held committed Player answer, exact response
clocks and sibling isolation, and fresh reentry. The preceding immutable frontend
`b3ddb94b9432` fails the early terminal-phase assertion after ten passing groups.
The immutable pre-fix unit control fails nine of 186 cases; all 187 final focused
cases and all 2,105 unit/frontend tests pass without skips or cancellations.

Typecheck and production build pass at 469.99 kB under the unchanged 470 kB
hard limit. Twenty-seven command/loading groups pass headed and headless;
fourteen Debug, five route, ten copied-tab/crash, five context, five actual
older-API and eighteen ERROR groups pass. The first headed fixture cleanup
incorrectly waited for an iframe absent in Pause; the final fixture checks its
presence and awaits action/response together. Existing bundle and CommonJS
warnings remain.

The fresh image from 900 verified tracked files passes Standard, Demo and
production PostgreSQL profiles, SQLite runtime and 388 API/transaction tests
as node in a read-only container. All 169 image, tested and restored host
frontend files match. Backend contracts, stores and schemas are unchanged;
previous PostgreSQL (1,313) and HTTP (498) results are reused only after all
90 backend source hashes match. Those two suites were not rerun. The existing
backend-first rollout boundary remains. All 24 existing containers, immutable
image IDs, states and mount fields, 85 volumes, 305 image aliases and protected
files are preserved; ten aliases are added. Owned containers and the clean
source archive are removed.

Full Original parity and production readiness remain unproven. Exact
already-TERMINATED no-op behavior, timer interruption, buffer/completion-log
timing and terminal lock/navigation completion after later commands remain open.
Initial loading/controller replacement, global/cross-document order, complete
legacy mixed-version concurrency, worker/post-unload behavior, full
visual/property/real-package acceptance, measured performance, remote CI,
release, deployment and production acceptance are also still required.
This checkpoint is local and unpushed.

### Forced terminal Source audit (2026-10-13)

Reference checkpoint `bac6840d74b9` executes the pinned Original's real
`canDeactivateUnit` together with the native root handler and `terminateTest`.
For the native force=true path, deactivation completes immediately and the
terminal phase is entered before `closeAllBuffers` waits. A Pause or Resume
arriving during that buffer wait changes the controller state; buffer completion
does not set the former terminal state again. Two new actual-source cases prove
both orders with held buffers, locking and navigation.

The preceding candidate `4a082496e30e` sampled native terminal state after answer
preparation. Its reference work was incomplete at that point:
the injected held deactivation Subject covered the generic method, not the real
forced native path. Green candidate browser/container checks therefore did not
prove Original parity. Its runtime change and the two unsupported browser
expectations are withdrawn. Candidate source, frontend and diagnostic results
are retained separately; the fixture receipt refinement `bd4f91bcf366` is also
withdrawn with that scenario. No candidate production-readiness claim is made.

The current runtime and browser harness again match accepted application
`438d1cebf5fd` byte for byte. The reference oracle now has fifteen cases, including
the two actual forced-guard cases; two additional native transport cases protect
prepared retry/restoration and unprepared legacy observations. All 2,093
unit/frontend tests pass fresh without skips or cancellations. The unchanged
runtime reuses the accepted build, browser and image evidence after source-hash
verification; those suites were not rerun for the current reference-only change.
All 169 host frontend files are restored to the accepted image's exact bytes.

All 24 existing containers, immutable IDs, states and mount fields, 85 volumes,
305 image aliases and protected files remain intact. Owned candidate container
and source-archive resources are removed; only its ten newly created image
aliases are deleted. Complete local terminal phase timing, the already-TERMINATED
guard, timer/navigation/buffer/log ordering and the other full-parity, CI, rollout,
performance and production acceptance requirements remain open. No push occurred.

### Immediate participant controller phases (2026-10-13)

Application checkpoint `438d1cebf5fd` enters PAUSED for Pause and RUNNING for
Resume/Goto within native invocation or successful remote ACK handling, before
asynchronous preparation, lazy execution imports or application replies. The
remote handler now starts in the ACK callback itself: an extra Promise
microtask previously allowed a later native invocation to overtake it. Shared
dispatch allocation observes the authenticated Run's existing highwater before
lazy execution. Native requests retain their pre-invocation controller
observation; remote terminal commands still sample state after preparation.

The local phase is independent of committed Run and navigation state. A held
application request leaves the server Run and trusted Player unchanged while
the console reports the Source-equivalent phase. Older receipts cannot restore
an earlier local phase. A later trusted Player ERROR interrupts the pending
phase and remains active after that command's late reply; a fresh Resume exits
ERROR immediately while retaining its existing dialog before the application.
Fresh entry and route destruction clear the phase. Restored legacy native
packets retain their prior delivery semantics and do not replay a new local
phase merely because their journal was restored. Startup transition logs stay
deduplicated; exact state-buffer and command-completion log timing remains open.

The pinned Original oracle now executes actual Pause, Resume, errorOut, Goto,
ACK-pipeline and handler-subscription bodies in seven cases. It proves normal
and reversed ACK overlap, Goto's RUNNING phase before invalid-target rejection,
and ERROR remaining after an earlier navigation promise resolves. The preceding
immutable frontend image `8a6110a0b7bc` fails at the held-request PAUSED gate.
A separate negative unit control reproduces remote/native start inversion.
Two additional real-browser groups cover both native and remote Pause followed
by trusted ERROR, the late receipt and a fresh native Resume. Answers, response
clocks and the sibling Run remain exact.

All 2,083 unit/frontend tests pass fresh without skips or cancellations.
Typecheck and production build pass at 469.99 kB under the unchanged 470 kB
hard limit. Twenty-three loading/command groups pass headful and with CI=true;
fourteen Debug, five route, ten copied-tab/crash, five context, five actual
older-API and eighteen ERROR groups also pass. The final isolated production
frontend's 169 files match the fresh image byte for byte. Its build preserves
all 169 frontend files used by the earlier running comparison. Existing bundle
and CommonJS warnings remain.

A fresh image from 900 hash-verified tracked files passes Standard, Demo and
production PostgreSQL profiles, SQLite runtime and 388 transaction/API tests
in the read-only container as node. The previous 1,313 PostgreSQL and 498 HTTP
results are reused only after all 90 backend source hashes match; those suites
were not rerun here. Backend contracts, stores and schemas are unchanged, so
the previous backend-first rollout requirement still applies. All 24 existing
containers, immutable image IDs, states and mount fields, 85 volumes, 295 image
aliases and protected files remain intact; ten image aliases are added. Owned
container and clean archive resources are removed.

Full Original parity and production readiness remain unproven. Exact timer
interruption, asynchronous navigation, native terminal-state sampling after
preparation, state-buffer and command-completion log phases still need Source
comparison. Initial LOADING/controller replacement,
global/cross-document intent order, complete legacy mixed-version concurrency,
post-unload Player effects, worker upgrades, full visual/property/real-package
acceptance, measured performance, remote CI, release, deployment and production
acceptance also remain open. This is a local checkpoint and is not pushed.

### Ordered overlapping controller applications (2026-10-13)

Application checkpoint `bc7b1ad5b6fc` lets independent native requests and
successfully acknowledged remote commands apply concurrently. ACK pacing
remains unchanged. Per-controller dispatch highwaters within each Run reject
late older state effects; changed committed Run snapshots receive a separate
revision under the store lock. Late views and receipts cannot replace a newer
snapshot. Superseded commands retain execution receipts without replaying the
old reload or Starter effect. Debug replies have their own presentation fence.
This establishes overlap and final-state ordering within a controller, not a
global intent order across independent controllers.

Memory, File, SQLite and PostgreSQL persist the optional ordering metadata.
SQLite schema 65 and PostgreSQL schema 59 migrate legacy rows without changing
answers or clocks, with rollback and retry coverage. Forged projections cannot
advance stored revisions or dispatch positions. PostgreSQL Run reads preserve
the distinction between SQL NULL and explicit JSON null so corrupt entry or
dispatch metadata fails atomically. Legacy prepared native packets retain their
exact bytes and FIFO; new version-2 packets share the controller dispatch clock
with remote applications. Backend-first rollout remains required. The older
API gate proves selected context/native compatibility, not a full mixed-version
concurrency rollout.

The pinned Original oracle executes the actual ACK pipeline, component
subscription and Pause/Resume methods for normal and reversed ACK completion.
It proves independent handler starts and completion-order logs. Five additional
browser groups hold real application requests or committed receipts and verify
a later Resume applies, stale state is fenced, and trusted answers, clocks and
siblings stay exact. The immutable preceding frontend image `8d7a246f3cf9`
fails at the held-application assertion. The crash fixture now holds a real
answer receipt to keep an intent unprepared and observes its owned Chromium
storage marker on disk before crashing the browser process. Both crash cases
retain old journals without replay and accept independent fresh commands.

All 2,067 unit/frontend, 1,313 PostgreSQL and 498 Memory/File/SQLite HTTP tests
pass fresh without skips or cancellations. Typecheck and production build
pass at 469.99 kB under the unchanged 470 kB hard limit. Twenty-one loading
and command groups pass headful and with CI=true, alongside fourteen Debug,
five route, ten copied-tab/crash, five context, five actual older-API and all
eighteen ERROR groups. Existing bundle and CommonJS warnings remain.

A fresh image from 900 hash-verified tracked files passes Standard, Demo and
production PostgreSQL profiles, SQLite runtime and 388 transaction/API tests
in the read-only container as node. All 24 preexisting containers, their
immutable image IDs, states and every mount field, 85 volumes, 285 existing
image aliases and protected files are preserved; ten image aliases are added.
Owned container, HTTP-integration, browser-profile and clean archive resources
are removed.

Full Original parity and production readiness remain unproven. In particular,
the Original changes controller status synchronously when a handler starts,
while this checkpoint still waits for application receipts; exact status,
navigation completion and command-executed log phases remain open. Initial
LOADING/controller replacement, global/cross-document intent order, complete
legacy mixed-version concurrency, post-unload Player effects, worker upgrades,
full visual/property/real-package acceptance, measured performance, remote CI,
release, deployment and production acceptance also remain open. This is a
local checkpoint and is not pushed.

### Scoped controller entry and sibling-independent reception (2026-10-12)

Application checkpoint `23af86e57514`, following persistence checkpoint
`ef01973312a5`, stores optional controller entry evidence on each Run. Entry
and termination flips advance its validated revision inside the same atomic
mutation as the selected Run and parent effects. Response-only projections and
replayed receipts preserve the current evidence. The revision orders activity
flips only; it does not establish a global order for every command or answer.
Memory, File, SQLite and PostgreSQL preserve answers and response clocks;
SQL migration failures roll back and can be retried. Legacy rows omit the field.

An already loaded terminated controller can reopen after a fresh authorized
RUNNING or PAUSED view proves a newer active entry for that same Run. Starting
a sibling cannot reopen it. Conversely, ending a sibling cannot close the
selected active Run even when the shared parent becomes signed_in. Server
stream registration, polling and atomic lease renewal follow the selected
entry; closed, expired, completed, foreign and terminated entries remain denied.
Legacy streaming still requires a launched parent. Initial LOADING context
alone still cannot open reception. Terminal reconciliation validates the exact
selected context and rejects missing, malformed or contradictory evidence.
Older replayed termination receipts cannot terminate a newer active entry.

The browser gate holds a terminal read in one actual page, resumes or pauses
through another, closes that page, then verifies the first page alone applies
a new remote command. It also launches and terminates a sibling through its
own accepted commands in the paused case. Its answers and clocks stay exact;
only that owned sibling fixture is restored before later independent groups.
The immutable preceding frontend image `03269a457d80` fails at the new paused
reception assertion. An earlier followup exposed a real server rejection after
a sibling exit; the final API, store and browser tests verify its correction.

All 2,020 unit/frontend, 1,290 PostgreSQL and 498 Memory/File/SQLite HTTP tests
were executed fresh and pass without skips or cancellations. Typecheck and
production build pass at 469.99 kB under the unchanged 470 kB hard limit.
Sixteen loading/command groups pass headful and with CI=true; fourteen Debug,
five route, ten copied-tab, five context and five actual older-API groups pass.
All eighteen ERROR variants pass headful. Existing build warnings remain.

A fresh image from 893 hash-verified tracked files passes Standard, Demo and
production PostgreSQL profiles, SQLite runtime and 371 transaction/API tests
in the read-only container as node. All 24 preexisting containers, immutable
image IDs, states and every mount field, 85 volumes, 275 preexisting image
aliases and protected files are preserved; ten image aliases were added.
Owned runtime, database and archive resources are removed. Backend-first
rollout is required for SQLite schema 64/PostgreSQL schema 58 and the entry
semantics. Older-API tests cover context/native compatibility, not a complete
mixed-version rollout of the new server behavior.

Full Original parity and production readiness remain unproven. Source-equivalent
initial loading and controller replacement, fully overlapping command application,
global/cross-document ordering, post-unload Player effects, worker/mixed-version
rollout, real-package and visual acceptance, measured performance, remote CI,
release, deployment and production acceptance remain open. This checkpoint is
local and not pushed.

### Reception after external controller reentry (2026-10-12)

Application checkpoint `1e839d66419d` restores command reception when a fresh,
authorized full view confirms that another controller resumed the same Run:
the selected Run is running and its parent session is launched. A launched
parent with a still-paused selected Run leaves that controller terminated.
An older running view captured before termination cannot reopen reception.
Answers, response clocks and sibling Runs remain unchanged.

The browser gate uses two actual pages sharing the selected Run. It holds the
first page's terminal runtime read, resumes through the second page, closes
that page and verifies a new remote Pause is applied by the first page alone.
The immutable preceding frontend image `0399c6ad4fda` fails exactly at the new
reception assertion; the negative unit control also reproduces the defect.
Released Goto view handlers now finish within a bounded wait before routes are
removed, followed by two animation frames before checking late-view fencing.
An earlier trial stalled before the new case and is not a negative control.

All 1,978 unit/frontend tests pass without skips or cancellations, including
96 focused context, execution and ERROR tests. Typecheck and production build
pass at 469.99 kB under the unchanged 470 kB hard limit. Fifteen loading/command
groups pass headful and with CI=true; fourteen Debug, five route, ten copied-tab,
five context and five actual older-API groups pass. All eighteen ERROR variants
pass headful. Existing bundle and CommonJS warnings remain.

A fresh image from 892 hash-verified tracked files passes Standard, Demo and
production PostgreSQL profiles, SQLite runtime and 340 transaction/API tests
in the read-only container as node. All 24 existing containers, their immutable
image IDs, states and every mount field, 85 volumes, 255 preexisting image
aliases and protected files are preserved. Owned runtime and archive resources
are removed. Backend, contracts, schemas, manifests and workflow are unchanged
from `56cc13512b02`: its 1,269 PostgreSQL and 498 HTTP tests are reused only after
89 backend source hashes match; those suites were not rerun in this checkpoint.
The prior backend-first rollout requirement still applies.

Full Original parity and production readiness remain unproven. A paused Run
with a launched parent cannot yet distinguish external same-Run Pause reentry
from sibling activation. Per-Run controller state and ordering, source-equivalent
initial loading and controller replacement, fully overlapping application,
post-unload Player effects, mixed-version and worker rollout, real-package and
visual acceptance, measured performance, remote CI, release, deployment and
production acceptance remain open. This checkpoint is local and not pushed.

### Terminal presentation and received-command lifecycle (2026-10-12)

Application checkpoint `56cc13512b02` finishes verified native and remote
terminal effects independently of the later Starter runtime read. New reception
stops immediately while already accepted receipts survive. An accepted Pause,
Resume or Goto of an already loaded controller can reopen reception before its
next Unit view arrives. A lightweight initial LOADING context still cannot do so.
Transient presentation failures retry independently; abort and scope replacement
end recovery, and permanent access or scope failures remain closed.

The backend now reactivates the parent session atomically with an accepted Pause,
Resume or Goto, matching the native command path. Replaying an older application
cannot reactivate it again. Exact answers, response clocks and sibling Runs remain
unchanged. An identical ordinary Run refresh no longer fences a confirmed command;
changed answers, selection or state still do. Terminal reconciliation leaves a
newer local receipt in control of its own Unit refresh.

All 1,975 unit/frontend tests, 1,269 PostgreSQL tests and 498 Memory/File/SQLite
HTTP tests pass without skips or cancellations. Typecheck and production build
pass at 469.99 kB under the unchanged 470 kB hard limit. Fourteen loading/command
groups pass headful and with CI=true; fourteen Debug, five route, ten copied-tab,
five context and five actual older-API groups pass. All eighteen ERROR variants
pass headful. The previous production frontend `6b4ae9daa478` fails the held
terminal-presentation assertion; its backend fails the three new parent
reactivation cases. A separate negative unit control reproduces the identical-view
Goto failure before the fix.

A fresh image from 892 hash-verified tracked files passes Standard, Demo and
production PostgreSQL profiles, SQLite runtime and all 340 transaction/API tests
in the read-only container as node. Existing 24 containers including image IDs,
state and every mount field, 85 volumes, 245 preexisting image aliases and the
protected files are preserved. Owned database, container and archive resources
are removed. Contracts, schemas, manifests and workflow are unchanged; backend
semantics changed. Backend-first rollout remains required. Older-API checks prove
the existing context/native entry contracts, not the new remote parent behavior.

Full Original parity and production readiness remain unproven. Open work includes
initial loading and controller replacement activation, fully overlapping command
application and global Run ordering, post-unload Player delivery and cross-document
effects, complete mixed-version/worker rollout, real-package/visual acceptance and
measured performance. Remote CI, release, deployment and production acceptance
are outstanding. This checkpoint is local and has not been pushed.

### Accepted commands while the next Unit view loads (2026-10-12)

Application checkpoint `6b4ae9daa478` projects a verified remote application
receipt before fetching its next full Unit view. An already accepted Pause,
Resume or Goto therefore does not wait behind an older held view. The transport
validates all six immutable Run scope fields and the actual returned status;
local view generations fence superseded replies. A terminal runtime reply is
re-read when a newer native entry arrived while it was pending, retaining that
entry instead of closing it with the older receipt. Existing ERROR presentation
and its scoped recovery behavior remain covered by the original regression gates.

When the confirmed selection and loaded Unit metadata differ, the old Player is
retired without remounting it. Its existing scoped listener can still process
already queued reports; a new Player waits for the target metadata. Text drafts
and Save remain disabled during that mismatch. Durable response-only delivery
now finishes independently of its subsequent view refresh, so a held refresh
cannot strand a later foreground answer drain or termination. The browser gate
uses actual input in the authenticated former frame while the native Goto receipt
is held, then verifies its final answer, termination and absence of any fabricated
target-Unit answer. It does not claim post-unload message delivery.

The pinned Original `ee2ab9ab64bd` dispatches acknowledged commands without
awaiting the previous component handler. Its fresh LOADING state does not open
reception, whereas an already open endpoint survives LOADING. This checkpoint
addresses the accepted-receipt/view boundary; it does not infer permission to
start a remote channel from a merely running canonical Run.

All 1,952 unit/frontend tests, 1,266 PostgreSQL tests and 498 Memory/File/SQLite
HTTP tests pass without skips or cancellations. Typecheck and production build
pass at 469.99 kB under the unchanged 470 kB initial hard limit. Twelve loading
and command groups pass both headful and with CI=true; fourteen Debug, five
route, ten copied-tab/crash and five context groups also pass. Five compatibility
groups pass against the actual older API image `9b099ecc69ee`. All eighteen ERROR
variants pass headful, including the native theme/viewport cases and accepted
Pause with a held older answer. The preceding production frontend `1fd4aa257c28`
fails the new held-view Pause projection assertion.

A fresh image from 892 hash-verified tracked files passes Standard, Demo and
production PostgreSQL profiles, SQLite runtime and all 337 transaction/API tests
in the read-only container as node. Existing 24 containers, all mount fields,
85 volumes, 235 preexisting image aliases and protected files are preserved;
dependency installation layers are reused. The owned clean archive is removed
after verification. API, schemas, manifests and workflow are unchanged here.
The prior backend-first entry-capability rollout requirement still applies;
older-API checks do not prove new startup-log semantics or full mixed-version rollout.

This is a local checkpoint. Source-equivalent early reception, controller
replacement activation, post-unload Player delivery, cross-document late effects
and global Run ordering remain open. Terminal runtime reconciliation can still
delay following received commands. Actual frontend upgrades, complete visual and
real-package acceptance, measured performance, mixed-version rollout, remote CI,
release, deployment and production proof remain separate work. Full Original
parity and production readiness are not established.

### Initial controller lifecycle buffering (2026-10-12)

Application checkpoint `1fd4aa257c28` records LOADING and the initial ready,
paused or failed state without requiring a loaded Unit, a response or the answer
outbox. The pinned Original loader sets LOADING before awaiting test data and its
root component subscribes controller changes to the independent test-state buffer.
The new browser advertises `controllerLifecycle: browser-v1` on all three entry
paths; the API suppresses only the synthetic entry RUNNING log for this client.
Clients without this field retain their existing entry behavior. Timer, activation,
audit, response and field-clock transactions are unchanged.

The initial log journal binds all six authorized scope fields, retains exact event
IDs and timestamps across retry/reload, uses fresh credentials without storing them,
and leaves other scopes and unrelated storage untouched. Native receipts and the
existing durable Player log path suppress duplicate status entries. After the first
full view, those established paths own later transitions. Non-saving modes do not
persist these logs. No INIT event is fabricated from the Original subscription,
whose pre-test emissions are filtered by its test-state buffer.

All 1,926 unit/frontend tests, 1,266 PostgreSQL tests and 498 Memory/File/SQLite
HTTP tests pass without skips or cancellations. Typecheck and production build
pass; the initial bundle remains 469.99 kB under the unchanged 470 kB hard limit.
Eight loading groups pass both headful and with CI=true, including pre-Unit ERROR
and lost-receipt replay across a real reload with one server entry per original ID.
Fourteen Debug, five route, ten copied-tab/crash and five context-fallback groups
also pass. The prior production frontend fails the new initial-loading assertion
with actual RUNNING / expected LOADING. Five compatibility groups pass against
the actual older API image `9b099ecc69ee`.

A fresh image built from 892 verified tracked files passes Standard, Demo and
production PostgreSQL profiles, SQLite runtime and all 337 transaction/API tests
in the read-only container as node. Existing 24 containers, 85 volumes, image
aliases and protected files are preserved; both dependency installation layers
are reused. The owned clean archive is verified and removed after validation.
Deploy the accepting API before the frontend: old-API compatibility checks cover
existing context/native contracts, not the new startup-log semantics.

This remains a local checkpoint. Remote early-loading reception, replacement
activation and late effects, complete visual/real-package/performance acceptance,
mixed-version rollout, remote CI, release, deployment and production proof remain
open. Full Original parity and production readiness are not established.

### Native LOADING observations and transition logs (2026-10-12)

Native terminal packets now distinguish an authorized controller still in LOADING
from a server Run that is already running. Debug and command observation use the
same loading projection, retaining the existing ERROR and PAUSED precedence.
The prepared packet keeps its exact status, timestamp and delivery identity across
reload and retry. The API accepts LOADING and logs a real transition to RUNNING
for early Resume even when the canonical Run was already running; an already
committed server pause still controls the paused termination variant. Execution
modes retain their response/log filtering. Answers, field clocks, immutable scope,
sibling Runs and the remote queue remain protected by the existing transaction.

A new protected browser case holds both the initial full view and the resumed view,
observes LOADING on the actual HTTP request, checks the single RUNNING transition
and command log, then releases the real Player. It fails against the preceding
production bundle with actual RUNNING / expected LOADING. The final loading gate
passes all seven groups headful and with CI=true, including the full observed
LOADING/PAUSED/RUNNING/ERROR command sequence. The fourteen Debug, five route,
ten copied-tab/crash and five context-fallback groups also pass. All 1,897 local
unit/frontend tests, 1,252 PostgreSQL tests and 498 Memory/File/SQLite HTTP tests
pass without skips or cancellations. Typecheck and the production build pass;
the initial bundle remains 469.99 kB under the unchanged 470 kB hard limit.
Five further browser groups pass with the actual older API image `9b099ecc69ee`,
covering its authenticated context fallback and existing native status values.

Application checkpoint `bfc07884cd23` additionally passes Standard, Demo and
production PostgreSQL container profiles, SQLite runtime and all 326 transaction/API
tests in the read-only image as `node`. Its clean archive contains 892 hash-verified
tracked files without host dependencies or the protected presentation. The image
build reuses both dependency installation layers. Existing 24 containers and all
85 volumes are retained; the final preservation report verifies their mount fields,
existing image tags and protected file hashes separately. This is local evidence;
remote CI, publication, release, deployment and production remain unverified.

Remaining Original controller lifecycle acceptance includes initial buffering,
remote early-loading reception, replacement activation and late effects.
New LOADING packets require
the updated API; deploy the accepting backend before the frontend. Existing
RUNNING/PAUSED/ERROR packets and their receipt fingerprints remain supported.
The older-API context fallback does not prove support for new LOADING packets.
Full visual/property/real-package acceptance, actual frontend upgrades, measured
performance, remote CI, release, deployment and production acceptance remain open.

### Native commands after a browser-process crash (2026-10-12)

The pinned Original `CommandService.commandFromTerminal` creates an ephemeral
command and publishes it directly; it does not persist or restore terminal
commands. The Rewrite therefore does not automatically replay an unproven
pre-crash native intent. Reentry reads the authenticated, explicitly selected
Run. A command already committed on the server remains effective, even if its
receipt was lost. Fresh commands use the new document owner and delivery ID;
unowned journal rows are preserved without authority to execute or delete them.
This policy is separate from recovery of participant answers through the outbox.

The existing required tab gate now also crashes two complete Chromium processes
with `Browser.crash`, relaunches each persistent profile and restores its real
tab through the [browser session API](https://developer.chrome.com/docs/extensions/reference/api/sessions).
One case leaves a prepared terminate-with-lock and an unprepared Goto queued;
the other commits Pause while holding its response. Both verify no `pagehide`,
no old native replay on reentry/online reception, exact selected Run, unchanged
answers and nonempty captured field clocks, expected command log counts, retained
unowned journal bytes, an empty remote command queue and working fresh commands.
The Player must actually receive its restored answer after its asynchronous start.

The browser must persist its open-session preference as well as its DOM store
before the crash. An owned extension with only the `sessions` permission invokes
Chromium's real restore operation; it never injects application storage. Its
profile, including credentials, is removed after each case. In the observed
Chromium path the restored tab does **not** retain the old `sessionStorage`.
Restoration paths that retain that namespace, and interrupted actual frontend
upgrades, remain separate acceptance work; they are not inferred from this gate.

Four new crash groups and the six existing copied-tab groups pass locally both
headful and with `CI=true`; 55 focused native transport/Original-reference tests
also pass. The existing non-optional CI command already invokes the extended gate;
remote CI remains unverified. Application sources, manifests, lockfile, build
configuration and Dockerfile are unchanged from `0e8538d10915`, so its 1,890 tests,
typecheck, production build and image validation are reused predecessor evidence,
not fresh broad executions. Only the regression gate and these acceptance notes
change. No push, release, deployment, full parity or production claim is made.

The preceding storage cleanup removed 70 precisely selected obsolete Testcenter
cache entries (Docker reports 4.29 GB). Existing 24 containers with all mount
fields, 85 volumes, image tags and protected file hashes remain intact. The current
install cache is retained; fresh SQLite/PostgreSQL startup, migration, preflight,
readiness and write/read checks pass. About 10.4 GB was free after that cleanup.
Sustained cache growth remains an operational concern for later changed manifests.

### Native command ownership across copied tabs (2026-10-12)

A copied active tab no longer adopts or removes the originating tab's native
command journal. The document receives a fresh owner; a normal reload retains
its own owner only through an exact departing handoff. Real opener copies,
removed openers, clone destruction/reentry/close, source retry and a copied tab
reloaded before app bootstrap pass six production-bundle groups. The first
browser reproduction failed before the fix on the shared owner. Normal cases
use the real service worker; the explicitly interrupted uncached-bootstrap case
bypasses it for that download.

Checkpoint `0e8538d10915` passes 1,890 local tests, typecheck, production build,
41 console/browser groups, all three PostgreSQL container profiles, SQLite
runtime and 320 read-only image checks as `node`. Backend integration and the
broader 147 browser cases remain verified predecessor evidence. The 891-file
archive was verified and removed, all existing containers/mounts/volumes and
protected hashes remain intact, and about 4.6 GB is free. Remote CI and production
remain unverified. See [the scope and remaining acceptance in PARITY](./PARITY.md#native-command-ownership-in-copied-browser-tabs-2026-10-12).
Without a verified departing handoff, legacy/crash intents are retained without
automatic execution; their complete recovery/upgrade policy is still open.
Full Original lifecycle, remote/activation races, visual/property/package,
performance and production acceptance remain required.


### Native commands after controller destruction (2026-10-12)

An actual Angular route exit now cancels pending native effect intents, including
a retry and an intent waiting for trusted answers to drain. A full document reload
still restores the exact prepared delivery, without repeating a server effect
after a lost receipt. A native Pause committed to the former Run remains there;
its late response cannot replace another Booklet's Player or saved answers.
The five-group production-bundle browser gate checks real Back/Forward destruction
and reentry with the same document, two saved Booklets, entry selection and clocks.
It failed before the fix on the retained resume journal and now passes.

Checkpoint `98b182dddcd4` passes 1,883 local tests, typecheck, production build and
35 console/browser groups, including the actual prior API image. All three
PostgreSQL container profiles, SQLite runtime and 320 read-only image checks as
`node` pass. The existing containers/mounts/volumes and protected hashes remain
unchanged. The 890-file archive was verified and removed; about 6.4 GB is free.
Backend integration and the broader 147 browser cases are verified predecessor
evidence, not fresh executions. The new gate is required by the console CI job;
remote CI and production remain unverified. See [the scope and remaining
acceptance in PARITY](./PARITY.md#native-command-lifetime-on-an-actual-route-exit-2026-10-12).
Cloned-tab ownership, wider remote/activation races and full Original lifecycle,
visual/property/package and production acceptance still remain open.


### Reentry across the controller-context API addition (2026-10-12)

Only a missing-route 404 now uses the older authenticated current-state route.
Explicit Run and Session selection remain intact; access rejection, missing Runs
and malformed responses stay closed. Both metadata and full/eager views validate
all six scope fields, while session-only legacy links use the server's authorized
selection. An older API supplies console authority only with the real full-state
reply, without fabricated Unit data.

All 1,881 local tests, typecheck and the 469.99 kB production build pass under the
unchanged hard limit. Five contract groups and five actual prior-API-image groups
verify two saved Booklets, exact reentry, retained answers/clocks, legacy selection
and rejection boundaries. Six loading and fourteen Debug/native groups also pass.
The unchanged backend retains checkpoint `7fdff889a3bd`'s PostgreSQL/HTTP/compatibility
proof. Full Original lifecycle/visual/property/package acceptance, remaining rolling
versions and production acceptance remain open. See [the current scope and proof
boundaries in PARITY](./PARITY.md#participant-reentry-with-an-older-api-2026-10-12).

Application checkpoint `94a7d5b42f1a` also passed all 147 existing browser cases,
all three PostgreSQL container profiles, SQLite runtime and all 320 read-only image
checks as `node`. The archive's 889 file hashes were verified and the archive removed.
All 24 existing containers, all mount fields, 85 volumes and protected hashes are
preserved, with about 8.01 GB free. The proof contains 304 verified evidence files;
remote CI and production confirmation remain unverified.

### Console and Debug during initial loading (2026-10-12)

All five terminal methods now bind before the first complete Unit view, matching
the pinned Original command/root initialization order. Dispatch and Debug still
require a server-authorized selected Run. A read-only participant controller-context
route supports a new document whose full Unit request fails, without inventing
Unit data or responses. Native receipts update early LOADING/PAUSED/ERROR display;
older full-view replies cannot restore a paused or terminated frame. Resume recovers
the selected Run after an initial load error, and the exact entry URL is written
before loading. Trusted old-Unit reports drain without creating a next-Unit answer.
Original surface styles now load before the Player and hide technical summaries
while the existing loading/paused views are displayed.

All 1,874 local tests, 1,244 PostgreSQL tests, 498 HTTP and 61 compatibility checks,
typecheck and the 469.99 kB production build pass under the unchanged hard limit.
Six loading/error Chromium groups, fourteen existing Debug/native groups and
all 147 existing browser regression cases pass;
the CI matrix includes both gates, with remote execution unverified. Full Original
visual/property/package and lifecycle acceptance, LOADING wire/log observation,
old-backend compatibility, route/tab ownership, measured performance and production
rollout remain open. See [the current contract and proof boundaries in PARITY](./PARITY.md#participant-console-before-the-first-unit-view-2026-10-12).

Application checkpoint `7fdff889a3bd` also passed all three PostgreSQL container
profiles, SQLite runtime and all 320 read-only image checks as `node`. Its clean
archive's 888 tracked files were hash-verified and the archive removed. The 24
existing containers, all mount fields, 85 volumes, protected presentation and host
TypeScript package remain intact, with about 8.95 GB free. The local proof preserves
307 verified evidence files; remote CI and production acceptance remain unverified.

### Native Resume accessibility (2026-10-12)

Native Resume now applies the pinned UnitActivateGuard next-accessible-Unit
fallback, retains all code/leave/Unit locks and answers, and starts only the
selected timer. The Source code-first exception and no-later-Unit fallback remain
intact; a missing current Unit does not fabricate a first-Unit selection.
All 1,852 local tests, 1,239 PostgreSQL tests, typecheck, the 469.99 kB production
build and fourteen protected Chromium/SQLite groups passed. The added browser
case verifies the real paused Player, authenticated redirect, exact saved answers
and clocks, retained Unit lock and reentry. Original resume/navigation/guard
methods execute directly in pinned reference tests. Checkpoint `9b099ecc69ee`
also passed all three PostgreSQL container profiles, SQLite runtime and 316
checks in the read-only image as `node`; the clean archive's 886 file hashes
were verified and the archive removed. All 24 existing containers, every mount
field, 85 volumes and protected hashes remain intact, with about 9.52 GB free.
Full controller lifetime,
early ERROR, live visual/property/package acceptance, performance and production
rollout remain open. See [the current contract and evidence in PARITY](./PARITY.md#native-resume-entry-guard-2026-10-12).

### Native console workflow (2026-10-12)

All five Source console methods are now provided in the selected participant
controller. Pause, Resume, Terminate and Goto use their own authenticated
participant endpoint and stable transaction receipt, without a monitor queue or
ACK. The root handler's immediate-parent unlocks, exact aliases/sequence, minute
restoration, positive balance retention and lowercase termination-lock arguments
are preserved. The browser drains trusted captures, validates scope and receipt,
orders tab-owned intents, restores them on reload and fences replaced controllers.
ERROR recovery replaces the errored frame and clears its presentation.

Controller/Player-only logs now travel as explicit log-only packets, without
creating an empty answer or response clock. Foreground/worker/reload preserve the
marker, and older workers do not accept their version-2 message/entry as answers.
Legacy answer packets retain their former version and identity. All 1,839 local
tests, 1,231 PostgreSQL tests, typecheck, 469.99 kB production build and thirteen
Chromium/SQLite groups passed. Checkpoint `6253dd500773` additionally passed
all 147 existing browser cases, 498 HTTP and 61 compatibility checks, three
PostgreSQL container profiles, SQLite runtime and 310 read-only image checks as
`node`. Its clean archive's 886 files were verified and the archive removed.
All 24 existing containers, every mount field, 85 volumes and the protected
presentation retain their identities/hashes; about 10.36 GB of host space remains.

The Native Resume redirect gap recorded at checkpoint `6253dd500773` is resolved
by the newer Native Resume accessibility checkpoint above.
Full Original live/property/visual/package and
controller-lifetime acceptance, performance and production rollout remain open.
See [the current contract and evidence in PARITY](./PARITY.md#native-participant-console-commands-and-log-only-delivery-2026-10-12).

### Participant Debug lock origins (2026-10-12)

Testlet details now match pinned Source own/ancestor lock priorities, show all
four lock fields and their effective `BY ... THROUGH ...` cause, and activate
code/time badges only at that cause's origin. The Source root `[0]`, inherited
block label/timer ID and Unit leave-lock metadata are also shown. Hidden access
codes remain redacted; the existing gate metadata keeps lock diagnostics
accurate. Local projection and countdown updates perform no persistence.

All 1,773 local unit/frontend tests, typecheck, 469.96 kB production build and
nine Chromium/SQLite Debug groups passed. Twenty-eight new checks execute the
pinned Original lock methods, while the actual Booklet proves own and inherited
code-lock origins. The unchanged core retains its prior 1,199-test PostgreSQL
proof; this frontend-only change does not repeat that suite.
Checkpoint `fbb5f1ea4eed` additionally passed all three PostgreSQL container
profiles, SQLite runtime and 286 read-only image checks as `node`. Its clean
archive's 879 tracked files were verified and the archive safely removed.
All 24 existing containers, every mount field, 85 volumes and the protected
presentation remain unchanged; about 11.6 GB of host space remains. Full visual and
property parity, native console commands, early ERROR, real-package/controller
transitions, performance and production acceptance remain open. See
[the current scope and evidence in PARITY](./PARITY.md#effective-participant-debug-testlet-locks-2026-10-12).

### Participant Debug and hidden codes (2026-10-12)

The selected-run Debug pane now implements all ten Source windows, explicit
native/remote Debug commands, development-only preference restoration and
offline local-response projection. Its initial checkpoint is `236cec382fba`;
remaining visual and package acceptance is itemized below.

Diagnostic GET/POST now retain the participant execution-mode boundary for
Testlet access codes. Hot-return, hot-restart, simulation and the legacy default
receive an empty code string with the original prompt and gate metadata; demo,
review and trial retain the authored code. Only the cloned transport snapshot
is changed. This deliberately hardens Original raw Debug property visibility.
All 1,745 unit/frontend and 1,199 PostgreSQL tests passed, with typecheck,
469.96 kB production build and all nine Chromium/SQLite Debug scenario groups.
The expanded Booklet still displays its active code gate without the secret.
Application checkpoint `02bce022a44a` additionally passed all three PostgreSQL
container profiles, SQLite runtime and 286 checks in its read-only image as
`node`, built from a clean, hash-verified Git archive. The 24 existing
containers, all mount fields, 85 volumes and the protected presentation remain
unchanged. Owned resources and the build archive were removed safely.
Full parity and production readiness remain open. See
[the current scope and evidence in PARITY](./PARITY.md#participant-debug-and-access-code-visibility-2026-10-12).

### Atomic fresh participant Run initialization (2026-10-11)

Local application checkpoint `613e2323e17c` resolves the reserved-Run/initial-log
gap. Actual fresh launch/resume creates the Run, activates its current parent and
persists initial timer/state logs and audit together in all four stores. Failed
writes leave no partial Run or artifacts; retry creates one complete Run and
concurrent losers reuse it. Timers start inside the parent reservation lock.
Current closure, expiry, code and execution mode are checked there. Existing
Runs remain unchanged; historically incomplete initial artifacts are not repaired.
SQLite/PostgreSQL schemas remain 63/57; File proof covers one repository owner.

Local validation passed 1,587 unit/state, 1,157 PostgreSQL, 498 HTTP and 61
compatibility tests without skips, all 147 browser reference/state cases, three
PostgreSQL container variants, SQLite runtime and 254 read-only image tests as
node. The web build remains 469.88 kB under the unchanged 470 kB hard gate.
All 24 existing containers, every mount field, 85 volumes and the protected
presentation retain their identities/hashes; the owned archive was removed safely.

Browser harness checkpoint `66e1389d1171` closes an observation race where the
route held the real focus-bearing packet before the request waiter was registered.
The check waits for its actual failure and subscribes before connectivity changes;
exact delivery/answer/reload assertions and timeouts remain intact. Eight cases
passed three consecutive runs, including four clock-skew cases each. The image
was built from the application checkpoint before this test-script-only correction.
Failed-attempt logs, route/client diagnosis and screenshots remain in the evidence.

Full parity and production readiness remain open. Next implement the pinned
Original root debug command and persistent pane, then audit command lifetime
across replacement controllers. Remaining Source acceptance, mixed-version
rollout, remote CI, release and deployment proof remain open. Nothing was pushed
or deployed. Previous sections below preserve historical checkpoint evidence.
See [the evidence and limits in PARITY](./PARITY.md#atomic-fresh-participant-run-initialization-2026-10-11).

### Scoped Player clocks and response-only deliveries (2026-10-11)

Local application checkpoint `e6587f2e626c` resolves the stored-clock bootstrap
and delayed-answer control gaps. The selected Run supplies immutable Unit clock
snapshots to active and retired Player frames; fresh captures advance beyond a
legacy server clock without carrying the opaque barrier in the packet. Foreground
and worker outbox requests explicitly use response-only transport, preserving
current navigation, status, pause source and timer state. Existing legacy receipts
remain acknowledgeable, and non-saving modes retain no answer data or clocks.

Validation passed 1,549 unit/state, 1,104 PostgreSQL, 498 HTTP and 61 compatibility
tests without skips, all 147 browser reference/state cases including four actual
clock-skew cases, three PostgreSQL container variants, SQLite runtime and 216
read-only image tests as node. The web build remains 469.88 kB under the unchanged
470 kB gate. All 24 existing containers, mount configurations, 85 volumes and the
protected presentation remain intact. The owned build archive was removed safely.

Production readiness remains open. The actual launch service leaves a reserved
Run when its first initial-log write fails; retry does not recover those logs.
Combine fresh reservation, parent activation, initial logs and audit in one store
write. Remaining Source acceptance, root command lifetime/debug, mixed-version
rollout and remote CI/release/deployment proof also remain open.
See [the evidence and limits in PARITY](./PARITY.md#scoped-player-clocks-and-response-only-deliveries-2026-10-11).

### Durable participant deliveries and response field ordering (2026-10-11)

Local application checkpoint `8ae5c5253e10` adds immutable scoped delivery receipts
and independently ordered response fields in all four stores. SQLite/PostgreSQL
schemas are now 63/57. Repeated accepted deliveries cannot replay older answers
or controls; new captured answer fields use strictly newer timestamps and retain
absent values. Foreground and worker retries preserve their capture metadata.

Validation passed 1,522 unit/state, 1,078 PostgreSQL, 498 HTTP and 61 compatibility
tests, all 143 browser reference/state cases, and the clean-archive PostgreSQL/
SQLite runtime checks plus 196 read-only image tests as node. The web build stays
469.88 kB under the unchanged 470 kB gate. All 24 existing containers, 85 volumes,
mount configurations and the protected presentation remain intact; build cache
cleanup freed 2.861 GB and container starts completed successfully.

Production readiness remains open: bootstrap Player clocks from stored scoped
clocks for legacy answers, keep first delayed answer deliveries from resetting
controls, and combine fresh Run creation with its initial artifacts. Remaining
Source acceptance and remote CI/release/deployment proof also remain open.
See [the full evidence and limits in PARITY](./PARITY.md#durable-participant-deliveries-and-response-field-ordering-2026-10-11).

### Atomic runtime transitions and monitor intent persistence (2026-10-11)

Local application checkpoint `225f0ff29ed7` extends the transaction used for
progress and timers to adaptive choices, code gates, direct resume, existing-Run
session reentry, starter preparation/return, completion and monitor commands.
The remaining ten application runtime `saveTestRun` calls have been removed.
Decisions use the current scoped Run and parent inside the store write boundary;
Run changes, test logs, activity and completion/activation parent status commit
together. Existing-Run reentry now activates its controller in that same write.

Monitor command intent is part of the projection. Deferred Source commands queue
the intent and issued-command audit together; native controls commit their Run
effect, queued intent and audit together. Memory remains synchronous, File
publishes detached maps only after persistence, SQLite uses BEGIN IMMEDIATE and
PostgreSQL locks parent before Run on one client. Schema versions remain 62/56.
File evidence covers one repository owner; SQL evidence also exercises independent
writers. Mode behavior, monitor-pause protection, transient non-saving packets,
starter confirmation ordering and the non-saving completion response are retained.

The required mutation suite now has 114 tests across Memory/File/SQLite and 158
when PostgreSQL is enabled. New cases interleave answers, locks, access expiry,
current-unit/status changes and sibling completion after the initial read; fault
injection verifies complete rollback after Run, log, command, audit and final
parent writes. Local validation passed 1,431 unit/state tests, 982 full PostgreSQL
tests and 166 HTTP tests per Memory/File/SQLite store (498 total), without skips.
The production web build passes at 469.88 kB under the existing 470 kB hard gate;
the 450 kB warning and four style warnings remain.

A clean archive of the application commit passed PostgreSQL standard/demo/
production-boundary and SQLite runtime checks, plus 125 tests inside the read-only
image `testcenter-rewrite-app:completeness-225f0ff29ed7` as user node. Its image ID
is `sha256:b8b059760d06158cb36beddd6dc2cdab6656a501859b0cddcb12b65851e80f09`.
All 24 existing containers, 85 volumes and their mount configurations
were preserved; the owned archive was removed after unlinking its node_modules
symlink. The protected presentation still hashes to
`7a2826bc8f1a9ffb92519a90f3784a6b1dbc27000892b21068a55a637a958a8a`.

Chromium passed two received-termination/error/reentry variants, four real
input/offline/retry/reload variants, 36 player-exit reference states and all 57
completeness/pixel-reference cases, plus all 44 paused-exit reference states
(143 browser state cases total).
An initial mobile retry request timeout and a six-border-pixel, one-color-level
capture difference were retained as failed-attempt evidence; the isolated reruns
passed without changing application code or Source reference fixtures.

Full parity and production readiness remain open. An owned Memory probe confirms
that replaying a previously accepted older delivery overwrites a newer same-unit
answer. Pinned Source `ee2ab9ab64bd91209ef8534bbe6005838024e46d` rejects older
response timestamps in TestDAO; durable scoped delivery receipts and response
version ordering are the next priority. Fresh Run creation/reservation plus its
initial artifacts still needs a combined boundary. Other Source acceptance,
command lifetime/debug and remote release/deployment proof remain outstanding.
The live GitHub CI snapshot is green for older commit `143dc3e73ae8`; it does not
cover this local application checkpoint.

### Atomic participant progress and timer persistence (2026-10-11)

Local application checkpoint `7037c86870cc` adds `mutateParticipantRun` to all
four stores. Progress merges answers and shared parameters, evaluates navigation,
locks and monitor-pause state, and projects timers from the current scoped Run
inside the storage write boundary. The resulting Run, test logs, activity and
any timer-completion parent status commit together. The projection performs no
asynchronous repository access. Memory projects synchronously, File publishes
its detached maps after persistence, SQLite uses BEGIN IMMEDIATE, and PostgreSQL
locks the parent before the Run on one client. Schema versions remain 62/56.

Current-state reads now calculate missing booklet-state snapshots inside the
same timer transaction. Shared timer persistence also reads the current Run
rather than writing the caller's old snapshot. Existing immutable Run identity
and parent fields are preserved; no-op projections do not write. Source behavior
was checked against the pinned controller/DAO at
`ee2ab9ab64bd91209ef8534bbe6005838024e46d`. That DAO explicitly notes a whole-test
laststate race; the reference establishes behavior, not an atomicity guarantee.

New required tests reproduce two independent service queues saving different
answers, a monitor pause applied after a progress request's initial read,
concurrent lock/expiry changes, and a current-state query overlapping a save.
They check timer completion against current sibling Runs, scope denials,
immutable fields and detached results. File persistence failure leaves cached
state unchanged; SQL failures after Run/log writes or during the completion
parent update roll back every artifact. A separate SQLite worker and independent
PostgreSQL connections prove that a blocked mutation reads the writer's committed
answer and preserves it. The new suite runs in both required local/PG gates.

All 1,345 unit/state cases (80 + 177 + 520 + 568), 863 complete real-PostgreSQL
integration cases and 166 HTTP integration cases each for Memory, File and
SQLite pass without failures or skips. Core and production web builds pass at
469.88 kB under the unchanged 470 kB error budget; existing bundle/style warnings
remain. Both received-termination/ERROR-dialog/re-entry browser cases pass, as do
four native offline/save/retry/reload cases in the Original and rewrite shells
at widths 1280/390, preserving exact answers, the selected Run and foreign-session
isolation. These are rewrite-host checks, not a new live Original backend run.

Five clean-image checks pass: PostgreSQL standard/demo/production boundaries,
SQLite startup, and 39 command-API/Run-mutation cases inside the read-only image.
Image `testcenter-rewrite-app:completeness-7037c86870cc` runs as node and has ID
`sha256:4b058272e5456a2746faebd34854d10f9d81d97fec2a62431a18ad1de597abcf`.
The tracked build archive is removed. All 24 pre-existing container IDs and
85 volumes, host dependencies and the protected presentation are preserved.
This checkpoint is local and unpushed.

Full parity and production readiness remain unproven. Other whole-Run mutation
paths still need the same atomic treatment, including resume, starter return,
completion and direct monitor operations. Delivery replay/order and ACKs arriving
after replacement-controller activation, the Source debug command, the full
Original acceptance corpus, remote CI/release/deployment and live production
proof remain open. The preceding checkpoints below are historical evidence.

### Atomic participant controller activation (2026-10-11)

Local application checkpoint `73b60bf81b8b` replaces the preceding checkpoint's
separate session read/write during launch and re-entry with
`activateParticipantController`. The repository reads the current parent and
selected Run inside its write boundary, validates tenant/workspace/session/Run
and content-release scope, checks closed/expired parent and locked/completed
Run states, and changes only the parent's status. It preserves all current
session fields and every Run field. A repeated eligible activation is read-only.
Memory uses a synchronous decision, File publishes its detached session map only
after persistence, SQLite uses BEGIN IMMEDIATE, and PostgreSQL locks the parent
before the Run on the same client. Schema versions remain 62/56.

New required tests cover scope denials, expiry and pause semantics, detached and
idempotent results, File persistence failure/cache recovery, and SQL rollback.
Independent SQLite workers hold writes while activation starts; separate
PostgreSQL pools demonstrably wait on parent/Run row locks. A concurrent close
or lock survives and activation rejects it without restoring a stale parent.
These tests run in the local unit gate and full PostgreSQL gate.

All 1,317 local unit/state tests (80 + 177 + 492 + 568) and the complete
824-case PostgreSQL integration pass without skips. Core and production web
builds pass at 469.88 kB under the unchanged 470 kB error budget. Both regular
and replacement-dialog browser termination/re-entry cases pass again, including
the same saved Run, restored SSE and unapplied acknowledged follow-up command.
The earlier eight command-overlap browser cases belong to checkpoint
`876192634bf8` below. Five new clean-image checks pass, including 11 real command
API tests inside the read-only image. Image
`testcenter-rewrite-app:completeness-73b60bf81b8b` has USER node and ID
`sha256:0ba767ebcd2dde32aeb3569c85047344f3ed4bd291854c44bf0df3c441a223ab`.
The tracked build archive is removed. All 24 original container IDs, 85 volumes,
the host dependencies and protected presentation digest are preserved. About
9.45 GiB are free; the initial warning and four style warnings remain.

Full parity and production readiness remain open: protect stale progress and
current-state writes across API servers; resolve cross-controller late ACK and
integrated multi-command ordering; implement debug; complete the Original corpus
and full-page/device acceptance. This operation protects controller activation,
not the entire launch/resume/logging transaction. Remote CI, release, deployment
and live production remain unverified. These checkpoints are local and unpushed.

### Historical command delivery after controller termination (2026-10-11, 876192634bf8)

Local application checkpoint `876192634bf8` corrects the preceding checkpoint's
redelivery of acknowledged deferred commands. Pinned Source
`ee2ab9ab64bd91209ef8534bbe6005838024e46d` filters `executed = false` in
`TestDAO::getCommands`; its ACK sets that flag before browser dispatch. Memory,
File, SQLite and PostgreSQL now deliver only commands with a null ACK. The
receiver rejects previously acknowledged records. An application failure can
still retry its accepted receipt within the current controller, and application
receipts remain durable and idempotent. A new controller does not consume old
ACKed intents or invent an execution timestamp for a discarded effect.
SQLite schema 62 and PostgreSQL schema 56 restore the corresponding partial
index without rewriting answers or command history. Both fresh stores and
failed/retried upgrades from the preceding index versions are covered.

Real browser verification also found and fixed two re-entry defects. A terminated
controller now records `view=starter` in its synchronized Router address,
so the retained error dialog's reload remains on the starter. Re-entering an
existing Run activates the current participant session, allowing its SSE stream
to reopen; launch rereads the parent before changing its status. The replacement
error dialog now has an opaque white background when its optional surface
variable is absent, with actual computed styles and a screenshot inspected.

Eight actual Chromium cases pass with regular and replacement error dialogs:
received pause/resume/terminate after ERROR, and an unreceived terminate that
stays inert until explicit reload. Received termination logs ERROR → TERMINATED,
retains the dialog over the starter, preserves the exact saved response and last
unit, and permits explicit re-entry into the same Run with a live connection.
A second resume whose ACK was held behind termination remains acknowledged but
unapplied after re-entry; it is absent from delivery and command-executed logs.
These browser cases are part of the required runtime-error smoke runner.

All 1,298 local unit/state tests (80 + 177 + 473 + 568), the complete 797-case
PostgreSQL integration and core/production web builds pass without skips.
The initial web bundle is 469.88 kB below the unchanged 470 kB error budget.
Five clean-image checks pass: PostgreSQL standard/demo/production boundaries,
SQLite startup, and 11 command API tests within the read-only image, including
the restored SSE connection. Image
`testcenter-rewrite-app:completeness-876192634bf8` has USER node, schema 62/56
and ID `sha256:6aa149bb68377a37c40501cc07b7268783eeb0e57faa90ce10372ac3eefa190c`.
The tracked build archive is removed safely; the protected presentation, all
24 original container IDs and 85 volume names are intact. About 10.07 GiB are
free. The 450 kB warning and four style warnings remain.

Full parity and production readiness remain open. Next verify ACK arrivals after
a replacement controller is already open and multiple simultaneous command
completions in real Source/Native browsers; protect session activation and
progress/current-state writes across API servers; implement debug; complete the
Original acceptance corpus and full-page/device checks. Remote CI, release,
deployment and live production are unverified. This checkpoint is local and has
not been pushed. The preceding sections document their historical revisions.

### Historical deferred participant command dispatch (2026-10-11, db4ecc666bc8)

Local application checkpoint `db4ecc666bc8` connects the atomic storage
foundation to the authenticated participant application API and real browser.
Issuing or acknowledging pause, resume, goto, complete or complete_and_lock
stores an intent/receipt without applying its Run, timer or controller effect.
Successful dispatch uses the stored command and latest Run under the repository
lock. The API ignores forged command type, target and execution timestamps.
The deep contract route is
`POST /api/v1/participant/sessions/:participantSessionId/commands/:commandId/application`.
Legacy intents retain their already-applied effects; their application is a
receipt-only operation. Direct Native lock/navigation/time extensions retain
existing behavior. The Source debug command is still missing.

New deferred commands remain pending after ACK until their execution receipt is
stored. SQLite schema 61 and PostgreSQL schema 55 update that pending index.
The receiver preserves ACK completion order through asynchronous application,
retries transient failures before its successor, and aborts view projection on
route cleanup. Application replies must match the exact accepted receipt and
Run/session scope. A duplicate receipt can restore an interrupted local view
without replaying its durable effect.

Source termination is resumable: complete returns to the starter, preserves the
last unit and saved answers, interrupts timers, and leaves the session signed_in;
complete_and_lock additionally locks the Run. The explicit participant complete
operation remains final. SSE refuses a session at the starter. Starter cleanup
also clears the serialized state fallback so rendering cannot resurrect the old
Run. Legacy optional assignment identities survive command normalization under
the immutable parent guard. A terminated resumable Run still blocks release
activation until explicitly completed.

Current checks pass core compilation and the production web build (469.88 kB,
unchanged 470 kB error limit), 1293 unit/state tests (80+177+469+567) and 791 full
PostgreSQL integration tests, with no failures or skips. Eight actual Chromium
cases pass with normal and fallback dialogs: received pause/resume after ERROR,
and unreceived pause/terminate after ERROR followed by explicit reload. The
received cases verify Source ERROR-to-PAUSED/RUNNING controller log order;
unreceived intents stay inert. Terminal reload/re-entry resumes the same saved
Run. All eight owned API processes stop and every stored browser receipt has a
server execution timestamp and execution sequence 1. The receiver/API order
checks do not substitute for a multi-command browser comparison.

Five clean-image checks pass: PostgreSQL standard/demo/production-secret
boundaries, SQLite startup, and 11 real command API tests inside the read-only
image. Image `testcenter-rewrite-app:completeness-db4ecc666bc8` uses USER node,
SQLite schema 61 and PostgreSQL schema 55; its ID is
`sha256:83f2023bb2a8db2d1525b5301c1a5503d94b9f5a33a5de184eb29c67875cc4b9`.
The tracked build archive is removed without following the host dependency
symlink. All 24 pre-existing container IDs, 85 volumes and the protected
presentation digest remain unchanged. The recovered host has about 10 GiB free.
The 450 kB initial warning and four style warnings remain unresolved.

Full parity and production acceptance remain open. Next, retire ACKed but
unexecuted intents when the Source root terminates, including late ACK/re-entry
races; prove queued terminate with its retained ERROR dialog and real browser
multi-ACK order; protect stale progress/current-state writes across API servers;
implement debug; finish the Original acceptance corpus, full-page/device and
fallback visual checks. Remote CI, release, deployment and production proof are
unverified. This checkpoint is local and has not been pushed.


### Historical atomic application foundation (2026-10-11, 6ef2057f7fb5)

Application checkpoint `6ef2057f7fb5` commits the storage infrastructure below.
The repository now commits an acknowledged command's Run effect, execution
receipt, participant logs, workspace activity and optional session status in
one operation. Memory uses a synchronous detached transform, File publishes
its cache only after persistence, SQLite uses BEGIN IMMEDIATE and PostgreSQL
locks the parent session before the Run. SQLite schema 60 and PostgreSQL schema
54 add a unique execution-order index. Older ACK records remain valid.

The first application receives a server execution timestamp and a per-Run
execution sequence. Retries do not execute the transform again or replace newer
saved answers. The transform reads the latest stored Run under the same lock;
immutable parent fields and foreign or duplicate log identities are rejected.
Failures in any associated SQL write roll back the entire operation. File
persistence failure leaves both cached and durable state unchanged for retry.

Fresh checks pass typecheck, the production web build (469.85 kB, unchanged
470 kB error budget), all 1269 unit/state checks and 787 full PostgreSQL
integration checks. The 56 targeted local command checks include real SQLite
writer processes, restart/retry, injected write failures and failed/retried
legacy migrations. PostgreSQL additionally covers independent pools and the
same transactional failures. Owned PostgreSQL resources are removed; exact
inventory retains 24 pre-existing containers and 85 volumes.

All four clean-image checks pass for this application commit: PostgreSQL
standard/demo/production-secret boundaries on schema 54 and SQLite on schema 60.
Image `testcenter-rewrite-app:completeness-6ef2057f7fb5` has USER node and ID
`sha256:4be48633796c9968efc0fda8ed21f91680b4fc97619d37d773fb2d762ef82675`.
The tracked build archive is removed after the checks, with the protected
presentation excluded and all pre-existing container and volume IDs preserved.

Four fresh browser checks at the same application commit also pass received
pause/resume with native and fallback dialogs, actual iframe lifecycle and saved
answers retained; all four owned API processes shut down. These verify the
existing transport and do not prove deferred command application or Source
PAUSED/ERROR log-order parity.

Pinned Source backend revision `ee2ab9ab64bd91209ef8534bbe6005838024e46d`
confirms the separation: MonitorController.putCommand stores and broadcasts;
TestDAO.setCommandExecuted only updates the receipt flag. Neither operation
applies a controller effect. Native must apply it following successful browser
dispatch, rather than treating the transport ACK as the effect itself.

This is repository infrastructure. Monitor issuance and the participant browser
still use the previous immediate canonical effect, so the confirmed PAUSED/ERROR
log-order mismatch remains open. Storage order tests use pinned Source fixtures
and do not prove integrated browser effect order. The next step is to connect
application through the participant API and move command effects to successful
browser dispatch, including terminal save drain. Cross-server stale progress
writes, complete Original acceptance, devices, remote CI, release and deployment
remain unproven. This checkpoint is local and has not been pushed.

### Scoped command transport and same-status resume (2026-10-11)

Application checkpoint `357eba0ffd84` connects nonterminal monitor commands
with independent IDs to authenticated selected-Run command listing and ACK
routes. SSE carries pending records; polling uses the same scoped collection.
The server derives tenant/workspace ownership and the first receipt timestamp.
An ACK changes receipt metadata without changing the Run or its saved answers.

The browser validates records and receipts before dispatch, suppresses duplicate
ACKs, spaces ACK starts by one second and dispatches in successful ACK completion
order. ERROR cuts new delivery while preserving accepted requests and scheduled
ACKs; route/session cleanup cancels both. Pending receipts also suppress opaque
SSE state refreshes, including the interval after the server persists an ACK
but before its held browser response arrives. The receiver loads lazily through
a contract subpath; the production initial bundle is 469.85 kB under the unchanged
470 kB error budget. Existing warning budgets remain exceeded.

Fresh checks pass typecheck, the production web build, 1237 unit/state checks
and 741 full PostgreSQL integration checks, including the new real command API
proof in a private schema. All 21 runtime browser cases across 16 variants pass,
including native/fallback same-status resume, accepted pause and old save replies.
Resume replaces the actual errored iframe, restores the saved answer, retains
the dialog and matches the pinned Source post-ERROR logs `ERROR, RUNNING`.
Read-only storage inspection confirms the exact persisted command receipts.
These are owned API/player fixtures, not a complete Original backend or device
acceptance proof.

All four fresh-image checks pass: PostgreSQL standard, demo and production-secret
boundaries plus SQLite. The image `testcenter-rewrite-app:completeness-357eba0ffd84`
has USER node and ID `sha256:6598630b62a1fe6a41507bf19c1041b016649ecf9f1449ba8a69b6773c6062f8`. Its build uses an archived tracked checkout;
the protected presentation is excluded. Owned test resources are removed and
exact inventory retains 24 existing containers and 85 volumes. About 8 GiB are
free after builds; the preceding targeted cleanup reclaimed about 5 GiB.

Confirmed remaining gaps: monitor issuance still changes canonical state before
browser execution, and its Run mutation and command insertion are separate writes.
In the held-pause test, Native persists `PAUSED` before `ERROR`; Source instead
records `ERROR, PAUSED` at browser execution. Pause DOM/receipt checks pass while
this log-order mismatch remains open. Integrated multi-command effects in ACK
completion order, terminal command delivery and termination/save-drain equivalence
still require work. All eight complete Original UI acceptance rows, real devices,
current-checkpoint remote CI, release, deployment and production proof remain
open. This is a local checkpoint; nothing was pushed.

### Durable command identities and receipts (2026-10-11)

Application checkpoint `5f88508c12e8` persists commands with independent IDs,
per-Run sequences and an idempotent first acknowledgement in Memory, File,
SQLite (schema 59) and PostgreSQL (schema 53). All four scope identifiers
must match the parent Run. SQL reads also check the parent in the same query;
writes serialize under a SQLite transaction or PostgreSQL Run lock. File
receipts update the cache only after durable persistence succeeds. Run and
workspace deletion remove their command history. Issuance and receipt alone
leave status, saved answers, timers and the current Unit unchanged.

Two additional pinned Source probes record pause/resume after ERROR with
normal and reversed HTTP acknowledgement completion. The effect order follows
successful acknowledgement completion, including RUNNING then PAUSED when
responses finish in reverse order. This is frontend evidence on owned
API/player fixtures, not a guarantee of execution in issuance order.
`scripts/record-original-runtime-command-order.mjs` guards the actual controller
states, command logs, DOM identity and response completion order in both cases.

Fresh validation passes typecheck, the production web build, 1216 unit checks,
733 full PostgreSQL integration checks and 32 additional command/migration
checks. These include two actual SQLite writer processes, independent
PostgreSQL pools, file write failure/recovery, selected-Run isolation,
parent deletion, restart durability and failed migrations with exact saved
answers retained after retry. The previously latest-schema-58 SQLite test
was updated for the new migration. An initial 512-MiB private tmpfs was too
small for the full corpus; the private-volume rerun passes and removes all
owned resources.

The new image `testcenter-rewrite-app:completeness-5f88508c12e8` has USER node
and ID `sha256:215ebc9da10cf2997f9f5b707ffa0078a65646463126746027903b64dca2fdfb`.
All four fresh container checks pass: PostgreSQL standard, demo and production
secret boundaries plus SQLite. Exact inventory preserves the 24 existing
containers, 85 volumes and protected presentation. Disk recovery initially
reclaimed about 5 GiB; 9.2 GiB is free after the current builds and cleanup.

This is storage infrastructure. Monitor issuance still mutates canonical
state directly; no producer, authenticated command endpoint or browser
consumer is connected to the new collection. The same-status resume regression
and termination/save-drain equivalence remain open. All eight complete Original
UI acceptance rows, remote CI for this checkpoint, real devices, release,
deployment and production proof remain open. Nothing was pushed.

### Command reception and dependency caching (2026-10-11)

Packaging checkpoint `26f74a5bd6be` installs workspace dependencies from the
root lockfile and all nine workspace manifests before copying application
sources or applying build metadata. Runtime copies retain node ownership.
A second image build in an owned archived checkout changes an API source file
and the build timestamp: both development and production npm-install layers
are CACHED, while the application rebuild and runtime preflight succeed.

Six fresh read-only Source browser probes at
`ee2ab9ab64bd91209ef8534bbe6005838024e46d` cover pending and queued
pause, terminate and resume. The recorder checks actual DOM identity:
pending replies after ERROR retain the original iframe and receive no ACK;
queued resume retains the dialog, replaces the iframe, records RUNNING and
reopens polling. Queued pause/terminate retain their existing observations.
These are unmodified Source frontend probes on owned API/player fixtures,
not a Source backend control-state equivalence claim.

An opt-in Rewrite regression (`UI_SMOKE_RUNTIME_RECEIVED_RESUME=true`)
issues a real same-status/same-Unit monitor resume, captures its resulting
current-state refresh before ERROR and delivers that response afterwards.
It currently fails the specific Source-derived DOM assertion: the errored
iframe remains connected. The failure is verified with the actual API shut
down and no page errors. This refresh is not a durable command receipt.
The regression is recorded, not fixed or enabled as a passing CI scenario;
command identity, receipt handling and already-accepted command execution
remain necessary. Clearing ERROR on an arbitrary snapshot cannot establish
that command causality.

Fresh checks pass 41 existing error-reception/save-drain tests and three
browser cases (normal runtime error, accepted pause, accepted pause with the
lazy-dialog fallback). Fresh-image Docker passes standard/demo/production-
secret PostgreSQL (schema 52) and SQLite (schema 58). The image
`testcenter-rewrite-app:completeness-26f74a5bd6be` has USER node and ID
`sha256:a387648696fad847f7e2265ca881280958607ec2342ec25214dbdc00ee46e65f`.
All owned runtime resources are removed; exact inventory retains 24 existing
containers, 85 volumes and the protected presentation hash.

Application/frontend sources are unchanged from `ef83639c4597`. Its 1192
unit checks, typecheck, production build, 56 runtime contracts and complete
Verona recovery checks below remain retained evidence, not new full-suite
runs. The new Docker builds compile the current production application.
Ordered command delivery, Source termination equivalence, all eight complete
Original UI acceptance rows, current-checkpoint remote CI, real devices,
release and deployment remain open. Nothing was pushed.



### Late save receipts and accepted control state (2026-10-11)

Application checkpoint `ef83639c4597` acknowledges successful durable Player saves
without projecting their Run snapshot into an errored controller, another
selected Run, or a state that has advanced through an applied refresh since
the request started. Receipt processing still removes the exact delivered
outbox entry and drains following packets. Unchanged active Runs retain their
ordinary save-state synchronization. Backend authorization, completion and
monitor write guards are unchanged.

A real-browser negative probe on the prior build reproduces a late paused
save receipt removing the ERROR Frame. A second probe uses only copied static
assets from the verified owned 92e0d0eaa776 image: an old running receipt
temporarily recreates the Player after an already accepted pause. The reference
container was never started and was removed immediately after extraction.
The corrected native and failed-lazy-load dialogs preserve the ERROR Frame or
the accepted paused state, retain exactly one runtime error/controller ERROR,
acknowledge the outbox, and preserve the exact incomplete response on reload.
A DOM observer rejects transient Player resurrection hidden by a later pause.
Read-only SQLite inspection confirms exact runtime-error text and one controller
ERROR for each of the four owned native/fallback cases.
Four new actual-method tests also cover ERROR, a newer state, Run switching
and normal successful receipt handling.

All 1192 unit/state checks pass (533 frontend). Typecheck and the subsequent
production build pass; initial size remains 469.41 kB under the unchanged
470 kB error budget, with existing warning budgets unchanged.
Fresh production browser checks pass the existing 17 runtime cases, the two
new accepted-pause/old-receipt cases with native/fallback dialogs, all 56
runtime contracts and the complete Verona/official-player recovery flow.
The late-save pair was additionally repeated with exact persisted error text
and controller log checks. The other browser groups from 92e0d0eaa776 remain
retained evidence; this checkpoint does not claim eight fresh browser groups.
API/store code is unchanged from bceb17b4db38; 166 memory/file/SQLite and 702
PostgreSQL integration checks remain retained evidence, not new API runs.

Fresh-image Docker passes standard/demo/production-secret PostgreSQL (schema
52) and standalone SQLite (schema 58). Image `testcenter-rewrite-app:completeness-ef83639c4597`
has USER node and revision ef83639c4597; ID `sha256:9a8b1aadc32f7bdda1f3b0718afb84008b3102555710c6392709d3348180a24f`.
All owned runtime resources are removed. Exact inventory preserves 24 existing
containers, 85 volumes and the protected presentation hash. Approximately 5.2 GiB are free.

Ordered/same-status command delivery, Source termination equivalence and all
eight complete Original UI acceptance rows remain open. Nothing was pushed;
current-checkpoint remote CI, real devices, release, deployment and overall
production readiness remain unverified.

### ERROR and accepted monitor pause overlap (2026-10-10)

Application checkpoint `92e0d0eaa776` cuts new participant channel delivery and
ordinary status refreshes on a validated ERROR from the selected running Unit.
Already accepted channel refreshes may finish. A pre-error accepted pause moves
the controller to PAUSED, removes the Player and reopens the channel, while
keeping the error dialog until reload. Ordinary late status responses and API failures
cannot replace or clear the errored Run; route/session cleanup still invalidates
in-flight responses and discards queued refreshes.

Pinned Source frontend ee2ab9ab64bd91209ef8534bbe6005838024e46d passes four
owned Primar/desktop fixtures: pending pause/terminate are ignored after ERROR,
queued pause executes and reopens command reception, and queued terminate
returns to Starter. A maintained recorder validates the four complete probes.
These are Source frontend/stub observations, not Source backend state proof.
Pinned backend MonitorController.putCommand stores and broadcasts a command;
TestDAO.getCommands reads unexecuted commands in timestamp order, and
patchCommandExecuted marks the selected test/command as acknowledged.
The current Rewrite monitor API applies canonical Run changes immediately.
Native canonical completion is not claimed equivalent to Source terminate.

The old production build reproduces the late-monitor-pause regression.
The corrected production replay passes 15 runtime cases, including native and
failed-lazy-load dialogs for late and already received pause. It verifies
retained dialog, reopened channel, exact incomplete answer/progress and reload.
All 1188 unit/state tests pass (529 frontend), including 11 new ERROR reception
cases. Typecheck and the subsequent production build pass with unchanged
469.41 kB initial size and 470 kB error budget; existing warnings remain.
Fresh browser replay also passes 56 runtime contract cases, 22 Player-version
cases, 44 pause, 43 exit, 32 header cases, Systemcheck and the complete
Verona/official-player recovery sequence.

API/store code is unchanged from bceb17b4db38. Its 166 memory/file/SQLite
and 702 PostgreSQL checks are retained evidence, not fresh API reruns.
Fresh-image Docker passes standard/demo/production-secret PostgreSQL (schema
52) and standalone SQLite (schema 58). Image `testcenter-rewrite-app:completeness-92e0d0eaa776`
has USER node, revision 92e0d0eaa776 and ID `sha256:334a95f30170f76fea2d8b7b6e800c8f99f4e8a9e7ba29bebf98a90778640a9d`.
Owned runtime resources are removed; exact inventory preserves 24 containers,
85 volumes and the protected presentation hash. Approximately 6 GiB are free.

Same-status/ordered command delivery, control-state reconciliation from late
save responses, Source termination equivalence and all eight full Original UI
acceptance rows remain open. Nothing was pushed.
Published main 143dc3e73ae8 has successful GitHub Actions run 38000558022;
that run does not validate this unpublished application checkpoint.
Remote CI, real devices, release, deployment and overall production readiness
remain unverified.

### Exact runtime error text and custom help (2026-10-10)

Application checkpoint `0e5c90b47fb5` preserves runtime message whitespace in
descriptions and logs, and keeps the Original log key for a missing code.
The guarded fallback now preserves empty descriptions, renders allowed rich
HTML through Angular sanitization, and displays multiline help with pre-wrap.
Existing diagnostic bounds and secret redaction remain in force.

The unchanged pinned Source frontend passes 28 cases: six known codes, an
unknown code, defensive missing code, empty/rich whitespace messages, and
application/login/booklet help across three themes and desktop/mobile.
Missing code is defensive behavior, not a valid optional protocol field.
A maintained recorder rejects incomplete Source probes. Source fixtures use
owned API/player stubs; they do not prove Source backend authorization or
persistence. Both probes neutralize the pointer before measuring dialogs.
An initial hover-shadow mismatch is retained as test-harness evidence.

All 56 Rewrite contract cases pass with native and failed-lazy-load dialogs:
exact description HTML/text, exact stored messages and keys, first-dialog
retention, one controller ERROR, focus trapping, and exact answer/progress/Run
recovery. Collapsed native dialog inset pixel comparison covers 28 cases
(maximum RMS 0.01357 on 0-255 RGB); outer shadows, underlying
page, expanded metadata and fallback geometry are outside that pixel scope.
The gate is included in ci:browser:quick. Negative unit/browser probes reproduce
the whitespace loss before the fix.

All 1177 unit/state checks pass (518 frontend). Typecheck and the subsequent
production rebuild pass; initial size stays 469.41 kB below the unchanged
470 kB error limit. Existing 450 kB/style warnings remain. Final production
browser replay passes runtime 11, versions 22, pause 44, exits 43, headers 32,
Systemcheck and the complete Verona/official-player recovery flow.
API/store code is unchanged from bceb17b4db38; its 166 memory/file/SQLite
and 702 PostgreSQL checks are retained evidence, not repeated API runs.

Fresh-image Compose passes standard/demo/production-secret PostgreSQL (schema
52), and standalone SQLite passes schema 58. Image `testcenter-rewrite-app:completeness-0e5c90b47fb5`
has USER node, revision 0e5c90b47fb5 and ID `sha256:3dac41aeffa4c89d4fa3c8a322e9b96a978922385b7149ee0eff6b021573ec1b`.
Owned resources are removed; exact inventory preserves 24 containers,
85 volumes and the protected presentation hash. Approximately 6.8 GiB are free.

Overlapping monitor commands and all eight full Original UI acceptance rows
remain open. Nothing was pushed; remote CI, real devices, release, deployment
and overall production readiness remain unverified.

### Durable replacement logs and recovered retry (2026-10-10)

Application checkpoint `bceb17b4db38` resolves the previous multi-unit answer
outbox recovery failure. Restoration now protects only the actual packet in
transit; a retry during the final status refresh can restore new work. A focus
log takes the durable answer rather than an older runtime draft.

Replacement answer packets retain unacknowledged logs with stable entry IDs.
The optional, validated `clientEntryId` remains scoped to the authenticated Run;
legacy callers retain the existing delivery/index IDs, and upgrading an old
outbox reproduces those IDs exactly even after batch reorder. No store migration
is required. Two new headful cases hold an old log-bearing request while a newer
answer replaces it, then let the old request either succeed or return 503.
Both preserve the latest exact answer and store each error log exactly once.
Negative state probes also reproduce the lost retry and stale focus-answer bugs
before their fixes.

All 1168 unit/state checks pass, including 509 frontend-state checks. All 166
API checks pass separately on memory, file and SQLite, and all 702 PostgreSQL
integration checks pass. The new configured-store API case verifies legacy ID
upgrade, reordered batches, distinct identical events, rejected IDs without
answer mutation, and participant/Run authorization. The worker regression keeps
the same log ID through an in-flight replacement and retry.

The final production browser replay passes all 11 runtime-error cases, 22 version
error cases, 44 pause cases, 43 exit cases (37 Original, 6 Rewrite), 32 header
cases, the broad Systemcheck flow and the complete Verona/official-player flow.
The latter includes three-Unit recovery plus STARS 28-Unit, parallel Run,
mid-drain reload, process crash, background sync and capacity checks. The initial
production bundle remains 469.41 kB under the unchanged 470 kB error limit;
450 kB and component-style warnings remain. Typecheck passes; its development
output was replaced by a fresh production build before the final browser replay.

Current-image PostgreSQL Compose passes standard, demo and production-secret
modes (schema 52), and standalone SQLite Docker passes (schema 58). Image
`testcenter-rewrite-app:completeness-bceb17b4db38`, ID `sha256:f09ebe09d48b1fb657f629863c0a7efc9c64971a3809d4644f97320c68de32dd`, has USER node, revision
bceb17b4db38 and timestamp 2026-10-10T18:57:05.043Z.
All owned container resources are removed. Exact comparison preserves all 24
preexisting container IDs, 85 volume names and the protected presentation SHA-256
`7a2826bc8f1a9ffb92519a90f3784a6b1dbc27000892b21068a55a637a958a8a`. Approximately 7.5 GiB are free.

The first file-store replay hit an HTTP timeout during a verified 902-second
macOS Maintenance Sleep (20:57:34 to 21:12:36 local time). Its complete replay
with process-scoped sleep prevention passes 166/166; the failed trace is retained.
Pinned Original master is freshly verified at
`ee2ab9ab64bd91209ef8534bbe6005838024e46d`. Source frontend fixtures do not prove
Source backend authorization/persistence. Custom help, further notification and
command overlap cases, and all eight full Original UI acceptance rows remain
open. Nothing was pushed; remote CI, real devices, release, deployment and
overall production readiness remain unverified.

### Version-specific errors and acknowledged log delivery (2026-10-10)

Application checkpoint `392692085f19` shows the pinned Original's titles and
expanded descriptions for missing and unsupported Verona Player versions,
including the actual failed-lazy-module fallback. Supported startup and the
existing legacy module-version correction are retained. The production initial
bundle remains 469.41 kB under the unchanged 470 kB error limit; the existing
450 kB and component-style warnings remain.

Twelve new unmodified Source frontend cases cover both version errors across
Primar, Sekundar and Erwachsene on desktop/mobile. The owned Rewrite cases begin
with a previously saved exact response/progress packet and retain it through
rejected startup and reload, without leave locks or timer cancellation. The new
mandatory quick-browser wrapper passes all 22 headful cases: 12 native states,
2 failed lazy-module downloads, 2 delayed saves, 2 failed saves with recovery,
2 delayed error-log deliveries after the answer was already saved, and 2 failed
such log deliveries with recovery. All 1158 unit/state checks pass, including
499 frontend-state checks. The existing nine runtime-error cases and all 44
pause cases also pass against this checkpoint. All 43 exit cases (37 Original,
6 Rewrite), 32 header cases and the broad Systemcheck flow pass. The broad
Verona regression fails in its later multi-unit answer outbox recovery check; that failure
is retained and remains unresolved at this checkpoint.

Two negative browser probes confirmed actual storage defects. Refresh could
acknowledge a log-bearing packet merely because its answer text already matched
the server; error logs emitted after a delivered answer could instead use a
detached HTTP write which reload did not await. Controller/focus logs now use
the durable answer outbox. Restoration skips an active drain and requires a
matching saved status plus an answer-only packet before inferring delivery;
a foreground answer write likewise cannot acknowledge queued logs or a different
status. Eight added save-drain tests and the delayed/failed browser cases prove
these narrow corrections.

All twelve closed-dialog interiors are pixel-identical after a 28-pixel inset.
Zero whole dialog rectangles are identical; no full-viewport or expanded-report
screenshot identity is claimed. A separate new unit probe confirms the next
open gap: replacing a same-Unit packet during its failed in-flight delivery can
lose the older packet's unacknowledged logs. That concurrent replacement is not
covered by the completed version/error cases. Custom help, further error and
command overlap cases, and all eight full Original UI acceptance rows remain open.

Current-image PostgreSQL Compose passes in standard, demo and production-secret
modes (schema 52), and standalone SQLite Docker passes (schema 58). Image
`testcenter-rewrite-app:completeness-392692085f19`, ID
`sha256:72421ecb598f4601da35681bd81d1b0b4db62ad0bd4536805f43d29549c7493b`,
has USER node, revision 392692085f19 and declared timestamp
2026-10-10T18:28:20.222Z. Owned containers/volumes are removed; exact comparison
preserves all 24 preexisting container IDs and 85 volume names, plus the protected
presentation SHA-256
`7a2826bc8f1a9ffb92519a90f3784a6b1dbc27000892b21068a55a637a958a8a`.
Approximately 9.1 GiB are free after these runs.

API/application/store code remains unchanged from checkpoint 9d9ec5754879 and
its recorded 165 SQLite API/701 PostgreSQL integration checks; these full suites
were not replayed for this frontend checkpoint. Remote Original master is freshly
verified at `ee2ab9ab64bd91209ef8534bbe6005838024e46d`. The Source references use
owned API fixtures and do not prove its backend authorization/persistence.
Nothing was pushed; remote CI, real devices, release and deployment are unverified.

### Runtime-error dialog and durable reload (2026-10-10)

Application checkpoint `d026e3f7c63f` retains the running Original Player behind
its native Material error dialog. It reproduces the help text, Fehlerdetails,
focus, non-dismissible backdrop/Escape behavior and reload action. The fixed
Source SVG and fixed en-US/local-zone date output are rendered directly, while
the native dialog and expansion panel remain deferred. The first implementation
failed the unchanged 470 kB initial budget; the final production build is
469.41 kB. The 450 kB and component-style warnings remain; no limit was raised.

Six unmodified Source frontend references and six owned SQLite browser cases
cover Primar, Sekundar and Erwachsene on desktop/mobile, incomplete responses,
and forbidden timed-block exits. A repeated error from the same callback leaves
one dialog and one CONTROLLER=ERROR, while preserving both runtime-error logs.
The reference and Rewrite share only an owned synthetic Player; the Source
frontend stays unchanged. The new mandatory quick-browser gate also proves a
failed lazy-module download, a delayed save, and failed saves followed by recovery.
These nine headful cases pass. The 44 pause cases, 43 normal exits (37 Original,
6 Rewrite), 32 header cases and the broad system-check browser flow also pass.
The broad Verona flow passes after updating its stale merged-timer exit
expectation: the timed confirmation suppresses the later leave-lock check, with
current-unit/status guards present. Cancel and accepted return preserve the exact
stored answer packet and leave unit/testlet locks empty. The new answer setup
waits for vopStart's rendered unit definition before typing.
Reload waits for the durable outbox, preserves
exact response/progress packets and the selected authorized Run, and fences
context changes while awaiting storage and Router navigation. All 1140 current
unit/state checks pass, including 481 frontend-state checks.

The six closed-dialog interiors are pixel-identical after a 28-pixel inset.
Zero complete dialog rectangles or full viewports are claimed identical: the
rounded corners expose different backgrounds (574 changed rectangle pixels on
desktop, 362–364 on mobile; maximum channel difference 155). Expanded diagnostic
content is functionally checked, without claiming complete screenshot identity.
Custom help variants, other startup/error categories and overlapping commands
remain open, as do all eight full Original UI acceptance rows.

The new image passes PostgreSQL Compose in standard, demo and production-secret
modes (schema 52), plus standalone SQLite Docker (schema 58). Image
`testcenter-rewrite-app:completeness-d026e3f7c63f` has ID
`sha256:fcd2cd7ed3fea049c3d9798e84ec78034a198dad0c4700baac01c3bdf1ea5da8`,
USER node, revision d026e3f7c63f and declared timestamp
2026-10-10T17:23:04.421Z. Owned containers/volumes are removed. Exact inventory
comparison preserves all 24 preexisting container IDs and 85 volume names; the
protected presentation remains SHA-256
`7a2826bc8f1a9ffb92519a90f3784a6b1dbc27000892b21068a55a637a958a8a`.
Approximately 9.9 GiB remain free after the runs (8.7 GiB during them).

The API/application/store implementation is unchanged from checkpoint
9d9ec5754879 and its recorded 165 SQLite API/701 PostgreSQL integration checks;
those full suites were not replayed for this frontend change. Source master is
freshly verified at `ee2ab9ab64bd91209ef8534bbe6005838024e46d`. The Source references
use owned API fixtures and do not prove Source backend authorization/persistence.
Nothing was pushed. Remote CI, real-device acceptance, release and deployment
are still unverified.

### Native pause container and startup budget (2026-10-10)

Application checkpoint `85e8e9e86fe8` uses the pinned Original's native
Material sidenav container/content, closed end drawer and white content surface
for the pause card. This clips the upper card shadow at the content boundary.
The first drawer build exceeded the unchanged 470 kB startup limit by 694 bytes.
Migrating the root template's conditional rendering to Angular control flow
removes its static NgIf dependency and lowers the production initial bundle to
469.02 kB. The existing 450 kB warning and component-style warnings remain;
no budget was increased.

Eight sequential headful browser suites pass against owned SQLite APIs: all 44
pause cases, 32 header cases, participant login/second-code cases, admin login
with and without its proof-of-work challenge, offline shell/central bug reporting,
global warning and raw-response settings, and required/voluntary password changes.
All 469 frontend state tests also pass. The API/application/store implementation
is unchanged from the preceding 9d9ec5754879 checkpoint and its recorded
1128 unit/state, 165 SQLite API and 701 PostgreSQL integration checks.

The new application image passes PostgreSQL Compose in standard, demo and
production-secret modes, plus standalone SQLite Docker. The image is
`testcenter-rewrite-app:completeness-85e8e9e86fe8`, with ID
`sha256:127a8503e58a17a4fd77db5b53751b81e80a47bc416cc1855f1e1c86b045299e`,
USER node and revision 85e8e9e86fe8. Its declared build timestamp is
2026-10-10T16:34:04.899Z. Owned test containers/volumes are removed. Exact comparison
preserves all 24 preexisting container IDs and 85 volume names, and the protected
presentation SHA-256 remains
`7a2826bc8f1a9ffb92519a90f3784a6b1dbc27000892b21068a55a637a958a8a`.
Approximately 11 GiB remain available after the runs.

A new full-PNG comparison of the 44 pause cases measures at most 0.13965% changed
pixels. The remaining differences are the header shadow and three card-edge
pixels; the maximum channel difference is 5. Zero full viewports are pixel-identical.
This improves the former upper-shadow overlap but does not close full-page UI
acceptance, remote CI, real-device, release or deployment proof.

The next confirmed gap is the Original runtime-error surface. Six unmodified
Source frontend cases (three themes, desktop/mobile, Hot Return with incomplete
presentation/response and a forbidden timed-block exit) pass in
`scripts/reference-original-runtime-error.mjs`. The Source retains its iframe,
focuses a native non-dismissible dialog, shows the default custom technical-help
text and expandable Fehlerdetails, and offers Schließen und neu laden. Escape and
backdrop clicks retain the dialog. Each case logs one Runtime Error: runtime-error
and one CONTROLLER=ERROR, then reloads through the same participant route and
sends a connection-lost beacon. Portable presentation expectations are saved in
`scripts/fixtures/original-runtime-error.json`. These are frontend references on
owned API/player fixtures, not Source backend authorization or persistence proof.
The Rewrite's retained-player/native-error-dialog implementation and broader
error, custom-text and overlapping-command acceptance remain open. The pinned
Source revision remains `ee2ab9ab64bd91209ef8534bbe6005838024e46d`, freshly verified
against remote master. All eight full Original UI acceptance rows remain open.

### Paused starter exits (2026-10-10)

Application checkpoint `9d9ec5754879` matches the pinned Original pause-status
exit. A visible pause leaves for Starter without a termination question, another
CONTROLLER write, changed response packets, timer cancellation or leave locks.
The interrupted timer and monitor pause remain intact. A forced silent pause
keeps only the ordinary end-test confirmation. Staying makes no mutation;
approval records `TERMINATED_PAUSED` and, if configured, locks the whole test.
Source's `patchLock` writes the separate `BOOKLETLOCKEDbyTESTEE` event and locked
flag, preserving the controller state; the Rewrite now does that for paused exits.

The lazy Original pause surface uses Source's native raised card, booklet title,
login and mode labels, custom pause text and retained unit toolbar. The paused
toolbar has Source's natural height and hides interrupted time. In all captured
cases card/toolbar/title/paragraph geometry agrees within 0.6 px; fonts, colors,
spacing, borders and shadows agree exactly. The shared participant controller
continues to own the Run and the ordinary interface keeps its existing surface.

Unmodified Source `ee2ab9ab64bd91209ef8534bbe6005838024e46d` passes 42 frontend
cases: Hot Return across three themes and desktop/mobile, Hot Restart in Primar
at desktop, three timer leave policies, and visible/silent pause. Two more
Source cases prove the configured termination lock. The matching 44 authenticated
Rewrite browser cases use its real SQLite API, owned operator pause commands and
trusted synthetic Verona input. Anonymous/foreign sessions, stale units/status,
exact saved packets, interrupted timers and absent leave locks are checked.
The 36 advisory, 57 completeness/visible-button and 43 normal-exit regression
cases also pass to owned API shutdown: 180 successful browser cases in total.
An extra PNG audit finds 44 exact card-body crops but zero exact full viewports;
small differences remain at the header/toolbar and upper-card shadow overlap.
Full pixel parity is therefore still open despite matching measured geometry
and computed styles.
Source frontend fixtures do not prove Source backend authorization; the pinned
PHP controller/DAO and TestLog sources independently establish the lock event.
This does not close the full Player UI row or untested navigation/custom-text
and hidden-header combinations.

Optional `expectedStatus` fences stale HTTP confirmations. Run, current unit,
view and status are also checked after lazy loading, autosave, draft saving,
preparation, confirmation and the response. A refresh observing this action's
exact server result before HTTP completes is accepted; a newer remote pause
cannot be erased by the old response. The production methods are exercised in
frontend state tests, alongside native browser flow checks.

All 1,128 unit/state tests pass (469 frontend), all 165 SQLite API tests and all
701 PostgreSQL integration tests pass. PostgreSQL uses a fresh owned container
and volume, removed afterwards. The new 44-case browser gate is mandatory in
`ci:browser:quick`; the initial bundle stays at 469.99 kB under the unchanged
470-kB limit. Existing budget warnings remain visible.

Fresh standard/demo/production-secret PostgreSQL Compose checks (schema 52) and
standalone SQLite Docker (schema 58) pass for application `9d9ec5754879`. Image
`testcenter-rewrite-app:completeness-9d9ec5754879` is
`sha256:c7190455bac4b65f100c8d304fd89582be76c9fe1fe6d3be4987f081c75f728d`,
uses `node`, and declares build time `2026-10-10T15:36:01.071Z`. All owned test
resources are removed. Exact inventories retain all 24 existing containers and
85 volumes, and the protected PPTX checksum is unchanged. Lossless compression
of one additional closed owned test database saves 106,082,263 bytes, with a
verified SHA-256 round trip. After the current image build, 11 GiB remain free.

Keep the negative evidence: 24 pre-correction memory-store pause cases failed
with forced-completeness denial. The first Source probe looked for literal
"Testpause" although Source resolves its default custom text. The first own card
used that fallback and had the wrong width. Reusing the same paused participant
across viewports then blocked a fixture's next Player load; each browser case now
uses its own workspace. The old API expectation of a termination during visible
pause caused the first SQLite/PostgreSQL replay to fail. Its replacement checks
unchanged complete test-log lists against the observed Source behavior; corrected
full replays pass. Failure logs and closed database evidence remain available.

All eight full Original UI rows, physical-device acceptance, current remote CI,
release and deployment acceptance remain open. Next establish Source's actual
Shell/error and overlapping-action behavior, then widen Player/Review acceptance.

### Starter exit advisory order (2026-10-10)

Application checkpoint `f74f3f8512a1` follows Source's order of completeness,
timer and leave-lock checks. In Demo/Review/Trial, an allowed timer is cancelled;
other non-enforced timers are interrupted before a later confirmation opens.
Cancelling that confirmation keeps the Run and current unit active, without
restarting its timer, changing saved packets or applying a leave lock. A repeated
attempt repeats the completeness notice but not the timer notice. Non-confirmed
lock notices appear immediately; confirmed lock notices appear only after consent.
A forced timed confirmation short-circuits the later leave-lock check.

The preparation endpoint authorizes the participant's selected Run and current
unit. Its effects come from stored execution policy; it cannot bypass forced
completeness/time rules or persist preview packets. Saving modes use stored
responses for completeness. Old foreground actions are fenced by Run, unit and
view at lazy loading, autosave, draft save, preparation, confirmation and response.
The optional current-unit guard on the final return request also rejects stale
HTTP confirmations while retaining compatibility for existing API callers.

Unmodified Source `ee2ab9ab` passes 36 owned frontend cases: three preview modes,
three timer leave policies, unit/testlet locks and both confirmation settings.
Their captured copy and notice order match all 36 authenticated Rewrite browser
cases with the real SQLite API and trusted synthetic Verona input. The browser
also checks anonymous/foreign-session rejection, stale units, unchanged packets
and no implicit locks after staying. A separate forced-time Source probe records
zero remaining time and termination without an additional unit leave-lock write.
These fixtures do not prove Source backend authorization or full Player UI parity.

All 1,031 local unit/state tests pass, including 444 frontend tests. All 165
SQLite API and 605 PostgreSQL integration tests pass; PostgreSQL used a fresh
owned container and volume, both removed after verification. The production
initial bundle remains 469.99 kB under the unchanged 470-kB limit. The new browser
gate is mandatory in `ci:browser:quick`.

Keep the negative evidence: the first preparation implementation let status
reads automatically resume an interrupted timer. A persisted interruption bound
to the loaded unit fixes that; status/save, repetition and explicit resume are
tested across all four stores. Native lifecycle copy initially used a UI timer
projection without its identity/duration fields; the compiler caught it and the
implementation now retains the actual current-state timer.

Fresh isolated PostgreSQL Compose checks (standard/demo/production-secret,
schema 52) and standalone SQLite Docker (schema 58) pass for application commit
`f74f3f8512a1`. Image `testcenter-rewrite-app:completeness-f74f3f8512a1` has ID
`sha256:c0304bf4c57342bafb8c69c8db21e54f273f14be2b0f8b35fbe1613d06033274`,
revision `f74f3f8512a1`, user `node` and declared timestamp
`2026-10-10T14:31:03.202Z`. All owned resources have been removed. Exact inventory
checks retain all 24 pre-existing containers and 85 volumes; the protected PPTX
checksum is unchanged. After the new image build, host availability is 12 GiB.
The 57-case completeness/visible-button and separate 43-case normal-exit
regressions both pass through owned API shutdown. Together with the new 36-case
advisory matrix, this checkpoint has 136 successful browser cases. The later
test-only refinement loads the pinned fixture before spawning its API and checks
Source's actual `UNITS_LOCKED_AFTER_LEAVE` / `TESTLETS_LOCKED_AFTER_LEAVE` keys;
all 36 captured advisory traces plus the forced-time trace have neither key.
All eight full Original UI rows, physical-device acceptance, current remote CI,
release and deployment acceptance remain open. Next compare paused exits and
Shell/error/busy races, then widen Player and Review acceptance.

### Completeness before starter exit (2026-10-10)

A forced logo exit now checks the current unit's completeness before timed-block
or leave-lock decisions. Direct return-to-starter requests cannot skip that check
with confirmation flags. The API resolves the nearest testlet/root policy and
projects it with the current unit; the frontend uses the newest local Player
report instead of an older API packet. A denial leaves saved responses, locks,
timer expiry and the running Run unchanged. Non-saving modes evaluate transient
reports without persisting them. Monitor navigation overrides keep the separate
forbidden-timer restriction.

Unmodified Source ee2ab9ab confirms the ordering in 54 presentation/response/both
cases and 18 legacy Verona 2 cases, across three themes, desktop/mobile and three
leave policies. Two additional fresh-Player probes distinguish an absent response
status from explicit incomplete progress. Source requires exactly `complete` for
presentation; `complete-and-valid` is accepted for responses. The controller,
Verona interfaces, InfoDialog and close SVG match their pinned Git blobs. These
frontend probes use owned API/Player fixtures; they do not prove Source backend
authorization or whole-page parity.

The Original UI presents the native information dialog with one close button.
The shared UI also offers only a close action. A malformed positive result cannot
approve a denied exit. Run/view fences cover lazy loading, autosave settling,
draft saving and the eventual HTTP response, so an obsolete exit cannot clear a
replacement view or stop its event stream. The lazy policy and direct contracts
subpath keep the unchanged 470-kB initial limit; the production build is 469.99 kB.

Local checks pass all 868 unit/state tests (including 419 frontend tests and 47
exit-method tests), 165 SQLite API integration tests and 421 PostgreSQL integration
tests against a fresh owned container. The mandatory 57-case browser gate uses
trusted Verona input, direct authenticated/anonymous/foreign-session HTTP calls,
exact stored packets, timer/lock precedence, native focus/close behavior and
Source dialog copy/geometry. Its visible close-button comparison uses real
locator screenshots from all 72 Source cases, including fractional positions;
off-screen transparent whole-page crops are not accepted as icon evidence.
The final 57-case visible-button replay and the separate 43-case normal-exit
regression both pass through owned API shutdown. The original animation timeout
remains recorded; its precise cause is not established by the successful retry.

Keep the negative evidence: the old API returned HTTP 200 for a forced incomplete
exit; the initial implementation invented an absent response status and failed
an existing execution-mode case. Explicit MatIconRegistry wiring and a contracts
barrel re-export exceeded the initial bundle budget. The inline SVG first sat
four pixels too low on desktop; Source's inline baseline/automatic icon height
fixes it. A generic close-button hash failed for a differently sized response
dialog; reference hashes are now captured separately for every state. A normal
exit replay timed out while waiting for animations; its retry brings the owned
page forward and preserves animation diagnostics on any repeated failure.

### Current container and storage checkpoint (2026-10-10)

Application tree ca54c32603bd passes fresh isolated standard, demo and
production-secret PostgreSQL Compose runs at schema 52, plus the same image's
standalone SQLite Docker runtime at schema 58. The local image is
`testcenter-rewrite-app:completeness-ca54c32603bd`, revision ca54c32603bd, user
`node`, image ID `sha256:09e3106f02f5f59b57718f7390c67038606b7d8374400cdb63ab2762d7407b54`.
Its declared build timestamp is 2026-10-10T13:44:39.382Z. All owned projects have
removed their containers and volumes after verification. The earlier a0f479d6
image also passed these four container executions.

Docker recovered from a stopped engine after a bounded Desktop restart. Two
completed owned SQLite artifacts were losslessly compressed and checksum-verified,
saving 212,118,099 bytes. A further 1.269 GB of unused Docker build cache was removed after the current
builds. Exact inventories retain all 24 pre-existing containers and 85 volumes;
the protected PPTX checksum is unchanged. The final measured host availability is 13 GiB. Complete Original UI rows, physical-device acceptance, remote CI,
release and deployment acceptance remain open. Continue with unforced timer/lock
advisory ordering on exit and the remaining Shell/error/busy and wider Player/
Review matrices; the visible-button and normal-exit replays are now closed.


### Original in-player logo exit and hidden header (2026-10-10)

The optional Original Player now opens the native Material confirmation used by
unmodified Source ee2ab9ab. A saved exit asks "Sicher, dass du den Test beenden
möchtest?" without an extra saved-progress paragraph. A timed-block or leave-lock
warning is folded into that one question. Source's restriction labels reverse
the native result: "Hier bleiben" stays, "Trotzdem weiter" continues. Primar fills
the first native false-result button; Sekundar/Erwachsene retain outlined order.
A forced forbidden timer reports the Source toast and never opens a dialog.
The shared Rewrite labels/renderer and server restrictions remain in use.

Source's hidden header has a 48px positioned logo wrapper and an inline native
link, whose measured hit rectangle differs from the image. Both visible and
hidden header geometry now follow that actual DOM. Replacing an open dialog uses
Material-generated IDs and keeps the original live focus trigger; destruction
unsubscribes before closing. Weak focus references do not retain detached views.
The parent rejects old overlay results, and the exit action fences its awaited
confirmation against a changed Run or view lifecycle.

The read-only Source helper covers 36 combinations: three themes, desktop/mobile,
visible/hidden header, and plain/confirm/forbidden exit. Its API and synthetic
Player fixtures establish frontend behavior, not Source backend authorization.
The actual logo/image and 24 native dialog geometry/style/copy measurements are
pinned in scripts/fixtures/original-player-exit.json. Caller revision metadata
must still be verified against the unmodified Source build externally. Reproduce
with ORIGINAL_PLAYER_REFERENCE_ROOT, ORIGINAL_PLAYER_REFERENCE_COMMIT and a fresh
absolute UI_SMOKE_ARTIFACT_DIR, then reference:ui:original-player-exit:built.

The new mandatory ci:browser:quick gate owns its real SQLite API and credentials.
Its 36 Original cases check trusted Verona answers and exact stored packets,
modified activation, native focus trap/Escape/backdrop/stay, one confirmed exit,
cancelled timer state, and an actual forbidden-return 409. It also checks native
dialog replacement, a deliberately missing lazy bundle's guarded fallback, and
six shared Rewrite cases. Only the injected missing-bundle case models no Service
Worker in its owned top frame; the normal matrix keeps production Worker behavior
and the opaque Verona sandbox. Actual request failures stay fatal through child/stream
shutdown. The 24 production-method tests exercise scoped timer/lock copy, reversed
results, destroyed/replaced overlays, live focus ownership and changed Run/view
fences; the complete frontend suite has 396 tests. Production build/typecheck
retain the 470-kB initial limit (469.99 kB). The existing 24-state protected Review
workflow and native header/read-only Starter gate also pass. The final 43-case
exit gate succeeds through owned API shutdown. The settled broader participant
entry/leave/resume/logout slice has 1,283 requests, zero actual API failures/5xx,
and orderly shutdown at participant-entry-start-after-sign-in. This is a bounded
local replay; it does not replace the complete browser/Compose matrix.

Keep the negative observations. The initial Source forbidden check accidentally
read the older timer snackbar instead of the current toast stack; the final
helper waits for the exact denial text. The first own check exposed inherited
logo fonts/inline hit geometry. Dialog replacement exposed a real detached-focus
regression and one comparison captured the replacement's intermediate animation;
the final gate waits for settled animation. The shared single-booklet login
already starts its Player; the test must not click a disappearing Starter button.
The first bundle-failure injection was satisfied by the Worker cache and did not
block a request. Playwright's Worker-block shim then threw in the opaque iframe;
the final injection models absent Worker support only in the owned top frame and
requires an actually blocked bundle. The shared fallback passes an explicit
request context and rejects obsolete results. The broad native cancellation flow
now waits for Material dismissal before opening its next confirmation.
A broad smoke initially reused demo bootstrap credentials with a different first-
admin password; repeat on a fresh owned, non-demo database. Complete PNGs retain
Player/notification/background differences, so no complete Original UI row,
physical hardware, remote CI, new container image, deployment or production
acceptance is closed here. The protected PPTX and user stores are preserved.
This checkpoint is local and unpublished; continue remaining whole Player/Shell,
error/busy and production acceptance.

## Acceptance baseline

The current native-logo correction makes 48 complete initial/focus/alert RGBA
pairs and twelve complete settled-tooltip pairs byte-identical to unmodified
Source ee2ab9ab. Native login activation resets the form; modified activation
clears both tabs. Source cancels modified Starter activation, while copied links
open an independently authorized read-only Starter. The own real SQLite gate
covers 24 participant/admin cases, eight fresh/running Starter cases across four
modes, unchanged server Run/answers and pending save outbox, and anonymous/foreign
session denial. It is mandatory in ci:browser:quick. The normal leave confirmation
and pending-authentication protection remain in use. This is a bounded header
proof; the bounded hidden-header/timer logo checks below complement it. Remaining Shell/error/busy states, whole flows and
production acceptance are still open. No complete row is closed.

To reproduce current Source header evidence, use the same externally verified
production build/revision and a fresh owned artifact directory as below, then
run reference:ui:original-header:built. Add ORIGINAL_LOGIN_REFERENCE_ENTRY=admin
for admin login or ORIGINAL_LOGIN_REFERENCE_STARTER=true for Starter. These
three modes pass twelve cases each. The helper's revision metadata is a caller
assertion, not Source/backend/production verification. Tooltip comparisons wait
for animation completion; intermediate scaled rectangles are not the fixture.

The latest participant alert comparison closes the plain-paragraph and stale
submitted-form presentation gaps: 24 complete Caps Lock/rejected-credential
RGBA pairs are exact across three themes and four widths. Rejection clears the
credentials and resets pristine/untouched/submitted state without forcing
focus. Source error/warning icons shrink naturally inside narrow notices.
Participant HTTPS notice geometry matches in twelve cases; eleven full-page
images are exact and one has 25 differing text pixels. Admin HTTPS notices have
separate current Source measurements. Protected real participant/admin browser
gates pass, including no-request HTTPS blocking, actual challenges and retry.
These bounded states do not close the login/Shell or cross-cutting row;
remaining whole Player/timer, errors/busy states and full production acceptance
are open.

Fresh 2026-10-10 comparison removes the Rewrite's synthetic initial participant
login/group values. Blank entry is disabled, while saved names and explicit
links retain their values across reload in both interfaces. The current Source
is built from verified byte-exact tracked frontend/common/definitions files at
`ee2ab9ab`; equal own frontend fixtures have no unknown requests or page errors.
The initial participant comparison matched desktop but exposed mobile full-page
heights of 847/844px. The corrected participant and admin entry shells preserve
the Source footer's overflow outside AppRoot, while html/body clip the window.
All twelve full-page pristine-focused-name RGBA pairs now match byte-for-byte:
both login surfaces, three themes and desktop/mobile. The two protected headful
production gates also pass their four-width matrix and actual login/recovery
cases; a DOM Range regression assertion rejects the clipped admin baseline.
The subsequent native-focus correction also makes the six initial participant
desktop/mobile RGBA pairs byte-identical without first focusing the name fields.
All 72 initial/password/visibility/back/repeated-password/invalid-return focus
states match Source across three themes and four widths. The independently
observed native Tab sequence is logo, welcome scroll container, name; Source's
logo was still a link while Rewrite used a button at that checkpoint; the correction above now resolves that bounded difference. One wider Primar/600px image
has 113 differing text pixels, while its fresh single-case replay is exact.
Both are retained; no complete Shell/login or cross-cutting row is closed.
Source's native window clipping and the footer-free starter are retained.
The corrected focus comparison uses the same actual pristine input state;
an earlier extra click had touched only the already-focused Rewrite control.
The fresh Source camera diagnostic again exits 2 after twelve actual
`video.nativeElement` startup/re-entry failures. These are separate negative
reference observations, not successful camera or physical hardware acceptance.

To reproduce the Source focus observation, first verify the unmodified current
Source revision and its production build, then run:

```sh
ORIGINAL_LOGIN_REFERENCE_ROOT=/path/to/original/frontend/dist/testcenter-frontend/browser \
ORIGINAL_LOGIN_REFERENCE_COMMIT=ee2ab9ab64bd91209ef8534bbe6005838024e46d \
UI_SMOKE_ARTIFACT_DIR=/path/to/new/owned/source-evidence \
npm run reference:ui:original-login-focus:built
```

The helper records the caller's revision assertion, renders the unchanged
frontend on owned rejected-login fixtures and fails unknown requests/page
errors. It does not verify that revision itself or establish backend behavior.
It also checks the Source notice fixtures and native form reset. For a real
insecure HTTP origin, run it with `ORIGINAL_LOGIN_REFERENCE_INSECURE=true` and
a new artifact directory. Add `ORIGINAL_LOGIN_REFERENCE_ENTRY=admin` to check
the admin notice. These three modes each pass twelve Source cases. The Source
participant fixture makes one rejected name probe; the protected Rewrite gates
independently require zero credential/challenge requests in that context.
The regular protected login and bounded entry/logout browser gates verify the
Rewrite's real authorization/session flow independently.

Requested on 2026-09-12: keep the existing rewrite interface available and add
an optional interface identical to the Original Testcenter. This is a separate
acceptance axis from functional parity; the historical 94% estimate in
PARITY.md does not measure it.

Current upstream target, reverified on 2026-10-09:
`ee2ab9ab64bd91209ef8534bbe6005838024e46d`. Its only new commit since
`14c98284` adds an initial short-header fallback e2e case and sample setup;
frontend tree `64032f00186dc287c9de3ffd63cc235fe1c9a5da` is unchanged.
The owned native label corpus now covers eight configurations, both interfaces
and both widths (32 cases), including this initial missing-short-label fallback,
exact Run/Session identity and byte-exact saved-response reload. These functional
checks do not close a full-page comparison row. The protected-login busy states,
insecure-context HTTPS notice and independent short Unit labels have current
functional browser evidence. Toolbar on-primary colors and full-page visual
identity require fresh comparison, not only the historical comparisons.
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

### Separate Player and Review toolbar references (2026-10-09)

The current unmodified Source has two different icon hosts: the main Player
toolbar uses 18px SVGs in 18x24px MatIcon hosts; the Review pane uses 24px SVGs
in 24x30px hosts. The optional Original renderer now preserves both geometries.
Its main toolbar keeps Source's default cursor; the pane retains pointer for
enabled controls and default for disabled controls. The disabled list button
keeps full opacity instead of inheriting the Rewrite's 0.65 opacity.

Both reference helpers wait for real finite drawer/ripple transitions and fonts
before capture. They independently compare both toolbar hosts/SVGs and cursors
in all 24 form/filled/list/edit states across three themes at 1280/390px.
Every list/edit capture first proves the same intended own comment is visibly
rendered. Protected SQLite native CRUD/back/new/retry, exact UTF-8 answers,
same Run reload, foreign-Session denial and the existing Rewrite switch pass.
The earlier diagnostic that selected `toolbar-right` measured the main Player
toolbar; it was not a measurement of the pane's `mat-toolbar`.

These are component comparisons, not full-page identity. Small image differences
remain and none of the eight complete acceptance rows is closed here. Source
fixtures prove rendered frontend behavior; they do not prove Source backend
authorization or physical camera/window acceptance.

### Current Starter and Review-download messages (2026-10-09)

Unmodified current Source `ee2ab9ab` renders 24 owned fresh/mixed/long-title/
Review Starter states in all three themes at 1280/390px. Their 2,928 measured
Starter geometry/style values match the protected Rewrite renderer exactly.
These are frontend fixtures, not Source backend authentication evidence.

The empty Review export exposed a concrete presentation difference: Source
shows a bottom-centered, independently dismissible toast; the Original-mode
Rewrite had inserted an inline status paragraph. The optional Original interface
now uses Source's stack, five-second per-message lifetime, close action,
inverse-surface colors, native button font and narrow-width text wrapping.
The existing Rewrite feedback remains available. Populated exports download
their exact CSV without an empty-message toast. Late replies across Session/
view changes are discarded before feedback/downloads; a destroyed Starter
suppresses its pending empty-message toast.

The existing protected SQLite Starter gate passes all 48 geometry/state cases,
exact saved-answer resume, duplicate pending-start prevention and authorized
empty exports. It additionally requires 18 exact single/stacked/first-dismissed
toast comparisons against actual Source in the six theme/viewport combinations,
native click/Enter/close, polite live announcements and independent expiry.
Fifteen production-method regressions cover download results, failed/stale
responses, destroyed views and independent timers. The new Source reference
helper is reproducible without changing Source or vendor assets:

```sh
ORIGINAL_STARTER_REFERENCE_ROOT=/path/to/original/frontend/dist/testcenter-frontend/browser \
UI_SMOKE_ARTIFACT_DIR=/path/to/new/owned/source-evidence \
npm run reference:ui:original-starter:built
npm run smoke:ui:original-starter:built
```

Verify current Source SHA and build before running the reference. The measured
toast fixtures are in `scripts/fixtures/original-starter-review-toasts.json`.
These checks close this component's empty-export presentation gap. Whole-page
pixel identity, all start/resume/error combinations, broader export feedback and
the complete cross-cutting requirements remain open; no full-page row is closed.

The 2026-10-08 PDF continuation adds nine actual TCPDF label-placement/wrapping
references and four actual Source bookmark references. Short/long generated
PDF pages decode correctly, and native protected single/batch exports retain
their scope. This does not close any full-page UI row: Source QR drawing/pixel
details, extended cases, the normal Source capture page and physical camera/
window visibility still require separate evidence. See `PARITY.md` for exact
whole-flow versus focused-run and publication boundaries.

Normal Source capture reference is currently blocked at `ee2ab9ab`:
`runCamera` reads `video.nativeElement` before dynamic ViewChild initialization.
Twelve fresh actual initial/re-entry states across all three themes and both widths
reproduce the failure without a video stream or metadata lookup. Native reload
returns to the Starter and capture URL re-entry fails again. The standalone
`diagnose-original-camera-reference.mjs` exits 2 and retains actual error states;
these cannot count as successful capture comparisons or close any matrix row.
The reference remains unmodified, and real camera/window acceptance is separate.

### Current Review drawer comparison (2026-10-08)

An additional read-only comparison on 2026-10-09 decodes the actual PNGs from
`goal-review-header-probe/` and the settled `source-label-review-reference/`
captures in all 24 states. Header content pixels match exactly in all three
themes and both widths; differing pixels occupy only the last two header shadow
rows. Its zero-scroll before/after measurements and decoded pixels do not
reproduce the earlier sporadic clipping described below. The retained result
is `goal-review-header-pixels.json`. This narrower header observation does not
establish full-page identity or close a matrix row; no image or runtime was
modified for the comparison.

Freshly rebuilt unmodified `ee2ab9ab` references and the protected owned SQLite
Rewrite gate repeat all 24 comparisons on 2026-10-09. They retain identical own
content, exact rendered list/editor checks, font/drawer readiness, native input,
same-Run persistence and foreign-Session rejection. All measured panel, toolbar,
form, button, label, list and header comparisons pass. Actual raw screenshots
still differ, including header raster clipping despite identical rectangles;
this is current component evidence, not full pixel identity or closure of any
complete acceptance row. The frontend source tree is unchanged from `14c98284`.

The optional participant Review pane now adapts the actual `14c98284` toolbar,
700px inner panel/90%-viewport drawer, Material form, current-Unit and whole-Test
lists, add/edit/back actions, priorities/categories, primary/on-primary colors
and scrim. The existing Rewrite pane remains available. Both use the same
authorized facade and SQLite review routes; there is no second persistence or
credential path. Pane/list/draft state is scoped to the exact Run and Unit.

`reference:ui:original-review:built` renders unmodified current upstream assets
with owned API fixtures; `smoke:ui:original-review:built` uses a protected owned
SQLite API. They share the same synthetic Player, labels and exact comment.
Before every list/edit capture they require the intended visible entry or exact
editor text, completed fonts and settled drawer geometry. Trusted native wheel
input puts both panes at the same natural top/left scroll endpoint before each
capture; no DOM scroll setter or forced input establishes the comparison.
All 24 empty/filled/list/edit
pairs pass in Primar, Sekundar and Erwachsene at 1280 and 390 pixels: panel,
drawer, toolbar and form-control rectangles match exactly, as do measured
toolbar/action-button colors, button geometry/shape/font, all form-label colors
and fonts, list typography and
scrim. Earlier empty/incorrect review-list
fixture captures are not evidence. Source-frontend fixtures do not prove the
Source backend. A fresh 24-state comparison also verifies the corrected plain
form-label tint and inherited drawer theme without a duplicated Material theme.
The production initial bundle remains 469.98 kB under the unchanged 470 kB gate.
Raw screenshots still differ and history-dependent native scrolling remains a
separate comparison requirement; this is not full pixel identity.

The next rendered comparison extends the gate to header/title/logo rectangles
and action-button opacity, cursor and transform. It exposed a real global
Rewrite-style leak: disabled Material buttons were additionally dimmed to 65%,
and enabled actions inherited a pointer cursor and hover translation. Only the
Original Review action buttons now use the current Source presentation (opacity
1, default cursor, no translation). Review edit captures await the intended
visible editor before measuring its scroll region; an independently retained
negative attempt had measured a disappearing list region during that transition.
Capture helpers also wait two native animation frames after wheel input.
Header/title/logo rectangles match in all 24 states. Some raw captures still
clip header raster content despite identical post-capture rectangles in both
unmodified Source and Rewrite; this observation is not a proven product layout
regression or resolved full screenshot acceptance.

Native protected browser flows also pass new/edit/save/delete/cancel, add/back,
test/unit/task targets, simultaneous categories, exact Unicode/newline content,
same-Run reload, restored editable drafts after closing/reopening, list reopening,
failed-save retry and switching to Rewrite. Own credentials authenticate their
own Run (`200`) and fail for another Session's Run (`401`); its review inventory
remains byte-for-byte unchanged. Eight actual production-class regressions cover
restoration, duplicate actions, destroyed views and late results across Run/Unit
boundaries. The new browser gate is mandatory CI. No full-page row below is
closed by this component-level comparison.

A subsequent native keyboard gate reproduced focus leaving the open drawer
after confirmed Review deletion (the unchanged 30-second focus assertion failed).
The old fallback targeted the generic sidebar close button, which the Original
Review pane no longer renders. It now targets the visible Review list/form close
action and retains the generic target for the Unit sidebar. The fixed-assets
protected comparison passes all 24 states plus visible in-drawer focus and
native Tab containment after deletion in all six theme/viewport combinations.
Fresh typecheck, production build (469.98 kB) and all 505 core/frontend checks
also pass. The retained failing log/screenshot establish the original defect;
these Cloud gates are separate from publication CI and full cross-cutting UI
acceptance.

To reproduce against separately built unmodified upstream assets:

```sh
ORIGINAL_REVIEW_REFERENCE_ROOT=/path/to/original/frontend/dist/testcenter-frontend/browser \
UI_SMOKE_ARTIFACT_DIR=/tmp/owned-original-reference \
npm run reference:ui:original-review:built
ORIGINAL_REVIEW_REFERENCE_METRICS=/tmp/owned-original-reference/metrics.json \
UI_SMOKE_ARTIFACT_DIR=/tmp/owned-rewrite-review \
npm run smoke:ui:original-review:built
```

Verify the upstream source SHA and build first. Use fixed production assets and
separate owned databases/ports; do not run build/typecheck cleanup against assets
still used by a browser fixture. A protected full new-tree run reproduced a
disabled save button after drawer recreation despite a retained draft. Its
negative log/screenshot were retained; the implementation now restores real
form changes and the new native close/reopen regressions pass. The complete
protected SQLite suite then passed on fixed final production assets. An immediate
new Edit-value read was corrected to await that exact rendered value, retaining
the assertion and default timeout; its failure screenshot showed the expected
text already rendered. Publication CI remains separate from these Cloud gates.

The current independent header/navigation/toolbar short-label keys now compile
and render in both interfaces, including missing-short-label fallback, modern
toolbar-key precedence and read-only projection of older stored source keys.
The complete repository browser smoke includes seven native XML configurations
at 1280 and 390 pixels, real UI login, native Controller radio input, Unit
navigation and byte-exact same-Run reload. The owned production Chrome repetition
passes all 28 cases, as does an independent bundled Chromium repetition. Smaller
mobile Rewrite card padding fixes a reproduced
vendor-content clipping failure without changing Original geometry or vendor
files. These functional label gates are separate from freshly rendering the
unmodified current upstream and comparing complete pages: none of the eight
full-page rows below is closed by this implementation.

The shared-target ItemBuilder correction retains the same exact native
Participant/iframe/runtime binding when headless Chromium does not create a
separate Player CDP target. The existing repository smoke passes Rewrite and
Original in CI mode as well as headful Chrome/Chromium (six cases). It still
requires visible controls, real trusted inputs, completed browser resource
downloads and byte-exact durable response; no Player sandbox, vendor bytes,
browser flag or test-library code is changed. See `PARITY.md` for the negative
CI reproduction and exact owner/identity/deadline checks. This is browser-harness
acceptance only: all eight complete visual comparison rows below remain open.

The 2026-10-07 focused ItemBuilder acceptance now passes in both interfaces with
headful Chrome and bundled Chromium. Exact native frame/Session binding replaces
an independently reproduced Playwright opaque-srcdoc inventory failure; the
Player, vendor bytes, compatibility adapter and sandbox are unchanged. Real
trusted checkbox/text input, rejection of foreign Sessions and covered controls,
interaction-derived state and byte-exact durable reload are required. Original's
intentionally hidden API-version diagnostic is checked for its actual handshake
text, while the actual Player and controls must be visible. This supersedes the
earlier focused blank-frame observation, not complete long-sequence acceptance,
the visual answer-restoration limitation or any full-page row below. The new
additional runtime reload verifies completed native browser HTML/Script loads
in the exact authorized frame and a new loader, before input and after participant
re-entry, in both interfaces. A fresh native binding verifies visible controls
after each resource probe; no API fetch or weakened sandbox replaces the browser
proof. The separate full sequence now uses the same gate; see `PARITY.md` for its
actual validation boundary. None of the eight complete Original-UI rows is closed
by this shared browser-harness change.

The current protected-login HTTPS notice is adapted from the actual
`14c98284` protection service and alert layout. The shared Rewrite protection
service refuses required challenges before sending credentials in a real
insecure browser context. Original name entry advances locally to its disabled
password step without a credential probe; administrator and second-code entry
are disabled directly. Inactive scopes and secure localhost remain available.
Owned production/headful Chrome gates cover both interfaces, all three themes,
administrator desktop/mobile layout, direct/Enter submissions, and second-code
keypad controls. The Source's non-shrinking 24px error icon is asserted at both
widths. Fixed old-browser geometry fixtures retain their warning even when the
installed Chrome is newer. These gates and actual controller/service regressions
are separate from a freshly rendered unmodified upstream page comparison:
none of the eight full-page rows below is complete.

The 2026-10-07 shared navigation correction synchronizes automatic Run-bound
addresses with Angular Router instead of only replacing native history. Owned
protected SQLite/immutable production browsers prove prevented Back and Forward
retain the exact selected Run, preset assignment, interface and unsaved draft;
the visible shared fallback reload control then restores the saved answer.
All six non-saving entry cases remain green. The longer official Verona 3 flow
also passes its unchanged exact-URL navigation assertion. Thirty-eight actual
entry-method regressions include awaited reload, cancellation and stale view
boundaries. This closes the reproduced local navigation defect, not complete
publication CI or any rendered Original-reference row. The raw-text variant
fixture uses the shared fallback Player, not the Original Verona toolbar.

Run-bound re-entry now distinguishes saving and non-saving modes in the shared
facade. Real protected SQLite/headful Chrome verifies Demo, Review and Simulation
login, code unlock, transient response and hard reload in both interfaces: the
same Run is retained but its transient answer, unlocks and timer are reset.
Saving A/B answers and monitor restrictions remain unchanged. All six paths are
included in the mandatory variant browser gate, with fifteen actual-entry-method
regressions. This fixes the shared Simulation reload CI failure locally; complete
publication CI and every full rendered Original-reference row remain separate.

The updated 2026-10-07 mandatory variant smoke creates both unfinished Runs
through the real protected Starter workflow, without repository seeding. Owned
SQLite/headful Chrome passes A/B answer preservation, exact preset selection,
automatic run-bound browser addresses, hard reload of each assignment,
background-save isolation, monitor pause/resume and completing B without closing
A, in both interfaces. Full Memory/File/SQLite API suites also pass concurrent
assignment creation, same-named timer isolation and monitor/completed denial.
Publication `09942c4c` passes native PostgreSQL (219 tests); its complete CI still
fails at the shared Simulation re-entry boundary described above. Full CI remains
an independent gate. This shared functional implementation changes no full
rendered Original-reference acceptance row or pixel-identity claim.

Both interfaces now bind the selected Run ID through state, asset preload,
live updates and actual generated re-entry links. Exact preset assignment,
Unicode answers and Run ID survive hard reload; another run's later background
saves cannot steal selection or bypass the selected run's monitor pause.
Production/development protected SQLite browsers and headless production pass.
At the earlier selected-Run publication, the second open Run in that focused
fixture was repository-seeded; the updated real-launch acceptance above now
replaces that fixture. These shared functional safeguards do not
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

The subsequent full SQLite flow exposed omitted Run IDs in Workspace/Content
operator links. Their Run-specific cards now bind the represented Run and exact
preset assignment instead of an unrelated roster/default selection. Real owned
protected SQLite/headful Chrome checks pass in both interfaces for Group,
Participant, Booklet and Unit detail links, actual link opening, hard-reload
answer restoration and Content release Run links; both participants' answers and
statuses are preserved. Thirteen actual-getter regressions cover variant and
historical/fallback boundaries. This shared functional fix changes no rendered
Original-reference acceptance row and by itself proved neither full UI identity
nor the then-blocked second unfinished Booklet launch.

The shared backend now permits exact preset-assignment resumption after returning
to the starter, rather than rejecting its variant key against the source Booklet
key. Both interfaces passed real participant login, Unicode draft preservation,
confirmed starter return, same-run resumption and session-link/hard-reload
restoration with owned protected SQLite in production/development; production
also passed headlessly. The mandatory quick-CI variant smoke retains exact
run/answer assertions. This earlier same-assignment check did not close the
other-unfinished-Booklet gap; the updated real-launch check above now covers that
workflow locally, without closing the full starter row or pixel-identity claim.

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

## Participant Debug pane checkpoint (2026-10-12)

All ten Source Debug windows are now available through explicit local or
selected-run remote `debug` commands. Saved window selection automatically
restores only in development, matching the pinned Source production guard.
Production Chromium/SQLite verifies window toggling/closing, native dragging,
configuration/mode fields, Custom Text keyboard selection, condition parsing,
offline tracked-variable projection, pause/ERROR purity and rejection of a
held response from a previously selected booklet. Pinned Source excerpts gate
formatters, conditions, all 39 raw config defaults and six mode definitions.
The Source MIT notice remains distributed in `assets/ORIGINAL-UI-LICENSE.txt`.
Diagnostic snapshots also retain the rewrite's participant access-code
visibility boundary, as described in the current checkpoint above.

This is functional coverage with owned fixtures, not a live Original Debug
pixel comparison. The other native console commands, early-loading ERROR,
inherited lock descriptions and large real-package Debug acceptance remain
open; full parity and production acceptance are not established.

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
