# Native participant Session boundary

The participant boundary implements the Original paths `PUT /session/login`,
`PUT /session/person`, `GET|PUT|DELETE /session`, `POST /session/challenge` and
`POST /session/person/challenge`. It uses `AuthToken` and the Original participant
AccessSet shape. Canonical RPC authentication remains available. Native admin and
operational AccessSets, `/session/admin`, numeric administration and
production native-transport adoption are still outstanding. Unit transport is
implemented in the candidate described below. This does not establish
paired visual parity.

The Source21 Login receipt and Source16 protected ALTCHA receipt are checked
against their pinned hashes in `scripts/original-session.test.mjs`. Tests upload
actual Player, Unit and Booklet XML; authentication does not activate a release
or create a Test. Current physical Booklet labels and current code buckets feed
the claims. ASCII case collisions retain the last whole authored bucket, then
append common Booklets in Source order. Current grants stay separate from already
owned Tests. Immediate responses use current Login group labels; person reads use
the exact credential-stage group snapshot and first stored person suffix.

Test `running` reflects known first-opening history, including paused/completed
Tests. Missing or ambiguous historical identities fail explicitly. The four
adapters expose a metadata-only Test projection; SQL does not select responses
or timers. Active negative decoder controls prove that reading the complete Test
would decode private response data while the AccessSet read does not.

The browser receives Source's five SHA-256 challenge fields. Its opaque salt
contains an AES-256-GCM authenticated encrypted credential ticket rather than
plaintext credentials. The ticket has a bounded lifetime, server-configured work,
current/previous key support and a durable one-use claim. Person work is bound to
the exact Login token; a peer token cannot consume it. Challenge limits follow
the existing deployment JSON body budget. Responses use `private, no-store`.
Configured participant/person protection also covers Source's empty-password and
`"0"` bypass cases. Source's observed replay and cross-Login acceptance are
deliberately not copied; the Rewrite retains its stronger security requirements.

The mandatory suite covers Memory, File, SQLite and PostgreSQL, real HTTP,
restart/durable replay, concurrent claims, expiry, key rotation, scope/type
denials, group-label imports, empty view settings, review grants and exact
Source-shaped AccessSets. It is included in complete unit/PostgreSQL acceptance
and both relevant focused service suites.

`npm run smoke:ui:original-session:built` uses an owned SQLite API, real admin
uploads and Chromium WebCrypto to solve work and verify typed Login/person
rotation, raw codes, replay denial, reload and empty 205 logout. It also creates an unopened native Test and signs in through the actual protected
Original-style UI: single-Booklet auto-entry opens that same Test and starts its
controller after a genuine Verona 6.0 fixture handshake. Native Session HTTP
adoption by production UI remains open. It runs after
the existing protected UI smoke in the mandatory quick proof-of-work CI cell;
the earlier smoke and all complete acceptance gates remain required.


## Unopened native Test creation (2026-10-26)

`PUT /test` accepts a genuine Original person `AuthToken`. Login, group and admin
capabilities cannot create a Test. Authentication precedes JSON parsing; the
operator boundary does not substitute for the participant capability. Success is
HTTP 201 with raw decimal bytes and `text/html; charset=UTF-8`, under
`private, no-store`. The decimal identity is separate from private Run UUIDs and
remains lossless through the signed 64-bit range.

[Unchanged production Source33](https://github.com/jurei733/testcenter-rewrite/actions/runs/40241983022)
qualifies 33 groups and 188 HTTP observations on pinned Original `eedae41840cbe90e5547c0211da818bdf620f5aa`,
with production Apache/PHP, actual ALTCHA and admin XSD uploads, TestMode off and
no SQL Test seeds or Source patches. The 16-file evidence fixture retains all
28 prior groups/53 assertion lines and checks its pinned hashes in mandatory CI.

The raw requested name is compared first using the qualified German comparison.
An owned raw-name hit returns its stable number even after physical-file deletion.
A raw miss requires the current physical Booklet, then applies Source's ASCII
whitespace/preset normalization, including duplicate values in first-key order.
Unassigned physical Booklets are allowed. Repeated/case-equivalent requests reuse
one Test; normalized reservation attempts may consume number gaps. The first raw
physical label and first name remain unchanged after replacement; a locked Test
returns 423 with its first label. Numeric gaps are not a public contiguous count.

Creation commits an unopened Run, number and first content binding atomically.
It creates no controller entry, current Unit, timer, response, TestLog or group
result row. Review-mode creation is allowed. Existing assignment claims remain
unchanged and report running=false. Subsequent canonical controller entry handles
the created Run under the same parent/Run writer fence, initializing its controller,
timer and initial artifacts once, including simultaneous entry requests.

SQLite migration 73 and PostgreSQL migration 67 add scoped unique number mappings,
a durable global decimal counter and cascading Run/person foreign keys. Memory
and File use equivalent scoped collections; File publishes its cache only after
its durable write. Existing Run writes cannot overwrite the separate identity.
Native group, generic Run and whole-workspace deletion remove mappings while
retaining the counter.
Legacy migrations create empty mappings and never guess historical numeric IDs.

Mandatory `scripts/original-test-creation.test.mjs` runs in complete unit,
PostgreSQL and focused Original-results gates. It covers actual legacy upgrade
and late DDL rollback, late File/SQL creation rollback, durable retries, role/scope
denials, raw HTTP, independent PostgreSQL writers, concurrent controller entry
and mapping cleanup. The following slice adds Test reads/state/resource transport.
The native Unit candidate below extends these paths; report HTTP/UI remains open. This does not
establish complete native transport or paired visual parity.

## Native Test reads, saved state and group resources (2026-10-26)

[Unchanged production Source37](https://github.com/jurei733/testcenter-rewrite/actions/runs/40249046818)
qualifies 37 groups and 207 actual HTTP observations, retaining all 33 previous
groups and 65 assertion lines. Its 16-file fixture pins the probe, production
image/PHP receipt and 31 Original source hashes. TestMode remains off; actual
ALTCHA and admin uploads create the fixtures without SQL Test seeds or patches.

`GET /test/:number` requires the owning person and returns Source's seven fields:
mode, laststate, xml, resources, firstStart, workspaceId, presetBookletStates.
It opens once under the parent/Run writer fence, without entering a Unit,
starting a controller/timer or writing logs/state. Current physical Booklet XML
and Unit resource dependencies are used; first stored Test identity stays fixed.
Workspace numbers use a separate durable decimal mapping and lossless int64
wire formatting. A SQL foreign-number lookup rejects before decoding private
Test state, with an owned decoder-failure control. Unknown historical saved state
returns 409 instead of inventing a history. Locked reads return 423.

`PATCH /test/:number/state` preserves typed scalar/array values and PHP's encoded
object strings. Clocks reset for each packet: the greatest positive timestamp
wins within one packet, equal timestamps keep the first entry, and a lower clock
in a later packet can replace a previous value. Every input entry is logged,
including ignored duplicates/zero clocks. Null content fails before publication.
Native state remains writable in review mode. State, server clock and logs commit
together; generic stale snapshots cannot replace independently saved native state.
Native log identity collisions fail atomically. Existing progress-delivery retry
semantics keep their separate stable-ID upsert behavior.

`GET /file/:groupToken/ws_:workspaceNumber/:path` accepts the current group
capability for Resource files only. It preserves current physical bytes, including
binary data, and Source MIME, `private` cache and `X-Source: backend` headers.
Person/Login tokens, foreign or inactive scopes, non-Resource paths and traversal
are rejected. Logs/metrics replace capability-bearing paths with fixed labels,
including encoded invalid route spellings. Replaced files invalidate the bounded
catalog cache; direct resource reads avoid rebuilding the XML catalog.

SQLite 74/PostgreSQL 68 add nullable saved native state and workspace mappings.
Legacy upgrades create empty mappings/state provenance. New workspace allocation
is atomic with creation; deletion retires mappings while keeping counters.
Mandatory existing gates cover real migration/open/state rollback, binary HTTP,
restarts, foreign decoder fences and independent concurrent PostgreSQL writers.
The existing Chromium Session smoke keeps all eight previous markers and adds
native Test read/state and group-resource markers. Production frontend adoption,
mixed native Unit adoption, ZIP resource dependency edge cases, numeric administration,
report HTTP/UI and paired broad visuals remain separate open work.

## Native Unit transport candidate (2026-10-26)

[Unchanged production Source41](https://github.com/jurei733/testcenter-rewrite/actions/runs/40256816222)
passes 41 groups and 231 HTTP observations, with all 37 previous groups and
74 assertion lines retained. Its 16-file fixture pins 34 Original source hashes,
the exact probe, production Apache/PHP receipt and eight raw report files.
Actual ALTCHA/admin uploads create every fixture; TestMode stays off, with no SQL
Test seeds or Source patches.

`GET /test/:number/unit/:physicalId[/alias/:alias]` returns the five Source fields:
state, dataParts, unitResponseType, definition and definitionType. Definition and
normalized Player identity come from current physical workspace files. An absent
saved Unit returns empty objects and an empty response type. Reading does not
create a Unit, open a Test, start a controller or modify Test clocks. PHP-falsy
alias `0` falls back to the physical Unit name. Test ownership is checked from
indexed metadata; SQL Unit access does not decode unrelated canonical responses,
with positive owned and foreign decoder controls.

`PATCH /test/:number/unit/:name/state` accepts both the legacy array and the
`{newState, originalUnitId}` body. Unlike Test state, Unit field clocks persist
across packets; equal/stale/zero updates do not replace an accepted value. Every
submitted entry is logged. The first stored Unit name and original ID survive
case-equivalent writes. Units outside current Booklet assignments are allowed.
State, clocks and logs publish atomically.

`PUT /test/:number/unit/:name/response` requires an initialized Unit and merges
each data part with its own strictly increasing clock and durable response type.
A new part can have clock zero; an omitted type defaults to `unknown`. A stale
part cannot change its content/type or suppress a new sibling part. The legacy
GET exposes one response type from its final stored part, matching the qualified
Source case; Source's SQL query itself has no general ordering guarantee.
`PUT /test/:number/unit/:name/log` accepts legacy arrays and `{logEntries}`.
Log-only writes create no Unit. Unit GET/state/response remain independent of
Test locks and execution-mode response-saving policy, as Source41 demonstrates.
JSON reads and empty HTML write responses use private/no-store caching.

SQLite75/PG69 persist a scoped Unit row separately from the canonical Run. Unit
packets avoid decoding/replacing the complete Test payload. Parent/Run locks
serialize first creation and German case-equivalent aliases with deletion and
canonical writes. File cache publication follows durable commit. Result-group
inventory reads only Unit identities, includes actual saved native Units and
does not decode their private JSON. Generic Run, group and workspace deletion
retire Unit rows; old schemas receive no fabricated Unit clocks.

Canonical legacy data without native field-clock provenance returns explicit409.
A later canonical response change marks an existing native row's history unknown,
preserving its first identity; stale native values are not returned as current.
Valid Unit fields/part strings, Unicode, original SQL string lengths and bounded
payloads are validated before publication. Full mixed-transport adoption and
native result/report projection remain open, together with Test-log HTTP,
numeric administration, ZIP dependency edges and the eight broad visual rows.
This candidate extends existing mandatory service/unit/PostgreSQL and protected
browser inventories; full candidate qualification remains required.


### Source-paired native Testlog candidate (2026-10-28; native Linux qualified)

The candidate adds metadata-owned atomic `appendOriginalTestLogs` to all four stores and protected literal `PUT /test/:id/log`. Person and metadata-only ownership checks precede body decoding; the current numeric mapping and immutable parent scope are checked again inside the append transaction. Whole batches are validated before writes. Existing artifact IDs cannot be overwritten, including an own ID named `__proto__`. Empty batches only validate ownership; repeated payloads receive distinct IDs. No Run, Unit, controller, revision, response, presence or timer is rewritten.

The production Source oracle [40604121346](https://github.com/jurei733/testcenter-rewrite/actions/runs/40604121346) passed 48 groups, preserving all 41 prior groups and 80 literal assertions. Unmodified pinned Original runs under Apache/PHP 8.3.36 with genuine ALTCHA and protected uploads, without SQL seeds or test mode. Its 284 HTTP observations and 36 Source file hashes establish defaults, whole-batch rejection, duplicates, no-ops, ownership-before-body ordering and lock-independent append. Artifact 12780616116 has 29,865 bytes and SHA256 `3deec3bb689d89f1c337529cabb7318b409864aac52b0b9d3db690039c4665a6`. Raw protected JSON/CSV reports establish already PHP-encoded content, including numeric-zero falsiness. Malformed nonempty JSON returns HTTP500 with generic `Internal error.`; a zero-byte body returns HTTP400.

Three cumulative production oracles extend this evidence without removing prior groups or assertions. Each retains the same 36 pinned Source hashes and immutable raw protected reports:

- [Source51 / 40618525961](https://github.com/jurei733/testcenter-rewrite/actions/runs/40618525961): NUL/Unicode content, strict field types, signed floating zero and exact raw JSON numbers. Artifact 12785833669: 35,196 bytes, SHA256 `4241fb86af0b06aba5201968414238505268497890612425cb69c0a5c8a37f4a`.
- [Source52 / 40620574561](https://github.com/jurei733/testcenter-rewrite/actions/runs/40620574561): full signed int64 client timestamps, PDO truncation of NUL-containing keys, numeric property order, duplicate property replacement, JSON depth boundaries and rejection of nonfinite decoded numbers. Artifact 12787546117: 40,935 bytes, SHA256 `75103da43efe5964d44823ef4dd71cfae693b8aaf57299868352c4f7c3f3e15d`.
- [Source53 / 40624110311](https://github.com/jurei733/testcenter-rewrite/actions/runs/40624110311): 177 actual PHP float encodings, comprising specified edge values and deterministic finite IEEE-754 samples, submitted as raw HTTP JSON. Artifact 12789120697: 65,859 bytes, SHA256 `bd4148ca1d3027d5fb2c81719d16dfed131338dad96228a4035bcb3632a55c00`.

The native-only decoder retains raw int/float distinctions and object property order after strict UTF-8/JSON validation and the existing request-byte bound. It rejects invalid Unicode, excessive depth and unsupported native values. Content is encoded once using the observed PHP dialect. Exact wide client clocks survive Memory/File reopening, SQL int64 reads and generic log saves using validated decimal metadata; native report JSON and CSV keep their original digits. Native log IDs are distinguished from state/presence events so a caller-controlled key or extreme client timestamp cannot become controller state. Optional null/missing content becomes an encoded empty string, timestamp zero remains zero, and client CONNECTION logs do not synthesize server-CONNECTION markers. Source-style HTML errors retain escaped messages, an opaque Error-ID, Test-Mode:NO and private no-store caching. Wrong-kind capability denial omits the Source bearer echo, and route logging uses a redacted template.

Local verification passes 217/217 native creation/read/Unit/log cases across Memory, File, SQLite and actual PostgreSQL14.9, with zero skips and owned database/server cleanup. Tests reproduce complete Source51 (14 rows), Source52 (23 rows) and Source53 (200 rows) protected JSON/CSV bytes after durable reopening; actual SQL-backed HTTP tests also submit every 177 float token and the exact int64 boundaries. Generic save/reopen and presence checks protect the distinction between log-only and state events. Fresh core/web builds, complete type checks and locked dependency audit pass; the audit finds zero vulnerabilities. All 12 production-built protected-browser markers pass locally, including genuine WebCrypto-authenticated native Testlog append and unchanged Test/Unit state. All 4,477 unit/frontend tests pass without skips. Local policy checks pass 325 cases with their one explicitly Linux-only case skipped on macOS. The Linux policy inventory passes every 326 case without skips.

Report comparisons establish collection/formatter parity using Source insertion order; the literal native report and lock endpoints and production frontend adoption remain open. The dedicated Linux qualification [40625495030](https://github.com/jurei733/testcenter-rewrite/actions/runs/40625495030) passes all four jobs on wrapper `bd5cc0e99d751833a59bb31f9d83b727d56cac73` (tree `d016ed2af9e1bcb796edabc0baf5da1f997a85fe`), whose sole parent is the backend candidate `fa74b9d5d7b6337dc05832e78ec3cb2d0241bec8` (tree `40fe647838b63c089b27e7dc40a70774a11c5816`). The wrapper only adds its isolated qualification workflow; the complete existing build, policy, audit, artifact provenance and browser modes remain intact. Linux passes 4,477 unit/frontend tests, all 326 policy checks and the complete 2,743-case PostgreSQL integration suite without skips, then the protected PostgreSQL startup smoke. The real headed browser passes its complete proof-of-work flow and all 12 native Original-session markers with owned API shutdown. The run completes in 9:55 (03:13:58–03:23:53 UTC). The subsequent full acceptance [40626699840](https://github.com/jurei733/testcenter-rewrite/actions/runs/40626699840) passes every 89 job on head `897a9e2688039f77e4be44acb9e6f75fb908f1cf`, tree `896e2a0fed1f6abeaf6a7c7acb4d4b9e4063f1c8` and same-tree PR merge `8278812a3b36d593300583a124e5b9b7a0a21217`. Its actual 24 Source tasks match the registry, all 4,477 unit/frontend and 2,743 PostgreSQL cases pass without skips, and independent Starter artifact 12791055088 verifies all 168 pairs/repeats, 18 faults, 504 visible hashes and 1,512 actual white frames. Its SHA256 is `6351263350dbd6612986a11334cadc166563b27b49613ea2bafab3d84035751d` (32,761,571 bytes; 2,461 safe members). The observed job span is 35:23, with 4:45 Fast feedback. Compared with the prior accepted 30:15, elapsed time increases 5:08 while first feedback improves 43 seconds; the final Monitor Detail Review job queues 14:38 and runs 15:53. Expanded tests and hosted timing differences prevent a causal speed claim. No broad functional or visual row closes.


### Source-paired native Test lock candidate (2026-10-28; native Linux qualified)

The corrected production oracle [40626328250](https://github.com/jurei733/testcenter-rewrite/actions/runs/40626328250) passes 57 groups and 545 actual HTTP observations, preserving every Source53 control and the same 36 pinned Original file hashes. Artifact 12790055538 is 74,185 bytes with SHA256 `12798546eeced668acd3e28a69599d08c1a58a11218936b8dc68c90ce597aeff`; independent verification checks all 22 safe archive members, each retained report hash and both exact signed int64 boundaries. All 21 lock vectors are correlated by their physical Test booklet name. The earlier run 40625865211 has valid raw report bytes but a diagnostic row-position attribution error and is superseded by the corrected receipt. Raw protected report bytes remain authoritative for int64 clocks, because Node's parsed receipt clock projections round wide values.

Literal protected `PATCH /test/:id/lock` now checks person/current Test ownership before strict native JSON decoding. Required timestamp extraction precedes the lock write; strict message/integer-clock construction and its log INSERT follow that separately committed write. The actual Source returns 400 without locking for missing/null timestamps, 500 without locking for malformed JSON, and 500 with a durable lock for typed-constructor failures. Missing/null message defaults to an empty raw key, NUL truncates the assembled key at the PDO boundary, repeated locks each append a new raw-key log, and signed int64 client clocks remain exact. Successful responses are empty HTTP200 HTML; known native errors retain Source-style escaped HTML and opaque error identifiers without bearer reflection.

All four stores recheck the live numeric mapping and immutable parent scope inside the lock write. Only the lock flag, server update time and known Original result modification timestamp change. Unrelated Unit/response JSON is not decoded; answers, Unit records, Test state, first opening, revisions, controller state and timers remain intact. Related malformed historical server evidence is rejected rather than invented. No migration or new environment variable is required. Actual SQL INSERT and File log-publication failures prove that the prior lock remains durable after reopening, while retired mappings and foreign scopes cannot lock restored private Runs.

The full Source57 report comparison exposed an existing export defect: native Test-state content was encoded twice. New native state-log identities now retain their PHP-encoded content for report formatting while remaining state events. Log-only identities continue to be excluded from state/presence selection. Existing unmarked historical records keep their previous interpretation. Complete Source57 JSON/CSV bytes, including an opened Test's saved state and both int64 limits, match using the real production entry formatter after all-store reopening; observed Source row order is used for this formatter proof, without claiming the literal report endpoint.

Local native creation/read/Unit/log/lock checks pass 332/332 on actual Memory/File/SQLite/PostgreSQL14.9 without skips, with the owned database and server cleaned up. The complete local unit/frontend run passes 4,562 cases before the final evidence-guard extension; its 14 focused server-gate cases then pass, including all old cases and new exact-request, wrong-field, missing/duplicate receipt, extra failure and backend-exception counterexamples. Fresh core/web compilation and complete type checks pass. The headed protected browser passes all 12 prior markers plus its new lock marker, including retained Unit data and a Source-proven durable lock after a typed-constructor error. Its intentionally exercised HTTP500 must match an explicit response request-ID, method, redacted route/path and status; all other server failures still reject the smoke. The observations are retained, and an actual backend exception cannot be accepted by that receipt.

The dedicated Linux qualification [40629669206](https://github.com/jurei733/testcenter-rewrite/actions/runs/40629669206) passes all four jobs on wrapper `ae8a2640e04be2c1522e12faa28b5587ce3760d3` (tree `e81b3d89ac2001b1dce87537d15d7b86a0fb69e4`), whose sole parent is backend candidate `8e99c0e57027095a174e262a6cde1c4ddb281d4a` (tree `4a22ddfa7512a8936754b9f98a7621858bded913`). The sole wrapper change is its isolated qualification workflow. Every 4,571 unit/frontend test, all 326 policy checks and the complete 2,858-case PostgreSQL integration pass without skips, along with audit0, fresh production build/typechecks and protected startup. The headed browser retains all 12 existing native session markers, adds the lock marker and verifies zero unexpected server failures plus exactly one request-specific expected Source500. The subsequent full acceptance [40630975230](https://github.com/jurei733/testcenter-rewrite/actions/runs/40630975230) passes all 89 jobs on head `e27ca9deb7fce9c3b75c3b613b180abd972478de`, tree `af015cc616a9c55f58994257e789f93ee9efbc1c` and verified same-tree PR merge `c1659a6e98dbcbcacf5183e8f64bcdcebd6e3d04`. All 4,571 unit/frontend and 2,858 PostgreSQL cases pass without skips. All 24 actual Source tasks match the registry; all 13 native session browser markers pass with exactly one request-specific expected Source500 and no unexpected failures. Independent Starter artifact12792163224 (32,741,912 bytes; SHA256 `172e217bf9659033622ea3b833c78e998cf63c74986808e989dc180086e5f165`; 2,461 safe members) verifies all168 pairs/repeats,18 faults,504 visible hashes and1,512 actual white frames at native visible Chromium147.0.7727.15/DPR1. Observed job span is31:55, first feedback5:35 and summed runner time453:25; hosted variation and expanded tests preclude a causal speed claim. Production native broadcast subscriptions, command/acknowledgement transport, literal report/admin adoption and broad visual parity remain open. No broad functional or visual acceptance row closes.


### Production native monitor/command oracle (2026-10-28; adapters remain open)

[Unchanged production Source65 / 40635022432](https://github.com/jurei733/testcenter-rewrite/actions/runs/40635022432) passes all65 groups and612 genuine HTTP observations, retaining every57 prior control. It independently verifies43 pinned Source file hashes, including the actual monitor frontend producer and inherited DAO state projection. Artifact12792503946 has80,472 bytes and SHA256 `23fece5cb5dec1a1f339f22cfb49d86d73485ffedee09e67f516611b03570a49`; all26 safe members and protected report hashes are verified without database files or SQL seeds. The cumulative fixture retains exact command packets and polling-state JSON/CSV plus the probe, composition and workflow. Four dedicated Source-only fixture tests are part of both complete unit and Original-result inventories; they establish evidence, not Rewrite adapter adoption.

The real monitor authenticates as a native uncoded person through genuine login work and receives both Test and `testGroupMonitor` claims. Admin/Login/ordinary participant credentials cannot send monitor commands; foreign people cannot poll or acknowledge another person's Test. `PUT /monitor/command` deduplicates addressed Tests, shares one command ID across them and converts arguments to PHP strings. Its frontend sends seconds (`Date.now()/1000`), explicitly truncated by the backend; this differs from the arbitrary int64 client clocks retained by Testlog. Queue reads are ordered by that supplied second timestamp. GET query parameters are ignored, while JSON-body `lastCommandId` applies a scoped strict timestamp comparison excluding equal-clock commands; an unknown scoped ID produces an empty queue, integer0 means no filter and a string ID returns500. ACK is scoped and idempotent, with exact reasons `OK` and `OK, was already marked as executed`; unaddressed command/Test pairs return404. Delivery, polling and ACK remain possible while the Test is locked.

Actual polling behavior contradicts the intended LOST-to-POLLING transition: the server patch uses clock0, which `State::applyPatch` ignores. Stored CONNECTION remains LOST; every poll still writes another raw `"CONNECTION" : POLLING` log at client timestamp0 and updates the Test's server modification time. Polling itself leaves firstStart untouched. All six final protected report rows, including repeated polling before and after lock, are captured byte-for-byte. Adapters must preserve the observed state/log distinction rather than silently repairing Original.

Two initial fixture defects (XML helper arity and milliseconds supplied to a seconds field) and the subsequently disproved POLLING-state assertion remain separate rejected diagnostic runs. Their observations are not full acceptance. The corrected oracle retains all earlier successful controls and asserts the actual zero-clock/repeated-log behavior.

The Source-only checks establish an immutable command oracle. Native group-monitor authentication is implemented in the later section below; command producer/consumer/ACK adapters remain open. Monitor identity must not be fabricated as a default participant execution mode or automatically promoted to an administrator. No broad functional or visual row closes.


### Private native operational identity storage (2026-10-28; authentication adapter remains open)

The validated Original19 XML import now preserves operational Login identity and a salted scrypt password hash in a separate private collection in Memory/File and a private column in SQLite/PostgreSQL. Public migration candidates contain no credentials. Candidate metadata and private identities are replaced together under the existing store write boundary; JSON/legacy imports cannot establish native provenance and clear previous native operational credentials. Replacement validates mode/name/password consistency and asset references before either half changes. Workspace deletion removes private identities, and a delayed write cannot recreate them after deletion.

SQLite76/PostgreSQL70 upgrades start with an empty private collection: existing migration candidates do not acquire inferred credentials. File manifests without the collection remain readable. Existing historical-schema test fixtures now remove the new column before replaying old migrations, preserving every prior upgrade/failure assertion. The new suite exercises real upgrade rollback, restart, returned-object isolation, password rotation, authored password whitespace/XML entities, cross-workspace isolation, invalid imports/credentials/assets, JSON provenance rejection and deletion. Credential derivation occurs only after complete input validation. The new suite remains in mandatory unit, Original-result and PostgreSQL inventories and is also available through the focused participant-auth iteration command.

This private persistence stage supplies the later native monitor authentication without placing credentials in public migration candidates. Command delivery/ACK and additional operational modes remain separate implementation work. No complete functional or visual parity row closes.

The storage-only stage passes fresh core and web builds, all4,601 mandatory unit/frontend cases and all2,893 complete PostgreSQL integration cases with zero skips. The targeted native identity/session/Test suite passes555 cases across all four stores using actual PostgreSQL14.9; owned database/cluster cleanup is verified. Focus/workflow policy passes115 cases with one existing macOS omission for the real Linux GNU-timeout control; actionlint and diff checks pass. These local results do not replace a new full89-job qualification. The accepted shared PR remains at `e27ca9de`; this storage groundwork is not yet published.


### Native group-monitor authentication and common person mode (2026-10-28)

Validated Original XML can now authenticate the measured `monitor-group` identity as an uncoded native person. It uses the existing hashed bearer, token rotation, compare-and-revoke logout, scoped group snapshot/binding, durable password-failure policy and current validity checks. Native access validates current workspace/tenant and private provenance. Canonical participant sign-in, access and runtime reject operational identities, including a same-name stale participant entry; no administrator is created. Participant and operational identities remain exact and scope-bound.

SQLite77/PostgreSQL71 store an explicit native operational person mode. Monitor people never default to a participant execution mode. Existing native people, first suffix, content binding and Test identity survive reentry and participant/monitor role changes; mode projection does not rewrite answers, state clocks, opening times, controllers or timers. Delayed parent/Run saves cannot restore a preceding mode. The new column is transactional and starts unknown for old rows; authentication resolves current private provenance without fabricating historical stored roles. All older schema test resets drop the new column while retaining their original assertions.

The native AccessSet matches actual Source65, including its raw physical Booklet label, Test claims collected from coded participant members of the monitor's authored group under empty code, `testGroupMonitor` claims/access, empty monitor flags and absent default view settings. The monitor owns distinct real native Tests and reads the honest `monitor-group` mode without canonical controller entry. Real SQLite and PostgreSQL HTTP tests solve configured work, reject direct credentials, invalid work, replay, wrong token types and foreign ownership, and verify the native mode. The visible Chromium protocol keeps every13 previous checks and adds a14th native monitor check using actual browser WebCrypto and the same owned protected API. Its request-specific Source lock constructor500 remains the sole expected server failure, with zero unexpected failures and owned API shutdown.

This implements the measured group-monitor authentication path. Commands/ACK/polling, study/system-check authentication, additional operational Booklet memberships/view settings, live broadcast and full monitor UI/visual parity remain open. The accepted shared PR/12 refs remain at `e27ca9de`; isolated native Linux qualification is prepared separately and is not full89-job acceptance. No broad parity row closes.

Local validation: fresh core/web builds, all4,645 mandatory unit/frontend cases, all2,953 complete PostgreSQL integration cases and615 targeted native cases across the four stores pass with zero skips. Real PostgreSQL14.9 cleanup is verified. Focus/workflow policy is115pass plus the existing macOS-only Linux GNU-timeout omission; actionlint and diff checks pass. The headed browser passes14 markers, with exactly one request-specific expected Source500 and zero unexpected server failures. A new complete89-job run has not yet been requested for this candidate.


### Native command producer, durable delivery and ACK (2026-10-28; isolated candidate)

The preceding monitor backend `0299e131a215d32b9ca0411ada3aa97ccca8df15` is now independently qualified by [Linux run40641982222](https://github.com/jurei733/testcenter-rewrite/actions/runs/40641982222): all4 jobs pass, including4 native Debian controls,326 policy cases,4,645 mandatory unit/frontend cases,2,953 PostgreSQL16 cases and14 protected headed-browser markers. The shared accepted PR remains at `e27ca9de`.

[Unmodified production Source67 / run40643360991](https://github.com/jurei733/testcenter-rewrite/actions/runs/40643360991) retains all65 prior groups and adds producer boundary evidence:67 groups,1,080 genuine HTTP observations,43 independently matched pinned Source files and52 actual producer vectors bracketed by104 independent marker deliveries. Artifact12796173035 is100,519 bytes, SHA256 `847643f3938f18fa50d46cc78471ee9ad97380baea78e9c47162db50821f9196`; all27 safe members and23 protected report pointers were verified. The cumulative fixture includes the unchanged probe, composition, workflow and per-file hash manifest. It uses actual protected XML/HTTP/Apache/PHP/PostgreSQL without SQL seeds, Source patches or test mode.

Literal `PUT /monitor/command`, `GET /test/:id/commands` and `PATCH /test/:id/command/:commandId/executed` now use a separate durable native queue in Memory, File, SQLite78 and PostgreSQL72. Authentication and current ownership precede decoding. The producer retains arbitrary keywords, PHP string arguments, seconds, shared int64 command IDs and deduplicated targets. Required fields, construction and complete target resolution precede allocation; a separate durable reservation precedes SQL-stage validation and the atomic all-recipient insert. Empty targets do not allocate. Insert failures consume their ID while publishing no recipient. Literal int64 JSON numbers remain exact across decoding, persistence, filtering and serialization, including IDs beyond JavaScript safe integers.

The codec uses the pinned [PHP8.3.36 cast implementation](https://github.com/php/php-src/blob/php-8.3.36/Zend/zend_operators.c) and [numeric conversion implementation](https://github.com/php/php-src/blob/php-8.3.36/Zend/zend_strtod.c), together with the52 measured vectors. Floats use PHP precision14 and ties-to-even binary64 rounding; numeric strings and float casts retain distinct saturation/wrapping. SQL-stage behavior preserves keyword NUL truncation, varchar50 Unicode character counting, argument NUL rejection and timestamp failure timing. A SQL-valid five-digit date can be stored yet fail queue serialization. The owned PostgreSQL database explicitly requires UTF8: an initial SQL_ASCII diagnostic counted UTF8 bytes as characters and was retained, then corrected at database creation without changing the varchar constraint.

GET ignores query `lastCommandId` and applies only the strict integer/null JSON-body field. The threshold is the referenced timestamp scoped to this Test; executed rows remain lookup evidence and equal-clock rows are excluded. ACK changes only the addressed delivery flag, returning empty HTTP200 with exact reason `OK` or `OK, was already marked as executed`. Locked Tests can still receive, poll and acknowledge. Verified stored `CONNECTION=LOST` causes the measured modification timestamp and separate zero-clock raw quoted-key POLLING log on every poll while retaining LOST. Unknown native state after canonical controller entry stays unknown and produces no inferred POLLING write; it cannot block independent command delivery. Native Test reads/state writes retain their existing explicit unknown-history behavior.

Tenant, workspace, native monitor role, group binding and recipient group are rechecked inside the write boundary. Source's global Test-existence check does not grant cross-group/workspace access: out-of-scope targets return404, retaining Rewrite's isolation boundary. Test/parent deletion removes deliveries without resetting the counter. Deleting only the commander nulls its audit reference and preserves recipients' packets. Production HTTP tests, actual late SQL insert failures, File publication failure, migration rollback/restart and deletion controls cover these paths across all four stores. Every historical migration assertion is retained byte-for-byte after the new table-drop prefix.

The protected visible-browser scenario retains all14 prior markers and adds shared delivery/locked-recipient and scoped/idempotent ACK checks. Its actual Original UI iframe keeps its running controller, unit responses and timers. Exactly one request-specific Source lock constructor500 is expected; unexpected server failures remain forbidden. These checks qualify transport beside the existing UI. Native frontend producer/poll/apply/ACK adoption, complete monitor UI, study/system-check authentication, additional operational memberships/settings, native monitor session lists, live broadcast and all8 broad visual rows remain open. No broad functional or visual row closes.

For iteration, `npm run ci:focus -- original-commands` performs one fresh core build and the exact codec/lifecycle suites. Its plan remains `completeAcceptance:false`; the tests also remain in mandatory unit/Original-result inventories, and the store lifecycle suite remains in complete PostgreSQL integration. Mixed browser selections still request a fresh full build. No acceptance gate, browser mode, wait or timeout is removed.


### Native monitor materialization and session snapshots (2026-10-28; Source79)

The current monitor backend implements `GET /monitor/test-sessions` and
`GET /monitor/group/:groupName/test-sessions`. The pinned unmodified production
Source79 receipt retains all75 preceding groups and records79 groups,
1,157 real HTTP observations and48 independently matched Original files.
The cumulative oracle, HTTP observations and hash manifest are retained under
`test-fixtures/original-testcenter/source-workspace-results/native-monitor-materialization`.

Constructing an uncoded monitor Login AccessSet registers its dependent
monitorable, reusable people and every assigned unopened Test. Authored code
buckets, normalized Booklet references and separate preset attributes retain
Source's distinct rules. Existing numeric person/Test identities, opening
history, saved clocks, locks and active participant bearers survive monitor
reentry. Credential-only internal authentication, person-code entry and
`GET /session` remain independent of registration. Conditional credential
initialization cannot rotate a concurrent human login or restore a missing or
foreign parent. First Test, parent content binding and numeric identity reserve
inside the same durable writer; exhausted numbering rolls back a new Test.

A snapshot uses current Login mode/group labels, stable numeric identities and
saved native Test/Unit state. It derives locked, pending or running status and
uses the saved server Test clock. Polling does not open a Test, enter a
controller or update state. SQL snapshots and fresh monitor reservations read
identity metadata without decoding responses or unrelated group state. Active
negative controls poison genuine response/foreign-state payloads, prove full
reads fail, then exercise polling, repeated registration and a newly assigned
preset through the protected production HTTP boundary. Unknown or ambiguous
native history remains an explicit failure.

Native study monitors materialize and list only their authenticated workspace
and expose the measured group claims without inventing their own Test claims.
Source's default group-array behavior is retained. Its explicit foreign-group
access vulnerability is not copied: group monitors remain scoped to their own
group and study monitors to their workspace. Proof-of-work login, replay,
wrong token types, malformed paths, methods and cache policy are exercised on
actual SQLite and PostgreSQL HTTP servers.

Local verification passes4,805 complete unit/frontend cases and3,032 complete
PostgreSQL cases with zero failures or skips. All332 policy cases execute;
331 pass and the existing real Linux GNU-timeout control is omitted on macOS.
Fresh production builds and typechecks pass. Actual headed Chrome retains all16
native markers, zero unexpected failures and the one exact expected Source lock
constructor500. These results qualify the backend and existing transport;
production frontend monitor/poll/apply/ACK adoption, system-check authentication,
live broadcast and all8 broad visual acceptance rows remain open. No broad
parity row closes.
