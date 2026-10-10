# Cloud continuation: Testcenter Rewrite

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


### Earlier f099540e container checkpoint (2026-10-10)

The application tree f099540e now has a fresh local Docker image, three successful
isolated PostgreSQL Compose runs (standard/demo/production secret), a successful
SQLite Docker runtime gate at schema 58, and 233 passing host-API integration
tests against an owned PostgreSQL container. Every owned test container/volume
was removed; exact inventories preserve all pre-existing 24 containers/85 volumes
and the protected PPTX. Further unused build-cache cleanup freed 439.4 MB; the
last measured host availability is 8.6 GiB. See the current container section in
PARITY.md for proof scope. Complete Original UI and deployment acceptance remain
open. That previously pending exit contract is implemented and validated in the current
completeness checkpoint above.

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

## Native logo and read-only Starter continuation (2026-10-10)

The optional Original header now uses the Source's native logo link, label,
image alt text and settled Material tooltip. Primary/Enter activation on login
clears the form and returns to blank entry; Ctrl/Meta activation clears both
the originating and newly opened login tab, as independently observed on Source.
On the authenticated Starter, Source cancels modified activation; the Rewrite
preserves that behavior. Copy/open-link destinations retain only UI, workspace
scope and session ID, never credentials or a selected Run. The normal in-player
logo still uses the existing leave confirmation and server restrictions.

A separately opened Starter uses the authorized runtime-state GET. It never
loads player state, resumes/resets a Run, drains another tab's pending save
outbox or emits player-load logs. The view clears its cached player presentation
only after authorization and the lifecycle fence; existing non-saving re-entry
semantics stay separate. Both fresh and running sessions are covered in
run-hot-return, run-demo, run-review and run-simulation. Anonymous and foreign
session links remain denied. Pending own authentication also prevents a logo
reset from clearing its credentials. The default Rewrite button remains shared
with the lazy Original failure fallback.

All 48 complete initial/native-focus/Caps-Lock/rejection RGBA pairs and all
12 complete settled-tooltip pairs match unmodified Source ee2ab9ab byte-for-byte
across three themes and four widths. The Source helper separately passes twelve
participant-login, twelve admin-login and twelve Starter header cases; API
fixtures establish frontend behavior only. The own real SQLite header gate
covers 24 participant/admin entry cases and eight authorized Starter cases,
including native modified activation, no Run mutation, unchanged stored answers
and pending save outbox, and anonymous/foreign-session rejection. It is part of
ci:browser:quick and observes actual API failures through child/stream shutdown.
The protected admin gate additionally passes its 24 real challenges, HTTPS,
access-window and failed-asset/chunk cases. The 372-test frontend suite (including
66 entry/protection cases), typecheck and unchanged 470-kB production limit pass;
the initial bundle is 469.99 kB. The bounded normal entry/leave/resume/logout
flow has 1,201 requests with zero actual API failures/5xx and orderly shutdown.

Keep the negative observations: native href is #/r/login, tooltip surfaces do
not have the assumed named role, and intermediate animation geometry differs
from settled geometry. Loading an empty style host as a flex child initially
moved the logo; the final hidden style host restores all full-page comparisons.
An overlapping rebuild invalidated a previously loaded chunk in one broad
browser run; the repeat used stable assets and passed. The first fresh-session
snapshot incorrectly expected current-state GET success; a fresh session has
no Run. The final Starter reads runtime-state directly, also avoiding player
save/log side effects. No complete Original UI row, physical camera/keyboard,
remote CI, new Docker image, deployment or production acceptance is claimed.
Earlier complete Compose/full-browser evidence belongs to the preceding tree.
The protected PPTX and user data are preserved. This checkpoint is local and
unpublished; continue with remaining Shell/error/busy, hidden-header/timer and
whole-flow Original acceptance.

## Participant alert and native form reset continuation (2026-10-10)

On `testcenter-production-readiness`, Original participant errors/Caps Lock now
use the current Source's alert geometry, inherited text color, error/warning
SVGs and native icon shrinking. Rejected login resets the submitted/touched
template form as well as clearing credentials, eliminating the premature red
name field. Text uses interpolation and authorization/secret clearing remain
shared. Twenty-four full-page RGBA error/warning pairs and all notice geometry
are exact against unmodified `ee2ab9ab`; the paragraph baseline fails all 24.
The intermediate no-form-reset images remain as negative evidence.

Participant HTTPS notices have twelve exact geometry comparisons and eleven
exact full-page pairs; retain one Primar/1280 pair with 25 differing text pixels.
Admin HTTPS Source fixtures are separately measured. The portable Source helper
passes twelve normal focus/alert cases plus twelve real-insecure participant
and twelve admin cases, with no unknown requests/page errors. Add
`ORIGINAL_LOGIN_REFERENCE_INSECURE=true` for HTTPS notices and
`ORIGINAL_LOGIN_REFERENCE_ENTRY=admin` for the admin mode, with separate owned
artifact directories and externally verified Source/build revision.

Protected/headful SQLite participant gates pass both scope configurations, all
24 login cases, 38 real participant proof challenges, password authorization,
name reload and second-code blocking. The admin gate passes twelve cases, six
Original HTTPS comparisons, 24 real browser proof challenges, access windows
and asset/chunk recovery. Twenty-six actual method tests, typecheck and the
469.44-kB production build pass. Keep the initial failed assumptions: fixed 24px
icons, literal false instead of Material's unset empty-required `aria-invalid`,
and absolute coordinates after native focus scrolling. Gates retain exact
notice-local geometry, 24px field gap, pristine/untouched/unsubmitted state and
strict no-request blocking. Source itself probes the fixture name once;
Rewrite's stronger zero-request protection remains. No complete UI row, physical
hardware, remote CI, deployment or production acceptance is claimed. Earlier
full browser/Compose proofs belong to the preceding tree. Continue with actual
Source logo-link/navigation semantics and remaining error/busy states; preserve
the protected PPTX and user data. No publication occurred.

## Native participant entry focus continuation (2026-10-10)

On `testcenter-production-readiness`, Original participant entry now uses
Source's native first-password autofocus and no repeated name-focus effect.
The baseline differs in 24/36 actual focus states; the corrected tree matches
all 72 states across three themes and four widths. Back retains the name;
invalid credentials clear it without forcing focus. Native keyboard order is
logo/welcome scroll/name, observed independently on unmodified Source. Source
logo remains a link versus Rewrite's button; do not call the entire entry row
closed. Six desktop/mobile initial full-page RGBA pairs match without manual
focus normalization. Retain the wider matrix's 113-pixel Primar/600px difference
and exact fresh repeat; they do not establish deterministic full-page identity.

The portable `reference:ui:original-login-focus:built` passes twelve current
Source cases with owned rejected-login fixtures, no unknown API paths and no
page errors. Its revision field is a caller assertion; verify Source/build
externally before running. Protected real Rewrite login passes twelve cases,
38 real proof challenges, saved/explicit names, HTTPS blocking and second code.
The main bounded entry/logout/re-entry flow passes same Run/answers, revoked
old token and strict API/shutdown checks: 1,161 requests, zero actual failures,
owned port 60107 closed. Seventeen protection-method tests, typecheck and
469.44-kB production build pass. The preceding complete browser/Compose results
belong to the earlier tree, not a new whole-tree replay. Preserve the negative
short-secret startup and initially wrong Tab-assumption logs; both were fixed
without weakening the 32-character secret or any gate. No publication, remote
CI, full Original UI, physical hardware or production acceptance is claimed.

## Recovered storage and container execution (2026-10-10)

The user authorized freeing space to resume container tests. Docker's actual
host log confirms `init.log` write `ENOSPC`. Host availability increased from
about 1.8 GiB to 12 GiB by clearing verified unused npm/Angular/Nx/Docker build
and dangling-image caches; it remains about 10–11 GiB after rebuilding. Existing
user data, 24 unrelated containers, 85 volumes and the protected PPTX remain.
Only the aborted own project's four containers were removed. Its volume and
the real failure logs remain. Root-owned/unverifiable caches were not forced.
After its regular restart timed out, the unresponsive verified Docker processes
were stopped and Desktop restarted; the Docker API now responds normally.

Fresh own standard, demo and production-secret Compose projects pass PostgreSQL
schema 52, build metadata, runtime preflight, non-root execution and the existing
production bootstrap/authentication assertions. Their synthetic generated
volumes are normally cleaned up. That freshly built production image also
passes the standalone SQLite Docker runtime gate at schema 58.
Separately, all 233 PostgreSQL integration tests pass without skips/cancellations
on a labelled own tmpfs database, and
its container is stopped. Keep the earlier masked SQLite cause unresolved;
confirmed Docker `ENOSPC` does not establish that lost exception. The older
failed Compose gate below is historical and now has a successful fresh replay.
These are local checks; no new remote CI, deployment or production proof exists.

The complete protected/headful SQLite browser replay now passes its strict
server-failure gate through teardown, with 12,911 completed requests and zero
actual failures/5xx. It passes the formerly failing IB stage, normal Attachment
capture/upload/preview/deletion, six observed QR-worker releases and exact
47/47 group-result log deletion. Its own API port 57894 is closed. No owned test
container/process remains; the final inventory still has the same 24 unrelated
containers and 85 preserved volumes. The successful own DB/log/screenshots and
the earlier failure evidence remain. Do not replace these local proofs with a
claim of full Original UI, physical hardware, remote CI or production acceptance.

## Original entry overflow continuation (2026-10-10)

Continue on `testcenter-production-readiness`; `cb8d0066` records the SQLite
failure-cause and strict browser-server gate correction below. Participant and
admin login now retain the current Source's footer overflow outside AppRoot,
with window clipping scoped to html/body. Twelve unmasked full-page RGBA pairs
match the byte-verified Source `ee2ab9ab`, across both surfaces, three themes
and desktop/mobile, in equivalent pristine focused name states. Initial
participant focus remains different. Both protected/headful production login
gates pass their four-width matrix and actual navigation/error/recovery cases;
the actual-text overflow assertion fails the admin baseline. Starter has no
Source footer and is unchanged. Build remains 469.44 kB under the 470-kB limit.
Retain the baseline screenshots and negative guard log; this is bounded entry
proof, not full Original UI acceptance.

## SQLite failure handling continuation (2026-10-10)

Local checkpoints `3e337dfa` and `894042eb` preserve capture ownership and
neutral participant entry. Continue on `testcenter-production-readiness`.
The subsequent store correction preserves the primary failure in all ten
transaction catch paths when SQLite has already rolled back; unexpected
rollback errors retain both causes. Seven real-store cases include bounded
`SQLITE_FULL`, true SQL rollback, atomic retry, migration, challenge consumption
and busy COMMIT. Baseline: four failures out of five, no cancellations. Current:
668 unit/frontend and 165 SQLite API cases pass. The protected real HTTP
negative check confirms generic 500, original private cause in logs, no rejected
data and one exact log after idempotent retry.

The full UI harness now checks its own structured API output for failed
requests/5xx at full/early completion and after shutdown, with streams drained
before the success message. Its six helper cases pass. The former browser log
correctly fails this stricter gate. Keep the original incident's primary storage
cause unresolved; do not infer disk-full or Docker causation from its masked
error. The complete stricter headful/protected SQLite UI run fails at the
IB-family stage with a test-log POST 500 (`unable to open database file`), then
actual log-output `ENOSPC`. Its owned API port 54778 is closed and no matching
API/browser processes remain. Keep the failure database/log; this is no clean
complete browser run. Three completed own synthetic DBs now have byte-exact
SHA-256-verified gzip archives in chat work, recovering about 261 MiB without
removing the diagnostics. The separate bounded protected/headful SQLite
attachment flow passes normal capture/upload/preview/deletion, releases six
workers and completes the strict early-exit/shutdown gate with zero API failed
requests/5xx. Docker production Compose remains open at the actual overlay2
I/O failure. Avoid another full corpus/container replay until stable host
storage headroom is established; do not reset/prune unrelated resources.

## Neutral entry, fresh Source and local container boundaries (2026-10-10)

The initial runtime login/group now start empty instead of synthetic
`student-ui`/`group:student-ui`. The protected production login gate passes fresh
blank/disabled entry in both interfaces, twelve saved/explicit-link cases with
native reload and zero sign-in requests, all three themes, real password login,
second-code and existing four-width geometry checks. All 361 frontend-state
cases, typecheck and the 469.44-kB production build pass. Defaults alone change;
saved participant inputs and explicit entry parameters still hydrate normally.

Fresh Source `ee2ab9ab` builds from frontend/common/definitions, with all 398
tracked blobs verified byte-exact, including symlinks. Its own equal frontend
fixtures and the own protected Rewrite SQLite API have zero page errors and
unknown requests. The same pristine-focused-name desktop state matches all
pixels in Primar/Sekundar/Erwachsene. Preserve the separate initial-focus and
mobile 847/844px height differences; no full UI row is closed. Earlier prototype
captures had unequal touched state, and its first ARIA assertion incorrectly
expected Source's absent valid-state attribute to be the string `false`.
Neither negative prototype is product evidence. Current unmodified Source's
camera reference still fails twelve initial/native-reload/re-entry states with
`video.nativeElement`, zero streams/lookups and diagnostic exit 2.

Own image `testcenter-rewrite-app:production-readiness-20261010` builds and
passes standalone non-root SQLite runtime smoke, schema 58, with local metadata
`local-3e337dfa-neutral-entry`. The own production Compose attempt
`testcenter-readiness-20261010-prod` uses ports 54839/54840 and fails in Docker
`overlay2` with actual `input/output error`. Its cleanup cannot remove the own
API container, and the daemon subsequently reports that Desktop cannot start.
Preserve the real log, and inspect/clean only that owned project after Docker
recovers. Do not prune unrelated images/volumes, reset Desktop or claim a
passing Compose gate. Only the verified chat-owned Source build caches were
removed; its source, built browser assets and evidence remain available. The
full own protected SQLite browser run completes its assertions, including
47/47 group deletion and six attachment workers. Its server log nevertheless
contains one test-log POST 500 (`cannot rollback - no transaction is active`).
Do not treat its exit 0 as clean runtime acceptance. Investigate the primary
SQLite error, which the unconditional rollback currently masks; the original
failure's cause is not established by the Docker failure or low disk space.

## Local attachment ownership correction (2026-10-10)

Continue from current main `143dc3e73ae83f379de4b2fe38edef25c7286a4a` on the
local neutral branch `testcenter-production-readiness`. Fresh main workflow
`38000558022` completes 37/37; it is baseline evidence, not CI for this change.
The correction binds native camera encoding, QR lookup and uploads to the
scope, target, stream/photo and operation that started them. Reset/retake/target
replacement expire old results; old upload bytes cannot start a request after
scope changes, and old results cannot clear newer busy state. Manual/saved-QR
target replacement clears the old photo; live QR capture retains its new frame.

Initial 32 actual-method baseline cases reproduce 27 failures without cancelled
tests. The unmodified production build also fails the protected native browser
reset case with the actual encoded PNG callback delayed. Corrected production
assets pass that full protected headful SQLite Attachment slice, six released
workers and 1280/390px checks, plus the separate generated live-camera sequence.
All 54 lifecycle regressions, 601 existing regular checks, 61 compatibility cases
and 165 SQLite API cases pass. Typecheck/build pass with unchanged 469.46-kB
initial output under the 470-kB limit; both fresh audits report zero findings.
Evidence belongs to the owning local chat's `work/attachment-*`, `work/build.log`,
`work/unit-all.log`, `work/compatibility.log` and `work/integration-sqlite.log`.

No publication or deployment is authorized by this checkpoint. Preserve the
untracked migration presentation (SHA-256
`7a2826bc8f1a9ffb92519a90f3784a6b1dbc27000892b21068a55a637a958a8a`).
Continue remaining Original full-page comparisons, camera/printed-page work and
production/recovery acceptance. Do not convert local passing focused tests or
the historical Source camera failure into full parity or production proof.

## Latest Quick CI evidence retention (2026-10-09)

Head `6221bbdd` Push `37986888156` finishes with 36 successful jobs and one
failed Quick job, `114010993886`. Its `Run ui-quick` step fails. Two actual
decoded-log requests return `Transport closed`; GitHub reports no uploaded
artifacts. The connector rejects the annotation endpoint; the local CLI reports
an invalid token and its actual job-log request returns `Forbidden` with zero
downloaded bytes. Preserve that precise access limitation and unknown assertion
in `ci-6221-push-quick-log-access-evidence.json`; do not claim an application
cause, general repository-access blocker or a passing head from the other jobs.
PR `37986892883` separately finishes 37/37 on its first attempt. Both workflows
finish before the next push; this independent pass does not explain the Push
failure. Both complete browser and activation/native-retry gates pass;
actual complete Push/activation logs are separately retained outside Git.

The next workflow change captures only Quick's unchanged command output and
uploads its owned log on failure. The original failing exit status still fails
the job; no deadline, assertion, authorization, native input or bundle gate is
relaxed. The actual extracted shell passes three controls for exact output and
statuses 0/37/29, including first-failure stopping. YAML parses with the same
thirty matrix entries. A fresh regular `network.enabled=true` turn-scoped grant
has no additional filesystem rights; real IPv4 loopback and child pipes pass.
VM package-manager rules and the three approved browser-download domains remain
enforced. This diagnostic change requires its own fresh publication CI and is
not a correction or inferred explanation of the unavailable Quick assertion.
No real Entire Cloud trace support, deployment, production acceptance or complete
Original-UI acceptance is established by it.

The additional owned protected ItemBuilder check first omits administrator
bootstrap and correctly receives `401 admin_credentials_invalid` before browser
launch. Preserve `goal-6221-quick-ib.log`, its own database and the invalid-
invocation JSON; this is neither a product regression nor a CI reproduction.
The unchanged helper then passes both interfaces on new owned SQLite paths
using the real synthetic secret-file bootstrap: trusted input, foreign/covered
target rejection and byte-exact reload, with exit 0. Logs
`goal-6221-protected-ib-rewrite.log` and `goal-6221-protected-ib-original.log`
are separate positive evidence, not an explanation of the absent Quick log.

## Objective and publication boundaries

Continue toward evidenced complete functional parity with the current Original
Testcenter and an optional identical Original interface. Preserve the existing
Rewrite interface. Read the repository README, `rewrite-app/README.md`,
`docs/PARITY.md`, `docs/ORIGINAL-UI-PARITY.md`, applicable instructions, status
and the last 15 commits before changing code. Paths below are relative to
`rewrite-app` unless stated otherwise.

GitHub `jurei733/testcenter-rewrite` remains the source of truth. On 2026-10-08
the owner explicitly authorized integrating every then-open PR and remaining
branch into main. PR #1 was ordinarily merged as
`2b22dbfe3d4fa54c52c6343d7b4997fe4282eb93`, preserving both parents and all
published commits. The complete inventory had only remote main and
`testcenter-rewrite-parity`; the local `work` branch was already contained.
No branch was deleted or history rewritten. Continue development on the existing
parity branch, now fast-forwarded to that merge, and open a follow-up PR.
The owner repeated that integration instruction on 2026-10-09. PR #2 was
normally merged as `537bd0cb4c579cf303313b2742056eacd92ef034` after all 74
Push/PR jobs passed on `eccdf8fc0d9fdf03e8396889d8c3f31451195ef1`. The merge
tree is exactly that verified tree; both parents and all published history are
preserved. The live inventory then has no open PRs and only main and the parity
branch. All remote branch changes and the local `work` branch are contained in
main. Local main and the existing parity checkout are fast-forwarded to this
merge. Fresh main CI is a separate requirement: its real navigation failure
and the next correction are recorded below. Complete each new tree's checks
before normal integration and recheck the live inventory.
PR #3 is subsequently normally merged as
`fe9ec21fd744fc769b7d0af49d44e27f466a4d1d`, preserving parents `537bd0cb`
and `d2807ed0` and their exact verified tree. All 74 head Push/PR jobs pass;
fresh main workflow `37939303283` separately passes all 37 jobs. The live
inventory has zero open PRs and all published branch changes are contained in
main. The existing local parity branch is fast-forwarded before the next step.
PR #4 is normally merged as `641f6f9096b7d9052f7bf3e8c07b270a8c3aedc6`,
preserving parents `fe9ec21f` and `f161e897` and the verified head's exact tree.
The PR workflow passes all 37 jobs. The Push workflow ultimately passes all
37 jobs after bounded unchanged Compose and Quick retries; its first failures
remain separate evidence, and the first Quick assertion is still unavailable.
Fresh main workflow `37962778150` independently passes all 37 jobs on its first
attempt. All published branch commits are contained in main and no PR remains
open at that checkpoint. Continue on the existing parity branch from this merge.
Never force-push or rewrite published history. Do not use assistant-specific
branch prefixes or names in publication prose.

Current Original target was independently verified on 2026-10-09 as
`iqb-berlin/testcenter` commit `ee2ab9ab64bd91209ef8534bbe6005838024e46d`.
Refresh that target before comparing requirements. Fetch/read upstream without
modifying unrelated working-tree changes. Distinguish local checks, published
CI, merged work, deployed work and production acceptance.

## Historical camera step at restoration

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

The dependency step below now has zero findings in both fresh audits. Keep
the following earlier audit as history, rather than treating it as the current
installed state. Production acceptance and the remaining capability/UI gates
are still open.

An earlier read-only dependency audit on 2026-10-09 recorded 183 findings
in the complete installed tree (68 low, 26 moderate, 82 high, seven critical).
The separate server `--omit=dev` audit records one high package,
`@xmldom/xmldom`; registry metadata confirms 0.9.12 is available. All seven
critical nodes are marked development-only in the lockfile, which does not
certify the compiled browser bundle or establish production exploitability.
Angular advisories need separate browser triage. Actual JSONs are
`goal-production-dependency-audit.json` and `goal-production-server-audit.json`.
No package, lockfile or vendor file was changed during active fixed-asset
fixtures. After verified PR integration, perform narrow ordinary updates with
XML/parser, compatibility, API and relevant browser/CI validation; retain the
470-kB limit. This audit is an open production-readiness item, not acceptance.

Current reference blocker: unmodified Source `ee2ab9ab` camera startup fails
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
   has eight additional restoration/lifecycle regressions. Current aggregate
   checks and publication status are recorded below.
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

### In-flight retry correction and retained negative CI evidence (2026-10-09)

Both `ce46b960` workflows complete before the next publication: Push
`37971006346` is 37/37 successful, while PR `37971066257` is 36/37 successful
and has the real failed activation job `113957509582`. Its full 1.76-MB decoded
log is saved as `ci-ce46-activation-runtime-113957509582.log` outside Git.
The existing strict 90-second mid-drain predicate fails; later reads continue
without the expected remaining save requests. An exact complete `git archive`
of that head, with its own install/assets/DB/ports, passes the unchanged gate
in `goal-ce46-activation-exact.log`. That pass is independent evidence, not a
fix or proof of the precise intermittent CI cause. The failure is not retried.

Actual production methods separately reproduce a lost online/manual retry while
an old request is in flight. Two new retry regressions fail before correction.
Retaining one fresh intent per attempt fixes them without changing packet IDs
or answer bytes or starting an unconditional retry loop. A further regression
fails when the selected Run changes after requesting the retry; checking the
still-selected Run expires that intent. All 14 actual-method cases then pass.
The final complete isolated archive plus the correction passes typecheck,
build (469.46 kB; unchanged 470-kB limit), 601 regular checks, 61 compatibility
cases and four new native Original/Rewrite 1280/390px cases against a protected
own SQLite API. A fresh comparison also passes all 24 completed Review states
against the current rendered Source reference in `goal-save-retry-final-review.log`.
Memory/File/SQLite each pass 165 API cases. The complete protected SQLite
production-correction repetition passes in `goal-save-retry-final-complete-ui.log`
through Attachments, five released workers, exact 47/47 deletion logs and clean
shutdown, with actual exit 0. Its unchanged full activation gate independently
passes in `goal-save-retry-final-activation.log` with actual exit 0.

`smoke-participant-save-retry.mjs` uses only own synthetic content and trusted
native input/connectivity, retaining the same delivery ID, Session/Run, both
byte-exact answers and reload restoration, and asserting foreign-Session denial
and an unchanged foreign Run. It isolates the supported foreground fallback
with an unavailable own Worker script and is appended after the existing
activation CI gate. Existing Worker/full gates remain enabled. The exact old
assets fail waiting for that same delivery's retry in
`goal-native-retry-ce46-baseline-v3.log`; the corrected final assets pass all
four cases in `goal-save-retry-final-native.log`. Earlier helper attempts with
a different newer delivery ID are invalid fixture evidence, not regressions.
The existing mid-drain predicate/deadline remains unchanged; failure-only
diagnostics now identify mismatched Units, hashes and queue IDs without answers.
The corrected complete fixture-timing repetition subsequently passes as recorded
below. Publication CI remains separate until its actual completion.

The first intermediate complete SQLite invocation omits
`FIRST_SLICE_OPERATOR_AUTH_REQUIRED=true`, so it is not protected acceptance
evidence. Its actual full log `goal-save-retry-complete-ui.log` fails at the
late real Monitor Pause: 409 versus 200. Read-only inspection of that own
database proves Run `09c60c33` is already completed, with its authored
120-second timer expired at `2026-10-09T19:23:19.230Z`. The screenshot and
`goal-save-retry-fixture-timer-failure.json` are retained outside Git.
Production correctly rejects pausing a completed Run. The existing fixture
pause is moved immediately after the final running-status and CSV checks, before
unrelated detail/import/attachment phases. Its native click, authorized 200,
same Session/Run and paused status assertions remain; the real timer's duration
and all deadlines are unchanged. Before deletion the helper additionally
requires the entire same paused timer to be unchanged, alongside exact Run,
Session and deletion counts. No completed Run is substituted or result relaxed.
The new complete archive `goal-save-retry-hold-final` has its own install,
compiler/assets/DB/ports and verifies this correction with operator auth enabled.
It independently passes typecheck/build at 469.46 kB, 601 regular/61 compatibility
checks and all four native retry cases. All 145 actual browser files are byte-
identical to the already fully tested production correction; this does not
substitute for the new fixture's complete browser run, independently checked below.
The first placement at the earlier status-filter boundary pauses before a
later CSV still requires `running`. The unchanged predicate catches that
fixture error in `goal-save-retry-hold-complete-ui.log`, with screenshot
`/tmp/testcenter-ui-failure-Cv79HJ/failure.png`. Its exact baseline-to-fixture
patch is retained as `goal-save-retry-hold-first-placement.patch`. The pause
is relocated after the final running CSV assertion, without altering it.
`goal-save-retry-export-hold-complete-ui.log` proves the unchanged running CSV
and correctly placed native pause, but then fails the new state-read helper:
its POST default receives the correct 404 `route_not_found`. This invocation
is not a pass. The helper now explicitly uses GET without changing the endpoint,
authorization or its identity/timer assertions. Its actual log and screenshot
`/tmp/testcenter-ui-failure-vLBtby/failure.png` remain retained; the corrected
fresh protected repetition is `goal-save-retry-get-hold-complete-ui.log`.
That complete repetition passes with actual exit 0: all unchanged running CSV
assertions, native authorized pause with 120-second duration and positive time,
same Session/Run and identical full paused timer at the later boundary,
Attachments, five released workers, exact 47/47 deletion logs and clean shutdown.
The 361 frontend checks independently pass after the corrected fixture placement.
No active fixture's assets are cleaned or rebuilt.

The product network permission is turn-scoped. A later fresh install runs under
`network: restricted` and fails `spawnSync .../esbuild/bin/esbuild EPERM`;
that failed invocation is preserved in `goal-save-retry-final-install.log`.
The regular authorized product request grants only `network.enabled=true` for
the current turn. Fresh Node 22.23.3 IPv4 loopback and exact `own-pipe-ok` child
output succeed; a protected new SQLite database returns unauthenticated 401
and shuts down cleanly in `goal-save-retry-restoration-renewed.log`. No file,
domain, VPN, proxy or policy rights are expanded. GitHub access remains proven.
Entire CLI/hooks/real Cloud trace export remain unavailable; no checkpoint or
trailer is invented. The historical remote checkpoint ref still resolves to
`fbd52e6f`. Private PPTX/tryout data are not read or transferred. All eight full
Original-UI rows, physical camera/window, deployment and production acceptance
remain open; the current unmodified Source camera reference still fails.

### Compatible dependency lock and restored runtime (2026-10-09)

The next continuation restores the clean existing parity checkout at `641f6f90`
with Node 22.23.3 after activation. The previous product network grant expired:
the initial own IPv4 listener fails with
`listen EPERM: operation not permitted 127.0.0.1`. After the regular product
network request, the effective execution profile has `network: enabled` and
the fresh IPv4 listener and exact `own-pipe-ok` child output succeed. An own
new SQLite database starts with operator authentication enabled, returns 401
for the unauthenticated workspace request and shuts down cleanly. This is a
fresh restoration pass. It does not expand filesystem rights, VM domains, VPN,
proxy exceptions or sandbox/policy configuration. Permissions remain turn-scoped.

An isolated complete `git archive` of `641f6f90` uses its own dependency install,
build assets, databases and ports. Targeted ordinary transitive updates remain
inside the parents' existing declared ranges; the manifest, Angular, Material,
TypeScript, Playwright and browser versions are unchanged. The MCP SDK explicitly
allows both `@hono/node-server` 1.x and 2.x. Vite allows esbuild 0.28.1; the same
version is already the Angular builder's exact dependency. Updating Vite's
older separate esbuild removes the last finding and deduplicates its binaries.
There is no override, force install, vendor modification or new direct dependency.
The fresh full audit moves from 17 findings to zero, and the separate server
`--omit=dev` audit remains zero. This closes those installed-lock findings, not
production acceptance or a claim that audits prove every security property.

Typecheck and the unchanged production budget pass at 469.46 kB. All 145 actual
browser files are byte-identical to the freshly built `641f6f90` baseline.
The 596 regular tests, 61 compatibility tests and 24 fresh Source/Rewrite
Review states pass, including the visibly verified own list/edit entry, native
CRUD/back/retry, exact UTF-8, same Run reload and foreign-Session denial.
Memory/File/SQLite each pass all 165 API cases. The unchanged Verona gate also
passes all eight native completion-navigation cases in both interfaces and
both widths with exact same-Run answers and unchanged foreign own state.
The complete protected SQLite browser repetition subsequently passes through
Attachments, five released workers, exact 47/47 deletion logs and clean shutdown
in `goal-next-compatible-tooling-full-sqlite.log`. At the earlier `ce46b960` commit
checkpoint it was still running. Publication CI remains independently required;
the later real activation failure and its correction are recorded above.
Builds finish before browser fixtures start; their assets are not cleaned or
rebuilt while in use. Logs and generated audit JSONs use the
`goal-next-compatible-tooling-*` names outside the repository.

Two fresh negative prerequisites remain separate. The existing real insecure
fixture hostname `testcenter-proof.insecure` still receives HTTP 403
`Domain forbidden`, while the same own protected API on 127.0.0.1 returns 200
and renders its login field. A supported loopback-only fixture exception or
equivalent actual insecure-context product fixture is still missing; no proxy
or domain bypass is made. Unmodified current Source `ee2ab9ab` also fails all
12 initial/native-reload camera states with the same `nativeElement` error,
zero stream and zero metadata/unknown requests. Its diagnostic exits 2 and
does not establish camera acceptance. The functioning current Original camera
reference and physical camera/OS-window acceptance remain external prerequisites.
None of the eight complete Original-UI rows is closed by this dependency step.
Entire CLI/Cloud trace export remains unavailable; no new checkpoint or trailer
is invented, and no private PPTX/tryout data is read or transferred.

### Maintained dependencies and completed toolbar references (2026-10-09)

The next step is validated in isolated own snapshots, with no shared build,
database or port paths and no build cleanup while a fixture uses its assets.
The official XML parser 0.9.12 rejects an own malformed SysCheck end tag that
0.9.10 imported successfully. Valid own XML remains accepted. A new protected
API regression asserts unauthenticated 401, successful valid import, precise
malformed-XML rejection and accepted/rejected persisted source status.
Memory/File/SQLite each pass 165 cases; PostgreSQL passes 233 cases, with own
fresh databases. The complete unchanged own PostgreSQL and SQLite browser
gates pass through Attachments, exact 47/47 deletion logs and clean shutdown.

Angular core packages are updated to 21.2.25 and CLI/build to 21.2.26, while
the pinned Material/CDK presentation versions remain unchanged. The project
already uses `@angular/build`; declaring it directly removes 397 unnecessary
legacy Devkit/webpack packages. Ordinary compatible updates also remove the
remaining critical development-package findings. The full audit drops from
183 findings/seven critical to 17 findings/zero critical (two low, five
moderate, ten high); the separate server `--omit=dev` audit has zero findings.
The remaining full-tree findings still require triage; neither a zero server
audit nor dependency flags certify the compiled browser or production safety.
Actual final JSONs are `goal-build-package-audit.json` and
`goal-build-package-server-audit.json`.

The initial 473.81-kB dependency-update build genuinely fails the unchanged
470-kB gate. Operator-only Live Context, Summary and Activity components now
load when their existing view opens; Live Context's unchanged styles load with
that component. The root imports only the Common directives it uses and keeps
the existing identity/permission tracking keys in built-in control flow.
The resulting build passes at 469.46 kB; typecheck, all 596 regular checks and
61 compatibility checks pass. Protected native before/after Live Context
captures have exactly matching content, rectangles and computed styles at
390, 1080, 1081 and 1280px. Later tooling updates emit byte-identical complete
browser assets, independently compared; their fresh browser repetition remains
a separate result and is not inferred from that comparison.

Current unmodified Source and protected own Rewrite compare 24 completed
form/filled/list/edit states in three themes at 1280/390px. Main Player and
Review-pane icons have different Source hosts and are measured independently.
The pane's disabled list button retains Source opacity. Native CRUD/back/new/
retry, exact UTF-8, same Run reload and foreign-Session isolation pass; all
eight trusted native completion-navigation cases pass on the final snapshot.
Every intended list/edit entry is visibly verified before capture. Small raw
image differences remain; no full Original-UI row is closed.

Invalid invocations remain separate: the first parser schema smoke omitted
CI=true and attempted headed Chromium without an X server; its normal CI=true
repetition passes. The first PostgreSQL browser invocation reused an own
integration database retaining a system_check role and therefore offered the
correct protected entry instead of the expected anonymous entry. A distinct
empty own database passes the unchanged complete gate. The nonexistent Memory
NPM alias is an invocation error; direct execution of the unchanged built test
passes. The first toolbar assumption measured the main Player icons as though
they were the pane icons; direct Source comparison rejects it before correction.
None of those records is a product regression or passing acceptance evidence.

GitHub main/PR/branch access, the published private environment and own protected
Cloud testing are established. Product network permission is still turn-scoped;
no filesystem/domain rights, VPN or sandbox/policy settings are expanded.
Entire CLI and real Cloud trace capture/export remain unavailable. No new
checkpoint/trailer is invented or attached from an old local session; the
historical remote checkpoint remains separate. Private PPTX/tryout data are
not transferred. Fresh complete publication CI is required before normal
integration; deployment, physical camera/window and the eight complete UI rows
remain distinct open requirements.

### PR #2 integration and host navigation correction (2026-10-09)

Push `37920261273` and PR `37920266922` both complete all 37 jobs successfully
on exact head `eccdf8fc`. PR #2 is ordinarily merged as `537bd0cb`; there is
no force-push, history rewrite or branch deletion. Fresh main workflow
`37926836911` has a real failure in job `113807688442`, `ui-open-run-sync`:
the unchanged 15-second assertion does not observe `CY-Unit.Sample-102` after
the native Original host-forward click. Its full actual 2.48-MB log is retained
as `ci-main-open-run-sync-113807688442.log`. This is not replaced by the earlier
green PR evidence. A complete isolated `git archive` of exact `537bd0cb`, with
its own modules, assets, database and ports, independently passes the unchanged
full `smoke:ui:open-run-sync:built` gate in `goal-537bd0cb-open-sync.log`.
That repetition alone does not fix or explain the intermittent failure.
This main workflow then completes all 37 jobs: 36 succeed and this navigation
job fails. Complete run/jobs metadata is retained as
`ci-main-537bd0cb-completed.json` before the next publication; no job is cancelled.

The actual host action nevertheless has a deterministic contradictory decision:
the Player's `canGoNextUnit`/`canGoPreviousUnit` uses the completed local response,
but the host action independently rejects the older raw completeness reasons.
Six actual-code regressions fail before correction. Both host actions now share
the Player's existing effective decision; the existing foreground save still
settles the answer before the real API enforces all booklet restrictions.
Fourteen new checks cover complete, incomplete, timed-block and unavailable
actions in both directions. Typecheck, production build and 596 regular checks
pass; all 61 compatibility checks pass. Initial bundle remains 469.98 kB under
the unchanged 470-kB limit. No existing browser assertion or deadline changes.

The new `smoke-participant-navigation-completeness.mjs` uses only own synthetic
content and protected SQLite. A real current-state read can be held without
changing its payload or credentials. The exact old main assets reproduce the
missing navigation after completed native input with trusted observers in
`goal-navigation-native-trusted-baseline.log`.
The corrected assets pass all eight forward/backward cases across both interfaces
and 1280/390px in `goal-navigation-native-ready.log`. Passive input/click observers
prove `isTrusted=true`; exact Session/Run and response bytes, reload restoration,
401 denial for a foreign own Session/Run and its unchanged state are asserted.
This fixture is added after the existing unchanged Verona smoke in the Quick CI
gate. Its earlier helper mistakes (reading an omitted snapshot field, an
unauthored hidden navigation control, removing an active route, and reading a
Player before its start-command status) are retained separately as invalid
fixture evidence, not application regressions or passing gates. The final helper
keeps its route alive, waits for the real answered status and retains all exact
answer assertions and deadlines. The complete unchanged protected SQLite
operator browser gate also passes in `goal-navigation-full-sqlite.log`, through
Attachments, exact 47/47 deletion logs and clean CLI shutdown. This is a fresh
corrected-tree Cloud pass. Publication CI remains a separate requirement before
integration. The next head's complete Push/PR workflows must finish before
another publication; the old main workflow has already completed with its
negative result preserved.

The already granted product network permission remains turn-scoped, with no
additional filesystem/domain rights or policy changes. Entire Cloud trace
capture/export and a working Entire CLI remain unavailable. No new checkpoint
or trailer is invented; the historical remote checkpoint ref remains separate
from these real GitHub commits. No full Original-UI row, physical camera/window,
deployment or production gate is closed by this correction.

### Latest selected-Run deletion correction (2026-10-09)

`4ba6bc37908e7fab485ccfe4c1cbffb347be601a` is committed and pushed on the
existing parity branch, with PR #2 updated for its final implementation.
Push workflow `37913363611` and PR workflow `37913369219` both have an actual
`local-demo` failure: jobs `113763554445` and `113763573499` time out at the
unchanged 15-second `Group Results Deleted` assertion after successful DELETE.
Full actual logs are retained outside the checkout as
`ci-4ba6-local-demo-113763554445.log` and
`ci-4ba6-local-demo-pr-113763573499.log`. The unchanged own SQLite reproduction
also fails in `goal-4ba6-local-demo.log`; this is a product regression, not an
invalid helper or a passing repetition. Both workflows subsequently finish all
37 jobs: 36 succeed and this one fails in each. Their complete results remain
negative baseline evidence. At that earlier checkpoint main had not yet been
changed by PR #2; the later verified integration is recorded above.

The new exact selected-Run read correctly rejects the deleted Run with 404,
but the deletion action had left that obsolete selection in place. Single and
bulk deletion now clear its Run ID, current Unit and draft only when confirmed
deleted Run/affected Session IDs and the original Workspace/Session/Run context
all match. Other selections retain their byte-exact answers. Session, Booklet
and group context remain available. The normal unknown/foreign-Run 404 boundary
and explicit older-Run reads remain unchanged; no fallback to another Run or
relaxed error classification is added.

The actual-code regression fails before the fix in
`goal-deleted-selection-before.log`. All 32 runtime checks pass afterwards,
including eleven deletion/retention/bulk cases. Typecheck, production build,
582 regular checks and 61 compatibility checks pass under the unchanged
470-kB limit (469.98 kB actual initial bundle). The complete unchanged owned
`local-demo` gate passes in `goal-deleted-selection-local-demo.log` with its
original assertion and timeout. Fresh full protected PostgreSQL and SQLite
browser suites both pass on separate owned databases and the same fixed assets,
through Attachments, exact 47/47 deletion logs and complete CLI shutdown. Their
logs are `goal-deleted-selection-full-pg.log` and
`goal-deleted-selection-full-sqlite.log`; all four scoped monitor probes in
each suite return HTTP 200 on their first trusted native activation. These
are new corrected-tree Cloud results, distinct from the previous publication.
The same corrected fixed assets also pass a fresh protected Original Starter
suite (48 geometry/state fixtures, 18 exact current-Source toast comparisons,
authorized empty export and saved-answer retention) and all 24 protected
Original Review states against the current rendered Source metrics. Native
CRUD/back/retry, same-Run reload, exact UTF-8, foreign-Session rejection and
the Rewrite switch remain checked. Actual logs are
`goal-deleted-selection-starter.log` and `goal-deleted-selection-review.log`.
The follow-up publication waits until both `4ba6bc37` workflows finish, preserving
every job result instead of cancelling them. Verify fresh corrected-head CI
independently before normal integration into main.

A supplementary unchanged `ci:browser:quick` run uses a complete archived
`6153568e` tree with its own dependencies, build, databases and ports. It fails
in `smoke-original-participant-login.mjs:74` at the unchanged 30-second native
`Anmeldename` fill. The actual log is `goal-6153568e-quick.log`. An independent
owned-server/browser diagnosis retains HTTP 200 and the rendered login through
`127.0.0.1`, versus HTTP 403 with body `Domain forbidden` through the fixture's
`testcenter-proof.insecure` hostname, despite its loopback resolver mapping.
Actual evidence is `goal-insecure-loopback-reference.log` and its owned PNGs.
This is a precise VM-domain restriction, distinct from the granted per-turn
socket permission and from an application regression. No domain, proxy, TLS,
authorization or assertion bypass was added. The suite remains unchanged and
the fresh corrected-head GitHub `ui-quick` job remains mandatory; the older
Push `ui-quick` already passed. This Cloud repetition is a failure, not a pass.

An independent read-only Review capture probe also passed 24 protected states
on `4ba6bc37`. Before/after screenshot measurements show zero document/header
scroll and normal title/logo rectangles. Direct decoding of all 24 actual PNGs
against the settled `source-label-review-reference/` captures finds identical
header content pixels; differences occupy only its last two shadow rows. This
probe does not reproduce the earlier sporadic raster clipping. Retain those
earlier observations separately; neither geometry nor a displayed thumbnail
proves a paint defect. Actual evidence is `goal-review-header-probe.log`,
`goal-review-header-probe/` and `goal-review-header-pixels.json`. Full-page
differences and all eight acceptance rows remain open. No image, CSS, Source,
vendor or browser patch was made for this read-only comparison.

### Latest runtime lifetime validation (2026-10-09)

The owned pass-through whole-flow PostgreSQL run
`goal-starter-routes-fixed.log` failed at
`study-monitor-booklet-detail-prepare-runtime`: a late old-Session response
overwrote the newly prepared group. Its separate SQLite counterpart passed
Attachments, exact 47/47 deletion logs and shutdown in
`goal-starter-routes-fixed-sqlite.log`. Both used the pre-correction tree;
neither is relabelled as proof of the new production runtime changes.

Twenty-one actual runtime-host/read/presentation regressions fail before and
pass after the new context guard, captured paths and explicit selected-Run
query/presentation. They cover changed workspace, authorization, Session, Run
and form context, late missing-state failures and an older Run with distinct
byte-exact synthetic answers. The guard compares context in memory without
logging or persisting credentials or answers. Actual retained logs are
`goal-runtime-context-before-corrected.log` and `goal-runtime-context-after.log`.
An initial test-loader extraction error executed no valid behavioral proof
and remains separately retained as `goal-runtime-context-before.log`.

A native owned HTTP disconnect executes the production shutdown closure and
reproduces repository shutdown before its asynchronous handler finishes in
`goal-aborted-handler-before.log`. The API now drains tracked HTTP handlers
before closing storage. All three regressions pass in
`goal-aborted-handler-after.log`, including rejection and newly registered work
during draining. CLI shutdown deadlines and security boundaries are unchanged.
Independent SSE/background lifetimes are not claimed as separately proven.

The combined tree passes typecheck, production build, 571 regular checks and
61 compatibility checks. The 469.98-kB initial bundle remains under the
unchanged 470-kB limit. Actual logs use the `goal-runtime-lifetime-` prefix.
Fresh complete protected PostgreSQL and SQLite suites both pass using the same
fixed assets and separate owned databases, through Attachments, exact 47/47
deletion logs and clean CLI shutdown. Both pass the previously failing runtime
preparation; all four scoped monitor probes observe HTTP 200 on their first
trusted native activation without recorded browser errors. Memory, File and
SQLite API integration each pass all 164 checks without skips. The 120 native error-list/
restore cycles completed with 240 successful HTTP-200 actions, API exit 0 and
no recurrence of the earlier pool-after-end error. Logs are
`goal-runtime-lifetime-final-pg.log`,
`goal-runtime-lifetime-final-sqlite.log`, `goal-runtime-lifetime-native-120.log`.
Do not rebuild or clean assets while any of these fixtures still uses them.
No new commit, push, CI result, full Original-UI row or production acceptance
is inferred from these local/Cloud checks.

A fresh supplemental Starter invocation omitted the documented CI headless
profile and attempted a headed browser without an X server. It failed before
any page rendering; `goal-runtime-lifetime-starter.log` retains the actual
`Missing X server or $DISPLAY` diagnostic. This invocation error is not an
application regression or physical-browser evidence. With `CI=true`, the
completed gate passes all 48 geometry/state cases and 18 exact current Source
toast comparisons in `goal-runtime-lifetime-starter-corrected.log`. The same
fixed-asset protected Review gate passes all 24 states, native CRUD/back/retry,
same-Run reload, exact UTF-8 and foreign-Session denial in
`goal-runtime-lifetime-review.log`. These are Headless Cloud checks; all eight
complete Original-UI rows and real hardware/production acceptance remain open.

### Latest deletion-fixture validation (2026-10-09)

`07fcbf6f` is published on the existing parity branch with follow-up PR #2.
Its Push PostgreSQL job `113705893956` failed `45 !== 44` despite snapshots
being taken after preparation. Full actual evidence is retained as
`/workspace/work/testcenter-continuation/ci-07fcb-postgres-ui-113705893956.log`.
All four scope probes observe trusted native activation and HTTP 200. A later
monitor read completes between snapshot and deletion; the extra row's body is
not in the log. Do not claim its exact key is established from this CI record.

Seventeen new/existing targeted service checks pass across all four stores.
They separately prove that expiry after completed preparation adds exactly one
`TESTLETS_TIMELEFT` entry and invalidates that exact snapshot; pausing the owned
Run keeps all snapshot data unchanged across a later read beyond the deadline.
The existing active-Run deletion case is retained. The browser fixture issues
its hold through the visible native authorized Pause action after timing/monitor
acceptance, leaving the foreign retained group untouched. No production timer,
monitor schedule, assertion or timeout is changed.

The first new-helper whole run returned HTTP 200 from Pause, then failed at an
incorrect `response.testRun` lookup. The contract is `response.command.testRun`;
the same exact Session/Run/status assertions now read that wrapper. Its retained
negative log is `goal-starter-held-postgres-browser.log`, not a passing result.
The corrected complete run on a new empty owned PostgreSQL database failed
earlier at `group-monitor-booklet-error-copy-restore`, before reaching the hold.
Its retained log is `goal-starter-held-postgres-browser-corrected.log`; two
trusted native clicks reached an enabled button, but no matching request was
observed. This reproduces the earlier main failure and is not a passing result.
A focused owned PostgreSQL fixture passed twelve native error-list/restore
cycles after real creation, required password change and sign-in of a fresh
monitor. Its log is `goal-monitor-restore-diagnostic-fresh-run.log`; these
cycles do not establish the whole-flow failure's cause. A further full run
with passive browser-error reporting uses its own empty `goal_starter_restore_probe`
database and unchanged fixed assets; its log is `goal-starter-restore-probe.log`.
It passed through Attachments, the native authorized hold, exact 47/47 deletion
logs and shutdown, with the original interception removal still present.

Extended native probes reproduced an unanswered read at interception removal
after 25 and 29 cycles (`goal-monitor-restore-diagnostic-120.log` and
`goal-monitor-restore-diagnostic-route-lifecycle.log`). The public
`unrouteAll({ behavior: "wait" })` alternative also failed after 29 cycles in
`goal-monitor-restore-diagnostic-unroute-wait.log`. Tracking records the next
read between removal entry and return, after mock fulfillment. Later refreshes
wait behind it. The fixture now retains its owned interception and forwards
all post-presentation requests unchanged to the protected API until browser
teardown. This variant passed 120 native cycles in
`goal-monitor-restore-diagnostic-passthrough.log`. The earlier CI logs do not
contain callback-lifetime detail, so do not claim that their exact internal race
was observed. Assertions, native inputs and deadlines remain unchanged.

The pre-correction 120-cycle probe's API teardown also logged an aborted read
failing with `Cannot use a pool after calling end on the pool`; exit code 0
does not make that clean-shutdown evidence. The separate handler/storage
correction is recorded above, alongside the subsequent whole-flow PostgreSQL
context failure and passing SQLite run.
The unrelated first unit wrapper used
an absent `npm test` alias and executed no tests. The actual documented
`test:unit:built` and `test:compatibility:built` commands subsequently passed;
that invocation error is neither a product regression nor acceptance evidence.

Earlier dated evidence below remains valid for its exact tree. New changes
require their own publication CI; do not erase failed attempts with a repetition.

### Current continuation and integration evidence (2026-10-09)

The merged main head is `2b22dbfe`. Its tree
`ec23c8c480d34d04eb56096161a8845341ef48c4` equals the verified `d6f5c570`
parity tree exactly. The preceding PR/Push workflows each passed all 37 jobs.
Main workflow `37862248931` initially passed 36 jobs and failed PostgreSQL
browser job `113600470480` at
`group-monitor-booklet-error-copy-restore did not request the scoped monitor runs.`
This is a different observation from the earlier 45/44 deletion snapshot.
The complete actual failing log is retained outside the checkout as
`/workspace/work/testcenter-continuation/ci-main-2b22-postgres-ui-113600470480.log`.
No screenshot artifact was published by that failed job.

A complete `git archive` of exact `2b22dbfe` was independently compiled and
passed the unchanged protected PostgreSQL browser suite, including Attachments,
44/44 result-deletion logs and clean shutdown. The run used its own database,
compiler and fixed assets under `goal-main-2b22-tree`; its passing log is
`/workspace/work/testcenter-continuation/goal-main-2b22-postgres-browser-corrected.log`.
An initial invocation incorrectly pointed the frontend-root option at the
browser directory and failed before application startup; that retained attempt
is invalid acceptance evidence, not a product regression. Nothing was reset or
copied back into the implementation checkout.

One targeted retry of the failed main job completed successfully as
`113697307205` on 2026-10-09. Workflow `37862248931`, attempt 2, is now
completed/success with all 37 jobs. Neither that retry nor the passing local
baseline proves the intermittent first failure's cause or a fix. The next
browser harness adds passive native-click and request-readiness diagnostics to
the existing monitor scope helper. It retains the same native activation, two
attempts, 30-second response deadline, status assertion and exact failure.
Diagnostics contain owned scope values, never credentials or answer bodies.

Upstream `ee2ab9ab` adds one e2e fallback case and its sample setup; it changes
no application frontend source. The frontend Git tree is unchanged at
`64032f00186dc287c9de3ffd63cc235fe1c9a5da`. An eighth owned XML case covers
an initially selected Unit without a short label when only `UNIT_LABEL_SHORT`
is configured. The real facade retains the full header/toolbar label, default
index navigation and exact saved state. Fresh typecheck, production build,
526 normal checks and 61 compatibility checks pass. The bundle remains
469.98 kB under the unchanged 470-kB limit. All 32 native label cases in both
interfaces at 1280/390px pass in the complete new protected PostgreSQL browser
run, through Attachments, exact 44/44 deletion snapshots and clean shutdown.
All four instrumented monitor phases observed trusted native activation and
HTTP 200 on the first attempt; the restore phase retained the intended owned
workspace and `all` profile. Its actual log is
`/workspace/work/testcenter-continuation/goal-ee2-postgres-browser.log`.
This passing instrumented run does not explain the earlier intermittent failure.

Fresh current Source Review references and the protected owned SQLite Rewrite
comparison also pass all 24 form/filled/list/edit states across the three themes
and 1280/390px. Each list/edit capture first verifies the intended exact comment.
The same labels/comment, completed fonts and settled drawers are required.
Toolbar, form, list, buttons, primary/on-primary colors and header geometry match;
native add/edit/save/delete/back, failed-save retry, exact UTF-8 persistence and
foreign Session rejection remain checked. Actual screenshots under
`goal-source-ee2-review` and `goal-ee2-review` still show raster differences,
including header clipping despite equal measured rectangles. These component
checks do not establish full pixel identity or close a complete Original-UI row.
New work is locally/Cloud verified at this checkpoint; publication and fresh CI
for its forthcoming commit must be checked separately.

The clean current Source checkout was independently rebuilt. Its unmodified
camera diagnostic reproduces the same twelve initial/re-entry failures in all
three themes and both widths: `nativeElement` is unavailable, no video stream
starts, and no attachment metadata or unknown API request occurs. The diagnostic
exits 2, writes actual negative evidence under `goal-source-ee2-camera`, and is
not a passing capture gate. All eight full-page Original-UI rows, physical
camera/OS visibility, deployment and production acceptance remain open.

The private published environment and GitHub access remain available. This new
turn initially restored restricted sockets; the already authorized regular
product network grant was requested and granted for this turn only, with no
additional filesystem rights. Owned IPv4 listen/connect and child-process pipes
then passed. A fresh protected owned SQLite API passed readiness/configuration,
unauthenticated workspace rejection (401) and clean shutdown. VM package-manager
rules and exactly the three previously approved browser-download domains remain
unchanged; a runtime grant does not persist permissions into future turns.

Real Entire Cloud trace capture remains unavailable. The CLI/runtime is absent;
no new checkpoint or fabricated trailer is created. The historic remote
`refs/entire/checkpoints/60/01M4D17VRMWJ3E43Z32G5RBA60` remains
`fbd52e6fc67a5b9285bc1a5de1c488bf512fec38`. An old local trace is not a Cloud
trace. Private tryout data and the local migration PPTX are neither inspected,
changed nor uploaded in this continuation.

The dated sections below retain earlier evidence and failures. Their pending CI
or publication statements describe those earlier checkpoints, not current main.

### Historical integration gate (2026-10-08)

Seven further commits are published through `e9885ae5`, not merely local.
Its complete isolated Git archive passed typecheck, production build, all 522
core/frontend and 61 compatibility checks, and the full unchanged protected
SQLite browser suite, including Attachments, result deletion and clean shutdown.
Its Push workflow `37848841718` subsequently completed successfully with all
37 jobs verified, including the full PostgreSQL browser gate. The separate PR
failure below remains a real negative observation, not erased by that pass.
The current read-only public GitHub resource tool also supports workflow-run
GETs and `jobs?per_page=100`, so both complete 37-job listings can be checked;
the older first-page-only limitation below is historical. No VM domain or
filesystem permission was expanded.

PR workflow `37848848880` has a retained failing PostgreSQL browser job
`113556452054`: `assertGroupDeletionMatchesSnapshot` compares 45 removed logs
with a pre-preparation inventory of 44. The complete actual log is retained
outside the checkout. It shows monitor reads finishing after the snapshot;
it does not include the extra log row's body. A deterministic service regression
on Memory, File, SQLite and PostgreSQL proves that a real monitor read can start
a timed block and append `TESTLETS_TIMELEFT`, making that earlier snapshot stale
without a participant answer write. The corrected smoke captures both groups
after native preparation/exports and the existing not-busy condition. Every
exact deletion count, Run ID, retained answer/review/log comparison and separate
removal check remains mandatory; no timeout or assertion is relaxed.

The correction has passing typecheck/build, 525 normal checks, 61 compatibility
checks, nine targeted snapshot checks including PostgreSQL, and twelve existing
presence/deletion boundary checks across all four stores. Its full protected
PostgreSQL browser run also passed on separate fixed assets and a new owned
database, through Attachments, native result deletion and clean shutdown. That
run's initial and deletion snapshots both contained 44 logs: it is a passing
corrected whole flow, not a replay that proves the CI's extra log was a timer
log. The deterministic regressions prove the stale-snapshot class separately.
Fresh publication CI is still pending for the correction.
The initial bundle remains 469.98 kB under the unchanged 470 kB error limit.
The Source camera blocker and all eight complete Original-UI rows remain open.
Entire runtime capture remains unavailable; do not invent a checkpoint trailer
for the correction or the later merge, or reuse an old local session trace.

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
